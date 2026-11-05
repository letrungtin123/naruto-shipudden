/* Konoha jōnin (spawn panel, faction 'jonin'): Yamato, Sai, Sarutobi Asuma, Yūhi Kurenai.
 * Same contract as duel-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints telegraphs and
 * ground effects, drawOverlay(ctx, z, time) what stands above the characters. Per-boss state lives on z.jn (plain
 * numbers / small arrays; closures in ev/upd are skipped by the co-op snapshot). The four sprites are registered
 * here with AnimeSprites.addSprite.
 *
 * Yamato  : Mộc Thích Trận (wood spike line), Mộc Trụ Phá (beam fan), Tứ Trụ Lao (cage bind + crush), Tứ Trụ Gia
 *           (house drop), Mộc Phân Thân (three wood clones charge), ult Mộc Long (wood dragon coils + forest).
 * Sai     : ink lions, ink birds dive-bombing, ink snakes bind, ink clones, the giant ink bird ride (bombing run),
 *           ult Bách Thú Cuồng Bôn (a stampede of ink beasts off a giant scroll).
 * Asuma   : Phi Yến (wind-blade slash), thrown wind knives (boomerang), Hôi Tích Thiêu (ash cloud ignites),
 *           wind-knife combo dash, Chân Không Nhận (long vacuum blade), ult ash dome + Hien dash + explosion.
 * Kurenai : petal storm (slow + cuts), Thụ Phược Sát (tree binds, she steps out of the trunk and stabs), illusion
 *           copies (kunai fans), thorn vines (knockback), petal blink strike, ult Huyễn Hoa Thụ Giới (genjutsu world). */
