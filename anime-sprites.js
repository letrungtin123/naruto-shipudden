/* Upright 3/4-view anime character sprites for Shinobi Siege.
 * Every character is drawn procedurally once per pose into an offscreen canvas
 * (facing right, origin at the feet) and then blitted, so hundreds of ninjas
 * stay cheap to render.
 *
 * Look: anime cel shading — flat base, one hard shadow tone (tinted violet), a
 * highlight tone, crisp dark linework with a heavier outer contour, and a thin
 * screen-space rim light from the top-left that is baked into every cached pose. */
(() => {
  'use strict';

  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const S = 2;          // cache pixel density
  const LIFT = 24;      // chest height: projectiles and hand-held jutsu float here
  // 8-frame run (contact, down, passing, up × 2 legs) and a 2-frame idle breathing loop.
  const RUN_N = 8;
  const FRAMES = ['idle', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'attack', 'seal', 'raise'];

  // ---------------------------------------------------------------- colors
  const RGB = new Map();
  function rgb(c) {
    let v = RGB.get(c);
    if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(c, v); }
    return v;
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    const h = v => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(x[0] + (y[0] - x[0]) * t) + h(x[1] + (y[1] - x[1]) * t) + h(x[2] + (y[2] - x[2]) * t);
  }
  const dark = (c, t = .26) => mix(c, '#1a1028', t);
  const light = (c, t = .32) => mix(c, '#ffffff', t);
  const lum = c => { const v = rgb(c); return (v[0] * .3 + v[1] * .59 + v[2] * .11) / 255; };
  // Highlight tone: dark materials get a cool sheen instead of washing out to grey.
  const gloss = c => lum(c) < .22 ? mix(c, '#8c9ccc', .32) : light(c, .3);
  const hairGloss = c => lum(c) < .22 ? mix(c, '#9fb2e8', .42) : light(c, .55);
  const rgba = (c, a) => { const v = rgb(c); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
  const SHADE = 'rgba(46,22,84,.26)';      // cel shadow tint laid over any material
  const DEEP = 'rgba(30,12,54,.34)';       // occlusion (under chin, under collars)
  const DEEP2 = 'rgba(22,8,40,.3)';        // second, deeper cel tone stacked on SHADE in folds
  const GLOSS = 'rgba(255,255,255,.16)';   // broad highlight
  const CREASE = 'rgba(34,14,60,.5)';      // fold / seam ink inside cloth
  // Key light in the body frame: from above and slightly in front of the face.
  const LX = .5, LY = -.866;

  // ---------------------------------------------------------------- poses
  // Legs: from hip [kneeX, kneeY, footX, footY]. Arms: from shoulder [elbowX, elbowY, handX, handY].
  // The run cycle is the classic ninja run: torso pitched forward, arms trailing behind and
  // alternating slightly, legs going contact → passing → contact → passing (the hip drops on contact).
  const POSES = {
    idle:   { lean: .05, legN: [-.6, 8.6, -1.3, 17], legF: [1.6, 8.5, 3, 17], armN: [-.8, 6.6, .6, 12.8], armF: [1.6, 6.5, 3.6, 12.2], run: false },
    attack: { lean: .2, legN: [4.6, 7, 8.4, 15.4], legF: [-3.6, 7.8, -8.6, 15.2], armN: [6.4, .6, 13.6, -.6], armF: [-3.8, 5, -6.4, 10.2], run: false, attack: true },
    seal:   { lean: .06, legN: [2.4, 8.2, 4, 16.6], legF: [-1.8, 8.4, -3.8, 16.6], armN: [5.6, 4.6, 10.6, .2], armF: [3.6, 4.4, 6.6, -.2], run: false, seal: true },
    // Arm thrust overhead, holding up a Rasen Shuriken.
    // The hand rises beside the back of the head so it never hides the face.
    raise:  { lean: -.06, legN: [2.8, 8.2, 4.8, 16.6], legF: [-2.2, 8.4, -4.4, 16.6], armN: [-2.4, -6.4, -3.2, -13.6], armF: [2.6, 5.6, 5.2, 10.8], run: false, raise: true }
  };
  // Run cycle: one leg goes contact → down → passing → push-off/airborne while the other
  // swings trail → high trail → passing → knee-high. Frames 4–7 swap the legs.
  // The hip height follows the supporting foot, so the body bobs (low on "down", high in the air).
  const RUN_LEGS = [
    [5.0, 6.6, 7.8, 15.2],     // contact: heel reaching forward
    [3.6, 7.4, .8, 14.6],      // down: knee bent under the weight
    [1.6, 8.4, -.6, 16.4],     // passing: straight support
    [-1.4, 8.2, -6.6, 14.6],   // push-off behind
    [-3.2, 7.8, -10.4, 11.2],  // trail: foot rising behind
    [-1.6, 8.0, -9.4, 7.4],    // high trail: heel kicked up
    [5.2, 6.2, 1.4, 12.4],     // swing: knee passing forward
    [6.6, 4.4, 6.6, 12.4]      // knee high, reaching
  ];
  const RUN_LIFT = [0, 0, 0, 1.8, 0, 0, 0, 1.8];
  // Ninja run: arms stream back; they rock gently against the legs.
  const ARM_A = [-5.6, 4.8, -12.4, 7.6], ARM_B = [-5.9, 3.4, -12.9, 4.0];
  for (let i = 0; i < RUN_N; i++) {
    const s = Math.sin(i / RUN_N * TAU + .6), mixA = v => ARM_A.map((a, j) => a + (ARM_B[j] - a) * v);
    POSES['run' + i] = {
      lean: .31 + .035 * Math.cos(i / RUN_N * TAU * 2), legN: RUN_LEGS[i], legF: RUN_LEGS[(i + 4) % RUN_N],
      armN: mixA(.5 + .5 * s), armF: mixA(.5 - .5 * s), lift: RUN_LIFT[i], run: true,
      // Secondary motion inputs: how hard cloth/hair streams back and where it is in its flutter.
      trail: 1, wave: i / RUN_N * TAU, bob: [0, -1, .4, 1, 0, -1, .4, 1][i]
    };
  }
  POSES.idle1 = Object.assign({}, POSES.idle, { breath: 1 });

  // Upper-body anchors (origin at the hip centre, before the lean rotation).
  const SH_N = [-1.8, -11.6], SH_F = [3.6, -11.8], HEAD = [1.4, -23.6];
  const HIP_N = -1.4, HIP_F = 2.2;

  // ---------------------------------------------------------------- primitives
  function paint(ctx, build, fill, outline, lw, decorate) {
    build();
    ctx.fillStyle = fill; ctx.fill();
    if (decorate) { ctx.save(); ctx.clip(); decorate(); ctx.restore(); }
    if (outline) {
      build();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = outline; ctx.lineWidth = lw || 1.1; ctx.stroke();
    }
  }
  function polar(ctx, cx, cy, list, inner) {
    ctx.beginPath();
    for (let i = 0; i < list.length; i++) {
      const a = list[i][0] * DEG, r = list[i][1];
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (inner) for (const [x, y] of inner) ctx.lineTo(x, y);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // Closed curve through the midpoints of a control polygon (soft cloth / hair shapes).
  function smooth(ctx, pts) {
    const n = pts.length, m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    ctx.beginPath();
    let p = m(n - 1); ctx.moveTo(p[0], p[1]);
    for (let i = 0; i < n; i++) { p = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], p[0], p[1]); }
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function line(ctx, pts, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Anime hair gloss: a band following an arc whose inner edge breaks into teeth.
  function shine(ctx, cx, cy, r, a0, a1, w, color, teeth = 5) {
    const n = teeth * 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (a0 + (a1 - a0) * t) * DEG, k = Math.sin(Math.PI * t) * .7 + .3;
      const rr = r + w * .45 * k;
      if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n, a = (a0 + (a1 - a0) * t) * DEG, k = Math.sin(Math.PI * t) * .7 + .3;
      const rr = r - w * .45 * k - (i % 2 ? w * .9 * k : 0);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }

  // Two-segment limb with cel shading: outline pass, shadow tone, offset lit tone, gloss.
  function seg(ctx, a, b, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function lit(a, b, d) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
    return [[a[0] + nx * d, a[1] + ny * d], [b[0] + nx * d, b[1] + ny * d]];
  }
  // Unit normal of a→b pointing toward the key light.
  function litN(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
    return [nx, ny, dx / len, dy / len];
  }
  // Cloth folds bunched at a joint: short diagonal creases running in from the shadow edge.
  function creases(ctx, a, b, w, color, ts, dir) {
    const [nx, ny, ux, uy] = litN(a, b);
    ctx.strokeStyle = color; ctx.lineWidth = .36; ctx.lineCap = 'round';
    for (let i = 0; i < ts.length; i++) {
      const m = lerp(a, b, ts[i]), k = i % 2 ? .3 : .44;
      ctx.beginPath();
      ctx.moveTo(m[0] - nx * w * k, m[1] - ny * w * k);
      ctx.quadraticCurveTo(m[0] + ux * dir * .5, m[1] + uy * dir * .5, m[0] + nx * w * .12 + ux * dir * 1.1, m[1] + ny * w * .12 + uy * dir * 1.1);
      ctx.stroke();
    }
  }
  // Two-segment limb, anime cel shading: outline, shadow tone, deeper occlusion along the
  // shadow edge, lit tone, gloss streak; cloth limbs also get fold creases at the joint.
  function limb(ctx, a, b, c, w1, w2, c1, c2, outline, o) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    seg(ctx, a, b, w1 + 2.2, outline); seg(ctx, b, c, w2 + 2.2, outline);
    seg(ctx, a, b, w1, dark(c1, .3)); seg(ctx, b, c, w2, dark(c2, .3));
    let [p, q] = lit(a, b, -w1 * .3); seg(ctx, p, q, w1 * .3, dark(c1, .5));
    [p, q] = lit(b, c, -w2 * .3); seg(ctx, p, q, w2 * .3, dark(c2, .5));
    [p, q] = lit(a, b, w1 * .19); seg(ctx, p, q, w1 * .62, c1);
    [p, q] = lit(b, c, w2 * .19); seg(ctx, p, q, w2 * .62, c2);
    [p, q] = lit(lerp(a, b, .2), lerp(a, b, .75), w1 * .3); seg(ctx, p, q, w1 * .12, gloss(c1));
    [p, q] = lit(lerp(b, c, .2), lerp(b, c, .65), w2 * .3); seg(ctx, p, q, w2 * .12, gloss(c2));
    if (o && o.folds) {
      creases(ctx, a, b, w1, rgba(dark(c1, .62), .85), o.long ? [.42, .7, .86] : [.7, .86], 1);
      creases(ctx, b, c, w2, rgba(dark(c2, .62), .85), [.14, .3], -1);
    }
  }

  // ---------------------------------------------------------------- emblems
  function cloud(ctx, x, y, s, rot = 0) {
    // Akatsuki red cloud with its white rim and a darker inner curl.
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    const blobs = [[-3.5, .5, 2.3], [-.4, -1.1, 3.1], [3.2, .2, 2.5]];
    const body = (grow) => {
      ctx.beginPath();
      for (const [bx, by, r] of blobs) { ctx.moveTo(bx + r + grow, by); ctx.arc(bx, by, r + grow, 0, TAU); }
      ctx.rect(-5.8 - grow, -.2 - grow, 11.6 + grow * 2, 2.9 + grow * 2);
    };
    ctx.fillStyle = '#f6f1ea'; body(1); ctx.fill();
    ctx.fillStyle = '#cf1f2d'; body(0); ctx.fill();
    ctx.fillStyle = '#9a1020';
    ctx.beginPath(); ctx.rect(-5.8, 1.6, 11.6, 1.1); ctx.fill();
    ctx.strokeStyle = '#f6f1ea'; ctx.lineWidth = .7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-.6, .4, 1.5, Math.PI * .9, Math.PI * 2.1); ctx.stroke();
    ctx.restore();
  }

  function plateSymbol(ctx, kind, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = .55; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'leaf') {
      // Konoha: a spiral that opens into a leaf point at the lower left.
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI / 2 + i * .44, r = .2 + i * .066;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.lineTo(-1.5, 1.9); ctx.lineTo(-.7, .7);
      ctx.moveTo(1.7, -.3); ctx.quadraticCurveTo(1.4, 1.8, -1.5, 1.9);
    } else if (kind === 'mist') {
      for (let i = 0; i < 4; i++) { const ox = -1.7 + i * 1.1; ctx.moveTo(ox - .3, -1.4); ctx.quadraticCurveTo(ox + .6, 0, ox + .1, 1.4); }
    } else if (kind === 'cloud') {
      ctx.moveTo(-2.1, .9); ctx.arc(-1.2, .3, .9, Math.PI, 0); ctx.arc(.2, -.1, 1, Math.PI, 0);
      ctx.arc(1.5, .4, .7, Math.PI, 0); ctx.lineTo(2.1, .9); ctx.closePath();
      ctx.moveTo(-1.6, 1.5); ctx.lineTo(1.6, 1.5);
    } else if (kind === 'stone') {
      ctx.moveTo(-1.7, 1.3); ctx.lineTo(-.9, -1.3); ctx.lineTo(.9, -1.3); ctx.lineTo(1.7, 1.3); ctx.closePath();
      ctx.moveTo(-.35, -1.1); ctx.lineTo(-.35, 1.2); ctx.moveTo(.35, -1.1); ctx.lineTo(.35, 1.2);
    } else if (kind === 'sound') {
      ctx.moveTo(.5, .9); ctx.lineTo(.5, -1.7); ctx.quadraticCurveTo(1.2, -1.1, 1.8, -.4);
      ctx.moveTo(.5, 1.0); ctx.ellipse(-.25, 1.0, .75, .55, -.4, 0, TAU);
    } else if (kind === 'rain') {
      for (let i = 0; i < 4; i++) { ctx.moveTo(-1.5 + i, -1.4); ctx.lineTo(-1.5 + i, 1.4); }
    } else if (kind === 'sand') {
      // Suna: an hourglass with a dot on either side.
      ctx.moveTo(-1.4, -1.5); ctx.lineTo(1.4, -1.5); ctx.lineTo(-1.4, 1.5); ctx.lineTo(1.4, 1.5); ctx.closePath();
      ctx.moveTo(-1.6, 0); ctx.arc(-1.9, 0, .3, 0, TAU); ctx.moveTo(2.2, 0); ctx.arc(1.9, 0, .3, 0, TAU);
    } else if (kind === 'taki') {
      ctx.moveTo(-1.5, -1.1); ctx.quadraticCurveTo(0, 1.8, 1.5, -1.1); ctx.moveTo(0, -1.5); ctx.lineTo(0, .7);
    } else if (kind === 'grass') {
      // Kusa: three blades of grass rising from one root.
      ctx.moveTo(0, 1.6); ctx.quadraticCurveTo(-.2, -.2, -.1, -1.8);
      ctx.moveTo(0, 1.6); ctx.quadraticCurveTo(-1.2, .4, -1.8, -.9);
      ctx.moveTo(0, 1.6); ctx.quadraticCurveTo(1.2, .4, 1.8, -.9);
    } else if (kind === 'yuga') {
      // Hot-spring mark: three rising wisps over a bowl.
      ctx.moveTo(-1.7, .6); ctx.quadraticCurveTo(0, 2.2, 1.7, .6);
      for (const ox of [-.9, 0, .9]) { ctx.moveTo(ox, .5); ctx.quadraticCurveTo(ox - .5, -.4, ox, -1.0); ctx.quadraticCurveTo(ox + .4, -1.5, ox, -1.9); }
    }
    ctx.stroke(); ctx.restore();
  }

  // ---------------------------------------------------------------- head parts
  // Head-local frame: origin at the head centre, face looking towards +X (3/4 front view).
  function headPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9.6, .6);
    ctx.arc(.2, -.6, 9.9, Math.PI * 1.02, Math.PI * 1.96);
    ctx.quadraticCurveTo(10.7, 1.2, 10.5, 3.4);           // cheekbone
    ctx.bezierCurveTo(10.3, 6.4, 8.4, 9.6, 6.1, 10.9);    // far cheek down to the chin
    ctx.bezierCurveTo(3.6, 11.9, -.9, 10.9, -3.8, 8.6);   // jaw
    ctx.bezierCurveTo(-7.4, 6.6, -9.6, 4.2, -9.6, .6);
    ctx.closePath();
  }
  function onFace(ctx, fn) { ctx.save(); headPath(ctx); ctx.clip(); fn(); ctx.restore(); }

  // Eye outline, `o` = -1 when the outer corner is on the left (near eye), +1 for the far eye.
  function eyeShape(ctx, x, y, w, h, o) {
    ctx.beginPath();
    ctx.moveTo(x - w * o * 1.02, y - h * .12);
    ctx.quadraticCurveTo(x - w * o * .3, y - h * 1.1, x + w * o * .98, y - h * .62);
    ctx.quadraticCurveTo(x + w * o * 1.1, y + h * .25, x + w * o * .55, y + h * .86);
    ctx.quadraticCurveTo(x - w * o * .25, y + h * 1.12, x - w * o * .82, y + h * .5);
    ctx.closePath();
  }

  function tomoe(ctx, x, y, r, a, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = r * .8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x - Math.cos(a) * r * 1.4, y - Math.sin(a) * r * 1.4, r * 1.6, a - .2, a + 1.3); ctx.stroke();
  }

  // Iris painter shared by the sprite eyes and the big close-up eyes (`detail` adds the fine
  // striations / extra rings that only read at large size). Draws inside the current clip.
  const SCLERA = { kakuzu: '#b81f2c', rinnegan: '#cdbcf0', byakugan: '#f2f0fa', edoRinnegan: '#1c1820' };
  const CATCH = new Set(['normal', 'sharingan', 'mangekyo', 'baryon', 'kakuzu', 'sleepy', 'kurama', 'sage']);
  function paintIris(ctx, type, e, ix, iy, irx, iry, detail) {
    const lw = irx * (detail ? .05 : .17);
    if (type === 'normal' || type === 'sleepy' || type === 'kakuzu' || type === 'baryon' || type === 'kurama' || type === 'sage') {
      const iris = type === 'baryon' ? '#ff8a1e' : type === 'kurama' ? '#ff6a14' : type === 'sage' ? '#f4b41e' : e.iris || '#3b6fd8';
      const g = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      g.addColorStop(0, dark(iris, .62)); g.addColorStop(.42, dark(iris, .12)); g.addColorStop(.7, iris); g.addColorStop(1, light(iris, .5));
      ctx.save(); ell(ctx, ix, iy, irx, iry); ctx.fillStyle = g; ctx.fill(); ctx.clip();
      // Lit crescent in the lower iris and (large only) radial striations.
      ctx.fillStyle = rgba(light(iris, .6), .55); ell(ctx, ix + irx * .1, iy + iry * .62, irx * .7, iry * .42); ctx.fill();
      if (detail) {
        ctx.strokeStyle = rgba(dark(iris, .5), .35); ctx.lineWidth = lw * .6;
        for (let i = 0; i < 28; i++) {
          const a = i / 28 * TAU, r0 = .46, r1 = .92 + (i % 3) * .03;
          ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * irx * r0, iy + Math.sin(a) * iry * r0); ctx.lineTo(ix + Math.cos(a) * irx * r1, iy + Math.sin(a) * iry * r1); ctx.stroke();
        }
        ctx.strokeStyle = rgba(light(iris, .7), .4); ctx.lineWidth = lw;
        ell(ctx, ix, iy, irx * .62, iry * .62); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = dark(iris, .66); ctx.lineWidth = lw * 1.5; ell(ctx, ix, iy, irx, iry); ctx.stroke();
      ctx.fillStyle = '#120e18';
      if (type === 'baryon' || type === 'sage') {
        // Toad / Kurama-link horizontal bar pupil.
        const bw = irx * (type === 'sage' ? 1.05 : 1.5), bh = iry * (type === 'sage' ? .36 : .28);
        ctx.beginPath(); ctx.moveTo(ix - bw / 2 + bh / 2, iy - bh / 2); ctx.lineTo(ix + bw / 2 - bh / 2, iy - bh / 2);
        ctx.arc(ix + bw / 2 - bh / 2, iy, bh / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(ix - bw / 2 + bh / 2, iy + bh / 2);
        ctx.arc(ix - bw / 2 + bh / 2, iy, bh / 2, Math.PI / 2, Math.PI * 1.5); ctx.fill();
      } else if (type === 'kurama') {
        // Nine-Tails slit pupil.
        ctx.beginPath(); ctx.moveTo(ix, iy - iry * .86); ctx.quadraticCurveTo(ix + irx * .24, iy, ix, iy + iry * .86); ctx.quadraticCurveTo(ix - irx * .24, iy, ix, iy - iry * .86); ctx.fill();
      } else if (type !== 'kakuzu') {
        ell(ctx, ix, iy - iry * .04, irx * .42, iry * .48); ctx.fill();
      }
    } else if (type === 'sharingan' || type === 'mangekyo') {
      const g = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      g.addColorStop(0, '#7a0410'); g.addColorStop(.5, '#d0121e'); g.addColorStop(1, '#ff5c50');
      ell(ctx, ix, iy, irx, iry); ctx.fillStyle = g; ctx.fill();
      const ink = '#16050a';
      ctx.strokeStyle = ink; ctx.lineWidth = lw * 1.5; ctx.stroke();
      if (type === 'sharingan') {
        ctx.lineWidth = lw * .9; ell(ctx, ix, iy, irx * .6, iry * .6); ctx.stroke();
        dot(ctx, ix, iy, irx * .24, ink);
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + i * TAU / 3;
          tomoe(ctx, ix + Math.cos(a) * irx * .6, iy + Math.sin(a) * iry * .6, irx * .15, a + Math.PI / 2, ink);
        }
      } else {
        // Itachi's Mangekyō: three curved black blades sweeping from a black hub to the rim.
        ctx.fillStyle = ink;
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + i * TAU / 3;
          const P = (ang, r) => [ix + Math.cos(ang) * irx * r, iy + Math.sin(ang) * iry * r];
          const p0 = P(a, .2), p1 = P(a + .8, .99), p3 = P(a + .42, .2);
          const c1 = P(a + .1, .7), c2 = P(a + .75, .5);
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]);
          ctx.ellipse(ix, iy, irx * .99, iry * .99, 0, a + .8, a + 1.42);
          ctx.quadraticCurveTo(c2[0], c2[1], p3[0], p3[1]); ctx.closePath(); ctx.fill();
        }
        ctx.lineWidth = lw * 1.4; ctx.strokeStyle = ink; ell(ctx, ix, iy, irx * .96, iry * .96); ctx.stroke();
        ell(ctx, ix, iy, irx * .26, iry * .26); ctx.fill();
      }
    } else if (type === 'rinnegan' || type === 'rinneSharingan') {
      // Ripples spread across the whole eye (Rinne-Sharingan: red, with nine tomoe).
      const red = type === 'rinneSharingan';
      if (red) { ell(ctx, ix, iy, irx * 1.6, iry * 1.6); ctx.fillStyle = '#d61f2c'; ctx.fill(); }
      ctx.strokeStyle = red ? '#3a0a10' : '#4a3480'; ctx.lineWidth = lw * (detail ? 1.4 : 1);
      for (const k of [.32, .6, .9, 1.22, 1.56]) { ell(ctx, ix, iy, irx * k, iry * k); ctx.stroke(); }
      dot(ctx, ix, iy, irx * .14, red ? '#2a0408' : '#3a2668');
      if (red) for (const k of [.6, .9, 1.22]) for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3 + k;
        tomoe(ctx, ix + Math.cos(a) * irx * k, iy + Math.sin(a) * iry * k, irx * .1, a + Math.PI / 2, '#2a0408');
      }
    } else if (type === 'edoRinnegan') {
      // Edo Tensei: black sclera round a lavender Rinnegan iris with its ripples.
      const g = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
      g.addColorStop(0, '#9c88d0'); g.addColorStop(.55, '#c8b6f0'); g.addColorStop(1, '#e6dcff');
      ell(ctx, ix, iy, irx * 1.02, iry * 1.02); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#4a3480'; ctx.lineWidth = lw;
      for (const k of [.3, .58, .86]) { ell(ctx, ix, iy, irx * k, iry * k); ctx.stroke(); }
      dot(ctx, ix, iy, irx * .14, '#3a2668');
    } else if (type === 'byakugan') {
      ctx.strokeStyle = '#b8b0d4'; ctx.lineWidth = lw; ell(ctx, ix, iy, irx * .82, iry * .82); ctx.stroke();
      ell(ctx, ix, iy + iry * .4, irx, iry * .5); ctx.fillStyle = 'rgba(190,176,226,.35)'; ctx.fill();
      if (detail) { ctx.strokeStyle = 'rgba(170,160,210,.35)'; ell(ctx, ix, iy, irx * .5, iry * .5); ctx.stroke(); }
    } else if (type === 'small') {
      dot(ctx, ix + irx * .05, iy - iry * .05, Math.max(.42, irx * .3), '#111');
    }
  }

  function drawEye(ctx, x, y, w, h, e, outline, near) {
    const type = e.type || 'normal', o = near ? -1 : 1;
    const ix = x + w * .16, iy = y + h * .14, irx = w * .74, iry = h * .86;
    if (e.ring) {
      // Gaara's insomnia rings: a heavy dark smudge hugging the eye, thickest at the outer corner.
      ctx.save(); ctx.translate(x, y); ctx.scale(1.38, 1.3); ctx.translate(-x - w * o * .08, -y);
      eyeShape(ctx, x, y, w, h, o); ctx.fillStyle = 'rgba(30,14,22,.88)'; ctx.fill();
      ctx.restore();
    }
    ctx.save();
    eyeShape(ctx, x, y, w, h, o);
    ctx.fillStyle = SCLERA[type] || '#fdfcf8';
    ctx.fill();
    ctx.clip();
    paintIris(ctx, type, e, ix, iy, irx, iry, false);
    // Upper lid casts a two-step shadow over the eyeball.
    if (type !== 'blank') {
      ctx.fillStyle = 'rgba(40,24,60,.24)'; ell(ctx, x, y - h * .98, w * 1.8, h * .7); ctx.fill();
      ctx.fillStyle = 'rgba(30,14,50,.22)'; ell(ctx, x, y - h * 1.12, w * 1.8, h * .45); ctx.fill();
    }
    if (type === 'edoRinnegan') dot(ctx, ix - irx * .36, iy - iry * .4, Math.max(.3, w * .18), 'rgba(255,255,255,.75)');
    if (CATCH.has(type)) {
      dot(ctx, ix - irx * .34, iy - iry * .36, Math.max(.42, w * .28), '#ffffff');
      dot(ctx, ix + irx * .36, iy + iry * .42, Math.max(.24, w * .13), 'rgba(255,255,255,.9)');
    }
    if (type === 'sleepy') {
      ctx.fillStyle = e.lid || '#e9c5a6'; ctx.fillRect(x - w * 2, y - h * 2, w * 4, h * 1.85);
    }
    ctx.restore();
    // Lash line — the main anime eye read — a filled crescent, heavy at the outer corner,
    // with the flick, a fine double-lid crease above and a light lower lash line.
    ctx.fillStyle = outline; ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const top = type === 'sleepy' ? y - h * .12 : y - h * .62;
    const th = near ? .62 : .5;
    ctx.beginPath();
    ctx.moveTo(x - w * o * 1.08, y - h * .08);
    if (type === 'sleepy') ctx.quadraticCurveTo(x, y - h * .32, x + w * o * 1.02, top);
    else ctx.quadraticCurveTo(x - w * o * .3, y - h * 1.16, x + w * o * 1.02, top);
    ctx.lineTo(x + w * o * .9, top + th * .5);
    if (type === 'sleepy') ctx.quadraticCurveTo(x, y - h * .32 + th, x - w * o * 1.0, y - h * .08 + th * .7);
    else ctx.quadraticCurveTo(x - w * o * .3, y - h * 1.16 + th * 1.5, x - w * o * 1.0, y - h * .08 + th * .7);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = near ? .7 : .6;
    ctx.beginPath(); ctx.moveTo(x - w * o * 1.08, y - h * .08); ctx.quadraticCurveTo(x - w * o * .3, y - h * 1.16, x + w * o * 1.02, top); ctx.stroke();
    const fl = e.fem ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x - w * o * .7, y - h * .74);
    ctx.lineTo(x - w * o * (1.48 + .25 * fl), y - h * (.38 + .35 * fl));
    ctx.lineTo(x - w * o * 1.08, y + h * .06);
    ctx.closePath(); ctx.fill();
    if (type !== 'sleepy') {
      ctx.strokeStyle = rgba(outline.length === 7 ? outline : '#000000', .45); ctx.lineWidth = .28;
      ctx.beginPath(); ctx.moveTo(x - w * o * .9, y - h * 1.02); ctx.quadraticCurveTo(x - w * o * .2, y - h * 1.38, x + w * o * .7, y - h * 1.0); ctx.stroke();
    }
    ctx.strokeStyle = outline; ctx.lineWidth = .42;
    ctx.beginPath(); ctx.moveTo(x - w * o * .9, y + h * .5); ctx.quadraticCurveTo(x - w * o * .1, y + h * 1.05, x + w * o * .45, y + h * .88); ctx.stroke();
  }

  function brow(ctx, x0, y0, x1, y1, w, color) {
    // Tapered brow, thick at (x0,y0).
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w * .5, y0 + ny * w * .5);
    ctx.quadraticCurveTo((x0 + x1) / 2 + nx * w * .1 - ny * .5 * 0, (y0 + y1) / 2 - w * .55, x1, y1);
    ctx.quadraticCurveTo((x0 + x1) / 2 - nx * w * .2, (y0 + y1) / 2 + w * .1, x0 - nx * w * .5, y0 - ny * w * .5);
    ctx.closePath(); ctx.fill();
  }

  function drawMouth(ctx, kind, outline, lip) {
    ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = .7;
    ctx.beginPath();
    if (kind === 'grin' || kind === 'shout') {
      if (kind === 'grin') { ctx.moveTo(3.4, 6.5); ctx.quadraticCurveTo(6.4, 10.2, 9.2, 6.2); ctx.quadraticCurveTo(6.2, 7.2, 3.4, 6.5); }
      else { ctx.moveTo(4.2, 6.6); ctx.quadraticCurveTo(4.6, 10.4, 7, 10); ctx.quadraticCurveTo(9.2, 9.2, 8.8, 6.2); ctx.quadraticCurveTo(6.4, 6.8, 4.2, 6.6); }
      ctx.closePath();
      ctx.fillStyle = '#6e1820'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#e8606a'; ell(ctx, 6.4, 10.2, 2.2, 1.5); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 5.6, 7, 1.7);
      ctx.restore();
      ctx.stroke();
      return;
    }
    if (kind === 'shark') {
      ctx.moveTo(2.2, 6.2); ctx.quadraticCurveTo(6, 9.4, 9.8, 5.6); ctx.quadraticCurveTo(6, 6.8, 2.2, 6.2); ctx.closePath();
      ctx.fillStyle = '#4a141c'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(2, 5.8);
      for (let i = 0; i < 7; i++) ctx.lineTo(2.6 + i * 1.05, i % 2 ? 6.2 : 7.7);
      ctx.lineTo(10, 5.4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3, 9);
      for (let i = 0; i < 6; i++) ctx.lineTo(3.4 + i * 1.05, i % 2 ? 8.6 : 7.4);
      ctx.lineTo(9.6, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(2.2, 6.2); ctx.quadraticCurveTo(6, 9.4, 9.8, 5.6); ctx.quadraticCurveTo(6, 6.8, 2.2, 6.2); ctx.stroke();
      return;
    }
    if (kind === 'smile') { ctx.moveTo(4.4, 7); ctx.quadraticCurveTo(6.6, 8.6, 8.8, 6.7); }
    else if (kind === 'frown') { ctx.moveTo(4.8, 7.9); ctx.quadraticCurveTo(6.6, 6.9, 8.6, 7.5); }
    else if (kind === 'smirk') { ctx.moveTo(4.6, 7.4); ctx.quadraticCurveTo(6.8, 7.9, 8.9, 6.2); }
    else if (kind === 'lips') {
      ell(ctx, 6.8, 7.4, 1.5, .62); ctx.fillStyle = lip || '#9a5a8c'; ctx.fill();
      ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(5.4, 7.4); ctx.lineTo(8.2, 7.3); ctx.stroke(); return;
    } else { ctx.moveTo(5.2, 7.5); ctx.quadraticCurveTo(6.6, 7.8, 8.1, 7.3); }
    ctx.stroke();
  }

  function drawBand(ctx, band, outline, pose) {
    if (!band) return;
    const cloth = band.cloth || '#1e2230', plate = band.plate || '#c9d1da';
    // Knot tails: hang behind the head at rest, stream back and flutter when running.
    const run = pose && pose.run, wv = run ? Math.sin((pose.wave || 0) * 2) : 0;
    const t1 = run ? -.55 - wv * .14 : pose && pose.attack ? -.25 : pose && pose.breath ? .04 : 0;
    const t2 = run ? -.85 + wv * .18 : pose && pose.attack ? -.4 : 0;
    ctx.save(); ctx.translate(-9.4, -5.6); ctx.rotate(t2); ctx.translate(9.4, 5.6);
    paint(ctx, () => smooth(ctx, [[-9.4, -6], [-11.8, -3.4], [-12.8, -.4 + wv * .6], [-11.6, -.1], [-10.4, -2], [-8.8, -3.8]]), dark(cloth, .18), outline, .8,
      () => { ctx.fillStyle = DEEP2; ctx.fillRect(-14, -3, 4, 4); });
    ctx.restore();
    ctx.save(); ctx.translate(-9.4, -5.8); ctx.rotate(t1); ctx.translate(9.4, 5.8);
    paint(ctx, () => smooth(ctx, [[-9.2, -7.2], [-12.4, -6.6 - wv * .5], [-14.8, -4.4], [-14.2, -3.2], [-11.8, -3.8 + wv * .4], [-9.2, -4.4]]), cloth, outline, .8,
      () => {
        ctx.fillStyle = SHADE; ctx.fillRect(-18, -4.6, 10, 4);
        ctx.strokeStyle = rgba(light(cloth, .3), .5); ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(-10, -6.6); ctx.quadraticCurveTo(-12.6, -6, -14, -4.6); ctx.stroke();
      });
    ctx.restore();
    // Knot.
    paint(ctx, () => ell(ctx, -9.5, -5.7, 1.3, 1.5), dark(cloth, .08), outline, .7);
    paint(ctx, () => poly(ctx, [[-9.9, -8.6], [9.8, -6.8], [10.4, -3.0], [-9.6, -4.4]]), cloth, outline, .9, () => {
      ctx.fillStyle = SHADE; ctx.fillRect(-12, -5.6, 26, 3);
      ctx.fillStyle = DEEP2; ctx.fillRect(-12, -4.6, 7, 3);
      ctx.fillStyle = rgba(light(cloth, .35), .35); ctx.fillRect(-12, -8.8, 26, .55);
    });
    const wide = band.wide ? 1.6 : 0;
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-.6 - wide * 2, -8.6 - wide * .3); ctx.lineTo(9.4, -7.6 - wide * .3); ctx.quadraticCurveTo(10.6, -5.4, 9.7, -2.8 + wide * .3);
      ctx.lineTo(-.6 - wide * 2, -3.4 + wide * .3); ctx.quadraticCurveTo(-1.4 - wide * 2, -6, -.6 - wide * 2, -8.6 - wide * .3); ctx.closePath();
    }, plate, outline, .8, () => {
      const g = ctx.createLinearGradient(0, -8.6, 0, -3.2);
      g.addColorStop(0, light(plate, .55)); g.addColorStop(.45, plate); g.addColorStop(1, dark(plate, .28));
      ctx.fillStyle = g; ctx.fillRect(-6, -10, 18, 8);
      // Bevel: lit top rim, dark bottom rim, then two metallic glint streaks.
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-6, -8.9, 18, .7);
      ctx.fillStyle = rgba(dark(plate, .5), .55); ctx.fillRect(-6, -3.9, 18, .8);
      ctx.fillStyle = 'rgba(30,30,50,.24)'; ctx.fillRect(-1.6 - wide * 2, -10, 1.75, 8);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.moveTo(6.4, -8.4); ctx.lineTo(7.6, -8.3); ctx.lineTo(6.2, -3); ctx.lineTo(5.2, -3.1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.moveTo(8.2, -8.2); ctx.lineTo(8.7, -8.1); ctx.lineTo(7.5, -3.2); ctx.lineTo(7.0, -3.2); ctx.fill();
    });
    const rv = dark(plate, .5);
    for (const [x, y] of [[.5 - wide * 2, -7.6], [8.7, -6.8], [.5 - wide * 2, -4.3], [8.9, -3.8]]) { dot(ctx, x, y, .34, rv); dot(ctx, x - .1, y - .1, .13, 'rgba(255,255,255,.8)'); }
    // Engraved symbol: dark groove with a light lower lip.
    if (band.symbol === 'nin') {
      // Allied Shinobi Forces: 忍 engraved on every plate.
      ctx.font = 'bold 4.6px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText('忍', 4.9, -5.4);
      ctx.fillStyle = band.mark || dark(plate, .7); ctx.fillText('忍', 4.7, -5.7);
    } else {
      plateSymbol(ctx, band.symbol || 'leaf', 4.75, -5.45, .95, 'rgba(255,255,255,.7)');
      plateSymbol(ctx, band.symbol || 'leaf', 4.6, -5.8, .95, dark(plate, .66));
    }
    if (band.slash) { line(ctx, [[.4, -4.5], [9.2, -6.7]], 'rgba(255,255,255,.6)', .4); line(ctx, [[.4, -4.75], [9.2, -6.95]], '#25252c', .6); }
  }

  function drawHead(ctx, spec, pose) {
    const h = spec.head, O = spec.outline, skin = spec.skin, shade = spec.skinShade || mix(skin, '#b0607a', .3);
    if (h.back) h.back(ctx, spec);
    paint(ctx, () => headPath(ctx), skin, O, 1.15, () => {
      // Cel shadow on the back of the skull and the near jaw; soft cheek blush; forehead light.
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.moveTo(-3.6, -12); ctx.quadraticCurveTo(-1.6, 1, -2.4, 12); ctx.lineTo(-14, 12); ctx.lineTo(-14, -12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, 9.4); ctx.quadraticCurveTo(2.4, 9.4, 6.6, 11.4); ctx.lineTo(-3, 13); ctx.fill();
      if (h.blush !== false) {
        ctx.fillStyle = 'rgba(255,110,110,.2)';
        ell(ctx, 2, 6.4, 2.2, 1.05); ctx.fill(); ell(ctx, 8.9, 6.1, 1.1, .9); ctx.fill();
      }
      ctx.fillStyle = light(skin, .3); ell(ctx, 6.4, -4.4, 3.6, 1.6, -.15); ctx.fill();
      // Second, deeper tone: the hairline's cast shadow, the eye sockets' inner corner,
      // and the occlusion under the jaw where it turns away from the light.
      const deep = mix(shade, '#5a2a52', .35);
      ctx.fillStyle = rgba(deep, .55);
      ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-5.6, -12); ctx.quadraticCurveTo(-4, 1, -4.6, 12); ctx.lineTo(-14, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, 10.2); ctx.quadraticCurveTo(2.4, 10.6, 7.2, 11.6); ctx.lineTo(-3, 13); ctx.fill();
      if (h.band) { ctx.fillStyle = shade; ctx.fillRect(-12, -3.6, 26, 1.5); ctx.fillStyle = rgba(deep, .5); ctx.fillRect(-12, -3.6, 26, .6); }
      else if (!h.noHairShadow) { ctx.fillStyle = rgba(shade, .85); smooth(ctx, [[-5, -6], [3.4, -5.6], [10.6, -4.6], [10.6, -3.2], [3.4, -4.2], [-5, -4.2]]); ctx.fill(); }
      ctx.fillStyle = rgba(shade, .5); ell(ctx, 5.1, 1.6, .9, 1.6); ctx.fill();
    });
    // Ear
    paint(ctx, () => ell(ctx, -3.4, 2, 2.1, 2.9), skin, O, .85, () => {
      ctx.fillStyle = shade; ell(ctx, -3.1, 2.3, 1.05, 1.8); ctx.fill();
    });
    if (h.ear) h.ear(ctx, spec);
    if (h.hair) h.hair(ctx, spec);
    const e = h.eyes || {};
    if (!h.noEyes) {
      drawEye(ctx, 2.4, 2.2, 2.1, 2.65, e, O, true);
      drawEye(ctx, 7.95, 2.1, 1.48, 2.45, e, O, false);
    }
    // Brows and nose
    if (h.brows !== false) {
      const bc = h.browColor || O, bw = h.browW || (h.brows === 'thick' ? 1.7 : .72);
      const ang = h.browAngle === 'angry' ? .9 : h.browAngle === 'sad' ? -.6 : 0;
      brow(ctx, 4.6, -1.3 + ang, .2, -1.6 - ang * .3, bw, bc);
      brow(ctx, 6.6, -1.4 + ang, 9.6, -1.4 - ang * .3, bw * .85, bc);
    }
    // Nose: shadow-side stroke, a nostril tick and a tiny highlight on the tip.
    line(ctx, [[8.9, 4.0], [9.7, 5.2], [9.0, 5.5]], dark(shade, .25), .55);
    dot(ctx, 9.5, 4.5, .28, 'rgba(255,255,255,.55)');
    const mouth = pose && pose.attack && h.attackMouth ? h.attackMouth : h.mouth || 'neutral';
    if (!h.mask) drawMouth(ctx, mouth, O, h.lipColor);
    if (h.marks) h.marks(ctx, spec);
    if (h.mask) h.mask(ctx, spec);
    if (h.band) drawBand(ctx, h.band, O, pose);
    if (h.front) h.front(ctx, spec, pose);
  }

  // ---------------------------------------------------------------- hair styles
  // Spiky mass helper: polar spikes around (cx, cy), closed across the face by `inner`.
  function spikeHair(ctx, spec, c, spikes, inner, opts = {}) {
    const O = spec.outline, cx = opts.cx ?? -.4, cy = opts.cy ?? -2.2;
    paint(ctx, () => polar(ctx, cx, cy, spikes, inner), c, O, 1.05, () => {
      // Shadow everywhere except a lit cap on the top-front, then gloss and strand lines.
      ctx.fillStyle = dark(c, .3); ctx.fillRect(-30, -30, 60, 60);
      ctx.fillStyle = c; ell(ctx, cx + 3.2, cy - 5.4, 12.6, 9.6, -.25); ctx.fill();
      ctx.fillStyle = mix(c, dark(c, .3), .5); ell(ctx, cx - 8, cy + 4, 7, 9); ctx.fill();
      shine(ctx, cx + 1, cy + .4, 9.2, -150, -60, 2.2, hairGloss(c), 5);
      ctx.strokeStyle = dark(c, .38); ctx.lineWidth = .5;
      for (let i = 0; i < spikes.length; i += 2) {
        const a = spikes[i][0] * DEG, r = spikes[i][1];
        if (r < 13) continue;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * .86, cy + Math.sin(a) * r * .86);
        ctx.lineTo(cx + Math.cos(a + .08) * r * .6, cy + Math.sin(a + .08) * r * .6); ctx.stroke();
      }
    });
  }
  // Swept spiky hair in the Kishimoto style: every spike is a curved blade (convex leading
  // edge, concave trailing edge) so the whole mop seems to stream backwards. `tips` are
  // [angleDeg, length] around (cx, cy); valleys sit between them at radius `valley`.
  function edgeCtrl(a, b, k) {
    return [(a[0] + b[0]) / 2 - (b[1] - a[1]) * k, (a[1] + b[1]) / 2 + (b[0] - a[0]) * k];
  }
  function sweptPath(ctx, tips, o) {
    const P = (a, r) => [o.cx + Math.cos(a * DEG) * r, o.cy + Math.sin(a * DEG) * r];
    const segs = [];
    let p = P(o.start[0], o.start[1]);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 0; i < tips.length; i++) {
      const [a, len, vr] = tips[i];
      const last = i === tips.length - 1;
      const T = P(a, len);
      const V = last ? P(o.end[0], o.end[1]) : P((a + tips[i + 1][0]) / 2, vr || o.valley);
      const c1 = edgeCtrl(p, T, o.sweep), c2 = edgeCtrl(T, V, -o.sweep * .55);
      ctx.quadraticCurveTo(c1[0], c1[1], T[0], T[1]);
      ctx.quadraticCurveTo(c2[0], c2[1], V[0], V[1]);
      segs.push({ a, T, V, c2, B: P(a, o.valley * .72) });
      p = V;
    }
    if (o.inner) for (const [x, y] of o.inner) ctx.lineTo(x, y);
    ctx.closePath();
    return segs;
  }
  function sweptHair(ctx, spec, c, tips, opts = {}) {
    const O = spec.outline;
    const o = Object.assign({ cx: -.6, cy: -2.4, valley: 12, sweep: .2, start: [-8, 10.8], end: [-232, 10.6], inner: HAIR_LINE }, opts);
    let segs = null;
    const build = () => { segs = sweptPath(ctx, tips, o); };
    paint(ctx, build, c, O, 1.1, () => {
      const sh = dark(c, .3), deep = dark(c, .46);
      // Trailing half of every spike sits in shadow: the two-tone spike read.
      ctx.fillStyle = sh;
      for (const s of segs) {
        ctx.beginPath(); ctx.moveTo(s.B[0], s.B[1]); ctx.lineTo(s.T[0], s.T[1]);
        ctx.quadraticCurveTo(s.c2[0], s.c2[1], s.V[0], s.V[1]); ctx.closePath(); ctx.fill();
      }
      // Lower/back of the mass in shadow, deepest at the nape.
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.moveTo(-30, -4); ctx.quadraticCurveTo(-8, 2, 2, -3.4); ctx.lineTo(4, 14); ctx.lineTo(-30, 14); ctx.fill();
      ctx.fillStyle = rgba(deep, .55); ell(ctx, o.cx - 10, o.cy + 9, 5.5, 4.5); ctx.fill();
      // Deep tone in each valley between two spikes: separates the locks.
      ctx.fillStyle = rgba(deep, .8);
      for (const s of segs) {
        const m = lerp(s.V, s.B, .45);
        ctx.beginPath(); ctx.moveTo(s.V[0], s.V[1]); ctx.lineTo(m[0] + (s.T[0] - s.B[0]) * .05, m[1] + (s.T[1] - s.B[1]) * .05);
        ctx.lineTo(lerp(s.V, s.T, .25)[0], lerp(s.V, s.T, .25)[1]); ctx.closePath(); ctx.fill();
      }
      // Ring-shaped anime gloss across the crown.
      shine(ctx, o.cx + 1.6, o.cy - .4, 10.4, -158, -62, 2.4, o.gloss || hairGloss(c), 6);
      // Strand strokes from each tip back toward the root.
      ctx.strokeStyle = deep; ctx.lineWidth = .45; ctx.lineCap = 'round';
      for (const s of segs) {
        ctx.beginPath(); ctx.moveTo(s.T[0] + (s.B[0] - s.T[0]) * .12, s.T[1] + (s.B[1] - s.T[1]) * .12);
        ctx.quadraticCurveTo(s.c2[0] * .3 + s.B[0] * .7, s.c2[1] * .3 + s.B[1] * .7, s.B[0], s.B[1]); ctx.stroke();
      }
      // Occlusion where the mop meets the face / headband.
      if (o.inner && o.inner.length > 1) {
        ctx.strokeStyle = rgba(deep, .7); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(o.inner[0][0], o.inner[0][1]); for (const [x, y] of o.inner) ctx.lineTo(x, y); ctx.stroke();
      }
    });
  }
  // Darker spikes peeking out behind the main mass give the mop depth and volume.
  function sweptBack(ctx, spec, c, tips, opts = {}) {
    const o = Object.assign({ cx: -.6, cy: -2.4, valley: 11, sweep: .18, start: [-40, 9], end: [-226, 9], inner: [[-.6, 2]] }, opts);
    paint(ctx, () => sweptPath(ctx, tips, o), dark(c, .38), spec.outline, 1.05, () => {
      ctx.fillStyle = dark(c, .5); ell(ctx, o.cx - 8, o.cy + 6, 9, 8); ctx.fill();
    });
  }

  // Locks (bangs) — each [rootX, rootY, tipX, tipY, width, bend].
  function locks(ctx, spec, c, list, lw = .8) {
    for (const [x0, y0, x1, y1, w, bend = 0] of list) {
      const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
      paint(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x0 - w, y0);
        ctx.quadraticCurveTo(mx - w * .6, my, x1, y1);
        ctx.quadraticCurveTo(mx + w * .7, my, x0 + w, y0 + .3);
        ctx.closePath();
      }, c, spec.outline, lw, () => {
        ctx.fillStyle = dark(c, .26);
        ctx.beginPath(); ctx.moveTo(x0 - w * 1.4, y0); ctx.quadraticCurveTo(mx - w * .9, my, x1 - .5, y1 + .5); ctx.lineTo(x0 - w * .2, y0); ctx.fill();
        // Darker inner strand down the lock and a deep root where it leaves the head.
        ctx.strokeStyle = dark(c, .44); ctx.lineWidth = .32;
        ctx.beginPath(); ctx.moveTo(x0 + w * .2, y0 + 1); ctx.quadraticCurveTo(mx + w * .1, my, x1 + (x0 - x1) * .12, y1 + (y0 - y1) * .12); ctx.stroke();
        ctx.fillStyle = rgba(dark(c, .5), .6); ell(ctx, x0, y0, w * 1.3, 1.1); ctx.fill();
        ctx.fillStyle = hairGloss(c); ell(ctx, x0 + (x1 - x0) * .2 + w * .3, y0 + (y1 - y0) * .2, w * .26, Math.abs(y1 - y0) * .16); ctx.fill();
      });
    }
  }
  // Shadow the hair casts onto the forehead and cheeks under a fringe.
  function fringeShadow(ctx, pts) {
    onFace(ctx, () => { ctx.fillStyle = 'rgba(120,50,70,.28)'; smooth(ctx, pts); ctx.fill(); });
  }

  const HAIR_LINE = [[-5.6, 6], [-4.6, 1], [-2.2, -4.4], [3.4, -6.2], [9.4, -5.6]];
  // Naruto's spikes: a short one over the brow, tall ones on the crown, long ones streaming back.
  const NARUTO_TIPS = [[-28, 17.8], [-57, 22], [-87, 23.6], [-117, 23.2], [-145, 22.2], [-171, 20.6], [-196, 17.8], [-218, 14.6]];
  const NARUTO_BACK_TIPS = [[-72, 21.4], [-102, 22.2], [-131, 21.6], [-158, 20.2], [-184, 17.8], [-207, 15.2]];
  const HAIR = {
    // Naruto: big spiky blond mop.
    // Naruto: the big swept-back spiky blond mop (Shippuden silhouette).
    naruto(color) {
      return (ctx, spec) => sweptHair(ctx, spec, color || '#ffd43b', NARUTO_TIPS, { valley: 14.2, sweep: .2 });
    },
    narutoBack(color) {
      return (ctx, spec) => sweptBack(ctx, spec, color || '#ffd43b', NARUTO_BACK_TIPS, { valley: 13 });
    },
    narutoFringe(color) {
      // Shippuden fringe: pointed locks framing the face and spilling over the plate's top edge.
      return (ctx, spec) => {
        const c = color || '#ffd43b';
        locks(ctx, spec, c, [
          [-1.6, -8.4, -3.4, 4.6, 1.7, -1.4], [9.4, -7.6, 11.2, 3.4, 1.35, .9],
          [.4, -8.8, -.2, -1.2, 1.35, -.4], [1.6, -8.8, 2.6, -5.2, 1.3, .2],
          [4.6, -8.6, 4.4, -6.2, 1.1, 0], [7.6, -8.2, 8.2, -5.4, 1.2, .2]
        ], .85);
      };
    },
    spiky(color, opts = {}) {
      const len = opts.len || 1;
      const count = opts.count || 7, pts = [[-8, 11]];
      for (let i = 0; i < count; i++) {
        const a = -22 - i * (210 / count);
        pts.push([a, 11.6 + (opts.tips?.[i] ?? 6.5) * len], [a - 105 / count, 11.4]);
      }
      return (ctx, spec) => spikeHair(ctx, spec, color, pts, [[-5.4, 6], [-4.6, 1], [-2, -4.4], [3.4, -6.2], [9.4, -5.4]], { cy: -2 });
    },
    smooth(color, opts = {}) {
      // Rounded cap with a parting; optional bangs and length.
      return (ctx, spec) => {
        const O = spec.outline, c = color;
        paint(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(10.2, -3.2);
          ctx.quadraticCurveTo(11.6, -13, 1, -12.8);
          ctx.quadraticCurveTo(-11.8, -12.4, -11.2, 1);
          ctx.lineTo(-10.6, opts.nape ?? 7.4);
          ctx.lineTo(-5.4, 6.4); ctx.lineTo(-4.4, 1); ctx.lineTo(-2, -4.6);
          ctx.quadraticCurveTo(3.6, -6.8, 10.2, -3.2); ctx.closePath();
        }, c, O, 1.05, () => {
          ctx.fillStyle = dark(c, .3); ctx.fillRect(-20, -20, 40, 40);
          ctx.fillStyle = c; ell(ctx, 2.4, -8, 11, 7.4, -.2); ctx.fill();
          // Deep tone at the nape and along the face edge.
          ctx.fillStyle = rgba(dark(c, .5), .7); ell(ctx, -9, 4, 4, 6); ctx.fill();
          ctx.strokeStyle = rgba(dark(c, .5), .7); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-5.4, 6.4); ctx.lineTo(-4.4, 1); ctx.lineTo(-2, -4.6); ctx.quadraticCurveTo(3.6, -6.8, 10.2, -3.2); ctx.stroke();
          shine(ctx, .2, -1.6, 9.4, -150, -55, 2, hairGloss(c), 6);
          ctx.strokeStyle = rgba(dark(c, .45), .6); ctx.lineWidth = .4;
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-3 + i * 2.6, -12.6); ctx.quadraticCurveTo(-6.4 + i * 1.8, -4, -9.4 + i * 1.4, 5 - i * .6); ctx.stroke(); }
        });
        if (opts.bangs) {
          fringeShadow(ctx, opts.bangs.map(([x, w, y2]) => [x + .6, y2 + .8]).concat([[10, -6], [-1, -7]]));
          locks(ctx, spec, c, opts.bangs.map(([x, w, y2]) => {
            const side = x > 5 ? 1 : x < 2 ? -1 : 0;
            return [x - side * .2, -8.4, x + side * 1.1, y2, w * 1.25, side * .9];
          }), .75);
        }
      };
    },
    longBack(color, length, width = 11, opts = {}) {
      // Long hair drape drawn behind the head and body.
      return (ctx, spec) => {
        paint(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-8, -7);
          ctx.quadraticCurveTo(-width - 2.4, 1, -width, length * .5);
          ctx.quadraticCurveTo(-width + .6, length * .8, -width + 1.2, length + 1.2);
          // Ragged ends: the mass breaks into pointed strands at the tips.
          if (opts.split) { ctx.lineTo(-6.6, length - .4); ctx.lineTo(-5.2, length + 2); ctx.lineTo(-4.4, length - 1); ctx.lineTo(-2.4, length + 1.4); }
          else {
            const x0 = -width + 1.2, x1 = -1.6, n = 4;
            for (let i = 1; i <= n; i++) {
              const xv = x0 + (x1 - x0) * (i - .5) / n, xt = x0 + (x1 - x0) * i / n;
              ctx.lineTo(xv, length - .6 - (i % 2) * .6); ctx.lineTo(xt + .3, length + 1.8 - (i % 2) * 1.1);
            }
          }
          ctx.quadraticCurveTo(-2.4, length * .5, 2, 4);
          ctx.closePath();
        }, color, spec.outline, 1.05, () => {
          ctx.fillStyle = dark(color, .28); ctx.fillRect(-30, 0, 60, length + 10);
          ctx.fillStyle = color; ell(ctx, -width * .4, -2, width * .7, 7); ctx.fill();
          // Lit outer strand band on the key-light side, deep tone toward the body.
          ctx.fillStyle = rgba(color, .85); ctx.beginPath(); ctx.moveTo(-width - 2, 0); ctx.quadraticCurveTo(-width - .6, length * .5, -width + .6, length + 2);
          ctx.lineTo(-width + 2.6, length + 2); ctx.quadraticCurveTo(-width + 1.2, length * .5, -width + .4, 0); ctx.fill();
          ctx.fillStyle = rgba(dark(color, .5), .7); ctx.fillRect(-3.6, 0, 8, length + 4);
          ctx.strokeStyle = dark(color, .45); ctx.lineWidth = .45;
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-4.6 - i * 1.1, 0); ctx.quadraticCurveTo(-6.4 - i * 1.3, length * .5, -3.6 - i * 1.15, length + 1); ctx.stroke(); }
          shine(ctx, -width * .45 - 1, length * .22, width * .6, 120, 240, 1.6, hairGloss(color), 4);
          ctx.strokeStyle = hairGloss(color); ctx.lineWidth = .6;
          ctx.beginPath(); ctx.moveTo(-width + 1.6, 2); ctx.quadraticCurveTo(-width + .4, length * .4, -width + 1.8, length * .72); ctx.stroke();
        });
      };
    }
  };

  // ---------------------------------------------------------------- body
  function torsoPath(ctx, bulk = 0) {
    const b = bulk;
    ctx.beginPath();
    ctx.moveTo(-5.4 - b * .4, .4);
    ctx.bezierCurveTo(-6.2 - b * .6, -3.4, -7.2 - b, -6.6, -6.8 - b, -10);
    ctx.quadraticCurveTo(-6.4 - b, -13, -3.4, -13.2);
    ctx.lineTo(4.2, -13.3);
    ctx.quadraticCurveTo(7.6 + b, -12.9, 7.6 + b, -9.6);
    ctx.bezierCurveTo(7.8 + b, -6.8, 6.2 + b * .6, -4.4, 6.4 + b * .5, .4);
    ctx.closePath();
  }
  // Generic cloth shading laid over whatever a torso painter drew.
  function torsoShade(ctx, bulk = 0) {
    ctx.fillStyle = SHADE;
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-3.2 - bulk * .4, -16); ctx.quadraticCurveTo(-5.2 - bulk * .4, -7, -2.6, 2); ctx.lineTo(-14, 2); ctx.fill();
    ctx.fillStyle = DEEP; ell(ctx, 3, -13.4, 5.2, 2); ctx.fill();
    ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-6, -.8); ctx.quadraticCurveTo(1, -2.6, 9, -1); ctx.lineTo(9, 2); ctx.lineTo(-6, 2); ctx.fill();
    // Deeper occlusion tone: hugging the back edge, under the chest and at the waist.
    ctx.fillStyle = DEEP2;
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-5.6 - bulk * .7, -16); ctx.quadraticCurveTo(-7 - bulk * .6, -7, -4.4, 2); ctx.lineTo(-14, 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, .6); ctx.quadraticCurveTo(1, -.9, 9, .4); ctx.lineTo(9, 2); ctx.lineTo(-6, 2); ctx.fill();
    ell(ctx, 7.4 + bulk * .5, -9.4, 1.4, 2.6); ctx.fill();
    ctx.fillStyle = GLOSS;
    ctx.beginPath(); ctx.moveTo(4.4, -12.6); ctx.quadraticCurveTo(7.8 + bulk, -10, 6.8 + bulk, -5.4); ctx.lineTo(5.6 + bulk, -5.6); ctx.quadraticCurveTo(6.4 + bulk, -9.4, 3.6, -12.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ell(ctx, 2.4, -10.6, 3.4, 1.4, -.2); ctx.fill();
    // Fold creases: pull lines from the armpit toward the waist and a bunched fold at the belt.
    ctx.strokeStyle = CREASE; ctx.lineWidth = .4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1.6, -9.4); ctx.quadraticCurveTo(0, -6, -.6, -3.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-.4, -10.8); ctx.quadraticCurveTo(2.2, -8.6, 2.2, -6.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.2, -4.6); ctx.quadraticCurveTo(3.4, -3.4, 1.6, -3.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.4, -7.6); ctx.quadraticCurveTo(5.4, -6.6, 4.2, -6.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.6, -1.6); ctx.lineTo(-2.4, -.6); ctx.moveTo(.4, -2); ctx.lineTo(1, -.6); ctx.stroke();
  }

  function drawHand(ctx, p, from, color, O, far) {
    const a = Math.atan2(p[1] - from[1], p[0] - from[0]);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a);
    // Clenched fist: squarish palm, curled finger row in front, thumb wrapped over it.
    paint(ctx, () => {
      ctx.beginPath(); ctx.moveTo(-1.9, -1.7); ctx.quadraticCurveTo(.6, -2.6, 2.4, -1.5);
      ctx.quadraticCurveTo(3.3, 0, 2.5, 1.6); ctx.quadraticCurveTo(.4, 2.6, -1.9, 1.7);
      ctx.quadraticCurveTo(-2.6, 0, -1.9, -1.7); ctx.closePath();
    }, color, O, .9, () => {
      ctx.fillStyle = SHADE; ctx.beginPath(); ctx.arc(.3, 1.9, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = DEEP2; ctx.fillRect(1.3, -3, 3, 6);
      ctx.fillStyle = 'rgba(255,255,255,.24)'; ell(ctx, -.2, -1.1, 1.3, .55); ctx.fill();
    });
    const ink = rgba(O.length === 7 ? O : '#000000', .6);
    ctx.strokeStyle = ink; ctx.lineWidth = .36; ctx.lineCap = 'round';
    // Finger joints across the front of the fist.
    ctx.beginPath(); ctx.moveTo(1.3, -1.7); ctx.quadraticCurveTo(1.0, 0, 1.4, 1.8); ctx.stroke();
    for (const y of [-.7, .3, 1.2]) { ctx.beginPath(); ctx.moveTo(1.5, y); ctx.lineTo(2.6, y + .1); ctx.stroke(); }
    if (!far) {
      ctx.beginPath(); ctx.moveTo(-1.2, -1.5); ctx.quadraticCurveTo(.6, -2.4, 1.9, -1.2); ctx.stroke();
      dot(ctx, 1.9, -1.1, .32, ink);
    }
    ctx.restore();
  }

  function drawArm(ctx, spec, shoulder, seg2, far, arms) {
    const a = arms || spec.arms, O = spec.outline;
    const p0 = shoulder, p1 = [shoulder[0] + seg2[0], shoulder[1] + seg2[1]], p2 = [shoulder[0] + seg2[2], shoulder[1] + seg2[3]];
    const k = far ? .2 : 0;
    const up = dark(a.upper, k), low = dark(a.lower, k);
    const w1 = a.w1 || 4.4, w2 = a.w2 || 3.8;
    limb(ctx, p0, p1, p2, w1, w2, up, low, O, { folds: a.upper !== spec.skin && !a.bare });
    if (a.cap) {
      // Shoulder yoke / sleeve cap in a second colour.
      const q = lerp(p0, p1, .45);
      seg(ctx, p0, q, w1 + 2.2, O); seg(ctx, p0, q, w1, dark(a.cap, k + .2));
      const [s0, s1] = lit(p0, q, w1 * .19); seg(ctx, s0, s1, w1 * .62, dark(a.cap, k));
    }
    if (a.guard) {
      // Forearm guard plate.
      const g0 = lerp(p1, p2, .2), g1 = lerp(p1, p2, .78);
      seg(ctx, g0, g1, w2 + 2.6, O); seg(ctx, g0, g1, w2 + .6, dark(a.guard, k + .25));
      const [s0, s1] = lit(g0, g1, w2 * .2); seg(ctx, s0, s1, w2 * .5, dark(a.guard, k));
    }
    if (a.cuff) {
      const c0 = lerp(p1, p2, .66), c1 = lerp(p1, p2, .86);
      seg(ctx, c0, c1, w2 + 2.4, O); seg(ctx, c0, c1, w2 + .4, dark(a.cuff, k));
    }
    if (a.pattern) a.pattern(ctx, p0, p1, p2, far);
    const hand = dark(a.hand || spec.skin, k * .9);
    drawHand(ctx, p2, p1, hand, O, far);
    return p2;
  }

  function drawLeg(ctx, spec, hip, seg2, far, near) {
    const l = spec.legs, O = spec.outline;
    const p0 = hip, p1 = [hip[0] + seg2[0], hip[1] + seg2[1]], p2 = [hip[0] + seg2[2], hip[1] + seg2[3]];
    const k = far ? .22 : 0;
    const thigh = dark(l.thigh, k), shin = dark(l.shin || l.thigh, k);
    const w1 = l.w1 || 5.4, w2 = l.w2 || 4.4;
    limb(ctx, p0, p1, p2, w1, w2, thigh, shin, O, { folds: l.thigh !== spec.skin, long: true });
    if (l.warmer) {
      // Guy's puffy leg warmers.
      const a0 = lerp(p1, p2, .22), a1 = lerp(p1, p2, .9);
      seg(ctx, a0, a1, w2 + 4, O); seg(ctx, a0, a1, w2 + 1.8, dark(l.warmer, k + .25));
      const [s0, s1] = lit(a0, a1, w2 * .25); seg(ctx, s0, s1, w2 + .2, dark(l.warmer, k));
      ctx.strokeStyle = dark(l.warmer, k + .45); ctx.lineWidth = .45;
      for (const t of [.35, .55, .75]) { const m = lerp(p1, p2, t); ctx.beginPath(); ctx.moveTo(m[0] - 2.6, m[1] - .3); ctx.lineTo(m[0] + 2.6, m[1] + .3); ctx.stroke(); }
    }
    // Ninja sandal shaft over the lower shin.
    const foot = dark(l.foot || '#27304a', k);
    if (!l.warmer) {
      const s0 = lerp(p1, p2, .74);
      seg(ctx, s0, p2, w2 + .2, foot);
      // Sandal shaft: shadow side and a lit edge so it reads as a cylinder.
      const [sp, sq] = lit(s0, p2, -w2 * .28); seg(ctx, sp, sq, w2 * .3, dark(foot, .35));
      if (l.wrap) {
        // Bandage wound round the shin: overlapping diagonal turns with lit top edges.
        const a0 = lerp(p1, p2, .4), a1 = lerp(p1, p2, .76);
        ctx.lineCap = 'butt';
        seg(ctx, a0, a1, w2 + 1.4, O); seg(ctx, a0, a1, w2 - .5, dark(l.wrap, k + .16));
        const [wp, wq] = lit(a0, a1, w2 * .16); seg(ctx, wp, wq, w2 * .5, dark(l.wrap, k));
        ctx.lineCap = 'round';
        const [nx, ny] = litN(a0, a1), hw = (w2 - .5) / 2;
        for (const t of [.47, .56, .65, .73]) {
          const m = lerp(p1, p2, t);
          line(ctx, [[m[0] - nx * hw - .35, m[1] - ny * hw - .35], [m[0] + nx * hw + .35, m[1] + ny * hw + .35]], dark(l.wrap, k + .36), .34);
        }
      }
    }
    if (l.holster && near) {
      // Kunai holster strapped round the near thigh: two straps, pouch, kunai rings poking out.
      const m = lerp(p0, p1, .58);
      const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(a);
      for (const sx of [-1.6, 1.4]) paint(ctx, () => { ctx.beginPath(); ctx.rect(sx - .45, -w1 * .55, .9, w1 * 1.1); }, dark(l.holster, .1), O, .45);
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.2, -3.2); ctx.lineTo(2.2, -3.2); ctx.lineTo(2.4, -.2); ctx.quadraticCurveTo(0, .4, -2.4, -.2); ctx.closePath(); }, l.holster, O, .7, () => {
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-2.4, -3.2, 5, .8);
        ctx.fillStyle = DEEP2; ctx.fillRect(-2.4, -1.3, 5, 1.4);
      });
      ctx.strokeStyle = '#8a8f9a'; ctx.lineWidth = .4;
      ctx.beginPath(); ctx.arc(-2.9, -2.4, .6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(-3.0, -1.1, .55, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // Open-toed sandal, tilted with the shin so trailing feet point their toes down.
    const tilt = clamp(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.PI / 2, -.5, 1.1);
    ctx.save(); ctx.translate(p2[0], p2[1]); ctx.rotate(tilt);
    if (!l.boots) {
      // Bare toes out of the open-toed sandal: a rounded row, big toe in front, toe splits inked.
      const sk = dark(spec.skin, k);
      paint(ctx, () => {
        ctx.beginPath(); ctx.moveTo(1.2, -2.3); ctx.quadraticCurveTo(3.6, -2.7, 4.5, -1.2);
        ctx.quadraticCurveTo(4.8, -.1, 4.0, 0); ctx.lineTo(1.2, 0); ctx.closePath();
      }, sk, O, .65, () => {
        ctx.fillStyle = SHADE; ctx.fillRect(0, -.9, 6, 1);
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ell(ctx, 3.2, -1.9, 1, .32, .1); ctx.fill();
      });
      ctx.strokeStyle = rgba(dark(spec.skin, .55), .9); ctx.lineWidth = .3;
      for (const x of [2.5, 3.4]) { ctx.beginPath(); ctx.moveTo(x, -.1); ctx.lineTo(x + .1, -1.1); ctx.stroke(); }
    }
    paint(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-2.6, -3.5);
      ctx.lineTo(1.4, -3.4);
      if (l.boots) ctx.quadraticCurveTo(5, -2.4, 4.8, 0);
      else { ctx.quadraticCurveTo(2.6, -3.1, 2.4, -1.6); ctx.lineTo(1.6, -.3); }
      ctx.lineTo(-2.9, 0);
      ctx.quadraticCurveTo(-3.3, -1.8, -2.6, -3.5);
      ctx.closePath();
    }, foot, O, .9, () => {
      ctx.fillStyle = SHADE; ctx.fillRect(-4, -1.3, 10, 2);
      ctx.fillStyle = DEEP2; ctx.fillRect(-4, -.6, 10, 1);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-2, -3.3, 2.8, .6);
      if (!l.boots) { ctx.strokeStyle = rgba(light(foot, .3), .6); ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(.4, -3.2); ctx.lineTo(1.9, -1.2); ctx.stroke(); }
    });
    // Sole: a light-grey slab under the whole foot, toes included.
    line(ctx, [[-2.9, -.25], [l.boots ? 4.8 : 4.6, -.25]], O, 1.15);
    line(ctx, [[-2.6, -.3], [l.boots ? 4.6 : 4.4, -.3]], l.boots ? dark(foot, .45) : '#8c8a94', .5);
    ctx.restore();
  }

  function drawSkirt(ctx, spec, pose, hipY) {
    const sk = spec.skirt; if (!sk) return;
    const hem = -(sk.hem ?? 6);
    // Running: the back flap streams out and flutters frame to frame (secondary motion).
    const wv = pose.run ? Math.sin(pose.wave || 0) : 0, wv2 = pose.run ? Math.cos((pose.wave || 0) * 2) : 0;
    const fb = pose.run ? 4 + wv * 1.4 : pose.attack ? 2 : 0;
    const ff = pose.run ? -1.6 - wv * .5 : pose.attack ? 1.4 : 0;
    const lift = pose.run ? 1.2 + wv2 * .8 : 0;
    const fl = sk.flare || 0;
    const build = () => {
      ctx.beginPath();
      ctx.moveTo(-6, hipY - 1.4);
      ctx.quadraticCurveTo(-8 - fb * .4 - fl * .5, (hipY + hem) / 2, -9.4 - fb - fl, hem - lift);
      // Wavy hem reads as cloth folds.
      ctx.quadraticCurveTo(-6.4 - fb * .6, hem + 1.4 - lift * .5, -3.4, hem + .6 - wv2 * .4);
      ctx.quadraticCurveTo(0, hem + 1.8, 3.4, hem + .6 - (pose.run ? .6 : 0));
      ctx.quadraticCurveTo(6.4, hem + 1.2, 9 + ff + fl, hem - (pose.run ? 1.6 : 0));
      ctx.quadraticCurveTo(7.6 + ff * .5, (hipY + hem) / 2, 6.4, hipY - 1.4);
      ctx.closePath();
    };
    paint(ctx, build, sk.color, spec.outline, 1.1, () => {
      if (sk.paint) sk.paint(ctx, hem, hipY, fb, ff);
      const mid = (hipY + hem) / 2;
      ctx.fillStyle = SHADE;
      ctx.beginPath(); ctx.moveTo(-16, hipY - 4); ctx.lineTo(-4.6, hipY - 4); ctx.quadraticCurveTo(-5.6, mid, -4, hem + 4); ctx.lineTo(-16, hem + 4); ctx.fill();
      // Deep tone inside each fold valley, tapering up toward the waist.
      ctx.fillStyle = DEEP2;
      ctx.beginPath(); ctx.moveTo(-16, hipY - 4); ctx.lineTo(-7.4, hipY - 4); ctx.quadraticCurveTo(-8, mid, -7.6 - fb * .5, hem + 4); ctx.lineTo(-16, hem + 4); ctx.fill();
      for (const [x0, x1] of [[-1, -3.4], [2.6, 3.4]]) {
        ctx.beginPath(); ctx.moveTo(x0, hipY + 1); ctx.quadraticCurveTo(x1 - .4, mid + 1, x1 - 1, hem + 1.4);
        ctx.lineTo(x1 + .5, hem + 1.4); ctx.quadraticCurveTo(x1 + .2, mid + 1, x0 + .1, hipY + 1); ctx.fill();
      }
      ctx.fillStyle = DEEP; ctx.fillRect(-16, hipY - 4, 32, 2.8);
      ctx.strokeStyle = CREASE; ctx.lineWidth = .45;
      ctx.beginPath(); ctx.moveTo(-1, hipY); ctx.quadraticCurveTo(-2.2, mid, -3.4, hem + .4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2.6, hipY); ctx.quadraticCurveTo(3, mid, 3.4, hem + .4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4.6, hipY + 1); ctx.quadraticCurveTo(-6, mid, -7 - fb * .6, hem); ctx.stroke();
      ctx.fillStyle = GLOSS; ctx.beginPath(); ctx.moveTo(4.4, hipY); ctx.quadraticCurveTo(5.6, mid, 6.6 + ff * .6, hem); ctx.lineTo(5.2 + ff * .4, hem); ctx.quadraticCurveTo(4.6, mid, 3.6, hipY); ctx.fill();
    });
    if (sk.opening !== false) line(ctx, [[5.4, hipY], [7 + ff * .6, hem + .4]], dark(sk.color, .5), .7);
  }

  // Both hands pressed together in a hand seal (Tiger: index fingers up).
  function drawSealHands(ctx, spec, hN, hF) {
    const O = spec.outline, c = spec.arms.hand || spec.skin;
    const m = lerp(hN, hF, .5);
    ctx.save(); ctx.translate(m[0], m[1] - .4);
    paint(ctx, () => { ctx.beginPath(); ctx.ellipse(0, .6, 2.6, 2.4, 0, 0, TAU); }, c, O, .9, () => {
      ctx.fillStyle = SHADE; ctx.fillRect(-4, 1, 8, 3);
    });
    if (spec.sealCross) {
      // Shadow Clone seal: index and middle fingers of both hands crossed in an X.
      for (const [r, cc] of [[-.62, dark(c, .12)], [.62, c]]) {
        ctx.save(); ctx.translate(0, -2.4); ctx.rotate(r);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-.8, 2.8); ctx.lineTo(-.72, -2.6); ctx.quadraticCurveTo(0, -3.4, .72, -2.6); ctx.lineTo(.8, 2.8); ctx.closePath(); }, cc, O, .75);
        line(ctx, [[0, -2.4], [0, 1.8]], rgba(O, .4), .28);
        ctx.restore();
      }
    } else {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-.9, -1); ctx.lineTo(-.7, -4.6); ctx.quadraticCurveTo(.1, -5.4, .8, -4.6); ctx.lineTo(1, -1); ctx.closePath(); }, c, O, .8);
      line(ctx, [[0, -4.4], [0, 2.4]], rgba(O, .5), .35);
    }
    ctx.restore();
  }

  // Shippuden proportions: a slightly smaller head on longer legs than the old chibi build
  // (portraits keep the full-size head). Per-spec overrides: headScale, legK.
  const HEAD_K = .88, LEG_K = 1.1;
  function renderCharacter(ctx, spec, pose) {
    const O = spec.outline;
    const lk = spec.legK || LEG_K;
    const legN = pose.legN.map(v => v * lk), legF = pose.legF.map(v => v * lk);
    const hipY = -Math.max(legN[3], legF[3]) - (pose.lift || 0);
    const hk = (spec.headScale || 1) * HEAD_K, hy = HEAD[1] + (spec.headDrop || 0) + (1 - HEAD_K) * 6;
    if (spec.ground) spec.ground(ctx, pose, hipY);
    // Breathing: the upper body rises a hair on the in-breath.
    const up = hipY - (pose.breath ? .45 : 0);
    // Behind the body: long hair drapes, weapons on the back, far arm.
    const lean = pose.lean + (spec.hunch || 0);
    ctx.save(); ctx.translate(.3, up); ctx.rotate(lean);
    if (spec.back) spec.back(ctx, pose);
    if (spec.head.drape) {
      // Long hair / pigtails trail behind the head when running and flutter with the stride.
      ctx.save(); ctx.translate(HEAD[0], hy); ctx.scale(hk, hk);
      const sway = pose.run ? .16 + Math.sin((pose.wave || 0) + 1) * .05 : pose.attack ? .06 : pose.breath ? .015 : 0;
      if (sway && !spec.head.drapeRigid) { ctx.translate(-6, 3); ctx.rotate(sway); ctx.translate(6, -3); }
      spec.head.drape(ctx, spec, pose); ctx.restore();
    }
    if (spec.collarBack) spec.collarBack(ctx, pose);
    const handF = drawArm(ctx, spec, SH_F, pose.armF, true, spec.farArms);
    ctx.restore();
    if (!spec.noLegs) {
      drawLeg(ctx, spec, [HIP_F, hipY], legF, true, false);
      drawLeg(ctx, spec, [HIP_N, hipY], legN, false, true);
      // Occlusion where the legs meet the body (only darkens what is already painted).
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(24,8,44,.22)'; ell(ctx, .6, hipY + 2.2, 3.4, 2.2); ctx.fill();
      ctx.restore();
    }
    drawSkirt(ctx, spec, pose, hipY);
    ctx.save(); ctx.translate(.3, up); ctx.rotate(lean);
    // Neck, torso, head
    paint(ctx, () => poly(ctx, [[-.8, -12], [3.2, -12], [3, -16.8], [-.4, -16.8]]), spec.skinShade || mix(spec.skin, '#b0607a', .3), O, .9, () => {
      // Deep shadow cast by the jaw onto the neck.
      ctx.fillStyle = DEEP; ctx.fillRect(-2, -17, 6, 2.6);
    });
    paint(ctx, () => torsoPath(ctx, spec.bulk || 0), spec.torso.base, O, 1.15, () => {
      if (spec.torso.paint) spec.torso.paint(ctx, pose);
      torsoShade(ctx, spec.bulk || 0);
    });
    if (spec.torso.over) spec.torso.over(ctx, pose);
    ctx.save(); ctx.translate(HEAD[0], hy); ctx.scale(hk, hk); drawHead(ctx, spec, pose); ctx.restore();
    if (spec.collar) spec.collar(ctx, pose);
    const handN = drawArm(ctx, spec, SH_N, pose.armN, false);
    if (pose.seal) drawSealHands(ctx, spec, handN, handF);
    if (spec.shoulder) spec.shoulder(ctx, pose);
    if (spec.front) spec.front(ctx, pose, handN, handF);
    ctx.restore();
  }

  // ---------------------------------------------------------------- shared outfits
  // Jōnin / chūnin flak jacket: rolled collar, scroll pouches, zip, side panels.
  function flakVest(color, opts = {}) {
    return (ctx) => {
      const O = opts.outline || '#1d1a14';
      paint(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-6, -.8); ctx.bezierCurveTo(-6.6, -4, -7.2, -7, -6.9, -10);
        ctx.quadraticCurveTo(-6.2, -13, -2.6, -13.3);
        ctx.lineTo(4, -13.3); ctx.quadraticCurveTo(7.8, -12.6, 7.7, -9.4);
        ctx.bezierCurveTo(7.8, -6.6, 6.6, -4.4, 6.8, -.8); ctx.closePath();
      }, color, O, .95, () => {
        if (opts.kumo) {
          // Kumo-style: single diagonal shoulder strap over a sleeveless vest.
          ctx.fillStyle = dark(color, .3); ctx.beginPath(); ctx.moveTo(-5, -13.4); ctx.lineTo(-1.8, -13.4); ctx.lineTo(7.6, -2); ctx.lineTo(5, -1); ctx.fill();
          ctx.fillStyle = light(color, .25); ctx.beginPath(); ctx.moveTo(-4.4, -13.4); ctx.lineTo(-3.4, -13.4); ctx.lineTo(6, -2); ctx.lineTo(5.4, -1.4); ctx.fill();
        } else if (!opts.plain) {
          // Konoha-style: two scroll pouches per side with buttoned flaps, a lower pocket,
          // padded shoulder seams and the centre zip.
          const ink = dark(color, .5);
          for (const px of [-.6, 2.2, 4.4]) {
            const pw = px < 0 ? 2.4 : 2.0;
            ctx.fillStyle = dark(color, .14); ctx.fillRect(px, -9.8, pw, 4.2);
            ctx.fillStyle = 'rgba(30,12,54,.3)'; ctx.fillRect(px, -6.4, pw, .8);
            ctx.fillStyle = light(color, .16); ctx.fillRect(px, -9.8, pw, 1.2);
            ctx.strokeStyle = ink; ctx.lineWidth = .36; ctx.strokeRect(px, -9.8, pw, 4.2);
            ctx.beginPath(); ctx.moveTo(px, -8.6); ctx.lineTo(px + pw, -8.6); ctx.stroke();
            dot(ctx, px + pw / 2, -9.1, .26, dark(color, .55));
          }
          ctx.fillStyle = dark(color, .14); ctx.fillRect(-.6, -4.6, 7.4, 2.4);
          ctx.strokeStyle = ink; ctx.strokeRect(-.6, -4.6, 7.4, 2.4);
          ctx.fillStyle = light(color, .12); ctx.fillRect(-.6, -4.6, 7.4, .6);
          line(ctx, [[3.7, -12.8], [3.7, -.8]], ink, .45);
          line(ctx, [[3.95, -12.8], [3.95, -.8]], rgba(light(color, .4), .6), .25);
          // Shoulder-strap seams.
          ctx.strokeStyle = rgba(ink, .8); ctx.lineWidth = .3;
          ctx.beginPath(); ctx.moveTo(-3.4, -13.2); ctx.quadraticCurveTo(-1.6, -11.4, -.8, -10.2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(6.4, -12.8); ctx.quadraticCurveTo(6.8, -11.4, 7.6, -10.6); ctx.stroke();
        }
        if (opts.strap) { ctx.fillStyle = dark(color, .35); ctx.beginPath(); ctx.moveTo(-4, -13); ctx.lineTo(-1.6, -13); ctx.lineTo(6, -1); ctx.lineTo(3.6, -1); ctx.fill(); }
        if (opts.ribs) { ctx.strokeStyle = dark(color, .4); ctx.lineWidth = .5; for (let y = -10.5; y < -1; y += 2.4) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(9, y - .3); ctx.stroke(); } }
        torsoShade(ctx);
      });
      if (!opts.kumo) {
        // Rolled collar
        paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.4, -13.1, 4.9, 1.9, 0, 0, TAU); }, light(color, .06), O, .85, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-4, -12.9, 12, 2);
          ctx.fillStyle = DEEP2; ctx.fillRect(-4, -12.2, 3.4, 2);
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ell(ctx, 2.6, -14.2, 2.6, .5); ctx.fill();
          ctx.strokeStyle = rgba(dark(color, .5), .7); ctx.lineWidth = .3; ctx.beginPath(); ctx.ellipse(1.4, -13.1, 3.6, 1.1, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        });
      }
    };
  }

  const AKA = '#1d1c25';
  function akatsukiSpec(base) {
    const cloak = AKA;
    return Object.assign({
      outline: '#0c0a10', skin: '#f2c9a5',
      legs: { thigh: '#232838', shin: '#232838', foot: '#2a2f45', w1: 5.6 },
      arms: {
        upper: cloak, lower: cloak, hand: null, w1: 5.4, w2: 5,
        pattern(ctx, p0, p1, p2, far) { if (!far) cloud(ctx, ...lerp(p0, p1, .55), .26, Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.PI / 2); }
      },
      torso: { base: cloak, paint: ctx => {
        cloud(ctx, 1.6, -7.6, .5, -.08); cloud(ctx, -5.6, -2.4, .34, .2);
        // Front closure and the heavy fabric's long vertical folds.
        line(ctx, [[3.6, -13], [4.2, .4]], '#07060a', .5);
        line(ctx, [[3.95, -13], [4.55, .4]], 'rgba(150,150,190,.25)', .3);
        ctx.strokeStyle = 'rgba(120,120,170,.22)'; ctx.lineWidth = .35;
        for (const [x0, x1] of [[-2.6, -3.2], [6.2, 6.8]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .6, -5, x1, .4); ctx.stroke(); }
      } },
      skirt: {
        color: cloak, hem: 5.6,
        paint: (ctx, hem, hipY) => {
          cloud(ctx, -4.6, hem - 3.8, .48, .05); cloud(ctx, 4.4, hipY + 4.6, .42, -.1);
          ctx.strokeStyle = 'rgba(120,120,170,.22)'; ctx.lineWidth = .35;
          for (const x of [-6, 1.2, 6.4]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1, hem); ctx.stroke(); }
        }
      },
      collarBack(ctx) {
        // Back half of the standing collar, red lining facing the viewer.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.6, -21.4); ctx.quadraticCurveTo(-2, -19, 3.6, -18.4); ctx.lineTo(7, -12); ctx.closePath(); },
          '#b01a28', '#0c0a10', 1, () => { ctx.fillStyle = 'rgba(40,0,10,.35)'; ctx.fillRect(-9, -22, 6, 12); });
      },
      collar(ctx) {
        // Front of the high collar wrapping the chin, red lining showing at the opening.
        paint(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-6.9, -10.6); ctx.lineTo(-7.4, -18.6);
          ctx.quadraticCurveTo(-2.4, -16.4, 3.6, -15.6);
          ctx.quadraticCurveTo(6.6, -15.6, 8.6, -17.2);
          ctx.lineTo(8.2, -13.8); ctx.quadraticCurveTo(8.2, -11.4, 7.4, -10.6); ctx.closePath();
        }, cloak, '#0c0a10', 1.05, () => {
          ctx.fillStyle = '#c21e2e';
          ctx.beginPath(); ctx.moveTo(-7.4, -18.8); ctx.quadraticCurveTo(-2.4, -16.6, 3.6, -15.8); ctx.quadraticCurveTo(6.6, -15.8, 8.6, -17.4);
          ctx.lineTo(8.6, -16); ctx.quadraticCurveTo(6.4, -14.6, 3.6, -14.6); ctx.quadraticCurveTo(-2.4, -15.2, -7.4, -17.4); ctx.fill();
          ctx.fillStyle = '#e8495a'; ctx.fillRect(-7.4, -18.9, 6, .5);
          ctx.fillStyle = SHADE; ctx.fillRect(-10, -16, 5.2, 7);
          ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(2, -14.6, 5, 4);
          cloud(ctx, -3.2, -12.8, .3, -.1);
        });
        line(ctx, [[3.8, -14.4], [5, -10.8]], '#08060c', .55);
      }
    }, base);
  }

  function robeSpec(base, robe, trim) {
    return Object.assign({
      outline: '#2b2330', skin: '#f3e1d6',
      legs: { thigh: dark(robe, .1), shin: dark(robe, .1), foot: '#ede6dc', w1: 5.6, boots: true },
      arms: { upper: robe, lower: robe, w1: 5.6, w2: 5.6, cuff: trim },
      torso: {
        base: robe, paint: ctx => {
          // Crossed robe front and a sash.
          ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(1, -13); ctx.lineTo(3, -13); ctx.lineTo(5.6, 0); ctx.lineTo(3.6, 0); ctx.fill();
          ctx.strokeStyle = dark(robe, .25); ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-3, -12.6); ctx.lineTo(3.4, -5); ctx.stroke();
          ctx.fillStyle = dark(robe, .45); ctx.fillRect(-8, -3.2, 17, 2.6);
          ctx.fillStyle = trim; ctx.fillRect(-8, -2.2, 17, .5);
        }
      },
      skirt: { color: robe, hem: 1.6, flare: 1.4, paint: (ctx, hem) => { ctx.fillStyle = trim; ctx.fillRect(-16, hem - 1.6, 32, 1.8); } },
      collar(ctx) {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.4, -17.6); ctx.quadraticCurveTo(-1, -15.4, 4.6, -14.4);
          ctx.lineTo(8.4, -15.6); ctx.lineTo(7.6, -11); ctx.closePath();
        }, robe, '#2b2330', 1, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -18, 5, 8);
          ctx.strokeStyle = trim; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-7.4, -17); ctx.quadraticCurveTo(-1, -14.8, 4.6, -13.8); ctx.lineTo(8.4, -15); ctx.stroke();
          // Magatama row.
          for (let i = 0; i < 4; i++) dot(ctx, -4.6 + i * 3, -13.4 + Math.abs(i - 1.5) * .3, .6, dark(trim, .1));
        });
      }
    }, base);
  }

  function horns(ctx, list, color = '#efe6da', outline = '#3b2f2a') {
    for (const [x, y, len, ang, w] of list) {
      const a = ang * DEG, nx = -Math.sin(a), ny = Math.cos(a);
      const build = () => {
        ctx.beginPath();
        ctx.moveTo(x + nx * w, y + ny * w);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * .6 + nx * w * .6, y + Math.sin(a) * len * .6 + ny * w * .6,
          x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * .5 - nx * w * .4, y + Math.sin(a) * len * .5 - ny * w * .4,
          x - nx * w, y - ny * w);
        ctx.closePath();
      };
      paint(ctx, build, color, outline, .8, () => {
        ctx.fillStyle = 'rgba(40,20,60,.22)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + nx * w * 2, y + ny * w * 2); ctx.lineTo(x + Math.cos(a) * len + nx * 2, y + Math.sin(a) * len + ny * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ell(ctx, x + Math.cos(a) * len * .35 - nx * w * .3, y + Math.sin(a) * len * .35 - ny * w * .3, len * .2, w * .25, a); ctx.fill();
      });
    }
  }

  // ---------------------------------------------------------------- characters
  const NARUTO_BAND = { cloth: '#1c1d26', plate: '#cdd5de', symbol: 'leaf' };
  const whiskers = (color, width = .6) => (ctx) => {
    // Three whisker marks per cheek, tapered like brush strokes; the far cheek's are foreshortened.
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const y = 4.7 + i * 1.3, t = (i - 1) * .22;
      ctx.beginPath();
      ctx.moveTo(-1.6, y - .7 - t); ctx.quadraticCurveTo(.6, y - .5 - width * .55, 2.6, y + .1 + t * .4);
      ctx.quadraticCurveTo(.6, y - .3 + width * .55, -1.6, y - .7 - t); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10.1, y - .35 - t * .5); ctx.quadraticCurveTo(9.1, y - .1 - width * .45, 8.1, y + .1 + t * .3);
      ctx.quadraticCurveTo(9.1, y + .1 + width * .45, 10.1, y - .35 - t * .5); ctx.fill();
    }
  };

  // Kurama's chakra ear: a broad flame-edged horn that bows outward (`bend` = ±1).
  function kuramaEar(ctx, x, y, len, ang, w, bend, cols) {
    const a = ang * DEG, ux = Math.cos(a), uy = Math.sin(a), nx = -uy * bend, ny = ux * bend;
    const shape = (L, W) => {
      const tip = [x + ux * L + nx * L * .16, y + uy * L + ny * L * .16];
      ctx.beginPath();
      ctx.moveTo(x - nx * W, y - ny * W);
      ctx.bezierCurveTo(x + ux * L * .45 - nx * W * .2, y + uy * L * .45 - ny * W * .2, x + ux * L * .8 + nx * W * .6, y + uy * L * .8 + ny * W * .6, tip[0], tip[1]);
      ctx.bezierCurveTo(x + ux * L * .78 + nx * W * 1.5, y + uy * L * .78 + ny * W * 1.5, x + ux * L * .4 + nx * W * 1.7, y + uy * L * .4 + ny * W * 1.7, x + nx * W, y + ny * W);
      ctx.closePath();
    };
    paint(ctx, () => shape(len, w), cols[0], cols[3], 1, () => {
      ctx.fillStyle = cols[1]; shape(len * .84, w * .62); ctx.fill();
      ctx.fillStyle = cols[2]; shape(len * .58, w * .26); ctx.fill();
    });
  }

  const KURAMA_EAR = ['#e0281c', '#ff7a22', '#ffe08a', '#4a0608'];
  // Naruto's own ready stance and Shadow Clone hand seal.
  const NARUTO_POSES = {
    idle: { lean: .06, legN: [-1.2, 8.5, -2.9, 17], legF: [2.6, 8.4, 4.9, 17], armN: [-1.9, 6.2, .2, 11.8], armF: [2.4, 6.1, 5.6, 10.6], run: false }
  };

  function narutoSpec(baryon, rinnegan = false) {
    const orange = baryon ? '#ff6526' : '#f8861d', black = baryon ? '#2c0a12' : '#20222c', hair = baryon ? '#ffb434' : '#ffd43b';
    const O = baryon ? '#3c0608' : '#3a200f';
    const swirl = (ctx, x, y, s, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = i * .55, r = (.15 + i * .1) * s; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    };
    return {
      outline: O, skin: baryon ? '#ffd0a6' : '#f9cfa6', skinShade: baryon ? '#ec9a78' : '#e3a27c',
      poses: NARUTO_POSES, sealCross: true,
      legs: { thigh: orange, shin: orange, foot: '#232c48', wrap: '#f1ece2', holster: black },
      arms: {
        upper: orange, lower: orange, cap: black, w1: 4.7, w2: 4.1, cuff: black,
        // Red Uzumaki swirl on the shoulder of the sleeve.
        pattern(ctx, p0, p1, p2, far) { if (!far) { const m = lerp(p0, p1, .3); swirl(ctx, m[0], m[1], .9, '#e2323a', .5); } }
      },
      torso: {
        base: orange, paint: ctx => {
          // Shippuden track jacket: black yoke over shoulders and chest, white zip, red swirl.
          ctx.fillStyle = black;
          ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(9, -14); ctx.lineTo(9, -8.8);
          ctx.quadraticCurveTo(6.4, -7.6, 3.6, -7.2); ctx.quadraticCurveTo(-2, -7.4, -9, -9.8); ctx.fill();
          ctx.strokeStyle = light(orange, .35); ctx.lineWidth = .45;
          ctx.beginPath(); ctx.moveTo(9, -8.4); ctx.quadraticCurveTo(6.4, -7.1, 3.6, -6.7); ctx.quadraticCurveTo(-2, -6.9, -9, -9.3); ctx.stroke();
          // Zip line and pull.
          ctx.fillStyle = '#f4f1ea'; ctx.fillRect(3.2, -7.4, .8, 7.2);
          ctx.fillStyle = '#d8d4cc'; ctx.fillRect(3.2, -7.4, .3, 7.2);
          paint(ctx, () => { ctx.beginPath(); ctx.rect(2.7, -8.6, 1.8, 1.9); }, '#f4f1ea', O, .4);
          // Pocket seam and darker hem band.
          ctx.strokeStyle = dark(orange, .4); ctx.lineWidth = .4;
          ctx.beginPath(); ctx.moveTo(4.6, -4.2); ctx.quadraticCurveTo(6.4, -3.6, 7.4, -4.6); ctx.stroke();
          ctx.fillStyle = dark(orange, .3); ctx.fillRect(-9, -1.9, 18, 1.9);
        }
      },
      collar(ctx) {
        // High black collar standing up round the neck, zipped at the front.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, -12.2); ctx.quadraticCurveTo(-4.4, -16, -.8, -16.2); ctx.lineTo(4.6, -15.4); ctx.quadraticCurveTo(7.4, -14.8, 6.8, -12.2); ctx.quadraticCurveTo(1.6, -11, -4, -12.2); ctx.closePath(); }, black, '#140e0a', .85,
          () => { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, -16.4, 6, 1.5); ctx.fillStyle = SHADE; ctx.fillRect(-5, -16.4, 3.4, 5); });
        line(ctx, [[3.6, -15.2], [3.7, -11.6]], '#e8e4dc', .5);
      },
      head: {
        back(ctx, spec) {
          if (baryon) {
            // Kurama's chakra ears rise out of the mop.
            kuramaEar(ctx, -6, -7, 30, -120, 6, -1, KURAMA_EAR);
            kuramaEar(ctx, 2.2, -8, 29, -70, 5.8, 1, KURAMA_EAR);
          }
          HAIR.narutoBack(hair)(ctx, spec);
        },
        hair: HAIR.naruto(hair),
        eyes: rinnegan ? { type: 'rinnegan' } : baryon ? { type: 'baryon' } : { type: 'normal', iris: '#2a8cf4' },
        mouth: rinnegan ? 'neutral' : baryon ? 'smirk' : 'grin', attackMouth: 'shout',
        browColor: baryon ? '#4a0a08' : '#a8700e', browAngle: baryon || rinnegan ? 'angry' : null,
        marks: baryon ? (ctx) => {
          whiskers('#3a0608', 1.25)(ctx);
          // Baryon red pigment flaring from the eyes.
          ctx.fillStyle = 'rgba(170,12,22,.75)';
          ctx.beginPath(); ctx.moveTo(-.8, .4); ctx.lineTo(4.8, -.7); ctx.lineTo(4.2, .5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6.4, -.6); ctx.lineTo(9.9, .2); ctx.lineTo(9.3, 1.1); ctx.closePath(); ctx.fill();
        } : whiskers('#4a2614', .75),
        band: NARUTO_BAND,
        front(ctx, spec) {
          HAIR.narutoFringe(hair)(ctx, spec);
        }
      }
    };
  }

  // Six Paths Sage Mode Naruto (I): Naruto's spec wrapped in the glowing golden chakra coat with
  // nine black magatama round the collar, black flame marks up the coat and round its hem, black
  // trousers, hair lit gold with two horn-like spikes and golden sage eyes.
  function narutoRikudoSpec() {
    const base = narutoSpec(false);
    const GOLD = '#ffb02a', GOLD_D = '#ec8a14', INK = '#16121a', O = '#5c2c06', hc = '#fff27e';
    // A black flame stripe licking up from (x, y0) to y1 with a bend.
    const stripe = (ctx, x, y0, y1, w, bend) => {
      ctx.fillStyle = INK; ctx.beginPath();
      ctx.moveTo(x - w, y0); ctx.quadraticCurveTo(x - w * .6 + bend, (y0 + y1) / 2, x + bend * 1.4, y1);
      ctx.quadraticCurveTo(x + w * .7 + bend, (y0 + y1) / 2, x + w, y0); ctx.closePath(); ctx.fill();
    };
    return Object.assign({}, base, {
      outline: O, skin: '#f9cfa6', skinShade: '#e3a27c',
      legs: { thigh: INK, shin: INK, foot: '#1e1a24', w1: 5.4, w2: 4.4 },
      arms: {
        upper: GOLD, lower: GOLD, w1: 4.8, w2: 4.2, cuff: INK,
        pattern(ctx, p0, p1, p2, far) {
          // A thin black flame mark up the forearm.
          line(ctx, [lerp(p1, p2, .18), lerp(p1, p2, .58)], far ? '#0c0a10' : INK, .9);
        }
      },
      torso: {
        base: GOLD, paint: ctx => {
          // Lit upper chest, darker gold below; a black flame mark rising up the coat front.
          ctx.fillStyle = 'rgba(255,248,200,.42)'; ctx.fillRect(-9, -14, 18, 3);
          ctx.fillStyle = 'rgba(214,100,10,.3)'; ctx.fillRect(-9, -5, 18, 5);
          stripe(ctx, 3.6, 0, -8.6, .8, .4);
          // Uzumaki swirl on the belly.
          ctx.strokeStyle = INK; ctx.lineWidth = .6; ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i <= 14; i++) { const a = i * .6, r = .2 + i * .18, px = 1 + Math.cos(a) * r, py = -4.4 + Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          ctx.stroke();
          ctx.fillStyle = INK; ctx.fillRect(-9, -1.6, 18, 1.6);
        }
      },
      collarBack(ctx) {
        // The coat's high golden collar standing behind the neck.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.6, -11.4); ctx.lineTo(-7.6, -19.2); ctx.quadraticCurveTo(-2, -17.6, 3.6, -17.2); ctx.lineTo(6.8, -11.6); ctx.closePath(); },
          GOLD_D, O, 1, () => { ctx.fillStyle = 'rgba(120,50,0,.3)'; ctx.fillRect(-9, -21, 6, 11); });
      },
      collar(ctx) {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6.2, -11.6); ctx.lineTo(-6.8, -16.6);
          ctx.quadraticCurveTo(-2.4, -15, 3.4, -14.4); ctx.quadraticCurveTo(6.4, -14.2, 8, -15.4);
          ctx.lineTo(7.6, -12.6); ctx.quadraticCurveTo(7.4, -11.6, 6.8, -11.2); ctx.closePath();
        }, GOLD, O, 1, () => {
          ctx.fillStyle = 'rgba(255,250,215,.55)'; ctx.fillRect(-8, -17, 17, 1.4);
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -17, 4.4, 8);
        });
        // Nine black magatama round the collar, rimmed gold so they read on the coat.
        ctx.strokeStyle = 'rgba(40,20,4,.6)'; ctx.lineWidth = .35;
        ctx.beginPath(); ctx.ellipse(1.8, -12.8, 7.2, 4.6, 0, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
        for (let i = 0; i < 9; i++) {
          const a = (.12 + i * .095) * Math.PI, x = 1.8 + Math.cos(a) * 7.2, y = -12.8 + Math.sin(a) * 4.6;
          tomoe(ctx, x, y + .3, .86, Math.PI * .5, '#fff1b0');
          tomoe(ctx, x, y + .3, .6, Math.PI * .5, INK);
        }
      },
      skirt: {
        color: GOLD, hem: 4.6, flare: 1.5, opening: true, paint: (ctx, hem, hipY) => {
          ctx.fillStyle = 'rgba(214,110,10,.28)'; ctx.fillRect(-20, hipY, 40, 3);
          // Black flames licking up from the hem of the coat.
          ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-20, hem + 2);
          for (let i = 0; i < 9; i++) {
            const x = -17 + i * 4.2, tall = i % 2 ? 6.4 : 4;
            ctx.quadraticCurveTo(x - 1.6, hem - tall * .3, x - .4, hem - tall);
            ctx.quadraticCurveTo(x + .4, hem - tall * .5, x + 2.1, hem - .2);
          }
          ctx.lineTo(22, hem + 2); ctx.closePath(); ctx.fill();
        }
      },
      head: Object.assign({}, base.head, {
        back(ctx, spec) { HAIR.narutoBack(hc)(ctx, spec); },
        hair: HAIR.naruto(hc),
        eyes: { type: 'sage' }, mouth: 'neutral', browAngle: 'angry', browColor: '#c8860c',
        marks: whiskers('#4a2614', .9),
        front(ctx, spec) {
          HAIR.narutoFringe(hc)(ctx, spec);
          // Two horn-like spikes standing up from the crown (Hagoromo's horns).
          locks(ctx, spec, hc, [[-2.6, -18, -5.8, -32, 2.1, -1.4], [4.6, -18.4, 7.8, -31, 2, 1.2]], .9);
        }
      })
    });
  }

  function gruntSpec(kind) {
    const base = {
      walker: { skin: '#eec39c', hair: '#2a2b38', cloth: '#2f3d5c', vest: '#7c8c80', band: { cloth: '#355a8c', symbol: 'mist', slash: true }, mask: '#3a4152', vestOpts: { ribs: true } },
      runner: { skin: '#b57a50', hair: '#ecebf2', cloth: '#30343f', vest: '#e8e1cf', band: { cloth: '#1d2532', symbol: 'cloud' }, vestOpts: { kumo: true } },
      brute:  { skin: '#e2b088', hair: '#5a3a24', cloth: '#8c3a32', vest: '#6e5a48', band: { cloth: '#7d2a24', symbol: 'stone' }, bulk: 1.6, vestOpts: { strap: true } },
      spitter:{ skin: '#efc49c', hair: '#8a6a3c', cloth: '#b6a57c', vest: '#8d7d58', band: { cloth: '#26252c', symbol: 'sound' }, mask: '#5a4f3c', rope: true, vestOpts: { plain: true } },
      // Village ninjas: Suna (head wrap), Kiri (striped vest, big sword), Kumo (one-strap vest), Iwa (one sleeve, scarf).
      suna_ninja: { skin: '#e8b98e', hair: '#6a4a2a', cloth: '#8a7458', vest: '#cdb98c', band: { cloth: '#3a3226', symbol: 'sand' }, wrap: '#e6dcc4', vestOpts: { strap: true } },
      kiri_ninja: { skin: '#eec7a4', hair: '#3a4250', cloth: '#3a4656', vest: '#8b9890', band: { cloth: '#2c4a72', symbol: 'mist' }, mask: '#e8e4da', vestOpts: { ribs: true }, sword: true },
      kumo_ninja: { skin: '#8a5a3a', hair: '#1e1e26', cloth: '#2a2e38', vest: '#f2eee2', band: { cloth: '#1a1e28', symbol: 'cloud' }, vestOpts: { kumo: true }, bareArms: true },
      iwa_ninja:  { skin: '#e6b48c', hair: '#3a2a1e', cloth: '#93392e', vest: '#7a6450', band: { cloth: '#6e2a22', symbol: 'stone' }, vestOpts: { strap: true }, oneSleeve: true, scarf: '#c8a24a' },
      // Minor villages: Ame (rain mask), Oto (rope belt, purple), Taki (green vest), Kusa (grass greens), Yu (warm onsen tones).
      ame_ninja:  { skin: '#e4bf9e', hair: '#40465a', cloth: '#3a4152', vest: '#6e7a8c', band: { cloth: '#2a2f3c', symbol: 'rain', slash: true }, mask: '#2e3442', vestOpts: { ribs: true } },
      oto_ninja:  { skin: '#e8c2a0', hair: '#4a3a5a', cloth: '#5a4f68', vest: '#a89878', band: { cloth: '#2a2430', symbol: 'sound' }, rope: true, vestOpts: { plain: true } },
      taki_ninja: { skin: '#eac19c', hair: '#2e4a3a', cloth: '#2f5048', vest: '#7aa494', band: { cloth: '#33423a', symbol: 'taki' }, vestOpts: { strap: true } },
      kusa_ninja: { skin: '#e9c49e', hair: '#5a4a2a', cloth: '#4d6a34', vest: '#9ab86a', band: { cloth: '#3a4a26', symbol: 'grass' }, vestOpts: { ribs: true }, scarf: '#c9b25a' },
      yu_ninja:   { skin: '#eebf98', hair: '#2a2228', cloth: '#7a3a2e', vest: '#d8b48a', band: { cloth: '#3a2a26', symbol: 'yuga' }, vestOpts: { strap: true }, bulk: .5 },
      // Konoha: the green flak jacket and the leaf on a navy band.
      konoha_ninja: { skin: '#efc39c', hair: '#3a2a1e', iris: '#3a2a1e', cloth: '#25324a', vest: '#5f7d3a', band: { cloth: '#1c2433', symbol: 'leaf' }, vestOpts: {}, scarf: '#2c3b56' },
      // Allied Shinobi Forces (Fourth War): each village's uniform, every plate engraved with 忍.
      shinobi_ally:      { skin: '#f0c7a2', hair: '#5a3a22', iris: '#4a3222', cloth: '#2b3954', vest: '#5d7a3b', band: { cloth: '#1c1d26', symbol: 'nin' }, vestOpts: {}, mouth: 'smirk' },
      shinobi_ally_suna: { skin: '#e2b48a', hair: '#c08a3e', iris: '#5a4a2a', cloth: '#6e5a44', vest: '#bfa070', band: { cloth: '#1c1d26', symbol: 'nin' }, vestOpts: { strap: true }, len: .9 },
      shinobi_ally_kumo: { skin: '#a8704a', hair: '#f2e6a6', iris: '#d8a31a', cloth: '#262a36', vest: '#e8eef8', band: { cloth: '#1c1d26', symbol: 'nin' }, vestOpts: { kumo: true }, bareArms: true, len: 1.1 },
      shinobi_ally_kiri: { skin: '#eec7a4', hair: '#2e6a76', iris: '#3a5a6a', cloth: '#34445a', vest: '#7f90a8', band: { cloth: '#1c1d26', symbol: 'nin' }, vestOpts: { ribs: true }, smoothHair: true },
      shinobi_ally_iwa:  { skin: '#e6b48c', hair: '#1e1a1c', iris: '#3a2a1e', cloth: '#8a3a2c', vest: '#7a5a46', band: { cloth: '#1c1d26', symbol: 'nin' }, vestOpts: { strap: true }, oneSleeve: true, scarf: '#b4582e' }
    }[kind];
    const spec = {
      outline: '#1a1612', skin: base.skin, bulk: base.bulk || 0,
      legs: { thigh: dark(base.cloth, .1), shin: dark(base.cloth, .1), foot: '#242a38', wrap: '#e8e4da', w1: kind === 'brute' ? 6.4 : 5.4, w2: kind === 'brute' ? 5.2 : 4.4, holster: '#2a2a30' },
      arms: {
        upper: kind === 'runner' || base.bareArms ? base.skin : base.cloth, lower: kind === 'runner' || base.bareArms ? base.skin : base.cloth,
        w1: kind === 'brute' ? 5.8 : 4.4, w2: kind === 'brute' ? 5.2 : 3.8,
        hand: kind === 'brute' ? '#4a3a30' : null, cuff: kind === 'runner' ? '#30343f' : null, guard: kind === 'walker' ? '#8f99a6' : null
      },
      torso: { base: base.cloth, over: flakVest(base.vest, base.vestOpts) },
      head: {
        hair: base.smoothHair ? HAIR.smooth(base.hair, { nape: 7 }) : HAIR.spiky(base.hair, { count: kind === 'brute' ? 5 : 7, len: base.len || (kind === 'runner' ? 1.2 : .7) }),
        eyes: { type: 'normal', iris: base.iris || (kind === 'runner' ? '#d8a31a' : kind === 'spitter' ? '#7a3a2a' : kind === 'brute' ? '#6a4a2a' : '#4a4e5c') },
        browAngle: 'angry', brows: kind === 'brute' ? 'thick' : true, browColor: dark(base.hair, .3), mouth: base.mouth || 'frown', attackMouth: 'shout',
        band: Object.assign({ plate: '#c3cad3' }, base.band),
        mask: base.mask ? (ctx, spec) => {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3, 3.8); ctx.lineTo(10.6, 3.5); ctx.quadraticCurveTo(10.4, 9.6, 6, 10.9); ctx.quadraticCurveTo(0, 11.6, -3.6, 8.6); ctx.closePath(); }, base.mask, '#1a1612', .8, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-5, 3, 5, 10);
            ctx.strokeStyle = dark(base.mask, .3); ctx.lineWidth = .4;
            for (let y = 5.6; y < 11; y += 1.8) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(11, y - .4); ctx.stroke(); }
          });
        } : null
      },
      front(ctx, pose, hand) {
        // Kunai in the leading hand.
        ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(pose.attack ? 0 : pose.run ? 2.6 : 1.3);
        paint(ctx, () => poly(ctx, [[1.4, -1.3], [9, 0], [1.4, 1.3]]), '#a4adb8', '#1a1612', .6, () => { ctx.fillStyle = '#e6ecf2'; ctx.fillRect(1.4, -1.3, 8, 1.1); });
        line(ctx, [[-2.8, 0], [1.4, 0]], '#3a2a24', 1.4);
        ctx.strokeStyle = '#1a1612'; ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(-3.6, 0, .9, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    };
    spec.closeUp = { hair: base.wrap || base.hair, fringe: base.wrap ? 'wrap' : base.smoothHair ? 'part' : 'spiky', mask: base.mask, accent: light(base.band.cloth, .3) };
    if (base.rope) spec.torso.paint = ctx => {
      // Sound ninja: purple rope belt tied in a bow.
      ctx.fillStyle = '#6a3d96'; ctx.fillRect(-8, -2.8, 17, 2.4);
      ctx.strokeStyle = '#3e2058'; ctx.lineWidth = .4; for (let x = -7; x < 9; x += 1.4) { ctx.beginPath(); ctx.moveTo(x, -2.8); ctx.lineTo(x + 1, -.4); ctx.stroke(); }
    };
    if (kind === 'brute') spec.torso.paint = ctx => { ctx.fillStyle = dark(base.cloth, .3); ctx.fillRect(-9, -2.6, 18, 2.4); };
    if (base.bareArms) spec.arms.guard = '#3a3e4a';
    if (base.oneSleeve) {
      // Iwa uniform: sleeved far arm, bare near arm with a wrist wrap.
      spec.arms = Object.assign({}, spec.arms, { upper: base.skin, lower: base.skin, cuff: '#e8e4da' });
      const sleeved = { upper: base.cloth, lower: base.cloth };
      const draw0 = spec.arms;
      spec.farArms = Object.assign({}, draw0, sleeved, { cuff: null });
    }
    if (base.wrap) {
      // Suna desert head wrap under the forehead protector, its tail hanging behind.
      const c = base.wrap;
      spec.head.hair = (ctx, sp) => {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(10.8, -2.4); ctx.quadraticCurveTo(12.2, -14, 0, -14); ctx.quadraticCurveTo(-13, -13.4, -12, 2); ctx.lineTo(-10.4, 9.6); ctx.lineTo(-3.4, 9.6); ctx.lineTo(-3, -1); ctx.lineTo(10.8, -2.4); ctx.closePath(); }, c, sp.outline, 1.05, () => {
          ctx.fillStyle = dark(c, .26); ctx.fillRect(-14, -3, 30, 16);
          ctx.strokeStyle = dark(c, .35); ctx.lineWidth = .5;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-11, -9 + i * 3.6); ctx.quadraticCurveTo(0, -12 + i * 3, 11, -8 + i * 3); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, 2, -11, 6, 1.6, -.2); ctx.fill();
        });
      };
      spec.head.drape = (ctx, sp) => paint(ctx, () => smooth(ctx, [[-9, 2], [-13, 6], [-14.6, 13], [-12, 14], [-10.6, 8], [-7, 6]]), dark(c, .1), sp.outline, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-16, 8, 10, 8); });
    }
    if (base.sword) {
      // Kubikiribōchō-style cleaver strapped to the back.
      spec.back = (ctx) => {
        ctx.save(); ctx.translate(-3, 1); ctx.rotate(-1.98);
        line(ctx, [[-8, 0], [-1, 0]], '#3a2a24', 2);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-1, -3.6); ctx.lineTo(26, -3.6); ctx.lineTo(28, 3.4); ctx.lineTo(-1, 3.4); ctx.closePath(); }, '#b9c2cc', '#1a1612', .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-2, .6, 32, 4);
          ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(0, -3.4, 26, .8);
          ctx.fillStyle = '#3a4656'; ctx.beginPath(); ctx.arc(23, -.4, 1.8, 0, TAU); ctx.fill();
        });
        ctx.restore();
      };
    }
    if (base.scarf) {
      const c = base.scarf;
      spec.collar = (ctx, pose) => {
        paint(ctx, () => smooth(ctx, [[-5.6, -12.4], [-2, -15.6], [4.4, -15], [7.4, -13], [4.4, -11.4], [-2.6, -11.6]]), c, '#1a1612', .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-7, -13, 16, 3);
          ctx.strokeStyle = dark(c, .35); ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-3, -12.6); ctx.quadraticCurveTo(1, -14, 6, -12.6); ctx.stroke();
        });
        // Scarf tail: hangs at rest, streams back and flaps with the stride when running.
        const sway = pose.run ? -4 - Math.sin(pose.wave || 0) * 1.2 : 0, flap = pose.run ? Math.sin((pose.wave || 0) * 2) * 1.1 : 0;
        paint(ctx, () => smooth(ctx, [[-4.6, -13.4], [-7 + sway * .5, -11.6 + flap * .4], [-9.4 + sway, -10.2 + sway * .3 + flap], [-8.6 + sway, -7.4 + sway * .3 + flap], [-6 + sway * .4, -9.6], [-3.6, -11.6]]), dark(c, .15), '#1a1612', .8, () => {
          ctx.fillStyle = DEEP2; ctx.fillRect(-14, -9.4 + flap, 12, 4);
        });
      };
    }
    return spec;
  }

  // ---------------------------------------------------------------- Fourth War helpers
  // Madara's gunbai (war fan): paddle-shaped red blade with a gold rim and a black mitsudomoe,
  // dark wrapped handle, a short chain hanging from the pommel. Origin at the grip, blade along -y.
  function gunbai(ctx, x, y, rot, O, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    // Chain links swinging from the pommel.
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = .45;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-.6 - i * .9, 4.4 + i * 1.5, .55, .8, .5, 0, TAU); ctx.stroke(); }
    // Handle with a cord wrap.
    line(ctx, [[0, 3.6], [0, -8]], O, 2.6);
    line(ctx, [[0, 3.6], [0, -8]], '#3a2418', 1.6);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = .4;
    for (let yy = 2.6; yy > -6.6; yy -= 1.3) { ctx.beginPath(); ctx.moveTo(-.8, yy); ctx.lineTo(.8, yy - .7); ctx.stroke(); }
    const blade = (k) => {
      ctx.beginPath();
      ctx.moveTo(-1.6 * k, -7.4 - (1 - k) * 2);
      ctx.bezierCurveTo(-8.4 * k, -9.6, -10.2 * k, -18, -7.6 * k, -22.6 + (1 - k) * 2);
      ctx.bezierCurveTo(-4.8 * k, -27.2 + (1 - k) * 3, 4.8 * k, -27.2 + (1 - k) * 3, 7.6 * k, -22.6 + (1 - k) * 2);
      ctx.bezierCurveTo(10.2 * k, -18, 8.4 * k, -9.6, 1.6 * k, -7.4 - (1 - k) * 2);
      ctx.closePath();
    };
    paint(ctx, () => blade(1), '#d8b062', O, 1.1, () => {
      ctx.fillStyle = '#a82228'; blade(.86); ctx.fill();
      ctx.fillStyle = 'rgba(60,0,10,.32)'; ctx.fillRect(-12, -30, 12, 26);
      ctx.fillStyle = 'rgba(255,190,170,.28)'; ell(ctx, 3.6, -21.6, 2.6, 1.4, -.5); ctx.fill();
      // Mitsudomoe in the centre of the blade.
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3;
        tomoe(ctx, Math.cos(a) * 2.4, -16.6 + Math.sin(a) * 2.4, 1.25, a + Math.PI / 2, '#16080a');
      }
      dot(ctx, 0, -16.6, .7, '#16080a');
    });
    // Metal collar where the blade meets the handle.
    paint(ctx, () => { ctx.beginPath(); ctx.rect(-1.7, -9, 3.4, 2); }, '#9aa0aa', O, .6);
    ctx.restore();
  }

  // Madara's mane: a huge, wild, spiky mass falling down the back to the thighs.
  // Head-local frame; the torso covers its middle so it frames both shoulders.
  const MANE_BACK = [[-22, -12], [-15, -6], [-24, -2], [-16, 3], [-25, 9], [-17, 12], [-24, 18], [-16, 20], [-21, 27], [-13, 26],
    [-15, 34], [-8, 29], [-7, 36], [-2, 30], [1, 35], [3, 28], [7, 32], [7, 24], [12, 25], [8, 18], [13, 15], [8, 10], [11, 5], [8, 2]];
  function maneDrape(color) {
    return (ctx, spec, pose) => {
      const O = spec.outline, sway = pose && pose.run ? -3 : 0;
      const pts = [[4, -9], [-4, -14], [-14, -15]].concat(MANE_BACK.map(([x, y], i) => [x + sway * (y > 10 ? (y - 10) / 30 : 0) * (i % 2 ? .8 : 1), y - (pose && pose.run ? Math.max(0, y - 10) * .08 : 0)]));
      const build = () => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const c = edgeCtrl(pts[i - 1], pts[i], i % 2 ? .16 : -.1);
          ctx.quadraticCurveTo(c[0], c[1], pts[i][0], pts[i][1]);
        }
        ctx.closePath();
      };
      paint(ctx, build, color, O, 1.1, () => {
        const sh = dark(color, .32), deep = dark(color, .5);
        ctx.fillStyle = sh; ctx.fillRect(-40, -4, 80, 60);
        ctx.fillStyle = color; ell(ctx, -12, -6, 12, 10, -.3); ctx.fill();
        ctx.fillStyle = rgba(deep, .7); ell(ctx, -2, 30, 12, 9); ctx.fill();
        shine(ctx, -6, 0, 14, -190, -120, 2.6, hairGloss(color), 5);
        // Long strand strokes streaming down the back.
        ctx.strokeStyle = deep; ctx.lineWidth = .55; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const x0 = -20 + i * 3.4;
          ctx.beginPath(); ctx.moveTo(x0 + 4, -6 + (i % 3) * 3); ctx.quadraticCurveTo(x0 - 2, 14, x0 - 1 + (i % 2) * 2, 30 + (i % 3) * 4); ctx.stroke();
        }
        ctx.strokeStyle = rgba(hairGloss(color), .5); ctx.lineWidth = .5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-22 + i * 2.6, 2 + i * 3); ctx.quadraticCurveTo(-24 + i * 2, 12 + i * 3, -20 + i * 2.4, 22 + i * 2); ctx.stroke(); }
      });
    };
  }
  const MADARA_TIPS = [[-14, 15], [-38, 18.4], [-60, 20], [-84, 19.4], [-106, 21], [-128, 20.2], [-150, 21], [-172, 20], [-194, 19], [-214, 17], [-232, 15]];
  // Long, ragged bangs: the big lock hanging over his right (near) eye and a lock down the far cheek.
  function maneFront(color, parted) {
    return (ctx, spec) => {
      fringeShadow(ctx, [[-3, -6], [3.4, -6.4], [2.2, 2], [.4, 11], [-2.4, 4]]);
      locks(ctx, spec, color, [
        [9.8, -7.4, 11.6, 9.6, 1.6, 1.2], [7.6, -8.6, 8.4, -3.4, 1.3, .4]
      ].concat(parted ? [] : [[4.6, -9, 4.6, -4.2, 1.3, 0]]), .9);
      const O = spec.outline;
      paint(ctx, () => {
        ctx.beginPath(); ctx.moveTo(-3.6, -9.4); ctx.quadraticCurveTo(3.6, -9.6, 3.2, -3.4);
        ctx.quadraticCurveTo(2.6, .6, 1.6, 3.6); ctx.lineTo(2.4, 6.8); ctx.quadraticCurveTo(1, 7, .4, 12.4);
        ctx.quadraticCurveTo(-.6, 6.4, -1.6, 3); ctx.quadraticCurveTo(-3.4, -2.6, -3.6, -9.4); ctx.closePath();
      }, color, O, .95, () => {
        ctx.fillStyle = dark(color, .3); ctx.fillRect(-5, -1, 4, 15);
        ctx.fillStyle = hairGloss(color); ell(ctx, .8, -6, 1.2, 2.2, .4); ctx.fill();
        ctx.strokeStyle = dark(color, .45); ctx.lineWidth = .4;
        ctx.beginPath(); ctx.moveTo(-1, -7); ctx.quadraticCurveTo(1.4, -2, .6, 9); ctx.stroke();
      });
    };
  }
  // Edo Tensei cracks: dark grey fissures round the eyes and down the cheeks.
  function edoCracks(ctx) {
    const c = '#4a4450';
    line(ctx, [[-.4, 4.4], [-.2, 6.2], [-1.2, 7.6]], c, .36); line(ctx, [[-.2, 6.2], [.9, 7.4]], c, .3);
    line(ctx, [[3.6, 4.8], [3.9, 6.6], [3.2, 7.8]], c, .32);
    line(ctx, [[5.2, 4.6], [6.2, 4.4], [6.6, 5.6]], c, .3);
    line(ctx, [[9.5, 4.4], [9.7, 6.4], [10.3, 7.2]], c, .34);
    line(ctx, [[-.6, .2], [-1.8, -1.2], [-1.6, -2.6]], c, .32);
    line(ctx, [[9.8, -.4], [10.4, -1.8]], c, .3);
    line(ctx, [[1.8, 9.2], [2.4, 10.4]], c, .28);
    ctx.strokeStyle = 'rgba(60,50,70,.5)'; ctx.lineWidth = .32;
    ctx.beginPath(); ctx.moveTo(-.4, 4.2); ctx.quadraticCurveTo(2.4, 5.6, 4.6, 4.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.4, 4); ctx.quadraticCurveTo(8, 5.2, 9.6, 4); ctx.stroke();
  }
  // Red samurai armour shared by Madara: lamellar rows with lit edges.
  const MADARA_RED = '#9e2228', MADARA_DEEP = '#4e0c12', MADARA_SUIT = '#1d2030';

  // Rinne-Sharingan: the red rippled third eye with nine tomoe in three rings.
  function thirdEye(ctx, x, y, s = 1) {
    paint(ctx, () => ell(ctx, x, y, 1.5 * s, 1.85 * s), '#d8202c', '#3a0a10', .5);
    ctx.strokeStyle = '#3a0a10'; ctx.lineWidth = .22;
    ell(ctx, x, y, .8 * s, 1 * s); ctx.stroke(); ell(ctx, x, y, 1.2 * s, 1.48 * s); ctx.stroke();
    dot(ctx, x, y, .3 * s, '#2a0408');
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; dot(ctx, x + Math.cos(a) * s, y + Math.sin(a) * 1.22 * s, .2 * s, '#2a0408'); }
    dot(ctx, x - .5 * s, y - .7 * s, .25 * s, 'rgba(255,255,255,.7)');
  }

  function madaraSpec(rikudo) {
    const O = rikudo ? '#1a1620' : '#140c10';
    const hair = rikudo ? '#eceaf0' : '#17151d';
    const suit = rikudo ? '#1a1920' : MADARA_SUIT;
    const spec = {
      outline: O, skin: rikudo ? '#e9e6e6' : '#ecdccf', skinShade: rikudo ? '#bab2bc' : '#bea6a6', bulk: .7,
      legs: { thigh: suit, shin: suit, foot: rikudo ? '#141319' : '#1a1c28', w1: 5.8, w2: 4.6, boots: rikudo },
      arms: rikudo
        ? { upper: '#e9e6e6', lower: '#e9e6e6', w1: 4.8, w2: 4.4, cuff: '#1a1920' }
        : { upper: MADARA_SUIT, lower: MADARA_SUIT, guard: MADARA_RED, w1: 4.9, w2: 4.5 },
      head: {
        drape: maneDrape(hair),
        hair: (ctx, sp) => sweptHair(ctx, sp, hair, MADARA_TIPS, { valley: 13.6, sweep: .22, gloss: rikudo ? '#ffffff' : null }),
        eyes: { type: rikudo ? 'rinnegan' : 'edoRinnegan' }, mouth: rikudo ? 'neutral' : 'smirk', attackMouth: 'shout',
        browAngle: 'angry', browColor: rikudo ? '#b8b2c0' : '#17151d', blush: false,
        marks: rikudo ? null : edoCracks,
        front(ctx, sp) {
          maneFront(hair, rikudo)(ctx, sp);
          if (rikudo) thirdEye(ctx, 5.2, -5.4, 1.05);
        }
      }
    };
    if (!rikudo) {
      // Edo Tensei Madara: dark red samurai armour over the navy-black battle suit.
      Object.assign(spec, {
        torso: {
          base: MADARA_RED, paint: ctx => {
            for (let y = -12.4, r = 0; y < -2; y += 2.3, r++) {
              ctx.fillStyle = 'rgba(255,170,150,.24)'; ctx.fillRect(-8, y + .2, 17, .6);
              ctx.strokeStyle = MADARA_DEEP; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-8, y + 2.1); ctx.lineTo(9, y + 1.8); ctx.stroke();
              ctx.fillStyle = '#2a080c'; for (let x = -5 + (r % 2) * 1.6; x < 8; x += 3.2) ctx.fillRect(x, y + 1.1, .45, .45);
              // Each lame darkens toward its lower edge; braided lacing cords tie the rows.
              ctx.fillStyle = 'rgba(60,4,14,.28)'; ctx.fillRect(-8, y + 1.3, 17, .8);
              ctx.strokeStyle = '#3a0a12'; ctx.lineWidth = .3;
              for (let x = -6.2 + (r % 2) * .8; x < 8.5; x += 1.6) { ctx.beginPath(); ctx.moveTo(x, y + 1.6); ctx.lineTo(x + .25, y + 2.7); ctx.stroke(); }
            }
            line(ctx, [[2.6, -12.6], [3.1, -2]], MADARA_DEEP, .55);
            ctx.fillStyle = MADARA_SUIT; ctx.fillRect(-9, -2.8, 19, 2.8);
            ctx.fillStyle = 'rgba(160,170,210,.25)'; ctx.fillRect(-9, -2.8, 19, .5);
          }
        },
        skirt: {
          color: MADARA_RED, hem: 10, flare: .8, opening: false, paint: (ctx, hem, hipY) => {
            // Tassets: hanging plate panels down to the knee.
            ctx.strokeStyle = MADARA_DEEP; ctx.lineWidth = .6;
            for (let y = hipY + 2; y < hem; y += 2.3) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,170,150,.2)'; for (let y = hipY + 2.3; y < hem; y += 2.3) ctx.fillRect(-16, y, 32, .5);
            ctx.strokeStyle = '#1a0408'; ctx.lineWidth = .8;
            for (const x of [-4.2, .8, 5.4]) { ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x + .3, hem + 2); ctx.stroke(); }
            ctx.fillStyle = MADARA_SUIT; ctx.fillRect(-16, hipY - 2, 32, 1.8);
          }
        },
        collarBack(ctx, pose) {
          // Gunbai slung on the back over the mane (in hand for attack / raise).
          if (!pose.attack && !pose.raise) gunbai(ctx, -6, pose.run ? -4 : -3, pose.run ? -1.1 : -.78, O, .8);
          // Far shoulder guard behind the body.
          paint(ctx, () => smooth(ctx, [[2.2, -13.8], [7.8, -14.4], [10.8, -11], [10, -7.2], [4.6, -8.4]]), dark(MADARA_RED, .2), O, .9, () => {
            ctx.strokeStyle = MADARA_DEEP; ctx.lineWidth = .5; for (const y of [-11.8, -9.8]) { ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(12, y + .4); ctx.stroke(); }
          });
        },
        collar(ctx) {
          // Uchiha high collar of the battle suit, standing up to the jaw.
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.4, -11.2); ctx.lineTo(-7.2, -17.4);
            ctx.quadraticCurveTo(-2.4, -15.4, 3.4, -14.6); ctx.quadraticCurveTo(6.4, -14.4, 8.2, -15.6);
            ctx.lineTo(7.8, -12.8); ctx.quadraticCurveTo(7.6, -11.6, 7, -11); ctx.closePath();
          }, MADARA_SUIT, O, 1.05, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -19, 5, 9);
            ctx.fillStyle = 'rgba(150,165,215,.28)'; ctx.beginPath(); ctx.moveTo(-7.2, -17.4); ctx.quadraticCurveTo(-2.4, -15.4, 3.4, -14.6); ctx.quadraticCurveTo(6.4, -14.4, 8.2, -15.6); ctx.lineTo(8.2, -14.8); ctx.quadraticCurveTo(6.4, -13.6, 3.4, -13.8); ctx.quadraticCurveTo(-2.4, -14.6, -7.2, -16.6); ctx.fill();
          });
          line(ctx, [[3.6, -14], [4.2, -11.4]], '#0a0a10', .5);
        },
        shoulder(ctx) {
          // Big near pauldron: three overlapping red lames.
          for (let i = 2; i >= 0; i--) {
            const dy = i * 2;
            paint(ctx, () => smooth(ctx, [[-8.8, -13.2 + dy], [-2.6, -15.4 + dy], [3, -12.6 + dy], [2.2, -9.2 + dy], [-5.8, -8.8 + dy], [-9.4, -10.4 + dy]]), i ? '#8e1c22' : '#ac2a2e', O, .9, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-11, -10.6 + dy, 15, 3);
              ctx.fillStyle = 'rgba(255,200,190,.38)'; ell(ctx, -2.6, -13.8 + dy, 3.6, .7, .1); ctx.fill();
            });
          }
        },
        front(ctx, pose, hand) {
          if (pose.attack) gunbai(ctx, hand[0], hand[1], 1.05, O);
          else if (pose.raise) gunbai(ctx, hand[0], hand[1], -.1, O);
        }
      });
    } else {
      // Six Paths Madara: sleeveless black high-collared robe, nine magatama round the chest,
      // black chakra receivers driven into his chest.
      Object.assign(spec, {
        torso: {
          base: suit, paint: ctx => {
            ctx.strokeStyle = 'rgba(120,116,150,.5)'; ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-2, -12.6); ctx.lineTo(3.2, -8); ctx.stroke();
            line(ctx, [[3, -8.4], [3.6, 0]], '#060508', .5);
            ctx.fillStyle = '#2c2a34'; ctx.fillRect(-9, -3, 19, 2.4);
          }
        },
        skirt: { color: suit, hem: 8.6, flare: 1.2 },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.6, -20.4); ctx.quadraticCurveTo(-2, -18.6, 3.6, -18); ctx.lineTo(7, -12); ctx.closePath(); },
            '#d6d2dc', O, 1, () => { ctx.fillStyle = 'rgba(40,30,60,.35)'; ctx.fillRect(-9, -22, 6, 12); });
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.6, -11.2); ctx.lineTo(-7.4, -17.2);
            ctx.quadraticCurveTo(-2.4, -15.2, 3.4, -14.4); ctx.quadraticCurveTo(6.4, -14.2, 8.4, -15.6);
            ctx.lineTo(8, -12.8); ctx.quadraticCurveTo(7.8, -11.6, 7.2, -11); ctx.closePath();
          }, suit, O, 1.05, () => {
            ctx.fillStyle = '#d6d2dc'; ctx.beginPath(); ctx.moveTo(-7.4, -17.4); ctx.quadraticCurveTo(-2.4, -15.4, 3.4, -14.6); ctx.quadraticCurveTo(6.4, -14.4, 8.4, -15.8); ctx.lineTo(8.4, -14.8); ctx.quadraticCurveTo(6.4, -13.6, 3.4, -13.8); ctx.quadraticCurveTo(-2.4, -14.4, -7.4, -16.4); ctx.fill();
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -17, 5, 8);
          });
          // Nine black magatama hanging round the chest, rimmed pale so they read on the black robe.
          ctx.strokeStyle = '#cfcbd8'; ctx.lineWidth = .35;
          ctx.beginPath(); ctx.ellipse(1.8, -12.6, 7, 4.6, 0, .1 * Math.PI, .9 * Math.PI); ctx.stroke();
          for (let i = 0; i < 9; i++) {
            const a = (.12 + i * .095) * Math.PI, x = 1.8 + Math.cos(a) * 7, y = -12.6 + Math.sin(a) * 4.6;
            tomoe(ctx, x, y + .3, .8, Math.PI * .5, '#d8d4e2');
            tomoe(ctx, x, y + .3, .56, Math.PI * .5, '#0e0d12');
          }
        },
        front(ctx) {
          // Black receiver rods sticking out of the chest.
          for (const [x0, y0, x1, y1] of [[1.4, -9.6, 6.4, -13.2], [4.4, -7, 10.4, -8.4], [.6, -5.4, 5.2, -2.2], [5.6, -4, 9.6, -1.4]]) {
            line(ctx, [[x0, y0], [x1, y1]], '#3c3846', 1.9);
            line(ctx, [[x0, y0], [x1, y1]], '#0c0b10', 1.2);
            dot(ctx, x1, y1, .85, '#0c0b10');
            dot(ctx, x1 - .3, y1 - .3, .28, '#8a88a0');
          }
        }
      });
    }
    return spec;
  }

  // Killer Bee, the Eight-Tails' jinchūriki (killer-bee-boss.js): dark skin, short pale-blond hair,
  // wraparound sunglasses, white goatee and moustache, the ox-horn tattoo on his cheek and 鉄 on his
  // shoulder, Kumo's one-strap white flak vest cinched with a thick twisted rope, seven swords fanned on his back.
  function killerBeeSpec() {
    const O = '#170e0a', SKIN = '#7d4b2d', SKIN_D = '#5a321e', VEST = '#eeeae0', PANTS = '#2b2d39', BLOND = '#f0e4b2', ROPE = '#d8bd86', BEARD = '#f4f1ea';
    // One katana seen from behind the shoulder: the scabbard mouth, a round tsuba and the wrapped hilt.
    const sword = (ctx, x, y, rot, len) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      line(ctx, [[0, 0], [0, -4]], O, 3.2); line(ctx, [[0, 0], [0, -4]], '#2e2a36', 2.2);
      paint(ctx, () => ell(ctx, 0, -4.4, 2.1, .9), '#a08a5a', O, .55, () => { ctx.fillStyle = 'rgba(255,240,190,.5)'; ctx.fillRect(-2, -5.2, 4, .6); });
      line(ctx, [[0, -4.8], [0, -4.8 - len]], O, 2.4); line(ctx, [[0, -4.8], [0, -4.8 - len]], '#e9e4d6', 1.5);
      ctx.strokeStyle = '#2a2430'; ctx.lineWidth = .4;
      for (let i = 0; i < len / 1.3 - 1; i++) { const yy = -5.6 - i * 1.3; ctx.beginPath(); ctx.moveTo(-.75, yy); ctx.lineTo(.75, yy - .8); ctx.moveTo(.75, yy); ctx.lineTo(-.75, yy - .8); ctx.stroke(); }
      paint(ctx, () => ell(ctx, 0, -5.2 - len, 1.05, .8), '#b89a52', O, .5);
      ctx.restore();
    };
    return {
      outline: O, skin: SKIN, skinShade: SKIN_D, bulk: 2.0, headScale: .95, legK: 1.12,
      legs: { thigh: PANTS, shin: PANTS, foot: '#20212b', wrap: '#e8e4da', w1: 6.4, w2: 5.2 },
      arms: {
        upper: SKIN, lower: SKIN, w1: 6.4, w2: 5.8, guard: '#262833', bare: true,
        pattern(ctx, p0, p1, p2, far) {
          if (far) return;
          // 鉄 ("iron") inked on the shoulder.
          const m = lerp(p0, p1, .38);
          ctx.save(); ctx.translate(m[0] + .4, m[1]); ctx.rotate(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.PI / 2);
          ctx.font = 'bold 3.4px "Yu Gothic","MS Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(20,10,8,.85)'; ctx.fillText('鉄', 0, 0);
          ctx.restore();
        }
      },
      torso: {
        base: '#30323e',
        over(ctx) {
          flakVest(VEST, { kumo: true, outline: O })(ctx);
          // Thick twisted rope belt with the knot at the front and two short ends hanging down.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.4, -3.6); ctx.quadraticCurveTo(0, -4.6, 8, -3.4); ctx.lineTo(8.1, .2); ctx.quadraticCurveTo(0, -.8, -7.2, .2); ctx.closePath(); }, ROPE, O, .9, () => {
            ctx.strokeStyle = '#8f7240'; ctx.lineWidth = .55;
            for (let x = -8; x < 9; x += 1.5) { ctx.beginPath(); ctx.moveTo(x, -4.4); ctx.quadraticCurveTo(x + .9, -1.8, x + .3, .4); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,250,225,.45)'; ctx.fillRect(-8, -4, 17, .8);
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -1.2, 17, 1.6);
          });
          for (const [dx, len, rot] of [[-.6, 6.2, .18], [1.0, 5.2, -.12]]) {
            ctx.save(); ctx.translate(5 + dx, -1.4); ctx.rotate(rot);
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-.9, 0); ctx.lineTo(-.7, len); ctx.lineTo(.7, len + .3); ctx.lineTo(.9, 0); ctx.closePath(); }, ROPE, O, .6, () => {
              ctx.strokeStyle = '#8f7240'; ctx.lineWidth = .4; for (let y = .8; y < len; y += 1.2) { ctx.beginPath(); ctx.moveTo(-.9, y); ctx.lineTo(.9, y + .7); ctx.stroke(); }
            });
            ctx.restore();
          }
          paint(ctx, () => ell(ctx, 5.2, -1.8, 2, 1.7), ROPE, O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(3, -1.6, 5, 2); ctx.fillStyle = 'rgba(255,250,225,.5)'; ell(ctx, 4.6, -2.6, .9, .4); ctx.fill(); });
        }
      },
      back(ctx) {
        // Seven swords fanned out behind the shoulders, hilts up.
        const list = [[-2.4, 7.4], [-2.18, 8.4], [-1.97, 9.2], [-1.76, 9.6], [-1.56, 9.2], [-1.36, 8.4], [-1.16, 7.4]];
        list.forEach(([a, len], i) => {
          const bx = -3.6 + i * .75, by = -11;
          ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
          // Scabbard running down the back.
          line(ctx, [[0, 0], [0, 12]], O, 3); line(ctx, [[0, 0], [0, 12]], i % 2 ? '#3a3040' : '#4a3a2c', 2);
          ctx.restore();
          sword(ctx, bx, by, a + Math.PI / 2, len);
        });
      },
      head: {
        hair: HAIR.spiky(BLOND, { count: 7, len: .42 }),
        noEyes: true, brows: false, mouth: 'smirk', attackMouth: 'shout', blush: false,
        band: { cloth: '#1c1e28', plate: '#c3cad3', symbol: 'cloud' },
        marks(ctx, spec) {
          // Ox-horn tattoo on the near cheek.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-.4, 4.4); ctx.quadraticCurveTo(.6, 7.4, 3, 7.8); ctx.quadraticCurveTo(1.2, 6.6, .9, 4.4); ctx.closePath(); }, '#2a160e', null);
          // White moustache and goatee.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(4, 7.3); ctx.quadraticCurveTo(6.6, 5.6, 9.8, 6.3); ctx.lineTo(9.6, 7.1); ctx.quadraticCurveTo(6.8, 6.5, 4.4, 8.1); ctx.closePath(); }, BEARD, O, .5);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(4.8, 9.2); ctx.quadraticCurveTo(6.8, 8.6, 8.8, 9); ctx.quadraticCurveTo(8.4, 11.6, 6.6, 13.6); ctx.quadraticCurveTo(5.2, 11.6, 4.8, 9.2); ctx.closePath(); }, BEARD, O, .6, () => {
            ctx.fillStyle = 'rgba(150,140,160,.4)'; ctx.fillRect(3, 11.2, 8, 3);
            ctx.strokeStyle = 'rgba(150,140,160,.6)'; ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(6.6, 9.4); ctx.lineTo(6.6, 12.6); ctx.stroke();
          });
          // Wraparound sunglasses: two dark lenses, a bridge and the arm running back to the ear.
          line(ctx, [[-.2, 1.1], [-3.6, 1.2]], O, 1.1);
          line(ctx, [[-.2, 1.1], [-3.6, 1.2]], '#3a3c48', .5);
          const lens = (pts) => paint(ctx, () => smooth(ctx, pts), '#15141c', O, .7, () => {
            ctx.fillStyle = 'rgba(80,90,130,.55)'; ctx.fillRect(-2, 2.6, 14, 2);
            ctx.fillStyle = 'rgba(255,255,255,.62)';
            ctx.beginPath(); ctx.moveTo(1, 3.4); ctx.lineTo(2.6, -.2); ctx.lineTo(3.6, -.2); ctx.lineTo(2, 3.4); ctx.fill();
            ctx.beginPath(); ctx.moveTo(7.4, 2.8); ctx.lineTo(8.6, .2); ctx.lineTo(9.1, .2); ctx.lineTo(7.9, 2.8); ctx.fill();
          });
          lens([[-.6, .4], [2.4, -.4], [5.2, .2], [5.2, 2.6], [3.6, 4.6], [.6, 4.4], [-.4, 2.8]]);
          lens([[6.4, .2], [8.6, -.2], [10.6, .4], [10.4, 2.6], [9.2, 4.2], [7.2, 4], [6.4, 2.6]]);
          line(ctx, [[5.1, 1.2], [6.5, 1.1]], O, .8);
        }
      }
    };
  }

  function tsunadeSpec() {
    const O = '#2a1a18', HAORI = '#6f9c58', hair = '#f3d36a', skin = '#f9dcc6';
    return {
      outline: O, skin, skinShade: '#e2aa92',
      legs: { thigh: '#2a3350', shin: '#2a3350', foot: '#2a2430', w1: 5, w2: 4.2 },
      arms: { upper: HAORI, lower: HAORI, w1: 5.2, w2: 5.2, cuff: dark(HAORI, .18) },
      torso: {
        base: '#a2a6a9', paint: ctx => {
          // Grey kimono-style top crossing into a V, navy obi sash.
          ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(.4, -13.4); ctx.lineTo(6.8, -13.4); ctx.lineTo(4.2, -8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(176,96,122,.3)'; ctx.beginPath(); ctx.moveTo(3.6, -11.2); ctx.lineTo(4.6, -11.2); ctx.lineTo(4.2, -8.4); ctx.fill();
          line(ctx, [[.4, -13.4], [4.2, -8], [6.8, -13.4]], '#5a5e64', .5);
          ctx.fillStyle = '#2a3350'; ctx.fillRect(-8, -4.8, 17, 3.6);
          ctx.fillStyle = '#4a5478'; ctx.fillRect(-8, -4.4, 17, .5);
          ctx.fillStyle = '#a2a6a9'; ctx.fillRect(-8, -1.2, 17, 1.4);
        },
        over(ctx) {
          // Open green haori hanging down both sides.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.2, -12.6); ctx.lineTo(-3.4, -13.4); ctx.quadraticCurveTo(-4.4, -6, -3.4, 1); ctx.lineTo(-7.4, 1); ctx.quadraticCurveTo(-7.8, -6, -7.2, -12.6); ctx.closePath(); }, HAORI, O, .85, () => {
            ctx.fillStyle = 'rgba(40,60,40,.3)'; ctx.fillRect(-9, -14, 3.4, 16);
            ctx.strokeStyle = 'rgba(30,50,30,.4)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-5.4, -10); ctx.quadraticCurveTo(-6, -4, -5.2, 1); ctx.stroke();
          });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(6.6, -12.8); ctx.lineTo(8.4, -12); ctx.quadraticCurveTo(8.8, -6, 8.2, 1); ctx.lineTo(6.4, 1); ctx.quadraticCurveTo(7, -6, 6.6, -12.8); ctx.closePath(); }, HAORI, O, .8, () => {
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(6.6, -12, .7, 12);
          });
        }
      },
      collarBack(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.2, -15.2); ctx.quadraticCurveTo(-4, -16, -1, -14.4); ctx.lineTo(-1, -11); ctx.closePath(); }, HAORI, O, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 4, 6); });
      },
      shoulder(ctx) {
        paint(ctx, () => smooth(ctx, [[-7.2, -12.8], [-2.4, -13.8], [1, -12], [-.4, -8.4], [-6.4, -8], [-7.8, -10]]), HAORI, O, .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -10, 12, 3);
        });
      },
      skirt: {
        color: HAORI, hem: 8.4, paint: (ctx, hem, hipY) => {
          // 賭 ("gamble") on the back of the haori, glimpsed on the far flap.
          ctx.font = 'bold 4.2px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(20,30,20,.75)'; ctx.fillText('賭', -6.2, (hipY + hem) / 2 + .6);
        }
      },
      head: {
        drape(ctx, spec) {
          // Two long low pigtails hanging down the back, tied at the nape.
          for (const [x0, dx, len] of [[-5.6, -4.6, 33], [-8.8, -7.4, 30]]) {
            paint(ctx, () => smooth(ctx, [[x0 + 1.4, 4.4], [x0 + dx * .4 - 2.4, 13], [x0 + dx - 2.2, len * .72], [x0 + dx - .4, len + 1], [x0 + dx + 1.8, len * .76], [x0 + dx * .4 + 2.4, 13], [x0 + 2.8, 5]]), hair, spec.outline, .95, () => {
              ctx.fillStyle = dark(hair, .3); ctx.fillRect(x0 - 12, 12, 24, 30);
              ctx.strokeStyle = dark(hair, .42); ctx.lineWidth = .45;
              for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x0 + 1 + i * .6, 7); ctx.quadraticCurveTo(x0 + dx * .5 - 1 + i, 18, x0 + dx - .6 + i * .8, len - 2); ctx.stroke(); }
              ctx.strokeStyle = hairGloss(hair); ctx.lineWidth = .6;
              ctx.beginPath(); ctx.moveTo(x0 + .2, 8); ctx.quadraticCurveTo(x0 + dx * .4 - 1.6, 14, x0 + dx - 1.2, len * .6); ctx.stroke();
            });
            paint(ctx, () => ell(ctx, x0 + 1.6, 6.8, 1.7, 1.1, .3), '#5a3a2e', spec.outline, .6);
          }
        },
        hair: HAIR.smooth(hair, { nape: 7.2, bangs: [[9.6, 1.6, 7.8], [-.6, 1.7, 8.4]] }),
        eyes: { type: 'normal', iris: '#a0692e', fem: true }, mouth: 'lips', lipColor: '#c95a6e', attackMouth: 'shout', browColor: '#b8902e',
        marks(ctx) {
          // Byakugō (Strength of a Hundred) seal: purple diamond on the forehead.
          paint(ctx, () => poly(ctx, [[4.6, -5.8], [5.5, -4.2], [4.6, -2.6], [3.7, -4.2]]), '#8a4fc8', '#3a1a5a', .4, () => {
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(3.8, -5.8, 1, 1.4);
          });
        }
      }
    };
  }

  // Adult Sasuke, Indra's reincarnation (end of Shippuden / The Last): swept-back black hair with a long
  // fringe over the left eye (purple ripple Rinnegan with tomoe peeking through), Eternal Mangekyō in the
  // right eye, dark grey high-collared poncho over dark clothes, Kusanagi slung across the back.
  function sasukeIndraSpec() {
    const O = '#0e0c14', HAIR = '#17161e', CLOAK = '#3a3946', CLOAK_D = '#2a2933', PANTS = '#272631';
    // Kusanagi: straight chokutō, black wrapped hilt, small square guard. Origin at the grip, blade along +x.
    const kusanagi = (ctx, x, y, rot, len = 21) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      line(ctx, [[-4.6, 0], [1.2, 0]], O, 2.4); line(ctx, [[-4.4, 0], [1, 0]], '#1c1a22', 1.5);
      ctx.strokeStyle = '#5c5868'; ctx.lineWidth = .35;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-3.8 + i * 1.3, -.7); ctx.lineTo(-3.2 + i * 1.3, .7); ctx.stroke(); }
      paint(ctx, () => { ctx.beginPath(); ctx.rect(1.2, -1.5, 1, 3); }, '#4a4656', O, .5);
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(2.2, -.95); ctx.lineTo(len - 2, -.8); ctx.lineTo(len, .1); ctx.lineTo(2.2, .85); ctx.closePath(); }, '#c9cfdc', O, .6, () => {
        ctx.fillStyle = '#f4f7ff'; ctx.fillRect(2.2, -.95, len, .55);
        ctx.fillStyle = 'rgba(70,60,110,.35)'; ctx.fillRect(2.2, .2, len, .8);
      });
      ctx.restore();
    };
    const pupil = (ctx, x, y, w, h, near) => {
      // Sasuke's Rinnegan: lavender ripples with tomoe on the inner rings, drawn inside the eye shape.
      const ix = x + w * .16, iy = y + h * .14, irx = w * .74, iry = h * .86;
      ctx.save(); eyeShape(ctx, x, y, w, h, near ? -1 : 1); ctx.clip();
      for (const [k, n] of [[.6, 3], [.9, 3]]) for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * TAU / n + k * 2;
        tomoe(ctx, ix + Math.cos(a) * irx * k, iy + Math.sin(a) * iry * k, irx * .1, a + Math.PI / 2, '#2a1858');
      }
      ctx.restore();
    };
    return {
      outline: O, skin: '#f2d6c0', skinShade: '#d2a28e', legK: 1.14,
      legs: { thigh: PANTS, shin: PANTS, foot: '#1c1b23', w1: 5.4, w2: 4.4 },
      arms: { upper: CLOAK, lower: CLOAK, w1: 5.8, w2: 5.2, cuff: CLOAK_D },
      torso: {
        base: CLOAK, paint: ctx => {
          // Poncho: a shoulder cape layer over the chest, the front closure and long vertical folds.
          ctx.fillStyle = 'rgba(255,255,255,.07)';
          ctx.beginPath(); ctx.moveTo(-8, -13.6); ctx.lineTo(9, -13.6); ctx.lineTo(9, -7.6); ctx.quadraticCurveTo(1, -5.6, -8, -8.4); ctx.fill();
          ctx.strokeStyle = 'rgba(14,12,22,.55)'; ctx.lineWidth = .45;
          ctx.beginPath(); ctx.moveTo(9, -7.6); ctx.quadraticCurveTo(1, -5.6, -8, -8.4); ctx.stroke();
          line(ctx, [[3.7, -13], [4.3, .4]], '#121019', .5);
          line(ctx, [[4.05, -13], [4.65, .4]], 'rgba(170,165,200,.28)', .3);
          ctx.strokeStyle = 'rgba(140,135,180,.22)'; ctx.lineWidth = .35;
          for (const [x0, x1] of [[-2.6, -3.4], [6.4, 7]]) { ctx.beginPath(); ctx.moveTo(x0, -6); ctx.quadraticCurveTo(x0 + .6, -3, x1, .4); ctx.stroke(); }
        }
      },
      skirt: {
        color: CLOAK, hem: 9.6, flare: 1.8, paint: (ctx, hem, hipY) => {
          ctx.fillStyle = CLOAK_D; ctx.fillRect(-20, hem - 1.2, 40, 2);
          ctx.strokeStyle = 'rgba(140,135,180,.24)'; ctx.lineWidth = .35;
          for (const x of [-6.4, -1.4, 5.8]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1.2, hem); ctx.stroke(); }
        }
      },
      back(ctx) {
        // Kusanagi slung diagonally across the back, hilt jutting out behind the near shoulder.
        line(ctx, [[5.4, 1.4], [-8.6, -13.2]], O, 2.6);
        line(ctx, [[5.2, 1.1], [-8.4, -12.9]], '#24212c', 1.7);
        line(ctx, [[4.9, .5], [-8, -12.4]], 'rgba(150,145,190,.35)', .35);
        kusanagi(ctx, -8.6, -13.2, Math.atan2(14.6, 14) + Math.PI, 0);
      },
      collarBack(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.6, -21); ctx.quadraticCurveTo(-2, -18.8, 3.6, -18.2); ctx.lineTo(7, -12); ctx.closePath(); },
          '#1b1a22', O, 1, () => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-9, -22, 6, 12); });
      },
      collar(ctx) {
        // High poncho collar wrapping the jaw.
        paint(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(-6.9, -10.6); ctx.lineTo(-7.4, -18.4);
          ctx.quadraticCurveTo(-2.4, -16.2, 3.6, -15.4);
          ctx.quadraticCurveTo(6.6, -15.4, 8.6, -17);
          ctx.lineTo(8.2, -13.8); ctx.quadraticCurveTo(8.2, -11.4, 7.4, -10.6); ctx.closePath();
        }, CLOAK, O, 1.05, () => {
          ctx.fillStyle = '#1b1a22';
          ctx.beginPath(); ctx.moveTo(-7.4, -18.6); ctx.quadraticCurveTo(-2.4, -16.4, 3.6, -15.6); ctx.quadraticCurveTo(6.6, -15.6, 8.6, -17.2);
          ctx.lineTo(8.6, -16); ctx.quadraticCurveTo(6.4, -14.6, 3.6, -14.6); ctx.quadraticCurveTo(-2.4, -15.2, -7.4, -17.4); ctx.fill();
          ctx.fillStyle = 'rgba(190,185,220,.3)'; ctx.fillRect(-7.4, -18.7, 6, .45);
          ctx.fillStyle = SHADE; ctx.fillRect(-10, -16, 5.2, 7);
          ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(2, -14.6, 5, 4);
        });
        line(ctx, [[3.8, -14.4], [5, -10.8]], '#0c0a12', .55);
      },
      head: {
        back(ctx, spec) {
          // The spiky crown flaring out at the back of the head.
          sweptBack(ctx, spec, HAIR, [[-130, 22.4], [-158, 25.2], [-186, 23.2], [-212, 18.6]], { valley: 12.8, sweep: .3 });
        },
        hair: (ctx, sp) => sweptHair(ctx, sp, HAIR, [[-40, 14.6], [-78, 17.2], [-112, 20], [-142, 22.6], [-170, 22.4], [-196, 19.4], [-220, 15.2]], { valley: 13.4, sweep: .28 }),
        noEyes: true, mouth: 'neutral', attackMouth: 'frown', browAngle: 'angry', browColor: HAIR, blush: false,
        marks(ctx, spec) {
          // Heterochromia: Rinnegan (near / left eye) and Eternal Mangekyō (far / right eye).
          drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'rinnegan' }, spec.outline, true);
          pupil(ctx, 2.4, 2.2, 2.1, 2.65, true);
          drawEye(ctx, 7.95, 2.1, 1.48, 2.45, { type: 'mangekyo' }, spec.outline, false);
        },
        front(ctx, spec) {
          fringeShadow(ctx, [[-3, -6], [3.2, -6.4], [2.4, 1], [.2, 9.6], [-2.6, 3]]);
          // The long fringe falling over the left eye, a lock down the far cheek and short crown locks.
          locks(ctx, spec, HAIR, [
            [9.6, -7.4, 11, 7.2, 1.4, 1], [7.4, -8.6, 8.4, -3.6, 1.2, .4], [4.6, -9, 4.9, -5, 1.15, 0]
          ], .9);
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-3.8, -9.4); ctx.quadraticCurveTo(3.4, -10, 3.4, -4);
            ctx.quadraticCurveTo(3, 1.2, 1.2, 4.4); ctx.lineTo(2, 7.2); ctx.quadraticCurveTo(.6, 7.6, -.2, 12.6);
            ctx.quadraticCurveTo(-.9, 6.6, -1.8, 3.2); ctx.quadraticCurveTo(-3.6, -2.6, -3.8, -9.4); ctx.closePath();
          }, HAIR, spec.outline, .95, () => {
            ctx.fillStyle = dark(HAIR, .3); ctx.fillRect(-5, -1, 3.6, 15);
            ctx.fillStyle = hairGloss(HAIR); ell(ctx, .8, -6.2, 1.2, 2.2, .4); ctx.fill();
            ctx.strokeStyle = dark(HAIR, .45); ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-1, -7); ctx.quadraticCurveTo(1.4, -2, .4, 9.4); ctx.stroke();
          });
        }
      },
      front(ctx, pose, hand) {
        if (pose.attack) kusanagi(ctx, hand[0] - .4, hand[1] + .2, -.16);
      }
    };
  }

  // ---------------------------------------------------------------- legends (legend-bosses.js)
  // Edo Tensei eyes: the sclera turns black round the iris (drawn over an already painted eye).
  function edoSclera(ctx, x, y, w, h, near) {
    const ix = x + w * .16, iy = y + h * .14, irx = w * .74, iry = h * .86;
    ctx.save(); eyeShape(ctx, x, y, w, h, near ? -1 : 1); ctx.clip();
    ctx.beginPath(); ctx.rect(x - w * 3, y - h * 3, w * 6, h * 6); ctx.ellipse(ix, iy, irx * 1.04, iry * 1.04, 0, 0, TAU);
    ctx.fillStyle = '#231d26'; ctx.fill('evenodd');
    ctx.restore();
  }
  // Kage kasa raised by `up` so the forehead protector shows under the brim; `tall` lifts the apex.
  function kageKasa(ctx, O, panel, kanji, up, tall = 0) {
    ctx.save(); ctx.translate(0, -up);
    const apex = -24.6 - tall;
    paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-15.4, -3.2); ctx.quadraticCurveTo(1, apex, 17.4, -2.8); ctx.quadraticCurveTo(1, -6.8, -15.4, -3.2); ctx.closePath(); }, '#f6f3ea', O, 1.05, () => {
      ctx.fillStyle = '#d6d0c2'; ctx.beginPath(); ctx.moveTo(-16, -3); ctx.quadraticCurveTo(-6, -16 - tall * .5, 0, -17 - tall * .5); ctx.lineTo(-2, -2); ctx.fill();
      ctx.fillStyle = panel; ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(1.2, -17.8 - tall * .5); ctx.lineTo(9.8, -16.2 - tall * .45); ctx.lineTo(10.8, -5.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(1.4, -17.4 - tall * .5, 8, .7);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(0, -18 - tall * .5, 10, -10); ctx.lineTo(10, -9); ctx.quadraticCurveTo(0, -16 - tall * .5, -10, -5); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,40,.3)'; ctx.lineWidth = .4;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(1, apex * .66 + 1); ctx.lineTo(-14 + i * 6, -3.6); ctx.stroke(); }
      ctx.fillStyle = 'rgba(40,30,60,.22)'; ctx.beginPath(); ctx.moveTo(-15.4, -3.2); ctx.quadraticCurveTo(1, -6.8, 17.4, -2.8); ctx.lineTo(17.4, -4.2); ctx.quadraticCurveTo(1, -8.4, -15.4, -4.6); ctx.fill();
    });
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 7px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(kanji, 5.4, -10.6 - tall * .25);
    ctx.restore();
  }
  // Shodai Kazekage Reto (Edo Tensei): white Kage robe with teal-green trim, kasa with 風 over the
  // Suna forehead protector and a veil down his back, dark hair, moustache and chin beard.
  function kazekage1Spec() {
    const O = '#1d1a17', ROBE = '#f3f0e6', TRIM = '#2f8f7a', INNER = '#34413c', HC = '#2b2420';
    return {
      outline: O, skin: '#e6cdb6', skinShade: '#b39486', bulk: .3,
      legs: { thigh: INNER, shin: INNER, foot: '#2a2c30', w1: 5.6 },
      arms: { upper: ROBE, lower: ROBE, w1: 5.8, w2: 5.6, cuff: TRIM },
      torso: { base: ROBE, paint: ctx => {
        ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(-1, -13.4); ctx.lineTo(4.2, -13.4); ctx.lineTo(3.6, -7.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-1.6, -13.4); ctx.lineTo(.2, -13.4); ctx.lineTo(3.9, -7.4); ctx.lineTo(3.7, 0); ctx.lineTo(2.1, 0); ctx.lineTo(2.3, -7.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(2.2, -7, .5, 7);
        ctx.fillStyle = dark(TRIM, .35); ctx.fillRect(-8, -2.8, 17, 2.6);
        ctx.fillStyle = light(TRIM, .3); ctx.fillRect(-8, -2.1, 17, .5);
        ctx.strokeStyle = 'rgba(90,90,120,.35)'; ctx.lineWidth = .4;
        for (const [x0, x1] of [[-3, -4], [6.4, 7.2]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .6, -6, x1, -3); ctx.stroke(); }
      } },
      skirt: { color: ROBE, hem: 2.6, flare: 1.8, paint: (ctx, hem) => {
        ctx.fillStyle = TRIM; ctx.fillRect(-20, hem - 2.2, 40, 2.2);
        ctx.fillStyle = light(TRIM, .35); ctx.fillRect(-20, hem - 2.2, 40, .5);
      } },
      collar(ctx) {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.4, -17.2); ctx.quadraticCurveTo(-1, -15.2, 4.6, -14.2);
          ctx.lineTo(8.4, -15.4); ctx.lineTo(7.6, -11); ctx.closePath();
        }, ROBE, O, 1, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -18, 5, 8);
          ctx.strokeStyle = TRIM; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(-7.4, -16.6); ctx.quadraticCurveTo(-1, -14.6, 4.6, -13.6); ctx.lineTo(8.4, -14.8); ctx.stroke();
        });
      },
      head: {
        drape(ctx, spec, pose) {
          // The kasa's veil hangs from under the brim down over the shoulders.
          const sw = pose && pose.run ? -2.4 : 0;
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-4, -12); ctx.quadraticCurveTo(-13.6, -9, -14.2 + sw, 6);
            ctx.quadraticCurveTo(-14.6 + sw, 14, -12.6 + sw * 1.4, 21); ctx.lineTo(-7 + sw, 20); ctx.quadraticCurveTo(-4.4, 8, -1, 0); ctx.closePath();
          }, ROBE, O, 1, () => {
            ctx.fillStyle = 'rgba(70,80,110,.28)'; ctx.fillRect(-22, -14, 10.4, 40);
            ctx.strokeStyle = 'rgba(90,96,120,.45)'; ctx.lineWidth = .4;
            for (const x of [-11.6, -9]) { ctx.beginPath(); ctx.moveTo(x + 2.4, -6); ctx.quadraticCurveTo(x - 1, 6, x + sw, 19.6); ctx.stroke(); }
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-13.4 + sw * 1.4, 19); ctx.lineTo(-6.8 + sw, 18.2); ctx.lineTo(-7 + sw, 20); ctx.lineTo(-12.6 + sw * 1.4, 21); ctx.fill();
          });
        },
        hair: HAIR.smooth(HC, { nape: 9.6 }),
        eyes: { type: 'normal', iris: '#3a3028' }, brows: 'thick', browW: 1.3, browAngle: 'angry', browColor: HC, mouth: 'frown', blush: false,
        marks(ctx, spec) {
          // Deep-set stern eyes: dark lines under them, Edo Tensei cracks and black sclera.
          line(ctx, [[.4, 5.4], [3.6, 6]], 'rgba(90,60,50,.55)', .4); line(ctx, [[7, 5.2], [9.4, 5.4]], 'rgba(90,60,50,.5)', .35);
          line(ctx, [[5.4, -2.6], [5.7, -.6]], 'rgba(90,60,50,.55)', .35);
          edoCracks(ctx);
          edoSclera(ctx, 2.4, 2.2, 2.1, 2.65, true); edoSclera(ctx, 7.95, 2.1, 1.48, 2.45, false);
          // Moustache and pointed chin beard.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(3.2, 7.6); ctx.quadraticCurveTo(6.6, 5.6, 10.4, 6.8); ctx.lineTo(10, 7.9); ctx.quadraticCurveTo(6.6, 6.9, 3.6, 8.8); ctx.closePath(); }, HC, O, .55);
          paint(ctx, () => poly(ctx, [[4, 9.9], [8.6, 9.4], [6.4, 14.4]]), HC, O, .55, () => { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(6.6, 9.6, 1, 3); });
        },
        band: { cloth: '#26303a', plate: '#cdd5de', symbol: 'sand' },
        front(ctx, spec) {
          kageKasa(ctx, spec.outline, TRIM, '風', 3.8);
          line(ctx, [[-5.2, -7.2], [-4.4, 6]], '#4a4036', .45);
        }
      }
    };
  }
  // Nidaime Tsuchikage Mu (Edo Tensei): bandaged from head to toe with only the eyes showing,
  // a tall Tsuchikage kasa and a red-brown Iwa robe.
  function muSpec() {
    const O = '#241c18', BAND = '#e4dac2', BAND_D = '#b2a382', ROBE = '#8a3e28', TRIM = '#d6b06e';
    const wrap = (ctx, a, b, w, ts, k) => {
      const [nx, ny, ux, uy] = litN(a, b), hw = w / 2 + .3;
      for (const t of ts) {
        const m = lerp(a, b, t);
        line(ctx, [[m[0] - nx * hw - ux * .7, m[1] - ny * hw - uy * .7], [m[0] + nx * hw + ux * .7, m[1] + ny * hw + uy * .7]], dark(BAND_D, k + .25), .36);
        line(ctx, [[m[0] - nx * hw - ux * .3, m[1] - ny * hw - uy * .3], [m[0] + nx * hw + ux * 1.1, m[1] + ny * hw + uy * 1.1]], 'rgba(255,252,240,.55)', .22);
      }
    };
    return {
      outline: O, skin: BAND, skinShade: BAND_D, legK: 1.24,
      legs: { thigh: BAND, shin: BAND, foot: '#2a2420', w1: 5, w2: 4.2, wrap: BAND },
      arms: { upper: ROBE, lower: BAND, w1: 5.4, w2: 4.4, cuff: dark(ROBE, .2),
        pattern(ctx, p0, p1, p2, far) { wrap(ctx, p1, p2, 4.4, [.12, .3, .48], far ? .2 : 0); } },
      torso: { base: ROBE, paint: ctx => {
        ctx.fillStyle = BAND; ctx.beginPath(); ctx.moveTo(-.6, -13.4); ctx.lineTo(4, -13.4); ctx.lineTo(3.4, -8.4); ctx.closePath(); ctx.fill();
        line(ctx, [[.4, -12.4], [3.6, -11.6]], BAND_D, .35); line(ctx, [[1, -10.8], [3.4, -10.2]], BAND_D, .35);
        ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-1.2, -13.4); ctx.lineTo(.4, -13.4); ctx.lineTo(3.8, -8); ctx.lineTo(3.7, 0); ctx.lineTo(2.3, 0); ctx.lineTo(2.4, -8.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dark(ROBE, .45); ctx.fillRect(-8, -3, 17, 2.6);
        ctx.fillStyle = TRIM; ctx.fillRect(-8, -2, 17, .5);
        ctx.strokeStyle = rgba(dark(ROBE, .5), .6); ctx.lineWidth = .4;
        for (const [x0, x1] of [[-3.4, -4.2], [6.2, 7]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .6, -6, x1, -3); ctx.stroke(); }
      } },
      skirt: { color: ROBE, hem: 2.2, flare: 1.4, paint: (ctx, hem, hipY) => {
        ctx.fillStyle = TRIM; ctx.fillRect(-20, hem - 1.8, 40, 1.8);
        ctx.strokeStyle = rgba(dark(ROBE, .5), .55); ctx.lineWidth = .4;
        for (const x of [-5.6, .4, 5.8]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1, hem); ctx.stroke(); }
      } },
      collarBack(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.4, -19.6); ctx.quadraticCurveTo(-2, -18, 3.6, -17.4); ctx.lineTo(7, -12); ctx.closePath(); },
          dark(ROBE, .25), O, 1, () => { ctx.fillStyle = 'rgba(30,10,10,.3)'; ctx.fillRect(-9, -22, 6, 12); });
      },
      collar(ctx) {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6.8, -10.8); ctx.lineTo(-7.4, -17.6); ctx.quadraticCurveTo(-2.4, -15.6, 3.6, -14.8);
          ctx.quadraticCurveTo(6.6, -14.8, 8.4, -16.2); ctx.lineTo(8, -12.8); ctx.quadraticCurveTo(7.8, -11.4, 7.2, -10.8); ctx.closePath();
        }, ROBE, O, 1.05, () => {
          ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-7.4, -17.8); ctx.quadraticCurveTo(-2.4, -15.8, 3.6, -15); ctx.quadraticCurveTo(6.6, -15, 8.4, -16.4);
          ctx.lineTo(8.4, -15.4); ctx.quadraticCurveTo(6.4, -14, 3.6, -14); ctx.quadraticCurveTo(-2.4, -14.6, -7.4, -16.8); ctx.fill();
          ctx.fillStyle = SHADE; ctx.fillRect(-10, -16, 5.2, 7);
        });
      },
      head: {
        drape(ctx, spec, pose) {
          // Two loose bandage tails trailing from the back of the head.
          const sw = pose && pose.run ? -3 : pose && pose.attack ? -1.4 : 0;
          for (const [y0, len, w] of [[-1, 15, 1.5], [2.4, 12, 1.2]]) {
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-8, y0 - w); ctx.quadraticCurveTo(-13 + sw, y0 + len * .3, -12 + sw * 1.6, y0 + len); ctx.lineTo(-10.4 + sw * 1.6, y0 + len - .4); ctx.quadraticCurveTo(-11 + sw, y0 + len * .3, -8, y0 + w); ctx.closePath(); },
              BAND, O, .7, () => { ctx.fillStyle = 'rgba(80,60,40,.3)'; ctx.fillRect(-16, y0, 5, len + 2); });
          }
        },
        noEyes: true, brows: false, blush: false, noHairShadow: true,
        mask(ctx, spec) {
          onFace(ctx, () => {
            // The eye slit: a dark gap between two bands of bandage.
            ctx.fillStyle = '#1c1512';
            ctx.beginPath(); ctx.moveTo(-3, -.8); ctx.quadraticCurveTo(5, -2, 12, -1); ctx.lineTo(12, 4.9); ctx.quadraticCurveTo(5, 5.9, -3, 5.4); ctx.closePath(); ctx.fill();
            // Wrapped bands: lower edge of each turn inked, upper edge lit.
            for (let i = 0; i < 6; i++) {
              const y = -11.4 + i * 1.95;
              line(ctx, [[-12, y + 1.6], [12, y - .9]], 'rgba(120,100,70,.75)', .45);
              line(ctx, [[-12, y + 2.05], [12, y - .45]], 'rgba(255,252,240,.6)', .3);
            }
            for (let i = 0; i < 3; i++) {
              const y = 6.8 + i * 2.1;
              line(ctx, [[-12, y - .8], [12, y + 1.2]], 'rgba(120,100,70,.75)', .45);
              line(ctx, [[-12, y - .35], [12, y + 1.65]], 'rgba(255,252,240,.6)', .3);
            }
            // Turns crossing the back of the skull.
            for (let i = 0; i < 3; i++) line(ctx, [[-9.6 + i * 2.2, -9], [-7 + i * 2.2, 8]], 'rgba(120,100,70,.5)', .4);
            ctx.fillStyle = 'rgba(70,50,35,.4)'; ctx.beginPath(); ctx.moveTo(-3, -.8); ctx.quadraticCurveTo(5, -2, 12, -1); ctx.lineTo(12, -2.2); ctx.quadraticCurveTo(5, -3.2, -3, -2); ctx.fill();
          });
          const e = { type: 'normal', iris: '#4a3a2a' };
          drawEye(ctx, 2.4, 2.2, 2.1, 2.45, e, spec.outline, true);
          drawEye(ctx, 7.95, 2.1, 1.48, 2.3, e, spec.outline, false);
          edoSclera(ctx, 2.4, 2.2, 2.1, 2.45, true); edoSclera(ctx, 7.95, 2.1, 1.48, 2.3, false);
          // Edo Tensei cracks round the slit, on the cloth.
          const c = 'rgba(70,60,72,.8)';
          line(ctx, [[-.6, 5.6], [-.4, 7.4], [-1.4, 8.6]], c, .36); line(ctx, [[9.4, 5.2], [9.8, 7.2], [10.4, 8]], c, .34);
          line(ctx, [[1.4, -1.8], [.8, -3.4], [1.2, -4.8]], c, .32); line(ctx, [[8.6, -1.6], [9.2, -3]], c, .3);
        },
        front(ctx, spec) { kageKasa(ctx, spec.outline, '#7a3a22', '土', 1.6, 6); }
      }
    };
  }
  // Six Paths Obito, the Ten-Tails' jinchūriki: white hair with two horn-like tufts, the right side of
  // his face scarred, Rinnegan + Sharingan, white high-collared robe ringed with black magatama,
  // black pants, the shakujō in his hand and the gunbai slung behind him.
  function obitoRikudoSpec() {
    const O = '#15131b', HAIR = '#f1eff3', ROBE = '#f0eef2', PANTS = '#17161d';
    const staff = (ctx, x, y, rot, len) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      line(ctx, [[0, 16], [0, -len]], O, 2.4); line(ctx, [[0, 16], [0, -len]], '#26242e', 1.4);
      line(ctx, [[-.35, 14], [-.35, -len + 1]], 'rgba(170,165,200,.45)', .35);
      // shakujō head: a ring with a crescent blade on top and two little rings.
      ctx.strokeStyle = O; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -len - 4, 3.6, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#3a3846'; ctx.lineWidth = .7; ctx.stroke();
      paint(ctx, () => { ctx.beginPath(); ctx.arc(0, -len - 9.6, 2.6, Math.PI * .15, Math.PI * .85, true); ctx.arc(0, -len - 8.4, 1.8, Math.PI * .8, Math.PI * .2); ctx.closePath(); }, '#1c1a22', O, .5);
      for (const s of [-1, 1]) { ctx.strokeStyle = O; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(s * 3.6, -len - 1.6, 1.3, 0, TAU); ctx.stroke(); }
      ctx.restore();
    };
    return {
      outline: O, skin: '#efd6c2', skinShade: '#c6a290', bulk: .4,
      legs: { thigh: PANTS, shin: PANTS, foot: '#0f0e13', w1: 5.6, w2: 4.6, boots: true },
      arms: { upper: ROBE, lower: ROBE, w1: 5.2, w2: 4.8, cuff: '#1c1a22' },
      torso: { base: ROBE, paint: ctx => {
        line(ctx, [[3.4, -12.6], [4, 0]], '#4a4656', .5);
        ctx.strokeStyle = 'rgba(110,100,140,.35)'; ctx.lineWidth = .4;
        for (const [x0, x1] of [[-3, -3.8], [6.4, 7.2]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .6, -6, x1, -2); ctx.stroke(); }
        ctx.fillStyle = '#1c1a22'; ctx.fillRect(-8, -2.8, 17, 2.4);
      } },
      skirt: { color: ROBE, hem: 7.8, flare: 1.8, paint: (ctx, hem, hipY) => {
        ctx.strokeStyle = 'rgba(110,100,140,.35)'; ctx.lineWidth = .4;
        for (const x of [-5.8, .6, 6]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1, hem); ctx.stroke(); }
      } },
      back(ctx, pose) {
        // The gunbai slung behind the far shoulder.
        if (!pose.attack) gunbai(ctx, 8.6, -1, .42, O, .72);
        // The shakujō held in the far hand, leaning back behind his head.
        if (!pose.attack && !pose.seal && !pose.raise) staff(ctx, 7, 1, pose.run ? -.9 : -.3, 38);
      },
      collarBack(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.8, -21.4); ctx.quadraticCurveTo(-2, -19.4, 3.6, -18.8); ctx.lineTo(7, -12); ctx.closePath(); },
          '#d8d4de', O, 1, () => { ctx.fillStyle = 'rgba(40,30,60,.3)'; ctx.fillRect(-10, -23, 6, 13); });
      },
      collar(ctx) {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.6, -18.4); ctx.quadraticCurveTo(-2.4, -16.2, 3.4, -15.4);
          ctx.quadraticCurveTo(6.4, -15.2, 8.6, -16.8); ctx.lineTo(8.2, -13); ctx.quadraticCurveTo(8, -11.6, 7.4, -11); ctx.closePath();
        }, ROBE, O, 1.05, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-10, -18, 5.4, 8);
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(1, -15, 6, .5);
        });
        // The ring of black magatama round the high collar.
        for (let i = 0; i < 9; i++) {
          const a = (.08 + i * .105) * Math.PI, x = 1.2 + Math.cos(a) * 7.4, y = -14 + Math.sin(a) * 2.2 - 1.2;
          tomoe(ctx, x, y, .82, Math.PI * .5, '#d8d4e2');
          tomoe(ctx, x, y, .6, Math.PI * .5, '#0c0b10');
        }
      },
      head: {
        back(ctx, spec) {
          sweptBack(ctx, spec, HAIR, [[-136, 18], [-162, 19], [-188, 17.6], [-210, 15]], { valley: 12, sweep: .26 });
        },
        hair(ctx, spec) {
          sweptHair(ctx, spec, HAIR, [[-34, 13.8], [-62, 15.6], [-94, 16], [-124, 16.4], [-152, 17], [-178, 16.6], [-202, 15], [-224, 13]], { valley: 12.6, sweep: .24, gloss: '#ffffff' });
          // Two horn-like tufts standing up off the crown.
          horns(ctx, [[3.6, -10, 14, -72, 2.6], [-3.4, -10.4, 13, -110, 2.5]], HAIR, spec.outline);
        },
        noEyes: true, mouth: 'neutral', attackMouth: 'shout', browAngle: 'angry', browColor: '#bdb8c6', blush: false,
        marks(ctx, spec) {
          // The scarred right side of his face: rippled ridges from brow to jaw.
          onFace(ctx, () => {
            ctx.fillStyle = 'rgba(150,100,100,.16)';
            ctx.beginPath(); ctx.moveTo(5.8, -10); ctx.quadraticCurveTo(4.8, 2, 6.2, 12); ctx.lineTo(14, 12); ctx.lineTo(14, -10); ctx.fill();
            for (let i = 0; i < 5; i++) {
              const x = 6.2 + i * 1.15;
              ctx.strokeStyle = 'rgba(140,86,84,.62)'; ctx.lineWidth = .42;
              ctx.beginPath(); ctx.moveTo(x, -9); ctx.bezierCurveTo(x - 1.2, -4, x + 1.1, 1, x - .4, 4.2); ctx.bezierCurveTo(x - 1.4, 7, x + .6, 9, x, 12); ctx.stroke();
              ctx.strokeStyle = 'rgba(255,240,230,.55)'; ctx.lineWidth = .28;
              ctx.beginPath(); ctx.moveTo(x + .4, -9); ctx.bezierCurveTo(x - .8, -4, x + 1.5, 1, x, 4.2); ctx.bezierCurveTo(x - 1, 7, x + 1, 9, x + .4, 12); ctx.stroke();
            }
          });
          // Rinnegan (near / left eye) and Sharingan (far / right eye).
          drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'rinnegan' }, spec.outline, true);
          drawEye(ctx, 7.95, 2.1, 1.48, 2.45, { type: 'sharingan' }, spec.outline, false);
        },
        front(ctx, spec) {
          fringeShadow(ctx, [[-3, -6], [3.4, -6.4], [2.4, 1], [.4, 7], [-2.4, 3]]);
          locks(ctx, spec, HAIR, [[9.6, -7.6, 11.2, 4.4, 1.4, 1], [6.8, -8.6, 7.6, -2.8, 1.3, .4], [3.4, -9, 3.2, -3.4, 1.3, 0], [.4, -8.8, -.6, 2.2, 1.4, -.6]], .9);
        }
      },
      front(ctx, pose, hand) {
        if (pose.attack) staff(ctx, hand[0], hand[1], 1.2, 26);
        else if (pose.raise) staff(ctx, hand[0], hand[1], -.1, 30);
      }
    };
  }

  // Nagato reanimated by Edo Tensei (nagato-boss.js): gaunt and pale with Edo cracks, black sclera
  // round the Rinnegan, long straight crimson Uzumaki hair falling past the shoulders with long
  // bangs framing the face (one lock over the far eye), in the Akatsuki cloak.
  function nagatoSpec() {
    const HC = '#c41f2d';
    return akatsukiSpec({
      skin: '#eadad0', skinShade: '#b9a2a6', bulk: -.7,
      legs: { thigh: '#232838', shin: '#232838', foot: '#2a2f45', w1: 4.9, w2: 4.2 },
      head: {
        drape: HAIR.longBack(HC, 26, 12.4),
        hair: HAIR.smooth(HC, { nape: 10.6, bangs: [[10.4, 1.8, 12.6], [-.8, 2.1, 12.6], [9.1, 1.15, 7.4]] }),
        eyes: { type: 'edoRinnegan' }, mouth: 'neutral', attackMouth: 'shout', browAngle: 'angry', browColor: '#8a1620', blush: false,
        marks(ctx) {
          // Hollow cheeks and dark rings under the eyes of the starved body, then the Edo cracks.
          ctx.fillStyle = 'rgba(110,80,100,.32)';
          ctx.beginPath(); ctx.moveTo(.4, 6.4); ctx.quadraticCurveTo(2.2, 9.8, 4.4, 10.6); ctx.quadraticCurveTo(2.2, 8.4, 1.8, 6.2); ctx.fill();
          line(ctx, [[.6, 5.4], [4, 5.9]], 'rgba(90,60,80,.6)', .45); line(ctx, [[6.8, 5.2], [9.4, 5.3]], 'rgba(90,60,80,.55)', .4);
          edoCracks(ctx);
        }
      },
      front(ctx, pose, hand) {
        if (!pose.attack && !pose.seal) return;
        // Palm thrust out: a lavender ripple of the Deva Path's force.
        ctx.strokeStyle = 'rgba(205,180,255,.85)'; ctx.lineWidth = .45;
        ell(ctx, hand[0] + 1.6, hand[1], 2.2, 3.2); ctx.stroke();
        ell(ctx, hand[0] + 2.6, hand[1], 3.4, 5); ctx.stroke();
      }
    });
  }

  function zetsuSpec() {
    const O = '#474a40', W = '#efeee6';
    return {
      outline: O, skin: '#f1f0e9', skinShade: '#c8cbbd', hunch: .16, headDrop: .8,
      legs: { thigh: '#e8e7de', shin: '#e8e7de', foot: '#e4e3da', w1: 5.2, w2: 4.2, boots: true },
      arms: { upper: W, lower: W, w1: 4.4, w2: 3.8 },
      torso: {
        base: W, paint: ctx => {
          // Plant-like ridges and a faint rib line on the chalk-white body.
          ctx.strokeStyle = 'rgba(110,120,90,.4)'; ctx.lineWidth = .45;
          for (const [x0, x1] of [[-2, -1], [1.6, 2.6], [5.2, 5.8]]) { ctx.beginPath(); ctx.moveTo(x0, -12.6); ctx.quadraticCurveTo(x0 + 1.4, -7, x1, -.6); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(-1, -8.2); ctx.quadraticCurveTo(2.6, -7, 7, -8.4); ctx.stroke();
          dot(ctx, 3.4, -2.6, .4, 'rgba(110,120,90,.55)');
        }
      },
      head: {
        hair(ctx, sp) {
          // Bald scalp with a faint leaf-like ridge running over the crown.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.4, -6); ctx.quadraticCurveTo(-3, -12.6, 6.6, -10.8); ctx.quadraticCurveTo(0, -9.6, -7.4, -6); ctx.closePath(); }, '#e2e3d6', 'rgba(71,74,64,.75)', .6, () => {
            ctx.fillStyle = 'rgba(120,130,100,.25)'; ctx.fillRect(-8, -9, 16, 3);
          });
          ctx.strokeStyle = 'rgba(110,120,90,.4)'; ctx.lineWidth = .35;
          ctx.beginPath(); ctx.moveTo(-6.6, -6.4); ctx.quadraticCurveTo(0, -10.4, 6.2, -10.6); ctx.stroke();
          for (const x of [-3.4, -.4, 2.6]) { ctx.beginPath(); ctx.moveTo(x, -9.6 + x * .1); ctx.lineTo(x - 1.4, -7.4 + x * .12); ctx.stroke(); }
        },
        noEyes: true, brows: false, blush: false,
        marks(ctx) {
          // Big round black eyes with no whites.
          paint(ctx, () => ell(ctx, 2.6, 2.2, 2.3, 2.7, -.08), '#0d0d10', O, .5);
          paint(ctx, () => ell(ctx, 8.1, 2.1, 1.55, 2.5), '#0d0d10', O, .45);
          dot(ctx, 2, 1.1, .45, 'rgba(255,255,255,.55)'); dot(ctx, 7.7, 1.1, .32, 'rgba(255,255,255,.5)');
        },
        mask(ctx) {
          // Wide toothy grin stretching across the face.
          const mouth = () => { ctx.beginPath(); ctx.moveTo(1, 6.2); ctx.quadraticCurveTo(6, 7.6, 10.4, 5.4); ctx.quadraticCurveTo(9.6, 10.4, 5.8, 10.6); ctx.quadraticCurveTo(2.4, 10.2, 1, 6.2); ctx.closePath(); };
          paint(ctx, mouth, '#2a1416', O, .6, () => {
            ctx.fillStyle = '#f6f4ec';
            ctx.beginPath(); ctx.moveTo(.6, 5.8); ctx.quadraticCurveTo(6, 7.4, 10.8, 5); ctx.lineTo(10.6, 6.8); ctx.quadraticCurveTo(6, 9, .8, 7.6); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(2.6, 10.6); ctx.quadraticCurveTo(6, 9.2, 9.4, 9.2); ctx.lineTo(9.8, 10.8); ctx.lineTo(2.6, 11.2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(60,40,40,.6)'; ctx.lineWidth = .28;
            for (let i = 0; i < 6; i++) { const x = 2.2 + i * 1.5; ctx.beginPath(); ctx.moveTo(x, 6.2 + Math.sin(i * .5) * .4); ctx.lineTo(x + .1, 8.4); ctx.stroke(); }
            for (let i = 0; i < 4; i++) { const x = 4 + i * 1.5; ctx.beginPath(); ctx.moveTo(x, 9.4); ctx.lineTo(x, 11); ctx.stroke(); }
          });
        }
      }
    };
  }

  // ---------------------------------------------------------------- Sannin (sannin-bosses.js)
  // Yellow snake eye: a normal eye repainted with a gold iris and a vertical slit pupil.
  function snakeEye(ctx, x, y, w, h, near, O, iris) {
    drawEye(ctx, x, y, w, h, { type: 'normal', iris }, O, near);
    const ix = x + w * .16, iy = y + h * .14, irx = w * .74, iry = h * .86;
    ctx.save(); eyeShape(ctx, x, y, w, h, near ? -1 : 1); ctx.clip();
    ctx.fillStyle = iris; ell(ctx, ix, iy - iry * .04, irx * .52, iry * .58); ctx.fill();
    ctx.fillStyle = light(iris, .4); ell(ctx, ix + irx * .1, iy + iry * .5, irx * .45, iry * .28); ctx.fill();
    ctx.fillStyle = '#120a10';
    ctx.beginPath(); ctx.moveTo(ix, iy - iry * .92); ctx.quadraticCurveTo(ix + irx * .24, iy, ix, iy + iry * .92); ctx.quadraticCurveTo(ix - irx * .24, iy, ix, iy - iry * .92); ctx.fill();
    ctx.fillStyle = 'rgba(40,24,60,.22)'; ell(ctx, x, y - h * .98, w * 1.8, h * .7); ctx.fill();
    dot(ctx, ix - irx * .38, iy - iry * .36, Math.max(.3, w * .17), '#ffffff');
    ctx.restore();
  }
  // Tapered serpent body along a polyline: outline, shadow tone, lit tone, belly scale rings, gloss.
  function serpentBody(ctx, pts, w0, w1, body, O) {
    const n = pts.length - 1, W = i => w0 + (w1 - w0) * i / n;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) seg(ctx, pts[i], pts[i + 1], W(i) + 1.8, O);
    for (let i = 0; i < n; i++) seg(ctx, pts[i], pts[i + 1], W(i), dark(body, .28));
    for (let i = 0; i < n; i++) { const [a, b] = lit(pts[i], pts[i + 1], W(i) * .16); seg(ctx, a, b, W(i) * .62, body); }
    ctx.strokeStyle = rgba(dark(body, .5), .55); ctx.lineWidth = .3;
    for (let i = 0; i < n; i++) {
      const [nx, ny, ux, uy] = litN(pts[i], pts[i + 1]), L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      for (let t = .2; t < 1; t += Math.max(.18, 1.3 / L)) {
        const m = lerp(pts[i], pts[i + 1], t), w = W(i + t) * .46;
        ctx.beginPath(); ctx.moveTo(m[0] - nx * w, m[1] - ny * w); ctx.quadraticCurveTo(m[0] + ux * .8, m[1] + uy * .8, m[0] + nx * w, m[1] + ny * w); ctx.stroke();
      }
    }
    for (let i = 0; i < n; i++) { const [a, b] = lit(pts[i], pts[i + 1], W(i) * .3); seg(ctx, a, b, W(i) * .12, 'rgba(255,255,255,.55)'); }
  }
  // Wedge snake head looking along +x (origin at the neck), gold slit eye, flicking tongue.
  function snakeHead(ctx, x, y, s, rot, body, O, open) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (open) {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(7.4, 3.6); ctx.lineTo(1.4, 3.4); ctx.closePath(); }, dark(body, .2), O, .5);
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(2, .6); ctx.lineTo(7, 2.6); ctx.lineTo(2.6, 2.4); ctx.closePath(); }, '#8a1e3a', null);
      for (const fx of [3.2, 5.6]) paint(ctx, () => poly(ctx, [[fx, .6], [fx + .5, .7], [fx + .2, 1.8]]), '#ffffff', O, .2);
    }
    line(ctx, [[6.4, open ? 1.2 : .7], [8.6, 1.2], [9.6, .4]], '#c42a4a', .35); line(ctx, [[8.6, 1.2], [9.6, 1.9]], '#c42a4a', .3);
    paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-1, -2.2); ctx.quadraticCurveTo(3, -3.4, 6.4, -1.4); ctx.quadraticCurveTo(7.8, -.4, 7.4, .6); ctx.quadraticCurveTo(3.8, open ? 1 : 1.8, -1, 2.4); ctx.closePath(); }, body, O, .6, () => {
      ctx.fillStyle = dark(body, .25); ctx.fillRect(-2, .4, 10, 3);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ell(ctx, 2.4, -1.9, 2.4, .5, -.1); ctx.fill();
      ctx.strokeStyle = rgba(dark(body, .5), .5); ctx.lineWidth = .2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(.4 + i * 1.3, -.6, .7, 3.6, 5.8); ctx.stroke(); }
    });
    paint(ctx, () => ell(ctx, 3.6, -1.2, .9, .6, -.1), '#f2c21e', O, .3);
    line(ctx, [[3.6, -1.7], [3.6, -.7]], '#120a10', .3);
    dot(ctx, 6.6, -.5, .2, O);
    ctx.restore();
  }

  // Jiraiya: towering, a wild white mane to the waist, red lines down from the eyes, horned 油
  // forehead protector, olive-green kimono under a red sleeveless haori, mesh at the neck,
  // forearm guards, wooden geta and the big toad scroll on his back. The seal frame is Sage Mode:
  // orange pigment round the eyes, toad pupils and warts on the nose.
  function jiraiyaSpec() {
    const O = '#241812', HAIR = '#efebe4', KIM = '#5f7d48', HAORI = '#c4342b', skin = '#f1c9a2';
    const mesh = (ctx, x0, y0, x1, y1) => {
      ctx.strokeStyle = 'rgba(20,18,26,.62)'; ctx.lineWidth = .24; ctx.beginPath();
      for (let x = x0 - (y1 - y0); x < x1; x += 1.05) { ctx.moveTo(x, y0); ctx.lineTo(x + (y1 - y0), y1); ctx.moveTo(x + (y1 - y0), y0); ctx.lineTo(x, y1); }
      ctx.stroke();
    };
    const scroll = ctx => {
      // The big summoning scroll strapped horizontally across his lower back.
      paint(ctx, () => { ctx.beginPath(); ctx.rect(-15.4, -7.2, 17, 6.8); }, '#d9c595', O, .95, () => {
        ctx.fillStyle = '#b02e28'; ctx.fillRect(-12.4, -7.4, 2, 7.2); ctx.fillRect(-5.2, -7.4, 2, 7.2);
        ctx.fillStyle = 'rgba(90,50,20,.32)'; ctx.fillRect(-16, -2.6, 20, 2.4);
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-16, -6.4, 20, .9);
        ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = .3; for (const x of [-9, -1.4]) { ctx.beginPath(); ctx.moveTo(x, -7.2); ctx.lineTo(x, -.4); ctx.stroke(); }
      });
      paint(ctx, () => ell(ctx, -15.4, -3.8, 1.7, 3.6), '#c4ab78', O, .85, () => { ctx.fillStyle = 'rgba(90,50,20,.3)'; ctx.fillRect(-17.4, -2.4, 4, 3); });
      paint(ctx, () => ell(ctx, -15.4, -3.8, .9, 1.9), '#8a6236', O, .5);
      line(ctx, [[-6, -7], [2.4, -12.6]], O, 1.4); line(ctx, [[-6, -7], [2.4, -12.6]], '#5a3e2a', .8);
    };
    const sage = ctx => {
      ctx.fillStyle = 'rgba(206,76,26,.92)';
      ctx.beginPath(); ctx.moveTo(-.6, 1.4); ctx.quadraticCurveTo(1.6, -2.4, 5.4, .2); ctx.quadraticCurveTo(5.4, 4.4, 3.2, 6); ctx.quadraticCurveTo(.2, 5.4, -.6, 1.4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6.2, .6); ctx.quadraticCurveTo(8.4, -2, 10.3, .2); ctx.quadraticCurveTo(10.2, 3.8, 8.8, 5.4); ctx.quadraticCurveTo(6.6, 4.8, 6.2, .6); ctx.fill();
      drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'sage' }, O, true);
      drawEye(ctx, 7.95, 2.1, 1.48, 2.45, { type: 'sage' }, O, false);
      for (const [x, y, r] of [[9.6, 4.6, .6], [8.8, 5.6, .42], [9.9, 5.8, .36]]) { dot(ctx, x, y, r + .22, O); dot(ctx, x, y, r, '#e6a27e'); dot(ctx, x - .16, y - .16, r * .4, 'rgba(255,255,255,.65)'); }
    };
    return {
      outline: O, skin, skinShade: '#d39a7c', legK: 1.16, bulk: .5,
      legs: { thigh: KIM, shin: KIM, foot: '#7a5230', w1: 6, w2: 4.8 },
      arms: { upper: KIM, lower: skin, guard: '#8f96a0', w1: 5.4, w2: 4.6 },
      torso: {
        base: KIM, paint: ctx => {
          // Mesh undershirt in the open V of the kimono, dark belt.
          ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-.6, -13.6); ctx.lineTo(6.8, -13.6); ctx.lineTo(3.4, -6.2); ctx.closePath(); ctx.fill();
          ctx.save(); ctx.clip(); mesh(ctx, -1, -14, 7.4, -6); ctx.restore();
          line(ctx, [[-.6, -13.6], [3.4, -6.2], [6.8, -13.6]], dark(KIM, .45), .55);
          ctx.fillStyle = '#3a2c24'; ctx.fillRect(-8, -3.8, 17, 2.6);
          ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-8, -3.8, 17, .45);
        },
        over(ctx) {
          // Open red haori (sleeveless) hanging down both sides.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.4, -12.8); ctx.lineTo(-3.2, -13.6); ctx.quadraticCurveTo(-4.2, -6, -3, 1); ctx.lineTo(-7.6, 1); ctx.quadraticCurveTo(-8, -6, -7.4, -12.8); ctx.closePath(); }, HAORI, O, .85, () => {
            ctx.fillStyle = 'rgba(70,10,10,.32)'; ctx.fillRect(-9, -14, 3.6, 16);
            ctx.strokeStyle = 'rgba(70,10,10,.45)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-5.4, -10); ctx.quadraticCurveTo(-6, -4, -5.2, 1); ctx.stroke();
            ctx.fillStyle = '#e8c860'; ell(ctx, -5.2, -7.2, 1.2, 1.3); ctx.fill();
            ctx.fillStyle = '#7a1a14'; ell(ctx, -5.2, -7.2, .6, .65); ctx.fill();
          });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(6.4, -13); ctx.lineTo(8.4, -12.2); ctx.quadraticCurveTo(8.9, -6, 8.3, 1); ctx.lineTo(6.2, 1); ctx.quadraticCurveTo(6.8, -6, 6.4, -13); ctx.closePath(); }, HAORI, O, .8, () => {
            ctx.fillStyle = 'rgba(255,220,200,.3)'; ctx.fillRect(6.4, -12, .7, 12);
          });
        }
      },
      collarBack(ctx) {
        scroll(ctx);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.4, -15.6); ctx.quadraticCurveTo(-4, -16.4, -1, -14.6); ctx.lineTo(-1, -11); ctx.closePath(); }, HAORI, O, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 4, 6); });
      },
      shoulder(ctx) {
        paint(ctx, () => smooth(ctx, [[-7.4, -13], [-2.4, -14], [1, -12.2], [-.4, -8.6], [-6.6, -8.2], [-8, -10.2]]), HAORI, O, .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -10.2, 12, 3);
          ctx.fillStyle = 'rgba(255,220,200,.3)'; ell(ctx, -3, -12.8, 3, .6, .1); ctx.fill();
        });
      },
      skirt: {
        color: HAORI, hem: 10, flare: 1.2, paint: (ctx, hem, hipY) => {
          // Green kimono showing between the haori flaps; dark hem band.
          ctx.fillStyle = KIM; ctx.beginPath(); ctx.moveTo(2.8, hipY - 2); ctx.lineTo(7, hipY - 2); ctx.lineTo(9.6, hem + 2); ctx.lineTo(4, hem + 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(60,8,8,.5)'; ctx.fillRect(-20, hem - 1, 40, 1.6);
        }
      },
      head: {
        drape: maneDrape(HAIR),
        back(ctx, spec) { sweptBack(ctx, spec, HAIR, [[-70, 21.6], [-100, 23.4], [-128, 23.4], [-156, 22.4], [-182, 20.4], [-206, 17.4]], { valley: 13, sweep: .26 }); },
        hair: (ctx, sp) => sweptHair(ctx, sp, HAIR, [[-32, 16.4], [-56, 20.6], [-80, 22.6], [-104, 23.2], [-128, 22.8], [-152, 21.6], [-176, 19.6], [-200, 17], [-222, 13.6]], { valley: 13.6, sweep: .26, gloss: '#ffffff' }),
        eyes: { type: 'normal', iris: '#3a2a22' }, mouth: 'smirk', attackMouth: 'shout', browAngle: 'angry', browColor: '#d6d0c6', browW: 1.1, blush: false,
        marks(ctx) {
          // The two long red lines running down from the inner corners of his eyes.
          ctx.fillStyle = '#b81c28';
          const bar = (x0, y0, x1, y1, w) => { ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x1 + w * .8, y1); ctx.lineTo(x1 - w * .8, y1); ctx.closePath(); ctx.fill(); };
          bar(3.9, 4.6, 3.6, 9.4, .36); bar(6.8, 4.4, 6.9, 8.6, .28);
        },
        band: { cloth: '#2c2a30', plate: '#ccd3dc', symbol: 'none', wide: true },
        front(ctx, spec, pose) {
          if (pose && pose.seal) sage(ctx);
          // Horned plate engraved 油, and the long locks framing the face.
          horns(ctx, [[1.2, -8.6, 5.4, -112, 1.3], [7.8, -7.8, 4.8, -74, 1.15]], '#ccd3dc', O);
          ctx.font = 'bold 4.4px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('油', 4.3, -5.5);
          ctx.fillStyle = '#3a3e48'; ctx.fillText('油', 4.1, -5.8);
          locks(ctx, spec, HAIR, [[-1.6, -8.6, -2.8, 10.4, 2, -1.4], [10, -7.2, 11.2, 7.6, 1.4, 1]], .9);
        }
      }
    };
  }

  // Orochimaru: deathly pale, long straight black hair, purple eye shadow, gold snake eyes, a pale
  // robe with the huge purple shimenawa rope belt tied in a bow at his back; Kusanagi in hand.
  function orochimaruSpec() {
    const O = '#1c1622', HC = '#131118', ROBE = '#e6dfcc', ROPE = '#6c3ea0';
    const rope = (ctx, x0, y0, x1, y1, w) => {
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, n = Math.max(2, Math.round(L / 1.1));
      line(ctx, [[x0, y0], [x1, y1]], O, w + 1); line(ctx, [[x0, y0], [x1, y1]], ROPE, w);
      ctx.strokeStyle = dark(ROPE, .5); ctx.lineWidth = .32; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = (i + .5) / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
        ctx.moveTo(cx - uy * w * .46 - ux * .45, cy + ux * w * .46 - uy * .45); ctx.lineTo(cx + uy * w * .46 + ux * .45, cy - ux * w * .46 + uy * .45);
      }
      ctx.stroke();
      line(ctx, [[x0 + uy * w * .22, y0 - ux * w * .22], [x1 + uy * w * .22, y1 - ux * w * .22]], 'rgba(226,196,255,.45)', w * .16);
    };
    const loop = (ctx, x, y, rx, ry, rot) => {
      for (const [c, w, dash] of [[O, 3.3, null], [ROPE, 2.4, null], [dark(ROPE, .5), 2.4, [.32, .8]]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash || []); ell(ctx, x, y, rx, ry, rot); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(226,196,255,.45)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.ellipse(x, y, rx + .6, ry + .6, rot, 3.6, 5.4); ctx.stroke();
    };
    const sword = (ctx, x, y, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      line(ctx, [[-4, 0], [1.2, 0]], O, 2.3); line(ctx, [[-3.8, 0], [1, 0]], '#2a2432', 1.4);
      paint(ctx, () => { ctx.beginPath(); ctx.rect(1.2, -1.3, .9, 2.6); }, '#8a8296', O, .45);
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(2.1, -.85); ctx.lineTo(20, -.7); ctx.lineTo(22, .1); ctx.lineTo(2.1, .8); ctx.closePath(); }, '#cfd4e2', O, .55, () => {
        ctx.fillStyle = '#f6f8ff'; ctx.fillRect(2.1, -.85, 20, .5); ctx.fillStyle = 'rgba(80,60,120,.35)'; ctx.fillRect(2.1, .2, 20, .7);
      });
      ctx.restore();
    };
    return {
      outline: O, skin: '#f1ebee', skinShade: '#c6b6c8', legK: 1.14,
      legs: { thigh: '#d6cdb6', shin: '#d6cdb6', foot: '#2a2532', w1: 5.6, w2: 4.4 },
      arms: { upper: ROBE, lower: ROBE, w1: 5.8, w2: 5.8, cuff: dark(ROBE, .14), hand: '#f1ebee' },
      torso: {
        base: ROBE, paint: ctx => {
          // Kimono front crossing left over right, then the thick twisted rope belt.
          ctx.fillStyle = dark(ROBE, .12); ctx.beginPath(); ctx.moveTo(-.6, -13.6); ctx.lineTo(4.6, -4); ctx.lineTo(9, -4); ctx.lineTo(9, -13.6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f1ebee'; ctx.beginPath(); ctx.moveTo(.2, -13.6); ctx.lineTo(6.4, -13.6); ctx.lineTo(3.6, -9.4); ctx.closePath(); ctx.fill();
          line(ctx, [[-.6, -13.6], [4.6, -4]], dark(ROBE, .5), .55); line(ctx, [[6.4, -13.6], [3.6, -9.4]], dark(ROBE, .4), .4);
          rope(ctx, -9, -2.6, 10, -2.9, 3);
        }
      },
      skirt: { color: ROBE, hem: 7.6, flare: 1, paint: (ctx, hem) => { ctx.fillStyle = dark(ROBE, .2); ctx.fillRect(-20, hem - .8, 40, 1.2); } },
      collarBack(ctx) {
        // The big shimenawa bow tied at the small of the back.
        rope(ctx, -7.6, -1.8, -10.6, 8.6, 2.1); rope(ctx, -7.2, -1.6, -6.4, 9.8, 1.9);
        loop(ctx, -11.4, -5, 3.8, 2.1, -.55); loop(ctx, -11.6, .8, 3.6, 2, .5);
        paint(ctx, () => ell(ctx, -7.8, -2.2, 2, 1.8), ROPE, O, .8, () => { ctx.fillStyle = dark(ROPE, .3); ctx.fillRect(-10, -1.8, 5, 2); });
      },
      collar(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.2, -15.4); ctx.quadraticCurveTo(-3.6, -16.2, -.4, -14.4); ctx.lineTo(-.2, -11); ctx.closePath(); }, ROBE, O, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 4, 6); });
      },
      head: {
        drape: HAIR.longBack(HC, 37, 12.8),
        hair: HAIR.smooth(HC, { nape: 9.6, bangs: [[9.9, 1.6, 11.6], [-.6, 1.9, 11], [5.4, 1, -2.4]] }),
        eyes: { type: 'normal', iris: '#e8c228' }, mouth: 'smirk', attackMouth: 'grin', browColor: HC, browW: .55, blush: false,
        marks(ctx, spec) {
          // Purple shadow round both eyes, then the gold snake eyes.
          ctx.fillStyle = 'rgba(120,58,168,.62)';
          ctx.beginPath(); ctx.moveTo(-.8, 2); ctx.quadraticCurveTo(1.4, -2.2, 5.2, .2); ctx.quadraticCurveTo(4.6, 3.6, 2.2, 4.6); ctx.quadraticCurveTo(-.2, 4, -.8, 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6.2, .4); ctx.quadraticCurveTo(8.4, -2, 10, .4); ctx.quadraticCurveTo(9.6, 3.4, 8.2, 4.2); ctx.quadraticCurveTo(6.6, 3.6, 6.2, .4); ctx.fill();
          snakeEye(ctx, 2.4, 2.2, 2.1, 2.65, true, spec.outline, '#e8c228');
          snakeEye(ctx, 7.95, 2.1, 1.48, 2.45, false, spec.outline, '#e8c228');
          line(ctx, [[-.4, 3.6], [1.4, 5.4]], 'rgba(110,50,150,.7)', .4); line(ctx, [[9.6, 3.4], [9.9, 4.8]], 'rgba(110,50,150,.6)', .35);
        },
        front(ctx, spec, pose) {
          if (pose && pose.attack) {
            // The long snake tongue lolling out of the grin.
            ctx.strokeStyle = spec.outline; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(7, 9); ctx.bezierCurveTo(10, 12, 14, 12.6, 15.4, 9.2); ctx.stroke();
            ctx.strokeStyle = '#b4486e'; ctx.lineWidth = .9; ctx.stroke();
          }
        }
      },
      front(ctx, pose, hand) {
        if (pose.attack) sword(ctx, hand[0] - .4, hand[1] + .2, -.12);
        else if (pose.raise) sword(ctx, hand[0], hand[1], -1.4);
      }
    };
  }

  // Kabuto in Sage Mode (War arc): dark-violet hooded cloak rimmed with white snake scales, white
  // horns through the hood, scaly pale skin and dark markings round gold snake eyes, and
  // Orochimaru's white snake body coiling out of his back into a raised snake head.
  function kabutoSpec() {
    const O = '#150f1d', CLOAK = '#3d2e5e', HOOD = '#34274f', SCALE = '#f1eee6', HAIR = '#c7cad3', skin = '#ebe5e8';
    const scaleTrim = (ctx, pts, w) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = O; ctx.lineWidth = w + .9; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = SCALE; ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,110,150,.6)'; ctx.lineWidth = w * .8; ctx.setLineDash([.25, .75]); ctx.stroke(); ctx.setLineDash([]);
    };
    return {
      outline: O, skin, skinShade: '#b9abbf', legK: 1.12,
      legs: { thigh: '#2a2238', shin: '#2a2238', foot: '#1d1828', w1: 5.6, w2: 4.4 },
      arms: { upper: CLOAK, lower: CLOAK, w1: 5.8, w2: 5.4, cuff: SCALE, hand: skin },
      back(ctx, pose) {
        // Orochimaru's white snake: out of the small of the back, down to the ground, up into a head.
        const run = pose && pose.run ? 1 : 0, sw = (pose && pose.wave) ? Math.sin(pose.wave) * 1.2 : 0;
        const pts = [[-4, -3], [-10, 1], [-14.6, 7], [-16, 13.4], [-20.6, 17.4], [-26, 15.4], [-27.8, 9 + sw], [-26.4, 2 - run * 2], [-23.6, -4 - run * 2]];
        serpentBody(ctx, pts, 5.4, 3.2, '#f2efe8', O);
        snakeHead(ctx, -23.6, -4.6 - run * 2, 1.05, -.5, '#f2efe8', O, !!(pose && (pose.attack || pose.seal)));
      },
      torso: {
        base: CLOAK, paint: ctx => {
          // The cloak parted over the pale scaly snake body, rimmed with white scales.
          ctx.fillStyle = '#e4e0d8'; ctx.beginPath(); ctx.moveTo(1.6, -13.6); ctx.lineTo(6.6, -13.6); ctx.lineTo(5.6, 0); ctx.lineTo(3.4, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(120,110,150,.55)'; ctx.lineWidth = .3;
          for (let y = -12.6; y < 0; y += 1.2) for (let x = 2.4 + (Math.round(y) % 2) * .6; x < 6.4; x += 1.2) { ctx.beginPath(); ctx.arc(x, y, .55, .2, Math.PI - .2); ctx.stroke(); }
          scaleTrim(ctx, [[1.4, -13.6], [3.2, 0]], 1.1); scaleTrim(ctx, [[6.8, -13.6], [5.9, 0]], .9);
          ctx.strokeStyle = 'rgba(140,120,190,.25)'; ctx.lineWidth = .35;
          for (const [x0, x1] of [[-3, -3.6], [-6, -6.4]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .6, -5, x1, .4); ctx.stroke(); }
        }
      },
      skirt: {
        color: CLOAK, hem: 11.4, flare: 2.2, paint: (ctx, hem, hipY) => {
          ctx.fillStyle = SCALE; ctx.fillRect(-22, hem - 1.2, 44, 1.6);
          ctx.fillStyle = 'rgba(120,110,150,.6)'; for (let x = -20; x < 20; x += 1.1) ctx.fillRect(x, hem - 1.1, .3, 1.3);
          ctx.strokeStyle = 'rgba(140,120,190,.24)'; ctx.lineWidth = .35;
          for (const x of [-6, 0, 5]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.quadraticCurveTo(x - .6, (hipY + hem) / 2, x - 1.2, hem); ctx.stroke(); }
        }
      },
      collarBack(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.6, -11.4); ctx.lineTo(-8.2, -17.6); ctx.quadraticCurveTo(-3, -18.2, 1.4, -15.6); ctx.lineTo(4, -12); ctx.closePath(); }, HOOD, O, 1, () => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-9, -19, 6, 9); });
      },
      collar(ctx) {
        scaleTrim(ctx, [[-6.8, -12.4], [-3, -14.4], [1.4, -14.4], [6.8, -13.6]], 1.2);
      },
      head: {
        hair(ctx, spec) {
          // Grey bangs under the hood, then the hood itself with its white scale rim and the horns.
          locks(ctx, spec, HAIR, [[1, -7.6, .4, 3.4, 1.5, -.4], [4.4, -7.8, 4.8, -1.6, 1.3, 0], [8.4, -7, 9.6, 2, 1.3, .6]], .8);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(11.4, -3.2); ctx.quadraticCurveTo(12.8, -15, 0, -15.2); ctx.quadraticCurveTo(-14, -14.4, -12.6, 2); ctx.lineTo(-11, 11.4); ctx.lineTo(-3.6, 12); ctx.lineTo(-3.4, 1); ctx.quadraticCurveTo(-2, -6.4, 4, -7.6); ctx.quadraticCurveTo(9, -7.6, 11.4, -3.2); ctx.closePath(); }, HOOD, spec.outline, 1.05, () => {
            ctx.fillStyle = dark(HOOD, .32); ctx.fillRect(-16, -2, 32, 16);
            ctx.fillStyle = light(HOOD, .18); ell(ctx, 1, -11, 8, 2.8, -.2); ctx.fill();
            ctx.strokeStyle = dark(HOOD, .5); ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(-10.4, 0, -8.4, 10); ctx.stroke();
          });
          scaleTrim(ctx, [[-3.4, 11.4], [-3.4, 1], [-2, -5.6], [4, -7.4], [9, -7.2], [11.4, -3.2]], 1.3);
          horns(ctx, [[0, -12.4, 8.6, -128, 1.5], [6.4, -12.2, 7.4, -66, 1.3]], '#f3efe6', spec.outline);
        },
        eyes: { type: 'normal', iris: '#f0c62a' }, mouth: 'smirk', attackMouth: 'grin', browAngle: 'angry', browColor: HAIR, brows: false, blush: false,
        marks(ctx, spec) {
          // Dark sage markings round the eyes, pale scales on the cheeks, gold slit eyes.
          ctx.fillStyle = 'rgba(44,24,70,.85)';
          ctx.beginPath(); ctx.moveTo(-1.6, 2.4); ctx.quadraticCurveTo(1.2, -2.6, 5.4, -.2); ctx.lineTo(5, 1.8); ctx.quadraticCurveTo(2, 4.6, -1.6, 2.4); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6.2, -.2); ctx.quadraticCurveTo(8.6, -2.4, 10.6, -.2); ctx.lineTo(9.8, 3); ctx.quadraticCurveTo(7.6, 3.4, 6.2, -.2); ctx.fill();
          snakeEye(ctx, 2.4, 2.2, 2.1, 2.65, true, spec.outline, '#f0c62a');
          snakeEye(ctx, 7.95, 2.1, 1.48, 2.45, false, spec.outline, '#f0c62a');
          ctx.strokeStyle = 'rgba(130,120,160,.75)'; ctx.lineWidth = .28;
          for (const [x, y] of [[-.6, 5.4], [.6, 6], [-.2, 6.8], [1.2, 7.2], [.4, 4.6], [9.6, 5], [9.2, 6.2], [-1.6, -1.6], [-.6, -2.4]]) { ctx.beginPath(); ctx.arc(x, y, .6, .2, Math.PI - .2); ctx.stroke(); }
        }
      }
    };
  }

  // Pain's piercings: studs drawn as dark metal with a glint.
  const stud = (ctx, x, y, r = .42) => { dot(ctx, x, y, r, '#3a3a44'); dot(ctx, x - r * .3, y - r * .3, r * .4, '#c8ccd6'); };

  // Hatake Kakashi (Fourth War): silver hair standing up and swept back to one side, the forehead protector
  // slanted down over his left (near) eye — pushed up in the seal / attack poses to bare the scarred
  // Mangekyō Sharingan — a dark mask over the lower face and neck, green flak vest over a navy suit.
  function kakashiSpec() {
    const O = '#141923', HAIR = '#d4d9e1', SUIT = '#2b3552', VEST = '#64793f', MASK = '#272e40', PLATE = '#cdd5de', CLOTH = '#1d2233';
    const BAND = { cloth: CLOTH, plate: PLATE, symbol: 'leaf' };
    const plateDown = ctx => {
      // Cloth running from the plate's low end back over the temple to the knot.
      paint(ctx, () => poly(ctx, [[-1.1, -.5], [2.1, 3.9], [-3.6, 2.4], [-9.3, -1.2], [-9.9, -6.2], [-4.8, -3.6]]), CLOTH, O, .85, () => {
        ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-10, -2.4); ctx.lineTo(2, 3); ctx.lineTo(2, 5); ctx.lineTo(-10, 0); ctx.fill();
        ctx.strokeStyle = rgba(light(CLOTH, .35), .5); ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(-9.4, -5.6); ctx.lineTo(-1.2, -.2); ctx.stroke();
      });
      paint(ctx, () => smooth(ctx, [[-9.6, -4.8], [-12.8, -3.8], [-14.8, -1], [-13.8, .2], [-11.4, -1.2], [-9.2, -2.4]]), CLOTH, O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(-16, -2.6, 8, 4); });
      paint(ctx, () => smooth(ctx, [[-9.8, -3.4], [-11.6, -.6], [-12.2, 2.4], [-11, 2.6], [-10, .2], [-9, -2]]), dark(CLOTH, .18), O, .75);
      paint(ctx, () => ell(ctx, -9.7, -3.7, 1.3, 1.6), dark(CLOTH, .08), O, .7);
      // The steel plate, tilted ~35° so its low end covers the eye.
      ctx.save(); ctx.translate(4.9, -1.4); ctx.rotate(-.62);
      const plateP = () => { ctx.beginPath(); ctx.moveTo(-5.4, -2.5); ctx.quadraticCurveTo(0, -2.9, 5.4, -2.5); ctx.quadraticCurveTo(5.9, 0, 5.4, 2.5); ctx.quadraticCurveTo(0, 2.9, -5.4, 2.5); ctx.quadraticCurveTo(-5.8, 0, -5.4, -2.5); ctx.closePath(); };
      paint(ctx, plateP, PLATE, O, .85, () => {
        const g = ctx.createLinearGradient(0, -2.8, 0, 2.8);
        g.addColorStop(0, light(PLATE, .55)); g.addColorStop(.45, PLATE); g.addColorStop(1, dark(PLATE, .3));
        ctx.fillStyle = g; ctx.fillRect(-6, -3, 12, 6);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-6, -2.7, 12, .6);
        ctx.fillStyle = rgba(dark(PLATE, .5), .55); ctx.fillRect(-6, 2, 12, .8);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(2.2, -2.8); ctx.lineTo(3.3, -2.8); ctx.lineTo(2.1, 2.8); ctx.lineTo(1, 2.8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(3.9, -2.8); ctx.lineTo(4.4, -2.8); ctx.lineTo(3.3, 2.8); ctx.lineTo(2.8, 2.8); ctx.fill();
      });
      const rv = dark(PLATE, .5);
      for (const [x, y] of [[-4.6, -1.7], [4.6, -1.7], [-4.6, 1.7], [4.6, 1.7]]) { dot(ctx, x, y, .34, rv); dot(ctx, x - .1, y - .1, .13, 'rgba(255,255,255,.8)'); }
      plateSymbol(ctx, 'leaf', .15, .35, .95, 'rgba(255,255,255,.7)');
      plateSymbol(ctx, 'leaf', 0, 0, .95, dark(PLATE, .66));
      ctx.restore();
    };
    return {
      outline: O, skin: '#efcfb4', skinShade: '#cfa28c', legK: 1.12,
      legs: { thigh: SUIT, shin: SUIT, foot: '#222a3e', wrap: '#e6e2d8', holster: '#1c2436', w1: 5.4, w2: 4.3 },
      arms: { upper: SUIT, lower: SUIT, w1: 4.8, w2: 4.2, cuff: '#3c4560', hand: '#262c3e' },
      torso: {
        base: SUIT, over(ctx, pose) {
          // The mask runs down the neck into the vest's rolled collar.
          paint(ctx, () => poly(ctx, [[-1, -11.8], [3.4, -11.8], [3.2, -17.6], [-.6, -17.6]]), MASK, O, .9, () => { ctx.fillStyle = DEEP; ctx.fillRect(-2, -18, 6, 3); });
          flakVest(VEST, { outline: O })(ctx, pose);
        }
      },
      shoulder(ctx) {
        // Red Uzumaki swirl on the sleeve.
        ctx.strokeStyle = '#b8352c'; ctx.lineWidth = .55; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const a = i * .55, r = .15 + i * .085; const x = -2.5 + Math.cos(a) * r, y = -8.6 + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      },
      head: {
        back(ctx, spec) { sweptBack(ctx, spec, HAIR, [[-84, 20], [-112, 23], [-140, 23.4], [-166, 20.4], [-192, 16.4], [-212, 13.4]], { valley: 12.4, sweep: .3 }); },
        // The tall silver shock, leaning up and back.
        hair: (ctx, sp) => sweptHair(ctx, sp, HAIR, [[-36, 14.6], [-64, 19.4], [-92, 23], [-118, 25.4], [-142, 25], [-166, 21.6], [-190, 17.2], [-214, 13.4]], { valley: 13.2, sweep: .32, gloss: '#ffffff' }),
        noEyes: true, browColor: '#9aa0aa', blush: false,
        mask(ctx, spec) {
          // Fitted mask from just under the eyes over the nose and jaw, clipped to the face.
          const top = () => { ctx.moveTo(-9.8, 3.2); ctx.lineTo(-3.4, 3.8); ctx.quadraticCurveTo(1.6, 5.4, 6.2, 5); ctx.quadraticCurveTo(8.6, 4.6, 9.4, 3.3); ctx.quadraticCurveTo(10.6, 3.8, 11.2, 5.4); };
          ctx.save(); headPath(ctx); ctx.clip();
          ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath();
          ctx.fillStyle = MASK; ctx.fill();
          ctx.save(); ctx.clip();
          ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-11, 3); ctx.quadraticCurveTo(-2, 6, -2.6, 14); ctx.lineTo(-11, 14); ctx.fill();
          ctx.fillStyle = 'rgba(160,175,215,.22)'; ell(ctx, 8.8, 5.4, 1.5, 1.1, .3); ctx.fill();
          ctx.strokeStyle = 'rgba(8,10,18,.55)'; ctx.lineWidth = .4;
          ctx.beginPath(); ctx.moveTo(9.2, 3.6); ctx.quadraticCurveTo(9.4, 5.6, 8.4, 6.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(5.2, 8.4); ctx.quadraticCurveTo(7, 8.9, 8.6, 8.2); ctx.stroke();
          ctx.restore();
          ctx.beginPath(); top(); ctx.strokeStyle = O; ctx.lineWidth = .8; ctx.stroke();
          ctx.restore();
          ctx.save(); ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.clip();
          headPath(ctx); ctx.strokeStyle = O; ctx.lineWidth = 1.15; ctx.stroke();
          ctx.restore();
        },
        front(ctx, spec, pose) {
          const up = pose && (pose.seal || pose.attack);
          // Far eye: lazy half-lidded at rest, wide open when he fights.
          drawEye(ctx, 7.95, 2.1, 1.48, 2.45, up ? { type: 'normal', iris: '#2c2c34' } : { type: 'sleepy', iris: '#2c2c34', lid: spec.skin }, O, false);
          if (up) {
            // Protector pushed up: the scarred Mangekyō Sharingan.
            drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'mangekyo' }, O, true);
            line(ctx, [[2.1, -2.6], [2.3, -.6]], '#a8604e', .5); line(ctx, [[2.5, 4.4], [2.7, 6.2]], '#a8604e', .5);
            drawBand(ctx, BAND, O, pose);
          } else plateDown(ctx);
          // Silver strands falling over the protector at both temples.
          locks(ctx, spec, HAIR, [[10, -7.6, 11.2, -.6, 1.15, .6], [8.2, -8.8, 8.8, -4.6, 1.05, .3], [-1.6, -8.6, -3, -2.2, 1.3, -.8]], .85);
        }
      },
      front(ctx, pose, hand) {
        // Raikiri crackling in the near hand when he strikes.
        if (!pose.attack) return;
        dot(ctx, hand[0] + 1.2, hand[1], 3.6, 'rgba(120,190,255,.45)');
        dot(ctx, hand[0] + 1.2, hand[1], 2.2, 'rgba(210,236,255,.9)');
        ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = .45; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + .3, r0 = 1.8, r1 = 4.6 + (i % 2) * 1.6;
          ctx.beginPath(); ctx.moveTo(hand[0] + 1.2 + Math.cos(a) * r0, hand[1] + Math.sin(a) * r0);
          ctx.lineTo(hand[0] + 1.2 + Math.cos(a + .35) * (r0 + r1) * .55, hand[1] + Math.sin(a + .35) * (r0 + r1) * .55);
          ctx.lineTo(hand[0] + 1.2 + Math.cos(a - .1) * r1, hand[1] + Math.sin(a - .1) * r1); ctx.stroke();
        }
      }
    };
  }

  const SPECS = {
    naruto: narutoSpec(false),
    naruto_baryon: narutoSpec(true),
    naruto_rinnegan: narutoSpec(false, true),
    naruto_baryon_rinnegan: narutoSpec(true, true),
    naruto_rikudo: narutoRikudoSpec(),
    walker: gruntSpec('walker'), runner: gruntSpec('runner'), brute: gruntSpec('brute'), spitter: gruntSpec('spitter'),
    suna_ninja: gruntSpec('suna_ninja'), kiri_ninja: gruntSpec('kiri_ninja'), kumo_ninja: gruntSpec('kumo_ninja'), iwa_ninja: gruntSpec('iwa_ninja'),
    ame_ninja: gruntSpec('ame_ninja'), oto_ninja: gruntSpec('oto_ninja'), taki_ninja: gruntSpec('taki_ninja'), kusa_ninja: gruntSpec('kusa_ninja'), yu_ninja: gruntSpec('yu_ninja'),

    pain: akatsukiSpec({
      skin: '#f0c9a8',
      head: {
        // Tendō: spiky orange hair swept up and back.
        hair: (ctx, spec) => sweptHair(ctx, spec, '#ff8530', [[-26, 16.6], [-54, 20.4], [-82, 21.6], [-110, 21.4], [-137, 20.4], [-163, 18.6], [-189, 16.4], [-213, 13.4]], { valley: 13.8, sweep: .24 }),
        eyes: { type: 'rinnegan' }, mouth: 'neutral', browAngle: 'angry', browColor: '#a8481c',
        band: { cloth: '#2a2f3c', plate: '#bfc7d0', symbol: 'rain', slash: true },
        marks(ctx) {
          // Six bars across the nose, studs under the lip, and a row up the ear.
          for (let i = 0; i < 3; i++) { stud(ctx, 8.6, 3.2 + i * .95, .36); stud(ctx, 10.1, 3.1 + i * .95, .32); }
          for (const x of [5.6, 7.6]) stud(ctx, x, 9.2, .38);
          stud(ctx, -3.6, -.6, .38); stud(ctx, -4.6, 1.4, .38); stud(ctx, -4.4, 3.6, .38); stud(ctx, -3.2, 4.8, .34);
        }
      },
      front(ctx, pose, hand) {
        // Black chakra receiver rod.
        line(ctx, [[hand[0] - 3, hand[1] + 4], [hand[0] + 6, hand[1] - 9]], '#121218', 1.5);
        line(ctx, [[hand[0] - 2.4, hand[1] + 3], [hand[0] + 5.4, hand[1] - 8]], '#4a4a5a', .4);
        dot(ctx, hand[0] + 6, hand[1] - 9, .9, '#121218');
      }
    }),
    itachi: akatsukiSpec({
      skin: '#f0cfb2',
      head: {
        // Low ponytail behind, centre-parted long bangs framing the face.
        drape(ctx, spec) {
          paint(ctx, () => smooth(ctx, [[-8.4, 4], [-11.4, 8], [-12.4, 13], [-11.8, 17.6], [-10.2, 13.4], [-9, 8.6]]), '#15151c', spec.outline, .9, () => {
            ctx.fillStyle = '#3a4260'; ell(ctx, -11, 10, .45, 3); ctx.fill();
          });
          paint(ctx, () => ell(ctx, -9.4, 5, 1.2, .9), '#8a1f2a', spec.outline, .6);
        },
        hair: HAIR.smooth('#15151c', { nape: 6 }),
        eyes: { type: 'sharingan' }, mouth: 'neutral', browColor: '#15151c',
        band: { cloth: '#1f2433', plate: '#c9d1da', symbol: 'leaf', slash: true },
        marks(ctx) {
          // Tear-trough lines.
          line(ctx, [[1.6, 5.2], [2.4, 6.9]], 'rgba(130,80,70,.6)', .4); line(ctx, [[7.2, 5.1], [7.6, 6.6]], 'rgba(130,80,70,.55)', .36);
        },
        front(ctx, spec) {
          locks(ctx, spec, '#15151c', [[-.8, -7.8, -1.6, 8.4, 1.25, -.7], [9.7, -6.8, 10.7, 7.4, 1.05, .7], [4.2, -8.2, 3.6, -5.4, 1, 0]]);
        }
      },
      front(ctx, pose, hand) { if (pose.seal || pose.attack) return; dot(ctx, hand[0] + .8, hand[1] + .4, .5, '#c9353c'); }
    }),
    kisame: akatsukiSpec({
      skin: '#7fa8c8', skinShade: '#5c84a8', bulk: .8,
      head: {
        // Blue hair standing up like a dorsal fin.
        hair: (ctx, spec) => spikeHair(ctx, spec, '#2f5694', [
          [-6, 11], [-22, 16.4], [-34, 11.4], [-52, 19.4], [-66, 11.6], [-84, 21], [-100, 11.8],
          [-118, 19.8], [-134, 11.6], [-154, 16.4], [-170, 11], [-192, 13], [-210, 10.6]], [[-5.4, 6], [-4.6, 1], [-2, -4.4], [3.4, -6.2], [9.4, -5.4]], { cy: -2 }),
        eyes: { type: 'small' }, mouth: 'shark', browAngle: 'angry', browColor: '#244a74',
        band: { cloth: '#26334d', plate: '#bfc7d0', symbol: 'mist', slash: true },
        marks(ctx) {
          // Gill slits under the eyes.
          for (let i = 0; i < 3; i++) line(ctx, [[.2 + i * 1, 4.8], [.8 + i * 1, 6.6]], '#3e6684', .55);
          for (let i = 0; i < 2; i++) line(ctx, [[8.6 + i * .8, 4.8], [8.9 + i * .8, 6.2]], '#3e6684', .5);
        }
      },
      back(ctx) {
        // Samehada: bandaged scale-covered great sword over the shoulder.
        ctx.save(); ctx.translate(-4, -8); ctx.rotate(-.95);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2, -4.6); ctx.lineTo(30, -6); ctx.quadraticCurveTo(34, 0, 30, 6); ctx.lineTo(-2, 4.6); ctx.closePath(); }, '#3f5d86', '#0c0a10', 1, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-4, 1, 40, 6);
          ctx.strokeStyle = '#e6e2d6'; ctx.lineWidth = 1.3;
          for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 3.6, -6); ctx.lineTo(i * 3.6 + 2, 6); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(150,140,120,.6)'; ctx.lineWidth = .4;
          for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 3.6 + .6, -6); ctx.lineTo(i * 3.6 + 2.6, 6); ctx.stroke(); }
        });
        line(ctx, [[-2, 0], [-10, 0]], '#5c3a2a', 2.4);
        dot(ctx, -10.6, 0, 1.6, '#9aa0aa');
        ctx.restore();
      }
    }),
    deidara: akatsukiSpec({
      skin: '#f6d2b2',
      head: {
        drape(ctx, spec) { HAIR.longBack('#f4d466', 11, 8)(ctx, spec); },
        hair: HAIR.smooth('#f4d466', { nape: 7 }),
        eyes: { type: 'normal', iris: '#3d7fd0' }, mouth: 'smirk', attackMouth: 'grin',
        band: { cloth: '#2a2f3c', plate: '#c3cad3', symbol: 'stone', slash: true },
        front(ctx, spec) {
          // High half-ponytail, the near-side lock, and the long bang hiding his left eye.
          paint(ctx, () => smooth(ctx, [[-3.6, -11.2], [-9, -15.6], [-14.4, -15.4], [-15.6, -11], [-11.6, -12.6], [-7, -8.6]]), '#f4d466', spec.outline, .9, () => {
            ctx.fillStyle = dark('#f4d466', .28); ctx.fillRect(-18, -12.8, 14, 6);
          });
          paint(ctx, () => ell(ctx, -5.2, -10.2, 1.4, 1.1), '#2a2f3c', spec.outline, .6);
          locks(ctx, spec, '#f4d466', [[-1.4, -7.6, -2.2, 8.6, 1.4, -.6]]);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(4.6, -8.4); ctx.quadraticCurveTo(12, -6.4, 11.2, 1.4); ctx.quadraticCurveTo(10.6, 6.6, 9.4, 9); ctx.quadraticCurveTo(7.2, 2.2, 5.2, -2.6); ctx.closePath(); }, '#f4d466', spec.outline, .9, () => {
            ctx.fillStyle = dark('#f4d466', .26); ctx.fillRect(4, -2, 4, 12);
            ctx.fillStyle = light('#f4d466', .45); ell(ctx, 8.6, -5, 1.2, 2.2, .4); ctx.fill();
          });
        }
      },
      front(ctx, pose, hand) {
        // Clay bird ready to detonate.
        ctx.save(); ctx.translate(hand[0] + 2, hand[1] - 2);
        paint(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.8, 0, 0, TAU); }, '#f1ead8', '#5a4a3a', .6, () => { ctx.fillStyle = SHADE; ctx.fillRect(-4, .4, 8, 2); });
        paint(ctx, () => poly(ctx, [[-1, -1], [-3.6, -4.4], [1, -1.4]]), '#f1ead8', '#5a4a3a', .5);
        dot(ctx, 1.8, -.4, .3, '#5a4a3a');
        ctx.restore();
      }
    }),
    sasori: akatsukiSpec({
      skin: '#f3cfb0',
      head: {
        // Short, messy red hair.
        hair: (ctx, spec) => spikeHair(ctx, spec, '#c2342c', [
          [-6, 11.2], [-18, 14.2], [-30, 11.2], [-44, 15.2], [-58, 11.6], [-74, 15.8], [-90, 11.8],
          [-106, 15.6], [-122, 11.8], [-140, 15], [-156, 11.4], [-174, 14.2], [-190, 11], [-206, 13], [-220, 10.6]], HAIR_LINE),
        eyes: { type: 'sleepy', iris: '#8b5a3c', lid: '#f3cfb0' }, mouth: 'neutral', browColor: '#8a2420',
        front(ctx, spec) { locks(ctx, spec, '#c2342c', [[-.4, -8.2, -.6, -2.6, 1.4, 0], [3.4, -8.6, 3.6, -4.2, 1.2, 0], [7, -8.2, 7.8, -3.8, 1.2, 0], [9.8, -6.6, 10.6, -.6, 1.1, .4]]); }
      },
      front(ctx, pose, hand) {
        if (!pose.attack && !pose.seal) return;
        ctx.strokeStyle = 'rgba(120,200,255,.85)'; ctx.lineWidth = .4;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(hand[0] + 16, hand[1] - 7 + i * 3.4); ctx.stroke(); }
      }
    }),
    kakuzu: akatsukiSpec({
      skin: '#8a6c55', bulk: 1,
      arms: {
        upper: AKA, lower: AKA, w1: 5.6, w2: 5.2, hand: '#7c5e48',
        pattern(ctx, p0, p1, p2, far) {
          if (far) return;
          // Stitched threads on the wrist.
          const m = lerp(p1, p2, .9); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = .35;
          for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(m[0] + i * .8 - .4, m[1] - 1.4); ctx.lineTo(m[0] + i * .8 + .4, m[1] + 1.4); ctx.stroke(); }
        }
      },
      head: {
        hair(ctx, spec) {
          // Hood covering the whole head.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(10.8, -2.2); ctx.quadraticCurveTo(12.2, -14, 0, -14); ctx.quadraticCurveTo(-13, -13.4, -12, 2); ctx.lineTo(-10.6, 10.4); ctx.lineTo(-3, 11); ctx.lineTo(-2.8, -1); ctx.lineTo(10.8, -2.2); ctx.closePath(); }, '#33423a', spec.outline, 1.05, () => {
            ctx.fillStyle = dark('#33423a', .3); ctx.fillRect(-14, -2, 30, 16);
            ctx.fillStyle = light('#33423a', .2); ell(ctx, 2, -10, 7, 2.6, -.2); ctx.fill();
            ctx.strokeStyle = dark('#33423a', .45); ctx.lineWidth = .5;
            ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(-10, 0, -8, 9); ctx.stroke();
          });
        },
        eyes: { type: 'kakuzu', iris: '#4fc070' }, browAngle: 'angry', browColor: '#2a1e18',
        mask(ctx, spec) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(10.6, 3.8); ctx.quadraticCurveTo(10.4, 10, 6, 11.2); ctx.quadraticCurveTo(0, 11.8, -3.4, 9); ctx.closePath(); }, '#33423a', spec.outline, .85, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-5, 4, 6, 9);
            ctx.strokeStyle = dark('#33423a', .4); ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(9.6, 5); ctx.quadraticCurveTo(8, 8, 5, 10.4); ctx.stroke();
          });
        },
        band: { cloth: '#33423a', plate: '#bfc7d0', symbol: 'taki', slash: true }
      }
    }),
    konan: akatsukiSpec({
      skin: '#f4d8c6',
      head: {
        // Blue bob with a bun on the back and the paper flower.
        back(ctx, spec) {
          paint(ctx, () => { ctx.beginPath(); ctx.arc(-8.6, -6.4, 3.8, 0, TAU); }, '#5868b6', spec.outline, .9, () => {
            ctx.fillStyle = dark('#5868b6', .3); ctx.fillRect(-14, -5, 10, 6);
            ctx.fillStyle = light('#5868b6', .4); ell(ctx, -8, -8.2, 1.6, .7, -.4); ctx.fill();
          });
        },
        hair: HAIR.smooth('#5868b6', { nape: 7.8, bangs: [[9.6, 1.6, 6.8], [-.4, 1.5, 6.4]] }),
        eyes: { type: 'normal', iris: '#d8962f', fem: true }, mouth: 'lips', browColor: '#3f4a8c', blush: false,
        marks(ctx) {
          // Labret piercing and lilac eye shadow.
          stud(ctx, 6.8, 9.3, .42);
          ctx.fillStyle = 'rgba(122,82,170,.5)'; ell(ctx, 2.4, -.3, 2.4, .7, -.05); ctx.fill(); ell(ctx, 7.9, -.4, 1.6, .6); ctx.fill();
        },
        front(ctx) {
          // Paper rose pinned over the bun.
          for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6 + .3;
            paint(ctx, () => ell(ctx, -5 + Math.cos(a) * 1.6, -10 + Math.sin(a) * 1.6, 1.8, 1.1, a), i % 2 ? '#e8edf8' : '#d6dff2', '#6a7090', .4);
          }
          paint(ctx, () => ell(ctx, -5, -10, 1, 1), '#c4d0ec', '#6a7090', .35);
        }
      }
    }),
    hidan: akatsukiSpec({
      skin: '#f0d6c4',
      torso: {
        base: AKA, paint: ctx => {
          // Open cloak showing the chest and the Jashin pendant.
          ctx.fillStyle = '#f0d6c4'; ctx.beginPath(); ctx.moveTo(-1.4, -13.4); ctx.lineTo(6, -13.4); ctx.lineTo(7, 0); ctx.lineTo(2.4, 0); ctx.fill();
          ctx.fillStyle = 'rgba(176,96,122,.35)'; ctx.fillRect(-1.4, -13.4, 2.6, 13.4);
          ctx.strokeStyle = 'rgba(150,90,80,.5)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(3, -9); ctx.quadraticCurveTo(4.6, -8.2, 6.4, -9); ctx.stroke();
          line(ctx, [[0, -13], [3.6, -8.4], [6.4, -13]], '#9aa0aa', .35);
          ctx.strokeStyle = '#c8ccd4'; ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(3.6, -7, 1.5, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(3.6, -5.6); ctx.lineTo(4.9, -7.8); ctx.lineTo(2.3, -7.8); ctx.closePath(); ctx.stroke();
          cloud(ctx, -4, -6, .5, .05);
        }
      },
      head: {
        hair(ctx, spec) {
          // Slicked-back silver hair.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(9.6, -5.4); ctx.quadraticCurveTo(6, -14, -4, -12.6); ctx.lineTo(-13.6, -9.2); ctx.lineTo(-10.8, -6.2); ctx.lineTo(-14.4, -3.6); ctx.lineTo(-10.2, -1); ctx.lineTo(-11.2, 4); ctx.lineTo(-5, 4); ctx.lineTo(-4, -2); ctx.quadraticCurveTo(2, -7, 9.6, -5.4); ctx.closePath(); }, '#d8dce4', spec.outline, 1.05, () => {
            ctx.fillStyle = '#a6acb8'; ctx.fillRect(-16, -4, 16, 10);
            ctx.strokeStyle = '#9aa0ae'; ctx.lineWidth = .5;
            for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(7 - i * 2, -9.4 + i * .9); ctx.quadraticCurveTo(-2 - i, -9 + i, -12, -6 + i * 2); ctx.stroke(); }
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(5, -10.8); ctx.quadraticCurveTo(-1, -11.4, -6, -10); ctx.stroke();
          });
        },
        eyes: { type: 'normal', iris: '#b34aa8' }, mouth: 'grin', attackMouth: 'shout', browAngle: 'angry', browColor: '#9aa0ae'
      },
      collarBack: null,
      collar(ctx) {
        // Lowered collar plus the slashed Yugakure band worn around the neck.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.9, -10.6); ctx.lineTo(-7.2, -15.4); ctx.quadraticCurveTo(-3.4, -14.6, -1.2, -13.4); ctx.lineTo(-1.4, -10.6); ctx.closePath(); }, AKA, '#0c0a10', 1, () => {
          ctx.fillStyle = '#c21e2e'; ctx.fillRect(-7.4, -15.6, 7, 1.1);
        });
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2, -15.4); ctx.quadraticCurveTo(2.4, -13.4, 7.4, -14.8); ctx.lineTo(7.4, -13); ctx.quadraticCurveTo(2.4, -11.8, -2, -13.6); ctx.closePath(); }, '#1f2433', '#0c0a10', .7);
        paint(ctx, () => poly(ctx, [[1, -15], [5.4, -15], [5.4, -12.4], [1, -12.4]]), '#c3cad3', '#0c0a10', .6);
        plateSymbol(ctx, 'yuga', 3.2, -13.7, .6, '#4a4f58');
        line(ctx, [[1.2, -12.8], [5.2, -14.6]], '#25252c', .45);
      },
      back(ctx) {
        // Triple-bladed red scythe.
        line(ctx, [[-10, 6], [10, -22]], '#2a1c18', 2.2);
        line(ctx, [[-10, 6], [10, -22]], '#6a4a40', 1.2);
        ctx.save(); ctx.translate(10, -22); ctx.rotate(-.6);
        for (let i = 0; i < 3; i++) paint(ctx, () => { ctx.beginPath(); ctx.moveTo(0, i * 2.4 - 2); ctx.quadraticCurveTo(-10 - i * 3, i * 3 - 6, -14 - i * 3, 4 + i * 3); ctx.quadraticCurveTo(-8, i * 2.4, 0, i * 2.4); ctx.closePath(); }, '#d0242f', '#3a0a10', .7, () => {
          ctx.fillStyle = 'rgba(255,200,200,.45)'; ctx.fillRect(-20, i * 3 - 7, 20, 1.2);
        });
        ctx.restore();
      }
    }),

    momoshiki: robeSpec({
      head: {
        drape(ctx, spec) { HAIR.longBack('#f4f2f6', 18, 9)(ctx, spec); },
        hair: HAIR.smooth('#f4f2f6', { bangs: [[9.6, 1.4, 4.6], [0, 1.6, 6]] }),
        eyes: { type: 'byakugan' }, mouth: 'neutral', browColor: '#9a8a8a', browAngle: 'angry',
        marks(ctx) { ctx.fillStyle = '#c8303a'; ell(ctx, 2.2, -1.4, 1.8, .45, -.1); ctx.fill(); ell(ctx, 8, -1.5, 1.2, .4); ctx.fill(); },
        front(ctx) { horns(ctx, [[1, -11, 4.8, -104, 1.15], [6, -10.6, 4.8, -78, 1.15]]); }
      },
      front(ctx, pose, hand) {
        // Rinnegan in the palm.
        if (!pose.attack && !pose.seal && !pose.raise) return;
        ell(ctx, hand[0] + .6, hand[1], 1.3, 1.1); ctx.fillStyle = '#cdbcf0'; ctx.fill();
        ctx.strokeStyle = '#4a3480'; ctx.lineWidth = .25; ell(ctx, hand[0] + .6, hand[1], .7, .6); ctx.stroke();
      }
    }, '#f3efe9', '#a63c43'),
    kinshiki: robeSpec({
      bulk: 1.6,
      head: {
        drape(ctx, spec) { HAIR.longBack('#f1eef0', 20, 10, { split: true })(ctx, spec); },
        hair: HAIR.smooth('#f1eef0'),
        eyes: { type: 'byakugan' }, brows: 'thick', browColor: '#c8c0c0', browAngle: 'angry',
        mask(ctx, spec) {
          // Pointed white beard.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.6, 6); ctx.lineTo(10.2, 5); ctx.quadraticCurveTo(10.6, 11, 6.4, 15.6); ctx.quadraticCurveTo(1.6, 13, -2.6, 6); ctx.closePath(); }, '#f1eef0', spec.outline, .9, () => {
            ctx.fillStyle = dark('#f1eef0', .25); ctx.fillRect(-4, 6, 6, 12);
            ctx.strokeStyle = dark('#f1eef0', .35); ctx.lineWidth = .4;
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 2.4, 7); ctx.quadraticCurveTo(3 + i * 1.6, 11, 5.6 + i * .5, 14.4); ctx.stroke(); }
          });
          line(ctx, [[5.4, 7.4], [8.6, 7]], spec.outline, .6);
        },
        front(ctx) { horns(ctx, [[-1, -11.4, 7, -110, 1.6], [5.4, -11, 7, -74, 1.6]]); }
      },
      back(ctx, pose) {
        if (pose.attack) return;
        // Crimson chakra greataxe resting across the back.
        ctx.save(); ctx.translate(-6, -2); ctx.rotate(-2.1);
        line(ctx, [[-4, 0], [24, 0]], '#7a1a24', 1.8);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(18, 0); ctx.quadraticCurveTo(24, -10, 30, -9); ctx.quadraticCurveTo(27, 0, 30, 9); ctx.quadraticCurveTo(24, 10, 18, 0); ctx.closePath(); }, '#ff3a4e', '#5a0612', .8, () => { ctx.fillStyle = 'rgba(255,220,220,.5)'; ctx.fillRect(26, -10, 2, 20); });
        ctx.restore();
      },
      front(ctx, pose, hand) {
        if (!pose.attack) return;
        ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(-.4);
        line(ctx, [[-4, 0], [22, 0]], '#7a1a24', 1.8);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(16, 0); ctx.quadraticCurveTo(22, -10, 28, -9); ctx.quadraticCurveTo(25, 0, 28, 9); ctx.quadraticCurveTo(22, 10, 16, 0); ctx.closePath(); }, '#ff3a4e', '#5a0612', .8, () => { ctx.fillStyle = 'rgba(255,220,220,.5)'; ctx.fillRect(24, -10, 2, 20); });
        ctx.restore();
      }
    }, '#ece6e2', '#4d4060'),
    isshiki: robeSpec({
      head: {
        drape(ctx, spec) { HAIR.longBack('#1e1d24', 16, 9)(ctx, spec); },
        hair: HAIR.smooth('#1e1d24', { bangs: [[9.6, 1.4, 5.6], [.4, 1.4, 5]] }),
        eyes: { type: 'byakugan' }, mouth: 'frown', browAngle: 'angry', browColor: '#1e1d24',
        front(ctx) { horns(ctx, [[1.6, -11.2, 7.4, -98, 1.5]], '#e6dccc'); }
      }
    }, '#2a2832', '#c9963f'),
    kaguya: robeSpec({
      noLegs: true,
      skin: '#f6ece6',
      skirt: { color: '#f3f1f6', hem: -1, flare: 3, opening: false, paint: (ctx, hem) => { ctx.fillStyle = '#9d74c0'; ctx.fillRect(-20, hem - 2, 40, 2.2); ctx.fillStyle = '#6e4f8c'; for (let x = -12; x < 12; x += 3.4) dot(ctx, x, hem - 3.6, .6, '#6e4f8c'); } },
      head: {
        drape(ctx, spec) { HAIR.longBack('#f6f4f8', 42, 11)(ctx, spec); },
        hair: HAIR.smooth('#f6f4f8', { bangs: [[9.6, 1.6, 8.4], [0, 1.6, 7.8]] }),
        eyes: { type: 'byakugan', fem: true }, mouth: 'lips', browColor: '#b8a8b8', blush: false,
        marks(ctx) {
          // Rinne-Sharingan third eye: red, rippled, with tomoe.
          paint(ctx, () => ell(ctx, 4.6, -6.6, 1.5, 1.8), '#d8202c', '#3a0a10', .5);
          ctx.strokeStyle = '#3a0a10'; ctx.lineWidth = .22; ell(ctx, 4.6, -6.6, .8, 1); ctx.stroke(); ell(ctx, 4.6, -6.6, 1.2, 1.45); ctx.stroke();
          dot(ctx, 4.6, -6.6, .3, '#2a0408');
          for (let i = 0; i < 3; i++) { const a = i * TAU / 3; dot(ctx, 4.6 + Math.cos(a) * 1, -6.6 + Math.sin(a) * 1.2, .22, '#2a0408'); }
        },
        front(ctx) { horns(ctx, [[-1.4, -11.6, 7, -116, 1.35], [5.2, -11.2, 7, -66, 1.35]]); }
      },
      collar(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(-7.8, -17.4); ctx.quadraticCurveTo(-1, -15.2, 4.6, -14.2); ctx.lineTo(8.8, -15.6); ctx.lineTo(7.8, -11); ctx.closePath(); }, '#f3f1f6', '#2b2330', 1, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -18, 5, 8);
          for (let i = 0; i < 5; i++) tomoe(ctx, -5 + i * 3, -14.4 + Math.abs(i - 2) * .4, .55, 0, '#6e4f8c');
        });
      }
    }, '#f3f1f6', '#9d74c0'),

    hashirama: {
      outline: '#22160f', skin: '#efc39e',
      legs: { thigh: '#262c40', shin: '#262c40', foot: '#20263a', w1: 5.6 },
      arms: { upper: '#262c40', lower: '#262c40', guard: '#b33a2c', w1: 4.8, w2: 4.4 },
      torso: {
        base: '#b33a2c', paint: ctx => {
          // Crimson lamellar breastplate: overlapping plate rows, each with a lit top edge.
          for (let y = -12, r = 0; y < 0; y += 2.4, r++) {
            ctx.fillStyle = 'rgba(255,190,160,.22)'; ctx.fillRect(-8, y + .2, 17, .6);
            ctx.strokeStyle = '#5a140e'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-8, y + 2.2); ctx.lineTo(9, y + 1.8); ctx.stroke();
            ctx.fillStyle = '#e8c070'; for (let x = -5 + (r % 2) * 1.6; x < 8; x += 3.2) ctx.fillRect(x, y + 1.1, .5, .5);
          }
          line(ctx, [[2.6, -12.6], [3.1, 0]], '#5a140e', .55);
          // Dark undersuit showing at the neck.
          ctx.fillStyle = '#262c40'; ctx.beginPath(); ctx.moveTo(-2, -13.6); ctx.lineTo(5.6, -13.6); ctx.lineTo(3.4, -11); ctx.lineTo(.2, -11); ctx.fill();
        }
      },
      skirt: { color: '#b33a2c', hem: 9.4, opening: false, paint: (ctx, hem, hipY) => {
        // Tassets: three hanging plate panels.
        ctx.strokeStyle = '#5a140e'; ctx.lineWidth = .6;
        for (let y = hipY + 2; y < hem; y += 2.3) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,190,160,.18)'; for (let y = hipY + 2.3; y < hem; y += 2.3) ctx.fillRect(-14, y, 28, .5);
        ctx.lineWidth = .7; for (const x of [-3.6, 1.2, 5.6]) { ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x + .3, hem + 2); ctx.stroke(); }
        ctx.fillStyle = '#262c40'; ctx.fillRect(-14, hipY - 2, 28, 1.6);
      } },
      collarBack(ctx) {
        // Far shoulder guard peeking out behind the body.
        paint(ctx, () => smooth(ctx, [[2.4, -13.6], [7.4, -14], [10, -11], [9.2, -7.6], [4.6, -8.6]]), '#8e2a20', '#22160f', .9, () => {
          ctx.strokeStyle = '#4e100a'; ctx.lineWidth = .5; for (const y of [-11.6, -9.8]) { ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(11, y + .4); ctx.stroke(); }
        });
      },
      shoulder(ctx) {
        // Big near pauldron: three overlapping lames.
        for (let i = 2; i >= 0; i--) {
          const dy = i * 1.9;
          paint(ctx, () => smooth(ctx, [[-8.2, -13 + dy], [-2.4, -15 + dy], [2.8, -12.4 + dy], [2, -9.4 + dy], [-5.4, -9 + dy], [-8.8, -10.4 + dy]]), i ? '#a8342a' : '#c04434', '#22160f', .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-10, -10.6 + dy, 14, 3);
            ctx.fillStyle = 'rgba(255,220,200,.35)'; ell(ctx, -2.4, -13.6 + dy, 3.4, .7, .1); ctx.fill();
          });
        }
      },
      head: {
        // Long, straight dark hair falling well past the shoulders, parted in the middle.
        drape(ctx, spec) { HAIR.longBack('#3a2a22', 37, 12.5)(ctx, spec); },
        hair: HAIR.smooth('#3a2a22', { nape: 9, bangs: [[9.8, 1.7, 9.4], [-.2, 1.9, 9.8], [4.4, 1.1, -3.2]] }),
        eyes: { type: 'normal', iris: '#4a2e1e' }, mouth: 'smile', browColor: '#2a1e18',
        band: { cloth: '#1d2233', plate: '#cdd5de', symbol: 'leaf' }
      }
    },
    tobirama: {
      outline: '#16202a', skin: '#f1cba8',
      legs: { thigh: '#1e2433', shin: '#1e2433', foot: '#1a2030', w1: 5.6 },
      arms: { upper: '#1e2433', lower: '#1e2433', guard: '#3c6696', w1: 4.6, w2: 4.4 },
      torso: { base: '#3c6696', paint: ctx => {
        ctx.strokeStyle = '#1f3a5c'; ctx.lineWidth = .6; for (let y = -9; y < 0; y += 2.6) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(9, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(200,230,255,.2)'; for (let y = -11.2; y < 0; y += 2.6) ctx.fillRect(-8, y + .5, 17, .5);
      } },
      skirt: { color: '#3c6696', hem: 9.5, opening: false, paint: (ctx, hem, hipY) => { ctx.strokeStyle = '#1f3a5c'; ctx.lineWidth = .55; for (let y = hipY + 2.4; y < hem; y += 2.4) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); } } },
      collar(ctx) {
        // Thick white fur ruff draped round the neck and over both shoulders.
        const ruff = (cx, cy, rx, ry, n, tuft) => {
          ctx.beginPath();
          for (let i = 0; i <= n; i++) {
            const a = i / n * TAU, r = i % 2 ? 1 : 1 + tuft;
            const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
            if (i) ctx.quadraticCurveTo(cx + Math.cos(a - Math.PI / n) * rx * (1 + tuft * 1.6), cy + Math.sin(a - Math.PI / n) * ry * (1 + tuft * 1.6), x, y); else ctx.moveTo(x, y);
          }
          ctx.closePath();
        };
        paint(ctx, () => ruff(1.2, -12.4, 9.4, 3.6, 22, .1), '#f6f5f0', '#16202a', .85, () => {
          ctx.fillStyle = '#c6ccd8'; ctx.beginPath(); ctx.ellipse(.6, -10.6, 10, 2.4, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#d8dce6'; ctx.fillRect(-10, -13, 6, 4);
          ctx.fillStyle = '#ffffff'; ell(ctx, 3.6, -14.4, 4, 1, -.05); ctx.fill();
          ctx.strokeStyle = '#a8b0c0'; ctx.lineWidth = .4;
          for (let i = 0; i < 9; i++) { const x = -6.4 + i * 1.9; ctx.beginPath(); ctx.moveTo(x, -14.6 + Math.abs(i - 4) * .2); ctx.quadraticCurveTo(x - .6, -12.6, x - .2, -10.6); ctx.stroke(); }
        });
      },
      head: {
        // Spiky silver-white hair standing up off the forehead protector.
        hair: (ctx, spec) => sweptHair(ctx, spec, '#eef0f2', [[-30, 15.6], [-56, 18.8], [-82, 19.8], [-108, 19.6], [-134, 18.8], [-160, 17.4], [-186, 15.6], [-210, 13.2]], { valley: 13, sweep: .14, gloss: '#ffffff' }),
        eyes: { type: 'normal', iris: '#c3343a' }, mouth: 'frown', browAngle: 'angry', browColor: '#aab0b8',
        marks(ctx) {
          const bar = (x0, y0, x1, y1, w) => { ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x1 + w * .35, y1); ctx.lineTo(x1 - w * .35, y1); ctx.closePath(); ctx.fill(); };
          ctx.fillStyle = '#d02a34';
          bar(1.7, 5, 1.9, 8.6, .5); bar(8, 4.9, 8.1, 7.8, .38); bar(6.3, 9.6, 6.4, 11.2, .42);
        },
        band: { cloth: '#1d2233', plate: '#cdd5de', symbol: 'leaf', wide: true }
      }
    },
    hiruzen: {
      outline: '#22180f', skin: '#eac2a0',
      legs: { thigh: '#262a35', shin: '#262a35', foot: '#22262f' },
      arms: { upper: '#f4f1e8', lower: '#f4f1e8', w1: 5.4, w2: 5.4, cuff: '#c0392b' },
      torso: { base: '#f4f1e8', paint: ctx => {
        ctx.fillStyle = '#262a35'; ctx.beginPath(); ctx.moveTo(-1, -13.4); ctx.lineTo(4, -13.4); ctx.lineTo(3.6, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-1.4, -13.4); ctx.lineTo(.2, -13.4); ctx.lineTo(3.8, -7.6); ctx.lineTo(3.6, 0); ctx.lineTo(2.2, 0); ctx.lineTo(2.4, -7.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#262a35'; ctx.fillRect(-8, -2.4, 17, 2.2);
      } },
      skirt: { color: '#f4f1e8', hem: 4.5, paint: (ctx, hem) => { ctx.fillStyle = '#c0392b'; ctx.fillRect(-20, hem - 1.8, 40, 1.8); } },
      head: {
        hair: HAIR.smooth('#d8d4cc'),
        eyes: { type: 'normal', iris: '#3a2c22' }, mouth: 'smile', browColor: '#9a948c',
        marks(ctx) {
          // Age lines, liver spot, goatee.
          line(ctx, [[.2, 4.8], [1.6, 5.6]], '#9a6a50', .45); line(ctx, [[-1, -.2], [.4, .6]], '#9a6a50', .45);
          line(ctx, [[8.6, 6.6], [9.6, 7.8]], '#9a6a50', .4);
          dot(ctx, 4.4, -3, .5, '#c49a7c');
          paint(ctx, () => poly(ctx, [[5.2, 9], [7.8, 9], [6.6, 13]]), '#d8d4cc', '#22180f', .5);
        },
        front(ctx, spec) {
          // Kage kasa with 火 on the red panel.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-15.4, -3.2); ctx.quadraticCurveTo(1, -24.6, 17.4, -2.8); ctx.quadraticCurveTo(1, -6.8, -15.4, -3.2); ctx.closePath(); }, '#f6f3ea', spec.outline, 1.05, () => {
            ctx.fillStyle = '#d8d2c4'; ctx.beginPath(); ctx.moveTo(-16, -3); ctx.quadraticCurveTo(-6, -16, 0, -17); ctx.lineTo(-2, -2); ctx.fill();
            ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(1.2, -17.8); ctx.lineTo(9.8, -16.2); ctx.lineTo(10.8, -5.6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(0, -18, 10, -10); ctx.lineTo(10, -9); ctx.quadraticCurveTo(0, -16, -10, -5); ctx.fill();
            ctx.strokeStyle = 'rgba(80,60,40,.3)'; ctx.lineWidth = .4;
            for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(1, -16); ctx.lineTo(-14 + i * 6, -3.6); ctx.stroke(); }
          });
          ctx.fillStyle = '#ffffff'; ctx.font = 'bold 7px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('火', 5.4, -10.6);
          // Chin strap.
          line(ctx, [[-5, -3.6], [-4.4, 6]], '#5a4a3a', .45);
        }
      }
    },
    minato: {
      outline: '#1a1c22', skin: '#f6d0ae',
      legs: { thigh: '#2b3954', shin: '#2b3954', foot: '#232f48', wrap: '#e8e4da', holster: '#1c2436' },
      arms: { upper: '#f7f5ee', lower: '#2b3954', w1: 5.2, w2: 4, cuff: '#f7f5ee' },
      torso: {
        base: '#2b3954', over(ctx, pose) {
          flakVest('#5d7a3b', { outline: '#1a1c22' })(ctx, pose);
          // Open white haori hanging over both sides of the vest.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.2, -12.6); ctx.lineTo(-3.6, -13.4); ctx.quadraticCurveTo(-4.6, -6, -3.6, 1); ctx.lineTo(-7.4, 1); ctx.quadraticCurveTo(-7.8, -6, -7.2, -12.6); ctx.closePath(); }, '#f7f5ee', '#1a1c22', .85, () => {
            ctx.fillStyle = 'rgba(70,60,110,.28)'; ctx.fillRect(-9, -14, 3.4, 16);
            ctx.strokeStyle = 'rgba(70,60,110,.35)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-5.4, -10); ctx.quadraticCurveTo(-6, -4, -5.2, 1); ctx.stroke();
          });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(6.6, -12.8); ctx.lineTo(8.2, -12); ctx.quadraticCurveTo(8.6, -6, 8, 1); ctx.lineTo(6.4, 1); ctx.quadraticCurveTo(7, -6, 6.6, -12.8); ctx.closePath(); }, '#f7f5ee', '#1a1c22', .8, () => {
            ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(6.6, -12, .7, 12);
          });
        }
      },
      collarBack(ctx) {
        // Haori collar rising behind the neck.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.2, -15.2); ctx.quadraticCurveTo(-4, -16, -1, -14.4); ctx.lineTo(-1, -11); ctx.closePath(); }, '#f7f5ee', '#1a1c22', .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 4, 6); });
      },
      shoulder(ctx) {
        // Haori shoulder over the flak vest.
        paint(ctx, () => smooth(ctx, [[-7.2, -12.8], [-2.4, -13.8], [1, -12], [-.4, -8.4], [-6.4, -8], [-7.8, -10]]), '#f7f5ee', '#1a1c22', .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-9, -10, 12, 3);
        });
      },
      skirt: {
        color: '#f7f5ee', hem: 7.4, paint: (ctx, hem) => {
          // Flame-patterned hem of the Fourth's haori: tall red tongues with orange cores.
          const flames = (h, color, inset) => {
            ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-20, hem + 2);
            for (let i = 0; i < 9; i++) {
              const x = -17 + i * 4.2, tall = (i % 2 ? 6.6 : 4.4) * h;
              ctx.quadraticCurveTo(x - 1.6 + inset, hem - tall * .3, x - .4, hem - tall);
              ctx.quadraticCurveTo(x + .4, hem - tall * .5, x + 2.1 - inset, hem - .2);
            }
            ctx.lineTo(22, hem + 2); ctx.closePath(); ctx.fill();
          };
          flames(1, '#d8361f', 0);
          flames(.55, '#ff8a2a', .5);
          ctx.fillStyle = '#9a1a10'; ctx.fillRect(-20, hem - .5, 40, .7);
        }
      },
      head: {
        hair(ctx, spec) {
          // Bright golden spikes, tamer and more swept back than Naruto's.
          sweptHair(ctx, spec, '#ffdd4e', [[-30, 16.6], [-60, 20], [-90, 21.4], [-119, 21], [-147, 20], [-173, 18.6], [-198, 16.4], [-219, 13.6]], { valley: 13.6, sweep: .24 });
        },
        back(ctx, spec) { sweptBack(ctx, spec, '#ffdd4e', [[-75, 19.2], [-104, 20], [-133, 19.6], [-160, 18.4], [-186, 16.4], [-208, 14]], { valley: 12.6 }); },
        eyes: { type: 'normal', iris: '#2f7ad8' }, mouth: 'smile', browColor: '#b08a20',
        band: { cloth: '#1d2233', plate: '#cdd5de', symbol: 'leaf' },
        front(ctx, spec) {
          // Long jaw-length bangs framing both sides of the face.
          locks(ctx, spec, '#ffd84a', [[-1.2, -8.2, -1.8, 9.4, 1.8, -1], [9.6, -7.2, 10.4, 8, 1.4, .9], [1.6, -8.6, 2.2, -5.8, 1.2, 0], [7.4, -8, 7.8, -5.4, 1.1, 0]], .9);
        }
      },
      front(ctx, pose, hand) {
        // Three-pronged Flying Thunder God kunai.
        ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(pose.attack ? 0 : pose.run ? 2.8 : 1.2);
        paint(ctx, () => poly(ctx, [[1.4, -1.4], [9.6, 0], [1.4, 1.4]]), '#a7b0ba', '#1a1c22', .6, () => { ctx.fillStyle = '#e6ecf2'; ctx.fillRect(1.4, -1.4, 8, 1.1); });
        paint(ctx, () => poly(ctx, [[2, -.6], [5, -4.2], [3.2, -.4]]), '#a7b0ba', '#1a1c22', .5);
        paint(ctx, () => poly(ctx, [[2, .6], [5, 4.2], [3.2, .4]]), '#a7b0ba', '#1a1c22', .5);
        line(ctx, [[-3, 0], [1.4, 0]], '#e8e2c8', 1.4);
        ctx.restore();
      }
    },
    guy: {
      outline: '#3a0c08', skin: '#e46a48', skinShade: '#b8402c',
      legs: { thigh: '#2f8a3e', shin: '#2f8a3e', warmer: '#f28a2e', foot: '#25304a', w1: 5.6, w2: 5 },
      arms: { upper: '#2f8a3e', lower: '#2f8a3e', w1: 4.8, w2: 4.4 },
      torso: {
        base: '#2f8a3e', paint: ctx => {
          // Forehead protector worn as a belt on red cloth.
          ctx.fillStyle = '#b8282c'; ctx.fillRect(-8, -2.8, 17, 2.4);
          ctx.fillStyle = '#cdd5de'; ctx.fillRect(2.4, -3.1, 3.8, 3);
          plateSymbol(ctx, 'leaf', 4.3, -1.6, .55, '#5a6470');
          ctx.strokeStyle = 'rgba(20,60,30,.5)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(3.4, -13); ctx.lineTo(3.4, -3); ctx.stroke();
        }
      },
      collar(ctx) { paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.6, -13.2, 4.4, 1.7, 0, 0, TAU); }, '#2f8a3e', '#3a0c08', .8); },
      head: {
        hair(ctx, spec) {
          // The famous glossy bowl cut: a smooth dome, dead-straight fringe, sides cut level at the jaw.
          const c = '#16161c';
          paint(ctx, () => {
            ctx.beginPath();
            ctx.moveTo(11, 1.6);
            ctx.quadraticCurveTo(12.2, -13.4, .6, -14);
            ctx.quadraticCurveTo(-13, -13.6, -12, .4);
            ctx.lineTo(-11.6, 6.8); ctx.lineTo(-3, 6.8); ctx.lineTo(-2.4, -2.6);
            ctx.quadraticCurveTo(4, -3.8, 10.4, -2.8);
            ctx.closePath();
          }, c, spec.outline, 1.15, () => {
            ctx.fillStyle = '#0a0a0e'; ctx.fillRect(-14, -1, 12, 10);
            // Vertical comb lines and the blunt fringe edge.
            ctx.strokeStyle = '#2c3044'; ctx.lineWidth = .4;
            for (let i = 0; i < 6; i++) { const x = -1 + i * 2.1; ctx.beginPath(); ctx.moveTo(x - .6, -11); ctx.quadraticCurveTo(x + .2, -7, x + .1, -3.2); ctx.stroke(); }
            for (let i = 0; i < 3; i++) { const x = -10 + i * 2.6; ctx.beginPath(); ctx.moveTo(x + 1, -9); ctx.quadraticCurveTo(x - .2, -2, x, 6.4); ctx.stroke(); }
            // Mirror-shine halo ring across the dome.
            ctx.strokeStyle = '#7d8cc0'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.ellipse(.4, -5.2, 9.6, 6.2, -.08, Math.PI * 1.08, Math.PI * 1.86); ctx.stroke();
            ctx.strokeStyle = '#e8eeff'; ctx.lineWidth = .8;
            ctx.beginPath(); ctx.ellipse(.4, -5.2, 9.6, 6.2, -.08, Math.PI * 1.32, Math.PI * 1.6); ctx.stroke();
          });
        },
        eyes: { type: 'small' }, brows: 'thick', browW: 2.3, browColor: '#121216', browAngle: 'angry', mouth: 'grin', attackMouth: 'shout', blush: false
      }
    },

    // ------------------------------------------------------------ other Kage
    gaara: {
      outline: '#2a1214', skin: '#f3d8c2',
      legs: { thigh: '#4a1a20', shin: '#4a1a20', foot: '#2a2630', w1: 5.4 },
      arms: { upper: '#7a2128', lower: '#7a2128', w1: 5, w2: 4.6, cuff: '#5a1218' },
      torso: {
        base: '#7a2128',
        over(ctx, pose) {
          flakVest('#9a9c94', { plain: true, outline: '#2a1214' })(ctx, pose);
          line(ctx, [[3.8, -12.6], [3.8, -1]], '#5a5c58', .45);
          // Gourd strap across the chest.
          paint(ctx, () => poly(ctx, [[-6.6, -12.4], [-4.2, -13.4], [7.8, -2.6], [6.8, -.6]]), '#8a6a44', '#2a1214', .7, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -6, 18, 6);
            ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(-5.6, -13); ctx.lineTo(-4.8, -13.2); ctx.lineTo(7.4, -2.4); ctx.lineTo(7, -2); ctx.fill();
          });
        }
      },
      skirt: { color: '#7a2128', hem: 3.2, flare: .8 },
      collar(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -11.4); ctx.lineTo(-6.8, -16.4); ctx.quadraticCurveTo(-2, -15, 3.4, -14.6); ctx.lineTo(7.6, -15.4); ctx.lineTo(7, -11.6); ctx.quadraticCurveTo(1, -12.4, -6.4, -11.4); ctx.closePath(); }, '#7a2128', '#2a1214', .95, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-8, -17, 5, 7);
          ctx.fillStyle = '#5a1218'; ctx.fillRect(-8, -13.4, 17, 1.6);
        });
      },
      back(ctx) {
        // Sand gourd, cork on top, rope round its waist.
        ctx.save(); ctx.translate(-7.6, -8); ctx.rotate(-.2);
        const g = '#d9c094', O = '#2a1214';
        const sh = () => { ctx.fillStyle = 'rgba(120,70,40,.32)'; ctx.fillRect(-12, -20, 8.6, 32); ctx.fillStyle = 'rgba(255,255,255,.28)'; ell(ctx, 2.6, -2, 1.4, 4, .1); ctx.fill(); };
        paint(ctx, () => ell(ctx, .6, -10, 4.4, 5), g, O, 1, sh);
        paint(ctx, () => ell(ctx, 0, 3.6, 6.8, 8.2), g, O, 1.05, sh);
        paint(ctx, () => { ctx.beginPath(); ctx.rect(-2.4, -6.2, 5.6, 1.8); }, '#7a5634', O, .7);
        paint(ctx, () => { ctx.beginPath(); ctx.rect(-.4, -16.6, 2.4, 2.4); }, '#8a6a44', O, .7);
        ctx.restore();
      },
      head: {
        // Short, messy brick-red hair.
        hair: (ctx, spec) => sweptHair(ctx, spec, '#b8262c', [[-24, 15], [-46, 17.2], [-70, 18.2], [-94, 18.4], [-118, 18], [-142, 17.4], [-165, 16.4], [-189, 15], [-212, 13]], { valley: 13.4, sweep: .17 }),
        eyes: { type: 'normal', iris: '#4fc0b4', ring: true }, brows: false, mouth: 'neutral', blush: false,
        marks(ctx) {
          // 愛 tattoo over his left (far) brow.
          ctx.font = 'bold 4.4px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(90,10,20,.5)'; ctx.fillText('愛', 8.5, -2.9);
          ctx.fillStyle = '#d8202e'; ctx.fillText('愛', 8.3, -3.1);
        },
        front(ctx, spec) { locks(ctx, spec, '#b8262c', [[-1.4, -8, -2.2, 2.4, 1.4, -.6], [2.4, -8.6, 2.6, -4.6, 1.3, 0], [5.6, -8.4, 5.4, -5.2, 1.1, 0]]); }
      }
    },
    mei: {
      outline: '#2a1a24', skin: '#f9dfcf',
      legs: { thigh: '#1d2a50', shin: '#1d2a50', foot: '#24203a', w1: 5, w2: 4.2 },
      arms: { upper: '#2a3e78', lower: '#2a3e78', w1: 4.6, w2: 4.4 },
      torso: {
        base: '#2a3e78', paint: ctx => {
          ctx.strokeStyle = 'rgba(15,20,50,.6)'; ctx.lineWidth = .5;
          ctx.beginPath(); ctx.moveTo(-1, -9.2); ctx.quadraticCurveTo(2.6, -6.6, 7, -8.6); ctx.stroke();
          ctx.fillStyle = '#1a2650'; ctx.fillRect(-8, -3, 17, 2.4);
        }
      },
      skirt: { color: '#2a3e78', hem: 1.8, flare: 1.6 },
      collar(ctx) {
        // Fishnet mesh high collar.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.2, -12); ctx.lineTo(-4.4, -17.2); ctx.quadraticCurveTo(1.4, -16, 6.8, -16.4); ctx.lineTo(6.8, -12); ctx.quadraticCurveTo(1.4, -11.2, -4.2, -12); ctx.closePath(); }, '#4a5064', '#2a1a24', .85, () => {
          ctx.strokeStyle = '#8a92a8'; ctx.lineWidth = .3;
          for (let i = -8; i < 12; i += 1.4) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i + 6, -11); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + 6, -18); ctx.lineTo(i, -11); ctx.stroke(); }
          ctx.fillStyle = SHADE; ctx.fillRect(-6, -17.6, 3, 7);
        });
      },
      head: {
        drape(ctx, spec) { HAIR.longBack('#b24f2a', 36, 11.5)(ctx, spec); },
        hair: HAIR.smooth('#b24f2a', { nape: 8 }),
        eyes: { type: 'normal', iris: '#3aa05a', fem: true }, mouth: 'lips', lipColor: '#cf2a3e', browColor: '#8a3a1e',
        front(ctx, spec) {
          const c = '#b24f2a', O = spec.outline;
          // Top knot.
          paint(ctx, () => smooth(ctx, [[-6.4, -10.6], [-8.2, -15], [-4.4, -17.2], [-.6, -15.4], [-1.4, -11.6]]), c, O, .9, () => {
            ctx.fillStyle = dark(c, .3); ctx.fillRect(-10, -13, 12, 4);
            ctx.fillStyle = hairGloss(c); ell(ctx, -4.6, -15.6, 1.8, .6, -.2); ctx.fill();
          });
          paint(ctx, () => ell(ctx, -3.6, -11.6, 1.4, .9, -.3), '#1a2650', O, .6);
          // Long bang sweeping over her right (near) eye; long lock on the far side.
          fringeShadow(ctx, [[-1.6, -6], [6.4, -6], [6.2, 2], [3.4, 11], [.4, 3]]);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.8, -8.8); ctx.quadraticCurveTo(6, -8.8, 5.8, -.4); ctx.quadraticCurveTo(5.4, 5.4, 2.8, 10.4); ctx.quadraticCurveTo(1.6, 4.2, -.6, 1.6); ctx.quadraticCurveTo(-2.4, -3, -2.8, -8.8); ctx.closePath(); }, c, O, .9, () => {
            ctx.fillStyle = dark(c, .28); ctx.fillRect(-4, -2, 4.4, 14);
            ctx.fillStyle = hairGloss(c); ell(ctx, 3.4, -5.4, 1.4, 2.4, .5); ctx.fill();
            ctx.strokeStyle = dark(c, .4); ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(1, -7); ctx.quadraticCurveTo(4, -2, 2.6, 8); ctx.stroke();
          });
          locks(ctx, spec, c, [[9.6, -7.2, 11, 9.4, 1.3, .8], [7.2, -8.2, 7.6, -5.4, 1.1, 0]]);
        }
      }
    },
    ay: {
      outline: '#1e120c', skin: '#9c6240', skinShade: '#74442c', bulk: 2.8, headScale: .96,
      legs: { thigh: '#2e2e38', shin: '#2e2e38', foot: '#22222a', w1: 7.2, w2: 6 },
      arms: { upper: '#9c6240', lower: '#9c6240', w1: 7.4, w2: 6.8, cuff: '#e8b730' },
      torso: {
        base: '#9c6240', paint: ctx => {
          // Bare, heavily muscled chest under the open sleeveless haori.
          ctx.strokeStyle = 'rgba(60,28,16,.6)'; ctx.lineWidth = .6;
          ctx.beginPath(); ctx.moveTo(-3.4, -8.8); ctx.quadraticCurveTo(1, -6.4, 2.6, -8.4); ctx.quadraticCurveTo(5, -6.2, 8.6, -8.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(2.6, -12.6); ctx.lineTo(2.8, -3.4); ctx.stroke();
          for (const y of [-6, -4.4]) { ctx.beginPath(); ctx.moveTo(.2, y); ctx.lineTo(2.6, y + .3); ctx.moveTo(3, y + .3); ctx.lineTo(6, y); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,220,180,.22)'; ell(ctx, 5.6, -10.2, 2.6, 1.2, -.2); ctx.fill(); ell(ctx, .4, -10.4, 2.2, 1, .2); ctx.fill();
          ctx.fillStyle = '#f4f2ea';
          ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-2.4, -16); ctx.quadraticCurveTo(-4.6, -8, -4.2, 0); ctx.lineTo(-14, 0); ctx.fill();
          ctx.beginPath(); ctx.moveTo(8.4, -14); ctx.lineTo(14, -14); ctx.lineTo(14, 0); ctx.lineTo(9.2, 0); ctx.quadraticCurveTo(10.2, -7, 8.4, -14); ctx.fill();
          // Gold belt with a chain.
          ctx.fillStyle = '#e8b730'; ctx.fillRect(-12, -3.4, 26, 3.2);
          ctx.fillStyle = '#a87a10'; ctx.fillRect(-12, -1, 26, .8);
          ctx.fillStyle = '#fff2b0'; ctx.fillRect(-12, -3.3, 26, .6);
          ctx.strokeStyle = '#c89a20'; ctx.lineWidth = .45;
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-4 + i * 1.6, .6 + Math.sin(i * .6) * .6, .8, .5, 0, 0, TAU); ctx.stroke(); }
        }
      },
      skirt: { color: '#f4f2ea', hem: 7.6, flare: 1.6, paint: (ctx, hem) => { ctx.fillStyle = '#e8b730'; ctx.fillRect(-20, hem - 1.2, 40, 1.2); } },
      shoulder(ctx) {
        paint(ctx, () => smooth(ctx, [[-8.4, -12.8], [-3, -14.4], [.8, -12.4], [-.6, -9], [-7.4, -8.6], [-9.2, -10.6]]), '#f4f2ea', '#1e120c', .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-10, -10.4, 12, 3);
          ctx.fillStyle = '#e8b730'; ctx.fillRect(-10, -9.4, 12, .8);
        });
      },
      head: {
        hair(ctx, spec) {
          // White hair slicked straight back.
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(9.8, -5.4); ctx.quadraticCurveTo(9.4, -14, 1, -15);
            ctx.quadraticCurveTo(-6, -15, -15.4, -12.2); ctx.lineTo(-10.4, -9.4);
            ctx.lineTo(-16.4, -5.6); ctx.lineTo(-10.8, -3.6); ctx.lineTo(-14.4, 1.2); ctx.lineTo(-10.4, 1.8);
            ctx.lineTo(-5, 3.6); ctx.lineTo(-4, -2); ctx.quadraticCurveTo(2, -7.4, 9.8, -5.4); ctx.closePath();
          }, '#f2f0ea', spec.outline, 1.05, () => {
            ctx.fillStyle = '#c4c2cc'; ctx.fillRect(-18, -6, 15, 12);
            ctx.fillStyle = '#d8d6de'; ctx.beginPath(); ctx.moveTo(-17, -11); ctx.quadraticCurveTo(-4, -12, 4, -9); ctx.lineTo(4, -6); ctx.quadraticCurveTo(-4, -9, -17, -7); ctx.fill();
            ctx.strokeStyle = '#9ea0ae'; ctx.lineWidth = .5;
            for (const [y0, x1, y1] of [[-12.6, -15, -12], [-10.4, -16, -5.8], [-8, -14, .8]]) { ctx.beginPath(); ctx.moveTo(8, y0 + 4); ctx.quadraticCurveTo(-2, y0, x1, y1); ctx.stroke(); }
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6.6, -12.6); ctx.quadraticCurveTo(0, -14.6, -7, -13.2); ctx.lineTo(-6, -12.4); ctx.quadraticCurveTo(0, -13.4, 6, -11.6); ctx.fill();
          });
        },
        eyes: { type: 'normal', iris: '#3a2a1e' }, brows: 'thick', browColor: '#f0eee8', browAngle: 'angry', mouth: 'frown', attackMouth: 'shout', blush: false,
        marks(ctx, spec) {
          // Moustache and chin beard.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(3.6, 7.2); ctx.quadraticCurveTo(6.6, 5.2, 10, 6.4); ctx.lineTo(9.6, 7.4); ctx.quadraticCurveTo(6.6, 6.6, 3.8, 8.2); ctx.closePath(); }, '#f2f0ea', spec.outline, .6);
          paint(ctx, () => poly(ctx, [[4.6, 9.6], [8.2, 9.2], [6.8, 12.4]]), '#f2f0ea', spec.outline, .6);
        }
      }
    },
    onoki: {
      outline: '#2a1e14', skin: '#f0c8a6', hunch: .24,
      legs: { thigh: '#5f6f38', shin: '#5f6f38', foot: '#3a3226', w1: 4.8, w2: 4 },
      arms: { upper: '#71863f', lower: '#71863f', cuff: '#e0c040', w1: 4.6, w2: 4.4 },
      torso: {
        base: '#71863f', paint: ctx => {
          ctx.fillStyle = '#e0c040'; ctx.beginPath(); ctx.moveTo(1, -13.4); ctx.lineTo(3.2, -13.4); ctx.lineTo(5.6, 0); ctx.lineTo(3.4, 0); ctx.fill();
          ctx.fillStyle = '#8a3a24'; ctx.fillRect(-8, -3, 17, 2.4);
        }
      },
      skirt: { color: '#71863f', hem: 4.6, flare: 1, paint: (ctx, hem) => { ctx.fillStyle = '#e0c040'; ctx.fillRect(-20, hem - 1.4, 40, 1.4); } },
      collar(ctx) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.6, -11.4); ctx.lineTo(-7, -15.4); ctx.quadraticCurveTo(-1.4, -14.4, 3.6, -13.8); ctx.lineTo(7.6, -14.4); ctx.lineTo(7.2, -11.4); ctx.closePath(); }, '#e0c040', '#2a1e14', .9, () => {
          ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 5, 6);
        });
      },
      head: {
        hair(ctx, spec) {
          // Bald crown, white tufts at the sides and a small topknot.
          paint(ctx, () => smooth(ctx, [[-4, -3], [-9.8, -5], [-11.4, 1], [-10, 6.6], [-5.4, 6], [-4.6, 1]]), '#f2f0ea', spec.outline, .9, () => {
            ctx.fillStyle = '#c8c6cc'; ctx.fillRect(-13, 2, 10, 6);
          });
          paint(ctx, () => smooth(ctx, [[-3, -9.8], [-5.4, -13.6], [-1.8, -15.6], [1.4, -13.4], [.6, -10]]), '#f2f0ea', spec.outline, .85, () => {
            ctx.fillStyle = '#c8c6cc'; ctx.fillRect(-7, -12, 10, 3);
          });
          paint(ctx, () => ell(ctx, -1.2, -10.4, 1.6, .8), '#8a3a24', spec.outline, .6);
        },
        eyes: { type: 'sleepy', iris: '#3a2c22', lid: '#f0c8a6' }, brows: 'thick', browColor: '#f2f0ea', blush: false,
        mask(ctx, spec) {
          // White moustache and beard.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(1.6, 6.6); ctx.quadraticCurveTo(6.6, 4.6, 10.6, 6.4); ctx.quadraticCurveTo(10.4, 11.6, 6.4, 13.6); ctx.quadraticCurveTo(2.4, 11.6, 1.6, 6.6); ctx.closePath(); }, '#f2f0ea', spec.outline, .8, () => {
            ctx.fillStyle = '#c8c6cc'; ctx.fillRect(0, 9, 5, 6);
            ctx.strokeStyle = '#b0aeb8'; ctx.lineWidth = .35; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 2, 7.4); ctx.lineTo(5 + i * 1.2, 12); ctx.stroke(); }
          });
          // Big red nose and wrinkles.
          paint(ctx, () => ell(ctx, 9.6, 4.2, 2.1, 1.7), '#e05a4a', spec.outline, .7, () => { ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, 9.2, 3.5, .7, .4); ctx.fill(); });
          line(ctx, [[-1.6, -1.2], [1, -2]], 'rgba(120,70,50,.6)', .4); line(ctx, [[-.4, 4.8], [.6, 6]], 'rgba(120,70,50,.6)', .4);
        }
      }
    },

    // ------------------------------------------------------------ Fourth Great Ninja War
    madara: madaraSpec(false),
    madara_rikudo: madaraSpec(true),
    nagato: nagatoSpec(),
    tsunade: tsunadeSpec(),
    killer_bee: killerBeeSpec(),
    zetsu_white: zetsuSpec(),
    konoha_ninja: gruntSpec('konoha_ninja'),
    shinobi_ally: gruntSpec('shinobi_ally'), shinobi_ally_suna: gruntSpec('shinobi_ally_suna'), shinobi_ally_kumo: gruntSpec('shinobi_ally_kumo'),
    shinobi_ally_kiri: gruntSpec('shinobi_ally_kiri'), shinobi_ally_iwa: gruntSpec('shinobi_ally_iwa'),
    // Summoned ally (B): Sasuke, Indra's reincarnation.
    sasuke_indra: sasukeIndraSpec(),
    // Sannin (sannin-bosses.js)
    jiraiya: jiraiyaSpec(), orochimaru: orochimaruSpec(), kabuto: kabutoSpec(),
    // Legends (legend-bosses.js)
    kazekage1: kazekage1Spec(), mu: muSpec(), obito_rikudo: obitoRikudoSpec(),
    kakashi: kakashiSpec()
  };
  SPECS.clone = SPECS.naruto;

  // Per-character sprite box (units) and world scale.
  const META = {
    naruto: { scale: 1.12 }, naruto_baryon: { scale: 1.16 }, clone: { scale: 1.12 },
    naruto_rinnegan: { scale: 1.12 }, naruto_baryon_rinnegan: { scale: 1.16 }, naruto_rikudo: { scale: 1.14 },
    walker: { scale: 1.02 }, runner: { scale: 1 }, brute: { scale: 1.32 }, spitter: { scale: 1.02 },
    suna_ninja: { scale: 1.02 }, kiri_ninja: { scale: 1.02 }, kumo_ninja: { scale: 1.02 }, iwa_ninja: { scale: 1.02 },
    ame_ninja: { scale: 1.02 }, oto_ninja: { scale: 1.02 }, taki_ninja: { scale: 1.02 }, kusa_ninja: { scale: 1.02 }, yu_ninja: { scale: 1.06 },
    gaara: { scale: 1.14 }, mei: { scale: 1.14, box: [-38, -82, 36, 8] }, ay: { scale: 1.48, box: [-40, -84, 42, 8] }, onoki: { scale: .84 },
    pain: { scale: 1.5 }, itachi: { scale: 1.5 }, kisame: { scale: 1.6, box: [-40, -84, 34, 8] }, deidara: { scale: 1.5 },
    sasori: { scale: 1.45 }, kakuzu: { scale: 1.6 }, konan: { scale: 1.48 }, hidan: { scale: 1.52, box: [-36, -88, 40, 10] },
    momoshiki: { scale: 1.6 }, kinshiki: { scale: 1.9, box: [-36, -80, 48, 8] }, isshiki: { scale: 1.75 }, kaguya: { scale: 1.75, box: [-36, -80, 36, 8] },
    hashirama: { scale: 1.14, box: [-36, -80, 36, 8] }, tobirama: { scale: 1.14 }, hiruzen: { scale: 1.12, box: [-38, -86, 38, 8] }, minato: { scale: 1.14 },
    guy: { scale: 1.18 },
    madara: { scale: 1.55, box: [-42, -88, 46, 8] }, madara_rikudo: { scale: 1.6, box: [-42, -88, 46, 8] },
    nagato: { scale: 1.52, box: [-40, -88, 40, 8] },
    tsunade: { scale: 1.18, box: [-38, -82, 36, 8] }, zetsu_white: { scale: 1 },
    killer_bee: { scale: 1.42, box: [-44, -86, 42, 8] },
    konoha_ninja: { scale: 1.05 }, shinobi_ally: { scale: 1.05 }, shinobi_ally_suna: { scale: 1.05 }, shinobi_ally_kumo: { scale: 1.05 },
    shinobi_ally_kiri: { scale: 1.05 }, shinobi_ally_iwa: { scale: 1.05 },
    sasuke_indra: { scale: 1.24, box: [-40, -88, 46, 8] },
    jiraiya: { scale: 1.34, box: [-44, -94, 40, 8] }, orochimaru: { scale: 1.24, box: [-40, -86, 46, 8] }, kabuto: { scale: 1.22, box: [-50, -92, 40, 8] },
    kazekage1: { scale: 1.22, box: [-40, -90, 40, 8] }, mu: { scale: 1.3, box: [-40, -100, 40, 8] }, obito_rikudo: { scale: 1.45, box: [-40, -92, 44, 8] },
    kakashi: { scale: 1.18, box: [-38, -84, 38, 8] }
  };

  // ---------------------------------------------------------------- cache
  // Post-pass helpers: a heavier outer contour (anime line weight) and a top-left rim light.
  let scratchA = null;
  // The scratch surface only ever grows; passes work in its top-left w×h corner.
  function scratch(w, h) {
    if (!scratchA) scratchA = document.createElement('canvas');
    const c = scratchA;
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    const g = c.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
    return c;
  }
  function contour(c, color) {
    const W = c.width, H = c.height, a = scratch(W, H);
    const g = a.getContext('2d');
    const d = .55 * S;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d * .7, d * .7], [-d * .7, -d * .7], [d * .7, -d * .7], [-d * .7, d * .7]]) g.drawImage(c, ox, oy);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(c, 0, 0);
    g.restore();
    const cg = c.getContext('2d');
    cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'copy'; cg.drawImage(a, 0, 0, W, H, 0, 0, W, H); cg.restore();
  }
  function rim(c, color) {
    // Pixels 1.1–2.4 units inside the silhouette's top-left edge get a light wash.
    const W = c.width, H = c.height, a = scratch(W, H);
    const g = a.getContext('2d'), u = S;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.drawImage(c, 1.1 * u, 1.1 * u);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'destination-out'; g.drawImage(c, 2.4 * u, 2.4 * u);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.restore();
    const cg = c.getContext('2d');
    cg.globalCompositeOperation = 'source-atop'; cg.drawImage(a, 0, 0, W, H, 0, 0, W, H); cg.globalCompositeOperation = 'source-over';
  }
  const RIM = 'rgba(255,246,220,.42)';

  const cache = new Map();
  // Both facings of a pose are built together: render + contour once, mirror the bitmap,
  // then bake the screen-space rim light into each copy so the light stays top-left.
  // Each pose is painted on a fresh CPU-backed surface (reusing one is much slower: the copy
  // taken from it turns every later clear into a copy-on-write), read back once to trim the
  // empty margin — the cached bitmaps hold only the character, about half the memory of the
  // full sprite box — then contoured, mirrored and rim-lit on the small trimmed bitmaps.
  function alphaBounds(g, W, H) {
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      let row = y * W * 4 + 3, any = false;
      for (let x = 0; x < W; x++, row += 4) if (d[row] > 2) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      if (any) { if (y < y0) y0 = y; y1 = y; }
    }
    if (x1 < 0) return [0, 0, 1, 1];
    x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3);
    return [x0, y0, Math.min(W, x1 + 4) - x0, Math.min(H, y1 + 4) - y0];
  }
  function sprite(id, frame, flip) {
    const key = id + '|' + frame;
    let entry = cache.get(flip ? key + '|m' : key);
    if (entry) return entry;
    const box = (META[id] && META[id].box) || [-36, -82, 36, 8];
    const w = box[2] - box[0], h = box[3] - box[1];
    const W = Math.ceil(w * S), H = Math.ceil(h * S);
    const r = document.createElement('canvas'); r.width = W; r.height = H;
    const g = r.getContext('2d', { willReadFrequently: true });
    g.save(); g.scale(S, S); g.translate(-box[0], -box[1]);
    try { renderCharacter(g, SPECS[id], poseOf(SPECS[id], frame)); } catch (err) { console.warn('sprite', id, frame, err); }
    g.restore();
    let bx = 0, by = 0, bw = W, bh = H;
    try { [bx, by, bw, bh] = alphaBounds(g, W, H); } catch (err) { /* keep the full box */ }
    const c = document.createElement('canvas'); c.width = bw; c.height = bh;
    c.getContext('2d').drawImage(r, bx, by, bw, bh, 0, 0, bw, bh);
    r.width = r.height = 0;   // free the full-size surface now rather than at the next GC
    try { contour(c, SPECS[id].outline || '#1a1612'); } catch (err) { /* keep the plain render */ }
    const m = document.createElement('canvas'); m.width = bw; m.height = bh;
    const mg = m.getContext('2d'); mg.translate(bw, 0); mg.scale(-1, 1); mg.drawImage(c, 0, 0);
    try { rim(c, RIM); rim(m, RIM); } catch (err) { /* rim is cosmetic */ }
    const ax = -box[0] - bx / S, ay = -box[1] - by / S, cw = bw / S, ch = bh / S;
    const a = { canvas: c, ax, ay, w: cw, h: ch, top: ay };
    const b = { canvas: m, ax: cw - ax, ay, w: cw, h: ch, top: ay };
    cache.set(key, a); cache.set(key + '|m', b);
    return flip ? b : a;
  }
  // Frame lookup. Custom `spec.poses` win; their idle also seeds the breathing frame, and
  // their legacy 4-frame run names (run0–run3) are spread over the 8-frame cycle.
  function poseOf(spec, frame) {
    const P = spec.poses;
    if (P && P[frame]) return P[frame];
    if (P && frame === 'idle1' && P.idle) return P.idle1 || (P.idle1 = Object.assign({}, P.idle, { breath: 1 }));
    if (P && /^run\d$/.test(frame) && P.run0 && !P.run4) { const k = P['run' + (+frame.slice(3) >> 1)]; if (k) return k; }
    return POSES[frame] || POSES.idle;
  }
  function frameName(state, opts) {
    if (state === 'idle') {
      // Breathing loop: opts.phase (enemy timers) or wall time, de-synced by position.
      const t = opts && opts.phase !== undefined ? opts.phase * .25 : performance.now() / 900 + ((opts && opts.seed) || 0);
      return (((Math.floor(t) % 2) + 2) % 2) ? 'idle1' : 'idle';
    }
    if (state === 'attack' || state === 'seal' || state === 'raise') return state;
    if (typeof state === 'string' && FRAMES.includes(state)) return state;   // exact frame names
    return 'idle';
  }
  // Same speed as the old 4-frame cycle: one phase unit = a quarter of the stride.
  function runFrame(phase) { return 'run' + (((Math.floor(phase * RUN_N / 4) % RUN_N) + RUN_N) % RUN_N); }

  // opts: { facing: 1|-1, frame: 'idle'|'attack'|'seal'|'raise'|'run'|exact frame name, phase, scale, alpha, flash }
  function draw(ctx, id, x, y, opts = {}) {
    if (!SPECS[id]) return 0;
    const frame = opts.frame === 'run' ? runFrame(opts.phase || 0) : frameName(opts.frame || 'idle', opts.seed === undefined && opts.phase === undefined ? { seed: x * .013 } : opts);
    const e = sprite(id, frame, (opts.facing || 1) < 0);
    const k = (opts.scale || 1) * ((META[id] && META[id].scale) || 1);
    const dx = x - e.ax * k, dy = y - e.ay * k + (opts.yOffset || 0);
    const alpha = opts.alpha === undefined ? 1 : opts.alpha;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(e.canvas, dx, dy, e.w * k, e.h * k);
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * Math.min(1, opts.flash);
      ctx.drawImage(e.canvas, dx, dy, e.w * k, e.h * k);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (alpha < 1 || opts.flash > 0) ctx.globalAlpha = 1;
    return k;
  }

  // Fallen ninja: the idle sprite laid on the ground and fading.
  function drawFallen(ctx, id, x, y, opts = {}) {
    if (!SPECS[id]) return;
    const e = sprite(id, 'idle', (opts.facing || 1) < 0);
    const k = (opts.scale || 1) * ((META[id] && META[id].scale) || 1);
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.rotate((opts.facing || 1) < 0 ? 1.45 : -1.45);
    ctx.scale(1, .82);
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
    ctx.drawImage(e.canvas, -e.ax * k, -e.ay * k * .55, e.w * k, e.h * k);
    ctx.restore();
  }

  // A pre-painted ellipse stamped with drawImage: hundreds of fighters in the war each need one,
  // and an image draw is far cheaper for the GPU than tessellating an ellipse path per character.
  let shadowImg = null;
  function shadow(ctx, x, y, r, alpha = .3) {
    if (!shadowImg) {
      shadowImg = document.createElement('canvas'); shadowImg.width = 64; shadowImg.height = 24;
      const g = shadowImg.getContext('2d');
      g.fillStyle = 'rgb(20,24,12)'; g.beginPath(); g.ellipse(32, 12, 31, 11.2, 0, 0, TAU); g.fill();
    }
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.drawImage(shadowImg, x - r, y + 1 - r * .36, r * 2, r * .72);
    ctx.globalAlpha = a;
  }

  function height(id, scale = 1) {
    const k = scale * ((META[id] && META[id].scale) || 1);
    return 62 * k;
  }

  // Bakes every pose the game shows constantly (idle, the 8 run frames, attack, seal). The rarer
  // breathing frame and the overhead raise are baked lazily on first use (~2 ms each).
  const WARM_FRAMES = FRAMES.filter(f => f !== 'idle1' && f !== 'raise');
  function prewarm(ids) {
    for (const id of ids) for (const f of WARM_FRAMES) sprite(id, f, false);
  }

  // ---------------------------------------------------------------- portraits
  function drawPortrait(ctx, id, size, opts = {}) {
    const spec = SPECS[id]; if (!spec) return;
    const k = size / 30;
    ctx.save();
    ctx.translate(size * .5 - 1.4 * k, size * .62);
    ctx.scale(k, k);
    // Bust: shoulders + head, framed by the canvas.
    ctx.save(); ctx.translate(-HEAD[0], -HEAD[1]);
    if (spec.head.drape) { ctx.save(); ctx.translate(HEAD[0], HEAD[1]); spec.head.drape(ctx, spec, POSES.idle); ctx.restore(); }
    if (spec.collarBack) spec.collarBack(ctx, POSES.idle);
    // Upper arms hang from both shoulders so the bust is not a floating block.
    const a = spec.arms;
    limb(ctx, SH_F, [SH_F[0] + 1.6, SH_F[1] + 6.6], [SH_F[0] + 2.4, SH_F[1] + 12], a.w1 || 4.4, a.w2 || 3.8, dark(a.upper, .2), dark(a.lower, .2), spec.outline);
    paint(ctx, () => poly(ctx, [[-.8, -12], [3.2, -12], [3, -16.8], [-.4, -16.8]]), spec.skinShade || mix(spec.skin, '#b0607a', .3), spec.outline, .9);
    paint(ctx, () => torsoPath(ctx, spec.bulk || 0), spec.torso.base, spec.outline, 1.15, () => {
      if (spec.torso.paint) spec.torso.paint(ctx, POSES.idle);
      torsoShade(ctx, spec.bulk || 0);
    });
    if (spec.torso.over) spec.torso.over(ctx, POSES.idle);
    limb(ctx, SH_N, [SH_N[0] - .8, SH_N[1] + 6.6], [SH_N[0] - .4, SH_N[1] + 12], a.w1 || 4.4, a.w2 || 3.8, a.upper, a.lower, spec.outline);
    if (a.cap) { const q = lerp(SH_N, [SH_N[0] - .8, SH_N[1] + 6.6], .45); seg(ctx, SH_N, q, (a.w1 || 4.4) + 2.2, spec.outline); seg(ctx, SH_N, q, a.w1 || 4.4, a.cap); }
    if (spec.shoulder) spec.shoulder(ctx, POSES.idle);
    ctx.restore();
    drawHead(ctx, spec, POSES.idle);
    if (spec.collar) { ctx.save(); ctx.translate(-HEAD[0], -HEAD[1]); spec.collar(ctx, POSES.idle); ctx.restore(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- close-up cut-in
  // drawCloseUp(ctx, id, w, h, opts): the anime "eyes before the jutsu" cut — a letterbox panel
  // with the character's upper face drawn frontally with vector paths at the target size.
  // Face space: unit U, eye line at y = 0, eyes centred at x = ±1.12, the face ±2.3 wide.
  // opts: { eye: 'sharingan'|'mangekyo'|'rinnegan'|'rinneSharingan'|'byakugan'|'kurama'|'sage'|'baryon'|'normal'…,
  //         intensity: 0..1 (glow + speed lines, default 1), background: false (transparent panel) }
  const CU = {
    naruto: { hair: '#ffd43b', fringe: 'naruto', accent: '#ff7a1a', marks: ['whiskers'] },
    naruto_baryon: { hair: '#ffb434', fringe: 'naruto', accent: '#ff3418', marks: ['whiskersBold', 'baryon'] },
    naruto_rinnegan: { hair: '#ffd43b', fringe: 'naruto', accent: '#8a6ad8', marks: ['whiskers'] },
    naruto_baryon_rinnegan: { hair: '#ffb434', fringe: 'naruto', accent: '#c03aa0', marks: ['whiskersBold', 'baryon'] },
    naruto_rikudo: { hair: '#fff27e', fringe: 'naruto', accent: '#ffb020', marks: ['whiskers'] },
    pain: { hair: '#ff8530', fringe: 'spiky', accent: '#7a5ad0', marks: ['pain'] },
    itachi: { hair: '#15151c', fringe: 'part', accent: '#c01020', marks: ['tearTrough'], long: true },
    kisame: { hair: '#2f5694', fringe: 'spiky', accent: '#2a6ab0', marks: ['gills'] },
    deidara: { hair: '#f4d466', fringe: 'deidara', accent: '#e8a030', long: true },
    sasori: { hair: '#c2342c', fringe: 'spiky', accent: '#b03030' },
    kakuzu: { hair: '#33423a', fringe: 'hood', accent: '#3a9a58', mask: '#33423a' },
    konan: { hair: '#5868b6', fringe: 'part', accent: '#7a8ae8', marks: ['eyeshadow'] },
    hidan: { hair: '#d8dce4', fringe: 'slick', accent: '#b0306a' },
    momoshiki: { hair: '#f4f2f6', fringe: 'part', accent: '#8a70d8', long: true, horns: [[-.7, -1.45, -.95], [.7, -1.45, .95]] },
    kinshiki: { hair: '#f1eef0', fringe: 'slick', accent: '#d03048', long: true, horns: [[-.5, -1.5, -.9], [.5, -1.5, .9]] },
    isshiki: { hair: '#1e1d24', fringe: 'part', accent: '#c9963f', long: true, horns: [[.55, -1.55, .7]] },
    kaguya: { hair: '#f6f4f8', fringe: 'part', accent: '#9d74c0', marks: ['thirdEye'], long: true, horns: [[-1.3, -1.5, -1.1], [1.3, -1.5, 1.1]] },
    hashirama: { hair: '#3a2a22', fringe: 'part', accent: '#3a9a3a', long: true },
    tobirama: { hair: '#eef0f2', fringe: 'spiky', accent: '#3c76b6', marks: ['tobirama'] },
    hiruzen: { hair: '#d8d4cc', fringe: 'hat', accent: '#d0402b', marks: ['wrinkles'] },
    minato: { hair: '#ffdd4e', fringe: 'minato', accent: '#ffc83a' },
    guy: { hair: '#16161c', fringe: 'bowl', accent: '#2f9a3e' },
    gaara: { hair: '#b8262c', fringe: 'spiky', accent: '#d8b070', marks: ['ai'] },
    mei: { hair: '#b24f2a', fringe: 'mei', accent: '#4a6ad0', long: true },
    ay: { hair: '#f2f0ea', fringe: 'slick', accent: '#ffe45a' },
    onoki: { hair: '#f2f0ea', fringe: 'bald', accent: '#9ab040', marks: ['nose'] },
    madara: { hair: '#17151d', fringe: 'madara', accent: '#a82028', marks: ['edo'], long: true },
    madara_rikudo: { hair: '#eceaf0', fringe: 'madaraParted', accent: '#d03040', marks: ['thirdEye'], long: true },
    nagato: { hair: '#c41f2d', fringe: 'part', accent: '#9a7ae0', marks: ['edo'], long: true },
    tsunade: { hair: '#f3d36a', fringe: 'part', accent: '#6fac58', marks: ['byakugo'], long: true },
    killer_bee: { hair: '#f0e4b2', fringe: 'spiky', accent: '#ffd23a' },
    zetsu_white: { hair: '#e2e3d6', fringe: 'bald', accent: '#9aa080' },
    sasuke_indra: { hair: '#17161e', fringe: 'madara', accent: '#9a62f0' },
    jiraiya: { hair: '#efebe4', fringe: 'minato', accent: '#d8402e', marks: ['sage'], long: true },
    orochimaru: { hair: '#131118', fringe: 'part', accent: '#9a5ad8', marks: ['eyeshadow'], long: true },
    kabuto: { hair: '#c7cad3', fringe: 'spiky', accent: '#7fe0b8', marks: ['eyeshadow'], horns: [[-.7, -1.45, -.95], [.7, -1.45, .95]] },
    kazekage1: { hair: '#2b2420', fringe: 'hat', accent: '#2f8f7a', marks: ['edo'] },
    mu: { hair: '#e4dac2', fringe: 'bald', accent: '#c8956a', mask: '#e4dac2', marks: ['edo'] },
    obito_rikudo: { hair: '#f1eff3', fringe: 'spiky', accent: '#b9a8ff', horns: [[-.7, -1.45, -.95], [.7, -1.45, .95]] },
    kakashi: { hair: '#d4d9e1', fringe: 'spiky', accent: '#7fb8ff', mask: '#272e40' }
  };
  CU.clone = CU.naruto;
  const GLOW = { sharingan: '255,40,40', mangekyo: '255,30,40', rinneSharingan: '255,40,60', rinnegan: '170,130,255', edoRinnegan: '170,130,255',
    byakugan: '220,215,255', kurama: '255,120,30', baryon: '255,110,30', sage: '255,200,60', kakuzu: '90,220,120' };

  function cuConf(id, spec) {
    if (CU[id]) return CU[id];
    const g = spec.closeUp || {};
    return { hair: g.hair || '#2a2b38', fringe: g.fringe || 'spiky', accent: g.accent || '#5a7ab0', mask: g.mask, marks: g.marks };
  }

  // A tapered hair lock (root half-width w) with cel shadow, inner strand, root occlusion, gloss.
  function cuLock(ctx, c, O, x0, y0, x1, y1, w, bend = 0) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
    const build = () => {
      ctx.beginPath(); ctx.moveTo(x0 - nx * w, y0 - ny * w);
      ctx.quadraticCurveTo(mx - nx * w * .75, my - ny * w * .75, x1, y1);
      ctx.quadraticCurveTo(mx + nx * w * .85, my + ny * w * .85, x0 + nx * w, y0 + ny * w); ctx.closePath();
    };
    build(); ctx.fillStyle = c; ctx.fill();
    ctx.save(); ctx.clip();
    // Shadow on the side facing away from the top-left light.
    const sx = nx * LX + ny * LY < 0 ? 1 : -1;
    ctx.fillStyle = dark(c, .3);
    ctx.beginPath(); ctx.moveTo(x0 + sx * nx * w * 1.2, y0 + sx * ny * w * 1.2); ctx.quadraticCurveTo(mx + sx * nx * w * .1, my + sx * ny * w * .1, x1, y1);
    ctx.lineTo(x1 + sx * nx * 2, y1 + sx * ny * 2); ctx.lineTo(x0 + sx * nx * 3, y0 + sx * ny * 3); ctx.fill();
    ctx.fillStyle = rgba(dark(c, .5), .75); ell(ctx, x0, y0, w * 1.6, w * 1.1); ctx.fill();
    ctx.strokeStyle = rgba(dark(c, .48), .9); ctx.lineWidth = .028;
    ctx.beginPath(); ctx.moveTo(x0 - sx * nx * w * .2, y0 - sx * ny * w * .2); ctx.quadraticCurveTo(mx - sx * nx * w * .15, my - sx * ny * w * .15, x1 - dx * .1, y1 - dy * .1); ctx.stroke();
    // Gloss streak a third of the way down, broken into teeth.
    ctx.fillStyle = hairGloss(c);
    const g0 = .22, g1 = .36;
    for (let k = 0; k < 3; k++) {
      const t0 = g0 + k * .015, t1 = g1 - (k % 2) * .05;
      const a = [x0 + dx * t0, y0 + dy * t0], b = [x0 + dx * t1, y0 + dy * t1], o = (k - 1) * w * .55;
      ctx.beginPath(); ctx.moveTo(a[0] + nx * (o - w * .16), a[1] + ny * (o - w * .16)); ctx.lineTo(a[0] + nx * (o + w * .16), a[1] + ny * (o + w * .16));
      ctx.lineTo(b[0] + nx * o, b[1] + ny * o); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    build(); ctx.strokeStyle = O; ctx.lineWidth = .045; ctx.lineJoin = 'round'; ctx.stroke();
  }

  // Fringe layouts: [rootX, rootY, tipX, tipY, halfWidth, bend].
  function cuFringe(style, band) {
    const top = -1.75, low = band ? -1.02 : -.78;
    switch (style) {
      case 'naruto': return [
        [-2.05, top, -2.5, .5, .36, -.16], [2.05, top, 2.5, .5, .36, .16],
        [-1.55, top, -1.9, -.62, .3, -.08], [1.55, top, 1.9, -.62, .3, .08],
        [-1.0, top, -1.25, -1.0, .26, -.05], [1.0, top, 1.25, -1.0, .26, .05],
        [-.35, top, -.42, -1.1, .22, 0], [.4, top, .5, -1.08, .22, 0]];
      case 'minato': return [
        [-1.95, top, -2.25, .72, .42, -.2], [1.95, top, 2.25, .72, .42, .2],
        [-1.35, top, -1.55, -.42, .3, -.06], [1.35, top, 1.55, -.42, .3, .06],
        [-.5, top, -.62, -1.06, .24, 0], [.55, top, .66, -1.04, .24, 0]];
      case 'spiky': return [
        [-2.0, top, -2.35, -.1, .32, -.1], [2.0, top, 2.35, -.1, .32, .1],
        [-1.35, top, -1.55, low + .05, .3, -.05], [-.55, top, -.62, low - .08, .28, 0],
        [.25, top, .3, low, .28, 0], [1.05, top, 1.2, low - .06, .3, .04], [1.7, top, 1.95, low + .12, .3, .08]];
      case 'part': return [
        [-1.45, top, -2.3, .78, .5, .22], [1.45, top, 2.3, .78, .5, -.22],
        [-.95, top, -1.85, .1, .36, .2], [.95, top, 1.85, .1, .36, -.2],
        [-.4, top, -1.05, -.86, .3, .12], [.4, top, 1.05, -.86, .3, -.12]];
      case 'madara': return [
        [-.3, top, -1.45, .7, .6, -.3], [-1.6, top, -2.4, .6, .45, -.15], [1.8, top, 2.4, .65, .42, .2],
        [.6, top, .75, -.86, .3, .05], [1.25, top, 1.5, -.6, .3, .1], [-1.1, top, -1.25, -.7, .3, 0]];
      case 'madaraParted': return [
        [-.5, top, -1.55, .72, .5, .2], [.9, top, 2.1, .72, .45, -.22],
        [-1.7, top, -2.45, .55, .42, -.15], [1.7, top, 2.45, .55, .42, .15]];
      case 'deidara': return [
        [.3, top, 1.85, .62, .78, .36], [-1.0, top, -2.1, .78, .42, -.3], [-.5, top, -.75, -1.08, .26, 0]];
      case 'mei': return [
        [-.4, top, -1.75, .66, .78, -.34], [1.1, top, 2.2, .8, .42, .3], [.4, top, .55, -1.02, .26, 0]];
      default: return [];
    }
  }

  function cuHeadband(ctx, band, O) {
    const cloth = band.cloth || '#1e2230', plate = band.plate || '#c9d1da';
    const y0 = -1.34, y1 = -.86, pw = band.wide ? 1.35 : 1.0;
    // Cloth band, curving slightly with the forehead.
    paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.7, y0 + .08); ctx.quadraticCurveTo(0, y0 - .08, 2.7, y0 + .08); ctx.lineTo(2.7, y1 + .1); ctx.quadraticCurveTo(0, y1 - .06, -2.7, y1 + .1); ctx.closePath(); }, cloth, O, .05, () => {
      ctx.fillStyle = rgba(light(cloth, .35), .5); ctx.fillRect(-3, y0 - .1, 6, .07);
      ctx.fillStyle = SHADE; ctx.fillRect(-3, y1 - .14, 6, .3);
      ctx.fillStyle = DEEP2; ctx.fillRect(1.8, y0 - .2, 1.2, .8);
      ctx.strokeStyle = rgba(dark(cloth, .5), .7); ctx.lineWidth = .015;
      for (let x = -2.6; x < 2.7; x += .09) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + .03, y1 + .1); ctx.stroke(); }
    });
    // Steel plate: rounded rectangle, brushed gradient, bevel, rivets, engraved emblem.
    const r = .1, px0 = -pw, px1 = pw, py0 = y0 - .05, py1 = y1 + .05;
    const plateP = () => { ctx.beginPath(); ctx.moveTo(px0 + r, py0); ctx.lineTo(px1 - r, py0); ctx.quadraticCurveTo(px1, py0, px1, py0 + r); ctx.lineTo(px1, py1 - r); ctx.quadraticCurveTo(px1, py1, px1 - r, py1); ctx.lineTo(px0 + r, py1); ctx.quadraticCurveTo(px0, py1, px0, py1 - r); ctx.lineTo(px0, py0 + r); ctx.quadraticCurveTo(px0, py0, px0 + r, py0); ctx.closePath(); };
    paint(ctx, plateP, plate, O, .05, () => {
      const g = ctx.createLinearGradient(0, py0, 0, py1);
      g.addColorStop(0, light(plate, .6)); g.addColorStop(.35, plate); g.addColorStop(.7, dark(plate, .12)); g.addColorStop(1, dark(plate, .34));
      ctx.fillStyle = g; ctx.fillRect(px0, py0, pw * 2, py1 - py0);
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillRect(px0, py0, pw * 2, .045);
      ctx.fillStyle = rgba(dark(plate, .55), .6); ctx.fillRect(px0, py1 - .05, pw * 2, .05);
      ctx.fillStyle = 'rgba(30,30,50,.18)'; ctx.fillRect(px1 - .25, py0, .25, py1 - py0);
      // Two diagonal glints.
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.moveTo(-pw * .35, py0); ctx.lineTo(-pw * .2, py0); ctx.lineTo(-pw * .42, py1); ctx.lineTo(-pw * .57, py1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.moveTo(-pw * .12, py0); ctx.lineTo(-pw * .06, py0); ctx.lineTo(-pw * .28, py1); ctx.lineTo(-pw * .34, py1); ctx.fill();
    });
    ctx.strokeStyle = rgba(dark(plate, .4), .6); ctx.lineWidth = .02;
    ctx.strokeRect(px0 + .08, py0 + .08, pw * 2 - .16, py1 - py0 - .16);
    for (const x of [px0 + .14, px1 - .14]) for (const y of [py0 + .14, py1 - .14]) {
      dot(ctx, x, y, .045, dark(plate, .5)); dot(ctx, x - .012, y - .012, .018, 'rgba(255,255,255,.9)');
    }
    const cy = (py0 + py1) / 2;
    if (band.symbol === 'nin') {
      ctx.font = 'bold .42px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('忍', .02, cy + .025);
      ctx.fillStyle = dark(plate, .7); ctx.fillText('忍', 0, cy);
    } else {
      const sym = band.symbol || 'leaf', k = .125;
      ctx.save(); ctx.translate(0, cy); ctx.scale(k, k); ctx.translate(0, 0);
      plateSymbol(ctx, sym, .14, .2, 1, 'rgba(255,255,255,.75)');
      plateSymbol(ctx, sym, 0, 0, 1, dark(plate, .7));
      ctx.restore();
    }
    if (band.slash) {
      line(ctx, [[px0 + .1, py1 - .1], [px1 - .1, py0 + .14]], 'rgba(255,255,255,.55)', .035);
      line(ctx, [[px0 + .1, py1 - .14], [px1 - .1, py0 + .1]], '#25252c', .05);
    }
  }

  function cuEye(ctx, s, e, type, O, skin, glow, fem) {
    // s = -1 screen-left eye, +1 screen-right eye.
    const I = [s * .48, .1], Oc = [s * 1.8, -.1];
    const shape = () => {
      ctx.beginPath(); ctx.moveTo(I[0], I[1]);
      ctx.bezierCurveTo(s * .62, -.34, s * 1.36, -.5, Oc[0], Oc[1]);
      ctx.bezierCurveTo(s * 1.66, .22, s * .92, .4, I[0], I[1]); ctx.closePath();
    };
    if (e.ring) {
      // Gaara: dark insomnia ring hugging the eye.
      ctx.save(); ctx.translate(s * 1.12, 0); ctx.scale(1.28, 1.5); ctx.translate(-s * 1.12, 0); shape(); ctx.restore();
      ctx.fillStyle = 'rgba(26,12,20,.9)'; ctx.fill();
    }
    const ix = s * 1.1, iy = .02, irx = type === 'small' ? .3 : .33, iry = .37;
    if (glow > 0 && GLOW[type]) {
      // Chakra glow bleeding onto the skin round the eye (drawn first so the iris stays crisp).
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(ix, iy, .2, ix, iy, 1.1);
      gg.addColorStop(0, `rgba(${GLOW[type]},${.45 * glow})`); gg.addColorStop(1, `rgba(${GLOW[type]},0)`);
      ctx.fillStyle = gg; ctx.fillRect(ix - 1.2, iy - 1.2, 2.4, 2.4); ctx.restore();
    }
    ctx.save(); shape(); ctx.fillStyle = SCLERA[type] || '#fbfaf6'; ctx.fill(); ctx.clip();
    if (!SCLERA[type]) { ctx.fillStyle = 'rgba(150,140,190,.25)'; ell(ctx, s * .55, .08, .25, .3); ctx.fill(); ell(ctx, s * 1.75, -.06, .25, .3); ctx.fill(); }
    if (type === 'small' || type === 'blank') {
      if (type === 'small') { dot(ctx, ix, iy, .1, '#111'); }
    } else paintIris(ctx, type, e, ix, iy, irx, iry, true);
    if (type === 'byakugan') {
      ctx.fillStyle = 'rgba(205,196,236,.45)'; ell(ctx, ix, iy, irx, iry); ctx.fill();
      ctx.strokeStyle = 'rgba(150,140,200,.75)'; ctx.lineWidth = .025; ell(ctx, ix, iy, irx, iry); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,170,215,.45)'; ctx.lineWidth = .02; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * .12, iy + Math.sin(a) * .12); ctx.lineTo(ix + Math.cos(a) * .3, iy + Math.sin(a) * .33); ctx.stroke(); } }
    // Upper-lid shadow: two cel steps.
    ctx.fillStyle = 'rgba(40,22,60,.28)'; ell(ctx, s * 1.12, -.5, 1.0, .3); ctx.fill();
    ctx.fillStyle = 'rgba(30,14,50,.22)'; ell(ctx, s * 1.12, -.58, 1.0, .22); ctx.fill();
    if (CATCH.has(type) || type === 'small') {
      dot(ctx, ix - s * .02 - .12, iy - .15, .085, '#ffffff');
      dot(ctx, ix + .13, iy + .16, .04, 'rgba(255,255,255,.9)');
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(ctx, ix + .02, iy + .2, .14, .04, -.2); ctx.fill();
    } else if (type !== 'blank') dot(ctx, ix - .12, iy - .16, .06, 'rgba(255,255,255,.7)');
    if (type === 'sleepy') {
      ctx.fillStyle = e.lid || skin; ctx.fillRect(-3, -1, 6, .82);
      ctx.fillStyle = 'rgba(120,60,70,.3)'; ctx.fillRect(-3, -.22, 6, .06);
    }
    ctx.restore();
    // Lash line: a heavy filled crescent thickening toward the outer corner, plus the flick.
    const lidY = type === 'sleepy' ? -.18 : 0;
    ctx.fillStyle = O;
    ctx.beginPath(); ctx.moveTo(I[0] - s * .04, I[1] + .02);
    ctx.bezierCurveTo(s * .62, -.36 + lidY, s * 1.36, -.52 + lidY, Oc[0] + s * .1, Oc[1] - .02);
    ctx.lineTo(Oc[0] + s * (fem ? .34 : .22), Oc[1] - (fem ? .2 : .1));
    ctx.lineTo(Oc[0] - s * .02, Oc[1] + .1);
    ctx.bezierCurveTo(s * 1.36, -.36 + lidY, s * .66, -.24 + lidY, I[0] + s * .04, I[1] + .04);
    ctx.closePath(); ctx.fill();
    if (fem) for (let i = 0; i < 3; i++) { const t = .6 + i * .15; ctx.beginPath(); ctx.moveTo(s * (.5 + t * 1.25), -.42 + t * .12); ctx.lineTo(s * (.62 + t * 1.3), -.6 + t * .12); ctx.lineWidth = .03; ctx.strokeStyle = O; ctx.stroke(); }
    // Double-lid crease and lower lash line.
    ctx.strokeStyle = rgba(O.length === 7 ? O : '#000000', .55); ctx.lineWidth = .028; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * .72, -.5 + lidY); ctx.quadraticCurveTo(s * 1.2, -.68 + lidY, s * 1.66, -.42); ctx.stroke();
    ctx.strokeStyle = O; ctx.lineWidth = .035;
    ctx.beginPath(); ctx.moveTo(Oc[0] - s * .05, Oc[1] + .08); ctx.bezierCurveTo(s * 1.6, .24, s * 1.15, .36, s * .85, .34); ctx.stroke();
    ctx.strokeStyle = rgba(O.length === 7 ? O : '#000000', .35); ctx.lineWidth = .022;
    ctx.beginPath(); ctx.moveTo(s * .85, .34); ctx.quadraticCurveTo(s * .65, .3, I[0], I[1] + .02); ctx.stroke();
  }

  function cuBrow(ctx, s, w, color, ang) {
    // Inner end (near the nose) is the thick end; `ang` > 0 = angry (inner end pulled down).
    const x0 = s * .42, y0 = -.6 + ang * .1, x1 = s * 1.9, y1 = -.68 - ang * .1;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x0, y0 - w * .5);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - w * .9 - .06, x1, y1);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) + w * .1, x0, y0 + w * .5);
    ctx.closePath(); ctx.fill();
  }

  function cuMarks(ctx, list, O, skin, shade) {
    for (const m of list || []) {
      if (m === 'whiskers' || m === 'whiskersBold') {
        const wdt = m === 'whiskersBold' ? .07 : .045;
        ctx.fillStyle = m === 'whiskersBold' ? '#3a0608' : '#5a2e18';
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          const y = .5 + i * .14, x0 = s * 1.32, x1 = s * 2.2;
          ctx.beginPath(); ctx.moveTo(x0, y - .02 + i * .01); ctx.quadraticCurveTo((x0 + x1) / 2, y - wdt - .02, x1, y + (i - 1) * .05);
          ctx.quadraticCurveTo((x0 + x1) / 2, y + wdt - .02, x0, y - .02 + i * .01); ctx.fill();
        }
      } else if (m === 'baryon') {
        ctx.fillStyle = 'rgba(176,14,24,.85)';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 1.75, -.12); ctx.quadraticCurveTo(s * 2.1, -.05, s * 2.2, .2); ctx.quadraticCurveTo(s * 2.0, .02, s * 1.72, -.02); ctx.fill(); }
      } else if (m === 'sage') {
        // Toad-sage pigmentation on the upper lids.
        ctx.fillStyle = 'rgba(232,110,34,.85)';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * .55, -.36); ctx.quadraticCurveTo(s * 1.2, -.86, s * 1.95, -.34); ctx.quadraticCurveTo(s * 1.2, -.62, s * .55, -.36); ctx.fill(); }
      } else if (m === 'pain') {
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          const x = s * .24, y = .16 + i * .2;
          dot(ctx, x, y, .055, '#3a3a44'); dot(ctx, x - .015, y - .015, .022, '#d8dce6');
        }
      } else if (m === 'tearTrough') {
        for (const s of [-1, 1]) line(ctx, [[s * .6, .3], [s * .72, .52], [s * .86, .7]], 'rgba(120,70,64,.75)', .035);
      } else if (m === 'gills') {
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(ctx, [[s * (1.2 + i * .16), .38], [s * (1.28 + i * .16), .62], [s * (1.24 + i * .16), .8]], '#3e6684', .05);
      } else if (m === 'tobirama') {
        ctx.fillStyle = '#d02a34';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 1.08, .34); ctx.lineTo(s * 1.26, .34); ctx.lineTo(s * 1.2, .9); ctx.lineTo(s * 1.14, .9); ctx.closePath(); ctx.fill(); }
      } else if (m === 'eyeshadow') {
        ctx.fillStyle = 'rgba(122,82,170,.55)';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * .55, -.4); ctx.quadraticCurveTo(s * 1.2, -.78, s * 1.9, -.3); ctx.quadraticCurveTo(s * 1.2, -.58, s * .55, -.4); ctx.fill(); }
      } else if (m === 'edo') {
        const c = '#4a4450';
        for (const s of [-1, 1]) {
          line(ctx, [[s * .5, .32], [s * .58, .55], [s * .45, .78]], c, .03); line(ctx, [[s * .58, .55], [s * .78, .66]], c, .025);
          line(ctx, [[s * 1.85, -.05], [s * 2.0, .2], [s * 1.95, .45]], c, .03);
          line(ctx, [[s * .4, -.42], [s * .3, -.7], [s * .38, -.9]], c, .025);
        }
      } else if (m === 'wrinkles') {
        for (const s of [-1, 1]) { line(ctx, [[s * .7, .42], [s * 1.2, .5], [s * 1.6, .42]], 'rgba(150,100,80,.6)', .03); line(ctx, [[s * 1.9, -.2], [s * 2.05, .05]], 'rgba(150,100,80,.6)', .03); }
        line(ctx, [[-.5, -.92], [.5, -.92]], 'rgba(150,100,80,.5)', .03);
      } else if (m === 'nose') {
        paint(ctx, () => ell(ctx, 0, .82, .4, .3), '#e05a4a', O, .04, () => { ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, -.1, .72, .12, .07); ctx.fill(); });
      }
    }
  }
  // Forehead marks drawn over the fringe (third eye, Byakugō, 愛).
  function cuForehead(ctx, list, O) {
    for (const m of list || []) {
      if (m === 'thirdEye') {
        ctx.save();
        const shape = () => { ctx.beginPath(); ctx.moveTo(0, -1.42); ctx.quadraticCurveTo(.26, -1.12, 0, -.82); ctx.quadraticCurveTo(-.26, -1.12, 0, -1.42); ctx.closePath(); };
        shape(); ctx.fillStyle = '#d61f2c'; ctx.fill(); ctx.clip();
        paintIris(ctx, 'rinneSharingan', {}, 0, -1.12, .12, .18, true);
        ctx.restore();
        shape(); ctx.strokeStyle = O; ctx.lineWidth = .04; ctx.stroke();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -1.12, 0, 0, -1.12, .5); g.addColorStop(0, 'rgba(255,40,60,.35)'); g.addColorStop(1, 'rgba(255,40,60,0)');
        ctx.fillStyle = g; ctx.fillRect(-.6, -1.7, 1.2, 1.2); ctx.restore();
      } else if (m === 'byakugo') {
        paint(ctx, () => poly(ctx, [[0, -1.22], [.13, -1.02], [0, -.82], [-.13, -1.02]]), '#8a4fc8', '#3a1a5a', .03, () => { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-.12, -1.22, .1, .16); });
      } else if (m === 'ai') {
        ctx.font = 'bold .5px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(90,10,20,.55)'; ctx.fillText('愛', 1.32, -.93); ctx.fillStyle = '#d8202e'; ctx.fillText('愛', 1.3, -.95);
      }
    }
  }

  function cuBackHair(ctx, conf, O) {
    const c = conf.hair;
    if (conf.fringe === 'bald' || conf.fringe === 'hood' || conf.fringe === 'hat') return;
    paint(ctx, () => {
      ctx.beginPath();
      if (conf.long) {
        // Long hair: a mass falling past the shoulders, its outer edge broken into strands.
        ctx.moveTo(-2.9, 2.2);
        for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-3.25 - (i % 2) * .15, 1.6 - i * .55, -3.05 + (i % 2) * .12, 1.3 - i * .55);
        ctx.quadraticCurveTo(-3.3, -2.6, 0, -2.8); ctx.quadraticCurveTo(3.3, -2.6, 3.05, -.9);
        for (let i = 3; i >= 0; i--) ctx.quadraticCurveTo(3.25 + (i % 2) * .15, 1.6 - i * .55 - .3, 3.05 - (i % 2) * .12, 1.3 - i * .55 + .55);
        ctx.lineTo(2.9, 2.2);
      } else if (conf.fringe === 'slick' || conf.fringe === 'bowl') {
        ctx.moveTo(-2.7, .6); ctx.quadraticCurveTo(-2.9, -2.6, 0, -2.7); ctx.quadraticCurveTo(2.9, -2.6, 2.7, .6);
      } else {
        // Spiky mop: jagged points all round the top and sides.
        const pts = 15;
        ctx.moveTo(-2.6, .4);
        for (let i = 0; i <= pts; i++) {
          const a = Math.PI * (1.02 + i / pts * .96), r = i % 2 ? 2.6 : 3.4, ry = i % 2 ? 2.2 : 2.9;
          ctx.lineTo(Math.cos(a) * r, -.5 + Math.sin(a) * ry);
        }
        ctx.lineTo(2.6, .4);
      }
      ctx.closePath();
    }, c, O, .05, () => {
      ctx.fillStyle = dark(c, .34); ctx.fillRect(-4, -3, 8, 6);
      ctx.fillStyle = c; ell(ctx, -.6, -2.2, 2.6, .9, -.1); ctx.fill();
      ctx.fillStyle = rgba(dark(c, .55), .8); ctx.fillRect(-4, -.2, 8, 3);
      if (conf.long) {
        // Lit outer strands on the left (key-light side), strand ink everywhere.
        ctx.fillStyle = rgba(c, .9); ctx.beginPath(); ctx.moveTo(-3.4, -1.4); ctx.quadraticCurveTo(-2.9, .4, -3.1, 2.3); ctx.lineTo(-2.75, 2.3); ctx.quadraticCurveTo(-2.7, .4, -3.0, -1.4); ctx.fill();
        ctx.strokeStyle = rgba(dark(c, .6), .9); ctx.lineWidth = .03;
        for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const x = s * (2.5 + i * .14); ctx.beginPath(); ctx.moveTo(x, -1.6); ctx.quadraticCurveTo(x + s * .12, .3, x - s * .05, 2.3); ctx.stroke(); }
        ctx.strokeStyle = rgba(hairGloss(c), .7); ctx.lineWidth = .06;
        ctx.beginPath(); ctx.moveTo(-3.0, -1.5); ctx.quadraticCurveTo(-2.75, -.6, -2.9, .2); ctx.stroke();
      }
    });
  }

  function cuFace(ctx, spec, conf, type, opts) {
    const h = spec.head, O = spec.outline, skin = spec.skin, shade = spec.skinShade || mix(skin, '#b0607a', .3);
    const deep = mix(shade, '#5a2a52', .35);
    const e = h.eyes || {};
    cuBackHair(ctx, conf, O);
    // Ears peeking out at the sides.
    if (!conf.long && conf.fringe !== 'hood') for (const s of [-1, 1]) paint(ctx, () => ell(ctx, s * 2.32, .2, .26, .42), skin, O, .04, () => { ctx.fillStyle = shade; ell(ctx, s * 2.36, .24, .13, .26); ctx.fill(); });
    const face = () => {
      ctx.beginPath(); ctx.moveTo(-2.32, -3);
      ctx.lineTo(-2.3, -.1); ctx.bezierCurveTo(-2.3, .55, -2.12, 1.1, -1.65, 1.7);
      ctx.lineTo(1.65, 1.7); ctx.bezierCurveTo(2.12, 1.1, 2.3, .55, 2.3, -.1);
      ctx.lineTo(2.32, -3); ctx.closePath();
    };
    paint(ctx, face, skin, O, .06, () => {
      // Light from the top-left: shade the right cheek, deeper at the very edge; forehead light.
      ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(1.7, -3); ctx.quadraticCurveTo(1.45, .1, 1.95, 1.8); ctx.lineTo(3, 1.8); ctx.lineTo(3, -3); ctx.fill();
      ctx.fillStyle = rgba(deep, .6); ctx.beginPath(); ctx.moveTo(2.05, -3); ctx.quadraticCurveTo(1.92, .2, 2.15, 1.8); ctx.lineTo(3, 1.8); ctx.lineTo(3, -3); ctx.fill();
      ctx.fillStyle = rgba(light(skin, .4), .7); ell(ctx, -.9, -1.0, 1.0, .3, -.1); ctx.fill();
      // Brow-ridge / socket shading above each eye and the cast shadow of hair or band.
      ctx.fillStyle = rgba(shade, .55); for (const s of [-1, 1]) { ell(ctx, s * 1.15, -.42, .95, .26); ctx.fill(); }
      // Cast shadow of whatever sits on the forehead: the band's lower edge, the fringe's locks
      // (each lock stamped again, offset down-right) or the cut line of a bowl / slicked hairline.
      ctx.fillStyle = rgba(shade, .95);
      const f = conf.fringe, band = h.band && f !== 'hat';
      if (band) { ctx.beginPath(); ctx.moveTo(-3, -1.0); ctx.lineTo(3, -1.0); ctx.lineTo(3, -.72); ctx.quadraticCurveTo(0, -.8, -3, -.74); ctx.closePath(); ctx.fill(); }
      else if (f === 'bowl') ctx.fillRect(-3, -1, 6, .38);
      else if (f === 'slick') { ctx.beginPath(); ctx.moveTo(-3, -1.6); ctx.lineTo(3, -1.6); ctx.lineTo(2.5, -.9); ctx.quadraticCurveTo(0, -1.36, -2.5, -.9); ctx.closePath(); ctx.fill(); }
      else if (f === 'hat') ctx.fillRect(-3, -1.6, 6, .82);
      if (!band) for (const [x0, y0, x1, y1, w, b] of cuFringe(f, false)) {
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const ox = .08, oy = .14, mx = (x0 + x1) / 2 + nx * b + ox, my = (y0 + y1) / 2 + ny * b + oy;
        ctx.beginPath(); ctx.moveTo(x0 - nx * w * 1.1 + ox, y0 - ny * w * 1.1 + oy);
        ctx.quadraticCurveTo(mx - nx * w * .8, my - ny * w * .8, x1 + ox, y1 + oy + .06);
        ctx.quadraticCurveTo(mx + nx * w * .9, my + ny * w * .9, x0 + nx * w * 1.1 + ox, y0 + ny * w * 1.1 + oy); ctx.fill();
      }
      if (type === 'byakugan') {
        // Byakugan active: veins bulging from the eyes toward the temples and the nose bridge.
        for (const s of [-1, 1]) for (const [pts, wd] of [
          [[[s * 1.85, -.12], [s * 2.05, -.3], [s * 2.12, -.62], [s * 2.3, -.85]], .05], [[[s * 2.05, -.3], [s * 2.3, -.32]], .035],
          [[[s * 1.88, .02], [s * 2.1, .14], [s * 2.25, .05]], .04], [[[s * .5, -.12], [s * .36, -.36], [s * .38, -.62]], .045],
          [[[s * .36, -.36], [s * .2, -.48]], .03], [[[s * 1.4, -.5], [s * 1.55, -.72], [s * 1.5, -.9]], .035]]) {
          line(ctx, pts, rgba(dark(skin, .3), .9), wd * 1.6);
          line(ctx, pts.map(([x, y]) => [x - .015, y - .02]), rgba(light(skin, .5), .8), wd * .5);
        }
      }
      // Nose: bridge shadow on the right, tip with a highlight and nostril tick.
      ctx.fillStyle = rgba(shade, .9); ctx.beginPath(); ctx.moveTo(.12, .05); ctx.quadraticCurveTo(.26, .45, .24, .76); ctx.lineTo(.08, .78); ctx.quadraticCurveTo(.16, .4, .04, .08); ctx.fill();
      if (h.blush !== false) { ctx.fillStyle = 'rgba(255,110,110,.16)'; for (const s of [-1, 1]) { ell(ctx, s * 1.45, .55, .5, .18); ctx.fill(); } }
    });
    line(ctx, [[.2, .74], [.04, .8], [-.12, .76]], rgba(dark(shade, .3), .9), .035);
    dot(ctx, .02, .7, .04, 'rgba(255,255,255,.7)');
    // Eyes.
    if (h.noEyes) {
      for (const s of [-1, 1]) { paint(ctx, () => ell(ctx, s * 1.1, 0, .62, .48), '#0d0d10', O, .04); dot(ctx, s * 1.1 - .2, -.18, .08, 'rgba(255,255,255,.55)'); }
    } else for (const s of [-1, 1]) cuEye(ctx, s, e, type, O, spec.skin, opts.intensity, e.fem);
    // Brows.
    if (h.brows !== false) {
      const bc = h.browColor || O, bw = h.brows === 'thick' ? (h.browW ? .3 : .22) : .1;
      const ang = h.browAngle === 'angry' ? 1 : h.browAngle === 'sad' ? -.7 : .35 * opts.intensity;
      for (const s of [-1, 1]) cuBrow(ctx, s, bw, bc, ang);
    }
    cuMarks(ctx, (conf.marks || []).concat(opts.eye === 'sage' ? ['sage'] : []), O, skin, shade);
  }

  function cuFrontHair(ctx, spec, conf) {
    const O = spec.outline, c = conf.hair, f = conf.fringe;
    const band = spec.head.band;
    if (f === 'bowl') {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.7, -3); ctx.lineTo(2.7, -3); ctx.lineTo(2.62, .7); ctx.lineTo(2.22, .7); ctx.lineTo(2.2, -.74); ctx.lineTo(-2.2, -.74); ctx.lineTo(-2.22, .7); ctx.lineTo(-2.62, .7); ctx.closePath(); }, c, O, .06, () => {
        ctx.fillStyle = '#0a0a0e'; ctx.fillRect(-3, -1.1, 6, .4);
        ctx.strokeStyle = '#2c3044'; ctx.lineWidth = .03;
        for (let x = -2.1; x <= 2.1; x += .3) { ctx.beginPath(); ctx.moveTo(x, -1.6); ctx.lineTo(x * 1.02, -.78); ctx.stroke(); }
        ctx.strokeStyle = '#7d8cc0'; ctx.lineWidth = .16; ctx.beginPath(); ctx.ellipse(0, -1.0, 2.3, .55, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.strokeStyle = '#e8eeff'; ctx.lineWidth = .07; ctx.beginPath(); ctx.ellipse(0, -1.0, 2.3, .55, 0, Math.PI * 1.3, Math.PI * 1.6); ctx.stroke();
      });
      return;
    }
    if (f === 'slick') {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.6, -3); ctx.lineTo(2.6, -3); ctx.lineTo(2.5, -1.0); ctx.quadraticCurveTo(0, -1.5, -2.5, -1.0); ctx.closePath(); }, c, O, .06, () => {
        ctx.fillStyle = dark(c, .25); ctx.fillRect(-3, -1.35, 6, .4);
        ctx.strokeStyle = dark(c, .35); ctx.lineWidth = .03;
        for (let x = -2.2; x <= 2.2; x += .35) { ctx.beginPath(); ctx.moveTo(x, -1.22 - Math.abs(x) * .03); ctx.quadraticCurveTo(x * .9, -1.8, x * .7, -2.6); ctx.stroke(); }
        ctx.strokeStyle = hairGloss(c); ctx.lineWidth = .08; ctx.beginPath(); ctx.moveTo(-1.6, -1.5); ctx.quadraticCurveTo(0, -1.75, 1.4, -1.5); ctx.stroke();
      });
      return;
    }
    if (f === 'hood' || f === 'wrap') {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3.4, 2); ctx.lineTo(-3.4, -3); ctx.lineTo(3.4, -3); ctx.lineTo(3.4, 2); ctx.lineTo(2.5, 2); ctx.lineTo(2.45, -.6); ctx.quadraticCurveTo(0, -.95, -2.45, -.6); ctx.lineTo(-2.5, 2); ctx.closePath(); }, c, O, .06, () => {
        ctx.fillStyle = dark(c, .3); ctx.fillRect(-3.5, -1.1, 7, 3.2); ctx.fillStyle = rgba(light(c, .25), .6); ell(ctx, -.8, -1.9, 2, .35); ctx.fill();
        ctx.strokeStyle = dark(c, .45); ctx.lineWidth = .03; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-3, -2.4 + i * .4); ctx.quadraticCurveTo(0, -2.7 + i * .4, 3, -2.4 + i * .4); ctx.stroke(); }
      });
      return;
    }
    if (f === 'hat') {
      // Kage kasa brim sweeping over the brow, 火 panel just visible.
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.4, -.55); ctx.quadraticCurveTo(0, -3.4, 4.4, -.55); ctx.quadraticCurveTo(0, -1.2, -4.4, -.55); ctx.closePath(); }, '#f6f3ea', O, .06, () => {
        ctx.fillStyle = '#d8d2c4'; ctx.fillRect(-5, -1.1, 10, .6);
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(-.9, -.95); ctx.lineTo(-.7, -2.4); ctx.lineTo(.9, -2.4); ctx.lineTo(.9, -.95); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(80,60,40,.3)'; ctx.lineWidth = .025; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * .2, -2.5); ctx.lineTo(i * 1.05, -.6); ctx.stroke(); }
      });
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold .62px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('火', 0, -1.5);
      return;
    }
    if (f === 'bald') {
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ell(ctx, -.6, -1.25, 1.3, .2, -.05); ctx.fill();
      return;
    }
    // Locks fall over the band (or the forehead); deep shade first so the mop has depth.
    const locks = cuFringe(f, !!band);
    for (const [x0, y0, x1, y1, w, b] of locks) cuLock(ctx, c, O, x0, y0, x1, y1, w, b);
  }

  function cuBackdrop(ctx, w, h, conf, intensity) {
    const acc = conf.accent || '#ff7a1a';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#07070c'); g.addColorStop(.5, dark(acc, .78)); g.addColorStop(1, '#07070c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Radial speed lines streaming out of the eyes.
    ctx.save(); ctx.translate(w / 2, h * .6);
    ctx.strokeStyle = rgba(light(acc, .3), .14 + .16 * intensity); ctx.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU + Math.sin(i * 12.9898) * .05, r0 = w * (.22 + (Math.abs(Math.sin(i * 78.233)) * .1)), r1 = w * .9;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * .5); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * .5); ctx.stroke();
    }
    ctx.restore();
  }

  // Ōtsutsuki horn rising out of the hairline (bone white, cel shaded).
  function cuHorn(ctx, x, y, lean, O) {
    const tipX = x + lean * .35, tipY = y - .95;
    paint(ctx, () => { ctx.beginPath(); ctx.moveTo(x - .2, y + .15); ctx.quadraticCurveTo(x - .12 + lean * .1, y - .5, tipX, tipY); ctx.quadraticCurveTo(x + .18 + lean * .2, y - .4, x + .2, y + .15); ctx.closePath(); }, '#efe6da', O, .045, () => {
      ctx.fillStyle = 'rgba(60,30,80,.25)'; ctx.beginPath(); ctx.moveTo(x + .02, y + .2); ctx.lineTo(tipX, tipY); ctx.lineTo(x + .3, y + .2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(ctx, x - .07, y - .25, .04, .22, lean * .3); ctx.fill();
    });
  }

  const CU_CACHE = new Map();
  function drawCloseUp(ctx, id, w = 640, h = 160, opts = {}) {
    const spec = SPECS[id]; if (!spec) return;
    const conf = cuConf(id, spec);
    const intensity = clamp(opts.intensity === undefined ? 1 : opts.intensity, 0, 1);
    const baseType = (spec.head.eyes && spec.head.eyes.type) || 'normal';
    const type = opts.eye || baseType;
    // Cache the rendered panel per size / eye / intensity at the destination's pixel density.
    const t = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 };
    const dens = clamp(Math.round(Math.hypot(t.a, t.b) * 4) / 4 || 1, 1, 3);
    const key = [id, w, h, type, Math.round(intensity * 20), opts.background === false ? 0 : 1, dens].join('|');
    let c = opts.noCache ? null : CU_CACHE.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = Math.ceil(w * dens); c.height = Math.ceil(h * dens);
      const g = c.getContext('2d'); g.scale(dens, dens);
      try { renderCloseUp(g, id, spec, conf, type, w, h, Object.assign({}, opts, { intensity })); } catch (err) { console.warn('closeUp', id, err); }
      if (!opts.noCache) { CU_CACHE.set(key, c); if (CU_CACHE.size > 24) CU_CACHE.delete(CU_CACHE.keys().next().value); }
    }
    ctx.drawImage(c, 0, 0, w, h);
  }

  function renderCloseUp(g, id, spec, conf, type, w, h, opts) {
    const intensity = opts.intensity;
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    if (opts.background !== false) cuBackdrop(g, w, h, conf, intensity);
    const U = Math.min(h / 2.45, w / 7.4);
    g.save(); g.translate(w / 2, h * .6); g.scale(U, U);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const band = spec.head.band;
    cuFace(g, spec, conf, type, opts);
    if (conf.mask) {
      const mc = conf.mask;
      paint(g, () => { g.beginPath(); g.moveTo(-2.5, .42); g.quadraticCurveTo(0, .28, 2.5, .42); g.lineTo(2.5, 2); g.lineTo(-2.5, 2); g.closePath(); }, mc, spec.outline, .05, () => {
        g.fillStyle = SHADE; g.fillRect(1.2, 0, 2, 2);
        g.strokeStyle = dark(mc, .3); g.lineWidth = .025; for (let y = .6; y < 1.2; y += .18) { g.beginPath(); g.moveTo(-2.5, y); g.quadraticCurveTo(0, y - .1, 2.5, y); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-2.5, .42, 5, .08);
      });
    }
    if (band && conf.fringe !== 'hat') cuHeadband(g, band, spec.outline);
    cuFrontHair(g, spec, conf);
    cuForehead(g, conf.marks, spec.outline);
    if (conf.horns) for (const [x, y, dx] of conf.horns) cuHorn(g, x, y, dx, spec.outline);
    g.restore();
    // Dramatic light: a soft dark vignette at both ends and thin letterbox rules.
    const v = g.createLinearGradient(0, 0, w, 0);
    v.addColorStop(0, 'rgba(0,0,0,.55)'); v.addColorStop(.16, 'rgba(0,0,0,0)'); v.addColorStop(.84, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, Math.max(2, h * .03)); g.fillRect(0, h - Math.max(2, h * .03), w, Math.max(2, h * .03));
    g.fillStyle = rgba(light(conf.accent || '#ff7a1a', .3), .8); g.fillRect(0, Math.max(2, h * .03), w, 1); g.fillRect(0, h - Math.max(2, h * .03) - 1, w, 1);
    g.restore();
  }

  // ---------------------------------------------------------------- dynamic auras
  // Soft radial glow baked once and stamped (no per-frame gradients).
  const GLOWS = new Map();
  function glowSprite(r, g, b) {
    const key = r + ',' + g + ',' + b;
    let c = GLOWS.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'), gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, `rgba(${key},.55)`); gr.addColorStop(.45, `rgba(${key},.28)`); gr.addColorStop(1, `rgba(${key},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    GLOWS.set(key, c);
    return c;
  }

  // One flowing chakra tail: an S-curved ribbon (cubic spine) with a wavering flame edge.
  const TAIL_N = 14, TAIL_PTS = new Float32Array(TAIL_N * 4);
  function tailSpine(sx, sy, a, len, w, time, i) {
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const b1 = Math.sin(time * 2.1 + i * 1.7) * 7, b2 = -Math.sin(time * 2.1 + i * 1.7 - 1.3) * 10;
    const curl = Math.sin(time * 2.6 + i * 1.3) * 7 + 4;
    const c1x = sx + ux * len * .34 + nx * b1, c1y = sy + uy * len * .34 + ny * b1;
    const c2x = sx + ux * len * .7 + nx * b2, c2y = sy + uy * len * .7 + ny * b2;
    const tx = sx + ux * len + nx * curl, ty = sy + uy * len + ny * curl;
    let px = sx, py = sy;
    for (let j = 0; j < TAIL_N; j++) {
      const t = j / (TAIL_N - 1), m = 1 - t;
      const x = m * m * m * sx + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * tx;
      const y = m * m * m * sy + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * ty;
      let dx = x - px, dy = y - py;
      if (j === 0) { dx = c1x - sx; dy = c1y - sy; }
      const dl = Math.hypot(dx, dy) || 1;
      const flick = 1 + .16 * Math.sin(t * 15 - time * 11 + i * 2.1);
      const ww = w * Math.pow(Math.sin(Math.PI * (.2 + .8 * t)), .75) * flick;
      TAIL_PTS[j * 4] = x; TAIL_PTS[j * 4 + 1] = y; TAIL_PTS[j * 4 + 2] = -dy / dl * ww; TAIL_PTS[j * 4 + 3] = dx / dl * ww;
      px = x; py = y;
    }
  }
  function tailFill(ctx, scale, grow, fill) {
    ctx.beginPath();
    for (let j = 0; j < TAIL_N; j++) {
      const o = j * 4, x = TAIL_PTS[o] + TAIL_PTS[o + 2] * scale, y = TAIL_PTS[o + 1] + TAIL_PTS[o + 3] * scale;
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let j = TAIL_N - 1; j >= 0; j--) {
      const o = j * 4;
      ctx.lineTo(TAIL_PTS[o] - TAIL_PTS[o + 2] * scale, TAIL_PTS[o + 1] - TAIL_PTS[o + 3] * scale);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (grow) { ctx.lineWidth = grow; ctx.strokeStyle = fill; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  // Baryon Mode / Kurama chakra cloak: nine flowing tails fan out behind a flame shroud.
  // Tail order goes outside-in so the central tails overlap the outer ones.
  const TAIL_ORDER = [0, 8, 1, 7, 2, 6, 3, 5, 4];
  function drawBaryonBehind(ctx, x, y, facing, time, k = 1.16) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * k, k);
    // Warm haze pooled around the body (reads as glow on grass and on dark ground).
    ctx.drawImage(glowSprite(255, 96, 30), -44, -82, 88, 90);
    const sx = -4.5, sy = -17;
    for (const i of TAIL_ORDER) {
      const fan = (i - 4) / 4;
      const sway = Math.sin(time * 1.7 + i * .9);
      const a = -Math.PI / 2 - .62 - fan * 1.02 + sway * .06;
      const len = 42 + (1 - Math.abs(fan)) * 15 + sway * 2.5;
      const w = 4.6 + (1 - Math.abs(fan)) * 1.6;
      tailSpine(sx, sy, a, len, w, time, i);
      tailFill(ctx, 1, 2.4, 'rgba(128,6,16,.92)');       // dark rim: holds the shape on bright grass
      tailFill(ctx, 1, 0, i % 2 ? '#f0361c' : '#ff4f1e'); // flame body
      tailFill(ctx, .58, 0, 'rgba(255,150,50,.78)');    // hot inner band
      tailFill(ctx, .2, 0, 'rgba(255,232,170,.85)');    // white-hot core
    }
    // Flame shroud hugging the body: dark crimson outer layer, then orange.
    shroud(ctx, time, -29, 17.5, 31, 16, 15, 'rgba(176,14,20,.62)', 0);
    shroud(ctx, time * 1.35, -29, 14, 27.5, 14, 10, 'rgba(255,118,40,.62)', 2);
    shroud(ctx, time * 1.7, -30, 10.5, 23.5, 12, 6, 'rgba(255,214,120,.45)', 5);
    ctx.restore();
  }

  // A flame-tipped silhouette hugging the body: the anime "chakra cloak" read.
  // Tips lean upward and flicker; bottom slots stay short so the feet stay planted.
  function shroud(ctx, time, cy, rx, ry, slots, height, fill, seed = 0) {
    const pt = a => [Math.cos(a) * rx, cy + Math.sin(a) * ry];
    ctx.beginPath();
    for (let i = 0; i < slots; i++) {
      const a0 = (i / slots) * TAU, a1 = ((i + .5) / slots) * TAU, a2 = ((i + 1) / slots) * TAU;
      const top = Math.max(0, -Math.sin(a1)), side = Math.abs(Math.cos(a1));
      const flick = .55 + .45 * Math.sin(time * 9 + i * 2.3 + seed);
      const h = height * flick * (.25 + top * .95 + side * .25);
      const b0 = pt(a0), b2 = pt(a2), m = pt(a1);
      const tip = [m[0] + Math.cos(a1) * h * .45 + Math.sin(time * 4 + i) * 1.4, m[1] + Math.sin(a1) * h * .35 - h * (.5 + top * .6)];
      if (i === 0) ctx.moveTo(b0[0], b0[1]);
      ctx.quadraticCurveTo((b0[0] + tip[0]) / 2 - Math.cos(a1) * 1.5, (b0[1] + tip[1]) / 2 + 2, tip[0], tip[1]);
      ctx.quadraticCurveTo((b2[0] + tip[0]) / 2 + Math.cos(a1) * 1.2, (b2[1] + tip[1]) / 2 + 1, b2[0], b2[1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  function embers(ctx, time, count, cy, rx, ry, color, size = 1.4) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const t = (time * .9 + i * .618) % 1;
      const x = Math.sin(i * 12.9 + time * 1.3) * rx * (1 - t * .4);
      const y = cy + ry * .6 - t * ry * 2.4;
      ctx.globalAlpha = (1 - t) * .9;
      ctx.beginPath(); ctx.arc(x, y, size * (1 - t * .6), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBaryonAbove(ctx, x, y, facing, time, k = 1.16) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * k, k);
    // A thin veil of flame over the body, flame tongues peeling off upward, rising embers.
    shroud(ctx, time * 1.2, -29, 12.5, 27.5, 14, 8, 'rgba(255,92,40,.2)', 3);
    for (let i = 0; i < 5; i++) {
      const t = (time * 1.15 + i * .2) % 1, side = i % 2 ? 1 : -1;
      const px = side * (6 + (i % 3) * 3) + Math.sin(time * 3 + i) * 1.5, py = -22 - (i % 3) * 9 - t * 26;
      const h = 7 * (1 - t) + 2, w = 2.4 * (1 - t * .6);
      ctx.globalAlpha = (1 - t) * .85;
      ctx.fillStyle = '#e8321c';
      ctx.beginPath(); ctx.moveTo(px - w, py); ctx.quadraticCurveTo(px - w * .4, py - h * .6, px + side * 1.2, py - h);
      ctx.quadraticCurveTo(px + w * .6, py - h * .4, px + w, py); ctx.quadraticCurveTo(px, py + w * .8, px - w, py); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    embers(ctx, time, 12, -26, 16, 27, 'rgba(255,190,90,.9)');
    ctx.restore();
  }

  // Eight Gates: blood-red steam pouring off Guy. `above` draws only the rising puffs.
  function drawGatesAura(ctx, x, y, facing, time, k = 1.18, attack = 0, above = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * k, k);
    if (!above) {
      // Blood-red chakra haze, a dark crimson flame body and a hot inner layer.
      ctx.drawImage(glowSprite(230, 30, 34), -42 - attack * 6, -84, 84 + attack * 12, 92);
      shroud(ctx, time * 1.1, -30, 17.5 + attack * 4, 31, 16, 16 + attack * 7, 'rgba(150,8,16,.5)', 1);
      shroud(ctx, time * 1.5, -30, 14, 27.5, 14, 10 + attack * 3, 'rgba(236,48,40,.5)', 4);
      shroud(ctx, time * 1.9, -30, 10.5, 23.5, 12, 6, 'rgba(255,150,120,.35)', 7);
      ctx.restore();
      return;
    }
    // Eighth Gate steam boiling off the body: each puff has a darker red body and a pale top.
    for (let i = 0; i < 8; i++) {
      const t = (time * .75 + i / 8) % 1, a = (1 - t) * (1 - t);
      const px = Math.sin(i * 7.3 + time * .8) * (8 + t * 6), py = -18 - t * 56, r = 3.4 + t * 9;
      ctx.fillStyle = `rgba(196,30,36,${a * .34})`;
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,170,150,${a * .3})`;
      ctx.beginPath(); ctx.arc(px - r * .25, py - r * .3, r * .62, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Shadow-clone smoke puff (white cartoon cloud).
  function drawSmoke(ctx, x, y, progress, radius = 30) {
    if (progress <= 0 || progress >= 1) return;
    const a = 1 - progress, r = radius * (.55 + progress * .7);
    ctx.save(); ctx.translate(x, y);
    for (let i = 0; i < 9; i++) {
      const ang = i * TAU / 9 + progress;
      const d = r * (.55 + (i % 3) * .12);
      const br = r * (.42 + (i % 2) * .12);
      ctx.fillStyle = `rgba(${i % 2 ? 236 : 250},${i % 2 ? 238 : 250},${i % 2 ? 244 : 252},${a * .92})`;
      ctx.beginPath(); ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d * .7 - r * .3, br, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(0, -r * .3, r * .55, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(150,160,180,${a * .6})`; ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) { const ang = i * TAU / 5 - progress * 2; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .5, Math.sin(ang) * r * .35 - r * .3, r * .22, ang, ang + 2.2); ctx.stroke(); }
    ctx.restore();
  }

  window.AnimeSprites = {
    LIFT, FRAMES, SPECS, META,
    has: id => !!SPECS[id],
    draw, drawFallen, shadow, height, prewarm, drawPortrait, drawCloseUp,
    drawBaryonBehind, drawBaryonAbove, drawGatesAura, drawSmoke,
    renderCharacter: (ctx, id, frame) => renderCharacter(ctx, SPECS[id], poseOf(SPECS[id], frame))
  };
})();
