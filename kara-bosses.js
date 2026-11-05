(() => {
  'use strict';

  // Kara (Boruto era), faction 'kara': Jigen (Isshiki's vessel), Code, Kashin Koji and the Ōtsutsuki
  // Urashiki and Toneri. update(z, dt, api) drives the jutsu; draw(ctx, z, time) paints telegraphs and
  // ground effects, drawOverlay(ctx, z, time) what stands above the characters. All cast state lives on
  // the enemy (z.kr) as plain, JSON-friendly data: effects are records, delayed blows are records in
  // fx.hits, and the rare custom step is a named handler (EV) with plain args.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R = Math.round;
  const r1 = v => Math.round(v * 10) / 10;
  const r3 = v => Math.round(v * 1000) / 1000;
  const Kit = () => window.VFXKit;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const FB = 114 / 128;

  // =================================================================== sprites (registered at load)
  function buildSprites() {
    const AS = window.AnimeSprites, K = AS && AS.kit;
    if (!K || !AS.addSprite) return;
    const { robeSpec, HAIR, paint, smooth, ell, dot, line, dark, rgba, SHADE, horns, drawEye, onFace, locks,
      headPath, sweptHair, sweptBack, maneDrape } = K;

    // ---- Jigen: long black hair slicked back, goatee, two short horns, Karma eye and black Karma
    // diamonds on the face; dark monk's robe with a beige patchwork kasaya and prayer beads.
    function jigenSpec() {
      const O = '#1a1418', ROBE = '#38333e', KAS = '#cdb48e', HAIRC = '#211d25', SKIN = '#e9ccb0', BEAD = '#6a3a2a';
      const karma = (ctx, big) => onFace(ctx, () => {
        ctx.fillStyle = '#141019';
        const dia = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x + s * .62, y); ctx.lineTo(x, y + s * 1.5); ctx.lineTo(x - s * .62, y); ctx.closePath(); ctx.fill(); };
        dia(.6, 6.2, .95); dia(-.9, 9, .7); dia(3.2, -4.6, .75);
        if (big) { dia(8.6, 7.4, .7); dia(-3.4, 4.2, .8); dia(5.8, -6.2, .6); }
        ctx.strokeStyle = '#141019'; ctx.lineWidth = .32;
        ctx.beginPath(); ctx.moveTo(.6, 4.6); ctx.lineTo(.6, 7.8); ctx.lineTo(-.9, 10.4); ctx.moveTo(3.2, -3); ctx.lineTo(2.6, -.6); ctx.stroke();
      });
      return robeSpec({
        outline: O, skin: SKIN, skinShade: '#c9a48c', bulk: .8, legK: 1.12,
        legs: { thigh: dark(ROBE, .14), shin: dark(ROBE, .14), foot: '#2a2420', w1: 5.8, boots: true },
        arms: { upper: ROBE, lower: ROBE, w1: 5.9, w2: 5.4, cuff: KAS, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            // Kasaya over the near shoulder down to the far hip, sewn from patches.
            ctx.fillStyle = KAS; ctx.beginPath(); ctx.moveTo(-7.4, -12.4); ctx.lineTo(-3.2, -13.6); ctx.lineTo(8.2, -3.6); ctx.lineTo(8.2, 1); ctx.lineTo(3.4, 1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = dark(KAS, .35); ctx.lineWidth = .35;
            for (let i = 0; i < 5; i++) { const t = i / 4, x = lerp(-5.4, 6, t), y = lerp(-13, -1.4, t); ctx.beginPath(); ctx.moveTo(x - 2.2, y + 2.4); ctx.lineTo(x + 2.4, y - 2.2); ctx.stroke(); }
            ctx.beginPath(); ctx.moveTo(-5.2, -12.8); ctx.lineTo(5.8, -.2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(-3.2, -13.6); ctx.lineTo(-2.2, -13.6); ctx.lineTo(8.2, -4.4); ctx.lineTo(8.2, -3.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = dark(ROBE, .5); ctx.fillRect(-8, -3.4, 17, 2.4);
            ctx.fillStyle = KAS; ctx.fillRect(-8, -2.6, 17, .5);
          },
          over(ctx) {
            // Prayer beads round the neck.
            for (let i = 0; i < 9; i++) { const a = .35 + i / 8 * 2.4, x = 1.6 + Math.cos(a) * 5.4, y = -13.4 + Math.sin(a) * 4.4; dot(ctx, x, y, .78, O); dot(ctx, x, y, .6, BEAD); dot(ctx, x - .2, y - .2, .22, 'rgba(255,230,200,.6)'); }
            dot(ctx, 1.6, -8.4, 1.05, O); dot(ctx, 1.6, -8.4, .85, KAS);
          }
        },
        skirt: { color: ROBE, hem: 1, flare: 2, paint: (ctx, hem) => { ctx.fillStyle = KAS; ctx.fillRect(-18, hem - 1.8, 36, 1.8); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-18, hem - 4.4, 36, 2.6); } },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.2, -17.2); ctx.quadraticCurveTo(-1, -15.6, 4.6, -14.6);
            ctx.lineTo(8, -15.6); ctx.lineTo(7.6, -11); ctx.closePath();
          }, ROBE, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -18, 5, 8);
            ctx.strokeStyle = KAS; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-7, -16.6); ctx.quadraticCurveTo(-1, -15, 4.6, -14); ctx.lineTo(8, -15); ctx.stroke();
          });
        },
        head: {
          drape: HAIR.longBack(HAIRC, 24, 10.5, { split: true }),
          hair: HAIR.smooth(HAIRC, { nape: 8.6 }),
          eyes: { type: 'normal', iris: '#2b2228' }, mouth: 'frown', browAngle: 'angry', browColor: HAIRC, browW: 1, blush: false,
          marks(ctx) {
            // Moustache and pointed goatee.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(3.2, 9.8); ctx.quadraticCurveTo(5.8, 11.2, 8.2, 9.6); ctx.quadraticCurveTo(7.4, 13.4, 5.4, 15); ctx.quadraticCurveTo(3.8, 12.6, 3.2, 9.8); ctx.closePath(); }, HAIRC, O, .5, () => {
              ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = .3; ctx.beginPath(); ctx.moveTo(5.4, 10.6); ctx.lineTo(5.4, 14); ctx.stroke();
            });
            ctx.fillStyle = HAIRC; ctx.beginPath(); ctx.moveTo(3, 6.6); ctx.quadraticCurveTo(6.4, 5, 9.6, 5.8); ctx.lineTo(9.6, 6.6); ctx.quadraticCurveTo(6.4, 6, 3.6, 7.6); ctx.closePath(); ctx.fill();
            karma(ctx, false);
          },
          front(ctx, spec, pose) {
            horns(ctx, [[-.8, -10.2, 6.4, -124, 1.3], [6.2, -10.8, 5.8, -72, 1.15]], '#e8dece', O);
            // Isshiki's Karma eye in the near socket: black sclera, gold-violet ripples.
            drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'edoRinnegan' }, O, true);
            ctx.strokeStyle = 'rgba(240,200,120,.75)'; ctx.lineWidth = .22; ell(ctx, 2.74, 2.56, 1.15, 1.7); ctx.stroke();
            if (pose && (pose.seal || pose.attack)) karma(ctx, true);
            locks(ctx, spec, HAIRC, [[-1.4, -8.2, -2.8, 2.4, 1.3, -1.1], [9.8, -6.6, 10.8, -1.2, 1, .8]], .8);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          // A black Sukunahikona rod pinched between two fingers.
          ctx.save(); ctx.translate(hand[0] + .6, hand[1]); ctx.rotate(-.5);
          line(ctx, [[0, 0], [14, 0]], O, 2); line(ctx, [[0, 0], [14, 0]], '#1b1822', 1.2);
          for (const x of [4, 8, 12]) line(ctx, [[x, -.7], [x, .7]], '#e0b060', .5);
          ctx.restore();
        }
      }, ROBE, KAS);
    }

    // ---- Code: wild white hair, black claw-like marks under the eyes, white high-collared sleeveless
    // coat with long tails over a black suit, bandaged shins and Karma triangles on the forearms.
    function codeSpec() {
      const O = '#121218', SKIN = '#f1ded2', HAIRC = '#eeedf2', SUIT = '#22212a', COAT = '#ebe9f0', WRAP = '#d8d4cc';
      return {
        outline: O, skin: SKIN, skinShade: '#cdb0a8', legK: 1.14,
        legs: { thigh: SUIT, shin: SUIT, foot: '#1b1a22', wrap: WRAP, w1: 5.2, w2: 4.2 },
        arms: {
          upper: SUIT, lower: SUIT, w1: 4.6, w2: 4.0, cuff: WRAP, hand: SKIN,
          pattern(ctx, p0, p1, p2) {
            // Karma triangles crawling up the forearm.
            ctx.fillStyle = '#0a090e';
            for (const t of [.25, .5]) {
              const x = lerp(p1[0], p2[0], t), y = lerp(p1[1], p2[1], t);
              ctx.beginPath(); ctx.moveTo(x - 1.1, y - .4); ctx.lineTo(x + 1.1, y - .4); ctx.lineTo(x, y + 1.2); ctx.closePath(); ctx.fill();
            }
          }
        },
        torso: {
          base: SUIT, paint: ctx => {
            ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(1, -13, 4, 13);
            ctx.fillStyle = '#3a3846'; ctx.fillRect(-8, -3.2, 17, 2.2);
          },
          over(ctx) {
            // Open white coat: two front panels with a dark inner edge.
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.2, -12.8); ctx.lineTo(-1.4, -13.6); ctx.quadraticCurveTo(-2.2, -6, -1, 1); ctx.lineTo(-7.6, 1); ctx.quadraticCurveTo(-8.2, -6, -7.2, -12.8); ctx.closePath(); }, COAT, O, .85, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-9, -14, 4.6, 16);
              ctx.strokeStyle = 'rgba(40,30,60,.35)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-4.6, -10); ctx.quadraticCurveTo(-5.2, -4, -4.4, 1); ctx.stroke();
            });
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(5.8, -13.2); ctx.lineTo(8.2, -12.2); ctx.quadraticCurveTo(8.9, -6, 8.3, 1); ctx.lineTo(5.6, 1); ctx.quadraticCurveTo(6.6, -6, 5.8, -13.2); ctx.closePath(); }, COAT, O, .8, () => {
              ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(7.4, -12, .8, 12);
            });
            line(ctx, [[-1.4, -13.4], [-1.1, 1]], '#0a090e', .5);
          }
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7.4, -11); ctx.lineTo(-8.6, -18.4); ctx.quadraticCurveTo(-3.4, -17.6, -.6, -15); ctx.lineTo(-.6, -11); ctx.closePath(); }, COAT, O, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-9, -19, 4, 9); });
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(4.4, -12.6); ctx.lineTo(8.8, -17.2); ctx.lineTo(9.2, -12.4); ctx.closePath(); }, COAT, O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(4, -18, 3, 7); });
        },
        skirt: { color: COAT, hem: 10, flare: 1.6, paint: (ctx, hem) => { ctx.fillStyle = '#c8c4d4'; ctx.fillRect(-20, hem - 1.2, 40, 1.4); ctx.fillStyle = SUIT; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(6.6, -1); ctx.lineTo(8.6, hem + 2); ctx.lineTo(3.4, hem + 2); ctx.closePath(); ctx.fill(); } },
        head: {
          back(ctx, spec) { sweptBack(ctx, spec, HAIRC, [[-66, 21.6], [-94, 23.8], [-122, 23.4], [-150, 21.8], [-178, 19.4], [-204, 16.4]], { valley: 12.6, sweep: .3 }); },
          hair: (ctx, sp) => sweptHair(ctx, sp, HAIRC, [[-30, 16.8], [-54, 21.6], [-78, 24.4], [-102, 25], [-126, 24], [-150, 22], [-176, 19.2], [-202, 16.2], [-224, 12.8]], { valley: 13.2, sweep: .36, gloss: '#ffffff' }),
          eyes: { type: 'normal', iris: '#6c5a7e' }, mouth: 'smirk', attackMouth: 'grin', browAngle: 'angry', browColor: '#b8b8c4', blush: false,
          marks(ctx) {
            // Claw-like black marks running down from both eyes.
            ctx.fillStyle = '#0c0b12';
            const claw = (x0, y0, x1, y1, w) => { ctx.beginPath(); ctx.moveTo(x0 - w, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - w * .6, (y0 + y1) / 2, x1, y1); ctx.quadraticCurveTo((x0 + x1) / 2 + w * .5, (y0 + y1) / 2, x0 + w, y0); ctx.closePath(); ctx.fill(); };
            claw(1.2, 4.8, -.2, 9.2, .5); claw(2.6, 5, 2.2, 9.8, .45); claw(3.9, 4.9, 4.4, 8.6, .38);
            claw(7.4, 4.6, 7, 8.4, .36); claw(8.6, 4.5, 8.9, 7.6, .3);
          },
          front(ctx, spec) {
            locks(ctx, spec, HAIRC, [[-1.4, -8.4, -3.2, -.4, 1.5, -1.2], [2, -9, .8, -3.6, 1.3, -.6], [5.4, -8.8, 6.8, -4, 1.2, .8], [9.6, -7.4, 11, -1.8, 1.2, 1]], .85);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          // A black Claw Mark trailing off the swiping hand.
          ctx.save(); ctx.translate(hand[0], hand[1]);
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.moveTo(1, -3 + i * 2); ctx.quadraticCurveTo(8, -6 + i * 2.4, 15, -4 + i * 3); ctx.quadraticCurveTo(8, -4.6 + i * 2.4, 1, -2.2 + i * 2); ctx.closePath();
            ctx.fillStyle = '#08070c'; ctx.fill(); ctx.strokeStyle = 'rgba(230,225,255,.85)'; ctx.lineWidth = .3; ctx.stroke();
          }
          ctx.restore();
        }
      };
    }

    // ---- Kashin Koji: Jiraiya's wild white mane, a horned dark plate, a black face mask with white
    // trim; dark coat with gold trim over a deep-red inner robe, steel arm guards.
    function kashinSpec() {
      const O = '#1b1416', SKIN = '#eec8a4', HAIRC = '#efebe4', COAT = '#2f2d39', TRIM = '#d8a848', INNER = '#7a2626', MASK = '#17161c';
      return {
        outline: O, skin: SKIN, skinShade: '#cf9c80', legK: 1.16, bulk: .6,
        legs: { thigh: dark(COAT, .1), shin: dark(COAT, .1), foot: '#3a2a22', w1: 6, w2: 4.8 },
        arms: { upper: COAT, lower: COAT, guard: '#8f96a0', w1: 5.4, w2: 4.6, hand: SKIN },
        torso: {
          base: COAT, paint: ctx => {
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(-.4, -13.6); ctx.lineTo(6.6, -13.6); ctx.lineTo(3.2, -5.6); ctx.closePath(); ctx.fill();
            line(ctx, [[-.4, -13.6], [3.2, -5.6], [6.6, -13.6]], TRIM, .7);
            ctx.fillStyle = '#18161e'; ctx.fillRect(-8, -3.8, 17, 2.8);
            ctx.fillStyle = TRIM; ctx.fillRect(-8, -2.9, 17, .55);
            dot(ctx, 3.6, -2.4, 1.1, TRIM); dot(ctx, 3.6, -2.4, .5, '#5a3a10');
          },
          over(ctx) {
            line(ctx, [[-7, -12.8], [-7.4, 1]], TRIM, .6);
          }
        },
        shoulder(ctx) {
          paint(ctx, () => smooth(ctx, [[-7.4, -13], [-2.4, -14], [1, -12.2], [-.4, -8.6], [-6.6, -8.2], [-8, -10.2]]), COAT, O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -10.2, 12, 3);
            ctx.strokeStyle = TRIM; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-7.6, -9.6); ctx.quadraticCurveTo(-3, -8.2, .6, -9.4); ctx.stroke();
          });
        },
        collarBack(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.4, -15.6); ctx.quadraticCurveTo(-4, -16.4, -1, -14.6); ctx.lineTo(-1, -11); ctx.closePath(); }, COAT, O, .9, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -16, 4, 6); });
        },
        skirt: { color: COAT, hem: 10, flare: 1.4, paint: (ctx, hem) => { ctx.fillStyle = TRIM; ctx.fillRect(-20, hem - 1.2, 40, 1.2); ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(2.8, -1); ctx.lineTo(7, -1); ctx.lineTo(9.4, hem + 2); ctx.lineTo(4, hem + 2); ctx.closePath(); ctx.fill(); } },
        head: {
          drape: maneDrape(HAIRC),
          back(ctx, spec) { sweptBack(ctx, spec, HAIRC, [[-70, 21.6], [-100, 23.4], [-128, 23.4], [-156, 22.4], [-182, 20.4], [-206, 17.4]], { valley: 13, sweep: .26 }); },
          hair: (ctx, sp) => sweptHair(ctx, sp, HAIRC, [[-32, 16.4], [-56, 20.6], [-80, 22.6], [-104, 23.2], [-128, 22.8], [-152, 21.6], [-176, 19.6], [-200, 17], [-222, 13.6]], { valley: 13.6, sweep: .26, gloss: '#ffffff' }),
          eyes: { type: 'normal', iris: '#3a2a22' }, browAngle: 'angry', browColor: '#d6d0c6', browW: 1.1, blush: false,
          band: { cloth: '#26222a', plate: '#3c3c46', symbol: 'none', wide: true },
          mask(ctx, spec) {
            // Black mask over nose and jaw, white trim along its top edge.
            const top = () => { ctx.moveTo(-9.8, 3.4); ctx.lineTo(-3.4, 4); ctx.quadraticCurveTo(1.6, 5.6, 6.2, 5.2); ctx.quadraticCurveTo(8.6, 4.8, 9.4, 3.5); ctx.quadraticCurveTo(10.6, 4, 11.2, 5.6); };
            ctx.save(); headPath(ctx); ctx.clip();
            ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.fillStyle = MASK; ctx.fill();
            ctx.save(); ctx.clip();
            ctx.fillStyle = 'rgba(255,255,255,.08)'; ell(ctx, 8.6, 6.2, 1.6, 1.2, .3); ctx.fill();
            ctx.fillStyle = '#e6e2dc'; ctx.fillRect(4.6, 7.8, 6, .7);
            ctx.restore();
            ctx.beginPath(); top(); ctx.strokeStyle = '#ece8e0'; ctx.lineWidth = .7; ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.clip();
            headPath(ctx); ctx.strokeStyle = spec.outline; ctx.lineWidth = 1.15; ctx.stroke();
            ctx.restore();
          },
          front(ctx, spec) {
            horns(ctx, [[1.2, -8.6, 5.4, -112, 1.3], [7.8, -7.8, 4.8, -74, 1.15]], '#d8dde6', O);
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.arc(4.4, -5.6, 1.3, 0, TAU); ctx.fill();
            ctx.fillStyle = '#3c3c46'; ctx.beginPath(); ctx.arc(4.4, -5.6, .6, 0, TAU); ctx.fill();
            locks(ctx, spec, HAIRC, [[-1.6, -8.6, -2.8, 10.4, 2, -1.4], [10, -7.2, 11.2, 7.6, 1.4, 1]], .9);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          dot(ctx, hand[0] + 1.4, hand[1], 3.4, 'rgba(120,190,255,.5)');
          dot(ctx, hand[0] + 1.4, hand[1], 2.2, 'rgba(225,245,255,.95)');
        }
      };
    }

    // ---- Urashiki: white hair with bangs, two small horns, Byakugan with a Rinnegan in the near eye;
    // white high-collared robe with violet trim; the chakra fishing rod slung across his back.
    function urashikiSpec() {
      const O = '#1c1a28', ROBE = '#eeedf4', TRIM = '#5c5a92', INNER = '#2e2a44', HAIRC = '#eef0f6', SKIN = '#f3e3da', ROD = '#6a5aa0';
      const rod = (ctx, x, y, rot, len) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        line(ctx, [[0, 0], [len, 0]], O, 1.6); line(ctx, [[0, 0], [len, 0]], ROD, 1);
        line(ctx, [[0, 0], [5, 0]], '#c8c0e0', 1.1);
        paint(ctx, () => ell(ctx, 3.4, 1.6, 1.4, 1.4), '#d8d2ec', O, .4);
        ctx.restore();
      };
      return robeSpec({
        outline: O, skin: SKIN,
        arms: { upper: ROBE, lower: ROBE, w1: 5.4, w2: 5.2, cuff: TRIM, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(0, -13.4); ctx.lineTo(6, -13.4); ctx.lineTo(3, -6.4); ctx.closePath(); ctx.fill();
            line(ctx, [[0, -13.4], [3, -6.4], [6, -13.4]], TRIM, .7);
            ctx.fillStyle = TRIM; ctx.fillRect(-8, -3.4, 17, 2.4);
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-8, -3.4, 17, .5);
            for (let i = 0; i < 3; i++) dot(ctx, -4 + i * 4, -7.6, .55, rgba(TRIM, .8));
          }
        },
        legs: { thigh: '#2c2846', shin: '#2c2846', foot: '#ede6dc', w1: 5.6, boots: true },
        skirt: { color: '#3a3462', hem: 2, flare: 1.6, paint: (ctx, hem) => { ctx.fillStyle = '#e8e6f2'; ctx.fillRect(-18, hem - 1.8, 36, 1.8); ctx.fillStyle = TRIM; ctx.fillRect(-18, hem - 2.6, 36, .7); } },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-8, -18.4); ctx.quadraticCurveTo(-1, -15.6, 4.6, -14.8);
            ctx.lineTo(9.2, -17.4); ctx.lineTo(7.6, -11); ctx.closePath();
          }, ROBE, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -19, 5, 9);
            ctx.strokeStyle = TRIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7.8, -17.6); ctx.quadraticCurveTo(-1, -15, 4.6, -14.1); ctx.lineTo(9, -16.6); ctx.stroke();
          });
        },
        back(ctx, pose) { if (!pose.attack) rod(ctx, -9, 2, -1.18, 30); },
        head: {
          back(ctx, spec) { sweptBack(ctx, spec, HAIRC, [[-80, 18.6], [-108, 19.6], [-136, 19], [-162, 17.6], [-188, 15.6], [-210, 13.4]], { valley: 11.6, sweep: .28 }); },
          hair: (ctx, sp) => sweptHair(ctx, sp, HAIRC, [[-36, 15.4], [-62, 18.6], [-88, 20.2], [-114, 20], [-140, 19], [-166, 17.4], [-192, 15.4], [-216, 12.8]], { valley: 12.4, sweep: .3, gloss: '#ffffff' }),
          eyes: { type: 'byakugan' }, mouth: 'smirk', browColor: '#b0b0c4', browAngle: 'angry', blush: false,
          front(ctx) {
            horns(ctx, [[.2, -10.8, 4.8, -114, 1.05], [6.8, -10.6, 4.4, -74, 1]], '#efe8de', O);
            drawEye(ctx, 2.4, 2.2, 2.1, 2.65, { type: 'rinnegan' }, O, true);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          rod(ctx, hand[0] - 2, hand[1] + 1, -.62, 26);
          ctx.strokeStyle = 'rgba(190,235,255,.9)'; ctx.lineWidth = .4;
          ctx.beginPath(); ctx.moveTo(hand[0] - 2 + Math.cos(-.62) * 26, hand[1] + 1 + Math.sin(-.62) * 26); ctx.quadraticCurveTo(hand[0] + 26, hand[1] - 8, hand[0] + 22, hand[1] + 6); ctx.stroke();
        }
      }, ROBE, TRIM);
    }

    // ---- Toneri: white hair with heavy bangs, blue Tenseigan with its white flower pupil; cream robe,
    // tall collar with a blue jewel and a pale-blue sash.
    function toneriSpec() {
      const O = '#1a1c2a', ROBE = '#f3f1ea', TRIM = '#6f8fd0', INNER = '#33456e', HAIRC = '#f2f2f6', SKIN = '#f4e6dc';
      return robeSpec({
        outline: O, skin: SKIN,
        arms: { upper: ROBE, lower: ROBE, w1: 5.4, w2: 5.2, cuff: TRIM, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            ctx.fillStyle = INNER; ctx.beginPath(); ctx.moveTo(.4, -13.4); ctx.lineTo(5.6, -13.4); ctx.lineTo(3, -7.4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-8, -4.2); ctx.lineTo(9, -4.6); ctx.lineTo(9, -1.6); ctx.lineTo(-8, -1.2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-8, -4.3, 17, .5);
            ctx.strokeStyle = rgba(TRIM, .7); ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(-6.6, -12); ctx.quadraticCurveTo(-2, -8, 6.6, -9.4); ctx.stroke();
          }
        },
        skirt: { color: ROBE, hem: 0, flare: 2.2, paint: (ctx, hem) => { ctx.fillStyle = TRIM; ctx.fillRect(-18, hem - 2, 36, 2); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-18, hem - 2.2, 36, .4); } },
        collar(ctx) {
          paint(ctx, () => {
            ctx.beginPath(); ctx.moveTo(-6.8, -11); ctx.lineTo(-7.6, -18.8); ctx.quadraticCurveTo(-1, -16, 4.6, -15);
            ctx.lineTo(8.8, -17.8); ctx.lineTo(7.6, -11); ctx.closePath();
          }, ROBE, O, 1, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-9, -19, 5, 9);
            ctx.strokeStyle = TRIM; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-7.4, -18); ctx.quadraticCurveTo(-1, -15.4, 4.6, -14.3); ctx.lineTo(8.6, -17); ctx.stroke();
          });
          paint(ctx, () => ell(ctx, 3.4, -12.6, 1.5, 1.3), '#5aa8ff', O, .5, () => { dot(ctx, 3, -13, .5, 'rgba(255,255,255,.85)'); });
        },
        head: {
          drape: HAIR.longBack(HAIRC, 15, 10),
          hair: HAIR.smooth(HAIRC, { bangs: [[9.6, 1.5, 4.8], [6.6, 1.4, 2], [3.4, 1.4, 1.2], [.2, 1.5, 5]] }),
          eyes: { type: 'normal', iris: '#3a8cff' }, mouth: 'neutral', browColor: '#c4c4d4', blush: false,
          front() {}
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          dot(ctx, hand[0] + 1, hand[1], 3.2, 'rgba(120,200,255,.45)');
          dot(ctx, hand[0] + 1, hand[1], 1.8, 'rgba(230,248,255,.95)');
        }
      }, ROBE, TRIM);
    }
    const toneri = toneriSpec();
    // Tenseigan: drawn after the eyes so the flower pupil sits on the blue iris.
    toneri.head.front = (ctx) => {
      const flower = (ix, iy, r) => {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; K.ell(ctx, ix + Math.cos(a) * r * .5, iy + Math.sin(a) * r * .62, r * .17, r * .4, a + Math.PI / 2); ctx.fill(); }
        K.dot(ctx, ix, iy, r * .22, '#10306e');
      };
      flower(2.74, 2.6, 1.5); flower(8.19, 2.45, 1.1);
    };

    AS.addSprite('jigen', jigenSpec(), { scale: 1.72, box: [-38, -86, 40, 8] },
      { hair: '#211d25', fringe: 'slick', accent: '#d8a850', long: true, horns: [[-.6, -1.5, -.9], [.6, -1.5, .9]] });
    AS.addSprite('code', codeSpec(), { scale: 1.6, box: [-38, -86, 38, 8] },
      { hair: '#eeedf2', fringe: 'spiky', accent: '#9a8ab8' });
    AS.addSprite('kashin', kashinSpec(), { scale: 1.64, box: [-40, -86, 38, 8] },
      { hair: '#efebe4', fringe: 'spiky', accent: '#e0a040', mask: '#17161c', long: true });
    AS.addSprite('urashiki', urashikiSpec(), { scale: 1.6, box: [-38, -86, 40, 8] },
      { hair: '#eef0f6', fringe: 'part', accent: '#8aa0ff', long: true, horns: [[-.7, -1.45, -.9], [.7, -1.45, .9]] });
    AS.addSprite('toneri', toneri, { scale: 1.62, box: [-38, -86, 38, 8] },
      { hair: '#f2f2f6', fringe: 'part', accent: '#5aa8ff', long: true });
    
  }
  try { buildSprites(); } catch (e) { /* sprites fall back to the generic boss look */ }

  // =================================================================== roster and moves
  const order = ['jigen', 'code', 'kashin', 'urashiki', 'toneri'];
  const members = {
    jigen: { name: 'JIGEN — VẬT CHỨA ISSHIKI', accent: '#e8c27a', hpScale: 4.0, damageScale: 2.0, lift: 0 },
    code: { name: 'CODE — TRẢO NGÂN', accent: '#ece8ff', hpScale: 3.5, damageScale: 1.9, lift: 0 },
    kashin: { name: 'KASHIN KOJI', accent: '#ffd27a', hpScale: 3.4, damageScale: 1.9, lift: 0 },
    urashiki: { name: 'ŌTSUTSUKI URASHIKI', accent: '#a8c0ff', hpScale: 3.9, damageScale: 2.0, lift: 0 },
    toneri: { name: 'ŌTSUTSUKI TONERI', accent: '#9fd4ff', hpScale: 4.0, damageScale: 2.0, lift: 10 }
  };
  const MOVES = {
    jigen: {
      rods:   { label: 'THIẾU DANH MỆNH · HẮC BỔNG', rgb: '240,200,120', windup: .75, after: 1.9 },
      shrink: { label: 'THIẾU DANH MỆNH · CỰ HÓA', rgb: '240,200,120', windup: .7, after: 1.8 },
      cubes:  { label: 'ĐẠI HẮC THIÊN · HẮC LẬP PHƯƠNG', rgb: '240,200,120', windup: .85, after: 2.0 },
      dash:   { label: 'KARMA · ĐỘT KÍCH', rgb: '255,210,140', windup: .55, after: 1.4 },
      crash:  { label: 'ĐẠI HẮC THIÊN · CỰ LẬP PHƯƠNG GIÁNG', rgb: '255,214,120', windup: 1.3, after: 3.0 }
    },
    code: {
      claw:  { label: 'TRẢO NGÂN · PHI TRẢM', rgb: '225,220,255', windup: .65, after: 1.6 },
      warp:  { label: 'TRẢO NGÂN · THUẤN DI', rgb: '225,220,255', windup: .6, after: 1.5 },
      grime: { label: 'TRẢO CẤU · BẠCH QUÁI', rgb: '235,235,245', windup: .8, after: 2.0 },
      rush:  { label: 'KARMA · GIẢI PHÓNG GIỚI HẠN', rgb: '235,230,255', windup: .55, after: 1.4 },
      storm: { label: 'TRẢO NGÂN · VẠN TRẢO LOẠN VŨ', rgb: '240,235,255', windup: 1.25, after: 3.0 }
    },
    kashin: {
      endan:    { label: 'HỎA ĐỘN · VIÊM ĐẠN', rgb: '255,150,60', windup: .7, after: 1.7 },
      rasengan: { label: 'ĐẠI NGỌC RASENGAN', rgb: '130,200,255', windup: .75, after: 1.5 },
      needles:  { label: 'NHẪN PHÁP · MAO CHÂM THIÊN BẢN', rgb: '240,236,228', windup: .7, after: 1.6 },
      toad:     { label: 'KHẨU TẾ CHI THUẬT · CỰ CÓC GIÁNG', rgb: '255,190,110', windup: .9, after: 1.9 },
      gamayu:   { label: 'HỎA ĐỘN · CÓC DU VIÊM ĐẠN', rgb: '255,130,40', windup: 1.3, after: 3.0 }
    },
    urashiki: {
      hook:   { label: 'ĐIẾU CAN · THÂU CHAKRA', rgb: '170,220,255', windup: .6, after: 1.6 },
      lash:   { label: 'ĐIẾU TUYẾN · CỰ TIÊN', rgb: '170,220,255', windup: .75, after: 1.6 },
      rings:  { label: 'ĐIẾU TUYẾN · LUÂN TRẢM', rgb: '180,200,255', windup: .7, after: 1.7 },
      rewind: { label: 'LUÂN HỒI NHÃN · THỜI GIAN NGHỊCH LƯU', rgb: '190,170,255', windup: .55, after: 1.6 },
      blink:  { label: 'THỜI GIAN · THUẤN ẢNH LOẠN KÍCH', rgb: '200,180,255', windup: 1.2, after: 3.0 }
    },
    toneri: {
      puppets: { label: 'KHÔI LỖI · NGUYỆT VỆ BINH', rgb: '160,200,255', windup: .8, after: 1.9 },
      tsb:     { label: 'CẦU ĐẠO NGỌC · CHUYỂN SINH', rgb: '140,190,255', windup: .7, after: 1.8 },
      meteor:  { label: 'NGUYỆT THẠCH · THIÊN GIÁNG', rgb: '255,180,110', windup: .9, after: 2.0 },
      wheel:   { label: 'KIM LUÂN CHUYỂN SINH BẠO', rgb: '255,215,120', windup: 1.0, after: 2.4 },
      blade:   { label: 'CHUYỂN SINH NHÃN · NGUYỆT TRẢM KIẾM', rgb: '120,200,255', windup: 1.4, after: 3.0 }
    }
  };
  // AI rotation (the ultimate comes round once per cycle); manual keys use the distinct moves, ultimate last.
  const SEQ = {
    jigen: ['rods', 'cubes', 'shrink', 'dash', 'crash'],
    code: ['claw', 'grime', 'warp', 'rush', 'storm'],
    kashin: ['endan', 'needles', 'rasengan', 'toad', 'gamayu'],
    urashiki: ['hook', 'lash', 'rings', 'rewind', 'blink'],
    toneri: ['tsb', 'puppets', 'meteor', 'wheel', 'blade']
  };
  const MANUAL = {};
  for (const id in MOVES) MANUAL[id] = Object.keys(MOVES[id]).slice(0, 8).map(k => ({ id: k, label: MOVES[id][k].label }));
  function moves(z) { return (z && MANUAL[z.bossId]) || []; }
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
  function pick(level) { return order[((level % order.length) + order.length) % order.length]; }

  // =================================================================== state
  function state(z) {
    return z.kr || (z.kr = { t: 0, casts: 0, timer: 1.1 + (z.id % 4) * .2, move: '', windup: 0, windMax: 1, aim: 0, tx: R(z.x), ty: R(z.y),
      tele: [], ev: [], fx: [], hold: 0, dash: null, hist: [], histT: 0, spots: null, armor: 1 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, h, a) => { if (st.ev.length < 40) st.ev.push({ t: r3(t), h, a: a || {} }); };
  const defOf = (z, move) => (MOVES[z.bossId] || {})[move];
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  // Hit helpers. Round ground areas are drawn as ellipses r × r/2, so their hits are a row of circles
  // radius r/2 along the major axis (what you see is what hits).
  function ellStrike(api, x, y, r, d, color, kind) {
    const n = r < 160 ? 3 : r < 330 ? 5 : 7, rr = r * .5;
    for (let i = 0; i < n; i++) {
      const mid = i === (n >> 1), ox = (i / (n - 1) * 2 - 1) * (r - rr);
      api.strike(x + ox, y, rr, d, mid ? color || null : null, mid ? kind || null : null, !(mid && color));
    }
  }
  function ringStrikes(api, x, y, rho, d, kind) {
    const n = Math.max(8, Math.ceil(TAU * rho / 120)), r = Math.max(46, TAU * rho / n * .5);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; api.strike(x + Math.cos(a) * rho, y + Math.sin(a) * rho * .5, r, d, null, i % 5 === 0 ? kind || null : null, true); }
  }
  function doHit(z, api, h, fx) {
    let x = h.x, y = h.y;
    if (h.it != null && fx && fx.items && fx.items[h.it]) { x = fx.items[h.it].x; y = fx.items[h.it].y; }
    switch (h.k) {
      case 'e': ellStrike(api, x, y, h.r, h.d, h.c, h.kd); break;
      case 'c': api.strike(x, y, h.r, h.d, h.c || null, h.kd || null, !h.c); break;
      case 'l': api.line(x, y, h.x2, h.y2, h.w, h.d, h.kd || null); break;
      case 'ring': ringStrikes(api, x, y, h.r, h.d, h.kd); break;
      case 'w': api.world(x, y, h.r, h.d, h.kd || 'crater', h.a || 0); break;
      case 's': api.shake(h.n); break;
      case 'kb': api.knockback(z, h.r, h.dist, h.d); break;
    }
  }
  function fxHits(z, st, fx, api) {
    if (fx.hits) for (const h of fx.hits) if (!h.done && fx.age >= h.t) { h.done = 1; doHit(z, api, h, fx); }
    if (fx.tk && fx.age >= fx.tn && fx.age < fx.tu) { fx.tn = r3(fx.tn + fx.tk); for (const h of fx.th) doHit(z, api, h, fx); }
  }
  // A beam / wave that travels: split into `n` segments, each hit as the front passes.
  function travelHits(hits, x, y, a, len, w, d, speed, n, kd, t0 = 0, from = 0) {
    const ca = Math.cos(a), sa = Math.sin(a), step = (len - from) / n;
    for (let i = 0; i < n; i++) {
      const d0 = from + i * step, d1 = d0 + step;
      hits.push({ t: r3(t0 + d1 / speed), k: 'l', x: R(x + ca * d0), y: R(y + sa * d0), x2: R(x + ca * d1), y2: R(y + sa * d1), w, d: r1(d), kd: kd && i % 2 === 0 ? kd : null });
    }
  }
  function scatter(cx, cy, r, n, firstAtCentre) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = i === 0 && firstAtCentre ? 0 : Math.sqrt(rand(.08, 1)) * r;
      out.push({ x: R(cx + Math.cos(a) * d), y: R(cy + Math.sin(a) * d * .55) });
    }
    return out;
  }
  function freeSpot(api, x, y, r) { return !(api.blocked && api.blocked(x, y, r)); }

  // =================================================================== telegraphs
  function teleFor(z, st, move) {
    const x = R(z.x), y = R(z.y), a = st.aim, tx = st.tx, ty = st.ty, id = z.bossId, ca = Math.cos(a), sa = Math.sin(a);
    const line = (len, w, ang = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: r3(ang), len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: R(cx), y: R(cy), r, faint });
    if (id === 'jigen') switch (move) {
      case 'rods': return [-2, -1, 0, 1, 2].map(i => line(880, 26, a + i * .16));
      case 'shrink': return [circ(tx, ty, 420, true)];
      case 'cubes': return [line(1000, 130)];
      case 'dash': return [line(720, 80), circ(x + ca * 720, y + sa * 720, 190)];
      case 'crash': return [circ(tx, ty, 380), circ(tx, ty, 540, true)];
    }
    if (id === 'code') switch (move) {
      case 'claw': return [-96, -32, 32, 96].map((o, i) => line(1000, 24, a + (i - 1.5) * .04, R(x - sa * o), R(y + ca * o)));
      case 'warp': {
        const a0 = a + Math.PI + rand(-.4, .4);
        st.spots = [0, 1, 2].map(i => { const b = a0 + i * TAU / 3, sx = R(tx + Math.cos(b) * 270), sy = R(ty + Math.sin(b) * 270 * .6); return { x: sx, y: sy, b: r3(Math.atan2(ty - sy, tx - sx)) }; });
        return st.spots.map(s => line(640, 40, s.b, s.x, s.y));
      }
      case 'grime': return [circ(tx, ty, 300, true)];
      case 'rush': {
        const out = []; let px = x, py = y;
        for (const off of [.55, -.55, .2]) { out.push(line(360, 60, a + off, R(px), R(py))); px += Math.cos(a + off) * 360; py += Math.sin(a + off) * 360; }
        out.push(circ(px, py, 170));
        return out;
      }
      case 'storm': return [circ(tx, ty, 520), line(1100, 70, .62, R(tx - Math.cos(.62) * 550), R(ty - Math.sin(.62) * 550)), line(1100, 70, Math.PI - .62, R(tx + Math.cos(.62) * 550), R(ty - Math.sin(.62) * 550))];
    }
    if (id === 'kashin') switch (move) {
      case 'endan': return [-2, -1, 0, 1, 2].map(i => { const b = a + i * .17, L = i % 2 ? 640 : 560; return [line(L, 26, b), circ(x + Math.cos(b) * L, y + Math.sin(b) * L, 125)]; }).flat();
      case 'rasengan': return [line(480, 70), circ(x + ca * 520, y + sa * 520, 200)];
      case 'needles': return [{ k: 'cone', x, y, a: r3(a), r: 780, h: .42 }];
      case 'toad': return [circ(tx, ty, 300)];
      case 'gamayu': return [line(1000, 120), circ(x + ca * 1000, y + sa * 1000, 300)];
    }
    if (id === 'urashiki') switch (move) {
      case 'hook': { const L = Math.min(820, Math.max(260, Math.hypot(tx - x, ty - y) + 60)); return [line(L, 30), circ(x + ca * L, y + sa * L, 80)]; }
      case 'lash': return [line(900, 70)];
      case 'rings': return [{ k: 'ring', x, y, r0: 110, r: 380 }];
      case 'rewind': return [circ(tx, ty, 210)];
      case 'blink': return [circ(tx, ty, 470)];
    }
    if (id === 'toneri') switch (move) {
      case 'puppets': return [circ(tx, ty, 260, true)];
      case 'tsb': { st.spots = scatter(tx, ty, 240, 6, true); return st.spots.map(s => circ(s.x, s.y, 115)); }
      case 'meteor': { st.spots = scatter(tx, ty, 430, 7, true); return st.spots.map(s => circ(s.x, s.y, 125)); }
      case 'wheel': return [circ(x, y, 400), circ(x, y, 540, true)];
      case 'blade': return [line(1200, 120), circ(x + ca * 1200, y + sa * 1200, 260)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId, list = SEQ[id];
    const move = forced && defOf(z, forced) ? forced : list[st.casts++ % list.length];
    const def = defOf(z, move), p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r3(aimAt(z, p));
    let tx = p ? p.x : z.x + Math.cos(st.aim) * 300, ty = p ? p.y : z.y + Math.sin(st.aim) * 300;
    const d = Math.hypot(tx - z.x, ty - z.y), max = 820;
    if (d > max) { tx = z.x + (tx - z.x) / d * max; ty = z.y + (ty - z.y) / d * max; }
    st.tx = R(tx); st.ty = R(ty);
    st.tele = teleFor(z, st, move);
    if (move === 'needles') st.armor = .4;
  }

  function startDash(z, st, o) {
    st.dash = { a: r3(o.a), speed: o.speed, left: r3(o.len / o.speed), seg: o.len, w: o.w, d: r1(o.d), ht: 0, end: o.end, endR: o.endR, endD: r1(o.endD),
      q: o.q || null, pts: [[R(z.x), R(z.y)], [R(z.x), R(z.y)]], rgb: o.rgb };
  }

  // =================================================================== casting
  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || z.damage || 42, id = z.bossId, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    const x = R(z.x), y = R(z.y), tx = st.tx, ty = st.ty, seed = R(Math.random() * 99);
    api.burst(z.x, z.y - 30, m.accent, 8);
    st.armor = 1;
    switch (id + ':' + move) {
      // -------------------------------------------------------------- Jigen
      case 'jigen:rods': {
        const speed = 1900, grow = .9, lines = st.tele.map(t => ({ x: t.x, y: t.y, a: t.a, len: t.len })), hits = [];
        lines.forEach((ln, i) => {
          const c = Math.cos(ln.a), s = Math.sin(ln.a), ex = R(ln.x + c * ln.len), ey = R(ln.y + s * ln.len);
          hits.push({ t: r3(ln.len / speed * .55), k: 'l', x: ln.x, y: ln.y, x2: ex, y2: ey, w: 26, d: r1(D * 1.2) });
          hits.push({ t: r3(ln.len / speed + grow), k: 'l', x: R(ln.x + c * ln.len * .22), y: R(ln.y + s * ln.len * .22), x2: ex, y2: ey, w: 60, d: r1(D * 1.7), kd: i % 2 ? null : 'crater' });
        });
        hits.push({ t: r3(880 / speed + grow), k: 's', n: 14 });
        addFx(st, { kind: 'jrods', lines, speed, grow, dur: r3(880 / speed + grow + 1.7), seed, hits });
        st.hold = .3;
        break;
      }
      case 'jigen:shrink': {
        const items = scatter(tx, ty, 420, 11, true).map((p, i) => ({ x: p.x, y: p.y, t0: r3(i * .055), fl: r3(.45 + hash(i + seed) * .2), v: i % 3, ch: i === 1 ? 1 : 0 }));
        const hits = items.map((it, i) => ({ t: r3(it.t0 + it.fl + .06), k: 'e', it: i, r: 80, d: r1(D * 1.5), kd: i % 3 === 0 ? 'crater' : null }));
        hits.push({ t: .7, k: 's', n: 10 });
        addFx(st, { kind: 'jshrink', x0: x, y0: y, items, dur: 2.9, seed, hits });
        st.hold = .35;
        break;
      }
      case 'jigen:cubes': {
        const items = [], hits = [];
        for (let i = 0; i < 7; i++) {
          const d = 150 + i * 140, off = (i % 2 ? 1 : -1) * 50;
          items.push({ x: R(x + ca * d - sa * off), y: R(y + sa * d + ca * off), t0: r3(i * .11), fl: .45, s: 74 + (i % 3) * 8, rot: r3(hash(i + seed) * 1.5) });
          hits.push({ t: r3(i * .11 + .45), k: 'e', it: i, r: 125, d: r1(D * 2.0), kd: i % 2 === 0 ? 'crater' : null });
        }
        hits.push({ t: .5, k: 's', n: 9 }, { t: 1.0, k: 's', n: 12 });
        addFx(st, { kind: 'jcubes', items, dur: 3.0, seed, hits });
        break;
      }
      case 'jigen:dash':
        startDash(z, st, { a, len: 720, speed: 2300, w: 80, d: D * 1.6, end: 'jdash', endR: 190, endD: D * 2.2, rgb: '255,205,120' });
        break;
      case 'jigen:crash': {
        const Rr = 380;
        const hits = [{ t: .9, k: 'e', x: tx, y: ty, r: Rr, d: r1(D * 4.2), c: '#f0c070', kd: 'crater' }, { t: 1.05, k: 'ring', x: tx, y: ty, r: 470, d: r1(D * 1.2), kd: 'shockwave' }, { t: .9, k: 's', n: 24 }];
        for (let i = 0; i < 6; i++) hits.push({ t: .92, k: 'w', x: R(tx + Math.cos(i * TAU / 6) * 250), y: R(ty + Math.sin(i * TAU / 6) * 125), r: 130, d: r1(D * 2.5) });
        addFx(st, { kind: 'jcrash', x: tx, y: ty, R: Rr, fall: .9, dur: 3.6, seed, hits });
        st.hold = 1.0;
        break;
      }
      // -------------------------------------------------------------- Code
      case 'code:claw': {
        const speed = 1700, marks = st.tele.map(t => ({ x: t.x, y: t.y, a: t.a, len: t.len })), hits = [];
        marks.forEach((mk, i) => travelHits(hits, mk.x, mk.y, mk.a, mk.len, 24, D * 1.3, speed, 3, i === 1 || i === 2 ? 'blade' : null));
        hits.push({ t: .2, k: 's', n: 9 });
        addFx(st, { kind: 'cclaw', marks, speed, dur: r3(1000 / speed + 1.5), seed, hits });
        st.hold = .25;
        break;
      }
      case 'code:warp': {
        const spots = st.spots || [], hits = [];
        spots.forEach((s, i) => {
          const t = r3(i * .27), ex = R(s.x + Math.cos(s.b) * 640), ey = R(s.y + Math.sin(s.b) * 640);
          later(st, t, 'tp', { x: s.x, y: s.y });
          hits.push({ t: r3(t + .07), k: 'l', x: s.x, y: s.y, x2: ex, y2: ey, w: 40, d: r1(D * 1.5), kd: 'blade' }, { t: r3(t + .07), k: 's', n: 9 });
          if (i === spots.length - 1) later(st, t + .14, 'tp', { x: R(s.x + Math.cos(s.b) * 420), y: R(s.y + Math.sin(s.b) * 420) });
        });
        addFx(st, { kind: 'cwarp', spots, tx, ty, x0: x, y0: y, dur: 2.1, seed, hits });
        st.spots = null; st.hold = .95;
        break;
      }
      case 'code:grime': {
        const items = [], hits = [];
        for (let i = 0; i < 6; i++) {
          const b = a + (i - 2.5) * .55, sx = R(x + Math.cos(b) * 80), sy = R(y + Math.sin(b) * 50), q = i / 6 * TAU + seed;
          const gx = R(tx + Math.cos(q) * rand(40, 150)), gy = R(ty + Math.sin(q) * rand(25, 80));
          const t0 = r3(.06 + i * .07);
          items.push({ sx, sy, x: gx, y: gy, t0, run: .6, ch: i % 3 === 1 ? 1 : 0, f: Math.cos(b) >= 0 ? 1 : -1 });
          hits.push({ t: r3(t0 + .85), k: 'e', it: i, r: 85, d: r1(D * 1.3) }, { t: r3(t0 + 1.2), k: 'e', it: i, r: 110, d: r1(D * .8), kd: i % 2 ? null : 'earth' });
        }
        hits.push({ t: 1.0, k: 's', n: 9 });
        addFx(st, { kind: 'cgrime', items, dur: 2.7, seed, hits });
        st.hold = .4;
        break;
      }
      case 'code:rush':
        startDash(z, st, { a: a + .55, len: 360, speed: 2600, w: 70, d: D * 1.4, end: 'crush', endR: 170, endD: D * 1.9, q: [r3(a - .55), r3(a + .2)], rgb: '235,230,255' });
        break;
      case 'code:storm': {
        const Rr = 520, marks = [], hits = [];
        for (let i = 0; i < 20; i++) {
          const b = rand(0, TAU), px = tx + rand(-.55, .55) * Rr, py = ty + rand(-.55, .55) * Rr * .5, t0 = r3(.05 + i * .075);
          const c = Math.cos(b), s = Math.sin(b), x1 = R(px - c * 420), y1 = R(py - s * 420 * .6), x2 = R(px + c * 420), y2 = R(py + s * 420 * .6);
          marks.push({ x1, y1, x2, y2, t0 });
          hits.push({ t: r3(t0 + .12), k: 'l', x: x1, y: y1, x2, y2, w: 24, d: r1(D * 1.0) });
        }
        const T = 1.75, X1 = { x1: R(tx - Math.cos(.62) * 550), y1: R(ty - Math.sin(.62) * 550), x2: R(tx + Math.cos(.62) * 550), y2: R(ty + Math.sin(.62) * 550) };
        const X2 = { x1: R(tx + Math.cos(.62) * 550), y1: R(ty - Math.sin(.62) * 550), x2: R(tx - Math.cos(.62) * 550), y2: R(ty + Math.sin(.62) * 550) };
        for (const L of [X1, X2]) hits.push({ t: T, k: 'l', x: L.x1, y: L.y1, x2: L.x2, y2: L.y2, w: 70, d: r1(D * 3.0), kd: 'blade' });
        hits.push({ t: T, k: 'e', x: tx, y: ty, r: 260, d: r1(D * 2.2), c: '#ece8ff', kd: 'crater' }, { t: T, k: 's', n: 22 });
        for (let i = 0; i < 4; i++) hits.push({ t: T + .02, k: 'w', x: R(tx + Math.cos(i * 1.57 + .6) * 220), y: R(ty + Math.sin(i * 1.57 + .6) * 110), r: 120, d: r1(D * 2) });
        addFx(st, { kind: 'cstorm', tx, ty, R: Rr, marks, X: [X1, X2], T, dur: T + 1.6, seed, hits });
        st.hold = 1.85;
        break;
      }
      // -------------------------------------------------------------- Kashin Koji
      case 'kashin:endan': {
        const speed = 950, balls = [], hits = [], th = [];
        for (let i = -2; i <= 2; i++) {
          const b = a + i * .17, L = (i + 2) % 2 ? 640 : 560, ex = R(x + Math.cos(b) * L), ey = R(y + Math.sin(b) * L);
          balls.push({ a: r3(b), len: L, x: ex, y: ey });
          hits.push({ t: r3(L / speed * .5), k: 'l', x, y, x2: ex, y2: ey, w: 30, d: r1(D * .9) });
          hits.push({ t: r3(L / speed), k: 'e', x: ex, y: ey, r: 125, d: r1(D * 1.8), kd: i % 2 ? null : 'fire' });
          th.push({ k: 'e', x: ex, y: ey, r: 105, d: r1(D * .3) });
        }
        hits.push({ t: .62, k: 's', n: 12 });
        addFx(st, { kind: 'kendan', x, y, balls, speed, dur: 3.0, seed, hits, tk: .45, tn: .95, tu: 2.5, th });
        st.hold = .3;
        break;
      }
      case 'kashin:rasengan':
        startDash(z, st, { a, len: 480, speed: 1500, w: 70, d: D * 1.2, end: 'krasen', endR: 200, endD: D * 2.8, rgb: '130,200,255' });
        break;
      case 'kashin:needles': {
        addFx(st, { kind: 'kneedles', x, y, a: r3(a), len: 780, speed: 2100, vol: 3, gap: .2, n: 9, half: .42, dur: 1.4, seed, ht: 0 });
        st.hold = .55;
        break;
      }
      case 'kashin:toad': {
        const Rr = 300, hits = [{ t: .55, k: 'e', x: tx, y: ty, r: Rr, d: r1(D * 3.0), c: '#ffb070', kd: 'crater' }, { t: .62, k: 'ring', x: tx, y: ty, r: 380, d: r1(D * .9), kd: 'shockwave' }, { t: .55, k: 's', n: 18 }];
        for (let i = 0; i < 4; i++) hits.push({ t: .58, k: 'w', x: R(tx + Math.cos(i * 1.57) * 200), y: R(ty + Math.sin(i * 1.57) * 100), r: 110, d: r1(D * 2.2) });
        addFx(st, { kind: 'ktoad', x: tx, y: ty, R: Rr, fall: .55, dur: 3.0, seed, f: tx >= x ? 1 : -1, hits });
        st.hold = .5;
        break;
      }
      case 'kashin:gamayu': {
        const len = 1000, speed = 1150, hits = [], ex = R(x + ca * len), ey = R(y + sa * len);
        travelHits(hits, x, y, a, len, 110, D * 2.2, speed, 8, 'fire', .1, 40);
        hits.push({ t: r3(.1 + len / speed), k: 'e', x: ex, y: ey, r: 300, d: r1(D * 3.0), c: '#ff9a40', kd: 'fire' }, { t: r3(.1 + len / speed), k: 's', n: 22 });
        hits.push({ t: r3(.1 + len / speed + .05), k: 'w', x: ex, y: ey, r: 260, d: r1(D * 2.6), kd: 'fire' });
        const th = [{ k: 'l', x: R(x + ca * 60), y: R(y + sa * 60), x2: ex, y2: ey, w: 95, d: r1(D * .35) }, { k: 'e', x: ex, y: ey, r: 260, d: r1(D * .35) }];
        addFx(st, { kind: 'kgamayu', x, y, a: r3(a), len, speed, bx: R(x - ca * 70), by: R(y - 30), f: ca >= 0 ? 1 : -1, dur: 4.4, seed, hits, tk: .45, tn: 1.2, tu: 3.6, th });
        st.hold = 1.3;
        break;
      }
      // -------------------------------------------------------------- Urashiki
      case 'urashiki:hook': {
        const t0 = st.tele[0], L = t0 ? t0.len : 600, ex = R(x + ca * L), ey = R(y + sa * L);
        const hits = [{ t: .3, k: 'c', x: ex, y: ey, r: 80, d: r1(D * 1.4) }, { t: .2, k: 'l', x, y, x2: ex, y2: ey, w: 20, d: r1(D * .6) }];
        addFx(st, { kind: 'uhook', x0: x, y0: y, x: ex, y: ey, cast: .3, reel: .55, dur: 1.6, hk: 0, got: 0, seed, hits });
        st.hold = .85;
        break;
      }
      case 'urashiki:lash': {
        const len = 900, speed = 2400, hits = [], ex = R(x + ca * len), ey = R(y + sa * len);
        travelHits(hits, x, y, a, len, 70, D * 1.9, speed, 6, 'blade', .05);
        hits.push({ t: r3(.05 + len / speed), k: 'e', x: ex, y: ey, r: 170, d: r1(D * 1.6), c: '#bfe6ff', kd: 'shockwave' }, { t: .2, k: 's', n: 12 });
        addFx(st, { kind: 'ulash', x, y, a: r3(a), len, speed, dur: 1.6, seed, hits });
        st.hold = .4;
        break;
      }
      case 'urashiki:rings': {
        const hits = [];
        [130, 250, 370].forEach((rho, i) => hits.push({ t: r3(.08 + i * .18), k: 'ring', x, y, r: rho, d: r1(D * 1.4), kd: i === 2 ? 'blade' : null }));
        hits.push({ t: .95, k: 'kb', r: 420, dist: -150, d: r1(D * .4) }, { t: .1, k: 's', n: 10 });
        addFx(st, { kind: 'urings', x, y, dur: 1.8, seed, hits });
        st.hold = 1.0;
        break;
      }
      case 'urashiki:rewind': {
        const past = st.hist[0] || [x, y];
        let px = past[0], py = past[1];
        if (!freeSpot(api, px, py, z.r || 20) || Math.hypot(px - x, py - y) < 60) { const b = a + Math.PI + rand(-.6, .6); px = R(x + Math.cos(b) * 240); py = R(y + Math.sin(b) * 160); if (!freeSpot(api, px, py, z.r || 20)) { px = x; py = y; } }
        z.x = px; z.y = py;
        z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .05);
        const hits = [{ t: .42, k: 'e', x: tx, y: ty, r: 210, d: r1(D * 2.3), c: '#c8b8ff', kd: 'vortex' }, { t: .42, k: 's', n: 14 }];
        addFx(st, { kind: 'urewind', x0: x, y0: y, x1: px, y1: py, tx, ty, dur: 1.7, seed, hits });
        st.hist.length = 0; st.hold = .5;
        break;
      }
      case 'urashiki:blink': {
        const a0 = rand(0, TAU), spots = [], hits = [];
        for (let i = 0; i < 6; i++) {
          const b = a0 + i * 2.3, sx = R(tx + Math.cos(b) * 250), sy = R(ty + Math.sin(b) * 250 * .6), t = r3(.05 + i * .24);
          const ex = R(tx - Math.cos(b) * 250), ey = R(ty - Math.sin(b) * 250 * .6);
          spots.push({ x: sx, y: sy, ex, ey, t });
          later(st, t, 'tp', { x: sx, y: sy });
          hits.push({ t: r3(t + .06), k: 'l', x: sx, y: sy, x2: ex, y2: ey, w: 46, d: r1(D * 1.4), kd: i % 2 ? 'blade' : null }, { t: r3(t + .06), k: 's', n: 8 });
        }
        const T = 1.7, b = Math.atan2(y - ty, x - tx);
        later(st, T - .12, 'tp', { x: R(tx + Math.cos(b) * 300), y: R(ty + Math.sin(b) * 180) });
        hits.push({ t: T, k: 'e', x: tx, y: ty, r: 470, d: r1(D * 3.6), c: '#d0c0ff', kd: 'vortex' }, { t: T + .12, k: 'ring', x: tx, y: ty, r: 560, d: r1(D * 1.0), kd: 'shockwave' }, { t: T, k: 's', n: 24 });
        for (let i = 0; i < 5; i++) hits.push({ t: T + .03, k: 'w', x: R(tx + Math.cos(i * 1.26) * 260), y: R(ty + Math.sin(i * 1.26) * 130), r: 130, d: r1(D * 2.4) });
        addFx(st, { kind: 'ublink', tx, ty, R: 470, spots, T, dur: T + 1.7, seed, hits });
        st.hold = 1.85;
        break;
      }
      // -------------------------------------------------------------- Toneri
      case 'toneri:puppets': {
        const items = [], hits = [];
        for (let i = 0; i < 5; i++) {
          const b = i / 5 * TAU + seed, sx = R(x + Math.cos(a + (i - 2) * .7) * 90), sy = R(y + Math.sin(a + (i - 2) * .7) * 60);
          items.push({ sx, sy, x: R(tx + Math.cos(b) * 140), y: R(ty + Math.sin(b) * 80), t0: r3(i * .05), f: Math.cos(b) > 0 ? -1 : 1 });
          hits.push({ t: r3(.75 + i * .05), k: 'e', it: i, r: 90, d: r1(D * 1.3) });
        }
        hits.push({ t: 1.05, k: 'e', x: tx, y: ty, r: 150, d: r1(D * 1.6), c: '#bcd8ff', kd: 'blade' }, { t: 1.05, k: 's', n: 12 });
        addFx(st, { kind: 'tpuppets', items, tx, ty, dur: 2.5, seed, hits });
        st.hold = .5;
        break;
      }
      case 'toneri:tsb': {
        const spots = st.spots || [{ x: tx, y: ty }], items = [], hits = [];
        spots.forEach((s, i) => {
          const b = i / spots.length * TAU;
          items.push({ sx: R(x + Math.cos(b) * 44), sy: R(y - 60 + Math.sin(b) * 18), x: s.x, y: s.y, t0: r3(i * .12), fl: .5 });
          hits.push({ t: r3(i * .12 + .5), k: 'e', it: i, r: 115, d: r1(D * 1.6), kd: i % 2 ? null : 'crater' }, { t: r3(i * .12 + .5), k: 's', n: 7 });
        });
        addFx(st, { kind: 'ttsb', items, dur: 2.6, seed, hits });
        st.spots = null; st.hold = .3;
        break;
      }
      case 'toneri:meteor': {
        const spots = st.spots || [{ x: tx, y: ty }], items = [], hits = [];
        spots.forEach((s, i) => {
          const t0 = r3(.05 + i * .15);
          items.push({ x: s.x, y: s.y, t0, fl: .7, v: i % 3, sz: r1(.85 + hash(i + seed) * .4) });
          hits.push({ t: r3(t0 + .7), k: 'e', x: s.x, y: s.y, r: 125, d: r1(D * 2.0), kd: 'crater' }, { t: r3(t0 + .7), k: 's', n: 10 });
        });
        hits.push({ t: 1.0, k: 'w', x: spots[0].x, y: spots[0].y, r: 150, d: r1(D * 2.4) });
        addFx(st, { kind: 'tmeteor', items, dur: 3.4, seed, hits });
        st.spots = null; st.hold = .4;
        break;
      }
      case 'toneri:wheel': {
        const hits = [];
        for (const t of [.05, .3, .55]) hits.push({ t, k: 'kb', r: 560, dist: -110, d: r1(D * .25) });
        hits.push({ t: .9, k: 'e', x, y, r: 400, d: r1(D * 3.0), c: '#ffe08a', kd: 'vortex' }, { t: 1.05, k: 'ring', x, y, r: 520, d: r1(D * 1.0), kd: 'shockwave' }, { t: .9, k: 's', n: 22 });
        for (let i = 0; i < 6; i++) hits.push({ t: .93, k: 'w', x: R(x + Math.cos(i * TAU / 6 + .3) * 280), y: R(y + Math.sin(i * TAU / 6 + .3) * 140), r: 130, d: r1(D * 2.4) });
        addFx(st, { kind: 'twheel', x, y, R: 400, pull: .9, dur: 2.7, seed, hits });
        st.hold = 1.0;
        break;
      }
      case 'toneri:blade': {
        const len = 1200, hits = [], ex = R(x + ca * len), ey = R(y + sa * len), sw = .35;
        travelHits(hits, x, y, a, len, 120, D * 3.6, 4200, 8, 'blade', sw, 40);
        hits.push({ t: r3(sw + len / 4200), k: 'e', x: ex, y: ey, r: 260, d: r1(D * 2.6), c: '#9fd8ff', kd: 'crater' }, { t: sw, k: 's', n: 26 });
        for (let i = 1; i <= 3; i++) hits.push({ t: r3(sw + i * .06), k: 'w', x: R(x + ca * len * i / 3.4), y: R(y + sa * len * i / 3.4), r: 150, d: r1(D * 2.5), kd: 'blade', a: r3(a) });
        const th = [{ k: 'l', x: R(x + ca * 80), y: R(y + sa * 80), x2: ex, y2: ey, w: 55, d: r1(D * .3) }];
        addFx(st, { kind: 'tblade', x, y, a: r3(a), len, sw, dur: 3.0, seed, hits, tk: .5, tn: .9, tu: 2.5, th });
        st.hold = .9;
        break;
      }
    }
  }

  // Named steps (plain args, JSON-safe).
  const EV = {
    tp(z, st, api, a) { if (freeSpot(api, a.x, a.y, z.r || 20)) { z.x = a.x; z.y = a.y; } }
  };
  // Dash ends.
  const DASH_END = {
    jdash(z, st, api, ds) {
      const seed = R(Math.random() * 99);
      ellStrike(api, z.x, z.y, ds.endR, ds.endD, '#f0c070', 'crater');
      api.shake(14);
      addFx(st, { kind: 'jburst', x: R(z.x), y: R(z.y), a: ds.a, R: ds.endR, dur: 1.6, seed });
    },
    crush(z, st, api, ds) {
      ellStrike(api, z.x, z.y, ds.endR, ds.endD, '#ece8ff', 'blade');
      api.shake(14);
      addFx(st, { kind: 'cx', x: R(z.x), y: R(z.y), R: ds.endR, dur: 1.0, seed: R(Math.random() * 99) });
    },
    krasen(z, st, api, ds) {
      const x = z.x + Math.cos(ds.a) * 40, y = z.y + Math.sin(ds.a) * 40;
      ellStrike(api, x, y, ds.endR, ds.endD, '#9fd0ff', 'vortex');
      api.world(x, y, ds.endR * .8, ds.endD, 'crater');
      api.shake(16);
      addFx(st, { kind: 'kblast', x: R(x), y: R(y), R: ds.endR, dur: 1.6, seed: R(Math.random() * 99) });
    }
  };
  function dashUpdate(z, st, dt, api) {
    const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
    ds.left -= dt;
    api.move(Math.cos(ds.a) * step, Math.sin(ds.a) * step);
    ds.pts[ds.pts.length - 1] = [R(z.x), R(z.y)];
    if ((ds.ht -= dt) <= 0) { ds.ht = .06; api.strike(z.x, z.y, ds.w, ds.d, null, null, true); }
    if (ds.left > 0) return;
    if (ds.q && ds.q.length) {
      // Next leg of a zig-zag: a claw slash where the leg turns.
      ellStrike(api, z.x, z.y, 110, ds.d * 1.05, null, 'blade');
      addFx(st, { kind: 'cx', x: R(z.x), y: R(z.y), R: 110, dur: .8, seed: R(Math.random() * 99) });
      ds.a = ds.q.shift(); ds.left = r3(ds.seg / ds.speed); ds.pts.push([R(z.x), R(z.y)]);
      return;
    }
    const end = DASH_END[ds.end];
    if (end) end(z, st, api, ds);
    addFx(st, { kind: 'trail', pts: ds.pts, w: ds.w, rgb: ds.rgb || '255,255,255', dur: .7 });
    st.dash = null;
  }

  // Per-frame steps of some effects.
  const FXU = {
    jshrink(z, st, fx, dt, api) {
      // One shard homes onto where the target stands now.
      for (const it of fx.items) if (it.ch === 1 && fx.age > it.t0 + it.fl * .5) {
        it.ch = 2; const p = api.player;
        if (p && Math.hypot(p.x - it.x, p.y - it.y) < 520) { it.x = R(p.x); it.y = R(p.y); }
      }
    },
    cgrime(z, st, fx, dt, api) {
      for (const it of fx.items) if (it.ch === 1 && fx.age > it.t0 + it.run * .7) {
        it.ch = 2; const p = api.player;
        if (p && Math.hypot(p.x - it.x, p.y - it.y) < 420) { it.x = R(p.x); it.y = R(p.y); }
      }
    },
    uhook(z, st, fx, dt, api) {
      if (!fx.hk && fx.age >= fx.cast) {
        fx.hk = 1;
        const p = api.player;
        let v = p && !p.pseudo && Math.hypot(p.x - fx.x, p.y - fx.y) < 110 + (p.r || 16) ? p : null;
        if (!v && api.nearestFoe) { const n = api.nearestFoe(fx.x, fx.y, 110); if (n && !n.pseudo) v = n; }
        if (v) { fx.got = 1; z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .035); }
      }
      if (fx.got === 1 && fx.age > fx.cast && fx.age < fx.cast + fx.reel) {
        // Reel in: whoever hangs on the hook is dragged toward Urashiki.
        const k = easeIn((fx.age - fx.cast) / fx.reel) * .72, hx = lerp(fx.x, fx.x0, k), hy = lerp(fx.y, fx.y0, k);
        const p = api.player;
        let v = p && !p.pseudo && Math.hypot(p.x - hx, p.y - hy) < 150 ? p : null;
        if (!v && api.nearestFoe) { const n = api.nearestFoe(hx, hy, 150); if (n && !n.pseudo) v = n; }
        if (v && !v.remote && freeSpot(api, hx, hy, v.r || 16)) { v.x = hx; v.y = hy; }
        fx.hx = R(hx); fx.hy = R(hy);
      }
    },
    kneedles(z, st, fx, dt, api) {
      // Needles are computed, not stored: volley v, needle i flies along a fixed fan.
      if ((fx.ht -= dt) > 0) return;
      fx.ht = .05;
      const D = api.damage || z.damage || 42;
      for (let v = 0; v < fx.vol; v++) {
        const tv = fx.age - v * fx.gap;
        if (tv < 0) continue;
        const d = tv * fx.speed;
        if (d > fx.len) continue;
        for (let i = 0; i < fx.n; i++) {
          const b = fx.a + ((i + (v % 2) * .5) / (fx.n - .5) - .5) * 2 * fx.half;
          api.strike(fx.x + Math.cos(b) * d, fx.y + Math.sin(b) * d, 20, D * .55, null, null, true);
        }
      }
    }
  };

  // =================================================================== update
  function update(z, dt, api) {
    const m = z && members[z.bossId];
    if (!m) return;
    const st = state(z);
    st.t += dt;
    const alive = z.health > 0;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (alive) { fxHits(z, st, fx, api); const u = FXU[fx.kind]; if (u) u(z, st, fx, dt, api); }
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (!alive) { z.bossWindup = 0; z.kageDash = 0; z.manualBusy = false; st.ev.length = 0; st.dash = null; st.hold = 0; st.windup = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const e = st.ev[i];
      if ((e.t -= dt) <= 0) { st.ev.splice(i, 1); const h = EV[e.h]; if (h) h(z, st, api, e.a); }
    }
    if (z.bossId === 'urashiki' && (st.histT -= dt) <= 0) {
      st.histT = .25; st.hist.push([R(z.x), R(z.y)]);
      if (st.hist.length > 11) st.hist.shift();
    }
    st.hold = Math.max(0, st.hold - dt);
    if (st.dash) dashUpdate(z, st, dt, api);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = r3(defOf(z, st.move).after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .85 : 1));
        st.move = ''; st.tele = [];
      }
    } else if (st.hold <= 0 && !st.dash) {
      if (z.manual) {
        // Driven by the user: only the requested jutsu, aimed at the cursor target.
        if (z.manualCast != null) { const mv = MANUAL[z.bossId][z.manualCast]; z.manualCast = null; if (mv) announce(z, st, m, api, mv.id); }
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 900) announce(z, st, m, api);
      }
    }
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash;
    z.kageDash = st.dash ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.armorScale = st.armor;
  }

  // =================================================================== cached art
  function rodSprite() {
    return Kit().sprite('kr:rod', 22, 220, g => {
      g.beginPath(); g.moveTo(11, 0); g.lineTo(19, 18); g.lineTo(19, 220); g.lineTo(3, 220); g.lineTo(3, 18); g.closePath();
      g.fillStyle = '#16131c'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
      g.fillStyle = '#4a4458'; g.fillRect(6, 20, 3, 196);
      g.fillStyle = '#e0ae58'; for (let y = 40; y < 210; y += 44) g.fillRect(3, y, 16, 5);
    });
  }
  // Giant rod lying on the ground (Sukunahikona restored): horizontal, 512 × 64.
  function bigRodSprite() {
    return Kit().sprite('kr:bigrod', 512, 64, g => {
      g.lineJoin = 'round';
      const body = () => { g.beginPath(); g.moveTo(4, 32); g.lineTo(40, 10); g.lineTo(508, 12); g.lineTo(508, 52); g.lineTo(40, 54); g.closePath(); };
      body(); g.fillStyle = '#17141d'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#050407'; g.stroke();
      g.fillStyle = '#3e3850'; g.fillRect(40, 16, 466, 8);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(40, 40, 466, 12);
      g.fillStyle = '#e0ae58'; for (let x = 90; x < 500; x += 92) { g.fillRect(x, 11, 12, 42); g.fillStyle = '#ffe0a0'; g.fillRect(x + 2, 13, 3, 38); g.fillStyle = '#e0ae58'; }
    });
  }
  // Black obsidian stakes with gold veins (Sukunahikona restoring a shard to full size).
  function stakeSprite(v) {
    return Kit().sprite('kr:stake' + v, 110, 170, g => {
      g.lineJoin = 'round';
      const spike = (bx, h, lean, w) => {
        g.beginPath(); g.moveTo(bx - w, 166); g.lineTo(bx - w * .5 + lean * .5, 166 - h * .6); g.lineTo(bx + lean, 166 - h); g.lineTo(bx + w * .55 + lean * .55, 166 - h * .55); g.lineTo(bx + w, 166); g.closePath();
        g.fillStyle = '#1c1824'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#06050a'; g.stroke();
        g.beginPath(); g.moveTo(bx + w * .1, 164); g.lineTo(bx + lean, 166 - h + 4); g.lineTo(bx + w * .8, 164); g.closePath(); g.fillStyle = '#3c3650'; g.fill();
        g.strokeStyle = '#f0c070'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx - w * .3, 160); g.lineTo(bx - w * .1 + lean * .3, 166 - h * .45); g.lineTo(bx + lean * .7, 166 - h * .8); g.stroke();
      };
      const s = v * 3.7 + 1;
      spike(30 + hash(s) * 8, 70 + hash(s + 1) * 30, -16, 11);
      spike(80 - hash(s + 2) * 8, 82 + hash(s + 3) * 26, 14, 12);
      spike(55, 135 + hash(s + 4) * 26, (hash(s + 5) - .5) * 18, 16);
    });
  }
  // Code's Claw Mark: a black tapered slash with a pale rim, horizontal, 256 × 48.
  function clawSprite() {
    return Kit().sprite('kr:claw', 256, 48, g => {
      const path = () => { g.beginPath(); g.moveTo(4, 27); g.quadraticCurveTo(116, -4, 252, 21); g.quadraticCurveTo(132, 40, 4, 27); g.closePath(); };
      g.shadowColor = 'rgba(170,140,255,.95)'; g.shadowBlur = 10;
      path(); g.fillStyle = '#07060b'; g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 2; g.strokeStyle = 'rgba(235,230,255,.95)'; path(); g.stroke();
      g.strokeStyle = 'rgba(150,110,255,.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(30, 25); g.quadraticCurveTo(124, 14, 230, 21); g.stroke();
    });
  }
  // Claw Grime: hunched white beast with black marks and a wide mouth, facing right, 120 × 104.
  function grimeSprite(fr) {
    return Kit().sprite('kr:grime' + fr, 120, 104, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#2a2634', W = '#ecebf2', S = '#b8b4c8';
      const leg = (x0, y0, x1, y1) => { g.strokeStyle = O; g.lineWidth = 11; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = W; g.lineWidth = 7; g.stroke();
        g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x1 + k * 3, y1); g.lineTo(x1 + k * 4 + 3, y1 + 6); } g.stroke(); };
      const s = fr ? 6 : -6;
      leg(36, 64, 26 - s, 94); leg(70, 62, 84 + s, 94);
      g.beginPath(); g.ellipse(56, 58, 36, 24, -.15, 0, TAU); g.fillStyle = W; g.fill(); g.lineWidth = 3; g.strokeStyle = O; g.stroke();
      g.fillStyle = S; g.beginPath(); g.ellipse(52, 70, 28, 10, -.1, 0, TAU); g.fill();
      leg(44, 66, 38 + s, 96); leg(78, 60, 96 - s, 92);
      g.beginPath(); g.ellipse(92, 42, 22, 18, .2, 0, TAU); g.fillStyle = W; g.fill(); g.lineWidth = 3; g.strokeStyle = O; g.stroke();
      // mouth with teeth
      g.beginPath(); g.moveTo(80, 48); g.quadraticCurveTo(100, 64, 114, 44); g.quadraticCurveTo(100, 52, 80, 48); g.closePath(); g.fillStyle = '#3a0c18'; g.fill(); g.strokeStyle = O; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { const tx = 86 + k * 5.5; g.beginPath(); g.moveTo(tx, 50 + k * .4); g.lineTo(tx + 2.5, 55); g.lineTo(tx + 5, 50 + k * .3); g.fill(); }
      g.fillStyle = '#0a0810'; g.beginPath(); g.ellipse(98, 34, 3.4, 2, .3, 0, TAU); g.fill();
      g.fillStyle = '#ff3050'; g.beginPath(); g.arc(98.6, 33.8, 1, 0, TAU); g.fill();
      // black claw marks over the back
      g.fillStyle = '#0a0810';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(34 + k * 12, 38); g.quadraticCurveTo(40 + k * 12, 50, 36 + k * 12, 64); g.quadraticCurveTo(44 + k * 12, 52, 40 + k * 12, 37); g.closePath(); g.fill(); }
    });
  }
  // Giant summoned toad, front three-quarter view, 340 × 250.
  function toadSprite() {
    return Kit().sprite('kr:toad', 340, 250, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#3a1a0c', B = '#d8743a', DK = '#8a3e1a', BL = '#f2d6a2';
      // hind legs
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(170 + s * 118, 186, 52, 40, s * .4, 0, TAU); g.fillStyle = DK; g.fill(); g.lineWidth = 5; g.strokeStyle = O; g.stroke();
      }
      // body
      g.beginPath(); g.ellipse(170, 140, 132, 90, 0, 0, TAU); g.fillStyle = B; g.fill(); g.lineWidth = 6; g.strokeStyle = O; g.stroke();
      g.save(); g.beginPath(); g.ellipse(170, 140, 132, 90, 0, 0, TAU); g.clip();
      g.fillStyle = 'rgba(90,30,10,.35)'; g.beginPath(); g.ellipse(80, 170, 120, 70, 0, 0, TAU); g.fill();
      g.fillStyle = BL; g.beginPath(); g.ellipse(170, 204, 92, 46, 0, 0, TAU); g.fill();
      g.fillStyle = DK; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(70 + i * 66, 96 + (i % 2) * 10, 22, 9, .5 - i * .3, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,230,190,.35)'; g.beginPath(); g.ellipse(210, 92, 60, 22, -.2, 0, TAU); g.fill();
      g.fillStyle = '#b05a28'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(60 + hash(i) * 220, 80 + hash(i + 7) * 80, 3 + hash(i + 3) * 3, 0, TAU); g.fill(); }
      g.restore();
      // mouth
      g.strokeStyle = O; g.lineWidth = 5; g.beginPath(); g.moveTo(66, 150); g.quadraticCurveTo(170, 196, 274, 150); g.stroke();
      // eyes
      for (const s of [-1, 1]) {
        const ex = 170 + s * 74, ey = 62;
        g.beginPath(); g.ellipse(ex, ey, 34, 30, 0, 0, TAU); g.fillStyle = B; g.fill(); g.lineWidth = 5; g.strokeStyle = O; g.stroke();
        g.beginPath(); g.ellipse(ex, ey - 2, 24, 20, 0, 0, TAU); g.fillStyle = '#ffd23a'; g.fill(); g.lineWidth = 3; g.stroke();
        g.fillStyle = '#100808'; g.fillRect(ex - 18, ey - 6, 36, 8);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 8, ey - 12, 4, 0, TAU); g.fill();
      }
      // front legs
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(170 + s * 60, 196); g.quadraticCurveTo(170 + s * 70, 236, 170 + s * 50, 244); g.lineTo(170 + s * 100, 244); g.quadraticCurveTo(170 + s * 96, 214, 170 + s * 92, 190); g.closePath();
        g.fillStyle = B; g.fill(); g.lineWidth = 5; g.strokeStyle = O; g.stroke();
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(170 + s * (52 + k * 22), 244, 9, 6, 0, 0, TAU); g.fillStyle = BL; g.fill(); g.lineWidth = 3; g.stroke(); }
      }
    });
  }
  // Toneri's puppet guard: white mask, dark-blue robe, a curved blade, 90 × 150.
  function puppetSprite() {
    return Kit().sprite('kr:puppet', 90, 150, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const O = '#151a2c';
      g.beginPath(); g.moveTo(26, 52); g.lineTo(64, 52); g.lineTo(76, 140); g.lineTo(14, 140); g.closePath();
      g.fillStyle = '#28345a'; g.fill(); g.lineWidth = 3; g.strokeStyle = O; g.stroke();
      g.fillStyle = '#6f8fd0'; g.fillRect(18, 128, 54, 6); g.fillRect(42, 52, 6, 80);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(26, 52); g.lineTo(40, 52); g.lineTo(34, 140); g.lineTo(14, 140); g.closePath(); g.fill();
      // arms and blade
      g.strokeStyle = O; g.lineWidth = 8; g.beginPath(); g.moveTo(62, 60); g.lineTo(80, 84); g.stroke(); g.strokeStyle = '#d8d0c0'; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.moveTo(80, 84); g.quadraticCurveTo(96, 50, 82, 14); g.quadraticCurveTo(86, 52, 74, 82); g.closePath(); g.fillStyle = '#dfe8f4'; g.fill(); g.lineWidth = 2; g.strokeStyle = O; g.stroke();
      g.strokeStyle = O; g.lineWidth = 8; g.beginPath(); g.moveTo(28, 60); g.lineTo(14, 88); g.stroke(); g.strokeStyle = '#d8d0c0'; g.lineWidth = 4; g.stroke();
      for (const [jx, jy] of [[62, 60], [28, 60], [80, 84], [14, 88]]) { g.beginPath(); g.arc(jx, jy, 4, 0, TAU); g.fillStyle = '#9a9488'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = O; g.stroke(); }
      // mask head
      g.beginPath(); g.ellipse(45, 32, 17, 21, 0, 0, TAU); g.fillStyle = '#f4f0e6'; g.fill(); g.lineWidth = 3; g.strokeStyle = O; g.stroke();
      g.fillStyle = '#1a1a26'; g.beginPath(); g.ellipse(38, 30, 3.6, 2.2, .2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(52, 30, 3.6, 2.2, -.2, 0, TAU); g.fill();
      g.fillStyle = '#c02838'; g.beginPath(); g.arc(45, 18, 2.4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,30,40,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, 42); g.quadraticCurveTo(45, 45, 50, 42); g.stroke();
      g.fillStyle = '#d8dce8'; g.beginPath(); g.ellipse(45, 12, 15, 6, 0, Math.PI, TAU); g.fill();
    });
  }
  function meteorSprite(v) {
    return Kit().sprite('kr:meteor' + v, 100, 100, g => {
      const c = 50, path = () => { g.beginPath(); for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, r = 40 * (.74 + hash(k % 10 + v * 13) * .26); if (k) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c); } g.closePath(); };
      path(); g.fillStyle = ['#7a6a66', '#857066', '#6a5e62'][v % 3]; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2a1e1a'; g.stroke();
      g.save(); path(); g.clip();
      g.fillStyle = 'rgba(230,210,200,.4)'; g.beginPath(); g.arc(c - 12, c - 14, 24, 0, TAU); g.fill();
      g.fillStyle = 'rgba(30,20,20,.45)'; g.beginPath(); g.arc(c + 14, c + 16, 30, 0, TAU); g.fill();
      g.strokeStyle = '#ffb040'; g.lineWidth = 3; g.beginPath(); g.moveTo(c - 20, c + 6); g.lineTo(c - 4, c - 2); g.lineTo(c + 6, c + 14); g.lineTo(c + 22, c + 8); g.moveTo(c - 4, c - 2); g.lineTo(c + 2, c - 22); g.stroke();
      g.strokeStyle = '#fff0b0'; g.lineWidth = 1; g.stroke();
      g.restore();
    });
  }
  // Golden wheel of the Tenseigan chakra mode, 256 × 256.
  function wheelSprite() {
    return Kit().sprite('kr:wheel', 256, 256, g => {
      g.lineCap = 'round';
      const c = 128;
      for (const [w, col] of [[16, 'rgba(120,70,10,.8)'], [9, '#ffcf5a'], [3, '#fff4c8']]) {
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath(); g.arc(c, c, 100, 0, TAU); g.stroke();
        g.beginPath(); g.arc(c, c, 40, 0, TAU); g.stroke();
        g.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.moveTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); g.lineTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100); } g.stroke();
      }
      g.fillStyle = '#ffe48a';
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a - .06) * 104, c + Math.sin(a - .06) * 104); g.lineTo(c + Math.cos(a) * (i % 2 ? 118 : 126), c + Math.sin(a) * (i % 2 ? 118 : 126)); g.lineTo(c + Math.cos(a + .06) * 104, c + Math.sin(a + .06) * 104); g.fill(); }
    });
  }
  // Toneri's Tenseigan sword: a huge blue chakra blade, tip up, 80 × 640.
  function swordSprite() {
    return Kit().sprite('kr:sword', 80, 640, g => {
      const blade = () => { g.beginPath(); g.moveTo(40, 2); g.quadraticCurveTo(66, 120, 62, 540); g.lineTo(18, 540); g.quadraticCurveTo(14, 120, 40, 2); g.closePath(); };
      blade(); const gr = g.createLinearGradient(0, 0, 80, 0);
      gr.addColorStop(0, 'rgba(40,110,230,.9)'); gr.addColorStop(.35, 'rgba(140,210,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(.65, 'rgba(140,210,255,.95)'); gr.addColorStop(1, 'rgba(40,110,230,.9)');
      g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,60,160,.95)'; g.stroke();
      g.fillStyle = '#ffd36a'; g.fillRect(6, 538, 68, 12); g.strokeStyle = '#6a4a10'; g.lineWidth = 2; g.strokeRect(6, 538, 68, 12);
      g.fillStyle = '#2a3a6a'; g.fillRect(32, 550, 16, 80); g.fillStyle = '#ffd36a'; g.fillRect(30, 626, 20, 10);
    });
  }
  // Clock dial of Urashiki's time jutsu, 256 × 256 (hands drawn live).
  function clockSprite() {
    return Kit().sprite('kr:clock', 256, 256, g => {
      const c = 128;
      g.strokeStyle = 'rgba(60,40,120,.85)'; g.lineWidth = 9; g.beginPath(); g.arc(c, c, 116, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(220,210,255,.95)'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, 116, 0, TAU); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(c, c, 92, 0, TAU); g.stroke();
      g.beginPath(); g.arc(c, c, 30, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, r0 = i % 3 ? 100 : 94;
        g.lineWidth = i % 3 ? 3 : 6; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * 112, c + Math.sin(a) * 112); g.stroke();
      }
      g.fillStyle = 'rgba(200,190,255,.9)';
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .26; g.beginPath(); g.arc(c + Math.cos(a) * 62, c + Math.sin(a) * 62, 4, 0, TAU); g.fill(); }
    });
  }
  function tsbSprite() { return Kit().sphere('kr:tsb', [[0, '#8a849a'], [.12, '#3a3546'], [.45, '#100e16'], [.85, '#050407'], [1, '#000']]); }

  // =================================================================== draw helpers
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function markEll(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2, kk = clamp01(k);
    ctx.fillStyle = `rgba(14,10,24,${faint ? .08 : .16})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * kk})`; ctx.beginPath(); ctx.ellipse(x, y, r * kk, r * .5 * kk, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(14,10,30,.45)'; ctx.lineWidth = faint ? 4 : 5.5; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3; ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + time * .8; ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14) * .5); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12) * .5); }
      ctx.stroke();
    }
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markEll(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    if (s.k === 'ring') {
      ctx.fillStyle = 'rgba(14,10,24,.14)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .5, 0, 0, TAU); ctx.ellipse(s.x, s.y, s.r0, s.r0 * .5, 0, 0, TAU, true); ctx.fill('evenodd');
      for (const rr of [s.r0, s.r]) { ctx.strokeStyle = 'rgba(14,10,30,.45)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(s.x, s.y, rr, rr * .5, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
      const rk = lerp(s.r0, s.r, clamp01(k)); ctx.strokeStyle = `rgba(${rgb},.5)`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(s.x, s.y, rk, rk * .5, 0, 0, TAU); ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(14,10,24,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * clamp01(k), s.w * 2);
      ctx.strokeStyle = 'rgba(14,10,30,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      if (s.w > 40) {
        ctx.lineWidth = 2.5; ctx.beginPath();
        for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
        ctx.stroke();
      }
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(14,10,24,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * clamp01(k), -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(14,10,30,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.restore();
  }
  function drawCube(ctx, x, y, s, rot, alpha, face, top, edge, hgt) {
    const P = [], h = hgt == null ? s * 1.5 : hgt;
    for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2 + Math.PI / 4; P.push(x + Math.cos(a) * s * 1.414, y + Math.sin(a) * s * .707); }
    ctx.lineJoin = 'round'; ctx.globalAlpha = alpha; ctx.strokeStyle = edge;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mid = rot + i * Math.PI / 2 + Math.PI / 2;
      if (Math.sin(mid) <= 0) continue;
      ctx.beginPath(); ctx.moveTo(P[i * 2], P[i * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1]); ctx.lineTo(P[j * 2], P[j * 2 + 1] - h); ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
      ctx.fillStyle = face; ctx.fill();
      if (Math.cos(mid) < 0) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill(); }
      ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1] - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Daikokuten cube: black faces, gold rim, gold seal rings on top and a Karma glyph on the faces.
  function blackCube(ctx, x, y, s, rot, alpha, hgt) {
    drawCube(ctx, x, y, s, rot, alpha, '#1a1720', '#2c2836', '#e0ae58', hgt);
    const h = hgt == null ? s * 1.5 : hgt;
    ctx.globalAlpha = alpha * .85; ctx.strokeStyle = '#f7c876'; ctx.lineWidth = Math.max(1.5, s * .035);
    ctx.beginPath(); ctx.ellipse(x, y - h, s * .62, s * .31, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - h, s * .32, s * .16, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * .5, y - h); ctx.lineTo(x + s * .5, y - h); ctx.moveTo(x, y - h - s * .25); ctx.lineTo(x, y - h + s * .25); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function craterG(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6e5a46'; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c231c'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .68, r * .34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1f18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .35);
      ctx.lineTo(x + Math.cos(b) * r * 1.05, y + Math.sin(b) * r * .55);
      ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * .66);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function dustBurst(ctx, x, y, r, t, seed, kind = 'dust', n = 12) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.3), a0 = 1 - win(t, .7, 2.2);
    if (a0 <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.35 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 10 - hash(i * 4.4) * r * .12, r * (.11 + e * (.08 + hash(i * 6.1) * .08)), a0 * .8, .75);
    }
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.2, t / 1.1, seed, '#3a2c22', 14);
  }
  function spriteAt(ctx, img, x, y, w, h, rot, alpha) {
    if (alpha <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function lighter(ctx, fn) { ctx.globalCompositeOperation = 'lighter'; fn(); ctx.globalCompositeOperation = 'source-over'; }
  // A glowing chakra thread (fishing line): dark under-stroke, coloured body, white core.
  function thread(ctx, pts, alpha, w = 3, rgb = '170,225,255') {
    if (alpha <= .01 || pts.length < 2) return;
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = `rgba(20,30,80,${.5 * alpha})`; ctx.lineWidth = w + 4; ctx.stroke();
    lighter(ctx, () => {
      path(); ctx.strokeStyle = `rgba(${rgb},${.55 * alpha})`; ctx.lineWidth = w + 3; ctx.stroke();
      path(); ctx.strokeStyle = `rgba(255,255,255,${.9 * alpha})`; ctx.lineWidth = Math.max(1, w * .45); ctx.stroke();
    });
  }
  function ghost(ctx, id, x, y, facing, alpha, frame = 'attack') {
    const S = window.AnimeSprites;
    if (!S || !S.has(id) || alpha <= .02) return;
    S.draw(ctx, id, x, y, { frame, facing, alpha });
  }
  function clawAt(ctx, x, y, a, len, alpha, thick = 1) {
    if (alpha <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.drawImage(clawSprite(), -len / 2, -12 * thick, len, 24 * thick);
    ctx.restore();
  }

  // =================================================================== FX: Jigen
  function jrodsG(ctx, fx) {
    for (const ln of fx.lines) {
      const land = ln.len / fx.speed, gt = land + fx.grow, u = fx.age - gt, c = Math.cos(ln.a), s = Math.sin(ln.a);
      if (fx.age > land && u < 0) { const ex = ln.x + c * ln.len, ey = ln.y + s * ln.len; ctx.fillStyle = 'rgba(10,8,14,.45)'; ctx.beginPath(); ctx.ellipse(ex, ey, 16, 7, 0, 0, TAU); ctx.fill(); }
      if (u > 0) {
        const a = 1 - win(fx.age, fx.dur - .6, fx.dur), cx = ln.x + c * ln.len * .61, cy = ln.y + s * ln.len * .61, L = ln.len * .78 * easeOut(u / .18);
        ctx.save(); ctx.translate(cx, cy + 10); ctx.rotate(ln.a); ctx.globalAlpha = .45 * a; ctx.fillStyle = '#0e0b12'; ctx.fillRect(-L / 2, -24, L, 48); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
  function jrodsO(ctx, fx, time) {
    const K = Kit(), L0 = LIFT(), img = rodSprite();
    for (const ln of fx.lines) {
      const land = ln.len / fx.speed, gt = land + fx.grow, c = Math.cos(ln.a), s = Math.sin(ln.a);
      if (fx.age < gt) {
        const d = Math.min(ln.len, fx.age * fx.speed), fly = fx.age < land, x = ln.x + c * d, y = ln.y + s * d - (fly ? L0 + 10 : 6);
        if (fly) lighter(ctx, () => { ctx.strokeStyle = 'rgba(240,200,120,.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - c * 150, y - s * 150); ctx.lineTo(x, y); ctx.stroke(); K.glow(ctx, x, y, 22, '240,200,120', .6, true); });
        spriteAt(ctx, img, x - c * 26, y - s * 26, 7, 60, ln.a + Math.PI / 2, 1);
        if (!fly && fx.age > gt - .25) lighter(ctx, () => K.glow(ctx, x, y, 30 + 30 * win(fx.age, gt - .25, gt), '255,220,150', .7, true));
      } else {
        const u = fx.age - gt, g = easeOut(u / .18), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
        const cx = ln.x + c * ln.len * .61, cy = ln.y + s * ln.len * .61, L = ln.len * .78 * g, T = 54 * (.3 + .7 * g);
        ctx.save(); ctx.translate(cx, cy - 14 * g); ctx.rotate(ln.a); ctx.globalAlpha = a;
        ctx.drawImage(bigRodSprite(), -L / 2, -T / 2, L, T);
        ctx.restore(); ctx.globalAlpha = 1;
        if (u < .5) lighter(ctx, () => K.glow(ctx, cx, cy - 10, 120 * (1 - u / .5) + 40, '255,214,140', .6 * (1 - u / .5)));
        if (u < 1.3) for (let k = 0; k < 2; k++) dustBurst(ctx, ln.x + c * ln.len * (.4 + k * .45), ln.y + s * ln.len * (.4 + k * .45), 100, u, fx.seed + k * 7 + ln.a * 10, 'dust', 6);
      }
    }
  }
  function jshrinkG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) markEll(ctx, it.x, it.y, 80, '240,200,120', t / it.fl, time, false);
      else craterG(ctx, it.x, it.y, 62, 1 - win(t - it.fl, 1.3, 1.9), it.t0 * 31 + fx.seed);
    }
  }
  function jshrinkO(ctx, fx, time) {
    const K = Kit(), hx = fx.x0, hy = fx.y0 - 70;
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = t / it.fl, x = lerp(hx, it.x, k), y = lerp(hy, it.y, k) - Math.sin(Math.PI * k) * 160;
        lighter(ctx, () => { K.glow(ctx, x, y, 14, '255,220,150', .9, true); ctx.strokeStyle = 'rgba(255,210,130,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(hx, it.x, k - .06), lerp(hy, it.y, k - .06) - Math.sin(Math.PI * (k - .06)) * 160); ctx.stroke(); });
        ctx.fillStyle = '#100c14'; ctx.fillRect(x - 2, y - 2, 4, 4);
      } else {
        const u = t - it.fl, g = easeOut(u / .1) * (1 - easeIn(win(u, 1.2, 1.7)) * .8), a = 1 - win(u, 1.3, 1.75), sc = .95 + it.v * .12;
        if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(stakeSprite(it.v), it.x - 55 * sc, it.y + 6 - 170 * sc * g, 110 * sc, 170 * sc * g); ctx.globalAlpha = 1; }
        if (u < .3) lighter(ctx, () => K.glow(ctx, it.x, it.y - 50, 90, '255,214,140', .7 * (1 - u / .3), true));
        if (u < .7) K.fx.shockRing(ctx, it.x, it.y, 120, u / .7, 1 - u / .7, '240,200,120');
        dustBurst(ctx, it.x, it.y, 80, u, it.t0 * 17 + fx.seed, 'dust', 6);
      }
    }
  }
  function jcubesG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = t / it.fl;
        ctx.fillStyle = `rgba(10,8,14,${.2 + .4 * k})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 110 * (.5 + .5 * k), 55 * (.5 + .5 * k), 0, 0, TAU); ctx.fill();
        markEll(ctx, it.x, it.y, 125, '240,200,120', 1, time, false);
      } else {
        const u = t - it.fl, a = 1 - win(u, 1.1, 1.7);
        craterG(ctx, it.x, it.y, 115, 1 - win(u, 1.4, 2.1), it.rot * 40);
        if (a > 0) blackCube(ctx, it.x, it.y + win(u, 1.1, 1.7) * 60, it.s, it.rot, a, it.s * 1.6 * (1 - win(u, 1.1, 1.7) * .6));
      }
    }
  }
  function jcubesO(ctx, fx) {
    const K = Kit();
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const k = Math.min(1, easeIn(t / it.fl)), u = t - it.fl;
      if (u > 1.6) continue;
      if (k < 1) {
        const drop = (1 - k) * 600;
        blackCube(ctx, it.x, it.y - drop, it.s, it.rot, 1, it.s * 1.6);
        ctx.strokeStyle = 'rgba(255,230,180,.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * it.s * .5; ctx.moveTo(it.x + ox, it.y - drop - it.s * 1.8); ctx.lineTo(it.x + ox, it.y - drop - it.s * 1.8 - 150); } ctx.stroke();
      }
      if (u > 0 && u < .25) lighter(ctx, () => K.glow(ctx, it.x, it.y - 30, 170, '255,220,150', .7 * (1 - u / .25), true));
      if (u > 0 && u < .8) K.fx.shockRing(ctx, it.x, it.y, 210, u / .8, 1 - u / .8, '240,200,120');
      if (u > 0) dustBurst(ctx, it.x, it.y, 125, u, it.rot * 30, 'dust', 10);
    }
  }
  function jburstO(ctx, fx, time) {
    const K = Kit(), img = rodSprite(), u = fx.age, L = LIFT();
    for (let i = 0; i < 8; i++) {
      const b = i / 8 * TAU + fx.seed, d = 40 + easeOut(u / .25) * fx.R * .9, a = 1 - win(u, .9, 1.4);
      const x = fx.x + Math.cos(b) * d, y = fx.y + Math.sin(b) * d * .5 - L * .5;
      spriteAt(ctx, img, x, y, 9, 80, b + Math.PI / 2, a);
    }
    if (u < .3) lighter(ctx, () => K.glow(ctx, fx.x, fx.y - 30, fx.R * 1.4, '255,214,140', .8 * (1 - u / .3), true));
    if (u < .8) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.4, u / .8, 1 - u / .8, '240,200,120');
    dustBurst(ctx, fx.x, fx.y, fx.R, u, fx.seed, 'dust', 12);
  }
  function jburstG(ctx, fx) { craterG(ctx, fx.x, fx.y, fx.R * .8, 1 - win(fx.age, 1, 1.6), fx.seed); }
  function jcrashG(ctx, fx, time) {
    if (fx.age < fx.fall) {
      const k = easeIn(fx.age / fx.fall);
      ctx.fillStyle = `rgba(8,6,12,${.2 + .5 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.R * (.4 + .55 * k), fx.R * (.2 + .28 * k), 0, 0, TAU); ctx.fill();
      markEll(ctx, fx.x, fx.y, fx.R, '255,214,120', 1, time, false);
    } else {
      const u = fx.age - fx.fall, a = 1 - win(u, 1.2, 1.9), S = fx.R * .62;
      craterG(ctx, fx.x, fx.y, fx.R, 1 - win(fx.age, fx.dur - .9, fx.dur), fx.seed);
      if (a > 0) blackCube(ctx, fx.x, fx.y + S * .3 + win(u, 1.2, 1.9) * 100, S, .3, a, S * 1.2 * (1 - win(u, 1.2, 1.9) * .6));
    }
  }
  function jcrashO(ctx, fx) {
    const K = Kit(), S = fx.R * .62;
    if (fx.age < fx.fall) {
      const k = Math.min(1, easeIn(fx.age / fx.fall)), drop = (1 - k) * 200;
      blackCube(ctx, fx.x, fx.y - drop + S * .3, S, .3, 1, S * 1.2);
      lighter(ctx, () => {
        ctx.strokeStyle = 'rgba(255,220,150,.5)'; ctx.lineWidth = 4;
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const ox = (i - 3.5) * S * .28; ctx.moveTo(fx.x + ox, fx.y - drop - S * 1.7); ctx.lineTo(fx.x + ox, fx.y - drop - S * 1.7 - 200 - hash(i) * 120); } ctx.stroke();
        K.glow(ctx, fx.x, fx.y - drop - S * .5, S * 1.6, '255,190,90', .25);
      });
    } else {
      const u = fx.age - fx.fall;
      if (u < .3) lighter(ctx, () => K.glow(ctx, fx.x, fx.y - 60, fx.R * 1.9, '255,230,170', 1 - u / .3, true));
      if (u < 1.1) { K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.5, u / 1.1, 1 - u / 1.1, '240,200,120'); if (u > .15) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.95, (u - .15) / .95, (1 - u / 1.1) * .7, '255,240,210'); }
      dustBurst(ctx, fx.x, fx.y, fx.R * 1.1, u, fx.seed, 'dust', 18);
      if (u < 1.4) dustBurst(ctx, fx.x, fx.y, fx.R * 1.5, u * .8, fx.seed + 5, 'smoke', 10);
    }
  }

  // =================================================================== FX: Code
  function cclawG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.strokeStyle = `rgba(14,10,24,${.45 * fade})`; ctx.lineCap = 'round'; ctx.lineWidth = 7;
    ctx.beginPath();
    for (const mk of fx.marks) { const d = Math.min(mk.len, fx.age * fx.speed); ctx.moveTo(mk.x, mk.y); ctx.lineTo(mk.x + Math.cos(mk.a) * d, mk.y + Math.sin(mk.a) * d); }
    ctx.stroke();
  }
  function cclawO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    for (const mk of fx.marks) {
      const d = Math.min(mk.len, fx.age * fx.speed), done = fx.age * fx.speed > mk.len, a = done ? 1 - win(fx.age, mk.len / fx.speed, mk.len / fx.speed + .7) : 1;
      if (a <= 0) continue;
      const x = mk.x + Math.cos(mk.a) * d, y = mk.y + Math.sin(mk.a) * d - L;
      clawAt(ctx, x - Math.cos(mk.a) * 110, y - Math.sin(mk.a) * 110, mk.a, 260, a, 1.5);
      if (!done) lighter(ctx, () => K.glow(ctx, x, y, 34, '200,180,255', .45));
    }
    if (fx.age < .4) { const fl = K.puff('poof'); for (const mk of fx.marks) K.stamp(ctx, fl, mk.x + Math.cos(mk.a) * 60, mk.y + Math.sin(mk.a) * 60 - L, 20 + fx.age * 40, .5 * (1 - fx.age / .4)); }
  }
  function cwarpO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT();
    fx.spots.forEach((s, i) => {
      const t0 = i * .27, open = fx.age < t0 + .3 ? 1 : 1 - win(fx.age, t0 + .3, t0 + .6);
      // the Claw Mark hanging in the air that Code warps to
      ctx.save(); ctx.translate(s.x, s.y - L - 20); ctx.rotate(-1.2 + i * .3); ctx.globalAlpha = open;
      ctx.drawImage(clawSprite(), -60, -10, 120, 20); ctx.restore(); ctx.globalAlpha = 1;
      const u = fx.age - t0 - .05;
      if (u > 0 && u < .55) {
        const k = easeOut(u / .1), fade = 1 - win(u, .15, .55), ex = s.x + Math.cos(s.b) * 640 * k, ey = s.y + Math.sin(s.b) * 640 * k;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(8,6,14,${.85 * fade})`; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(s.x, s.y - L); ctx.lineTo(ex, ey - L); ctx.stroke();
        lighter(ctx, () => { ctx.strokeStyle = `rgba(230,225,255,${.9 * fade})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x, s.y - L); ctx.lineTo(ex, ey - L); ctx.stroke(); });
        ghost(ctx, 'code', s.x, s.y, Math.cos(s.b) >= 0 ? 1 : -1, .45 * fade);
      }
    });
    if (fx.age < .25) ghost(ctx, 'code', fx.x0, fx.y0, 1, .5 * (1 - fx.age / .25), 'seal');
  }
  function cwarpG(ctx, fx) {
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.strokeStyle = `rgba(14,10,24,${.4 * fade})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
    fx.spots.forEach((s, i) => { if (fx.age > i * .27 + .08) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(s.b) * 640, s.y + Math.sin(s.b) * 640); } });
    ctx.stroke();
  }
  function grimePos(it, t) {
    const k = clamp01(t / it.run);
    return { x: lerp(it.sx, it.x, easeIn(k) * .7 + k * .3), y: lerp(it.sy, it.y, easeIn(k) * .7 + k * .3), hop: t > it.run * .7 && t < it.run + .25 ? Math.sin(Math.PI * clamp01((t - it.run * .7) / (it.run * .3 + .25))) * 70 : Math.abs(Math.sin(t * 16)) * 6 };
  }
  function cgrimeG(ctx, fx) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const p = grimePos(it, t), land = t - it.run - .25;
      if (t < .35) { ctx.fillStyle = `rgba(8,6,12,${.7 * (1 - t / .35)})`; ctx.beginPath(); ctx.ellipse(it.sx, it.sy, 40, 16, 0, 0, TAU); ctx.fill(); }
      if (land < 0) { ctx.fillStyle = 'rgba(10,8,16,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 26, 10, 0, 0, TAU); ctx.fill(); }
      else { const a = 1 - win(land, .8, 1.4); ctx.fillStyle = `rgba(232,230,240,${.55 * a})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 60, 26, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(10,8,16,${.6 * a})`; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(it.x - 24 + k * 22, it.y - 4 + (k % 2) * 8, 9, 3, .5, 0, TAU); ctx.fill(); } }
    }
  }
  function cgrimeO(ctx, fx, time) {
    const K = Kit();
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const land = t - it.run - .25;
      if (land < .3) {
        const p = grimePos(it, t), rise = clamp01(t / .25), fr = Math.floor(time * 10 + it.t0 * 9) % 2, f = it.x >= it.sx ? 1 : -1;
        ctx.save(); ctx.translate(p.x, p.y - p.hop); ctx.scale(f * 1.05, 1.05 * rise); ctx.globalAlpha = land > 0 ? 1 - land / .3 : 1;
        ctx.drawImage(grimeSprite(fr), -60, -96, 120, 104); ctx.restore(); ctx.globalAlpha = 1;
      }
      if (land > 0 && land < .9) {
        const goo = K.puff('poof'), ink = K.puff('violet'), e = easeOut(land / .5), a = 1 - win(land, .4, .9);
        for (let k = 0; k < 7; k++) { const b = k / 7 * TAU + it.t0 * 9, d = 20 + e * 70; K.stamp(ctx, k % 2 ? ink : goo, it.x + Math.cos(b) * d, it.y - 30 + Math.sin(b) * d * .5 - e * 20, 16 + e * 14, a * .8); }
        if (land < .5) K.fx.shockRing(ctx, it.x, it.y, 120, land / .5, 1 - land / .5, '235,230,255');
      }
    }
  }
  function cxO(ctx, fx) {
    const L = LIFT(), u = fx.age, k = easeOut(u / .12), a = 1 - win(u, .25, fx.dur);
    for (const b of [.7, -.7]) {
      ctx.save(); ctx.translate(fx.x, fx.y - L); ctx.rotate(b); ctx.globalAlpha = a;
      ctx.drawImage(clawSprite(), -fx.R * 1.2 * k, -14, fx.R * 2.4 * k, 28); ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (u < .5) Kit().fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.3, u / .5, 1 - u / .5, '235,230,255');
  }
  function trailO(ctx, fx, time, z) {
    const a = 1 - fx.age / fx.dur, L = LIFT();
    if (a <= 0 || !fx.pts || fx.pts.length < 2) return;
    const path = () => { ctx.beginPath(); ctx.moveTo(fx.pts[0][0], fx.pts[0][1] - L); for (let i = 1; i < fx.pts.length; i++) ctx.lineTo(fx.pts[i][0], fx.pts[i][1] - L); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = `rgba(12,8,20,${.35 * a})`; ctx.lineWidth = fx.w * .9; ctx.stroke();
    lighter(ctx, () => { path(); ctx.strokeStyle = `rgba(${fx.rgb},${.4 * a})`; ctx.lineWidth = fx.w * .6; ctx.stroke(); path(); ctx.strokeStyle = `rgba(255,255,255,${.7 * a})`; ctx.lineWidth = 3; ctx.stroke(); });
  }
  function cstormG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (fx.age < fx.T) markEll(ctx, fx.tx, fx.ty, fx.R, '240,235,255', fx.age / fx.T, time, true);
    ctx.strokeStyle = `rgba(14,10,24,${.35 * fade})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
    for (const mk of fx.marks) if (fx.age > mk.t0 + .2) { ctx.moveTo(mk.x1, mk.y1); ctx.lineTo(mk.x2, mk.y2); }
    ctx.stroke();
    if (fx.age > fx.T) { craterG(ctx, fx.tx, fx.ty, 230, fade, fx.seed); ctx.strokeStyle = `rgba(10,6,16,${.6 * fade})`; ctx.lineWidth = 18; ctx.beginPath(); for (const X of fx.X) { ctx.moveTo(X.x1, X.y1); ctx.lineTo(X.x2, X.y2); } ctx.stroke(); }
  }
  function cstormO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    for (const mk of fx.marks) {
      const u = fx.age - mk.t0;
      if (u < 0 || u > .6) continue;
      const k = easeOut(u / .25), a = 1 - win(u, .3, .6), len = Math.hypot(mk.x2 - mk.x1, mk.y2 - mk.y1), ang = Math.atan2(mk.y2 - mk.y1, mk.x2 - mk.x1);
      const hx = lerp(mk.x1, mk.x2, k), hy = lerp(mk.y1, mk.y2, k) - L;
      clawAt(ctx, lerp(mk.x1, hx, .5), lerp(mk.y1 - L, hy, .5), ang, len * k, a, .9);
    }
    if (fx.age < fx.T) {
      // hovering claw marks spiralling in round the area
      for (let i = 0; i < 10; i++) { const b = i / 10 * TAU + fx.age * 2.4, r = fx.R * (1 - .4 * fx.age / fx.T); clawAt(ctx, fx.tx + Math.cos(b) * r, fx.ty + Math.sin(b) * r * .5 - 60, b + 1.6, 90, .7, .7); }
    } else {
      const u = fx.age - fx.T, k = easeOut(u / .1), a = 1 - win(u, .3, 1.0);
      for (const X of fx.X) {
        const ang = Math.atan2(X.y2 - X.y1, X.x2 - X.x1), len = Math.hypot(X.x2 - X.x1, X.y2 - X.y1);
        clawAt(ctx, (X.x1 + X.x2) / 2, (X.y1 + X.y2) / 2 - L, ang, len * k, a, 3.2);
      }
      if (u < .35) lighter(ctx, () => K.glow(ctx, fx.tx, fx.ty - 40, 360, '230,225,255', 1 - u / .35, true));
      if (u < 1.1) { K.fx.shockRing(ctx, fx.tx, fx.ty, fx.R * 1.2, u / 1.1, 1 - u / 1.1, '235,230,255'); }
      dustBurst(ctx, fx.tx, fx.ty, 260, u, fx.seed, 'smoke', 14);
    }
  }

  // =================================================================== FX: Kashin Koji
  function fireTongues(ctx, x, y, r, n, time, seed, alpha, hgt = 70) {
    const K = Kit();
    for (let i = 0; i < n; i++) {
      const b = hash(i * 3.1 + seed) * TAU, d = Math.sqrt(hash(i * 7.7 + seed)) * r, h = hgt * (.6 + .5 * hash(i + seed)) * (.8 + .2 * Math.sin(time * 9 + i));
      const fx = x + Math.cos(b) * d, fy = y + Math.sin(b) * d * .5;
      ctx.globalAlpha = alpha * .9;
      ctx.drawImage(K.flame((i + Math.floor(time * 12)) % 6), fx - h * .22, fy - h * FB, h * .44, h);
    }
    ctx.globalAlpha = 1;
  }
  function kendanG(ctx, fx) {
    for (const b of fx.balls) {
      const tl = b.len / fx.speed, u = fx.age - tl;
      if (u < 0) continue;
      const a = 1 - win(fx.age, fx.dur - .7, fx.dur);
      ctx.fillStyle = `rgba(40,16,6,${.42 * a})`; ctx.beginPath(); ctx.ellipse(b.x, b.y, 105, 50, 0, 0, TAU); ctx.fill();
      lighter(ctx, () => Kit().glow(ctx, b.x, b.y, 120, '255,120,30', .35 * a, false, .5));
    }
  }
  function kendanO(ctx, fx, time) {
    const K = Kit(), fire = K.puff('fire'), L = LIFT();
    for (const b of fx.balls) {
      const tl = b.len / fx.speed, u = fx.age - tl, c = Math.cos(b.a), s = Math.sin(b.a);
      if (u < 0) {
        const d = fx.age * fx.speed, x = fx.x + c * d, y = fx.y + s * d - L - 10;
        for (let k = 4; k >= 1; k--) K.stamp(ctx, fire, x - c * k * 18, y - s * k * 18, 22 - k * 3, .5);
        K.stamp(ctx, fire, x, y, 34, 1);
        lighter(ctx, () => K.glow(ctx, x, y, 60, '255,150,50', .6, true));
      } else {
        if (u < 1.1) K.fx.fireBlast(ctx, b.x, b.y, 130, u / 1.1, 1 - win(u, .6, 1.1), time, b.a * 10 + fx.seed);
        const a = 1 - win(fx.age, fx.dur - .7, fx.dur);
        if (u > .2) fireTongues(ctx, b.x, b.y, 80, 6, time, b.a * 7, a, 60);
      }
    }
  }
  function kblastO(ctx, fx, time) {
    const K = Kit(), u = fx.age / 1.2;
    if (u < 1) { K.fx.windDome(ctx, fx.x, fx.y, fx.R, u, 1 - u, time, false); K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.4, u * 1.2, 1 - u, '140,200,255'); }
    if (fx.age < .25) { ctx.save(); ctx.translate(fx.x, fx.y - 50); K.fx.rasenganOrb(ctx, 70 * (1 + fx.age * 2), time, 1 - fx.age / .25); ctx.restore(); }
    dustBurst(ctx, fx.x, fx.y, fx.R, fx.age, fx.seed, 'dust', 12);
  }
  function kblastG(ctx, fx) { craterG(ctx, fx.x, fx.y, fx.R * .75, 1 - win(fx.age, 1, 1.6), fx.seed); }
  function kneedlesO(ctx, fx, time) {
    const L = LIFT();
    ctx.lineCap = 'round';
    for (let v = 0; v < fx.vol; v++) {
      const tv = fx.age - v * fx.gap;
      if (tv < 0) continue;
      const d = tv * fx.speed, a = d > fx.len ? 1 - win(d, fx.len, fx.len + 300) : 1;
      if (a <= 0) continue;
      const dd = Math.min(d, fx.len);
      for (let i = 0; i < fx.n; i++) {
        const b = fx.a + ((i + (v % 2) * .5) / (fx.n - .5) - .5) * 2 * fx.half, c = Math.cos(b), s = Math.sin(b);
        const x = fx.x + c * dd, y = fx.y + s * dd - L - 6;
        ctx.strokeStyle = `rgba(30,24,30,${.85 * a})`; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(x - c * 70, y - s * 70); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = `rgba(252,250,244,${a})`; ctx.lineWidth = 3.4; ctx.stroke();
        if (d < fx.len) lighter(ctx, () => { ctx.strokeStyle = `rgba(255,255,255,${.5 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - c * 170, y - s * 170); ctx.lineTo(x - c * 70, y - s * 70); ctx.stroke(); });
      }
    }
    // the needle mane bristling round him as he fires
    if (fx.age < .7) {
      const k = 1 - fx.age / .7;
      ctx.strokeStyle = `rgba(245,242,235,${k})`; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const b = i / 16 * TAU; ctx.moveTo(fx.x + Math.cos(b) * 20, fx.y - 46 + Math.sin(b) * 22); ctx.lineTo(fx.x + Math.cos(b) * 52, fx.y - 46 + Math.sin(b) * 50); } ctx.stroke();
    }
  }
  function ktoadG(ctx, fx, time) {
    if (fx.age < fx.fall) {
      const k = easeIn(fx.age / fx.fall);
      ctx.fillStyle = `rgba(20,10,6,${.2 + .45 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.R * (.4 + .5 * k), fx.R * .5 * (.4 + .5 * k), 0, 0, TAU); ctx.fill();
      markEll(ctx, fx.x, fx.y, fx.R, '255,190,110', 1, time, false);
    } else {
      craterG(ctx, fx.x, fx.y, fx.R * .9, 1 - win(fx.age, fx.dur - .8, fx.dur), fx.seed);
      ctx.fillStyle = 'rgba(20,10,6,.35)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 10, fx.R * .6, fx.R * .22, 0, 0, TAU); ctx.fill();
    }
  }
  function ktoadO(ctx, fx, time) {
    const K = Kit(), W = 340 * 1.1, H = 250 * 1.1, gone = 2.15;
    const smoke = K.puff('poof');
    if (fx.age < .22) for (let i = 0; i < 9; i++) { const b = i / 9 * TAU; K.stamp(ctx, smoke, fx.x + Math.cos(b) * 90, fx.y - 680 + Math.sin(b) * 40, 60 + fx.age * 200, .9); }
    if (fx.age < gone) {
      const k = Math.min(1, easeIn(fx.age / fx.fall)), drop = (1 - k) * 640, u = fx.age - fx.fall;
      const sq = u > 0 && u < .25 ? 1 - Math.sin(Math.PI * u / .25) * .18 : 1, bob = u > .25 ? Math.sin((u - .25) * 5) * 3 : 0;
      ctx.save(); ctx.translate(fx.x, fx.y - drop + bob); ctx.scale(fx.f / sq * .98, sq);
      ctx.drawImage(toadSprite(), -W / 2, -H + 20, W, H); ctx.restore();
      if (u > 0 && u < 1.2) { K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.4, u / 1.2, 1 - u / 1.2, '255,200,140'); dustBurst(ctx, fx.x, fx.y, fx.R * 1.1, u, fx.seed, 'dust', 16); }
    } else {
      const u = fx.age - gone;
      for (let i = 0; i < 12; i++) { const b = i / 12 * TAU + fx.seed; K.stamp(ctx, smoke, fx.x + Math.cos(b) * (80 + u * 120), fx.y - 120 + Math.sin(b) * (50 + u * 60), 70 + u * 60, (1 - u / (fx.dur - gone)) * .95); }
    }
  }
  function kgamayuG(ctx, fx, time) {
    // The summoned toad squats behind Koji (ground layer, so Koji stands in front of it).
    if (fx.age < 2.4) {
      const sc = .66 * Math.min(1, fx.age / .2);
      ctx.save(); ctx.translate(fx.bx, fx.by); ctx.scale(fx.f * sc, sc); ctx.globalAlpha = 1 - win(fx.age, 2.1, 2.4);
      ctx.drawImage(toadSprite(), -170, -230, 340, 250); ctx.restore(); ctx.globalAlpha = 1;
    }
    const c = Math.cos(fx.a), s = Math.sin(fx.a), t0 = .1, front = Math.max(0, Math.min(fx.len, (fx.age - t0) * fx.speed)), a = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (front <= 0) return;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(40,14,4,${.4 * a})`; ctx.fillRect(40, -100, front - 40, 200);
    ctx.restore();
    lighter(ctx, () => { for (let d = 120; d < front; d += 160) Kit().glow(ctx, fx.x + c * d, fx.y + s * d, 150, '255,110,20', .3 * a, false, .5); });
    if (fx.age > t0 + fx.len / fx.speed) craterG(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 250, a, fx.seed);
  }
  function kgamayuO(ctx, fx, time) {
    const K = Kit(), fire = K.puff('fire'), smoke = K.puff('smoke'), c = Math.cos(fx.a), s = Math.sin(fx.a), L = LIFT(), t0 = .1;
    // The summoned toad behind Koji, spitting the oil that his fire lights.
    if (fx.age >= 2.4) { const u = fx.age - 2.4; const p = K.puff('poof'); for (let i = 0; i < 8; i++) { const b = i / 8 * TAU; K.stamp(ctx, p, fx.bx + Math.cos(b) * (60 + u * 80), fx.by - 80 + Math.sin(b) * 40, 50 + u * 40, (1 - u / 2) * .8); } }
    const front = Math.max(0, Math.min(fx.len, (fx.age - t0) * fx.speed)), flow = fx.age < t0 + fx.len / fx.speed + .7;
    if (front > 0 && flow) {
      // the torrent: big fire billows streaming along the line, a hot core and a dark smoke crown
      for (let d = front; d > 30; d -= 46) {
        const k = d / fx.len, w = 30 + 60 * k, wob = Math.sin(d * .05 - fx.age * 18) * 16 * k;
        const px = fx.x + c * d - s * wob, py = fx.y + s * d + c * wob - L - 10;
        K.stamp(ctx, smoke, px, py - w * .5, w * 1.05, .3);
        K.stamp(ctx, fire, px, py, w, .95);
      }
      lighter(ctx, () => {
        ctx.strokeStyle = 'rgba(255,230,140,.6)'; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40 - L - 10); ctx.lineTo(fx.x + c * front, fx.y + s * front - L - 10); ctx.stroke();
        K.glow(ctx, fx.x + c * front, fx.y + s * front - L, 120, '255,160,60', .7, true);
      });
    }
    const te = fx.age - (t0 + fx.len / fx.speed);
    if (te > 0 && te < 1.3) K.fx.fireBlast(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 300, te / 1.3, 1 - win(te, .8, 1.3), time, fx.seed);
    // fire sea left along the line
    if (front > 100) {
      const a = 1 - win(fx.age, fx.dur - .8, fx.dur);
      for (let d = 120; d < front; d += 130) fireTongues(ctx, fx.x + c * d, fx.y + s * d, 70, 3, time, d * .1 + fx.seed, a, 66);
      if (te > .3) fireTongues(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 190, 10, time, fx.seed + 3, a, 80);
    }
  }

  // =================================================================== FX: Urashiki
  function uhookO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), a = 1 - win(fx.age, fx.dur - .4, fx.dur);
    const rx = z ? z.x + 26 : fx.x0, ry = z ? z.y - L - 34 : fx.y0 - L - 34;
    let hx, hy;
    if (fx.age < fx.cast) { const k = easeOut(fx.age / fx.cast); hx = lerp(rx, fx.x, k); hy = lerp(ry, fx.y - L, k) - Math.sin(Math.PI * k) * 120; }
    else if (fx.age < fx.cast + fx.reel) { const k = easeIn((fx.age - fx.cast) / fx.reel) * .72; hx = lerp(fx.x, rx, k); hy = lerp(fx.y, ry + L, k) - L; }
    else { const k = easeOut((fx.age - fx.cast - fx.reel) / .3); hx = lerp(lerp(fx.x, rx, .72), rx, k); hy = lerp(lerp(fx.y - L, ry, .72), ry, k); }
    const mx = (rx + hx) / 2, my = Math.min(ry, hy) - 70;
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([(1 - t) * (1 - t) * rx + 2 * (1 - t) * t * mx + t * t * hx, (1 - t) * (1 - t) * ry + 2 * (1 - t) * t * my + t * t * hy]); }
    thread(ctx, pts, a, 2.6);
    // the hook and a drained chakra orb when it bit
    ctx.save(); ctx.translate(hx, hy); ctx.globalAlpha = a;
    ctx.strokeStyle = '#1c2050'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 8, 10, -Math.PI * .1, Math.PI * 1.05); ctx.stroke();
    ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    lighter(ctx, () => { K.glow(ctx, hx, hy + 6, 30, '170,225,255', .7 * a, true); if (fx.got) K.glow(ctx, hx, hy + 6, 60, '120,255,200', .6 * a * (1 - win(fx.age, fx.cast + fx.reel, fx.dur))); });
    if (fx.got && fx.age > fx.cast) {
      // stolen chakra flowing up the line into Urashiki's gourd-like orb
      const fl = 1 - win(fx.age, fx.cast + fx.reel + .3, fx.dur);
      lighter(ctx, () => {
        for (let i = 0; i < 9; i++) { const t = (fx.age * 1.8 + i / 9) % 1, j = Math.floor(t * 12), p = pts[12 - Math.min(12, j)]; K.glow(ctx, p[0], p[1], 14 + 6 * bell(t), '120,255,200', .85 * fl * bell(t), true); }
        K.glow(ctx, rx, ry, 46, '120,255,200', .7 * fl, true);
      });
    }
    if (fx.age >= fx.cast && fx.age < fx.cast + .4) K.fx.shockRing(ctx, fx.x, fx.y, 110, (fx.age - fx.cast) / .4, 1 - (fx.age - fx.cast) / .4, '170,225,255');
  }
  function ulashG(ctx, fx) {
    const d = Math.min(fx.len, (fx.age - .05) * fx.speed), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
    if (d <= 0) return;
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.strokeStyle = `rgba(16,20,50,${.45 * a})`; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); for (let x = 30; x <= d; x += 30) { const y = Math.sin(x * .03) * 14; if (x === 30) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    ctx.restore();
  }
  function ulashO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), c = Math.cos(fx.a), s = Math.sin(fx.a), t = fx.age - .05, d = Math.min(fx.len, Math.max(0, t * fx.speed));
    const a = 1 - win(fx.age, .55, 1.0);
    if (a > 0 && d > 0) {
      const pts = [];
      for (let x = 0; x <= d; x += 24) { const amp = 34 * Math.sin(Math.PI * clamp01(x / Math.max(1, d))) * (1 - t * .6), y = Math.sin(x * .02 - t * 30) * amp; pts.push([fx.x + c * x - s * y, fx.y + s * x + c * y - L - 20 * (1 - x / fx.len)]); }
      thread(ctx, pts, a, 6, '150,210,255');
      const e = pts[pts.length - 1];
      lighter(ctx, () => K.glow(ctx, e[0], e[1], 70, '190,235,255', .8 * a, true));
    }
    if (t > fx.len / fx.speed) { const u = t - fx.len / fx.speed; if (u < .8) { K.fx.shockRing(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 220, u / .8, 1 - u / .8, '170,225,255'); dustBurst(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 150, u, fx.seed, 'dust', 10); } }
    for (let i = 1; i <= 5 && d > 0; i++) { const dd = d * i / 5, u = t - dd / fx.speed; if (u > 0 && u < .5) K.fx.shockRing(ctx, fx.x + c * dd, fx.y + s * dd, 110, u / .5, (1 - u / .5) * .8, '170,225,255'); }
  }
  function uringsO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    for (let i = 0; i < 3; i++) {
      const u = fx.age - .02 - i * .18;
      if (u < 0) continue;
      const rho = Math.min(1, easeOut(u / .22)) * (130 + i * 120), a = 1 - win(u, .5, .95);
      if (a <= 0) continue;
      const pts = []; for (let k = 0; k <= 40; k++) { const b = k / 40 * TAU + fx.age * (i % 2 ? -6 : 6); pts.push([fx.x + Math.cos(b) * rho, fx.y + Math.sin(b) * rho * .5 - L * .6 + Math.sin(b * 3 + fx.age * 20) * 5]); }
      thread(ctx, pts, a, 4.5 - i, '170,215,255');
    }
    // reeling the loops back in
    if (fx.age > .85 && fx.age < 1.4) {
      const k = (fx.age - .85) / .55, rho = 420 * (1 - easeIn(k));
      const pts = []; for (let j = 0; j <= 40; j++) { const b = j / 40 * TAU; pts.push([fx.x + Math.cos(b) * rho, fx.y + Math.sin(b) * rho * .5 - L * .5]); }
      thread(ctx, pts, 1 - k, 3, '200,230,255');
      for (let j = 0; j < 8; j++) { const b = j / 8 * TAU + fx.age * 3; thread(ctx, [[fx.x, fx.y - L - 20], [fx.x + Math.cos(b) * rho, fx.y + Math.sin(b) * rho * .5 - L * .5]], (1 - k) * .6, 1.5); }
    }
    if (fx.age < .7) lighter(ctx, () => K.glow(ctx, fx.x, fx.y - L, 140, '170,210,255', .5 * (1 - fx.age / .7)));
  }
  function clockAt(ctx, x, y, r, alpha, time, squash = 1, back = 1) {
    if (alpha <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, squash); ctx.globalAlpha = alpha;
    ctx.drawImage(clockSprite(), -r, -r, r * 2, r * 2);
    const h1 = -time * 6 * back, h2 = -time * 1.2 * back;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,40,120,.9)'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(h1) * r * .8, Math.sin(h1) * r * .8); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(h2) * r * .5, Math.sin(h2) * r * .5); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,230,255,.95)'; ctx.lineWidth = r * .035; ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function urewindG(ctx, fx, time) {
    const a = 1 - win(fx.age, 1.0, fx.dur);
    clockAt(ctx, fx.x1, fx.y1, 120, .55 * a, time, .5, 3);
    if (fx.age < .42) markEll(ctx, fx.tx, fx.ty, 210, '190,170,255', fx.age / .42, time, false);
    else craterG(ctx, fx.tx, fx.ty, 170, a, fx.seed);
  }
  function urewindO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), a = 1 - fx.age / fx.dur;
    // afterimages running backwards along the rewound path
    for (let i = 0; i < 5; i++) { const t = i / 4; ghost(ctx, 'urashiki', lerp(fx.x0, fx.x1, t), lerp(fx.y0, fx.y1, t), fx.x1 >= fx.x0 ? -1 : 1, (.12 + .3 * t) * a, 'seal'); }
    thread(ctx, [[fx.x0, fx.y0 - L], [fx.x1, fx.y1 - L]], .5 * a, 2, '190,170,255');
    // hooks converging from all sides on the target he already "saw"
    const u = fx.age;
    if (u < .5) for (let i = 0; i < 6; i++) {
      const b = i / 6 * TAU + fx.seed, k = easeIn(u / .42), r = 260 * (1 - k), x = fx.tx + Math.cos(b) * r, y = fx.ty + Math.sin(b) * r * .5 - L;
      thread(ctx, [[fx.tx + Math.cos(b) * 400, fx.ty + Math.sin(b) * 200 - L - 120], [x, y]], 1, 2.2);
      lighter(ctx, () => K.glow(ctx, x, y, 20, '200,180,255', .9, true));
    }
    if (u > .42 && u < 1.3) { const v = (u - .42) / .9; K.fx.shockRing(ctx, fx.tx, fx.ty, 260, v, 1 - v, '200,180,255'); if (v < .3) lighter(ctx, () => K.glow(ctx, fx.tx, fx.ty - 40, 260, '210,190,255', 1 - v / .3, true)); dustBurst(ctx, fx.tx, fx.ty, 200, u - .42, fx.seed, 'dust', 10); }
  }
  function ublinkG(ctx, fx, time) {
    const a = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (fx.age < fx.T) { markEll(ctx, fx.tx, fx.ty, fx.R, '200,180,255', fx.age / fx.T, time, false); clockAt(ctx, fx.tx, fx.ty, fx.R * .8, .4, time, .5, 4); }
    else craterG(ctx, fx.tx, fx.ty, fx.R * .7, a, fx.seed);
    ctx.strokeStyle = `rgba(16,14,40,${.35 * a})`; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath();
    for (const s of fx.spots) if (fx.age > s.t + .06) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.ex, s.ey); }
    ctx.stroke();
  }
  function ublinkO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    for (const s of fx.spots) {
      const u = fx.age - s.t;
      if (u < -.15 || u > .7) continue;
      if (u < 0) { clockAt(ctx, s.x, s.y - L - 30, 40, (u + .15) / .15, time, 1, 6); continue; }
      const k = easeOut(u / .1), fade = 1 - win(u, .2, .7);
      ghost(ctx, 'urashiki', s.x, s.y, s.ex >= s.x ? 1 : -1, .55 * fade);
      clockAt(ctx, s.x, s.y, 70, .5 * fade, time, .5, -6);
      for (const off of [-26, 0, 26]) {
        const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * k; pts.push([lerp(s.x, s.ex, t), lerp(s.y, s.ey, t) - L - Math.sin(Math.PI * t) * (40 + off)]); }
        thread(ctx, pts, fade * (off ? .6 : 1), off ? 3 : 7, '190,180,255');
      }
      if (u < .3) lighter(ctx, () => { K.glow(ctx, s.x, s.y - L, 110, '200,180,255', .8 * (1 - u / .3), true); K.glow(ctx, (s.x + s.ex) / 2, (s.y + s.ey) / 2 - L - 30, 90, '220,210,255', .6 * (1 - u / .3), true); });
      if (u < .5) K.fx.shockRing(ctx, (s.x + s.ex) / 2, (s.y + s.ey) / 2, 140, u / .5, 1 - u / .5, '200,180,255');
    }
    const u = fx.age - fx.T;
    if (u < 0 && u > -.6) {
      // the vortex of lines closing in for the finish
      const k = (u + .6) / .6;
      for (let i = 0; i < 4; i++) { const rho = fx.R * (1.3 - k * .9) + i * 30; const pts = []; for (let j = 0; j <= 36; j++) { const b = j / 36 * TAU + time * (5 + i); pts.push([fx.tx + Math.cos(b) * rho, fx.ty + Math.sin(b) * rho * .5 - L]); } thread(ctx, pts, .8, 3, '200,190,255'); }
    }
    if (u > 0) {
      if (u < .35) lighter(ctx, () => K.glow(ctx, fx.tx, fx.ty - 50, fx.R * 1.5, '220,200,255', 1 - u / .35, true));
      if (u < 1.2) { K.fx.shockRing(ctx, fx.tx, fx.ty, fx.R * 1.25, u / 1.2, 1 - u / 1.2, '200,180,255'); if (u > .12) K.fx.shockRing(ctx, fx.tx, fx.ty, fx.R * 1.5, (u - .12) / 1.08, (1 - u / 1.2) * .7, '240,235,255'); }
      dustBurst(ctx, fx.tx, fx.ty, fx.R, u, fx.seed, 'dust', 18);
    }
  }

  // =================================================================== FX: Toneri
  function tpuppetPos(it, t) { const k = easeOut(clamp01(t / .6)); return { x: lerp(it.sx, it.x, k), y: lerp(it.sy, it.y, k), h: Math.sin(Math.PI * clamp01(t / .6)) * 60 + 8 }; }
  function tpuppetsG(ctx, fx, time) {
    if (fx.age < 1.05) markEll(ctx, fx.tx, fx.ty, 150, '160,200,255', fx.age / 1.05, time, false);
    for (const it of fx.items) { const p = tpuppetPos(it, fx.age - it.t0); ctx.fillStyle = 'rgba(10,12,24,.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 9, 0, 0, TAU); ctx.fill(); }
  }
  function tpuppetsO(ctx, fx, time, z) {
    const K = Kit(), img = puppetSprite(), L = LIFT();
    const break_ = fx.age > 1.5, smoke = K.puff('poof');
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      const p = tpuppetPos(it, t), rise = clamp01(t / .2), a = 1 - win(fx.age, 1.5, 1.9);
      if (z && fx.age < 1.2) thread(ctx, [[z.x + 20, z.y - L - 40], [p.x, p.y - p.h - 120]], .55, 1.2, '190,220,255');
      if (a > 0) { ctx.save(); ctx.translate(p.x, p.y - p.h + 8); ctx.scale(it.f, rise); ctx.globalAlpha = a; ctx.drawImage(img, -45, -150, 90, 150); ctx.restore(); ctx.globalAlpha = 1; }
      const u = fx.age - .75 - (fx.items.indexOf(it) * .05);
      if (u > 0 && u < .3) { const ang = Math.atan2(fx.ty - p.y, fx.tx - p.x); clawAt(ctx, p.x + Math.cos(ang) * 50, p.y + Math.sin(ang) * 25 - L, ang, 150, 1 - u / .3, .6); }
      if (break_ && fx.age < 2.2) K.stamp(ctx, smoke, p.x, p.y - 60, 40 + (fx.age - 1.5) * 50, (1 - (fx.age - 1.5) / .7) * .8);
    }
    const u = fx.age - 1.05;
    if (u > 0 && u < .6) { for (const b of [.6, -.6, 0]) { ctx.save(); ctx.translate(fx.tx, fx.ty - L); ctx.rotate(b); ctx.globalAlpha = 1 - u / .6; lighter(ctx, () => { ctx.strokeStyle = 'rgba(190,225,255,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-170, 0); ctx.lineTo(170, 0); ctx.stroke(); }); ctx.restore(); } ctx.globalAlpha = 1; K.fx.shockRing(ctx, fx.tx, fx.ty, 200, u / .6, 1 - u / .6, '170,210,255'); }
  }
  function ttsbG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) markEll(ctx, it.x, it.y, 115, '140,190,255', t / it.fl, time, false);
      else craterG(ctx, it.x, it.y, 95, 1 - win(t - it.fl, 1.2, 1.9), it.t0 * 50 + fx.seed);
    }
  }
  function ttsbO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), img = tsbSprite();
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = easeIn(t / it.fl), x = lerp(it.sx, it.x, k), y = lerp(it.sy, it.y - L, k) - Math.sin(Math.PI * k) * 140;
        lighter(ctx, () => K.glow(ctx, x, y, 44, '120,180,255', .55));
        ctx.drawImage(img, x - 20, y - 20, 40, 40);
        ctx.strokeStyle = 'rgba(150,200,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 21, 0, TAU); ctx.stroke();
      } else {
        const u = t - it.fl;
        if (u < .9) {
          const rho = 115 * easeOut(u / .25), a = 1 - win(u, .25, .9);
          ctx.globalAlpha = .7 * a; ctx.drawImage(img, it.x - rho, it.y - rho * .9 - 20, rho * 2, rho * 1.6); ctx.globalAlpha = 1;
          lighter(ctx, () => { ctx.strokeStyle = `rgba(150,200,255,${.85 * a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(it.x, it.y - 20, rho, rho * .8, 0, 0, TAU); ctx.stroke(); });
          K.fx.shockRing(ctx, it.x, it.y, 150, u / .9, 1 - u / .9, '140,190,255');
        }
        dustBurst(ctx, it.x, it.y, 100, u, it.t0 * 40, 'smoke', 8);
      }
    }
  }
  function tmeteorG(ctx, fx, time) {
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) { const k = t / it.fl; ctx.fillStyle = `rgba(20,10,6,${.15 + .35 * k})`; ctx.beginPath(); ctx.ellipse(it.x, it.y, 90 * (.4 + .6 * k), 45 * (.4 + .6 * k), 0, 0, TAU); ctx.fill(); markEll(ctx, it.x, it.y, 125, '255,180,110', k, time, false); }
      else { craterG(ctx, it.x, it.y, 115, 1 - win(t - it.fl, 1.6, 2.4), it.t0 * 70); lighter(ctx, () => Kit().glow(ctx, it.x, it.y, 100, '255,110,30', .5 * (1 - win(t - it.fl, .4, 2.0)), false, .5)); }
    }
  }
  function tmeteorO(ctx, fx, time) {
    const K = Kit(), fire = K.puff('fire'), smoke = K.puff('smoke');
    for (const it of fx.items) {
      const t = fx.age - it.t0;
      if (t < 0) continue;
      if (t < it.fl) {
        const k = easeIn(t / it.fl), x = it.x - 520 * (1 - k), y = it.y - 900 * (1 - k), S = 70 * it.sz;
        for (let j = 6; j >= 1; j--) { const q = j * .045; K.stamp(ctx, j > 3 ? smoke : fire, x - 520 * q * 1.4, y - 900 * q * .9, S * (.9 - j * .08), .6); }
        lighter(ctx, () => K.glow(ctx, x, y, S * 1.8, '255,150,60', .8, true));
        spriteAt(ctx, meteorSprite(it.v), x, y, S * 1.4, S * 1.4, time * 3 + it.v, 1);
      } else {
        const u = t - it.fl;
        if (u < 1.1) K.fx.fireBlast(ctx, it.x, it.y, 135, u / 1.1, 1 - win(u, .6, 1.1), time, it.t0 * 33);
        dustBurst(ctx, it.x, it.y, 125, u, it.t0 * 27, 'dust', 10);
        if (u > .3) fireTongues(ctx, it.x, it.y, 60, 3, time, it.t0 * 13, 1 - win(u, 1.4, 2.4), 50);
      }
    }
  }
  function twheelG(ctx, fx, time) {
    if (fx.age < fx.pull) { markEll(ctx, fx.x, fx.y, fx.R, '255,215,120', fx.age / fx.pull, time, false); markEll(ctx, fx.x, fx.y, 540, '255,215,120', 1, time, true); }
    else craterG(ctx, fx.x, fx.y, fx.R * .8, 1 - win(fx.age, fx.dur - .8, fx.dur), fx.seed);
  }
  function twheelO(ctx, fx, time, z) {
    const K = Kit(), L = LIFT(), cy = fx.y - L - 30;
    if (fx.age < fx.pull) {
      const k = fx.age / fx.pull;
      // golden wheel spinning behind him; dust and debris dragged inward
      ctx.save(); ctx.translate(fx.x, cy - 20); ctx.rotate(time * 4); ctx.globalAlpha = .9; ctx.drawImage(wheelSprite(), -90 - 40 * k, -90 - 40 * k, 180 + 80 * k, 180 + 80 * k); ctx.restore(); ctx.globalAlpha = 1;
      lighter(ctx, () => K.glow(ctx, fx.x, cy, 120 + 160 * k, '255,215,120', .45 + .3 * k, true));
      const dust = K.puff('dust');
      for (let i = 0; i < 18; i++) {
        const ph = (fx.age * 1.6 + hash(i + fx.seed)) % 1, b = i / 18 * TAU + ph * .8, r = 540 * (1 - ph);
        const x = fx.x + Math.cos(b) * r, y = fx.y + Math.sin(b) * r * .5 - 10 - ph * 30;
        K.stamp(ctx, dust, x, y, 14 + 10 * (1 - ph), .7 * bell(ph));
        ctx.strokeStyle = `rgba(255,225,150,${.5 * bell(ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, fx.x, .15), lerp(y, fx.y, .15)); ctx.stroke();
      }
    } else {
      const u = fx.age - fx.pull, e = easeOut(u / .3), a = 1 - win(u, .4, 1.4);
      if (a > 0) {
        ctx.globalAlpha = .55 * a; ctx.drawImage(tsbSprite(), fx.x - fx.R * e, cy - fx.R * .8 * e, fx.R * 2 * e, fx.R * 1.6 * e); ctx.globalAlpha = 1;
        lighter(ctx, () => {
          K.glow(ctx, fx.x, cy, fx.R * 1.6 * e, '255,200,110', .5 * a);
          K.glow(ctx, fx.x, cy, fx.R * .6 * e, '255,240,200', .8 * a, true);
          ctx.strokeStyle = `rgba(255,230,160,${.9 * a})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(fx.x, cy, fx.R * e, fx.R * .8 * e, 0, 0, TAU); ctx.stroke();
          ctx.save(); ctx.translate(fx.x, cy); ctx.rotate(time * 3); ctx.globalAlpha = a; ctx.drawImage(wheelSprite(), -fx.R * e * .9, -fx.R * e * .9, fx.R * e * 1.8, fx.R * e * 1.8); ctx.restore(); ctx.globalAlpha = 1;
        });
      }
      if (u < 1.2) { K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.35, u / 1.2, 1 - u / 1.2, '255,215,120'); if (u > .15) K.fx.shockRing(ctx, fx.x, fx.y, 560 * 1.1, (u - .15) / 1.05, (1 - u / 1.2) * .7, '255,245,210'); }
      dustBurst(ctx, fx.x, fx.y, fx.R * 1.1, u, fx.seed, 'dust', 18);
    }
  }
  function tbladeG(ctx, fx) {
    const u = fx.age - fx.sw, a = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (u < 0) return;
    const c = Math.cos(fx.a), s = Math.sin(fx.a), d = Math.min(fx.len, u * 4200);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(8,14,30,${.55 * a})`;
    ctx.beginPath(); ctx.moveTo(40, 0); for (let x = 40; x <= d; x += 40) ctx.lineTo(x, -12 - hash(x) * 14); for (let x = d; x >= 40; x -= 40) ctx.lineTo(x, 12 + hash(x + 7) * 14); ctx.closePath(); ctx.fill();
    ctx.restore();
    lighter(ctx, () => { for (let k = 120; k < d; k += 200) Kit().glow(ctx, fx.x + c * k, fx.y + s * k, 120, '90,170,255', .3 * a, false, .5); });
    if (u * 4200 > fx.len) craterG(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 230, a, fx.seed);
  }
  function tbladeO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), c = Math.cos(fx.a), s = Math.sin(fx.a), u = fx.age - fx.sw;
    if (u < .35) {
      // the giant blade sweeping down along the aim line
      const k = easeIn(clamp01((fx.age) / fx.sw)), H = fx.len * 1.02, rot = lerp(-Math.PI / 2 + (c >= 0 ? -.35 : .35), fx.a, k);
      const fade = u > 0 ? 1 - u / .35 : 1;
      ctx.save(); ctx.translate(fx.x, fx.y - L - 40); ctx.rotate(rot + Math.PI / 2); ctx.globalAlpha = fade;
      const sx = .5 + .5 * Math.abs(Math.cos(rot)) * 0 + .5;
      lighter(ctx, () => ctx.drawImage(swordSprite(), -60 * sx, -H, 120 * sx, H * 1.08));
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (u > 0) {
      const d = Math.min(fx.len, u * 4200), a = 1 - win(u, .25, 1.2);
      lighter(ctx, () => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(60,140,255,${.5 * a})`; ctx.lineWidth = 120; ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40 - L); ctx.lineTo(fx.x + c * d, fx.y + s * d - L); ctx.stroke();
        ctx.strokeStyle = `rgba(170,225,255,${.7 * a})`; ctx.lineWidth = 50; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 14; ctx.stroke();
        K.glow(ctx, fx.x + c * d, fx.y + s * d - L, 200, '120,200,255', a, true);
      });
      for (let k = 1; k <= 3; k++) { const dd = fx.len * k / 3.4, v = u - .06 * k; if (v > 0) dustBurst(ctx, fx.x + c * dd, fx.y + s * dd, 150, v, fx.seed + k * 5, 'dust', 9); }
      const te = u - fx.len / 4200;
      if (te > 0 && te < 1.2) { K.fx.shockRing(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 320, te / 1.2, 1 - te / 1.2, '120,200,255'); dustBurst(ctx, fx.x + c * fx.len, fx.y + s * fx.len, 240, te, fx.seed + 3, 'smoke', 12); }
      // blue sparks crackling in the split ground
      const a2 = 1 - win(fx.age, fx.dur - .8, fx.dur);
      lighter(ctx, () => { for (let i = 0; i < 10; i++) { const dd = 80 + hash(i + Math.floor(time * 8)) * (d - 80); K.glow(ctx, fx.x + c * dd, fx.y + s * dd - 6, 26, '120,200,255', .7 * a2, true); } });
    }
  }

  const FX = {
    jrods: [jrodsG, jrodsO], jshrink: [jshrinkG, jshrinkO], jcubes: [jcubesG, jcubesO], jburst: [jburstG, jburstO], jcrash: [jcrashG, jcrashO],
    cclaw: [cclawG, cclawO], cwarp: [cwarpG, cwarpO], cgrime: [cgrimeG, cgrimeO], cx: [null, cxO], trail: [null, trailO], cstorm: [cstormG, cstormO],
    kendan: [kendanG, kendanO], kblast: [kblastG, kblastO], kneedles: [null, kneedlesO], ktoad: [ktoadG, ktoadO], kgamayu: [kgamayuG, kgamayuO],
    uhook: [null, uhookO], ulash: [ulashG, ulashO], urings: [null, uringsO], urewind: [urewindG, urewindO], ublink: [ublinkG, ublinkO],
    tpuppets: [tpuppetsG, tpuppetsO], ttsb: [ttsbG, ttsbO], tmeteor: [tmeteorG, tmeteorO], twheel: [twheelG, twheelO], tblade: [tbladeG, tbladeO]
  };

  // =================================================================== windup looks
  function windupOverlay(ctx, z, st, m, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z), L = LIFT(), cx = z.x, cy = z.y - lift - 44, id = z.bossId, mv = st.move;
    const rgb = defOf(z, mv).rgb, hx = cx + Math.cos(st.aim) * 26, hy = cy + 6;
    lighter(ctx, () => K.glow(ctx, cx, cy, 40 + 40 * k, rgb, .45));
    if (id === 'jigen') {
      if (mv === 'crash') {
        // Sukunahikona releasing the cube: it swells above the target
        const S = 380 * .62 * (.1 + .9 * easeOut(k));
        ctx.fillStyle = `rgba(8,6,12,${.25 * k})`; ctx.beginPath(); ctx.ellipse(st.tx, st.ty, S * 1.2, S * .6, 0, 0, TAU); ctx.fill();
        blackCube(ctx, st.tx, st.ty - 200 + S * .3, S, .3 + time * .4 * (1 - k), .55 + .45 * k, S * 1.2);
        lighter(ctx, () => K.glow(ctx, st.tx, st.ty - 200 - S * .4, S * 1.8, '255,210,120', .25 + .25 * k));
      } else if (mv === 'cubes') { for (let i = 0; i < 3; i++) blackCube(ctx, cx + Math.cos(time * 2 + i * 2.1) * 34, cy - 30 + Math.sin(time * 2 + i * 2.1) * 10, 6 + 4 * k, time * 2, .9, 10 + 6 * k); }
      else if (mv === 'shrink') { lighter(ctx, () => { for (let i = 0; i < 8; i++) { const b = time * 5 + i / 8 * TAU; K.glow(ctx, hx + Math.cos(b) * 16, hy + Math.sin(b) * 8, 8, '255,220,150', .9, true); } }); }
      else if (mv === 'dash') {
        ctx.fillStyle = '#100c14';
        for (let i = 0; i < 10; i++) { const b = i / 10 * TAU + time, r = 36 + 10 * Math.sin(time * 8 + i); ctx.save(); ctx.translate(cx + Math.cos(b) * r, cy + Math.sin(b) * r * .7); ctx.rotate(b); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      } else { const img = rodSprite(); for (let i = -2; i <= 2; i++) spriteAt(ctx, img, hx + i * 10, cy - 46 - Math.abs(i) * 4, 6, 60, st.aim + Math.PI / 2 + i * .16, .95); }
    } else if (id === 'code') {
      if (mv === 'storm' || mv === 'rush') {
        // Karma spreading: black triangles crawling over him, a pale aura
        ctx.fillStyle = '#0a0810';
        for (let i = 0; i < 12; i++) { const b = i / 12 * TAU + time * 1.5, r = 30 + 14 * k; ctx.save(); ctx.translate(cx + Math.cos(b) * r, cy + Math.sin(b) * r * .9); ctx.rotate(b + 1.6); ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.restore(); }
        if (mv === 'storm') for (let i = 0; i < 6; i++) { const b = i / 6 * TAU + time * 3; clawAt(ctx, cx + Math.cos(b) * 70, cy + Math.sin(b) * 30, b + 1.5, 70, .9, .6); }
      } else if (mv === 'grime') {
        const goo = K.puff('violet');
        for (let i = 0; i < 6; i++) { const b = st.aim + (i - 2.5) * .55; K.stamp(ctx, goo, z.x + Math.cos(b) * 80, z.y + Math.sin(b) * 50 - 6, 14 + 10 * k + Math.sin(time * 12 + i) * 3, .8, .5); }
      } else if (mv === 'warp' && st.spots) { for (const s of st.spots) { ctx.save(); ctx.translate(s.x, s.y - L - 20); ctx.rotate(-1.2); ctx.globalAlpha = easeOut(k * 1.5); ctx.drawImage(clawSprite(), -60, -10, 120, 20); ctx.restore(); ctx.globalAlpha = 1; } }
      else { for (let i = 0; i < 3; i++) clawAt(ctx, hx + 20, hy - 14 + i * 10, st.aim - .3, 40 + 30 * k, .9, .5); }
    } else if (id === 'kashin') {
      if (mv === 'rasengan') { ctx.save(); ctx.translate(hx, hy); K.fx.rasenganOrb(ctx, 10 + 30 * easeOut(k), time, 1); ctx.restore(); }
      else if (mv === 'endan' || mv === 'gamayu') { const fire = K.puff('fire'); for (let i = 0; i < 5; i++) K.stamp(ctx, fire, hx + Math.sin(time * 9 + i) * 8, cy - 14 + Math.cos(time * 7 + i) * 6, 8 + 10 * k, .85); }
      if (mv === 'gamayu' || mv === 'toad') {
        const smoke = K.puff('poof'), bx = mv === 'gamayu' ? z.x - Math.cos(st.aim) * 70 : st.tx, by = mv === 'gamayu' ? z.y - 80 : st.ty - 660;
        for (let i = 0; i < 8; i++) { const b = i / 8 * TAU + time; K.stamp(ctx, smoke, bx + Math.cos(b) * 60 * k, by + Math.sin(b) * 26 * k, 24 + 40 * k, .85 * k); }
      }
      if (mv === 'needles') {
        ctx.strokeStyle = 'rgba(245,242,235,.95)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); for (let i = 0; i < 22; i++) { const b = i / 22 * TAU, r = 30 + 26 * easeOut(k); ctx.moveTo(cx + Math.cos(b) * 14, cy + Math.sin(b) * 16); ctx.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r * 1.1); } ctx.stroke();
        ctx.strokeStyle = 'rgba(40,30,30,.6)'; ctx.lineWidth = 1; ctx.stroke();
      }
    } else if (id === 'urashiki') {
      if (mv === 'rewind') clockAt(ctx, cx, cy - 30, 40 + 40 * k, .85, time, 1, 6);
      else if (mv === 'blink') { clockAt(ctx, cx, cy - 40, 60, .9, time, 1, 8); clockAt(ctx, st.tx, st.ty - L - 60, 30 + 60 * k, .6, time, 1, -5); }
      else if (mv === 'rings') { for (let i = 0; i < 2; i++) { const pts = []; for (let j = 0; j <= 24; j++) { const b = j / 24 * TAU + time * 9 * (i ? -1 : 1); pts.push([cx + Math.cos(b) * (30 + 20 * k + i * 12), cy + 20 + Math.sin(b) * (14 + 8 * k)]); } thread(ctx, pts, .9, 2); } }
      else { const tip = [hx + Math.cos(st.aim) * 30, hy - 44]; thread(ctx, [tip, [tip[0] + Math.cos(time * 7) * 14, tip[1] + 30 + Math.sin(time * 5) * 6]], .9, 2); lighter(ctx, () => K.glow(ctx, tip[0], tip[1], 20, '170,225,255', .8, true)); }
    } else if (id === 'toneri') {
      if (mv === 'blade') {
        const H = 140 + 420 * easeOut(k);
        ctx.save(); ctx.translate(cx, cy - 20); ctx.rotate(Math.cos(st.aim) >= 0 ? -.35 : .35); ctx.globalAlpha = .55 + .4 * k;
        lighter(ctx, () => ctx.drawImage(swordSprite(), -30 - 20 * k, -H, 60 + 40 * k, H * 1.08)); ctx.restore(); ctx.globalAlpha = 1;
      } else if (mv === 'wheel') {
        ctx.save(); ctx.translate(cx, cy - 20); ctx.rotate(time * 3); ctx.globalAlpha = .4 + .5 * k; ctx.drawImage(wheelSprite(), -40 - 60 * k, -40 - 60 * k, 80 + 120 * k, 80 + 120 * k); ctx.restore(); ctx.globalAlpha = 1;
      } else if (mv === 'tsb') {
        const img = tsbSprite();
        for (let i = 0; i < 6; i++) { const b = time * 2.4 + i / 6 * TAU; const x = cx + Math.cos(b) * 44, y = cy - 20 + Math.sin(b) * 18; ctx.drawImage(img, x - 10, y - 10, 20, 20); }
      } else if (mv === 'meteor') {
        const y = z.y - 620, x = z.x - 260, S = 40 + 60 * k;
        lighter(ctx, () => K.glow(ctx, x, y, S * 2.4, '255,190,120', .5 + .3 * k));
        spriteAt(ctx, meteorSprite(1), x, y, S * 1.5, S * 1.5, time, .9);
      } else if (mv === 'puppets') {
        for (let i = 0; i < 5; i++) { const b = st.aim + (i - 2) * .7; thread(ctx, [[hx, hy], [z.x + Math.cos(b) * 90, z.y + Math.sin(b) * 60 - 80 * k]], .7, 1.2, '190,220,255'); }
      }
      // Tenseigan glow in the eyes during every windup
      lighter(ctx, () => K.glow(ctx, cx + 6, z.y - lift - (window.AnimeSprites ? window.AnimeSprites.height('toneri') * .78 : 80), 22, '120,200,255', .7, true));
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function bodyLift(z) {
    const m = members[z && z.bossId], st = z && z.kr;
    if (!m) return 0;
    const storm = st && z.bossId === 'code' && st.fx.some(f => f.kind === 'cstorm' && f.age < f.T) ? 16 : 0;
    return (m.lift || storm) ? (m.lift || 0) + storm + Math.sin(((st && st.t) || 0) * 2) * 3 : 0;
  }

  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const S = window.AnimeSprites, id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - bodyLift(z) - (S && S.height ? S.height(id) : 100) - 34, text = defOf(z, st.move).label;
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 13px sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = '#151017'; ctx.strokeText(text, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(text, z.x, top);
    ctx.restore();
  }

  // =================================================================== draw entry points
  function draw(ctx, z, time) {
    const member = z && members[z.bossId], st = z && z.kr;
    if (!member || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = defOf(z, st.move).rgb;
      for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const member = z && members[z.bossId], st = z && z.kr;
    if (!member || !st) return;
    ctx.save();
    if (st.dash && z.health > 0) {
      // live dash streak and afterimage
      const ds = st.dash;
      trailO(ctx, { pts: ds.pts, w: ds.w, rgb: ds.rgb || '255,255,255', age: 0, dur: 1 }, time, z);
      if (z.bossId === 'kashin') { ctx.save(); ctx.translate(z.x + Math.cos(ds.a) * 34, z.y - LIFT() - 30); Kit().fx.rasenganOrb(ctx, 40, time, 1); ctx.restore(); }
      else ghost(ctx, z.bossId, z.x - Math.cos(ds.a) * 60, z.y - Math.sin(ds.a) * 60, Math.cos(ds.a) >= 0 ? 1 : -1, .35);
    }
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) { windupOverlay(ctx, z, st, member, time); label(ctx, z, st, member); }
    ctx.restore();
  }

  window.KaraBosses = { members, order, pick, update, draw, drawOverlay, bodyLift, moves, moveLabels };
})();
