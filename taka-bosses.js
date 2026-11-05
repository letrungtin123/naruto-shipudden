/* Taka & the samurai general (spawn panel, faction 'taka'): Hōzuki Suigetsu, Jūgo, Uzumaki Karin, Mifune.
 * Same contract as duel-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. All per-boss
 * state lives on z.tk (plain numbers / small arrays; closures in ev/upd are skipped by the co-op snapshot).
 * The four sprites are registered here with AnimeSprites.addSprite (built from AnimeSprites.kit).
 *
 * Suigetsu: Water Gun bursts, Great Water Arm punch, Water Shark Bomb, Hydrification (melts into a puddle,
 *           bursts up behind the target), Kubikiribōchō leaping slam, ultimate: a giant water arm swinging
 *           a water Kubikiribōchō down a long street (tidal wave along the cut).
 * Jūgo:     Sage Transformation hammer arm, jet-propulsion punch, curse-mark armour (damage cut + shockwave),
 *           Multi-Layered Barrage (jet shells), spear-arm fan, ultimate: Sage Art jet-arm burst (he rockets up
 *           and crashes down, three rings of explosions).
 * Karin:    sensor kunai fan, Kagura Mind's Eye lock-on strike, Adamantine chain lash (drags), healing bite
 *           (heals herself and Taka allies of her own team), chain cage, ultimate: Adamantine Sealing Chains
 *           field (dozens of golden chains, a short bind, the seal detonates).
 * Mifune:   Iai quick draw (instant line cut after a pause), cross cut, chakra-blade flying slash, counter
 *           stance (360° draw), three-step flash, ultimate: Iai "Shinkū" multi-cut flash (a storm of cut lines
 *           that all split at once when he sheathes). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 100) / 100;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;

  // ================================================================== sprites
  (function registerSprites() {
    const A = window.AnimeSprites, K = A && A.kit;
    if (!K || !A.addSprite) return;
    const { paint, seg, line, lerp, lit, litN, dark, light, mix, rgba, SHADE, DEEP, DEEP2, GLOSS, ell, dot, poly, smooth,
      locks, sweptHair, spikeHair, fringeShadow, HAIR_LINE } = K;

    // Kubikiribōchō: the huge cleaver, its round hole near the tip and the half-moon notch in the spine.
    // Local frame: grip centre at the origin, blade along +x.
    function cleaver(ctx, x, y, rot, s, wet) {
      const O = '#121a24';
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(5, 0);
      ctx.lineCap = 'round';
      seg(ctx, [-11.4, 0], [0, 0], 3, O); seg(ctx, [-11.4, 0], [0, 0], 2, '#3a2c34');
      for (let i = -10.4; i < -1; i += 1.5) line(ctx, [[i, -1.1], [i + .9, 1.1]], '#cbbca4', .45);
      dot(ctx, -11.8, 0, 1.4, O); dot(ctx, -11.8, 0, .85, '#9098a4');
      const blade = () => {
        ctx.beginPath(); ctx.moveTo(1.2, -3.6); ctx.lineTo(1.2, 4.4); ctx.lineTo(35, 6); ctx.lineTo(38, 2); ctx.lineTo(38, -5.2);
        ctx.lineTo(33.4, -5.3); ctx.arc(30.2, -5.3, 3.2, 0, Math.PI, false); ctx.lineTo(3.6, -5.6); ctx.quadraticCurveTo(1.2, -5.4, 1.2, -3.6);
        ctx.moveTo(34.2, .2); ctx.arc(31.4, .2, 2.8, 0, TAU, true);
      };
      blade(); ctx.fillStyle = wet ? '#bfe6ff' : '#c3ccd6'; ctx.fill('evenodd');
      ctx.save(); blade(); ctx.clip('evenodd');
      ctx.fillStyle = 'rgba(50,62,84,.38)'; ctx.fillRect(0, -7, 40, 4.4);
      ctx.fillStyle = 'rgba(30,40,60,.25)'; ctx.fillRect(0, -2.6, 40, 1);
      ctx.fillStyle = wet ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.moveTo(1.2, 3); ctx.lineTo(36, 4.6); ctx.lineTo(35, 6.2); ctx.lineTo(1.2, 4.6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillRect(3, -4.2, 24, .6);
      if (wet) { ctx.fillStyle = 'rgba(80,170,240,.35)'; ctx.fillRect(0, -7, 40, 14); }
      ctx.restore();
      blade(); ctx.strokeStyle = O; ctx.lineWidth = .8; ctx.lineJoin = 'round'; ctx.stroke();
      paint(ctx, () => { ctx.beginPath(); ctx.rect(-.7, -2.4, 1.9, 4.8); }, '#6c707c', O, .5);
      ctx.restore();
    }
    function bottle(ctx, x, y, r, O) {
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(x - .7, y - r * 1.5); ctx.lineTo(x + .7, y - r * 1.5); ctx.lineTo(x + .8, y - r * .9); ctx.quadraticCurveTo(x + r, y - r * .7, x + r, y); ctx.quadraticCurveTo(x + r, y + r, x, y + r); ctx.quadraticCurveTo(x - r, y + r, x - r, y); ctx.quadraticCurveTo(x - r, y - r * .7, x - .8, y - r * .9); ctx.closePath(); },
        '#9fd8f0', O, .5, () => {
          ctx.fillStyle = 'rgba(40,110,180,.45)'; ctx.fillRect(x - r, y - r * .1, r * 2, r * 1.2);
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - r * .6, y - r * .6, r * .3, r * .9);
        });
      paint(ctx, () => { ctx.beginPath(); ctx.rect(x - .9, y - r * 1.5 - .9, 1.8, 1); }, '#3a2a22', O, .35);
    }

    // Long straight hair hanging down the back (len = how far below the head it falls); ragged tips.
    function longDrape(color, len, tips = 5) {
      return (ctx, spec, pose) => {
        const O = spec.outline, run = pose && pose.run ? 1 : 0, sw = run * 3.4;
        const pts = [[6, -8], [-2, -13.8], [-10.6, -12.6], [-14.4, -5], [-15.4 - sw * .3, len * .45]];
        const x0 = -15 - sw, x1 = -3 - sw * .5;
        for (let i = 0; i <= tips * 2; i++) {
          const t = i / (tips * 2), x = x0 + (x1 - x0) * t;
          pts.push([x, len - (i % 2 ? 4.2 : 0) - t * 3 - (run ? t * 2 : 0)]);
        }
        pts.push([-2.4, len * .55], [1.4, 8], [5, 1]);
        const build = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
        paint(ctx, build, color, O, 1.05, () => {
          const sh = dark(color, .3), deep = dark(color, .48);
          ctx.fillStyle = sh; ctx.fillRect(-40, -2, 80, 60);
          ctx.fillStyle = color; ell(ctx, -9, -5, 8, 9, -.2); ctx.fill();
          ctx.fillStyle = rgba(deep, .6); ell(ctx, -6, len * .8, 8, 6); ctx.fill();
          ctx.strokeStyle = deep; ctx.lineWidth = .5; ctx.lineCap = 'round';
          for (let i = 0; i < 6; i++) { const x = -14 + i * 2.2 - sw * .4; ctx.beginPath(); ctx.moveTo(x + 2, -4 + i); ctx.quadraticCurveTo(x - 1, len * .5, x - sw * .3, len - 3); ctx.stroke(); }
          ctx.strokeStyle = rgba(light(color, .45), .55); ctx.lineWidth = .5;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 2.4, 0 + i * 2); ctx.quadraticCurveTo(-13 + i * 2, len * .3, -12 + i * 2.2, len * .55); ctx.stroke(); }
        });
      };
    }

    // Hōzuki Suigetsu (Taka): chin-length white hair with a blue tint, violet eyes, shark-tooth grin, the
    // purple sleeveless top, grey trousers, a slung belt of water bottles and Kubikiribōchō on his back.
    function suigetsuSpec() {
      const O = '#121a24', SKIN = '#f1ddce', HC = '#e2eaf4', TOP = '#7a62ae', PANTS = '#7e8596', BELT = '#6a4a32';
      return {
        outline: O, skin: SKIN, skinShade: '#c9ada6', bulk: -.1, legK: 1.12,
        legs: { thigh: PANTS, shin: PANTS, foot: '#24262e', w1: 5.2, w2: 4.4 },
        arms: { upper: SKIN, lower: SKIN, w1: 4.3, w2: 3.9, bare: true },
        torso: { base: TOP, paint: ctx => {
          // Open neck, a centre seam, the armholes' trim and fabric folds.
          ctx.fillStyle = SKIN; ctx.beginPath(); ctx.moveTo(.2, -13.4); ctx.lineTo(6.6, -13.4); ctx.lineTo(3.6, -8.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(120,70,80,.25)'; ctx.beginPath(); ctx.moveTo(2.8, -11); ctx.lineTo(4.4, -11); ctx.lineTo(3.6, -8.8); ctx.fill();
          line(ctx, [[.2, -13.4], [3.6, -8.4], [6.6, -13.4]], dark(TOP, .45), .55);
          ctx.fillStyle = dark(TOP, .35); ctx.fillRect(-8.4, -13.6, 3, 4.6); ctx.fillRect(6.6, -13.6, 2.6, 4);
          ctx.strokeStyle = rgba(dark(TOP, .5), .6); ctx.lineWidth = .4;
          for (const [x0, x1] of [[-3.6, -4.4], [6, 6.8]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .5, -7, x1, -2.4); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(4.4, -12.4, .7, 9);
          // Slung belt, low on the hip.
          ctx.fillStyle = O; ctx.beginPath(); ctx.moveTo(-8.6, -4.4); ctx.lineTo(9.4, -2.6); ctx.lineTo(9.4, -.2); ctx.lineTo(-8.6, -2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = BELT; ctx.beginPath(); ctx.moveTo(-8.6, -3.9); ctx.lineTo(9.4, -2.1); ctx.lineTo(9.4, -.7); ctx.lineTo(-8.6, -2.5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,180,.3)'; ctx.beginPath(); ctx.moveTo(-8.6, -3.9); ctx.lineTo(9.4, -2.1); ctx.lineTo(9.4, -1.7); ctx.lineTo(-8.6, -3.5); ctx.fill();
          ctx.fillStyle = '#b8bcc4'; ctx.fillRect(2.6, -3.2, 1.8, 1.8);
        } },
        collar(ctx) {
          // Low folded collar of the top.
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3, -12); ctx.quadraticCurveTo(-3.2, -14.8, -.6, -15.2); ctx.lineTo(.4, -13.2); ctx.lineTo(-1.4, -11.2); ctx.closePath(); }, TOP, O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(-4, -15, 3, 4); });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(7.4, -12.4); ctx.quadraticCurveTo(7.6, -14.8, 5.6, -15); ctx.lineTo(6.2, -13); ctx.closePath(); }, dark(TOP, .2), O, .6);
        },
        back(ctx, pose) {
          if (pose && pose.attack) return;
          cleaver(ctx, -2.6, -27, 1.92, .84);
        },
        head: {
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-18, 13.8], [-40, 15.2], [-64, 15.6], [-88, 16], [-112, 15.6], [-136, 16.2], [-160, 15.8], [-184, 15.6], [-206, 15], [-228, 14]], { valley: 12.9, sweep: .1 }),
          eyes: { type: 'normal', iris: '#8a5cc8' }, browColor: '#a8b4c8', browW: .7, mouth: 'shark', attackMouth: 'shark', blush: false, browAngle: 'angry',
          marks(ctx) {
            // Grin lines and a tooth peeking over the lip.
            line(ctx, [[1.6, 5.4], [2, 6.4]], 'rgba(110,60,60,.5)', .35);
          },
          front(ctx, spec) {
            fringeShadow(ctx, [[-3, -6], [10.6, -5.4], [10.6, -2.4], [4, -2.6], [-3, -2]]);
            // Straight, slightly ragged locks: fringe over the brow, side locks to the jaw.
            locks(ctx, spec, HC, [[-1.2, -8.4, -2.6, 8.6, 1.8, -.8], [10.2, -6.8, 11.2, 7.4, 1.5, .5], [1.4, -8.8, 1, -2.2, 1.4, -.3],
              [4.4, -8.8, 4.6, -3, 1.3, .1], [7.4, -8.4, 8.4, -2.8, 1.3, .4]], .85);
          }
        },
        front(ctx, pose, hand) {
          // The water bottles on the belt (in front of the hip).
          bottle(ctx, -5.6, -.4, 1.5, O); bottle(ctx, 7.4, 1.2, 1.35, O);
          if (pose.attack) { const a = -.5; cleaver(ctx, hand[0] - Math.cos(a) * 4, hand[1] - Math.sin(a) * 4, a, .95); }
        }
      };
    }

    // Jūgo (Taka): a big man with spiky orange hair and gentle orange eyes, the curse mark creeping over the
    // near side of his face and his near forearm, a high-collared indigo tunic open at the chest, a violet
    // sash, tan trousers and bandaged shins.
    function jugoSpec() {
      const O = '#1a1214', SKIN = '#e9c4a2', HC = '#f0862a', TOP = '#3d3b6c', PANTS = '#b2a17e', SASH = '#6a3a86', MARK = '#3a2216';
      const markTri = (ctx, pts) => { ctx.fillStyle = MARK; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill(); };
      return {
        outline: O, skin: SKIN, skinShade: '#c2927a', bulk: 1.1, legK: 1.16, headScale: .96,
        legs: { thigh: PANTS, shin: PANTS, foot: '#2a2620', w1: 6.4, w2: 5.4, wrap: '#e4dccb' },
        arms: {
          upper: TOP, lower: SKIN, w1: 6.4, w2: 5.8, cuff: null,
          pattern(ctx, p0, p1, p2, far) {
            // Rolled sleeve at the elbow; on the near forearm the curse mark's dark triangles and a
            // grey Sage-transformed patch with a jet vent.
            const e0 = lerp(p0, p1, .82), e1 = lerp(p1, p2, .12);
            seg(ctx, e0, e1, 7.8, O); seg(ctx, e0, e1, 6.4, dark(TOP, far ? .3 : .1));
            if (far) return;
            const [nx, ny] = litN(p1, p2);
            const m = lerp(p1, p2, .55), m2 = lerp(p1, p2, .78);
            ctx.fillStyle = rgba('#5a5258', .55); ell(ctx, m[0], m[1], 2.4, 1.9, Math.atan2(p2[1] - p1[1], p2[0] - p1[0])); ctx.fill();
            markTri(ctx, [[m[0] - nx * 2.6, m[1] - ny * 2.6], [m[0] + 1.6, m[1] + 1.2], [m[0] - nx * .4 + 1, m[1] - ny * .4 - 1.4]]);
            markTri(ctx, [[m2[0] - nx * 2.2, m2[1] - ny * 2.2], [m2[0] + 1.2, m2[1] + .9], [m2[0] - nx * .2 + .8, m2[1] - ny * .2 - 1.1]]);
            dot(ctx, m[0] + nx * 1.2, m[1] + ny * 1.2, .8, '#241618'); dot(ctx, m[0] + nx * 1.2 - .2, m[1] + ny * 1.2 - .2, .35, '#ff9a4a');
          }
        },
        torso: { base: TOP, paint: ctx => {
          // Chest showing in the open V, a stitched centre seam and the violet sash.
          ctx.fillStyle = SKIN; ctx.beginPath(); ctx.moveTo(-.6, -13.6); ctx.lineTo(7.2, -13.6); ctx.lineTo(3.6, -6.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(140,70,60,.3)'; ctx.beginPath(); ctx.moveTo(3.6, -10.4); ctx.lineTo(4.8, -10.6); ctx.lineTo(3.6, -6.8); ctx.fill();
          line(ctx, [[1.6, -11.4], [3, -10.6]], 'rgba(120,60,50,.45)', .35); line(ctx, [[6, -11.6], [4.6, -10.6]], 'rgba(120,60,50,.4)', .3);
          line(ctx, [[-.6, -13.6], [3.6, -6.4], [7.2, -13.6]], dark(TOP, .5), .6);
          ctx.strokeStyle = rgba(light(TOP, .4), .3); ctx.lineWidth = .35;
          for (const [x0, x1] of [[-4.6, -5.4], [6.6, 7.6]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .5, -7, x1, -3.4); ctx.stroke(); }
          ctx.fillStyle = SASH; ctx.fillRect(-9.4, -4.4, 20, 3.2);
          ctx.fillStyle = light(SASH, .3); ctx.fillRect(-9.4, -4.2, 20, .55);
          ctx.fillStyle = dark(SASH, .35); ctx.fillRect(-9.4, -1.7, 20, .5);
          ctx.fillStyle = dark(SASH, .2); ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-8.6, 3.2); ctx.lineTo(-6.6, 3.4); ctx.lineTo(-4.6, -1.6); ctx.fill();
        } },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -12); ctx.lineTo(-7.8, -19.4); ctx.quadraticCurveTo(-2, -17.6, 3, -17.2); ctx.lineTo(6.6, -12); ctx.closePath(); }, dark(TOP, .25), O, .95, () => {
            ctx.fillStyle = 'rgba(0,0,10,.3)'; ctx.fillRect(-9, -20, 5, 10);
          });
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.6, -11.8); ctx.lineTo(-7.2, -16.4); ctx.quadraticCurveTo(-3, -15.6, -.8, -14); ctx.lineTo(1.6, -10.6); ctx.quadraticCurveTo(-2.4, -11.4, -6.6, -11.8); ctx.closePath(); }, TOP, O, .85, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -17, 4, 7);
            ctx.fillStyle = 'rgba(200,200,255,.22)'; ctx.fillRect(-5, -15.6, 4, .5);
          });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(8.4, -12.2); ctx.lineTo(8.6, -16); ctx.quadraticCurveTo(7.4, -15.4, 6.6, -14); ctx.lineTo(5.6, -10.8); ctx.closePath(); }, dark(TOP, .15), O, .7);
        },
        head: {
          hair: (ctx, spec) => spikeHair(ctx, spec, HC, [
            [-6, 11.6], [-18, 17], [-30, 12.4], [-44, 18.6], [-58, 13], [-72, 19.4], [-86, 13.2], [-100, 19.4], [-114, 13], [-128, 18.6],
            [-142, 12.6], [-156, 18], [-170, 12.4], [-186, 16.6], [-200, 12], [-214, 14.6], [-232, 11]], HAIR_LINE),
          eyes: { type: 'normal', iris: '#ee7a2a' }, browColor: '#b8561a', browW: .9, browAngle: 'sad', mouth: 'neutral', attackMouth: 'shout', blush: false,
          marks(ctx) {
            // Curse mark: dark triangles spreading from the near eye over the cheek and temple.
            markTri(ctx, [[-1.2, 4.6], [1.6, 5.6], [-.4, 8.2]]);
            markTri(ctx, [[-1.6, 7.6], [.6, 8.8], [-1, 10.4]]);
            markTri(ctx, [[-1.4, -1], [.6, -2.4], [-.6, .6]]);
            markTri(ctx, [[4.4, 5.6], [5.6, 6.2], [4.2, 7.4]]);
            line(ctx, [[2.6, 5.2], [2.2, 6]], 'rgba(90,40,30,.5)', .3);
          },
          front(ctx, spec) {
            locks(ctx, spec, HC, [[1.2, -8.6, -.2, -2.6, 1.6, -.4], [4.4, -8.8, 5, -3.6, 1.5, .2], [7.6, -8.2, 9.2, -3.2, 1.4, .5], [-1.8, -8, -3.4, 3.6, 1.8, -.8]], .9);
          }
        }
      };
    }

    // Uzumaki Karin (Taka): long red hair, wild and spiky on one side and straight on the other, red eyes
    // behind black-framed glasses, a zipped high-collared lavender top, bite marks on her forearms, black
    // shorts and black thigh-high stockings.
    function karinSpec() {
      const O = '#1c1018', SKIN = '#f6dccb', HC = '#d42c38', TOP = '#b9a3da', SHORTS = '#24202a', SOCK = '#1d1b22';
      return {
        outline: O, skin: SKIN, skinShade: '#dcab98', bulk: -.6, legK: 1.14,
        legs: { thigh: SKIN, shin: SOCK, foot: '#2a2430', w1: 4.9, w2: 4 },
        arms: {
          upper: TOP, lower: SKIN, w1: 4.4, w2: 3.6, bare: false,
          pattern(ctx, p0, p1, p2, far) {
            // Sleeves pushed to the elbow; the bite marks of everyone she has healed.
            const e0 = lerp(p0, p1, .78), e1 = lerp(p1, p2, .18);
            seg(ctx, e0, e1, 6, O); seg(ctx, e0, e1, 4.8, dark(TOP, far ? .3 : .08));
            const [s0, s1] = lit(e0, e1, .8); seg(ctx, s0, s1, 1.4, light(TOP, .2));
            if (far) return;
            for (const t of [.42, .62, .8]) {
              const m = lerp(p1, p2, t);
              ctx.strokeStyle = 'rgba(150,40,60,.75)'; ctx.lineWidth = .34;
              ctx.beginPath(); ctx.arc(m[0], m[1] - .3, 1, .2, Math.PI - .2); ctx.stroke();
              ctx.beginPath(); ctx.arc(m[0], m[1] + .4, 1, Math.PI + .2, TAU - .2); ctx.stroke();
            }
          }
        },
        torso: { base: TOP, paint: ctx => {
          line(ctx, [[3.6, -13.4], [3.4, -2]], dark(TOP, .45), .5);
          line(ctx, [[3.85, -13.4], [3.65, -2]], 'rgba(255,255,255,.4)', .25);
          ctx.strokeStyle = rgba(dark(TOP, .4), .5); ctx.lineWidth = .35;
          for (const [x0, x1] of [[-3, -3.8], [6.4, 7]]) { ctx.beginPath(); ctx.moveTo(x0, -11); ctx.quadraticCurveTo(x0 + .5, -7, x1, -2.6); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,.2)'; ell(ctx, 1.6, -9, 3, 1.6); ctx.fill();
          // Belt with a pouch at the hip.
          ctx.fillStyle = '#3a2c2a'; ctx.fillRect(-7.6, -2.4, 16, 1.8);
          ctx.fillStyle = 'rgba(255,220,200,.25)'; ctx.fillRect(-7.6, -2.4, 16, .4);
          ctx.fillStyle = '#5a4434'; ctx.fillRect(-6.6, -2.6, 3, 3);
          ctx.strokeStyle = O; ctx.lineWidth = .35; ctx.strokeRect(-6.6, -2.6, 3, 3);
        } },
        skirt: { color: SHORTS, hem: 14.2, flare: .3, opening: false, paint: (ctx, hem) => {
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-20, hem - 1.2, 40, .5);
        } },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-2.6, -12); ctx.lineTo(-2.6, -16.6); ctx.quadraticCurveTo(1.4, -17.6, 5.2, -16.4); ctx.lineTo(5.6, -12.2); ctx.closePath(); }, TOP, O, .8, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-3, -17, 3, 6);
            line(ctx, [[3.4, -16.8], [3.4, -12]], dark(TOP, .45), .45);
            ctx.fillStyle = '#d8d8e0'; ctx.fillRect(2.9, -16.2, 1, 1.2);
          });
        },
        head: {
          drape: longDrape(HC, 26, 6),
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-14, 15.6], [-36, 17.8], [-58, 18.4], [-82, 16.4], [-106, 15.4], [-130, 14.8], [-154, 14.6], [-180, 14.4], [-206, 14], [-228, 13.4]], { valley: 12.8, sweep: .24 }),
          eyes: { type: 'normal', iris: '#d0203a', fem: true }, browColor: '#a01a28', browW: .6, mouth: 'smile', attackMouth: 'shout',
          marks(ctx, spec) {
            // Black rounded-rectangle glasses with a pale glint.
            const lens = (x0, y0, x1, y1) => {
              ctx.fillStyle = 'rgba(200,220,255,.18)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
              ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(x0 + .8, y1 - .4); ctx.lineTo(x0 + 2, y0 + .3); ctx.lineTo(x0 + 2.7, y0 + .3); ctx.lineTo(x0 + 1.5, y1 - .4); ctx.fill();
              ctx.strokeStyle = spec.outline; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x0 + .6, y0); ctx.lineTo(x1 - .6, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + .6);
              ctx.lineTo(x1, y1 - .6); ctx.quadraticCurveTo(x1, y1, x1 - .6, y1); ctx.lineTo(x0 + .6, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - .6); ctx.lineTo(x0, y0 + .6); ctx.quadraticCurveTo(x0, y0, x0 + .6, y0); ctx.stroke();
            };
            lens(-.4, -.4, 5, 4.4); lens(6.3, -.5, 10, 4.2);
            line(ctx, [[5, .8], [6.3, .7]], spec.outline, .6);
            line(ctx, [[-.4, .8], [-3.2, 1.3]], spec.outline, .6);
          },
          front(ctx, spec) {
            fringeShadow(ctx, [[-3, -6], [10.6, -5.4], [10.6, -2], [4, -2.6], [-3, -2]]);
            // Near side: wild spiky locks; far side: a straight curtain down past the jaw.
            locks(ctx, spec, HC, [[-1.6, -8.4, -4.2, 4.4, 1.9, -1.6], [-.6, -8.6, -2.6, 9, 1.4, -1.2], [1.6, -8.8, .8, -1.6, 1.4, -.6],
              [4.6, -8.8, 4.2, -3.2, 1.3, -.2], [7.6, -8.4, 8.2, -3.6, 1.2, .2], [10, -6.8, 10.8, 10.6, 1.6, .4]], .85);
          }
        }
      };
    }

    // Mifune, general of the Land of Iron: long grey hair parted in the middle, a navy head wrap, heavy-lidded
    // eyes, a long drooping grey moustache and chin beard; navy-steel samurai armour laced in white, big rounded
    // shoulder guards, armoured tassets over a dark hakama, and the katana sheathed at his hip.
    function katana(ctx, x, y, rot, s, drawn) {
      const O = '#14161e';
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      ctx.lineCap = 'round';
      // grip: white wrap with the dark diamond pattern, round tsuba
      seg(ctx, [-8.4, 0], [0, 0], 2.4, O); seg(ctx, [-8.4, 0], [0, 0], 1.5, '#e8e6e0');
      ctx.strokeStyle = '#2a2c3a'; ctx.lineWidth = .32;
      ctx.beginPath(); for (let i = -7.8; i < -.6; i += 1.4) { ctx.moveTo(i, -.75); ctx.lineTo(i + .7, .75); ctx.moveTo(i, .75); ctx.lineTo(i + .7, -.75); } ctx.stroke();
      dot(ctx, -8.8, 0, 1, O); dot(ctx, -8.8, 0, .55, '#b89a52');
      paint(ctx, () => ell(ctx, .5, 0, .9, 2.6), '#b89a52', O, .5);
      if (drawn) {
        // blade: long, thin, slight curve, bright edge
        const bl = () => { ctx.beginPath(); ctx.moveTo(1.2, -.8); ctx.quadraticCurveTo(16, -1.6, 30, -3.6); ctx.lineTo(31.6, -3.2); ctx.quadraticCurveTo(17, .6, 1.2, .9); ctx.closePath(); };
        paint(ctx, bl, '#dfe6ee', O, .5, () => {
          ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.moveTo(1.2, .3); ctx.quadraticCurveTo(17, -.2, 31.4, -3.3); ctx.lineTo(31.6, -3.2); ctx.quadraticCurveTo(17, .6, 1.2, .9); ctx.fill();
          ctx.fillStyle = 'rgba(70,90,130,.35)'; ctx.beginPath(); ctx.moveTo(1.2, -.8); ctx.quadraticCurveTo(16, -1.6, 30, -3.6); ctx.lineTo(30, -2.6); ctx.quadraticCurveTo(16, -.8, 1.2, -.2); ctx.fill();
        });
      } else {
        // the black lacquered scabbard
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(1.2, -1.2); ctx.quadraticCurveTo(16, -2, 30, -4.2); ctx.lineTo(30.6, -2.2); ctx.quadraticCurveTo(17, .2, 1.2, 1.2); ctx.closePath(); }, '#1c1e2a', O, .55, () => {
          ctx.fillStyle = 'rgba(150,170,220,.4)'; ctx.beginPath(); ctx.moveTo(1.2, -1); ctx.quadraticCurveTo(16, -1.8, 30, -4); ctx.lineTo(30, -3.5); ctx.quadraticCurveTo(16, -1.3, 1.2, -.5); ctx.fill();
          ctx.fillStyle = '#b89a52'; ctx.fillRect(28.6, -4.4, 1.4, 2.6);
        });
        line(ctx, [[4, -.6], [5.4, 1.6], [7.6, .4]], '#e8e4da', .55);
      }
      ctx.restore();
    }
    function mifuneSpec() {
      const O = '#14161e', SKIN = '#e7cbb3', HC = '#cfd1d6', ARM = '#3c4a68', ARM_L = '#56688c', LACE = '#e6e8ee', UNDER = '#252935', WRAP = '#2c3654';
      const lames = (ctx, x0, x1, y0, y1, step) => {
        for (let y = y0; y < y1; y += step) {
          ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x0, y, x1 - x0, .5);
          ctx.strokeStyle = '#1e2638'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(x0, y + step - .2); ctx.lineTo(x1, y + step - .4); ctx.stroke();
          ctx.fillStyle = LACE; for (let x = x0 + 1.4; x < x1; x += 2.6) ctx.fillRect(x, y + step * .45, .5, .5);
        }
      };
      return {
        outline: O, skin: SKIN, skinShade: '#bf9a84', bulk: .5, legK: 1.08,
        legs: { thigh: UNDER, shin: UNDER, foot: '#1c1e26', w1: 6, w2: 5, wrap: '#6a7896' },
        arms: { upper: UNDER, lower: UNDER, guard: ARM, w1: 5.2, w2: 4.8, hand: SKIN },
        torso: { base: ARM, paint: ctx => {
          // Lamellar breastplate laced in white rows, a white sash knotted at the front.
          ctx.fillStyle = ARM_L; ctx.fillRect(-8, -13, 17, 3);
          lames(ctx, -8, 9, -12.8, -4.6, 2.05);
          line(ctx, [[3.2, -12.8], [3.4, -4.6]], '#1e2638', .5);
          ctx.fillStyle = '#e8e4da'; ctx.fillRect(-9, -4.4, 19, 2.6);
          ctx.fillStyle = 'rgba(120,110,100,.4)'; ctx.fillRect(-9, -2.2, 19, .5);
          ctx.fillStyle = '#e8e4da'; ctx.beginPath(); ctx.moveTo(4.2, -3); ctx.lineTo(2.6, 1.6); ctx.lineTo(4, 1.8); ctx.lineTo(5.2, -2.8); ctx.fill();
          ctx.strokeStyle = O; ctx.lineWidth = .3; ctx.stroke();
        } },
        skirt: { color: ARM, hem: 8.6, flare: 1.4, opening: true, paint: (ctx, hem, hipY) => {
          // Tassets: horizontal armoured lames laced in white.
          for (let y = hipY + 1.6; y < hem; y += 2.3) {
            ctx.strokeStyle = '#1e2638'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(-18, y + 2.1); ctx.lineTo(18, y + 2.1); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-18, y, 36, .5);
            ctx.fillStyle = LACE; for (let x = -10; x < 12; x += 2.8) ctx.fillRect(x, y + 1, .5, .5);
          }
          ctx.fillStyle = LACE; ctx.fillRect(-20, hem - .9, 40, .6);
        } },
        collarBack(ctx, pose) {
          // The scabbard at the hip, angled back behind him (empty while the blade is out).
          katana(ctx, 2, -1.6, pose && pose.attack ? 2.6 : 2.75, .8, false);
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6, -11.6); ctx.lineTo(-6.6, -15.6); ctx.quadraticCurveTo(-1.4, -14.6, 3.8, -14.4); ctx.quadraticCurveTo(6.8, -14.2, 8, -15); ctx.lineTo(7.8, -11.6); ctx.closePath(); }, UNDER, O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -16, 5, 6);
            ctx.fillStyle = 'rgba(230,232,240,.5)'; ctx.fillRect(-5, -14.6, 12, .6);
          });
        },
        shoulder(ctx) {
          // Big rounded shoulder guards (sode), three laced lames.
          for (let i = 2; i >= 0; i--) {
            const dy = i * 2.4;
            paint(ctx, () => smooth(ctx, [[-9.8, -13.6 + dy], [-3, -16 + dy], [3, -13 + dy], [2.2, -9.4 + dy], [-6, -8.8 + dy], [-10.6, -10.6 + dy]]), i === 2 ? dark(ARM, .15) : i ? ARM : ARM_L, O, .9, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-12, -10.8 + dy, 16, 3);
              ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(ctx, -3, -14.2 + dy, 3.6, .65, .1); ctx.fill();
              ctx.fillStyle = LACE; for (let x = -8; x < 2; x += 2.4) ctx.fillRect(x, -11.4 + dy + (x + 8) * -.05, .55, .55);
            });
          }
        },
        head: {
          drape: longDrape(HC, 30, 5),
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-16, 13.8], [-40, 14.6], [-64, 14.8], [-90, 15], [-116, 14.8], [-142, 14.8], [-168, 14.6], [-194, 14.2], [-218, 13.6]], { valley: 13, sweep: .1 }),
          eyes: { type: 'normal', iris: '#3a3c48' }, brows: 'thick', browW: 1.5, browColor: '#a9abb2', browAngle: 'angry', mouth: 'neutral', blush: false,
          marks(ctx, spec) {
            // Heavy lids, eye bags and crow's feet; the long moustache and chin beard.
            ctx.fillStyle = spec.skin; ctx.fillRect(-.2, -.6, 5.4, 1.5); ctx.fillRect(6.4, -.6, 3.4, 1.4);
            line(ctx, [[-.2, .9], [2.4, .5], [5.2, .9]], spec.outline, .6); line(ctx, [[6.4, .8], [8, .5], [9.8, .8]], spec.outline, .5);
            ctx.strokeStyle = 'rgba(110,70,60,.55)'; ctx.lineWidth = .3;
            ctx.beginPath(); ctx.moveTo(.6, 5.4); ctx.quadraticCurveTo(2.4, 6, 4.4, 5.4); ctx.moveTo(-.6, 1.6); ctx.lineTo(-1.6, 2.2); ctx.moveTo(-.6, 2.6); ctx.lineTo(-1.5, 3.3); ctx.stroke();
            const mo = () => { ctx.beginPath(); ctx.moveTo(6.6, 5.9); ctx.quadraticCurveTo(4.6, 6.4, 3.2, 8.6); ctx.quadraticCurveTo(2.6, 10.8, 2.8, 13.2); ctx.quadraticCurveTo(3.4, 10.6, 4.6, 8.4); ctx.quadraticCurveTo(6.2, 7.2, 7.4, 7.2);
              ctx.quadraticCurveTo(8.8, 7.2, 9.8, 8.6); ctx.quadraticCurveTo(10.8, 10, 11, 12); ctx.quadraticCurveTo(11.2, 9.4, 10.4, 7.6); ctx.quadraticCurveTo(9.4, 6, 7.6, 5.8); ctx.closePath(); };
            paint(ctx, mo, '#c4c6cc', spec.outline, .5, () => { ctx.fillStyle = 'rgba(80,80,100,.3)'; ctx.fillRect(0, 7.6, 14, 7); });
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(5.4, 9.6); ctx.quadraticCurveTo(7, 10.4, 8.4, 9.6); ctx.quadraticCurveTo(8.2, 13, 6.8, 15.4); ctx.quadraticCurveTo(5.6, 12.6, 5.4, 9.6); ctx.closePath(); }, '#bfc1c8', spec.outline, .45);
          },
          front(ctx, spec) {
            // Navy head wrap across the brow, knotted behind, with two long grey bangs framing the face.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-9, -6.6); ctx.quadraticCurveTo(1, -10.8, 11.2, -6.4); ctx.lineTo(11.2, -3.8); ctx.quadraticCurveTo(1, -7.8, -9, -3.8); ctx.closePath(); }, WRAP, spec.outline, .8, () => {
              ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-9, -8.6, 21, .7);
              ctx.fillStyle = SHADE; ctx.fillRect(-9, -5.4, 21, 2);
            });
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-8.6, -6); ctx.quadraticCurveTo(-13, -5, -16, -1.4); ctx.lineTo(-14.6, -.4); ctx.quadraticCurveTo(-12, -3.2, -8.4, -3.8); ctx.closePath(); }, dark(WRAP, .15), spec.outline, .6);
            locks(ctx, spec, HC, [[3.2, -6.4, -.6, 10.4, 1.6, -1.6], [8.6, -5.8, 11.4, 9.8, 1.5, 1.2]], .85);
          }
        },
        front(ctx, pose, hand) {
          if (pose.attack) { const a = -.28; katana(ctx, hand[0] - Math.cos(a) * 3.6, hand[1] - Math.sin(a) * 3.6, a, 1.05, true); }
          else if (pose.seal) {
            // Iai stance: right hand on the grip at the hip, thumb pushing the guard.
            katana(ctx, 3.6, -1.4, -.3, .95, false);
          }
        }
      };
    }

    const box = [-46, -90, 52, 16];
    A.addSprite('suigetsu', suigetsuSpec(), { scale: 1.32, box }, { hair: '#e2eaf4', fringe: 'spiky', accent: '#7ad0e8' });
    A.addSprite('jugo', jugoSpec(), { scale: 1.5, box: [-44, -90, 46, 10] }, { hair: '#f0862a', fringe: 'spiky', accent: '#ff9a3a' });
    A.addSprite('karin', karinSpec(), { scale: 1.24, box: [-44, -90, 44, 10] }, { hair: '#d42c38', fringe: 'part', accent: '#e03a4a', long: true });
    A.addSprite('mifune', mifuneSpec(), { scale: 1.36, box: [-46, -90, 50, 10] }, { hair: '#cfd1d6', fringe: 'part', accent: '#c0c8d8', long: true, marks: ['wrinkles'] });
  })();

  // ================================================================== boss kit
  const members = {
    suigetsu: { name: 'HŌZUKI SUIGETSU', accent: '#7ad0e8', hpScale: 3.2, damageScale: 1.85, armor: .95,
      moves: ['gun', 'arm', 'hydro', 'shark', 'blade', 'ult', 'shark', 'gun', 'blade', 'hydro', 'arm', 'ult'] },
    jugo: { name: 'JŪGO — CHÚ ẤN', accent: '#ff9a3a', hpScale: 3.4, damageScale: 1.9, armor: .9,
      moves: ['hammer', 'jet', 'armor', 'barrage', 'spears', 'ult', 'jet', 'hammer', 'barrage', 'spears', 'armor', 'ult'] },
    karin: { name: 'UZUMAKI KARIN', accent: '#e03a4a', hpScale: 3.0, damageScale: 1.75,
      moves: ['kunai', 'eye', 'chain', 'bite', 'cage', 'ult', 'chain', 'kunai', 'eye', 'cage', 'bite', 'ult'] },
    mifune: { name: 'MIFUNE — SAMURAI', accent: '#c0c8d8', hpScale: 3.5, damageScale: 2.0, armor: .88,
      moves: ['iai', 'wave', 'cross', 'counter', 'flash', 'ult', 'iai', 'cross', 'wave', 'flash', 'counter', 'ult'] }
  };
  const order = Object.keys(members);
  const pick = level => order[((level % order.length) + order.length) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    suigetsu: {
      gun:   { label: 'THỦY ĐỘN · THỦY SÚNG', rgb: '120,210,255', windup: .7, after: 1.0 },
      arm:   { label: 'THỦY HÓA · HÀO THỦY OẢN', rgb: '110,200,255', windup: .85, after: 1.1 },
      hydro: { label: 'THỦY HÓA CHI THUẬT', rgb: '150,225,255', windup: .5, after: 1.0 },
      shark: { label: 'THỦY ĐỘN · THỦY GIAO ĐẠN', rgb: '90,185,255', windup: .9, after: 1.1 },
      blade: { label: 'TRẢM THỦ ĐẠI ĐAO · BỔ SƠN', rgb: '215,232,248', windup: .8, after: 1.1 },
      ult:   { label: 'HÀO THỦY OẢN · THỦY QUỶ ĐẠI TRẢM', shout: 'ĐỂ TA CHÉM ĐÔI NGƯƠI!', rgb: '80,190,255', windup: 1.4, after: 1.7 }
    },
    jugo: {
      hammer:  { label: 'TIÊN NHÂN HÓA · CỰ CHÙY THỦ', rgb: '255,150,70', windup: .85, after: 1.1 },
      jet:     { label: 'TIÊN THUẬT · PHÚN XẠ QUYỀN', rgb: '255,170,80', windup: .75, after: 1.1 },
      armor:   { label: 'CHÚ ẤN · TIÊN NHÂN GIÁP KHẢI', rgb: '255,120,60', windup: .7, after: .9 },
      barrage: { label: 'TIÊN PHÁP · ĐA TRỌNG LIÊN ĐẠN', rgb: '255,140,60', windup: .9, after: 1.2 },
      spears:  { label: 'TIÊN NHÂN HÓA · THIÊN THƯƠNG', rgb: '255,185,120', windup: .8, after: 1.1 },
      ult:     { label: 'TIÊN PHÁP · PHÚN XẠ ĐẠI BẠO PHÁ', shout: 'TA... KHÔNG KIỀM CHẾ ĐƯỢC NỮA!', rgb: '255,110,40', windup: 1.4, after: 1.8 }
    },
    karin: {
      kunai: { label: 'CẢM TRI · BỘC PHÙ KHỔ VÔ', rgb: '255,120,140', windup: .6, after: 1.0 },
      eye:   { label: 'THẦN LẠC TÂM NHÃN', rgb: '255,70,90', windup: .8, after: 1.0 },
      chain: { label: 'KIM CƯƠNG PHONG TỎA · XÍCH TIÊN', rgb: '255,215,110', windup: .8, after: 1.0 },
      bite:  { label: 'TRỊ LIỆU · GIẢO THƯƠNG THUẬT', rgb: '140,255,170', windup: .55, after: .9 },
      cage:  { label: 'KIM CƯƠNG PHONG TỎA · LAO LUNG', rgb: '255,210,100', windup: 1.0, after: 1.2 },
      ult:   { label: 'UZUMAKI · KIM CƯƠNG PHONG TỎA TRẬN', shout: 'ĐỪNG HÒNG THOÁT KHỎI TA!', rgb: '255,200,80', windup: 1.4, after: 1.8 }
    },
    mifune: {
      iai:     { label: 'IAI · NHẤT THIỂM', rgb: '235,240,255', windup: .75, after: 1.0 },
      wave:    { label: 'CHAKRA ĐAO · PHI NGUYỆT TRẢM', rgb: '160,210,255', windup: .8, after: 1.0 },
      cross:   { label: 'IAI · THẬP TỰ TRẢM', rgb: '220,232,255', windup: .85, after: 1.0 },
      counter: { label: 'IAI · VIÊN TRẢM PHẢN KÍCH', rgb: '210,225,255', windup: 1.0, after: 1.0 },
      flash:   { label: 'THUẤN BỘ · TAM LIÊN TRẢM', rgb: '230,236,255', windup: .7, after: 1.1 },
      ult:     { label: 'IAI · CHÂN KHÔNG THIÊN TRẢM', shout: 'KIẾM CỦA SAMURAI CHỈ RA MỘT LẦN.', rgb: '200,225,255', windup: 1.5, after: 1.8 }
    }
  };
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
  // Manual control (team mode): each fighter's moves in key order 1..n, ultimate last.
  const MANUAL = {}, MOVE_LISTS = {};
  for (const id in members) {
    MANUAL[id] = [...new Set(members[id].moves)];
    MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[id][k].label }));
  }
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }

  // Live Taka bosses (module-level, never on z): Karin's healing bite reaches allies of her own team.
  const LIVE = new Set();
  let NOW = 0;

  function state(z) {
    return z.tk || (z.tk = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, arc: null, jump: null, lift: 0, hold: 0, seed: 0, vanish: 0, pose: 0, armor: 0, guard: 0, heal: 0, arm: null, pin: null, spots: null, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 18) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 200) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (Spr() && Spr().has && Spr().has(id) ? Spr().height(id) : 88);
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - x1) * dx + (py - y1) * dy) / l2);
    return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
  };
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 50 + i * 16;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }
  // Farthest free point along a straight path (for blinks that must not end inside a wall).
  function reach(api, x, y, a, len, r) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let d = len; d > 30; d -= 40) if (!api.blocked(x + ca * d, y + sa * d, r)) return { x: x + ca * d, y: y + sa * d, d };
    return { x, y, d: 0 };
  }
  // A projectile-like jutsu: the path is cut into chunks hit at the moment the head passes them.
  function travelHits(st, x0, y0, a, len, sp, hw, dmg, kind, chunk = 160, t0 = 0, from = 0) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let d0 = from; d0 < len; d0 += chunk) {
      const d1 = Math.min(len, d0 + chunk);
      later(st, t0 + d0 / sp, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * d1, y0 + sa * d1, hw, dmg, kind));
    }
  }
  const targetOf = api => api.player || null;
  // A victim for grabs: the real target, or in manual mode the hostile unit nearest the aim point.
  function victim(api, x, y, r) {
    const p = api.player;
    if (!p) return null;
    if (!p.pseudo) return p;
    return api.nearestFoe ? api.nearestFoe(x, y, r) : null;
  }

  // ------------------------------------------------------------------ telegraphs per move
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    if (id === 'suigetsu') switch (move) {
      case 'gun': return [line(820, 22, a - .11), line(820, 22), line(820, 22, a + .11)];
      case 'arm': return [line(470, 70), circ(x + ca * 470, y + sa * 470, 200)];
      case 'hydro': return [circ(tx, ty, 260, true)];
      case 'shark': return [line(860, 60), circ(x + ca * 860, y + sa * 860, 190)];
      case 'blade': {
        const dd = Math.min(520, Math.max(60, d));
        st.spots = [{ x: Math.round(x + ca * dd), y: Math.round(y + sa * dd) }];
        return [line(dd, 26), circ(st.spots[0].x, st.spots[0].y, 230), circ(st.spots[0].x, st.spots[0].y, 270, true)];
      }
      case 'ult': return [line(980, 95), circ(x + ca * 980, y + sa * 980, 330), circ(x, y, 160, true)];
    }
    if (id === 'jugo') switch (move) {
      case 'hammer': {
        const dd = Math.min(260, Math.max(120, d));
        st.spots = [{ x: Math.round(x + ca * dd), y: Math.round(y + sa * dd) }];
        return [circ(st.spots[0].x, st.spots[0].y, 230)];
      }
      case 'jet': { const len = Math.min(680, Math.max(300, d + 60)); st.spots = [{ len }]; return [line(len, 70), circ(x + ca * len, y + sa * len, 200)]; }
      case 'armor': return [circ(x, y, 270)];
      case 'barrage': {
        const b = Math.random() * TAU, spots = [{ x: tx, y: ty }];
        for (let i = 0; i < 6; i++) spots.push({ x: tx + Math.cos(b + i * TAU / 6) * 230, y: ty + Math.sin(b + i * TAU / 6) * 230 });
        st.spots = spots.map(s => ({ x: Math.round(s.x), y: Math.round(s.y) }));
        return st.spots.map(s => circ(s.x, s.y, 120));
      }
      case 'spears': return [{ k: 'cone', x, y, a, r: 620, h: .58 }];
      case 'ult': {
        const dd = Math.min(620, d);
        st.spots = [{ x: Math.round(x + ca * dd), y: Math.round(y + sa * dd) }];
        const s = st.spots[0];
        return [circ(s.x, s.y, 420), circ(s.x, s.y, 600, true), circ(s.x, s.y, 780, true)];
      }
    }
    if (id === 'karin') switch (move) {
      case 'kunai': { const out = []; for (let i = 0; i < 7; i++) out.push(line(640, 16, a + (i / 6 - .5) * .8)); return out; }
      case 'eye': return [circ(tx, ty, 170), circ(x, y, 700, true)];
      case 'chain': return [line(720, 36)];
      case 'bite': return [circ(x, y, 420, true)];
      case 'cage': st.spots = [{ x: Math.round(tx), y: Math.round(ty) }]; return [circ(tx, ty, 280), circ(tx, ty, 200, true)];
      case 'ult': {
        const dd = Math.min(560, d);
        st.spots = [{ x: Math.round(x + ca * dd), y: Math.round(y + sa * dd) }];
        return [circ(st.spots[0].x, st.spots[0].y, 540), circ(st.spots[0].x, st.spots[0].y, 400, true)];
      }
    }
    if (id === 'mifune') switch (move) {
      case 'iai': { const len = Math.min(640, Math.max(260, d + 140)); st.spots = [{ len }]; return [line(len, 40)]; }
      case 'wave': return [line(920, 70)];
      case 'cross': {
        st.spots = [{ x: Math.round(tx), y: Math.round(ty) }];
        return [line(560, 34, a + Math.PI / 4, tx - Math.cos(a + Math.PI / 4) * 280, ty - Math.sin(a + Math.PI / 4) * 280),
          line(560, 34, a - Math.PI / 4, tx - Math.cos(a - Math.PI / 4) * 280, ty - Math.sin(a - Math.PI / 4) * 280)];
      }
      case 'counter': return [circ(x, y, 260)];
      case 'flash': return [line(Math.min(420, d + 150), 40), circ(tx, ty, 220, true)];
      case 'ult': {
        const dd = Math.min(560, d);
        st.spots = [{ x: Math.round(x + ca * dd), y: Math.round(y + sa * dd) }];
        return [circ(st.spots[0].x, st.spots[0].y, 560), circ(st.spots[0].x, st.spots[0].y, 280, true)];
      }
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId;
    let move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) {
      st.casts++;
      // Karin skips her healing bite when nobody (her or a teammate) needs it.
      if (move === 'bite' && st.bitten && !needsHeal(z)) move = m.moves[st.casts++ % m.moves.length];
    }
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r2(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    z.angle = st.aim;
    st.tx = Math.round(p ? p.x : z.x + Math.cos(st.aim) * 200); st.ty = Math.round(p ? p.y : z.y + Math.sin(st.aim) * 200);
    st.seed = r1(Math.random() * 99);
    st.tele = teleFor(z, st, id, move);
    if (id === 'mifune' && move === 'counter') st.guard = def.windup;
  }
  function allies(z, r) {
    const out = [];
    for (const o of LIVE) if (o !== z && o.health > 0 && o.team === z.team && NOW - ((o.tk && o.tk.seen) || 0) < 1 && Math.hypot(o.x - z.x, o.y - z.y) < r) out.push(o);
    return out;
  }
  function needsHeal(z) {
    if (z.health < z.maxHealth * .9) return true;
    return allies(z, 420).some(o => o.health < o.maxHealth * .85);
  }

  // ------------------------------------------------------------------ movement helpers
  function startDash(z, st, a, len, dur, dmg, w, end, rgb, every = .12) {
    st.dash = { a: r2(a), speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end, every };
    addFx(st, { kind: 'trail', pts: [], a: r2(a), dur: dur + .5, x0: Math.round(z.x), y0: Math.round(z.y), x1: Math.round(z.x), y1: Math.round(z.y), rgb: rgb || '255,255,255', jet: z.bossId === 'jugo' ? 1 : 0 });
  }
  function startArc(z, st, x1, y1, dur, h, end) {
    st.arc = { t: 0, dur, h, x0: z.x, y0: z.y, x1, y1, end };
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const id = z.bossId, D = api.damage || 60, a = st.aim, fn = CAST[id] && CAST[id][st.move];
    z.angle = a;
    if (fn) fn(z, st, api, D, a, Math.cos(a), Math.sin(a));
  }

  const CAST = {
    suigetsu: {
      // Three volleys of finger-flicked water bullets, re-aimed each time.
      gun(z, st, api, D) {
        for (let v = 0; v < 3; v++) later(st, v * .3, api => {
          const p = targetOf(api), a = p ? Math.atan2(p.y - z.y, p.x - z.x) : st.aim;
          z.angle = a; st.pose = .24;
          const hx = z.x + Math.cos(a) * 26, hy = z.y + Math.sin(a) * 26, len = 820, sp = 1700, as = [];
          for (const da of [-.11, 0, .11]) {
            const aa = a + da + rand(-.02, .02); as.push(r2(aa));
            travelHits(st, hx, hy, aa, len, sp, 22, D * .55, null, 150, 0, 20);
          }
          addFx(st, { kind: 'bullets', x: r1(hx), y: r1(hy), as, len, sp, dur: len / sp + .1 });
          later(st, len / sp, () => addFx(st, { kind: 'splash', pts: as.map(aa => [Math.round(hx + Math.cos(aa) * len), Math.round(hy + Math.sin(aa) * len)]), r: 60, dur: .8 }));
          addFx(st, { kind: 'splash', pts: [[Math.round(hx), Math.round(hy)]], r: 34, dur: .45, up: 1 });
          api.shake(3);
        });
        st.hold = 1.0;
      },
      // Great Water Arm: his arm swells into a huge water fist that punches down the street.
      arm(z, st, api, D, a, ca, sa) {
        const L = 470, x0 = z.x, y0 = z.y, ex = x0 + ca * L, ey = y0 + sa * L;
        addFx(st, { kind: 'warm', x: r1(x0), y: r1(y0), a: r2(a), L, f: facingOf(z), dur: 1.1 });
        later(st, .16, api => {
          api.line(x0, y0, ex, ey, 70, D * 1.5, 'shockwave');
          api.strike(ex, ey, 200, D * 1.9, null, 'crater', true);
          const p = targetOf(api);
          if (p && !p.pseudo && segDist(p.x, p.y, x0, y0, ex, ey) < 220) api.knockback(z, L + 200, 210, 0);
          api.world(ex, ey, 150, D * 2.4, 'shockwave', a);
          addFx(st, { kind: 'splash', pts: [[Math.round(ex), Math.round(ey)]], r: 210, dur: 1.3, big: 1 });
          api.shake(13);
        });
        st.pose = .5; st.hold = .9;
      },
      // Hydrification: melt into a puddle, slide under the target, burst up behind it with the cleaver.
      hydro(z, st, api, D, a) {
        const p = targetOf(api), tx = p ? p.x : st.tx, ty = p ? p.y : st.ty;
        const ba = Math.atan2(ty - z.y, tx - z.x);
        const spot = freeSpot(api, tx + Math.cos(ba) * 150, ty + Math.sin(ba) * 150, z.r) || freeSpot(api, tx, ty, z.r) || { x: z.x, y: z.y };
        addFx(st, { kind: 'splash', pts: [[Math.round(z.x), Math.round(z.y)]], r: 110, dur: .9 });
        addFx(st, { kind: 'puddle', x0: Math.round(z.x), y0: Math.round(z.y), x1: Math.round(spot.x), y1: Math.round(spot.y), T: .95, dur: 1.05 });
        st.vanish = 1.0;
        later(st, .45, () => addFx(st, { kind: 'mark', x: Math.round(spot.x), y: Math.round(spot.y), r: 210, dur: .55, rgb: '140,215,255' }));
        later(st, 1.0, api => {
          z.x = spot.x; z.y = spot.y;
          const q = targetOf(api); if (q) z.angle = Math.atan2(q.y - z.y, q.x - z.x);
          st.pose = .45; st.vanish = 0;
          addFx(st, { kind: 'geyser', x: Math.round(z.x), y: Math.round(z.y), h: 230, dur: 1.1 });
          addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r2(z.angle), r: 210, h: 1.5, side: 1, dur: .55, rgb: '200,235,255' });
          api.strike(z.x, z.y, 210, D * 1.9, null, 'vortex', true);
          api.knockback(z, 220, 160, 0);
          api.shake(11);
        });
        st.hold = 1.5;
      },
      // Water Shark Bomb: a shark of water racing down a line, bursting at the end.
      shark(z, st, api, D, a, ca, sa) {
        const L = 860, sp = 1150, x0 = z.x, y0 = z.y;
        addFx(st, { kind: 'shark', x: r1(x0), y: r1(y0), a: r2(a), L, sp, dur: L / sp + .5 });
        addFx(st, { kind: 'splash', pts: [[Math.round(x0 + ca * 40), Math.round(y0 + sa * 40)]], r: 90, dur: .7 });
        travelHits(st, x0, y0, a, L, sp, 60, D * 1.5, 'shockwave', 170, 0, 30);
        later(st, L / sp, api => {
          const ex = x0 + ca * L, ey = y0 + sa * L;
          api.strike(ex, ey, 190, D * 1.9, null, 'crater', true);
          api.world(ex, ey, 140, D * 2.4, 'shockwave', a);
          addFx(st, { kind: 'splash', pts: [[Math.round(ex), Math.round(ey)]], r: 200, dur: 1.3, big: 1 });
          api.shake(12);
        });
        st.pose = .3; st.hold = .8;
      },
      // Kubikiribōchō: a leaping overhead slam that splits the ground, then a sweeping follow-up.
      blade(z, st, api, D, a) {
        const s = st.spots[0], land = freeSpot(api, s.x, s.y, z.r) || { x: z.x, y: z.y };
        startArc(z, st, land.x, land.y, .55, 150, api => {
          api.strike(z.x, z.y, 230, D * 2.1, null, 'crater', true);
          api.world(z.x, z.y, 170, D * 2.6, 'crater', a);
          addFx(st, { kind: 'impact', x: Math.round(z.x), y: Math.round(z.y), r: 240, dur: 1.4, rgb: '200,230,255', water: 1 });
          addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r2(a), r: 230, h: 1.2, side: -1, dur: .5, rgb: '230,240,255', vert: 1 });
          api.shake(16);
          later(st, .3, api => {
            api.strike(z.x, z.y, 270, D * 1.2, null, 'blade', true);
            addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r2(a + Math.PI * .5), r: 270, h: 2.6, side: 1, dur: .6, rgb: '200,230,255' });
            api.shake(7);
          });
        });
        st.hold = 1.3;
      },
      // Ultimate: a giant water arm rises behind him and brings a giant water cleaver down the street;
      // a tidal wave rolls along the cut.
      ult(z, st, api, D, a, ca, sa) {
        const L = 980, x0 = z.x, y0 = z.y, ex = x0 + ca * L, ey = y0 + sa * L;
        addFx(st, { kind: 'giant', x: r1(x0), y: r1(y0), a: r2(a), L, f: facingOf(z), dur: 1.9 });
        api.shake(10);
        later(st, 1.0, api => {
          api.line(x0, y0, ex, ey, 95, D * 2.6, 'blade');
          api.strike(ex, ey, 330, D * 3.0, null, 'crater', true);
          for (const t of [.35, .7]) api.world(x0 + ca * L * t, y0 + sa * L * t, 170, D * 3, 'blade', a);
          api.world(ex, ey, 230, D * 3.4, 'crater', a);
          addFx(st, { kind: 'tide', x: r1(x0), y: r1(y0), a: r2(a), L, sp: L / 1.2, dur: 2.6 });
          addFx(st, { kind: 'splash', pts: [[Math.round(ex), Math.round(ey)], [Math.round(x0 + ca * L * .5), Math.round(y0 + sa * L * .5)]], r: 300, dur: 1.6, big: 1 });
          api.shake(26);
        });
        travelHits(st, x0, y0, a, L, L / 1.2, 125, D * .9, null, 200, 1.12, 100);
        st.hold = 2.5;
      }
    },
    jugo: {
      // Sage Transformation: the arm swells into a stone-hard hammer and smashes the ground.
      hammer(z, st, api, D, a) {
        const s = st.spots[0];
        st.arm = { k: 'hammer', t: 0, dur: 1.05, a: r2(a), x: s.x, y: s.y };
        later(st, .24, api => {
          api.strike(s.x, s.y, 230, D * 2.2, null, 'crater', true);
          api.world(s.x, s.y, 170, D * 2.8, 'crater', a);
          addFx(st, { kind: 'impact', x: s.x, y: s.y, r: 240, dur: 1.4, rgb: '255,160,80' });
          addFx(st, { kind: 'cracks', x: s.x, y: s.y, r: 260, dur: 2.2 });
          api.shake(15);
        });
        st.hold = 1.0;
      },
      // Jet-propulsion punch: vents on his back roar and he rockets fist-first down a line.
      jet(z, st, api, D, a) {
        const len = st.spots[0].len;
        st.arm = { k: 'jet', t: 0, dur: .75, a: r2(a) };
        startDash(z, st, a, len, .38, D * 1.3, 70, api => {
          api.strike(z.x, z.y, 200, D * 2.0, null, 'crater', true);
          api.world(z.x, z.y, 150, D * 2.6, 'shockwave', a);
          addFx(st, { kind: 'blast', list: [[Math.round(z.x + Math.cos(a) * 30), Math.round(z.y + Math.sin(a) * 30), 200, 0]], dur: 1.4 });
          api.knockback(z, 230, 180, 0);
          api.shake(14);
        }, '255,150,60');
        st.hold = .9;
      },
      // Curse-mark armour: grey plates and orange flames cover him (takes far less damage for a while).
      armor(z, st, api, D) {
        st.armor = 6.5;
        api.knockback(z, 270, 180, D * 1.0);
        addFx(st, { kind: 'impact', x: Math.round(z.x), y: Math.round(z.y), r: 270, dur: 1.2, rgb: '255,120,50' });
        addFx(st, { kind: 'cracks', x: Math.round(z.x), y: Math.round(z.y), r: 230, dur: 1.8 });
        api.shake(10);
        st.hold = .5;
      },
      // Multi-Layered Barrage: chakra shells fired from the vents on his arm, raining round the target.
      barrage(z, st, api, D) {
        const f = facingOf(z), hx = z.x + f * 14, hy = z.y;
        const list = st.spots.map((s, i) => [s.x, s.y, r2(.04 + i * .09), .5]);
        st.arm = { k: 'barrage', t: 0, dur: 1.25, a: r2(st.aim) };
        addFx(st, { kind: 'shells', x: Math.round(hx), y: Math.round(hy), list, dur: 1.3 });
        addFx(st, { kind: 'blast', list: list.map((s, i) => [s[0], s[1], i ? 120 : 140, r2(s[2] + s[3])]), dur: 2.4 });
        list.forEach((s, i) => later(st, s[2] + s[3], api => {
          api.strike(s[0], s[1], 120, D * 1.4, null, i % 3 === 0 ? 'crater' : null, true);
          if (i % 3 === 0) api.world(s[0], s[1], 100, D * 2, 'fire');
          api.shake(i ? 5 : 9);
        }));
        st.hold = 1.0;
      },
      // Spear arm: the transformed flesh bursts into a fan of spears.
      spears(z, st, api, D, a, ca, sa) {
        const list = [];
        for (let i = 0; i < 7; i++) list.push([r2(a + (i / 6 - .5) * 1.1 + rand(-.03, .03)), Math.round(560 + rand(0, 80))]);
        st.arm = { k: 'spears', t: 0, dur: 1.0, a: r2(a) };
        addFx(st, { kind: 'spears', x: Math.round(z.x), y: Math.round(z.y), list, dur: 1.05 });
        later(st, .12, api => {
          api.strike(z.x + ca * 190, z.y + sa * 190, 190, D * 1.6, null, null, true);
          for (const [aa, len] of list) api.line(z.x + Math.cos(aa) * 400, z.y + Math.sin(aa) * 400, z.x + Math.cos(aa) * len, z.y + Math.sin(aa) * len, 26, D * 1.4, 'blade');
          api.shake(9);
        });
        st.hold = .9;
      },
      // Ultimate: full Sage transformation, the jets fire him into the sky and he crashes onto the target;
      // three rings of explosions roll outward.
      ult(z, st, api, D) {
        const s = st.spots[0], spot = freeSpot(api, s.x, s.y, z.r) || { x: z.x, y: z.y };
        st.jump = { t: 0, x0: Math.round(z.x), y0: Math.round(z.y), x1: Math.round(spot.x), y1: Math.round(spot.y) };
        st.arm = { k: 'ult', t: 0, dur: 1.9, a: r2(st.aim) };
        addFx(st, { kind: 'impact', x: Math.round(z.x), y: Math.round(z.y), r: 200, dur: 1.0, rgb: '255,140,60' });
        api.shake(12);
        later(st, 1.0, api => {
          const x = spot.x, y = spot.y;
          api.strike(x, y, 420, D * 3.2, null, 'crater', true);
          api.world(x, y, 260, D * 4, 'crater');
          addFx(st, { kind: 'impact', x: Math.round(x), y: Math.round(y), r: 430, dur: 1.8, rgb: '255,120,40', big: 1 });
          addFx(st, { kind: 'cracks', x: Math.round(x), y: Math.round(y), r: 520, dur: 3 });
          const ring = (R, n, t0, dmg) => {
            const b = Math.random() * TAU, list = [];
            for (let i = 0; i < n; i++) list.push([Math.round(x + Math.cos(b + i * TAU / n) * R), Math.round(y + Math.sin(b + i * TAU / n) * R), 120, r2(t0 + hash(i) * .08)]);
            addFx(st, { kind: 'blast', list, dur: t0 + 1.6 });
            later(st, t0, api => {
              for (const q of list) api.strike(q[0], q[1], 110, dmg, null, null, true);
              api.world(list[0][0], list[0][1], 120, dmg * 1.5, 'fire'); api.world(list[n >> 1][0], list[n >> 1][1], 120, dmg * 1.5, 'fire');
              api.shake(14);
            });
          };
          ring(540, 10, .25, D * 1.6);
          ring(720, 14, .5, D * 1.2);
          api.shake(30);
        });
        st.hold = 2.0;
      }
    },
    karin: {
      // A fan of seven kunai with explosive tags; they stick in the ground and blow.
      kunai(z, st, api, D, a) {
        const list = [], len = 640, sp = 1300, x0 = z.x, y0 = z.y;
        for (let i = 0; i < 7; i++) { const aa = a + (i / 6 - .5) * .8; list.push(r2(aa)); travelHits(st, x0, y0, aa, len, sp, 18, D * .6, null, 160, 0, 50); }
        addFx(st, { kind: 'kunai', x: r1(x0), y: r1(y0), list, len, sp, dur: len / sp + .6 });
        later(st, len / sp + .45, api => {
          const ends = list.map(aa => [Math.round(x0 + Math.cos(aa) * len), Math.round(y0 + Math.sin(aa) * len), 80, 0]);
          addFx(st, { kind: 'blast', list: ends, dur: 1.3 });
          api.strike(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, 280, D * 1.2, null, 'fire', true);
          api.shake(8);
        });
        st.pose = .3; st.hold = .7;
      },
      // Kagura Mind's Eye: sensing waves ripple out, lock on, and chakra needles rain on the locked spot.
      eye(z, st, api, D) {
        const p = targetOf(api), sx = Math.round(p ? p.x : st.tx), sy = Math.round(p ? p.y : st.ty);
        addFx(st, { kind: 'ripple', x: Math.round(z.x), y: Math.round(z.y), r: 700, dur: 1.4 });
        addFx(st, { kind: 'reticle', x: sx, y: sy, r: 170, dur: 1.2, hit: .55 });
        later(st, .55, api => {
          api.strike(sx, sy, 170, D * 2.1, null, 'crater', true);
          api.world(sx, sy, 110, D * 2, 'crater');
          addFx(st, { kind: 'impact', x: sx, y: sy, r: 180, dur: 1.1, rgb: '255,80,100' });
          api.shake(9);
        });
        st.hold = .9;
      },
      // One Adamantine chain lashes out of her back; whoever it catches is dragged to her.
      chain(z, st, api, D, a, ca, sa) {
        const L = 720, f = facingOf(z), x0 = z.x - f * 6, y0 = z.y, ex = z.x + ca * L, ey = z.y + sa * L;
        addFx(st, { kind: 'chains', list: [[Math.round(x0), Math.round(y0), Math.round(ex), Math.round(ey), 0, .24, .3, .4, 60]], dur: 1.2 });
        later(st, .14, api => api.line(z.x, z.y, ex, ey, 36, D * 1.6, null));
        later(st, .26, api => {
          const q = victim(api, ex, ey, L);
          if (q && !q.pseudo && segDist(q.x, q.y, z.x, z.y, ex, ey) < 80) {
            const dd = Math.hypot(q.x - z.x, q.y - z.y);
            api.knockback(z, L + 80, -Math.min(440, Math.max(0, dd - 110)), D * .3);
            addFx(st, { kind: 'impact', x: Math.round(q.x), y: Math.round(q.y), r: 90, dur: .7, rgb: '255,210,100' });
          }
          api.shake(7);
        });
        st.hold = 1.0;
      },
      // Healing bite: she bites her own arm; she and the Taka allies of her team close by are healed.
      bite(z, st) {
        st.heal = 1.6; st.bitten = 1;
        addFx(st, { kind: 'heal', x: Math.round(z.x), y: Math.round(z.y), dur: 2.0 });
        st.hold = 1.2;
      },
      // Chain cage: chains erupt from the ground round the target, arch over it and crush inward.
      cage(z, st, api, D) {
        const s = st.spots[0], R = 280, list = [];
        for (let i = 0; i < 12; i++) {
          const an = i * TAU / 12 + hash(st.seed + i) * .2;
          list.push([Math.round(s.x + Math.cos(an) * R), Math.round(s.y + Math.sin(an) * R), s.x, s.y, r2(i * .025), .3, .75, .35, 150, 1]);
        }
        addFx(st, { kind: 'chains', list, dur: 1.6 });
        addFx(st, { kind: 'seal', x: s.x, y: s.y, r: R, dur: 1.6 });
        later(st, .25, api => {
          api.strike(s.x, s.y, R, D * 1.2, null, null, true);
          // The cage closes: whoever is inside is drawn toward the middle.
          const p = targetOf(api);
          if (p && !p.pseudo && !p.remote && Math.hypot(p.x - s.x, p.y - s.y) < R) {
            const nx = p.x + (s.x - p.x) * .5, ny = p.y + (s.y - p.y) * .5;
            if (!api.blocked(nx, ny, p.r || 16)) { p.x = nx; p.y = ny; }
          }
          api.shake(6);
        });
        later(st, 1.0, api => {
          api.strike(s.x, s.y, 210, D * 1.9, null, 'crater', true);
          api.world(s.x, s.y, 150, D * 2.4, 'crater');
          addFx(st, { kind: 'impact', x: s.x, y: s.y, r: 220, dur: 1.2, rgb: '255,210,100' });
          api.shake(12);
        });
        st.hold = 1.3;
      },
      // Ultimate: dozens of Adamantine chains burst from her back and the ground, bind the field briefly,
      // and the Uzumaki seal under it detonates.
      ult(z, st, api, D) {
        const s = st.spots[0], R = 540, f = facingOf(z), bx = Math.round(z.x - f * 8), by = Math.round(z.y), list = [];
        for (let i = 0; i < 14; i++) {
          const an = hash(st.seed + i * 3.1) * TAU, rr = R * Math.sqrt(hash(st.seed + i * 7.7)) * .95;
          list.push([bx, by, Math.round(s.x + Math.cos(an) * rr), Math.round(s.y + Math.sin(an) * rr), r2(i * .035), .3, 1.5, .4, 120 + hash(i) * 120, 0]);
        }
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8;
          list.push([Math.round(s.x + Math.cos(an) * R), Math.round(s.y + Math.sin(an) * R), s.x, s.y, r2(.35 + i * .03), .3, 1.1, .35, 180, 1]);
        }
        addFx(st, { kind: 'chains', list, dur: 2.6 });
        addFx(st, { kind: 'seal', x: s.x, y: s.y, r: R, dur: 2.5, big: 1 });
        api.shake(10);
        later(st, .35, api => { api.strike(s.x, s.y, R, D * 1.4, null, null, true); api.shake(10); });
        later(st, .5, api => {
          const p = targetOf(api);
          if (p && !p.pseudo && !p.remote && Math.hypot(p.x - s.x, p.y - s.y) < R) st.pin = { x: Math.round(p.x), y: Math.round(p.y), t: 1.0 };
        });
        later(st, 1.75, api => {
          api.strike(s.x, s.y, R * .8, D * 3.0, null, 'crater', true);
          api.world(s.x, s.y, 240, D * 3.6, 'crater');
          for (let i = 0; i < 3; i++) api.world(s.x + Math.cos(i * 2.1) * 260, s.y + Math.sin(i * 2.1) * 260, 130, D * 2.4, 'shockwave');
          addFx(st, { kind: 'impact', x: s.x, y: s.y, r: 480, dur: 1.8, rgb: '255,205,90', big: 1 });
          api.shake(26);
        });
        st.hold = 2.3;
      }
    },
    mifune: {
      // Iai: after the still pause, he is suddenly past the target and the line splits.
      iai(z, st, api, D, a) {
        const len = st.spots[0].len, x0 = z.x, y0 = z.y, to = reach(api, x0, y0, a, len, z.r);
        z.x = to.x; z.y = to.y; st.pose = .4;
        addFx(st, { kind: 'after', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(to.x), y1: Math.round(to.y), f: facingOf(z), dur: .55 });
        addFx(st, { kind: 'cuts', list: [[Math.round(x0), Math.round(y0), Math.round(x0 + Math.cos(a) * len), Math.round(y0 + Math.sin(a) * len), 0]], dur: 1.1 });
        later(st, .1, api => { api.line(x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, 40, D * 2.3, 'blade'); api.shake(9); });
        st.hold = .7;
      },
      // Chakra blade: the sword's flowing chakra flies off as a crescent wave.
      wave(z, st, api, D, a) {
        const L = 920, sp = 1400;
        addFx(st, { kind: 'wave', x: r1(z.x), y: r1(z.y), a: r2(a), L, sp, dur: L / sp + .4 });
        addFx(st, { kind: 'slash', x: Math.round(z.x), y: Math.round(z.y), a: r2(a), r: 120, h: 2.2, side: 1, dur: .4, rgb: '190,225,255' });
        travelHits(st, z.x, z.y, a, L, sp, 70, D * 1.7, 'blade', 180, 0, 40);
        st.pose = .35; st.hold = .6;
      },
      // Two lightning-fast draws cut an X through the target's spot.
      cross(z, st, api, D, a) {
        const s = st.spots[0], list = [];
        [a + Math.PI / 4, a - Math.PI / 4].forEach((aa, i) => {
          const c = Math.cos(aa) * 280, d = Math.sin(aa) * 280, t0 = i * .14;
          list.push([Math.round(s.x - c), Math.round(s.y - d), Math.round(s.x + c), Math.round(s.y + d), t0]);
          later(st, t0 + .06, api => { api.line(s.x - c, s.y - d, s.x + c, s.y + d, 34, D * 1.8, 'blade'); api.shake(7); });
        });
        addFx(st, { kind: 'cuts', list, dur: 1.2 });
        st.pose = .4; st.hold = .7;
      },
      // Counter stance: sheathed and still (hard to hurt), then a 360° draw.
      counter(z, st, api, D) {
        const list = [], R = 260;
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + st.seed; list.push([Math.round(z.x + Math.cos(an) * 40), Math.round(z.y + Math.sin(an) * 40), Math.round(z.x + Math.cos(an) * R), Math.round(z.y + Math.sin(an) * R), r2(i * .02)]); }
        addFx(st, { kind: 'cuts', list, dur: .9 });
        addFx(st, { kind: 'ring', x: Math.round(z.x), y: Math.round(z.y), r: R, dur: .7 });
        api.strike(z.x, z.y, R, D * 2.2, null, 'blade', true);
        api.knockback(z, R + 10, 160, 0);
        api.shake(12);
        st.pose = .45; st.hold = .6;
      },
      // Three flash steps through the target, each a cut.
      flash(z, st, api, D) {
        for (let k = 0; k < 3; k++) later(st, k * .33, api => {
          const p = targetOf(api), base = p ? Math.atan2(p.y - z.y, p.x - z.x) : st.aim;
          const a = base + (k === 1 ? .38 : k === 2 ? -.38 : 0), d = p ? Math.hypot(p.x - z.x, p.y - z.y) : 260;
          const len = Math.min(420, Math.max(220, d + 150)), x0 = z.x, y0 = z.y, to = reach(api, x0, y0, a, len, z.r);
          z.x = to.x; z.y = to.y; z.angle = a; st.pose = .3;
          addFx(st, { kind: 'after', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(to.x), y1: Math.round(to.y), f: Math.cos(a) >= 0 ? 1 : -1, dur: .45 });
          addFx(st, { kind: 'cuts', list: [[Math.round(x0), Math.round(y0), Math.round(to.x), Math.round(to.y), 0]], dur: .8 });
          api.line(x0, y0, to.x, to.y, 40, D * 1.4, 'blade');
          api.shake(6);
        });
        st.hold = 1.1;
      },
      // Ultimate: he vanishes; a storm of cut lines flashes across the area; he reappears behind the target,
      // sheathes, and every cut splits at once.
      ult(z, st, api, D, a) {
        const s = st.spots[0], R = 560, list = [];
        addFx(st, { kind: 'poofw', x: Math.round(z.x), y: Math.round(z.y), r: 110, dur: .7 });
        st.vanish = 1.75;
        for (let i = 0; i < 14; i++) {
          const an = hash(st.seed + i * 2.3) * Math.PI, off = (hash(st.seed + i * 5.1) - .5) * R * 1.1;
          const nx = -Math.sin(an), ny = Math.cos(an), hl = Math.sqrt(Math.max(0, R * R - off * off)) * .96;
          const cx = s.x + nx * off, cy = s.y + ny * off, t0 = r2(.15 + i * .085);
          const q = [Math.round(cx - Math.cos(an) * hl), Math.round(cy - Math.sin(an) * hl), Math.round(cx + Math.cos(an) * hl), Math.round(cy + Math.sin(an) * hl), t0];
          list.push(q);
          later(st, t0 + .05, api => { api.line(q[0], q[1], q[2], q[3], 34, D * .8, null); if (i % 3 === 0) api.shake(5); });
        }
        addFx(st, { kind: 'shinku', x: s.x, y: s.y, r: R, dur: 2.7 });
        addFx(st, { kind: 'cuts', list, dur: 2.6, split: 1.75 });
        later(st, 1.75, api => {
          const p = targetOf(api), ba = p ? Math.atan2(p.y - s.y, p.x - s.x) : a;
          const sp = freeSpot(api, (p ? p.x : s.x) + Math.cos(ba) * 170, (p ? p.y : s.y) + Math.sin(ba) * 170, z.r) || { x: z.x, y: z.y };
          z.x = sp.x; z.y = sp.y; st.vanish = 0; st.pose = .6;
          z.angle = ba + Math.PI;
          api.strike(s.x, s.y, R, D * 2.8, null, 'blade', true);
          for (let i = 0; i < 4; i++) api.world(s.x + Math.cos(i * 1.57 + .4) * 220, s.y + Math.sin(i * 1.57 + .4) * 220, 130, D * 2.6, 'blade', i);
          addFx(st, { kind: 'impact', x: s.x, y: s.y, r: 500, dur: 1.4, rgb: '210,230,255', big: 1 });
          api.shake(24);
        });
        st.hold = 2.4;
      }
    }
  };

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    NOW = api.time || 0;
    st.seen = r2(NOW);
    if (z.health > 0) LIVE.add(z); else LIVE.delete(z);
    for (const o of LIVE) if (o.health <= 0 || !o.tk || NOW - (o.tk.seen || 0) > 1.5) LIVE.delete(o);
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.arc = null; st.jump = null; st.ev.length = 0; st.windup = 0; st.move = '';
      st.lift = 0; st.vanish = 0; st.arm = null; st.pin = null; st.heal = 0; st.armor = 0;
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.pose = Math.max(0, st.pose - dt);
    st.vanish = Math.max(0, st.vanish - dt);
    st.armor = Math.max(0, st.armor - dt);
    st.guard = Math.max(0, st.guard - dt);
    if (st.arm) { st.arm.t += dt; if (st.arm.t >= st.arm.dur) st.arm = null; }
    z.armorScale = (m.armor || 1) * (st.vanish > 0 ? .15 : 1) * (st.armor > 0 ? .45 : 1) * (st.guard > 0 ? .5 : 1);
    z.kageDash = 0;

    // Karin's heal over time (herself + Taka allies of her own team nearby).
    if (st.heal > 0) {
      const k = Math.min(dt, st.heal) / 1.6;
      st.heal -= dt;
      z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .14 * k);
      for (const o of allies(z, 420)) o.health = Math.min(o.maxHealth, o.health + o.maxHealth * .08 * k);
    }
    // Adamantine bind: whoever stood in the field stays put for a moment.
    if (st.pin) {
      st.pin.t -= dt;
      const p = api.player;
      if (p && !p.pseudo && !p.remote && Math.hypot(p.x - st.pin.x, p.y - st.pin.y) < 70) { p.x = st.pin.x; p.y = st.pin.y; }
      if (st.pin.t <= 0) st.pin = null;
    }
    if (st.dash) {
      const ds = st.dash;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if ((ds.wt -= dt) <= 0) { ds.wt = .12; api.world(nx, ny, 70, (api.damage || 60) * 2, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = ds.every; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      const tr = st.fx.find(f => f.kind === 'trail' && f.age < .5 && f.a === ds.a);
      if (tr) { tr.x1 = Math.round(z.x); tr.y1 = Math.round(z.y); }
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
    if (st.jump) {
      // Jūgo's ultimate: rocket up (0–.55 s), drift over the target, hang, crash down at 1.0 s.
      const j = st.jump;
      j.t += dt;
      const e = easeInOut(win(j.t, .1, .8)), nx = j.x0 + (j.x1 - j.x0) * e, ny = j.y0 + (j.y1 - j.y0) * e;
      if (!api.blocked(nx, ny, z.r * .5)) { z.x = nx; z.y = ny; }
      st.lift = j.t < .55 ? 320 * easeOut(j.t / .55) : j.t < .82 ? 320 + Math.sin((j.t - .55) * 12) * 6 : 320 * (1 - easeIn((j.t - .82) / .18));
      z.kageDash = .05;
      if (j.t >= 1) { st.jump = null; st.lift = 0; }
    }
    if (st.vanish > 0 || st.pose > 0) z.kageDash = Math.max(z.kageDash, .05);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && !st.jump && st.hold <= 0 && st.vanish <= 0) {
      if (z.manual) {
        // driven by the user: cast only what was asked for, aimed at the cursor
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, m, api);
      }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold > 0 && !st.pose && !st.vanish ? st.hold : 0;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc || !!st.jump || st.vanish > 0;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0; st.arm = null;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ telegraph shapes
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = faint ? 3.5 : 5;
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
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      if (s.len < 4) { ctx.restore(); return; }
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ shared VFX pieces
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .5) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
    }
  }
  function scorchG(ctx, x, y, r, alpha, seed, col = '30,18,14') {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(${col},${.3 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .8, r * .4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${.65 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .25);
      ctx.lineTo(x + Math.cos(b) * r * .85, y + Math.sin(b) * r * .43);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * .58);
    }
    ctx.stroke();
  }
  function crescent(ctx, cx, cy, R, w, a0, a1, sq, sym) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u;
      const prof = sym ? Math.sin(Math.PI * u) : Math.pow(Math.sin(Math.PI * Math.pow(u, .7)), .8) * (.35 + .65 * u);
      ctx.lineTo(cx + Math.cos(an) * (R - w * prof), cy + Math.sin(an) * (R - w * prof) * sq);
    }
    ctx.closePath();
  }
  function smokePoof(ctx, x, y, r, t, seed, kind = 'poof') {
    const K = Kit(), pf = K.puff(kind), e = easeOut(t / .6), a = 1 - win(t, .35, 1);
    if (a <= 0) return;
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .5, d = r * (.15 + e * (.5 + hash(i * 2.1 + seed) * .3));
      K.stamp(ctx, pf, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - r * .25 - e * r * .2 * hash(i * 3 + seed), r * (.22 + e * .2), a * .9);
    }
    K.stamp(ctx, pf, x, y - r * .35, r * (.35 + e * .25), a);
  }
  function ringE(ctx, x, y, r, a, rgb, w, sq = .5) {
    if (a <= .01 || r <= 1) return;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * sq, 0, 0, TAU);
    ctx.lineWidth = w + 3; ctx.strokeStyle = `rgba(10,24,44,${a * .35})`; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.stroke();
  }
  function impactO(ctx, x, y, r, t, seed, rgb, big) {
    const K = Kit();
    if (t < 0) return;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) K.glow(ctx, x, y - 10, r * (.6 + t * 2), rgb, (1 - t / .35) * .9, true, .7);
    K.fx.shockRing(ctx, x, y, r * 1.1, t * 1.4, Math.max(0, 1 - t * 1.2), rgb);
    if (t > .1) K.fx.shockRing(ctx, x, y, r * 1.35, (t - .1) * 1.2, Math.max(0, .8 - t), '255,245,235');
    if (big && t > .2) K.fx.shockRing(ctx, x, y, r * 1.7, (t - .2) * 1.0, Math.max(0, .7 - t * .6), rgb);
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, x, y, r, t, seed, big ? 18 : 12);
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.1, t / 1.1, seed, '#3a2c22', big ? 16 : 12);
  }
  // Water drops thrown out in arcs (batched: one path per tone).
  function droplets(ctx, x, y, r, t, seed, n, up = 1) {
    if (t < 0 || t > 1) return;
    const k = Math.sqrt(r / 120), P = [];
    for (let i = 0; i < n; i++) {
      const an = hash(seed + i) * TAU, sp = r * (.5 + hash(i * 2.3 + seed) * .8), v0 = (160 + hash(i * 3.7 + seed) * 260) * k * up;
      const h = v0 * t - 600 * t * t; if (h < -4) continue;
      const s = Math.min(9, 2.4 + hash(i * 5.1 + seed) * 4 * k) * (1 - t * .4);
      P.push(x + Math.cos(an) * sp * t, y + Math.sin(an) * sp * t * .5 - Math.max(0, h), s);
    }
    if (!P.length) return;
    const pass = (col, grow, sh) => {
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < P.length; i += 3) { const s = P[i + 2] * sh + grow; ctx.moveTo(P[i] + s, P[i + 1]); ctx.ellipse(P[i], P[i + 1], s, s * .82, 0, 0, TAU); }
      ctx.fill();
    };
    pass('rgba(12,46,86,.6)', 1.3, 1); pass('rgba(130,210,255,.95)', 0, 1); pass('rgba(255,255,255,.9)', 0, .32);
  }
  // A tapered tube (water arm / flesh arm) from a to b through the bulge c, widths w0 -> w1.
  function tube(ctx, ax, ay, cx, cy, bx, by, w0, w1) {
    const n = 14, L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx, y = u * u * ay + 2 * u * t * cy + t * t * by;
      const dx = 2 * u * (cx - ax) + 2 * t * (bx - cx), dy = 2 * u * (cy - ay) + 2 * t * (by - cy), l = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * t) * (1 + Math.sin(Math.PI * t) * .18);
      L.push([x - dy / l * w, y + dx / l * w]); R.push([x + dy / l * w, y - dx / l * w]);
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (const p of L) ctx.lineTo(p[0], p[1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  function waterFill(ctx, a, lw = 4) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(10,40,80,${.75 * a})`; ctx.lineWidth = lw + 3; ctx.stroke();
    ctx.fillStyle = `rgba(62,160,232,${.84 * a})`; ctx.fill();
    ctx.strokeStyle = `rgba(190,238,255,${.8 * a})`; ctx.lineWidth = lw * .45; ctx.stroke();
  }
  function fleshFill(ctx, a) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(26,14,12,${a})`; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = `rgba(104,88,82,${a})`; ctx.fill();
  }

  // The water shark (cached): faces +x, belly down.
  function sharkSpr() {
    return Kit().sprite('tk:shark', 280, 140, g => {
      g.translate(140, 70); g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#0b2c4c';
      const body = () => {
        g.beginPath(); g.moveTo(122, -2); g.quadraticCurveTo(100, -34, 30, -34); g.quadraticCurveTo(-40, -32, -88, -8);
        g.lineTo(-126, -46); g.quadraticCurveTo(-116, -6, -118, 4); g.quadraticCurveTo(-116, 22, -128, 44); g.lineTo(-88, 10);
        g.quadraticCurveTo(-30, 34, 40, 30); g.quadraticCurveTo(96, 26, 122, -2); g.closePath();
      };
      // fins behind
      g.fillStyle = '#2a7cc6'; g.beginPath(); g.moveTo(10, 24); g.lineTo(-24, 62); g.lineTo(-30, 24); g.closePath(); g.fill(); g.strokeStyle = O; g.lineWidth = 4; g.stroke();
      body(); g.fillStyle = '#3c9ee6'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = '#c4ecff'; g.beginPath(); g.ellipse(30, 30, 100, 22, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(16,70,130,.45)'; g.beginPath(); g.ellipse(-10, -34, 130, 18, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-70 + i * 40, -20 + (i % 2) * 6); g.quadraticCurveTo(-50 + i * 40, -26, -30 + i * 40, -18); g.stroke(); }
      // gills
      g.strokeStyle = 'rgba(10,50,90,.7)'; g.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(46 - i * 9, -14); g.quadraticCurveTo(40 - i * 9, 0, 46 - i * 9, 12); g.stroke(); }
      g.restore();
      body(); g.strokeStyle = O; g.lineWidth = 4.5; g.stroke();
      // dorsal fin
      g.beginPath(); g.moveTo(10, -32); g.quadraticCurveTo(-6, -58, -24, -70); g.quadraticCurveTo(-18, -46, -30, -31); g.closePath();
      g.fillStyle = '#2f88d4'; g.fill(); g.stroke();
      // the gaping jaw: dark mouth, two rows of white teeth
      g.beginPath(); g.moveTo(124, -2); g.lineTo(78, 2); g.lineTo(118, 20); g.closePath(); g.fillStyle = '#0e1e3a'; g.fill(); g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath(); for (let i = 0; i < 5; i++) { const x = 84 + i * 8; g.moveTo(x, 1.4 + i * .2); g.lineTo(x + 4, 7); g.lineTo(x + 8, 1.4 + i * .4); } g.fill();
      g.beginPath(); for (let i = 0; i < 4; i++) { const x = 88 + i * 7.5; g.moveTo(x, 17 - i * .6); g.lineTo(x + 3.6, 10); g.lineTo(x + 7.2, 15 - i * .6); } g.fill();
      // eye
      g.fillStyle = '#0a1426'; g.beginPath(); g.ellipse(88, -12, 6, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(86, -14, 2, 0, TAU); g.fill();
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(80, -20); g.lineTo(96, -16); g.stroke();
      // foam rim
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-80 + i * 22, -34 + Math.sin(i) * 4, 3 + (i % 3), 0, TAU); g.fill(); }
    });
  }

  // ------------------------------------------------------------------ effect painters [ground, overlay]
  const FX = {
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed),
      (ctx, fx) => {
        impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb || '255,200,160', fx.big);
        if (fx.water) droplets(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, 16);
        else if (fx.big && fx.age < 1.4) {
          const K = Kit(), fire = K.puff('fire'), smoke = K.puff('smoke'), e = easeOut(fx.age / .7);
          for (let i = 0; i < 12; i++) {
            const an = i * TAU / 12 + hash(i + fx.seed), d = fx.r * (.2 + e * .6);
            K.stamp(ctx, smoke, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 30 - e * 60 * hash(i * 2 + fx.seed), fx.r * (.16 + e * .12), (1 - win(fx.age, .5, 1.4)) * .7);
          }
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 9; i++) {
            const an = i * TAU / 9 + hash(i * 3 + fx.seed), d = fx.r * (.1 + e * .5);
            K.stamp(ctx, fire, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 20 - e * 40, fx.r * (.14 + e * .1), (1 - win(fx.age, .2, .8)) * .85);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    mark: [(ctx, fx, time) => markCircle(ctx, fx.x, fx.y, fx.r, fx.rgb, clamp01(fx.age / fx.dur), time, false), null],
    slash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .2, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.45 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const r = fx.r * (.45 + i * .22); ctx.moveTo(fx.x + Math.cos(fx.a - fx.h) * r, fx.y + Math.sin(fx.a - fx.h) * r); ctx.arc(fx.x, fx.y, r, fx.a - fx.h, fx.a + fx.h); }
        ctx.stroke();
      },
      (ctx, fx) => {
        const t = fx.age / .2, a = 1 - win(fx.age, .2, fx.dur), K = Kit();
        const s = fx.side, from = fx.a - fx.h * s, to = from + 2 * fx.h * s * easeOut(t), cy = fx.y - 30, SQ = fx.vert ? 1 : .6;
        for (const [k, w, lag] of [[1, 30, 0], [.78, 20, .16]]) {
          const e = to - lag * s;
          if (s * (e - from) <= .04) continue;
          crescent(ctx, fx.x, cy, fx.r * k, w, from, e, SQ, false);
          ctx.strokeStyle = `rgba(16,20,40,${.6 * a})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(250,252,255,${.95 * a})`; ctx.fill();
          crescent(ctx, fx.x, cy, fx.r * k - 3, w * .35, from, e, SQ, false);
          ctx.fillStyle = `rgba(${fx.rgb},${.8 * a})`; ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x + Math.cos(to) * fx.r * .9, cy + Math.sin(to) * fx.r * .9 * SQ, 50, fx.rgb, .7 * a * (1 - win(fx.age, .18, .35)), true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    poofw: [null, (ctx, fx) => smokePoof(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed)],

    // ---- Suigetsu
    splash: [
      (ctx, fx) => {
        const t = fx.age, e = easeOut(t / .6), a = 1 - win(t, .2, fx.dur), K = Kit(), wp = K.puff('water');
        for (const [x, y] of fx.pts) {
          ctx.fillStyle = `rgba(40,120,190,${.22 * a})`; ctx.beginPath(); ctx.ellipse(x, y, fx.r * .75, fx.r * .38, 0, 0, TAU); ctx.fill();
          ringE(ctx, x, y, fx.r * (.35 + e * .8), a * .9, '170,228,255', fx.big ? 4 : 2.5);
          if (fx.big) ringE(ctx, x, y, fx.r * (.2 + e * .5), a * .7, '230,248,255', 2);
          const n = fx.big ? 10 : 6;
          for (let i = 0; i < n; i++) {
            const an = i * TAU / n + hash(i + fx.seed), d = fx.r * (.3 + e * .6);
            K.stamp(ctx, wp, x + Math.cos(an) * d, y + Math.sin(an) * d * .5, fx.r * (.1 + e * .06), a * .6, .6);
          }
        }
      },
      (ctx, fx) => {
        const t = fx.age, K = Kit(), wp = K.puff('water');
        for (const [x, y] of fx.pts) {
          if (t < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - (fx.up ? 34 : 14), fx.r * 1.1, '140,210,255', (1 - t / .25) * .6, true, .8); ctx.globalCompositeOperation = 'source-over'; }
          droplets(ctx, x, y - (fx.up ? 30 : 0), fx.r, t, fx.seed + x * .01, fx.big ? 22 : 10, fx.up ? .6 : 1);
          if (fx.big && t < 1.1) {
            const e = easeOut(t / .5), a = 1 - win(t, .4, 1.1);
            for (let i = 0; i < 7; i++) K.stamp(ctx, wp, x + (hash(i + fx.seed) - .5) * fx.r * .7, y - e * fx.r * (.4 + hash(i * 3 + fx.seed) * .7), fx.r * (.12 + e * .1), a * .85, .9);
          }
        }
      }
    ],
    bullets: [
      (ctx, fx) => {
        ctx.fillStyle = 'rgba(10,30,50,.22)';
        for (const a of fx.as) { const d = Math.min(fx.len, fx.age * fx.sp); if (fx.age * fx.sp > fx.len) continue; ctx.beginPath(); ctx.ellipse(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 9, 4, 0, 0, TAU); ctx.fill(); }
      },
      (ctx, fx) => {
        ctx.lineCap = 'round';
        for (const a of fx.as) {
          const d = fx.age * fx.sp; if (d > fx.len) continue;
          const ca = Math.cos(a), sa = Math.sin(a), tl = Math.max(0, d - 120);
          const hx = fx.x + ca * d, hy = fx.y + sa * d - 34, tx = fx.x + ca * tl, ty = fx.y + sa * tl - 34;
          for (const [w, c] of [[10, 'rgba(10,40,80,.5)'], [6.5, 'rgba(70,170,240,.85)'], [2.6, 'rgba(235,250,255,.95)']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke(); }
          ctx.fillStyle = 'rgba(10,40,80,.7)'; ctx.beginPath(); ctx.ellipse(hx, hy, 10, 6.5, a, 0, TAU); ctx.fill();
          ctx.fillStyle = '#a8e4ff'; ctx.beginPath(); ctx.ellipse(hx, hy, 8, 5, a, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(hx - ca * 2, hy - 2, 3, 1.8, a, 0, TAU); ctx.fill();
        }
      }
    ],
    warm: [
      (ctx, fx) => {
        const k = easeOut(fx.age / .16) * (1 - easeIn(win(fx.age, .62, 1))), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(30,90,150,${.25 * k})`; ctx.lineWidth = 60; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + ca * fx.L * k, fx.y + sa * fx.L * k); ctx.stroke();
      },
      (ctx, fx, time) => {
        const grow = easeOut(fx.age / .16), k = grow * (1 - easeIn(win(fx.age, .62, 1))), a = 1 - win(fx.age, .85, 1.1);
        if (k <= .02) return;
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a), f = fx.f;
        const sx = fx.x + f * 6, sy = fx.y - 50, ex = fx.x + ca * fx.L * k, ey = fx.y + sa * fx.L * k - 34;
        const mx = (sx + ex) / 2 - sa * 18 * f, my = (sy + ey) / 2 - 26;
        const fr = 26 + 24 * k;
        tube(ctx, sx, sy, mx, my, ex, ey, 11, fr * .72); waterFill(ctx, a, 5);
        // muscle highlights + bubbles inside the arm
        ctx.strokeStyle = `rgba(230,250,255,${.55 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx + (mx - sx) * .3, sy + (my - sy) * .3 - 8); ctx.quadraticCurveTo(mx, my - 14, ex - ca * fr, ey - sa * fr - fr * .5); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${.6 * a})`; ctx.beginPath();
        for (let i = 0; i < 7; i++) { const t = (hash(i + fx.seed) + time * .8) % 1, bx = sx + (ex - sx) * t + Math.sin(i * 3 + time * 5) * 6, by = sy + (ey - sy) * t + Math.cos(i * 2.2) * 6; ctx.moveTo(bx + 2.4, by); ctx.arc(bx, by, 2.4, 0, TAU); }
        ctx.fill();
        // the giant fist
        ctx.beginPath(); ctx.ellipse(ex, ey, fr, fr * .86, fx.a, 0, TAU); waterFill(ctx, a, 5);
        ctx.strokeStyle = `rgba(10,40,80,${.55 * a})`; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = -1.5; i <= 1.5; i++) { const an = fx.a + i * .38; ctx.moveTo(ex + Math.cos(an) * fr * .55, ey + Math.sin(an) * fr * .5); ctx.lineTo(ex + Math.cos(an) * fr * .95, ey + Math.sin(an) * fr * .85); }
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${.7 * a})`; ctx.beginPath(); ctx.ellipse(ex - fr * .3, ey - fr * .35, fr * .3, fr * .14, -.4, 0, TAU); ctx.fill();
        if (fx.age > .12 && fx.age < .5) droplets(ctx, ex, ey + 20, 90, fx.age - .12, fx.seed, 12, .8);
      }
    ],
    shark: [
      (ctx, fx) => {
        const d = Math.min(fx.L, fx.age * fx.sp), ca = Math.cos(fx.a), sa = Math.sin(fx.a), K = Kit(), wp = K.puff('water');
        const fade = 1 - win(fx.age, fx.L / fx.sp, fx.dur), b = Math.max(0, d - 420);
        if (d - b < 4) return;
        const nx = -sa, ny = ca;
        ctx.fillStyle = `rgba(40,120,190,${.25 * fade})`; ctx.beginPath();
        ctx.moveTo(fx.x + ca * b, fx.y + sa * b); ctx.lineTo(fx.x + ca * d + nx * 50, fx.y + sa * d + ny * 50); ctx.lineTo(fx.x + ca * d - nx * 50, fx.y + sa * d - ny * 50); ctx.closePath(); ctx.fill();
        ctx.lineCap = 'round';
        for (const s of [-1, 1]) for (const [w, c] of [[5, `rgba(10,40,70,${.35 * fade})`], [2.5, `rgba(235,250,255,${.85 * fade})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(fx.x + ca * d + nx * 20 * s, fx.y + sa * d + ny * 20 * s); ctx.lineTo(fx.x + ca * b + nx * 110 * s, fx.y + sa * b + ny * 110 * s); ctx.stroke();
        }
        for (let i = 0; i < 6; i++) { const dd = d - 40 - i * 60; if (dd < 0) break; K.stamp(ctx, wp, fx.x + ca * dd + nx * (hash(i + fx.seed) - .5) * 40, fx.y + sa * dd + ny * (hash(i * 2 + fx.seed) - .5) * 40, 22 - i * 2, fade * (.7 - i * .1), .55); }
      },
      (ctx, fx, time) => {
        const d = fx.age * fx.sp; if (d > fx.L) return;
        const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x = fx.x + ca * d, y = fx.y + sa * d - 32 + Math.sin(time * 14) * 3;
        ctx.save(); ctx.translate(x, y); ctx.rotate(fx.a + Math.sin(time * 9) * .05); if (ca < 0) ctx.scale(1, -1);
        const k = Math.min(1, fx.age * 6);
        ctx.drawImage(sharkSpr(), -150 * k, -75 * k, 300 * k, 150 * k);
        ctx.restore();
        droplets(ctx, x - ca * 40, y + 20, 80, (fx.age * 3) % 1, Math.floor(fx.age * 3) + fx.seed, 8, .7);
      }
    ],
    puddle: [
      (ctx, fx, time) => {
        const k = easeInOut(fx.age / fx.T), x = fx.x0 + (fx.x1 - fx.x0) * k, y = fx.y0 + (fx.y1 - fx.y0) * k, a = 1 - win(fx.age, fx.T, fx.dur);
        ctx.strokeStyle = `rgba(50,140,210,${.22 * a})`; ctx.lineWidth = 30; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(x, y); ctx.stroke();
        const r = 40 + Math.sin(time * 9) * 3;
        ctx.fillStyle = `rgba(10,40,80,${.55 * a})`; ctx.beginPath(); ctx.ellipse(x, y, r + 4, (r + 4) * .5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(70,170,240,${.85 * a})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${.6 * a})`; ctx.beginPath(); ctx.ellipse(x - r * .3, y - r * .15, r * .35, r * .1, -.2, 0, TAU); ctx.fill();
        for (let i = 0; i < 2; i++) ringE(ctx, x, y, r * (1 + ((time * 1.6 + i * .5) % 1) * .9), a * (1 - ((time * 1.6 + i * .5) % 1)) * .8, '200,240,255', 2);
      },
      null
    ],
    geyser: [
      (ctx, fx) => { const a = 1 - win(fx.age, .5, fx.dur); ringE(ctx, fx.x, fx.y, 60 + 140 * easeOut(fx.age / .5), a, '170,228,255', 3); },
      (ctx, fx, time) => {
        const t = fx.age, h = fx.h * (t < .15 ? easeOut(t / .15) : 1 - easeIn(win(t, .3, .9)));
        if (h > 8) {
          const w = 34, x = fx.x, y = fx.y, wob = Math.sin(time * 30) * 5;
          ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * .5 + wob, y - h * .5, x - w * .7, y - h); ctx.quadraticCurveTo(x, y - h - 30, x + w * .7, y - h);
          ctx.quadraticCurveTo(x + w * .5 - wob, y - h * .5, x + w, y); ctx.closePath(); waterFill(ctx, 1, 5);
          ctx.strokeStyle = 'rgba(240,252,255,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 4, y - 10); ctx.quadraticCurveTo(x - 10 + wob, y - h * .5, x - 6, y - h + 10); ctx.stroke();
          const K = Kit(), wp = K.puff('water');
          for (let i = 0; i < 6; i++) K.stamp(ctx, wp, x + (hash(i + fx.seed) - .5) * 80, y - h - hash(i * 3 + fx.seed) * 40, 20 + hash(i * 7) * 14, .8, .9);
        }
        droplets(ctx, fx.x, fx.y - Math.min(h, 160), 160, t, fx.seed, 18, 1.1);
      }
    ],
    giant: [
      (ctx, fx) => {
        const k1 = easeOut(fx.age / .55), a = 1 - win(fx.age, 1.3, fx.dur), bx = fx.x - fx.f * 60, by = fx.y + 4;
        ctx.fillStyle = `rgba(40,120,190,${.35 * a * k1})`; ctx.beginPath(); ctx.ellipse(bx, by, 120 * k1, 56 * k1, 0, 0, TAU); ctx.fill();
        ringE(ctx, bx, by, 130 * k1, a * .8, '190,236,255', 3);
      },
      (ctx, fx, time) => {
        const K = Kit(), wp = K.puff('water'), f = fx.f, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        const k1 = easeOut(fx.age / .55), s = easeIn(win(fx.age, .82, 1.0)), a = 1 - win(fx.age, 1.25, fx.dur);
        if (a <= 0) return;
        const bx = fx.x - f * 60, by = fx.y + 4;
        const h0x = bx - f * 50, h0y = by - 250 * k1, h1x = fx.x + ca * 90, h1y = fx.y + sa * 90 - 30;
        const hx = h0x + (h1x - h0x) * s, hy = h0y + (h1y - h0y) * s;
        const exx = bx + (hx - bx) * .5 - f * 70 * (1 - s), exy = by - 140 * k1 * (1 - s * .7);
        // blade angle: from leaning back over his head to lying along the aim
        const t0 = -Math.PI / 2 - f * .62;
        let dA = fx.a - t0; while (dA > Math.PI) dA -= TAU; while (dA < -Math.PI) dA += TAU;
        const th = t0 + dA * s, u = [Math.cos(th), Math.sin(th)], n = [-u[1], u[0]];
        const Lb = (300 + (fx.L - 100 - 300) * s) * k1, W = 120 * k1;
        // the arm (behind the blade): base pool → elbow → fist
        tube(ctx, bx, by, exx, exy, hx, hy, 52 * k1, 40 * k1); waterFill(ctx, a, 6);
        ctx.strokeStyle = `rgba(230,250,255,${.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx - 20, by - 30 * k1); ctx.quadraticCurveTo(exx - 20, exy, hx - 20, hy); ctx.stroke();
        // the water Kubikiribōchō
        const P = (along, side) => [hx + u[0] * along + n[0] * side, hy + u[1] * along + n[1] * side];
        const pts = [P(10, -W * .42), P(Lb - 120, -W * .46), P(Lb - 120, -W * .46)];
        ctx.beginPath();
        let q = P(10, -W * .42); ctx.moveTo(q[0], q[1]);
        q = P(Lb - 150, -W * .48); ctx.lineTo(q[0], q[1]);
        // spine notch
        const nc = P(Lb - 110, -W * .48); ctx.arc(nc[0], nc[1], W * .2, th + Math.PI, th, f > 0 ? true : false);
        q = P(Lb, -W * .48); ctx.lineTo(q[0], q[1]); q = P(Lb, W * .3); ctx.lineTo(q[0], q[1]); q = P(Lb - 30, W * .56); ctx.lineTo(q[0], q[1]);
        q = P(10, W * .5); ctx.lineTo(q[0], q[1]); ctx.closePath();
        const hc = P(Lb - 60, 0); ctx.moveTo(hc[0] + W * .17, hc[1]); ctx.arc(hc[0], hc[1], W * .17, 0, TAU, true);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(10,40,80,${.8 * a})`; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = `rgba(78,176,242,${.8 * a})`; ctx.fill('evenodd');
        ctx.strokeStyle = `rgba(200,240,255,${.8 * a})`; ctx.lineWidth = 3; ctx.stroke();
        // edge gleam and inner streaks
        const e0 = P(20, W * .42), e1 = P(Lb - 40, W * .46);
        ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke();
        ctx.strokeStyle = `rgba(20,80,150,${.35 * a})`; ctx.lineWidth = 10; const s0 = P(30, -W * .2), s1 = P(Lb - 180, -W * .22);
        ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
        void pts;
        // the fist round the grip
        ctx.beginPath(); ctx.ellipse(hx, hy, 46 * k1, 40 * k1, th, 0, TAU); waterFill(ctx, a, 5);
        // water streaming off the blade and foam
        ctx.strokeStyle = `rgba(120,200,255,${.7 * a})`; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const al = (hash(i + fx.seed) * .9 + .05) * Lb, p0 = P(al, W * .5), dl = 20 + ((time * 200 + i * 37) % 70); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p0[0], p0[1] + dl); }
        ctx.stroke();
        for (let i = 0; i < 6; i++) { const al = (i + .5) / 6 * Lb, p0 = P(al, -W * .48); K.stamp(ctx, wp, p0[0], p0[1], 16 + 8 * hash(i + fx.seed), .75 * a, .9); }
        if (fx.age > .98 && fx.age < 1.3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x + ca * fx.L * .5, fx.y + sa * fx.L * .5 - 20, 320, '150,220,255', (1 - win(fx.age, 1, 1.3)) * .7, true, .6); ctx.globalCompositeOperation = 'source-over'; }
      }
    ],
    tide: [
      (ctx, fx) => {
        const d = Math.min(fx.L, fx.age * fx.sp), ca = Math.cos(fx.a), sa = Math.sin(fx.a), a = 1 - win(fx.age, 1.6, fx.dur), nx = -sa, ny = ca, W = 120;
        if (a <= 0) return;
        ctx.fillStyle = `rgba(50,140,210,${.3 * a})`; ctx.beginPath();
        ctx.moveTo(fx.x + nx * W * .6, fx.y + ny * W * .6); ctx.lineTo(fx.x + ca * d + nx * W, fx.y + sa * d + ny * W); ctx.lineTo(fx.x + ca * d - nx * W, fx.y + sa * d - ny * W); ctx.lineTo(fx.x - nx * W * .6, fx.y - ny * W * .6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(230,248,255,${.6 * a})`; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i < 5; i++) { const o = (i / 4 - .5) * W * 1.5, s0 = (hash(i + fx.seed) * .4) * d; ctx.moveTo(fx.x + ca * s0 + nx * o, fx.y + sa * s0 + ny * o); ctx.lineTo(fx.x + ca * d * .95 + nx * o, fx.y + sa * d * .95 + ny * o); }
        ctx.stroke();
      },
      (ctx, fx, time) => {
        const dd = fx.age * fx.sp; if (dd > fx.L + 60) return;
        const d = Math.min(fx.L, dd), ca = Math.cos(fx.a), sa = Math.sin(fx.a), nx = -sa, ny = ca, W = 130, K = Kit(), wp = K.puff('water');
        const hgt = 80 * (1 - win(dd, fx.L * .85, fx.L + 60)), fx0 = fx.x + ca * d, fy0 = fx.y + sa * d;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const o = (i / 12 - .5) * 2 * W, hh = hgt * (1 - Math.pow(o / W, 2)) + Math.sin(time * 12 + i) * 5; const px = fx0 + nx * o - ca * 20, py = fy0 + ny * o - sa * 20 - hh; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        for (let i = 12; i >= 0; i--) { const o = (i / 12 - .5) * 2 * W; ctx.lineTo(fx0 + nx * o + ca * 14, fy0 + ny * o + sa * 14); }
        ctx.closePath(); waterFill(ctx, 1, 5);
        for (let i = 0; i < 8; i++) { const o = (i / 7 - .5) * 2 * W * .9, hh = hgt * (1 - Math.pow(o / W, 2)); K.stamp(ctx, wp, fx0 + nx * o - ca * 20, fy0 + ny * o - hh - 6, 20 + hash(i + Math.floor(time * 8)) * 10, .85, .8); }
        droplets(ctx, fx0, fy0 - hgt * .6, 140, (fx.age * 2.5) % 1, Math.floor(fx.age * 2.5) + fx.seed, 12, .8);
      }
    ],

    // ---- Jūgo
    cracks: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur * .6, fx.dur), glow = 1 - win(fx.age, .2, 1);
        if (a <= 0) return;
        const pass = (col, w) => {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            let an = i * TAU / 10 + hash(i + fx.seed) * .5, x = fx.x, y = fx.y;
            ctx.moveTo(x, y);
            for (let j = 1; j <= 4; j++) { an += (hash(i * 7 + j + fx.seed) - .5) * .7; const d = fx.r * (j / 4) * (.6 + hash(i * 3 + fx.seed) * .4); ctx.lineTo(fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .55); }
          }
          ctx.stroke();
        };
        pass(`rgba(28,18,12,${.7 * a})`, 4);
        if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; pass(`rgba(255,140,50,${.6 * glow})`, 1.6); ctx.globalCompositeOperation = 'source-over'; }
      },
      null
    ],
    blast: [
      (ctx, fx) => { for (const [x, y, r, t0] of fx.list) { const t = fx.age - t0; if (t > 0) scorchG(ctx, x, y, r * .8, 1 - win(t, 1, 1.6), fx.seed + x); } },
      (ctx, fx) => {
        const K = Kit(), fire = K.puff('fire'), smoke = K.puff('smoke');
        for (const [x, y, r, t0] of fx.list) {
          const t = fx.age - t0; if (t < 0 || t > 1.5) continue;
          const e = easeOut(t / .5), sd = hash(x * .37 + y * .11);
          ctx.globalCompositeOperation = 'lighter';
          if (t < .3) K.glow(ctx, x, y - 20, r * (1 + t * 2), '255,150,60', (1 - t / .3) * .9, true, .8);
          K.fx.shockRing(ctx, x, y, r * 1.1, t * 1.5, Math.max(0, 1 - t * 1.6), '255,170,90');
          ctx.globalCompositeOperation = 'source-over';
          const sa = 1 - win(t, .3, 1.5);
          for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + sd * 6; K.stamp(ctx, smoke, x + Math.cos(an) * r * .4 * e, y - 20 - t * 50 + Math.sin(an) * r * .2 * e, r * (.3 + e * .25), sa * .7); }
          if (t < .55) for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + sd * 3; K.stamp(ctx, fire, x + Math.cos(an) * r * .35 * e, y - 16 - e * 20 + Math.sin(an) * r * .18 * e, r * (.24 + e * .2), (1 - t / .55) * .95); }
          if (t < 1) K.fx.debris(ctx, x, y, r, t, sd * 50, '#3a2a20', 8);
        }
      }
    ],
    shells: [
      null,
      (ctx, fx) => {
        const K = Kit(), smoke = K.puff('smoke');
        for (const [x1, y1, t0, fl] of fx.list) {
          const t = fx.age - t0; if (t < 0 || t > fl) continue;
          const P = k => [fx.x + (x1 - fx.x) * k, fx.y - 54 + (y1 - fx.y + 54) * k - 170 * Math.sin(Math.PI * k)];
          const k = t / fl, [px, py] = P(k);
          for (let j = 1; j <= 3; j++) { const [qx, qy] = P(Math.max(0, k - j * .06)); K.stamp(ctx, smoke, qx, qy, 8 + j * 4, .5 - j * .12); }
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px, py, 26, '255,140,50', .9, true); ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#2a1610'; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#ffb060'; ctx.lineWidth = 2; ctx.stroke();
          if (t < .08) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 54, 40, '255,170,80', 1 - t / .08, true); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
    ],
    spears: [
      (ctx, fx) => {
        const k = easeOut(fx.age / .12) * (1 - easeIn(win(fx.age, .6, .95)));
        if (k <= 0) return;
        ctx.strokeStyle = `rgba(20,14,10,${.25 * k})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
        for (const [a, len] of fx.list) { ctx.moveTo(fx.x + Math.cos(a) * 30, fx.y + Math.sin(a) * 30); ctx.lineTo(fx.x + Math.cos(a) * len * k, fx.y + Math.sin(a) * len * k); }
        ctx.stroke();
        if (fx.age > .1 && fx.age < 1) for (const [a, len] of fx.list) dustRing(ctx, fx.x + Math.cos(a) * len, fx.y + Math.sin(a) * len, 60, fx.age - .1, fx.seed + a, 5, 'dust', .6);
      },
      (ctx, fx) => {
        const k = easeOut(fx.age / .12) * (1 - easeIn(win(fx.age, .6, .95)));
        if (k <= .02) return;
        const ox = fx.x, oy = fx.y - 34;
        for (const [a, len] of fx.list) {
          const ca = Math.cos(a), sa = Math.sin(a), L = len * k, nx = -sa, ny = ca;
          const tx = ox + ca * L, ty = oy + sa * L + 10 * (L / len);
          ctx.beginPath(); ctx.moveTo(ox + ca * 20 + nx * 9, oy + sa * 20 + ny * 9);
          for (let i = 1; i <= 4; i++) { const d = 20 + (L - 20) * i / 5, w = 9 * (1 - i / 5) + 2 * (i % 2); ctx.lineTo(ox + ca * d + nx * w, oy + sa * d + ny * w + 10 * (d / len)); }
          ctx.lineTo(tx, ty);
          for (let i = 4; i >= 1; i--) { const d = 20 + (L - 20) * i / 5, w = 9 * (1 - i / 5) + 2 * ((i + 1) % 2); ctx.lineTo(ox + ca * d - nx * w, oy + sa * d - ny * w + 10 * (d / len)); }
          ctx.lineTo(ox + ca * 20 - nx * 9, oy + sa * 20 - ny * 9); ctx.closePath();
          fleshFill(ctx, 1);
          ctx.strokeStyle = 'rgba(255,140,60,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ox + ca * 30, oy + sa * 30); ctx.lineTo(tx - ca * 20, ty - sa * 20); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ox + ca * 30 + nx * 4, oy + sa * 30 + ny * 4 - 2); ctx.lineTo(tx - ca * 30 + nx * 1.5, ty - sa * 30 + ny * 1.5 - 2); ctx.stroke();
        }
      }
    ],
    trail: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust'), len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(40,24,18,${.3 * a})`; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        for (let d = 0; d < len; d += 60) { const t = d / len, j = hash(d * .1 + fx.seed); K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 16 + j * 14, a * .6, .75); }
      },
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .45, fx.dur), K = Kit(), len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        const ux = (fx.x1 - fx.x0) / len, uy = (fx.y1 - fx.y0) / len;
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(${fx.rgb},${a * .8})` : `rgba(30,14,10,${a * .35})`; ctx.lineWidth = pass ? 2.2 : 5; ctx.beginPath();
          for (let i = 0; i < 12; i++) { const o = (hash(i + fx.seed) - .5) * 70, s0 = hash(i * 3.1 + fx.seed) * len * .7, l = len * (.25 + hash(i * 1.7 + fx.seed) * .4); ctx.moveTo(fx.x0 + ux * s0 - uy * o, fx.y0 + uy * s0 + ux * o - 40); ctx.lineTo(fx.x0 + ux * (s0 + l) - uy * o, fx.y0 + uy * (s0 + l) + ux * o - 40); }
          ctx.stroke();
        }
        if (fx.jet) {
          const fire = K.puff('fire');
          ctx.globalCompositeOperation = 'lighter';
          for (let d = len; d > 0 && d > len - 300; d -= 34) { const k = (len - d) / 300; K.stamp(ctx, fire, fx.x0 + ux * d, fx.y0 + uy * d - 50 + k * 20, 26 - k * 14, a * (1 - k) * .9); }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],

    // ---- Karin
    kunai: [
      (ctx, fx) => {
        for (const a of fx.list) {
          const d = fx.age * fx.sp; if (d < fx.len) continue;
          const x = fx.x + Math.cos(a) * fx.len, y = fx.y + Math.sin(a) * fx.len;
          ctx.fillStyle = 'rgba(20,10,10,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, TAU); ctx.fill();
        }
      },
      (ctx, fx, time) => {
        const K = Kit();
        for (const a of fx.list) {
          const d0 = fx.age * fx.sp, stuck = d0 >= fx.len, d = Math.min(fx.len, d0), q = d / fx.len;
          const ca = Math.cos(a), sa = Math.sin(a), x = fx.x + ca * d, y = fx.y + sa * d - (stuck ? 4 : 34 * (1 - q * q * q));
          ctx.save(); ctx.translate(x, y); ctx.rotate(stuck ? (ca >= 0 ? .9 : Math.PI - .9) : a); if (!stuck && ca < 0) ctx.scale(1, -1);
          // tag fluttering behind, glowing red before it blows
          const blink = stuck ? .5 + .5 * Math.sin(time * 40) : 0;
          ctx.fillStyle = '#f4efe2'; ctx.strokeStyle = '#2a1414'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-26, -5 + Math.sin(time * 30 + a) * 2); ctx.lineTo(-26, 4 + Math.sin(time * 30 + a) * 2); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#c0202a'; ctx.fillRect(-22, -2, 7, 3);
          ctx.fillStyle = '#2a2c36'; ctx.beginPath(); ctx.moveTo(-2, -3.4); ctx.lineTo(16, 0); ctx.lineTo(-2, 3.4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#d8dee8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(14, 0); ctx.stroke();
          ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-2, 0); ctx.stroke();
          ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-12, 0, 2.2, 0, TAU); ctx.stroke();
          ctx.restore();
          if (stuck && blink > .5) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 18, '255,60,60', .7); ctx.globalCompositeOperation = 'source-over'; }
          if (!stuck) { ctx.strokeStyle = 'rgba(255,120,140,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - ca * 50, y - sa * 50 + 4); ctx.lineTo(x - ca * 12, y - sa * 12); ctx.stroke(); }
        }
      }
    ],
    ripple: [
      (ctx, fx) => {
        for (let i = 0; i < 4; i++) {
          const t = (fx.age - i * .2) / (fx.dur - .6); if (t < 0 || t > 1) continue;
          const r = fx.r * easeOut(t), a = (1 - t) * .9;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU);
          ctx.strokeStyle = `rgba(40,10,20,${a * .35})`; ctx.lineWidth = 5; ctx.stroke();
          ctx.strokeStyle = `rgba(255,80,100,${a})`; ctx.lineWidth = 2.2; ctx.stroke();
        }
      },
      (ctx, fx, time) => {
        // Kagura Shingan: a red chakra flame flickers over the sensed target's heart.
        const K = Kit(); ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 46, 50 + Math.sin(time * 10) * 6, '255,60,80', .45 * (1 - win(fx.age, .6, fx.dur)), true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    reticle: [
      (ctx, fx, time) => {
        const t = fx.age, k = clamp01(t / fx.hit), a = 1 - win(t, fx.hit + .1, fx.dur), r = fx.r * (1.7 - .7 * easeOut(k));
        if (a <= 0) return;
        ctx.lineCap = 'round';
        for (const [w, c] of [[6, `rgba(40,0,10,${.4 * a})`], [3, `rgba(255,60,80,${.95 * a})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + time * 2.2; ctx.moveTo(fx.x + Math.cos(a0 - .45) * r, fx.y + Math.sin(a0 - .45) * r); ctx.arc(fx.x, fx.y, r, a0 - .45, a0 + .45); }
          for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + Math.PI / 4 - time * 1.4; ctx.moveTo(fx.x + Math.cos(a0) * r * .45, fx.y + Math.sin(a0) * r * .45); ctx.lineTo(fx.x + Math.cos(a0) * r * .75, fx.y + Math.sin(a0) * r * .75); }
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,60,80,${.18 * a * (.6 + .4 * Math.sin(time * 30))})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.fill();
      },
      (ctx, fx) => {
        // crimson chakra needles raining onto the locked spot
        const t = fx.age - (fx.hit - .22); if (t < 0 || t > .5) return;
        ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const k = clamp01((t - hash(i + fx.seed) * .1) / .22); if (k <= 0 || k >= 1) continue;
          const ox = (hash(i * 3.3 + fx.seed) - .5) * fx.r * 1.5, oy = (hash(i * 5.7 + fx.seed) - .5) * fx.r * .9;
          const x = fx.x + ox + (1 - k) * 60, y = fx.y + oy - 380 * (1 - k);
          ctx.strokeStyle = 'rgba(60,0,10,.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 18, y - 60); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,120,140,.95)'; ctx.lineWidth = 2.2; ctx.stroke();
        }
      }
    ],
    chains: [
      (ctx, fx) => {
        // ground burst where a chain erupts / lands
        for (const c of fx.list) {
          const t = fx.age - c[4]; if (t < 0 || t > 1.2) continue;
          if (c[9]) dustRing(ctx, c[0], c[1], 50, t, c[0] * .1, 5, 'dust', .7);
          else if (t > c[5]) dustRing(ctx, c[2], c[3], 46, t - c[5], c[2] * .1, 5, 'dust', .6);
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), S = [];
        for (const c of fx.list) {
          const [x0, y0, x1, y1, t0, ext, hold, ret, h, ground] = c, t = fx.age - t0;
          if (t < 0) continue;
          const p = t < ext ? easeOut(t / ext) : t < ext + hold ? 1 : 1 - easeIn((t - ext - hold) / ret);
          if (p <= .01) continue;
          const sx = x0, sy = y0 - (ground ? 0 : 46), ex = x1, ey = y1 - (ground ? 36 : 0);
          const cx = (sx + ex) / 2 + Math.sin(time * 6 + t0 * 9) * 8, cy = (sy + ey) / 2 - h;
          const L = Math.hypot(ex - sx, ey - sy) + h, n = Math.max(6, Math.min(70, Math.round(L * p / 11)));
          S.push([sx, sy, cx, cy, ex, ey, p, n]);
        }
        if (!S.length) return;
        const at = (s, u) => { const v = 1 - u; return [v * v * s[0] + 2 * v * u * s[2] + u * u * s[4], v * v * s[1] + 2 * v * u * s[3] + u * u * s[5]]; };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // dark under-stroke + golden glow along every chain
        ctx.beginPath();
        for (const s of S) { for (let i = 0; i <= s[7]; i++) { const q = at(s, s[6] * i / s[7]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } }
        ctx.strokeStyle = 'rgba(50,30,0,.5)'; ctx.lineWidth = 9; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,200,90,.28)'; ctx.lineWidth = 16; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
        // links: alternating open rings and edge-on bars
        const rings = new Path2D(), bars = new Path2D();
        for (const s of S) {
          for (let i = 0; i < s[7]; i++) {
            const u0 = s[6] * i / s[7], u1 = s[6] * (i + 1) / s[7], q0 = at(s, u0), q1 = at(s, u1), an = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
            const mx = (q0[0] + q1[0]) / 2, my = (q0[1] + q1[1]) / 2;
            if (i % 2) { rings.moveTo(mx + Math.cos(an) * 6.5, my + Math.sin(an) * 6.5); rings.ellipse(mx, my, 6.5, 3.6, an, 0, TAU); }
            else { bars.moveTo(mx - Math.cos(an) * 6, my - Math.sin(an) * 6); bars.lineTo(mx + Math.cos(an) * 6, my + Math.sin(an) * 6); }
          }
        }
        ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 4.4; ctx.stroke(rings); ctx.lineWidth = 5; ctx.stroke(bars);
        ctx.strokeStyle = '#ffd46a'; ctx.lineWidth = 2.2; ctx.stroke(rings); ctx.lineWidth = 2.6; ctx.stroke(bars);
        ctx.strokeStyle = 'rgba(255,250,220,.8)'; ctx.lineWidth = .9; ctx.stroke(rings);
        // spearheads at the tips
        for (const s of S) {
          const q = at(s, s[6]), q0 = at(s, Math.max(0, s[6] - .03)), an = Math.atan2(q[1] - q0[1], q[0] - q0[0]);
          ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(an);
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, -7); ctx.lineTo(0, 0); ctx.lineTo(-4, 7); ctx.closePath();
          ctx.fillStyle = '#ffe08a'; ctx.fill(); ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < S.length; i += 2) { const q = at(S[i], S[i][6] * ((time * .9 + i * .13) % 1)); K.glow(ctx, q[0], q[1], 22, '255,220,120', .8, true); }
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    heal: [
      (ctx, fx, time, z) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
        ringE(ctx, z.x, z.y, 60 + Math.sin(time * 6) * 6, a * .8, '140,255,170', 3);
        ringE(ctx, z.x, z.y, 60 + ((time * 1.4) % 1) * 360, a * (1 - (time * 1.4) % 1) * .6, '140,255,170', 2);
      },
      (ctx, fx, time, z) => {
        const K = Kit(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), H = bodyH(z.bossId), f = facingOf(z);
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - H * .5, 60 + Math.sin(time * 8) * 8, '120,255,160', .45 * a, false, 1.3);
        if (fx.age < .35) K.glow(ctx, z.x + f * 10, z.y - H * .55, 26, '255,60,80', (1 - fx.age / .35), true);
        ctx.globalCompositeOperation = 'source-over';
        // rising green crosses
        ctx.strokeStyle = `rgba(20,60,30,${.5 * a})`; ctx.lineWidth = 4.6; ctx.lineCap = 'round';
        const cr = new Path2D();
        for (let i = 0; i < 9; i++) {
          const ph = (time * .7 + hash(i + fx.seed)) % 1, x = z.x + (hash(i * 3.1 + fx.seed) - .5) * 70, y = z.y - 10 - ph * (H + 30), s = 4 + 3 * bell(ph);
          cr.moveTo(x - s, y); cr.lineTo(x + s, y); cr.moveTo(x, y - s); cr.lineTo(x, y + s);
        }
        ctx.stroke(cr); ctx.strokeStyle = `rgba(170,255,190,${.95 * a})`; ctx.lineWidth = 2.2; ctx.stroke(cr);
        // chakra streams to the allies she is healing
        for (const o of allies(z, 420)) {
          const ox = o.x, oy = o.y - 40, sx = z.x, sy = z.y - H * .55, mx = (sx + ox) / 2, my = Math.min(sy, oy) - 60;
          ctx.strokeStyle = `rgba(20,60,30,${.35 * a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ox, oy); ctx.stroke();
          ctx.strokeStyle = `rgba(150,255,180,${.8 * a})`; ctx.lineWidth = 2; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -time * 60; ctx.stroke(); ctx.setLineDash([]);
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ox, oy, 34, '120,255,160', .5 * a); ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    seal: [
      (ctx, fx, time) => {
        const a = win(fx.age, 0, .3) * (1 - win(fx.age, fx.dur - .4, fx.dur)), r = fx.r, x = fx.x, y = fx.y, rot = time * .6;
        if (a <= 0) return;
        ctx.lineCap = 'round';
        const pass = (col, w) => {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x + r * .84, y); ctx.arc(x, y, r * .84, 0, TAU);
          // the Uzumaki spiral at the centre
          for (let i = 0; i <= 60; i++) { const t = i / 60, an = rot + t * TAU * 2.4, rr = r * .36 * t; const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          for (let i = 0; i < 12; i++) { const an = rot * -.5 + i * TAU / 12; ctx.moveTo(x + Math.cos(an) * r * .84, y + Math.sin(an) * r * .84); ctx.lineTo(x + Math.cos(an) * r * .6, y + Math.sin(an) * r * .6); }
          ctx.stroke();
        };
        pass(`rgba(60,36,0,${.45 * a})`, 7); pass(`rgba(255,212,100,${.9 * a})`, 3);
        // glyph boxes round the ring
        ctx.fillStyle = `rgba(255,212,100,${.8 * a})`;
        for (let i = 0; i < 12; i++) { const an = rot * -.5 + (i + .5) * TAU / 12; ctx.fillRect(x + Math.cos(an) * r * .92 - 5, y + Math.sin(an) * r * .92 - 5, 10, 10); }
        if (fx.big) { const k = win(fx.age, 1.55, 1.75) * (1 - win(fx.age, 1.75, 2.2)); if (k > 0) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x, y, r * 1.1, '255,210,100', k * .9, true, .55); ctx.globalCompositeOperation = 'source-over'; } }
      },
      null
    ],

    // ---- Mifune
    cuts: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur * .5, fx.dur);
        ctx.strokeStyle = `rgba(24,24,34,${.4 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
        for (const [x0, y0, x1, y1, t0] of fx.list) if (fx.age > t0 + .05) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
        ctx.stroke();
      },
      (ctx, fx) => {
        const K = Kit(), LIFTC = 26;
        ctx.lineCap = 'round';
        for (const [x0, y0, x1, y1, t0] of fx.list) {
          const t = fx.age - t0; if (t < 0) continue;
          const ts = fx.split != null ? fx.split - t0 : .12, len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
          const k = easeOut(t / .07), ax = x0, ay = y0 - LIFTC, bx = x0 + (x1 - x0) * k, by = y0 + (y1 - y0) * k - LIFTC;
          if (t < ts) {
            const fl = t < .08 ? 1 : .55 + .35 * Math.sin(t * 60 + x0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(170,210,255,${.45 * fl})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = `rgba(20,24,40,${.5 * fl})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${fl})`; ctx.lineWidth = 2; ctx.stroke();
          } else {
            const u = t - ts, a = 1 - clamp01(u / .5), o = Math.min(9, u * 50);
            if (a <= 0) continue;
            if (u < .12) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, (ax + bx) / 2, (ay + by) / 2, len * .4, '200,225,255', (1 - u / .12) * .5, true, .25); ctx.globalCompositeOperation = 'source-over'; }
            for (const s of [-1, 1]) {
              ctx.strokeStyle = `rgba(20,24,40,${.45 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax + nx * o * s, ay + ny * o * s); ctx.lineTo(bx + nx * o * s, by + ny * o * s); ctx.stroke();
              ctx.strokeStyle = `rgba(235,245,255,${a})`; ctx.lineWidth = 2; ctx.stroke();
            }
            // sparks thrown off the cut
            ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.6; ctx.beginPath();
            for (let i = 0; i < 6; i++) { const q = hash(i + x0 * .1), px = ax + (bx - ax) * q, py = ay + (by - ay) * q, s = (i % 2 ? 1 : -1) * (10 + u * 120 * hash(i * 2 + y0)); ctx.moveTo(px + nx * s, py + ny * s); ctx.lineTo(px + nx * (s + 8 * Math.sign(s)), py + ny * (s + 8 * Math.sign(s)) + 2); }
            ctx.stroke();
          }
        }
      }
    ],
    after: [
      null,
      (ctx, fx) => {
        const S = Spr(), a = 1 - win(fx.age, .1, fx.dur);
        if (!S || a <= 0) return;
        for (let i = 0; i < 4; i++) {
          const k = (i + 1) / 5;
          S.draw(ctx, 'mifune', fx.x0 + (fx.x1 - fx.x0) * k, fx.y0 + (fx.y1 - fx.y0) * k + 3, { facing: fx.f, frame: 'attack', alpha: a * (.12 + .08 * i) });
        }
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0); if (len < 5) return;
        const ux = (fx.x1 - fx.x0) / len, uy = (fx.y1 - fx.y0) / len;
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(235,242,255,${a * .85})` : `rgba(20,24,40,${a * .35})`; ctx.lineWidth = pass ? 2 : 4.5; ctx.beginPath();
          for (let i = 0; i < 10; i++) { const o = (hash(i + fx.seed) - .5) * 60, s0 = hash(i * 3.1 + fx.seed) * len * .6, l = len * (.3 + hash(i * 1.7 + fx.seed) * .4); ctx.moveTo(fx.x0 + ux * s0 - uy * o, fx.y0 + uy * s0 + ux * o - 36); ctx.lineTo(fx.x0 + ux * (s0 + l) - uy * o, fx.y0 + uy * (s0 + l) + ux * o - 36); }
          ctx.stroke();
        }
      }
    ],
    wave: [
      (ctx, fx) => {
        const d = Math.min(fx.L, fx.age * fx.sp), a = 1 - win(fx.age, fx.L / fx.sp, fx.dur), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(24,24,34,${.35 * a})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); for (const o of [-26, 0, 26]) { ctx.moveTo(fx.x + ca * 40 - sa * o, fx.y + sa * 40 + ca * o); ctx.lineTo(fx.x + ca * d - sa * o, fx.y + sa * d + ca * o); } ctx.stroke();
      },
      (ctx, fx) => {
        const d = fx.age * fx.sp; if (d > fx.L) return;
        const K = Kit(), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
        for (const [lag, al] of [[90, .3], [45, .55], [0, 1]]) {
          const dd = d - lag; if (dd < 20) continue;
          const px = fx.x + ca * (dd - 70), py = fx.y + sa * (dd - 70) - 30;
          crescent(ctx, px, py, 100, 40, fx.a - 1.15, fx.a + 1.15, .75, true);
          ctx.strokeStyle = `rgba(16,24,48,${.5 * al})`; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = `rgba(235,245,255,${.95 * al})`; ctx.fill();
          crescent(ctx, px, py, 96, 16, fx.a - 1.05, fx.a + 1.05, .75, true);
          ctx.fillStyle = `rgba(140,200,255,${.85 * al})`; ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x + ca * (d + 20), fx.y + sa * (d + 20) - 30, 90, '160,210,255', .55, true, .9);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    ring: [
      null,
      (ctx, fx) => {
        const K = Kit(), t = fx.age, e = easeOut(t / .18), a = 1 - win(t, .15, fx.dur), r = fx.r * (.55 + .45 * e);
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y - 24, r, r * .5, 0, 0, TAU);
        ctx.strokeStyle = `rgba(16,24,48,${.5 * a})`; ctx.lineWidth = 12; ctx.stroke();
        ctx.strokeStyle = `rgba(240,248,255,${a})`; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = `rgba(150,205,255,${a})`; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.1, t * 1.6, Math.max(0, 1 - t * 1.8), '210,230,255');
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    shinku: [
      (ctx, fx) => {
        const a = win(fx.age, 0, .3) * (1 - win(fx.age, 1.7, 2.2));
        if (a > 0) { ctx.fillStyle = `rgba(12,14,30,${.22 * a})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.fill(); }
      },
      (ctx, fx) => {
        const K = Kit(), t = fx.age - 1.75;
        if (t < 0 || t > .9) return;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.x, fx.y - 30, fx.r * (1 + t), '200,225,255', (1 - t / .9) * .8, true, .6);
        ctx.globalCompositeOperation = 'source-over';
        // glittering shards
        ctx.fillStyle = `rgba(255,255,255,${1 - t / .9})`; ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const an = hash(i + fx.seed) * TAU, d = fx.r * (.2 + .8 * hash(i * 2.7 + fx.seed)) + t * 200, x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d * .55 - 30 - t * 60 * hash(i * 5);
          ctx.moveTo(x, y - 6); ctx.lineTo(x + 2.4, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 2.4, y); ctx.closePath();
        }
        ctx.fill();
      }
    ]
  };

  // ------------------------------------------------------------------ Jūgo's transformed arm and armour
  function drawJugoArm(ctx, z, st, time) {
    const ar = st.arm; if (!ar || st.vanish > 0) return;
    const K = Kit(), H = bodyH('jugo'), f = facingOf(z), lift = st.lift, t = ar.t;
    const sx = z.x + f * 6, sy = z.y - H * .62 - lift, ca = Math.cos(ar.a), sa = Math.sin(ar.a);
    const grow = easeOut(t / .15) * (1 - easeIn(win(t, ar.dur - .3, ar.dur)));
    if (grow <= .02) return;
    let ex, ey, size = 30 * grow;
    if (ar.k === 'hammer') {
      const up = [sx - f * 30, sy - 110], dn = [ar.x, ar.y - 16], s = easeIn(win(t, .14, .24));
      ex = up[0] + (dn[0] - up[0]) * s; ey = up[1] + (dn[1] - up[1]) * s; size = 44 * grow;
    } else if (ar.k === 'ult') {
      const s = st.jump ? easeIn(win(st.jump.t, .82, 1)) : 1;
      ex = sx + ca * 40 * (1 - s) - f * 30 * (1 - s); ey = sy - 70 * (1 - s) + (z.y - 10 - sy) * s; size = 50 * grow;
    } else if (ar.k === 'barrage') { ex = sx + ca * 70; ey = sy + sa * 40 - 50; size = 32 * grow; }
    else { ex = sx + ca * 70; ey = sy + sa * 50 + 4; size = 32 * grow; }
    const mx = (sx + ex) / 2 - f * 14, my = (sy + ey) / 2 - 10;
    tube(ctx, sx, sy, mx, my, ex, ey, 9 * grow + 4, size * .55); fleshFill(ctx, 1);
    // curse-mark triangles and glowing vents along the arm
    ctx.fillStyle = '#2a1810'; ctx.beginPath();
    for (let i = 1; i <= 3; i++) { const k = i / 4, px = sx + (ex - sx) * k, py = sy + (ey - sy) * k - 4; ctx.moveTo(px - 5, py - 3); ctx.lineTo(px + 6, py); ctx.lineTo(px - 3, py + 5); ctx.closePath(); }
    ctx.fill();
    // the hammer fist: a heavy rounded block with knuckle ridges and spikes
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.atan2(ey - my, ex - mx));
    ctx.beginPath(); ctx.moveTo(-size * .6, -size * .7); ctx.quadraticCurveTo(size * 1.1, -size * .95, size * .95, 0); ctx.quadraticCurveTo(size * 1.1, size * .95, -size * .6, size * .7); ctx.quadraticCurveTo(-size * .9, 0, -size * .6, -size * .7); ctx.closePath();
    fleshFill(ctx, 1);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(size * .1, -size * .45, size * .5, size * .14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1e120c'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let i = -1; i <= 1; i++) { ctx.moveTo(size * .5, i * size * .3); ctx.lineTo(size * .92, i * size * .32); }
    ctx.stroke();
    ctx.fillStyle = '#3a2c28'; ctx.strokeStyle = '#1e120c'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-size * .2 + i * size * .35, -size * .78); ctx.lineTo(-size * .05 + i * size * .35, -size * 1.15); ctx.lineTo(size * .1 + i * size * .35, -size * .78); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    // jets: orange chakra flames roaring out of the vents behind
    const jetOn = ar.k === 'jet' || ar.k === 'ult' || (ar.k === 'hammer' && t > .1 && t < .3) || ar.k === 'barrage';
    if (jetOn) {
      const fire = K.puff('fire'), bxx = -(ar.k === 'ult' ? 0 : ca), byy = ar.k === 'ult' ? 1 : -sa * .5;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const ph = (time * 6 + i / 6) % 1, d = 14 + ph * (ar.k === 'ult' ? 140 : 70);
        K.stamp(ctx, fire, sx - f * 8 + bxx * d + Math.sin(time * 40 + i) * 4, sy + 6 + byy * d, (16 - ph * 8) * (ar.k === 'ult' ? 1.5 : 1), (1 - ph) * .95);
      }
      K.glow(ctx, sx - f * 8, sy + 6, 40, '255,150,60', .6, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function drawJugoArmor(ctx, z, st, time) {
    if (st.armor <= 0 || st.vanish > 0) return;
    const K = Kit(), H = bodyH('jugo'), a = Math.min(1, st.armor * 2) * Math.min(1, (6.5 - st.armor) * 4 + .2), cx = z.x, cy = z.y - H * .5 - st.lift, fire = K.puff('fire');
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 70, '255,110,40', .32 * a, false, 1.4);
    for (let i = 0; i < 7; i++) {
      const ph = (time * 1.3 + hash(i)) % 1;
      K.stamp(ctx, fire, cx + Math.sin(i * 2.3 + time * 2) * 26, cy + 30 - ph * (H * .9), 9 + ph * 8, (1 - ph) * .55 * a);
    }
    ctx.globalCompositeOperation = 'source-over';
    // stone-grey plates orbiting close to his body
    ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const an = time * 1.6 + i * TAU / 6, x = cx + Math.cos(an) * 30, y = cy + Math.sin(an) * 12 + Math.sin(time * 3 + i) * 4;
      if (Math.sin(an) < -.2) continue;
      ctx.beginPath(); ctx.moveTo(x - 9, y - 5); ctx.lineTo(x + 2, y - 10); ctx.lineTo(x + 10, y - 2); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x - 8, y + 5); ctx.closePath();
      ctx.fillStyle = `rgba(110,96,90,${.9 * a})`; ctx.fill(); ctx.strokeStyle = `rgba(30,16,10,${a})`; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = `rgba(42,24,16,${a})`; ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 4, y); ctx.lineTo(x - 2, y + 3); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ windups and labels
  function windupFx(ctx, z, st, time, H) {
    const K = Kit(), id = z.bossId, k = 1 - st.windup / st.windMax, def = MOVES[id][st.move];
    const fy = z.y + 3 - st.lift, fac = facingOf(z);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, 40 + 40 * k, def.rgb, .25 + .3 * k);
    ctx.strokeStyle = `rgba(${def.rgb},${.4 + .4 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = i * TAU / 8 + time * 2, ph = (time * 2.4 + hash(i + st.seed)) % 1, d0 = 120 * (1 - ph) + 30;
      ctx.moveTo(z.x + Math.cos(an) * d0, fy - H * .5 + Math.sin(an) * d0 * .6); ctx.lineTo(z.x + Math.cos(an) * (d0 - 22), fy - H * .5 + Math.sin(an) * (d0 - 22) * .6);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const big = st.move === 'ult';
    if (id === 'suigetsu') {
      // water spiralling up round him (thicker for the ultimate: he drinks the bottles)
      const P = [];
      for (let i = 0; i < (big ? 18 : 10); i++) {
        const ph = (time * (big ? 1.4 : 1) + i / (big ? 18 : 10)) % 1, an = ph * TAU * 2 + i;
        P.push(z.x + Math.cos(an) * (34 - ph * 10) * (big ? 1.4 : 1), fy - ph * H * (big ? 1.4 : 1) + Math.sin(an) * 10, 3 + 3 * bell(ph));
      }
      ctx.fillStyle = 'rgba(12,46,86,.55)'; ctx.beginPath(); for (let i = 0; i < P.length; i += 3) { ctx.moveTo(P[i] + P[i + 2] + 1.4, P[i + 1]); ctx.arc(P[i], P[i + 1], P[i + 2] + 1.4, 0, TAU); } ctx.fill();
      ctx.fillStyle = 'rgba(150,222,255,.95)'; ctx.beginPath(); for (let i = 0; i < P.length; i += 3) { ctx.moveTo(P[i] + P[i + 2], P[i + 1]); ctx.arc(P[i], P[i + 1], P[i + 2], 0, TAU); } ctx.fill();
      if (big) { ringE(ctx, z.x, z.y, 50 + 40 * k, .8, '170,228,255', 3); ringE(ctx, z.x - fac * 60, z.y, 90 * k, .6, '190,236,255', 2); }
    } else if (id === 'jugo') {
      const fire = K.puff('fire');
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < (big ? 12 : 6); i++) {
        const ph = (time * 1.2 + hash(i * 2.1)) % 1;
        K.stamp(ctx, fire, z.x + Math.sin(time * 3 + i * 1.7) * (18 + 10 * k), fy - 10 - ph * H * 1.1, 8 + ph * (big ? 18 : 10), bell(ph) * (.5 + .4 * k));
      }
      ctx.globalCompositeOperation = 'source-over';
      if (big) { ringE(ctx, z.x, z.y, 70 + 50 * Math.sin(time * 9), .7, '255,140,60', 3); }
    } else if (id === 'karin') {
      for (let i = 0; i < 2; i++) { const ph = (time * 1.6 + i * .5) % 1; ringE(ctx, z.x, z.y, 30 + ph * 110, (1 - ph) * .8, st.move === 'bite' ? '140,255,170' : '255,80,100', 2); }
      if (st.move === 'chain' || st.move === 'cage' || big) {
        // golden chain tips sliding out of her back
        ctx.lineCap = 'round';
        for (let i = 0; i < (big ? 6 : 3); i++) {
          const an = -Math.PI / 2 - fac * (.4 + i * .3) + Math.sin(time * 5 + i) * .15, l = 20 + 30 * k + i * 4;
          const x0 = z.x - fac * 6, y0 = fy - H * .6, x1 = x0 + Math.cos(an) * l, y1 = y0 + Math.sin(an) * l;
          ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#ffd46a'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    } else if (id === 'mifune') {
      // the glint on the guard as his thumb pushes the blade out
      const gx = z.x + fac * 8, gy = fy - H * .42, s = 6 + 10 * k + Math.sin(time * 20) * 2;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, gx, gy, 20 + 16 * k, '220,235,255', .6 + .3 * k, true);
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - s, gy); ctx.lineTo(gx + s, gy); ctx.moveTo(gx, gy - s); ctx.lineTo(gx, gy + s); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (big || st.move === 'counter') {
        ctx.strokeStyle = `rgba(20,24,40,${.35 + .3 * k})`; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + time * .5, r = 50 + 20 * k; ctx.moveTo(z.x + Math.cos(an) * r, z.y + Math.sin(an) * r * .5); ctx.lineTo(z.x + Math.cos(an) * (r + 18), z.y + Math.sin(an) * (r + 18) * .5); }
        ctx.stroke();
      }
    }
  }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - st.lift - bodyH(z.bossId) - 40;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#160f1d';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    if (def.shout) {
      ctx.font = 'italic 800 10px sans-serif'; ctx.lineWidth = 3;
      ctx.strokeText(def.shout, z.x, top - 14); ctx.fillStyle = '#ffffff'; ctx.fillText(def.shout, z.x, top - 14);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.tk;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
      for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
    }
    if (z.health > 0 && st.pin) {
      // the bind: chains coiled round whoever is held
      const p = st.pin;
      ctx.strokeStyle = 'rgba(60,36,0,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(p.x, p.y, 30, 14, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd46a'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.tk, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (z.bossId === 'jugo') { drawJugoArmor(ctx, z, st, time); drawJugoArm(ctx, z, st, time); }
      if (st.pin) {
        const p = st.pin;
        ctx.lineCap = 'round';
        for (const [w, c] of [[7, 'rgba(60,36,0,.55)'], [3.4, '#ffd46a']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i < 3; i++) { const y = p.y - 14 - i * 16; ctx.moveTo(p.x - 20, y + 5); ctx.quadraticCurveTo(p.x, y - 6, p.x + 20, y + 5); }
          ctx.stroke();
        }
      }
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, bodyH(z.bossId));
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.tk && z.tk.vanish > 0 && z.health > 0);
  const bodyLift = z => (z.tk && z.health > 0 ? z.tk.lift || 0 : 0);

  window.TakaBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moveLabels, moves };
})();
