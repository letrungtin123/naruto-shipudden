/* Sound bosses (spawn panel, faction 'sound'): Kaguya Kimimaro and the Sound Four (Sakon & Ukon, Tayuya,
 * Kidōmaru, Jirōbō), Orochimaru's bodyguards. Same contract as duel-bosses.js: update(z, dt, api) drives the
 * jutsu, draw(ctx, z, time) paints telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above
 * the characters. All per-boss state lives on z.so (plain numbers / small arrays; closures in ev/upd are
 * skipped by the co-op snapshot). Sprites are registered here with AnimeSprites.addSprite.
 *
 * Kimimaro: Tsubaki no Mai (bone-sword dash), Teshi Sendan (finger-bone bullets), Karamatsu no Mai (bone
 *           spikes from the whole body), Yanagi no Mai (bone whirl), Tessenka no Mai (bone whip + drill),
 *           ultimate Sawarabi no Mai (a forest of bone spires erupting in rings, curse mark stage 2).
 * Sakon:    Tarenken (multiple connected fists), Ukon's parasitic merge, Rashōmon, the twin drop kick,
 *           ultimate Triple Rashōmon prison + twin combo.
 * Tayuya:   Demon Flute sound waves, Summoning: Doki (three ogres), the Doki's ghost worms, closing ring of
 *           notes, ultimate Demon Flute: Chains of Fantasia.
 * Kidōmaru: Spider Bind (sticky web shot), Spider Sticky Gold kunai, Spider Web Area, Summoning: giant spider
 *           and its brood, ultimate Spider War Bow: Terrible Split (giant golden arrow line).
 * Jirōbō:   Earth Release slab throw, Arhat Fist, earth-splitting stomp, rock rain, ultimate Earth Prison
 *           Dome (chakra drain: he heals from what the dome absorbs). */
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
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;

  // ================================================================== sprites
  (function registerSprites() {
    const S = window.AnimeSprites;
    if (!S || !S.kit || !S.addSprite) return;
    const K = S.kit;
    const { paint, seg, line, lerp, lit, litN, dark, light, rgba, SHADE, DEEP, DEEP2, GLOSS, CREASE, ell, dot, poly, smooth, locks, spikeHair,
      drawArm, drawHead, plateSymbol, hairGloss, SH_N, SH_F, HEAD } = K;
    const T2 = Math.PI * 2;
    const ROPE = '#6a3d96', ROPE_D = '#3e2058', ROPE_L = '#9a6ac8';
    const TAN = '#cbb690', TAN_P = '#b9a37e';

    // Orochimaru's purple rope: a thick twisted belt round the waist ...
    function ropeBelt(ctx, y0 = -3.6, h = 2.8) {
      ctx.fillStyle = ROPE; ctx.fillRect(-9, y0, 19, h);
      ctx.fillStyle = ROPE_L; ctx.fillRect(-9, y0 + .2, 19, .5);
      ctx.fillStyle = ROPE_D; ctx.fillRect(-9, y0 + h - .7, 19, .7);
      ctx.strokeStyle = ROPE_D; ctx.lineWidth = .45;
      for (let x = -8.6; x < 10; x += 1.25) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + .9, y0 + h * .5, x + .5, y0 + h); ctx.stroke(); }
      ctx.strokeStyle = rgba(ROPE_L, .7); ctx.lineWidth = .25;
      for (let x = -8.2; x < 10; x += 1.25) { ctx.beginPath(); ctx.moveTo(x, y0 + .3); ctx.quadraticCurveTo(x + .7, y0 + h * .45, x + .5, y0 + h * .8); ctx.stroke(); }
    }
    // ... tied in the big bow at the small of the back, its tails fluttering when running.
    function ropeBow(ctx, pose, O, y = -2.2) {
      const run = pose.run ? 1 : 0, wv = run ? Math.sin(pose.wave || 0) : 0;
      const x = -7.6;
      for (const [dx, dy, s] of [[-4.6, -3.2, 1], [-4.2, 2.6, -1]]) {
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + dx * .4, y + dy * 1.6 - s * 1.2, x + dx * 1.3 - run * 1.2, y + dy * 1.2, x + dx - run, y + dy * .2); ctx.bezierCurveTo(x + dx * .7, y + dy * -.3, x + dx * .2, y + s * .4, x, y); ctx.closePath(); }, ROPE, O, .8, () => {
          ctx.fillStyle = ROPE_D; ctx.fillRect(x - 8, y + (s > 0 ? 0 : 1), 9, 3 * s);
          ctx.strokeStyle = rgba(ROPE_L, .8); ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(x - 1, y - s * .6); ctx.quadraticCurveTo(x + dx * .6, y + dy * .9, x + dx * .9, y + dy * .4); ctx.stroke();
        });
      }
      // Two rope tails hanging from the knot.
      for (const [len, off] of [[11, .8], [9, -1.2]]) {
        const tx = x - 1.6 - run * (4 + wv * 1.6) + off * .4, ty = y + len - run * 3;
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(x - .6, y + .6); ctx.quadraticCurveTo(x - 1.4 - run * 1.5, y + len * .5, tx, ty); ctx.lineTo(tx + 1.4, ty + .2); ctx.quadraticCurveTo(x + .2 - run, y + len * .5, x + .8, y + .8); ctx.closePath(); }, ROPE, O, .6, () => {
          ctx.fillStyle = ROPE_D; ctx.fillRect(x - 8, y + len * .4, 10, len);
        });
        dot(ctx, tx + .6, ty + .2, .8, ROPE_D);
      }
      paint(ctx, () => ell(ctx, x, y, 1.6, 1.5), ROPE, O, .7, () => { dot(ctx, x - .3, y - .5, .5, ROPE_L); });
    }
    // Tan Sound uniform shared by the Four: long sleeves, high round neck, rope belt, bandaged shins.
    function soundTorso(base, extra) {
      return {
        base, paint: (ctx, pose) => {
          ctx.strokeStyle = rgba(dark(base, .5), .5); ctx.lineWidth = .45;
          for (const [x0, x1] of [[-3.8, -4.6], [1.2, 1.8], [5.8, 6.6]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .7, -8, x1, -4); ctx.stroke(); }
          if (extra) extra(ctx, pose);
          ropeBelt(ctx);
        }
      };
    }
    function roundCollar(color, O) {
      return ctx => paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.8, -13.3, 4.6, 1.7, 0, 0, T2); }, color, O, .8, () => {
        ctx.fillStyle = SHADE; ctx.fillRect(-3.4, -13.4, 10, 2.2);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-1, -14.9, 6, .5);
      });
    }
    // Long hair hanging down the back (head units), with strand lines and a gloss streak.
    function longDrape(c, O, len, w = 1, wave = 0) {
      return (ctx) => {
        paint(ctx, () => smooth(ctx, [[-1, 2], [-6.4 * w, 6], [-9.6 * w, len * .55], [-10.6 * w - wave, len * .86], [-8.4 * w, len], [-5.6 * w + wave, len * .9],
          [-3 * w, len * .7], [-1.4, len * .45], [2, 6]]), c, O, .95, () => {
          ctx.fillStyle = dark(c, .3); ctx.fillRect(-20, 10, 40, len);
          ctx.strokeStyle = dark(c, .45); ctx.lineWidth = .45;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-3 - i * 1.6, 5); ctx.quadraticCurveTo(-6 * w - i * 1.2 + wave, len * .5, -6.2 * w - i * 1.1, len - 2); ctx.stroke(); }
          ctx.strokeStyle = hairGloss(c); ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(-3.4, 6.5); ctx.quadraticCurveTo(-6.6 * w, len * .35, -7.2 * w, len * .55); ctx.stroke();
        });
      };
    }
    // Bone white with ivory shading (Shikotsumyaku).
    const BONE = '#f1ecdf', BONE_D = '#c9bfa8', BONE_O = '#2c2620';
    function boneBlade(ctx, x, y, rot, len, w = 1.6) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-1, -w); ctx.quadraticCurveTo(len * .5, -w * 1.25, len, 0); ctx.quadraticCurveTo(len * .5, w * .9, -1, w); ctx.closePath(); }, BONE, BONE_O, .6, () => {
        ctx.fillStyle = BONE_D; ctx.fillRect(-2, w * .1, len + 2, w);
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, -w * .9, len * .7, w * .35);
        ctx.strokeStyle = rgba(BONE_D, .9); ctx.lineWidth = .3;
        for (let d = 2; d < len - 3; d += 3.2) { ctx.beginPath(); ctx.moveTo(d, -w * .8); ctx.lineTo(d + .6, w * .7); ctx.stroke(); }
      });
      ctx.restore();
    }

    // ---------------------------------------------------------------- Kimimaro
    // Long white hair parted in the middle with long bangs framing the face, two red dots for brows,
    // green eyes, the white-lavender robe with a deep V neck and the purple rope; a bone sword grows
    // out of his palm when he attacks.
    function kimimaroSpec() {
      const O = '#1e1a26', ROBE = '#ebe7f0', ROBE_S = '#cfc8da', HC = '#efece6', skin = '#f4e4d8';
      return {
        outline: O, skin, skinShade: '#d6b8b0', legK: 1.12,
        legs: { thigh: ROBE_S, shin: ROBE_S, foot: '#2a2836', wrap: '#f3efe6', w1: 5.2, w2: 4.4 },
        arms: { upper: ROBE, lower: ROBE, w1: 4.8, w2: 4.4, cuff: ROBE_S },
        torso: {
          base: ROBE, paint: ctx => {
            // Deep V neckline down to the sternum.
            ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-.4, -13.4); ctx.lineTo(6.8, -13.4); ctx.lineTo(3.3, -6.2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(176,110,120,.35)'; ctx.beginPath(); ctx.moveTo(2.9, -11); ctx.lineTo(3.7, -11); ctx.lineTo(3.3, -7); ctx.fill();
            line(ctx, [[-.4, -13.4], [3.3, -6.2], [6.8, -13.4]], '#8e86a0', .55);
            line(ctx, [[-.1, -13.2], [3.3, -6.6]], 'rgba(255,255,255,.7)', .3);
            ctx.strokeStyle = 'rgba(110,100,140,.4)'; ctx.lineWidth = .4;
            for (const [x0, x1] of [[-4, -4.8], [6.6, 7]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .7, -8, x1, -4); ctx.stroke(); }
            ropeBelt(ctx);
          }
        },
        skirt: { color: ROBE, hem: 7.4, flare: .8, paint: (ctx, hem) => {
          ctx.fillStyle = ROBE_S; ctx.fillRect(-20, hem - 1, 40, 1);
          ctx.strokeStyle = 'rgba(110,100,140,.35)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(5.4, hem - 7); ctx.lineTo(6.4, hem); ctx.stroke();
        } },
        collar(ctx) {
          // Robe collar folded open round the V.
          for (const pts of [[[-1.6, -13.6], [.4, -14], [3.6, -6.4], [2.8, -6.6]], [[6, -14], [7.6, -13.6], [3.9, -6.4], [3.6, -6.8]]])
            paint(ctx, () => poly(ctx, pts), ROBE, O, .6, () => { ctx.fillStyle = 'rgba(120,110,150,.3)'; ctx.fillRect(-3, -15, 12, 3); });
        },
        back(ctx, pose) { ropeBow(ctx, pose, O); },
        head: {
          drape: longDrape(HC, O, 24, .95),
          hair: K.HAIR ? K.HAIR.smooth(HC, { nape: 9.4, bangs: [[9.8, 1.7, 9.6], [-.4, 1.8, 10.4], [1.6, 1.3, 5.4]] }) : null,
          eyes: { type: 'normal', iris: '#3f9b6e' }, brows: false, mouth: 'neutral', attackMouth: 'frown', blush: false,
          marks(ctx) {
            // The Kaguya clan's two red dots in place of eyebrows.
            for (const [x, y, w] of [[2.6, -1.9, .95], [7.9, -2.1, .72]]) {
              paint(ctx, () => ell(ctx, x, y, w, w * .78), '#d0283a', '#6a1020', .3, () => dot(ctx, x - w * .3, y - w * .3, w * .3, 'rgba(255,200,200,.8)'));
            }
          }
        },
        front(ctx, pose, handN) {
          if (pose.attack) boneBlade(ctx, handN[0] + .6, handN[1] - .4, -.08, 23, 1.7);
          else if (pose.seal) {
            // Bone tips piercing out of the shoulders as he calls the bones up.
            for (const [x, y, a] of [[-4.4, -13.6, -2.2], [-1.6, -14.4, -1.7], [5.6, -13.8, -1.1]]) boneBlade(ctx, x, y, a, 5.5, .9);
          }
        }
      };
    }

    // ---------------------------------------------------------------- Sakon & Ukon
    // Silver-lilac hair with a heavy fringe over the far eye, dark red lipstick, the tan Sound uniform;
    // his twin Ukon's head sleeps half out of his back behind the near shoulder.
    function ukonHead(skin, O, HC) {
      return {
        outline: O, skin, skinShade: '#c4a49e',
        head: {
          hair: K.HAIR.smooth(HC, { nape: 7.6 }),
          eyes: { type: 'sleepy', iris: '#5a3a5a', lid: skin }, browColor: dark(HC, .3), browW: .8, mouth: 'smirk', lipColor: '#7a1e34', blush: false,
          front(ctx, spec) { locks(ctx, spec, HC, [[8.4, -8.6, 11, 4.2, 2.2, -.6], [5.6, -8.8, 7.4, -.4, 1.6, -.2], [1.6, -8.6, .8, 2, 1.5, -.4]]); }
        }
      };
    }
    function sakonSpec() {
      const O = '#1a1622', HC = '#bdb6c8', skin = '#f0d8c8';
      const ukon = ukonHead(skin, O, HC);
      return {
        outline: O, skin, skinShade: '#cfaea6',
        legs: { thigh: TAN_P, shin: TAN_P, foot: '#2a2632', wrap: '#ece6da', w1: 5.2, w2: 4.4 },
        arms: { upper: TAN, lower: TAN, w1: 4.6, w2: 4.2, cuff: TAN_P },
        torso: soundTorso(TAN),
        collar: roundCollar(TAN, O),
        back(ctx, pose) { ropeBow(ctx, pose, O); },
        collarBack(ctx, pose) {
          // Ukon: the second head emerging from Sakon's back.
          const lean = pose.run ? .12 : 0;
          ctx.save(); ctx.translate(HEAD[0] - 8.6, HEAD[1] + 7.4); ctx.rotate(-.18 - lean); ctx.scale(.78, .78);
          drawHead(ctx, ukon, pose); ctx.restore();
        },
        head: {
          hair: K.HAIR.smooth(HC, { nape: 8.2 }),
          eyes: { type: 'normal', iris: '#4a2e52' }, browColor: dark(HC, .35), browW: .85, browAngle: 'angry', mouth: 'lips', attackMouth: 'shout', lipColor: '#6e1a3a', blush: false,
          front(ctx, spec) {
            // The heavy fringe hiding his far eye.
            locks(ctx, spec, HC, [[8.6, -8.6, 11.4, 5, 2.4, -.8], [6, -8.8, 7.8, 0, 1.7, -.3], [2.2, -8.6, 1.2, 1.6, 1.5, -.4], [-1.2, -8, -2.6, 3.4, 1.4, -.6]]);
          }
        }
      };
    }

    // ---------------------------------------------------------------- Tayuya
    // Long red-pink hair under a black knit hat, brown eyes, the tan Sound uniform and her demon flute.
    function flute(ctx, x0, y0, x1, y1, O) {
      line(ctx, [[x0, y0], [x1, y1]], O, 2.2);
      line(ctx, [[x0, y0], [x1, y1]], '#d9dde4', 1.3);
      line(ctx, [[x0 + .2, y0 - .3], [x1 + .2, y1 - .3]], 'rgba(255,255,255,.8)', .35);
      for (let t = .25; t < .9; t += .13) { const p = lerp([x0, y0], [x1, y1], t); dot(ctx, p[0], p[1], .32, '#2a2a34'); }
      const e = lerp([x0, y0], [x1, y1], .96); dot(ctx, e[0], e[1], .7, '#9aa0ac');
    }
    function tayuyaSpec() {
      const O = '#1e1418', HC = '#d23a55', HAT = '#1d1b24', skin = '#f7dccb';
      return {
        outline: O, skin, skinShade: '#deae9e',
        legs: { thigh: TAN_P, shin: TAN_P, foot: '#2a2430', wrap: '#ece6da', w1: 4.9, w2: 4.1 },
        arms: { upper: TAN, lower: TAN, w1: 4.3, w2: 3.9, cuff: TAN_P },
        torso: soundTorso(TAN),
        collar: roundCollar(TAN, O),
        back(ctx, pose) { ropeBow(ctx, pose, O); },
        head: {
          drape: longDrape(HC, O, 30, 1.05, 1.2),
          hair: K.HAIR.smooth(HC, { nape: 10 }),
          eyes: { type: 'normal', iris: '#7a4a2e', fem: true }, browColor: '#a02436', browW: .8, browAngle: 'angry', mouth: 'frown', attackMouth: 'shout', lipColor: '#c94a5a',
          front(ctx, spec) {
            locks(ctx, spec, HC, [[9.6, -7.6, 11.2, 6, 1.6, .8], [6.4, -8.4, 7.2, -2.4, 1.6, .2], [3.4, -8.6, 3, -2.2, 1.6, -.2], [.4, -8.2, -1.2, 4.4, 1.6, -.8], [-2.6, -7.4, -4.2, 7.4, 1.6, -.6]]);
            // Black knit hat pulled down to the brow: dome, ribbed band and a soft crease on top.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-12.2, -3.2); ctx.quadraticCurveTo(-13.6, -16.6, -.6, -17.2); ctx.quadraticCurveTo(12.6, -16.8, 11.8, -5.4); ctx.quadraticCurveTo(0, -7.2, -12.2, -3.2); ctx.closePath(); }, HAT, O, 1.1, () => {
              ctx.fillStyle = '#121118'; ctx.fillRect(-16, -8, 10, 8);
              ctx.fillStyle = 'rgba(150,160,210,.28)'; ell(ctx, 1.6, -13.6, 7, 2.4, -.15); ctx.fill();
              ctx.strokeStyle = 'rgba(120,130,170,.3)'; ctx.lineWidth = .4;
              for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 4.6, -15.4 + Math.abs(i - 1.5) * .6); ctx.quadraticCurveTo(-7 + i * 4.4, -11, -7.6 + i * 4.6, -6.4 + i * .3); ctx.stroke(); }
            });
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-12.6, -2.6); ctx.quadraticCurveTo(0, -7.6, 12.2, -4.8); ctx.lineTo(12, -7.2); ctx.quadraticCurveTo(0, -9.8, -12.8, -5.4); ctx.closePath(); }, '#26232e', O, .8, () => {
              ctx.strokeStyle = 'rgba(140,150,190,.35)'; ctx.lineWidth = .3;
              for (let x = -12; x < 12.5; x += 1.3) { ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x + .2, -2.6); ctx.stroke(); }
            });
          }
        },
        front(ctx, pose, handN, handF) {
          if (pose.seal) flute(ctx, 7.4, -16.8, 15.6, -13.6, O);
          else if (pose.attack) flute(ctx, handN[0] - 2, handN[1] + 1.6, handN[0] + 8, handN[1] - 3.4, O);
          else flute(ctx, handN[0] - 1, handN[1] - 3, handN[0] + 1.6, handN[1] + 7, O);
        }
      };
    }

    // ---------------------------------------------------------------- Kidōmaru
    // Six arms, a high brown ponytail, tanned skin, a cocky grin. The extra pairs grow from his ribs.
    function kidomaruSpec() {
      const O = '#1a1410', HC = '#3a2a22', skin = '#e2b088';
      const arms = { upper: TAN, lower: TAN, w1: 4.3, w2: 3.9, cuff: TAN_P };
      const extra = pose => pose.attack ? [[[6, -1.4, 12.6, -3], [6.2, 2.6, 12.4, 4.4]], [[-2, 4.6, 4, 7.4], [-1, 5.4, 5.6, 9]]]
        : pose.seal ? [[[4.8, 2, 9.6, -.8], [5, 3.4, 9.8, 1.6]], [[3, 4, 7.6, 2.8], [3.4, 4.6, 8, 4]]]
        : pose.run ? [[[-5, 3.4, -11, 5.6], [-4.4, 4.6, -10.4, 7.6]], [[-5.6, 2.2, -11.6, 2.4], [-5, 3, -11.2, 4.4]]]
        : [[[-5.4, 2.2, -10.8, 4.6], [5.6, 1.8, 11, 3.4]], [[-5, 4, -9.6, 9.2], [5, 3.8, 10, 8.2]]];
      return {
        outline: O, skin, skinShade: '#c08a68',
        legs: { thigh: TAN_P, shin: TAN_P, foot: '#2a2420', wrap: '#ece6da', w1: 5.2, w2: 4.4 },
        arms,
        torso: soundTorso(TAN),
        collar: roundCollar(TAN, O),
        back(ctx, pose) { ropeBow(ctx, pose, O); },
        collarBack(ctx, pose) {
          // Far-side extra arms (behind the body).
          const [mid, low] = extra(pose);
          drawArm(ctx, this, [SH_F[0] - .6, -7.6], mid[1], true, arms);
          drawArm(ctx, this, [SH_F[0] - .8, -4.6], low[1], true, arms);
        },
        shoulder(ctx, pose) {
          // Near-side extra arms over the torso.
          const [mid, low] = extra(pose);
          drawArm(ctx, this, [SH_N[0] + .4, -4.4], low[0], false, arms);
          drawArm(ctx, this, [SH_N[0] + .6, -7.4], mid[0], false, arms);
        },
        head: {
          drape(ctx, spec) {
            // High ponytail: tied at the crown, the tail sweeping back and down.
            const c = HC;
            paint(ctx, () => smooth(ctx, [[-4, -12.6], [-10, -16], [-17, -13.6], [-20, -6], [-19.4, 2], [-16.4, -4], [-13.2, -9.6], [-8, -10]]), c, spec.outline, 1, () => {
              ctx.fillStyle = dark(c, .3); ctx.fillRect(-24, -8, 14, 14);
              ctx.strokeStyle = hairGloss(c); ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-7, -13.4); ctx.quadraticCurveTo(-14, -15, -17.4, -8); ctx.stroke();
              ctx.strokeStyle = dark(c, .45); ctx.lineWidth = .4;
              for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 - i, -12 + i); ctx.quadraticCurveTo(-15 - i, -12 + i * 2, -17.6 - i * .4, -2 + i * 2); ctx.stroke(); }
            });
            paint(ctx, () => ell(ctx, -5.6, -12.4, 1.6, 2.2, .5), ROPE, spec.outline, .6);
          },
          hair: K.HAIR.smooth(HC, { nape: 6.4, bangs: [[9.8, 1.4, 4.6], [-.2, 1.5, 6]] }),
          eyes: { type: 'normal', iris: '#3a2e2a' }, browColor: '#20160f', browW: 1, browAngle: 'angry', mouth: 'grin', attackMouth: 'shout', blush: false,
          front(ctx, spec) { locks(ctx, spec, HC, [[2.4, -8.8, 2, -3.6, 1.4, -.2], [5.2, -8.8, 5.8, -4, 1.3, .2], [7.8, -8.4, 9, -4.4, 1.2, .5]]); }
        }
      };
    }

    // ---------------------------------------------------------------- Jirōbō
    // The big one: barrel body, round face with small eyes, an orange crest of hair on a shaved head.
    function jiroboSpec() {
      const O = '#1c1410', HC = '#e2843a', skin = '#f0c8a2';
      return {
        outline: O, skin, skinShade: '#cf9c7c', bulk: 3.4, headScale: 1.1, legK: .98,
        legs: { thigh: TAN_P, shin: TAN_P, foot: '#2a2420', wrap: '#ece6da', w1: 7.2, w2: 6 },
        arms: { upper: TAN, lower: TAN, w1: 6.6, w2: 6.2, cuff: TAN_P, hand: '#e8bd96' },
        torso: soundTorso(TAN, ctx => {
          // Belly bulge shading.
          ctx.fillStyle = 'rgba(255,255,255,.14)'; ell(ctx, 4.6, -6, 5, 4); ctx.fill();
          ctx.strokeStyle = rgba(dark(TAN, .5), .5); ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(2.4, -5.4, 6.6, .2, 1.4); ctx.stroke();
        }),
        collar: roundCollar(TAN, O),
        back(ctx, pose) { ropeBow(ctx, pose, O, -2.6); },
        head: {
          hair(ctx, spec) {
            // Shaved sides (stubble tone) with a spiky orange crest running front to back.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(10, -3.6); ctx.quadraticCurveTo(11, -12.6, 1, -12.8); ctx.quadraticCurveTo(-11.6, -12.4, -11, 2); ctx.lineTo(-10, 6); ctx.lineTo(-5, 5.4); ctx.lineTo(-4.4, 1); ctx.lineTo(-2, -4.4); ctx.quadraticCurveTo(3.6, -6.4, 10, -3.6); ctx.closePath(); }, '#dcb08c', O, .9, () => {
              ctx.fillStyle = 'rgba(120,80,50,.22)'; ctx.fillRect(-14, -14, 12, 24);
              ctx.fillStyle = 'rgba(200,110,50,.18)'; ctx.fillRect(-14, -14, 30, 24);
              ctx.fillStyle = 'rgba(255,255,255,.15)'; ell(ctx, 2, -9, 7, 3); ctx.fill();
            });
            spikeHair(ctx, spec, HC, [[-36, 11.4], [-52, 15.6], [-66, 12.4], [-82, 16.4], [-98, 12.6], [-114, 16.2], [-130, 12.4], [-148, 15.2], [-164, 11.6]],
              [[-9, -6.6], [-4, -10], [2, -10.8], [7.6, -8.4]], { cy: -2.4 });
          },
          eyes: { type: 'small', iris: '#2a1e18' }, brows: 'thick', browColor: '#8a4a22', browW: 1.2, mouth: 'frown', attackMouth: 'shout', blush: false,
          marks(ctx) {
            // Heavy jowls and a broad nose bridge.
            line(ctx, [[1.4, 8.6], [3.6, 10.8], [7.4, 11.2]], 'rgba(120,70,50,.5)', .45);
            line(ctx, [[10.2, 5.8], [10.6, 7]], 'rgba(120,70,50,.45)', .35);
          }
        }
      };
    }

    const reg = (id, spec, meta, cu) => S.addSprite(id, spec, meta, cu);
    reg('kimimaro', kimimaroSpec(), { scale: 1.3, box: [-40, -86, 42, 8] }, { hair: '#efece6', fringe: 'part', accent: '#e8e2d0', long: true });
    reg('sakon', sakonSpec(), { scale: 1.26, box: [-42, -86, 40, 8] }, { hair: '#bdb6c8', fringe: 'madara', accent: '#8a6ab0' });
    reg('tayuya', tayuyaSpec(), { scale: 1.22, box: [-40, -88, 44, 8] }, { hair: '#d23a55', fringe: 'part', accent: '#e04a5a', long: true });
    reg('kidomaru', kidomaruSpec(), { scale: 1.28, box: [-46, -90, 44, 8] }, { hair: '#3a2a22', fringe: 'spiky', accent: '#c8a050' });
    reg('jirobo', jiroboSpec(), { scale: 1.58, box: [-44, -86, 46, 8] }, { hair: '#e2843a', fringe: 'bald', accent: '#a07050' });
  })();

  // ================================================================== roster
  const members = {
    kimimaro: { name: 'KIMIMARO — THI CỐT MẠCH', accent: '#efe8d4', hpScale: 3.45, damageScale: 1.85, armor: .9,
      moves: ['tsubaki', 'teshi', 'karamatsu', 'yanagi', 'tessenka', 'sawarabi'] },
    sakon: { name: 'SAKON & UKON', accent: '#b894e0', hpScale: 2.9, damageScale: 1.7,
      moves: ['tarenken', 'ukon', 'rashomon', 'drop', 'tajuu'] },
    tayuya: { name: 'TAYUYA — MA ĐỊCH', accent: '#ff6a7e', hpScale: 2.8, damageScale: 1.7,
      moves: ['mateki', 'doki', 'spirits', 'ring', 'fantasia'] },
    kidomaru: { name: 'KIDŌMARU — TRI CHU', accent: '#f0c040', hpScale: 2.9, damageScale: 1.7,
      moves: ['bind', 'kunai', 'net', 'spider', 'bow'] },
    jirobo: { name: 'JIRŌBŌ — THỔ LAO', accent: '#e8955a', hpScale: 3.0, damageScale: 1.75, armor: .88,
      moves: ['slab', 'arhat', 'split', 'rain', 'dome'] }
  };
  const order = Object.keys(members);
  const pick = level => order[((level % order.length) + order.length) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    kimimaro: {
      tsubaki:   { label: 'THI CỐT MẠCH · XUÂN CHI VŨ', rgb: '245,240,225', windup: .75, after: 1.0 },
      teshi:     { label: 'THẬP CHỈ XUYÊN ĐẠN', rgb: '240,236,220', windup: .7, after: 1.0 },
      karamatsu: { label: 'ĐƯỜNG TÙNG CHI VŨ', rgb: '250,244,228', windup: .8, after: 1.1 },
      yanagi:    { label: 'LIỄU CHI VŨ', rgb: '235,240,230', windup: .6, after: 1.0 },
      tessenka:  { label: 'THIẾT TUYẾN HOA CHI VŨ', rgb: '245,238,215', windup: .9, after: 1.2 },
      sawarabi:  { label: 'TẢO QUYẾT CHI VŨ', shout: 'VÌ ĐẠI NHÂN OROCHIMARU!', rgb: '255,248,230', windup: 1.4, after: 1.8, ult: 1 }
    },
    sakon: {
      tarenken: { label: 'ĐA LIÊN QUYỀN', rgb: '200,160,255', windup: .6, after: 1.0 },
      ukon:     { label: 'KÝ SINH QUỶ HOẠI THUẬT', rgb: '190,120,255', windup: .7, after: 1.1 },
      rashomon: { label: 'KHẨU KÝ · LA SINH MÔN', rgb: '220,120,255', windup: .9, after: 1.1 },
      drop:     { label: 'ĐA LIÊN CƯỚC · THIÊN LẠC', rgb: '210,170,255', windup: .7, after: 1.0 },
      tajuu:    { label: 'KHẨU KÝ · TAM TRỌNG LA SINH MÔN', shout: 'HAI ANH EM TA LÀ MỘT!', rgb: '200,90,255', windup: 1.3, after: 1.8, ult: 1 }
    },
    tayuya: {
      mateki:   { label: 'MA ĐỊCH · ÂM BA HUYỄN THUẬT', rgb: '255,120,170', windup: .65, after: 1.0 },
      doki:     { label: 'KHẨU KÝ · NỘ QUỶ', rgb: '220,110,255', windup: 1.0, after: 1.2 },
      spirits:  { label: 'NỘ QUỶ · THỰC HỒN TRÙNG', rgb: '230,220,255', windup: .8, after: 1.0 },
      ring:     { label: 'MA ĐỊCH · ÂM LUÂN KHỐN', rgb: '255,140,200', windup: .7, after: 1.0 },
      fantasia: { label: 'MA ĐỊCH · MỘNG HUYỄN ÂM TỎA', shout: 'NGHE KHÚC NHẠC CUỐI CÙNG ĐI!', rgb: '230,80,200', windup: 1.4, after: 1.8, ult: 1 }
    },
    kidomaru: {
      bind:   { label: 'TRI CHU PHƯỢC', rgb: '250,245,225', windup: .6, after: .9 },
      kunai:  { label: 'TRI CHU NIÊM KIM', rgb: '255,205,70', windup: .6, after: .9 },
      net:    { label: 'TRI CHU SÀO GIỚI', rgb: '255,240,200', windup: .85, after: 1.0 },
      spider: { label: 'KHẨU KÝ · CỰ ĐẠI TRI CHU', rgb: '220,170,110', windup: .9, after: 1.1 },
      bow:    { label: 'TRI CHU CHIẾN CUNG · THÊ LIỆT', shout: 'TRÒ CHƠI KẾT THÚC RỒI!', rgb: '255,200,50', windup: 1.5, after: 1.6, ult: 1 }
    },
    jirobo: {
      slab:  { label: 'THỔ ĐỘN · ĐỊA PHIẾN TRỊCH', rgb: '230,170,110', windup: .9, after: .85 },
      arhat: { label: 'LA HÁN QUYỀN', rgb: '255,170,90', windup: .7, after: 1.0 },
      split: { label: 'THỔ ĐỘN · ĐỊA LIỆT CHẤN', rgb: '220,160,100', windup: .9, after: 1.0 },
      rain:  { label: 'THỔ ĐỘN · LOẠN THẠCH VŨ', rgb: '215,170,120', windup: .9, after: 1.0 },
      dome:  { label: 'THỔ ĐỘN · KẾT GIỚI · THỔ LAO ĐƯỜNG', shout: 'CHAKRA CỦA NGƯƠI LÀ CỦA TA!', rgb: '255,150,60', windup: 1.3, after: 1.8, ult: 1 }
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

  function state(z) {
    return z.so || (z.so = { t: 0, casts: 0, timer: 1.1, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, seed: 0, tele: [], ev: [], fx: [],
      spots: null, dash: null, arc: null, lift: 0, hold: 0, curse: 0, armorT: 0, anchor: null, refY: Math.round(z.y), lastDraw: 0 });
  }
  // Persistent summons (gates, ogres, the dome) are flagged `keep` so a burst of small effects never evicts them.
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 24) { const i = st.fx.findIndex(f => !f.keep); st.fx.splice(i >= 0 ? i : 0, 1); }
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 260) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (Spr() && Spr().height ? Spr().height(id) : 80);
  const P = v => Math.round(v);

  function conePts(x, y, a, reach, half, from = 70) {
    const out = [];
    for (let d = from; d <= reach; d += 85) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120)), r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d });
      }
    }
    return out;
  }
  function ringPts(x, y, R, step = 140) {
    const n = Math.max(6, Math.round(TAU * R / step)), out = [];
    for (let i = 0; i < n; i++) { const a = i * TAU / n; out.push({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R }); }
    return out;
  }
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 60 + i * 18;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }
  // The hostile body nearest a point (works for the hero, clones and team-battle units; never the cursor pseudo-target).
  function victim(api, x, y, r) {
    const f = api.nearestFoe ? api.nearestFoe(x, y, r) : null;
    if (f) return f;
    const p = api.player;
    return p && !p.pseudo && p.health > 0 && Math.hypot(p.x - x, p.y - y) < r + (p.r || 14) ? p : null;
  }
  // Webs, the Fantasia chains and the dome drag whoever is caught toward their centre (a short, fair slow).
  function pullTo(api, cx, cy, r, speed, dt) {
    const p = victim(api, cx, cy, r);
    if (!p) return null;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d > 14) {
      const step = Math.min(d - 12, speed * dt), nx = p.x + (cx - p.x) / d * step, ny = p.y + (cy - p.y) / d * step;
      if (!api.blocked(nx, ny, p.r || 14)) { p.x = nx; p.y = ny; }
    }
    return p;
  }

  // ================================================================== telegraphs per move
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y), nx = -sa, ny = ca;
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const cone = (r, h, aa = a, ox = x, oy = y) => ({ k: 'cone', x: ox, y: oy, a: aa, r, h });
    const clampLen = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (id === 'kimimaro') switch (move) {
      case 'tsubaki': { const len = clampLen(d - 40, 120, 520); st.spots = [{ len: P(len) }]; return [line(len, 46), circ(x + ca * len, y + sa * len, 170)]; }
      case 'teshi': return [cone(900, .3)];
      case 'karamatsu': return [circ(x, y, 240), circ(x, y, 380, true)];
      case 'yanagi': { const len = clampLen(d - 30, 0, 300); st.spots = [{ len: P(len) }]; return [line(len, 120), circ(x + ca * len, y + sa * len, 230)]; }
      case 'tessenka': return [cone(440, 1.0), line(600, 24)];
      case 'sawarabi': return [circ(x, y, 300), circ(x, y, 780, true)];
    }
    if (id === 'sakon') switch (move) {
      case 'tarenken': { const len = clampLen(d - 70, 0, 360); st.spots = [{ len: P(len) }]; return [line(len, 40), cone(240, .7, a, x + ca * len, y + sa * len)]; }
      case 'ukon': return [line(clampLen(d, 100, 760), 26), circ(tx, ty, 100, true)];
      case 'rashomon': return [circ(tx, ty, 175), line(d, 18)];
      case 'drop': return [circ(tx, ty, 220)];
      case 'tajuu': {
        const b = st.seed, spots = [];
        for (let i = 0; i < 3; i++) { const an = b + i * TAU / 3; spots.push({ x: P(tx + Math.cos(an) * 250), y: P(ty + Math.sin(an) * 250 * .8) }); }
        st.spots = spots;
        return spots.map(s => circ(s.x, s.y, 120)).concat([circ(tx, ty, 260, true)]);
      }
    }
    if (id === 'tayuya') switch (move) {
      case 'mateki': return [cone(650, .48)];
      case 'doki': {
        const b = st.seed, spots = [];
        for (let i = 0; i < 3; i++) {
          const an = b + i * TAU / 3, ox = tx + Math.cos(an) * 200, oy = ty + Math.sin(an) * 170;
          spots.push({ x: P(ox), y: P(oy), sx: P(ox + (tx - ox) * .55), sy: P(oy + (ty - oy) * .55) });
        }
        st.spots = spots;
        return spots.map(s => circ(s.sx, s.sy, 150));
      }
      case 'spirits': return [circ(tx, ty, 170, true), line(clampLen(d, 100, 900), 22)];
      case 'ring': return [circ(tx, ty, 420, true), circ(tx, ty, 150)];
      case 'fantasia': return [circ(tx, ty, 480), circ(tx, ty, 170, true)];
    }
    if (id === 'kidomaru') switch (move) {
      case 'bind': {
        const spots = [-1, 0, 1].map(k => ({ x: P(tx + nx * k * 140 - ca * Math.abs(k) * 40), y: P(ty + ny * k * 140 - sa * Math.abs(k) * 40) }));
        st.spots = spots;
        return spots.map(s => circ(s.x, s.y, 140));
      }
      case 'kunai': { const out = []; for (let i = 0; i < 6; i++) out.push(line(780, 20, a + (i - 2.5) * .12)); return out; }
      case 'net': return [circ(tx, ty, 320)];
      case 'spider': {
        const k = Math.min(.6, 380 / Math.max(1, d)), sx = x + (tx - x) * k, sy = y + (ty - y) * k;
        st.spots = [{ x: P(sx), y: P(sy) }];
        return [circ(sx, sy, 110, true), circ(tx, ty, 150)];
      }
      case 'bow': return [line(1150, 66), circ(x + ca * 1150, y + sa * 1150, 240)];
    }
    if (id === 'jirobo') switch (move) {
      case 'slab': return [circ(tx, ty, 210)];
      case 'arhat': { const len = clampLen(d - 80, 0, 380); st.spots = [{ len: P(len) }]; return [line(len, 50), cone(300, .6, a, x + ca * len, y + sa * len)]; }
      case 'split': { const out = []; for (let i = 0; i < 5; i++) out.push(line(620, 40, a + (i - 2) * .28)); return out; }
      case 'rain': return [circ(tx, ty, 330, true), circ(x, y, 150)];
      case 'dome': return [circ(tx, ty, 300), circ(tx, ty, 120, true)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId, move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = P(p ? p.x : z.x + Math.cos(st.aim) * 200); st.ty = P(p ? p.y : z.y + Math.sin(st.aim) * 200);
    st.seed = r1(Math.random() * 6);
    st.spots = null;
    st.tele = teleFor(z, st, id, move);
    if (def.ult) st.curse = Math.max(st.curse, def.windup + 5);
    z.angle = st.aim;
  }

  // ================================================================== movement helpers
  function startDash(z, st, a, len, dur, dmg, w, end, trail, heavy) {
    st.dash = { a: r1(a), speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end, heavy: heavy ? 1 : 0 };
    st.liftT = 0;
    addFx(st, { kind: 'dash', pts: [], a: r1(a), dur: dur + .45, x0: P(z.x), y0: P(z.y), x1: P(z.x), y1: P(z.y), rgb: trail || '255,255,255' });
  }
  function startArc(z, st, x1, y1, dur, h, end) {
    st.arc = { t: 0, dur, h, x0: z.x, y0: z.y, x1, y1, end };
  }

  // ================================================================== casting
  function cast(z, st, api) {
    const id = z.bossId, move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    if (id === 'kimimaro') castKimimaro(z, st, api, move, D, a, ca, sa);
    else if (id === 'sakon') castSakon(z, st, api, move, D, a, ca, sa);
    else if (id === 'tayuya') castTayuya(z, st, api, move, D, a, ca, sa);
    else if (id === 'kidomaru') castKidomaru(z, st, api, move, D, a, ca, sa);
    else castJirobo(z, st, api, move, D, a, ca, sa);
  }
  const impact = (st, x, y, r, rgb, dur = 1.3) => addFx(st, { kind: 'impact', x: P(x), y: P(y), r, rgb, dur });

  // ------------------------------------------------------------------ Kimimaro
  function castKimimaro(z, st, api, move, D, a, ca, sa) {
    const seed = st.seed;
    switch (move) {
      case 'tsubaki': {
        const len = st.spots ? st.spots[0].len : 200;
        const fin = api => {
          for (let k = 0; k < 3; k++) later(st, k * .17, api => {
            const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : a;
            api.strike(z.x + Math.cos(aa) * 50, z.y + Math.sin(aa) * 50, 170, D * 1.3, null, k === 2 ? 'blade' : null, true);
            api.shake(6 + k * 3);
            addFx(st, { kind: 'slash', x: P(z.x + Math.cos(aa) * 34), y: P(z.y + Math.sin(aa) * 34), a: r1(aa + (k - 1) * .8), r: 150 + k * 22, flip: k % 2, dur: .5 });
          });
          st.hold = Math.max(st.hold, .7);
        };
        startDash(z, st, a, len, .2, D * 1.1, 48, fin, '245,240,225');
        break;
      }
      case 'teshi': {
        for (let k = 0; k < 3; k++) later(st, k * .26, api => {
          const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : a, list = [];
          for (let i = 0; i < 5; i++) list.push([P(z.x), P(z.y), r1((aa + (i - 2) * .085 + (hash(i + k * 7 + seed) - .5) * .05) * 100) / 100]);
          const f = addFx(st, { kind: 'bullets', list, speed: 1150, range: 900, dur: .9, tick: 0, dmg: D * .8 });
          f.upd = (f, dt, api) => {
            if ((f.tick -= dt) > 0) return;
            f.tick = .045;
            const dd = f.age * f.speed;
            if (dd > f.range) return;
            for (const b of f.list) api.strike(b[0] + Math.cos(b[2]) * dd, b[1] + Math.sin(b[2]) * dd, 30, f.dmg, null, null, true);
          };
          api.shake(4);
        });
        st.hold = .85;
        break;
      }
      case 'karamatsu': {
        const x = z.x, y = z.y;
        api.strike(x, y, 240, D * 2.0, null, 'blade', true);
        api.knockback(z, 250, 130, 0);
        api.shake(13);
        st.armorT = 1.4;
        const sp = [];
        for (let i = 0; i < 24; i++) sp.push([r1(i * TAU / 24 + (hash(i + seed) - .5) * .2), P(80 + hash(i * 3.1 + seed) * 60), r1(hash(i * 5.3 + seed) * .9 - .2)]);
        addFx(st, { kind: 'bodyspikes', x: P(x), y: P(y), sp, dur: 1.3 });
        later(st, .3, api => {
          const list = [];
          ringPts(x, y, 330, 95).forEach((q, i) => list.push([P(q.x + (hash(i + seed) - .5) * 30), P(q.y + (hash(i * 2 + seed) - .5) * 24), P(60 + hash(i * 4 + seed) * 50), r1(hash(i * 7 + seed) * .1), i % 3]));
          addFx(st, { kind: 'forest', list, dur: 2.2 });
          ringPts(x, y, 330, 150).forEach(q => api.strike(q.x, q.y, 90, D * 1.4, null, null, true));
          api.world(x, y, 340, D * 1.6, 'earth');
          api.shake(9);
        });
        st.hold = 1.1;
        break;
      }
      case 'yanagi': {
        const len = st.spots ? st.spots[0].len : 0;
        addFx(st, { kind: 'whirl', dur: .95, follow: 1 });
        const fin = api => {
          api.strike(z.x, z.y, 230, D * 1.6, null, 'blade', true);
          api.knockback(z, 240, 140, 0);
          api.shake(10);
          for (let k = 0; k < 2; k++) addFx(st, { kind: 'slash', x: P(z.x), y: P(z.y), a: r1(a + k * Math.PI), r: 210, flip: k, dur: .55 });
        };
        if (len > 20) startDash(z, st, a, len, .6, D * .8, 120, fin, '235,240,230'); else { later(st, .3, fin); st.hold = .6; }
        break;
      }
      case 'tessenka': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'whip', x: P(x), y: P(y), a, r: 440, dur: .65 });
        later(st, .14, api => {
          conePts(x, y, a, 440, 1.0).forEach(q => api.strike(q.x, q.y, q.r, D * 1.5, null, null, true));
          api.world(x + ca * 360, y + sa * 360, 120, D * 1.6, 'blade', a);
          api.shake(9);
        });
        later(st, .55, api => {
          const q = api.player, aa = r1(q ? Math.atan2(q.y - z.y, q.x - z.x) : a);
          addFx(st, { kind: 'lineMark', x: P(z.x), y: P(z.y), a: aa, len: 600, w: 54, dur: .4, rgb: '245,238,215' });
          later(st, .4, api => {
            addFx(st, { kind: 'drill', dur: .55, follow: 1, a: aa });
            startDash(z, st, aa, 600, .2, D * 2.2, 56, api => {
              api.strike(z.x, z.y, 160, D * 1.4, null, 'crater', true);
              api.shake(14);
              impact(st, z.x, z.y, 170, '250,244,228', 1.1);
            }, '245,238,215', true);
          });
        });
        st.hold = 1.35;
        break;
      }
      case 'sawarabi': {
        const x = z.x, y = z.y, R = [120, 230, 340, 450, 560, 670, 770], list = [];
        st.curse = Math.max(st.curse, 5.5);
        R.forEach((r, i) => {
          const n = Math.round(TAU * r / 120);
          for (let j = 0; j < n; j += (i < 2 ? .8 : 1.25)) {
            const an = j / n * TAU + hash(i * 13 + j + seed) * .3, rr = r + (hash(j * 3.3 + i + seed) - .5) * 60;
            if (list.length < 120) list.push([P(x + Math.cos(an) * rr), P(y + Math.sin(an) * rr * .82), P(90 + hash(i + j * 1.7 + seed) * 90 + i * 12), r1(i * .16 + hash(j + i * 4) * .08), (i + j) % 3]);
          }
          later(st, i * .16, api => {
            ringPts(x, y, r, 140).forEach((q, j) => api.strike(q.x, q.y * .82 + y * .18, 90, D * 1.7, null, j % 5 === 0 && i % 2 ? 'earth' : null, true));
            api.shake(8 + i * 1.4);
          });
        });
        // Kimimaro rises on the central spire.
        list.push([P(x), P(y + 2), 78, 0, 0]);
        addFx(st, { kind: 'forest', list, dur: 4.6, keep: 1, big: 1 });
        st.liftT = 3.8;
        later(st, .6, api => { for (let k = 0; k < 4; k++) { const an = seed + k * TAU / 4; api.world(x + Math.cos(an) * 520, y + Math.sin(an) * 420, 200, D * 2.4, 'earth', an); } });
        later(st, .1, api => impact(st, x, y, 300, '255,248,230', 1.5));
        st.hold = 2.0;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Sakon & Ukon
  function castSakon(z, st, api, move, D, a, ca, sa) {
    const seed = st.seed;
    switch (move) {
      case 'tarenken': {
        const len = st.spots ? st.spots[0].len : 0;
        const go = api => {
          addFx(st, { kind: 'fists', x: P(z.x), y: P(z.y), a, dur: 1.0 });
          for (let k = 0; k < 7; k++) later(st, k * .11, api => {
            api.strike(z.x + ca * 120, z.y + sa * 120, 135, D * .62, null, null, true);
            if (k === 6) { api.knockback(z, 240, 170, D * .6); api.shake(12); impact(st, z.x + ca * 130, z.y + sa * 130, 150, '210,170,255', .9); }
            else api.shake(4);
          });
          st.hold = Math.max(st.hold, .9);
        };
        if (len > 20) startDash(z, st, a, len, .18, D * 1.0, 40, go, '200,160,255'); else go(api);
        break;
      }
      case 'ukon': {
        const f = addFx(st, { kind: 'ukon', x: P(z.x), y: P(z.y - 6), tx: st.tx, ty: st.ty, mode: 0, lt: 0, tick: 0, fc: facingOf(z), dur: 6, dmg: D * .55, keep: 1 });
        f.upd = (f, dt, api) => {
          const sp = f.mode === 2 ? 820 : 640;
          let gx = f.tx, gy = f.ty;
          if (f.mode < 2) { const v = victim(api, f.x, f.y, f.mode ? 220 : 900); if (v) { gx = v.x; gy = v.y; } else if (f.mode === 1) f.mode = 2; }
          if (f.mode === 2) { gx = z.x; gy = z.y - 6; }
          const dx = gx - f.x, dy = gy - f.y, dd = Math.hypot(dx, dy);
          if (f.mode === 1) { f.x = gx; f.y = gy; }
          else if (dd > 1) { const s = Math.min(dd, sp * dt); f.x += dx / dd * s; f.y += dy / dd * s; if (Math.abs(dx) > 4) f.fc = dx > 0 ? 1 : -1; }
          if (f.mode === 0 && (dd < 34 || f.age > 1.6)) { f.mode = dd < 34 ? 1 : 2; f.lt = 0; if (f.mode === 1) api.strike(f.x, f.y, 70, f.dmg * 1.6, null, null, true); }
          if (f.mode === 1) {
            f.lt += dt;
            if ((f.tick -= dt) <= 0) { f.tick = .4; api.strike(f.x, f.y, 60, f.dmg, null, null, true); }
            if (f.lt > 2.4) f.mode = 2;
          }
          if (f.mode === 2 && dd < 30) f.age = f.dur;
          f.x = r1(f.x); f.y = r1(f.y);
        };
        st.hold = .5;
        break;
      }
      case 'rashomon': {
        const gx = st.tx, gy = st.ty;
        addFx(st, { kind: 'gate', x: gx, y: gy, s: 1, dur: 3.8, keep: 1 });
        api.strike(gx, gy, 175, D * 2.4, null, 'earth', true);
        api.knockback({ x: gx, y: gy }, 240, 170, 0);
        api.shake(16);
        impact(st, gx, gy, 200, '220,140,255', 1.2);
        st.hold = .7;
        break;
      }
      case 'drop': {
        const spot = freeSpot(api, st.tx, st.ty, z.r) || { x: z.x, y: z.y };
        startArc(z, st, spot.x, spot.y, .72, 210, api => {
          api.strike(z.x, z.y, 220, D * 2.6, null, 'crater', true);
          api.knockback(z, 240, 150, 0);
          api.shake(18);
          impact(st, z.x, z.y, 230, '210,170,255', 1.3);
          addFx(st, { kind: 'fists', x: P(z.x), y: P(z.y), a: r1(Math.PI / 2), dur: .6, down: 1 });
        });
        break;
      }
      case 'tajuu': {
        const cx = st.tx, cy = st.ty, gates = st.spots || [];
        st.curse = Math.max(st.curse, 5.5);
        gates.forEach((g, i) => later(st, i * .12, api => {
          addFx(st, { kind: 'gate', x: g.x, y: g.y, s: .72, dur: 4.4 - i * .12, keep: 1 });
          api.strike(g.x, g.y, 120, D * 1.8, null, 'earth', true);
          api.shake(12);
        }));
        // Sakon and Ukon cut across the prison from opposite sides, four times.
        for (let k = 0; k < 4; k++) later(st, .6 + k * .55, api => {
          const ak = r1(seed + k * TAU / 4 + .4), c = Math.cos(ak), s = Math.sin(ak);
          const ax = cx - c * 250, ay = cy - s * 250, bx = cx + s * 250, by = cy - c * 250;
          addFx(st, { kind: 'lineMark', x: P(ax), y: P(ay), a: ak, len: 500, w: 50, dur: .3, rgb: '200,120,255' });
          addFx(st, { kind: 'lineMark', x: P(bx), y: P(by), a: r1(ak + Math.PI / 2), len: 500, w: 50, dur: .3, rgb: '255,120,200' });
          later(st, .3, api => {
            const spot = freeSpot(api, ax, ay, z.r);
            if (spot) { z.x = spot.x; z.y = spot.y; }
            startDash(z, st, ak, 500, .14, D * 1.3, 52, null, '200,140,255');
            addFx(st, { kind: 'twin', x0: P(bx), y0: P(by), x1: P(2 * cx - bx), y1: P(2 * cy - by), dur: .5 });
            for (let i = 1; i <= 4; i++) later(st, i * .035, api => api.strike(bx + (cx - bx) * i / 2, by + (cy - by) * i / 2, 60, D * 1.3, null, null, true));
            api.shake(8);
          });
        });
        later(st, 3.0, api => {
          const spot = freeSpot(api, cx, cy, z.r) || { x: z.x, y: z.y };
          addFx(st, { kind: 'mark', x: P(cx), y: P(cy), r: 260, dur: .45, rgb: '200,90,255' });
          startArc(z, st, spot.x, spot.y, .45, 170, api => {
            api.strike(cx, cy, 260, D * 3.0, null, 'crater', true);
            api.knockback({ x: cx, y: cy }, 280, 200, 0);
            api.shake(22);
            impact(st, cx, cy, 280, '200,110,255', 1.5);
            addFx(st, { kind: 'fists', x: P(cx), y: P(cy), a: r1(Math.PI / 2), dur: .7, down: 1 });
          });
        });
        st.hold = 3.6;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Tayuya
  function castTayuya(z, st, api, move, D, a, ca, sa) {
    const seed = st.seed;
    switch (move) {
      case 'mateki': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'notes', x: P(x), y: P(y), a, r: 650, h: .48, dur: 1.5 });
        for (let k = 0; k < 3; k++) later(st, .1 + k * .3, api => {
          const R = 650 * (.45 + k * .275);
          conePts(x, y, a, R, .48).forEach(q => { if (q.d > R - 230) api.strike(q.x, q.y, q.r, D * .85, null, null, true); });
          api.shake(4);
        });
        st.hold = 1.0;
        break;
      }
      case 'doki': {
        const spots = st.spots || [], cx = st.tx, cy = st.ty;
        const f = addFx(st, { kind: 'doki', og: spots.map((s, i) => ({ x: s.x, y: s.y, f: s.x < cx ? 1 : -1, v: i, sx: s.sx, sy: s.sy })), slam: [1.0, 2.7, 3.9], dur: 4.8, keep: 1 });
        const slam = (k) => api => {
          if (k < 2) f.og.forEach(o => { api.strike(o.sx, o.sy, 150, D * 2.0, null, 'crater', true); impact(st, o.sx, o.sy, 160, '200,150,255', 1.0); });
          else { api.strike(f.cx, f.cy, 240, D * 2.6, null, 'crater', true); api.knockback({ x: f.cx, y: f.cy }, 260, 170, 0); impact(st, f.cx, f.cy, 260, '220,120,255', 1.3); }
          api.shake(k < 2 ? 14 : 20);
        };
        later(st, .3, api => f.og.forEach(o => addFx(st, { kind: 'mark', x: o.sx, y: o.sy, r: 150, dur: .7, rgb: '220,110,255' })));
        later(st, 1.0, slam(0));
        f.upd = (f, dt, api) => {
          if (f.age < 1.5 || f.age > 2.0) return;
          const v = victim(api, cx, cy, 900), gx = v ? v.x : cx, gy = v ? v.y : cy;
          f.og.forEach((o, i) => {
            const an = seed + i * TAU / 3, wx = gx + Math.cos(an) * 170, wy = gy + Math.sin(an) * 150, dx = wx - o.x, dy = wy - o.y, dd = Math.hypot(dx, dy);
            if (dd > 2) { const s = Math.min(dd, 300 * dt); o.x = r1(o.x + dx / dd * s); o.y = r1(o.y + dy / dd * s); o.f = gx > o.x ? 1 : -1; }
          });
        };
        later(st, 2.0, api => {
          const v = victim(api, cx, cy, 900), gx = v ? v.x : cx, gy = v ? v.y : cy;
          f.og.forEach(o => { o.sx = P(o.x + (gx - o.x) * .6); o.sy = P(o.y + (gy - o.y) * .6); addFx(st, { kind: 'mark', x: o.sx, y: o.sy, r: 150, dur: .7, rgb: '220,110,255' }); });
        });
        later(st, 2.7, slam(1));
        later(st, 3.15, api => {
          const v = victim(api, cx, cy, 900);
          f.cx = P(v ? v.x : cx); f.cy = P(v ? v.y : cy);
          f.og.forEach(o => { o.sx = f.cx; o.sy = f.cy; });
          addFx(st, { kind: 'mark', x: f.cx, y: f.cy, r: 240, dur: .75, rgb: '230,90,255' });
        });
        later(st, 3.9, slam(2));
        st.hold = 4.1;
        break;
      }
      case 'spirits': {
        const list = [];
        for (let i = 0; i < 11; i++) {
          const an = a + (i / 10 - .5) * 2.4 + (hash(i + seed) - .5) * .2, sp = 260 + hash(i * 2 + seed) * 120;
          list.push([P(z.x + Math.cos(an) * 20), P(z.y - 30), P(Math.cos(an) * sp), P(Math.sin(an) * sp * .7 - 80), 1, r1(i * .07), 0]);
        }
        const f = addFx(st, { kind: 'spirits', list, tx: st.tx, ty: st.ty, dur: 3.4, dmg: D * .7 });
        f.upd = (f, dt, api) => {
          const v = victim(api, z.x, z.y, 1300);
          if (v) { f.tx = P(v.x); f.ty = P(v.y); }
          for (const s of f.list) {
            if (!s[4] || f.age < s[5]) continue;
            const dx = f.tx - s[0], dy = f.ty - 20 - s[1], dd = Math.hypot(dx, dy) || 1;
            const want = Math.min(560, 240 + (f.age - s[5]) * 260);
            s[2] += (dx / dd * want - s[2]) * Math.min(1, dt * 3.4); s[3] += (dy / dd * want - s[3]) * Math.min(1, dt * 3.4);
            s[0] = r1(s[0] + s[2] * dt); s[1] = r1(s[1] + s[3] * dt);
            if (dd < 40) { s[4] = 0; s[6] = r1(f.age); api.strike(s[0], s[1] + 20, 56, f.dmg, null, null, true); }
          }
        };
        st.hold = .9;
        break;
      }
      case 'ring': {
        const cx = st.tx, cy = st.ty;
        addFx(st, { kind: 'noteRing', x: cx, y: cy, r0: 420, dur: 1.4 });
        later(st, .55, api => { ringPts(cx, cy, 215, 120).forEach(q => api.strike(q.x, q.y, 70, D * .9, null, null, true)); api.shake(5); });
        later(st, 1.05, api => {
          api.strike(cx, cy, 155, D * 2.4, null, 'shockwave', true);
          api.shake(13);
          impact(st, cx, cy, 170, '255,140,200', 1.0);
        });
        st.hold = .7;
        break;
      }
      case 'fantasia': {
        const cx = st.tx, cy = st.ty, R = 480, T = 3.6;
        st.curse = Math.max(st.curse, 6);
        const f = addFx(st, { kind: 'fantasia', x: cx, y: cy, R, T, vx: cx, vy: cy, tick: .2, dur: T + 1.4, keep: 1, dmg: D * .42 });
        f.upd = (f, dt, api) => {
          if (f.age > f.T) return;
          const v = pullTo(api, f.x, f.y, f.R, 120, dt);
          if (v) { f.vx = P(v.x); f.vy = P(v.y); } else { f.vx = f.x; f.vy = f.y; }
          if ((f.tick -= dt) <= 0) { f.tick = .45; api.strike(f.x, f.y, f.R, f.dmg, null, null, true); }
        };
        later(st, T, api => {
          api.strike(cx, cy, 280, D * 3.0, null, 'crater', true);
          api.strike(cx, cy, R, D * .9, null, null, true);
          api.knockback({ x: cx, y: cy }, R, 160, 0);
          api.world(cx, cy, 300, D * 2.4, 'shockwave');
          api.shake(22);
          impact(st, cx, cy, 300, '230,90,200', 1.6);
        });
        st.hold = T + .3;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Kidōmaru
  function webAt(st, x, y, r, dur, D, big) {
    const f = addFx(st, { kind: 'web', x: P(x), y: P(y), r, dur, big: big ? 1 : 0, tick: .3, dmg: D * .35, keep: big ? 1 : 0 });
    f.upd = (f, dt, api) => {
      if (f.age > f.dur - .4) return;
      pullTo(api, f.x, f.y, f.r, f.big ? 200 : 150, dt);
      if ((f.tick -= dt) <= 0) { f.tick = .42; api.strike(f.x, f.y, f.r * .92, f.dmg, null, null, true); }
    };
    return f;
  }
  function spit(z, st, x0, y0, x1, y1, D, r) {
    const T = r1(Math.max(.15, Math.hypot(x1 - x0, y1 - y0) / 950));
    addFx(st, { kind: 'glob', x0: P(x0), y0: P(y0), x1: P(x1), y1: P(y1), T, dur: T });
    later(st, T, api => { api.strike(x1, y1, r, D * 1.15, null, null, true); webAt(st, x1, y1, r, 2.6, D); api.shake(4); });
  }
  function castKidomaru(z, st, api, move, D, a, ca, sa) {
    const seed = st.seed;
    switch (move) {
      case 'bind': {
        (st.spots || []).forEach((s, i) => later(st, i * .09, () => spit(z, st, z.x + ca * 16, z.y - 4, s.x, s.y, D, 140)));
        st.hold = .6;
        break;
      }
      case 'kunai': {
        const x = z.x, y = z.y, as = [];
        for (let i = 0; i < 6; i++) as.push(r1((a + (i - 2.5) * .12) * 100) / 100);
        addFx(st, { kind: 'kunai', x: P(x), y: P(y), as, len: 780, speed: 1800, dur: .9 });
        as.forEach((aa, i) => later(st, i * .03 + .05, api => api.line(x, y, x + Math.cos(aa) * 780, y + Math.sin(aa) * 780, 22, D * 1.15, i === 2 || i === 3 ? 'blade' : null)));
        api.shake(5);
        st.hold = .5;
        break;
      }
      case 'net': {
        const cx = st.tx, cy = st.ty;
        addFx(st, { kind: 'drop', x: cx, y: cy, r: 320, dur: .35 });
        later(st, .3, api => {
          api.strike(cx, cy, 320, D * 1.3, null, null, true);
          webAt(st, cx, cy, 320, 3.8, D, true);
          api.shake(9);
        });
        st.hold = .7;
        break;
      }
      case 'spider': {
        const s = st.spots ? st.spots[0] : { x: z.x, y: z.y };
        const f = addFx(st, { kind: 'spider', x: s.x, y: s.y, fc: st.tx >= s.x ? 1 : -1, sac: 0, dur: 4.8, keep: 1 });
        addFx(st, { kind: 'poof', x: s.x, y: s.y, r: 150, dur: 1.0 });
        api.shake(8);
        later(st, .7, api => { const v = victim(api, s.x, s.y, 900); spit(z, st, s.x + f.fc * 60, s.y - 50, v ? v.x : st.tx, v ? v.y : st.ty, D, 150); });
        later(st, 1.2, () => { f.sac = 1; });
        later(st, 1.9, api => {
          f.sac = 2;
          const list = [];
          for (let i = 0; i < 14; i++) { const an = i * TAU / 14 + seed; list.push([P(s.x - f.fc * 50 + Math.cos(an) * 18), P(s.y + Math.sin(an) * 10), r1(an), 1, r1(hash(i + seed) * .25)]); }
          const L = addFx(st, { kind: 'lings', list, dur: 3.0, dmg: D * .5 });
          L.upd = (L, dt, api) => {
            for (const b of L.list) {
              if (!b[3] || L.age < b[4]) continue;
              const v = victim(api, b[0], b[1], 900);
              let wa = b[2];
              if (v) wa = Math.atan2(v.y - b[1], v.x - b[0]);
              const da = Math.atan2(Math.sin(wa - b[2]), Math.cos(wa - b[2]));
              b[2] = r1((b[2] + Math.max(-1, Math.min(1, da)) * dt * 6 + Math.sin(L.age * 9 + b[4] * 30) * dt * 2) * 100) / 100;
              const nx = b[0] + Math.cos(b[2]) * 290 * dt, ny = b[1] + Math.sin(b[2]) * 290 * dt;
              if (!api.blocked(nx, ny, 6)) { b[0] = r1(nx); b[1] = r1(ny); }
              if (v && Math.hypot(v.x - b[0], v.y - b[1]) < 30 + (v.r || 14)) { b[3] = 0; api.strike(b[0], b[1], 44, L.dmg, null, null, true); }
            }
          };
          addFx(st, { kind: 'poof', x: P(s.x - f.fc * 50), y: s.y, r: 70, dur: .7 });
        });
        later(st, 4.3, () => addFx(st, { kind: 'poof', x: s.x, y: s.y, r: 160, dur: 1.0 }));
        st.hold = 1.1;
        break;
      }
      case 'bow': {
        const x = z.x, y = z.y, len = 1150, sp = 2800;
        st.curse = Math.max(st.curse, 3);
        addFx(st, { kind: 'arrow', x0: P(x), y0: P(y), a, len, speed: sp, dur: len / sp + 1.0 });
        for (let s = 0; s < len; s += 115) later(st, s / sp, api => {
          const e = Math.min(len, s + 130);
          api.line(x + ca * s, y + sa * s, x + ca * e, y + sa * e, 70, D * 3.0, (s / 115) % 3 === 1 ? 'blade' : null);
        });
        later(st, len / sp, api => {
          api.strike(x + ca * len, y + sa * len, 240, D * 2.2, null, 'crater', true);
          api.shake(22);
          impact(st, x + ca * len, y + sa * len, 260, '255,210,80', 1.4);
        });
        for (const d of [380, 760]) later(st, d / sp, api => api.world(x + ca * d, y + sa * d, 130, D * 2.4, 'blade', a));
        api.shake(12);
        st.hold = .8;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Jirōbō
  function castJirobo(z, st, api, move, D, a, ca, sa) {
    const seed = st.seed;
    switch (move) {
      case 'slab': {
        const x1 = st.tx, y1 = st.ty, T = .75;
        addFx(st, { kind: 'slab', x0: P(z.x), y0: P(z.y), x1, y1, T, h: 260, dur: T });
        later(st, T, api => {
          api.strike(x1, y1, 210, D * 2.8, null, 'crater', true);
          api.knockback({ x: x1, y: y1 }, 230, 150, 0);
          api.shake(18);
          impact(st, x1, y1, 230, '230,180,120', 1.4);
          const list = [];
          for (let i = 0; i < 5; i++) { const an = seed + i * TAU / 5, dd = 150 + hash(i + seed) * 110; list.push([P(x1 + Math.cos(an) * dd), P(y1 + Math.sin(an) * dd * .8), r1(.25 + i * .06), i % 3, 1]); }
          addFx(st, { kind: 'rocks', list, fall: .3, dur: 1.6, small: 1 });
          list.forEach(q => later(st, q[2] + .3, api => api.strike(q[0], q[1], 80, D * 1.0, null, null, true)));
        });
        st.hold = .9;
        break;
      }
      case 'arhat': {
        const len = st.spots ? st.spots[0].len : 0;
        const go = api => {
          for (let k = 0; k < 3; k++) later(st, k * .26, api => {
            api.strike(z.x + ca * 120, z.y + sa * 120, 150, D * 1.3, null, null, true);
            addFx(st, { kind: 'punch', x: P(z.x + ca * 60), y: P(z.y + sa * 60), a, big: 0, dur: .6 });
            api.shake(7);
          });
          later(st, .82, api => {
            api.line(z.x, z.y, z.x + ca * 460, z.y + sa * 460, 62, D * 1.8, 'earth');
            api.knockback(z, 280, 180, 0);
            addFx(st, { kind: 'punch', x: P(z.x + ca * 70), y: P(z.y + sa * 70), a, big: 1, dur: 1.0 });
            addFx(st, { kind: 'cracks', x: P(z.x + ca * 60), y: P(z.y + sa * 60), as: [r1(a - .14), r1(a), r1(a + .14)], len: 440, speed: 1600, dur: 1.6, sp: 0 });
            api.shake(18);
          });
          st.hold = Math.max(st.hold, 1.1);
        };
        if (len > 20) startDash(z, st, a, len, .22, D * 1.0, 58, go, '255,190,120', true); else go(api);
        break;
      }
      case 'split': {
        const x = z.x, y = z.y, as = [], len = 620, sp = 950;
        for (let i = 0; i < 5; i++) as.push(r1((a + (i - 2) * .28) * 100) / 100);
        api.strike(x, y, 150, D * 1.0, null, 'crater', true);
        impact(st, x, y, 160, '230,180,120', 1.0);
        addFx(st, { kind: 'cracks', x: P(x), y: P(y), as, len, speed: sp, dur: 2.0, sp: 1 });
        as.forEach(aa => { for (let d = 80; d <= len; d += 80) later(st, d / sp, api => api.strike(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 64, D * 1.5, null, d % 320 === 0 ? 'earth' : null, true)); });
        api.shake(14);
        st.hold = .8;
        break;
      }
      case 'rain': {
        const cx = st.tx, cy = st.ty, list = [];
        api.strike(z.x, z.y, 150, D * 1.0, null, 'crater', true);
        impact(st, z.x, z.y, 160, '230,180,120', 1.0);
        api.shake(12);
        for (let i = 0; i < 9; i++) {
          const an = seed + i * 2.4, dd = i === 0 ? 0 : 120 + hash(i + seed) * 190;
          list.push([P(cx + Math.cos(an) * dd), P(cy + Math.sin(an) * dd * .8), r1(.35 + i * .14), i % 3, 0]);
        }
        addFx(st, { kind: 'rocks', list, fall: .7, dur: 3.2 });
        list.forEach((q, i) => later(st, q[2] + .7, api => { api.strike(q[0], q[1], 110, D * 1.6, null, i % 3 === 0 ? 'crater' : null, true); api.shake(8); }));
        st.hold = 1.0;
        break;
      }
      case 'dome': {
        const cx = st.tx, cy = st.ty, R = 300, T = 3.6;
        st.curse = Math.max(st.curse, 6.5);
        const ang = Math.atan2(z.y - cy, z.x - cx), ex = cx + Math.cos(ang) * (R + 36), ey = cy + Math.sin(ang) * (R * .82 + 30);
        const spot = freeSpot(api, ex, ey, z.r) || { x: z.x, y: z.y };
        addFx(st, { kind: 'mark', x: cx, y: cy, r: R, dur: .5, rgb: '255,150,60' });
        startArc(z, st, spot.x, spot.y, .5, 150, api => {
          st.anchor = { x: P(z.x), y: P(z.y), t: T };
          api.shake(14);
          api.strike(cx, cy, R, D * 1.0, null, null, true);
          const f = addFx(st, { kind: 'dome', x: cx, y: cy, R, T, tick: .3, drain: -9, jx: P(z.x), jy: P(z.y), dur: T + 1.2, keep: 1, dmg: D * .45 });
          f.upd = (f, dt, api) => {
            if (f.age > f.T) return;
            const v = pullTo(api, f.x, f.y, f.R - 10, 120, dt);
            if ((f.tick -= dt) <= 0) {
              f.tick = .4;
              api.strike(f.x, f.y, f.R, f.dmg, null, null, true);
              if (v) { z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .012); f.drain = r1(f.age); }
            }
          };
          later(st, T, api => {
            api.strike(cx, cy, R, D * 2.6, null, 'crater', true);
            api.knockback({ x: cx, y: cy }, R + 40, 160, 0);
            for (let k = 0; k < 3; k++) api.world(cx + Math.cos(k * 2.1) * 160, cy + Math.sin(k * 2.1) * 120, 180, D * 2.6, 'earth');
            api.shake(24);
            impact(st, cx, cy, R, '230,170,110', 1.6);
          });
        });
        st.hold = 4.4;
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
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.arc = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.lift = 0; st.anchor = null; st.liftT = 0;
      z.manualBusy = false;
      return;
    }
    const p = api.player;
    st.refY = P(p ? p.y : z.y);
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.curse = Math.max(0, st.curse - dt);
    st.armorT = Math.max(0, st.armorT - dt);
    st.liftT = Math.max(0, (st.liftT || 0) - dt);
    z.armorScale = (m.armor || 1) * (st.armorT > 0 ? .5 : 1) * (st.curse > 0 ? .85 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (ds.heavy && (ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 80, D * 2.2, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      const tr = st.fx.find(f => f.kind === 'dash' && f.age < .4 && f.a === ds.a);
      if (tr) { tr.x1 = P(z.x); tr.y1 = P(z.y); tr.pts.push(P(z.x), P(z.y)); if (tr.pts.length > 16) tr.pts.splice(0, 2); }
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
    } else if (st.liftT > 0) {
      // Kimimaro standing on the central bone spire of the Sawarabi forest.
      st.lift = Math.min(st.lift + dt * 300, 70 * Math.min(1, st.liftT * 2));
      z.kageDash = .05;
    } else if (!st.dash) st.lift = Math.max(0, st.lift - dt * 300);
    if (st.anchor) {
      // Jirōbō keeps both palms on the dome while it drains.
      st.anchor.t -= dt;
      z.x = st.anchor.x; z.y = st.anchor.y; z.kageDash = .05;
      if (st.anchor.t <= 0) st.anchor = null;
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && !st.anchor && st.hold <= 0) {
      if (z.manual) {
        // driven by the user: cast only what was asked for, aimed at the cursor
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, m, api);
      }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc || !!st.anchor;
  }

  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0; st.curse = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ================================================================== cached art (baked once through VFXKit.sprite)
  const BONE = '#f1ecdf', BONE_D = '#c9bfa8', BONE_DD = '#9e9278', INK = '#2a2420';
  function cel(g, path, fill, lw = 3) { path(); g.fillStyle = fill; g.fill(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = lw; path(); g.stroke(); }
  // A bone spire (Sawarabi / Karamatsu): tapered, slightly bent, ivory with growth rings. Base at the bottom centre.
  function spireImg(v) {
    return Kit().sprite('snd:spire' + v, 60, 180, g => {
      const bend = (v - 1) * 7, W = 22 - v * 2;
      const path = () => { g.beginPath(); g.moveTo(30 - W, 176); g.quadraticCurveTo(28 - W * .6 + bend * .3, 90, 30 + bend, 6); g.quadraticCurveTo(32 + W * .5 + bend * .4, 92, 30 + W, 176); g.closePath(); };
      cel(g, path, BONE, 3.2);
      g.save(); path(); g.clip();
      g.fillStyle = BONE_D; g.beginPath(); g.moveTo(30 + bend * .5, 10); g.quadraticCurveTo(34 + W * .5 + bend * .4, 92, 30 + W, 178); g.lineTo(60, 178); g.lineTo(60, 0); g.fill();
      g.fillStyle = 'rgba(150,135,110,.55)'; g.fillRect(0, 150, 60, 30);
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(30 - W * .55, 168); g.quadraticCurveTo(29 - W * .3 + bend * .3, 90, 30 + bend, 14); g.lineTo(31 + bend, 20); g.quadraticCurveTo(31 - W * .1 + bend * .3, 90, 30 - W * .25, 168); g.fill();
      g.strokeStyle = 'rgba(120,105,80,.6)'; g.lineWidth = 1.4;
      for (let y = 40; y < 170; y += 22) { const w = W * (y / 176) + 2; g.beginPath(); g.moveTo(30 - w + bend * (1 - y / 176), y); g.quadraticCurveTo(30 + bend * (1 - y / 176), y + 5, 30 + w + bend * (1 - y / 176), y - 2); g.stroke(); }
      g.restore();
    });
  }
  // Finger-bone bullet (Teshi Sendan): pointing +x.
  function bulletImg() {
    return Kit().sprite('snd:bullet', 48, 16, g => {
      cel(g, () => { g.beginPath(); g.moveTo(2, 8); g.quadraticCurveTo(8, 2, 20, 3.5); g.lineTo(46, 8); g.lineTo(20, 12.5); g.quadraticCurveTo(8, 14, 2, 8); g.closePath(); }, BONE, 2);
      g.fillStyle = BONE_D; g.fillRect(4, 9, 40, 4);
      g.strokeStyle = 'rgba(120,105,80,.7)'; g.lineWidth = 1; for (const x of [12, 18, 24]) { g.beginPath(); g.moveTo(x, 4.4); g.lineTo(x + 2, 11.6); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(8, 5, 18, 1.6);
    });
  }
  // Vertebra for the bone whip / curse-mark tail.
  function vertebraImg() {
    return Kit().sprite('snd:vert', 30, 24, g => {
      cel(g, () => { g.beginPath(); g.moveTo(3, 12); g.lineTo(9, 4); g.lineTo(15, 8); g.lineTo(21, 4); g.lineTo(27, 12); g.lineTo(21, 20); g.lineTo(15, 16); g.lineTo(9, 20); g.closePath(); }, BONE, 2);
      g.fillStyle = BONE_D; g.fillRect(4, 13, 22, 6);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(15, 10, 4, 2, 0, 0, TAU); g.fill();
    });
  }
  // Rashōmon: a towering demon gate, oni face carved into the door. Base at (160, 296).
  function gateImg() {
    return Kit().sprite('snd:gate', 320, 300, g => {
      const PIL = '#5a2a3a', DOOR = '#6c4e86', ROOF = '#2a1e2e';
      cel(g, () => { g.beginPath(); g.rect(14, 274, 292, 22); }, '#6e6670', 3);
      g.fillStyle = '#4e4652'; g.fillRect(16, 286, 288, 8);
      for (const x of [26, 254]) { cel(g, () => { g.beginPath(); g.rect(x, 64, 40, 212); }, PIL, 3); g.fillStyle = 'rgba(255,190,200,.25)'; g.fillRect(x + 4, 66, 7, 208); g.fillStyle = 'rgba(20,0,20,.35)'; g.fillRect(x + 28, 66, 10, 208); }
      cel(g, () => { g.beginPath(); g.rect(66, 84, 188, 192); }, DOOR, 3);
      g.fillStyle = 'rgba(30,10,50,.35)'; g.fillRect(160, 86, 92, 188);
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(160, 86); g.lineTo(160, 274); g.stroke();
      // Studs.
      g.fillStyle = '#d8b860';
      for (let y = 100; y < 270; y += 24) for (const x of [76, 244]) { g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); }
      // Oni face across both doors.
      cel(g, () => { g.beginPath(); g.ellipse(160, 172, 76, 70, 0, 0, TAU); }, '#8a3a58', 3);
      g.fillStyle = 'rgba(30,0,30,.3)'; g.beginPath(); g.ellipse(176, 182, 62, 58, 0, 0, TAU); g.fill();
      // Horns.
      for (const s of [-1, 1]) cel(g, () => { g.beginPath(); g.moveTo(160 + s * 40, 118); g.quadraticCurveTo(160 + s * 78, 96, 160 + s * 70, 54); g.quadraticCurveTo(160 + s * 60, 92, 160 + s * 22, 110); g.closePath(); }, '#ece0c4', 2.5);
      // Brows, burning eyes.
      for (const s of [-1, 1]) {
        cel(g, () => { g.beginPath(); g.moveTo(160 + s * 12, 150); g.lineTo(160 + s * 62, 128); g.lineTo(160 + s * 60, 144); g.lineTo(160 + s * 14, 162); g.closePath(); }, '#2a1424', 2);
        cel(g, () => { g.beginPath(); g.ellipse(160 + s * 34, 162, 15, 9, s * .3, 0, TAU); }, '#ffd23a', 2);
        g.fillStyle = '#c01010'; g.beginPath(); g.arc(160 + s * 34, 163, 4, 0, TAU); g.fill();
      }
      // Nose and the fanged maw.
      cel(g, () => { g.beginPath(); g.moveTo(152, 170); g.lineTo(168, 170); g.lineTo(174, 192); g.lineTo(146, 192); g.closePath(); }, '#7a2a48', 2);
      cel(g, () => { g.beginPath(); g.moveTo(108, 206); g.quadraticCurveTo(160, 196, 212, 206); g.quadraticCurveTo(200, 240, 160, 242); g.quadraticCurveTo(120, 240, 108, 206); g.closePath(); }, '#2a0812', 2.5);
      g.fillStyle = '#f4ecd8';
      for (let i = 0; i < 7; i++) { const x = 118 + i * 14; g.beginPath(); g.moveTo(x, 204); g.lineTo(x + 7, 218 + (i % 3 === 0 ? 8 : 0)); g.lineTo(x + 14, 204); g.fill(); }
      for (const x of [122, 198]) { g.beginPath(); g.moveTo(x - 6, 240); g.lineTo(x, 222); g.lineTo(x + 6, 240); g.fill(); }
      // Roof beam with upswept ends.
      cel(g, () => { g.beginPath(); g.moveTo(4, 70); g.quadraticCurveTo(20, 54, 40, 50); g.lineTo(280, 50); g.quadraticCurveTo(300, 54, 316, 70); g.lineTo(300, 72); g.lineTo(20, 72); g.closePath(); }, ROOF, 3);
      cel(g, () => { g.beginPath(); g.rect(40, 30, 240, 22); }, '#3a2a3e', 3);
      g.fillStyle = '#d8b860'; g.fillRect(44, 34, 232, 3);
      cel(g, () => { g.beginPath(); g.rect(134, 6, 52, 30); }, '#1e141e', 2.5);
      g.font = 'bold 20px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8c860'; g.fillText('羅生門', 160, 22);
    });
  }
  // Doki: one of Tayuya's three ogres (front-facing, slight 3/4). Feet at (100, 236).
  const DOKI = [['#8a7aa0', '#f0ece4', '#e8dcc0'], ['#9a6a5a', '#e8e0d0', '#2a2028'], ['#6a8a86', '#dcd8e8', '#f0e0c0']];
  function ogreImg(v) {
    return Kit().sprite('snd:ogre' + v, 200, 240, g => {
      const [SK, HR, HN] = DOKI[v], SKD = mixc(SK, '#1a1028', .35);
      // Legs and loincloth.
      for (const x of [70, 122]) cel(g, () => { g.beginPath(); g.moveTo(x - 4, 170); g.lineTo(x + 18, 170); g.lineTo(x + 20, 230); g.lineTo(x - 8, 232); g.closePath(); }, SKD, 3);
      cel(g, () => { g.beginPath(); g.moveTo(58, 150); g.lineTo(146, 150); g.lineTo(140, 196); g.lineTo(102, 188); g.lineTo(64, 196); g.closePath(); }, '#2e2434', 3);
      g.strokeStyle = '#c8a050'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(70 + i * 20, 156); g.lineTo(76 + i * 20, 186); g.stroke(); }
      // Huge hunched torso.
      cel(g, () => { g.beginPath(); g.moveTo(52, 152); g.quadraticCurveTo(28, 110, 46, 70); g.quadraticCurveTo(100, 44, 158, 70); g.quadraticCurveTo(178, 112, 150, 152); g.closePath(); }, SK, 3.2);
      g.fillStyle = SKD; g.beginPath(); g.moveTo(120, 64); g.quadraticCurveTo(176, 110, 150, 152); g.lineTo(120, 152); g.closePath(); g.fill();
      g.strokeStyle = mixc(SK, '#1a1028', .55); g.lineWidth = 2;
      g.beginPath(); g.moveTo(100, 84); g.lineTo(100, 140); g.moveTo(66, 96); g.quadraticCurveTo(84, 108, 98, 98); g.moveTo(134, 96); g.quadraticCurveTo(118, 108, 102, 98); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(76, 92, 18, 10, -.4, 0, TAU); g.fill();
      // Hanging left arm with claws.
      cel(g, () => { g.beginPath(); g.moveTo(46, 76); g.quadraticCurveTo(14, 110, 22, 170); g.lineTo(42, 172); g.quadraticCurveTo(40, 120, 62, 96); g.closePath(); }, SK, 3);
      g.fillStyle = '#efe6d0'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(22 + i * 7, 170); g.lineTo(24 + i * 7, 182); g.lineTo(28 + i * 7, 170); g.fill(); }
      // Wild white mane.
      cel(g, () => { g.beginPath(); g.moveTo(64, 60); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.05 + i * .1125), r = i % 2 ? 46 : 60; g.lineTo(100 + Math.cos(a) * r, 52 + Math.sin(a) * r * .8); } g.lineTo(140, 62); g.quadraticCurveTo(150, 100, 136, 118); g.lineTo(64, 118); g.quadraticCurveTo(50, 100, 64, 60); g.closePath(); }, HR, 3);
      g.fillStyle = 'rgba(120,110,140,.3)'; g.fillRect(100, 10, 60, 110);
      // Face, blindfold, fangs, horns.
      cel(g, () => { g.beginPath(); g.ellipse(100, 70, 30, 30, 0, 0, TAU); }, SK, 3);
      g.fillStyle = SKD; g.beginPath(); g.ellipse(112, 76, 20, 24, 0, 0, TAU); g.fill();
      cel(g, () => { g.beginPath(); g.moveTo(68, 56); g.quadraticCurveTo(100, 50, 132, 56); g.lineTo(132, 68); g.quadraticCurveTo(100, 62, 68, 68); g.closePath(); }, '#efe8d6', 2.4);
      g.strokeStyle = 'rgba(120,100,80,.6)'; g.lineWidth = 1; for (let x = 74; x < 130; x += 7) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 3, 67); g.stroke(); }
      cel(g, () => { g.beginPath(); g.moveTo(80, 80); g.quadraticCurveTo(100, 76, 120, 80); g.quadraticCurveTo(116, 98, 100, 99); g.quadraticCurveTo(84, 98, 80, 80); g.closePath(); }, '#3a0a14', 2.2);
      g.fillStyle = '#f6efdc';
      for (const x of [84, 111]) { g.beginPath(); g.moveTo(x, 81); g.lineTo(x + 3, 92); g.lineTo(x + 6, 81); g.fill(); }
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(88 + i * 6, 97); g.lineTo(91 + i * 6, 90); g.lineTo(94 + i * 6, 97); g.fill(); }
      const hn = v === 1 ? [0] : [-1, 1];
      for (const s of hn) cel(g, () => { g.beginPath(); g.moveTo(100 + s * 14 - 6, 46); g.quadraticCurveTo(100 + s * 22, 22, 100 + s * 18 + (s ? 0 : 2), 6); g.quadraticCurveTo(100 + s * 28 + 4, 26, 100 + s * 14 + 6, 46); g.closePath(); }, HN, 2.4);
    });
  }
  function clubImg() {
    // Kanabō: studded iron club. Grip at (20, 150), head along -y.
    return Kit().sprite('snd:club', 40, 160, g => {
      cel(g, () => { g.beginPath(); g.rect(16, 100, 8, 56); }, '#4a3020', 2.4);
      cel(g, () => { g.beginPath(); g.moveTo(10, 104); g.lineTo(6, 14); g.quadraticCurveTo(20, 2, 34, 14); g.lineTo(30, 104); g.closePath(); }, '#4c4a58', 3);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(11, 16, 5, 86);
      g.fillStyle = '#d8d4e0';
      for (let y = 22; y < 100; y += 14) for (const x of [9, 20, 31]) { g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x, y - 4); g.lineTo(x + 3, y + 3); g.fill(); }
    });
  }
  // Kyodaigumo: Kidōmaru's giant summoned spider (3/4 top view, facing +x). Body centre at (120, 100).
  function spiderImg() {
    return Kit().sprite('snd:spider', 240, 170, g => {
      const B = '#3a2a24', BD = '#21160f', M = '#d89a2a';
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        const ax = 112 + i * 14, ay = 100, kx = ax + (i - 1.5) * 22, ky = ay + s * 42 - 26, fx = kx + (i - 1.5) * 26, fy = ay + s * 62 + 4;
        g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 11; g.beginPath(); g.moveTo(ax, ay); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
        g.strokeStyle = s > 0 ? B : BD; g.lineWidth = 7; g.beginPath(); g.moveTo(ax, ay); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
        g.strokeStyle = M; g.lineWidth = 2; g.beginPath(); g.moveTo(kx - 3, ky - 2); g.lineTo(kx + 3, ky + 2); g.stroke();
      }
      cel(g, () => { g.beginPath(); g.ellipse(70, 92, 58, 46, -.1, 0, TAU); }, B, 3.4);
      g.fillStyle = BD; g.beginPath(); g.ellipse(76, 104, 50, 32, -.1, 0, TAU); g.fill();
      g.fillStyle = M;
      for (const [x, y, r] of [[58, 76, 10], [82, 72, 8], [46, 98, 7], [70, 96, 9], [92, 92, 6]]) { g.beginPath(); g.ellipse(x, y, r, r * .7, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(56, 70, 22, 10, -.3, 0, TAU); g.fill();
      cel(g, () => { g.beginPath(); g.ellipse(150, 98, 34, 26, 0, 0, TAU); }, B, 3);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(146, 88, 16, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff3a2a'; for (const [x, y, r] of [[172, 90, 4], [178, 98, 3.4], [168, 100, 3], [176, 84, 2.6]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.fillStyle = '#ffd0c0'; g.beginPath(); g.arc(171, 89, 1.3, 0, TAU); g.fill();
      for (const s of [-1, 1]) cel(g, () => { g.beginPath(); g.moveTo(178, 104 + s * 6); g.quadraticCurveTo(194, 108 + s * 8, 188, 120 + s * 2); g.lineTo(184, 110 + s * 5); g.closePath(); }, '#1a120c', 2);
    });
  }
  function lingImg() {
    return Kit().sprite('snd:ling', 30, 24, g => {
      g.strokeStyle = '#1a120c'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(14 + i * 2, 12); g.lineTo(10 + i * 4, 12 + s * 7); g.lineTo(6 + i * 6, 12 + s * 11); g.stroke(); }
      cel(g, () => { g.beginPath(); g.ellipse(11, 12, 7, 5.5, 0, 0, TAU); }, '#3a2a24', 1.6);
      cel(g, () => { g.beginPath(); g.ellipse(20, 12, 4.4, 3.6, 0, 0, TAU); }, '#2a1c16', 1.6);
      g.fillStyle = '#d89a2a'; g.fillRect(8, 10, 5, 2.4); g.fillStyle = '#ff4030'; g.fillRect(22, 10.6, 1.8, 1.6);
    });
  }
  // Web: 16 spokes + spiral, dark under-stroke so it reads on sand and grass.
  function webImg() {
    return Kit().sprite('snd:web', 256, 256, g => {
      g.translate(128, 128);
      const N = 16, spiral = [];
      for (let r = 14; r < 124; r += 9) spiral.push(r);
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? 'rgba(255,252,240,.95)' : 'rgba(40,30,20,.55)'; g.lineWidth = pass ? 1.6 : 4;
        g.beginPath();
        for (let i = 0; i < N; i++) { const a = i * TAU / N; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 126, Math.sin(a) * 126); }
        for (const r of spiral) for (let i = 0; i < N; i++) {
          const a0 = i * TAU / N, a1 = (i + 1) * TAU / N, r0 = r + (i % 2) * 2, sag = .86;
          g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
          g.quadraticCurveTo(Math.cos((a0 + a1) / 2) * r * sag, Math.sin((a0 + a1) / 2) * r * sag, Math.cos(a1) * (r + ((i + 1) % 2) * 2), Math.sin(a1) * (r + ((i + 1) % 2) * 2));
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(255,220,120,.9)';
      for (let i = 0; i < 40; i++) { const a = hash(i) * TAU, r = 20 + hash(i * 3.3) * 100; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, TAU); g.fill(); }
    });
  }
  // Music notes: dark outline, coloured fill (k picks the glyph).
  const NOTE_GLYPHS = ['♪', '♫', '♬', '♩'];
  function noteImg(k, col) {
    return Kit().sprite('snd:note' + k + col, 40, 40, g => {
      g.font = 'bold 30px "Segoe UI Symbol","Arial Unicode MS",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = 'rgba(30,8,30,.9)'; g.lineJoin = 'round'; g.strokeText(NOTE_GLYPHS[k], 20, 21);
      g.fillStyle = col; g.fillText(NOTE_GLYPHS[k], 20, 21);
    });
  }
  function rockImg(v) {
    return Kit().sprite('snd:rock' + v, 70, 60, g => {
      const pts = []; for (let i = 0; i < 9; i++) { const a = i * TAU / 9, r = 24 + hash(i + v * 9) * 9; pts.push([35 + Math.cos(a) * r * 1.1, 32 + Math.sin(a) * r * .85]); }
      cel(g, () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.closePath(); }, ['#8a7058', '#7a6a5a', '#94785a'][v], 2.6);
      g.fillStyle = 'rgba(40,24,14,.35)'; g.beginPath(); g.ellipse(42, 40, 22, 14, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,210,.3)'; g.beginPath(); g.ellipse(28, 22, 12, 6, -.4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,24,14,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(24, 34); g.lineTo(36, 30); g.lineTo(44, 38); g.stroke();
    });
  }
  // Earth slab ripped out of the ground: rock below, a strip of grass and soil on top.
  function slabImg() {
    return Kit().sprite('snd:slab', 170, 110, g => {
      cel(g, () => { g.beginPath(); g.moveTo(10, 30); g.lineTo(160, 22); g.lineTo(152, 70); g.lineTo(120, 98); g.lineTo(52, 104); g.lineTo(16, 74); g.closePath(); }, '#8a6e54', 3);
      g.fillStyle = 'rgba(40,22,12,.35)'; g.beginPath(); g.moveTo(16, 60); g.lineTo(156, 50); g.lineTo(120, 98); g.lineTo(52, 104); g.closePath(); g.fill();
      cel(g, () => { g.beginPath(); g.moveTo(8, 30); g.quadraticCurveTo(80, 10, 162, 22); g.lineTo(160, 34); g.quadraticCurveTo(80, 26, 10, 42); g.closePath(); }, '#7aa04a', 2.4);
      g.strokeStyle = 'rgba(40,22,12,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 50); g.lineTo(70, 64); g.lineTo(64, 84); g.moveTo(110, 46); g.lineTo(100, 70); g.lineTo(122, 82); g.stroke();
    });
  }
  function rockSpikeImg(v) {
    return Kit().sprite('snd:rspike' + v, 50, 90, g => {
      const bend = (v - 1) * 6;
      cel(g, () => { g.beginPath(); g.moveTo(6, 88); g.lineTo(22 + bend, 6); g.lineTo(30 + bend, 18); g.lineTo(44, 88); g.closePath(); }, '#8e7258', 2.6);
      g.fillStyle = 'rgba(40,22,12,.35)'; g.beginPath(); g.moveTo(26 + bend, 12); g.lineTo(44, 88); g.lineTo(26, 88); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,210,.35)'; g.beginPath(); g.moveTo(10, 84); g.lineTo(22 + bend, 10); g.lineTo(18 + bend, 40); g.closePath(); g.fill();
    });
  }
  function fistImg() {
    return Kit().sprite('snd:fist', 34, 28, g => {
      cel(g, () => { g.beginPath(); g.rect(2, 8, 14, 12); }, '#cbb690', 2);
      cel(g, () => { g.beginPath(); g.ellipse(22, 14, 10, 9, 0, 0, TAU); }, '#f0d8c8', 2.2);
      g.strokeStyle = 'rgba(120,70,60,.7)'; g.lineWidth = 1.2; for (const y of [9, 13, 17]) { g.beginPath(); g.moveTo(26, y); g.lineTo(31, y + .5); g.stroke(); }
    });
  }
  function kunaiImg() {
    return Kit().sprite('snd:kunai', 46, 14, g => {
      cel(g, () => { g.beginPath(); g.moveTo(16, 2); g.lineTo(44, 7); g.lineTo(16, 12); g.closePath(); }, '#ffd04a', 1.8);
      g.fillStyle = '#fff2b0'; g.fillRect(17, 4, 22, 2);
      g.fillStyle = '#c89020'; g.fillRect(4, 5.5, 13, 3); g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(4, 7, 3, 0, TAU); g.stroke();
    });
  }
  // Golden arrow of the Spider War Bow: drill head with spiral grooves. Tip at +x.
  function arrowImg() {
    return Kit().sprite('snd:arrow', 300, 60, g => {
      cel(g, () => { g.beginPath(); g.rect(10, 26, 200, 8); }, '#e0a820', 2.4);
      g.fillStyle = '#fff0a0'; g.fillRect(12, 27, 196, 2);
      for (const s of [-1, 1]) cel(g, () => { g.beginPath(); g.moveTo(12, 30); g.lineTo(2, 30 + s * 22); g.lineTo(46, 30 + s * 6); g.closePath(); }, '#f0c040', 2);
      cel(g, () => { g.beginPath(); g.moveTo(196, 14); g.lineTo(296, 30); g.lineTo(196, 46); g.quadraticCurveTo(188, 30, 196, 14); g.closePath(); }, '#ffcc30', 2.6);
      g.strokeStyle = '#9a6a10'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const x = 202 + i * 15; g.beginPath(); g.moveTo(x, 16 + i * 2.4); g.quadraticCurveTo(x + 10, 30, x + 4, 44 - i * 2.4); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(200, 18); g.lineTo(290, 29); g.lineTo(200, 24); g.closePath(); g.fill();
    });
  }
  function mixc(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }
  const CURSE_PAL = [[1, '#0a0410'], [.84, '#22082a'], [.66, '#3c0e44'], [.46, '#5a1a5a'], [.25, '#7a2a6a']];

  // ================================================================== telegraph painters
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .82, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.ellipse(x, y, r * clamp01(k), r * .82 * clamp01(k), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.42)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .82, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3; ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14) * .82); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12) * .82);
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
      ctx.strokeStyle = 'rgba(30,20,30,.42)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.42)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }

  // ================================================================== shared VFX pieces
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .55) {
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
    if (t > .1) K.fx.shockRing(ctx, x, y, r * 1.35, (t - .1) * 1.2, Math.max(0, .8 - t), '255,240,240');
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, x, y, r, t, seed, 14);
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.1, t / 1.1, seed, '#3a2c22', 14);
  }
  function scorchG(ctx, x, y, r, alpha, seed, col = '30,18,14') {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(${col},${.3 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .8, r * .4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${.7 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .45, y + Math.sin(a) * r * .22);
      ctx.lineTo(x + Math.cos(b) * r * .85, y + Math.sin(b) * r * .43);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * .58);
    }
    ctx.stroke();
  }
  function crescent(ctx, cx, cy, R, w, a0, a1, sq) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u, prof = Math.pow(Math.sin(Math.PI * Math.pow(u, .7)), .8) * (.35 + .65 * u);
      ctx.lineTo(cx + Math.cos(an) * (R - w * prof), cy + Math.sin(an) * (R - w * prof) * sq);
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
    if (a <= 0) return;
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .5, d = r * (.15 + e * (.5 + hash(i * 2.1 + seed) * .3));
      K.stamp(ctx, pf, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - r * .25 - e * r * .2 * hash(i * 3 + seed), r * (.22 + e * .2), a * .9);
    }
    K.stamp(ctx, pf, x, y - r * .35, r * (.35 + e * .25), a);
  }
  // Tall standing object visible in this layer? (behind the fighter in draw, in front of him in drawOverlay)
  const inLayer = (st, y, layer) => layer ? y >= st.refY : y < st.refY;

  // ================================================================== effect painters [ground, overlay]
  function drawSpires(ctx, fx, st, layer) {
    const K = Kit(), dust = K.puff('dust');
    for (const s of fx.list) {
      const [x, y, h, t0, v] = s, t = fx.age - t0;
      if (t < 0 || !inLayer(st, y, layer)) continue;
      const grow = easeOut(t / .16), sink = win(fx.age, fx.dur - .7, fx.dur), H = h * grow * (1 - sink * .85), W = h * .36;
      if (H < 2) continue;
      ctx.globalAlpha = 1 - sink * .6;
      ctx.drawImage(spireImg(v), x - W * .5, y - H + 4, W, H);
      ctx.globalAlpha = 1;
      if (t < .5) K.stamp(ctx, dust, x, y - 6, W * (.5 + t), (1 - t * 2) * .8, .6);
    }
  }
  function ogreDraw(ctx, o, k, time, slamT, age) {
    const img = ogreImg(o.v), W = 190, H = 228, bob = Math.sin(time * 3 + o.v * 2) * 2;
    // club swing: raised before each slam, smashed down on it
    let rot = -.35;
    for (const s of slamT) {
      const d = age - s;
      if (d > -.55 && d < 0) rot = -.35 - 1.7 * easeOut((d + .55) / .55);
      else if (d >= 0 && d < .5) rot = -2.05 + 3.3 * easeOut(d / .1) - (d > .15 ? .4 * win(d, .15, .5) : 0);
    }
    ctx.save(); ctx.translate(o.x, o.y + 4 + bob * .3); ctx.scale(o.f * k, k);
    ctx.drawImage(img, -W / 2, -H + 6, W, H);
    // arm + club pivot at the right shoulder
    ctx.save(); ctx.translate(48, -H * .66); ctx.rotate(rot);
    ctx.drawImage(clubImg(), -20, -150, 40, 160);
    ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -2); ctx.stroke();
    ctx.strokeStyle = DOKI[o.v][0]; ctx.lineWidth = 14; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function gateDraw(ctx, fx, time) {
    const K = Kit(), rise = easeOut(fx.age / .32), fall = win(fx.age, fx.dur - .7, fx.dur), s = fx.s;
    const W = 300 * s, H = 280 * s * rise, sink = fall * H * .6;
    if (H < 3) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(fx.x - W, fx.y - 600, W * 2, 600 + 8); ctx.clip();
    ctx.globalAlpha = 1 - fall * .7;
    ctx.drawImage(gateImg(), fx.x - W / 2, fx.y - H + sink + 6 * s, W, 280 * s);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Purple chakra flaring up the gate's face while it stands.
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - H * .55 + sink, W * .55, '170,80,255', .18 + .1 * Math.sin(time * 5), false, 1.1);
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age < .7 || fall > 0) {
      const dust = K.puff('dust'), t = fall > 0 ? fall : fx.age / .7;
      for (let i = 0; i < 9; i++) K.stamp(ctx, dust, fx.x + (i / 8 - .5) * W * 1.1, fx.y - 8 - hash(i + fx.seed) * 20 - t * 30, 26 * s + t * 20, (1 - t) * .85, .7);
    }
  }
  function ukonDraw(ctx, fx, time) {
    const S = Spr(), K = Kit();
    const latched = fx.mode === 1, a = Math.min(1, fx.age * 4) * (1 - win(fx.age, fx.dur - .3, fx.dur));
    const sc = latched ? .62 + .05 * Math.sin(time * 8) : .92;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y - 40, latched ? 70 : 54, '170,90,255', .45 * a);
    ctx.globalCompositeOperation = 'source-over';
    if (S) S.draw(ctx, 'sakon', fx.x, fx.y + 2, { facing: fx.fc || 1, frame: fx.mode === 0 ? 'attack' : latched ? 'seal' : 'run', phase: time * 3, scale: sc, alpha: (latched ? .6 : .82) * a });
    if (latched) {
      // Parasite tendrils sinking into the host.
      ctx.strokeStyle = `rgba(60,10,80,${.7 * a})`; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const an = i * TAU / 7 + time * 1.4, r = 26 + Math.sin(time * 6 + i) * 6;
        ctx.moveTo(fx.x, fx.y - 34); ctx.quadraticCurveTo(fx.x + Math.cos(an) * r * 1.4, fx.y - 34 + Math.sin(an) * r * .6, fx.x + Math.cos(an + .6) * r, fx.y - 10 + Math.sin(an + .6) * r * .5);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(220,150,255,${.6 * a})`; ctx.lineWidth = 1.2; ctx.stroke();
    } else speedLines(ctx, fx.x - (fx.fc || 1) * 120, fx.y, fx.x, fx.y, 18, .6 * a, fx.seed, '210,170,255', 36);
  }
  function webDraw(ctx, fx, time) {
    const K = Kit(), a = Math.min(1, fx.age * 5) * (1 - win(fx.age, fx.dur - .5, fx.dur)), r = fx.r;
    ctx.globalAlpha = a * .92;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.seed); ctx.scale(1, .5);
    ctx.drawImage(webImg(), -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, r * .9, '255,220,140', .12 * a + .04 * Math.sin(time * 4), false, .5);
    ctx.globalCompositeOperation = 'source-over';
    // Strands still stretched up to where the glob hit (sticky drips).
    ctx.strokeStyle = `rgba(250,245,230,${.55 * a})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const an = hash(i + fx.seed) * TAU, d = r * .5 * hash(i * 2 + fx.seed); ctx.moveTo(fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5); ctx.lineTo(fx.x + Math.cos(an) * d * .6, fx.y + Math.sin(an) * d * .3 - 30 - 20 * hash(i * 5 + fx.seed)); }
    ctx.stroke();
  }
  function spiritsDraw(ctx, fx, time) {
    const K = Kit();
    ctx.lineCap = 'round';
    for (const s of fx.list) {
      if (fx.age < s[5]) continue;
      if (!s[4]) {
        const t = fx.age - s[6]; if (t > .5) continue;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s[0], s[1], 40 + t * 80, '220,200,255', (1 - t * 2) * .7, true); ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      const sp = Math.hypot(s[2], s[3]) || 1, ux = s[2] / sp, uy = s[3] / sp, fade = 1 - win(fx.age, fx.dur - .4, fx.dur);
      // Wriggling ghost worm: dark under-stroke, pale body, a gaping mouth at the head.
      const pts = [];
      for (let i = 0; i < 6; i++) { const w = Math.sin(time * 14 + i * 1.2 + s[5] * 20) * 5 * (i / 5); pts.push([s[0] - ux * i * 9 - uy * w, s[1] - uy * i * 9 + ux * w]); }
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? `rgba(240,236,255,${.95 * fade})` : `rgba(40,20,60,${.55 * fade})`; ctx.lineWidth = pass ? 7 : 11;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      ctx.fillStyle = `rgba(50,10,40,${fade})`; ctx.beginPath(); ctx.arc(s[0] + ux * 3, s[1] + uy * 3, 3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s[0], s[1], 22, '200,170,255', .5 * fade); ctx.globalCompositeOperation = 'source-over';
    }
  }

  const FX = {
    impact: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, fx.r, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed),
      (ctx, fx) => impactO(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed, fx.rgb || '255,220,180')
    ],
    mark: [(ctx, fx, time) => markCircle(ctx, fx.x, fx.y, fx.r, fx.rgb, clamp01(fx.age / fx.dur), time, false), null],
    lineMark: [(ctx, fx, time) => teleShape(ctx, { k: 'line', x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: fx.w }, fx.rgb, clamp01(fx.age / fx.dur), time), null],
    poof: [null, (ctx, fx) => smokePoof(ctx, fx.x, fx.y, fx.r, fx.age, fx.seed)],
    dash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust');
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(40,24,18,${.28 * a})`; ctx.lineWidth = 22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        for (let d = 0; d < len; d += 50) {
          const t = d / len, j = hash(d * .1 + fx.seed);
          K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 16 + j * 14, a * .6, .75);
        }
      },
      (ctx, fx, time, z) => {
        const S = Spr(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), fac = Math.cos(fx.a) >= 0 ? 1 : -1;
        for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const k = i / fx.pts.length;
          if (S) S.draw(ctx, z.bossId, fx.pts[i], fx.pts[i + 1] + 3, { facing: fac, frame: 'attack', alpha: (.12 + k * .3) * a });
        }
        speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 40, a, fx.seed, fx.rgb);
      }
    ],
    // ---------------------------------------------------------------- Kimimaro
    slash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .2, fx.dur);
        ctx.strokeStyle = `rgba(40,22,18,${.4 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const o = (i - 1) * 16; ctx.moveTo(fx.x + Math.cos(fx.a + 1.4) * o - Math.cos(fx.a) * fx.r * .5, fx.y + Math.sin(fx.a + 1.4) * o * .5); ctx.lineTo(fx.x + Math.cos(fx.a) * fx.r * .7 + Math.cos(fx.a + 1.4) * o, fx.y + Math.sin(fx.a) * fx.r * .35 + Math.sin(fx.a + 1.4) * o * .5); }
        ctx.stroke();
      },
      (ctx, fx) => {
        const K = Kit(), t = fx.age / fx.dur, sw = easeOut(t / .35), a = 1 - win(t, .4, 1), dir = fx.flip ? -1 : 1;
        const cx = fx.x, cy = fx.y - 30, a0 = fx.a - dir * 1.5, a1 = a0 + dir * 3 * sw;
        ctx.fillStyle = `rgba(30,20,20,${.45 * a})`; crescent(ctx, cx + 2, cy + 3, fx.r, 26, a0, a1, .55); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,250,235,${.95 * a})`; crescent(ctx, cx, cy, fx.r, 22, a0, a1, .55); ctx.fill();
        ctx.fillStyle = `rgba(220,210,180,${.5 * a})`; crescent(ctx, cx, cy, fx.r * .85, 14, a0, a1, .55); ctx.fill();
        K.glow(ctx, cx + Math.cos(a1) * fx.r, cy + Math.sin(a1) * fx.r * .55, 40, '255,245,220', .6 * a, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    bullets: [null, (ctx, fx) => {
      const K = Kit(), img = bulletImg(), dd = fx.age * fx.speed, a = 1 - win(dd, fx.range - 120, fx.range);
      if (a <= 0) return;
      for (const b of fx.list) {
        const c = Math.cos(b[2]), s = Math.sin(b[2]), x = b[0] + c * dd, y = b[1] + s * dd - 30;
        ctx.strokeStyle = `rgba(40,30,20,${.4 * a})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - c * 150, y - s * 150); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,235,${.85 * a})`; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(b[2]); ctx.globalAlpha = a; ctx.drawImage(img, -54, -12, 72, 24); ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 16, '255,245,220', .45 * a); ctx.globalCompositeOperation = 'source-over';
      }
    }],
    bodyspikes: [
      (ctx, fx) => scorchG(ctx, fx.x, fx.y, 200, 1 - win(fx.age, fx.dur - .4, fx.dur), fx.seed, '60,50,40'),
      (ctx, fx) => {
        // Karamatsu: bones bursting outward from every part of his body.
        const g = easeOut(fx.age / .12), back = win(fx.age, fx.dur - .45, fx.dur), k = g * (1 - back);
        if (k <= .01) return;
        const cy = fx.y - 34;
        for (let i = 0; i < fx.sp.length; i++) {
          const [an, len, el] = fx.sp[i], L = len * k, ex = Math.cos(an) * L, ey = Math.sin(an) * L * .55 + el * L * .6;
          ctx.save(); ctx.translate(fx.x + Math.cos(an) * 8, cy + Math.sin(an) * 12); ctx.rotate(Math.atan2(ey, ex));
          const w = 7;
          ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(L * .5, -w * 1.1, Math.hypot(ex, ey), 0); ctx.quadraticCurveTo(L * .5, w * .8, 0, w); ctx.closePath();
          ctx.fillStyle = BONE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.fillStyle = BONE_D; ctx.fillRect(2, w * .1, Math.hypot(ex, ey) * .7, w * .7);
          ctx.restore();
        }
        if (fx.age < .5) impactO(ctx, fx.x, fx.y, 230, fx.age, fx.seed, '250,244,228');
      }
    ],
    forest: [
      (ctx, fx, time, z, st) => {
        // ground cracks where every spire erupted, then the spires standing behind the fighter
        const a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        ctx.fillStyle = `rgba(40,30,22,${.32 * a})`;
        for (const s of fx.list) if (fx.age > s[3]) { ctx.beginPath(); ctx.ellipse(s[0], s[1] + 2, s[2] * .24, s[2] * .09, 0, 0, TAU); ctx.fill(); }
        if (fx.big && fx.age < 1.3) {
          const K = Kit(); ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, z.x, z.y, 700 * easeOut(fx.age / 1.2), '255,246,225', .2 * (1 - fx.age / 1.3), false, .5);
          ctx.globalCompositeOperation = 'source-over';
        }
        drawSpires(ctx, fx, st, 0);
      },
      (ctx, fx, time, z, st) => drawSpires(ctx, fx, st, 1)
    ],
    whirl: [
      (ctx, fx, time, z) => dustRing(ctx, z.x, z.y, 200, (fx.age % .5) * 2, fx.seed, 10, 'dust', .5),
      (ctx, fx, time, z) => {
        const a = 1 - win(fx.age, fx.dur - .25, fx.dur), sp = fx.age * 22;
        for (let k = 0; k < 4; k++) {
          const a0 = sp + k * Math.PI / 2;
          ctx.fillStyle = `rgba(30,20,20,${.4 * a})`; crescent(ctx, z.x + 2, z.y - 30, 150, 18, a0, a0 + 1.3, .5); ctx.fill();
          ctx.fillStyle = `rgba(255,250,235,${.9 * a})`; crescent(ctx, z.x, z.y - 33, 150, 14, a0, a0 + 1.3, .5); ctx.fill();
        }
        // bone blades jutting from both forearms while he spins
        for (const s of [-1, 1]) { const an = sp * .5 + (s > 0 ? 0 : Math.PI); ctx.save(); ctx.translate(z.x + Math.cos(an) * 18, z.y - 38 + Math.sin(an) * 8); ctx.rotate(an); ctx.globalAlpha = a; ctx.drawImage(bulletImg(), 0, -6, 70, 12); ctx.restore(); }
        ctx.globalAlpha = 1;
      }
    ],
    whip: [
      (ctx, fx) => { const a = 1 - win(fx.age, .3, fx.dur); ctx.fillStyle = `rgba(40,30,20,${.18 * a})`; sector(ctx, fx.x, fx.y, 60, fx.r, fx.a - 1, fx.a + 1); ctx.fill(); },
      (ctx, fx) => {
        // Tessenka: the spine pulled out of his back as a bone whip, sweeping the arc.
        const K = Kit(), t = fx.age / fx.dur, sw = easeOut(t / .3), a = 1 - win(t, .6, 1), img = vertebraImg();
        const an = fx.a - 1 + 2 * sw, n = 16, ox = fx.x, oy = fx.y - 40;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,248,230,${.12 * a})`; sector(ctx, ox, oy + 20, 90, fx.r, fx.a - 1, an); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(40,30,20,${.4 * a})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(ox, oy + 20, fx.r * .96, fx.r * .96 * .55, 0, Math.max(fx.a - 1, an - .9), an); ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,235,${.9 * a})`; ctx.lineWidth = 4; ctx.stroke();
        const pts = [];
        for (let i = 0; i <= 22; i++) {
          const u = i / 22, lag = an - (1 - u) * .5 * (1 - t) - Math.sin(u * 3 + t * 6) * .08, d = fx.r * u;
          pts.push([ox + Math.cos(lag) * d, oy + Math.sin(lag) * d * .55 + u * 24, lag]);
        }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(210,200,175,${a})` : `rgba(40,30,20,${.7 * a})`; ctx.lineWidth = pass ? 6 : 11;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
        ctx.globalAlpha = a;
        for (let i = 1; i < pts.length; i++) {
          const [x, y, lag] = pts[i], s = 1.6 - i / 22 * .8;
          ctx.save(); ctx.translate(x, y); ctx.rotate(lag); ctx.drawImage(img, -15 * s, -12 * s, 30 * s, 24 * s); ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ox + Math.cos(an) * fx.r, oy + Math.sin(an) * fx.r * .55 + 24, 50, '255,245,220', .6 * a, true); ctx.globalCompositeOperation = 'source-over';
      }
    ],
    drill: [null, (ctx, fx, time, z) => {
      // Tessenka no Hana: a spiralled bone drill sheathing his arm.
      const a = 1 - win(fx.age, fx.dur - .2, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a), x = z.x + c * 22, y = z.y - 34 + s * 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s * .6, c)); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(96, 0); ctx.lineTo(0, 14); ctx.closePath();
      ctx.fillStyle = BONE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = BONE_DD; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const d = ((i * 16 + time * 400) % 96); ctx.beginPath(); ctx.moveTo(d, -14 * (1 - d / 96)); ctx.lineTo(d + 10, 14 * (1 - (d + 10) / 96)); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, x + c * 90, y + s * 40, 40, '255,245,220', .5 * a, true); ctx.globalCompositeOperation = 'source-over';
    }],
    // ---------------------------------------------------------------- Sakon
    fists: [null, (ctx, fx, time) => {
      // Tarenken: a storm of fists (Ukon's arms bursting out of Sakon's body).
      const K = Kit(), img = fistImg(), a = 1 - win(fx.age, fx.dur - .25, fx.dur), N = fx.down ? 14 : 20;
      for (let i = 0; i < N; i++) {
        const ph = (fx.age * 4.2 + hash(i + fx.seed)) % 1, sp = (hash(i * 3.7 + fx.seed) - .5) * (fx.down ? TAU : 1.3);
        const an = fx.a + sp, d = 20 + easeOut(ph) * (fx.down ? 150 : 140), x = fx.x + Math.cos(an) * d, y = fx.y - (fx.down ? 10 : 34) + Math.sin(an) * d * (fx.down ? .5 : .6);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.sin(an) * .6, Math.cos(an))); ctx.globalAlpha = a * (1 - ph * .6);
        ctx.drawImage(img, -28, -12, 34, 28); ctx.restore();
        if (ph > .7) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 22, '220,180,255', .5 * a); ctx.globalCompositeOperation = 'source-over'; }
      }
      ctx.globalAlpha = 1;
      speedLines(ctx, fx.x, fx.y, fx.x + Math.cos(fx.a) * 180, fx.y + Math.sin(fx.a) * 180, 40, .5 * a, fx.seed, '230,200,255', 34);
    }],
    gate: [
      (ctx, fx, time, z, st) => {
        scorchG(ctx, fx.x, fx.y, 160 * fx.s, 1 - win(fx.age, fx.dur - .6, fx.dur), fx.seed, '50,20,50');
        if (inLayer(st, fx.y, 0)) gateDraw(ctx, fx, time);
      },
      (ctx, fx, time, z, st) => { if (inLayer(st, fx.y, 1)) gateDraw(ctx, fx, time); }
    ],
    ukon: [null, (ctx, fx, time) => ukonDraw(ctx, fx, time)],
    twin: [null, (ctx, fx, time) => {
      // Ukon split off: his afterimage dash crossing Sakon's.
      const S = Spr(), t = clamp01(fx.age / .16), a = 1 - win(fx.age, .2, fx.dur), x = fx.x0 + (fx.x1 - fx.x0) * t, y = fx.y0 + (fx.y1 - fx.y0) * t, f = fx.x1 >= fx.x0 ? 1 : -1;
      for (let i = 0; i < 4; i++) { const u = Math.max(0, t - i * .12); if (S) S.draw(ctx, 'sakon', fx.x0 + (fx.x1 - fx.x0) * u, fx.y0 + (fx.y1 - fx.y0) * u + 3, { facing: f, frame: 'attack', alpha: (i ? .22 : .85) * a }); }
      speedLines(ctx, fx.x0, fx.y0, x, y, 36, a, fx.seed, '255,150,220');
    }],
    // ---------------------------------------------------------------- Tayuya
    notes: [
      (ctx, fx) => { const a = 1 - win(fx.age, fx.dur - .5, fx.dur); ctx.fillStyle = `rgba(90,20,70,${.12 * a})`; sector(ctx, fx.x, fx.y, 30, fx.r * Math.min(1, fx.age * 2), fx.a - fx.h, fx.a + fx.h); ctx.fill(); },
      (ctx, fx, time) => {
        // Demon Flute: sound-wave arcs rolling out of the flute, notes riding them.
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), ox = fx.x + Math.cos(fx.a) * 20, oy = fx.y - 46;
        const K = Kit();
        for (let k = 0; k < 8; k++) {
          const ph = (fx.age * 1.5 + k / 8) % 1, R = 40 + ph * fx.r, al = Math.min(1, (1 - ph) * 1.4) * a;
          if (fx.age * 1.5 * fx.r < R - 40) continue;
          const sq = .62, cy = oy + ph * 36;
          for (let pass = 0; pass < 3; pass++) {
            ctx.strokeStyle = pass === 2 ? `rgba(255,240,250,${.8 * al})` : pass ? `rgba(255,110,180,${.9 * al})` : `rgba(50,10,40,${.45 * al})`;
            ctx.lineWidth = pass === 2 ? 1.4 : pass ? 5 : 10;
            ctx.beginPath(); ctx.ellipse(ox, cy, R, R * sq, 0, fx.a - fx.h, fx.a + fx.h); ctx.stroke();
          }
          for (let j = 0; j < 6; j++) {
            const an = fx.a + (hash(j + k * 5 + fx.seed) - .5) * 2 * fx.h * .9, img = noteImg((j + k) % 4, j % 2 ? '#ff7ab8' : '#ffe0f0');
            const x = ox + Math.cos(an) * R, y = cy + Math.sin(an) * R * sq - 8 - Math.sin(time * 8 + j) * 8, s = 26 + ph * 14;
            ctx.globalAlpha = al; ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
          }
          ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, ox, oy, 60, '255,110,190', .5 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    noteRing: [
      (ctx, fx, time) => {
        // Five staff lines closing in on the target, notes riding them.
        const t = clamp01(fx.age / 1.05), R = fx.r0 * (1 - easeIn(t)) + 18, a = 1 - win(fx.age, 1.05, fx.dur);
        for (let i = 0; i < 5; i++) {
          const r = R + i * 9;
          ctx.strokeStyle = `rgba(40,8,30,${.45 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * .55, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = `rgba(255,140,200,${.8 * a})`; ctx.lineWidth = 1.6; ctx.stroke();
        }
        for (let j = 0; j < 14; j++) {
          const an = j * TAU / 14 + time * 1.2, img = noteImg(j % 4, j % 2 ? '#ff7ab8' : '#ffe0f0'), r = R + (j % 5) * 9;
          ctx.globalAlpha = a; ctx.drawImage(img, fx.x + Math.cos(an) * r - 13, fx.y + Math.sin(an) * r * .55 - 20, 26, 26);
        }
        ctx.globalAlpha = 1;
      },
      null
    ],
    doki: [
      (ctx, fx, time, z, st) => {
        const k = easeOut(fx.age / .45) * (1 - win(fx.age, fx.dur - .5, fx.dur));
        for (const o of fx.og) {
          ctx.fillStyle = `rgba(20,10,30,${.3 * k})`; ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, 70 * k, 22 * k, 0, 0, TAU); ctx.fill();
          if (inLayer(st, o.y, 0)) ogreDraw(ctx, o, k, time, fx.slam, fx.age);
        }
      },
      (ctx, fx, time, z, st) => {
        const K = Kit(), k = easeOut(fx.age / .45) * (1 - win(fx.age, fx.dur - .5, fx.dur));
        for (const o of fx.og) {
          if (inLayer(st, o.y, 1)) ogreDraw(ctx, o, k, time, fx.slam, fx.age);
          if (fx.age < .7) smokePoof(ctx, o.x, o.y, 150, fx.age, fx.seed + o.v, 'violet');
          if (fx.age > fx.dur - .6) smokePoof(ctx, o.x, o.y, 150, fx.age - (fx.dur - .6), fx.seed + o.v);
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, o.x, o.y - 120, 90, '170,90,255', .18 * k); ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    spirits: [null, (ctx, fx, time) => spiritsDraw(ctx, fx, time)],
    fantasia: [
      (ctx, fx, time) => {
        // Chains of Fantasia: a violet field, staff lines spiralling in, note chains binding the victim.
        const K = Kit(), on = easeOut(fx.age / .4), off = win(fx.age, fx.T, fx.T + .6), a = on * (1 - off), R = fx.R;
        if (a <= 0) { if (fx.age > fx.T) impactO(ctx, fx.x, fx.y, 300, fx.age - fx.T, fx.seed, '230,90,200'); return; }
        ctx.fillStyle = `rgba(50,8,60,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R, R * .55, 0, 0, TAU); ctx.fill();
        ctx.lineCap = 'round';
        for (let l = 0; l < 5; l++) {
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const u = i / 60, an = u * TAU * 1.6 + time * .9 + l * .09, r = R * (1 - u * .9);
            ctx.lineTo(fx.x + Math.cos(an) * r, fx.y + Math.sin(an) * r * .55);
          }
          ctx.strokeStyle = `rgba(30,0,30,${.4 * a})`; ctx.lineWidth = 3.5; ctx.stroke();
          ctx.strokeStyle = `rgba(255,120,210,${.7 * a})`; ctx.lineWidth = 1.3; ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,140,220,${.8 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R, R * .55, 0, 0, TAU); ctx.stroke();
        // chains from the rim to the victim
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + fx.seed, sx = fx.x + Math.cos(an) * R, sy = fx.y + Math.sin(an) * R * .55, ex = fx.vx, ey = fx.vy - 26;
          const L = Math.hypot(ex - sx, ey - sy), n = Math.max(3, Math.floor(L / 22)), reach = easeOut((fx.age - .2 - i * .04) / .5);
          for (let j = 0; j < n * reach; j++) {
            const u = j / n, x = sx + (ex - sx) * u, y = sy + (ey - sy) * u - Math.sin(u * Math.PI) * 30;
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ey - sy, ex - sx) + (j % 2) * .0);
            ctx.strokeStyle = `rgba(30,0,30,${.7 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 9, j % 2 ? 2.5 : 5, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = `rgba(255,170,230,${.9 * a})`; ctx.lineWidth = 1.8; ctx.stroke();
            ctx.restore();
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, fx.vx, fx.vy - 30, 70, '255,100,200', .35 * a);
        ctx.globalCompositeOperation = 'source-over';
      },
      (ctx, fx, time) => {
        const K = Kit(), a = easeOut(fx.age / .4) * (1 - win(fx.age, fx.T, fx.T + .6));
        for (let j = 0; j < 16; j++) {
          const ph = (time * .35 + hash(j + fx.seed)) % 1, an = j * TAU / 16 + time * .5, r = fx.R * (.3 + hash(j * 3 + fx.seed) * .65);
          ctx.globalAlpha = a * bell(ph); ctx.drawImage(noteImg(j % 4, j % 3 ? '#ff7ab8' : '#ffd0ea'), fx.x + Math.cos(an) * r - 14, fx.y + Math.sin(an) * r * .55 - 30 - ph * 90, 28, 28);
        }
        ctx.globalAlpha = 1;
        // The three Doki rise as ghosts for the finale.
        if (fx.age > fx.T - 1 && fx.age < fx.T + .9) {
          const k = easeOut((fx.age - fx.T + 1) / .6) * (1 - win(fx.age, fx.T + .3, fx.T + .9));
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const an = fx.seed + i * TAU / 3, x = fx.x + Math.cos(an) * 170, y = fx.y + Math.sin(an) * 90;
            ctx.globalAlpha = .45 * k; ctx.drawImage(ogreImg(i), x - 100 * k, y - 230 * k, 200 * k, 240 * k);
          }
          ctx.globalAlpha = 1;
          K.glow(ctx, fx.x, fx.y - 60, 320 * k, '220,80,200', .3 * k, false, .7);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (fx.age > fx.T) impactO(ctx, fx.x, fx.y, 300, fx.age - fx.T, fx.seed, '230,90,200');
      }
    ],
    // ---------------------------------------------------------------- Kidōmaru
    glob: [
      (ctx, fx) => { const t = clamp01(fx.age / fx.T); ctx.fillStyle = 'rgba(20,14,10,.25)'; ctx.beginPath(); ctx.ellipse(fx.x0 + (fx.x1 - fx.x0) * t, fx.y0 + (fx.y1 - fx.y0) * t, 14, 6, 0, 0, TAU); ctx.fill(); },
      (ctx, fx) => {
        const t = clamp01(fx.age / fx.T), x = fx.x0 + (fx.x1 - fx.x0) * t, y = fx.y0 + (fx.y1 - fx.y0) * t - 40 - Math.sin(Math.PI * t) * 70;
        ctx.strokeStyle = 'rgba(40,30,20,.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0 - 40); ctx.quadraticCurveTo((fx.x0 + x) / 2, (fx.y0 + y) / 2 - 40, x, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,235,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = 'rgba(40,30,20,.6)'; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fbf6e6'; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,120,.9)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, TAU); ctx.fill();
      }
    ],
    web: [(ctx, fx, time) => webDraw(ctx, fx, time), null],
    drop: [null, (ctx, fx) => {
      // The great web falling from above onto the area.
      const t = clamp01(fx.age / fx.dur), r = fx.r * (1.5 - .5 * t), lift = (1 - t) * 260;
      ctx.globalAlpha = .4 + .5 * t;
      ctx.save(); ctx.translate(fx.x, fx.y - lift); ctx.rotate(fx.seed); ctx.scale(1, .5); ctx.drawImage(webImg(), -r, -r, r * 2, r * 2); ctx.restore();
      ctx.globalAlpha = 1;
    }],
    kunai: [null, (ctx, fx) => {
      const K = Kit(), img = kunaiImg(), dd = Math.min(fx.len, fx.age * fx.speed), a = 1 - win(fx.age, fx.dur - .3, fx.dur);
      for (const an of fx.as) {
        const c = Math.cos(an), s = Math.sin(an), x = fx.x + c * dd, y = fx.y + s * dd - 34;
        ctx.strokeStyle = `rgba(60,40,10,${.35 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx.x + c * 20, fx.y + s * 20 - 34); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,215,90,${.8 * a})`; ctx.lineWidth = 1.5; ctx.stroke();
        if (dd < fx.len) { ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.drawImage(img, -40, -7, 46, 14); ctx.restore(); }
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 18, '255,210,80', .5 * a); ctx.globalCompositeOperation = 'source-over';
      }
    }],
    spider: [
      (ctx, fx, time, z, st) => { if (inLayer(st, fx.y, 0)) spiderDraw(ctx, fx, time); },
      (ctx, fx, time, z, st) => { if (inLayer(st, fx.y, 1)) spiderDraw(ctx, fx, time); }
    ],
    lings: [(ctx, fx, time) => {
      const img = lingImg(), a = 1 - win(fx.age, fx.dur - .4, fx.dur);
      for (const b of fx.list) {
        if (!b[3] || fx.age < b[4]) continue;
        ctx.fillStyle = 'rgba(20,14,10,.3)'; ctx.beginPath(); ctx.ellipse(b[0], b[1] + 3, 12, 4, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(b[0], b[1] - 4 + Math.sin(time * 30 + b[4] * 40) * 1.2); ctx.rotate(b[2]); ctx.globalAlpha = a; ctx.drawImage(img, -15, -12, 30, 24); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }, null],
    arrow: [
      (ctx, fx) => {
        const T = fx.len / fx.speed, head = Math.min(fx.len, fx.age * fx.speed), a = 1 - win(fx.age, T + .2, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
        ctx.strokeStyle = `rgba(60,30,0,${.35 * a})`; ctx.lineWidth = 60; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0 + c * 40, fx.y0 + s * 40); ctx.lineTo(fx.x0 + c * head, fx.y0 + s * head); ctx.stroke();
      },
      (ctx, fx, time) => {
        // Terrible Split: a golden beam-trail behind the spinning drill arrow.
        const K = Kit(), T = fx.len / fx.speed, head = Math.min(fx.len, fx.age * fx.speed), a = 1 - win(fx.age, T + .15, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
        const x0 = fx.x0 + c * 40, y0 = fx.y0 + s * 40 - 36, hx = fx.x0 + c * head, hy = fx.y0 + s * head - 36;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(80,40,0,${.5 * a})`; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,190,40,${.75 * a})`; ctx.lineWidth = 30; ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,200,${.95 * a})`; ctx.lineWidth = 10; ctx.stroke();
        for (let d = 60; d < head; d += 70) {
          const ph = (d / 70 + time * 10) % 1;
          K.glow(ctx, fx.x0 + c * d, fx.y0 + s * d - 36, 30 + ph * 20, '255,200,60', .25 * a);
        }
        // spiral rings wound round the beam
        ctx.strokeStyle = `rgba(255,240,170,${.8 * a})`; ctx.lineWidth = 2.5;
        for (let d = 80; d < head; d += 90) {
          const x = fx.x0 + c * d, y = fx.y0 + s * d - 36;
          ctx.beginPath(); ctx.ellipse(x, y, 10, 34, fx.a + (d * .01 + time * 9) % 1 * 0, 0, TAU); ctx.stroke();
        }
        K.glow(ctx, hx, hy, 90, '255,210,80', .8 * a, true);
        ctx.globalCompositeOperation = 'source-over';
        if (head < fx.len) { ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(s, c)); ctx.drawImage(arrowImg(), -270, -30, 300, 60); ctx.restore(); }
      }
    ],
    // ---------------------------------------------------------------- Jirōbō
    slab: [
      (ctx, fx) => {
        const t = clamp01(fx.age / fx.T), x = fx.x0 + (fx.x1 - fx.x0) * t, y = fx.y0 + (fx.y1 - fx.y0) * t;
        ctx.fillStyle = `rgba(20,14,10,${.18 + .2 * t})`; ctx.beginPath(); ctx.ellipse(x, y, 60 + 40 * t, 20 + 14 * t, 0, 0, TAU); ctx.fill();
      },
      (ctx, fx) => {
        const t = clamp01(fx.age / fx.T), x = fx.x0 + (fx.x1 - fx.x0) * t, y = fx.y0 + (fx.y1 - fx.y0) * t - 110 - Math.sin(Math.PI * t) * fx.h * (1 - t * .3) + t * 80;
        ctx.save(); ctx.translate(x, y); ctx.rotate((t - .3) * .8 * (fx.x1 >= fx.x0 ? 1 : -1)); ctx.drawImage(slabImg(), -95, -62, 190, 124); ctx.restore();
        Kit().fx.debris(ctx, x, y + 40, 60, (fx.age * 2) % 1, fx.seed, '#5a4434', 6);
      }
    ],
    rocks: [
      (ctx, fx) => {
        for (const q of fx.list) {
          const t = (fx.age - q[2]) / fx.fall;
          if (t < 0 || t > 1) continue;
          const r = (fx.small ? 34 : 56) * (.4 + .6 * t);
          ctx.fillStyle = `rgba(20,14,10,${.15 + .3 * t})`; ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * .4, 0, 0, TAU); ctx.fill();
          if (!fx.small) { ctx.strokeStyle = `rgba(230,170,110,${.5 + .3 * Math.sin(t * 20)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q[0], q[1], 110, 110 * .45, 0, 0, TAU); ctx.stroke(); }
        }
      },
      (ctx, fx) => {
        for (const q of fx.list) {
          const t = (fx.age - q[2]) / fx.fall;
          if (t < 0) continue;
          if (t <= 1) {
            const s = fx.small ? .7 : 1.4, y = q[1] - (1 - t) * (fx.small ? 160 : 520) - 26;
            ctx.save(); ctx.translate(q[0], y); ctx.rotate(t * 4 + q[3]); ctx.drawImage(rockImg(q[3]), -35 * s, -30 * s, 70 * s, 60 * s); ctx.restore();
          } else if (t < 1 + .9 / fx.fall) impactO(ctx, q[0], q[1], fx.small ? 80 : 115, (t - 1) * fx.fall, fx.seed + q[2] * 10, '230,180,120');
        }
      }
    ],
    cracks: [
      (ctx, fx, time) => {
        const a = 1 - win(fx.age, fx.dur - .5, fx.dur), reach = Math.min(fx.len, fx.age * fx.speed);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        fx.as.forEach((an, li) => {
          const c = Math.cos(an), s = Math.sin(an), nx = -s, ny = c;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
          for (let d = 30; d <= reach; d += 30) { const j = (hash(d * .1 + li * 7 + fx.seed) - .5) * 22; ctx.lineTo(fx.x + c * d + nx * j, fx.y + s * d + ny * j * .5); }
          ctx.strokeStyle = `rgba(30,18,10,${.75 * a})`; ctx.lineWidth = 7; ctx.stroke();
          ctx.strokeStyle = `rgba(255,150,60,${.5 * a})`; ctx.lineWidth = 2; ctx.stroke();
        });
        if (fx.age < .9) impactO(ctx, fx.x, fx.y, 150, fx.age, fx.seed, '230,180,120');
      },
      (ctx, fx) => {
        if (!fx.sp) return;
        const K = Kit(), dust = K.puff('dust');
        fx.as.forEach((an, li) => {
          const c = Math.cos(an), s = Math.sin(an);
          for (let d = 80; d <= fx.len; d += 80) {
            const t = fx.age - d / fx.speed; if (t < 0 || t > 1.1) continue;
            const g = easeOut(t / .12) * (1 - win(t, .7, 1.1)), h = (46 + hash(d + li * 13 + fx.seed) * 34) * g, x = fx.x + c * d, y = fx.y + s * d;
            if (h > 2) ctx.drawImage(rockSpikeImg((d / 80 + li) % 3), x - h * .3, y - h + 4, h * .6, h);
            if (t < .4) K.stamp(ctx, dust, x, y - 8, 22 + t * 40, (1 - t / .4) * .8, .6);
          }
        });
      }
    ],
    punch: [null, (ctx, fx) => {
      // Arhat Fist: a wedge of compressed air and a giant fist echo.
      const K = Kit(), t = fx.age / fx.dur, a = 1 - t, c = Math.cos(fx.a), s = Math.sin(fx.a), R = fx.big ? 420 : 200;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,190,120,${.3 * a})`; sector(ctx, fx.x, fx.y - 30, R * .2, R * (.3 + easeOut(t) * .7), fx.a - .45, fx.a + .45); ctx.fill();
      K.glow(ctx, fx.x + c * 40, fx.y - 30 + s * 20, fx.big ? 110 : 60, '255,200,140', .7 * a, true);
      ctx.globalCompositeOperation = 'source-over';
      const img = fistImg(), sc = fx.big ? 4 : 2.4, d = 30 + easeOut(t) * (fx.big ? 160 : 70);
      ctx.save(); ctx.translate(fx.x + c * d, fx.y - 34 + s * d * .55); ctx.rotate(Math.atan2(s * .55, c)); ctx.globalAlpha = a * .8; ctx.drawImage(img, -28 * sc / 2, -12 * sc / 2, 34 * sc / 2, 28 * sc / 2); ctx.restore();
      ctx.globalAlpha = 1;
      for (let k = 0; k < 3; k++) K.fx.shockRing(ctx, fx.x + c * (60 + k * 50), fx.y + s * (60 + k * 50), (fx.big ? 120 : 70) + k * 20, clamp01(t * 1.6 - k * .15), a * .7, '255,220,180');
    }],
    dome: [
      (ctx, fx, time, z) => {
        // back half of the dome wall + the interior in shadow
        const K = Kit(), rise = easeOut(fx.age / .45), fall = win(fx.age, fx.T, fx.T + .5), R = fx.R, H = 230 * rise * (1 - fall);
        ctx.fillStyle = `rgba(30,18,10,${.35 * rise * (1 - fall)})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R, R * .5, 0, 0, TAU); ctx.fill();
        if (H > 3) domeShell(ctx, fx, R, H, 0, time);
        if (fx.age > fx.T) impactO(ctx, fx.x, fx.y, R, fx.age - fx.T, fx.seed, '230,170,110');
      },
      (ctx, fx, time, z) => {
        const K = Kit(), rise = easeOut(fx.age / .45), fall = win(fx.age, fx.T, fx.T + .5), R = fx.R, H = 230 * rise * (1 - fall);
        if (H > 3) domeShell(ctx, fx, R, H, 1, time);
        // chakra being drained through the wall into Jirōbō's palms
        if (fx.age < fx.T && z.health > 0) {
          const pulse = fx.age - fx.drain < .5 ? 1 : .45;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 7; i++) {
            const ph = (time * 1.3 + i / 7) % 1, sx = fx.x + Math.cos(i * 1.7 + fx.seed) * R * .5, sy = fx.y - 40 + Math.sin(i * 1.7) * 30;
            const x = sx + (z.x - sx) * ph, y = sy + (z.y - 40 - sy) * ph - Math.sin(ph * Math.PI) * 60;
            K.glow(ctx, x, y, 18 + 8 * pulse, '255,170,70', .55 * pulse * bell(ph));
          }
          K.glow(ctx, z.x, z.y - 40, 60, '255,170,70', .35 * pulse);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (fx.age > fx.T && fx.age < fx.T + .8) Kit().fx.debris(ctx, fx.x, fx.y - 60, R, (fx.age - fx.T) / .8, fx.seed, '#6a5040', 18);
      }
    ]
  };
  function spiderDraw(ctx, fx, time) {
    const k = easeOut(fx.age / .3) * (1 - win(fx.age, fx.dur - .4, fx.dur)), W = 240 * k, H = 170 * k, f = fx.fc, br = 1 + Math.sin(time * 5) * .03;
    if (k < .02) return;
    ctx.fillStyle = 'rgba(20,14,10,.32)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, 110 * k, 36 * k, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(fx.x, fx.y - 30 * k); ctx.scale(f, br);
    ctx.drawImage(spiderImg(), -W / 2, -H * .6, W, H);
    if (fx.sac === 1) {
      // the egg sac swelling under its abdomen
      const s = .6 + Math.sin(time * 9) * .05 + (fx.age - 1.2) * .5;
      ctx.fillStyle = 'rgba(40,30,20,.5)'; ctx.beginPath(); ctx.ellipse(-60, 30, 30 * s + 3, 24 * s + 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f4eedc'; ctx.beginPath(); ctx.ellipse(-60, 30, 30 * s, 24 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(170,150,110,.7)'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-60, 30, 30 * s * (1 - i * .2), 24 * s, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
  }
  // Earth Prison Dome: a shell of packed rock (translucent so the trapped fighter stays visible).
  function domeShell(ctx, fx, R, H, front, time) {
    const K = Kit(), x = fx.x, y = fx.y, ry = R * .5;
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    // wall base band (thick rock rim) on this half
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(40,24,14,.8)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.ellipse(x, y - 10, R, ry, 0, a0, a1); ctx.stroke();
    ctx.strokeStyle = '#8a6c52'; ctx.lineWidth = 28; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, y - 22, R, ry, 0, a0, a1); ctx.stroke();
    // the shell: meridians of rock ribs rising to the crown
    const crownY = y - H;
    ctx.fillStyle = front ? 'rgba(120,92,66,.28)' : 'rgba(90,66,46,.45)';
    ctx.beginPath(); ctx.ellipse(x, y - 10, R, ry, 0, a0, a1, false);
    ctx.quadraticCurveTo(front ? x - R * 1.05 : x + R * 1.05, crownY + H * .1, x, crownY);
    ctx.quadraticCurveTo(front ? x + R * 1.05 : x - R * 1.05, crownY + H * .1, front ? x + R : x - R, y - 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,14,.55)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      const an = a0 + (a1 - a0) * i / 8, bx = x + Math.cos(an) * R, by = y - 10 + Math.sin(an) * ry;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(x + Math.cos(an) * R * .9, crownY + H * .25 + Math.sin(an) * ry * .4, x, crownY); ctx.stroke();
    }
    if (front) {
      ctx.strokeStyle = 'rgba(255,230,190,.3)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - R, y - 10); ctx.quadraticCurveTo(x - R * 1.05, crownY + H * .1, x, crownY); ctx.stroke();
      // glowing seal lines of the barrier
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, crownY + H * .4, R * .6, '255,160,70', .12 + .05 * Math.sin(time * 6), false, .8);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) { const an = .3 + i * .5, rx = x + Math.cos(an) * R * .96, ry2 = y - 20 + Math.sin(an) * ry; ctx.drawImage(rockImg(i % 3), rx - 22, ry2 - 18, 44, 38); }
    }
  }

  // ================================================================== windup / persistent overlays
  function windupFx(ctx, z, st, time, H) {
    const K = Kit(), id = z.bossId, k = 1 - st.windup / st.windMax, def = MOVES[id][st.move];
    const fy = z.y + 3 - st.lift, fac = facingOf(z);
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
    if (id === 'tayuya') {
      // notes drifting up off the flute
      for (let i = 0; i < 6; i++) {
        const ph = (time * .9 + i / 6) % 1;
        ctx.globalAlpha = bell(ph); ctx.drawImage(noteImg(i % 4, '#ffb0d8'), z.x + fac * (16 + ph * 30) + Math.sin(time * 4 + i) * 10 - 11, fy - H * .82 - ph * 60 - 11, 22, 22);
      }
      ctx.globalAlpha = 1;
    }
    if (id === 'kimimaro' && (st.move === 'tsubaki' || st.move === 'tessenka' || st.move === 'sawarabi')) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x + fac * 20, fy - H * .5, 26 + 20 * k, '255,248,230', .5 * k, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (id === 'kidomaru' && st.move === 'bow') {
      // Six arms drawing the great golden bow; the drill arrow spins on the string.
      const a = st.aim, c = Math.cos(a), s = Math.sin(a), cx = z.x + c * 26, cy = fy - H * .5 + s * 12, R = 70;
      const nx = -s, ny = c, pull = 18 + 28 * easeOut(k);
      ctx.lineCap = 'round';
      const bow = () => { ctx.beginPath(); ctx.moveTo(cx + nx * R - c * 10, cy + ny * R * .8 - s * 10); ctx.quadraticCurveTo(cx + c * 34, cy + s * 34, cx - nx * R - c * 10, cy - ny * R * .8 - s * 10); };
      bow(); ctx.strokeStyle = 'rgba(60,30,0,.7)'; ctx.lineWidth = 11; ctx.stroke();
      bow(); ctx.strokeStyle = '#ffc830'; ctx.lineWidth = 7; ctx.stroke();
      bow(); ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,230,.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx + nx * R - c * 10, cy + ny * R * .8 - s * 10); ctx.lineTo(cx - c * pull, cy - s * pull); ctx.lineTo(cx - nx * R - c * 10, cy - ny * R * .8 - s * 10); ctx.stroke();
      ctx.save(); ctx.translate(cx - c * pull, cy - s * pull); ctx.rotate(a); ctx.drawImage(arrowImg(), -12, -20, 200, 40); ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, cx + c * 150, cy + s * 150, 40 + 40 * k, '255,210,80', .5 + .4 * k, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (id === 'jirobo' && st.move === 'slab') {
      // the slab torn out of the ground and raised overhead
      const up = easeOut(k / .7), x = z.x, y = fy - H - 20 - up * 30;
      ctx.save(); ctx.translate(x, y + (1 - up) * 80); ctx.globalAlpha = Math.min(1, k * 3); ctx.drawImage(slabImg(), -95, -62, 190, 124); ctx.restore();
      ctx.globalAlpha = 1;
      if (k < .4) Kit().fx.debris(ctx, z.x, z.y, 90, k / .4, st.seed, '#5a4434', 10);
    }
    if (id === 'jirobo' && st.move === 'dome') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, fy - H * .4, 90 * k + 30, '255,150,60', .4 * k);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - st.lift - bodyH(z.bossId) - 36;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#160f1d';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    if (def.shout) {
      const bob = Math.sin(time * 9) * 1.5;
      ctx.font = 'italic 800 10px sans-serif'; ctx.lineWidth = 3;
      ctx.strokeText(def.shout, z.x, top - 14 + bob); ctx.fillStyle = '#ffffff'; ctx.fillText(def.shout, z.x, top - 14 + bob);
    }
    ctx.restore();
  }
  // Curse mark (Juin): dark flame patterns crawling over the skin, a black-violet aura; stage-2 extras per fighter.
  function curseAura(ctx, z, st, time, above) {
    if (!(st.curse > 0) || z.health <= 0) return;
    const K = Kit(), id = z.bossId, H = bodyH(id), a = Math.min(1, st.curse * 1.5), fy = z.y + 3 - st.lift, f = facingOf(z);
    if (!above) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, fy - H * .45, H * .9, '120,30,140', .3 * a, false, 1.2);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 7; i++) {
        const img = K.flame(i, CURSE_PAL, 'snd-curse'), ph = (time * 1.4 + i / 7) % 1, w = 22 + hash(i) * 14, h = H * (.55 + .35 * bell(ph));
        ctx.globalAlpha = .55 * a * (1 - ph * .5);
        ctx.drawImage(img, z.x + (i / 6 - .5) * H * .5 - w / 2, fy - h * .9, w, h);
      }
      ctx.globalAlpha = 1;
      if (id === 'kimimaro') {
        // Stage 2: the bone tail sweeping behind him.
        const img = vertebraImg();
        for (let i = 0; i < 14; i++) {
          const u = i / 13, x = z.x - f * (10 + u * 70) + Math.sin(time * 3 + u * 4) * 8 * u, y = fy - H * .42 + u * (H * .42 - 4) - Math.sin(u * Math.PI) * 20;
          const s = 1.15 - u * .55;
          ctx.save(); ctx.translate(x, y); ctx.rotate(-f * .3 + u * f * .8); ctx.drawImage(img, -15 * s, -12 * s, 30 * s, 24 * s); ctx.restore();
        }
      }
      return;
    }
    // Flame-shaped marks over the body (drawn over the sprite).
    ctx.fillStyle = `rgba(14,4,18,${.62 * a})`;
    for (let i = 0; i < 9; i++) {
      const hx = z.x + f * ((hash(i * 3.1) - .5) * H * .26), hy = fy - H * (.3 + hash(i * 5.7) * .55), s = 3 + hash(i * 1.3) * 3.5, g = clamp01(a * 1.5 - hash(i) * .5);
      ctx.beginPath(); ctx.moveTo(hx, hy - s * 2.2 * g); ctx.quadraticCurveTo(hx + s, hy, hx, hy + s * .8 * g); ctx.quadraticCurveTo(hx - s, hy, hx, hy - s * 2.2 * g); ctx.fill();
    }
    const hx = z.x + f * H * .07, hy = fy - H * .88;
    if (id === 'sakon' || id === 'tayuya') {
      // horn(s) of the second stage
      const list = id === 'sakon' ? [[0, 1]] : [[-.12, .8], [.1, .7], [.28, .55]];
      for (const [o, s] of list) {
        const bx = hx + f * o * H * .3, by = hy - H * .02, L = H * .16 * s;
        ctx.fillStyle = '#efe6d0'; ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.quadraticCurveTo(bx + f * 2, by - L * .6, bx + f * 5, by - L); ctx.quadraticCurveTo(bx + f * 4, by - L * .4, bx + 3, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (id === 'kidomaru') {
      // third eye opening on his forehead
      ctx.fillStyle = '#1a0a0a'; ctx.beginPath(); ctx.ellipse(hx + f * 3, hy + 1, 2.2, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd030'; ctx.beginPath(); ctx.ellipse(hx + f * 3, hy + 1, 1.3, 2.6, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx + f * 3, hy + 1, 14, '255,200,60', .7 * a); ctx.globalCompositeOperation = 'source-over';
    }
    if (id === 'jirobo') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x, fy - H * .5, H * .7, '255,90,40', .2 * a); ctx.globalCompositeOperation = 'source-over'; }
  }

  // ================================================================== module hooks
  function draw(ctx, z, time) {
    const st = z.so;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      curseAura(ctx, z, st, time, false);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.so, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z, st); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      curseAura(ctx, z, st, time, true);
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, bodyH(z.bossId));
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const bodyLift = z => (z.so && z.health > 0 ? z.so.lift || 0 : 0);

  window.SoundBosses = { members, order, pick, update, draw, drawOverlay, bodyLift, moveLabels, moves };
})();
