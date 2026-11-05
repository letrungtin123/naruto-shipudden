/* Boruto era (spawn panel, faction 'boruto'): Uzumaki Boruto, Uchiha Sarada, Mitsuki, Kawaki.
 * Same contract as duel-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. All per-boss
 * state lives on z.bt (plain numbers / small arrays; closures in ev/upd are skipped by the co-op snapshot).
 * The four sprites are registered here with AnimeSprites.addSprite (built from AnimeSprites.kit).
 *
 * Boruto  : Vanishing Rasengan, Shadow Clones, lightning shuriken, Rasengan Uzuhiko (tornado), Gale Palm,
 *           Kāma absorption, ultimate Karma Rasengan (Karma marks spread, giant orb, leaping slam).
 * Sarada  : Chidori, Sharingan shuriken barrage, Shannarō punch (crater), Great Fireball, heel-drop
 *           fissure, ultimate Sharingan combo (wire-shuriken trap → Chidori → Shannarō finisher).
 * Mitsuki : stretching snake arm, Hidden Shadow Snake Hands, Lightning Snake, wind blades, Sage Mode,
 *           ultimate Sage Art serpent swarm (giant white snakes + one colossal serpent).
 * Kawaki  : Karma spike wave, morphing arm hammer, Kāma absorb-and-return beam, Karma blade sweep,
 *           Daikokuten cubes, ultimate Karma cube rain. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const r1 = v => Math.round(v * 10) / 10;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const liftH = () => (Spr() ? Spr().LIFT : 24);

  // ================================================================== sprites
  (function registerSprites() {
    const S = window.AnimeSprites;
    if (!S || !S.kit || !S.addSprite) return;
    const K = S.kit;
    const { paint, line, lerp, dark, light, rgba, ell, dot, poly, locks, sweptHair, sweptBack, HAIR, SHADE, eyeShape, snakeEye, uchihaFan, fringeShadow } = K;

    // Karma seal: a black rhombus with a hollow centre, painted on a palm.
    const karmaSeal = (ctx, x, y, s) => {
      ctx.fillStyle = '#101018';
      ctx.beginPath(); ctx.moveTo(x, y - 1.6 * s); ctx.lineTo(x + 1.1 * s, y); ctx.lineTo(x, y + 1.6 * s); ctx.lineTo(x - 1.1 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(170,190,255,.8)'; ell(ctx, x, y, .32 * s, .5 * s); ctx.fill();
    };

    // ---- Uzumaki Boruto: spiky blond mop with an upright tuft, Leaf plate, two whiskers a cheek,
    // black track jacket with red trim and lining, grey trousers; Jōgan in the right eye when he fights.
    function borutoSpec() {
      const O = '#2a1a14', HC = '#f7d24c', JK = '#24252f', JKD = '#17181f', TRIM = '#e0405a', PANTS = '#3c4254';
      const TIPS = [[-30, 15.6], [-58, 18.8], [-88, 19.8], [-117, 19.2], [-145, 18.2], [-171, 16.6], [-196, 14.8], [-219, 13]];
      const BACK = [[-74, 18.4], [-104, 19], [-133, 18.4], [-160, 17], [-186, 15], [-208, 13]];
      const jogan = (ctx, x, y, w, h, near) => {
        const ix = x + w * .16, iy = y + h * .14, irx = w * .74, iry = h * .86;
        ctx.save(); eyeShape(ctx, x, y, w, h, near ? -1 : 1); ctx.clip();
        ell(ctx, ix, iy, irx, iry); ctx.fillStyle = '#bfe6ff'; ctx.fill();
        ctx.strokeStyle = '#2a5ac8'; ctx.lineWidth = irx * .2; ell(ctx, ix, iy, irx * .96, iry * .96); ctx.stroke();
        ctx.strokeStyle = 'rgba(40,110,220,.8)'; ctx.lineWidth = irx * .1;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.moveTo(ix + Math.cos(a) * irx * .22, iy + Math.sin(a) * iry * .22); ctx.lineTo(ix + Math.cos(a) * irx * .78, iy + Math.sin(a) * iry * .78); }
        ctx.stroke();
        dot(ctx, ix, iy, irx * .2, '#ffffff');
        ctx.restore();
      };
      return {
        outline: O, skin: '#f9cfa6', skinShade: '#e3a27c', sealCross: true, legK: 1.08,
        legs: { thigh: PANTS, shin: PANTS, foot: '#232c48', wrap: '#f1ece2', holster: JKD, w1: 5.2, w2: 4.2 },
        arms: {
          upper: JK, lower: JK, w1: 4.6, w2: 4.0, cuff: TRIM,
          pattern(ctx, p0, p1, p2, far) { if (!far) line(ctx, [lerp(p0, p1, .15), lerp(p0, p1, .85)], rgba(TRIM, .85), .55); }
        },
        torso: {
          base: JK, paint: ctx => {
            // Black track jacket: red lining in the open collar V, a red zip strip, dark hem band.
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(1.4, -13.8); ctx.lineTo(6.4, -13.8); ctx.lineTo(3.8, -9.6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#2e2f3a'; ctx.beginPath(); ctx.moveTo(2.4, -13.8); ctx.lineTo(5.4, -13.8); ctx.lineTo(3.8, -11); ctx.closePath(); ctx.fill();
            ctx.fillStyle = TRIM; ctx.fillRect(3.3, -9.8, .8, 8);
            ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(3.3, -9.8, .3, 8);
            ctx.fillStyle = JKD; ctx.fillRect(-9, -2.2, 18, 2.2);
            line(ctx, [[-9, -2.3], [9, -2.3]], TRIM, .5);
            ctx.strokeStyle = 'rgba(120,130,170,.35)'; ctx.lineWidth = .35;
            ctx.beginPath(); ctx.moveTo(5, -5.4); ctx.quadraticCurveTo(6.6, -4.8, 7.6, -5.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-6, -11); ctx.quadraticCurveTo(-4, -6, -5, -2.6); ctx.stroke();
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, -12.2); ctx.quadraticCurveTo(-4.6, -15.8, -1, -16); ctx.lineTo(1.6, -15.6); ctx.lineTo(1.4, -12.2); ctx.closePath(); }, JK, O, .8,
            () => { ctx.fillStyle = SHADE; ctx.fillRect(-5, -16.4, 3.4, 5); });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(6.4, -12.4); ctx.lineTo(7.8, -15.6); ctx.quadraticCurveTo(8.4, -13.6, 7.6, -11.8); ctx.closePath(); }, JK, O, .7);
          line(ctx, [[-3.8, -15.6], [1.4, -15.4]], rgba(TRIM, .9), .45);
        },
        head: {
          back(ctx, spec) { sweptBack(ctx, spec, HC, BACK, { valley: 12 }); },
          hair: (ctx, spec) => sweptHair(ctx, spec, HC, TIPS, { valley: 12.8, sweep: .2 }),
          eyes: { type: 'normal', iris: '#3f8ef2' }, mouth: 'smirk', attackMouth: 'shout', browColor: '#b07a12', browAngle: 'angry',
          marks(ctx) {
            // Two whisker marks a cheek (Naruto has three).
            ctx.fillStyle = '#5a2e18';
            for (const y of [5.2, 6.6]) {
              ctx.beginPath(); ctx.moveTo(-1.4, y - .6); ctx.quadraticCurveTo(.6, y - .85, 2.5, y + .05); ctx.quadraticCurveTo(.6, y - .2, -1.4, y - .6); ctx.fill();
              ctx.beginPath(); ctx.moveTo(10.1, y - .4); ctx.quadraticCurveTo(9.1, y - .55, 8.2, y + .05); ctx.quadraticCurveTo(9.1, y + .15, 10.1, y - .4); ctx.fill();
            }
          },
          band: { cloth: '#20232e', plate: '#c9d1da', symbol: 'leaf' },
          front(ctx, spec, pose) {
            if (pose && (pose.attack || pose.seal)) jogan(ctx, 2.4, 2.2, 2.1, 2.65, true);
            fringeShadow(ctx, [[-2, -3], [3, -3.4], [1.4, 2], [-1.6, 1.4]]);
            locks(ctx, spec, HC, [
              [-1.6, -8.4, -3, 5.4, 1.8, -1.3], [9.4, -7.4, 10.8, 1.8, 1.3, .9],
              [.6, -8.8, -.4, -.4, 1.5, -.5], [3, -8.8, 3.6, -4.2, 1.3, .3], [5.8, -8.6, 6.8, -5, 1.15, .3], [8.2, -8, 9, -4.8, 1.1, .2]
            ], .85);
            // The upright tuft on the crown.
            locks(ctx, spec, HC, [[2.2, -13.6, 6.4, -25.4, 1.7, 1.6], [-.8, -13.2, -2.4, -22.6, 1.4, -1]], .85);
          }
        },
        front(ctx, pose, hand) { if (pose.attack || pose.seal) karmaSeal(ctx, hand[0] + .4, hand[1] - .2, .8); }
      };
    }

    // ---- Uchiha Sarada: black bob with side locks, red glasses, Leaf plate on a red cloth, red
    // sleeveless high-collared top with the Uchiha fan on the back, black arm warmers and shorts.
    function saradaSpec() {
      const O = '#1a1016', HC = '#1e1a28', RED = '#c82a3c', REDD = '#8e1a28', BLK = '#26222e', SKIN = '#f6dccb';
      return {
        outline: O, skin: SKIN, skinShade: '#dcaa96', bulk: -.6, legK: 1.12,
        legs: { thigh: BLK, shin: BLK, foot: '#2a2430', w1: 4.7, w2: 3.9, wrap: '#d8cfc6' },
        arms: { upper: SKIN, lower: BLK, w1: 4.1, w2: 3.8, cuff: '#3a3442', hand: SKIN },
        torso: {
          base: RED, paint: ctx => {
            ctx.fillStyle = 'rgba(255,200,200,.22)'; ctx.fillRect(-9, -14, 18, 2.4);
            // Qipao front flap edge and the dark sash at the waist.
            line(ctx, [[1.2, -13.6], [5.6, -9.6], [6.2, -3]], REDD, .5);
            ctx.fillStyle = '#2a2230'; ctx.fillRect(-9, -3.4, 18, 2.2);
            ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-9, -3.4, 18, .45);
            ctx.strokeStyle = 'rgba(90,10,20,.45)'; ctx.lineWidth = .35;
            ctx.beginPath(); ctx.moveTo(-5, -11); ctx.quadraticCurveTo(-3.8, -7, -4.6, -3.6); ctx.stroke();
          }
        },
        skirt: {
          color: RED, hem: 11.6, flare: .9, paint: (ctx, hem, hipY) => {
            ctx.fillStyle = REDD; ctx.fillRect(-20, hem - 1, 40, 1.5);
            line(ctx, [[1.6, hipY + 1], [2.2, hem + .6]], '#5a0e18', .6);
          }
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7, -18.2); ctx.quadraticCurveTo(-2, -17, 2.6, -16.2); ctx.lineTo(5, -12.2); ctx.closePath(); },
            REDD, O, 1, () => { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-9, -20, 5, 9); });
          uchihaFan(ctx, -5.4, -14.8, .9, O);
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.4, -11.6); ctx.lineTo(-6.8, -16.2); ctx.quadraticCurveTo(-2.4, -15, 2.8, -14.6);
            ctx.quadraticCurveTo(6, -14.6, 7.4, -15.4); ctx.lineTo(7.2, -12.6); ctx.quadraticCurveTo(6.8, -11.6, 6, -11.2); ctx.closePath();
          }, RED, O, .95, () => { ctx.fillStyle = SHADE; ctx.fillRect(-9, -17, 5, 7); ctx.fillStyle = 'rgba(255,220,220,.35)'; ctx.fillRect(-6.8, -16.4, 13, .5); });
        },
        head: {
          drape: (ctx, spec) => {
            // The bob falls just past the jaw at the back.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-8, -6); ctx.quadraticCurveTo(-12.6, 0, -11.4, 9.6); ctx.lineTo(-8.6, 8.4); ctx.lineTo(-7.4, 10.6); ctx.lineTo(-5, 8); ctx.quadraticCurveTo(-3, 2, -2, -4); ctx.closePath(); },
              HC, spec.outline, 1, () => { ctx.fillStyle = dark(HC, .3); ctx.fillRect(-14, -8, 14, 20); });
          },
          hair: HAIR.smooth(HC, { nape: 8.8 }),
          eyes: { type: 'sharingan', fem: true }, mouth: 'neutral', attackMouth: 'shout', browColor: HC, browW: .6, browAngle: 'angry',
          band: { cloth: '#b8283a', plate: '#c9d1da', symbol: 'leaf' },
          front(ctx, spec) {
            locks(ctx, spec, HC, [[-1.4, -8.4, -2.6, 8.6, 2, -.8], [10, -6.8, 10.8, 5.8, 1.5, .6], [1.4, -8.8, .8, -4.6, 1.3, -.2], [4.6, -8.9, 4.9, -5.4, 1.2, 0], [7.6, -8.4, 8.4, -5, 1.1, .2]], .85);
            // Red glasses: two rounded lenses with a tint and a glare stroke, bridge and temple arm.
            ctx.fillStyle = 'rgba(210,230,255,.16)';
            ell(ctx, 2.6, 2.4, 2.9, 2.1); ctx.fill(); ell(ctx, 8.1, 2.3, 1.95, 1.95); ctx.fill();
            for (const [c, w] of [[spec.outline, 1.05], ['#d8283a', .55]]) {
              ctx.strokeStyle = c; ctx.lineWidth = w;
              ell(ctx, 2.6, 2.4, 2.9, 2.1); ctx.stroke(); ell(ctx, 8.1, 2.3, 1.95, 1.95); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(5.5, 1.7); ctx.quadraticCurveTo(5.85, 1.2, 6.2, 1.7); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-.3, 2); ctx.lineTo(-3, 1.4); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = .32;
            ctx.beginPath(); ctx.moveTo(1, 1.2); ctx.lineTo(2.2, .7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(7.3, 1.2); ctx.lineTo(8, .8); ctx.stroke();
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          // A kunai in the striking hand.
          ctx.save(); ctx.translate(hand[0], hand[1]);
          paint(ctx, () => poly(ctx, [[1.2, -1.2], [8.4, 0], [1.2, 1.2]]), '#a4adb8', O, .55, () => { ctx.fillStyle = '#e6ecf2'; ctx.fillRect(1.2, -1.2, 7, 1); });
          line(ctx, [[-2.4, 0], [1.2, 0]], '#3a2a24', 1.3);
          ctx.restore();
        }
      };
    }

    // ---- Mitsuki: pale skin, light-blue bob with a side-swept fringe, gold snake eyes, serene smile,
    // a pale high-collared robe with wide sleeves over a dark shirt, purple rope belt with a bow.
    function mitsukiSpec() {
      const O = '#1c1a26', HC = '#a8d8ea', ROBE = '#eceaf2', ROBED = '#c4c2d2', ROPE = '#7c52b8', PANTS = '#2e3148', SKIN = '#eef0f3';
      const rope = (ctx, x0, y0, x1, y1, w) => {
        line(ctx, [[x0, y0], [x1, y1]], O, w + 1); line(ctx, [[x0, y0], [x1, y1]], ROPE, w);
        ctx.strokeStyle = dark(ROPE, .5); ctx.lineWidth = .3; ctx.beginPath();
        const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, n = Math.max(2, Math.round(L / 1.1));
        for (let i = 0; i < n; i++) {
          const t = (i + .5) / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
          ctx.moveTo(cx - uy * w * .46 - ux * .45, cy + ux * w * .46 - uy * .45); ctx.lineTo(cx + uy * w * .46 + ux * .45, cy - ux * w * .46 + uy * .45);
        }
        ctx.stroke();
        line(ctx, [[x0 + uy * w * .22, y0 - ux * w * .22], [x1 + uy * w * .22, y1 - ux * w * .22]], 'rgba(226,196,255,.45)', w * .16);
      };
      return {
        outline: O, skin: SKIN, skinShade: '#c8c6d6', legK: 1.12, bulk: -.3,
        legs: { thigh: PANTS, shin: PANTS, foot: '#262838', w1: 5.6, w2: 4.6, wrap: '#d6d4de' },
        arms: { upper: ROBE, lower: ROBE, w1: 5.4, w2: 6.2, cuff: ROBED, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            // Robe front crossing over a dark shirt, then the twisted purple rope belt.
            ctx.fillStyle = '#2a2a38'; ctx.beginPath(); ctx.moveTo(.6, -13.6); ctx.lineTo(6.6, -13.6); ctx.lineTo(3.8, -7.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = dark(ROBE, .1); ctx.beginPath(); ctx.moveTo(-.4, -13.6); ctx.lineTo(4.4, -4); ctx.lineTo(9, -4); ctx.lineTo(9, -13.6); ctx.lineTo(6.6, -13.6); ctx.lineTo(3.8, -7.4); ctx.closePath(); ctx.fill();
            line(ctx, [[-.4, -13.6], [4.4, -4]], dark(ROBE, .45), .5);
            ctx.strokeStyle = 'rgba(120,110,160,.4)'; ctx.lineWidth = .35;
            for (const x of [-5, -2]) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.quadraticCurveTo(x + .8, -7, x, -3); ctx.stroke(); }
            rope(ctx, -9, -2.4, 10, -2.7, 2.6);
          }
        },
        skirt: { color: ROBE, hem: 9.6, flare: 1.1, paint: (ctx, hem) => { ctx.fillStyle = ROBED; ctx.fillRect(-20, hem - .9, 40, 1.3); } },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.2, -18.6); ctx.quadraticCurveTo(-2, -17.2, 2.4, -16.4); ctx.lineTo(4.8, -12.2); ctx.closePath(); },
            ROBED, O, 1, () => { ctx.fillStyle = 'rgba(60,50,100,.22)'; ctx.fillRect(-9, -20, 5, 9); });
          // Rope bow at the small of the back.
          rope(ctx, -7.4, -1.8, -9.4, 4.2, 1.5); rope(ctx, -7, -1.6, -6.6, 4.8, 1.4);
          for (const [x, y, rx, ry, rot] of [[-9.4, -3.6, 2.2, 1.3, -.5], [-9.6, -.2, 2, 1.2, .5]]) {
            ctx.strokeStyle = O; ctx.lineWidth = 2.8; ell(ctx, x, y, rx, ry, rot); ctx.stroke();
            ctx.strokeStyle = ROPE; ctx.lineWidth = 2; ell(ctx, x, y, rx, ry, rot); ctx.stroke();
          }
          paint(ctx, () => ell(ctx, -7.6, -2.2, 1.8, 1.6), ROPE, O, .8);
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.6, -11.4); ctx.lineTo(-7, -16.8); ctx.quadraticCurveTo(-2.6, -15.4, 1.2, -14.6); ctx.lineTo(1.8, -12.8); ctx.quadraticCurveTo(-1.6, -12.4, -2.4, -11); ctx.closePath();
          }, ROBE, O, .95, () => { ctx.fillStyle = ROBED; ctx.fillRect(-9, -18, 4.4, 8); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-7, -17, 6, .45); });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(6.6, -13.4); ctx.lineTo(8.4, -16.4); ctx.quadraticCurveTo(8.8, -13.8, 7.8, -11.4); ctx.closePath(); }, ROBE, O, .85);
        },
        head: {
          hair: HAIR.smooth(HC, { nape: 8.2 }),
          eyes: { type: 'normal', iris: '#f2c62a' }, mouth: 'smile', attackMouth: 'smirk', browColor: dark(HC, .35), browW: .5, blush: false,
          marks(ctx, spec) {
            snakeEye(ctx, 2.4, 2.2, 2.1, 2.65, true, spec.outline, '#f2c62a');
            snakeEye(ctx, 7.95, 2.1, 1.48, 2.45, false, spec.outline, '#f2c62a');
          },
          front(ctx, spec) {
            fringeShadow(ctx, [[-1.6, -5], [8, -5.4], [9, -2], [3, -.6], [-1.4, .4]]);
            locks(ctx, spec, HC, [
              [-1.4, -8.6, -2.4, 6.6, 1.9, -.8], [10.2, -6.8, 10.9, 3.6, 1.3, .5],
              [.6, -9.2, 3.4, -1.4, 1.7, .8], [3.4, -9.4, 6.4, -2.6, 1.6, .7], [6.4, -9, 9.2, -2.2, 1.4, .6], [8.6, -8.2, 10.4, -3, 1.2, .4]
            ], .85);
          }
        }
      };
    }

    // ---- Kawaki: messy black hair with white streaks, grey eyes, the small X mark on the forehead,
    // a row of rings in the ear, black high-collared jacket with grey trim, Karma seal on the palm.
    function kawakiSpec() {
      const O = '#141218', HC = '#1b1b22', WHITE = '#e6e8ee', JK = '#23232b', TRIM = '#c4c8d6', PANTS = '#474855';
      const TIPS = [[-26, 14.8], [-52, 17.4], [-80, 18.2], [-108, 17.8], [-136, 17], [-162, 15.8], [-188, 14.4], [-212, 13]];
      return {
        outline: O, skin: '#efd2bc', skinShade: '#c9a08c', bulk: .3, legK: 1.14,
        legs: { thigh: PANTS, shin: PANTS, foot: '#1e1e26', w1: 5.6, w2: 4.5, holster: '#1a1a20' },
        arms: {
          upper: JK, lower: JK, w1: 5, w2: 4.4, cuff: TRIM,
          pattern(ctx, p0, p1, p2, far) { if (!far) line(ctx, [lerp(p0, p1, .2), lerp(p0, p1, .8)], 'rgba(160,164,180,.5)', .45); }
        },
        torso: {
          base: JK, paint: ctx => {
            ctx.fillStyle = '#30303a'; ctx.fillRect(-9, -14, 18, 3);
            line(ctx, [[3.6, -13.6], [3.6, -1.6]], TRIM, .5);
            ctx.fillStyle = '#18181e'; ctx.fillRect(-9, -2.4, 18, 2.4);
            line(ctx, [[-9, -2.5], [9, -2.5]], TRIM, .45);
            ctx.strokeStyle = 'rgba(150,150,180,.3)'; ctx.lineWidth = .35;
            ctx.beginPath(); ctx.moveTo(-5.4, -11); ctx.quadraticCurveTo(-3.6, -6, -4.6, -2.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5, -7); ctx.quadraticCurveTo(6.4, -6.4, 7.6, -7.2); ctx.stroke();
          }
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.4, -12); ctx.lineTo(-7.2, -19); ctx.quadraticCurveTo(-2, -17.6, 2.6, -16.8); ctx.lineTo(5, -12.2); ctx.closePath(); },
            '#1a1a22', O, 1, () => { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-9, -20, 5, 9); });
        },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.6, -11.4); ctx.lineTo(-7.2, -17.2); ctx.quadraticCurveTo(-2.6, -15.6, 2.6, -14.8);
            ctx.quadraticCurveTo(6, -14.6, 8, -15.8); ctx.lineTo(7.6, -12.6); ctx.quadraticCurveTo(7.2, -11.6, 6.4, -11.2); ctx.closePath();
          }, JK, O, 1, () => { ctx.fillStyle = SHADE; ctx.fillRect(-9, -18, 5, 8); ctx.fillStyle = rgba(TRIM, .6); ctx.fillRect(-7.2, -17.3, 15, .5); });
          line(ctx, [[3.4, -14.6], [3.8, -11.6]], TRIM, .45);
        },
        head: {
          back(ctx, spec) { sweptBack(ctx, spec, HC, [[-70, 16.6], [-100, 17.2], [-130, 16.6], [-158, 15.4], [-184, 14], [-206, 12.6]], { valley: 11.4 }); },
          hair: (ctx, spec) => sweptHair(ctx, spec, HC, TIPS, { valley: 12.4, sweep: .24 }),
          eyes: { type: 'normal', iris: '#8b90a4' }, mouth: 'frown', attackMouth: 'shout', browColor: HC, browAngle: 'angry', blush: false,
          ear(ctx) {
            // Rings all along the ear.
            for (const [x, y] of [[-5.2, .6], [-5.4, 2], [-5.1, 3.4], [-4.4, 4.6]]) { ctx.strokeStyle = '#2a2a32'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x, y, .62, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#dfe3ec'; ctx.lineWidth = .35; ctx.stroke(); }
          },
          marks(ctx) {
            ctx.strokeStyle = 'rgba(30,26,40,.9)'; ctx.lineWidth = .55; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(.2, 6.2); ctx.quadraticCurveTo(1.6, 6.8, 3.2, 6.2); ctx.stroke();
          },
          front(ctx, spec) {
            locks(ctx, spec, HC, [[-1.4, -8.4, -2.8, 4, 1.8, -1.2], [9.4, -7.4, 10.6, .6, 1.3, .8], [.8, -8.8, .4, -1.8, 1.5, -.4], [6.4, -8.6, 7.8, -3.4, 1.3, .4]], .85);
            // The white streaks through the fringe.
            locks(ctx, spec, WHITE, [[3, -8.9, 3.8, -2.6, 1.6, .3], [8.4, -8, 9.8, -3.6, 1.3, .3], [-.8, -8.6, -1.8, -1.6, 1.4, -.4], [.6, -12.4, -1.6, -20.6, 1.7, -.6], [5.6, -12.8, 8.2, -20.4, 1.6, .6]], .7);
            // The X mark on the forehead, between the locks.
            ctx.strokeStyle = '#121016'; ctx.lineWidth = 1.15; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(4.6, -6.4); ctx.lineTo(6.4, -4.6); ctx.moveTo(6.4, -6.4); ctx.lineTo(4.6, -4.6); ctx.stroke();
          }
        },
        front(ctx, pose, hand) { if (pose.attack || pose.seal) karmaSeal(ctx, hand[0] + .4, hand[1] - .2, .85); }
      };
    }

    S.addSprite('boruto', borutoSpec(), { scale: 1.1 }, { hair: '#f7d24c', fringe: 'naruto', accent: '#5ab0ff', marks: ['whiskers'] });
    S.addSprite('sarada', saradaSpec(), { scale: 1.1 }, { hair: '#1e1a28', fringe: 'part', accent: '#e03a3a' });
    S.addSprite('mitsuki', mitsukiSpec(), { scale: 1.12 }, { hair: '#a8d8ea', fringe: 'part', accent: '#b0e0ff' });
    S.addSprite('kawaki', kawakiSpec(), { scale: 1.2 }, { hair: '#1b1b22', fringe: 'spiky', accent: '#9a9ab0' });
  })();

  // ================================================================== roster
  const members = {
    boruto: { name: 'UZUMAKI BORUTO', accent: '#5ab0ff', hpScale: 2.9, damageScale: 1.72,
      kit: ['vanish', 'clones', 'shur', 'uzu', 'gale', 'kama', 'karma'],
      moves: ['vanish', 'clones', 'shur', 'uzu', 'gale', 'kama', 'karma', 'shur', 'vanish', 'gale', 'clones', 'uzu', 'kama', 'karma'] },
    sarada: { name: 'UCHIHA SARADA', accent: '#ff4a52', hpScale: 2.8, damageScale: 1.7,
      kit: ['chidori', 'shur', 'punch', 'katon', 'heel', 'combo'],
      moves: ['chidori', 'shur', 'punch', 'katon', 'heel', 'combo', 'katon', 'chidori', 'heel', 'shur', 'punch', 'combo'] },
    mitsuki: { name: 'MITSUKI — XÀ TIÊN', accent: '#9fe4ff', hpScale: 2.8, damageScale: 1.7,
      kit: ['arms', 'snakes', 'lsnake', 'wind', 'sage', 'swarm'],
      moves: ['arms', 'snakes', 'lsnake', 'wind', 'sage', 'swarm', 'snakes', 'arms', 'wind', 'lsnake', 'sage', 'swarm'] },
    kawaki: { name: 'KAWAKI — KĀMA', accent: '#b4b0ff', hpScale: 3.45, damageScale: 1.88, armor: .92,
      kit: ['spikes', 'hammer', 'absorb', 'lance', 'cubes', 'rain'],
      moves: ['spikes', 'hammer', 'absorb', 'lance', 'cubes', 'rain', 'hammer', 'spikes', 'cubes', 'lance', 'absorb', 'rain'] }
  };
  const order = Object.keys(members);
  const pick = level => order[(((level | 0) % order.length) + order.length) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    boruto: {
      vanish: { label: 'TIÊU THẤT · LOA TOÀN HOÀN', rgb: '120,190,255', windup: .8, after: 1.1 },
      clones: { label: 'ẢNH PHÂN THÂN THUẬT', rgb: '230,236,255', windup: .7, after: 1.1 },
      shur:   { label: 'LÔI ĐỘN · LÔI QUANG THỦ LÝ KIẾM', rgb: '140,200,255', windup: .7, after: 1.0 },
      uzu:    { label: 'LOA TOÀN HOÀN · UZUHIKO', rgb: '150,215,255', windup: .9, after: 1.2 },
      gale:   { label: 'PHONG ĐỘN · LIỆT PHONG CHƯỞNG', rgb: '200,240,255', windup: .7, after: 1.0 },
      kama:   { label: 'KARMA · KĀMA HẤP THU', rgb: '150,130,255', windup: .85, after: 1.2 },
      karma:  { label: 'KARMA KHAI · ĐẠI LOA TOÀN HOÀN', shout: 'ĐÂY LÀ NHẪN ĐẠO CỦA TA!', rgb: '110,170,255', windup: 1.45, after: 1.8 }
    },
    sarada: {
      chidori: { label: 'LÔI ĐỘN · THIÊN ĐIỂU', rgb: '150,200,255', windup: .9, after: 1.1 },
      shur:    { label: 'SHARINGAN · THỦ LÝ KIẾM LOẠN VŨ', rgb: '255,90,90', windup: .7, after: 1.0 },
      punch:   { label: 'SHANNARŌ! · ANH HOA XUNG', rgb: '255,130,170', windup: .8, after: 1.2 },
      katon:   { label: 'HỎA ĐỘN · HÀO HỎA CẦU THUẬT', rgb: '255,140,60', windup: .9, after: 1.2 },
      heel:    { label: 'THIÊN CƯỚC · ĐỊA LIỆT', rgb: '255,150,190', windup: .75, after: 1.1 },
      combo:   { label: 'SHARINGAN · THIÊN ĐIỂU LIÊN KÍCH', shout: 'SHANNARŌ!!', rgb: '255,70,80', windup: 1.35, after: 1.8 }
    },
    mitsuki: {
      arms:   { label: 'XÀ THỦ · TRƯỜNG TÝ QUYỀN', rgb: '210,230,255', windup: .7, after: 1.0 },
      snakes: { label: 'TIỀM ẢNH XÀ THỦ', rgb: '200,180,255', windup: .75, after: 1.1 },
      lsnake: { label: 'LÔI ĐỘN · LÔI XÀ', rgb: '140,200,255', windup: .8, after: 1.1 },
      wind:   { label: 'PHONG ĐỘN · PHONG NHẬN', rgb: '190,245,235', windup: .7, after: 1.0 },
      sage:   { label: 'TIÊN THUẬT · XÀ TIÊN NHÂN MÔ THỨC', rgb: '255,220,110', windup: 1.0, after: .9 },
      swarm:  { label: 'TIÊN THUẬT · VẠN XÀ TRIỀU', shout: 'ĐÂY LÀ CON ĐƯỜNG TA CHỌN.', rgb: '240,230,170', windup: 1.35, after: 1.8 }
    },
    kawaki: {
      spikes: { label: 'KARMA · HẮC THÍCH TRẬN', rgb: '160,150,255', windup: .75, after: 1.0 },
      hammer: { label: 'KARMA · BIẾN HÌNH THIẾT CHÙY', rgb: '170,160,255', windup: .85, after: 1.2 },
      absorb: { label: 'KĀMA · HẤP THU PHẢN XẠ', rgb: '140,190,255', windup: .8, after: 1.1 },
      lance:  { label: 'KARMA · HẮC NHẬN TRẢM', rgb: '180,170,255', windup: .8, after: 1.0 },
      cubes:  { label: 'ĐẠI HẮC THIÊN · HẮC KHỐI', rgb: '170,150,255', windup: .9, after: 1.2 },
      rain:   { label: 'KARMA · ĐẠI HẮC THIÊN KHỐI VŨ', shout: 'CÚT KHỎI ĐƯỜNG CỦA TA!', rgb: '150,130,255', windup: 1.45, after: 1.9 }
    }
  };
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
  // Manual control (team mode): each fighter's moves in key order 1..n, ultimate last.
  const MOVE_LISTS = {};
  for (const id in members) MOVE_LISTS[id] = members[id].kit.map(k => ({ id: k, label: MOVES[id][k].label }));
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }

  function state(z) {
    return z.bt || (z.bt = { t: 0, casts: 0, timer: 1.1, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, arc: null, lift: 0, hold: 0, seed: 0, vanish: 0, karma: 0, sage: 0, orb: 0, ham: 0, chid: 0, spots: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 120) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (Spr() && Spr().has && Spr().has(id) ? Spr().height(id) : 70);
  const R = v => Math.round(v);

  function conePts(x, y, a, reach, half) {
    const out = [];
    for (let d = 70; d <= reach; d += 85) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120)), r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d });
      }
    }
    return out;
  }
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - x1) * dx + (py - y1) * dy) / l2);
    return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
  };
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 60 + i * 18;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }
  // Line hits along a path, segment by segment as the jutsu front reaches them.
  function lineHits(st, x0, y0, a, len, sp, w, dmg, kind, step = 170, delay = 0) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let d0 = 0; d0 < len; d0 += step) {
      const d1 = Math.min(len, d0 + step);
      later(st, delay + d1 / sp, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * d1, y0 + sa * d1, w, dmg, kind && d0 % (step * 2) === 0 ? kind : null));
    }
  }
  // A victim for grabs/pulls: the real target, or the nearest hostile near the aim point when driven by hand.
  function victim(api, x, y, r) {
    const p = api.player;
    if (p && p.pseudo) return api.nearestFoe ? api.nearestFoe(x, y, r) : null;
    return p;
  }

  // ================================================================== telegraphs
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const sq = (cx, cy, s) => ({ k: 'sq', x: cx, y: cy, s });
    const at = len => [x + ca * len, y + sa * len];
    if (id === 'boruto') switch (move) {
      case 'vanish': { const len = clamp(d + 30, 320, 800); st.spots = [{ len: R(len) }]; const [ex, ey] = at(len); return [line(len, 26), circ(ex, ey, 175)]; }
      case 'clones': {
        const spots = [];
        for (let i = 0; i < 3; i++) { const aa = a + Math.PI + (i - 1) * 1.15; spots.push({ x: R(tx + Math.cos(aa) * 70), y: R(ty + Math.sin(aa) * 70) }); }
        st.spots = spots; return spots.map(s => circ(s.x, s.y, 140));
      }
      case 'shur': { const out = []; for (let i = 0; i < 5; i++) out.push(line(860, 18, a + (i - 2) * .15)); return out; }
      case 'uzu': { const len = clamp(d, 220, 720); st.spots = [{ len: R(len) }]; const [ex, ey] = at(len); return [line(len, 24), circ(ex, ey, 300), circ(ex, ey, 140, true)]; }
      case 'gale': return [{ k: 'cone', x, y, a, r: 560, h: .5 }];
      case 'kama': return [circ(x, y, 360), circ(x, y, 420, true)];
      case 'karma': {
        const len = Math.min(d, 600), [ex, ey] = at(len);
        st.spots = [{ x: R(ex), y: R(ey) }];
        return [circ(ex, ey, 430), circ(ex, ey, 210, true), line(len, 30)];
      }
    }
    if (id === 'sarada') switch (move) {
      case 'chidori': { const len = clamp(d + 90, 280, 640); st.spots = [{ len: R(len) }]; const [ex, ey] = at(len); return [line(len, 46), circ(ex, ey, 200)]; }
      case 'shur': return [circ(tx, ty, 190), circ(tx, ty, 90, true)];
      case 'punch': { const len = Math.min(d, 520), [ex, ey] = at(len); st.spots = [{ x: R(ex), y: R(ey) }]; return [circ(ex, ey, 310), line(len, 22)]; }
      case 'katon': { const len = clamp(d, 260, 700); st.spots = [{ len: R(len) }]; const [ex, ey] = at(len); return [line(len, 66), circ(ex, ey, 270)]; }
      case 'heel': return [line(680, 56), circ(x, y, 130, true)];
      case 'combo': { const len = Math.min(d, 560), [ex, ey] = at(len); st.spots = [{ x: R(ex), y: R(ey) }]; return [circ(ex, ey, 380), circ(ex, ey, 250, true), line(len + 120, 40)]; }
    }
    if (id === 'mitsuki') switch (move) {
      case 'arms': return [line(700, 36)];
      case 'snakes': return [{ k: 'cone', x, y, a, r: 600, h: .46 }];
      case 'lsnake': return [line(860, 62)];
      case 'wind': return [{ k: 'cone', x, y, a, r: 740, h: .34 }];
      case 'sage': return [circ(x, y, 340), circ(x, y, 180, true)];
      case 'swarm': {
        const len = Math.min(d, 640), [ex, ey] = at(len);
        st.spots = [{ x: R(ex), y: R(ey) }];
        return [circ(ex, ey, 330), circ(ex, ey, 420, true), line(1000, 84)];
      }
    }
    if (id === 'kawaki') switch (move) {
      case 'spikes': return [line(720, 62)];
      case 'hammer': { const len = Math.min(d, 480), [ex, ey] = at(len); st.spots = [{ x: R(ex), y: R(ey) }]; return [circ(ex, ey, 300), line(len, 26)]; }
      case 'absorb': return [circ(x, y, 360, true), line(980, 48)];
      case 'lance': {
        const dir = Math.random() < .5 ? 1 : -1, a0 = a - dir * 1.25, a1 = a + dir * 1.25;
        st.spots = [{ dir, a0: r1(a0) }];
        return [{ k: 'ring', x, y, r0: 50, r1: 560, a0, a1 }];
      }
      case 'cubes': {
        const spots = [{ x: R(tx), y: R(ty), s: 200 }], b = Math.random() * TAU;
        for (let i = 0; i < 3; i++) spots.push({ x: R(tx + Math.cos(b + i * TAU / 3) * 230), y: R(ty + Math.sin(b + i * TAU / 3) * 230), s: 150 });
        st.spots = spots; return spots.map(s => sq(s.x, s.y, s.s));
      }
      case 'rain': {
        const spots = [], b = Math.random() * TAU;
        for (let i = 0; i < 12; i++) {
          const aa = b + i * 2.399, rr = 170 + (i % 4) * 120 + hash(i + b) * 60;
          spots.push({ x: R(tx + Math.cos(aa) * rr), y: R(ty + Math.sin(aa) * rr * .8), s: R(120 + hash(i * 3.3 + b) * 60) });
        }
        spots.push({ x: R(tx), y: R(ty), s: 300 });
        st.spots = spots; return spots.map(s => sq(s.x, s.y, s.s));
      }
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId, move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    const quick = id === 'mitsuki' && st.sage > 0 ? .8 : 1;
    st.move = move; st.windup = st.windMax = r1(def.windup * quick * 100) / 100 || def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = R(p ? p.x : z.x); st.ty = R(p ? p.y : z.y);
    st.seed = r1(Math.random() * 99);
    st.tele = teleFor(z, st, id, move);
    if (id === 'boruto' && move === 'karma') st.karma = def.windup + 4;
    if (id === 'kawaki' && move === 'rain') st.karma = def.windup + 5;
    if (id === 'kawaki' && move === 'hammer') st.ham = def.windup + 1.2;
    if (id === 'sarada' && (move === 'chidori' || move === 'combo')) st.chid = def.windup + (move === 'combo' ? 1.6 : .5);
    if (id === 'boruto' && move === 'clones') addFx(st, { kind: 'poof', x: R(z.x), y: R(z.y), r: 90, dur: .9 });
  }

  // ================================================================== movement helpers
  function startDash(z, st, a, len, dur, dmg, w, end, trail, bolt) {
    st.dash = { a: r1(a), speed: len / dur, left: dur, hit: 0, w, dmg, end };
    addFx(st, { kind: 'dash', pts: [], a: r1(a), dur: dur + .5, x0: R(z.x), y0: R(z.y), x1: R(z.x), y1: R(z.y), rgb: trail || '255,255,255', bolt: bolt ? 1 : 0 });
  }
  function startArc(z, st, x1, y1, dur, h, end) { st.arc = { t: 0, dur, h, x0: z.x, y0: z.y, x1, y1, end }; }

  // ================================================================== casting
  function cast(z, st, api) {
    const id = z.bossId, move = st.move, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = st.seed;
    const D = (api.damage || 60) * (id === 'mitsuki' && st.sage > 0 ? 1.25 : 1);
    if (id === 'boruto') castBoruto(z, st, api, move, D, a, ca, sa, seed);
    else if (id === 'sarada') castSarada(z, st, api, move, D, a, ca, sa, seed);
    else if (id === 'mitsuki') castMitsuki(z, st, api, move, D, a, ca, sa, seed);
    else castKawaki(z, st, api, move, D, a, ca, sa, seed);
  }

  // ------------------------------------------------------------------ Boruto
  function castBoruto(z, st, api, move, D, a, ca, sa, seed) {
    const fac = facingOf(z), H = bodyH('boruto');
    switch (move) {
      case 'vanish': {
        // Thrown like a ball: it disappears a third of the way out and reappears just before the target.
        const len = st.spots[0].len, sp = 820, x0 = z.x + ca * 20, y0 = z.y + sa * 20, ex = x0 + ca * len, ey = y0 + sa * len;
        addFx(st, { kind: 'ras', x0: R(x0), y0: R(y0), a: r1(a), len, sp, r: 15, v0: R(len * .28), v1: R(len * .8), dur: len / sp + .05 });
        later(st, len / sp * .5, api => api.line(x0, y0, ex, ey, 30, D * .9));
        later(st, len / sp, api => {
          api.strike(ex, ey, 175, D * 2.3, null, 'vortex', true);
          addFx(st, { kind: 'vortex', x: R(ex), y: R(ey), r: 180, dur: 1.2 });
          api.shake(10);
        });
        st.hold = .5;
        break;
      }
      case 'clones': {
        const list = [], hx = z.x, hy = z.y;
        st.spots.forEach((s, i) => {
          const aa = a + (i - 1) * 1.4 + Math.PI * .5 * (i - 1), d0 = 110;
          const sx = hx + Math.cos(aa) * d0, sy = hy + Math.sin(aa) * d0 * .7;
          const t0 = r1(.25 + i * .22);
          list.push({ x0: R(sx), y0: R(sy), x1: s.x, y1: s.y, t0, ras: i !== 1 ? 1 : 0 });
          later(st, t0 + .3, api => {
            api.strike(s.x, s.y, 140, D * (i !== 1 ? 1.7 : 1.4), null, null, true);
            api.shake(7);
          });
        });
        addFx(st, { kind: 'clones', list, dur: 1.8 });
        st.hold = 1.4;
        break;
      }
      case 'shur': {
        const list = [], sp = 1250, len = 860, x0 = z.x + fac * 10, y0 = z.y;
        for (let i = 0; i < 5; i++) {
          const aa = a + (i - 2) * .15;
          list.push(r1(aa));
          lineHits(st, x0, y0, aa, len, sp, 22, D * .95, null, 215);
        }
        addFx(st, { kind: 'shur', x0: R(x0), y0: R(y0), list, sp, len, dur: len / sp + .35 });
        st.hold = .5;
        break;
      }
      case 'uzu': {
        // The Rasengan flies out, then blooms into a grinding tornado that drags everything in.
        const len = st.spots[0].len, sp = 900, x0 = z.x + ca * 20, y0 = z.y + sa * 20, ex = x0 + ca * len, ey = y0 + sa * len, ta = len / sp, T = 1.9;
        addFx(st, { kind: 'ras', x0: R(x0), y0: R(y0), a: r1(a), len, sp, r: 17, v0: 0, v1: 0, dur: ta + .05 });
        later(st, ta, api => {
          addFx(st, { kind: 'uzu', x: R(ex), y: R(ey), r: 300, T, dur: T + .7 });
          api.strike(ex, ey, 160, D * 1.6, null, 'vortex', true);
          api.shake(12);
        });
        for (let k = 1; k <= 6; k++) later(st, ta + k * .28, api => {
          api.strike(ex, ey, 300, D * .55, null, null, true);
          // drag toward the eye of the tornado
          const q = victim(api, ex, ey, 320);
          if (q && !q.pseudo && !q.remote && Math.hypot(q.x - ex, q.y - ey) < 320) {
            const dd = Math.hypot(q.x - ex, q.y - ey), pull = Math.min(dd, 46);
            if (dd > 30 && !api.blocked(q.x + (ex - q.x) / dd * pull, q.y + (ey - q.y) / dd * pull, q.r || 16)) { q.x += (ex - q.x) / dd * pull; q.y += (ey - q.y) / dd * pull; }
          }
        });
        later(st, ta + T, api => { api.strike(ex, ey, 320, D * 1.6, null, 'crater', true); api.world(ex, ey, 260, D * 3, 'vortex'); api.shake(16); addFx(st, { kind: 'impact', x: R(ex), y: R(ey), r: 300, dur: 1.3, rgb: '150,210,255' }); });
        st.hold = .7;
        break;
      }
      case 'gale': {
        addFx(st, { kind: 'gale', x: R(z.x), y: R(z.y), a: r1(a), r: 560, h: .5, dur: 1.2 });
        conePts(z.x, z.y, a, 560, .5).forEach(q => later(st, q.d / 1400, api => api.strike(q.x, q.y, q.r, D * 1.5, null, null, true)));
        later(st, .12, api => {
          const q = api.player;
          if (q && !q.pseudo) {
            const d = Math.hypot(q.x - z.x, q.y - z.y), da = Math.abs(Math.atan2(Math.sin(Math.atan2(q.y - z.y, q.x - z.x) - a), Math.cos(Math.atan2(q.y - z.y, q.x - z.x) - a)));
            if (d < 420 && da < .55) api.knockback(z, d + 30, 220, 0);
          }
          api.world(z.x + ca * 300, z.y + sa * 300, 150, D * 2, 'shockwave', a);
        });
        api.shake(7);
        st.hold = .6;
        break;
      }
      case 'kama': {
        const T1 = 1.25;
        addFx(st, { kind: 'kama', x: R(z.x), y: R(z.y), r: 360, t1: T1, dur: T1 + 1.1, dark: 0 });
        for (let k = 0; k < 3; k++) later(st, .15 + k * .38, api => api.knockback(z, 400, -70, 0));
        later(st, T1, api => {
          api.strike(z.x, z.y, 360, D * 2.3, null, 'shockwave', true);
          api.knockback(z, 370, 210, 0);
          z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .03);
          addFx(st, { kind: 'karmaBurst', x: R(z.x), y: R(z.y), r: 400, dur: 1.1 });
          api.shake(14);
        });
        st.hold = T1 + .35;
        break;
      }
      case 'karma': {
        // Leap with the giant Karma Rasengan held overhead and grind it into the target.
        const s = st.spots[0];
        st.orb = 1;
        const dest = freeSpot(api, s.x - Math.cos(a) * 40, s.y - Math.sin(a) * 40, z.r) || { x: z.x, y: z.y };
        addFx(st, { kind: 'mark', x: s.x, y: s.y, r: 430, dur: .7, rgb: '110,170,255' });
        startArc(z, st, dest.x, dest.y, .7, 170, api => {
          st.orb = 0;
          api.strike(s.x, s.y, 430, D * 3.2, null, 'crater', true);
          api.knockback(z, 440, 230, 0);
          api.world(s.x, s.y, 360, D * 4, 'vortex');
          addFx(st, { kind: 'uzu', x: s.x, y: s.y, r: 430, T: 1.4, dur: 2.1, big: 1 });
          addFx(st, { kind: 'karmaBurst', x: s.x, y: s.y, r: 520, dur: 1.4 });
          addFx(st, { kind: 'impact', x: s.x, y: s.y, r: 440, dur: 1.6, rgb: '120,180,255' });
          for (let k = 1; k <= 4; k++) later(st, k * .3, api => api.strike(s.x, s.y, 300, D * .6, null, k === 2 ? 'vortex' : null, true));
          api.shake(26);
        });
        st.hold = 2.2;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Sarada
  function castSarada(z, st, api, move, D, a, ca, sa, seed) {
    const fac = facingOf(z);
    switch (move) {
      case 'chidori': {
        const len = st.spots[0].len;
        startDash(z, st, a, len, .34, D * 2.1, 62, api => {
          api.strike(z.x, z.y, 200, D * 1.5, null, 'lightning', true);
          addFx(st, { kind: 'bolt', x: R(z.x), y: R(z.y), r: 210, dur: 1.0 });
          api.shake(12); st.chid = 0;
        }, '150,200,255', true);
        st.hold = .35;
        break;
      }
      case 'shur': {
        // Sharingan-read barrage: shuriken thrown on curving arcs that converge on the target.
        const list = [], tx = st.tx, ty = st.ty, x0 = z.x + fac * 8, y0 = z.y;
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), bow = side * (120 + k * 55), mx = (x0 + tx) / 2, my = (y0 + ty) / 2;
          const ox = tx + (hash(i + seed) - .5) * 110, oy = ty + (hash(i * 3 + seed) - .5) * 110;
          const cx = mx - sa * bow, cy = my + ca * bow;
          const t0 = r1(i * .05), d = r1(.42 + k * .05);
          list.push({ x0: R(x0), y0: R(y0), cx: R(cx), cy: R(cy), x1: R(ox), y1: R(oy), t0, d });
          later(st, t0 + d, api => { api.strike(ox, oy, 80, D * .7, null, null, true); });
        }
        addFx(st, { kind: 'curveShur', list, dur: 1.9 });
        later(st, .95, api => api.shake(6));
        st.hold = .9;
        break;
      }
      case 'punch': {
        const s = st.spots[0];
        const dest = freeSpot(api, s.x, s.y, z.r) || { x: z.x, y: z.y };
        startArc(z, st, dest.x, dest.y, .55, 120, api => {
          api.strike(s.x, s.y, 310, D * 2.6, null, 'crater', true);
          api.knockback(z, 320, 180, 0);
          addFx(st, { kind: 'crater', x: s.x, y: s.y, r: 310, dur: 2.2, rgb: '255,140,190', pink: 1 });
          api.shake(22);
        });
        st.hold = .9;
        break;
      }
      case 'katon': {
        const len = st.spots[0].len, sp = 700, hx = z.x + fac * 14, hy = z.y, ex = hx + ca * len, ey = hy + sa * len, ta = len / sp;
        addFx(st, { kind: 'fireball', x0: R(hx), y0: R(hy), a: r1(a), len, sp, r: 62, dur: ta + 1.5 });
        lineHits(st, hx, hy, a, len, sp, 66, D * 1.0, null, 200);
        later(st, ta, api => {
          api.strike(ex, ey, 270, D * 2.2, null, 'fire', true);
          addFx(st, { kind: 'flames', x: R(ex), y: R(ey), r: 220, dur: 3.2 });
          api.shake(14);
        });
        for (let k = 1; k <= 5; k++) later(st, ta + k * .5, api => api.strike(ex, ey, 210, D * .32, null, null, true));
        st.hold = .6;
        break;
      }
      case 'heel': {
        const sp = 1200, len = 680;
        startArc(z, st, z.x, z.y, .36, 70, api => {
          addFx(st, { kind: 'fissure', x: R(z.x), y: R(z.y), a: r1(a), len, sp, dur: len / sp + 1.6 });
          api.strike(z.x, z.y, 130, D * 1.6, null, 'crater', true);
          lineHits(st, z.x, z.y, a, len, sp, 56, D * 1.7, 'earth', 170);
          api.shake(16);
        });
        st.hold = 1.0;
        break;
      }
      case 'combo': {
        // Wire-shuriken trap → Chidori charge through the target → leaping Shannarō finisher.
        const s = st.spots[0], R0 = 250, stakes = [];
        for (let i = 0; i < 8; i++) { const aa = i * TAU / 8 + seed; stakes.push({ x: R(s.x + Math.cos(aa) * R0), y: R(s.y + Math.sin(aa) * R0) }); }
        addFx(st, { kind: 'wires', x: s.x, y: s.y, list: stakes, x0: R(z.x), y0: R(z.y), dur: 2.3 });
        later(st, .45, api => { api.strike(s.x, s.y, R0, D * 1.1, null, null, true); api.shake(6); });
        later(st, .7, api => {
          const d = Math.hypot(s.x - z.x, s.y - z.y), aa = Math.atan2(s.y - z.y, s.x - z.x);
          startDash(z, st, aa, d + 110, .3, D * 2, 64, api => {
            api.strike(z.x, z.y, 180, D * 1.3, null, 'lightning', true);
            addFx(st, { kind: 'bolt', x: R(z.x), y: R(z.y), r: 200, dur: .9 });
            api.shake(10);
            later(st, .12, api => {
              const dest = freeSpot(api, s.x, s.y, z.r) || { x: z.x, y: z.y };
              startArc(z, st, dest.x, dest.y, .5, 150, api => {
                api.strike(s.x, s.y, 380, D * 3.0, null, 'crater', true);
                api.knockback(z, 390, 230, 0);
                addFx(st, { kind: 'crater', x: s.x, y: s.y, r: 390, dur: 2.4, rgb: '255,120,150', pink: 1 });
                addFx(st, { kind: 'bolt', x: s.x, y: s.y, r: 300, dur: 1.0 });
                api.world(s.x, s.y, 320, D * 4, 'crater');
                api.shake(26); st.chid = 0;
              });
            });
          }, '160,205,255', true);
        });
        st.hold = 2.3;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Mitsuki
  function castMitsuki(z, st, api, move, D, a, ca, sa, seed) {
    switch (move) {
      case 'arms': {
        const len = 700, sp = 2300, x0 = z.x, y0 = z.y, te = len / sp;
        addFx(st, { kind: 'arm', a: r1(a), len, sp, dur: te + .55 });
        lineHits(st, x0, y0, a, len, sp, 36, D * 1.8, null, 175);
        later(st, te + .03, api => {
          const q = victim(api, x0 + ca * len / 2, y0 + sa * len / 2, len / 2 + 60);
          if (q && segDist(q.x, q.y, x0, y0, x0 + ca * len, y0 + sa * len) < 70) {
            const dd = Math.hypot(q.x - z.x, q.y - z.y);
            api.knockback(z, len + 80, -Math.min(520, Math.max(0, dd - 100)), D * .4);
          }
          api.shake(7);
        });
        st.hold = .9;
        break;
      }
      case 'snakes': {
        const list = [];
        for (let i = 0; i < 9; i++) list.push({ a: r1(a + (i / 8 - .5) * .84 + (hash(i + seed) - .5) * .08), len: R(420 + hash(i * 2.7 + seed) * 180), ph: r1(hash(i * 5.1 + seed) * 6) });
        addFx(st, { kind: 'snakes', x: R(z.x), y: R(z.y), list, dur: 1.4 });
        conePts(z.x, z.y, a, 600, .46).forEach(q => later(st, .1 + q.d / 1500, api => api.strike(q.x, q.y, q.r, D * 1.5, null, null, true)));
        api.shake(6);
        st.hold = 1.0;
        break;
      }
      case 'lsnake': {
        const len = 860, sp = 1150, x0 = z.x, y0 = z.y, ex = x0 + ca * len, ey = y0 + sa * len;
        addFx(st, { kind: 'lsnake', x0: R(x0), y0: R(y0), a: r1(a), len, sp, dur: len / sp + .5 });
        lineHits(st, x0, y0, a, len, sp, 60, D * 1.6, null, 170);
        later(st, len / sp, api => {
          api.strike(ex, ey, 190, D * 1.5, null, 'lightning', true);
          addFx(st, { kind: 'bolt', x: R(ex), y: R(ey), r: 200, dur: .9 });
          api.shake(10);
        });
        st.hold = .6;
        break;
      }
      case 'wind': {
        const list = [], sp = 1300, len = 740;
        for (let i = 0; i < 3; i++) {
          const aa = a + (i - 1) * .2, t0 = i * .17;
          list.push({ a: r1(aa), t0: r1(t0) });
          for (let dd = 100; dd <= len; dd += 120) later(st, t0 + dd / sp, api => api.strike(z.x + Math.cos(aa) * dd, z.y + Math.sin(aa) * dd, 105, D * .95, null, null, true));
          later(st, t0 + len / sp * .6, api => api.world(z.x + Math.cos(aa) * len * .6, z.y + Math.sin(aa) * len * .6, 110, D * 1.6, 'blade', aa));
        }
        addFx(st, { kind: 'blades', x0: R(z.x), y0: R(z.y), list, sp, len, dur: len / sp + .6 });
        api.shake(6);
        st.hold = .7;
        break;
      }
      case 'sage': {
        st.sage = 12;
        addFx(st, { kind: 'sagePulse', x: R(z.x), y: R(z.y), r: 340, dur: 1.3 });
        api.strike(z.x, z.y, 340, D * 1.8, null, 'shockwave', true);
        api.knockback(z, 340, 200, 0);
        api.shake(14);
        st.hold = .5;
        break;
      }
      case 'swarm': {
        // Giant white snakes burst from the ground round the target and strike inward; then the
        // colossal serpent lunges along the whole line.
        const s = st.spots[0], list = [];
        st.sage = Math.max(st.sage, 4);
        for (let i = 0; i < 6; i++) {
          const aa = seed + i * TAU / 6, x = s.x + Math.cos(aa) * 300, y = s.y + Math.sin(aa) * 300;
          const t0 = r1(i * .1);
          list.push({ x: R(x), y: R(y), t0 });
          later(st, t0 + .05, api => { api.strike(x, y, 120, D * 1.1, null, 'earth', true); });
          later(st, t0 + .78, api => { api.strike(s.x, s.y, 200, D * .85, null, i % 2 ? null : 'crater', true); api.shake(8); });
        }
        addFx(st, { kind: 'giants', tx: s.x, ty: s.y, list, dur: 2.4 });
        const t1 = 1.55, len = 1000, x0 = z.x - Math.cos(a) * 60, y0 = z.y - Math.sin(a) * 60;
        later(st, t1 - .5, api => addFx(st, { kind: 'serpent', x0: R(x0), y0: R(y0), a: r1(a), len, dur: 2.0 }));
        lineHits(st, x0, y0, a, len, 1900, 84, D * 2.2, 'crater', 200, t1);
        later(st, t1 + len / 1900, api => { api.strike(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, 260, D * 1.5, null, 'crater', true); api.shake(22); });
        st.hold = 2.7;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Kawaki
  function castKawaki(z, st, api, move, D, a, ca, sa, seed) {
    switch (move) {
      case 'spikes': {
        const len = 720, sp = 1400;
        addFx(st, { kind: 'spikes', x0: R(z.x), y0: R(z.y), a: r1(a), len, sp, dur: len / sp + 1.2 });
        lineHits(st, z.x, z.y, a, len, sp, 60, D * 1.9, 'earth', 160);
        api.shake(8);
        st.hold = .7;
        break;
      }
      case 'hammer': {
        const s = st.spots[0], dest = freeSpot(api, s.x - Math.cos(a) * 50, s.y - Math.sin(a) * 50, z.r) || { x: z.x, y: z.y };
        startArc(z, st, dest.x, dest.y, .55, 140, api => {
          api.strike(s.x, s.y, 300, D * 2.6, null, 'crater', true);
          api.knockback(z, 320, 180, 0);
          addFx(st, { kind: 'crater', x: s.x, y: s.y, r: 300, dur: 2.2, rgb: '160,150,255', pink: 0 });
          api.shake(22);
          st.ham = .45;
        });
        st.hold = 1.0;
        break;
      }
      case 'absorb': {
        const T1 = .95;
        addFx(st, { kind: 'kama', x: R(z.x), y: R(z.y), r: 360, t1: T1, dur: T1 + .2, dark: 1 });
        for (let k = 0; k < 2; k++) later(st, .2 + k * .4, api => api.knockback(z, 380, -60, 0));
        later(st, T1, api => {
          // Fire the absorbed chakra back at whoever stands in front now.
          const p = api.player, aa = p ? Math.atan2(p.y - z.y, p.x - z.x) : st.aim;
          const fx = addFx(st, { kind: 'beam', a: r1(aa), len: 980, dur: .85 });
          void fx;
          for (let k = 0; k < 4; k++) later(st, .05 + k * .16, api => api.line(z.x, z.y, z.x + Math.cos(aa) * 980, z.y + Math.sin(aa) * 980, 46, D * .9, k === 1 ? 'shockwave' : null));
          api.shake(14);
        });
        st.hold = T1 + .8;
        break;
      }
      case 'lance': {
        const sp0 = st.spots[0], sw = 2.5, T = .5;
        const fx = addFx(st, { kind: 'lance', a0: sp0.a0, dir: sp0.dir, sw, T, len: 560, dur: T + .5, tick: 0 });
        fx.upd = (f, dt, api) => {
          if (f.age > f.T || f.age < .06) return;
          const ang = f.a0 + f.dir * f.sw * easeInOut(f.age / f.T), L = f.len * easeOut(f.age / .12);
          if ((f.tick -= dt) <= 0) { f.tick = .06; api.line(z.x, z.y, z.x + Math.cos(ang) * L, z.y + Math.sin(ang) * L, 30, D * 1.6); }
        };
        later(st, T * .5, api => api.world(z.x + ca * 380, z.y + sa * 380, 120, D * 2, 'blade', a));
        api.shake(8);
        st.hold = T + .3;
        break;
      }
      case 'cubes': {
        const list = st.spots.map((s, i) => ({ x: s.x, y: s.y, s: s.s, t0: r1(i ? .25 + i * .14 : .1), fall: .42 }));
        addFx(st, { kind: 'cubes', list, dur: 2.5 });
        list.forEach((c, i) => later(st, c.t0 + c.fall, api => { api.strike(c.x, c.y, c.s * .58, D * 2.0, null, 'crater', true); api.shake(i ? 8 : 14); }));
        st.hold = 1.1;
        break;
      }
      case 'rain': {
        const n = st.spots.length, list = st.spots.map((s, i) => ({ x: s.x, y: s.y, s: s.s, t0: i === n - 1 ? 1.9 : r1(.15 + i * .12), fall: i === n - 1 ? .7 : .4 }));
        addFx(st, { kind: 'cubes', list, dur: 3.8, big: 1 });
        list.forEach((c, i) => later(st, c.t0 + c.fall, api => {
          const last = i === n - 1;
          api.strike(c.x, c.y, c.s * .6, D * (last ? 3.4 : 1.4), null, 'crater', true);
          if (last) { api.world(c.x, c.y, 320, D * 4, 'crater'); addFx(st, { kind: 'karmaBurst', x: c.x, y: c.y, r: 480, dur: 1.4 }); addFx(st, { kind: 'impact', x: c.x, y: c.y, r: 380, dur: 1.5, rgb: '150,130,255' }); }
          api.shake(last ? 26 : 7);
        }));
        st.hold = 2.9;
        break;
      }
    }
  }

  // ================================================================== update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.arc = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.lift = 0;
      st.vanish = 0; st.orb = 0; st.ham = 0; st.chid = 0; st.karma = 0;
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); if (ev.fn) ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.karma = Math.max(0, st.karma - dt);
    st.sage = Math.max(0, st.sage - dt);
    st.ham = Math.max(0, st.ham - dt);
    st.chid = Math.max(0, st.chid - dt);
    z.armorScale = (m.armor || 1) * (st.karma > 0 ? .85 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      const tr = st.fx.find(f => f.kind === 'dash' && f.age < .45 && f.a === ds.a);
      if (tr) { tr.x1 = R(z.x); tr.y1 = R(z.y); tr.pts.push(R(z.x), R(z.y)); if (tr.pts.length > 16) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (end) end(api); }
    }
    if (st.arc) {
      const ar = st.arc;
      ar.t += dt;
      const k = clamp01(ar.t / ar.dur), e = easeInOut(k);
      const nx = ar.x0 + (ar.x1 - ar.x0) * e, ny = ar.y0 + (ar.y1 - ar.y0) * e;
      if (!api.blocked(nx, ny, z.r * .5)) { z.x = nx; z.y = ny; }
      st.lift = ar.h * Math.sin(Math.PI * k);
      z.kageDash = .05;
      if (k >= 1) { const end = ar.end; st.arc = null; st.lift = 0; if (end) end(api); }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      // the Rain: Kawaki floats up on Karma while the cubes gather
      if (z.bossId === 'kawaki' && st.move === 'rain') st.lift = 26 * easeOut(1 - st.windup / st.windMax);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && st.hold <= 0) {
      if (z.bossId === 'kawaki' && st.lift > 0 && !st.arc) st.lift = Math.max(0, st.lift - dt * 60);
      if (z.manual) {
        const want = z.manualCast != null ? m.kit[z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, m, api);
      }
    }
    if (z.bossId === 'kawaki' && st.hold > 0 && !st.arc && st.lift > 0 && st.move === '') st.lift = Math.max(0, st.lift - dt * 30);
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ================================================================== cached art
  const SW = {
    wind: () => Kit().swirl('bt-wind', ['rgba(225,245,255,.95)', 'rgba(120,190,255,.85)', 'rgba(255,255,255,.95)', 'rgba(70,140,230,.8)'], 8, 1.25, .08, 128, 3.6),
    windDark: () => Kit().swirl('bt-wind-d', ['rgba(20,50,110,.7)', 'rgba(40,90,170,.6)'], 6, 1.2, .1, 128, 5),
    karma: () => Kit().swirl('bt-karma', ['rgba(16,12,28,.92)', 'rgba(90,70,170,.85)', 'rgba(40,30,80,.9)'], 7, 1.4, .06, 128, 4),
    gold: () => Kit().swirl('bt-gold', ['rgba(255,240,170,.95)', 'rgba(255,200,80,.85)', 'rgba(255,255,230,.9)'], 6, 1.1, .1, 128, 3.2)
  };
  // Shuriken: four blades round a ring, steel with a lit edge.
  function shurImg() {
    return Kit().sprite('bt-shur', 48, 48, g => {
      g.translate(24, 24);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
        g.lineTo(Math.cos(a + .55) * 6.5, Math.sin(a + .55) * 6.5);
        g.lineTo(Math.cos(a + .78) * 5, Math.sin(a + .78) * 5);
      }
      g.closePath();
      g.fillStyle = '#5c6474'; g.fill(); g.strokeStyle = '#14161c'; g.lineWidth = 2.4; g.stroke();
      g.fillStyle = '#c7d0dc';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); g.lineTo(Math.cos(a + .5) * 6, Math.sin(a + .5) * 6); g.lineTo(Math.cos(a + .2) * 5, Math.sin(a + .2) * 5); g.closePath(); g.fill(); }
      g.fillStyle = '#14161c'; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
      g.strokeStyle = '#9aa4b4'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.stroke();
    });
  }
  function rockImg(v) {
    return Kit().sprite('bt-rock:' + (v % 4), 40, 40, g => {
      const n = 7, pts = [];
      for (let i = 0; i < n; i++) { const a = i * TAU / n + hash(v * 7 + i) * .5, r = 12 + hash(v * 3 + i * 1.7) * 7; pts.push([20 + Math.cos(a) * r, 20 + Math.sin(a) * r * .85]); }
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = '#8c7a62'; g.fill(); g.strokeStyle = '#2e2418'; g.lineWidth = 2.2; g.stroke();
      g.fillStyle = '#b8a688'; g.beginPath(); g.moveTo(pts[4][0], pts[4][1]); g.lineTo(pts[5][0], pts[5][1]); g.lineTo(pts[6][0], pts[6][1]); g.lineTo(20, 18); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,26,14,.35)'; g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(20, 22); g.closePath(); g.fill();
    });
  }

  // ================================================================== telegraph painters
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,40,.42)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
  }
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1, a1 < a0); ctx.arc(x, y, r0, a1, a0, a1 >= a0); ctx.closePath();
  }
  function sqTele(ctx, x, y, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, h = s / 2;
    ctx.fillStyle = 'rgba(20,12,30,.2)'; ctx.fillRect(x - h, y - h, s, s);
    ctx.fillStyle = `rgba(${rgb},${.12 + .18 * k})`; ctx.fillRect(x - h * k, y - h * k, s * k, s * k);
    ctx.strokeStyle = 'rgba(20,14,30,.5)'; ctx.lineWidth = 5; ctx.strokeRect(x - h, y - h, s, s);
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.6; ctx.strokeRect(x - h, y - h, s, s);
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y + h); ctx.moveTo(x + h, y - h); ctx.lineTo(x - h, y + h); ctx.stroke();
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    if (s.k === 'sq') { sqTele(ctx, s.x, s.y, s.s, rgb, k, time); return; }
    if (s.k === 'ring') {
      const am = s.a0 + (s.a1 - s.a0) * clamp01(k);
      ctx.fillStyle = 'rgba(24,12,30,.15)'; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, s.a1); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, am); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,40,.4)'; ctx.lineWidth = 5; sector(ctx, s.x, s.y, s.r0, s.r1, s.a0, s.a1); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      if (s.len < 4) { ctx.restore(); return; }
      ctx.fillStyle = 'rgba(24,12,30,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeStyle = 'rgba(30,20,40,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,30,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,40,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================================== shared VFX pieces
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .5) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
    }
  }
  function impactO(ctx, x, y, r, t, seed, rgb) {
    const K = Kit();
    if (t < 0) return;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) K.glow(ctx, x, y - 10, r * (.6 + t * 2), rgb, (1 - t / .35) * .9, true, .7);
    K.fx.shockRing(ctx, x, y, r * 1.1, t * 1.4, Math.max(0, 1 - t * 1.2), rgb);
    if (t > .1) K.fx.shockRing(ctx, x, y, r * 1.35, (t - .1) * 1.2, Math.max(0, .8 - t), '255,250,255');
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, x, y, r, t, seed, 12);
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.1, t / 1.1, seed, '#3a2c22', 12);
  }
  function scorchG(ctx, x, y, r, alpha, seed, col = '30,18,14') {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(${col},${.32 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .8, r * .4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${.7 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .25);
      ctx.lineTo(x + Math.cos(b) * r * .85, y + Math.sin(b) * r * .43);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * .58);
    }
    ctx.stroke();
  }
  function crescent(ctx, cx, cy, Rr, w, a0, a1, sq) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u, prof = Math.sin(Math.PI * u);
      ctx.lineTo(cx + Math.cos(an) * (Rr - w * prof), cy + Math.sin(an) * (Rr - w * prof) * sq);
    }
    ctx.closePath();
  }
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255', lift = 34) {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .8})` : `rgba(30,14,30,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - lift); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - lift);
      }
      ctx.stroke();
    }
  }
  function smokePoof(ctx, x, y, r, t, seed, kind = 'poof') {
    const K = Kit(), pf = K.puff(kind), e = easeOut(t / .6), a = 1 - win(t, .35, 1);
    if (a <= 0 || t < 0) return;
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .5, d = r * (.15 + e * (.5 + hash(i * 2.1 + seed) * .3));
      K.stamp(ctx, pf, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - r * .25 - e * r * .2 * hash(i * 3 + seed), r * (.22 + e * .2), a * .9);
    }
    K.stamp(ctx, pf, x, y - r * .35, r * (.35 + e * .25), a);
  }
  function rasOrb(ctx, x, y, r, time, alpha = 1) {
    if (alpha <= .01 || r < 1) return;
    ctx.save(); ctx.translate(x, y); Kit().fx.rasenganOrb(ctx, r, time, alpha); ctx.restore();
  }
  function groundShadow(ctx, x, y, r, a = .25) {
    ctx.fillStyle = `rgba(16,20,10,${a})`; ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * .36, 0, 0, TAU); ctx.fill();
  }
  const BOLT_PAL = ['70,130,255', '150,200,255', '240,250,255'];
  function bolt(ctx, x1, y1, x2, y2, seed, time, w = 1.4, alpha = 1, forks = 1, pal = BOLT_PAL) {
    Kit().forkedBolt(ctx, x1, y1, x2, y2, seed, time, { jitter: Math.min(26, Math.hypot(x2 - x1, y2 - y1) * .12 + 3), alpha, width: w, pal,
      base: 'rgba(16,26,80,.55)', forkBase: true, step: 16, forks, forkLen: 26, rate: 24, snap: true });
  }
  // Black jagged Karma lines radiating from a point (ground).
  function karmaLines(ctx, x, y, r, k, alpha, seed, sq = .5) {
    if (alpha <= .01) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(130,150,255,${.55 * alpha})` : `rgba(10,8,18,${.85 * alpha})`;
      ctx.lineWidth = pass ? 1.4 : 4.2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a0 = i * TAU / 12 + hash(i + seed) * .3, L = r * k * (.55 + hash(i * 2.3 + seed) * .45);
        let px = x, py = y; ctx.moveTo(px, py);
        for (let j = 1; j <= 4; j++) {
          const d = L * j / 4, aa = a0 + (hash(i * 7 + j + seed) - .5) * .5;
          px = x + Math.cos(aa) * d; py = y + Math.sin(aa) * d * sq; ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }
  // Isometric-ish black cube: footprint (x, y, s), floating `up` px above the ground.
  function drawCube(ctx, x, y, s, up, alpha, time, seed) {
    if (alpha <= .01) return;
    const h = s / 2, Hh = s * .42, T = s * .8, bottom = y + h - up, top = bottom - Hh - T, ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * alpha;
    // front face, then the lit top face
    ctx.fillStyle = '#0c0b12'; ctx.fillRect(x - h, bottom - Hh, s, Hh);
    ctx.fillStyle = 'rgba(70,60,130,.35)'; ctx.fillRect(x - h, bottom - Hh, s * .16, Hh);
    ctx.fillStyle = '#25232f'; ctx.fillRect(x - h, top, s, T);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x - h, top, s, T * .2);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + h * .6, top, h * .4, T);
    ctx.strokeStyle = '#05040a'; ctx.lineWidth = 3; ctx.strokeRect(x - h, top, s, T + Hh);
    ctx.strokeStyle = 'rgba(150,140,255,.7)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - h, top + T); ctx.lineTo(x + h, top + T); ctx.moveTo(x - h + 1.5, top + 1.5); ctx.lineTo(x + h - 1.5, top + 1.5); ctx.stroke();
    // Karma glyph glowing faintly on the top face
    const cy = top + T / 2, gh = T * .36;
    ctx.strokeStyle = `rgba(140,150,255,${.4 + .2 * Math.sin(time * 4 + seed)})`; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, cy - gh); ctx.lineTo(x + h * .42, cy); ctx.lineTo(x, cy + gh); ctx.lineTo(x - h * .42, cy); ctx.closePath();
    ctx.moveTo(x - h * .8, cy); ctx.lineTo(x - h * .45, cy); ctx.moveTo(x + h * .45, cy); ctx.lineTo(x + h * .8, cy);
    ctx.stroke();
    ctx.globalAlpha = ga;
  }
  // Snake body along a flat point list [x0,y0,x1,y1,...], tapering w0 → w1; head at the end.
  function snakeBody(ctx, pts, w0, w1, body, belly, alpha, open, eye = '#f2c62a') {
    const n = pts.length / 2 - 1;
    if (n < 1 || alpha <= .01) return;
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const W = i => w0 + (w1 - w0) * i / n;
    const strokeAll = (c, kw, add, off) => {
      ctx.strokeStyle = c;
      for (let i = 0; i < n; i++) {
        const w = W(i), o = w * off;
        ctx.lineWidth = w * kw + add;
        ctx.beginPath(); ctx.moveTo(pts[i * 2], pts[i * 2 + 1] - o); ctx.lineTo(pts[i * 2 + 2], pts[i * 2 + 3] - o); ctx.stroke();
      }
    };
    // ink outline → shadow side → lit back → glossy ridge
    strokeAll('#1a1424', 1, 4, 0);
    strokeAll(dark2(body), 1, 0, 0);
    strokeAll(body, .7, 0, .13);
    strokeAll(belly, .22, 0, .26);
    // scale bands (chevrons pointing back along the body)
    ctx.strokeStyle = 'rgba(70,50,100,.45)'; ctx.lineWidth = Math.max(1, w0 * .06);
    ctx.beginPath();
    for (let i = 1; i < n; i += 1) {
      const x = pts[i * 2], y = pts[i * 2 + 1], dx = pts[i * 2 + 2] - pts[i * 2 - 2], dy = pts[i * 2 + 3] - pts[i * 2 - 1], L = Math.hypot(dx, dy) || 1, w = W(i) * .42;
      const ux = dx / L, uy = dy / L;
      ctx.moveTo(x - uy * w - ux * w * .5, y + ux * w - uy * w * .5); ctx.lineTo(x, y); ctx.lineTo(x + uy * w - ux * w * .5, y - ux * w - uy * w * .5);
    }
    ctx.stroke();
    // head: a broad wedge wider than the neck, both eyes on top, jaws split when it bites
    const hx = pts[n * 2], hy = pts[n * 2 + 1], ha = Math.atan2(hy - pts[n * 2 - 1], hx - pts[n * 2 - 2]), hs = Math.max(w1 * 1.6 + 3, 7);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
    const jaw = open ? .42 : 0;
    if (open) {
      ctx.fillStyle = '#6a1428'; ctx.beginPath(); ctx.moveTo(-hs * .1, 0); ctx.lineTo(hs * 1.4, -hs * .62); ctx.lineTo(hs * 1.4, hs * .62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hs * 1.05, sg * hs * .42); ctx.lineTo(hs * 1.2, sg * hs * .14); ctx.lineTo(hs * 1.3, sg * hs * .46); ctx.closePath(); ctx.fill(); }
    }
    for (const sg of [-1, 1]) {
      ctx.save(); ctx.rotate(sg * jaw);
      ctx.beginPath(); ctx.moveTo(-hs * .5, 0); ctx.lineTo(-hs * .45, sg * hs * .42);
      ctx.quadraticCurveTo(hs * .3, sg * hs * .72, hs * 1.0, sg * hs * .42); ctx.quadraticCurveTo(hs * 1.45, sg * hs * .2, hs * 1.5, 0); ctx.closePath();
      ctx.fillStyle = sg < 0 ? body : dark2(body); ctx.fill(); ctx.strokeStyle = '#1a1424'; ctx.lineWidth = Math.max(1.6, hs * .08); ctx.stroke();
      // eye on this side of the head, slit pupil
      ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(hs * .5, sg * hs * .36, hs * .17, hs * .11, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1a1424'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#120a10'; ctx.fillRect(hs * .48, sg * hs * .36 - hs * .09, hs * .05, hs * .18);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = ga;
  }
  const dark2 = c => c === '#eeeaf4' ? '#bdb4d2' : c === '#e4def0' ? '#b4aacb' : '#8a8098';
  // Serpent spine sampler: from (x0,y0) heading a, length L, sine wiggle amplitude amp, wavelength wl, phase ph.
  function spine(out, x0, y0, a, L, n, amp, wl, ph, taperFrom0 = true) {
    const ca = Math.cos(a), sa = Math.sin(a);
    out.length = 0;
    for (let i = 0; i <= n; i++) {
      const d = L * i / n, env = taperFrom0 ? Math.min(1, d / 80) : 1, o = Math.sin(d / wl * TAU + ph) * amp * env;
      out.push(x0 + ca * d - sa * o, y0 + sa * d + ca * o);
    }
    return out;
  }
  const PTS = [];

  // ================================================================== effect painters [ground, overlay]
  const FX = {
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed),
      (ctx, fx) => impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb || '255,200,160')
    ],
    poof: [null, (ctx, fx) => smokePoof(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed)],
    mark: [(ctx, fx, time) => markCircle(ctx, fx.x, fx.y, fx.r, fx.rgb, clamp01(fx.age / fx.dur), time, false), null],

    dash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust');
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(40,24,30,${.3 * a})`; ctx.lineWidth = 20; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        for (let d = 0; d < len; d += 50) {
          const t = d / len, j = hash(d * .1 + fx.seed);
          K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 15 + j * 14, a * .6, .75);
        }
      },
      (ctx, fx, time, z) => {
        const S = Spr(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), fac = Math.cos(fx.a) >= 0 ? 1 : -1;
        for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const k = i / fx.pts.length;
          if (S) S.draw(ctx, z.bossId, fx.pts[i], fx.pts[i + 1] + 3, { facing: fac, frame: 'attack', alpha: (.12 + k * .3) * a });
        }
        speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 36, a, fx.seed, fx.rgb);
        if (fx.bolt && a > .05) {
          ctx.globalCompositeOperation = 'lighter';
          const L = liftH();
          for (let i = 0; i < 3; i++) {
            const o = (i - 1) * 14;
            bolt(ctx, fx.x0, fx.y0 - L + o, fx.x1, fx.y1 - L + o * .5, fx.seed + i * 7, time, 1.3, a, 2);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],

    // ---- Boruto
    ras: [
      (ctx, fx) => {
        const d = Math.min(fx.len, fx.age * fx.sp);
        if (fx.age * fx.sp > fx.len) return;
        const vis = fx.v1 ? (d < fx.v0 ? 1 : d > fx.v1 ? win(d, fx.v1, fx.v1 + 40) : 1 - win(d, fx.v0, fx.v0 + 40)) : 1;
        groundShadow(ctx, fx.x0 + Math.cos(fx.a) * d, fx.y0 + Math.sin(fx.a) * d, fx.r * 1.3, .3 * vis);
      },
      (ctx, fx, time) => {
        if (fx.age * fx.sp > fx.len) return;
        const d = fx.age * fx.sp, L = liftH(), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        const x = fx.x0 + ca * d, y = fx.y0 + sa * d - L;
        const vis = fx.v1 ? (d < fx.v0 ? 1 : d > fx.v1 ? win(d, fx.v1, fx.v1 + 40) : 1 - win(d, fx.v0, fx.v0 + 40)) : 1;
        // wind wake trailing the sphere
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const o = (i - 2) * fx.r * .35, back = 60 + hash(i + fx.seed) * 60;
          ctx.strokeStyle = `rgba(30,60,120,${.25 * vis})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x - ca * 8 - sa * o, y - sa * 8 + ca * o); ctx.lineTo(x - ca * back - sa * o, y - sa * back + ca * o); ctx.stroke();
          ctx.strokeStyle = `rgba(200,235,255,${.6 * vis})`; ctx.lineWidth = 1.6; ctx.stroke();
        }
        rasOrb(ctx, x, y, fx.r, time, vis);
        if (fx.v1 && vis < .95) {
          // the hidden sphere: only a heat-shimmer ripple shows where it is
          const ph = (time * 6) % 1;
          ctx.strokeStyle = `rgba(220,240,255,${.35 * (1 - vis) * (1 - ph)})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, y, fx.r * (1 + ph * 1.6), fx.r * (1 + ph * 1.6) * .8, 0, 0, TAU); ctx.stroke();
          if (d > fx.v1 && d < fx.v1 + 50) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x, y, fx.r * 4, '150,210,255', (1 - (d - fx.v1) / 50) * .9, true); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
    ],
    vortex: [
      (ctx, fx, time) => {
        const t = fx.age / fx.dur, a = 1 - win(t, .55, 1), K = Kit(), e = easeOut(t * 2);
        ctx.fillStyle = `rgba(30,26,30,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r * .55 * e, fx.r * .27 * e, 0, 0, TAU); ctx.fill();
        K.spin(ctx, SW.windDark(), fx.x, fx.y, fx.r * (.5 + e * .5), -time * 8, a * .6, .5);
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, SW.wind(), fx.x, fx.y, fx.r * (.45 + e * .55), -time * 9, a * .7, .5);
        ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 12);
      },
      (ctx, fx, time) => {
        const t = fx.age / fx.dur;
        Kit().fx.windDome(ctx, fx.x, fx.y, fx.r * .9, t, 1 - win(t, .4, 1), time, false);
        if (fx.age < .9) Kit().fx.debris(ctx, fx.x, fx.y, fx.r, fx.age / .9, fx.seed, '#4c443c', 10);
      }
    ],
    uzu: [
      (ctx, fx, time) => {
        const K = Kit(), T = fx.T, grow = easeOut(fx.age / .4), a = 1 - win(fx.age, T, fx.dur), r = fx.r * (.4 + .6 * grow);
        ctx.fillStyle = `rgba(20,30,50,${.28 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .5, 0, 0, TAU); ctx.fill();
        K.spin(ctx, SW.windDark(), fx.x, fx.y, r * 1.02, -time * 6, a * .55, .5);
        ctx.globalCompositeOperation = 'source-over';
        K.spin(ctx, SW.wind(), fx.x, fx.y, r, -time * 7.5, a * .55, .5);
        K.spin(ctx, SW.wind(), fx.x, fx.y, r * .62, time * 5, a * .32, .5); ctx.globalCompositeOperation = 'lighter';
        if (fx.big) K.spin(ctx, SW.karma(), fx.x, fx.y, r * .8, -time * 4, a * .5, .5);
        K.glow(ctx, fx.x, fx.y, r * .9, '90,170,255', .2 * a, false, .5);
        ctx.globalCompositeOperation = 'source-over';
        // grooves cut into the ground
        ctx.strokeStyle = `rgba(26,22,26,${.4 * a})`; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a0 = k * TAU / 6 + fx.seed;
          for (let j = 0; j <= 10; j++) { const u = j / 10, aa = a0 + u * 2.4, rr = r * (.15 + u * .9), px = fx.x + Math.cos(aa) * rr, py = fx.y + Math.sin(aa) * rr * .5; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        }
        ctx.stroke();
        dustRing(ctx, fx.x, fx.y, r * 1.1, (fx.age % 1.2), fx.seed + Math.floor(fx.age / 1.2), 12, 'dust', .55 * a);
      },
      (ctx, fx, time) => {
        // The tornado: stacked spinning wind rings rising and widening, rocks orbiting, the sphere at its eye.
        const K = Kit(), T = fx.T, grow = easeOut(fx.age / .4), a = 1 - win(fx.age, T, fx.dur), r = fx.r * (.4 + .6 * grow);
        const Hh = r * 1.25 * grow;
        for (let i = 0; i < 7; i++) {
          const u = i / 6, rr = r * (.28 + u * .55), y = fx.y - Hh * u;
          ctx.globalCompositeOperation = 'source-over';
          K.spin(ctx, SW.windDark(), fx.x + Math.sin(time * 3 + i) * 8, y, rr, -time * (9 - i * .6), a * .28, .32);
          ctx.globalCompositeOperation = 'source-over';
          K.spin(ctx, SW.wind(), fx.x + Math.sin(time * 3 + i) * 8, y, rr, -time * (10 - i * .7) + i, a * (.42 - u * .14), .32);
        }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - Hh * .3, r * .9, '120,190,255', .22 * a, false, 1.2);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 10; i++) {
          const ang = time * (2.4 + hash(i) * 1.4) + i * 1.7, u = (hash(i * 2.2 + fx.seed) + time * .25) % 1, rr = r * (.3 + u * .55);
          ctx.globalAlpha = a * (1 - u * .5);
          ctx.drawImage(rockImg(i), fx.x + Math.cos(ang) * rr - 7, fx.y - Hh * u + Math.sin(ang) * rr * .32 - 7, 14 - u * 4, 14 - u * 4);
        }
        ctx.globalAlpha = 1;
        if (fx.age < T) rasOrb(ctx, fx.x, fx.y - 26, (fx.big ? 34 : 22) * (1 - win(fx.age, T - .3, T)), time, a);
      }
    ],
    shur: [
      (ctx, fx) => {
        for (const aa of fx.list) {
          const d = Math.min(fx.len, fx.age * fx.sp); if (fx.age * fx.sp > fx.len) continue;
          groundShadow(ctx, fx.x0 + Math.cos(aa) * d, fx.y0 + Math.sin(aa) * d, 9, .22);
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), L = liftH(), img = shurImg();
        fx.list.forEach((aa, i) => {
          const dd = fx.age * fx.sp, ca = Math.cos(aa), sa = Math.sin(aa);
          if (dd > fx.len + 40) return;
          const d = Math.min(dd, fx.len), x = fx.x0 + ca * d, y = fx.y0 + sa * d - L, al = 1 - win(dd, fx.len - 40, fx.len + 40);
          // trail of crackling blue
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(120,190,255,${.5 * al})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ca * Math.min(d, 130), y - sa * Math.min(d, 130)); ctx.stroke();
          K.glow(ctx, x, y, 30, '110,180,255', .7 * al);
          bolt(ctx, x - ca * 40, y - sa * 40, x, y, fx.seed + i * 5, time, 1, al, 0);
          for (let k = 0; k < 3; k++) { const ba = time * 20 + k * 2.1 + i; bolt(ctx, x, y, x + Math.cos(ba) * 26, y + Math.sin(ba) * 18, fx.seed + i * 11 + k, time, .7, al, 0); }
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.scale(1, .7); ctx.rotate(time * 26 + i); ctx.drawImage(img, -13, -13, 26, 26); ctx.restore();
          if (dd > fx.len - 10) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 50, '160,210,255', .9 * (1 - win(dd, fx.len, fx.len + 40)), true); ctx.globalCompositeOperation = 'source-over'; }
        });
      }
    ],
    clones: [
      (ctx, fx) => {
        for (const c of fx.list) {
          const t = fx.age - c.t0;
          if (t > .3 && t < 1.2) { scorchG(ctx, c.x1, c.y1, 90, 1 - win(t, .6, 1.2), fx.seed + c.x1 % 7); dustRing(ctx, c.x1, c.y1, 140, t - .3, fx.seed, 10); }
        }
      },
      (ctx, fx, time, z) => {
        const S = Spr(), L = liftH();
        if (!S) return;
        for (const c of fx.list) {
          const t = fx.age, tt = t - c.t0;
          const fac = c.x1 >= c.x0 ? 1 : -1;
          if (t < .15) smokePoof(ctx, c.x0, c.y0 + 4, 70, t + .1, fx.seed + c.x0 % 9);
          if (tt >= .62) { smokePoof(ctx, c.x1, c.y1 + 4, 76, tt - .62, fx.seed + c.y1 % 5); continue; }
          let x, y, frame = 'seal';
          if (tt < 0) { x = c.x0; y = c.y0; frame = 'raise'; }
          else if (tt < .3) {
            const e = easeIn(tt / .3); x = c.x0 + (c.x1 - c.x0) * e; y = c.y0 + (c.y1 - c.y0) * e; frame = 'attack';
            speedLines(ctx, c.x0, c.y0, x, y, 20, .8, fx.seed + c.x0 % 13, '220,235,255');
          } else { x = c.x1; y = c.y1; frame = 'attack'; }
          S.draw(ctx, 'boruto', x, y + 3, { facing: fac, frame });
          if (c.ras && tt < .34) rasOrb(ctx, x + fac * 18, y - L + 2, 11, time, 1);
          if (tt > .28 && tt < .62) {
            const k = (tt - .28) / .34;
            if (c.ras) Kit().fx.windDome(ctx, c.x1, c.y1, 120, k, 1 - k, time, false);
            else { ctx.globalCompositeOperation = 'lighter'; Kit().fx.shockRing(ctx, c.x1, c.y1, 140, k, 1 - k, '220,230,255'); ctx.globalCompositeOperation = 'source-over'; }
          }
        }
        void z;
      }
    ],
    gale: [
      (ctx, fx) => {
        const K = Kit(), dust = K.puff('dust'), a = 1 - win(fx.age, .5, fx.dur);
        for (let i = 0; i < 14; i++) {
          const u = hash(i + fx.seed), dd = 80 + u * fx.r * easeOut(fx.age / .45), aa = fx.a + (hash(i * 3 + fx.seed) - .5) * 2 * fx.h * .9;
          K.stamp(ctx, dust, fx.x + Math.cos(aa) * dd, fx.y + Math.sin(aa) * dd - 6, 16 + u * 18, a * .55, .7);
        }
      },
      (ctx, fx) => {
        const L = liftH(), a = 1 - win(fx.age, .7, fx.dur);
        for (let i = 0; i < 4; i++) {
          const t = fx.age - i * .07; if (t < 0) continue;
          const Rr = 60 + fx.r * easeOut(t / .6), w = 46 - i * 6, al = a * (1 - win(t, .45, .85));
          if (al <= .01) continue;
          crescent(ctx, fx.x, fx.y - L * .6, Rr, w, fx.a - fx.h, fx.a + fx.h, .6);
          ctx.strokeStyle = `rgba(20,40,70,${.5 * al})`; ctx.lineWidth = 4; ctx.stroke();
          ctx.fillStyle = `rgba(225,248,255,${.85 * al})`; ctx.fill();
          crescent(ctx, fx.x, fx.y - L * .6, Rr - 4, w * .4, fx.a - fx.h * .8, fx.a + fx.h * .8, .6);
          ctx.fillStyle = `rgba(120,200,255,${.7 * al})`; ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,255,255,${.7 * a})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const aa = fx.a + (hash(i * 5 + fx.seed) - .5) * 2 * fx.h, d0 = 60 + ((fx.age * 900 + hash(i) * 300) % fx.r), l = 50 + hash(i * 7) * 60;
          ctx.moveTo(fx.x + Math.cos(aa) * d0, fx.y + Math.sin(aa) * d0 - L * .6); ctx.lineTo(fx.x + Math.cos(aa) * (d0 + l), fx.y + Math.sin(aa) * (d0 + l) - L * .6);
        }
        ctx.stroke();
      }
    ],
    kama: [
      (ctx, fx, time, z) => {
        // Kāma sigil spinning under the feet, suction streaks crawling inward.
        const x = z ? z.x : fx.x, y = z ? z.y : fx.y, pre = fx.age < fx.t1, a = pre ? win(fx.age, 0, .2) : 1 - win(fx.age, fx.t1, fx.t1 + .3);
        if (a <= .01) return;
        ctx.save(); ctx.translate(x, y); ctx.scale(1, .5); ctx.rotate(time * .8);
        ctx.strokeStyle = `rgba(12,10,22,${.8 * a})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(70, 0); ctx.lineTo(0, 110); ctx.lineTo(-70, 0); ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = `rgba(150,160,255,${.7 * a})`; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.strokeStyle = `rgba(12,10,22,${.6 * a})`; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
        if (pre) {
          ctx.lineCap = 'round';
          for (let pass = 0; pass < 2; pass++) {
            ctx.strokeStyle = pass ? `rgba(170,160,255,${.75 * a})` : `rgba(14,10,26,${.6 * a})`; ctx.lineWidth = pass ? 1.6 : 4;
            ctx.beginPath();
            for (let i = 0; i < 18; i++) {
              const an = i * TAU / 18 + hash(i + fx.seed), ph = (time * 1.6 + hash(i * 3 + fx.seed)) % 1, d0 = fx.r * (1 - ph) + 30, l = 40 + 30 * (1 - ph);
              const a2 = an + .5 * (1 - ph);
              ctx.moveTo(x + Math.cos(a2) * d0, y + Math.sin(a2) * d0 * .5); ctx.lineTo(x + Math.cos(a2 - .15) * (d0 - l), y + Math.sin(a2 - .15) * (d0 - l) * .5);
            }
            ctx.stroke();
          }
        } else {
          const t = fx.age - fx.t1;
          ctx.globalCompositeOperation = 'lighter';
          Kit().fx.shockRing(ctx, x, y, fx.r * 1.1, t * 1.5, Math.max(0, 1 - t * 1.3), fx.dark ? '140,120,255' : '120,180,255');
          ctx.globalCompositeOperation = 'source-over';
        }
      },
      (ctx, fx, time, z) => {
        if (!z) return;
        const pre = fx.age < fx.t1, H = bodyH(z.bossId), fac = facingOf(z), K = Kit();
        const hx = z.x + fac * H * .26, hy = z.y + 3 - H * .42 - ((z.bt && z.bt.lift) || 0);
        if (pre) {
          const k = fx.age / fx.t1;
          // Chakra ribbons spiralling into the open palm.
          ctx.lineCap = 'round';
          for (let i = 0; i < 7; i++) {
            const ph = (time * 1.3 + i / 7) % 1, an = i * TAU / 7 + time * 1.2, d = 40 + (1 - ph) * 170;
            const sx = hx + Math.cos(an) * d, sy = hy + Math.sin(an) * d * .6;
            const cx = hx + Math.cos(an + 1.2) * d * .5, cy = hy + Math.sin(an + 1.2) * d * .3;
            ctx.strokeStyle = `rgba(14,10,28,${.6 * (1 - ph * .5)})`; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, hx, hy); ctx.stroke();
            ctx.strokeStyle = `rgba(160,150,255,${.8 * (1 - ph * .5)})`; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, hx, hy, 26 + 30 * k, '130,120,255', .7);
          K.spin(ctx, SW.karma(), hx, hy, 20 + 16 * k, -time * 10, .9, .8);
          K.glow(ctx, hx, hy, 10 + 6 * k, '230,235,255', .9, true);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          const t = fx.age - fx.t1;
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, hx, hy, 160 * (1 - t), fx.dark ? '140,120,255' : '120,190,255', Math.max(0, .9 - t), true);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    karmaBurst: [
      (ctx, fx, time) => {
        const t = fx.age / fx.dur, a = 1 - win(t, .5, 1);
        karmaLines(ctx, fx.x, fx.y, fx.r, easeOut(t * 3), a, fx.seed);
        ctx.globalCompositeOperation = 'lighter';
        Kit().glow(ctx, fx.x, fx.y, fx.r * .7, '110,120,255', .35 * a, false, .5);
        ctx.globalCompositeOperation = 'source-over';
        void time;
      },
      null
    ],

    // ---- Sarada
    bolt: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r * .7, 1 - win(fx.age, fx.dur - .4, fx.dur), fx.seed, '18,20,40'),
      (ctx, fx, time) => {
        const t = fx.age / fx.dur;
        Kit().fx.lightningBlast(ctx, fx.x, fx.y, fx.r, t, 1 - win(t, .45, 1), time, fx.seed);
      }
    ],
    curveShur: [
      (ctx, fx) => {
        for (const s of fx.list) {
          const u = (fx.age - s.t0) / s.d;
          if (u >= 1 && fx.age < fx.dur - .1) {
            // stuck in the ground
            ctx.save(); ctx.translate(s.x1, s.y1); ctx.scale(1, .45); ctx.rotate(s.x1 * .1);
            ctx.globalAlpha = 1 - win(fx.age, fx.dur - .5, fx.dur); ctx.drawImage(shurImg(), -9, -9, 18, 18); ctx.restore(); ctx.globalAlpha = 1;
          }
        }
      },
      (ctx, fx, time) => {
        const L = liftH(), img = shurImg();
        for (const s of fx.list) {
          const u = (fx.age - s.t0) / s.d;
          if (u < 0 || u >= 1) { if (u >= 1 && u < 1.4) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, s.x1, s.y1 - 6, 26, '255,200,170', (1.4 - u) * 2, true); ctx.globalCompositeOperation = 'source-over'; } continue; }
          const P = v => { const w = 1 - v; return [w * w * s.x0 + 2 * w * v * s.cx + v * v * s.x1, w * w * s.y0 + 2 * w * v * s.cy + v * v * s.y1 - L * (1 - v * .8)]; };
          const [x, y] = P(u), [bx, by] = P(Math.max(0, u - .18));
          ctx.strokeStyle = 'rgba(30,20,30,.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,235,235,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.save(); ctx.translate(x, y); ctx.rotate(time * 30 + s.cx); ctx.drawImage(img, -10, -10, 20, 20); ctx.restore();
        }
      }
    ],
    crater: [
      (ctx, fx) => {
        const t = fx.age, a = 1 - win(t, fx.dur - .7, fx.dur), r = fx.r, e = easeOut(t / .25);
        ctx.fillStyle = `rgba(40,26,20,${.38 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r * .6 * e, r * .3 * e, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(20,12,10,${.32 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r * .32 * e, r * .16 * e, 0, 0, TAU); ctx.fill();
        // radial cracks, jagged, with a lit lip
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(${fx.pink ? '255,190,210' : '170,160,255'},${.5 * a})` : `rgba(26,16,12,${.8 * a})`;
          ctx.lineWidth = pass ? 1.2 : 3.4;
          ctx.beginPath();
          for (let i = 0; i < 14; i++) {
            const a0 = i * TAU / 14 + hash(i + fx.seed) * .3, Lc = r * e * (.7 + hash(i * 2.1 + fx.seed) * .5);
            ctx.moveTo(fx.x + Math.cos(a0) * r * .2, fx.y + Math.sin(a0) * r * .1);
            for (let j = 1; j <= 4; j++) { const d = r * .2 + Lc * j / 4, aa = a0 + (hash(i * 5 + j + fx.seed) - .5) * .4; ctx.lineTo(fx.x + Math.cos(aa) * d, fx.y + Math.sin(aa) * d * .5); }
          }
          ctx.stroke();
        }
        if (!fx.pink) karmaLines(ctx, fx.x, fx.y, r * 1.05, e, a * .8, fx.seed + 3);
      },
      (ctx, fx, time) => {
        const t = fx.age, K = Kit(), r = fx.r;
        impactO(ctx, fx.x, fx.y, r, t, fx.seed, fx.rgb);
        if (t < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 30, r * 1.1, fx.rgb, (1 - t / .25), true, .8); ctx.globalCompositeOperation = 'source-over'; }
        // slabs of earth thrown up round the rim
        for (let i = 0; i < 12; i++) {
          const u = (t - hash(i + fx.seed) * .08) / .9; if (u < 0 || u > 1) continue;
          const an = i * TAU / 12 + hash(i * 3 + fx.seed) * .4, d = r * (.35 + .55 * easeOut(u)), h = Math.sin(Math.PI * u) * r * (.35 + hash(i * 7 + fx.seed) * .35);
          const s = 16 + hash(i * 9 + fx.seed) * 16;
          ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.translate(fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - h); ctx.rotate(u * 6 + i);
          ctx.drawImage(rockImg(i), -s / 2, -s / 2, s, s); ctx.restore();
        }
        ctx.globalAlpha = 1;
        if (fx.pink && t < .7) {
          // pink chakra sparks off the fist
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,170,200,${.9 * (1 - t / .7)})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i < 16; i++) { const an = i * TAU / 16 + fx.seed, d0 = r * .2 + t * r * 1.2, l = 30; ctx.moveTo(fx.x + Math.cos(an) * d0, fx.y - 30 + Math.sin(an) * d0 * .55); ctx.lineTo(fx.x + Math.cos(an) * (d0 + l), fx.y - 30 + Math.sin(an) * (d0 + l) * .55); }
          ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
        }
        void time;
      }
    ],
    fissure: [
      (ctx, fx) => {
        const K = Kit(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), front = Math.min(fx.len, fx.age * fx.sp), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        // the split in the ground, zig-zagging
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(255,170,200,${.45 * a})` : `rgba(26,16,12,${.85 * a})`; ctx.lineWidth = pass ? 1.4 : 7;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
          for (let d = 30; d <= front; d += 30) { const o = (hash(d * .1 + fx.seed) - .5) * 26; ctx.lineTo(fx.x + ca * d - sa * o, fx.y + sa * d + ca * o); }
          ctx.stroke();
        }
        const dust = K.puff('dust');
        for (let d = 60; d <= front; d += 70) {
          const t = fx.age - d / fx.sp, j = hash(d + fx.seed);
          if (t > 0 && t < 1.4) K.stamp(ctx, dust, fx.x + ca * d + (j - .5) * 40, fx.y + sa * d - 12 - t * 20, 20 + t * 26, (1 - t / 1.4) * .6, .7);
        }
      },
      (ctx, fx) => {
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        for (let d = 60; d <= fx.len; d += 64) {
          const t = fx.age - d / fx.sp; if (t < 0) break;
          const rise = t < .12 ? easeOut(t / .12) : t < .9 ? 1 : 1 - easeIn((t - .9) / .5);
          if (rise <= .01) continue;
          for (let k = 0; k < 3; k++) {
            const side = (k - 1), o = side * 22 + (hash(d + k + fx.seed) - .5) * 14, h = (34 + hash(d * 3 + k + fx.seed) * 40) * rise * (k === 1 ? 1.3 : .9);
            const bx = fx.x + ca * d - sa * o, by = fx.y + sa * d + ca * o, w = 10 + hash(d + k * 7) * 6, lean = side * 6;
            ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.lineTo(bx + lean - 2, by - h); ctx.lineTo(bx + lean + 3, by - h + 6); ctx.lineTo(bx + w, by); ctx.closePath();
            ctx.fillStyle = '#7e6b54'; ctx.fill(); ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#ac987a'; ctx.beginPath(); ctx.moveTo(bx - w * .6, by - 2); ctx.lineTo(bx + lean - 2, by - h + 2); ctx.lineTo(bx - w * .1, by - 2); ctx.closePath(); ctx.fill();
          }
        }
      }
    ],
    fireball: [
      (ctx, fx) => {
        const d = fx.age * fx.sp; if (d > fx.len) return;
        groundShadow(ctx, fx.x0 + Math.cos(fx.a) * d, fx.y0 + Math.sin(fx.a) * d, fx.r * 1.1, .3);
        ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx.x0 + Math.cos(fx.a) * d, fx.y0 + Math.sin(fx.a) * d, fx.r * 1.8, '255,120,40', .35, false, .45); ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time) => {
        const K = Kit(), L = liftH() + 10, ca = Math.cos(fx.a), sa = Math.sin(fx.a), ta = fx.len / fx.sp;
        if (fx.age < ta) {
          const d = fx.age * fx.sp, x = fx.x0 + ca * d, y = fx.y0 + sa * d - L, g = easeOut(fx.age / .25), r = fx.r * (.4 + .6 * g);
          const smoke = K.puff('smoke'), fire = K.puff('fire'), ember = K.puff('ember');
          for (let i = 0; i < 8; i++) { const b = 30 + i * 26, j = hash(i + fx.seed + Math.floor(time * 8)); K.stamp(ctx, smoke, x - ca * b + (j - .5) * 20, y - sa * b - i * 3, r * (.45 + i * .06), .5 * (1 - i / 8)); }
          for (let i = 0; i < 6; i++) { const b = 10 + i * 18; K.stamp(ctx, ember, x - ca * b, y - sa * b, r * (.7 - i * .07), .75 - i * .1); }
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, x, y, r * 2.2, '255,120,30', .55);
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 7; i++) { const an = time * 5 + i * TAU / 7, rr = r * .45; K.stamp(ctx, fire, x + Math.cos(an) * rr, y + Math.sin(an) * rr * .8, r * .62, .9); }
          K.stamp(ctx, fire, x, y, r * .9, 1);
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r * .7, '255,230,160', .9, true); ctx.globalCompositeOperation = 'source-over';
        } else {
          const t = (fx.age - ta) / 1.4;
          if (t < 1) K.fx.fireBlast(ctx, fx.x0 + ca * fx.len, fx.y0 + sa * fx.len, 260, t, 1, time, fx.seed);
        }
      }
    ],
    flames: [
      (ctx, fx, time) => {
        const K = Kit(), a = win(fx.age, 0, .3) * (1 - win(fx.age, fx.dur - .8, fx.dur));
        scorchG(ctx, fx.x, fx.y, fx.r, a, fx.seed, '40,16,8');
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y, fx.r * 1.2, '255,110,30', .3 * a, false, .5); ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 14; i++) {
          const an = hash(i + fx.seed) * TAU, d = Math.sqrt(hash(i * 2.3 + fx.seed)) * fx.r * .85, x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d * .5;
          const fl = .75 + .35 * Math.sin(time * 9 + i * 2.1), h = (40 + hash(i * 5) * 40) * fl * a, w = h * .5;
          if (h < 3) continue;
          ctx.drawImage(K.flame(i + Math.floor(time * 10)), x - w / 2, y - h * (114 / 128), w, h);
        }
      },
      null
    ],
    wires: [
      (ctx, fx, time) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), img = shurImg();
        fx.list.forEach((s, i) => {
          const u = clamp01((fx.age - i * .03) / .4);
          if (u < 1) return;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(s.x, s.y); ctx.scale(1, .45); ctx.rotate(i); ctx.drawImage(img, -11, -11, 22, 22); ctx.restore();
        });
        ctx.globalAlpha = 1;
        if (fx.age > .4) {
          // glinting chakra wires: ring between stakes and spokes to the trapped centre
          const k = clamp01((fx.age - .4) / .2) * a, n = fx.list.length;
          ctx.strokeStyle = `rgba(20,14,20,${.4 * k})`; ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < n; i++) { const p = fx.list[i], q = fx.list[(i + 3) % n]; ctx.moveTo(p.x, p.y - 4); ctx.lineTo(q.x, q.y - 4); }
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,240,240,${.85 * k})`; ctx.lineWidth = 1.1; ctx.stroke();
          const g = (time * 2) % 1;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) { const p = fx.list[i], q = fx.list[(i + 3) % n]; Kit().glow(ctx, p.x + (q.x - p.x) * g, p.y - 4 + (q.y - p.y) * g, 12, '255,120,120', .8 * k, true); }
          ctx.globalCompositeOperation = 'source-over';
        }
      },
      (ctx, fx, time) => {
        const L = liftH(), img = shurImg();
        fx.list.forEach((s, i) => {
          const u = clamp01((fx.age - i * .03) / .4); if (u >= 1 || u <= 0) return;
          const x = fx.x0 + (s.x - fx.x0) * u, y = fx.y0 + (s.y - fx.y0) * u - L * (1 - u) - Math.sin(Math.PI * u) * 40;
          ctx.save(); ctx.translate(x, y); ctx.rotate(time * 30 + i); ctx.drawImage(img, -10, -10, 20, 20); ctx.restore();
        });
      }
    ],

    // ---- Mitsuki
    arm: [
      null,
      (ctx, fx, time, z) => {
        if (!z) return;
        const te = fx.len / fx.sp, e = fx.age < te ? fx.age / te : fx.age < te + .12 ? 1 : 1 - easeIn((fx.age - te - .12) / .4);
        if (e <= .01) return;
        const H = bodyH('mitsuki'), lift = (z.bt && z.bt.lift) || 0, ca = Math.cos(fx.a), sa = Math.sin(fx.a), fac = ca >= 0 ? 1 : -1;
        const x0 = z.x + fac * 6, y0 = z.y + 3 - H * .52 - lift, L = fx.len * e;
        PTS.length = 0;
        for (let i = 0; i <= 12; i++) {
          const d = L * i / 12, o = Math.sin(d / 90 + time * 10) * 7 * Math.min(1, d / 60) * (1 - i / 14);
          PTS.push(x0 + ca * d - sa * o, y0 + sa * d * .9 + ca * o + (d / fx.len) * H * .28);
        }
        // sleeve, then the stretched pale arm, then the fist
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const strokeP = () => { ctx.beginPath(); ctx.moveTo(PTS[0], PTS[1]); for (let i = 2; i < PTS.length; i += 2) ctx.lineTo(PTS[i], PTS[i + 1]); ctx.stroke(); };
        ctx.strokeStyle = '#1c1a26'; ctx.lineWidth = 12; strokeP();
        ctx.strokeStyle = '#c8c6d6'; ctx.lineWidth = 8.6; strokeP(); ctx.strokeStyle = '#eef0f3'; ctx.lineWidth = 5.4; ctx.save(); ctx.translate(0, -1.4); strokeP(); ctx.restore();
        ctx.strokeStyle = 'rgba(160,150,200,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(PTS[0], PTS[1] + 2); for (let i = 2; i < PTS.length; i += 2) ctx.lineTo(PTS[i], PTS[i + 1] + 2); ctx.stroke();
        ctx.strokeStyle = '#1c1a26'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(PTS[0], PTS[1]); ctx.lineTo(PTS[2], PTS[3]); ctx.stroke();
        ctx.strokeStyle = '#eceaf2'; ctx.lineWidth = 11; ctx.stroke();
        const n = PTS.length - 2, fx2 = PTS[n], fy2 = PTS[n + 1];
        ctx.fillStyle = '#eef0f3'; ctx.strokeStyle = '#1c1a26'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(fx2, fy2, 8, 7, fx.a, 0, TAU); ctx.fill(); ctx.stroke();
        if (fx.age < te + .15) speedLines(ctx, x0, y0 + liftH(), fx2, fy2 + liftH(), 14, .7, fx.seed, '230,235,255');
        if (Math.abs(fx.age - te) < .12) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx2, fy2, 40, '220,230,255', .8, true); ctx.globalCompositeOperation = 'source-over'; }
      }
    ],
    snakes: [
      (ctx, fx) => {
        for (const s of fx.list) {
          const g = easeOut(fx.age / .4) * (1 - easeIn(win(fx.age, .85, 1.3))), L = s.len * g;
          if (L < 10) continue;
          ctx.strokeStyle = 'rgba(20,16,30,.2)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(s.a) * L, fx.y + Math.sin(s.a) * L); ctx.stroke();
        }
      },
      (ctx, fx, time, z) => {
        const H = bodyH('mitsuki'), lift = z && z.bt ? z.bt.lift || 0 : 0, fac = fx.list[4] && Math.cos(fx.list[4].a) < 0 ? -1 : 1;
        const x0 = (z ? z.x : fx.x) + fac * 10, y0 = (z ? z.y : fx.y) + 3 - H * .45 - lift;
        for (const s of fx.list) {
          const g = easeOut(fx.age / .4) * (1 - easeIn(win(fx.age, .85, 1.3))), L = s.len * g;
          if (L < 10) continue;
          spine(PTS, x0, y0, s.a, L, 26, 13, 190, s.ph + time * 9, true);
          // the body droops from hand height toward the ground along its length
          for (let i = 0; i < PTS.length; i += 2) PTS[i + 1] += (i / PTS.length) * H * .3;
          snakeBody(ctx, PTS, 13, 7, '#e4def0', '#fbf8ff', 1, g > .9 && fx.age < .9);
        }
      }
    ],
    lsnake: [
      (ctx, fx) => {
        const d = Math.min(fx.len, fx.age * fx.sp), a = 1 - win(fx.age, fx.dur - .4, fx.dur);
        ctx.strokeStyle = `rgba(16,20,40,${.25 * a})`; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + Math.cos(fx.a) * d, fx.y0 + Math.sin(fx.a) * d); ctx.stroke();
      },
      (ctx, fx, time) => {
        const L = liftH(), dd = fx.age * fx.sp, head = Math.min(fx.len, dd), tail = Math.max(0, head - 300), a = 1 - win(dd, fx.len, fx.len + 120);
        if (a <= .01) return;
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a), P = d => { const o = Math.sin(d / 70 - time * 14) * 34 * Math.min(1, d / 60); return [fx.x0 + ca * d - sa * o, fx.y0 + sa * d + ca * o - L]; };
        ctx.globalCompositeOperation = 'lighter';
        let prev = P(tail);
        for (let d = tail + 30; d <= head + .1; d += 30) {
          const q = P(Math.min(d, head)), k = (d - tail) / Math.max(1, head - tail);
          bolt(ctx, prev[0], prev[1], q[0], q[1], fx.seed + d * .1, time, 1.2 + 2 * k, a * (.4 + .6 * k), k > .4 ? 2 : 1); Kit().glow(ctx, q[0], q[1], 26 + 20 * k, '90,150,255', .35 * a * k);
          prev = q;
        }
        const [hx, hy] = P(head);
        Kit().glow(ctx, hx, hy, 60, '110,170,255', .8 * a);
        Kit().glow(ctx, hx, hy, 22, '235,245,255', .9 * a, true);
        // snake head of lightning: two jaws
        const ha = fx.a + Math.cos(head / 70 - time * 14) * .4;
        for (const sg of [-1, 1]) bolt(ctx, hx, hy, hx + Math.cos(ha + sg * .45) * 44, hy + Math.sin(ha + sg * .45) * 44, fx.seed + sg * 9, time, 1.6, a, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    blades: [
      (ctx, fx) => {
        const K = Kit(), dust = K.puff('dust');
        for (const b of fx.list) {
          const d = (fx.age - b.t0) * fx.sp; if (d < 0) continue;
          for (let k = 0; k < 4; k++) {
            const dk = d - k * 90; if (dk < 40 || dk > fx.len) continue;
            const t = (d - dk) / 360;
            K.stamp(ctx, dust, fx.x0 + Math.cos(b.a) * dk + (hash(k + b.t0) - .5) * 60, fx.y0 + Math.sin(b.a) * dk - 8, 18 + t * 20, .5 * (1 - t), .7);
          }
        }
      },
      (ctx, fx) => {
        const L = liftH();
        for (const b of fx.list) {
          const d = (fx.age - b.t0) * fx.sp; if (d < 30 || d > fx.len + 60) continue;
          const al = 1 - win(d, fx.len - 60, fx.len + 60), cx = fx.x0 + Math.cos(b.a) * (d - 110), cy = fx.y0 + Math.sin(b.a) * (d - 110) - L * .7;
          crescent(ctx, cx, cy, 120, 30, b.a - .8, b.a + .8, .62);
          ctx.strokeStyle = `rgba(16,40,50,${.55 * al})`; ctx.lineWidth = 4; ctx.stroke();
          ctx.fillStyle = `rgba(230,255,250,${.9 * al})`; ctx.fill();
          crescent(ctx, cx, cy, 116, 12, b.a - .62, b.a + .62, .62);
          ctx.fillStyle = `rgba(110,230,210,${.75 * al})`; ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${.6 * al})`; ctx.lineWidth = 1.6; ctx.beginPath();
          for (let k = 0; k < 6; k++) { const aa = b.a + (k / 5 - .5) * 1.3, r0 = 95, l = 50 + k % 3 * 20; ctx.moveTo(cx + Math.cos(aa) * r0 - Math.cos(b.a) * 10, cy + Math.sin(aa) * r0 * .62); ctx.lineTo(cx + Math.cos(aa) * r0 - Math.cos(b.a) * l, cy + Math.sin(aa) * r0 * .62 - Math.sin(b.a) * l * .62); }
          ctx.stroke();
        }
      }
    ],
    sagePulse: [
      (ctx, fx, time) => {
        const t = fx.age / fx.dur, a = 1 - win(t, .4, 1), K = Kit();
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, SW.gold(), fx.x, fx.y, fx.r * easeOut(t * 2), time * 4, a * .7, .5);
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.15, t * 1.4, a, '255,220,120');
        ctx.globalCompositeOperation = 'source-over';
        dustRing(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 12);
      },
      (ctx, fx) => {
        const t = fx.age / fx.dur, a = 1 - win(t, .3, 1), K = Kit();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 50, 140 * (1 + t), '255,220,120', .6 * a, true, 1.2);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    giants: [
      (ctx, fx) => {
        for (const g of fx.list) {
          const t = fx.age - g.t0; if (t < 0) continue;
          const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
          ctx.fillStyle = `rgba(30,22,16,${.45 * a})`; ctx.beginPath(); ctx.ellipse(g.x, g.y, 60, 26, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(30,20,14,${.7 * a})`; ctx.lineWidth = 3; ctx.beginPath();
          for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + g.x, d = 50 + hash(i + g.y) * 40; ctx.moveTo(g.x + Math.cos(an) * 40, g.y + Math.sin(an) * 18); ctx.lineTo(g.x + Math.cos(an) * d * 1.4, g.y + Math.sin(an) * d * .6); }
          ctx.stroke();
          if (t < 1.2) dustRing(ctx, g.x, g.y, 130, t, g.x % 17, 10);
        }
      },
      (ctx, fx, time) => {
        const tx = fx.tx, ty = fx.ty;
        // draw farther (smaller y) snakes first
        const order = fx.list.slice().sort((p, q) => p.y - q.y);
        for (const g of order) {
          const t = fx.age - g.t0; if (t < 0) continue;
          const sink = win(fx.age, fx.dur - .6, fx.dur), rise = easeOut(t / .35);
          const strike = easeIn(win(t, .55, .8)), back = win(t, 1.1, 1.5);
          const ang = Math.atan2(ty - g.y, tx - g.x);
          // head: rears up high, then lunges to the target, then pulls back
          const rx = g.x + Math.cos(ang) * 30, ry = g.y - 170 * rise;
          const sx = tx - Math.cos(ang) * 40, sy = ty - 30;
          const k = strike * (1 - back * .6);
          const hx = rx + (sx - rx) * k, hy = ry + (sy - ry) * k + sink * 160;
          const cx = g.x - Math.cos(ang) * 50, cy = g.y - 140 * rise + sink * 100;
          PTS.length = 0;
          for (let i = 0; i <= 12; i++) {
            const u = i / 12, w = 1 - u;
            const wob = Math.sin(u * 6 + time * 6 + g.x) * 8 * (1 - k);
            PTS.push(w * w * g.x + 2 * w * u * cx + u * u * hx + wob, w * w * (g.y + 4) + 2 * w * u * cy + u * u * hy);
          }
          snakeBody(ctx, PTS, 34, 18, '#eeeaf4', '#fbf8ff', 1 - sink, t > .4 && t < 1.1);
        }
      }
    ],
    serpent: [
      (ctx, fx) => {
        const e = easeOut(win(fx.age, .5, 1.05)), back = easeIn(win(fx.age, 1.5, 2)), L = fx.len * e * (1 - back);
        if (L < 10) return;
        const dust = Kit().puff('dust'), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        ctx.strokeStyle = 'rgba(26,20,16,.3)'; ctx.lineWidth = 90; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + ca * L, fx.y0 + sa * L); ctx.stroke();
        for (let d = 60; d < L; d += 90) Kit().stamp(ctx, dust, fx.x0 + ca * d + (hash(d) - .5) * 90, fx.y0 + sa * d - 14, 30 + hash(d * 3) * 20, .5, .7);
      },
      (ctx, fx, time) => {
        // rises behind Mitsuki (0–.5 s), lunges along the line, stays, withdraws
        const rise = easeOut(fx.age / .5), e = easeOut(win(fx.age, .5, 1.05)), back = easeIn(win(fx.age, 1.5, 2));
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a), L = fx.len * e * (1 - back);
        PTS.length = 0;
        const n = 16, headUp = 120 * rise * (1 - e) + 40;
        for (let i = 0; i <= n; i++) {
          const u = i / n, d = -80 + (L + 80) * u, o = Math.sin(u * 7 - time * 6) * 30 * (1 - u * .6);
          PTS.push(fx.x0 + ca * d - sa * o, fx.y0 + sa * d + ca * o - headUp * u * u - 20);
        }
        snakeBody(ctx, PTS, 70, 40, '#eeeaf4', '#fbf8ff', 1 - back, e > .2);
        if (e > 0 && e < 1) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, PTS[n * 2], PTS[n * 2 + 1], 90, '255,240,200', .5, false); ctx.globalCompositeOperation = 'source-over'; }
      }
    ],

    // ---- Kawaki
    spikes: [
      (ctx, fx) => {
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a), front = Math.min(fx.len, fx.age * fx.sp), a = 1 - win(fx.age, fx.dur - .5, fx.dur);
        ctx.strokeStyle = `rgba(12,10,20,${.55 * a})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + ca * front, fx.y0 + sa * front); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(120,110,255,${.35 * a})`; ctx.lineWidth = 3; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx) => {
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        for (let d = 50; d <= fx.len; d += 52) {
          const t = fx.age - d / fx.sp; if (t < 0) break;
          const rise = t < .1 ? easeOut(t / .1) : t < .75 ? 1 : 1 - easeIn((t - .75) / .35);
          if (rise <= .01) continue;
          for (let k = 0; k < 3; k++) {
            const side = k - 1, o = side * 24 + (hash(d + k + fx.seed) - .5) * 12;
            const h = (52 + hash(d * 3 + k + fx.seed) * 50) * rise * (k === 1 ? 1.35 : .85) * (1 + d / fx.len * .4);
            const bx = fx.x0 + ca * d - sa * o, by = fx.y0 + sa * d + ca * o, w = 7 + hash(d + k * 7) * 6, lean = side * 10 + ca * 8;
            ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.lineTo(bx + lean, by - h); ctx.lineTo(bx + w, by); ctx.closePath();
            ctx.fillStyle = '#0d0c14'; ctx.fill(); ctx.strokeStyle = '#05040a'; ctx.lineWidth = 2; ctx.stroke();
            ctx.strokeStyle = 'rgba(150,150,255,.75)'; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(bx + w * .3, by - 2); ctx.lineTo(bx + lean, by - h + 2); ctx.stroke();
          }
        }
      }
    ],
    beam: [
      (ctx, fx, time, z) => {
        if (!z) return;
        const a = 1 - win(fx.age, fx.dur - .3, fx.dur), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(16,14,30,${.4 * a})`; ctx.lineWidth = 70; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + ca * fx.len, z.y + sa * fx.len); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, z.x + ca * fx.len, z.y + sa * fx.len, 120, '120,170,255', .6 * a, false, .5); ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time, z) => {
        if (!z) return;
        const K = Kit(), a = 1 - win(fx.age, fx.dur - .3, fx.dur), H = bodyH('kawaki'), ca = Math.cos(fx.a), sa = Math.sin(fx.a), fac = ca >= 0 ? 1 : -1;
        const x0 = z.x + fac * H * .26, y0 = z.y + 3 - H * .42 - ((z.bt && z.bt.lift) || 0), x1 = x0 + ca * fx.len, y1 = y0 + sa * fx.len + H * .3;
        const w = (22 + Math.sin(time * 40) * 3) * easeOut(fx.age / .08) * a;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(14,10,30,${.75 * a})`; ctx.lineWidth = w * 2 + 10; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(90,120,255,${.6 * a})`; ctx.lineWidth = w * 2; ctx.stroke();
        ctx.strokeStyle = `rgba(190,220,255,${.85 * a})`; ctx.lineWidth = w; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = w * .35; ctx.stroke();
        // spiral streaks flowing down the beam
        ctx.strokeStyle = `rgba(200,210,255,${.7 * a})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const u = ((time * 2.4 + i / 10) % 1), px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u, o = Math.sin(u * 30 + time * 20) * w; ctx.moveTo(px - sa * o, py + ca * o); ctx.lineTo(px + ca * 30 - sa * o, py + sa * 30 + ca * o); }
        ctx.stroke();
        K.glow(ctx, x0, y0, 50, '150,170,255', .9 * a, true);
        K.glow(ctx, x1, y1, 70, '150,190,255', .8 * a, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    lance: [
      (ctx, fx, time, z) => {
        if (!z || fx.age > fx.T + .4) return;
        const k = clamp01(fx.age / fx.T), a0 = fx.a0, a1 = fx.a0 + fx.dir * fx.sw * easeInOut(k), al = 1 - win(fx.age, fx.T, fx.T + .4);
        ctx.fillStyle = `rgba(16,12,30,${.22 * al})`; sector(ctx, z.x, z.y, 40, fx.len, Math.min(a0, a1), Math.max(a0, a1)); ctx.fill();
        ctx.strokeStyle = `rgba(14,10,22,${.6 * al})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, fx.len * .96, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      },
      (ctx, fx, time, z) => {
        if (!z || fx.age > fx.T + .15) return;
        const H = bodyH('kawaki'), lift = (z.bt && z.bt.lift) || 0;
        const k = clamp01(fx.age / fx.T), ang = fx.a0 + fx.dir * fx.sw * easeInOut(k), L = fx.len * easeOut(fx.age / .12) * (1 - win(fx.age, fx.T, fx.T + .15));
        const x0 = z.x, y0 = z.y + 3 - H * .45 - lift, ca = Math.cos(ang), sa = Math.sin(ang);
        // motion smear of the sweep
        for (let i = 1; i <= 4; i++) {
          const pa = fx.a0 + fx.dir * fx.sw * easeInOut(Math.max(0, k - i * .05));
          ctx.strokeStyle = `rgba(170,160,255,${.4 / i})`; ctx.lineWidth = 22; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x0 + Math.cos(pa) * 40, y0 + Math.sin(pa) * 40 * .9); ctx.lineTo(x0 + Math.cos(pa) * L, y0 + Math.sin(pa) * L * .9 + H * .3); ctx.stroke();
        }
        const tx = x0 + ca * L, ty = y0 + sa * L * .9 + H * .3, nx = -sa * 15, ny = ca * 15;
        ctx.beginPath(); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(tx, ty); ctx.lineTo(x0 - nx, y0 - ny); ctx.closePath();
        ctx.fillStyle = '#0d0c14'; ctx.fill(); ctx.strokeStyle = '#05040a'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(120,110,255,.55)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(tx, ty); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(235,235,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + nx * .6, y0 + ny * .6); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, tx, ty, 26, '150,140,255', .7, true); ctx.globalCompositeOperation = 'source-over';
      }
    ],
    cubes: [
      (ctx, fx, time) => {
        const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
        for (const c of fx.list) {
          const t = fx.age - c.t0, u = t / c.fall, h = c.s / 2;
          if (t < 0) { sqTele(ctx, c.x, c.y, c.s, '170,150,255', clamp01(fx.age / Math.max(.05, c.t0)), time); continue; }
          if (u < 1) {
            sqTele(ctx, c.x, c.y, c.s, '200,170,255', 1, time);
            ctx.fillStyle = `rgba(10,8,16,${.15 + .35 * u})`; ctx.fillRect(c.x - h * (.5 + .5 * u), c.y - h * (.5 + .5 * u), c.s * (.5 + .5 * u), c.s * (.5 + .5 * u));
          } else {
            const tt = t - c.fall;
            ctx.fillStyle = `rgba(10,8,16,${.45 * fade})`; ctx.fillRect(c.x - h * 1.06, c.y - h * 1.06, c.s * 1.06, c.s * 1.06);
            scorchG(ctx, c.x, c.y + h * .3, c.s * .75, fade, c.x % 13);
            if (tt < 1.3) dustRing(ctx, c.x, c.y + h * .4, c.s * 1.1, tt, c.y % 11, 12);
          }
        }
      },
      (ctx, fx, time) => {
        const fade = 1 - win(fx.age, fx.dur - .6, fx.dur), sink = win(fx.age, fx.dur - .6, fx.dur);
        const order = fx.list.slice().sort((p, q) => p.y - q.y);
        for (const c of order) {
          const t = fx.age - c.t0; if (t < 0) continue;
          const u = t / c.fall, up = u < 1 ? (1 - easeIn(u)) * (c.s > 250 ? 700 : 520) : 0;
          drawCube(ctx, c.x, c.y, c.s, up - sink * c.s * .3, (u < 1 ? clamp01(u * 3) : t - c.fall < .35 ? 1 : .64) * fade, time, c.x * .01);
          if (u >= 1) {
            const tt = t - c.fall;
            if (tt < .5) {
              ctx.globalCompositeOperation = 'lighter';
              Kit().fx.shockRing(ctx, c.x, c.y + c.s * .25, c.s * 1.3, tt * 2, 1 - tt * 2, '150,140,255');
              Kit().glow(ctx, c.x, c.y, c.s * .8, '140,130,255', (1 - tt * 2) * .5, false, .5);
              ctx.globalCompositeOperation = 'source-over';
              Kit().fx.debris(ctx, c.x, c.y + c.s * .25, c.s * .9, tt * 2, c.x % 7, '#2e2420', 8);
            }
            if (sink > 0) {
              // crumbles into black motes
              ctx.fillStyle = `rgba(20,16,30,${.7 * fade})`;
              for (let i = 0; i < 6; i++) { const ph = (sink + hash(i + c.x)) % 1; ctx.fillRect(c.x + (hash(i * 3 + c.y) - .5) * c.s, c.y - c.s * .4 - ph * 60, 4, 4); }
            }
          } else {
            // falling streak
            ctx.strokeStyle = `rgba(150,140,255,${.4 * u})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(c.x - c.s * .4, c.y - c.s * .4 - up - 60); ctx.lineTo(c.x - c.s * .4, c.y - c.s * .4 - up - 200); ctx.moveTo(c.x + c.s * .4, c.y - c.s * .4 - up - 60); ctx.lineTo(c.x + c.s * .4, c.y - c.s * .4 - up - 200); ctx.stroke();
          }
        }
      }
    ]
  };

  // ================================================================== windup / persistent overlays
  function handPos(z, st, H) {
    const fac = facingOf(z);
    return [z.x + fac * H * .26, z.y + 3 - H * .42 - st.lift];
  }
  function windupFx(ctx, z, st, time, H) {
    const K = Kit(), id = z.bossId, k = 1 - st.windup / st.windMax, def = MOVES[id][st.move];
    const fy = z.y + 3 - st.lift, fac = facingOf(z), [hx, hy] = handPos(z, st, H);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, 40 + 40 * k, def.rgb, .22 + .28 * k);
    ctx.strokeStyle = `rgba(${def.rgb},${.4 + .4 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = i * TAU / 8 + time * 2, ph = (time * 2.4 + hash(i + st.seed)) % 1, d0 = 120 * (1 - ph) + 30;
      ctx.moveTo(z.x + Math.cos(an) * d0, fy - H * .5 + Math.sin(an) * d0 * .6); ctx.lineTo(z.x + Math.cos(an) * (d0 - 22), fy - H * .5 + Math.sin(an) * (d0 - 22) * .6);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const mv = st.move;
    if (id === 'boruto') {
      if (mv === 'vanish' || mv === 'uzu') rasOrb(ctx, hx, hy, 5 + 11 * easeOut(k), time, 1);
      else if (mv === 'shur') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) bolt(ctx, hx, hy, hx + Math.cos(time * 9 + i * 2) * 24, hy + Math.sin(time * 9 + i * 2) * 18, st.seed + i, time, .8, .9, 0); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'gale') { ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, SW.wind(), hx, hy, 12 + 14 * k, -time * 12, .8, .8); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'kama') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 20 + 20 * k, '140,120,255', .8, true); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'karma') {
        const r = 10 + 46 * easeOut(k), ox = z.x + fac * 6, oy = fy - H - 30 - r * .6;
        // black Karma wisps streaming into the giant sphere
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const ph = (time * 1.5 + i / 8) % 1, an = i * TAU / 8 + time, d = r + 30 + (1 - ph) * 120;
          ctx.strokeStyle = `rgba(14,10,24,${.7 * (1 - ph)})`; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(ox + Math.cos(an) * d, oy + Math.sin(an) * d * .7); ctx.quadraticCurveTo(ox + Math.cos(an + 1) * d * .5, oy + Math.sin(an + 1) * d * .35, ox, oy); ctx.stroke();
        }
        rasOrb(ctx, ox, oy, r, time, 1);
        ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, SW.karma(), ox, oy, r * 1.1, time * 5, .5); ctx.globalCompositeOperation = 'source-over';
      }
    } else if (id === 'sarada') {
      if (mv === 'katon') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x + fac * H * .2, fy - H * .82, 16 + 24 * k, '255,140,40', .9, true); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'punch' || mv === 'heel') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, mv === 'heel' ? z.x + fac * 8 : hx, mv === 'heel' ? fy - 6 : hy, 20 + 26 * k, '255,120,170', .85, true); ctx.globalCompositeOperation = 'source-over'; }
      if (mv === 'shur' || mv === 'combo') {
        // Sharingan glare
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x + fac * H * .14, fy - H * .8, 14 + 10 * k, '255,40,40', .95, true); ctx.globalCompositeOperation = 'source-over';
      }
    } else if (id === 'mitsuki') {
      if (mv === 'lsnake') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) bolt(ctx, z.x, fy - H * .5, hx + Math.cos(time * 7 + i * 2) * 20, hy + Math.sin(time * 7 + i * 2) * 14, st.seed + i * 3, time, 1, .9, 1); K.glow(ctx, hx, hy, 30 * k + 10, '120,180,255', .8, true); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'sage' || mv === 'swarm') {
        ctx.globalCompositeOperation = 'lighter';
        K.spin(ctx, SW.gold(), z.x, z.y, 60 + 80 * k, time * 5, .6, .5);
        for (let i = 0; i < 10; i++) { const ph = (time * .9 + i / 10) % 1, an = i * 2.4 + time; K.glow(ctx, z.x + Math.cos(an) * (1 - ph) * 140, fy - H * .5 + Math.sin(an) * (1 - ph) * 60 - ph * 30, 7, '255,230,140', .9 * ph, true); }
        ctx.globalCompositeOperation = 'source-over';
      } else if (mv === 'wind') { ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, SW.wind(), hx, hy, 12 + 16 * k, time * 12, .8, .8); ctx.globalCompositeOperation = 'source-over'; }
    } else if (id === 'kawaki') {
      if (mv === 'absorb') { ctx.globalCompositeOperation = 'lighter'; K.spin(ctx, SW.karma(), hx, hy, 14 + 12 * k, -time * 10, .9, .8); K.glow(ctx, hx, hy, 18, '150,140,255', .8, true); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 'lance' || mv === 'spikes') {
        const L = 20 + 30 * k;
        ctx.fillStyle = '#0d0c14'; ctx.strokeStyle = 'rgba(160,150,255,.8)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < (mv === 'spikes' ? 4 : 1); i++) {
          const aa = (fac > 0 ? 0 : Math.PI) + (i - 1.5) * .4;
          ctx.beginPath(); ctx.moveTo(hx, hy - 5); ctx.lineTo(hx + Math.cos(aa) * L, hy + Math.sin(aa) * L * .6 - 4); ctx.lineTo(hx, hy + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      } else if (mv === 'cubes' || mv === 'rain') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) { const ph = (time * 1.2 + i / 12) % 1; K.glow(ctx, z.x + (hash(i + st.seed) - .5) * 160, fy - ph * 200, 6, '140,130,255', ph, true); }
        ctx.globalCompositeOperation = 'source-over';
        if (mv === 'rain' && st.tele.length) {
          // cubes condensing high above the field before they drop
          for (let i = 0; i < st.tele.length; i++) { const s = st.tele[i]; drawCube(ctx, s.x, s.y, s.s * (.4 + .6 * k), 560 + (1 - k) * 200, k * .7, time, i); }
        }
      }
    }
  }
  // Karma marks spreading over the near arm, chest and face (Boruto's Karma, Kawaki's full Karma).
  function karmaMarks(ctx, z, st, time, H) {
    const a = Math.min(1, st.karma * 2), fac = facingOf(z), u = H / 62, ox = z.x, oy = z.y + 3 - st.lift;
    const P = (x, y) => [ox + fac * x * u, oy + y * u];
    const lines = z.bossId === 'kawaki'
      ? [[[-2, -24], [1, -30], [-1, -36], [3, -40]], [[4, -26], [6, -33], [4, -38]], [[3, -42], [7, -44], [9, -48]], [[-3, -32], [-6, -38], [-4, -44]], [[1, -20], [4, -24], [8, -22]]]
      : [[[-1, -22], [2, -27], [0, -32], [3, -36]], [[3, -40], [6, -43], [8, -47]], [[0, -30], [-3, -35]]];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(150,170,255,${.5 * a})` : `rgba(8,6,14,${.85 * a})`;
      ctx.lineWidth = (pass ? .8 : 2.4) * u * 1.2;
      ctx.beginPath();
      for (const pts of lines) pts.forEach(([x, y], i) => { const [px, py] = P(x + Math.sin(time * 3 + i) * .3, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    Kit().glow(ctx, ox, oy - H * .55, H * .9, '120,130,255', .18 * a, false, 1.3);
    ctx.globalCompositeOperation = 'source-over';
  }
  function sageAura(ctx, z, st, time, H) {
    const K = Kit(), a = Math.min(1, st.sage * 1.5), fy = z.y + 3 - st.lift;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, H * .95, '255,220,120', .22 * a, false, 1.3);
    for (let i = 0; i < 8; i++) {
      const ph = (time * .7 + i / 8) % 1, x = z.x + Math.sin(i * 2.3 + time * 1.4) * H * .4;
      K.glow(ctx, x, fy - ph * H * 1.2, 5, '255,240,170', .9 * bell(ph) * a, true);
    }
    // golden snake-eye glint
    K.glow(ctx, z.x + facingOf(z) * H * .14, fy - H * .8, 10, '255,210,80', .7 * a, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - st.lift - bodyH(z.bossId) - (z.bossId === 'boruto' && st.move === 'karma' ? 150 : 40);
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#120e1c';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    if (def.shout) {
      const bob = Math.sin(time * 9) * 1.5;
      ctx.font = 'italic 800 10px sans-serif'; ctx.lineWidth = 3;
      ctx.strokeText(def.shout, z.x, top - 14 + bob); ctx.fillStyle = '#ffffff'; ctx.fillText(def.shout, z.x, top - 14 + bob);
    }
    ctx.restore();
  }

  // ================================================================== module hooks
  function draw(ctx, z, time) {
    const st = z.bt;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (z.bossId === 'mitsuki' && st.sage > 0) {
        ctx.globalCompositeOperation = 'lighter';
        Kit().spin(ctx, SW.gold(), z.x, z.y, 46, time * 3, .4 * Math.min(1, st.sage), .5);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (st.karma > 0) karmaLines(ctx, z.x, z.y, 90, 1, Math.min(1, st.karma * 2) * .55, 7 + Math.floor(time * 4) % 3);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.bt, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    const H = bodyH(z.bossId);
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.karma > 0) karmaMarks(ctx, z, st, time, H);
      if (z.bossId === 'mitsuki' && st.sage > 0) sageAura(ctx, z, st, time, H);
      const [hx, hy] = handPos(z, st, H);
      // Boruto's giant orb rides overhead through the leap.
      if (z.bossId === 'boruto' && st.orb) {
        const ox = z.x + facingOf(z) * 6, oy = z.y + 3 - st.lift - H - 58;
        rasOrb(ctx, ox, oy, 56, time, 1);
        ctx.globalCompositeOperation = 'lighter'; Kit().spin(ctx, SW.karma(), ox, oy, 62, time * 5, .5); ctx.globalCompositeOperation = 'source-over';
      }
      // Sarada's Chidori crackling in her hand.
      if (z.bossId === 'sarada' && st.chid > 0) {
        const k = st.windup > 0 ? 1 - st.windup / st.windMax : 1;
        Kit().chidoriBall(ctx, hx, hy, 10 + 10 * k, time, st.seed, { pal: BOLT_PAL, body: '60,120,230', base: 'rgba(14,30,90,.6)', power: k, alpha: 1, bolts: 9, width: 1.1 });
      }
      // Kawaki's arm morphed into the Karma hammer: raised overhead, swung down through the leap.
      if (z.bossId === 'kawaki' && st.ham > 0) {
        const k = st.windup > 0 ? easeOut(1 - st.windup / st.windMax) : 1, fac = facingOf(z), s = 16 + 24 * k;
        const swing = st.arc ? easeIn(st.arc.t / st.arc.dur) : st.windup > 0 ? 0 : 1;
        const sx = z.x + fac * 5, sy = hy - 4, ang = -Math.PI / 2 + fac * (-.45 + 2.1 * swing), L = 24 + 16 * k;
        const ex = sx + Math.cos(ang) * L, ey = sy + Math.sin(ang) * L;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#05040a'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#1a1824'; ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = 'rgba(160,150,255,.7)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.fillStyle = '#121019'; ctx.fillRect(-s * .5, -s * .9, s * 1.0, s * 1.8);
        ctx.fillStyle = '#2a2836'; ctx.fillRect(-s * .5, -s * .9, s * .3, s * 1.8);
        ctx.strokeStyle = '#05040a'; ctx.lineWidth = 2.6; ctx.strokeRect(-s * .5, -s * .9, s * 1.0, s * 1.8);
        // Karma spikes along the striking face
        ctx.fillStyle = '#0d0c14'; ctx.beginPath();
        for (let i = 0; i < 4; i++) { const y0 = -s * .9 + i * s * .45; ctx.moveTo(s * .5, y0 + s * .05); ctx.lineTo(s * .5 + s * .32, y0 + s * .225); ctx.lineTo(s * .5, y0 + s * .4); }
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,150,255,.85)'; ctx.lineWidth = 1.2; ctx.strokeRect(-s * .4, -s * .8, s * .8, s * 1.6);
        ctx.beginPath(); ctx.moveTo(0, -s * .5); ctx.lineTo(s * .22, 0); ctx.lineTo(0, s * .5); ctx.lineTo(-s * .22, 0); ctx.closePath(); ctx.stroke();
        ctx.restore();
        if (st.arc) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, ex, ey, s * 1.6, '140,130,255', .35 * swing); ctx.globalCompositeOperation = 'source-over'; }
      }
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, H);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.bt && z.bt.vanish > 0 && z.health > 0);
  const bodyLift = z => (z.bt && z.health > 0 ? z.bt.lift || 0 : 0);

  window.BorutoBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moveLabels, moves };
})();