(() => {
  'use strict';
  const AS = window.AnimeSprites, K = AS && AS.kit;
  // ================================================================== sprites
  if (K) (() => {
    const { paint, poly, smooth, ell, dot, line, seg, lerp, lit, litN, dark, light, mix, rgba, SHADE, DEEP, DEEP2, GLOSS, CREASE, TAU,
      plateSymbol, flakVest, locks, HAIR, sweptHair, sweptBack, spikeHair, drawEye, fringeShadow, onFace, headPath, hairGloss, shine } = K;
    const swirlSleeve = ctx => {
      ctx.strokeStyle = '#b8352c'; ctx.lineWidth = .55; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const a = i * .55, r = .15 + i * .085; const x = -2.5 + Math.cos(a) * r, y = -8.6 + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    };
    const KONOHA_LEGS = (suit, o = {}) => Object.assign({ thigh: suit, shin: suit, foot: '#222a3e', wrap: '#e6e2d8', holster: '#1c2436', w1: 5.4, w2: 4.3 }, o);

    // ---------------------------------------------------------------- Yamato
    // Short spiky brown hair, the forehead protector with the metal face guard framing his cheeks
    // and chin, big round dark eyes, the green flak jacket over the navy suit.
    function yamatoSpec() {
      const O = '#141a14', HC = '#5b3b24', SUIT = '#2b3552', VEST = '#62793e', GUARD = '#7d8794', CLOTH = '#262c3a';
      const guard = (ctx, spec) => {
        // Near cheek guard: from the band down in front of the ear to the jaw, wrapping under the chin.
        const G = () => {
          ctx.beginPath();
          ctx.moveTo(-7.2, -4.6); ctx.lineTo(-1.2, -3.6);
          ctx.quadraticCurveTo(-.2, 2.4, .8, 7.6);
          ctx.quadraticCurveTo(3.6, 10.2, 6.8, 10.6);
          ctx.lineTo(6.4, 12.6);
          ctx.quadraticCurveTo(1.4, 13, -3.2, 10.4);
          ctx.quadraticCurveTo(-7.4, 7.6, -8.6, 2.6);
          ctx.quadraticCurveTo(-8.8, -1.4, -7.2, -4.6); ctx.closePath();
        };
        paint(ctx, G, GUARD, spec.outline, .95, () => {
          const g = ctx.createLinearGradient(-8, 0, 2, 0);
          g.addColorStop(0, dark(GUARD, .35)); g.addColorStop(.6, GUARD); g.addColorStop(1, light(GUARD, .35));
          ctx.fillStyle = g; ctx.fillRect(-10, -6, 18, 20);
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(-1.6, -3.4); ctx.quadraticCurveTo(-.6, 2.6, .4, 7.2); ctx.lineTo(-.4, 7.4); ctx.quadraticCurveTo(-1.4, 2.6, -2.4, -3.4); ctx.fill();
          ctx.fillStyle = rgba(dark(GUARD, .5), .6); ctx.fillRect(-10, 9.6, 20, 4);
          // rivets
          for (const [x, y] of [[-5.6, -2.2], [-6.4, 3.4], [-3.6, 8.2], [3.2, 11.2]]) { dot(ctx, x, y, .42, dark(GUARD, .55)); dot(ctx, x - .12, y - .12, .16, 'rgba(255,255,255,.85)'); }
        });
        // Far cheek guard peeking past the face's far edge.
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(9.8, -3.4); ctx.quadraticCurveTo(11.6, 1, 11.2, 4.4); ctx.quadraticCurveTo(10.4, 8.4, 7.6, 11); ctx.lineTo(7, 10.2); ctx.quadraticCurveTo(9.8, 6.8, 10.3, 3.4); ctx.quadraticCurveTo(10.4, .4, 9.2, -3.2); ctx.closePath(); },
          dark(GUARD, .12), spec.outline, .7);
      };
      return {
        outline: O, skin: '#efcfb2', skinShade: '#cfa08a', legK: 1.12,
        legs: KONOHA_LEGS(SUIT),
        arms: { upper: SUIT, lower: SUIT, w1: 4.8, w2: 4.2, cuff: '#3c4560', hand: '#262c3e' },
        torso: { base: SUIT, over: flakVest(VEST, { outline: O }) },
        shoulder: swirlSleeve,
        head: {
          back(ctx, spec) { sweptBack(ctx, spec, HC, [[-80, 16], [-110, 18], [-140, 18.4], [-168, 16.4], [-196, 14]], { valley: 12, sweep: .22 }); },
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-40, 13.6], [-64, 16.2], [-88, 17.6], [-112, 18], [-136, 17.4], [-160, 16.4], [-186, 14.8], [-212, 13]], { valley: 12.2, sweep: .26 }),
          eyes: { type: 'normal', iris: '#2a1e16' }, browColor: '#3a2618', mouth: 'neutral', attackMouth: 'shout', blush: false,
          band: { cloth: CLOTH, plate: '#cdd5de', symbol: 'leaf', wide: true },
          front(ctx, spec, pose) {
            guard(ctx, spec);
            // a couple of brown tufts falling over the plate
            locks(ctx, spec, HC, [[1.2, -8.8, .6, -6.2, 1.2, -.2], [4.4, -9, 4.8, -6.8, 1.1, .2], [7.6, -8.4, 8.6, -6, 1.1, .4]], .8);
            if (pose && pose.seal) {
              // the "scary face": shadowed brow and pinprick pupils
              onFace(ctx, () => { ctx.fillStyle = 'rgba(20,10,30,.42)'; ctx.fillRect(-12, -3.2, 26, 5.4); });
              dot(ctx, 2.6, 2.4, .5, '#fff'); dot(ctx, 8.1, 2.3, .4, '#fff');
            }
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          // wood splinters budding from the striking palm
          const [x, y] = hand;
          for (let i = 0; i < 4; i++) {
            const a = -.9 + i * .55, L = 5 + (i % 2) * 2.5;
            paint(ctx, () => poly(ctx, [[x + Math.cos(a - .5) * 1.2, y + Math.sin(a - .5) * 1.2], [x + Math.cos(a) * L + 1, y + Math.sin(a) * L], [x + Math.cos(a + .5) * 1.2, y + Math.sin(a + .5) * 1.2]]), '#9a6a3a', O, .5);
          }
        }
      };
    }

    // ---------------------------------------------------------------- Sai
    // Pale skin, neat short black hair, the cropped black jacket bared at the midriff (one long and
    // one short sleeve), tantō across the back, the ink scroll and the brush; that empty smile.
    function saiSpec() {
      const O = '#121218', HC = '#17171d', SKIN = '#f6ebe4', JACKET = '#2a2a33', PANTS = '#22232c', TRIM = '#b8303a';
      const brush = (ctx, x, y, rot) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        line(ctx, [[-2, 0], [9, 0]], O, 1.6); line(ctx, [[-1.8, 0], [8.8, 0]], '#c9a46a', .9);
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(8.6, -.9); ctx.quadraticCurveTo(12.4, -.6, 13.6, 0); ctx.quadraticCurveTo(12.4, .6, 8.6, .9); ctx.closePath(); }, '#0c0c10', O, .5);
        ctx.restore();
      };
      return {
        outline: O, skin: SKIN, skinShade: '#d6c2c0', bulk: -.3, legK: 1.12,
        legs: { thigh: PANTS, shin: PANTS, foot: '#1c1d26', wrap: '#e6e2d8', holster: '#1a1b22', w1: 5.2, w2: 4.2 },
        // near arm: the long black sleeve; far arm: the short sleeve and a bare forearm
        arms: { upper: JACKET, lower: JACKET, w1: 4.5, w2: 4, cuff: '#3a3a46', hand: SKIN },
        farArms: { upper: JACKET, lower: SKIN, w1: 4.4, w2: 3.8, hand: SKIN, bare: true },
        torso: {
          base: SKIN, paint: ctx => {
            // the cropped jacket ends above the navel; bare midriff, then the trouser waist
            ctx.fillStyle = JACKET; ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(10, -14); ctx.lineTo(10, -6.4); ctx.quadraticCurveTo(1, -5.2, -9, -6.6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(3.6, -13.6, 4, 6.6);
            line(ctx, [[-9, -6.6], [1, -5.4], [10, -6.4]], TRIM, .7);
            line(ctx, [[3.4, -13.6], [3.6, -5.6]], 'rgba(0,0,0,.55)', .5);
            ctx.fillStyle = 'rgba(180,120,130,.25)'; ell(ctx, 3.2, -3.6, 2.6, 1.2); ctx.fill();
            ctx.strokeStyle = 'rgba(160,110,120,.5)'; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(3.6, -4.8); ctx.lineTo(3.7, -3.2); ctx.stroke();
            ctx.fillStyle = PANTS; ctx.fillRect(-9, -2.4, 19, 4.6);
            ctx.fillStyle = '#3a3b48'; ctx.fillRect(-9, -2.4, 19, .8);
            // the scroll pouch on the back of the belt
            ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-8.4, -3.4, 3.4, 3.4);
          }
        },
        collar(ctx) {
          // high, open collar
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3.2, -12); ctx.quadraticCurveTo(-4, -16, -1.6, -17.2); ctx.lineTo(1.4, -16.6); ctx.lineTo(.6, -12.4); ctx.closePath(); }, JACKET, O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(-5, -18, 4, 7); });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(4.6, -12.4); ctx.lineTo(4.4, -16.6); ctx.quadraticCurveTo(6.8, -16.4, 7.2, -13.4); ctx.closePath(); }, JACKET, O, .7);
        },
        back(ctx) {
          // tantō slung across the back, hilt up behind the far shoulder; the rolled scroll at the hip
          line(ctx, [[-7.6, -2], [6.4, -18]], O, 2.6); line(ctx, [[-7.4, -2.2], [6.2, -17.8]], '#2a2a36', 1.7);
          line(ctx, [[4.6, -16], [8.4, -20.4]], O, 2.4); line(ctx, [[4.8, -16.2], [8.2, -20.2]], '#d8cfc0', 1.3);
          ctx.save(); ctx.translate(-7.8, -1.6); ctx.rotate(.18);
          paint(ctx, () => { ctx.beginPath(); ctx.rect(-1.6, -4.6, 3.2, 9.2); }, '#efe6d0', O, .7, () => {
            ctx.fillStyle = 'rgba(80,60,40,.3)'; ctx.fillRect(-1.6, -4.6, 1, 9.2); ctx.fillStyle = '#b8303a'; ctx.fillRect(-1.6, -.6, 3.2, 1.1);
          });
          paint(ctx, () => ell(ctx, 0, -4.6, 1.6, .7), '#d8ccb0', O, .5);
          ctx.restore();
        },
        head: {
          hair: HAIR.smooth(HC, { nape: 6.4, bangs: [[9.4, 1.3, 1.2], [.2, 1.6, 2.6], [3.4, 1.5, -.6], [6.4, 1.3, -1.6]] }),
          eyes: { type: 'normal', iris: '#121216' }, browColor: HC, browW: .6, mouth: 'smile', attackMouth: 'smile', blush: false,
          band: { cloth: '#18181e', plate: '#cdd5de', symbol: 'leaf' },
          front(ctx, spec, pose) {
            if (pose && (pose.seal || pose.attack)) return;
            // the closed-eye smile: arcs over the eyes
            onFace(ctx, () => {
              ctx.fillStyle = SKIN; ctx.fillRect(-.2, -.6, 4.8, 5.6); ctx.fillRect(6.2, -.4, 3.6, 5.4);
            });
            ctx.strokeStyle = O; ctx.lineWidth = .75; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(.4, 2.8); ctx.quadraticCurveTo(2.4, .8, 4.4, 2.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(6.6, 2.6); ctx.quadraticCurveTo(8, 1, 9.4, 2.4); ctx.stroke();
          }
        },
        front(ctx, pose, hand) {
          if (pose.attack || pose.seal) brush(ctx, hand[0] - .5, hand[1], pose.seal ? -1.2 : -.5);
          if (pose.seal) {
            // the scroll unrolled across the far hand
            paint(ctx, () => { ctx.beginPath(); ctx.rect(4, -1.4, 9, 5); }, '#f1ead8', O, .6, () => {
              ctx.strokeStyle = 'rgba(20,20,30,.7)'; ctx.lineWidth = .5;
              ctx.beginPath(); ctx.moveTo(5.4, 1.6); ctx.quadraticCurveTo(7.4, -.6, 9, 1.2); ctx.quadraticCurveTo(10.6, 2.8, 12, .4); ctx.stroke();
            });
          }
        }
      };
    }

    // ---------------------------------------------------------------- Asuma
    // Tall and broad: short spiky dark hair, the short beard, a cigarette, the flak jacket with the
    // Guardian Twelve sash (火) knotted at the waist, trench knives in his fists.
    function asumaSpec() {
      const O = '#16140f', HC = '#2b2622', SUIT = '#2a3450', VEST = '#62793e', SASH = '#d9d4c6', SKIN = '#e6bf9c';
      const knife = (ctx, x, y, rot, glow) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        // knuckle ring and the grip, then the twin-edged blade
        ctx.strokeStyle = O; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(-.6, 1.8, 2.2, 1.4, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#9aa2ae'; ctx.lineWidth = .7; ctx.stroke();
        paint(ctx, () => { ctx.beginPath(); ctx.moveTo(1.4, -1.1); ctx.lineTo(9.6, -.7); ctx.lineTo(12, .1); ctx.lineTo(9.6, .9); ctx.lineTo(1.4, 1.2); ctx.closePath(); }, '#cfd6e0', O, .55, () => {
          ctx.fillStyle = '#f6f9ff'; ctx.fillRect(1.4, -1, 10, .5);
          ctx.fillStyle = 'rgba(60,70,90,.4)'; ctx.fillRect(1.4, .3, 10, .8);
        });
        if (glow) {
          ctx.fillStyle = 'rgba(120,200,255,.35)'; ctx.beginPath(); ctx.moveTo(1, -2.4); ctx.lineTo(17, 0); ctx.lineTo(1, 2.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(220,245,255,.7)'; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(15, 0); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      };
      return {
        outline: O, skin: SKIN, skinShade: '#c4987a', bulk: .9, legK: 1.16, headScale: 1.02,
        legs: KONOHA_LEGS(SUIT, { w1: 5.9, w2: 4.7 }),
        arms: { upper: SUIT, lower: SUIT, w1: 5.4, w2: 4.8, cuff: '#3a4462', hand: SKIN },
        torso: {
          base: SUIT, over(ctx, pose) {
            flakVest(VEST, { outline: O })(ctx, pose);
            // the Guardian Twelve sash: pale cloth round the waist, 火 in a ring, tails at the hip
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-7, -3.4); ctx.quadraticCurveTo(0, -4.4, 8, -3.2); ctx.lineTo(8.2, .4); ctx.quadraticCurveTo(0, -.6, -7, .6); ctx.closePath(); }, SASH, O, .8, () => {
              ctx.fillStyle = SHADE; ctx.fillRect(-9, -1.4, 19, 3);
              ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-9, -3.8, 19, .6);
            });
            ctx.strokeStyle = '#2a2420'; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(3.2, -1.6, 1.5, 0, TAU); ctx.stroke();
            ctx.font = 'bold 2.4px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#2a2420'; ctx.fillText('火', 3.2, -1.5);
            paint(ctx, () => poly(ctx, [[-6.2, -1.2], [-8.4, 4.6], [-6.6, 4.2], [-5.4, 5.4], [-4.6, .2]]), dark(SASH, .06), O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(-12, 1, 6, 7); });
          }
        },
        shoulder: swirlSleeve,
        head: {
          hair: HAIR.spiky(HC, { count: 7, len: .62, tips: [5, 6.5, 7, 7, 6.5, 6, 5] }),
          eyes: { type: 'normal', iris: '#2a2218' }, brows: 'thick', browW: 1.3, browColor: HC, mouth: 'neutral', attackMouth: 'shout', blush: false,
          band: { cloth: '#1e2433', plate: '#cdd5de', symbol: 'leaf' },
          marks(ctx, spec) {
            // the short beard along the jaw and round the chin, and the moustache
            onFace(ctx, () => {
              ctx.fillStyle = HC;
              ctx.beginPath(); ctx.moveTo(-5.4, 3); ctx.quadraticCurveTo(-3.2, 4, -1.6, 7.2); ctx.quadraticCurveTo(2, 9.4, 4.4, 9.2);
              ctx.quadraticCurveTo(6.6, 8.6, 8.4, 8.8); ctx.quadraticCurveTo(10.4, 7.2, 10.8, 5.8); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,.12)'; ell(ctx, 4, 10.6, 3, .8); ctx.fill();
              ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .3;
              for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-2 + i * 2, 9 + Math.sin(i) * .4); ctx.lineTo(-2.4 + i * 2, 11); ctx.stroke(); }
              // moustache
              ctx.fillStyle = HC; ctx.beginPath(); ctx.moveTo(5, 6.6); ctx.quadraticCurveTo(7, 5.6, 9.6, 6.2); ctx.lineTo(9.4, 7); ctx.quadraticCurveTo(7, 6.6, 5.2, 7.3); ctx.closePath(); ctx.fill();
            });
          },
          front(ctx, spec, pose) {
            // cigarette in the corner of the mouth, a faint wisp
            if (!(pose && pose.attack)) {
              line(ctx, [[7.6, 7.6], [12.6, 8.4]], spec.outline, 1.5); line(ctx, [[7.8, 7.6], [12.4, 8.35]], '#f4f0e6', .85);
              dot(ctx, 12.6, 8.4, .7, '#ff7a2a'); dot(ctx, 12.7, 8.3, .3, '#ffe6a0');
              ctx.strokeStyle = 'rgba(220,220,230,.55)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.moveTo(12.8, 7.6); ctx.quadraticCurveTo(14, 5, 12.8, 3); ctx.quadraticCurveTo(12, 1, 13.4, -1); ctx.stroke();
            }
            locks(ctx, spec, HC, [[-1.4, -8.6, -2.6, -2.6, 1.3, -.6], [9.4, -7.6, 10.6, -3, 1.2, .5]], .8);
          }
        },
        front(ctx, pose, hand) {
          knife(ctx, hand[0] + .4, hand[1] - .4, pose.attack ? -.12 : pose.seal ? -1.3 : 1.25, !!pose.attack);
        }
      };
    }

    // ---------------------------------------------------------------- Kurenai
    // Long wavy black hair, red eyes ringed in red, red lips, the bandage-wrapped dress with the
    // single red mesh sleeve, wrapped thighs.
    function kurenaiSpec() {
      const O = '#1a1016', HC = '#1d1720', WRAP = '#ebe4d8', WRAP_D = '#bdb2a2', RED = '#b8283a', SKIN = '#f7dccd';
      const wrapLines = (ctx, x0, y0, x1, y1, step, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = .35;
        for (let y = y0; y < y1; y += step) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y - 2.2); ctx.stroke(); }
      };
      const waveDrape = (ctx, spec) => {
        // the long wavy mass falling down the back to the waist
        const L = 34;
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(-6, -8);
          ctx.bezierCurveTo(-15, -2, -11, 8, -15, 14); ctx.bezierCurveTo(-18, 20, -12, 26, -15, L);
          ctx.lineTo(-11, L - 2.6); ctx.lineTo(-9.4, L + 1); ctx.lineTo(-6.6, L - 3); ctx.lineTo(-4.4, L - .4);
          ctx.bezierCurveTo(-6, 26, -2.4, 20, -4.4, 14); ctx.bezierCurveTo(-6, 9, -1, 5, 1.4, 3);
          ctx.closePath();
        }, HC, spec.outline, 1.05, () => {
          ctx.fillStyle = dark(HC, .3); ctx.fillRect(-30, 0, 40, 50);
          ctx.strokeStyle = 'rgba(120,110,150,.4)'; ctx.lineWidth = .5;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6 - i * 1.6, -2); ctx.bezierCurveTo(-12 - i, 8, -6 - i * 1.4, 18, -12 - i * .6, L - 2); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(190,180,230,.35)'; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(-12, 2); ctx.bezierCurveTo(-15, 10, -11, 14, -14, 22); ctx.stroke();
        });
      };
      return {
        outline: O, skin: SKIN, skinShade: '#ddaa98', bulk: -.6, legK: 1.12,
        legs: { thigh: WRAP, shin: '#2a2230', foot: '#2a2230', w1: 4.9, w2: 4, wrap: WRAP,
          // bandage turns round the thighs
        },
        arms: { upper: RED, lower: RED, w1: 4.3, w2: 3.8, hand: SKIN,
          pattern(ctx, p0, p1, p2, far) {
            // the red mesh sleeve: a fine net
            const [nx, ny] = litN(p0, p2);
            ctx.strokeStyle = far ? 'rgba(40,0,10,.45)' : 'rgba(60,0,14,.5)'; ctx.lineWidth = .25;
            for (const t of [.2, .35, .5, .65, .8]) { const m = lerp(p0, p2, t); ctx.beginPath(); ctx.moveTo(m[0] - nx * 2, m[1] - ny * 2); ctx.lineTo(m[0] + nx * 2, m[1] + ny * 2); ctx.stroke(); }
          } },
        farArms: { upper: WRAP, lower: WRAP, w1: 4.2, w2: 3.7, hand: SKIN,
          pattern(ctx, p0, p1, p2) {
            const [nx, ny] = litN(p0, p2);
            for (const t of [.15, .3, .45, .6, .75, .88]) { const m = lerp(p0, p2, t); line(ctx, [[m[0] - nx * 2.1, m[1] - ny * 2.1 - .5], [m[0] + nx * 2.1, m[1] + ny * 2.1 + .5]], WRAP_D, .3); }
          } },
        torso: {
          base: WRAP, paint: ctx => {
            // the wrapped bodice: diagonal bandage turns, a red lining at the hem of the top
            wrapLines(ctx, -9, -12, 10, 2, 1.7, rgba(WRAP_D, .9));
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(3.6, -12, 3, 8);
            ctx.fillStyle = RED; ctx.fillRect(-9, -13.6, 19, 1.2);
          }
        },
        skirt: {
          color: WRAP, hem: 9.4, flare: .6, paint: (ctx, hem, hipY) => {
            wrapLines(ctx, -14, hipY - 2, 14, hem + 2, 1.6, rgba(WRAP_D, .95));
            ctx.fillStyle = RED; ctx.fillRect(-20, hem - .9, 40, 1.1);
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.6, -13.2, 4.1, 1.4, 0, 0, TAU); }, WRAP, O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(-3, -13, 9, 2); });
        },
        shoulder(ctx) {
          // the red sleeve's shoulder cap
          paint(ctx, () => smooth(ctx, [[-5.6, -13], [-1.6, -13.6], [.4, -11.6], [-.8, -9.6], [-5, -9.6], [-6.4, -11.2]]), RED, O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(-8, -11, 10, 2); });
        },
        head: {
          drape: waveDrape,
          hair(ctx, spec) {
            HAIR.smooth(HC, { nape: 9.6, bangs: [[9.8, 1.5, 6.4], [-.8, 1.9, 7.2], [2.6, 1.4, -2.4], [6, 1.3, -2.8]] })(ctx, spec);
            // wavy volume bulging at the back of the head
            paint(ctx, () => smooth(ctx, [[-9.4, -6], [-13.6, -1], [-12.4, 4], [-14, 9], [-10.6, 12], [-8.4, 6], [-6.6, 0]]), HC, spec.outline, .9, () => {
              ctx.fillStyle = dark(HC, .3); ctx.fillRect(-16, 2, 10, 12);
              ctx.strokeStyle = 'rgba(190,180,230,.35)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-11.4, -3); ctx.quadraticCurveTo(-13, 2, -11.4, 6); ctx.stroke();
            });
          },
          eyes: { type: 'normal', iris: '#c8243a', fem: true }, blush: false, mouth: 'lips', lipColor: '#c0203a', attackMouth: 'lips', browColor: HC, browW: .55,
          band: { cloth: '#1c2030', plate: '#cdd5de', symbol: 'leaf' },
          marks(ctx) {
            // eye shadow and the red ring round each iris
            onFace(ctx, () => {
              ctx.fillStyle = 'rgba(150,40,90,.14)'; ell(ctx, 2.4, -.1, 2.4, .8); ctx.fill(); ell(ctx, 7.9, -.1, 1.7, .7); ctx.fill();
            });
          },
          front(ctx, spec) {
            ctx.strokeStyle = 'rgba(120,10,30,.55)'; ctx.lineWidth = .25;
            ctx.beginPath(); ctx.ellipse(2.75, 2.6, 1.0, 1.3, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(8.2, 2.45, .7, 1.2, 0, 0, TAU); ctx.stroke();
            locks(ctx, spec, HC, [[-1.4, -8.4, -3.4, 9.4, 1.9, -1], [10.2, -6.6, 11.4, 7.6, 1.5, .8]], .85);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          // kunai
          ctx.save(); ctx.translate(hand[0] + .6, hand[1]); ctx.rotate(-.25);
          line(ctx, [[-3, 0], [0, 0]], O, 1.8); line(ctx, [[-2.8, 0], [-.2, 0]], '#3a2a30', 1);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -1.3); ctx.lineTo(7, 0); ctx.lineTo(0, 1.3); ctx.closePath(); }, '#c8ced8', O, .5, () => { ctx.fillStyle = '#f4f7ff'; ctx.fillRect(0, -1.2, 7, .5); });
          ctx.restore();
        }
      };
    }

    AS.addSprite('yamato', yamatoSpec(), { scale: 1.3, box: [-40, -86, 42, 8] }, { hair: '#5b3b24', fringe: 'spiky', accent: '#a8c070', mask: undefined });
    AS.addSprite('sai', saiSpec(), { scale: 1.26, box: [-42, -88, 42, 8] }, { hair: '#17171d', fringe: 'part', accent: '#8a9ac8' });
    AS.addSprite('asuma', asumaSpec(), { scale: 1.36, box: [-42, -88, 46, 8] }, { hair: '#2b2622', fringe: 'spiky', accent: '#6ab0ff' });
    AS.addSprite('kurenai', kurenaiSpec(), { scale: 1.26, box: [-44, -86, 40, 10] }, { hair: '#1d1720', fringe: 'part', accent: '#e0304a', marks: ['eyeshadow'], long: true });
  })();

  // ================================================================== module
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const r1 = v => Math.round(v * 10) / 10, R0 = Math.round;
  const Kit = () => window.VFXKit;
  const LIFT = (AS && AS.LIFT) || 24;

  const members = {
    yamato: { name: 'YAMATO — MỘC ĐỘN', accent: '#b8d27a', hpScale: 3.3, damageScale: 1.85, armor: .92,
      rot: ['spikes', 'pillars', 'cage', 'clones', 'house', 'dragon', 'pillars', 'spikes', 'house', 'cage', 'clones', 'dragon'] },
    sai: { name: 'SAI — SIÊU THÚ NGỤY HỌA', accent: '#a6b4e0', hpScale: 3.1, damageScale: 1.8,
      rot: ['lions', 'birds', 'snakes', 'clones', 'ride', 'stampede', 'birds', 'lions', 'ride', 'snakes', 'clones', 'stampede'] },
    asuma: { name: 'SARUTOBI ASUMA — PHONG ĐỘN', accent: '#7cc4ff', hpScale: 3.4, damageScale: 1.9, armor: .9,
      rot: ['hien', 'knives', 'ash', 'combo', 'vacuum', 'ult', 'combo', 'hien', 'vacuum', 'knives', 'ash', 'ult'] },
    kurenai: { name: 'YŪHI KURENAI — HUYỄN THUẬT', accent: '#ff5a7a', hpScale: 3.0, damageScale: 1.8,
      rot: ['petals', 'tree', 'copies', 'vines', 'blink', 'garden', 'copies', 'petals', 'blink', 'tree', 'vines', 'garden'] }
  };
  const order = Object.keys(members);
  const pick = level => order[((level % order.length) + order.length) % order.length];

  // windup = dodge window (s); after = pause before the next jutsu. Key order = manual keys 1..6, ultimate last.
  const MOVES = {
    yamato: {
      spikes:  { label: 'MỘC ĐỘN · MỘC THÍCH TRẬN', rgb: '200,236,120', windup: .75, after: 1.1 },
      pillars: { label: 'MỘC ĐỘN · MỘC TRỤ PHÁ', rgb: '210,190,120', windup: .8, after: 1.2 },
      cage:    { label: 'MỘC ĐỘN · TỨ TRỤ LAO', rgb: '190,230,110', windup: .9, after: 1.2 },
      house:   { label: 'MỘC ĐỘN · TỨ TRỤ GIA', rgb: '230,200,130', windup: .95, after: 1.2 },
      clones:  { label: 'MỘC ĐỘN · MỘC PHÂN THÂN', rgb: '200,230,140', windup: .7, after: 1.2 },
      dragon:  { label: 'MỘC ĐỘN · MỘC LONG CHI THUẬT', rgb: '170,240,100', windup: 1.35, after: 1.6, ult: 1 }
    },
    sai: {
      lions:    { label: 'SIÊU THÚ NGỤY HỌA · MẶC SƯ', rgb: '150,170,230', windup: .75, after: 1.1 },
      birds:    { label: 'SIÊU THÚ NGỤY HỌA · MẶC ĐIỂU', rgb: '160,180,240', windup: .85, after: 1.2 },
      snakes:   { label: 'SIÊU THÚ NGỤY HỌA · MẶC XÀ', rgb: '140,160,220', windup: .75, after: 1.2 },
      clones:   { label: 'MẶC PHÂN THÂN', rgb: '170,180,220', windup: .65, after: 1.1 },
      ride:     { label: 'SIÊU THÚ NGỤY HỌA · CỰ ĐIỂU', rgb: '170,190,250', windup: .7, after: 1.0 },
      stampede: { label: 'SIÊU THÚ NGỤY HỌA · BÁCH THÚ CUỒNG BÔN', rgb: '150,170,255', windup: 1.35, after: 1.6, ult: 1 }
    },
    asuma: {
      hien:   { label: 'PHONG ĐỘN · PHI YẾN', rgb: '150,215,255', windup: .6, after: 1.0 },
      knives: { label: 'PHONG ĐỘN · PHI YẾN PHI ĐAO', rgb: '160,225,255', windup: .7, after: 1.1 },
      ash:    { label: 'HỎA ĐỘN · HÔI TÍCH THIÊU', rgb: '255,150,70', windup: .8, after: 1.3 },
      combo:  { label: 'PHI YẾN · LIÊN HOÀN TRẢM', rgb: '170,230,255', windup: .65, after: 1.1 },
      vacuum: { label: 'PHONG ĐỘN · CHÂN KHÔNG NHẬN', rgb: '140,205,255', windup: .8, after: 1.1 },
      ult:    { label: 'PHI YẾN · HÔI TÍCH BẠO VIÊM', rgb: '255,130,60', windup: 1.3, after: 1.6, ult: 1 }
    },
    kurenai: {
      petals: { label: 'HUYỄN THUẬT · HOA BIỆN VŨ', rgb: '255,110,150', windup: .7, after: 1.1 },
      tree:   { label: 'MA HUYỄN · THỤ PHƯỢC SÁT', rgb: '255,80,110', windup: .85, after: 1.2 },
      copies: { label: 'HUYỄN THUẬT · HUYỄN ẢNH PHÂN THÂN', rgb: '255,120,160', windup: .75, after: 1.1 },
      vines:  { label: 'MA HUYỄN · ĐẰNG LA TRIỀN', rgb: '230,90,120', windup: .65, after: 1.0 },
      blink:  { label: 'HUYỄN THUẬT · HOA ẢNH THUẤN BỘ', rgb: '255,140,170', windup: .55, after: 1.0 },
      garden: { label: 'MA HUYỄN · HUYỄN HOA THỤ GIỚI', rgb: '255,60,100', windup: 1.45, after: 1.7, ult: 1 }
    }
  };
  const MANUAL = {}, MOVE_LISTS = {};
  for (const id in MOVES) { MANUAL[id] = Object.keys(MOVES[id]); MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[id][k].label })); }
  const moves = z => (z && MOVE_LISTS[z.bossId]) || [];
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;

  function state(z) {
    return z.jn || (z.jn = { t: 0, casts: 0, timer: 1.2, move: '', windup: 0, windMax: 1, aim: 0, tx: R0(z.x), ty: R0(z.y), seed: 0,
      tele: [], ev: [], fx: [], spots: null, dash: null, hold: 0, lift: 0, vanish: 0, lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 160) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (AS && AS.has && AS.has(id) ? AS.height(id) : 84);
  // The unit a bind / drag acts on: api.player, or in manual mode (cursor pseudo-target) the nearest foe.
  const victim = (api, x, y, r) => { const p = api.player; if (p && !p.pseudo) return p; return api.nearestFoe ? api.nearestFoe(x, y, r) : null; };
  // Pull a unit toward (x, y) without a shove; teammates' heroes in other browsers and the cursor are left alone.
  function drag(api, p, x, y, sp, dt) {
    if (!p || p.remote || p.pseudo || !(p.health > 0)) return;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const m = Math.min(d, sp * dt), mx = dx / d * m, my = dy / d * m, r = p.r || 12;
    if (!api.blocked(p.x + mx, p.y, r)) p.x += mx;
    if (!api.blocked(p.x, p.y + my, r)) p.y += my;
  }
  // Bind: whoever stands inside (x, y, r) when it closes is held there for T seconds.
  function bind(st, api, x, y, r, T, sp = 520, tick = 0, D = 0) {
    const v = victim(api, x, y, r + 60);
    if (!v || Math.hypot(v.x - x, v.y - y) > r + (v.r || 12)) return false;
    let k = .5;
    const fx = addFx(st, { kind: 'none', dur: T });
    fx.upd = (f, dt, api) => {
      drag(api, v, x, y, sp, dt);
      if (tick && (k -= dt) <= 0) { k = .5; api.strike(x, y, r, D * tick, null, null, true); }
    };
    return true;
  }
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 50 + i * 16;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }
  // Point toward the target, no farther than `max` from (x, y).
  function reach(x, y, tx, ty, max, min = 0) {
    const d = Math.hypot(tx - x, ty - y), a = Math.atan2(ty - y, tx - x), k = Math.max(min, Math.min(max, d));
    return { x: x + Math.cos(a) * k, y: y + Math.sin(a) * k, d: k, a };
  }

  // ------------------------------------------------------------------ telegraphs
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    const L = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: R0(ox), y: R0(oy), a: r1(aa), len: R0(len), w });
    const C = (cx, cy, r, faint) => ({ k: 'c', x: R0(cx), y: R0(cy), r, faint: faint ? 1 : 0 });
    const T = (max, min) => reach(x, y, st.tx, st.ty, max, min);
    const keep = pts => { st.spots = pts.map(p => p.map(v => typeof v === 'number' ? r1(v) : v)); return st.spots; };
    if (id === 'yamato') switch (move) {
      case 'spikes': { const len = Math.max(560, Math.min(980, T(2000).d + 180)); keep([[len]]); return [L(len, 58)]; }
      case 'pillars': return [-2, -1, 0, 1, 2].map(i => L(720, 36, a + i * .25));
      case 'cage': { const t = T(760); keep([[t.x, t.y]]); return [C(t.x, t.y, 150), C(t.x, t.y, 200, 1)]; }
      case 'house': { const t = T(720); keep([[t.x, t.y]]); return [C(t.x, t.y, 200)]; }
      case 'clones': {
        const t = T(700), b = Math.random() * TAU, out = [C(t.x, t.y, 120, 1)], sp = [];
        for (let i = 0; i < 3; i++) {
          const ang = b + i * TAU / 3, cx = t.x + Math.cos(ang) * 250, cy = t.y + Math.sin(ang) * 250;
          sp.push([cx, cy, ang + Math.PI]); out.push(L(500, 34, ang + Math.PI, cx, cy), C(cx, cy, 46, 1));
        }
        keep(sp); return out;
      }
      case 'dragon': {
        const t = T(900, 300), ex = t.x - Math.cos(t.a) * 240, ey = t.y - Math.sin(t.a) * 240;
        keep([[t.x, t.y, t.a, Math.hypot(ex - x, ey - y)]]);
        return [L(Math.hypot(ex - x, ey - y), 64, t.a), C(t.x, t.y, 250), C(t.x, t.y, 520, 1)];
      }
    }
    if (id === 'sai') switch (move) {
      case 'lions': return [-1, 0, 1].map(i => L(860, 46, a + i * .2));
      case 'birds': {
        const t = T(700), b = Math.random() * TAU, sp = [[t.x, t.y]];
        for (let i = 0; i < 7; i++) sp.push([t.x + Math.cos(b + i * TAU / 7) * 200, t.y + Math.sin(b + i * TAU / 7) * 200]);
        keep(sp); return sp.map(p => C(p[0], p[1], 105));
      }
      case 'snakes': { const t = T(720, 200); keep([[t.x, t.y, t.d]]); return [{ k: 'cone', x: R0(x), y: R0(y), a: r1(t.a), r: R0(t.d + 60), h: .32 }, C(t.x, t.y, 130)]; }
      case 'clones': {
        const t = T(620), out = [], sp = [];
        for (let i = 0; i < 3; i++) {
          const ang = a + Math.PI + (i - 1) * 1.1, cx = x + Math.cos(ang + Math.PI * .5 * (i - 1)) * 120, cy = y + Math.sin(ang + Math.PI * .5 * (i - 1)) * 120;
          const da = Math.atan2(t.y - cy, t.x - cx), dl = Math.hypot(t.x - cx, t.y - cy) + 170;
          sp.push([cx, cy, da, dl]); out.push(L(dl, 40, da, cx, cy));
        }
        keep(sp); return out;
      }
      case 'ride': {
        const len = Math.max(420, Math.min(820, T(2000).d + 260)), sp = [];
        for (let i = 1; i <= 5; i++) { const d = len * i / 5.4; sp.push([x + ca * d, y + sa * d]); }
        keep([[len]].concat(sp)); return [L(len, 54)].concat(sp.map(p => C(p[0], p[1], 115)));
      }
      case 'stampede': return [L(1100, 250), C(x + ca * 1100, y + sa * 1100, 320, 1)];
    }
    if (id === 'asuma') switch (move) {
      case 'hien': return [{ k: 'cone', x: R0(x), y: R0(y), a: r1(a), r: 340, h: .95 }];
      case 'knives': return [L(700, 48, a - .2), L(700, 48, a + .2)];
      case 'ash': return [{ k: 'cone', x: R0(x), y: R0(y), a: r1(a), r: 660, h: .46 }];
      case 'combo': {
        const t = T(560, 160), nx = -Math.sin(t.a), ny = Math.cos(t.a), sp = [[x, y]];
        const side = Math.random() < .5 ? 1 : -1;
        sp.push([t.x + nx * 150 * side + Math.cos(t.a) * 160, t.y + ny * 150 * side + Math.sin(t.a) * 160]);
        sp.push([t.x - nx * 170 * side - Math.cos(t.a) * 40, t.y - ny * 170 * side - Math.sin(t.a) * 40]);
        sp.push([t.x + Math.cos(t.a) * 230, t.y + Math.sin(t.a) * 230]);
        keep(sp);
        const out = [];
        for (let i = 1; i < sp.length; i++) out.push(L(Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]), 60, Math.atan2(sp[i][1] - sp[i - 1][1], sp[i][0] - sp[i - 1][0]), sp[i - 1][0], sp[i - 1][1]));
        return out;
      }
      case 'vacuum': return [L(1080, 54)];
      case 'ult': { const t = T(640, 200); keep([[t.x, t.y, t.a, t.d]]); return [C(t.x, t.y, 440), L(t.d + 380, 90, t.a)]; }
    }
    if (id === 'kurenai') switch (move) {
      case 'petals': { const t = T(680); keep([[t.x, t.y]]); return [C(t.x, t.y, 250), L(t.d, 30, t.a)]; }
      case 'tree': { const t = T(720); keep([[t.x, t.y]]); return [C(t.x, t.y, 135)]; }
      case 'copies': {
        const t = T(700), b = Math.random() * TAU, sp = [], out = [C(t.x, t.y, 150, 1)];
        for (let i = 0; i < 4; i++) { const ang = b + i * TAU / 4, cx = t.x + Math.cos(ang) * 280, cy = t.y + Math.sin(ang) * 280; sp.push([cx, cy, ang + Math.PI]); out.push(L(470, 28, ang + Math.PI, cx, cy)); }
        keep([[t.x, t.y]].concat(sp)); return out;
      }
      case 'vines': return [C(x, y, 340), C(x, y, 120, 1)];
      case 'blink': { const t = T(640); keep([[t.x, t.y, t.a]]); return [C(t.x, t.y, 125)]; }
      case 'garden': { const t = T(640); keep([[t.x, t.y]]); return [C(t.x, t.y, 580, 1), C(t.x, t.y, 220)]; }
    }
    return [];
  }

  function announce(z, st, api, forced) {
    const id = z.bossId, m = members[id], move = forced || m.rot[st.casts % m.rot.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = R0(p ? p.x : z.x + Math.cos(st.aim) * 300); st.ty = R0(p ? p.y : z.y + Math.sin(st.aim) * 300);
    st.seed = r1(Math.random() * 99);
    st.spots = null;
    st.tele = teleFor(z, st, id, move);
    z.angle = st.aim;
  }

  // Straight dash (houses on the way are smashed, walls stop it).
  function startDash(z, st, a, len, dur, dmg, w, end, o = {}) {
    st.dash = { a: r1(a), speed: len / dur, left: dur, dur, hit: 0, w, dmg, end, ride: o.ride ? 1 : 0, lift: o.lift || 0, heavy: o.heavy ? 1 : 0, wt: 0 };
    if (!o.ride) addFx(st, { kind: 'trail', x0: R0(z.x), y0: R0(z.y), x1: R0(z.x), y1: R0(z.y), a: r1(a), dur: dur + .4, rgb: o.rgb || '200,230,255' });
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, api) {
    const id = z.bossId, D = api.damage || 60, a = st.aim;
    const f = CAST[id] && CAST[id][st.move];
    if (f) f(z, st, api, D, a, Math.cos(a), Math.sin(a));
  }
  const sp = st => st.spots || [];

  const CAST = {
    yamato: {
      spikes(z, st, api, D, a, ca, sa) {
        const len = sp(st)[0] ? sp(st)[0][0] : 900, x0 = z.x, y0 = z.y, SPD = 1500, pts = [];
        for (let d = 50, i = 0; d < len; d += 34, i++) {
          for (let j = 0; j < 2; j++) {
            const off = (hash(i * 3 + j + st.seed) - .5) * 70, px = x0 + ca * d - sa * off, py = y0 + sa * d + ca * off;
            pts.push([R0(px), R0(py), r1(d / SPD), R0(60 + hash(i + j * 7) * 70 + Math.min(1, d / 300) * 40), R0(16 + hash(i * 2 + j) * 10), r1((hash(i * 5 + j) - .5) * .6 - (off / 70) * .4), (i * 2 + j) % 4]);
          }
        }
        pts.sort((p, q) => p[1] - q[1]);
        addFx(st, { kind: 'stakes', pts, dur: len / SPD + 1.6, rgb: '200,236,120' });
        for (let d0 = 40; d0 < len; d0 += 150) later(st, d0 / SPD, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * Math.min(len, d0 + 150), y0 + sa * Math.min(len, d0 + 150), 58, D * 1.6, d0 > 250 ? 'earth' : null));
        later(st, len / SPD, api => { api.world(x0 + ca * len, y0 + sa * len, 110, D * 3, 'earth', a); api.shake(6); });
        api.shake(4);
      },
      pillars(z, st, api, D, a) {
        const x0 = z.x, y0 = z.y, beams = [];
        for (let i = -2; i <= 2; i++) beams.push([r1(a + i * .25), R0(720 - Math.abs(i) * 40), r1(hash(i + st.seed) * .1)]);
        addFx(st, { kind: 'beams', x: R0(x0), y: R0(y0), beams, dur: 1.5 });
        for (const [ba, bl, dl] of beams) later(st, .12 + dl, api => {
          api.line(x0, y0, x0 + Math.cos(ba) * bl, y0 + Math.sin(ba) * bl, 36, D * 1.5, 'earth');
          api.world(x0 + Math.cos(ba) * bl, y0 + Math.sin(ba) * bl, 70, D * 2, 'earth', ba);
        });
        api.shake(5);
      },
      cage(z, st, api, D) {
        const [cx, cy] = sp(st)[0] || [st.tx, st.ty], T = 1.7;
        addFx(st, { kind: 'cage', x: R0(cx), y: R0(cy), r: 150, T, dur: T + 1.3 });
        later(st, .14, api => { api.strike(cx, cy, 150, D * .8, null, 'earth', true); bind(st, api, cx, cy, 150, T, 600, .3, D); api.shake(5); });
        later(st, T, api => { api.strike(cx, cy, 175, D * 2.3, null, 'crater'); api.world(cx, cy, 160, D * 3, 'earth'); api.shake(9); });
      },
      house(z, st, api, D) {
        const [cx, cy] = sp(st)[0] || [st.tx, st.ty];
        addFx(st, { kind: 'house', x: R0(cx), y: R0(cy), dur: 3.2 });
        later(st, .16, api => { api.strike(cx, cy, 200, D * 2.4, null, 'crater'); api.world(cx, cy, 200, D * 3.5, 'earth'); api.shake(10); });
        later(st, .5, api => api.strike(cx, cy, 240, D * .6, null, null, true));
      },
      clones(z, st, api, D) {
        const list = sp(st).map(([x, y, ang], i) => [R0(x), R0(y), r1(ang), r1(.05 + i * .2)]);
        addFx(st, { kind: 'wclones', list, dur: 2.4 });
        for (const [x, y, ang, t0] of list) later(st, t0 + .5, api => {
          api.line(x, y, x + Math.cos(ang) * 500, y + Math.sin(ang) * 500, 34, D * 1.4, 'blade');
          api.burst(x + Math.cos(ang) * 250, y + Math.sin(ang) * 250, '#a8743c', 8);
        });
      },
      dragon(z, st, api, D) {
        const [cx, cy, ang, len] = sp(st)[0] || [st.tx, st.ty, st.aim, 600];
        const x0 = z.x, y0 = z.y, SPD = 1150, tArr = len / SPD, T = 1.6;
        addFx(st, { kind: 'dragon', x0: R0(x0), y0: R0(y0), cx: R0(cx), cy: R0(cy), a: r1(ang), len: R0(len), sp: SPD, R: 240, tArr: r1(tArr), T, dur: tArr + T + 2.2 });
        for (let d0 = 0; d0 < len; d0 += 170) later(st, d0 / SPD, api => api.line(x0 + Math.cos(ang) * d0, y0 + Math.sin(ang) * d0, x0 + Math.cos(ang) * Math.min(len, d0 + 170), y0 + Math.sin(ang) * Math.min(len, d0 + 170), 64, D * 1.6, 'earth'));
        later(st, tArr + .1, api => { bind(st, api, cx, cy, 250, T, 700, .35, D); api.shake(6); });
        later(st, tArr + T, api => {
          api.strike(cx, cy, 270, D * 3, null, 'crater'); api.world(cx, cy, 300, D * 5, 'earth'); api.shake(14);
          const trees = [];
          for (let i = 0; i < 22; i++) {
            const ta = hash(i * 3.3 + st.seed) * TAU, td = 160 + Math.sqrt(hash(i * 7.1 + st.seed)) * 340;
            trees.push([R0(cx + Math.cos(ta) * td), R0(cy + Math.sin(ta) * td), r1(td / 1400), r1(.7 + hash(i) * .5), i % 3]);
          }
          trees.sort((p, q) => p[1] - q[1]);
          addFx(st, { kind: 'trees', pts: trees, dur: 2.6, green: 1 });
        });
        later(st, tArr + T + .25, api => { api.strike(cx, cy, 520, D * 1.6, null, 'earth'); api.shake(8); });
        st.hold = tArr + T + .3;
      }
    },
    sai: {
      lions(z, st, api, D, a) {
        const x0 = z.x, y0 = z.y, SPD = 880, list = [];
        addFx(st, { kind: 'scroll', x: R0(x0), y: R0(y0), a: r1(a), len: 150, dur: 1.6 });
        for (let i = -1; i <= 1; i++) {
          const la = a + i * .2, t0 = .08 + Math.abs(i) * .1;
          list.push(['lion', R0(x0 + Math.cos(la) * 60), R0(y0 + Math.sin(la) * 60), r1(la), 800, SPD, r1(t0), 0]);
          for (let d0 = 60; d0 < 860; d0 += 160) later(st, t0 + d0 / SPD, api => api.line(x0 + Math.cos(la) * d0, y0 + Math.sin(la) * d0, x0 + Math.cos(la) * (d0 + 160), y0 + Math.sin(la) * (d0 + 160), 46, D * 1.3, null));
          later(st, t0 + 860 / SPD, api => api.strike(x0 + Math.cos(la) * 860, y0 + Math.sin(la) * 860, 90, D * .8, null, null, true));
        }
        addFx(st, { kind: 'beasts', list, dur: 2.2 });
      },
      birds(z, st, api, D) {
        const x0 = z.x, y0 = z.y, list = sp(st).map(([x, y], i) => [R0(x), R0(y), r1(.55 + i * .1)]);
        addFx(st, { kind: 'scroll', x: R0(x0), y: R0(y0), a: r1(st.aim), len: 120, dur: 1.4 });
        addFx(st, { kind: 'ibirds', x: R0(x0), y: R0(y0), list, dur: 2.6 });
        for (const [x, y, t] of list) later(st, t, api => { api.strike(x, y, 105, D * 1.45, null, 'shockwave'); api.shake(3); });
      },
      snakes(z, st, api, D, a) {
        const [tx, ty, d] = sp(st)[0] || [st.tx, st.ty, 500], x0 = z.x, y0 = z.y, SPD = 1000, list = [];
        addFx(st, { kind: 'scroll', x: R0(x0), y: R0(y0), a: r1(a), len: 120, dur: 1.8 });
        for (let i = 0; i < 4; i++) {
          const la = Math.atan2(ty - y0, tx - x0) + (i - 1.5) * .16;
          list.push(['snake', R0(x0), R0(y0), r1(la), R0(d), SPD, r1(i * .06), r1(1 + (i % 2) * .6)]);
        }
        addFx(st, { kind: 'beasts', list, dur: d / SPD + 2.4, coil: [R0(tx), R0(ty)], tc: r1(d / SPD + .2) });
        later(st, d / SPD * .5, api => api.line(x0, y0, tx, ty, 60, D * 1.1, null));
        later(st, d / SPD + .2, api => { api.strike(tx, ty, 130, D * .9, null, null, true); bind(st, api, tx, ty, 130, 1.3, 600, .3, D); });
        later(st, d / SPD + 1.5, api => { api.strike(tx, ty, 140, D * 1.7); addFx(st, { kind: 'splat', x: R0(tx), y: R0(ty), r: 150, dur: 2.4 }); });
      },
      clones(z, st, api, D) {
        const list = sp(st).map(([x, y, ang, len], i) => [R0(x), R0(y), r1(ang), R0(len), r1(.15 + i * .22)]);
        addFx(st, { kind: 'iclones', list, dur: 2.2 });
        for (const [x, y, ang, len, t0] of list) later(st, t0 + .35, api => api.line(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, 40, D * 1.35, 'blade'));
      },
      ride(z, st, api, D, a) {
        const s = sp(st), len = s[0] ? s[0][0] : 600, bombs = s.slice(1), dur = len / 720;
        addFx(st, { kind: 'splat', x: R0(z.x), y: R0(z.y), r: 110, dur: 1.6 });
        st.ridef = 1;
        startDash(z, st, a, len, dur, D * .5, 40, null, { ride: 1, lift: 74 });
        bombs.forEach(([bx, by], i) => {
          const t = (i + 1) / 5.4 * dur;
          later(st, t, api => addFx(st, { kind: 'drop', x: R0(bx), y: R0(by), h: 80, dur: .4 }));
          later(st, t + .3, api => { api.strike(bx, by, 115, D * 1.4, null, 'shockwave'); addFx(st, { kind: 'splat', x: R0(bx), y: R0(by), r: 120, dur: 1.8 }); api.shake(3); });
        });
      },
      stampede(z, st, api, D, a, ca, sa) {
        const x0 = z.x, y0 = z.y, SPD = 760, LEN = 1100, nx = -sa, ny = ca, list = [];
        addFx(st, { kind: 'scroll', x: R0(x0), y: R0(y0), a: r1(a), len: 420, wide: 1, dur: 3.6 });
        const kinds = ['lion', 'tiger', 'lion', 'wolf', 'tiger', 'lion', 'snake', 'wolf'];
        for (let w = 0; w < 3; w++) for (let i = 0; i < 6; i++) {
          const off = (i - 2.5) * 86 + (hash(w * 9 + i) - .5) * 36, t0 = w * .55 + hash(i * 3 + w) * .18;
          const k = kinds[(i + w * 3) % kinds.length];
          list.push([k, R0(x0 + nx * off + ca * 40), R0(y0 + ny * off + sa * 40), r1(a), LEN, SPD + hash(i + w) * 120, r1(t0), k === 'snake' ? 1 : 0]);
        }
        addFx(st, { kind: 'beasts', list, dur: 4, big: 1 });
        // the sky darkens with ink birds diving into the herd's path
        const birds = [];
        for (let i = 0; i < 6; i++) { const d = 300 + i * 140, o = (hash(i * 5 + st.seed) - .5) * 360; birds.push([R0(x0 + ca * d + nx * o), R0(y0 + sa * d + ny * o), r1(.7 + i * .22)]); }
        addFx(st, { kind: 'ibirds', x: R0(x0), y: R0(y0), list: birds, dur: 3.2 });
        for (const [bx, by, t] of birds) later(st, t, api => api.strike(bx, by, 100, D * 1.1, null, 'shockwave', true));
        for (let w = 0; w < 3; w++) for (let d0 = 40; d0 < LEN; d0 += 200) later(st, w * .55 + .1 + d0 / SPD, api => {
          api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * (d0 + 200), y0 + sa * (d0 + 200), 250, D * 1.05, d0 > 300 && w === 1 ? 'shockwave' : null);
        });
        later(st, 1.2 + LEN / SPD, api => {
          const ex = x0 + ca * LEN, ey = y0 + sa * LEN;
          api.strike(ex, ey, 320, D * 1.8, null, 'crater'); api.world(ex, ey, 260, D * 3, 'shockwave', a); api.shake(10);
          addFx(st, { kind: 'splat', x: R0(ex), y: R0(ey), r: 300, dur: 2.6, big: 1 });
        });
        st.hold = 2.4; api.shake(5);
      }
    },
    asuma: {
      hien(z, st, api, D, a, ca, sa) {
        const step = freeSpot(api, z.x + ca * 110, z.y + sa * 110, z.r) || z;
        z.x = step.x; z.y = step.y;
        addFx(st, { kind: 'slash', x: R0(z.x), y: R0(z.y), a: r1(a), r: 300, dur: .7, n: 2 });
        hitCone(api, z.x, z.y, a, 340, .95, D * 1.9);
        later(st, .42, api => hitCone(api, z.x, z.y, a, 340, .95, D * .8));
        api.world(z.x + ca * 220, z.y + sa * 220, 140, D * 2, 'blade', a);
        api.shake(4);
      },
      knives(z, st, api, D, a) {
        const x0 = z.x, y0 = z.y, out = .5, list = [[r1(a - .2), 700], [r1(a + .2), 700]];
        addFx(st, { kind: 'blades', x: R0(x0), y: R0(y0), list, out, dur: out * 2 + .3 });
        for (const [ba, len] of list) {
          for (let k = 0; k < 4; k++) {
            later(st, out * k / 4, api => api.line(x0 + Math.cos(ba) * len * k / 4, y0 + Math.sin(ba) * len * k / 4, x0 + Math.cos(ba) * len * (k + 1) / 4, y0 + Math.sin(ba) * len * (k + 1) / 4, 48, D * 1.05, 'blade'));
            later(st, out + out * k / 4, api => api.line(x0 + Math.cos(ba) * len * (1 - k / 4), y0 + Math.sin(ba) * len * (1 - k / 4), x0 + Math.cos(ba) * len * (1 - (k + 1) / 4), y0 + Math.sin(ba) * len * (1 - (k + 1) / 4), 48, D * .8, null));
          }
        }
        st.hold = out * 2;
      },
      ash(z, st, api, D, a) {
        const x0 = z.x, y0 = z.y, pts = [];
        for (let i = 0; i < 26; i++) {
          const d = 90 + Math.sqrt(hash(i * 3.7 + st.seed)) * 560, aa = a + (hash(i * 5.1 + st.seed) - .5) * .9 * Math.min(1, d / 200);
          pts.push([R0(x0 + Math.cos(aa) * d), R0(y0 + Math.sin(aa) * d), R0(50 + hash(i) * 40 + d * .06), r1(d / 900)]);
        }
        const IGN = 1.5;
        addFx(st, { kind: 'ash', x: R0(x0), y: R0(y0), a: r1(a), pts, ign: IGN, dur: IGN + 1.6 });
        for (let d0 = 0; d0 < 660; d0 += 165) later(st, IGN + d0 / 1300, api => {
          const half = .46;
          for (const q of pts) { const dq = Math.hypot(q[0] - x0, q[1] - y0); if (dq >= d0 && dq < d0 + 165) api.strike(q[0], q[1], q[2] * 1.2, D * 2.3, null, 'fire', true); }
          api.shake(4);
        });
        later(st, IGN + .6, api => api.world(x0 + Math.cos(a) * 420, y0 + Math.sin(a) * 420, 200, D * 3, 'fire', a));
        st.hold = IGN + .2;
      },
      combo(z, st, api, D) {
        const s = sp(st);
        const go = i => {
          if (i >= s.length) return;
          const [x1, y1] = s[i], ang = Math.atan2(y1 - z.y, x1 - z.x), len = Math.hypot(x1 - z.x, y1 - z.y);
          startDash(z, st, ang, len, .15, D * 1.35, 70, api => {
            addFx(st, { kind: 'slash', x: R0(z.x), y: R0(z.y), a: r1(ang), r: 170, dur: .45, n: 1 });
            hitCone(api, z.x, z.y, ang, 190, 1.1, D * .5);
            api.world(z.x, z.y, 90, D * 1.5, 'blade', ang);
            st.hold = .2; later(st, .2, () => go(i + 1));
          }, { rgb: '170,230,255' });
        };
        go(1);
        st.hold = .3;
      },
      vacuum(z, st, api, D, a, ca, sa) {
        const x0 = z.x, y0 = z.y, SPD = 2600, LEN = 1080;
        addFx(st, { kind: 'gust', x: R0(x0), y: R0(y0), a: r1(a), len: LEN, sp: SPD, dur: LEN / SPD + .7 });
        for (let d0 = 0; d0 < LEN; d0 += 180) later(st, d0 / SPD, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * (d0 + 180), y0 + sa * (d0 + 180), 54, D * 2, 'blade'));
        api.shake(4);
      },
      ult(z, st, api, D) {
        const [cx, cy, ang, d] = sp(st)[0] || [st.tx, st.ty, st.aim, 400];
        const x0 = z.x, y0 = z.y, pts = [];
        for (let i = 0; i < 30; i++) {
          const ta = hash(i * 2.9 + st.seed) * TAU, td = Math.sqrt(hash(i * 6.3 + st.seed)) * 420;
          pts.push([R0(cx + Math.cos(ta) * td), R0(cy + Math.sin(ta) * td), R0(60 + hash(i * 1.7) * 50), r1(.1 + td / 900)]);
        }
        const IGN = 1.25;
        addFx(st, { kind: 'ash', x: R0(x0), y: R0(y0), a: r1(ang), pts, ign: IGN, dur: IGN + 2, big: 1 });
        later(st, IGN - .35, api => {
          // the Hien dash through the cloud lights it
          const len = d + 380;
          startDash(z, st, ang, len, .3, D * 2, 90, null, { rgb: '255,200,140' });
          addFx(st, { kind: 'gust', x: R0(z.x), y: R0(z.y), a: r1(ang), len: R0(len), sp: len / .3, dur: 1.1, hot: 1 });
        });
        for (let k = 0; k < 4; k++) later(st, IGN + k * .16, api => {
          for (const q of pts) { const dq = Math.hypot(q[0] - cx, q[1] - cy); if (dq >= k * 110 && dq < (k + 1) * 110) api.strike(q[0], q[1], q[2] * 1.25, D * 2.6, null, 'fire', true); }
          api.shake(6 + k * 2);
        });
        later(st, IGN + .7, api => { api.strike(cx, cy, 440, D * 1.2, null, 'crater'); api.world(cx, cy, 380, D * 5, 'fire'); api.shake(14); addFx(st, { kind: 'boom', x: R0(cx), y: R0(cy), r: 440, dur: 1.8 }); });
        st.hold = IGN + .5;
      }
    },
    kurenai: {
      petals(z, st, api, D) {
        const [cx, cy] = sp(st)[0] || [st.tx, st.ty], T = 2.8;
        addFx(st, { kind: 'stream', x0: R0(z.x), y0: R0(z.y), x1: R0(cx), y1: R0(cy), dur: .9 });
        addFx(st, { kind: 'field', x: R0(cx), y: R0(cy), r: 250, t0: .35, dur: T + .8 });
        let k = .5;
        const v = victim(api, cx, cy, 300);
        const fx = addFx(st, { kind: 'none', dur: T + .35 });
        fx.upd = (f, dt, api) => {
          if (f.age < .35) return;
          // the petals cling and drag (a heavy slow toward the swirl) and cut
          if (v && Math.hypot(v.x - cx, v.y - cy) < 250 + (v.r || 12)) drag(api, v, cx, cy, 110, dt);
          if ((k -= dt) <= 0) { k = .45; api.strike(cx, cy, 250, D * .42, null, null, true); }
        };
      },
      tree(z, st, api, D) {
        const [cx, cy] = sp(st)[0] || [st.tx, st.ty], T = 1.5;
        addFx(st, { kind: 'ktree', x: R0(cx), y: R0(cy), T, dur: T + 1.4 });
        later(st, .2, api => { api.strike(cx, cy, 135, D * .7, null, 'earth', true); bind(st, api, cx, cy, 135, T, 700, .25, D); });
        // she sinks into petals and steps out of the trunk behind the victim
        later(st, .35, api => { addFx(st, { kind: 'poofp', x: R0(z.x), y: R0(z.y), dur: .9 }); st.vanish = T - .2; });
        later(st, T - .15, api => {
          const s = freeSpot(api, cx - 46, cy - 8, z.r);
          if (s) { z.x = s.x; z.y = s.y; }
          z.angle = 0; st.vanish = 0;
          addFx(st, { kind: 'poofp', x: R0(z.x), y: R0(z.y), dur: .8 });
        });
        later(st, T, api => { api.strike(cx, cy, 140, D * 2.6, null, 'blade'); api.shake(6); addFx(st, { kind: 'cut', x: R0(cx), y: R0(cy), dur: .5 }); });
        st.hold = T + .1;
      },
      copies(z, st, api, D) {
        const s = sp(st), list = s.slice(1).map(([x, y, ang], i) => [R0(x), R0(y), r1(ang), r1(.1 + i * .16)]);
        addFx(st, { kind: 'kcopies', list, dur: 2.3 });
        for (const [x, y, ang, t0] of list) for (let j = -1; j <= 1; j++) {
          const ka = ang + j * .12;
          later(st, t0 + .45, api => api.line(x, y, x + Math.cos(ka) * 260, y + Math.sin(ka) * 260, 24, D * .62, null));
          later(st, t0 + .6, api => api.line(x + Math.cos(ka) * 260, y + Math.sin(ka) * 260, x + Math.cos(ka) * 470, y + Math.sin(ka) * 470, 24, D * .62, null));
        }
      },
      vines(z, st, api, D) {
        const list = [];
        for (let i = 0; i < 9; i++) list.push([r1(i * TAU / 9 + st.seed), R0(300 + hash(i) * 60)]);
        addFx(st, { kind: 'vines', x: R0(z.x), y: R0(z.y), list, dur: 1.3 });
        later(st, .12, api => { api.knockback(z, 340, 210, D * 1.5); api.world(z.x, z.y, 300, D * 2, 'earth'); api.shake(5); });
      },
      blink(z, st, api, D) {
        const [cx, cy, ang] = sp(st)[0] || [st.tx, st.ty, st.aim];
        addFx(st, { kind: 'poofp', x: R0(z.x), y: R0(z.y), dur: .9 });
        st.vanish = .32;
        later(st, .3, api => {
          const s = freeSpot(api, cx + Math.cos(ang) * 80, cy + Math.sin(ang) * 80, z.r);
          if (s) { z.x = s.x; z.y = s.y; }
          z.angle = ang + Math.PI;
          addFx(st, { kind: 'poofp', x: R0(z.x), y: R0(z.y), dur: .8 });
        });
        later(st, .42, api => { api.strike(cx, cy, 125, D * 1.9, null, 'blade'); addFx(st, { kind: 'cut', x: R0(cx), y: R0(cy), dur: .5 }); api.shake(4); });
        st.hold = .5;
      },
      garden(z, st, api, D) {
        const [cx, cy] = sp(st)[0] || [st.tx, st.ty], T = 3.6;
        addFx(st, { kind: 'world', x: R0(cx), y: R0(cy), r: 580, dur: T + 1 });
        addFx(st, { kind: 'field', x: R0(cx), y: R0(cy), r: 560, t0: .1, dur: T + .8, big: 1 });
        let k = .5;
        const fx = addFx(st, { kind: 'none', dur: T });
        fx.upd = (f, dt, api) => { if ((k -= dt) <= 0) { k = .5; api.strike(cx, cy, 560, D * .26, null, null, true); } };
        // trees burst up under the victim, one after another
        for (let i = 0; i < 4; i++) later(st, .3 + i * .7, api => {
          const v = victim(api, cx, cy, 620);
          let tx = cx, ty = cy;
          if (v && Math.hypot(v.x - cx, v.y - cy) < 600) { tx = v.x; ty = v.y; }
          else { const ta = hash(i * 4 + st.seed) * TAU; tx = cx + Math.cos(ta) * 220; ty = cy + Math.sin(ta) * 220; }
          addFx(st, { kind: 'ktree', x: R0(tx), y: R0(ty), T: .8, dur: 2.2, small: 1 });
          later(st, .2, api => { api.strike(tx, ty, 120, D * .9, null, 'earth', true); bind(st, api, tx, ty, 120, .7, 700); });
        });
        later(st, T, api => {
          api.strike(cx, cy, 580, D * 2.2, null, 'shockwave'); api.world(cx, cy, 300, D * 3, 'shockwave'); api.shake(12);
          addFx(st, { kind: 'bloom', x: R0(cx), y: R0(cy), r: 580, dur: 1.6 });
        });
        st.hold = T + .1;
      }
    }
  };
  // Wedge hit: strike circles tiling the cone (the victim's hit invulnerability keeps it to one hit).
  function hitCone(api, x, y, a, r, half, dmg) {
    if (!dmg) return;
    for (let d = 60; d <= r; d += 100) {
      const n = Math.max(1, Math.ceil(2 * half * d / 120));
      for (let i = 0; i < n; i++) { const aa = a + (n === 1 ? 0 : (i / (n - 1) - .5) * 2 * half * .92); api.strike(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 64, dmg, null, null, true); }
    }
  }

  // ------------------------------------------------------------------ update
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
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.lift = 0; st.vanish = 0; st.hold = 0;
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.vanish = Math.max(0, st.vanish - dt);
    // bake this fighter's cached art one piece per frame so the first cast does not hitch
    const warm = WARM[z.bossId];
    if (warm && (st.warm || 0) < warm.length && Kit()) { const i = st.warm || 0; st.warm = i + 1; warm[i](); }
    z.armorScale = m.armor || 1;
    z.kageDash = 0;
    if (st.dash) {
      const ds = st.dash;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (ds.ride) {
        // on the giant ink bird: flies over walls and houses
        const k = 1 - ds.left / ds.dur;
        st.lift = ds.lift * Math.min(1, Math.min(k, 1 - k) * 6);
        z.x = nx; z.y = ny;
      } else if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if (!ds.ride && (ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      const tr = st.fx.find(f => f.kind === 'trail' && f.a === ds.a && f.age < f.dur - .3);
      if (tr) { tr.x1 = R0(z.x); tr.y1 = R0(z.y); }
      if (ds.left <= 0) {
        const end = ds.end; st.dash = null; st.lift = 0;
        if (ds.ride) { const s = freeSpot(api, z.x, z.y, z.r); if (s) { z.x = s.x; z.y = s.y; } addFx(st, { kind: 'splat', x: R0(z.x), y: R0(z.y), r: 130, dur: 1.6 }); }
        if (end) end(api);
      }
    }
    if (st.vanish > 0) z.kageDash = Math.max(z.kageDash, .05);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = ''; st.tele = [];
      }
    } else if (!st.dash && st.hold <= 0) {
      if (z.manual) {
        // driven by the user: only what was asked for, aimed at the cursor
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, api, want);
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, api);
      }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash;
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ------------------------------------------------------------------ cached art
  const WOOD = ['#2a160a', '#8a5a32', '#c48d55', '#5e3a1e'];
  function stakeSpr(v) {
    return Kit().sprite('jn:stake' + v, 48, 180, g => {
      const cx = 24, base = 176, tip = 6 + v * 3, w = 15 + v;
      const lean = (v - 1.5) * 2.2;
      const path = (o) => { g.beginPath(); g.moveTo(cx - w - o, base); g.quadraticCurveTo(cx - w * .7 - o + lean, 90, cx + lean * 2, tip - o); g.quadraticCurveTo(cx + w * .7 + o + lean, 90, cx + w + o, base); g.closePath(); };
      path(2.5); g.fillStyle = WOOD[0]; g.fill();
      path(0); const gr = g.createLinearGradient(cx - w, 0, cx + w, 0);
      gr.addColorStop(0, '#5a3418'); gr.addColorStop(.35, '#9a6638'); gr.addColorStop(.62, '#c8925a'); gr.addColorStop(1, '#6a4020');
      g.fillStyle = gr; g.fill();
      g.save(); path(0); g.clip();
      g.strokeStyle = 'rgba(40,20,8,.55)'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const x = cx - w * .7 + i * w * .35; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean, 100, cx + lean * 2 + (i - 2) * 1.5, tip + 20); g.stroke(); }
      g.strokeStyle = 'rgba(255,230,180,.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx + w * .25, base); g.quadraticCurveTo(cx + w * .2 + lean, 90, cx + lean * 2 + 2, tip + 14); g.stroke();
      g.fillStyle = '#3a2210'; g.beginPath(); g.ellipse(cx - 3, 120 - v * 10, 3, 4.5, 0, 0, TAU); g.fill();
      g.restore();
      // a twig stub
      g.strokeStyle = WOOD[0]; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + w * .6, 110); g.lineTo(cx + w + 8, 96 - v * 4); g.stroke();
      g.strokeStyle = '#8a5a32'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx + w * .6, 110); g.lineTo(cx + w + 7, 96 - v * 4); g.stroke();
    });
  }
  function canopy(g, x, y, r, pal, seed) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + hash(i * 2.3 + seed) * .5, d = r * (.32 + .3 * hash(i * 4.1 + seed));
      const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * .6, rr = r * (.36 + hash(i * 1.9 + seed) * .2);
      g.fillStyle = pal[0]; g.beginPath(); g.arc(cx, cy, rr + 3, 0, TAU); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + hash(i * 2.3 + seed) * .5, d = r * (.32 + .3 * hash(i * 4.1 + seed));
      const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * .6, rr = r * (.36 + hash(i * 1.9 + seed) * .2);
      g.fillStyle = pal[1]; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
      g.fillStyle = pal[2]; g.beginPath(); g.arc(cx - rr * .25, cy - rr * .3, rr * .6, 0, TAU); g.fill();
    }
    for (let i = 0; i < 30; i++) {
      const a = hash(i * 3.1 + seed) * TAU, d = Math.sqrt(hash(i * 5.3 + seed)) * r * .9;
      g.fillStyle = i % 3 ? pal[3] : pal[0];
      g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, 4, 2.4, a, 0, TAU); g.fill();
    }
  }
  const TREE_PAL = { green: ['#1f4a1c', '#3d8a33', '#6fbf4a', 'rgba(200,255,150,.55)'], red: ['#4a0c1e', '#a3203e', '#e0506e', 'rgba(255,200,215,.7)'] };
  function treeSpr(kind, v) {
    return Kit().sprite('jn:tree' + kind + v, 200, 300, g => {
      const x = 100, y = 292, h = 200 + v * 18, tw = 15 + v * 2, lean = (v - 1) * 14;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const trunk = (o, col) => {
        g.fillStyle = col; g.beginPath();
        g.moveTo(x - tw * 1.6 - o, y + 2); g.quadraticCurveTo(x - tw * .7 - o, y - h * .4, x + lean - tw * .45 - o, y - h);
        g.lineTo(x + lean + tw * .45 + o, y - h); g.quadraticCurveTo(x + tw * .7 + o, y - h * .4, x + tw * 1.6 + o, y + 2); g.closePath(); g.fill();
      };
      const dark = kind === 'red' ? '#24101a' : WOOD[0], mid = kind === 'red' ? '#5a2a30' : WOOD[1], hi = kind === 'red' ? '#8a4a4a' : WOOD[2];
      trunk(3, dark); trunk(0, mid);
      g.fillStyle = hi; g.beginPath(); g.moveTo(x + tw * .2, y); g.quadraticCurveTo(x + tw * .3, y - h * .4, x + lean + tw * .25, y - h); g.lineTo(x + lean + tw * .05, y - h); g.quadraticCurveTo(x, y - h * .4, x - tw * .15, y); g.fill();
      // twisting branches
      for (let i = 0; i < 5; i++) {
        const t = .42 + i * .11, bx = x + lean * t, by = y - h * t, s = i % 2 ? 1 : -1, L = 46 + hash(i + v) * 30;
        g.strokeStyle = dark; g.lineWidth = 9 - i; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + s * L * .5, by - 10, bx + s * L, by - 30 - i * 4); g.stroke();
        g.strokeStyle = mid; g.lineWidth = 5.5 - i * .7; g.stroke();
      }
      // roots
      for (let i = -1; i <= 1; i += 2) { g.strokeStyle = dark; g.lineWidth = 8; g.beginPath(); g.moveTo(x, y - 10); g.quadraticCurveTo(x + i * tw * 2, y - 4, x + i * tw * 3.2, y + 4); g.stroke(); g.strokeStyle = mid; g.lineWidth = 4.5; g.stroke(); }
      canopy(g, x + lean, y - h - 14, 62 + v * 6, TREE_PAL[kind], v * 3.1 + (kind === 'red' ? 7 : 0));
    });
  }
  function houseSpr() {
    return Kit().sprite('jn:house', 240, 230, g => {
      g.lineJoin = 'round';
      const O = '#2a160a';
      // walls: two storeys of pale timber panels framed in dark beams
      const wall = (x, y, w, h) => {
        g.fillStyle = O; g.fillRect(x - 3, y - 3, w + 6, h + 6);
        const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#b88a58'); gr.addColorStop(.5, '#e0b47a'); gr.addColorStop(1, '#a87a4a');
        g.fillStyle = gr; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(70,40,18,.45)'; g.lineWidth = 1.2;
        for (let yy = y + 8; yy < y + h; yy += 9) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
        g.fillStyle = '#5a3418'; for (const bx of [x, x + w / 2 - 4, x + w - 8]) g.fillRect(bx, y, 8, h);
      };
      wall(36, 128, 168, 98);
      wall(60, 62, 120, 66);
      // windows
      g.fillStyle = '#2a1a10';
      for (const [wx, wy] of [[56, 150], [148, 150], [82, 82], [134, 82]]) { g.fillRect(wx, wy, 26, 22); g.fillStyle = '#f0d9a8'; g.fillRect(wx + 3, wy + 3, 9, 16); g.fillRect(wx + 14, wy + 3, 9, 16); g.fillStyle = '#2a1a10'; }
      // door
      g.fillStyle = '#3a2210'; g.fillRect(104, 176, 32, 50);
      // roofs: dark tiles with a light ridge
      const roof = (x, y, w, h) => {
        g.fillStyle = O; g.beginPath(); g.moveTo(x - 14, y + h); g.lineTo(x + w * .18, y); g.lineTo(x + w * .82, y); g.lineTo(x + w + 14, y + h); g.closePath(); g.fill();
        g.fillStyle = '#4a5a52'; g.beginPath(); g.moveTo(x - 9, y + h - 3); g.lineTo(x + w * .2, y + 3); g.lineTo(x + w * .8, y + 3); g.lineTo(x + w + 9, y + h - 3); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(20,30,26,.6)'; g.lineWidth = 1.4;
        for (let i = 1; i < 10; i++) { const t = i / 10; g.beginPath(); g.moveTo(x + w * (.2 + .6 * t), y + 4); g.lineTo(x - 8 + (w + 16) * t, y + h - 4); g.stroke(); }
        g.fillStyle = '#9aaaa0'; g.fillRect(x + w * .2, y, w * .6, 4);
      };
      roof(28, 106, 184, 30); roof(52, 30, 136, 36);
      g.fillStyle = O; g.fillRect(114, 14, 12, 18);
    });
  }
  // Ink beasts: black brush silhouettes with a cold sheen and white brush highlights (side view, facing right).
  const INK = '#0b0b12';
  function sheen(g, w, h) {
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(120,130,190,.55)'); gr.addColorStop(.45, 'rgba(40,44,70,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
  function stroke(g, pts, w, col) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  function beastSpr(type) {
    return Kit().sprite('jn:ink:' + type, 180, 120, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const lion = type === 'lion', tiger = type === 'tiger', wolf = type === 'wolf';
      const blob = (x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); };
      // far legs (a shade lighter so the gallop reads)
      stroke(g, [[118, 60], [140, 74], [158, 70]], 9, '#262a40');
      stroke(g, [[54, 58], [36, 72], [20, 72]], 10, '#262a40');
      // tail
      stroke(g, [[40, 50], [10, 44], [12, 16]], wolf ? 9 : 6, INK);
      g.fillStyle = INK;
      if (lion) blob(12, 14, 8, 9);
      if (wolf) blob(18, 34, 10, 7, -.9);
      // body: haunch, torso, chest, neck, head
      blob(52, 50, 24, 19, -.2); blob(84, 48, 36, 16, -.04); blob(114, 48, 20, 19);
      g.beginPath(); g.moveTo(108, 34); g.quadraticCurveTo(128, 26, 142, 34); g.lineTo(146, 54); g.quadraticCurveTo(126, 62, 112, 60); g.closePath(); g.fill();
      if (lion) {
        // mane: a ring of brush flames round the neck
        g.beginPath();
        for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, r = (i % 2 ? 18 : 31) + hash(i) * 4; g.lineTo(132 + Math.cos(a) * r, 42 + Math.sin(a) * r * .95); }
        g.closePath(); g.fill();
      }
      blob(146, 40, wolf ? 14 : 16, wolf ? 11 : 13, -.1);
      // snout + open jaw
      g.beginPath(); g.moveTo(150, 32); g.lineTo(wolf ? 176 : 170, 40); g.lineTo(wolf ? 174 : 168, 47); g.lineTo(152, 50); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(150, 50); g.lineTo(wolf ? 172 : 166, 57); g.lineTo(150, 58); g.closePath(); g.fill();
      if (!lion) { g.beginPath(); g.moveTo(136, 32); g.lineTo(wolf ? 138 : 140, wolf ? 12 : 20); g.lineTo(148, 30); g.closePath(); g.fill(); }
      // near legs: front reaching forward, hind kicking back
      stroke(g, [[116, 58], [134, 82], [156, 86]], 11, INK);
      stroke(g, [[56, 58], [48, 84], [26, 96]], 12, INK);
      blob(158, 86, 6, 4); blob(24, 97, 6, 4);
      // ink drips off the belly
      for (let i = 0; i < 4; i++) { const x = 66 + i * 14; g.beginPath(); g.moveTo(x - 3, 60); g.quadraticCurveTo(x, 70 + i % 2 * 6, x + 3, 60); g.fill(); }
      sheen(g, 180, 120);
      // white brush highlights
      g.strokeStyle = 'rgba(245,247,255,.9)'; g.lineWidth = 2;
      stroke(g, [[40, 38], [80, 28], [118, 34]], 2.2, 'rgba(245,247,255,.9)');
      stroke(g, [[120, 62], [132, 80], [150, 84]], 1.6, 'rgba(245,247,255,.7)');
      stroke(g, [[52, 64], [46, 84], [30, 93]], 1.6, 'rgba(245,247,255,.7)');
      stroke(g, [[150, 36], [166, 41]], 1.6, 'rgba(245,247,255,.8)');
      if (tiger) for (let i = 0; i < 6; i++) stroke(g, [[52 + i * 13, 34], [48 + i * 13 + 6, 46], [54 + i * 13, 58]], 2.4, 'rgba(245,247,255,.85)');
      if (lion) for (let i = 0; i < 7; i++) { const a = -2.4 + i * .62; stroke(g, [[132 + Math.cos(a) * 14, 42 + Math.sin(a) * 14], [132 + Math.cos(a) * 26, 42 + Math.sin(a) * 25]], 1.8, 'rgba(245,247,255,.75)'); }
      if (wolf) for (let i = 0; i < 4; i++) stroke(g, [[118 + i * 6, 30], [114 + i * 6, 40]], 1.6, 'rgba(245,247,255,.7)');
      // eye and fangs
      g.fillStyle = '#ffffff'; blob(150, 36, 3.6, 2.2, -.3);
      g.fillStyle = '#c8203a'; blob(151, 36, 1.3, 1.3);
      g.fillStyle = '#ffffff';
      for (const x of [156, 162]) { g.beginPath(); g.moveTo(x, 48); g.lineTo(x + 2, 53); g.lineTo(x + 4, 48); g.fill(); }
    });
  }
  // Ink bird seen from above (facing right): swept wings with feather fingers, forked tail.
  function birdSpr() {
    return Kit().sprite('jn:ink:birdtop', 120, 100, g => {
      g.lineJoin = 'round'; g.lineCap = 'round'; g.fillStyle = INK;
      const wing = s => {
        g.beginPath(); g.moveTo(70, 50 - 4 * s);
        for (const [x, y] of [[60, 34], [50, 18], [42, 4], [37, 13], [31, 6], [28, 17], [21, 13], [22, 25], [15, 24], [24, 36], [44, 46]]) g.lineTo(x, 50 + (y - 50) * s);
        g.closePath(); g.fill();
      };
      wing(1); wing(-1);
      g.beginPath(); g.ellipse(64, 50, 30, 8.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(94, 50, 8, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(100, 45); g.lineTo(114, 50); g.lineTo(100, 55); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(38, 46); g.lineTo(12, 36); g.lineTo(22, 50); g.lineTo(12, 64); g.lineTo(38, 54); g.closePath(); g.fill();
      sheen(g, 120, 100);
      for (const s of [1, -1]) {
        stroke(g, [[66, 50 - 6 * s], [52, 50 - 26 * s], [42, 50 - 44 * s]], 2, 'rgba(245,247,255,.85)');
        stroke(g, [[56, 50 - 6 * s], [40, 50 - 20 * s], [28, 50 - 32 * s]], 1.4, 'rgba(245,247,255,.6)');
      }
      stroke(g, [[44, 50], [86, 49]], 1.8, 'rgba(245,247,255,.7)');
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(96, 47, 2.2, 0, TAU); g.fill();
    });
  }
  function petalSpr(v) {
    return Kit().sprite('jn:petal' + v, 18, 12, g => {
      const c = ['#ff4f74', '#ff86a2', '#d8204a', '#ffc0cf'][v];
      g.fillStyle = 'rgba(60,0,16,.75)'; g.beginPath(); g.ellipse(9, 6, 8.4, 5.2, 0, 0, TAU); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(2, 6); g.quadraticCurveTo(8, -1, 16, 4); g.quadraticCurveTo(13, 6, 16, 8); g.quadraticCurveTo(8, 13, 2, 6); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(8, 4.4, 3.4, 1.2, -.2, 0, TAU); g.fill();
    });
  }
  function splatSpr(v) {
    return Kit().sprite('jn:splat' + v, 160, 160, g => {
      g.fillStyle = '#0c0c14';
      g.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = i / 24 * TAU, r = 46 + hash(i * 3.7 + v) * 22 + (i % 3 === 0 ? 12 : 0);
        if (i) g.lineTo(80 + Math.cos(a) * r, 80 + Math.sin(a) * r); else g.moveTo(80 + r, 80);
      }
      g.closePath(); g.fill();
      for (let i = 0; i < 12; i++) {
        const a = hash(i * 5.1 + v) * TAU, d = 62 + hash(i * 2.2 + v) * 14, r = 2 + hash(i + v) * 5;
        g.beginPath(); g.arc(80 + Math.cos(a) * d, 80 + Math.sin(a) * d, r, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(90,100,150,.45)'; g.beginPath(); g.ellipse(70, 66, 26, 14, -.4, 0, TAU); g.fill();
    });
  }
  // Sai's ink clone: his own sprite rendered in ink (cached per frame / facing).
  function inkClone(frame, flip) {
    return Kit().sprite('jn:inkclone:' + frame + (flip ? 'm' : ''), 130, 160, g => {
      if (!AS || !AS.has('sai')) return;
      g.filter = 'grayscale(1) brightness(.42) contrast(1.7)';
      AS.draw(g, 'sai', 65, 150, { frame, facing: flip ? -1 : 1, seed: 0 });
      g.filter = 'none';
    });
  }

  // ------------------------------------------------------------------ shared pieces
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
      const ch = Math.min(s.w * .5, 22);
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -ch); ctx.lineTo(d, 0); ctx.lineTo(d - 16, ch); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = 'rgba(24,12,8,.15)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
    }
    ctx.restore();
  }
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .5) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
    }
  }
  function impactO(ctx, x, y, r, t, seed, rgb, debrisCol = '#3a2c22') {
    const K = Kit();
    if (t < 0) return;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) K.glow(ctx, x, y - 10, r * (.6 + t * 2), rgb, (1 - t / .35) * .9, true, .7);
    K.fx.shockRing(ctx, x, y, r * 1.1, t * 1.4, Math.max(0, 1 - t * 1.2), rgb);
    ctx.globalCompositeOperation = 'source-over';
    dustRing(ctx, x, y, r, t, seed, 12);
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.1, t / 1.1, seed, debrisCol, 12);
  }
  function crackG(ctx, x, y, r, alpha, seed, col = '40,24,12') {
    if (alpha <= .01) return;
    ctx.fillStyle = `rgba(${col},${.3 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, r * .8, r * .42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${.75 * alpha})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = hash(i * 4.7 + seed) * TAU, b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(a) * r * .4, y + Math.sin(a) * r * .2);
      ctx.lineTo(x + Math.cos(b) * r * .8, y + Math.sin(b) * r * .4);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * .58);
    }
    ctx.stroke();
  }
  function crescent(ctx, cx, cy, R, w, a0, a1, sq) {
    const n = 18;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const an = a0 + (a1 - a0) * i / n; ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * sq); }
    for (let i = n; i >= 0; i--) { const u = i / n, an = a0 + (a1 - a0) * u, prof = Math.sin(Math.PI * u); ctx.lineTo(cx + Math.cos(an) * (R - w * prof), cy + Math.sin(an) * (R - w * prof) * sq); }
    ctx.closePath();
  }
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255', lift = 34) {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .85})` : `rgba(20,24,40,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - lift); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - lift);
      }
      ctx.stroke();
    }
  }
  function puffBurst(ctx, x, y, r, t, seed, kind, n = 10, a0 = 1) {
    const K = Kit(), pf = K.puff(kind), e = easeOut(t / .6), a = (1 - win(t, .35, 1)) * a0;
    if (a <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .5, d = r * (.15 + e * (.5 + hash(i * 2.1 + seed) * .3));
      K.stamp(ctx, pf, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - r * .25 - e * r * .2 * hash(i * 3 + seed), r * (.22 + e * .2), a * .9);
    }
  }
  // Tapered wooden tube between two screen points (outline, bark, lit strip, grain).
  function woodBeam(ctx, x0, y0, x1, y1, w0, w1, pointed) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const quad = (o, a0, a1, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x0 + nx * (w0 * a0 + o), y0 + ny * (w0 * a0 + o));
      if (pointed) ctx.lineTo(x1 + dx / L * (o + 2), y1 + dy / L * (o + 2)); else ctx.lineTo(x1 + nx * (w1 * a0 + o), y1 + ny * (w1 * a0 + o));
      if (!pointed) ctx.lineTo(x1 + nx * (w1 * a1 - o), y1 + ny * (w1 * a1 - o));
      ctx.lineTo(x0 + nx * (w0 * a1 - o), y0 + ny * (w0 * a1 - o)); ctx.closePath(); ctx.fill();
    };
    quad(2.5, -.5, .5, WOOD[0]); quad(0, -.5, .5, WOOD[1]); quad(0, -.5, -.1, WOOD[2]); quad(0, .25, .5, WOOD[3]);
    ctx.strokeStyle = 'rgba(40,20,8,.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const o of [-.2, .12, .35]) { ctx.moveTo(x0 + nx * w0 * o, y0 + ny * w0 * o); ctx.lineTo(x0 + dx * .92 + nx * w1 * o * .6, y0 + dy * .92 + ny * w1 * o * .6); }
    ctx.stroke();
  }
  const DPX = new Float32Array(64), DPY = new Float32Array(64), DPH = new Float32Array(64), DPB = new Uint8Array(64);

  // ------------------------------------------------------------------ FX painters [ground, overlay]
  const FX = {
    none: [null, null],
    trail: [null, (ctx, fx) => { const a = 1 - win(fx.age, fx.dur - .4, fx.dur); speedLines(ctx, fx.x0, fx.y0, fx.x1, fx.y1, 26, a * .9, fx.seed, fx.rgb, LIFT + 8); }],
    // ---- Yamato
    stakes: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .5, fx.dur);
      ctx.fillStyle = `rgba(40,22,10,${.32 * a})`;
      for (const p of fx.pts) { if (fx.age < p[2]) continue; ctx.beginPath(); ctx.ellipse(p[0], p[1] + 2, p[4] * 1.3, p[4] * .55, 0, 0, TAU); ctx.fill(); }
    }, (ctx, fx) => {
      const K = Kit(), dust = K.puff('dust'), end = fx.dur - .55;
      for (const p of fx.pts) {
        const u = fx.age - p[2]; if (u < 0) continue;
        const k = easeOut(u / .16) * (1 - easeIn((fx.age - end) / .5)), spr = stakeSpr(p[6]);
        if (k <= .01) continue;
        const h = p[3], w = p[4] * 2.2, vis = h * k;
        ctx.save(); ctx.translate(p[0], p[1] + 3); ctx.rotate(p[5]);
        ctx.drawImage(spr, 0, 0, 48, 180 * k, -w / 2, -vis, w, vis);
        ctx.restore();
        if (u < .5) K.stamp(ctx, dust, p[0] + (hash(p[0]) - .5) * 20, p[1] - 6, 14 + u * 30, (1 - u / .5) * .7, .7);
      }
    }],
    beams: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
      ctx.strokeStyle = `rgba(40,22,10,${.3 * a})`; ctx.lineCap = 'round';
      for (const [ba, bl, dl] of fx.beams) {
        const k = easeOut((fx.age - dl) / .22) * (1 - easeIn((fx.age - fx.dur + .5) / .5)); if (k <= 0) continue;
        ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(ba) * bl * k, fx.y + Math.sin(ba) * bl * k); ctx.stroke();
      }
    }, (ctx, fx) => {
      const K = Kit(), dust = K.puff('dust');
      const list = fx.beams.slice().sort((p, q) => Math.sin(p[0]) - Math.sin(q[0]));
      for (const [ba, bl, dl] of list) {
        const u = fx.age - dl, k = easeOut(u / .22) * (1 - easeIn((fx.age - fx.dur + .5) / .5)); if (k <= 0) continue;
        const ca = Math.cos(ba), sa = Math.sin(ba), h0 = LIFT + 10, L = bl * k;
        const x0 = fx.x + ca * 16, y0 = fx.y + sa * 16 - h0, x1 = fx.x + ca * L, y1 = fx.y + sa * L - h0 * .7;
        woodBeam(ctx, x0, y0, x1, y1, 54, 26, true);
        // a few side shoots
        for (let i = 1; i <= 3; i++) {
          const t = i / 4, bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t, s = i % 2 ? 1 : -1;
          woodBeam(ctx, bx, by, bx - sa * 26 * s + ca * 18, by + ca * 26 * s + sa * 18 - 8, 10, 4, true);
        }
        if (u > .18 && u < .9) { const e = (u - .18) / .72; K.stamp(ctx, dust, fx.x + ca * bl, fx.y + sa * bl - 10, 30 + e * 40, (1 - e) * .8, .7); K.fx.debris(ctx, fx.x + ca * bl, fx.y + sa * bl, 90, e, fx.seed + ba, '#6a4422', 8); }
      }
    }],
    cage: [(ctx, fx, time) => {
      const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
      crackG(ctx, fx.x, fx.y, fx.r * 1.2, a * Math.min(1, fx.age * 5), fx.seed);
      cagePosts(ctx, fx, time, false);
    }, (ctx, fx, time) => cagePosts(ctx, fx, time, true)],
    house: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
      crackG(ctx, fx.x, fx.y, 210, a * Math.min(1, fx.age * 6), fx.seed);
      ctx.fillStyle = `rgba(30,16,8,${.35 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, 120, 40, 0, 0, TAU); ctx.fill();
    }, (ctx, fx) => {
      const K = Kit(), spr = houseSpr(), k = easeOut(fx.age / .3) * (1 - easeIn((fx.age - fx.dur + .7) / .7));
      if (k > .01) ctx.drawImage(spr, 0, 0, 240, 230 * k, fx.x - 120, fx.y + 12 - 230 * k, 240, 230 * k);
      dustRing(ctx, fx.x, fx.y, 260, fx.age, fx.seed, 14, 'dust', .7);
      if (fx.age < 1.2) K.fx.debris(ctx, fx.x, fx.y, 240, fx.age / 1.2, fx.seed, '#6a4422', 14);
      if (fx.age < .5) { ctx.globalCompositeOperation = 'lighter'; K.fx.shockRing(ctx, fx.x, fx.y, 260, fx.age * 2, 1 - fx.age * 2, '230,200,140'); ctx.globalCompositeOperation = 'source-over'; }
      if (fx.age > fx.dur - .7) dustRing(ctx, fx.x, fx.y, 200, fx.age - fx.dur + .7, fx.seed + 3, 10, 'dust', .6);
    }],
    wclones: [(ctx, fx) => {
      for (const [x, y, ang, t0] of fx.list) {
        const u = fx.age - t0; if (u < 0) continue;
        const a = 1 - win(u, 1.4, 1.9);
        // the stump the clone grew out of
        ctx.fillStyle = `rgba(40,22,10,${.4 * a})`; ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(138,90,50,${.9 * a})`; ctx.beginPath(); ctx.ellipse(x, y, 18, 7, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(60,34,16,${a})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, TAU); ctx.stroke();
      }
    }, (ctx, fx) => {
      const K = Kit();
      for (const [x, y, ang, t0] of fx.list) {
        const u = fx.age - t0; if (u < 0) continue;
        const ca = Math.cos(ang), sa = Math.sin(ang), dk = clamp01((u - .5) / .16), px = x + ca * 500 * easeOut(dk), py = y + sa * 500 * easeOut(dk);
        const face = ca >= 0 ? 1 : -1, H = 120;
        if (u < .5) {
          const k = easeOut(u / .4);
          ctx.save(); ctx.beginPath(); ctx.rect(x - 70, y - 200, 140, 202); ctx.clip();
          AS.draw(ctx, 'yamato', x, y + H * (1 - k), { frame: u > .36 ? 'seal' : 'idle', facing: face });
          ctx.restore();
          // wood grain still on the half-grown body
          ctx.globalAlpha = (1 - k) * .8; ctx.fillStyle = '#8a5a32'; ctx.fillRect(x - 14, y - H * k, 28, H * k); ctx.globalAlpha = 1;
          K.fx.debris(ctx, x, y, 60, u / .5, t0 * 9, '#6a4422', 6);
        } else if (u < .8) {
          speedLines(ctx, x, y, px, py, 20, 1 - (u - .5) / .3, t0 * 7, '230,210,160', LIFT + 6);
          AS.draw(ctx, 'yamato', px, py, { frame: 'attack', facing: face });
          // the stake held in front
          woodBeam(ctx, px + ca * 8, py + sa * 8 - LIFT - 4, px + ca * 62, py + sa * 62 - LIFT - 8, 12, 4, true);
        } else {
          const e = (u - .8) / .6; if (e > 1) continue;
          ctx.globalAlpha = 1 - e; AS.draw(ctx, 'yamato', px, py, { frame: 'idle', facing: face }); ctx.globalAlpha = 1;
          ctx.globalAlpha = e * (1 - e) * 2.4; ctx.fillStyle = '#9a6a3a'; ctx.fillRect(px - 16, py - 100, 32, 100); ctx.globalAlpha = 1;
          K.fx.debris(ctx, px, py - 40, 80, e, t0 * 13, '#7a4e2a', 10);
        }
      }
    }],
    dragon: [(ctx, fx, time) => {
      const N = dragonPts(fx, time), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
      if (N < 2) return;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(40,22,10,${.35 * a})`; ctx.lineWidth = 46;
      ctx.beginPath(); ctx.moveTo(DPX[0], DPY[0]); for (let i = 1; i < N; i++) ctx.lineTo(DPX[i], DPY[i]); ctx.stroke();
      const u = fx.age - fx.tArr;
      if (u > 0) crackG(ctx, fx.cx, fx.cy, fx.R * 1.1, a * Math.min(1, u * 3), fx.seed);
      // furrow where it burst out of the ground
      crackG(ctx, fx.x0 + Math.cos(fx.a) * 60, fx.y0 + Math.sin(fx.a) * 60, 90, a, fx.seed + 2);
      if (u > fx.T) crackG(ctx, fx.cx, fx.cy, 360, a, fx.seed + 5, '30,16,8');
      dragonDraw(ctx, fx, time, 0);
    }, (ctx, fx, time) => dragonDraw(ctx, fx, time, 1)],
    trees: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .5, fx.dur);
      ctx.fillStyle = `rgba(20,40,16,${.3 * a})`;
      for (const p of fx.pts) { if (fx.age < p[2]) continue; ctx.beginPath(); ctx.ellipse(p[0], p[1] + 4, 60 * p[3], 22 * p[3], 0, 0, TAU); ctx.fill(); }
    }, (ctx, fx) => {
      const K = Kit(), dust = K.puff('dust');
      for (const p of fx.pts) {
        const u = fx.age - p[2]; if (u < 0) continue;
        const k = easeOut(u / .25), fa = 1 - win(fx.age, fx.dur - .6, fx.dur); if (k <= .01 || fa <= 0) continue;
        const s = p[3], spr = treeSpr(fx.green ? 'green' : 'red', p[4]), W = 200 * s, H = 300 * s;
        ctx.globalAlpha = fa; ctx.drawImage(spr, 0, 0, 200, 300 * k, p[0] - W / 2, p[1] + 8 * s - H * k, W, H * k); ctx.globalAlpha = 1;
        if (u < .6) K.stamp(ctx, dust, p[0], p[1] - 8, 20 + u * 60, (1 - u / .6) * .8, .7);
      }
    }],
    // ---- Sai
    scroll: [(ctx, fx) => {
      const k = easeOut(fx.age / .25), a = 1 - win(fx.age, fx.dur - .4, fx.dur), L = fx.len * k, W = fx.wide ? 46 : 22;
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.fillRect(20, -W / 2 + 4, L, W);
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(18, -W / 2, L, W);
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.strokeRect(18, -W / 2, L, W);
      ctx.fillStyle = '#b8303a'; ctx.fillRect(18, -W / 2, L, 3); ctx.fillRect(18, W / 2 - 3, L, 3);
      // ink beasts sketched along the paper
      ctx.strokeStyle = '#101018'; ctx.lineWidth = fx.wide ? 3.5 : 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = 40; x < L - 10; x += fx.wide ? 42 : 30) { const h = W * .3; ctx.moveTo(x, h * .4); ctx.quadraticCurveTo(x + 8, -h, x + 18, 0); ctx.quadraticCurveTo(x + 24, h, x + 30, -h * .3); }
      ctx.stroke();
      ctx.fillStyle = '#d8ccb0'; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(18 + L, 0, 7, W / 2 + 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }, null],
    beasts: [(ctx, fx) => {
      ctx.fillStyle = 'rgba(10,10,20,.25)';
      for (const b of fx.list) {
        const d = (fx.age - b[6]) * b[5]; if (d < 0 || d > b[4]) continue;
        ctx.beginPath(); ctx.ellipse(b[1] + Math.cos(b[3]) * d, b[2] + Math.sin(b[3]) * d + 3, fx.big ? 46 : 38, 12, 0, 0, TAU); ctx.fill();
      }
      if (fx.coil && fx.age > fx.tc) snakeCoil(ctx, fx, false);
    }, (ctx, fx, time) => {
      for (const b of fx.list) {
        const u = fx.age - b[6], d = u * b[5];
        if (u < 0) continue;
        const ca = Math.cos(b[3]), sa = Math.sin(b[3]);
        if (b[0] === 'snake') { if (!fx.coil || fx.age < fx.tc) snakeDraw(ctx, b, Math.min(d, b[4]), time, fx.big); continue; }
        if (d > b[4]) {
          const e = (d - b[4]) / b[5] / .7; if (e > 1) continue;
          splatAt(ctx, b[1] + ca * b[4], b[2] + sa * b[4], 70 * (fx.big ? 1.3 : 1), e, b[1] % 4);
          continue;
        }
        const x = b[1] + ca * d, y = b[2] + sa * d, gait = Math.abs(Math.sin(d * .028 + b[6] * 9)), s = fx.big ? 1.25 : 1;
        const spr = beastSpr(b[0]), W = 150 * s, H = 103 * s, rise = clamp01(u / .15);
        ctx.save(); ctx.translate(x, y - gait * 12 * s); if (ca < 0) ctx.scale(-1, 1);
        ctx.rotate(sa * (ca < 0 ? -.25 : .25));
        ctx.globalAlpha = rise;
        ctx.drawImage(spr, -W * .55, -H * .92, W, H);
        ctx.restore(); ctx.globalAlpha = 1;
        // ink drips flicking off the run
        ctx.fillStyle = '#0d0d14';
        for (let i = 0; i < 4; i++) { const q = (u * 3 + i * .25) % 1, ox = -ca * (30 + q * 50), oy = -sa * (30 + q * 50); ctx.beginPath(); ctx.arc(x + ox + (hash(i + b[6]) - .5) * 30, y + oy - 30 + q * 30, 3.4 * (1 - q), 0, TAU); ctx.fill(); }
      }
      if (fx.coil && fx.age > fx.tc) snakeCoil(ctx, fx, true);
    }],
    ibirds: [(ctx, fx) => {
      ctx.fillStyle = 'rgba(10,10,20,.22)';
      for (const [x, y, t] of fx.list) {
        const u = clamp01((fx.age - .05) / (t - .05)); if (u >= 1 || fx.age < .05) continue;
        ctx.beginPath(); ctx.ellipse(fx.x + (x - fx.x) * u, fx.y + (y - fx.y) * u, 22 + u * 10, 8, 0, 0, TAU); ctx.fill();
      }
    }, (ctx, fx, time) => {
      const K = Kit(), spr = birdSpr();
      fx.list.forEach(([x, y, t], i) => {
        if (fx.age < .05) return;
        const u = (fx.age - .05) / (t - .05);
        if (u >= 1) { const e = (fx.age - t) / .8; if (e < 1) { splatAt(ctx, x, y, 90, e, x % 4); ctx.globalCompositeOperation = 'lighter'; K.fx.shockRing(ctx, x, y, 120, e * 1.6, 1 - e, '150,170,230'); ctx.globalCompositeOperation = 'source-over'; } return; }
        // each bird leaves the scroll on its own side, climbs and stoops on its mark
        const sa = i * 2.4 + fx.seed, x0 = fx.x + Math.cos(sa) * 50, y0 = fx.y - 40 + Math.sin(sa) * 24;
        const mx = (x0 + x) / 2 + Math.cos(sa) * 220, my = Math.min(y0, y) - 300 - hash(i + fx.seed) * 80;
        const q = 1 - u, bx = q * q * x0 + 2 * q * u * mx + u * u * x, by = q * q * y0 + 2 * q * u * my + u * u * y;
        const vx = 2 * q * (mx - x0) + 2 * u * (x - mx), vy = 2 * q * (my - y0) + 2 * u * (y - my), ang = Math.atan2(vy, vx);
        const fl = u > .75 ? .55 : 1 + Math.sin(time * 26 + i * 2) * .3;
        ctx.save(); ctx.translate(bx, by - 20); ctx.rotate(ang);
        ctx.drawImage(spr, -66, -55 * fl, 120, 100 * fl);
        ctx.restore();
        if (u > .6) speedLines(ctx, bx - vx * .06, by - vy * .06, bx, by, 10, (u - .6) * 2, i * 3, '40,44,70', 20);
      });
    }],
    splat: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .6, fx.dur), k = easeOut(fx.age / .2), r = fx.r * k;
      ctx.globalAlpha = a * .9;
      ctx.drawImage(splatSpr(R0(fx.seed) % 4), fx.x - r, fx.y - r * .55, r * 2, r * 1.1);
      ctx.globalAlpha = 1;
    }, (ctx, fx) => { if (fx.age < .5) inkDroplets(ctx, fx.x, fx.y, fx.r, fx.age / .5, fx.seed); }],
    iclones: [(ctx, fx) => {
      for (const [x, y, ang, len, t0] of fx.list) {
        const u = fx.age - t0; if (u < 0) continue;
        const e = u < .35 ? easeOut(u / .35) : 1, a = 1 - win(u, 1.2, 1.7), ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
        ctx.globalAlpha = a * .85;
        const s1 = splatSpr(1); ctx.drawImage(s1, x - 40 * e, y - 22 * e, 80 * e, 44 * e);
        if (u > .55) { const f = easeOut((u - .55) / .3); ctx.drawImage(splatSpr(2), ex - 50 * f, ey - 28 * f, 100 * f, 56 * f); }
        ctx.globalAlpha = 1;
      }
    }, (ctx, fx) => {
      for (const [x, y, ang, len, t0] of fx.list) {
        const u = fx.age - t0; if (u < .1) continue;
        const ca = Math.cos(ang), flip = ca < 0;
        if (u < .35) {
          const k = easeOut((u - .1) / .25);
          ctx.save(); ctx.beginPath(); ctx.rect(x - 70, y - 200, 140, 202); ctx.clip();
          ctx.drawImage(inkClone('seal', flip), x - 65, y - 150 + 120 * (1 - k)); ctx.restore();
        } else if (u < .55) {
          const k = easeOut((u - .35) / .2), px = x + ca * len * k, py = y + Math.sin(ang) * len * k;
          speedLines(ctx, x, y, px, py, 22, 1, t0 * 5, '40,40,60', LIFT + 6);
          ctx.drawImage(inkClone('attack', flip), px - 65, py - 150);
        } else {
          const e = (u - .55) / .55; if (e > 1) continue;
          const px = x + ca * len, py = y + Math.sin(ang) * len;
          // melting back into ink
          ctx.save(); ctx.beginPath(); ctx.rect(px - 70, py - 200, 140, 202); ctx.clip();
          ctx.globalAlpha = 1 - e; ctx.drawImage(inkClone('idle', flip), px - 65, py - 150 + 110 * e); ctx.restore(); ctx.globalAlpha = 1;
          inkDroplets(ctx, px, py, 70, e, t0 * 3);
        }
      }
    }],
    drop: [null, (ctx, fx) => {
      const k = easeIn(fx.age / fx.dur), y = fx.y - fx.h - 60 + (fx.h + 60) * k;
      ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.ellipse(fx.x, y, 9, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,170,220,.6)'; ctx.beginPath(); ctx.ellipse(fx.x - 3, y - 4, 2.4, 4, 0, 0, TAU); ctx.fill();
    }],
    // ---- Asuma
    slash: [(ctx, fx) => {
      const a = 1 - win(fx.age, .2, fx.dur);
      ctx.strokeStyle = `rgba(30,40,60,${.35 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const aa = fx.a + (i / 4 - .5) * 1.6; ctx.beginPath(); ctx.moveTo(fx.x + Math.cos(aa) * fx.r * .4, fx.y + Math.sin(aa) * fx.r * .4); ctx.lineTo(fx.x + Math.cos(aa) * fx.r, fx.y + Math.sin(aa) * fx.r); ctx.stroke(); }
    }, (ctx, fx) => windSlash(ctx, fx)],
    blades: [null, (ctx, fx, time) => {
      const K = Kit();
      for (const [ba, len] of fx.list) {
        const u = fx.age, d = u < fx.out ? len * easeOut(u / fx.out) : len * (1 - easeIn((u - fx.out) / fx.out));
        if (u > fx.out * 2) continue;
        const ca = Math.cos(ba), sa = Math.sin(ba), x = fx.x + ca * d, y = fx.y + sa * d - LIFT - 6;
        // wind streak behind and the spinning chakra knife
        speedLines(ctx, fx.x + ca * Math.max(0, d - 160), fx.y + sa * Math.max(0, d - 160), fx.x + ca * d, fx.y + sa * d, 18, .8, ba * 10, '190,235,255', LIFT + 6);
        // a whirling disc of wind round the spinning chakra knife
        const sp = time * 24 + ba * 5;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = 'rgba(16,26,46,.38)'; ctx.beginPath(); ctx.ellipse(0, 2, 50, 22, 0, 0, TAU); ctx.fill();
        for (let j = 0; j < 3; j++) { ctx.fillStyle = 'rgba(16,26,46,.5)'; crescent(ctx, 0, 1, 48, 12, sp + j * 2.09, sp + j * 2.09 + 1.7, .46); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, 0, 0, 70, '120,200,255', .8, false, .6);
        for (let j = 0; j < 3; j++) { ctx.fillStyle = 'rgba(200,240,255,.9)'; crescent(ctx, 0, 0, 46, 10, sp + j * 2.09, sp + j * 2.09 + 1.6, .46); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.rotate(time * 28 + ba); ctx.scale(1.5, 1.5);
        for (let i = 0; i < 2; i++) {
          ctx.rotate(Math.PI);
          ctx.fillStyle = '#1a2030'; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(26, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#d8e0ea'; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(23, 0); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(150,220,255,.55)'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(38, 0); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }],
    gust: [(ctx, fx) => {
      const f = Math.min(fx.len, fx.age * fx.sp), a = 1 - win(fx.age, fx.dur - .5, fx.dur);
      ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
      ctx.strokeStyle = fx.hot ? `rgba(80,30,10,${.45 * a})` : `rgba(30,40,60,${.4 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(f, 0); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath();
      for (let d = 60; d < f; d += 70) { const o = (hash(d + fx.seed) - .5) * 60; ctx.moveTo(d, o); ctx.lineTo(d + 40, o * .6); }
      ctx.stroke();
      ctx.restore();
    }, (ctx, fx) => {
      const K = Kit(), f = Math.min(fx.len, fx.age * fx.sp), a = 1 - win(fx.age, fx.len / fx.sp, fx.dur);
      if (a <= 0) return;
      const ca = Math.cos(fx.a), sa = Math.sin(fx.a), x = fx.x + ca * f, y = fx.y + sa * f - LIFT;
      const rgb = fx.hot ? '255,190,120' : '170,225,255';
      speedLines(ctx, fx.x + ca * Math.max(0, f - 420), fx.y + sa * Math.max(0, f - 420), fx.x + ca * f, fx.y + sa * f, 40, a, fx.seed, fx.hot ? '255,220,170' : '220,245,255', LIFT);
      ctx.save(); ctx.translate(x, y); ctx.rotate(fx.a);
      ctx.fillStyle = `rgba(20,30,50,${.4 * a})`; crescent(ctx, -40, 0, 80, 26, -1.25, 1.25, 1); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${rgb},${.75 * a})`; crescent(ctx, -42, 0, 78, 22, -1.2, 1.2, 1); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${.85 * a})`; crescent(ctx, -44, 0, 74, 9, -1.1, 1.1, 1); ctx.fill();
      ctx.restore();
      K.glow(ctx, x, y, 90, rgb, .5 * a);
      ctx.globalCompositeOperation = 'source-over';
    }],
    ash: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .6, fx.dur);
      if (fx.age > fx.ign) for (const q of fx.pts) { const tq = fx.ign + Math.hypot(q[0] - fx.x, q[1] - fx.y) / 1300; if (fx.age > tq) crackG(ctx, q[0], q[1], q[2] * .9, a * .7, q[0], '30,14,6'); }
    }, (ctx, fx, time) => ashDraw(ctx, fx, time)],
    boom: [null, (ctx, fx, time) => {
      const K = Kit(), a = 1 - win(fx.age, fx.dur - .6, fx.dur);
      K.fx.fireBlast(ctx, fx.x, fx.y, fx.r * .8, fx.age, a, time, fx.seed);
      ctx.globalCompositeOperation = 'lighter';
      K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.2, fx.age * 1.2, Math.max(0, 1 - fx.age), '255,170,90');
      ctx.globalCompositeOperation = 'source-over';
      if (fx.age < 1.3) K.fx.debris(ctx, fx.x, fx.y, fx.r, fx.age / 1.3, fx.seed, '#2a1a12', 16);
    }],
    // ---- Kurenai
    stream: [null, (ctx, fx, time) => {
      for (let i = 0; i < 26; i++) {
        const u = (fx.age - i * .015) / .55; if (u < 0 || u > 1) continue;
        const o = (hash(i * 3.3 + fx.seed) - .5) * 80, w = Math.sin(u * Math.PI) * o;
        const dx = fx.x1 - fx.x0, dy = fx.y1 - fx.y0, L = Math.hypot(dx, dy) || 1;
        const x = fx.x0 + dx * u - dy / L * w, y = fx.y0 + dy * u + dx / L * w - LIFT - Math.sin(u * Math.PI) * 40;
        petal(ctx, x, y, time * 9 + i, i % 4, 1.2);
      }
    }],
    field: [(ctx, fx, time) => {
      const k = easeOut((fx.age - fx.t0) / .4), a = (1 - win(fx.age, fx.dur - .6, fx.dur)) * k;
      if (a <= 0) return;
      ctx.fillStyle = `rgba(200,40,80,${.14 * a})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(120,10,40,${.4 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * k, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,130,160,${.45 * a})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const r = fx.r * k * (.35 + i * .25), s = time * (1.4 - i * .3) + i * 2; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, s, s + 2.2); ctx.stroke(); }
    }, (ctx, fx, time) => {
      const k = easeOut((fx.age - fx.t0) / .4), a = (1 - win(fx.age, fx.dur - .6, fx.dur)) * k;
      if (a <= 0) return;
      const n = fx.big ? 96 : 40;
      ctx.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        const rr = fx.r * k * (.15 + .85 * Math.sqrt(hash(i * 1.7 + fx.seed))), sp = (.8 + hash(i * 3.1) * 1.2) * (220 / (rr + 80)), an = hash(i * 5.7 + fx.seed) * TAU + time * sp;
        const h = 14 + 40 * hash(i * 2.9) + Math.sin(time * 3 + i) * 10;
        petal(ctx, fx.x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr - h, time * 6 + i, i % 4, 1 + hash(i) * .5);
      }
      ctx.globalAlpha = 1;
    }],
    ktree: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .5, fx.dur);
      crackG(ctx, fx.x, fx.y, fx.small ? 90 : 130, a * Math.min(1, fx.age * 5), fx.seed, '50,20,20');
      treeWrap(ctx, fx, false);
    }, (ctx, fx) => {
      const K = Kit(), s = fx.small ? .7 : 1, k = easeOut(fx.age / .35), fa = 1 - win(fx.age, fx.dur - .6, fx.dur), spr = treeSpr('red', fx.small ? 2 : 1);
      if (k > .01 && fa > 0) { const W = 200 * s, H = 300 * s, tx = fx.x + 34 * s; ctx.globalAlpha = fa; ctx.drawImage(spr, 0, 0, 200, 300 * k, tx - W / 2, fx.y + 6 - H * k, W, H * k); ctx.globalAlpha = 1; }
      treeWrap(ctx, fx, true);
      if (fx.age < .6) dustRing(ctx, fx.x, fx.y, 150 * s, fx.age, fx.seed, 10, 'dust', .6);
      if (fx.age < .8) K.fx.debris(ctx, fx.x, fx.y, 120 * s, fx.age / .8, fx.seed, '#4a2420', 8);
    }],
    poofp: [null, (ctx, fx, time) => {
      const e = easeOut(fx.age / fx.dur), a = 1 - win(fx.age, fx.dur * .4, fx.dur);
      puffBurst(ctx, fx.x, fx.y - LIFT, 46, fx.age * 1.2, fx.seed, 'poof', 8, .8);
      ctx.globalAlpha = a;
      for (let i = 0; i < 22; i++) { const an = i * TAU / 22 + fx.seed, d = 10 + e * (60 + hash(i) * 50); petal(ctx, fx.x + Math.cos(an) * d, fx.y - LIFT - 20 + Math.sin(an) * d * .6 - e * 30 * hash(i * 3), time * 8 + i, i % 4, 1.2); }
      ctx.globalAlpha = 1;
    }],
    cut: [null, (ctx, fx) => {
      const K = Kit(), e = fx.age / fx.dur, a = 1 - e, y = fx.y - LIFT;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, y, 80, '255,90,130', a);
      ctx.strokeStyle = `rgba(255,240,245,${a})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const L = 70 * easeOut(e * 3);
      ctx.beginPath(); ctx.moveTo(fx.x - L, y - L * .5); ctx.lineTo(fx.x + L, y + L * .5); ctx.moveTo(fx.x - L, y + L * .4); ctx.lineTo(fx.x + L, y - L * .4); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }],
    kcopies: [(ctx, fx, time) => {
      for (const [x, y, , t0] of fx.list) {
        const u = fx.age - t0; if (u < 0 || u > 1.4) continue;
        const a = Math.min(1, u * 4) * (1 - win(u, 1, 1.4));
        ctx.fillStyle = `rgba(200,30,70,${.22 * a})`; ctx.beginPath(); ctx.ellipse(x, y + 2, 34, 13, 0, 0, TAU); ctx.fill();
      }
    }, (ctx, fx, time) => {
      const K = Kit();
      for (const [x, y, ang, t0] of fx.list) {
        const u = fx.age - t0; if (u < 0) continue;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        if (u < 1.2) {
          const a = Math.min(1, u * 4) * (1 - win(u, .9, 1.2)), fl = .55 + Math.sin(time * 30 + x) * .15;
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y - 50, 70, '255,60,110', a * .5); ctx.globalCompositeOperation = 'source-over';
          AS.draw(ctx, 'kurenai', x + Math.sin(time * 40 + y) * 2 * a, y, { frame: u > .35 && u < .7 ? 'attack' : 'idle', facing: ca >= 0 ? 1 : -1, alpha: a * fl });
          if (u > .85) { ctx.globalAlpha = a; for (let i = 0; i < 8; i++) petal(ctx, x + (hash(i + x) - .5) * 60, y - 30 - (u - .85) * 120 * hash(i * 3), time * 7 + i, i % 4, 1.1); ctx.globalAlpha = 1; }
        }
        // the kunai fans
        for (let j = -1; j <= 1; j++) {
          const v = (u - .42) / .32; if (v < 0 || v > 1) continue;
          const ka = ang + j * .12, d = 40 + 430 * v, kx = x + Math.cos(ka) * d, ky = y + Math.sin(ka) * d - LIFT - 4;
          ctx.strokeStyle = 'rgba(255,200,220,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx - Math.cos(ka) * 50, ky - Math.sin(ka) * 50); ctx.stroke();
          ctx.save(); ctx.translate(kx, ky); ctx.rotate(ka);
          ctx.fillStyle = '#1a1016'; ctx.beginPath(); ctx.moveTo(-10, -3.4); ctx.lineTo(12, 0); ctx.lineTo(-10, 3.4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#dfe4ee'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(10, 0); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#1a1016'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-13, 0, 3, 0, TAU); ctx.stroke();
          ctx.restore();
        }
      }
    }],
    vines: [(ctx, fx) => {
      const a = 1 - win(fx.age, fx.dur - .4, fx.dur);
      crackG(ctx, fx.x, fx.y, 200, a, fx.seed, '40,30,14');
    }, (ctx, fx, time) => {
      const k = easeOut(fx.age / .16), back = easeIn((fx.age - .75) / .5);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [va, vl] of fx.list) {
        const L = vl * k * (1 - back); if (L < 6) continue;
        const ca = Math.cos(va), sa = Math.sin(va), n = 10;
        for (let i = 0; i <= n; i++) {
          const t = i / n, w = Math.sin(t * 7 - time * 14 + va) * 24 * t;
          DPX[i] = fx.x + ca * L * t - sa * w; DPY[i] = fx.y + sa * L * t + ca * w - Math.sin(t * Math.PI) * 50 * k;
        }
        for (const [col, lw] of [['#1a1208', 14], ['#3e5a24', 9], ['#7a9a44', 3]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(DPX[0], DPY[0]); for (let i = 1; i <= n; i++) ctx.lineTo(DPX[i], DPY[i]); ctx.stroke();
        }
        ctx.fillStyle = '#1a1208';
        for (let i = 2; i < n; i += 2) { ctx.beginPath(); ctx.moveTo(DPX[i] - 3, DPY[i]); ctx.lineTo(DPX[i] + 2, DPY[i] - 11); ctx.lineTo(DPX[i] + 5, DPY[i]); ctx.fill(); }
        petal(ctx, DPX[n], DPY[n] - 4, time * 5 + va, R0(va * 3) % 4, 1.6);
      }
    }],
    world: [(ctx, fx, time) => {
      const k = easeOut(fx.age / .6), a = 1 - win(fx.age, fx.dur - .7, fx.dur), r = fx.r * k;
      if (r < 4) return;
      const g = ctx.createRadialGradient(fx.x, fx.y, r * .1, fx.x, fx.y, r);
      g.addColorStop(0, `rgba(120,0,40,${.34 * a})`); g.addColorStop(.7, `rgba(170,20,60,${.26 * a})`); g.addColorStop(1, `rgba(90,0,30,${.42 * a})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,120,150,${.6 * a})`; ctx.lineWidth = 3; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -time * 40;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, r - 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // the world warps: rippling rings
      ctx.strokeStyle = `rgba(60,0,20,${.35 * a})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const rr = r * ((time * .35 + i / 3) % 1); ctx.beginPath(); ctx.arc(fx.x, fx.y, rr, 0, TAU); ctx.stroke(); }
    }, null],
    bloom: [null, (ctx, fx, time) => {
      const K = Kit(), e = easeOut(fx.age / .7), a = 1 - win(fx.age, .5, fx.dur);
      ctx.globalCompositeOperation = 'lighter';
      if (fx.age < .4) K.glow(ctx, fx.x, fx.y - 40, fx.r * (.6 + fx.age), '255,80,130', (1 - fx.age / .4) * .8, true, .6);
      K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.05, fx.age * 1.3, Math.max(0, 1 - fx.age), '255,120,160');
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      for (let i = 0; i < 60; i++) { const an = i * TAU / 60 + fx.seed, d = fx.r * (.15 + e * (.7 + hash(i) * .3)); petal(ctx, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 20 - e * 60 * hash(i * 2), time * 6 + i, i % 4, 1.6); }
      ctx.globalAlpha = 1;
    }]
  };

  function petal(ctx, x, y, rot, v, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * (.6 + .4 * Math.abs(Math.sin(rot * .7))));
    ctx.drawImage(petalSpr(v), -9, -6);
    ctx.restore();
  }
  function inkDroplets(ctx, x, y, r, e, seed) {
    ctx.fillStyle = '#0d0d14';
    for (let i = 0; i < 10; i++) {
      const an = hash(i * 2.3 + seed) * TAU, d = r * (.3 + e * (.6 + hash(i) * .4)), h = Math.sin(Math.PI * e) * r * .5 * hash(i * 5 + seed);
      ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - h, 5 * (1 - e) + 1, 0, TAU); ctx.fill();
    }
  }
  function splatAt(ctx, x, y, r, e, v) {
    ctx.globalAlpha = (1 - e) * .9;
    const k = easeOut(e * 3);
    ctx.drawImage(splatSpr(R0(v) % 4), x - r * k, y - r * .55 * k, r * 2 * k, r * 1.1 * k);
    ctx.globalAlpha = 1;
    inkDroplets(ctx, x, y, r, e, v * 7);
  }
  // ---- Yamato's cage (back posts in the ground pass, front posts above the characters)
  function cagePosts(ctx, fx, time, front) {
    const n = 10, u = fx.age - .1, k = easeOut(u / .18), crush = easeIn((fx.age - fx.T) / .25), gone = win(fx.age, fx.T + .3, fx.dur);
    if (u < 0 || gone >= 1) return;
    const H = 170 * k, R = fx.r * (1 - crush * .45), a = 1 - gone;
    ctx.globalAlpha = a;
    const tops = [];
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + .15, sn = Math.sin(an);
      const x = fx.x + Math.cos(an) * fx.r, y = fx.y + sn * fx.r * .55, tx = fx.x + Math.cos(an) * R * .8, ty = fx.y + sn * R * .45 - H;
      tops.push([tx, ty, sn]);
      if ((sn >= 0) !== front) continue;
      woodBeam(ctx, x, y + 2, tx, ty, 26, 18, false);
    }
    // crossbeams binding the post tops into a lattice
    for (let i = 0; i < n; i++) {
      const p = tops[i], q = tops[(i + 1) % n];
      if (((p[2] + q[2]) >= 0) !== front) continue;
      for (const h of [0, .55]) {
        const pa = [p[0] + (fx.x - p[0]) * 0, p[1] + H * h], qa = [q[0], q[1] + H * h];
        woodBeam(ctx, pa[0], pa[1], qa[0], qa[1], 12, 12, false);
      }
    }
    if (front && u < .5) Kit().fx.debris(ctx, fx.x, fx.y, fx.r * 1.4, u / .5, fx.seed, '#6a4422', 12);
    if (front && fx.age > fx.T && fx.age < fx.T + .9) impactO(ctx, fx.x, fx.y, 190, fx.age - fx.T, fx.seed, '200,240,140', '#7a4e2a');
    ctx.globalAlpha = 1;
  }
  // ---- the wood dragon: body points (ground x/y + height) along its line, then coiling round the victim
  function dragonPts(fx, time) {
    const N = 46, gap = 30, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    const travel = fx.age * fx.sp;
    const out = win(fx.age, fx.tArr + fx.T, fx.tArr + fx.T + .35);
    const RR = fx.R * (1 - easeIn(win(fx.age, fx.tArr + fx.T - .35, fx.tArr + fx.T)) * .45);
    let n = 0;
    for (let i = 0; i < N; i++) {
      const s = travel - i * gap; if (s < 0) break;
      let x, y, h, back = 0;
      if (s <= fx.len) {
        const wv = Math.sin(s * .012 + fx.seed) * 36 * Math.min(1, s / 200);
        x = fx.x0 + ca * s - sa * wv; y = fx.y0 + sa * s + ca * wv; h = 78 * easeOut(s / 160) + 16 * Math.sin(s * .02 - time * 5);
      } else {
        // coil: round the centre, rising with every turn
        const c = (s - fx.len) * .95, th = fx.a + Math.PI + c / RR;
        x = fx.cx + Math.cos(th) * RR; y = fx.cy + Math.sin(th) * RR * .55; h = 26 + Math.min(150, c / (TAU * RR) * 110);
        back = Math.sin(th) < -.05 ? 1 : 0;
      }
      DPX[n] = x; DPY[n] = y; DPH[n] = h * (1 - out); DPB[n] = back; n++;
    }
    return n;
  }
  // pass 0: the coils behind the victim (ground layer), pass 1: everything in front + the head.
  function dragonDraw(ctx, fx, time, pass) {
    const N = dragonPts(fx, time), fade = 1 - win(fx.age, fx.tArr + fx.T + .1, fx.tArr + fx.T + .5);
    const K = Kit(), u = fx.age - fx.tArr - fx.T;
    if (pass && u > 0 && u < 1.4) { impactO(ctx, fx.cx, fx.cy, 300, u, fx.seed, '190,240,120', '#7a4e2a'); K.fx.debris(ctx, fx.cx, fx.cy - 40, 320, u / 1.4, fx.seed + 4, '#8a5a32', 16); }
    if (N < 2 || fade <= 0) return;
    ctx.globalAlpha = fade; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const W = 66, wid = i => W * (.4 + .6 * (1 - i / N));
    const on = i => (DPB[i] && DPB[i - 1]) ? !pass : !!pass;
    // body from the tail forward so the head ends on top
    for (const [col, k, dy] of [[WOOD[0], 1, 0], [WOOD[1], .8, 0], [WOOD[3], .45, .22], [WOOD[2], .28, -.26]]) {
      ctx.strokeStyle = col;
      for (let i = N - 1; i > 0; i--) {
        if (!on(i)) continue;
        const w = wid(i) * k + (k === 1 ? 7 : 0);
        ctx.lineWidth = w; ctx.beginPath();
        ctx.moveTo(DPX[i], DPY[i] - DPH[i] + w * dy); ctx.lineTo(DPX[i - 1], DPY[i - 1] - DPH[i - 1] + w * dy); ctx.stroke();
      }
    }
    // spines and branch stubs along the back, grain rings across the body
    for (let i = 2; i < N - 1; i += 2) {
      if (!on(i)) continue;
      const x = DPX[i], y = DPY[i] - DPH[i], w = wid(i);
      ctx.fillStyle = WOOD[0]; ctx.beginPath(); ctx.moveTo(x - 9, y - w * .38); ctx.lineTo(x - 3, y - w * .38 - 22 * (1 - i / N) - 8); ctx.lineTo(x + 8, y - w * .38); ctx.fill();
      ctx.fillStyle = WOOD[1]; ctx.beginPath(); ctx.moveTo(x - 5, y - w * .38); ctx.lineTo(x - 3, y - w * .38 - 18 * (1 - i / N) - 4); ctx.lineTo(x + 3, y - w * .38); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,20,8,.6)'; ctx.lineWidth = 2.4;
    for (let i = 1; i < N - 1; i += 2) { if (!on(i)) continue; const x = DPX[i], y = DPY[i] - DPH[i], w = wid(i) * .5; ctx.beginPath(); ctx.moveTo(x, y - w); ctx.quadraticCurveTo(x + 5, y, x, y + w); ctx.stroke(); }
    if (pass) {
      const hx = DPX[0], hy = DPY[0] - DPH[0], ang = Math.atan2((DPY[0] - DPH[0]) - (DPY[1] - DPH[1]), DPX[0] - DPX[1]);
      dragonHead(ctx, hx, hy, ang, 64, [WOOD[0], WOOD[1], WOOD[2], '#e8f0a0'], .4 + .3 * Math.sin(time * 6));
      if (fx.age < .7) dustRing(ctx, fx.x0 + Math.cos(fx.a) * 60, fx.y0 + Math.sin(fx.a) * 60, 160, fx.age, fx.seed, 12, 'dust', .7);
    }
    ctx.globalAlpha = 1;
  }
  function dragonHead(ctx, x, y, angle, s, pal, open) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    ctx.lineJoin = 'round';
    for (const [col, k] of [[pal[0], 1.12], [pal[1], 1]]) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(-s * .6 * k, -s * .55 * k); ctx.quadraticCurveTo(s * .2, -s * .75 * k, s * 1.15 * k, -s * .25 * k);
      ctx.lineTo(s * .55, -s * .02 - open * s * .1); ctx.lineTo(s * 1.05 * k, s * .2 + open * s * .45);
      ctx.quadraticCurveTo(s * .2, s * .55 * k, -s * .6 * k, s * .45 * k); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.moveTo(-s * .3, -s * .4); ctx.quadraticCurveTo(s * .3, -s * .55, s * .9, -s * .25); ctx.quadraticCurveTo(s * .3, -s * .35, -s * .3, -s * .25); ctx.closePath(); ctx.fill();
    // wooden horns / antler branches
    ctx.lineCap = 'round';
    for (const [col, w] of [[pal[0], s * .2], [pal[1], s * .11]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(-s * .2, -s * .5); ctx.quadraticCurveTo(-s * .7, -s * .95, -s * 1.25, -s * .85); ctx.moveTo(-s * .7, -s * .9); ctx.lineTo(-s * .8, -s * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * .05, -s * .45); ctx.quadraticCurveTo(-s * .4, -s * 1.05, -s * .95, -s * 1.2); ctx.stroke();
    }
    ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.ellipse(s * .3, -s * .3, s * .15, s * .075, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120808'; ctx.beginPath(); ctx.ellipse(s * .33, -s * .3, s * .04, s * .06, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0e2c0';
    for (let i = 0; i < 3; i++) { const fx0 = s * (.5 + i * .18); ctx.beginPath(); ctx.moveTo(fx0, -s * .1); ctx.lineTo(fx0 + s * .05, s * .06); ctx.lineTo(fx0 + s * .1, -s * .12); ctx.fill(); }
    ctx.restore();
  }
  // ---- Sai's snakes
  function snakeDraw(ctx, b, d, time, big) {
    const ca = Math.cos(b[3]), sa = Math.sin(b[3]), n = 12, L = 170 * (big ? 1.3 : 1), W = big ? 18 : 14;
    for (let i = 0; i <= n; i++) {
      const s = Math.max(0, d - L * i / n), w = Math.sin(s * .03 - time * 10 + b[6] * 20) * 22 * b[7];
      DPX[i] = b[1] + ca * s - sa * w; DPY[i] = b[2] + sa * s + ca * w - 12;
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, k] of [['#05050a', 1.25], ['#121220', 1], ['rgba(120,130,190,.6)', .25]]) {
      ctx.strokeStyle = col;
      for (let i = 0; i < n; i++) { ctx.lineWidth = W * k * (1 - i / n * .7); ctx.beginPath(); ctx.moveTo(DPX[i], DPY[i] - (k < .5 ? W * .25 : 0)); ctx.lineTo(DPX[i + 1], DPY[i + 1] - (k < .5 ? W * .25 : 0)); ctx.stroke(); }
    }
    const ha = Math.atan2(DPY[0] - DPY[1], DPX[0] - DPX[1]);
    ctx.save(); ctx.translate(DPX[0], DPY[0]); ctx.rotate(ha);
    ctx.fillStyle = '#0d0d14'; ctx.beginPath(); ctx.moveTo(-6, -W * .7); ctx.quadraticCurveTo(16, -W * .8, 24, -2); ctx.lineTo(10, 0); ctx.lineTo(24, 4); ctx.quadraticCurveTo(14, W * .8, -6, W * .7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(10, -W * .35, 2.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d8203a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(24, 1); ctx.lineTo(32, -2); ctx.moveTo(28, 0); ctx.lineTo(32, 3); ctx.stroke();
    ctx.restore();
  }
  function snakeCoil(ctx, fx, front) {
    const [cx, cy] = fx.coil, u = fx.age - fx.tc, k = easeOut(u / .25), gone = win(fx.age, fx.dur - .9, fx.dur - .4), R = 54 * (1 - easeIn(win(u, 1.1, 1.3)) * .3);
    if (gone >= 1) return;
    ctx.globalAlpha = 1 - gone; ctx.lineCap = 'round';
    for (let ring = 0; ring < 4; ring++) {
      const h = 10 + ring * 15 * k, a0 = front ? 0 : Math.PI, rot = u * 3 * (ring % 2 ? 1 : -1);
      for (const [col, w] of [['#05050a', 15], ['#14141f', 11], ['rgba(130,140,200,.55)', 3]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.ellipse(cx, cy - h, R, R * .45, 0, a0 + rot * .02, a0 + Math.PI); ctx.stroke();
      }
    }
    if (front) for (const sd of [-1, 1]) {
      // two heads rear up over the coils, jaws open
      const hx = cx + sd * R * .5, hy = cy - 10 - 45 * k - 26 - Math.sin(u * 8 + sd) * 4;
      ctx.strokeStyle = '#05050a'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(cx + sd * R * .8, cy - 50 * k); ctx.quadraticCurveTo(cx + sd * R * 1.05, hy + 10, hx, hy); ctx.stroke();
      ctx.strokeStyle = '#14141f'; ctx.lineWidth = 9; ctx.stroke();
      ctx.save(); ctx.translate(hx, hy); ctx.scale(-sd, 1);
      ctx.fillStyle = '#0b0b12'; ctx.beginPath(); ctx.moveTo(8, -9); ctx.quadraticCurveTo(-14, -12, -22, -4); ctx.lineTo(-10, -1); ctx.lineTo(-22, 5); ctx.quadraticCurveTo(-12, 10, 8, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -5, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-18, -3); ctx.lineTo(-16, 1); ctx.lineTo(-14, -2); ctx.fill();
      ctx.strokeStyle = '#d8203a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-22, 1); ctx.lineTo(-30, -2); ctx.moveTo(-26, 0); ctx.lineTo(-30, 3); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // ---- Kurenai's binding tree: branches wrapping the victim's spot
  function treeWrap(ctx, fx, front) {
    const k = easeOut((fx.age - .12) / .3), gone = win(fx.age, fx.T + .1, fx.T + .6), s = fx.small ? .75 : 1;
    if (k <= 0 || gone >= 1) return;
    ctx.globalAlpha = 1 - gone; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const h = (14 + i * 17) * s, R = (40 - i * 3) * s, a0 = front ? .1 : Math.PI + .1, a1 = a0 + (Math.PI - .2) * k;
      for (const [col, w] of [['#24101a', 11 * s], ['#6a3238', 7 * s], ['#9a5a58', 2]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(fx.x, fx.y - h, R, R * .42, (i - 1.5) * .12, a0, a1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  // ---- Asuma's wind blades
  function windSlash(ctx, fx) {
    const K = Kit(), e = easeOut(fx.age / .16), a = 1 - win(fx.age, .18, fx.dur), cy = fx.y - LIFT;
    if (a <= 0) return;
    for (let s = 0; s < fx.n; s++) {
      const R = fx.r * (.55 + .45 * e) - s * 30, tilt = s ? .5 : -.5, a0 = fx.a - 1.05, a1 = fx.a + 1.05;
      ctx.save(); ctx.translate(fx.x, cy); ctx.rotate(tilt * .25);
      ctx.fillStyle = `rgba(20,30,50,${.38 * a})`; crescent(ctx, 0, 0, R + 4, 30, a0, a1, .62); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(140,210,255,${.7 * a})`; crescent(ctx, 0, 0, R, 26, a0, a1, .62); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${.9 * a})`; crescent(ctx, 0, 0, R - 3, 9, a0 + .1, a1 - .1, .62); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x + Math.cos(fx.a) * fx.r * .6, cy + Math.sin(fx.a) * fx.r * .35, fx.r * .7, '120,200,255', .45 * a, false, .6);
    ctx.globalCompositeOperation = 'source-over';
  }
  // ---- Asuma's ash cloud: grey billows drifting out, then a chain of fire racing through them
  function ashDraw(ctx, fx, time) {
    const K = Kit(), smoke = K.puff('smoke'), dust = K.puff('dust'), fire = K.puff('fire'), ember = K.puff('ember');
    const end = 1 - win(fx.age, fx.dur - .7, fx.dur);
    for (const q of fx.pts) {
      const tq = q[3] * .9, u = fx.age - tq; if (u < 0) continue;
      const g = easeOut(u / .5), ti = fx.ign + Math.hypot(q[0] - fx.x, q[1] - fx.y) / 1300, v = fx.age - ti;
      const wob = Math.sin(time * 1.5 + q[0]) * 6, y = q[1] - 26 - q[2] * .3 * g;
      if (v < 0) {
        K.stamp(ctx, smoke, q[0] + wob, y, q[2] * g, .85 * end);
        K.stamp(ctx, dust, q[0] - q[2] * .25 + wob, y - q[2] * .2, q[2] * .55 * g, .35 * end);
        if (hash(q[0] + R0(time * 6)) > .8) { ctx.fillStyle = '#ffb04a'; ctx.fillRect(q[0] + (hash(q[1] + time) - .5) * q[2], y + (hash(q[0] * 2 + time) - .5) * q[2] * .6, 2, 2); }
      } else {
        const f = easeOut(v / .25), fa = (1 - win(v, .5, 1.3)) * end;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, q[0], y, q[2] * (1.4 + f * .6), '255,120,40', fa * .8, v < .2);
        ctx.globalCompositeOperation = 'source-over';
        K.stamp(ctx, fire, q[0] + wob, y - f * 16, q[2] * (.9 + f * .4), fa);
        K.stamp(ctx, ember, q[0] - wob, y + q[2] * .2, q[2] * .7, fa * .8);
        if (v > .4) K.stamp(ctx, smoke, q[0], y - 40 - v * 50, q[2] * (.7 + v * .5), (1 - win(v, .6, 1.6)) * .7 * end);
      }
    }
    // the spark that sets it off: from his teeth into the cloud
    const sp = fx.age - (fx.ign - .3);
    if (sp > 0 && sp < .45) {
      const t = clamp01(sp / .3), x = fx.x + Math.cos(fx.a) * 120 * t, y = fx.y + Math.sin(fx.a) * 120 * t - LIFT - 14;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 40, '255,200,120', 1, true); ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------------------ windup look
  function windupFx(ctx, z, st, time) {
    const K = Kit(), def = MOVES[z.bossId][st.move], k = 1 - st.windup / st.windMax, H = bodyH(z.bossId), fy = z.y - st.lift, cy = fy - H * .55;
    const rgb = def.rgb, ult = !!def.ult;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, cy, (ult ? 120 : 70) * (.6 + k * .5), rgb, (ult ? .55 : .35) * (.6 + .4 * Math.sin(time * 14)));
    ctx.globalCompositeOperation = 'source-over';
    const id = z.bossId;
    if (id === 'yamato') {
      // wood chips spiralling up round him
      ctx.fillStyle = '#8a5a32'; ctx.strokeStyle = WOOD[0]; ctx.lineWidth = 1.2;
      for (let i = 0; i < (ult ? 16 : 9); i++) {
        const an = time * 3 + i * TAU / (ult ? 16 : 9), r = 34 + 10 * Math.sin(time * 2 + i), y = fy - ((time * 60 + i * 13) % H);
        const x = z.x + Math.cos(an) * r;
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (id === 'sai') {
      // ink ribbons whirling off the brush
      ctx.lineCap = 'round';
      for (let i = 0; i < (ult ? 5 : 3); i++) {
        const s = time * (4 + i) + i * 2, r = 40 + i * 9;
        ctx.strokeStyle = '#0d0d14'; ctx.lineWidth = 5 - i * .6;
        ctx.beginPath(); ctx.ellipse(z.x, cy, r, r * .4, 0, s, s + 1.8 + k); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,170,230,.6)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    } else if (id === 'asuma') {
      const fire = st.move === 'ash' || st.move === 'ult';
      ctx.strokeStyle = fire ? 'rgba(255,170,90,.8)' : 'rgba(220,245,255,.85)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (let i = 0; i < (ult ? 6 : 4); i++) {
        const s = time * 9 + i * 1.6, r = 26 + i * 8;
        ctx.beginPath(); ctx.ellipse(z.x, cy + 8 - i * 6, r, r * .35, 0, s, s + 1.5); ctx.stroke();
      }
      if (fire) { const smoke = K.puff('smoke'); for (let i = 0; i < 4; i++) { const ph = (time * .9 + i / 4) % 1; K.stamp(ctx, smoke, z.x + facingOf(z) * (14 + ph * 30), fy - H * .78 - ph * 30, 8 + ph * 16, (1 - ph) * .7); } }
    } else if (id === 'kurenai') {
      ctx.globalAlpha = .9;
      for (let i = 0; i < (ult ? 18 : 10); i++) {
        const an = time * 2.4 + i * TAU / (ult ? 18 : 10), r = 36 + 14 * Math.sin(time * 3 + i);
        petal(ctx, z.x + Math.cos(an) * r, cy + Math.sin(an) * r * .4 - 10 * Math.sin(time * 4 + i), time * 7 + i, i % 4, 1.2);
      }
      ctx.globalAlpha = 1;
    }
    if (ult) {
      // the ultimate: a column of chakra and a ground ring
      ctx.globalCompositeOperation = 'lighter';
      K.fx.shockRing(ctx, z.x, z.y, 160, (time * 1.4) % 1, .7, rgb);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y - st.lift - bodyH(z.bossId) - 34;
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `900 ${def.ult ? 13 : 11}px sans-serif`; ctx.lineWidth = 3.5; ctx.strokeStyle = '#120d16';
    ctx.strokeText(def.label, z.x, top); ctx.fillStyle = m.accent; ctx.fillText(def.label, z.x, top);
    ctx.restore();
  }

  const WARM = {
    yamato: [0, 1, 2, 3].map(v => () => stakeSpr(v)).concat([0, 1, 2].map(v => () => treeSpr('green', v)), [() => houseSpr()]),
    sai: ['lion', 'tiger', 'wolf'].map(t => () => beastSpr(t)).concat([() => birdSpr()], [0, 1, 2, 3].map(v => () => splatSpr(v)),
      ['seal', 'attack', 'idle'].flatMap(f => [() => inkClone(f, false), () => inkClone(f, true)])),
    asuma: [],
    kurenai: [0, 1, 2, 3].map(v => () => petalSpr(v)).concat([1, 2].map(v => () => treeSpr('red', v)))
  };

  // ------------------------------------------------------------------ module hooks
  function draw(ctx, z, time) {
    const st = z.jn;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      // Sai's giant ink bird carries him (drawn under his body)
      if (st.dash && st.dash.ride) {
        const fl = 1 + Math.sin(time * 9) * .28, y = z.y - st.lift;
        ctx.fillStyle = 'rgba(10,10,20,.25)'; ctx.beginPath(); ctx.ellipse(z.x, z.y + 4, 130, 40, st.dash.a, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(z.x, y + 4); ctx.rotate(st.dash.a);
        ctx.drawImage(birdSpr(), -170, -140 * fl, 340, 280 * fl);
        ctx.restore();
        ctx.fillStyle = INK;
        for (let i = 0; i < 3; i++) { const ph = (time * 2 + i / 3) % 1; ctx.beginPath(); ctx.arc(z.x - Math.cos(st.dash.a) * (60 + ph * 80), y + 10 + ph * st.lift, 5 * (1 - ph) + 1, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  function drawOverlay(ctx, z, time) {
    const st = z.jn, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move && st.vanish <= 0) {
      windupFx(ctx, z, st, time);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      label(ctx, z, st, m, time);
    }
    ctx.restore();
  }
  const hidden = z => !!(z.jn && z.jn.vanish > 0 && z.health > 0);
  const bodyLift = z => (z.jn && z.health > 0 ? z.jn.lift || 0 : 0);

  window.KonohaJoninBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moves, moveLabels };
})();
