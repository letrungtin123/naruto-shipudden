/* Jinchūriki (spawn panel "NHÂN TRỤ LỰC", faction 'jinchu'): Nii Yugito (Two-Tails), Rōshi (Four-Tails),
 * Han (Five-Tails), Utakata (Six-Tails) and Fū (Seven-Tails).
 * Same contract as killer-bee-boss.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the
 * telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. Every bit of
 * per-boss state lives on z.jc (plain numbers / small arrays; closures are skipped by the co-op serializer).
 * Each member fights in a partial beast cloak (Version 1/2) and, as the ultimate, turns into the full
 * tailed beast, painted with TailedBeasts' own art at giant scale (hidden(z) hides the human sprite).
 * The five human sprites are built here from AnimeSprites.kit and registered with addSprite. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeBack = t => { t = clamp01(t); const c = 1.7; return Math.max(0, 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;

  // ================================================================== sprites
  const AS = window.AnimeSprites, SK = AS && AS.kit;
  if (SK && AS.addSprite) {
    const { paint, seg, line, lerp, lit, dark, light, rgba, SHADE, DEEP, DEEP2, ell, smooth, poly, dot, locks, sweptHair, sweptBack, HAIR, plateSymbol, onFace } = SK;

    // ---- Nii Yugito (Kumo): long blond braid bound in white wraps, dark-violet eyes, a lavender tunic with a
    // high collar over dark-purple long sleeves, a crimson sash and a Kumo forehead protector.
    const yugitoSpec = () => {
      const O = '#1c1426', SKIN = '#f7dcc8', HC = '#f2d27a', TOP = '#7a5aa8', TOP_L = '#a688d0', UNDER = '#33284a', SASH = '#9a2c40', WRAP = '#efe8dc';
      return {
        outline: O, skin: SKIN, skinShade: '#dcab9a', bulk: -.5, legK: 1.12,
        legs: { thigh: UNDER, shin: UNDER, foot: '#2a2232', w1: 4.7, w2: 3.9, wrap: '#ddd4cc', holster: '#4a3a5a' },
        arms: { upper: TOP, lower: UNDER, w1: 4.3, w2: 3.7, cuff: WRAP, hand: SKIN },
        torso: {
          base: TOP, paint: ctx => {
            // mesh at the collar V, the lighter front panel and the crimson sash knotted at the hip
            ctx.fillStyle = TOP_L; ctx.beginPath(); ctx.moveTo(1.2, -12.8); ctx.lineTo(7.2, -12.6); ctx.lineTo(6.4, -3.6); ctx.lineTo(2, -3.6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(5.6, -12, .6, 8);
            line(ctx, [[1.2, -12.8], [2, -3.6]], dark(TOP, .45), .5);
            ctx.fillStyle = SASH; ctx.fillRect(-8, -4.4, 17, 2.8);
            ctx.fillStyle = light(SASH, .3); ctx.fillRect(-8, -4.2, 17, .5);
            ctx.fillStyle = dark(SASH, .3); ctx.fillRect(-6.4, -4.8, 2.6, 3.8);
            ctx.strokeStyle = 'rgba(40,20,60,.35)'; ctx.lineWidth = .4;
            for (const [x0, x1] of [[-3.6, -4.2], [-.2, .6]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .6, -8, x1, -4.6); ctx.stroke(); }
          }
        },
        skirt: {
          color: TOP, hem: 8.6, flare: .7, paint: (ctx, hem) => {
            ctx.fillStyle = TOP_L; ctx.fillRect(-20, hem - 1.6, 40, 1.6);
            ctx.fillStyle = SASH; ctx.fillRect(-20, hem - 2, 40, .45);
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-5.4, -11.6); ctx.lineTo(-5.8, -16.2); ctx.quadraticCurveTo(-1, -15.2, 3.4, -14.8); ctx.lineTo(7, -15.6); ctx.lineTo(6.6, -11.8); ctx.closePath(); }, TOP, O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -17, 5, 7);
            ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(.6, -15, 6, .5);
          });
        },
        head: {
          drape(ctx, spec, pose) {
            // the long braid hanging down her back, bound every few twists
            const run = pose && pose.run ? 1 : 0;
            paint(ctx, () => smooth(ctx, [[-5, -10], [-11.4, -4], [-12, 4], [-9.4, 8.6], [-5.6, 6]]), dark(HC, .12), O, 1);
            for (let i = 0; i < 10; i++) {
              const t = i / 9, x = -9.6 - t * 2.4 - run * t * t * 7, y = 6.4 + i * 2.85 - run * t * t * 3, s = i % 2 ? 1 : -1, w = 2.5 - t * .7;
              paint(ctx, () => ell(ctx, x + s * .6, y, w, 2.1, s * .55), i % 2 ? HC : dark(HC, .1), O, .7, () => {
                ctx.fillStyle = SHADE; ell(ctx, x + s * .6 - 1.1, y + .9, w, 1.4); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,.38)'; ell(ctx, x + s * .6 + .5, y - .8, w * .4, .4, s * .5); ctx.fill();
              });
              if (i % 3 === 2) paint(ctx, () => ell(ctx, x, y + 1.5, w * .95, .8), WRAP, O, .55, () => { ctx.fillStyle = SHADE; ctx.fillRect(x - 3, y + 1.6, 6, 1); });
            }
            const ex = -12 - run * 7, ey = 35.2 - run * 3;
            paint(ctx, () => poly(ctx, [[ex - 1.6, ey - 1], [ex + 1.6, ey - 1], [ex + 1.2, ey + 3.4], [ex, ey + 2.2], [ex - 1.2, ey + 3.6]]), HC, O, .6);
          },
          hair: HAIR.smooth(HC, { nape: 7.6 }),
          eyes: { type: 'normal', iris: '#4a2e6a', fem: true }, mouth: 'smirk', attackMouth: 'shout', browColor: '#b88a3a', browW: .6, browAngle: 'angry',
          band: { cloth: '#2a2236', plate: '#c9d1da', symbol: 'cloud' },
          front(ctx, spec) {
            // side-swept fringe and the long locks framing the face
            locks(ctx, spec, HC, [[-1.4, -8.4, -2.6, 9, 1.9, -.8], [10, -6.8, 10.8, 7.4, 1.4, .6], [2, -8.8, 1, -4.4, 1.3, -.3], [5, -8.8, 5.6, -5, 1.2, .2], [8, -8.4, 9, -4.8, 1.1, .3]], .85);
          }
        }
      };
    };

    // ---- Rōshi (Iwa): spiky red hair and a full red beard, Iwa forehead protector, a heavy grey-brown armour
    // vest with plated shoulders over a red undershirt, broad build.
    const roshiSpec = () => {
      const O = '#20140e', SKIN = '#eec4a2', HC = '#cf3a20', ARM = '#6e6354', PLATE = '#8c7f6a', UNDER = '#8a2418', PANTS = '#4a3e34';
      return {
        outline: O, skin: SKIN, skinShade: '#c99a7c', bulk: 1.2, legK: 1.02, headScale: 1.02,
        legs: { thigh: PANTS, shin: PANTS, foot: '#2c241e', w1: 6, w2: 5, wrap: '#d6cbb8' },
        arms: { upper: UNDER, lower: UNDER, w1: 5.4, w2: 4.8, guard: ARM, hand: SKIN },
        torso: {
          base: ARM, paint: ctx => {
            // red undershirt in the collar, horizontal armour plates with rivets, broad belt
            ctx.fillStyle = UNDER; ctx.beginPath(); ctx.moveTo(.4, -13.4); ctx.lineTo(6.4, -13.4); ctx.lineTo(4, -10); ctx.closePath(); ctx.fill();
            for (let i = 0; i < 4; i++) {
              const y = -11 + i * 2.4;
              ctx.fillStyle = i % 2 ? PLATE : light(PLATE, .1); ctx.fillRect(-1, y, 9.6, 1.9);
              ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-1, y, 9.6, .4);
              ctx.fillStyle = dark(ARM, .5); ctx.fillRect(-1, y + 1.7, 9.6, .35);
              dot(ctx, 7.6, y + 1, .3, '#3a3026'); dot(ctx, 0, y + 1, .3, '#3a3026');
            }
            ctx.fillStyle = '#3a2e24'; ctx.fillRect(-9, -2.6, 19, 2.6);
            ctx.fillStyle = '#a8946a'; ctx.fillRect(2.6, -2.8, 3, 3);
            ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(2.6, -2.8, 3, .5);
          }
        },
        skirt: { color: ARM, hem: 6.4, flare: 1.4, opening: false, paint: (ctx, hem, hipY) => {
          // plated tassets hanging from the belt
          ctx.strokeStyle = dark(ARM, .5); ctx.lineWidth = .45;
          for (const x of [-4.6, -.4, 3.8]) { ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x - .4, hem + 1); ctx.stroke(); }
          ctx.fillStyle = PLATE; ctx.fillRect(-20, hem - 1.4, 40, 1.4);
        } },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.6, -11.6); ctx.lineTo(-7, -15.6); ctx.quadraticCurveTo(-1, -14.2, 4, -14); ctx.lineTo(8, -15); ctx.lineTo(7.8, -11.6); ctx.closePath(); }, UNDER, O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 5, 6);
          });
        },
        shoulder(ctx) {
          // the big rounded shoulder plate over the near arm
          paint(ctx, () => smooth(ctx, [[-8.6, -13.4], [-2.4, -15], [1.6, -12.6], [.4, -8.6], [-6.8, -8], [-9.6, -10.4]]), PLATE, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-11, -10.4, 14, 3);
            ctx.fillStyle = DEEP2; ctx.fillRect(-11, -9, 14, 2);
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, -3.4, -13.2, 3, .8, -.1); ctx.fill();
            line(ctx, [[-8.4, -11.2], [.8, -11.4]], dark(PLATE, .45), .4);
          });
          dot(ctx, -3, -10.2, .4, '#3a3026');
        },
        head: {
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-24, 15.2], [-50, 18], [-78, 19.4], [-106, 19.2], [-134, 18.2], [-160, 16.6], [-186, 14.6], [-210, 12.8]], { valley: 12.6, sweep: .22 }),
          eyes: { type: 'normal', iris: '#2a221e' }, brows: 'thick', browColor: '#a8301a', browW: 1.5, browAngle: 'angry', blush: false,
          band: { cloth: '#3a2a22', plate: '#c3cbd4', symbol: 'stone' },
          mask(ctx, spec) {
            // the full red beard from ear to ear and a heavy moustache
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.4, 2); ctx.quadraticCurveTo(-3.4, 6.4, .4, 6.2); ctx.quadraticCurveTo(5, 4.6, 10.8, 5.4); ctx.quadraticCurveTo(11.6, 9.6, 9.6, 12.4); ctx.lineTo(8.6, 15.6); ctx.lineTo(7, 13.2); ctx.lineTo(5.6, 17); ctx.lineTo(4, 13.6); ctx.lineTo(2, 16.4); ctx.lineTo(.6, 12.6); ctx.quadraticCurveTo(-3.4, 11.4, -5.2, 6.6); ctx.closePath(); }, HC, spec.outline, .9, () => {
              ctx.fillStyle = dark(HC, .3); ctx.fillRect(-8, 9, 20, 10);
              ctx.fillStyle = dark(HC, .45); ell(ctx, -2, 8, 3, 4); ctx.fill();
              ctx.strokeStyle = dark(HC, .5); ctx.lineWidth = .35;
              for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(1 + i * 2, 7.6); ctx.quadraticCurveTo(1.4 + i * 1.8, 10.6, 1.6 + i * 1.6, 13.6); ctx.stroke(); }
              ctx.fillStyle = 'rgba(255,220,190,.35)'; ell(ctx, 7.6, 6.6, 2.4, .6, -.1); ctx.fill();
            });
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(3.4, 7.4); ctx.quadraticCurveTo(6.6, 5, 10.4, 6.6); ctx.lineTo(10, 8); ctx.quadraticCurveTo(7, 6.8, 4, 8.8); ctx.closePath(); }, dark(HC, .1), spec.outline, .6);
            line(ctx, [[5.6, 9.6], [8.4, 9.2]], '#3a1008', .5);
          }
        }
      };
    };

    // ---- Han (Iwa): very tall, crimson plated armour, a white wrap masking his face below the eyes, a wide
    // straw kasa over a dark hood, and the copper steam boiler strapped to his back with its chimney.
    const hanSpec = () => {
      const O = '#1e1414', SKIN = '#e8c8aa', ARMOR = '#b4412e', ARMOR_D = '#7a2a22', CLOTH = '#3a302c', MASK = '#e8e4da', HAT = '#cfb06e', TANK = '#a8703c';
      return {
        outline: O, skin: SKIN, skinShade: '#c49a80', bulk: .7, legK: 1.2,
        legs: { thigh: CLOTH, shin: ARMOR, foot: '#2a2220', w1: 5.8, w2: 5, boots: true },
        arms: { upper: ARMOR, lower: CLOTH, w1: 5.2, w2: 4.6, guard: ARMOR_D, cuff: MASK, hand: '#4a3a34' },
        back(ctx) {
          // copper boiler on his back: riveted drum, a chimney venting steam
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-14.4, -16); ctx.quadraticCurveTo(-15.8, -8, -14.2, -1.6); ctx.quadraticCurveTo(-10, 0, -6, -1.6); ctx.lineTo(-5.6, -16); ctx.quadraticCurveTo(-10, -18, -14.4, -16); ctx.closePath(); }, TANK, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-17, -18, 4.4, 18);
            ctx.fillStyle = 'rgba(255,230,190,.4)'; ctx.fillRect(-8.6, -15, 1.1, 12);
            for (const y of [-12.6, -8, -3.6]) { line(ctx, [[-14.6, y], [-5.8, y]], dark(TANK, .45), .55); for (let x = -13.6; x < -6; x += 1.7) dot(ctx, x, y + .55, .28, '#4a2a14'); }
          });
          paint(ctx, () => poly(ctx, [[-12.6, -16.4], [-10.2, -16.6], [-11.6, -25], [-14.2, -24.6]]), dark(TANK, .2), O, .85, () => { ctx.fillStyle = SHADE; ctx.fillRect(-15, -25, 1.8, 9); });
          paint(ctx, () => ell(ctx, -12.9, -24.8, 1.9, .9), '#2a1a12', O, .6);
        },
        torso: {
          base: ARMOR, paint: ctx => {
            // segmented crimson plates down the front, dark lacing, a cloth belt
            for (let i = 0; i < 5; i++) {
              const y = -12.6 + i * 2.3;
              ctx.fillStyle = i % 2 ? ARMOR : light(ARMOR, .08); ctx.fillRect(-8, y, 17, 2);
              ctx.fillStyle = 'rgba(255,220,200,.22)'; ctx.fillRect(-8, y, 17, .4);
              ctx.fillStyle = ARMOR_D; ctx.fillRect(-8, y + 1.75, 17, .35);
            }
            ctx.strokeStyle = '#2a1410'; ctx.lineWidth = .35;
            for (const x of [1.4, 4.6]) { ctx.beginPath(); ctx.moveTo(x, -12.6); ctx.lineTo(x, -1.4); ctx.stroke(); }
            ctx.fillStyle = CLOTH; ctx.fillRect(-8, -1.8, 17, 2.2);
          }
        },
        skirt: { color: ARMOR_D, hem: 8, flare: 1.4, opening: false, paint: (ctx, hem) => {
          ctx.fillStyle = ARMOR; for (let i = 0; i < 3; i++) ctx.fillRect(-20, hem - 7 + i * 2.4, 40, 1.4);
          ctx.fillStyle = 'rgba(255,220,200,.2)'; for (let i = 0; i < 3; i++) ctx.fillRect(-20, hem - 7 + i * 2.4, 40, .35);
        } },
        collar(ctx) {
          // the mask's wrap continuing round the neck
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6, -11.4); ctx.lineTo(-6.4, -16.8); ctx.quadraticCurveTo(-1, -15.6, 4, -15.4); ctx.lineTo(7.6, -16.2); ctx.lineTo(7.2, -11.6); ctx.closePath(); }, MASK, O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -17, 5, 7);
            ctx.strokeStyle = 'rgba(120,110,100,.5)'; ctx.lineWidth = .35;
            for (const y of [-15, -13.4]) { ctx.beginPath(); ctx.moveTo(-6, y); ctx.quadraticCurveTo(1, y + 1, 7.4, y - .4); ctx.stroke(); }
          });
        },
        shoulder(ctx) {
          paint(ctx, () => smooth(ctx, [[-8, -13.4], [-2, -14.6], [1.6, -12.2], [.2, -8.2], [-6.4, -7.6], [-9, -10.2]]), ARMOR, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-11, -10.4, 14, 3);
            ctx.fillStyle = ARMOR_D; ctx.fillRect(-11, -9.2, 14, .5);
            ctx.fillStyle = 'rgba(255,230,210,.3)'; ell(ctx, -3, -12.8, 3, .8, -.1); ctx.fill();
          });
        },
        head: {
          hair(ctx, spec) {
            // dark hood under the hat
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(10, -3); ctx.quadraticCurveTo(11.4, -13.4, .6, -13.4); ctx.quadraticCurveTo(-12.4, -13, -12, 2); ctx.lineTo(-11, 10); ctx.lineTo(-4.8, 9); ctx.lineTo(-4.2, 1); ctx.lineTo(-2.2, -4.2); ctx.quadraticCurveTo(3.6, -6, 10, -3); ctx.closePath(); }, CLOTH, spec.outline, 1.05, () => {
              ctx.fillStyle = dark(CLOTH, .3); ctx.fillRect(-14, -2, 10, 14);
              ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .4;
              ctx.beginPath(); ctx.moveTo(-6, -11); ctx.quadraticCurveTo(-9, -2, -8, 9); ctx.stroke();
            });
          },
          noHairShadow: true,
          eyes: { type: 'normal', iris: '#3a2a22' }, browColor: '#2a1a14', browW: 1, browAngle: 'angry', blush: false,
          mask(ctx, spec) {
            // the white face wrap from the nose down, folds catching the light
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.4, 3.4); ctx.quadraticCurveTo(3, 4.4, 10.9, 3.6); ctx.bezierCurveTo(10.6, 6.6, 8.6, 9.8, 6.1, 11.2); ctx.bezierCurveTo(3.4, 12.2, -1, 11.2, -4, 8.8); ctx.closePath(); }, MASK, spec.outline, .85, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-6, 8.6, 18, 4);
              ctx.fillStyle = rgba('#9a948a', .5); ell(ctx, -1.6, 6, 2.6, 3.4); ctx.fill();
              ctx.strokeStyle = 'rgba(130,120,110,.6)'; ctx.lineWidth = .35;
              for (const y of [5.6, 7.6, 9.4]) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.quadraticCurveTo(4, y + .9, 10.4, y - .6); ctx.stroke(); }
              ctx.fillStyle = 'rgba(255,255,255,.6)'; ell(ctx, 8.6, 4.4, 1.6, .4); ctx.fill();
            });
          },
          front(ctx, spec) {
            // wide straw kasa with a dark band, tied under the chin
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-16.4, -6.4); ctx.quadraticCurveTo(-4, -20.6, 1.6, -21); ctx.quadraticCurveTo(7, -20.4, 18.4, -5.4); ctx.quadraticCurveTo(1, -8.4, -16.4, -6.4); ctx.closePath(); }, HAT, spec.outline, 1.1, () => {
              ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-17, -6); ctx.quadraticCurveTo(-6, -18, 1.4, -21); ctx.lineTo(-2, -6); ctx.fill();
              ctx.fillStyle = 'rgba(255,250,220,.35)'; ctx.beginPath(); ctx.moveTo(3, -20); ctx.quadraticCurveTo(10, -14, 15, -7.6); ctx.lineTo(12.6, -7.4); ctx.quadraticCurveTo(8, -13, 2.4, -19); ctx.fill();
              ctx.strokeStyle = rgba(dark(HAT, .45), .6); ctx.lineWidth = .35;
              for (let i = -3; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(1.6, -21); ctx.lineTo(1 + i * 4.2, -6.6); ctx.stroke(); }
              ctx.fillStyle = '#5a2a1e'; ctx.beginPath(); ctx.moveTo(-9, -11.4); ctx.quadraticCurveTo(1.6, -14, 12.6, -10.6); ctx.lineTo(13.6, -9); ctx.quadraticCurveTo(1.6, -12.4, -10, -9.6); ctx.closePath(); ctx.fill();
            });
            line(ctx, [[-3.6, -7], [-4, 4]], '#5a2a1e', .5);
          }
        }
      };
    };

    // ---- Utakata (Kiri, missing-nin): dark hair with a long lock over one eye, a pale-blue kimono worn open
    // at the chest with a navy sash, wide sleeves, the bubble pipe in hand.
    const utakataSpec = () => {
      const O = '#141a22', SKIN = '#f2dcc8', HC = '#2c2834', ROBE = '#a9d7ea', ROBE_D = '#6aa2c2', SASH = '#2c3c5c', PANTS = '#3a4452';
      const pipe = (ctx, hx, hy, up, bubble) => {
        // long kiseru: lacquered stem, metal mouthpiece, a small bowl with a soap bubble growing on it
        const a = up ? -.95 : -.3, c = Math.cos(a), s = Math.sin(a), L = 12;
        const x0 = hx - c * 2, y0 = hy - s * 2, x1 = hx + c * L, y1 = hy + s * L;
        seg(ctx, [x0, y0], [x1, y1], 1.6, O); seg(ctx, [x0, y0], [x1, y1], .9, '#6a3a24');
        seg(ctx, [x0, y0], [x0 + c * 1.6, y0 + s * 1.6], 1.1, '#c8c4b8');
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(x1 - 1, y1 - .4); ctx.lineTo(x1 + 1.6, y1 - 1.6); ctx.lineTo(x1 + 2, y1 + .6); ctx.quadraticCurveTo(x1 + .6, y1 + 1.4, x1 - .4, y1 + .8); ctx.closePath(); }, '#b8a878', O, .55);
        if (bubble) {
          paint(ctx, () => ell(ctx, x1 + 3.4, y1 - 2.6, 2.6, 2.6), 'rgba(200,240,255,.35)', '#3a6a8a', .5, () => {
            ctx.fillStyle = 'rgba(255,255,255,.85)'; ell(ctx, x1 + 2.6, y1 - 3.6, .8, .5, -.5); ctx.fill();
            ctx.fillStyle = 'rgba(255,150,220,.35)'; ell(ctx, x1 + 4.4, y1 - 1.6, 1, .6, .4); ctx.fill();
          });
        }
      };
      return {
        outline: O, skin: SKIN, skinShade: '#d4ac98', bulk: -.1, legK: 1.14,
        legs: { thigh: PANTS, shin: PANTS, foot: '#232630', w1: 4.9, w2: 4.1, wrap: '#d8dce0' },
        arms: { upper: ROBE, lower: ROBE, w1: 5.4, w2: 5.8, cuff: ROBE_D, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            // the kimono open over the chest, dark trim along the lapels, navy sash
            ctx.fillStyle = SKIN; ctx.beginPath(); ctx.moveTo(.2, -13.4); ctx.lineTo(7, -13.4); ctx.lineTo(3.8, -5.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(170,110,110,.25)'; ctx.beginPath(); ctx.moveTo(3, -10.6); ctx.lineTo(4.6, -10.6); ctx.lineTo(3.8, -7); ctx.fill();
            ctx.fillStyle = SASH; ctx.beginPath(); ctx.moveTo(-.6, -13.4); ctx.lineTo(.4, -13.4); ctx.lineTo(4, -5.6); ctx.lineTo(3.2, -5); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(6.8, -13.4); ctx.lineTo(7.8, -13.2); ctx.lineTo(4.4, -5.2); ctx.lineTo(3.8, -5.6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = SASH; ctx.fillRect(-8, -5, 17, 3.4);
            ctx.fillStyle = light(SASH, .3); ctx.fillRect(-8, -4.8, 17, .5);
            ctx.fillStyle = '#c8d8e8'; ctx.fillRect(-8, -3.4, 17, .45);
            ctx.strokeStyle = 'rgba(40,80,110,.38)'; ctx.lineWidth = .4;
            for (const [x0, x1] of [[-4, -4.6], [-1, -.4]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .6, -8, x1, -5); ctx.stroke(); }
          }
        },
        skirt: { color: ROBE, hem: 12.4, flare: 1.6, paint: (ctx, hem) => {
          ctx.fillStyle = ROBE_D; ctx.fillRect(-20, hem - 1.2, 40, 1.2);
          ctx.strokeStyle = 'rgba(40,80,110,.35)'; ctx.lineWidth = .4;
          for (const x of [-5, -1, 3.4]) { ctx.beginPath(); ctx.moveTo(x, hem - 11); ctx.quadraticCurveTo(x - .6, hem - 5, x - 1, hem - 1); ctx.stroke(); }
        } },
        collar(ctx) {
          paint(ctx, () => poly(ctx, [[-6.4, -11.4], [-6.8, -14.6], [-1.8, -13.6], [.6, -12.6], [-3, -10.6]]), ROBE, O, .8, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -15, 4, 6);
            ctx.fillStyle = SASH; ctx.beginPath(); ctx.moveTo(-1.8, -13.6); ctx.lineTo(.6, -12.6); ctx.lineTo(.2, -12); ctx.lineTo(-2.2, -13); ctx.fill();
          });
        },
        head: {
          hair: (ctx, sp) => {
            sweptBack(ctx, sp, HC, [[-80, 18], [-110, 18.6], [-140, 17.4], [-170, 15.6], [-198, 13.6]], { valley: 12 });
            sweptHair(ctx, sp, HC, [[-30, 15.6], [-58, 18.2], [-86, 19], [-114, 18.6], [-142, 17.4], [-168, 15.8], [-194, 14], [-218, 12.4]], { valley: 12.8, sweep: .16 });
          },
          eyes: { type: 'sleepy', iris: '#a87a3a', lid: SKIN }, browColor: HC, browW: .7, mouth: 'neutral', attackMouth: 'smirk', blush: false,
          front(ctx, spec) {
            // the long lock falling over his far eye, short strands over the brow
            locks(ctx, spec, HC, [[-1.4, -8.4, -2.6, 4.6, 1.6, -.8], [1.8, -8.8, 1.4, -3.4, 1.3, -.2], [4.4, -8.8, 4.6, -4.6, 1.2, .1]], .85);
            locks(ctx, spec, HC, [[7.2, -8.6, 10, 5.8, 2.5, .9]], .9);
          }
        },
        front(ctx, pose, handN) {
          const [hx, hy] = handN;
          pipe(ctx, hx, hy, pose.attack || pose.seal || pose.raise, pose.seal || pose.attack);
          paint(ctx, () => ell(ctx, hx + .2, hy + .1, 1.6, 1.4), SKIN, O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(hx - 2, hy + .4, 4, 2); });
        }
      };
    };

    // ---- Fū (Taki): mint-green short hair with an orange clip, orange eyes, tanned skin; a white sleeveless
    // top over a mesh midriff, white wrap skirt, arm guards, the Taki plate tied on her arm, and the big red
    // cylinder pack on her back.
    const fuSpec = () => {
      const O = '#1c1610', SKIN = '#dba57e', HC = '#7fe3b6', TOP = '#f2efe6', SKIRT = '#e9e3d4', MESH = '#3a3430', PACK = '#c8362c', CLIP = '#ff9a2a';
      return {
        outline: O, skin: SKIN, skinShade: '#b67e5c', bulk: -.6, legK: 1.14,
        legs: { thigh: SKIN, shin: SKIN, foot: '#2e2620', w1: 4.6, w2: 3.8, wrap: '#efe8dc' },
        arms: {
          upper: SKIN, lower: TOP, w1: 4, w2: 3.6, cuff: '#9a948a', hand: SKIN, bare: true,
          pattern(ctx, p0, p1, p2, far) {
            if (far) return;
            // the Taki forehead protector tied round the upper arm
            const m = lerp(p0, p1, .5), a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(a);
            paint(ctx, () => { ctx.beginPath(); ctx.rect(-1.6, -2.6, 3.2, 5.2); }, '#3a3a44', O, .5);
            paint(ctx, () => { ctx.beginPath(); ctx.rect(-1.3, -2, 2.6, 4); }, '#cdd5de', O, .45, () => { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-1.3, -2, .5, 4); });
            ctx.restore();
            plateSymbol(ctx, 'taki', m[0], m[1], .45, '#4a5460');
          }
        },
        back(ctx) {
          // big red cylinder pack with rope bands
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-10.6, -16.4); ctx.quadraticCurveTo(-8.4, -17.6, -5.2, -16.6); ctx.lineTo(-4.8, -1.4); ctx.quadraticCurveTo(-7.8, -.2, -10.6, -1.6); ctx.closePath(); }, PACK, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-12, -18, 3.4, 18);
            ctx.fillStyle = 'rgba(255,200,180,.35)'; ctx.fillRect(-6.8, -15.6, .8, 13);
            for (const y of [-13.4, -5.6]) { ctx.fillStyle = '#efe6d2'; ctx.fillRect(-11, y, 6.6, 1.2); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-11, y + .9, 6.6, .3); }
          });
          paint(ctx, () => ell(ctx, -7.9, -16.6, 2.7, .9), light(PACK, .15), O, .6);
        },
        torso: {
          base: TOP, paint: ctx => {
            // crop top over a mesh midriff, collar line
            ctx.fillStyle = SKIN; ctx.fillRect(-8, -5.6, 17, 6);
            ctx.strokeStyle = rgba(MESH, .55); ctx.lineWidth = .3;
            for (let i = -8; i < 10; i += 1.4) { ctx.beginPath(); ctx.moveTo(i, -5.6); ctx.lineTo(i + 3, .4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + 3, -5.6); ctx.lineTo(i, .4); ctx.stroke(); }
            ctx.fillStyle = dark(TOP, .2); ctx.fillRect(-8, -6, 17, .7);
            line(ctx, [[1, -13.2], [3.8, -10.8], [6.8, -13.2]], '#9a948a', .45);
          }
        },
        skirt: { color: SKIRT, hem: 7.2, flare: 1.1, paint: (ctx, hem, hipY) => {
          ctx.fillStyle = '#c8302a'; ctx.fillRect(-20, hipY - 1.6, 40, 1.4);
          ctx.fillStyle = dark(SKIRT, .25); ctx.fillRect(-20, hem - 1, 40, 1);
        } },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.6, -13.4, 4.4, 1.5, 0, 0, TAU); }, TOP, O, .75, () => { ctx.fillStyle = SHADE; ctx.fillRect(-3, -13.2, 9, 2); });
        },
        head: {
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-28, 14.6], [-56, 16.8], [-84, 17.8], [-112, 17.4], [-140, 16.4], [-166, 15.2], [-192, 13.6], [-216, 12]], { valley: 12.2, sweep: .2 }),
          eyes: { type: 'normal', iris: '#f08a1a', fem: true }, browColor: '#4aa882', browW: .6, mouth: 'grin', attackMouth: 'shout',
          front(ctx, spec) {
            locks(ctx, spec, HC, [[-1.6, -8.2, -2.4, 3.6, 1.5, -.7], [1.6, -8.8, 1.2, -3.6, 1.3, -.3], [4.6, -8.8, 5.2, -4.4, 1.2, .2], [7.8, -8.2, 9.4, -3.6, 1.2, .6]], .85);
            // the orange hair clip above the near ear
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.6, -6.4); ctx.lineTo(-.6, -7.8); ctx.lineTo(-.2, -6.4); ctx.lineTo(-4.2, -5); ctx.closePath(); }, CLIP, spec.outline, .6, () => {
              ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-4, -7.2, 3, .4);
            });
          }
        }
      };
    };

    AS.addSprite('yugito', yugitoSpec(), { scale: 1.3, box: [-40, -84, 40, 10] }, { hair: '#f2d27a', fringe: 'part', accent: '#5a8aff' });
    AS.addSprite('roshi', roshiSpec(), { scale: 1.44, box: [-40, -84, 42, 8] }, { hair: '#cf3a20', fringe: 'spiky', accent: '#ff5a2a' });
    AS.addSprite('han', hanSpec(), { scale: 1.62, box: [-40, -90, 44, 8] }, { hair: '#3a302c', fringe: 'hood', accent: '#e8e0d0' });
    AS.addSprite('utakata', utakataSpec(), { scale: 1.36, box: [-40, -84, 44, 8] }, { hair: '#2c2834', fringe: 'part', accent: '#9ae0c0' });
    AS.addSprite('fu', fuSpec(), { scale: 1.24, box: [-40, -84, 40, 8] }, { hair: '#7fe3b6', fringe: 'spiky', accent: '#8ae05a' });
  }

  // ================================================================== members
  const members = {
    yugito: { name: 'NII YUGITO — NHỊ VĨ', accent: '#5a8aff', hpScale: 3.2, damageScale: 1.85 },
    roshi: { name: 'RŌSHI — TỨ VĨ', accent: '#ff6a2a', hpScale: 3.4, damageScale: 1.85, armor: .9 },
    han: { name: 'HAN — NGŨ VĨ', accent: '#f0e6d6', hpScale: 3.4, damageScale: 1.9, armor: .85 },
    utakata: { name: 'UTAKATA — LỤC VĨ', accent: '#9ae0c0', hpScale: 3.1, damageScale: 1.8 },
    fu: { name: 'FŪ — THẤT VĨ', accent: '#8ae05a', hpScale: 3.0, damageScale: 1.8 }
  };
  const order = Object.keys(members);
  const pick = level => order[((level % order.length) + order.length) % order.length];

  // ================================================================== moves
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const mv = (label, rgb, windup, after, cloak) => ({ label, rgb, windup, after, cloak: !!cloak });
  const MOVES = {
    yugito: {
      claws: mv('MIÊU TRẢO · QUỶ HỎA TRẢM', '90,160,255', .75, 1.3, 1),
      pounce: mv('NHỊ VĨ · MIÊU HỎA XUNG', '90,160,255', .8, 1.4, 1),
      volley: mv('QUỶ HỎA · LAM VIÊM ĐẠN', '120,180,255', .9, 1.5),
      ring: mv('QUỶ ĐĂNG · LAM HỎA LUÂN', '90,150,255', 1.0, 1.6, 1),
      beast: mv('VĨ THÚ HÓA · NHỊ VĨ MATATABI', '110,170,255', 1.3, 2.0, 1)
    },
    roshi: {
      globs: mv('DUNG ĐỘN · NHAM CẦU VŨ', '255,120,40', .95, 1.5),
      melt: mv('DUNG ĐỘN · HÓA DUNG THUẬT', '255,100,30', 1.0, 1.6, 1),
      stream: mv('DUNG ĐỘN · DUNG NHAM LÃNG', '255,130,40', .9, 1.5, 1),
      fist: mv('TỨ VĨ · NHAM QUYỀN XUNG', '255,90,30', .85, 1.4, 1),
      beast: mv('VĨ THÚ HÓA · TỨ VĨ SON GOKŪ', '255,110,40', 1.3, 2.0, 1)
    },
    han: {
      punch: mv('BỘC ĐỘN · CHƯNG KHÍ QUYỀN', '255,240,230', .8, 1.3, 1),
      boil: mv('BỘC ĐỘN · CHƯNG BỘC TUYỀN', '255,230,220', 1.0, 1.6),
      cloud: mv('BỘC ĐỘN · NHIỆT CHƯNG VÂN', '255,220,210', .9, 1.5, 1),
      kicks: mv('NGŨ VĨ · LIÊN HOÀN XUNG KÍCH', '255,235,225', .9, 1.5, 1),
      beast: mv('VĨ THÚ HÓA · NGŨ VĨ KOKUŌ', '255,245,240', 1.3, 2.0, 1)
    },
    utakata: {
      drift: mv('BÀO ĐỘN · BỘC LIỆT BÀO', '150,230,255', .9, 1.6),
      acid: mv('BÀO ĐỘN · TOAN BÀO LƯU', '170,240,100', .85, 1.5, 1),
      prison: mv('BÀO ĐỘN · BÀO LAO', '150,230,255', 1.1, 1.7),
      rain: mv('BÀO ĐỘN · VŨ BÀO TRẬN', '160,230,255', 1.0, 1.6, 1),
      beast: mv('VĨ THÚ HÓA · LỤC VĨ SAIKEN', '170,240,220', 1.3, 2.0, 1)
    },
    fu: {
      powder: mv('BÍ THUẬT · LÂN PHẤN MỤC LÓA', '255,235,120', .9, 1.5, 1),
      fly: mv('THẤT VĨ · TRÙNG SÍ PHI XUNG', '170,240,110', .8, 1.5, 1),
      bomb: mv('LÂN PHẤN · BỘC LIỆT', '255,220,100', 1.0, 1.6),
      gust: mv('THẤT VĨ · SÍ PHONG ĐẠI LÃNG', '190,250,140', .9, 1.5, 1),
      beast: mv('VĨ THÚ HÓA · THẤT VĨ CHŌMEI', '180,255,120', 1.3, 2.0, 1)
    }
  };
  const CYCLES = Object.fromEntries(Object.entries(MOVES).map(([id, m]) => [id, Object.keys(m)]));
  // Manual control (team mode): keys 1..5 follow the cycle, the tailed-beast transformation (ultimate) last.
  const moves = z => (CYCLES[z && z.bossId] || []).map(k => ({ label: MOVES[z.bossId][k].label }));

  const BEAST = { yugito: 'matatabi', roshi: 'songoku', han: 'kokuo', utakata: 'saiken', fu: 'chomei' };
  const BEAST_NAME = { yugito: 'NHỊ VĨ · MATATABI — YUGITO', roshi: 'TỨ VĨ · SON GOKŪ — RŌSHI', han: 'NGŨ VĨ · KOKUŌ — HAN', utakata: 'LỤC VĨ · SAIKEN — UTAKATA', fu: 'THẤT VĨ · CHŌMEI — FŪ' };
  const BEAST_DUR = { yugito: 8.2, roshi: 8.4, han: 8.6, utakata: 8.4, fu: 8.8 };
  const BK = 1.85;           // beast drawing scale (≈ 280–350 px tall)
  const FLY_PX = 70;         // how high Chōmei hovers

  // Partial-transformation cloaks: tails, ears/horns and the chakra's own matter.
  const CLOAK = {
    yugito: { tails: 2, fill: '30,80,230', dark: '8,24,96', glow: '80,150,255', ears: 'cat', fx: 'bfire' },
    roshi: { tails: 4, fill: '210,60,14', dark: '80,14,4', glow: '255,130,40', ears: 'ape', fx: 'lava' },
    han: { tails: 5, fill: '236,232,226', dark: '120,108,104', glow: '255,236,220', ears: 'horn', fx: 'steam' },
    utakata: { tails: 6, fill: '110,210,196', dark: '24,90,90', glow: '170,255,232', ears: 'none', fx: 'bubble' },
    fu: { tails: 6, fill: '150,220,60', dark: '40,84,20', glow: '210,255,120', ears: 'none', fx: 'powder', wings: true }
  };

  // Elements: glow colours, puffs and stains for every effect painter.
  const EL = {
    bfire: { rgb: '70,140,255', hot: '170,220,255', stain: '16,24,60', puff: 'jc:bfire' },
    lava: { rgb: '255,110,30', hot: '255,210,120', stain: '40,16,10', puff: 'fire' },
    steam: { rgb: '255,236,226', hot: '255,200,170', stain: '70,64,64', puff: 'jc:steam' },
    bubble: { rgb: '140,220,255', hot: '230,250,255', stain: '40,90,110', puff: 'jc:foam' },
    acid: { rgb: '160,240,80', hot: '230,255,170', stain: '50,80,20', puff: 'jc:acid' },
    powder: { rgb: '255,232,110', hot: '255,255,220', stain: '90,90,30', puff: 'jc:powder' },
    tbb: { rgb: '160,90,255', hot: '230,210,255', stain: '24,14,30', puff: 'violet' }
  };
  const BEAST_EL = { yugito: 'bfire', roshi: 'lava', han: 'steam', utakata: 'acid', fu: 'powder' };

  function state(z) {
    return z.jc || (z.jc = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      plan: null, dash: null, beast: null, cloak: 0, cloakT: 0, hold: 0, rec: 0, fly: 0, flyT: 0, seed: 0, lastDraw: 0, r0: z.r || 22 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 90) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = z => (Spr() && Spr().height ? Spr().height(z.bossId) : 80);
  const R1 = v => Math.round(v);

  // Hit points covering a cone (true world geometry, same as its telegraph).
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
  // A scatter around (cx, cy) that always includes the centre (the target) first.
  function scatter(cx, cy, n, R, r) {
    const out = [{ x: R1(cx), y: R1(cy), r }], off = Math.random() * TAU;
    for (let i = 1; i < n; i++) {
      const a = off + i * 2.39996 + rand(-.3, .3), d = R * Math.sqrt(i / (n - 1)) * rand(.82, 1.08);
      out.push({ x: R1(cx + Math.cos(a) * d), y: R1(cy + Math.sin(a) * d), r: R1(r * rand(.88, 1.1)) });
    }
    return out;
  }
  // Spots inside a cone, for lingering pools left by a spray.
  function coneSpots(x, y, a, reach, half, n, r, t0, speed) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = reach * (.25 + .72 * (i + .5) / n), aa = a + (hash(i * 3.7 + x) - .5) * 1.6 * half;
      out.push({ x: R1(x + Math.cos(aa) * d), y: R1(y + Math.sin(aa) * d), r: R1(r * rand(.85, 1.15)), t0: t0 + d / speed, seed: R1(rand(0, 99)) });
    }
    return out;
  }

  // ------------------------------------------------------------------ jutsu selection
  function planFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const cone = (r, h, ox = x, oy = y) => ({ k: 'cone', x: ox, y: oy, a, r, h });
    st.plan = null;
    switch (z.bossId + ':' + move) {
      case 'yugito:claws': return [cone(440, .72)];
      case 'yugito:pounce': { const len = Math.max(420, Math.min(720, d + 150)); st.plan = { len }; return [line(len, 60), circ(x + ca * len, y + sa * len, 220)]; }
      case 'yugito:volley': { st.plan = { spots: scatter(tx, ty, 7, 270, 125) }; return st.plan.spots.map(s => circ(s.x, s.y, s.r)); }
      case 'yugito:ring': return [circ(x, y, 560, true), circ(x, y, 300)];
      case 'roshi:globs': { st.plan = { spots: scatter(tx, ty, 8, 320, 125) }; return st.plan.spots.map(s => circ(s.x, s.y, s.r)); }
      case 'roshi:melt': return [circ(x, y, 430), circ(x, y, 150, true)];
      case 'roshi:stream': return [cone(660, .42)];
      case 'roshi:fist': { const len = Math.max(380, Math.min(700, d + 120)); st.plan = { len }; return [line(len, 62), circ(x + ca * len, y + sa * len, 240)]; }
      case 'han:punch': { const len = Math.max(160, Math.min(460, d - 60)); st.plan = { len }; const ex = x + ca * len, ey = y + sa * len; return [line(len, 56), cone(400, .5, ex, ey)]; }
      case 'han:boil': { const s = scatter(tx, ty, 8, 330, 112); s.push({ x: R1(x), y: R1(y), r: 150 }); st.plan = { spots: s }; return s.map(q => circ(q.x, q.y, q.r)); }
      case 'han:cloud': return [cone(560, .55)];
      case 'han:kicks': {
        const side = Math.random() < .5 ? 1 : -1, a1 = a + side * .55, x1 = x + Math.cos(a1) * 280, y1 = y + Math.sin(a1) * 280;
        const a2 = Math.atan2(ty - y1, tx - x1) - side * .6, x2 = x1 + Math.cos(a2) * 280, y2 = y1 + Math.sin(a2) * 280;
        const a3 = Math.atan2(ty - y2, tx - x2), l3 = Math.max(120, Math.min(520, Math.hypot(tx - x2, ty - y2) + 40));
        st.plan = { side };
        return [line(280, 50, a1), line(280, 50, a2, x1, y1), line(l3, 50, a3, x2, y2), circ(x2 + Math.cos(a3) * l3, y2 + Math.sin(a3) * l3, 210)];
      }
      case 'utakata:drift': { st.plan = { spots: scatter(tx, ty, 9, 300, 115) }; return st.plan.spots.map(s => circ(s.x, s.y, s.r)); }
      case 'utakata:acid': return [cone(600, .38)];
      case 'utakata:prison': return [circ(tx, ty, 170), circ(tx, ty, 300, true)];
      case 'utakata:rain': {
        const s = [];
        for (let i = 0; i < 16; i++) { const an = Math.random() * TAU, dd = i ? 420 * Math.sqrt(Math.random()) : 0; s.push({ x: R1(tx + Math.cos(an) * dd), y: R1(ty + Math.sin(an) * dd), r: 82 }); }
        st.plan = { spots: s };
        return [circ(tx, ty, 470, true)].concat(s.slice(0, 6).map(q => circ(q.x, q.y, q.r)));
      }
      case 'fu:powder': return [cone(560, .5)];
      case 'fu:fly': { const len = Math.max(380, Math.min(760, d + 180)); st.plan = { len }; return [line(len, 60), circ(tx, ty, 210, true)]; }
      case 'fu:bomb': { st.plan = { spots: scatter(tx, ty, 7, 290, 122) }; return st.plan.spots.map(s => circ(s.x, s.y, s.r)); }
      case 'fu:gust': return [{ k: 'band', x, y, a, len: 900, w: 330 }];
    }
    if (move === 'beast') return [circ(x, y, 320), circ(x, y, 900, true)];
    return [];
  }

  function announce(z, st, api, forced) {
    const cyc = CYCLES[z.bossId];
    const move = forced || cyc[st.casts % cyc.length];
    if (!forced) st.casts++;
    const def = MOVES[z.bossId][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
    st.tx = p ? R1(p.x) : R1(z.x); st.ty = p ? R1(p.y) : R1(z.y);
    st.seed = R1(rand(0, 99));
    st.tele = planFor(z, st, move);
    if (def.cloak) st.cloakT = def.windup + 1.4;
  }

  // Straight-line dash: houses on the way are smashed, walls stop it.
  function startDash(z, st, a, len, dur, dmg, w, el, end) {
    st.dash = { a, speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end };
    addFx(st, { kind: 'dash', pts: [], a, el, dur: dur + .5, seed: R1(rand(0, 99)), x0: R1(z.x), y0: R1(z.y), x1: R1(z.x), y1: R1(z.y), id: z.bossId });
  }
  function aimAt(z, api) { const p = api.player; return p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0; }
  function distTo(z, api) { const p = api.player; return p ? Math.hypot(p.x - z.x, p.y - z.y) : 300; }

  // Generic timed blasts: each spot gets a ground mark, then hits at s.t (fx age). Optional projectile
  // (from mouth / sky / drifting bubble) or an erupting column. dmg 0 = purely visual.
  function spotsFx(st, el, list, dmg, o = {}) {
    let last = 0;
    for (const s of list) { s.seed = s.seed ?? R1(rand(0, 99)); s.done = 0; last = Math.max(last, s.t); }
    const fx = addFx(st, Object.assign({ kind: 'spots', el, list, dmg, dur: last + 1.6 }, o));
    fx.upd = (fx, dt, api) => {
      for (const s of fx.list) {
        if (s.done || fx.age < s.t) continue;
        s.done = 1;
        if (fx.dmg > 0) api.strike(s.x, s.y, s.r, fx.dmg * (s.k || 1), null, s.kind || null, true);
        if (s.kind === 'crater' || s.world) api.world(s.x, s.y, s.r * .85, (fx.dmg || 60) * 2.2, s.kind === 'crater' ? 'crater' : 'shockwave');
        api.shake(s.r > 180 ? 12 : 5);
      }
    };
    return fx;
  }
  // Lingering hazards (lava pools, blue flames, acid puddles, scalding steam, scale-powder fog).
  function poolFx(st, el, list, dmg, dur, tick = .5) {
    for (const s of list) { s.t0 = s.t0 || 0; s.seed = s.seed ?? R1(rand(0, 99)); }
    const fx = addFx(st, { kind: 'pool', el, list, dmg, dur, tick: .3, step: tick });
    fx.upd = (fx, dt, api) => {
      if ((fx.tick -= dt) > 0 || fx.age > fx.dur - .5) return;
      fx.tick = fx.step;
      for (const s of fx.list) if (fx.age > s.t0 + .15) api.strike(s.x, s.y, s.r * .9, fx.dmg, null, null, true);
    };
    return fx;
  }
  // Spray cone (lava / steam / acid / powder) whose hits follow the front.
  function sprayFx(st, el, x, y, a, r, h, speed, dmg, api) {
    conePts(x, y, a, r, h).forEach(p => later(st, .04 + p.d / speed, api => api.strike(p.x, p.y, p.r, dmg, null, null, true)));
    later(st, r * .5 / speed, api => api.world(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, 150, dmg * 1.6, el === 'lava' || el === 'bfire' ? 'fire' : 'vortex', a));
    return addFx(st, { kind: 'cone', el, x: R1(x), y: R1(y), a, r, h, speed, dur: r / speed + 1.1, seed: R1(rand(0, 99)) });
  }
  // Expanding ring wave; hits the band at its front, once per 70 px.
  function ringFx(st, el, x, y, r0, r1, speed, dmg) {
    const fx = addFx(st, { kind: 'ring', el, x: R1(x), y: R1(y), r0, r1, speed, dur: (r1 - r0) / speed + 1.2, hitR: r0, dmg, seed: R1(rand(0, 99)) });
    fx.upd = (fx, dt, api) => {
      const front = fx.r0 + fx.age * fx.speed;
      while (fx.hitR <= fx.r1 && front >= fx.hitR) {
        const R = fx.hitR, n = Math.max(6, Math.ceil(TAU * R / 95));
        for (let i = 0; i < n; i++) { const an = i * TAU / n; api.strike(fx.x + Math.cos(an) * R, fx.y + Math.sin(an) * R, 62, fx.dmg, null, null, true); }
        if (R > 150 && (R - fx.r0) % 210 < 70) for (let i = 0; i < 3; i++) { const an = hash(R + i) * TAU; api.world(fx.x + Math.cos(an) * R, fx.y + Math.sin(an) * R, 120, fx.dmg * 2, el === 'lava' || el === 'bfire' ? 'fire' : 'shockwave'); }
        fx.hitR += 70;
      }
    };
    return fx;
  }
  function teleFx(st, shapes, rgb, dur) { return addFx(st, { kind: 'tele', shapes, rgb, dur }); }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const id = z.bossId, move = st.move, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = st.seed, P = st.plan;
    const fac = facingOf(z), H = bodyH(z), tx = st.tx, ty = st.ty;
    const mouth = { ox: R1(z.x + fac * 12), oy: R1(z.y), oh: R1(H * .78) };
    switch (id + ':' + move) {
      // ---------------- Yugito
      case 'yugito:claws': {
        const R = 440, Hh = .72;
        for (let k = 0; k < 3; k++) later(st, k * .13, api => {
          conePts(z.x, z.y, a, R, Hh).forEach(p => api.strike(p.x, p.y, p.r, D * 1.25, null, null, true));
          addFx(st, { kind: 'claw', el: 'bfire', x: R1(z.x), y: R1(z.y), a: a + (k - 1) * .2, r: R, h: Hh, side: k % 2 ? 1 : -1, dur: 1.0, seed: seed + k * 3 });
          api.shake(6); api.burst(z.x + ca * 60, z.y + sa * 60 - 30, '#7ab4ff', 6);
        });
        poolFx(st, 'bfire', coneSpots(z.x, z.y, a, R, Hh, 6, 58, .25, 2000), D * .3, 3.2);
        later(st, .36, api => api.world(z.x + ca * 260, z.y + sa * 260, 150, D * 2.2, 'fire', a));
        st.hold = .55;
        break;
      }
      case 'yugito:pounce': {
        const len = P.len, list = [];
        for (let d = 60; d < len; d += 95) list.push({ x: R1(z.x + ca * d), y: R1(z.y + sa * d), r: 58, t0: d / len * .36 });
        poolFx(st, 'bfire', list, D * .3, 3.4);
        startDash(z, st, a, len, .36, D * 2.2, 60, 'bfire', api => {
          api.strike(z.x, z.y, 220, D * 2.4, null, 'crater', true);
          api.knockback(z, 230, 220, 0);
          api.world(z.x + ca * 60, z.y + sa * 60, 180, D * 3, 'fire', a);
          api.shake(16);
          spotsFx(st, 'bfire', [{ x: R1(z.x), y: R1(z.y), r: 230, t: 0, m: 0 }], 0);
        });
        break;
      }
      case 'yugito:volley': {
        const list = P.spots.map((s, i) => Object.assign(s, { t: .48 + i * .1, fl: .48, ox: mouth.ox, oy: mouth.oy, oh: mouth.oh, arc: 150, kind: i < 2 ? 'fire' : null, m: 0 }));
        spotsFx(st, 'bfire', list, D * 1.8);
        st.hold = .5; api.shake(5);
        break;
      }
      case 'yugito:ring': {
        ringFx(st, 'bfire', z.x, z.y, 60, 560, 820, D * 1.8);
        const list = [];
        for (let i = 0; i < 9; i++) { const an = i * TAU / 9 + seed; list.push({ x: R1(z.x + Math.cos(an) * 300), y: R1(z.y + Math.sin(an) * 300), r: 86, t: .3 + i * .025, col: 1, m: 0 }); }
        spotsFx(st, 'bfire', list, D * 1.2);
        api.strike(z.x, z.y, 140, D * 1.6, null, 'fire', true);
        api.shake(12); st.hold = .6;
        break;
      }
      // ---------------- Rōshi
      case 'roshi:globs': {
        const list = P.spots.map((s, i) => Object.assign(s, { t: .55 + i * .11, fl: .55, ox: mouth.ox, oy: mouth.oy, oh: mouth.oh, arc: 200, kind: i < 3 ? 'fire' : null, m: 0 }));
        spotsFx(st, 'lava', list, D * 1.9);
        poolFx(st, 'lava', list.map(s => ({ x: s.x, y: s.y, r: 74, t0: s.t })), D * .32, list[list.length - 1].t + 3.6);
        st.hold = .6; api.shake(6);
        break;
      }
      case 'roshi:melt': {
        api.strike(z.x, z.y, 130, D * 1.6, null, 'fire', true);
        api.knockback(z, 200, 150, 0);
        ringFx(st, 'lava', z.x, z.y, 50, 430, 640, D * 2.1);
        const list = [];
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + seed, d = 170 + hash(i + seed) * 200; list.push({ x: R1(z.x + Math.cos(an) * d), y: R1(z.y + Math.sin(an) * d), r: 70, t0: d / 640 }); }
        poolFx(st, 'lava', list, D * .32, 4.2);
        spotsFx(st, 'lava', [{ x: R1(z.x), y: R1(z.y), r: 170, t: 0, m: 0 }], 0);
        api.shake(14); st.hold = .8; st.cloakT = 2;
        break;
      }
      case 'roshi:stream': {
        const ox = z.x + ca * 16, oy = z.y + sa * 8;
        sprayFx(st, 'lava', ox, oy, a, 660, .42, 1100, D * 1.6, api);
        poolFx(st, 'lava', coneSpots(ox, oy, a, 660, .42, 6, 72, .1, 1100), D * .34, 4.6);
        st.hold = .8; api.shake(9);
        break;
      }
      case 'roshi:fist': {
        startDash(z, st, a, P.len, .34, D * 2.3, 62, 'lava', api => {
          const ex = z.x, ey = z.y;
          api.strike(ex, ey, 240, D * 2.8, null, 'crater', true);
          api.knockback(z, 250, 230, 0);
          api.world(ex + ca * 60, ey + sa * 60, 200, D * 3.2, 'crater');
          api.shake(18);
          const list = [{ x: R1(ex), y: R1(ey), r: 250, t: 0, m: 0, k: 0 }];
          for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + seed; list.push({ x: R1(ex + Math.cos(an) * 185), y: R1(ey + Math.sin(an) * 185), r: 70, t: .14 + i * .04, col: 1, m: 0 }); }
          spotsFx(st, 'lava', list, D * 1.2);
          poolFx(st, 'lava', [{ x: R1(ex), y: R1(ey), r: 110, t0: 0 }], D * .34, 4.2);
        });
        break;
      }
      // ---------------- Han
      case 'han:punch': {
        startDash(z, st, a, P.len, .2, D * 1.8, 56, 'steam', api => {
          const ex = z.x, ey = z.y;
          sprayFx(st, 'steam', ex, ey, a, 400, .5, 1900, D * 2.3, api);
          api.knockback(z, 400, 210, 0);
          api.world(ex + ca * 140, ey + sa * 140, 170, D * 3, 'shockwave', a);
          api.shake(15);
          spotsFx(st, 'steam', [{ x: R1(ex + ca * 30), y: R1(ey + sa * 30), r: 150, t: 0, m: 0 }], 0);
        });
        break;
      }
      case 'han:boil': {
        const list = P.spots.map((s, i) => Object.assign(s, { t: .22 + i * .09, col: 1, m: 0, kind: i % 3 ? null : 'crater' }));
        spotsFx(st, 'steam', list, D * 2.0);
        st.hold = .6; api.shake(6);
        break;
      }
      case 'han:cloud': {
        sprayFx(st, 'steam', z.x + ca * 16, z.y + sa * 8, a, 560, .55, 900, D * 1.3, api);
        poolFx(st, 'steam', coneSpots(z.x, z.y, a, 560, .55, 7, 90, .1, 900), D * .42, 3.6, .45);
        st.hold = .8; api.shake(8);
        break;
      }
      case 'han:kicks': {
        const side = P ? P.side : 1;
        const kick = (aa, len, last) => api2 => {
          const ex = z.x, ey = z.y;
          api2.strike(ex, ey, last ? 210 : 150, D * (last ? 2.6 : 1.8), null, last ? 'crater' : null, true);
          spotsFx(st, 'steam', [{ x: R1(ex), y: R1(ey), r: last ? 230 : 150, t: 0, m: 0 }], 0);
          api2.shake(last ? 16 : 8);
          if (last) { api2.knockback(z, 230, 220, 0); api2.world(ex, ey, 190, D * 3, 'crater'); }
        };
        startDash(z, st, a + side * .55, 280, .18, D * 1.6, 54, 'steam', api1 => {
          kick(0, 0, false)(api1);
          const a2 = aimAt(z, api1) - side * .6;
          st.hold = .9;
          startDash(z, st, a2, 280, .18, D * 1.6, 54, 'steam', api2 => {
            kick(0, 0, false)(api2);
            const a3 = aimAt(z, api2), l3 = Math.max(120, Math.min(520, distTo(z, api2) + 40));
            startDash(z, st, a3, l3, .2, D * 1.8, 56, 'steam', api3 => kick(0, 0, true)(api3));
          });
        });
        break;
      }
      // ---------------- Utakata
      case 'utakata:drift': {
        const list = P.spots.map((s, i) => Object.assign(s, { t0: i * .07, fl: .95, t: i * .07 + .95 + .32, ox: R1(z.x + fac * 26), oy: R1(z.y), oh: R1(H * .74), drift: 1, m: 0 }));
        spotsFx(st, 'bubble', list, D * 1.9);
        st.hold = .5;
        break;
      }
      case 'utakata:acid': {
        const ox = z.x + ca * 26, oy = z.y + sa * 10;
        sprayFx(st, 'acid', ox, oy, a, 600, .38, 1000, D * 1.5, api);
        poolFx(st, 'acid', coneSpots(ox, oy, a, 600, .38, 6, 76, .1, 1000), D * .36, 4.6);
        st.hold = .8; api.shake(5);
        break;
      }
      case 'utakata:prison': {
        const fx = addFx(st, { kind: 'prison', x: tx, y: ty, r: 160, pop: 1.0, dur: 2.4, seed, done: 0 });
        fx.upd = (fx, dt, api) => {
          if (fx.done || fx.age < fx.pop) return;
          fx.done = 1;
          api.strike(fx.x, fx.y, 175, D * 3.2, null, 'vortex', true);
          api.knockback({ x: fx.x, y: fx.y }, 220, 120, 0);
          api.world(fx.x, fx.y, 150, D * 2.4, 'vortex');
          api.shake(16);
          const list = [];
          for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + fx.seed; list.push({ x: R1(fx.x + Math.cos(an) * 230), y: R1(fx.y + Math.sin(an) * 230), r: 86, t: .22 + i * .05, m: 0 }); }
          spotsFx(st, 'bubble', list, D * 1.2);
        };
        st.hold = .6;
        break;
      }
      case 'utakata:rain': {
        const list = P.spots.map((s, i) => Object.assign(s, { t: .45 + i * .075, fl: .45, ox: s.x, oy: s.y, oh: 460, arc: 0, sky: 1, m: 0 }));
        spotsFx(st, 'bubble', list, D * 1.3);
        st.hold = .5;
        break;
      }
      // ---------------- Fū
      case 'fu:powder': {
        const ox = z.x + ca * 14, oy = z.y + sa * 6;
        sprayFx(st, 'powder', ox, oy, a, 560, .5, 900, D * 1.2, api);
        poolFx(st, 'powder', coneSpots(ox, oy, a, 560, .5, 7, 100, .1, 900), D * .3, 3.8, .45);
        st.hold = .8;
        break;
      }
      case 'fu:fly': {
        st.flyT = 2.6;
        later(st, .12, api0 => startDash(z, st, a, P.len, .3, D * 1.9, 60, 'powder', api1 => {
          api1.shake(6);
          const a2 = aimAt(z, api1), l2 = Math.max(300, Math.min(720, distTo(z, api1) + 180));
          startDash(z, st, a2, l2, .3, D * 1.9, 60, 'powder', api2 => {
            api2.shake(6);
            const a3 = aimAt(z, api2), l3 = Math.max(100, Math.min(640, distTo(z, api2)));
            startDash(z, st, a3, l3, .26, D * 2, 62, 'powder', api3 => {
              api3.strike(z.x, z.y, 210, D * 2.4, null, 'crater', true);
              api3.knockback(z, 220, 200, 0);
              api3.world(z.x, z.y, 180, D * 3, 'crater');
              api3.shake(16);
              spotsFx(st, 'powder', [{ x: R1(z.x), y: R1(z.y), r: 230, t: 0, m: 0 }], 0);
              st.flyT = .35;
            });
          });
        }));
        st.hold = .3;
        break;
      }
      case 'fu:bomb': {
        const list = P.spots.map((s, i) => Object.assign(s, { t: .5 + i * .09, m: 0, glow: 1, kind: i < 2 ? 'crater' : null }));
        spotsFx(st, 'powder', list, D * 2.0);
        st.hold = .5;
        break;
      }
      case 'fu:gust': {
        const len = 900, w = 330, sp = 1300, x0 = z.x, y0 = z.y, nx = -sa, ny = ca;
        for (let d = 70; d <= len; d += 110) later(st, d / sp, api => {
          const cx = x0 + ca * d, cy = y0 + sa * d;
          api.line(cx - nx * w, cy - ny * w, cx + nx * w, cy + ny * w, 60, D * 1.6, d % 330 < 110 ? 'shockwave' : null);
        });
        api.knockback(z, 420, 220, 0);
        addFx(st, { kind: 'gust', x: R1(x0), y: R1(y0), a, w, len, speed: sp, dur: len / sp + 1, seed });
        st.hold = .7; api.shake(10);
        break;
      }
    }
    if (move === 'beast') startBeast(z, st, api);
  }

  // ------------------------------------------------------------------ the full tailed beast (ultimate)
  const beastMouth = (b) => {
    const TB = window.TailedBeasts, m = TB && TB.members[b.id] && TB.members[b.id].mouth || [80, -100];
    return { x: b.x + b.f * m[0] * BK, y: b.y, h: -m[1] * BK + b.lift * FLY_PX };
  };
  function bijudama(z, st, tAim, tFire) {
    later(st, tAim, api => {
      const b = st.beast; if (!b) return;
      const p = api.player;
      b.f = p ? (p.x >= b.x ? 1 : -1) : b.f;
      const mo = beastMouth(b);
      b.charge = { t0: b.t, fire: tFire - tAim, a: p ? Math.atan2(p.y - b.y, p.x - mo.x) : (b.f > 0 ? 0 : Math.PI), len: p ? R1(Math.max(450, Math.min(1150, Math.hypot(p.x - mo.x, p.y - b.y) + 80))) : 900 };
    });
    later(st, tFire, api => {
      const b = st.beast; if (!b || !b.charge) return;
      const D = api.damage || 60, a = b.charge.a, c = Math.cos(a), s = Math.sin(a), mo = beastMouth(b), len = b.charge.len || 1000, sp = 2600;
      const x0 = mo.x, y0 = b.y + s * 20;
      for (let d = 0; d < len; d += 230) later(st, d / sp, api => api.line(x0 + c * d, y0 + s * d, x0 + c * Math.min(len, d + 230), y0 + s * Math.min(len, d + 230), 100, D * 2.6, d % 460 === 0 ? 'crater' : null));
      later(st, len / sp, api => {
        const ex = x0 + c * len, ey = y0 + s * len;
        api.strike(ex, ey, 400, D * 4.4, null, 'crater', true);
        api.world(ex, ey, 360, D * 4, 'crater');
        api.shake(28);
      });
      addFx(st, { kind: 'tbb', x0: R1(x0), y0: R1(y0), h0: R1(mo.h), a, len, speed: sp, dur: len / sp + 2.1, bt: len / sp, blast: 400, seed: R1(rand(0, 99)), tint: CLOAK[z.bossId].glow });
      b.charge = null; b.act = .5;
      api.shake(14);
    });
  }
  function startBeast(z, st, api) {
    const D = api.damage || 60, id = z.bossId, el = BEAST_EL[id], seed = st.seed;
    const b = st.beast = { id: BEAST[id], t: 0, x: R1(z.x), y: R1(z.y), f: facingOf(z), dur: BEAST_DUR[id], lift: 0, liftT: id === 'fu' ? 1 : 0, act: 0, charge: null, dash: null, swoop: null, seed };
    st.cloakT = 0; st.cloak = 0;
    addFx(st, { kind: 'transform', el, x: b.x, y: b.y, r: 340, dur: 2.0, seed, rgb: CLOAK[id].glow });
    api.strike(z.x, z.y, 320, D * 2.4, null, 'crater', true);
    api.knockback(z, 340, 140, 0);
    api.world(z.x, z.y, 260, D * 3, 'crater');
    api.shake(24);
    const P = () => api.player;
    const tgt = (api2) => { const p = api2.player; return p ? { x: R1(p.x), y: R1(p.y) } : { x: R1(b.x + b.f * 300), y: R1(b.y) }; };
    switch (id) {
      case 'yugito': {
        // three giant flaming claw slams hunting the target, a blue flame sea, then the Tailed Beast Ball
        for (let i = 0; i < 3; i++) later(st, .8 + i * .62, api2 => {
          const t = tgt(api2); if (!st.beast) return;
          st.beast.f = t.x >= st.beast.x ? 1 : -1; st.beast.act = 1;
          const fx = spotsFx(st, 'bfire', [{ x: t.x, y: t.y, r: 210, t: .72, m: 0, kind: 'crater' }], D * 2.6);
          later(st, .72, () => addFx(st, { kind: 'claw', el: 'bfire', x: t.x - st.beast.f * 200, y: t.y, a: st.beast.f > 0 ? 0 : Math.PI, r: 300, h: .55, side: i % 2 ? 1 : -1, dur: 1.1, seed: seed + i * 4, big: 1 }));
          return fx;
        });
        later(st, 2.7, api2 => { const b2 = st.beast; if (!b2) return; const t = tgt(api2), a = Math.atan2(t.y - b2.y, t.x - b2.x); b2.coneA = a; b2.f = Math.cos(a) >= 0 ? 1 : -1; teleFx(st, [{ k: 'cone', x: b2.x, y: b2.y, a, r: 840, h: .5 }], '90,150,255', .75); });
        later(st, 3.45, api2 => {
          const b2 = st.beast; if (!b2) return; const a = b2.coneA ?? 0, mo = beastMouth(b2);
          sprayFx(st, 'bfire', mo.x, b2.y, a, 840, .5, 1150, D * 2.0, api2);
          poolFx(st, 'bfire', coneSpots(mo.x, b2.y, a, 840, .5, 8, 70, .1, 1150), D * .4, 4.2);
          b2.act = 1.2; api2.shake(14);
        });
        bijudama(z, st, 5.0, 6.3);
        break;
      }
      case 'roshi': {
        // lava rain from the maw, the volcano eruption ring, then the Tailed Beast Ball
        later(st, .7, api2 => {
          const b2 = st.beast; if (!b2) return; const t = tgt(api2), mo = beastMouth(b2);
          b2.f = t.x >= b2.x ? 1 : -1; b2.act = 2.4;
          const list = scatter(t.x, t.y, 10, 400, 150).map((s, i) => Object.assign(s, { t: .9 + i * .15, fl: .8, ox: R1(mo.x), oy: R1(b2.y), oh: R1(mo.h), arc: 260, m: 0, kind: i < 4 ? 'crater' : null }));
          spotsFx(st, 'lava', list, D * 2.2);
          poolFx(st, 'lava', list.map(s => ({ x: s.x, y: s.y, r: 90, t0: s.t })), D * .36, list[9].t + 3.4);
        });
        later(st, 3.0, () => { const b2 = st.beast; if (b2) teleFx(st, [{ k: 'c', x: b2.x, y: b2.y, r: 600 }], '255,110,40', .65); });
        later(st, 3.65, api2 => {
          const b2 = st.beast; if (!b2) return;
          ringFx(st, 'lava', b2.x, b2.y, 90, 600, 720, D * 2.4);
          const list = [];
          for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + seed; list.push({ x: R1(b2.x + Math.cos(an) * 340), y: R1(b2.y + Math.sin(an) * 340), r: 90, t: .32 + i * .03, col: 1, m: 0 }); }
          spotsFx(st, 'lava', list, D * 1.4);
          b2.act = 1; api2.shake(22);
        });
        bijudama(z, st, 5.3, 6.6);
        break;
      }
      case 'han': {
        // two horn charges straight through everything, a steam-dome explosion, then the Tailed Beast Ball
        const charge = (tAim, tGo) => {
          later(st, tAim, api2 => {
            const b2 = st.beast; if (!b2) return; const t = tgt(api2), a = Math.atan2(t.y - b2.y, t.x - b2.x);
            b2.chA = a; b2.f = Math.cos(a) >= 0 ? 1 : -1; b2.act = .8;
            teleFx(st, [{ k: 'line', x: b2.x, y: b2.y, a, len: 920, w: 95 }], '255,240,230', tGo - tAim);
          });
          later(st, tGo, api2 => {
            const b2 = st.beast; if (!b2) return;
            b2.dash = { a: b2.chA ?? 0, speed: 2050, left: .45, hit: 0, wt: 0 };
            api2.shake(12);
          });
        };
        charge(.75, 1.55); charge(2.65, 3.45);
        later(st, 4.25, () => { const b2 = st.beast; if (b2) teleFx(st, [{ k: 'c', x: b2.x, y: b2.y, r: 440 }], '255,236,226', .75); });
        later(st, 5.0, api2 => {
          const b2 = st.beast; if (!b2) return;
          api2.strike(b2.x, b2.y, 440, D * 2.6, null, 'crater', true);
          api2.knockback({ x: b2.x, y: b2.y }, 460, 200, 0);
          api2.world(b2.x, b2.y, 380, D * 3, 'shockwave');
          const list = [{ x: b2.x, y: b2.y, r: 440, t: 0, m: 0 }];
          for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + seed; list.push({ x: R1(b2.x + Math.cos(an) * 360), y: R1(b2.y + Math.sin(an) * 360), r: 90, t: .1 + i * .03, col: 1, m: 0 }); }
          spotsFx(st, 'steam', list, 0);
          b2.act = 1; api2.shake(24);
        });
        bijudama(z, st, 5.9, 7.1);
        break;
      }
      case 'utakata': {
        // a barrage of giant bubbles, a corrosive slime wave, then the Tailed Beast Ball
        later(st, .7, api2 => {
          const b2 = st.beast; if (!b2) return; const t = tgt(api2), mo = beastMouth(b2);
          b2.f = t.x >= b2.x ? 1 : -1; b2.act = 2.4;
          const list = scatter(t.x, t.y, 14, 440, 140).map((s, i) => Object.assign(s, { t: .85 + i * .13, fl: .8, ox: R1(mo.x), oy: R1(b2.y), oh: R1(mo.h), arc: 220, big: 1, m: 0, kind: i < 3 ? 'crater' : null }));
          spotsFx(st, 'bubble', list, D * 1.9);
        });
        later(st, 3.15, api2 => { const b2 = st.beast; if (!b2) return; const t = tgt(api2), a = Math.atan2(t.y - b2.y, t.x - b2.x); b2.coneA = a; b2.f = Math.cos(a) >= 0 ? 1 : -1; teleFx(st, [{ k: 'cone', x: b2.x, y: b2.y, a, r: 780, h: .55 }], '160,240,80', .75); });
        later(st, 3.9, api2 => {
          const b2 = st.beast; if (!b2) return; const a = b2.coneA ?? 0, mo = beastMouth(b2);
          sprayFx(st, 'acid', mo.x, b2.y, a, 780, .55, 950, D * 2.1, api2);
          poolFx(st, 'acid', coneSpots(mo.x, b2.y, a, 780, .55, 8, 84, .1, 950), D * .4, 4.2);
          b2.act = 1.2; api2.shake(12);
        });
        bijudama(z, st, 5.4, 6.7);
        break;
      }
      case 'fu': {
        // Chōmei takes to the air: a scale-powder storm with flashes, a dive bomb, then the Tailed Beast Ball from the sky
        later(st, .8, api2 => {
          const b2 = st.beast; if (!b2) return; const t = tgt(api2);
          b2.f = t.x >= b2.x ? 1 : -1; b2.act = 1;
          const fog = [];
          for (let i = 0; i < 12; i++) { const an = i * 2.39996 + seed, d = 600 * Math.sqrt((i + .5) / 12); fog.push({ x: R1(t.x + Math.cos(an) * d), y: R1(t.y + Math.sin(an) * d), r: 120, t0: i * .05 }); }
          poolFx(st, 'powder', fog, D * .32, 4.0, .4);
          const list = scatter(t.x, t.y, 6, 420, 135).map((s, i) => Object.assign(s, { t: 1.0 + i * .4, m: .3 + i * .4, glow: 1 }));
          spotsFx(st, 'powder', list, D * 1.7);
        });
        later(st, 4.4, api2 => {
          const b2 = st.beast; if (!b2) return; const t = tgt(api2);
          b2.f = t.x >= b2.x ? 1 : -1;
          b2.dive = { x: t.x, y: t.y };
          spotsFx(st, 'powder', [{ x: t.x, y: t.y, r: 300, t: .85, m: 0, kind: 'crater' }], D * 3);
          later(st, .45, () => { const b3 = st.beast; if (b3 && b3.dive) b3.swoop = { x0: b3.x, y0: b3.y, x1: b3.dive.x - b3.f * 60, y1: b3.dive.y, t0: b3.t, dur: .4 }; });
        });
        bijudama(z, st, 6.0, 7.3);
        break;
      }
    }
  }
  function endBeast(z, st, quiet) {
    const b = st.beast; if (!b) return;
    addFx(st, { kind: 'transform', el: BEAST_EL[z.bossId], x: R1(b.x), y: R1(b.y), r: 300, dur: 1.6, seed: b.seed + 9, revert: 1, rgb: CLOAK[z.bossId].glow });
    st.beast = null; z.r = st.r0 || z.r;
    if (!quiet) st.timer = MOVES[z.bossId].beast.after;
  }

  // ------------------------------------------------------------------ update
  function update(z, dt, api) {
    if (!members[z.bossId]) return;
    const st = state(z), m = members[z.bossId];
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.fly = 0;
      if (st.beast) endBeast(z, st, true);
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.rec = Math.max(0, st.rec - dt);
    st.cloakT = Math.max(0, st.cloakT - dt);
    st.flyT = Math.max(0, st.flyT - dt);
    const want = st.cloakT > 0 || st.dash ? 1 : 0;
    st.cloak += (want - st.cloak) * Math.min(1, dt * (want ? 7 : 3));
    const fw = st.flyT > 0 ? 1 : 0;
    st.fly += (fw - st.fly) * Math.min(1, dt * (fw ? 6 : 4));
    z.armorScale = (m.armor || 1) * (st.beast ? .6 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if ((ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 90, D * 2.6, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      for (let i = st.fx.length - 1; i >= 0; i--) {
        const tr = st.fx[i];
        if (tr.kind !== 'dash') continue;
        tr.x1 = R1(z.x); tr.y1 = R1(z.y); tr.pts.push(R1(z.x), R1(z.y)); if (tr.pts.length > 16) tr.pts.splice(0, 2);
        break;
      }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (end) end(api); }
    }
    if (st.beast) {
      const b = st.beast, D = api.damage || 60;
      b.t += dt;
      b.act = Math.max(0, b.act - dt);
      b.lift += ((b.liftT || 0) - b.lift) * Math.min(1, dt * 2.5);
      z.kageDash = Math.max(z.kageDash, .05);
      z.r = (st.r0 || 22) * 1.8;
      if (b.dash) {
        // Kokuō's horn charge: the beast (and the boss with it) rams in a straight line
        const ds = b.dash, step = Math.min(ds.left, dt) * ds.speed, nx = b.x + Math.cos(ds.a) * step, ny = b.y + Math.sin(ds.a) * step;
        ds.left -= dt;
        b.x = nx; b.y = ny;
        if (!api.blocked(nx, ny, st.r0 || 22)) { z.x = nx; z.y = ny; }
        if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(b.x + Math.cos(ds.a) * 60, b.y + Math.sin(ds.a) * 30, 130, D * 2.2, null, null, true); }
        if ((ds.wt -= dt) <= 0) { ds.wt = .09; api.world(b.x + Math.cos(ds.a) * 80, b.y, 150, D * 3, 'shockwave', ds.a); }
        if (ds.left <= 0) {
          b.dash = null;
          api.strike(b.x, b.y, 260, D * 2.6, null, 'crater', true);
          api.knockback({ x: b.x, y: b.y }, 280, 180, 0);
          api.shake(18);
          spotsFx(st, 'steam', [{ x: R1(b.x), y: R1(b.y), r: 260, t: 0, m: 0 }], 0);
        }
      }
      if (b.swoop) {
        const s = b.swoop, k = clamp01((b.t - s.t0) / s.dur);
        b.x = s.x0 + (s.x1 - s.x0) * easeIn(k); b.y = s.y0 + (s.y1 - s.y0) * easeIn(k);
        b.lift = 1 - bell(k) * .85;
        if (!api.blocked(b.x, b.y, st.r0 || 22)) { z.x = b.x; z.y = b.y; }
        if (k >= 1) { b.swoop = null; b.dive = null; }
      }
      if (b.t >= b.dur) endBeast(z, st, false);
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.rec = .4;
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.beast && z.manual) {
      // Driven by the player: only the requested jutsu, no rotation.
      if (z.manualCast != null && st.rec <= 0 && st.hold <= 0) {
        const k = CYCLES[z.bossId][z.manualCast]; z.manualCast = null;
        if (k) announce(z, st, api, k);
      }
    } else if (!st.dash && !st.beast) {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, api);
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || st.rec > 0 || !!st.dash || !!st.beast || st.ev.length > 0;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.cloak = Math.max(0, st.cloak - dt * 3); st.fly = Math.max(0, st.fly - dt * 3);
    if (st.beast) endBeast(z, st, true);
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ================================================================== cached art
  const PUFF = {
    'jc:bfire': [[0, '#f4fbff'], [.2, '#a6d6ff'], [.45, '#3f8cff'], [.7, '#1c46cc'], [.88, 'rgba(14,28,120,.8)'], [1, 'rgba(10,20,90,0)']],
    'jc:steam': [[0, 'rgba(255,255,255,.97)'], [.45, 'rgba(242,240,238,.9)'], [.72, 'rgba(210,204,202,.58)'], [.9, 'rgba(170,164,162,.24)'], [1, 'rgba(160,150,150,0)']],
    'jc:foam': [[0, 'rgba(255,255,255,.95)'], [.5, 'rgba(222,246,255,.82)'], [.8, 'rgba(150,210,236,.42)'], [1, 'rgba(120,190,220,0)']],
    'jc:acid': [[0, '#f4ffd0'], [.35, '#bcf064'], [.65, '#6eaa2c'], [.88, 'rgba(40,80,16,.6)'], [1, 'rgba(30,60,10,0)']],
    'jc:powder': [[0, 'rgba(255,255,236,.96)'], [.35, 'rgba(252,242,150,.82)'], [.7, 'rgba(196,224,96,.42)'], [1, 'rgba(140,180,60,0)']],
    'jc:navy': [[0, 'rgba(30,40,90,.8)'], [.5, 'rgba(20,28,70,.55)'], [.85, 'rgba(14,20,50,.2)'], [1, 'rgba(10,16,40,0)']]
  };
  function puffImg(name) {
    const K = Kit();
    if (!PUFF[name]) return K.puff(name);
    return K.sprite('puff:' + name, 96, 96, g => {
      const gr = g.createRadialGradient(38, 36, 0, 48, 48, 48);
      for (const [s, c] of PUFF[name]) gr.addColorStop(s, c);
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  const BFLAME = [[1, '#0c2a8c'], [.84, '#1650e2'], [.66, '#3c8cff'], [.46, '#94ceff'], [.25, '#f2fbff']];
  // FLICK steps every 1/12 s so each tongue cycles through the six cached flame shapes: live, flickering fire.
  let FLICK = 0;
  const bflame = v => Kit().flame(((Math.floor(v) + FLICK) % 6 + 6) % 6, BFLAME, 'jcb');
  const rflame = v => Kit().flame(((Math.floor(v) + FLICK) % 6 + 6) % 6);
  // flame sprite with its base at (x, y)
  function tongue(ctx, img, x, y, w, h, alpha = 1) {
    if (h < 2 || alpha <= .01) return;
    // flames keep normal blending so their hue survives on bright ground (glows add light separately)
    const a = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalAlpha = a * Math.min(1, alpha); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, x - w / 2, y - h * (114 / 128), w, h);
    ctx.globalAlpha = a; ctx.globalCompositeOperation = op;
  }
  function bubbleImg() {
    return Kit().sprite('jc:bubble', 128, 128, g => {
      g.translate(64, 64);
      const gr = g.createRadialGradient(-18, -20, 4, 0, 0, 60);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(180,235,255,.16)'); gr.addColorStop(.86, 'rgba(120,200,240,.28)'); gr.addColorStop(1, 'rgba(90,170,220,.55)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
      g.lineWidth = 4; g.strokeStyle = 'rgba(30,80,120,.55)'; g.beginPath(); g.arc(0, 0, 59, 0, TAU); g.stroke();
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(230,250,255,.9)'; g.beginPath(); g.arc(0, 0, 56, 0, TAU); g.stroke();
      // iridescent film bands
      g.lineWidth = 5; g.lineCap = 'round';
      for (const [c, a0, a1, rr] of [['rgba(255,140,220,.45)', .3, 1.3, 48], ['rgba(140,255,200,.4)', 1.6, 2.6, 46], ['rgba(255,230,120,.38)', 3.3, 4.1, 50]]) { g.strokeStyle = c; g.beginPath(); g.arc(0, 0, rr, a0, a1); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(-24, -28, 14, 7, -.7, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(26, 30, 5, 3, -.7, 0, TAU); g.fill();
    });
  }
  function lavaGlob() {
    return Kit().sprite('jc:lavaglob', 96, 96, g => {
      g.translate(48, 48);
      g.fillStyle = '#2a0e06'; g.beginPath();
      for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, r = 40 * (.86 + hash(i * 3.1) * .2); if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(r, 0); }
      g.closePath(); g.fill();
      const gr = g.createRadialGradient(-8, -10, 2, 0, 0, 38);
      gr.addColorStop(0, '#fff2b0'); gr.addColorStop(.3, '#ffb22e'); gr.addColorStop(.62, '#e84a10'); gr.addColorStop(1, 'rgba(120,20,6,.2)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 35, 0, TAU); g.fill();
      g.strokeStyle = '#3a1206'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = hash(i * 7.1) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a + .4) * 26, Math.sin(a + .4) * 26); g.lineTo(Math.cos(a + .1) * 36, Math.sin(a + .1) * 36); g.stroke(); }
    });
  }
  function poolImg(el, v) {
    return Kit().sprite('jc:pool:' + el + v, 160, 80, g => {
      g.translate(80, 40); g.scale(1, .5);
      const blob = (r, s) => { g.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, rr = r * (.8 + hash(s + i % 18 * 1.7) * .3); if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(rr, 0); } g.closePath(); };
      if (el === 'lava') {
        g.fillStyle = '#1e0a06'; blob(74, v * 5); g.fill();
        g.fillStyle = '#c8380e'; blob(60, v * 5 + 2); g.fill();
        g.fillStyle = '#ff8a1e'; blob(44, v * 5 + 4); g.fill();
        g.fillStyle = '#ffd25a'; blob(22, v * 5 + 6); g.fill();
        g.strokeStyle = '#2a0e06'; g.lineWidth = 7; g.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const a = hash(v + i * 2.3) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); g.lineTo(Math.cos(a + .5) * 40, Math.sin(a + .5) * 40); g.lineTo(Math.cos(a + .2) * 62, Math.sin(a + .2) * 62); g.stroke(); }
      } else {
        g.fillStyle = 'rgba(40,70,10,.55)'; blob(74, v * 5); g.fill();
        g.fillStyle = 'rgba(150,220,60,.75)'; blob(62, v * 5 + 2); g.fill();
        g.fillStyle = 'rgba(210,255,120,.7)'; blob(36, v * 5 + 4); g.fill();
        g.strokeStyle = 'rgba(40,70,10,.7)'; g.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const a = hash(v + i * 4.1) * TAU, d = 20 + hash(i + v) * 36; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 5 + hash(i * 2 + v) * 6, 0, TAU); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-20, -22, 14, 6, -.3, 0, TAU); g.fill();
      }
    });
  }
  function tbbSphere() {
    return Kit().sphere('jc:tbb', [[0, '#d8c8ff'], [.1, '#5a3a8a'], [.42, '#140a24'], [.86, '#060309'], [.96, '#3a1460'], [1, 'rgba(90,30,150,0)']], .36, .32);
  }
  const tbbSwirl = () => Kit().swirl('jc:tbbswirl', ['rgba(255,255,255,.9)', 'rgba(200,150,255,.85)', 'rgba(120,60,220,.85)'], 7, 1.1, .12, 128, 3);
  // four-point twinkle star
  function star(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  }

  // ------------------------------------------------------------------ telegraphs
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.ellipse(x, y, r * clamp01(k), r * .5 * clamp01(k), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.42)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8, c = Math.cos(a), s = Math.sin(a) * .5;
        ctx.moveTo(x + c * (r - 14), y + s * (r - 14)); ctx.lineTo(x + c * (r + 12), y + s * (r + 12));
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
    if (s.k === 'line' || s.k === 'band') {
      const x0 = s.k === 'band' ? 40 : 0;
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(x0, -s.w, s.len - x0, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(x0, -s.w, (s.len - x0) * k, s.w * 2);
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; ctx.strokeRect(x0, -s.w, s.len - x0, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(x0, -s.w, s.len - x0, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      const cw = Math.min(s.w * .4, 40);
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) for (const o of s.k === 'band' ? [-s.w * .6, 0, s.w * .6] : [0]) { ctx.moveTo(d - 16, o - cw); ctx.lineTo(d, o); ctx.lineTo(d - 16, o + cw); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ element painters
  function stainG(ctx, el, x, y, r, a, seed) {
    if (a <= .01) return;
    const E = EL[el];
    ctx.fillStyle = `rgba(${E.stain},${(el === 'powder' || el === 'bubble' || el === 'steam' ? .16 : .32) * a})`;
    ctx.beginPath(); ctx.ellipse(x, y, r * .82, r * .41, 0, 0, TAU); ctx.fill();
    if (el === 'lava' || el === 'bfire' || el === 'tbb' || r > 150) {
      ctx.strokeStyle = `rgba(${E.stain},${.7 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const an = hash(i * 4.7 + seed) * TAU, b = an + (hash(i * 9 + seed) - .5) * .5;
        ctx.moveTo(x + Math.cos(an) * r * .45, y + Math.sin(an) * r * .22);
        ctx.lineTo(x + Math.cos(b) * r * .8, y + Math.sin(b) * r * .4);
        ctx.lineTo(x + Math.cos(an) * r * 1.1, y + Math.sin(an) * r * .55);
      }
      ctx.stroke();
    }
    if (el === 'lava' || el === 'bfire') {
      ctx.globalCompositeOperation = 'lighter';
      Kit().glow(ctx, x, y, r * .7, el === 'lava' ? '255,90,20' : '50,110,255', .35 * a, false, .5);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Explosion of an element at (x, y); u = seconds since the hit.
  function blastO(ctx, el, x, y, r, u, seed, col) {
    if (u < 0 || u > 1.5) return;
    const K = Kit(), E = EL[el], fade = 1 - win(u, .6, 1.5);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .4) K.glow(ctx, x, y - r * .3, r * (.8 + u * 1.6), E.rgb, (1 - u / .4) * (el === 'lava' || el === 'bfire' ? .6 : .38), el === 'lava' || el === 'bfire', .75);
    K.fx.shockRing(ctx, x, y, r * 1.1, u * 1.5, Math.max(0, 1 - u * 1.3), E.rgb);
    ctx.globalCompositeOperation = 'source-over';
    if (col) { columnO(ctx, el, x, y, r, u, seed); return; }
    const e = easeOut(u * 1.6);
    switch (el) {
      case 'bfire': {
        const nv = puffImg('jc:navy'), bp = puffImg('jc:bfire');
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + hash(seed + i), d = r * (.3 + .55 * e); K.stamp(ctx, nv, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 10, r * (.22 + .1 * e), .45 * fade, .7); }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const an = i * TAU / 10 + hash(seed + i * 1.3) * .5, d = r * (.2 + .62 * e), hh = Math.min(150, r * (.38 + hash(i + seed) * .42)) * bell(u / 1.2) * (.82 + .18 * Math.sin(u * 32 + i * 2));
          tongue(ctx, bflame(i + seed), x + Math.cos(an) * d, y + Math.sin(an) * d * .5, hh * .55, hh, fade);
        }
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 7; i++) { const ph = clamp01(u * 1.2 + hash(i + seed) * .2), an = hash(i * 2.2 + seed) * TAU; K.stamp(ctx, bp, x + Math.cos(an) * r * .4 * ph, y - 20 - ph * r * .9, r * (.2 + ph * .2), (1 - ph) * .8, .9); }
        break;
      }
      case 'lava': {
        const sm = K.puff('smoke'), fp = K.puff('fire');
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + hash(seed + i), d = r * (.3 + .6 * e); K.stamp(ctx, sm, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 14 - u * 30, r * (.22 + .14 * e), .6 * fade, .75); }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) { const an = hash(seed + i * 3) * TAU; K.stamp(ctx, fp, x + Math.cos(an) * r * .25 * e, y - r * .2 * e - 10, r * (.3 + .2 * e) * (1 - u * .5), (1 - u / 1.1) * .9); }
        ctx.globalCompositeOperation = 'source-over';
        // molten droplets thrown out in arcs
        for (let i = 0; i < 12; i++) {
          const t = clamp01(u * 1.3 - hash(i + seed) * .1); if (t <= 0 || t >= 1) continue;
          const an = hash(i * 3.7 + seed) * TAU, d = r * (.2 + .95 * easeOut(t)), h = Math.sin(Math.PI * t) * r * (.4 + hash(i + seed * 2) * .5);
          const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - h, s = 2.4 + hash(i * 5.5 + seed) * 3.6;
          ctx.fillStyle = '#2a0c06'; ctx.beginPath(); ctx.arc(px, py, s + 1.6, 0, TAU); ctx.fill();
          ctx.fillStyle = t < .6 ? '#ffb030' : '#e8501a'; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
        }
        if (u < 1.1) K.fx.debris(ctx, x, y, r * 1.1, u / 1.1, seed, '#2e1a12', 10);
        break;
      }
      case 'steam': {
        const sm = K.puff('smoke'), sp = puffImg('jc:steam');
        for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + seed, d = r * (.3 + .6 * e); K.stamp(ctx, sm, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8, r * .2, .28 * fade, .7); }
        for (let i = 0; i < 10; i++) {
          const an = i * TAU / 10 + hash(seed + i) * .6, d = r * (.25 + .7 * e), lift = hash(i * 2 + seed) * r * .5 * e;
          K.stamp(ctx, sp, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 14 - lift, r * (.22 + .16 * e), .85 * fade, .8);
        }
        for (let i = 0; i < 5; i++) K.stamp(ctx, sp, x + Math.sin(i * 2 + seed) * 12, y - 20 - e * r * (.3 + i * .22), r * (.3 + i * .05) * (.6 + e * .5), .8 * fade);
        break;
      }
      case 'bubble': case 'acid': {
        const foam = puffImg(el === 'acid' ? 'jc:acid' : 'jc:foam');
        for (let i = 0; i < 7; i++) { const an = i * TAU / 7 + seed, d = r * (.2 + .5 * e); K.stamp(ctx, foam, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 10, r * (.18 + .1 * e), .7 * fade, .7); }
        // the bubble's film snapping outward
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(30,80,110,${.5 * (1 - e)})`;
        ctx.beginPath(); ctx.ellipse(x, y - r * .35, r * (.5 + e * .6), r * (.5 + e * .6) * .8, 0, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = `rgba(240,255,255,${.9 * (1 - e)})`; ctx.stroke();
        for (let i = 0; i < 14; i++) {
          const t = clamp01(u * 1.5 - hash(i + seed) * .1); if (t <= 0 || t >= 1) continue;
          const an = hash(i * 3.1 + seed) * TAU, d = r * (.3 + .9 * easeOut(t)), h = Math.sin(Math.PI * t) * r * .4 + r * .3 * (1 - t);
          const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - h, s = 2.4 + hash(i * 5 + seed) * 3;
          ctx.fillStyle = el === 'acid' ? '#3a5a10' : '#1e4a66'; ctx.beginPath(); ctx.arc(px, py, s + 1.2, 0, TAU); ctx.fill();
          ctx.fillStyle = el === 'acid' ? '#c8ff6a' : '#e8fbff'; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
        }
        if (el === 'acid') { const sm = K.puff('smoke'); for (let i = 0; i < 3; i++) K.stamp(ctx, sm, x + (i - 1) * r * .3, y - 20 - u * 60, r * .25, .3 * fade); }
        break;
      }
      case 'powder': {
        const pp = puffImg('jc:powder');
        for (let i = 0; i < 9; i++) { const an = i * TAU / 9 + seed, d = r * (.25 + .6 * e); K.stamp(ctx, pp, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 12 - e * 20, r * (.2 + .14 * e), .8 * fade, .8); }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) {
          const an = hash(i * 1.7 + seed) * TAU, d = r * (.15 + 1.0 * easeOut(u * 1.3 + hash(i) * .2)), tw = .5 + .5 * Math.sin(u * 30 + i);
          star(ctx, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 20 - hash(i * 3 + seed) * r * .5, (4 + hash(i + seed) * 8) * tw * fade, `rgba(255,250,200,${fade})`);
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }
  // Erupting column: blue fire pillar / lava geyser / steam geyser.
  function columnO(ctx, el, x, y, r, u, seed) {
    const K = Kit(), rise = easeOut(u / .25), fall = 1 - win(u, .55, 1.3), Hc = r * 3.4 * rise;
    if (fall <= 0) return;
    if (el === 'bfire') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y - Hc * .45, r * .9, '60,130,255', .55 * fall, false, Math.max(1, Hc / (r * 1.8)));
      for (let i = 0; i < 5; i++) tongue(ctx, bflame(i + seed), x + (i - 2) * r * .2, y + 4, r * (.66 - Math.abs(i - 2) * .12), Hc * (1 - Math.abs(i - 2) * .22) * (.86 + .14 * Math.sin(u * 30 + i)), fall);
      const bp = puffImg('jc:bfire');
      for (let i = 0; i < 4; i++) { const ph = frac(u * 1.8 + i / 4); K.stamp(ctx, bp, x + Math.sin(i * 2.3 + seed + u * 5) * r * .25, y - Hc * (.7 + ph * .5), r * (.22 + ph * .14), (1 - ph) * .7 * fall); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (el === 'lava') {
      // lava fountain: a wobbling molten stem flaring into a splash crown, crusted edges, droplets raining back
      const w0 = r * .2 * fall, w1 = r * .5 * fall, top = y - Hc, wob = i => Math.sin(u * 22 + i * 1.7 + seed) * w0 * .25;
      const stem = (k, inset) => {
        ctx.beginPath(); ctx.moveTo(x - w0 * k + inset, y + 2);
        ctx.bezierCurveTo(x - w0 * k + wob(1), y - Hc * .4, x - w1 * .5 * k + wob(2), y - Hc * .8, x - w1 * k + inset, top + 8);
        for (let i = 0; i <= 6; i++) { const t = i / 6, px = x + (t * 2 - 1) * w1 * k * (1 - inset * .02); ctx.lineTo(px, top + 8 - (i % 2 ? 18 : 6) * k * (.7 + .3 * Math.sin(u * 30 + i))); }
        ctx.bezierCurveTo(x + w1 * .5 * k + wob(3), y - Hc * .8, x + w0 * k + wob(4), y - Hc * .4, x + w0 * k - inset, y + 2);
        ctx.closePath();
      };
      stem(1.25, 0); ctx.fillStyle = '#2a0c06'; ctx.fill();
      stem(1, 0); ctx.fillStyle = '#e8501a'; ctx.fill();
      stem(.62, 2); ctx.fillStyle = '#ff9a2a'; ctx.fill();
      stem(.3, 3); ctx.fillStyle = '#ffe07a'; ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - Hc * .5, r * .8, '255,110,30', .4 * fall, false, Math.max(1, Hc / (r * 1.6))); ctx.globalCompositeOperation = 'source-over';
      const fp = K.puff('fire');
      for (let i = 0; i < 3; i++) K.stamp(ctx, fp, x + (i - 1) * w1 * .7, top + 4 - i % 2 * 10, w1 * .55, .85 * fall);
      for (let i = 0; i < 10; i++) {
        const t = frac(u * 1.5 + hash(i + seed)), an = (hash(i * 2.7 + seed) - .5) * 2.6;
        const px = x + Math.sin(an) * r * .9 * t, py = top + t * t * Hc * .95 - Math.sin(Math.PI * t) * 30;
        ctx.fillStyle = '#2a0c06'; ctx.beginPath(); ctx.arc(px, py, 4.6, 0, TAU); ctx.fill();
        ctx.fillStyle = t < .5 ? '#ffb030' : '#e8501a'; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
      }
      K.stamp(ctx, K.puff('smoke'), x + Math.sin(u * 3) * 10, top - 20 - u * 30, r * .45, .5 * fall);
    } else {
      const sp = puffImg(el === 'acid' ? 'jc:acid' : el === 'powder' ? 'jc:powder' : 'jc:steam'), sm = K.puff('smoke');
      K.stamp(ctx, sm, x, y - 10, r * .6, .3 * fall, .6);
      for (let i = 0; i < 9; i++) {
        const t = i / 8, py = y - Hc * t - 6, rr = r * (.32 + t * .38) * (.8 + .2 * Math.sin(u * 12 + i));
        K.stamp(ctx, sp, x + Math.sin(i * 1.9 + seed + u * 4) * r * .16 * t, py, rr, .9 * fall);
      }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 10, r * .7, '255,170,140', .35 * fall * (1 - u), false, .5); ctx.globalCompositeOperation = 'source-over';
    }
  }
  // A projectile in flight.
  function projO(ctx, el, x, y, r, time, seed, dx, dy, big) {
    const K = Kit();
    if (el === 'bfire') {
      const bp = puffImg('jc:bfire');
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, r * 2.2, '60,130,255', .7);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 1; i <= 4; i++) K.stamp(ctx, bp, x - dx * i * .06, y - dy * i * .06, r * (1 - i * .15), .55 - i * .1);
      K.stamp(ctx, bp, x, y, r * 1.05, 1);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r * .7, '220,240,255', .9, true); ctx.globalCompositeOperation = 'source-over';
    } else if (el === 'lava') {
      const sm = K.puff('smoke');
      for (let i = 1; i <= 4; i++) K.stamp(ctx, sm, x - dx * i * .05, y - dy * i * .05, r * (.6 + i * .12), .4 - i * .07);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r * 2, '255,110,30', .6); ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); ctx.rotate(time * 5 + seed); ctx.drawImage(lavaGlob(), -r, -r, r * 2, r * 2); ctx.restore();
    } else if (el === 'bubble' || el === 'acid') {
      const wob = 1 + Math.sin(time * 9 + seed) * .06;
      ctx.drawImage(bubbleImg(), x - r * wob, y - r / wob, r * 2 * wob, r * 2 / wob);
      if (big) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, r * 1.2, '160,240,200', .25); ctx.globalCompositeOperation = 'source-over'; }
    } else if (el === 'powder') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, r * 2, '255,230,110', .7, true);
      for (let i = 0; i < 4; i++) star(ctx, x + Math.cos(time * 6 + i * 1.6) * r, y + Math.sin(time * 6 + i * 1.6) * r * .6, 5, 'rgba(255,255,220,.9)');
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------------------ effect painters [ground, overlay]
  function spotPos(s, age) {
    // returns the projectile position for spots that fly in, or null
    if (s.drift) {
      const k = clamp01((age - s.t0) / s.fl);
      if (age < s.t0) return null;
      const e = easeOut(k), hv = age > s.t0 + s.fl ? Math.sin((age - s.t0 - s.fl) * 14) * 3 : 0;
      return { x: s.ox + (s.x - s.ox) * e + Math.sin(k * 6 + s.seed) * 26 * (1 - k), y: s.oy + (s.y - s.oy) * e, h: s.oh * (1 - e) + 44 * e + hv + Math.sin(k * 9 + s.seed) * 8 };
    }
    if (s.fl == null || s.ox == null) return null;
    const k = (age - (s.t - s.fl)) / s.fl;
    if (k < 0 || k >= 1) return null;
    if (s.sky) return { x: s.x, y: s.y, h: s.oh * (1 - easeIn(k)), k };
    return { x: s.ox + (s.x - s.ox) * k, y: s.oy + (s.y - s.oy) * k, h: s.oh * (1 - k) + Math.sin(k * Math.PI) * (s.arc || 120), k };
  }
  const FX = {
    spots: [
      (ctx, fx, time) => {
        const E = MOVE_RGB[fx.el] || '255,255,255';
        for (const s of fx.list) {
          const m = s.m || 0;
          if (fx.age < s.t) {
            if (fx.age >= m) markCircle(ctx, s.x, s.y, s.r, E, (fx.age - m) / Math.max(.05, s.t - m), time, false);
            if (s.glow && fx.age >= m) {
              // scattered scale powder glittering on the ground before it ignites
              ctx.globalCompositeOperation = 'lighter';
              for (let i = 0; i < 7; i++) { const an = hash(i + s.seed) * TAU, d = s.r * .7 * hash(i * 3 + s.seed); star(ctx, s.x + Math.cos(an) * d, s.y + Math.sin(an) * d * .5, 3 + 3 * Math.sin(time * 14 + i), 'rgba(255,245,170,.85)'); }
              Kit().glow(ctx, s.x, s.y, s.r * .8, '255,230,110', .25 + .2 * Math.sin(time * 16), false, .5);
              ctx.globalCompositeOperation = 'source-over';
            }
            const p = spotPos(s, fx.age);
            if (p) { ctx.fillStyle = 'rgba(14,10,20,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 18, 7, 0, 0, TAU); ctx.fill(); }
          } else stainG(ctx, fx.el, s.x, s.y, s.r, 1 - win(fx.age - s.t, .9, 1.6), s.seed);
        }
      },
      (ctx, fx, time) => {
        for (const s of fx.list) {
          if (fx.age < s.t) {
            const p = spotPos(s, fx.age);
            if (p) {
              const q = spotPos(s, Math.max(0, fx.age - .03)) || p;
              const r = s.drift ? 24 : s.big ? 34 : s.sky ? 18 : fx.el === 'bubble' ? 20 : 15;
              projO(ctx, fx.el, p.x, p.y - p.h, r, time, s.seed, (p.x - q.x) * 30, (p.y - p.h - q.y + q.h) * 30, s.big);
            }
          } else blastO(ctx, fx.el, s.x, s.y, s.r, fx.age - s.t, s.seed, s.col);
        }
      }
    ],
    pool: [
      (ctx, fx, time) => {
        const K = Kit(), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
        for (const s of fx.list) {
          const a = clamp01((fx.age - s.t0) / .3) * fade; if (a <= .01) continue;
          if (fx.el === 'lava' || fx.el === 'acid') {
            ctx.globalAlpha = a;
            ctx.drawImage(poolImg(fx.el, s.seed % 3), s.x - s.r * 1.1, s.y - s.r * .55, s.r * 2.2, s.r * 1.1);
            ctx.globalAlpha = 1;
            if (fx.el === 'lava') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y, s.r * 1.2, '255,100,20', (.35 + .15 * Math.sin(time * 4 + s.seed)) * a, false, .5); ctx.globalCompositeOperation = 'source-over'; }
          } else if (fx.el === 'bfire') {
            ctx.fillStyle = `rgba(14,20,60,${.3 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .45, 0, 0, TAU); ctx.fill();
            ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y, s.r * 1.3, '50,110,255', .45 * a, false, .5); ctx.globalCompositeOperation = 'source-over';
          } else if (fx.el === 'powder') {
            ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s.x, s.y, s.r * 1.2, '240,230,120', .25 * a, false, .5); ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.fillStyle = `rgba(60,70,80,${.18 * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .45, 0, 0, TAU); ctx.fill();
          }
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
        for (const s of fx.list) {
          const a = clamp01((fx.age - s.t0) / .3) * fade; if (a <= .01) continue;
          const sd = s.seed;
          if (fx.el === 'bfire') {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) { const h = s.r * (.6 + .45 * K.wobble(sd + i * 7, time, 3)); tongue(ctx, bflame(i + sd), s.x + (i - 1) * s.r * .45, s.y + 3, h * .55, h, a); }
            ctx.globalCompositeOperation = 'source-over';
          } else if (fx.el === 'lava') {
            for (let i = 0; i < 2; i++) { const h = s.r * (.5 + .4 * K.wobble(sd + i * 5, time, 3)); tongue(ctx, rflame(i + sd), s.x + (i - .5) * s.r * .6, s.y + 2, h * .5, h, a * .9); }
            const ph = frac(time * .5 + hash(sd)); K.stamp(ctx, K.puff('smoke'), s.x + Math.sin(sd) * 10, s.y - 20 - ph * 60, 14 + ph * 22, (1 - ph) * .45 * a);
          } else if (fx.el === 'acid') {
            for (let i = 0; i < 3; i++) {
              const ph = frac(time * 1.4 + hash(sd + i)), bx = s.x + (hash(sd + i * 3) - .5) * s.r * 1.2, by = s.y + (hash(sd + i * 5) - .5) * s.r * .4;
              ctx.strokeStyle = `rgba(40,70,10,${.8 * a * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by - ph * 10, 3 + ph * 6, 0, TAU); ctx.stroke();
              ctx.fillStyle = `rgba(220,255,140,${.6 * a * (1 - ph)})`; ctx.fill();
            }
            const ph = frac(time * .6 + hash(sd)); K.stamp(ctx, puffImg('jc:acid'), s.x, s.y - 14 - ph * 40, 14 + ph * 16, (1 - ph) * .4 * a);
          } else if (fx.el === 'steam') {
            const sp = puffImg('jc:steam');
            for (let i = 0; i < 3; i++) {
              const ph = frac(time * .45 + hash(sd + i * 2.1)), an = hash(sd + i * 4.3) * TAU;
              K.stamp(ctx, sp, s.x + Math.cos(an) * s.r * .6 * (.4 + ph), s.y + Math.sin(an) * s.r * .3 - 16 - ph * 50, s.r * (.45 + ph * .35), bell(ph) * .75 * a, .8);
            }
          } else if (fx.el === 'powder') {
            // dense glittering fog: the blinding scale powder
            const pp = puffImg('jc:powder');
            for (let i = 0; i < 3; i++) {
              const ph = frac(time * .35 + hash(sd + i * 2.1)), an = hash(sd + i * 4.3) * TAU + time * .3;
              K.stamp(ctx, pp, s.x + Math.cos(an) * s.r * .5, s.y + Math.sin(an) * s.r * .25 - 24 - ph * 30, s.r * (.55 + ph * .3), bell(ph) * .7 * a, .75);
            }
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 6; i++) { const an = hash(sd + i * 1.7) * TAU + time * (i % 2 ? .6 : -.5), d = s.r * (.3 + .6 * hash(sd + i)); star(ctx, s.x + Math.cos(an) * d, s.y + Math.sin(an) * d * .5 - 20 - hash(i + sd) * 50, (3 + 4 * Math.abs(Math.sin(time * 9 + i * 2))) * a, 'rgba(255,255,210,.95)'); }
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
    ],
    cone: [
      (ctx, fx) => {
        const front = Math.min(fx.r, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
        if (front < 10) return;
        ctx.fillStyle = `rgba(${EL[fx.el].stain},${.22 * fade})`;
        sector(ctx, fx.x, fx.y, 20, front, fx.a - fx.h, fx.a + fx.h);
        ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .55); ctx.translate(-fx.x, -fx.y); ctx.fill(); ctx.restore();
      },
      (ctx, fx, time) => {
        const K = Kit(), front = Math.min(fx.r, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), el = fx.el;
        const img = puffImg(EL[el].puff), under = el === 'steam' || el === 'powder' || el === 'bubble' ? K.puff('smoke') : el === 'bfire' ? puffImg('jc:navy') : K.puff('smoke');
        const N = 30;
        for (let pass = 0; pass < 2; pass++) {
          if (pass) ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < N; i++) {
            const ph = frac(i / N + fx.age * 1.4), d = front * ph, an = fx.a + (hash(i * 3.1 + fx.seed) - .5) * 1.9 * fx.h * (.5 + ph * .5);
            if (d < 12) continue;
            const x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d - 26 * (1 - ph) - 8, rr = 14 + d * .16 * (.7 + hash(i + fx.seed) * .6);
            if (!pass) { if (i % 2 === 0) K.stamp(ctx, under, x, y + 6, rr * 1.05, .32 * fade, .7); }
            else K.stamp(ctx, img, x, y, rr, (el === 'bfire' ? .7 : .85) * fade * (1 - ph * .4), .8);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        if (el === 'lava') for (let i = 0; i < 12; i++) {
          const ph = frac(i / 12 + fx.age * 1.7), d = front * ph, an = fx.a + (hash(i * 5.3 + fx.seed) - .5) * 1.8 * fx.h;
          const x = fx.x + Math.cos(an) * d, y = fx.y + Math.sin(an) * d - Math.sin(ph * Math.PI) * 50 - 10;
          ctx.fillStyle = '#2a0c06'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffa030'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
        } else if (el === 'acid' || el === 'bubble') for (let i = 0; i < 10; i++) {
          const ph = frac(i / 10 + fx.age * 1.2), d = front * ph, an = fx.a + (hash(i * 5.3 + fx.seed) - .5) * 1.8 * fx.h;
          const r = 8 + 10 * hash(i + fx.seed);
          ctx.globalAlpha = fade; ctx.drawImage(bubbleImg(), fx.x + Math.cos(an) * d - r, fx.y + Math.sin(an) * d - 30 * (1 - ph) - 20 - r, r * 2, r * 2); ctx.globalAlpha = 1;
        } else if (el === 'powder') {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 16; i++) { const ph = frac(i / 16 + fx.age), d = front * ph, an = fx.a + (hash(i * 7.3 + fx.seed) - .5) * 1.9 * fx.h; star(ctx, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 30, (3 + 5 * Math.abs(Math.sin(time * 11 + i))) * fade, 'rgba(255,255,210,.95)'); }
          ctx.globalCompositeOperation = 'source-over';
        } else if (el === 'bfire') {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 8; i++) { const ph = frac(i / 8 + fx.age * 1.1), d = front * ph, an = fx.a + (hash(i * 7.3 + fx.seed) - .5) * 1.6 * fx.h, h = 40 + d * .12; tongue(ctx, bflame(i), fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d + 4, h * .5, h, fade * bell(ph)); }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    ],
    ring: [
      (ctx, fx) => {
        const R = Math.min(fx.r1, fx.r0 + fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
        ctx.strokeStyle = `rgba(${EL[fx.el].stain},${.35 * fade})`; ctx.lineWidth = 40;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R * .92, R * .46, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(${EL[fx.el].stain},${.12 * fade})`; ctx.fill();
      },
      (ctx, fx, time) => {
        const K = Kit(), R = Math.min(fx.r1, fx.r0 + fx.age * fx.speed), live = fx.r0 + fx.age * fx.speed < fx.r1 + 40 ? 1 : 0;
        const fade = 1 - win(fx.age, fx.dur - .7, fx.dur), n = Math.max(10, Math.min(30, Math.round(R / 18)));
        ctx.globalCompositeOperation = 'lighter';
        K.fx.shockRing(ctx, fx.x, fx.y, R, 1, .7 * fade, EL[fx.el].rgb);
        for (let i = 0; i < n; i++) {
          const an = i * TAU / n + fx.seed, x = fx.x + Math.cos(an) * R, y = fx.y + Math.sin(an) * R * .5, j = hash(i + fx.seed);
          if (fx.el === 'bfire') { const h = (50 + 50 * j) * (live ? 1 : .6) * (.8 + .2 * Math.sin(time * 18 + i)); tongue(ctx, bflame(i), x, y + 3, h * .5, h, fade); }
          else { ctx.globalCompositeOperation = 'source-over'; const h = (30 + 30 * j) * (live ? 1 : .5); tongue(ctx, rflame(i), x, y + 3, h * .55, h, fade * .95); K.stamp(ctx, K.puff('smoke'), x, y - h - 10 - (1 - fade) * 30, 18 + j * 12, .45 * fade); ctx.globalCompositeOperation = 'lighter'; }
        }
        ctx.globalCompositeOperation = 'source-over';
        if (fx.el === 'lava' && live) for (let i = 0; i < n; i += 2) {
          const an = i * TAU / n + fx.seed + .1, x = fx.x + Math.cos(an) * R, y = fx.y + Math.sin(an) * R * .5;
          ctx.fillStyle = '#2a0c06'; ctx.beginPath(); ctx.ellipse(x, y - 6, 16, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff8a24'; ctx.beginPath(); ctx.ellipse(x, y - 8, 11, 6, 0, 0, TAU); ctx.fill();
        }
      }
    ],
    claw: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, .3, fx.dur);
        ctx.strokeStyle = `rgba(14,22,50,${.5 * a})`; ctx.lineWidth = fx.big ? 8 : 4; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const r = fx.r * (.55 + i * .17); ctx.moveTo(fx.x + Math.cos(fx.a - fx.h) * r, fx.y + Math.sin(fx.a - fx.h) * r * .5); ctx.ellipse(fx.x, fx.y, r, r * .5, 0, fx.a - fx.h, fx.a + fx.h); }
        ctx.stroke();
      },
      (ctx, fx, time) => {
        const t = fx.age / .18, a = 1 - win(fx.age, .25, fx.dur), K = Kit(), s = fx.side;
        const from = fx.a - fx.h * s, to = from + 2 * fx.h * s * easeOut(t), cy = fx.y - (fx.big ? 60 : 28), SQ = .55;
        // three parallel blue-fire claw crescents, thickest at the leading edge
        for (let i = 0; i < 3; i++) {
          const R = fx.r * (.6 + i * .17), w = (fx.big ? 30 : 16) * (1 - i * .15);
          const path = () => crescent(ctx, fx.x, cy, R, w, from, to, SQ);
          crescent(ctx, fx.x, cy, R + 3, w + 6, from, to, SQ); ctx.fillStyle = `rgba(8,20,80,${.7 * a})`; ctx.fill();
          path(); ctx.fillStyle = `rgba(40,104,255,${.92 * a})`; ctx.fill();
          crescent(ctx, fx.x, cy, R - w * .1, w * .55, from, to, SQ); ctx.fillStyle = `rgba(140,200,255,${.95 * a})`; ctx.fill();
          crescent(ctx, fx.x, cy, R - w * .18, w * .22, from, to, SQ); ctx.fillStyle = `rgba(245,252,255,${a})`; ctx.fill();
        }
        // flames licking along the cut
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) { const an = from + (to - from) * (i + .5) / 9, R = fx.r * (.6 + (i % 3) * .17), h = (fx.big ? 80 : 40) * bell(fx.age / fx.dur) * (.7 + hash(i + fx.seed) * .6); tongue(ctx, bflame(i), fx.x + Math.cos(an) * R, cy + Math.sin(an) * R * SQ + 6, h * .5, h, a); }
        K.glow(ctx, fx.x + Math.cos(fx.a) * fx.r * .7, cy + Math.sin(fx.a) * fx.r * .35, fx.r * .5, '70,140,255', .4 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    dash: [
      (ctx, fx) => {
        const a = 1 - win(fx.age, fx.dur - .4, fx.dur), K = Kit(), dust = K.puff('dust');
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
        if (len < 5) return;
        ctx.strokeStyle = `rgba(${EL[fx.el].stain},${.3 * a})`; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
        if (fx.el !== 'powder') for (let d = 0; d < len; d += 50) {
          const t = d / len, j = hash(d * .1 + fx.seed);
          K.stamp(ctx, dust, fx.x0 + (fx.x1 - fx.x0) * t + (j - .5) * 40, fx.y0 + (fx.y1 - fx.y0) * t - 10 - j * 14, 16 + j * 14, a * .6, .75);
        }
      },
      (ctx, fx, time) => {
        const S = Spr(), K = Kit(), a = 1 - win(fx.age, fx.dur - .4, fx.dur), fac = Math.cos(fx.a) >= 0 ? 1 : -1;
        const lift = fx.el === 'powder' ? 34 : 0;
        for (let i = 0; i + 1 < fx.pts.length; i += 4) {
          const k = i / fx.pts.length;
          if (S) S.draw(ctx, fx.id, fx.pts[i], fx.pts[i + 1] + 3 - lift, { facing: fac, frame: 'attack', alpha: (.12 + k * .3) * a });
        }
        const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0); if (len < 5) return;
        const ux = (fx.x1 - fx.x0) / len, uy = (fx.y1 - fx.y0) / len, img = puffImg(EL[fx.el].puff);
        ctx.globalCompositeOperation = 'source-over';
        for (let d = 0; d < len; d += 38) {
          const t = d / len, j = hash(d * .07 + fx.seed), x = fx.x0 + ux * d + (j - .5) * 24, y = fx.y0 + uy * d - 30 - lift - j * 20;
          if (fx.el === 'bfire') tongue(ctx, bflame(d), x, y + 34, 26, 60 * (.5 + t * .5), a * .9);
          else K.stamp(ctx, img, x, y, 16 + 14 * t, a * (.4 + .5 * t), .8);
        }
        ctx.globalCompositeOperation = 'source-over';
        // speed lines
        ctx.lineCap = 'round'; const nx = -uy, ny = ux;
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(255,255,255,${a * .75})` : `rgba(30,14,30,${a * .3})`; ctx.lineWidth = pass ? 2 : 4.5; ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const o = (hash(i + fx.seed) - .5) * 80, s0 = hash(i * 3.1 + fx.seed) * len * .7, l = len * (.25 + hash(i * 1.7 + fx.seed) * .4);
            ctx.moveTo(fx.x0 + ux * s0 + nx * o, fx.y0 + uy * s0 + ny * o - 34 - lift); ctx.lineTo(fx.x0 + ux * (s0 + l) + nx * o, fx.y0 + uy * (s0 + l) + ny * o - 34 - lift);
          }
          ctx.stroke();
        }
      }
    ],
    tbb: [
      (ctx, fx, time) => {
        const c = Math.cos(fx.a), s = Math.sin(fx.a), ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len;
        if (fx.age < fx.bt) {
          markCircle(ctx, ex, ey, fx.blast, '190,120,255', fx.age / fx.bt, time, false);
          const d = fx.age * fx.speed;
          ctx.fillStyle = 'rgba(10,6,20,.3)'; ctx.beginPath(); ctx.ellipse(fx.x0 + c * d, fx.y0 + s * d, 80, 26, 0, 0, TAU); ctx.fill();
        } else {
          const k = (fx.age - fx.bt) / 2.0;
          ctx.globalAlpha = Math.max(0, 1 - k);
          ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.ellipse(ex, ey, fx.blast * .75, fx.blast * .36, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#1a1620'; ctx.beginPath(); ctx.ellipse(ex, ey + 4, fx.blast * .5, fx.blast * .24, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          stainG(ctx, 'tbb', ex, ey, fx.blast, 1 - k, fx.seed);
          ctx.strokeStyle = `rgba(30,20,40,${.3 * Math.max(0, 1 - k)})`; ctx.lineWidth = 140; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(ex, ey); ctx.stroke();
        }
      },
      (ctx, fx, time) => {
        const K = Kit(), c = Math.cos(fx.a), s = Math.sin(fx.a);
        if (fx.age < fx.bt) {
          const d = fx.age * fx.speed, q = d / fx.len, x = fx.x0 + c * d, y = fx.y0 + s * d - (fx.h0 * (1 - q) + 60 * q);
          for (let i = 1; i <= 6; i++) { const dd = Math.max(0, d - i * 55); K.stamp(ctx, K.puff('violet'), fx.x0 + c * dd, fx.y0 + s * dd - (fx.h0 * (1 - dd / fx.len) + 60 * dd / fx.len), 40 + i * 6, .6 - i * .08, .8); }
          tbbBall(ctx, x, y, 66, time, 1, fx.tint);
        } else {
          const k = (fx.age - fx.bt) / 2.0, ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len, R = fx.blast;
          if (k >= 1) return;
          if (k < .5) {
            const q = k / .5;
            ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ex, ey - 80, R * (1.1 + q), '190,150,255', (1 - q) * .95, true); ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = (1 - q) * .92;
            ctx.fillStyle = '#140c26'; ctx.beginPath(); ctx.ellipse(ex, ey, R * (.3 + .8 * easeOut(q)), R * (.28 + .62 * easeOut(q)), 0, Math.PI, TAU); ctx.fill();
            ctx.strokeStyle = '#d0c0ff'; ctx.lineWidth = 5; ctx.stroke();
            ctx.globalAlpha = 1;
            K.spin(ctx, tbbSwirl(), ex, ey - R * .3 * easeOut(q), R * .55 * easeOut(q), time * 4, (1 - q) * .8, .6);
          }
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) { const q = clamp01(k * 1.6 - i * .12); if (q > 0 && q < 1) K.fx.shockRing(ctx, ex, ey, R * (1 + i * .3), q, 1 - q, i ? '255,230,255' : '170,110,255'); }
          ctx.globalCompositeOperation = 'source-over';
          const sm = K.puff('smoke'), vi = K.puff('violet');
          for (let i = 0; i < 14; i++) { const an = i * TAU / 14 + fx.seed, d = R * (.3 + .75 * easeOut(k * 1.5)); K.stamp(ctx, i % 2 ? sm : vi, ex + Math.cos(an) * d, ey + Math.sin(an) * d * .5 - 20 - k * 60, R * (.2 + .15 * k), (1 - k) * .75, .8); }
          if (k < .7) K.fx.debris(ctx, ex, ey, R * 1.2, k / .7, fx.seed, '#2a2030', 14);
        }
      }
    ],
    transform: [
      (ctx, fx) => stainG(ctx, fx.el, fx.x, fx.y, fx.r, (1 - win(fx.age, fx.dur - .6, fx.dur)) * (fx.revert ? .5 : 1), fx.seed),
      (ctx, fx, time) => {
        const K = Kit(), u = fx.age, e = easeOut(u / .7), fade = 1 - win(u, .5, fx.dur), R = fx.r;
        ctx.globalCompositeOperation = 'lighter';
        if (u < .6) K.glow(ctx, fx.x, fx.y - 120, R * (1 + u), fx.rgb, (1 - u / .6) * .9, true, 1.2);
        for (let i = 0; i < 3; i++) { const q = clamp01(u * 1.3 - i * .15); if (q > 0 && q < 1) K.fx.shockRing(ctx, fx.x, fx.y, R * (1 + i * .35), q, 1 - q, i ? '255,255,255' : fx.rgb); }
        // chakra pillar bursting up where the beast appears
        if (!fx.revert && u < 1) K.glow(ctx, fx.x, fx.y - 200 * e, 120, fx.rgb, (1 - u) * .7, false, 2.4);
        ctx.globalCompositeOperation = 'source-over';
        const poof = K.puff('poof'), elp = puffImg(EL[fx.el].puff);
        for (let i = 0; i < 16; i++) {
          const an = i * TAU / 16 + fx.seed, d = R * (.2 + .7 * e), lift = hash(i + fx.seed) * 120 * e;
          K.stamp(ctx, i % 4 ? poof : elp, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .5 - 30 - lift, R * (.13 + .1 * e) * (i % 4 ? 1 : .7), .85 * fade, .85);
        }
        if (u < 1.2) K.fx.debris(ctx, fx.x, fx.y, R * 1.2, u / 1.2, fx.seed, '#3a2c22', 12);
      }
    ],
    prison: [
      (ctx, fx, time) => {
        if (fx.age < fx.pop) markCircle(ctx, fx.x, fx.y, fx.r + 10, '150,230,255', fx.age / fx.pop, time, false);
        else stainG(ctx, 'bubble', fx.x, fx.y, fx.r, 1 - win(fx.age - fx.pop, .8, 1.4), fx.seed);
      },
      (ctx, fx, time) => {
        const K = Kit();
        if (fx.age < fx.pop) {
          // a giant bubble closing around the target, swirling inside, the film tightening
          const k = easeBack(fx.age / .45), r = fx.r * Math.min(1.05, k) * (1 - .1 * win(fx.age, fx.pop - .25, fx.pop)), y = fx.y - r * .8;
          const wob = 1 + Math.sin(time * 14) * .03 * (fx.age / fx.pop);
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, fx.x, y, r * 1.3, '120,220,255', .1 + .12 * fx.age / fx.pop);
          K.spin(ctx, K.swirl('jc:bswirl', ['rgba(200,250,255,.6)', 'rgba(255,160,230,.4)', 'rgba(160,255,210,.4)'], 6, 1.2, .2, 128, 3), fx.x, y, r * .8, time * 3, .6);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(bubbleImg(), fx.x - r * wob, y - r / wob, r * 2 * wob, r * 2 / wob);
          for (let i = 0; i < 6; i++) { const an = time * 2 + i * TAU / 6, rr = r * 1.15; ctx.drawImage(bubbleImg(), fx.x + Math.cos(an) * rr - 9, y + Math.sin(an) * rr * .6 - 9, 18, 18); }
        } else blastO(ctx, 'bubble', fx.x, fx.y, fx.r * 1.3, fx.age - fx.pop, fx.seed);
      }
    ],
    gust: [
      (ctx, fx) => {
        const d = Math.min(fx.len, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .5, fx.dur), K = Kit(), dust = K.puff('dust');
        const c = Math.cos(fx.a), s = Math.sin(fx.a), nx = -s, ny = c;
        for (let i = 0; i < 12; i++) {
          const o = (i / 11 - .5) * 2 * fx.w, dd = d - 30 - hash(i + fx.seed) * 80;
          if (dd < 0) continue;
          K.stamp(ctx, dust, fx.x + c * dd + nx * o, fx.y + s * dd + ny * o - 12, 26 + hash(i) * 18, .55 * fade, .7);
        }
      },
      (ctx, fx, time) => {
        const d = Math.min(fx.len, fx.age * fx.speed), fade = 1 - win(fx.age, fx.dur - .5, fx.dur), K = Kit();
        const c = Math.cos(fx.a), s = Math.sin(fx.a), nx = -s, ny = c;
        ctx.lineCap = 'round';
        // the wind wall itself: a pale band sweeping forward
        for (const [lw, col] of [[56, `rgba(60,90,40,${.12 * fade})`], [44, `rgba(220,255,200,${.3 * fade})`], [10, `rgba(255,255,240,${.55 * fade})`]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
          ctx.moveTo(fx.x + c * (d - 60) - nx * fx.w, fx.y + s * (d - 60) - ny * fx.w - 40); ctx.quadraticCurveTo(fx.x + c * (d + 40), fx.y + s * (d + 40) - 40, fx.x + c * (d - 60) + nx * fx.w, fx.y + s * (d - 60) + ny * fx.w - 40); ctx.stroke();
        }
        // curved wind arcs across the whole front, a dark under-stroke so they read on bright ground
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(240,255,220,${.85 * fade})` : `rgba(40,60,30,${.35 * fade})`; ctx.lineWidth = pass ? 3 : 7;
          ctx.beginPath();
          for (let i = 0; i < 9; i++) {
            const o = (i / 8 - .5) * 2 * fx.w, dd = d - (i % 3) * 40 - hash(i + fx.seed) * 30;
            if (dd < 20) continue;
            const x = fx.x + c * dd + nx * o, y = fx.y + s * dd + ny * o - 40 - (i % 2) * 20;
            ctx.moveTo(x - c * 70 + nx * 30, y - s * 70 + ny * 30); ctx.quadraticCurveTo(x + c * 10, y + s * 10, x - c * 70 - nx * 30, y - s * 70 - ny * 30);
          }
          ctx.stroke();
        }
        // glittering scales and leaves carried by the gust
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 18; i++) {
          const o = (hash(i * 2.3 + fx.seed) - .5) * 2 * fx.w, dd = d - hash(i * 1.1) * 140;
          if (dd < 0) continue;
          star(ctx, fx.x + c * dd + nx * o, fx.y + s * dd + ny * o - 30 - hash(i) * 60, (3 + 4 * Math.abs(Math.sin(time * 10 + i))) * fade, 'rgba(230,255,170,.95)');
        }
        K.glow(ctx, fx.x + c * d, fx.y + s * d - 40, fx.w * .7, '200,255,150', .25 * fade, false, .5);
        ctx.globalCompositeOperation = 'source-over';
      }
    ],
    tele: [
      (ctx, fx, time) => { for (const s of fx.shapes) teleShape(ctx, s, fx.rgb, fx.age / fx.dur, time); },
      null
    ]
  };
  const MOVE_RGB = { bfire: '90,160,255', lava: '255,120,40', steam: '255,236,226', bubble: '150,230,255', acid: '170,240,90', powder: '255,230,110', tbb: '190,120,255' };

  // Tapered crescent along an elliptical arc a0 → a1 (outer radius R, max width w), thickest at the leading end.
  function crescent(ctx, cx, cy, R, w, a0, a1, sq) {
    const n = 16;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) {
      const u = i / n, an = a0 + (a1 - a0) * u, prof = Math.pow(Math.sin(Math.PI * Math.pow(u, .7)), .8) * (.35 + .65 * u), rr = R - w * prof;
      ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * sq);
    }
    ctx.closePath();
  }
  function tbbBall(ctx, x, y, r, time, alpha, tint) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.4, '120,90,255', .55 * alpha);
    if (tint) K.glow(ctx, x, y, r * 1.6, tint, .3 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(tbbSphere(), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    K.spin(ctx, tbbSwirl(), x, y, r * .95, time * 10, .6 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(210,190,255,${.7 * alpha})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r * 1.03, 0, TAU); ctx.stroke();
  }

  // ------------------------------------------------------------------ the beast cloak (Version 1 / 2)
  const SP = new Float32Array(64), LE = new Float32Array(64), RI = new Float32Array(64);
  function spine(x, y, ang, len, curl, sway, ph, n) {
    const step = len / (n - 1);
    SP[0] = x; SP[1] = y;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1), h = ang + curl * t * t + Math.sin(ph + t * 3.2) * sway * t;
      x += Math.cos(h) * step; y += Math.sin(h) * step;
      SP[i * 2] = x; SP[i * 2 + 1] = y;
    }
    return SP;
  }
  function ribbon(ctx, P, n, w0, w1, fill, shade, line, lw = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = P[b * 2] - P[a * 2], ty = P[b * 2 + 1] - P[a * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const t = i / (n - 1), w = (w0 + (w1 - w0) * Math.pow(t, .8)) * .5;
      LE[i * 2] = P[i * 2] - ty * w; LE[i * 2 + 1] = P[i * 2 + 1] + tx * w;
      RI[i * 2] = P[i * 2] + ty * w; RI[i * 2 + 1] = P[i * 2 + 1] - tx * w;
    }
    ctx.beginPath(); ctx.moveTo(LE[0], LE[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(LE[i * 2], LE[i * 2 + 1]);
    const ex = P[(n - 1) * 2], ey = P[(n - 1) * 2 + 1];
    ctx.quadraticCurveTo(ex + (ex - P[(n - 2) * 2]) * .6, ey + (ey - P[(n - 2) * 2 + 1]) * .6, RI[(n - 1) * 2], RI[(n - 1) * 2 + 1]);
    for (let i = n - 2; i >= 0; i--) ctx.lineTo(RI[i * 2], RI[i * 2 + 1]);
    ctx.closePath();
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
    if (shade) {
      ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(RI[i * 2], RI[i * 2 + 1]);
      ctx.closePath(); ctx.fillStyle = shade; ctx.fill();
    }
  }
  // Fū's insect wings (Chōmei's), flapping fast.
  function wings(ctx, x, y, fac, k, time) {
    if (k < .02) return;
    const flap = Math.sin(time * 55);
    for (const far of [1, 0]) {
      ctx.save(); ctx.translate(x - fac * 6, y); ctx.scale(fac, 1);
      ctx.rotate(-2.3 + (far ? .35 : 0) + flap * .28);
      ctx.scale(1, .42 + .18 * Math.abs(flap));
      ctx.globalAlpha = k * (far ? .55 : .8);
      ctx.fillStyle = far ? 'rgba(190,255,170,.35)' : 'rgba(220,255,190,.45)';
      ctx.strokeStyle = 'rgba(40,80,30,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(34, 0, 36, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,190,80,.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(66, 0); ctx.moveTo(14, 0); ctx.lineTo(44, -10); ctx.moveTo(14, 0); ctx.lineTo(44, 10); ctx.moveTo(30, 0); ctx.lineTo(60, -6); ctx.moveTo(30, 0); ctx.lineTo(60, 6); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function cloakBehind(ctx, z, x, fy, fac, k, time) {
    if (k < .02) return;
    const K = Kit(), H = bodyH(z), C = CLOAK[z.bossId], seed = z.seed || 0;
    for (let i = 0; i < C.tails; i++) {
      const base = fac > 0 ? -2.45 : -.69, ang = base + (i - (C.tails - 1) / 2) * (C.tails > 4 ? .17 : .26) * fac;
      spine(x - fac * 8, fy - H * .42, ang, (H * .45 + 26 * k) * (1 + (i % 3) * .12), -1.1 * fac, .35, time * 3 + i * .9 + seed, 9);
      ribbon(ctx, SP, 9, 15 * k + 3, 1.5, `rgba(${C.fill},${.82 * k})`, `rgba(${C.dark},${.45 * k})`, `rgba(${C.dark},${.75 * k})`, 2);
    }
    // the shroud: a flickering silhouette hugging the body
    ctx.fillStyle = `rgba(${C.fill},${.4 * k})`;
    ctx.beginPath();
    const cx = x, cy = fy - H * .5, rx = 30, ry = H * .62;
    for (let i = 0; i <= 26; i++) {
      const a = i / 26 * TAU, up = Math.max(0, -Math.sin(a));
      const fl = 1 + (hash(i + Math.floor(time * 12) * .37 + seed) * .22 + up * .25) * (i % 2 ? 1 : .4);
      const px = cx + Math.cos(a) * rx * fl, py = cy + Math.sin(a) * ry * (a > 0 && a < Math.PI ? .78 : fl);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${C.dark},${.5 * k})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, ry * 1.3, C.glow, .3 * k, false, 1.2);
    ctx.globalCompositeOperation = 'source-over';
  }
  function cloakFront(ctx, z, x, fy, fac, k, time) {
    if (k < .02) return;
    const K = Kit(), H = bodyH(z), C = CLOAK[z.bossId], seed = z.seed || 0, hy = fy - H + 12;
    ctx.lineCap = 'round';
    if (C.ears !== 'none') for (const s of [-1, 1]) {
      const bx = x + s * 9 + fac * 2, by = hy + 4;
      ctx.beginPath();
      if (C.ears === 'cat') { ctx.moveTo(bx - s * 5, by); ctx.lineTo(bx + s * 4, by - 20 * k); ctx.lineTo(bx + s * 8, by + 2); ctx.closePath(); }
      else if (C.ears === 'horn') { ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + s * 16, by - 2, bx + s * 14, by - 22 * k); }
      else { ctx.arc(bx + s * 4, by, 6 * k, 0, TAU); }
      if (C.ears === 'horn') { ctx.strokeStyle = `rgba(${C.dark},${.85 * k})`; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = `rgba(${C.fill},${.95 * k})`; ctx.lineWidth = 5; ctx.stroke(); }
      else { ctx.fillStyle = `rgba(${C.fill},${.85 * k})`; ctx.fill(); ctx.strokeStyle = `rgba(${C.dark},${.85 * k})`; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.fillStyle = `rgba(${C.fill},${.12 * k})`;
    ctx.beginPath(); ctx.ellipse(x, fy - H * .48, 22, H * .52, 0, 0, TAU); ctx.fill();
    // the chakra's own matter boiling off the shroud
    if (C.fx === 'bfire') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { const ph = frac(time * 2.2 + hash(i * 1.9 + seed)), bx = x + (i - 3) * 8 + Math.sin(time * 5 + i) * 3, by = fy - H * (.1 + hash(i + seed) * .7); tongue(ctx, bflame(i), bx, by - ph * 10, 14, 30 * (1 - ph * .5), k * (1 - ph)); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (C.fx === 'lava') {
      for (let i = 0; i < 6; i++) {
        const ph = frac(time * .9 + hash(i * 1.9 + seed)), bx = x + (hash(i * 3.3 + seed) - .5) * 44, by = fy - H * (.2 + hash(i + seed) * .6) + ph * 26;
        ctx.fillStyle = `rgba(40,10,4,${k * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(bx, by, 4, 5.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,150,40,${k * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(bx, by - .5, 2.6, 3.8, 0, 0, TAU); ctx.fill();
      }
      const ph = frac(time * .7 + seed); K.stamp(ctx, K.puff('smoke'), x + Math.sin(time) * 8, fy - H - ph * 40, 14 + ph * 16, (1 - ph) * .5 * k);
    } else if (C.fx === 'steam') {
      const sp = puffImg('jc:steam');
      for (let i = 0; i < 6; i++) { const ph = frac(time * .9 + hash(i + seed)), bx = x + (hash(i * 3.3 + seed) - .5) * 50 - fac * ph * 20, by = fy - 20 - ph * (H + 30); K.stamp(ctx, sp, bx, by, 9 + ph * 16, bell(ph) * .8 * k); }
    } else if (C.fx === 'bubble') {
      for (let i = 0; i < 7; i++) { const ph = frac(time * .7 + hash(i + seed)), bx = x + (hash(i * 3.3 + seed) - .5) * 52 + Math.sin(time * 3 + i) * 5, by = fy - 10 - ph * (H + 30), r = 4 + 6 * (1 - ph); ctx.globalAlpha = k * (1 - ph * .6); ctx.drawImage(bubbleImg(), bx - r, by - r, r * 2, r * 2); }
      ctx.globalAlpha = 1;
    } else if (C.fx === 'powder') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const ph = frac(time * .8 + hash(i + seed)), bx = x + (hash(i * 3.3 + seed) - .5) * 56, by = fy - 10 - ph * (H + 20); star(ctx, bx, by, (3 + 3 * Math.abs(Math.sin(time * 12 + i))) * k, 'rgba(255,255,200,.9)'); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const ph = frac(time * .9 + hash(i + seed * 2)), bx = x + (hash(i * 5.3 + seed) - .5) * 50, by = fy - 10 - ph * (H + 30); K.glow(ctx, bx, by, 6 + 5 * (1 - ph), C.glow, (1 - ph) * .6 * k); }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ the full beast
  // Scratch object handed to TailedBeasts.draw (never stored on z): health 0 + deathTimer 1.2 paints the
  // body at full alpha without the beast's own name plate and health bar.
  const FAKE = { beastId: 'matatabi', x: 0, y: 0, angle: 0, health: 0, maxHealth: 1, deathTimer: 1.2, pulse: 0, beastWindup: 0, beastPulse: 0, beastDashTimer: 0, seed: 0, hitFlash: 0, tb: null };
  const beastScale = (b) => b.t < .4 ? easeBack(b.t / .4) : b.t > b.dur - .4 ? 1 - easeIn((b.t - b.dur + .4) / .4) : 1;
  function beastGround(ctx, z, st, time) {
    const b = st.beast, s = beastScale(b), sh = 1 - b.lift * .5;
    ctx.fillStyle = 'rgba(16,10,20,.3)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 3, 150 * s * sh, 46 * s * sh, 0, 0, TAU); ctx.fill();
    if (b.charge) {
      const k = clamp01((b.t - b.charge.t0) / b.charge.fire), c = Math.cos(b.charge.a), sn = Math.sin(b.charge.a), mo = beastMouth(b);
      const L = b.charge.len || 1000;
      teleShape(ctx, { k: 'line', x: mo.x, y: b.y + sn * 20, a: b.charge.a, len: L, w: 100 }, '200,110,255', k, time);
      markCircle(ctx, mo.x + c * L, b.y + sn * 20 + sn * L, 400, '200,110,255', k, time, false);
    }
  }
  function beastOver(ctx, z, st, time) {
    const b = st.beast, s = beastScale(b), K = Kit(), TB = window.TailedBeasts, C = CLOAK[z.bossId];
    if (!TB || s <= .02) return;
    const lift = b.lift * FLY_PX, act = b.act > 0 || !!b.charge;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, b.x, b.y - 150 * s - lift, 260 * s, C.glow, .16, false, 1.1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(b.x, b.y - lift); ctx.scale(BK * s, BK * s);
    FAKE.beastId = b.id; FAKE.angle = b.f > 0 ? 0 : Math.PI; FAKE.beastWindup = act ? 1 : 0; FAKE.beastPulse = act ? 1 : 0;
    FAKE.pulse = b.dash ? b.t * 3 : b.t * 1.2; FAKE.seed = b.seed; FAKE.beastDashTimer = b.dash || b.swoop ? 1 : 0;
    try { TB.draw(ctx, FAKE, time); } catch (e) { /* the beast art is cosmetic */ }
    ctx.restore();
    if (b.dash && b.id === 'kokuo') {
      // steam blasting off Kokuō's flanks as it charges
      const sp = puffImg('jc:steam'), dust = K.puff('dust'), c = Math.cos(b.dash.a), sn = Math.sin(b.dash.a);
      for (let i = 0; i < 8; i++) { const ph = frac(time * 3 + i / 8); K.stamp(ctx, dust, b.x - c * (40 + ph * 260) + (hash(i * 5) - .5) * 120, b.y - sn * (40 + ph * 260) - 14 - ph * 30, 34 + ph * 46, (1 - ph) * .7, .7); }
      for (let i = 0; i < 8; i++) { const ph = frac(time * 3 + i / 8); K.stamp(ctx, sp, b.x - c * (60 + ph * 200) + (hash(i) - .5) * 80, b.y - 60 - hash(i * 3) * 160 - ph * 40, 30 + ph * 40, (1 - ph) * .8); }
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(255,255,255,.8)' : 'rgba(30,20,30,.3)'; ctx.lineWidth = pass ? 3 : 6; ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const o = (hash(i * 2.1) - .5) * 300, h = 40 + hash(i * 3.3) * 220, l = 160 + hash(i) * 200, s0 = 80 + frac(time * 4 + hash(i)) * 120;
          ctx.moveTo(b.x - c * s0 - sn * o, b.y - h - sn * s0 + c * o * .3); ctx.lineTo(b.x - c * (s0 + l) - sn * o, b.y - h - sn * (s0 + l) + c * o * .3);
        }
        ctx.stroke();
      }
    }
    // the Tailed Beast Ball condensing at the maw
    if (b.charge) {
      const k = clamp01((b.t - b.charge.t0) / b.charge.fire), mo = beastMouth(b), r = 12 + 60 * easeOut(k), bx = mo.x + b.f * (r + 10), by = b.y - mo.h + 6;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, bx, by, r * 4, '170,80,255', .6);
      ctx.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        const ph = frac(time * 1.6 + hash(i + b.seed)), an = hash(i * 3.7 + b.seed) * TAU + time;
        const d0 = r + 260 * (1 - ph), d1 = d0 * .75;
        ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${ph})` : `rgba(${i % 3 ? '160,90,255' : C.glow},${ph})`; ctx.lineWidth = 3 + ph * 3;
        ctx.beginPath(); ctx.moveTo(bx + Math.cos(an) * d0, by + Math.sin(an) * d0 * .8); ctx.lineTo(bx + Math.cos(an) * d1, by + Math.sin(an) * d1 * .8); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      tbbBall(ctx, bx, by, r, time, Math.min(1, k * 3), C.glow);
    }
    // name plate over the beast
    if (s > .5) {
      const m = members[z.bossId], TBm = TB.members[b.id], top = b.y - lift - (TBm ? TBm.height : 170) * BK * s - 24, w = 170;
      ctx.fillStyle = 'rgba(8,6,12,.85)'; ctx.fillRect(b.x - w / 2 - 2, top - 2, w + 4, 11);
      ctx.fillStyle = m.accent; ctx.fillRect(b.x - w / 2, top, w * clamp01(z.health / z.maxHealth), 7);
      ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#0c0810'; ctx.strokeText(BEAST_NAME[z.bossId], b.x, top - 7);
      ctx.fillStyle = '#fff4e2'; ctx.fillText(BEAST_NAME[z.bossId], b.x, top - 7);
      if (b.charge) {
        ctx.font = '900 11px sans-serif'; ctx.strokeText('VĨ THÚ NGỌC', b.x, top - 22); ctx.fillStyle = '#d9a2ff'; ctx.fillText('VĨ THÚ NGỌC', b.x, top - 22);
      }
    }
  }

  // ------------------------------------------------------------------ windup looks
  function windupOverlay(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, fac = facingOf(z), H = bodyH(z), el = BEAST_EL[z.bossId];
    const hx = z.x + fac * 20, hy = z.y - H * .5 - (st.fly * 34);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, hx, hy, 30 + 50 * k, CLOAK[z.bossId].glow, .35 + .4 * k, true);
    // chakra motes converging on the hands
    for (let i = 0; i < 10; i++) {
      const ph = frac(time * 1.8 + hash(i + st.seed)), an = hash(i * 3.3 + st.seed) * TAU, d = (90 + 60 * hash(i)) * (1 - ph);
      const x = hx + Math.cos(an) * d, y = hy + Math.sin(an) * d * .7;
      if (el === 'powder') star(ctx, x, y, 3 + 3 * ph, 'rgba(255,255,200,.9)');
      else K.glow(ctx, x, y, 5 + 4 * ph, el === 'bfire' ? '90,160,255' : el === 'lava' ? '255,130,40' : el === 'acid' ? '170,255,200' : '255,240,230', ph * .9);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (st.move === 'beast') {
      // the beast's chakra erupting before the transformation
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, z.y - H * .5, 80 + 160 * k, CLOAK[z.bossId].glow, .3 + .4 * k, false, 1.4);
      K.fx.shockRing(ctx, z.x, z.y, 150 + 100 * k, frac(time * 1.5), .6, CLOAK[z.bossId].glow);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function label(ctx, z, st, m) {
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - bodyH(z) - 40 - st.fly * 34;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '900 12px sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = '#160f1d';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.jc;
    if (!st || !members[z.bossId] || !Kit()) return;
    FLICK = Math.floor(time * 12);
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.beast) beastGround(ctx, z, st, time);
      else {
        const fac = facingOf(z), lift = st.fly * 34;
        if (z.bossId === 'fu' && st.fly > .02) wings(ctx, z.x, z.y + 3 - lift - bodyH(z) * .62, fac, st.fly, time);
        if (st.cloak > .02) cloakBehind(ctx, z, z.x, z.y + 3 - lift, fac, st.cloak, time);
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.jc, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    FLICK = Math.floor(time * 12);
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (st.beast) beastOver(ctx, z, st, time);
      else if (st.cloak > .02) cloakFront(ctx, z, z.x, z.y + 3 - st.fly * 34, facingOf(z), st.cloak, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (st.windup > 0 && st.move) {
        windupOverlay(ctx, z, st, time);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.jc && z.jc.beast && z.health > 0 && z.jc.beast.t > .15);
  const bodyLift = z => (z.jc ? z.jc.fly * 34 : 0);

  window.JinchurikiBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moves };
})();
