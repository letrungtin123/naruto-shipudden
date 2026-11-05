/* Konoha rookies (spawn panel, faction 'rookie'): Haruno Sakura, Hyūga Hinata, Hyūga Neji, Nara Shikamaru.
 * Same contract as duel-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the telegraphs
 * and ground effects, drawOverlay(ctx, z, time) what stands above the characters. All per-boss state lives on
 * z.rk (plain numbers / small arrays; closures in ev/upd are skipped by the co-op JSON snapshot).
 * The four sprites are built here with AnimeSprites.kit and registered with AnimeSprites.addSprite.
 *
 * Sakura    : Cherry Blossom Impact, Heel Drop fissure, Shannarō punch rush, Byakugō regen (seal lines), Katsuyu
 *             (acid spray, splits heal her), ultimate Byakugō Strength punch (district-wide crater, heaving slabs).
 * Hinata    : 8 Trigrams 64 Palms, Twin Lion Fists, Protective 64 Palms dome, Vacuum Palm, Gentle Step palm rush,
 *             ultimate Hamura's twin chakra lions (The Last).
 * Neji      : Rotation (Kaiten), 8 Trigrams 64 Palms, Vacuum Palm volley, Air Palm wall, kunai fan,
 *             ultimate 8 Trigrams 128 Palms + Great Rotation.
 * Shikamaru : Shadow Imitation (crawling shadow, short root), Shadow Neck Bind, Shadow Stitching, Asuma's wind
 *             knives, explosive tag trap ring, ultimate Shadow mass bind + explosive tag field. */
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
  const R = Math.round;
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;

  // ================================================================== sprites
  (function registerSprites() {
    const S = window.AnimeSprites;
    if (!S || !S.kit || !S.addSprite) return;
    const { paint, poly, smooth, ell, dot, line, seg, lerp, lit, dark, light, SHADE, DEEP2, HAIR, locks, drawBand,
      flakVest, plateSymbol, lazyLid } = S.kit;

    // Byakugan veins bulging at the temples (seal / attack poses).
    const veins = ctx => {
      ctx.strokeStyle = 'rgba(120,96,150,.85)'; ctx.lineWidth = .32; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(.2, .6); ctx.lineTo(-.8, -.4); ctx.lineTo(-1.6, -.2);
      ctx.moveTo(-.8, -.4); ctx.lineTo(-1.2, -1.4);
      ctx.moveTo(.2, 3.6); ctx.lineTo(-.9, 4.2); ctx.lineTo(-1.4, 5);
      ctx.moveTo(10, 1); ctx.lineTo(10.8, .2); ctx.moveTo(10, 3.4); ctx.lineTo(10.7, 4.2);
      ctx.stroke();
    };
    const palmGlow = (ctx, hand, rgb) => {
      dot(ctx, hand[0] + 1, hand[1], 4.2, `rgba(${rgb},.38)`);
      dot(ctx, hand[0] + 1, hand[1], 2.5, 'rgba(240,238,255,.85)');
    };

    // Haruno Sakura (Shippuden, war arc): chin-length pink bob, the protector worn high as a hairband,
    // Byakugō diamond on the forehead, red sleeveless qipao top with its white zip, pink elbow pads,
    // black gloves, pink apron-skirt over black shorts, tall black boots.
    function sakuraSpec() {
      const O = '#2a1420', HC = '#f2a0c0', SKIN = '#fbe1d0', TOP = '#c8303f', APRON = '#eca0be', DK = '#28242e', PAD = '#f6bcd2';
      const BAND = { cloth: '#b02a3c', plate: '#c9d1da', symbol: 'leaf' };
      return {
        outline: O, skin: SKIN, skinShade: '#e5ab9a', bulk: -.6, legK: 1.12,
        legs: { thigh: DK, shin: DK, foot: '#221e28', boots: true, w1: 4.8, w2: 4.1 },
        arms: {
          upper: SKIN, lower: SKIN, w1: 3.9, w2: 3.5, hand: DK, bare: true,
          pattern(ctx, p0, p1, p2, far) {
            const k = far ? .2 : 0, g0 = lerp(p1, p2, .45);
            ctx.lineCap = 'round';
            seg(ctx, g0, p2, 5.6, O); seg(ctx, g0, p2, 3.6, dark(DK, k));
            const [s0, s1] = lit(g0, p2, .7); seg(ctx, s0, s1, 1, dark('#5a5470', k));
            paint(ctx, () => ell(ctx, p1[0], p1[1], 2.5, 2.1), dark(PAD, k), O, .7, () => {
              ctx.fillStyle = 'rgba(255,255,255,.45)'; ell(ctx, p1[0] - .5, p1[1] - .8, 1.2, .55); ctx.fill();
            });
          }
        },
        torso: {
          base: TOP, paint: ctx => {
            ctx.fillStyle = '#f2ece6'; ctx.fillRect(3.1, -13.2, 1.1, 12.8);
            ctx.fillStyle = 'rgba(110,16,28,.55)'; ctx.fillRect(4.2, -13.2, .4, 12.8);
            ctx.fillStyle = '#c8ccd8'; ctx.fillRect(2.9, -12.4, 1.5, 1.7);
            ctx.strokeStyle = 'rgba(90,10,20,.45)'; ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-1.6, -9); ctx.quadraticCurveTo(1, -7.2, 3, -8.4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5, -8.6); ctx.quadraticCurveTo(6.4, -7.4, 7.2, -8.6); ctx.stroke();
            // pouch belt
            ctx.fillStyle = '#3a2a34'; ctx.fillRect(-8, -1.6, 17, 1.4);
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-1.6, -12.4); ctx.quadraticCurveTo(-2, -15.6, -.6, -16); ctx.lineTo(4.8, -15.8); ctx.quadraticCurveTo(6, -14, 5.4, -12.2); ctx.quadraticCurveTo(1.8, -11.6, -1.6, -12.4); ctx.closePath(); }, TOP, O, .8, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-3, -14, 4, 3);
            ctx.fillStyle = '#f2ece6'; ctx.fillRect(3.1, -16, 1, 4);
          });
        },
        skirt: {
          color: APRON, hem: 7.4, flare: 1.2, paint: (ctx, hem) => {
            ctx.fillStyle = dark(APRON, .3); ctx.fillRect(-20, hem - 1.3, 40, 1.3);
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-20, hem - 1.3, 40, .35);
          }
        },
        head: {
          drape: HAIR.longBack(HC, 9, 10.6),
          hair: HAIR.smooth(HC, { nape: 9.4 }),
          eyes: { type: 'normal', iris: '#3fae72', fem: true }, mouth: 'smile', attackMouth: 'shout', browColor: '#c86a90', browW: .62,
          marks(ctx) {
            // Byakugō: the violet diamond of the Strength of a Hundred seal.
            paint(ctx, () => poly(ctx, [[4.9, -4.9], [5.7, -3.5], [4.9, -2.2], [4.1, -3.5]]), '#9150d0', '#3a1a5a', .35, () => {
              ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(4.2, -4.9, .7, 1.2);
            });
          },
          front(ctx, spec, pose) {
            ctx.save(); ctx.translate(-.8, -4.2); ctx.rotate(-.07); drawBand(ctx, BAND, O, pose); ctx.restore();
            locks(ctx, spec, HC, [[-1.4, -8, -2.6, 8.8, 1.9, -.7], [10, -6.8, 10.7, 7, 1.4, .5], [1.2, -8.2, .2, -1.6, 1.5, -.3],
              [2.8, -8.4, 2.6, -3.6, 1.1, 0], [7.8, -7.8, 8.9, -2, 1.3, .3]], .8);
          }
        },
        front(ctx, pose, hand) { if (pose.attack) palmGlow(ctx, hand, '255,120,180'); }
      };
    }

    // Hyūga Hinata (Shippuden): long straight indigo hair with a blunt hime fringe and long side locks,
    // pale Byakugan eyes, cream jacket with a lavender yoke and sleeves, navy pants, protector round the neck.
    function hinataSpec() {
      const O = '#18152a', HC = '#2c3268', SKIN = '#fae6d8', JK = '#ece4f2', LAV = '#b2a2dc', LAV_D = '#7d6dbe', PANTS = '#2b3154';
      return {
        outline: O, skin: SKIN, skinShade: '#e2b2a4', bulk: -.5, legK: 1.1,
        legs: { thigh: PANTS, shin: PANTS, foot: '#252a40', w1: 5, w2: 4.2 },
        arms: { upper: LAV, lower: LAV, w1: 4.8, w2: 4.5, cuff: JK, hand: SKIN },
        torso: {
          base: JK, paint: ctx => {
            ctx.fillStyle = LAV; ctx.beginPath(); ctx.moveTo(-8, -13.8); ctx.lineTo(8.4, -13.8); ctx.lineTo(8.4, -10.4); ctx.quadraticCurveTo(1, -8.8, -8, -10.8); ctx.closePath(); ctx.fill();
            ctx.fillStyle = LAV_D; ctx.fillRect(3.1, -12, .9, 12.4);
            ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(4, -12, .3, 12.4);
            ctx.fillStyle = 'rgba(90,70,150,.35)'; ctx.fillRect(-8, -10.4, 17, .5);
            ctx.strokeStyle = 'rgba(90,70,140,.45)'; ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-.4, -5.4); ctx.lineTo(1.8, -3.6); ctx.moveTo(5.4, -5.4); ctx.lineTo(7, -3.8); ctx.stroke();
          }
        },
        collarBack(ctx) {
          // the jacket's hood bunched behind the neck
          paint(ctx, () => smooth(ctx, [[-1.6, -16.6], [-7.8, -16.8], [-9.8, -13], [-7.4, -10.4], [-2, -11.4]]), LAV, O, .85, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-11, -14, 8, 5);
          });
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.6, -13.7, 4.7, 1.9, 0, 0, TAU); }, '#25294a', O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(-4, -13.7, 11, 2); });
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(2.2, -15.1); ctx.lineTo(6.9, -14.7); ctx.quadraticCurveTo(7.4, -13.2, 6.7, -11.8); ctx.lineTo(2.2, -12.2); ctx.closePath(); }, '#c9d1da', O, .6, () => {
            ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(2, -15.1, 5, .5);
            plateSymbol(ctx, 'leaf', 4.6, -13.4, .55, '#5a6470');
          });
        },
        skirt: { color: JK, hem: 13.4, flare: .6, paint: (ctx, hem) => { ctx.fillStyle = LAV; ctx.fillRect(-20, hem - 1.5, 40, 1.5); } },
        head: {
          drape: HAIR.longBack(HC, 34, 11),
          hair: HAIR.smooth(HC, { nape: 8.8 }),
          eyes: { type: 'byakugan', fem: true }, mouth: 'smile', attackMouth: 'shout', browColor: HC, browW: .55,
          front(ctx, spec, pose) {
            locks(ctx, spec, HC, [[-1.6, -8, -2.4, 10.4, 2, -.4], [10.2, -6.6, 10.9, 9.2, 1.4, .3],
              [.8, -8.6, .5, -2.4, 1.35, 0], [3, -8.8, 3, -2.3, 1.35, 0], [5.2, -8.8, 5.3, -2.3, 1.35, 0], [7.4, -8.4, 7.7, -2.4, 1.25, 0], [9.2, -7.6, 9.7, -2.6, 1, 0]], .75);
            if (pose && (pose.seal || pose.attack)) veins(ctx);
          }
        },
        front(ctx, pose, hand) { if (pose.attack) palmGlow(ctx, hand, '170,160,255'); }
      };
    }

    // Hyūga Neji (Shippuden): long dark-brown hair tied near the ends, protector over the caged-bird seal,
    // Byakugan, the long cream-white robe with a dark sash, dark shorts and bandaged shins.
    function nejiSpec() {
      const O = '#18141c', HC = '#2f2326', SKIN = '#f4dcc8', ROBE = '#ede8ec', ROBE_D = '#cbc2cf', SASH = '#4b3a4a', PANTS = '#2b2b3c';
      const BAND = { cloth: '#23232c', plate: '#c9d1da', symbol: 'leaf' };
      return {
        outline: O, skin: SKIN, skinShade: '#d9ab96', legK: 1.12,
        legs: { thigh: PANTS, shin: PANTS, foot: '#23232e', wrap: '#e6e1d8', holster: '#2a2a38', w1: 5.2, w2: 4.3 },
        arms: { upper: ROBE, lower: ROBE, w1: 5.2, w2: 5.1, cuff: ROBE_D, hand: SKIN },
        torso: {
          base: ROBE, paint: ctx => {
            ctx.fillStyle = '#2f2a36'; ctx.beginPath(); ctx.moveTo(-.2, -13.4); ctx.lineTo(5.6, -13.4); ctx.lineTo(3.2, -10.2); ctx.closePath(); ctx.fill();
            line(ctx, [[-.6, -13.4], [3.6, -8], [6.8, -4]], dark(ROBE, .42), .6);
            line(ctx, [[-.2, -13.2], [3.8, -8.3]], 'rgba(255,255,255,.6)', .3);
            ctx.fillStyle = SASH; ctx.fillRect(-8, -4.6, 17, 3.3);
            ctx.fillStyle = light(SASH, .25); ctx.fillRect(-8, -4.4, 17, .5);
            ctx.fillStyle = dark(SASH, .3); ctx.fillRect(-6, -5.1, 2.2, 4.4);
            ctx.strokeStyle = 'rgba(90,80,110,.35)'; ctx.lineWidth = .4;
            for (const [x0, x1] of [[-3.6, -4.2], [1, 1.6]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .6, -8, x1, -4.8); ctx.stroke(); }
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-5.6, -11.6); ctx.lineTo(-6, -16); ctx.quadraticCurveTo(-1, -14.8, 3.4, -14.4); ctx.lineTo(7, -15.2); ctx.lineTo(6.6, -11.8); ctx.closePath(); }, ROBE, O, .85, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-8, -17, 5, 7);
            ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(.4, -14.8, 6, .5);
          });
        },
        skirt: { color: ROBE, hem: 7, flare: 1.4, paint: (ctx, hem) => { ctx.fillStyle = ROBE_D; ctx.fillRect(-20, hem - 1.2, 40, 1.2); } },
        head: {
          drape(ctx, spec) {
            HAIR.longBack(HC, 31, 9.6)(ctx, spec);
            paint(ctx, () => ell(ctx, -6.2, 24.4, 2.8, 1.3, .08), '#e8e4ea', O, .6, () => { ctx.fillStyle = SHADE; ctx.fillRect(-10, 24.4, 8, 2); });
          },
          hair: HAIR.smooth(HC, { nape: 8 }),
          band: BAND,
          eyes: { type: 'byakugan' }, mouth: 'neutral', attackMouth: 'shout', browAngle: 'angry', browColor: '#2a1e20',
          front(ctx, spec, pose) {
            locks(ctx, spec, HC, [[-1.4, -7.8, -2.4, 9.6, 1.9, -.5], [10.2, -6.2, 10.9, 8, 1.4, .4], [8.6, -7.4, 9.4, -1.4, 1.1, .3]], .8);
            if (pose && (pose.seal || pose.attack)) veins(ctx);
          }
        },
        front(ctx, pose, hand) { if (pose.attack) palmGlow(ctx, hand, '200,215,255'); }
      };
    }

    // Nara Shikamaru (Shippuden): black hair pulled back into the spiky high ponytail, lazy half-lidded eyes,
    // Asuma's earrings, the green chūnin flak vest over a dark shirt, protector tied round his upper arm.
    function shikamaruSpec() {
      const O = '#141814', HC = '#1b1b22', SKIN = '#efd2b4', VEST = '#6b7b3f', SHIRT = '#2c3142', PANTS = '#2c3142';
      return {
        outline: O, skin: SKIN, skinShade: '#cfa48a', legK: 1.12,
        legs: { thigh: PANTS, shin: PANTS, foot: '#222838', wrap: '#e4e0d6', holster: '#202838', w1: 5.2, w2: 4.3 },
        arms: {
          upper: SHIRT, lower: SHIRT, w1: 4.6, w2: 4, cuff: '#3a4054', hand: SKIN,
          pattern(ctx, p0, p1, p2, far) {
            if (far) return;
            const m = lerp(p0, p1, .5), a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(a);
            paint(ctx, () => { ctx.beginPath(); ctx.rect(-2, -3.1, 4, 6.2); }, '#1e2230', O, .55);
            paint(ctx, () => { ctx.beginPath(); ctx.rect(-1.5, -2.3, 3, 4.6); }, '#c9d1da', O, .5, () => {
              ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-1.5, -2.3, .6, 4.6);
            });
            ctx.rotate(Math.PI / 2); plateSymbol(ctx, 'leaf', 0, 0, .5, '#5a6470');
            ctx.restore();
          }
        },
        torso: { base: SHIRT, over(ctx, pose) { flakVest(VEST, { outline: O })(ctx, pose); } },
        head: {
          back(ctx, spec) {
            // the high spiky ponytail
            const pts = [[-2.8, -10.6], [-3.6, -21], [-6.6, -15.8], [-8.4, -22.6], [-9.6, -16.2], [-13.2, -21], [-11.8, -15],
              [-16.6, -17.2], [-12.8, -12.6], [-15.6, -11.4], [-10.4, -9.4]];
            paint(ctx, () => poly(ctx, pts), HC, O, 1.05, () => {
              ctx.fillStyle = dark(HC, .3); ctx.fillRect(-20, -14, 20, 8);
              ctx.strokeStyle = '#3a4058'; ctx.lineWidth = .4;
              for (const [x0, y0, x1, y1] of [[-4.6, -12, -4.2, -19], [-7.4, -12, -8.2, -20], [-9.6, -12, -12.4, -19], [-10.6, -11.6, -15, -15.6]]) {
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
              }
              ctx.strokeStyle = '#8a96c8'; ctx.lineWidth = .9;
              ctx.beginPath(); ctx.moveTo(-4.4, -17.6); ctx.lineTo(-7.6, -18.8); ctx.stroke();
            });
            paint(ctx, () => ell(ctx, -6.8, -11.2, 3, 1.3, -.25), '#3a3a46', O, .6);
          },
          hair: HAIR.smooth(HC, { nape: 6.4 }),
          eyes: { type: 'normal', iris: '#2a2b30' }, mouth: 'neutral', attackMouth: 'frown', browColor: HC, browW: .8, blush: false,
          marks(ctx, spec) {
            lazyLid(ctx, 2.4, 2.2, 2.1, 2.65, true, spec.skin, spec.outline);
            lazyLid(ctx, 7.95, 2.1, 1.48, 2.45, false, spec.skin, spec.outline);
            dot(ctx, -3.3, 5.1, .75, '#c9a64a'); dot(ctx, -3.5, 4.85, .26, '#fff4c0');
          },
          front(ctx, spec) {
            locks(ctx, spec, HC, [[-1.4, -7.6, -2.2, 2.6, 1.4, -.4], [9.8, -6, 10.4, -.6, 1, .3]], .75);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack) return;
          // Asuma's trench knife, wind chakra flowing off the blade.
          const [hx, hy] = hand;
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(hx + 1, hy - 1.2); ctx.lineTo(hx + 10.5, hy - 2.6); ctx.lineTo(hx + 1.4, hy + .6); ctx.closePath(); }, '#c8d0dc', O, .55, () => {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(hx, hy - 2.4, 11, .6);
          });
          line(ctx, [[hx - 1.6, hy - 1.6], [hx - 1.6, hy + 1.8]], O, 1.4);
          dot(ctx, hx + 6, hy - 1.6, 4, 'rgba(170,230,255,.35)');
        }
      };
    }

    S.addSprite('sakura', sakuraSpec(), { scale: 1.14, box: [-38, -84, 38, 8] }, { hair: '#f2a0c0', fringe: 'part', accent: '#ff8ab8', marks: ['byakugo'] });
    S.addSprite('hinata', hinataSpec(), { scale: 1.12, box: [-38, -84, 38, 8] }, { hair: '#2c3268', fringe: 'part', accent: '#b8a0ff', long: true });
    S.addSprite('neji', nejiSpec(), { scale: 1.18, box: [-38, -86, 38, 8] }, { hair: '#2f2326', fringe: 'part', accent: '#d8d0f0', long: true });
    S.addSprite('shikamaru', shikamaruSpec(), { scale: 1.18, box: [-38, -90, 38, 8] }, { hair: '#1b1b22', fringe: 'slick', accent: '#9ab07a' });
  })();

  // ================================================================== members / moves
  const members = {
    sakura: { name: 'HARUNO SAKURA — BÁCH HÀO', accent: '#ff8ab8', hpScale: 3.0, damageScale: 1.75, armor: .92 },
    hinata: { name: 'HYŪGA HINATA — NHU QUYỀN', accent: '#b8a0ff', hpScale: 2.8, damageScale: 1.7 },
    neji: { name: 'HYŪGA NEJI — BÁT QUÁI', accent: '#d8d0f0', hpScale: 2.9, damageScale: 1.72 },
    shikamaru: { name: 'NARA SHIKAMARU — ẢNH THUẬT', accent: '#9ab07a', hpScale: 2.8, damageScale: 1.65 }
  };
  const order = Object.keys(members);
  const pick = level => order[((level % order.length) + order.length) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    sakura: {
      oka:     { label: 'ANH HOA XUNG', rgb: '255,120,175', windup: .8, after: 1.1 },
      heel:    { label: 'THỐNG THIÊN CƯỚC', rgb: '255,140,190', windup: .9, after: 1.2 },
      rush:    { label: 'SHANNARŌ · LIÊN HOÀN QUYỀN', shout: 'SHANNARŌ!', rgb: '255,110,160', windup: .65, after: 1.1 },
      regen:   { label: 'BÁCH HÀO CHI THUẬT', rgb: '200,120,255', windup: .6, after: 1.0 },
      katsuyu: { label: 'KHẨU KÝ · KATSUYU', rgb: '150,230,200', windup: 1.0, after: 1.3 },
      byakugo: { label: 'BÁCH HÀO · ANH HOA ĐẠI XUNG', shout: 'SHANNARŌ!!!', rgb: '255,90,170', windup: 1.4, after: 1.8 }
    },
    hinata: {
      palms:   { label: 'BÁT QUÁI · LỤC THẬP TỨ CHƯỞNG', rgb: '170,160,255', windup: .8, after: 1.1 },
      lions:   { label: 'NHU BỘ · SONG SƯ QUYỀN', rgb: '160,150,255', windup: 1.0, after: 1.2 },
      guard:   { label: 'BÁT QUÁI · HỘ THÂN LỤC THẬP TỨ CHƯỞNG', rgb: '150,190,255', windup: .5, after: 1.0 },
      kusho:   { label: 'BÁT QUÁI · KHÔNG CHƯỞNG', rgb: '200,200,255', windup: .7, after: 1.0 },
      jab:     { label: 'NHU QUYỀN · BỘ PHÁP LIÊN CHƯỞNG', rgb: '190,170,255', windup: .6, after: 1.0 },
      hamura:  { label: 'BẠCH NHÃN · SONG SƯ QUYỀN · HAMURA', shout: 'TA SẼ KHÔNG BỎ CUỘC!', rgb: '190,170,255', windup: 1.5, after: 1.9 }
    },
    neji: {
      kaiten:  { label: 'BÁT QUÁI · HỒI THIÊN', rgb: '200,225,255', windup: .45, after: 1.0 },
      palms:   { label: 'BÁT QUÁI · LỤC THẬP TỨ CHƯỞNG', rgb: '210,220,255', windup: .8, after: 1.1 },
      kusho:   { label: 'BÁT QUÁI · KHÔNG CHƯỞNG LIÊN XẠ', rgb: '200,230,255', windup: .7, after: 1.0 },
      kuheki:  { label: 'BÁT QUÁI · KHÔNG BÍCH CHƯỞNG', rgb: '190,215,255', windup: .85, after: 1.1 },
      kunai:   { label: 'KHỔ VÔ · BÁT QUÁI LOẠN XẠ', rgb: '230,230,240', windup: .55, after: .9 },
      hyakuni: { label: 'BÁT QUÁI · BÁCH NHỊ THẬP BÁT CHƯỞNG', shout: 'NGƯƠI ĐÃ Ở TRONG TẦM BÁT QUÁI!', rgb: '210,225,255', windup: 1.3, after: 1.9 }
    },
    shikamaru: {
      kage:    { label: 'ẢNH MÔ PHỎNG THUẬT', rgb: '150,120,210', windup: .6, after: 1.0 },
      kubi:    { label: 'ẢNH THỦ PHƯỢC THUẬT', rgb: '150,110,210', windup: .85, after: 1.1 },
      nui:     { label: 'ẢNH KHÂU THUẬT', rgb: '160,130,220', windup: .8, after: 1.0 },
      knives:  { label: 'PHONG ĐỘN · PHI YẾN SONG ĐAO', rgb: '170,230,255', windup: .65, after: 1.0 },
      tags:    { label: 'BẪY BỘC PHÙ · LIÊN HOÀN', rgb: '255,170,90', windup: .9, after: 1.1 },
      mass:    { label: 'ẢNH MÔ PHỎNG · BỘC PHÙ ĐẠI TRẬN', shout: 'PHIỀN PHỨC THẬT ĐẤY...', rgb: '150,110,220', windup: 1.3, after: 1.9 }
    }
  };
  // AI rotation (every move shows inside ~25 s) and the manual key order (ultimate last).
  const ROTATION = {
    sakura: ['oka', 'rush', 'regen', 'heel', 'katsuyu', 'byakugo', 'rush', 'oka', 'heel', 'regen', 'katsuyu', 'byakugo'],
    hinata: ['palms', 'kusho', 'lions', 'guard', 'jab', 'hamura', 'kusho', 'palms', 'jab', 'lions', 'guard', 'hamura'],
    neji: ['kusho', 'palms', 'kaiten', 'kuheki', 'kunai', 'hyakuni', 'kuheki', 'kusho', 'kaiten', 'palms', 'kunai', 'hyakuni'],
    shikamaru: ['kage', 'knives', 'nui', 'tags', 'kubi', 'mass', 'knives', 'kage', 'tags', 'nui', 'kubi', 'mass']
  };
  const MANUAL = {
    sakura: ['oka', 'heel', 'rush', 'regen', 'katsuyu', 'byakugo'],
    hinata: ['palms', 'lions', 'guard', 'kusho', 'jab', 'hamura'],
    neji: ['kaiten', 'palms', 'kusho', 'kuheki', 'kunai', 'hyakuni'],
    shikamaru: ['kage', 'kubi', 'nui', 'knives', 'tags', 'mass']
  };
  const MOVE_LISTS = {};
  for (const id in MANUAL) MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[id][k].label }));
  const moveLabels = {};
  for (const id in MOVES) for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }

  function state(z) {
    return z.rk || (z.rk = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y, tele: [], ev: [], fx: [],
      dash: null, arc: null, lift: 0, hold: 0, seed: 0, regen: 0, seal: 0, dome: 0, domeKind: '', lion: 0, bind: null, bindCd: 0, spots: null, lastDraw: 0 });
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
  const bodyH = id => (Spr() && Spr().has && Spr().has(id) ? Spr().height(id) : 88);
  // The unit a bind / pull works on: api.player, or (manual mode: a cursor pseudo-target) the nearest foe.
  const victim = (api, x, y, r) => { const p = api.player; if (p && !p.pseudo) return p; return api.nearestFoe ? api.nearestFoe(x, y, r) : null; };

  function conePts(x, y, a, reach, half, step = 85) {
    const out = [];
    for (let d = 70; d <= reach; d += step) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 120)), r = Math.max(56, (2 * half * d / cnt) * .64);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .9);
        out.push({ x: x + Math.cos(aa) * d, y: y + Math.sin(aa) * d, r, d });
      }
    }
    return out;
  }
  // Hit points along a ring (so a widening shock ring does not hit the centre again).
  function ringPts(x, y, R0, n, r) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = i * TAU / n; out.push({ x: x + Math.cos(a) * R0, y: y + Math.sin(a) * R0, r }); }
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
  const heal = (z, frac) => { z.health = Math.min(z.maxHealth, z.health + z.maxHealth * frac); };

  // ================================================================== telegraphs
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: ox, y: oy, a: aa, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    if (id === 'sakura') switch (move) {
      case 'oka': return [circ(tx, ty, 250), line(d, 24)];
      case 'heel': return [circ(tx, ty, 200), line(640, 64, a, tx, ty)];
      case 'rush': return [circ(tx, ty, 300, true)];
      case 'regen': return [circ(x, y, 240, true)];
      case 'katsuyu': {
        const f = ca >= 0 ? 1 : -1, sx = x - f * 70, sy = y - 95, mx = sx + f * 128, my = sy + 14;
        const ba = Math.atan2(ty - my, tx - mx);
        st.spots = [{ x: R(sx), y: R(sy), f, mx: R(mx), my: R(my), a: r1(ba) }];
        return [{ k: 'cone', x: mx, y: my, a: ba, r: 640, h: .4 }];
      }
      case 'byakugo': return [circ(tx, ty, 560), circ(tx, ty, 250), line(d, 30)];
    }
    if (id === 'hinata') switch (move) {
      case 'palms': return [circ(tx, ty, 210), line(Math.max(0, d - 50), 24)];
      case 'lions': { const len = Math.max(260, Math.min(720, d + 90)); st.spots = [{ len }]; return [line(len, 60), circ(x + ca * len, y + sa * len, 230)]; }
      case 'guard': return [circ(x, y, 240)];
      case 'kusho': return [{ k: 'cone', x, y, a, r: 640, h: .34 }];
      case 'jab': return [circ(tx, ty, 260, true)];
      case 'hamura': {
        const lanes = [];
        for (const s of [-1, 1]) {
          const ox = x - ca * 60 + -sa * s * 230, oy = y - sa * 60 + ca * s * 230;
          const la = Math.atan2(ty - oy, tx - ox), ll = Math.min(1150, Math.hypot(tx - ox, ty - oy) + 220);
          lanes.push({ x0: R(ox), y0: R(oy), a: r1(la), len: R(ll) });
        }
        st.spots = lanes;
        return [line(lanes[0].len, 100, lanes[0].a, lanes[0].x0, lanes[0].y0), line(lanes[1].len, 100, lanes[1].a, lanes[1].x0, lanes[1].y0), circ(tx, ty, 420)];
      }
    }
    if (id === 'neji') switch (move) {
      case 'kaiten': return [circ(x, y, 200)];
      case 'palms': return [circ(tx, ty, 220), line(Math.max(0, d - 50), 24)];
      case 'kusho': return [line(860, 46, a - .16), line(860, 46, a), line(860, 46, a + .16)];
      case 'kuheki': return [{ k: 'cone', x, y, a, r: 700, h: .55 }];
      case 'kunai': return [{ k: 'cone', x, y, a, r: 560, h: .5 }];
      case 'hyakuni': return [circ(tx, ty, 380), circ(tx, ty, 160, true), line(Math.max(0, d - 50), 30)];
    }
    if (id === 'shikamaru') switch (move) {
      case 'kage': { const len = Math.min(820, Math.max(160, d)); st.spots = [{ len }]; return [line(len, 26), circ(x + ca * len, y + sa * len, 70, true)]; }
      case 'kubi': return [circ(tx, ty, 170), line(d, 20)];
      case 'nui': return [-.5, -.25, 0, .25, .5].map(o => line(680, 30, a + o));
      case 'knives': return [line(620, 56), circ(x + ca * 240, y + sa * 240, 120, true)];
      case 'tags': {
        const pts = [{ x: tx, y: ty }], b = Math.random() * TAU;
        for (let i = 0; i < 8; i++) pts.push({ x: tx + Math.cos(b + i * TAU / 8) * 210, y: ty + Math.sin(b + i * TAU / 8) * 210 });
        st.spots = pts.map((p, i) => ({ x: R(p.x), y: R(p.y), t0: r1(i * .07) }));
        return st.spots.map(p => circ(p.x, p.y, 110));
      }
      case 'mass': return [circ(x, y, 640), circ(x, y, 640 * .55, true)];
    }
    return [];
  }

  function announce(z, st, api, forced) {
    const id = z.bossId, rot = ROTATION[id], move = forced || rot[st.casts % rot.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = R(p ? p.x : z.x); st.ty = R(p ? p.y : z.y);
    st.seed = r1(Math.random() * 99);
    st.tele = teleFor(z, st, id, move);
    z.angle = st.aim;
    if (id === 'sakura' && move === 'byakugo') st.seal = Math.max(st.seal, def.windup + 2.6);
    if (id === 'hinata' && (move === 'lions' || move === 'hamura')) st.lion = def.windup + (move === 'hamura' ? .6 : .5);
    if (id === 'sakura' && move === 'katsuyu') {
      const s = st.spots[0];
      addFx(st, { kind: 'slug', x: s.x, y: s.y, f: s.f, mx: s.mx, my: s.my, a: s.a, dur: def.windup + 4.4, born: def.windup });
    }
  }

  // ================================================================== movement helpers
  function startDash(z, st, a, len, dur, dmg, w, end, rgb, heavy) {
    st.dash = { a: r1(a), speed: len / dur, left: dur, hit: 0, wt: 0, w, dmg, end, heavy: heavy ? 1 : 0 };
    addFx(st, { kind: 'dash', pts: [], a: r1(a), dur: dur + .45, x0: R(z.x), y0: R(z.y), x1: R(z.x), y1: R(z.y), rgb: rgb || '255,255,255', id: z.bossId });
  }
  function startArc(z, st, x1, y1, dur, h, end) {
    st.arc = { t: 0, dur, h, x0: z.x, y0: z.y, x1, y1, end };
  }
  const toward = (z, st, api, stop) => {
    const spot = freeSpot(api, st.tx, st.ty, z.r) || { x: z.x, y: z.y };
    const d = Math.hypot(spot.x - z.x, spot.y - z.y), a = Math.atan2(spot.y - z.y, spot.x - z.x);
    const len = Math.max(0, d - (stop || 0));
    return { x: z.x + Math.cos(a) * len, y: z.y + Math.sin(a) * len, len, a };
  };

  // ================================================================== casting
  function cast(z, st, api) {
    const id = z.bossId, D = api.damage || 60, a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    if (id === 'sakura') castSakura(z, st, api, st.move, D, a, ca, sa);
    else if (id === 'hinata') castHinata(z, st, api, st.move, D, a, ca, sa);
    else if (id === 'neji') castNeji(z, st, api, st.move, D, a, ca, sa);
    else castShikamaru(z, st, api, st.move, D, a, ca, sa);
  }

  // ------------------------------------------------------------------ Sakura
  function castSakura(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'oka': {
        const spot = freeSpot(api, st.tx, st.ty, z.r) || { x: z.x, y: z.y };
        startArc(z, st, spot.x, spot.y, .5, 130, api => {
          api.strike(z.x, z.y, 250, D * 2.4, null, 'crater', true);
          api.knockback(z, 260, 150, 0);
          api.world(z.x, z.y, 210, D * 3, 'crater');
          api.shake(18);
          addFx(st, { kind: 'crater', x: R(z.x), y: R(z.y), r: 250, dur: 3.4 });
        });
        st.hold = .9;
        break;
      }
      case 'heel': {
        const spot = freeSpot(api, st.tx, st.ty, z.r) || { x: z.x, y: z.y };
        startArc(z, st, spot.x, spot.y, .72, 270, api => {
          const x0 = z.x, y0 = z.y;
          api.strike(x0, y0, 200, D * 2.2, null, 'crater', true);
          api.shake(16);
          addFx(st, { kind: 'crater', x: R(x0), y: R(y0), r: 200, dur: 3 });
          addFx(st, { kind: 'fissure', x: R(x0), y: R(y0), a: r1(a), len: 640, dur: 3.4 });
          for (let d = 120, i = 0; d <= 640; d += 95, i++) {
            const px = x0 + ca * d, py = y0 + sa * d;
            later(st, .08 + d / 1500, api => { api.strike(px, py, 72, D * 1.25, null, i % 2 ? null : 'earth', true); if (i === 5) api.shake(8); });
          }
          later(st, .45, api => api.world(x0 + ca * 520, y0 + sa * 520, 130, D * 2.4, 'earth', a));
        });
        st.hold = 1.3;
        break;
      }
      case 'rush': {
        for (let k = 0; k < 3; k++) later(st, k * .5, api => {
          const q = api.player; if (!q) return;
          const aa = Math.atan2(q.y - z.y, q.x - z.x) + (k === 1 ? .35 : k === 2 ? -.2 : 0);
          const len = Math.min(560, Math.max(120, Math.hypot(q.x - z.x, q.y - z.y) - 20));
          addFx(st, { kind: 'lineMark', x: R(z.x), y: R(z.y), a: r1(aa), len: R(len), w: 44, dur: .34, rgb: '255,120,175' });
          later(st, .3, api => startDash(z, st, aa, len, .13, D * 1.1, 44, api => {
            const big = k === 2;
            api.strike(z.x, z.y, big ? 210 : 150, D * (big ? 2.0 : 1.4), null, big ? 'crater' : 'earth', true);
            if (big) { api.knockback(z, 220, 170, 0); api.world(z.x, z.y, 150, D * 2.2, 'crater'); }
            api.shake(big ? 15 : 8);
            addFx(st, { kind: 'crater', x: R(z.x), y: R(z.y), r: big ? 210 : 150, dur: big ? 2.8 : 2, small: big ? 0 : 1 });
          }, '255,150,190'));
        });
        st.hold = 1.65;
        break;
      }
      case 'regen': {
        st.regen = 4.2; st.seal = Math.max(st.seal, 4.4);
        later(st, .15, api => {
          api.strike(z.x, z.y, 240, D * 1.0, null, 'shockwave', true);
          api.knockback(z, 250, 170, 0);
          api.shake(9);
          addFx(st, { kind: 'burst', x: R(z.x), y: R(z.y), r: 250, dur: 1.2, rgb: '210,120,255' });
        });
        st.hold = .5;
        break;
      }
      case 'katsuyu': {
        const s = st.spots && st.spots[0]; if (!s) break;
        const f = st.fx.find(q => q.kind === 'slug' && q.x === s.x && q.y === s.y);
        // Acid spray (Zessei Nensan): two pulses down the cone, then puddles that keep burning.
        for (let k = 0; k < 3; k++) later(st, k * .28, api => {
          conePts(s.mx, s.my, s.a, 640 * (.7 + k * .15), .4).forEach(q => api.strike(q.x, q.y, q.r, D * .75, null, null, true));
          api.shake(5);
        });
        const pts = [];
        for (let i = 0; i < 7; i++) {
          const dd = 180 + i * 70, an = s.a + (hash(i * 3 + st.seed) - .5) * .7;
          pts.push({ x: R(s.mx + Math.cos(an) * dd), y: R(s.my + Math.sin(an) * dd), r: 56 + i * 6, t0: r1(.2 + i * .06) });
        }
        const acid = addFx(st, { kind: 'acid', pts, dur: 3.8, tick: .5 });
        acid.upd = (q, dt, api) => {
          if ((q.tick -= dt) > 0) return; q.tick = .5;
          for (const p of q.pts) if (q.age > p.t0 + .1 && q.age < q.dur - .6) api.strike(p.x, p.y, p.r, D * .22, null, null, true);
        };
        later(st, .5, api => api.world(s.mx + Math.cos(s.a) * 380, s.my + Math.sin(s.a) * 380, 140, D * 2, 'vortex', s.a));
        // ...then Katsuyu splits into small slugs that crawl back and heal her.
        if (f) f.split = 2.4;
        for (let i = 0; i < 8; i++) later(st, 2.4 + .9 + i * .06, () => heal(z, .011));
        st.hold = 1.2;
        break;
      }
      case 'byakugo': {
        const spot = freeSpot(api, st.tx, st.ty, z.r) || { x: z.x, y: z.y };
        st.seal = Math.max(st.seal, 3);
        startArc(z, st, spot.x, spot.y, .95, 360, api => {
          const x0 = z.x, y0 = z.y;
          api.strike(x0, y0, 250, D * 3.4, null, 'crater', true);
          api.world(x0, y0, 260, D * 4, 'crater');
          api.shake(30);
          addFx(st, { kind: 'crater', x: R(x0), y: R(y0), r: 560, dur: 5, big: 1 });
          [[250, 400, .16], [400, 560, .36]].forEach(([r0, r1v, t], i) => later(st, t, api => {
            ringPts(x0, y0, (r0 + r1v) / 2, 14, (r1v - r0) * .62 + 30).forEach(q => api.strike(q.x, q.y, q.r, D * 1.6, null, null, true));
            for (let j = 0; j < 4; j++) { const an = j * TAU / 4 + i; api.world(x0 + Math.cos(an) * r1v * .8, y0 + Math.sin(an) * r1v * .8, 140, D * 2.6, 'earth', an); }
            api.knockback({ x: x0, y: y0 }, r1v + 40, 150, 0);
            api.shake(18 - i * 4);
          }));
        });
        st.hold = 1.9;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Hinata / Neji shared: 64 Palms
  function castPalms(z, st, api, D, rgb, r, n, final, counts, big) {
    const go = () => {
      const fx = addFx(st, { kind: 'trigram', x: R(z.x), y: R(z.y), r, dur: n * .16 + 1.4, rgb, counts, big: big ? 1 : 0, id: z.bossId });
      for (let k = 0; k < n; k++) later(st, .18 + k * .15, api => {
        api.strike(z.x, z.y, r * .62, D * (big ? .55 : .45), null, null, true);
        if (k % 2) api.shake(4);
        fx.hit = k + 1;
      });
      later(st, .2 + n * .15, api => {
        api.strike(z.x, z.y, r * .78, D * final, null, 'shockwave', true);
        api.knockback(z, r, big ? 240 : 170, 0);
        if (big) api.world(z.x, z.y, 220, D * 3, 'crater');
        api.shake(big ? 22 : 12);
        addFx(st, { kind: 'burst', x: R(z.x), y: R(z.y), r: r * (big ? 1.15 : .9), dur: 1.1, rgb });
      });
      st.hold = .4 + n * .15 + .3;
    };
    const t = toward(z, st, api, 46);
    if (t.len > 20) { startDash(z, st, t.a, t.len, .18, D * .8, 40, go, rgb); st.hold = 2.4; } else go();
  }

  // ------------------------------------------------------------------ Hinata
  function castHinata(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'palms': castPalms(z, st, api, D, '170,160,255', 210, 6, 1.4, ['2', '4', '8', '16', '32', '64'], false); break;
      case 'lions': {
        const len = st.spots ? st.spots[0].len : 500;
        st.lion = Math.max(st.lion, .5);
        startDash(z, st, a, len, .34, D * 1.3, 60, api => {
          api.strike(z.x, z.y, 230, D * 2.3, null, 'shockwave', true);
          api.knockback(z, 240, 190, 0);
          api.world(z.x + ca * 60, z.y + sa * 60, 160, D * 2.4, 'shockwave', a);
          api.shake(16);
          addFx(st, { kind: 'lionburst', x: R(z.x), y: R(z.y), a: r1(a), r: 230, dur: 1.3, rgb: '170,160,255' });
        }, '180,170,255');
        st.hold = .5;
        break;
      }
      case 'guard': {
        st.dome = 2.3; st.domeKind = 'guard';
        addFx(st, { kind: 'dome', r: 240, dur: 2.5, sub: 'guard' });
        for (let k = 0; k < 11; k++) later(st, .1 + k * .2, api => {
          api.strike(z.x, z.y, 240, D * .36, null, null, true);
          if (k % 3 === 0) api.shake(4);
        });
        later(st, 2.25, api => { api.knockback(z, 260, 180, D * .6); api.shake(10); addFx(st, { kind: 'burst', x: R(z.x), y: R(z.y), r: 260, dur: 1, rgb: '150,190,255' }); });
        st.hold = 2.35;
        break;
      }
      case 'kusho': {
        addFx(st, { kind: 'palmwave', x: R(z.x), y: R(z.y), a: r1(a), r: 640, h: .34, dur: 1.1, rgb: '200,200,255' });
        [0, .1, .2].forEach((t, k) => later(st, t, api => {
          conePts(z.x, z.y, a, 640 * (.55 + k * .22), .34).forEach(q => { if (q.d > 640 * (.3 + k * .2) - 100) api.strike(q.x, q.y, q.r, D * .75, null, null, true); });
          api.shake(6);
        }));
        later(st, .12, api => api.knockback({ x: z.x - ca * 40, y: z.y - sa * 40 }, 380, 200, 0));
        later(st, .25, api => api.world(z.x + ca * 420, z.y + sa * 420, 130, D * 2, 'shockwave', a));
        st.hold = .6;
        break;
      }
      case 'jab': {
        for (let k = 0; k < 3; k++) later(st, k * .45, api => {
          const q = api.player; if (!q) return;
          const off = k === 2 ? 0 : (k ? -1 : 1) * .7, oa = Math.atan2(q.y - z.y, q.x - z.x);
          const len = Math.min(480, Math.max(100, Math.hypot(q.x - z.x, q.y - z.y) - 30)), aa = oa + off * .4;
          addFx(st, { kind: 'lineMark', x: R(z.x), y: R(z.y), a: r1(aa), len: R(len), w: 40, dur: .3, rgb: '190,170,255' });
          later(st, .28, api => startDash(z, st, aa, len, .14, D * .9, 40, api => {
            api.strike(z.x + Math.cos(aa) * 30, z.y + Math.sin(aa) * 30, 140, D * 1.35, null, k === 2 ? 'shockwave' : null, true);
            if (k === 2) api.knockback(z, 170, 160, 0);
            api.shake(k === 2 ? 10 : 6);
            addFx(st, { kind: 'palmhit', x: R(z.x + Math.cos(aa) * 34), y: R(z.y + Math.sin(aa) * 34), a: r1(aa), dur: .7, rgb: '190,170,255', big: k === 2 ? 1 : 0 });
          }, '200,180,255'));
        });
        st.hold = 1.5;
        break;
      }
      case 'hamura': {
        const lanes = st.spots || [];
        const fx = addFx(st, { kind: 'hamura', lanes, tx: st.tx, ty: st.ty, dur: 3.6, T: 1.05 });
        lanes.forEach((l, li) => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 80; d <= l.len; d += 110) later(st, d / l.len * fx.T, api => api.strike(l.x0 + c * d, l.y0 + s * d, 100, D * 1.1, null, null, true));
          later(st, fx.T * .6, api => api.world(l.x0 + c * l.len * .55, l.y0 + s * l.len * .55, 140, D * 2.4, 'shockwave', l.a));
        });
        later(st, fx.T * .82, api => {
          api.strike(st.tx, st.ty, 420, D * 3.0, null, 'crater', true);
          api.knockback({ x: fx.tx, y: fx.ty }, 440, 230, 0);
          api.world(fx.tx, fx.ty, 260, D * 3.6, 'crater');
          api.shake(28);
        });
        st.hold = 1.6;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Neji
  function castNeji(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'kaiten': {
        st.dome = 1.35; st.domeKind = 'kaiten';
        addFx(st, { kind: 'dome', r: 200, dur: 1.6, sub: 'kaiten' });
        api.knockback(z, 210, 150, D * .8);
        for (let k = 0; k < 6; k++) later(st, .12 + k * .2, api => api.strike(z.x, z.y, 200, D * .45, null, k === 5 ? 'vortex' : null, true));
        later(st, 1.3, api => { api.knockback(z, 250, 200, D * .6); api.shake(12); addFx(st, { kind: 'burst', x: R(z.x), y: R(z.y), r: 240, dur: 1, rgb: '200,225,255' }); });
        st.hold = 1.4;
        break;
      }
      case 'palms': castPalms(z, st, api, D, '210,220,255', 220, 6, 1.5, ['2', '4', '8', '16', '32', '64'], false); break;
      case 'kusho': {
        [-.16, 0, .16].forEach((o, k) => later(st, k * .22, api => {
          const aa = a + o, c = Math.cos(aa), s = Math.sin(aa), x0 = z.x, y0 = z.y, sp = 1400;
          addFx(st, { kind: 'airshot', x: R(x0), y: R(y0), a: r1(aa), len: 860, sp, dur: 860 / sp + .5, rgb: '200,230,255' });
          for (let d = 80; d <= 860; d += 85) later(st, d / sp, api => api.strike(x0 + c * d, y0 + s * d, 66, D * 1.05, null, d > 780 ? 'shockwave' : null, true));
          api.shake(5);
        }));
        st.hold = .9;
        break;
      }
      case 'kuheki': {
        const x0 = z.x, y0 = z.y;
        addFx(st, { kind: 'wall', x: R(x0), y: R(y0), a: r1(a), len: 700, h: .55, dur: 1.2, rgb: '190,215,255' });
        [180, 340, 500, 660].forEach((d, k) => later(st, k * .1, api => {
          const half = d * .55 * 1.05, nx = -sa, ny = ca;
          api.line(x0 + ca * d - nx * half, y0 + sa * d - ny * half, x0 + ca * d + nx * half, y0 + sa * d + ny * half, 60, D * .95, k === 3 ? 'shockwave' : null);
          // the wall shoves whoever it catches
          const p = victim(api, x0 + ca * d, y0 + sa * d, half + 80);
          if (p && !p.remote) {
            const along = (p.x - x0) * ca + (p.y - y0) * sa, across = Math.abs(-(p.x - x0) * sa + (p.y - y0) * ca);
            if (along > d - 110 && along < d + 60 && across < half + 30) {
              const nxp = p.x + ca * 70, nyp = p.y + sa * 70;
              if (!api.blocked(nxp, nyp, p.r || 14)) { p.x = nxp; p.y = nyp; }
            }
          }
          api.shake(6 + k * 2);
        }));
        st.hold = .7;
        break;
      }
      case 'kunai': {
        const n = 9;
        for (let w = 0; w < 2; w++) later(st, w * .2, api => {
          for (let i = 0; i < n; i++) {
            const aa = a + (i / (n - 1) - .5) * 1.0 + (w ? .055 : 0);
            api.projectile(z, aa, 820, D * .7, 'shuriken', '#d8dce8', .75);
          }
        });
        addFx(st, { kind: 'burst', x: R(z.x), y: R(z.y), r: 90, dur: .5, rgb: '230,230,240' });
        st.hold = .5;
        break;
      }
      case 'hyakuni': {
        const go = () => {
          const fx = addFx(st, { kind: 'trigram', x: R(z.x), y: R(z.y), r: 380, dur: 4.2, rgb: '210,225,255', counts: ['2', '4', '8', '16', '32', '64', '128'], big: 1, id: 'neji' });
          for (let k = 0; k < 7; k++) later(st, .2 + k * .22, api => {
            api.strike(z.x, z.y, 200, D * .62, null, null, true);
            api.shake(5 + k);
            fx.hit = k + 1;
          });
          // the last palm: a Kūshō blast, then the Great Rotation.
          later(st, .2 + 7 * .22, api => {
            const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : a;
            addFx(st, { kind: 'palmwave', x: R(z.x), y: R(z.y), a: r1(aa), r: 900, h: .3, dur: 1.2, rgb: '210,225,255', big: 1 });
            conePts(z.x, z.y, aa, 900, .3).forEach(p => api.strike(p.x, p.y, p.r, D * 1.6, null, null, true));
            api.world(z.x + Math.cos(aa) * 600, z.y + Math.sin(aa) * 600, 160, D * 3, 'shockwave', aa);
            api.shake(18);
          });
          later(st, .2 + 7 * .22 + .5, api => {
            st.dome = 1.2; st.domeKind = 'kaiten';
            addFx(st, { kind: 'dome', r: 380, dur: 1.5, sub: 'kaiten', big: 1 });
            api.strike(z.x, z.y, 380, D * 2.4, null, 'crater', true);
            api.knockback(z, 400, 240, 0);
            api.world(z.x, z.y, 260, D * 3.6, 'crater');
            api.shake(26);
          });
          st.hold = .2 + 7 * .22 + 1.8;
        };
        const t = toward(z, st, api, 46);
        if (t.len > 20) { startDash(z, st, t.a, t.len, .2, D * .8, 40, go, '210,225,255'); st.hold = 3.6; } else go();
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Shikamaru
  function bindNear(st, api, x, y, r, dur, sx, sy) {
    if (st.bindCd > 0) return false;
    const p = victim(api, x, y, r + 40);
    if (!p || Math.hypot(p.x - x, p.y - y) > r + (p.r || 14)) return false;
    st.bind = { x: R(p.x), y: R(p.y), t: dur, dur, sx: R(sx), sy: R(sy) };
    st.bindCd = dur + 2.2;
    return true;
  }
  function castShikamaru(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'kage': {
        const len = st.spots ? st.spots[0].len : 600, sp = 950, x0 = z.x, y0 = z.y;
        const fx = addFx(st, { kind: 'shadow', x: R(x0), y: R(y0), a: r1(a), len, sp, dur: len / sp + 1.6, seed: st.seed });
        // the tip sweeps the lane: whoever it touches is caught
        for (let d = 120; d <= len + 109; d += 110) later(st, Math.min(len, d) / sp, api => {
          if (fx.caught) return;
          const dd = Math.min(len, d), tx = x0 + ca * dd, ty = y0 + sa * dd;
          if (bindNear(st, api, tx, ty, 66, 1.15, x0, y0)) { fx.caught = 1; fx.len = dd; api.strike(tx, ty, 50, D * .6, null, null, true); }
        });
        st.hold = len / sp + .25;
        later(st, len / sp + .05, () => { if (st.bind) st.hold = Math.max(st.hold, st.bind.t); });
        break;
      }
      case 'kubi': {
        const tx = st.tx, ty = st.ty, d = Math.hypot(tx - z.x, ty - z.y), tt = Math.min(.7, d / 1200);
        const fx = addFx(st, { kind: 'hands', x: tx, y: ty, sx: R(z.x), sy: R(z.y), r: 170, dur: tt + 2.2, T: tt });
        later(st, tt, api => { if (bindNear(st, api, tx, ty, 150, .9, z.x, z.y)) fx.caught = 1; });
        for (let k = 0; k < 4; k++) later(st, tt + .15 + k * .32, api => { api.strike(tx, ty, 160, D * .62, null, k === 3 ? 'crater' : null, true); api.shake(4 + k); });
        st.hold = tt + 1.2;
        break;
      }
      case 'nui': {
        const lanes = [-.5, -.25, 0, .25, .5].map(o => r1(a + o)), x0 = z.x, y0 = z.y, sp = 1300;
        addFx(st, { kind: 'needles', x: R(x0), y: R(y0), lanes, len: 680, sp, dur: 680 / sp + 1.4 });
        lanes.forEach(aa => {
          const c = Math.cos(aa), s = Math.sin(aa);
          for (let d = 90; d <= 680; d += 85) later(st, d / sp, api => api.strike(x0 + c * d, y0 + s * d, 44, D * .9, null, null, true));
        });
        later(st, .45, api => api.shake(8));
        st.hold = .8;
        break;
      }
      case 'knives': {
        startDash(z, st, a, 230, .15, D * 1.2, 48, api => {
          const x0 = z.x, y0 = z.y;
          [0, .2].forEach((t, k) => later(st, t, api => {
            addFx(st, { kind: 'blade', x: R(x0), y: R(y0), a: r1(a), len: 600, dur: .75, flip: k });
            for (let d = 60; d <= 600; d += 80) later(st, d / 1500, api => api.strike(x0 + ca * d, y0 + sa * d, 62, D * 1.15, null, d > 520 ? 'blade' : null, true));
            api.shake(7);
          }));
          api.strike(x0, y0, 110, D * 1.2, null, null, true);
        }, '170,230,255');
        st.hold = .85;
        break;
      }
      case 'tags': {
        const pts = st.spots || [];
        addFx(st, { kind: 'tags', pts, dur: 3.4, T: 1.1, sx: R(z.x), sy: R(z.y) });
        pts.forEach(p => later(st, 1.1 + p.t0, api => {
          api.strike(p.x, p.y, 115, D * 1.25, null, 'fire', true);
          api.shake(6);
        }));
        later(st, 1.2, api => api.world(pts[0] ? pts[0].x : z.x, pts[0] ? pts[0].y : z.y, 150, D * 2.4, 'fire'));
        st.hold = .6;
        break;
      }
      case 'mass': {
        const n = 10, x0 = z.x, y0 = z.y, sp = 900, Rr = 640;
        const branches = [];
        const p = api.player, pa = p ? Math.atan2(p.y - y0, p.x - x0) : a;
        for (let i = 0; i < n; i++) branches.push({ a: r1(pa + i * TAU / n), len: R(Rr * (.86 + hash(i + st.seed) * .14)), b: r1((hash(i * 3 + st.seed) - .5) * .5) });
        const fx = addFx(st, { kind: 'web', x: R(x0), y: R(y0), branches, sp, dur: 5.2, T: Rr / sp });
        // branch tips sweep outward: anyone touched is bound (once)
        for (let d = 120; d <= Rr; d += 100) later(st, d / sp, api => {
          if (fx.caught) return;
          for (const b of branches) {
            if (d > b.len) continue;
            const an = b.a + b.b * (d / b.len), tx = x0 + Math.cos(an) * d, ty = y0 + Math.sin(an) * d;
            if (bindNear(st, api, tx, ty, 64, 1.5, x0, y0)) { fx.caught = 1; fx.cx = R(tx); fx.cy = R(ty); break; }
          }
        });
        // explosive tags rain onto the shadow web, then go off in a chain
        const tags = [];
        for (let i = 0; i < 14; i++) {
          const an = hash(i * 7.1 + st.seed) * TAU, dd = 120 + hash(i * 3.3 + st.seed) * (Rr - 160);
          tags.push({ x: R(x0 + Math.cos(an) * dd), y: R(y0 + Math.sin(an) * dd), t0: r1(i * .09) });
        }
        if (p && !p.pseudo) tags.push({ x: R(p.x), y: R(p.y), t0: 1.3 });
        else tags.push({ x: R(st.tx), y: R(st.ty), t0: 1.3 });
        addFx(st, { kind: 'tags', pts: tags, dur: 4.8, T: 1.7, rain: 1, sx: R(x0), sy: R(y0) });
        tags.forEach((q, i) => later(st, 1.7 + q.t0, api => {
          api.strike(q.x, q.y, i === tags.length - 1 ? 190 : 130, D * (i === tags.length - 1 ? 2.4 : 1.25), null, 'fire', true);
          if (i % 4 === 0) api.world(q.x, q.y, 140, D * 2.4, 'fire');
          api.shake(i === tags.length - 1 ? 20 : 7);
        }));
        st.hold = 1.9;
        later(st, Rr / sp + .1, () => { if (st.bind) st.hold = Math.max(st.hold, st.bind.t); });
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
      st.bind = null; st.dome = 0; st.regen = 0;
      z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.seal = Math.max(0, st.seal - dt);
    st.lion = Math.max(0, st.lion - dt);
    st.bindCd = Math.max(0, st.bindCd - dt);
    st.dome = Math.max(0, st.dome - dt);
    // Byakugō: the stored chakra mends her (passive while the seal lines are out).
    if (st.regen > 0) { st.regen = Math.max(0, st.regen - dt); heal(z, .036 * dt); }
    z.armorScale = (m.armor || 1) * (st.regen > 0 ? .75 : 1) * (st.dome > 0 ? (st.domeKind === 'kaiten' ? .2 : .4) : 1);
    z.kageDash = 0;

    // Shadow Imitation: the caught unit is pinned where the shadow took it (hero, or a unit in team mode).
    if (st.bind) {
      const b = st.bind;
      b.t -= dt;
      const p = victim(api, b.x, b.y, 140);
      if (p && !p.remote && Math.hypot(p.x - b.x, p.y - b.y) < 150) { p.x = b.x; p.y = b.y; }
      if (b.t <= 0) st.bind = null;
    }

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (ds.heavy && (ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, 70, D * 2, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg * .35, null, null, true); }
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
      // rises fast, hangs at the top, then drops like a hammer
      st.lift = ar.h * (k < .6 ? easeOut(k / .6) : 1 - easeIn((k - .6) / .4));
      z.kageDash = .05;
      if (k >= 1) { const end = ar.end; st.arc = null; st.lift = 0; if (end) end(api); }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && st.hold <= 0) {
      if (z.manual) {
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
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc;
  }

  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ================================================================== cached art
  const spr = (key, w, h, paint) => Kit().sprite('rk:' + key, w, h, paint);
  // The Hyūga trigram circle (Hakke): outer ring with the eight trigrams, the 64-palm grid and a yin-yang.
  const TRIGRAMS = ['111', '110', '101', '100', '011', '010', '001', '000'];
  function trigramImg(col) {
    return spr('tri:' + col, 512, 512, g => {
      g.translate(256, 256);
      g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'butt';
      g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 246, 0, TAU); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 232, 0, TAU); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 158, 0, TAU); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 150, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate(i * TAU / 8 - Math.PI / 2);
        const bits = TRIGRAMS[i];
        for (let b = 0; b < 3; b++) {
          const rr = 172 + b * 17;
          if (bits[b] === '1') g.fillRect(-34, -rr - 5, 68, 10);
          else { g.fillRect(-34, -rr - 5, 28, 10); g.fillRect(6, -rr - 5, 28, 10); }
        }
        g.restore();
      }
      // the 64-palm grid: radial strokes and rings
      g.lineWidth = 1.6;
      for (let i = 0; i < 32; i++) { const a = i * TAU / 32; g.beginPath(); g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a) * 146, Math.sin(a) * 146); g.stroke(); }
      for (const rr of [80, 104, 126]) { g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke(); }
      // yin-yang
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 50, -Math.PI / 2, Math.PI / 2); g.arc(0, 25, 25, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -25, 25, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, -25, 7, 0, TAU); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 25, 7, 0, TAU); g.fill();
    });
  }
  // Chakra lion head facing +x (Twin Lion Fists / Hamura's lions): flame mane, open jaws, glowing eye.
  function lionImg(rgb) {
    return spr('lion2:' + rgb, 240, 200, g => {
      g.translate(112, 104);
      g.lineJoin = 'round'; g.lineCap = 'round';
      // flame mane: three layers of tapered tongues streaming back from the head
      const tongues = (n, r0, r1, a0, a1, w, fill, seed) => {
        for (let i = 0; i < n; i++) {
          const a = a0 + (a1 - a0) * (i + .5) / n + (hash(i + seed) - .5) * .12, L = r1 * (.75 + hash(i * 3 + seed) * .35);
          const bx = -8 + Math.cos(a) * r0, by = Math.sin(a) * r0 * .9, tx = -8 + Math.cos(a) * L, ty = Math.sin(a) * L * .9 - 10;
          const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
          g.beginPath(); g.moveTo(bx + nx, by + ny);
          g.quadraticCurveTo((bx + tx) / 2 + nx * 1.2 - 8, (by + ty) / 2 + ny, tx, ty);
          g.quadraticCurveTo((bx + tx) / 2 - nx * .6, (by + ty) / 2 - ny * .8, bx - nx, by - ny);
          g.closePath(); g.fillStyle = fill; g.fill();
        }
      };
      g.save(); g.shadowColor = 'rgba(30,20,80,.9)'; g.shadowBlur = 0;
      tongues(13, 30, 104, Math.PI * .45, Math.PI * 1.62, 15, 'rgba(40,30,100,.6)', 1);
      g.restore();
      tongues(13, 30, 98, Math.PI * .45, Math.PI * 1.62, 13, `rgba(${rgb},.7)`, 1);
      tongues(11, 26, 76, Math.PI * .5, Math.PI * 1.55, 9, 'rgba(235,230,255,.8)', 5);
      tongues(9, 20, 52, Math.PI * .55, Math.PI * 1.5, 6, 'rgba(255,255,255,.9)', 9);
      // head: skull, brow, muzzle, open jaws
      const head = () => {
        g.beginPath();
        g.moveTo(-34, 22); g.quadraticCurveTo(-40, -30, -6, -44); g.quadraticCurveTo(24, -52, 46, -36);
        g.quadraticCurveTo(62, -30, 74, -24); g.quadraticCurveTo(92, -22, 98, -10); g.quadraticCurveTo(100, -2, 94, 2);
        g.lineTo(52, 10); g.lineTo(90, 30); g.quadraticCurveTo(80, 44, 52, 44); g.quadraticCurveTo(10, 52, -20, 44); g.closePath();
      };
      head(); g.strokeStyle = 'rgba(30,20,80,.85)'; g.lineWidth = 7; g.stroke();
      const gr = g.createLinearGradient(0, -52, 0, 50); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, `rgb(${rgb})`); gr.addColorStop(1, `rgba(${rgb},.85)`);
      head(); g.fillStyle = gr; g.fill();
      g.save(); head(); g.clip();
      g.fillStyle = 'rgba(60,40,130,.32)'; g.beginPath(); g.ellipse(-10, 34, 70, 20, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(30, -38, 40, 8, -.15, 0, TAU); g.fill();
      g.restore();
      head(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.6; g.stroke();
      // mouth cavity, tongue and fangs
      g.fillStyle = 'rgba(36,20,80,.9)';
      g.beginPath(); g.moveTo(94, 2); g.lineTo(52, 10); g.lineTo(90, 30); g.quadraticCurveTo(76, 18, 94, 2); g.fill();
      g.fillStyle = 'rgba(255,170,220,.8)'; g.beginPath(); g.ellipse(66, 18, 12, 4, .35, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(30,20,80,.8)'; g.lineWidth = 1.2;
      for (const [x, y, s, l] of [[88, 2, 1, 12], [74, 6, 1, 9], [84, 28, -1, 11], [70, 22, -1, 8]]) {
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + 1, y + s * l); g.closePath(); g.fill(); g.stroke();
      }
      // nose, brow ridge, glowing slit eye, whisker pads, ruff lines
      g.fillStyle = 'rgba(30,20,80,.9)'; g.beginPath(); g.ellipse(92, -14, 7, 5, .3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,20,80,.85)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(14, -34); g.quadraticCurveTo(40, -42, 66, -26); g.stroke();
      g.beginPath(); g.moveTo(48, -28); g.lineTo(76, -20); g.stroke();
      g.fillStyle = 'rgba(30,20,80,.95)'; g.beginPath(); g.moveTo(26, -22); g.quadraticCurveTo(44, -32, 60, -22); g.quadraticCurveTo(44, -16, 26, -22); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(32, -22); g.quadraticCurveTo(44, -28, 56, -22); g.quadraticCurveTo(44, -19, 32, -22); g.fill();
      g.lineWidth = 2.4;
      for (const [x0, y0, x1, y1] of [[-14, -30, -2, 4], [-24, -14, -12, 24], [4, -14, 14, 20], [62, -6, 50, 4]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 8, (y0 + y1) / 2, x1, y1); g.stroke(); }
    });
  }
  // Katsuyu (big summon) facing +x: pale slug body, the blue stripes down her back, eyestalks.
  function slugImg() {
    return spr('slug', 300, 210, g => {
      g.translate(150, 170);
      const body = () => { g.beginPath(); g.moveTo(-140, 30); g.quadraticCurveTo(-150, -40, -70, -70); g.quadraticCurveTo(10, -110, 70, -110); g.quadraticCurveTo(128, -110, 134, -60); g.quadraticCurveTo(140, -10, 118, 30); g.closePath(); };
      body(); g.fillStyle = '#eef0f4'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = '#cfd6e2'; g.fillRect(-160, -10, 320, 60);
      g.fillStyle = '#b8c4d6'; g.fillRect(-160, 12, 320, 40);
      g.fillStyle = '#4a7ad0';
      for (const [o, w] of [[-20, 10], [8, 9]]) { g.beginPath(); g.moveTo(-138, 18 + o); g.quadraticCurveTo(-130, -54 + o, -60, -80 + o); g.quadraticCurveTo(20, -116 + o, 90, -112 + o); g.lineTo(90, -112 + o + w); g.quadraticCurveTo(20, -104 + o + w, -56, -70 + o + w); g.quadraticCurveTo(-120, -44 + o + w, -126, 18 + o); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(40, -92, 40, 8, -.1, 0, TAU); g.fill();
      g.restore();
      body(); g.strokeStyle = '#1e2a40'; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
      // eyestalks and eyes
      for (const [x, h] of [[96, 46], [118, 40]]) {
        g.strokeStyle = '#1e2a40'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 8, -100); g.lineTo(x, -100 - h); g.stroke();
        g.strokeStyle = '#e8ecf2'; g.lineWidth = 7; g.stroke();
        g.fillStyle = '#1e2a40'; g.beginPath(); g.arc(x, -100 - h, 8, 0, TAU); g.fill();
        g.fillStyle = '#ffd860'; g.beginPath(); g.arc(x + 1, -100 - h, 5, 0, TAU); g.fill();
        g.fillStyle = '#1e2a40'; g.fillRect(x - .5, -104 - h, 2.6, 8);
      }
      g.strokeStyle = '#1e2a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(124, -40); g.quadraticCurveTo(132, -30, 128, -18); g.stroke();
    });
  }
  // Rotation sphere: clear centre, pale-blue chakra thickening toward the rim.
  function kaitenImg() {
    return spr('kaiten', 256, 256, g => {
      const gr = g.createRadialGradient(118, 110, 10, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(.6, 'rgba(190,215,255,.16)'); gr.addColorStop(.86, 'rgba(170,200,255,.42)');
      gr.addColorStop(.97, 'rgba(235,245,255,.7)'); gr.addColorStop(1, 'rgba(235,245,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
    });
  }
  function tagImg() {
    return spr('tag', 26, 46, g => {
      g.fillStyle = '#1e1a14'; g.fillRect(0, 0, 26, 46);
      g.fillStyle = '#f2e6c4'; g.fillRect(2, 2, 22, 42);
      g.fillStyle = '#c02a20'; g.fillRect(4, 4, 18, 3); g.fillRect(4, 39, 18, 3);
      g.font = 'bold 15px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('爆', 13, 18);
      g.fillRect(12, 27, 2, 10); g.fillRect(9, 31, 8, 1.6);
    });
  }
  function petalImg() {
    return spr('petal', 20, 14, g => {
      g.translate(10, 7);
      g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-4, -7, 6, -4); g.lineTo(9, -1); g.lineTo(6, 1); g.lineTo(9, 3); g.quadraticCurveTo(-2, 8, -9, 0); g.closePath();
      g.fillStyle = '#ffb6d2'; g.fill(); g.strokeStyle = '#b84a7a'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#ffe6f0'; g.beginPath(); g.ellipse(-2, -1.5, 4, 1.6, -.2, 0, TAU); g.fill();
    });
  }
  // Rock slab variants (lit top face, dark flank) for craters and fissures.
  function slabImg(v) {
    return spr('slab' + v, 64, 64, g => {
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + hash(v * 9 + i) * .6, r = 20 + hash(v * 5 + i * 2) * 10; pts.push([32 + Math.cos(a) * r, 30 + Math.sin(a) * r * .62]); }
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + 12) : g.moveTo(p[0], p[1] + 12)); g.closePath();
      g.fillStyle = '#5a4434'; g.fill();
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = v % 2 ? '#a88a68' : '#9c8064'; g.fill();
      g.strokeStyle = '#2e2018'; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = 'rgba(255,240,210,.35)'; g.beginPath(); g.moveTo(pts[3][0], pts[3][1]); g.lineTo(pts[4][0], pts[4][1]); g.lineTo(32, 30); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, 30); g.lineTo(pts[1][0], pts[1][1]); g.stroke();
    });
  }
  function palmImg(rgb) {
    // open palm print (Jūken strike)
    return spr('palm:' + rgb, 64, 64, g => {
      g.translate(32, 36);
      g.fillStyle = `rgba(${rgb},.9)`; g.strokeStyle = 'rgba(30,24,70,.7)'; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(0, 6, 13, 14, 0, 0, TAU);
      for (const [x, a, l] of [[-10, -.5, 16], [-4, -.15, 22], [3, .05, 24], [9, .25, 20]]) { g.moveTo(x, -4); g.ellipse(x + Math.sin(a) * l * .5, -4 - Math.cos(a) * l * .5, 3.4, l * .55, a, 0, TAU); }
      g.moveTo(13, 8); g.ellipse(17, 2, 3.6, 9, .9, 0, TAU);
      g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-2, 4, 7, 8, 0, 0, TAU); g.fill();
    });
  }

  // ================================================================== VFX pieces
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
  function sector(ctx, x, y, r0, r1v, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1v, a0, a1, a1 < a0); ctx.arc(x, y, r0, a1, a0, a1 >= a0); ctx.closePath();
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
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .5) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
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
  function speedLines(ctx, x0, y0, x1, y1, w, alpha, seed, rgb = '255,255,255', lift = 34) {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 4) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(${rgb},${alpha * .85})` : `rgba(30,14,30,${alpha * .35})`;
      ctx.lineWidth = pass ? 2 : 4.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const o = (hash(i + seed) - .5) * w * 2, s0 = hash(i * 3.1 + seed) * len * .7, l = len * (.25 + hash(i * 1.7 + seed) * .4);
        ctx.moveTo(x0 + ux * s0 + nx * o, y0 + uy * s0 + ny * o - lift); ctx.lineTo(x0 + ux * (s0 + l) + nx * o, y0 + uy * (s0 + l) + ny * o - lift);
      }
      ctx.stroke();
    }
  }
  // Radial ground cracks: dark groove with a pale lip.
  function cracks(ctx, x, y, r, n, seed, alpha, grow) {
    if (alpha <= .01) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(255,236,210,${.45 * alpha})` : `rgba(36,22,16,${.85 * alpha})`;
      ctx.lineWidth = pass ? 1.2 : 3.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        let a = i * TAU / n + (hash(i * 3.1 + seed) - .5) * .5, d = r * .18;
        const L = r * (.7 + hash(i * 5.7 + seed) * .55) * grow;
        let px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5;
        ctx.moveTo(px + (pass ? 1 : 0), py + (pass ? 1.4 : 0));
        while (d < L) {
          d += r * .14; a += (hash(d + i * 7 + seed) - .5) * .5;
          px = x + Math.cos(a) * d; py = y + Math.sin(a) * d * .5;
          ctx.lineTo(px + (pass ? 1 : 0), py + (pass ? 1.4 : 0));
          if (hash(d * .3 + i + seed) > .72) {
            const b = a + (hash(d + seed) > .5 ? .7 : -.7), l2 = r * .16;
            ctx.lineTo(px + Math.cos(b) * l2, py + Math.sin(b) * l2 * .5); ctx.moveTo(px, py);
          }
        }
      }
      ctx.stroke();
    }
  }
  function petals(ctx, x, y, r, t, seed, n, alpha) {
    const img = petalImg();
    for (let i = 0; i < n; i++) {
      const ph = clamp01(t * (.7 + hash(i + seed) * .5)), an = hash(i * 2.7 + seed) * TAU, d = r * (.2 + ph * (.6 + hash(i * 4.1 + seed) * .6));
      const h = Math.sin(Math.PI * Math.min(1, ph * 1.2)) * r * (.25 + hash(i * 1.9 + seed) * .3) + ph * 30;
      const a = alpha * (1 - ph * ph);
      if (a <= .02) continue;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - h);
      ctx.rotate(t * 6 + i); ctx.scale(1, .5 + .5 * Math.abs(Math.sin(t * 5 + i)));
      ctx.drawImage(img, -10, -7, 20, 14);
      ctx.restore();
    }
  }
  function slab(ctx, v, x, y, s, rot, a) {
    if (a <= .02) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(slabImg(v % 4), -32 * s, -36 * s, 64 * s, 64 * s);
    ctx.restore();
  }
  // Shadow band on the ground from (x0,y0) along angle a for `len` px: wobbly black-violet edge.
  function shadowBand(ctx, x0, y0, a, len, w, time, seed, alpha, bend = 0) {
    if (len < 4) return;
    const c = Math.cos(a), s = Math.sin(a), n = Math.max(4, Math.ceil(len / 26));
    const P = (t, side) => {
      const d = len * t, wob = Math.sin(t * 9 + time * 6 + seed) * 3 + Math.sin(t * 23 + seed * 2) * 2;
      const ww = (w * (1 - t * .55) + wob) * side, bb = bend * Math.sin(Math.PI * t) * len * .25;
      return [x0 + c * d - s * (ww + bb), y0 + s * d + c * (ww + bb) * .6];
    };
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = P(i / n, 1); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    // pointed tip
    const tip = [x0 + c * (len + 14), y0 + s * (len + 14)];
    ctx.lineTo(tip[0], tip[1]);
    for (let i = n; i >= 0; i--) { const p = P(i / n, -1); ctx.lineTo(p[0], p[1]); }
    ctx.closePath();
    ctx.fillStyle = `rgba(10,6,20,${.82 * alpha})`; ctx.fill();
    ctx.strokeStyle = `rgba(110,80,170,${.55 * alpha})`; ctx.lineWidth = 2; ctx.stroke();
  }
  function shadowPool(ctx, x, y, r, alpha, time, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = i * TAU / 20, rr = r * (1 + Math.sin(a * 3 + time * 4 + seed) * .08 + Math.sin(a * 7 + seed) * .05);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * .5;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(10,6,20,${.8 * alpha})`; ctx.fill();
    ctx.strokeStyle = `rgba(120,90,180,${.5 * alpha})`; ctx.lineWidth = 2; ctx.stroke();
  }
  // A shadow hand / tendril rising from the ground at (x,y) up to height h, curling toward angle `a`.
  function shadowHand(ctx, x, y, h, a, k, seed) {
    if (k <= .02) return;
    const lean = Math.cos(a) * 14 * k, top = y - h * k;
    ctx.fillStyle = 'rgba(8,4,16,.92)';
    ctx.beginPath();
    ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x - 7 + lean * .3, y - h * .5 * k, x - 4 + lean, top + 6);
    // fingers
    for (let f = 0; f < 4; f++) {
      const fx = x - 4 + lean + f * 2.8, fl = 7 + (f === 1 || f === 2 ? 3 : 0) + hash(seed + f) * 2;
      ctx.lineTo(fx, top - fl * k); ctx.lineTo(fx + 1.4, top + 1);
    }
    ctx.quadraticCurveTo(x + 7 + lean * .3, y - h * .5 * k, x + 6, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,110,200,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function blastFire(ctx, x, y, r, t, time, seed) {
    const K = Kit();
    if (t < 0 || t > 1.4) return;
    K.fx.fireBlast(ctx, x, y, r, t, Math.max(0, 1 - t / 1.4), time, seed);
  }

  // ================================================================== FX painters [ground, overlay]
  const FX = {
    mark: [(ctx, f, time) => markCircle(ctx, f.x, f.y, f.r, f.rgb, clamp01(f.age / f.dur), time, false), null],
    lineMark: [(ctx, f, time) => teleShape(ctx, { k: 'line', x: f.x, y: f.y, a: f.a, len: f.len, w: f.w }, f.rgb, clamp01(f.age / f.dur), time), null],
    dash: [null, (ctx, f, time) => {
      const a = 1 - f.age / f.dur;
      speedLines(ctx, f.x0, f.y0, f.x1, f.y1, 24, a, f.seed, f.rgb, 36);
      // afterimages of the dasher
      const S = Spr();
      if (S && f.pts.length >= 4) for (let i = 0; i < f.pts.length - 2; i += 4) {
        const k = i / f.pts.length;
        S.draw(ctx, f.id, f.pts[i], f.pts[i + 1] + 3, { facing: Math.cos(f.a) >= 0 ? 1 : -1, frame: 'run3', alpha: a * .35 * (.4 + k) });
      }
    }],
    burst: [(ctx, f) => {
      const t = f.age, K = Kit();
      ctx.globalCompositeOperation = 'lighter';
      K.fx.shockRing(ctx, f.x, f.y, f.r * 1.1, t * 1.4, Math.max(0, 1 - t * 1.1), f.rgb);
      if (t > .12) K.fx.shockRing(ctx, f.x, f.y, f.r * 1.3, (t - .12) * 1.2, Math.max(0, .8 - t), '255,255,255');
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, f.x, f.y, f.r, t, f.seed, 10);
    }, (ctx, f) => {
      const t = f.age, K = Kit();
      if (t < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, f.x, f.y - 30, f.r * (.5 + t * 2), f.rgb, (1 - t / .3) * .8, true, .8); ctx.globalCompositeOperation = 'source-over'; }
    }],
    // Cherry Blossom Impact / Heel Drop / Byakugō punch crater.
    crater: [(ctx, f, time) => {
      const t = f.age, fade = 1 - win(t, f.dur - 1, f.dur), r = f.r, K = Kit(), e = easeOut(t / .35);
      // basin: dark rim, sunken floor
      ctx.fillStyle = `rgba(40,24,16,${.34 * fade})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, r * .78 * e, r * .39 * e, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(80,56,40,${.3 * fade})`; ctx.beginPath(); ctx.ellipse(f.x, f.y + r * .04, r * .52 * e, r * .24 * e, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(30,18,12,${.5 * fade})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y, r * .78 * e, r * .39 * e, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(240,220,190,${.35 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 3, r * .76 * e, r * .37 * e, 0, .2, Math.PI - .2); ctx.stroke();
      cracks(ctx, f.x, f.y, r * (f.big ? 1.05 : 1), f.big ? 22 : f.small ? 9 : 14, f.seed, fade, e);
      if (f.big) cracks(ctx, f.x, f.y, r * .5, 12, f.seed + 7, fade, e);
      ctx.globalCompositeOperation = 'lighter';
      K.fx.shockRing(ctx, f.x, f.y, r * 1.15, t * 1.3, Math.max(0, 1 - t * 1.1), '255,130,190');
      if (t > .1) K.fx.shockRing(ctx, f.x, f.y, r * 1.4, (t - .1) * 1.1, Math.max(0, .85 - t), '255,240,250');
      if (f.big && t > .25) K.fx.shockRing(ctx, f.x, f.y, r * 1.6, (t - .25) * .9, Math.max(0, .9 - (t - .25)), '255,150,210');
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, f.x, f.y, r, t, f.seed, f.big ? 20 : 12, 'dust', .6);
      // ground slabs tipped up round the rim (ground layer: the low ones)
      const n = f.big ? 16 : f.small ? 6 : 10;
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + hash(i + f.seed) * .3, d = r * (.62 + hash(i * 3 + f.seed) * .18) * e;
        const rise = easeOut((t - .03 * i % .2) / .25) * (1 - win(t, f.dur - .8, f.dur));
        slab(ctx, i, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .5 - 6 * rise, (f.big ? 1.1 : .8) * (.6 + hash(i * 7 + f.seed) * .5), an + 1.2 + hash(i) * .6, rise);
      }
    }, (ctx, f, time) => {
      const t = f.age, r = f.r, K = Kit();
      ctx.globalCompositeOperation = 'lighter';
      if (t < .4) K.glow(ctx, f.x, f.y - 30, r * (.6 + t * 1.6), '255,140,200', (1 - t / .4) * .95, true, .8);
      if (t < .25) K.glow(ctx, f.x, f.y - 20, r * .45, '255,255,255', (1 - t / .25), true, .7);
      ctx.globalCompositeOperation = 'source-over';
      // flying chunks and the big slabs tossed up
      if (t < 1.3) K.fx.debris(ctx, f.x, f.y, r * 1.1, t / 1.3, f.seed, '#4a3426', f.big ? 22 : 12);
      const n = f.big ? 10 : f.small ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const tt = clamp01((t - hash(i + f.seed) * .1) / 1.1); if (tt <= 0 || tt >= 1) continue;
        const an = hash(i * 4.3 + f.seed) * TAU, d = r * (.2 + .8 * easeOut(tt)), h = Math.sin(Math.PI * tt) * r * (.5 + hash(i * 2 + f.seed) * .5);
        slab(ctx, i + 2, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .5 - h, (f.big ? 1 : .7) * (.6 + hash(i * 9 + f.seed) * .6), tt * 8 + i, 1 - tt * tt);
      }
      petals(ctx, f.x, f.y - 10, r * 1.1, t / 1.6, f.seed, f.big ? 26 : f.small ? 8 : 14, 1);
      // a column of pulverised earth over the centre
      if (t < 1.6) {
        const dust = K.puff('dust');
        for (let i = 0; i < (f.big ? 10 : 5); i++) {
          const ph = clamp01(t / 1.6 + hash(i + f.seed) * .1);
          K.stamp(ctx, dust, f.x + (hash(i * 3 + f.seed) - .5) * r * .5, f.y - 10 - ph * r * (.5 + hash(i) * .4), r * (.12 + ph * .18), (1 - ph) * .75);
        }
      }
    }],
    fissure: [(ctx, f, time) => {
      const t = f.age, fade = 1 - win(t, f.dur - .8, f.dur), grow = easeOut(t / .5), c = Math.cos(f.a), s = Math.sin(f.a);
      const L = f.len * grow;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = pass === 0 ? `rgba(30,16,10,${.5 * fade})` : pass === 1 ? `rgba(20,10,6,${.9 * fade})` : `rgba(255,220,200,${.5 * fade})`;
        ctx.lineWidth = pass === 0 ? 22 : pass === 1 ? 9 : 1.6;
        ctx.beginPath();
        for (let d = 0; d <= L; d += 30) {
          const o = (hash(d * .1 + f.seed) - .5) * 26;
          const px = f.x + c * d - s * o, py = f.y + s * d + c * o * .5 + (pass === 2 ? 4 : 0);
          d ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      // rock spikes jutting up along the crack
      for (let i = 0, d = 100; d <= L; d += 64, i++) {
        const rise = easeOut((t - d / 1500) / .2) * fade, o = (hash(i * 2.3 + f.seed) - .5) * 60;
        const px = f.x + c * d - s * o, py = f.y + s * d + c * o * .5;
        if (rise <= .02) continue;
        const h = (26 + hash(i * 4 + f.seed) * 30) * rise, w = 12 + hash(i + f.seed) * 8;
        ctx.fillStyle = '#7c6248';
        ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px - w * .2, py - h); ctx.lineTo(px + w * .5, py - h * .7); ctx.lineTo(px + w, py); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a88a68'; ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px - w * .2, py - h); ctx.lineTo(px, py); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2e2018'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px - w, py); ctx.lineTo(px - w * .2, py - h); ctx.lineTo(px + w * .5, py - h * .7); ctx.lineTo(px + w, py); ctx.stroke();
      }
    }, (ctx, f) => {
      const t = f.age, c = Math.cos(f.a), s = Math.sin(f.a), K = Kit(), dust = K.puff('dust');
      for (let i = 0; i < 9; i++) {
        const d = 100 + i * 64, ph = clamp01((t - d / 1500) / 1.1);
        if (ph <= 0 || ph >= 1) continue;
        K.stamp(ctx, dust, f.x + c * d + (hash(i + f.seed) - .5) * 30, f.y + s * d - 14 - ph * 40, 18 + ph * 26, (1 - ph) * .7);
      }
      if (t < 1) K.fx.debris(ctx, f.x + c * f.len * .5, f.y + s * f.len * .5, f.len * .5, t, f.seed, '#4a3426', 10);
    }],
    acid: [(ctx, f, time) => {
      const K = Kit(), fade = 1 - win(f.age, f.dur - .7, f.dur);
      for (const p of f.pts) {
        const k = easeOut((f.age - p.t0) / .3); if (k <= 0) continue;
        ctx.fillStyle = `rgba(120,150,30,${.45 * fade * k})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * k, p.r * .5 * k, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(200,240,90,${.4 * fade * k})`; ctx.beginPath(); ctx.ellipse(p.x - p.r * .15, p.y - 2, p.r * .6 * k, p.r * .26 * k, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(50,60,10,${.55 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * k, p.r * .5 * k, 0, 0, TAU); ctx.stroke();
        // bubbles
        for (let i = 0; i < 4; i++) {
          const ph = (time * 1.3 + hash(i + p.x)) % 1, bx = p.x + (hash(i * 3 + p.y) - .5) * p.r * 1.2, by = p.y + (hash(i * 5 + p.x) - .5) * p.r * .5;
          ctx.strokeStyle = `rgba(230,255,150,${(1 - ph) * .7 * fade})`; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(bx, by - ph * 6, 2 + ph * 4, 0, TAU); ctx.stroke();
        }
        K.stamp(ctx, K.puff('smoke'), p.x, p.y - 16 - ((time * 20 + p.x) % 20), p.r * .5, .25 * fade);
      }
    }, null],
    slug: [(ctx, f) => {
      // summoning circle under Katsuyu
      const k = win(f.age, 0, .3) * (1 - win(f.age, f.dur - .6, f.dur));
      if (k <= 0) return;
      ctx.strokeStyle = `rgba(30,40,60,${.4 * k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y + 40, 150, 50, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(150,230,210,${.6 * k})`; ctx.lineWidth = 2; ctx.stroke();
      const born = f.born || 0, tt = f.age - born, split = f.split || 99;
      const show = tt < 0 ? 0 : win(tt, 0, .25) * (1 - win(tt, split, split + .45));
      if (show > .02) {
        const sc = (.85 + .15 * win(tt, 0, .3)) * (1 - .3 * win(tt, split, split + .45)), breath = 1 + Math.sin(f.age * 3) * .02;
        ctx.fillStyle = `rgba(20,30,50,${.25 * show})`; ctx.beginPath(); ctx.ellipse(f.x, f.y + 40, 130 * sc, 30 * sc, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalAlpha = show; ctx.translate(f.x, f.y + 40); ctx.scale(f.f * sc, sc * breath);
        ctx.drawImage(slugImg(), -150, -170, 300, 210);
        ctx.restore();
      }
    }, (ctx, f, time, z) => {
      const K = Kit(), born = f.born || 0, t = f.age;
      if (t < born + .6 && t > born - .2) smokePoof(ctx, f.x, f.y + 40, 170, t - born + .2, f.seed);
      if (t < born) return;
      const tt = t - born, split = f.split || 99;
      const show = win(tt, 0, .25) * (1 - win(tt, split, split + .45));
      if (show > .02) {
        // acid spray from the mouth while the cone is live
        const sp = win(tt, .05, .2) * (1 - win(tt, .85, 1.1));
        if (sp > .02) {
          const ac = K.puff('water');
          for (let i = 0; i < 18; i++) {
            const ph = (time * 2.2 + hash(i + f.seed)) % 1, an = f.a + (hash(i * 3.7 + f.seed) - .5) * .7, d = 40 + ph * 600;
            const px = f.mx + Math.cos(an) * d, py = f.my + Math.sin(an) * d - Math.sin(Math.PI * ph) * 60 - 30;
            ctx.save(); ctx.filter = 'none';
            ctx.globalAlpha = sp * (1 - ph) * .8;
            ctx.fillStyle = '#c8f060'; ctx.beginPath(); ctx.arc(px, py, 5 + ph * 10, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#4a5a10'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
          }
          void ac;
        }
      }
      if (tt > split) {
        // the split slugs crawl back to Sakura
        const k = clamp01((tt - split) / .9), tx = z ? z.x : f.x, ty = z ? z.y : f.y;
        if (k < 1) for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + f.seed, sx = f.x + Math.cos(an) * 90, sy = f.y + 40 + Math.sin(an) * 40;
          const px = sx + (tx - sx) * easeInOut(k), py = sy + (ty - sy) * easeInOut(k);
          ctx.save(); ctx.translate(px, py - 6); ctx.scale(tx > sx ? 1 : -1, 1);
          ctx.fillStyle = '#eef0f4'; ctx.strokeStyle = '#1e2a40'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#4a7ad0'; ctx.fillRect(-9, -3, 16, 2);
          ctx.restore();
        }
        if (k > .9 && k < 1) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tx, ty - 40, 60, '140,255,190', .8); ctx.globalCompositeOperation = 'source-over'; }
        if (k < .1) smokePoof(ctx, f.x, f.y + 40, 120, (tt - split) * 1.5, f.seed + 3);
      }
    }],
    trigram: [(ctx, f, time) => {
      const t = f.age, k = easeOut(t / .25) * (1 - win(t, f.dur - .5, f.dur)), r = f.r * (.8 + .2 * easeOut(t / .3));
      if (k <= .01) return;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, .5); ctx.rotate(t * (f.big ? .8 : .5));
      ctx.globalAlpha = k * .7; ctx.drawImage(trigramImg('#141030'), -r - 3, -r + 4, r * 2 + 6, r * 2 + 6);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .95;
      ctx.drawImage(trigramImg(`rgb(${f.rgb})`), -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      Kit().glow(ctx, f.x, f.y, r * 1.1, f.rgb, k * .25, false, .5);
      ctx.globalCompositeOperation = 'source-over';
    }, (ctx, f, time, z) => {
      const t = f.age, K = Kit(), hit = f.hit || 0, cx = z ? z.x : f.x, cy = z ? z.y : f.y;
      const active = t < f.dur - .8;
      if (active) {
        // a storm of palms around the striker
        const img = palmImg(f.rgb);
        const n = f.big ? 10 : 6;
        for (let i = 0; i < n; i++) {
          const ph = (time * 6 + i / n) % 1, an = hash(i * 3.3 + Math.floor(time * 6 + i / n) + f.seed) * TAU, d = 30 + hash(i * 5.1 + Math.floor(time * 6)) * f.r * .5;
          const px = cx + Math.cos(an) * d, py = cy - 30 + Math.sin(an) * d * .5;
          ctx.globalAlpha = (1 - ph) * .9;
          ctx.drawImage(img, px - 14 - ph * 6, py - 14 - ph * 6, 28 + ph * 12, 28 + ph * 12);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px, py, 26, f.rgb, (1 - ph) * .5); ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = `rgba(${f.rgb},.8)`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const an = i * TAU / 10 + time * 5, r0 = 26, r1v = 50 + (i % 3) * 14;
          ctx.moveTo(cx + Math.cos(an) * r0, cy - 30 + Math.sin(an) * r0 * .6); ctx.lineTo(cx + Math.cos(an + .3) * r1v, cy - 30 + Math.sin(an + .3) * r1v * .6);
        }
        ctx.stroke();
      }
      // the count, called out as it climbs
      if (hit > 0 && f.counts) {
        const txt = f.counts[Math.min(hit, f.counts.length) - 1] + ' CHƯỞNG!', bob = Math.sin(time * 14) * 1.5, H = bodyH(f.id || 'neji');
        ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.font = `900 ${f.big && hit >= f.counts.length ? 17 : 13}px sans-serif`; ctx.lineWidth = 4; ctx.strokeStyle = '#140f22';
        const y = cy - H - 18 + bob;
        ctx.strokeText(txt, cx + 34, y); ctx.fillStyle = '#ffffff'; ctx.fillText(txt, cx + 34, y);
        ctx.restore();
      }
    }],
    lionburst: [(ctx, f) => {
      const t = f.age, K = Kit();
      ctx.globalCompositeOperation = 'lighter';
      K.fx.shockRing(ctx, f.x, f.y, f.r * 1.2, t * 1.3, Math.max(0, 1 - t), f.rgb);
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, f.x, f.y, f.r, t, f.seed, 12);
    }, (ctx, f) => {
      const t = f.age, K = Kit(), img = lionImg(f.rgb), c = Math.cos(f.a), s = Math.sin(f.a);
      const k = 1 - win(t, .3, 1.0), push = easeOut(t / .5) * 90;
      if (k > .02) for (const side of [-1, 1]) {
        const px = f.x + c * (30 + push) - s * side * 34, py = f.y - 40 + s * (30 + push) + c * side * 17;
        const sc = (1 + t * .8) * .9;
        ctx.save(); ctx.globalAlpha = k; ctx.translate(px, py); ctx.scale(c >= 0 ? 1 : -1, 1);
        ctx.rotate(Math.atan2(s * .6, Math.abs(c)));
        ctx.drawImage(img, -112 * sc * .8, -104 * sc * .8, 240 * sc * .8, 200 * sc * .8);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      if (t < .4) K.glow(ctx, f.x, f.y - 40, f.r * (.6 + t * 1.5), f.rgb, (1 - t / .4) * .9, true, .8);
      ctx.globalCompositeOperation = 'source-over';
    }],
    dome: [(ctx, f, time, z) => {
      const x = z ? z.x : 0, y = z ? z.y : 0, t = f.age, k = easeOut(t / .2) * (1 - win(t, f.dur - .3, f.dur)), r = f.r;
      if (k <= .01 || !z) return;
      ctx.fillStyle = `rgba(20,30,70,${.18 * k})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * .5, 0, 0, TAU); ctx.fill();
      // spiral grooves dug into the ground by the spin
      ctx.strokeStyle = `rgba(40,30,30,${.35 * k})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a0 = i * TAU / 6 + time * (f.sub === 'kaiten' ? 9 : 4); ctx.moveTo(x + Math.cos(a0) * r * .3, y + Math.sin(a0) * r * .15); ctx.quadraticCurveTo(x + Math.cos(a0 + .6) * r * .7, y + Math.sin(a0 + .6) * r * .35, x + Math.cos(a0 + 1.1) * r * .95, y + Math.sin(a0 + 1.1) * r * .48); }
      ctx.stroke();
      Kit().fx.shockRing(ctx, x, y, r, (time * 2) % 1, .6 * k, f.sub === 'kaiten' ? '200,225,255' : '150,190,255');
    }, (ctx, f, time, z) => {
      if (!z) return;
      const K = Kit(), x = z.x, t = f.age, k = easeOut(t / .2) * (1 - win(t, f.dur - .3, f.dur)), r = f.r, cy = z.y - Math.min(56, r * .26);
      if (k <= .01) return;
      if (f.sub === 'kaiten') {
        // Rotation: a spinning sphere of chakra, bands whipping round it.
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, cy, r * 1.05, '170,210,255', .35 * k, false, .82);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = k; ctx.drawImage(kaitenImg(), x - r, cy - r * .82, r * 2, r * 1.64);
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const tilt = -1.1 + i * .27, ph = time * (13 + i) + i * 1.7;
          ctx.save(); ctx.translate(x, cy); ctx.rotate(tilt * .35);
          ctx.strokeStyle = `rgba(30,50,110,${.35 * k})`; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(0, 0, r * (.95 - i * .02), r * (.5 + .3 * Math.sin(i)), 0, ph, ph + 2.2); ctx.stroke();
          ctx.strokeStyle = `rgba(${i % 2 ? '220,240,255' : '170,205,255'},${.85 * k})`; ctx.lineWidth = i % 3 ? 2.4 : 4;
          ctx.beginPath(); ctx.ellipse(0, 0, r * (.95 - i * .02), r * (.5 + .3 * Math.sin(i)), 0, ph, ph + 2.2); ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = `rgba(40,90,200,${.6 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, cy, r, r * .82, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.7 * k})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(x, cy, r * .94, r * .76, 0, -2.6, -.9); ctx.stroke();
        // dust flung off the rim
        const dust = K.puff('dust');
        for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + time * 7, ph = (time * 2 + i * .1) % 1; K.stamp(ctx, dust, x + Math.cos(an) * r * (1 + ph * .3), z.y + Math.sin(an) * r * .5 * (1 + ph * .3) - 8, 12 + ph * 14, (1 - ph) * .6 * k); }
      } else {
        // Protective 64 Palms: a hemisphere of whirling chakra blades round her.
        const P = (a, e, rr) => [x + Math.cos(a) * rr * Math.cos(e), z.y + Math.sin(a) * rr * Math.cos(e) * .5 - rr * Math.sin(e) * .62];
        ctx.fillStyle = `rgba(150,170,255,${.13 * k})`;
        ctx.beginPath(); ctx.ellipse(x, z.y, r, r * .62 + r * .12, 0, Math.PI, TAU); ctx.ellipse(x, z.y, r, r * .5, 0, 0, Math.PI); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, z.y - r * .25, r * 1.05, '140,160,255', .32 * k, false, .7);
        K.glow(ctx, x, z.y - 40, 80, '225,228,255', .55 * k, true);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(230,236,255,${.95 * k})` : `rgba(30,36,110,${.45 * k})`;
          ctx.lineWidth = pass ? 2 : 5;
          ctx.beginPath();
          for (let i = 0; i < 26; i++) {
            const e = hash(i * 3.7) * 1.25, rr = r * (.55 + .45 * hash(i * 5.3)), dir = i % 2 ? 1 : -1;
            const a0 = time * (5 + hash(i * 2.9) * 4) * dir + hash(i * 7.1) * TAU, sw = .7 + hash(i * 1.3) * .6;
            for (let j = 0; j <= 7; j++) { const q = P(a0 - dir * sw * j / 7, e, rr); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
          }
          ctx.stroke();
        }
        // bright blade heads
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i += 2) {
          const e = hash(i * 3.7) * 1.25, rr = r * (.55 + .45 * hash(i * 5.3)), dir = i % 2 ? 1 : -1;
          const q = P(time * (5 + hash(i * 2.9) * 4) * dir + hash(i * 7.1) * TAU, e, rr);
          K.glow(ctx, q[0], q[1], 16, '200,210,255', .8 * k, true);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(40,50,130,${.5 * k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, z.y, r, r * .5, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(190,205,255,${.9 * k})`; ctx.lineWidth = 2.4; ctx.stroke();
      }
    }],
    palmwave: [(ctx, f) => {
      const t = f.age, c = Math.cos(f.a), s = Math.sin(f.a), K = Kit(), dust = K.puff('dust');
      for (let i = 0; i < (f.big ? 14 : 9); i++) {
        const d = 80 + i * (f.r / (f.big ? 14 : 9)), ph = clamp01((t - d / 1600) / .9);
        if (ph <= 0 || ph >= 1) continue;
        const o = (hash(i + f.seed) - .5) * d * f.h * 1.4;
        K.stamp(ctx, dust, f.x + c * d - s * o, f.y + s * d + c * o * .5 - 6 - ph * 20, 16 + ph * 30, (1 - ph) * .65);
      }
    }, (ctx, f) => {
      const t = f.age, c = Math.cos(f.a), s = Math.sin(f.a), K = Kit();
      // compressed-air crescents racing down the cone, wind-shear streaks inside it
      ctx.lineCap = 'round';
      const cx = f.x, cy = f.y - 30, half = f.h * .95, B = f.big ? 1.5 : 1;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(235,240,255,.75)' : 'rgba(40,40,100,.3)'; ctx.lineWidth = pass ? 1.6 : 4;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const an = f.a + (hash(i + f.seed) - .5) * 2 * half, d0 = t * 1600 - 120 - hash(i * 3 + f.seed) * 200, l = 90 + hash(i * 5) * 80;
          if (d0 < 30 || d0 > f.r) continue;
          ctx.moveTo(cx + Math.cos(an) * d0, cy + Math.sin(an) * d0); ctx.lineTo(cx + Math.cos(an) * (d0 + l), cy + Math.sin(an) * (d0 + l));
        }
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const d = (t * 1600 - i * 70); if (d < 40 || d > f.r) continue;
        const a = (1 - d / f.r) * (1 - i * .08);
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(240,245,255,${a * .95})` : `rgba(40,40,110,${a * .5})`;
          ctx.lineWidth = (pass ? 4 - i * .4 : 11 - i) * B;
          ctx.beginPath();
          for (let j = 0; j <= 14; j++) {
            const an = f.a - half + 2 * half * j / 14, dd = d - Math.abs(j / 14 - .5) * 40, px = cx + Math.cos(an) * dd, py = cy + Math.sin(an) * dd;
            j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        if (i === 0) {
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, cx + c * d, cy + s * d, 60 + d * f.h * .9, f.rgb, a * .45, false, .7);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (t < .35) {
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, f.x + c * 40, f.y - 30 + s * 40, 80 * B, f.rgb, (1 - t / .35), true, .8);
        K.fx.shockRing(ctx, f.x + c * 40, f.y + s * 40, 110 * B, t * 2.6, 1 - t / .35, f.rgb);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - t / .35;
        const img = palmImg(f.rgb), sz = 50 * B;
        ctx.drawImage(img, f.x + c * 40 - sz / 2, f.y - 30 + s * 40 - sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      }
    }],
    palmhit: [(ctx, f) => { dustRing(ctx, f.x, f.y, f.big ? 160 : 110, f.age, f.seed, 8); }, (ctx, f) => {
      const t = f.age, K = Kit(), k = 1 - t / f.dur, sz = (f.big ? 60 : 40) * (1 + t);
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, f.y - 30, sz * 1.4, f.rgb, k * .8, true, .8);
      K.fx.shockRing(ctx, f.x, f.y, f.big ? 170 : 120, t * 1.6, k, f.rgb);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k; ctx.drawImage(palmImg(f.rgb), f.x - sz / 2, f.y - 30 - sz / 2, sz, sz); ctx.globalAlpha = 1;
    }],
    airshot: [(ctx, f) => {
      const d = Math.min(f.len, f.age * f.sp), c = Math.cos(f.a), s = Math.sin(f.a), k = 1 - win(f.age, f.dur - .4, f.dur);
      ctx.strokeStyle = `rgba(30,30,60,${.25 * k})`; ctx.lineWidth = 18; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x + c * 40, f.y + s * 40); ctx.lineTo(f.x + c * d, f.y + s * d); ctx.stroke();
      dustRing(ctx, f.x + c * d, f.y + s * d, 60, (f.age * 3) % 1.2, f.seed, 4, 'dust', .4 * k);
    }, (ctx, f) => {
      const d = f.age * f.sp; if (d > f.len + 60) return;
      const c = Math.cos(f.a), s = Math.sin(f.a), px = f.x + c * d, py = f.y - 30 + s * d, K = Kit();
      // a ring of compressed air with trailing ripples
      for (let i = 0; i < 4; i++) {
        const dd = d - i * 34; if (dd < 30) continue;
        const qx = f.x + c * dd, qy = f.y - 30 + s * dd, rr = 36 - i * 5;
        ctx.save(); ctx.translate(qx, qy); ctx.rotate(f.a); ctx.scale(.45, 1);
        ctx.strokeStyle = `rgba(30,30,80,${.5 - i * .1})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(235,245,255,${.95 - i * .2})`; ctx.lineWidth = 4.5; ctx.stroke();
        if (!i) { ctx.fillStyle = 'rgba(220,235,255,.35)'; ctx.fill(); }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px, py, 60, f.rgb, .8); K.glow(ctx, px, py, 22, '255,255,255', .9, true);
      if (f.age < .25) K.glow(ctx, f.x + c * 40, f.y - 30 + s * 40, 70, f.rgb, 1 - f.age / .25, true);
      ctx.globalCompositeOperation = 'source-over';
    }],
    wall: [(ctx, f) => {
      const t = f.age, K = Kit(), dust = K.puff('dust'), c = Math.cos(f.a), s = Math.sin(f.a);
      const d = Math.min(f.len, t * 1500), half = d * f.h * 1.05;
      if (t < .7) for (let i = 0; i < 12; i++) {
        const o = (i / 11 - .5) * 2 * half;
        K.stamp(ctx, dust, f.x + c * d - s * o, f.y + s * d + c * o * .5 - 8, 22 + hash(i + f.seed) * 16, .6 * (1 - t / .7));
      }
      dustRing(ctx, f.x + c * f.len * .6, f.y + s * f.len * .6, f.len * .4, t - .3, f.seed, 10);
    }, (ctx, f) => {
      const t = f.age, c = Math.cos(f.a), s = Math.sin(f.a), K = Kit();
      const d = t * 1500; if (d > f.len + 100) return;
      const half = Math.min(d, f.len) * f.h * 1.05, a = 1 - clamp01(d / (f.len + 100));
      // a wide wall of compressed air: a pale body, stacked bright arcs over a dark underlay
      {
        const dd0 = Math.max(30, d - 90), dd1 = d;
        ctx.beginPath();
        for (let j = 0; j <= 14; j++) { const u = j / 14 - .5, o = u * 2 * half, bow = (1 - 4 * u * u) * 30; const px = f.x + c * (dd1 + bow) - s * o, py = f.y - 34 + s * (dd1 + bow) + c * o * .5 + Math.abs(u) * 18; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        for (let j = 14; j >= 0; j--) { const u = j / 14 - .5, o = u * 2 * half * (dd0 / Math.max(1, d)), bow = (1 - 4 * u * u) * 20; const px = f.x + c * (dd0 + bow) - s * o, py = f.y - 34 + s * (dd0 + bow) + c * o * .5 + Math.abs(u) * 18; ctx.lineTo(px, py); }
        ctx.closePath(); ctx.fillStyle = `rgba(210,225,255,${a * .28})`; ctx.fill();
      }
      for (let layer = 0; layer < 3; layer++) {
        const dd = d - layer * 40; if (dd < 30) continue;
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(235,245,255,${a * (.95 - layer * .25)})` : `rgba(30,40,100,${a * .45})`;
          ctx.lineWidth = pass ? 5 - layer : 14 - layer * 3;
          ctx.beginPath();
          for (let j = 0; j <= 14; j++) {
            const u = j / 14 - .5, o = u * 2 * half * (dd / Math.max(1, d)), bow = (1 - 4 * u * u) * 30;
            const px = f.x + c * (dd + bow) - s * o, py = f.y - 34 + s * (dd + bow) + c * o * .5 + Math.abs(u) * 18;
            j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x + c * Math.min(d, f.len), f.y - 34 + s * Math.min(d, f.len), half * .7, f.rgb, a * .4, false, .5);
      if (t < .25) K.glow(ctx, f.x + c * 40, f.y - 30, 90, f.rgb, 1 - t / .25, true, .8);
      ctx.globalCompositeOperation = 'source-over';
    }],
    hamura: [(ctx, f, time) => {
      const t = f.age, K = Kit(), fade = 1 - win(t, f.dur - .8, f.dur);
      for (const l of f.lanes) {
        const c = Math.cos(l.a), s = Math.sin(l.a), d = Math.min(l.len, t / f.T * l.len);
        ctx.strokeStyle = `rgba(40,24,60,${.35 * fade})`; ctx.lineWidth = 60; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x0 + c * d, l.y0 + s * d); ctx.stroke();
        ctx.strokeStyle = `rgba(170,150,255,${.35 * fade})`; ctx.lineWidth = 16; ctx.stroke();
      }
      const bt = t - f.T * .82;
      if (bt > 0) {
        K.fx.shockRing(ctx, f.tx, f.ty, 470, bt * 1.1, Math.max(0, 1 - bt * .8), '190,170,255');
        if (bt > .15) K.fx.shockRing(ctx, f.tx, f.ty, 560, (bt - .15) * .9, Math.max(0, .9 - bt * .7), '255,255,255');
        cracks(ctx, f.tx, f.ty, 380, 16, f.seed, fade, easeOut(bt / .4));
        dustRing(ctx, f.tx, f.ty, 420, bt, f.seed, 18, 'dust', .65);
      }
    }, (ctx, f, time) => {
      const t = f.age, K = Kit(), img = lionImg('200,180,255');
      // two giant chakra lions charging down their lanes
      if (t < f.T * .9) for (const l of f.lanes) {
        const c = Math.cos(l.a), s = Math.sin(l.a), k = clamp01(t / f.T), d = l.len * easeIn(k * .5 + .5 * k * k) ;
        const px = l.x0 + c * d, py = l.y0 + s * d - 80;
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, px, py, 170, '170,150,255', .55, false, .8);
        // flame trail of the mane
        for (let i = 1; i < 7; i++) { const dd = d - i * 45; if (dd < 0) break; K.glow(ctx, l.x0 + c * dd, l.y0 + s * dd - 70, 90 - i * 8, '190,170,255', .35 - i * .04); }
        ctx.globalCompositeOperation = 'source-over';
        const sc = 1.55 + Math.sin(time * 9) * .04;
        ctx.save(); ctx.translate(px, py); ctx.scale(c >= 0 ? sc : -sc, sc);
        ctx.rotate(Math.atan2(s * .6, Math.abs(c)));
        ctx.drawImage(img, -112, -104, 240, 200);
        ctx.restore();
      }
      const bt = t - f.T * .82;
      if (bt > 0 && bt < 1.6) {
        ctx.globalCompositeOperation = 'lighter';
        if (bt < .5) K.glow(ctx, f.tx, f.ty - 60, 420 * (.5 + bt), '200,180,255', (1 - bt / .5), true, .75);
        K.glow(ctx, f.tx, f.ty - 40, 300, '170,150,255', Math.max(0, .6 - bt * .4), false, .6);
        ctx.globalCompositeOperation = 'source-over';
        K.fx.debris(ctx, f.tx, f.ty, 440, bt / 1.4, f.seed, '#3a2c3c', 18);
        // chakra flames licking up from the blast
        for (let i = 0; i < 12; i++) {
          const an = i * TAU / 12 + f.seed, ph = clamp01(bt / 1.4), d = 80 + ph * 300;
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, f.tx + Math.cos(an) * d, f.ty + Math.sin(an) * d * .5 - 30 - ph * 60, 60, '190,170,255', (1 - ph) * .5);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }],
    shadow: [(ctx, f, time, z) => {
      const t = f.age, d = Math.min(f.len, t * f.sp), k = 1 - win(t, f.dur - .4, f.dur);
      // while bound, the shadow stays stretched from Shikamaru to the victim
      const st = z && z.rk;
      if (st && st.bind && f.caught) {
        const b = st.bind, a = Math.atan2((b.y - z.y), (b.x - z.x)), L = Math.hypot(b.x - z.x, b.y - z.y);
        shadowBand(ctx, z.x, z.y + 2, a, L, 13, time, f.seed, 1);
        shadowPool(ctx, b.x, b.y + 3, 30, 1, time, f.seed);
        return;
      }
      shadowBand(ctx, f.x, f.y + 2, f.a, d, 13, time, f.seed, k);
    }, null],
    hands: [(ctx, f, time) => {
      const t = f.age, k = 1 - win(t, f.dur - .4, f.dur), tt = f.T;
      const a = Math.atan2(f.y - f.sy, f.x - f.sx), L = Math.hypot(f.x - f.sx, f.y - f.sy), d = Math.min(L, t / Math.max(.05, tt) * L);
      shadowBand(ctx, f.sx, f.sy + 2, a, d, 10, time, f.seed, k);
      if (t > tt) shadowPool(ctx, f.x, f.y, f.r * easeOut((t - tt) / .25), k, time, f.seed);
    }, (ctx, f, time) => {
      const t = f.age - f.T, k = 1 - win(f.age, f.dur - .5, f.dur);
      if (t <= 0) return;
      // shadow hands crawling up and closing on the throat
      for (let i = 0; i < 14; i++) {
        const an = i * TAU / 14 + f.seed, rr = f.r * (.3 + hash(i + f.seed) * .55) * (1 - easeOut(t / 1.2) * .5);
        const px = f.x + Math.cos(an) * rr, py = f.y + Math.sin(an) * rr * .5;
        shadowHand(ctx, px, py, 46 + hash(i * 3) * 36, an + Math.PI, easeOut((t - i * .03) / .35) * k, i);
      }
    }],
    needles: [(ctx, f, time) => {
      const t = f.age, k = 1 - win(t, f.dur - .4, f.dur), d = Math.min(f.len, t * f.sp);
      for (const a of f.lanes) shadowBand(ctx, f.x, f.y + 2, a, d, 7, time, f.seed + a, k * .9);
    }, (ctx, f, time) => {
      const t = f.age, k = 1 - win(t, f.dur - .5, f.dur), d = Math.min(f.len, t * f.sp);
      // black spears punching up out of the shadow, a few per lane, the newest at the tip
      for (const a of f.lanes) {
        const c = Math.cos(a), s = Math.sin(a);
        for (let dd = 90; dd <= d; dd += 85) {
          const age = t - dd / f.sp, rise = easeOut(age / .12) * k * (1 - win(age, .5, .9) * .4);
          if (rise <= .02) continue;
          const px = f.x + c * dd, py = f.y + s * dd, h = (42 + hash(dd + a * 10) * 26) * rise;
          ctx.fillStyle = '#0a0612';
          ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + c * 6, py - h); ctx.lineTo(px + 4, py); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(150,120,210,.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }],
    blade: [null, (ctx, f) => {
      const t = f.age, d = Math.min(f.len, t * 1500), c = Math.cos(f.a), s = Math.sin(f.a), k = 1 - t / f.dur, K = Kit();
      const px = f.x + c * d, py = f.y - 34 + s * d;
      speedLines(ctx, f.x, f.y, f.x + c * d, f.y + s * d, 16, k * .8, f.seed, '190,240,255', 34);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px - c * 20, py - s * 20, 64, '120,200,255', k * .3);
      ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(200,245,255,${k * .55})`; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const o = (i - 2.5) * 16; ctx.moveTo(px - c * 30 - s * o, py - s * 30 + c * o); ctx.lineTo(px - c * 140 - s * o, py - s * 140 + c * o); } ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // the wind blade: a crescent with a dark underlay so it reads on bright ground
      ctx.save(); ctx.translate(px, py); ctx.rotate(f.a); ctx.scale(1, f.flip ? -1 : 1);
      const cres = (R0, R1, o) => { ctx.beginPath(); ctx.arc(-30 + o, 0, R0, -1.1, 1.1); ctx.arc(-52 + o, 0, R1, 1.0, -1.0, true); ctx.closePath(); };
      ctx.save(); ctx.translate(2, 4); cres(80, 64, 0); ctx.fillStyle = `rgba(20,50,90,${k * .55})`; ctx.fill(); ctx.restore();
      cres(78, 64, 0); ctx.fillStyle = `rgba(150,220,255,${k * .9})`; ctx.fill();
      cres(76, 68, 2); ctx.fillStyle = `rgba(250,255,255,${k})`; ctx.fill();
      ctx.restore();
    }],
    tags: [(ctx, f, time) => {
      const t = f.age, img = tagImg(), K = Kit();
      for (let i = 0; i < f.pts.length; i++) {
        const p = f.pts[i], bt = t - f.T - p.t0;
        if (bt > 0) continue;
        // laid tags blink faster as the fuse burns down (rain: they flutter down first)
        const land = f.rain ? clamp01(t / (.4 + (i % 5) * .08)) : 1;
        if (land < 1) continue;
        const blink = Math.sin(time * (14 + 30 * clamp01(t / (f.T + p.t0)))) > 0;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .55); ctx.rotate(hash(i + f.seed) * 2 - 1);
        ctx.drawImage(img, -10, -18, 20, 36);
        if (blink) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, 0, 0, 26, '255,120,60', .7); ctx.globalCompositeOperation = 'source-over'; }
        ctx.restore();
      }
      // wires strung between the tags of a trap ring
      if (!f.rain && t < f.T) {
        ctx.strokeStyle = 'rgba(30,30,40,.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 1; i < f.pts.length; i++) { ctx.moveTo(f.pts[i].x, f.pts[i].y); const q = f.pts[i % (f.pts.length - 1) + 1]; ctx.lineTo(q.x, q.y); }
        ctx.stroke();
      }
      for (const p of f.pts) { const bt = t - f.T - p.t0; if (bt > 0 && bt < 2.2) { ctx.fillStyle = `rgba(40,20,10,${.35 * (1 - bt / 2.2)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 80, 40, 0, 0, TAU); ctx.fill(); } }
    }, (ctx, f, time) => {
      const t = f.age, img = tagImg();
      if (f.rain) for (let i = 0; i < f.pts.length; i++) {
        const p = f.pts[i], land = clamp01(t / (.4 + (i % 5) * .08));
        if (land >= 1) continue;
        const h = (1 - land) * 260, sw = Math.sin(time * 8 + i) * 16 * (1 - land);
        ctx.save(); ctx.translate(p.x + sw, p.y - h); ctx.rotate(Math.sin(time * 6 + i) * .6);
        ctx.drawImage(img, -10, -18, 20, 36);
        ctx.restore();
      }
      for (let i = 0; i < f.pts.length; i++) {
        const p = f.pts[i], bt = t - f.T - p.t0;
        if (bt > 0) blastFire(ctx, p.x, p.y, i === f.pts.length - 1 && f.rain ? 170 : 115, bt, time, f.seed + i);
      }
    }],
    web: [(ctx, f, time, z) => {
      const t = f.age, k = 1 - win(t, f.dur - .5, f.dur), d = t * f.sp;
      shadowPool(ctx, f.x, f.y + 2, 60, k, time, f.seed);
      for (const b of f.branches) {
        const L = Math.min(b.len, d);
        // a curved branch: draw as several short bands following the bend
        const n = 6;
        for (let i = 0; i < n; i++) {
          const d0 = L * i / n, d1 = L * (i + 1) / n; if (d1 <= d0 + 1) continue;
          const a0 = b.a + b.b * (d0 / b.len), a1 = b.a + b.b * (d1 / b.len);
          const x0 = f.x + Math.cos(a0) * d0, y0 = f.y + Math.sin(a0) * d0, x1 = f.x + Math.cos(a1) * d1, y1 = f.y + Math.sin(a1) * d1;
          const aa = Math.atan2(y1 - y0, x1 - x0);
          shadowBand(ctx, x0, y0 + 2, aa, Math.hypot(x1 - x0, y1 - y0) + 6, 12 * (1 - i / n * .6), time, f.seed + i, k);
        }
      }
      const st = z && z.rk;
      if (f.caught && st && st.bind) shadowPool(ctx, st.bind.x, st.bind.y + 3, 34, 1, time, f.seed);
    }, null]
  };

  // ================================================================== overlays drawn from state
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
    if (id === 'shikamaru' && (st.move === 'kage' || st.move === 'kubi' || st.move === 'nui' || st.move === 'mass')) {
      // the shadow pooling and stirring under his feet (Rat seal)
      shadowPool(ctx, z.x, z.y + 3, 30 + 40 * k * (st.move === 'mass' ? 2 : 1), .5 + .5 * k, time, st.seed);
    }
    if ((id === 'hinata' || id === 'neji') && st.move !== 'kunai') {
      // Byakugan: veins and a pale flare at the eyes
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x + fac * 6, fy - H * .86, 14 + 8 * k, '230,225,255', .7);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (id === 'sakura' && st.move !== 'regen' && st.move !== 'katsuyu') {
      // chakra gathering in the fist
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x + fac * 16, fy - H * .5, 20 + 26 * k, '255,120,180', .8 * k, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Byakugō: the seal lines spreading from the diamond over her face and arms, violet aura, petals.
  function drawSeal(ctx, z, st, time) {
    const lvl = Math.min(1, st.seal * 1.5);
    if (lvl < .03) return;
    const K = Kit(), H = bodyH('sakura'), fy = z.y + 3 - st.lift, fac = facingOf(z);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, H * .75, '190,110,255', .28 * lvl, false, 1.3);
    ctx.globalCompositeOperation = 'source-over';
    // seal lines (diamond chains) crawling down from the forehead
    const grow = clamp01((4.4 - st.seal) / .6 + .2) * lvl;
    ctx.strokeStyle = `rgba(40,10,60,${.85 * lvl})`; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    const fx0 = z.x + fac * 6, fy0 = fy - H * .9;
    ctx.beginPath();
    for (const [dx, len] of [[-1, H * .5], [1, H * .5], [-1.6, H * .3], [1.6, H * .3]]) {
      let x = fx0, y = fy0;
      ctx.moveTo(x, y);
      const n = Math.floor(6 * grow);
      for (let i = 0; i < n; i++) { x += dx * 2.2 * (i % 2 ? -1 : 1) + dx * 1.2; y += len / 6; ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(150,80,220,${lvl})`;
    for (let i = 0; i < 6 * grow; i++) { const y = fy0 + i * H * .08, x = fx0 + (i % 2 ? -3 : 3); ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 1.6, y); ctx.lineTo(x, y + 2); ctx.lineTo(x - 1.6, y); ctx.fill(); }
    // healing sparkles / petals rising off her
    for (let i = 0; i < 8; i++) {
      const ph = (time * .8 + i / 8) % 1, x = z.x + Math.sin(i * 2.3 + time) * (14 + ph * 16), y = fy - 10 - ph * H * 1.1;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, x, y, 8, i % 2 ? '255,150,210' : '190,130,255', (1 - ph) * lvl);
      ctx.globalCompositeOperation = 'source-over';
    }
    petals(ctx, z.x, fy - H * .3, 60, (time * .5) % 1, 7, 5, .7 * lvl);
  }
  // Twin Lion Fists: a chakra lion head roaring on each fist.
  function drawLionFists(ctx, z, st, time) {
    const lvl = Math.min(1, st.lion * 3);
    if (lvl < .03) return;
    const K = Kit(), H = bodyH('hinata'), fy = z.y + 3 - st.lift, fac = facingOf(z), img = lionImg('170,160,255');
    for (const side of [-1, 1]) {
      const px = z.x + fac * (18 + side * 4), py = fy - H * .5 + side * 8;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px, py, 40, '170,160,255', .6 * lvl); ctx.globalCompositeOperation = 'source-over';
      const sc = .4 * (1 + Math.sin(time * 12 + side) * .05) * lvl;
      ctx.save(); ctx.globalAlpha = lvl; ctx.translate(px, py); ctx.scale(fac * sc, sc); ctx.drawImage(img, -70, -104, 240, 200); ctx.restore();
    }
  }
  function label(ctx, z, st, m, time) {
    if (!(st.windup > 0) || !st.move) return;
    const def = MOVES[z.bossId][st.move], top = z.y + 3 - st.lift - bodyH(z.bossId) - 40;
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

  // ================================================================== module hooks
  function draw(ctx, z, time) {
    const st = z.rk;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
      for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
    }
    if (z.health > 0 && st.bind && z.bossId === 'shikamaru' && !st.fx.some(f => f.caught)) {
      shadowBand(ctx, z.x, z.y + 2, Math.atan2(st.bind.y - z.y, st.bind.x - z.x), Math.hypot(st.bind.x - z.x, st.bind.y - z.y), 12, time, 3, 1);
      shadowPool(ctx, st.bind.x, st.bind.y + 3, 30, 1, time, 3);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.rk, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (z.bossId === 'sakura') drawSeal(ctx, z, st, time);
      if (z.bossId === 'hinata') drawLionFists(ctx, z, st, time);
      if (st.bind) {
        // the caught unit: shadow climbing its legs
        const b = st.bind;
        for (let i = 0; i < 4; i++) shadowHand(ctx, b.x + (i - 1.5) * 7, b.y + 3, 22 + (i % 2) * 6, 0, Math.min(1, (b.dur - b.t) * 4), i);
      }
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, bodyH(z.bossId));
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const bodyLift = z => (z.rk && z.health > 0 ? z.rk.lift || 0 : 0);

  window.KonohaRookieBosses = { members, order, pick, update, draw, drawOverlay, bodyLift, moveLabels, moves };
})();
