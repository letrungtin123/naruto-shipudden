/* Konoha 11 rivals (spawn panel, faction 'konoha11'): Akimichi Chōji, Yamanaka Ino, Inuzuka Kiba (with Akamaru),
 * Aburame Shino and Tenten. Same contract as duel-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time)
 * paints telegraphs and ground effects, drawOverlay(ctx, z, time) what stands above the characters. All per-boss state
 * lives on z.k11 (plain numbers / small arrays; closures in ev/upd are dropped by the co-op JSON snapshot).
 * The five sprites are registered here with AnimeSprites.addSprite (specs built from AnimeSprites.kit).
 *
 * Chōji  : Nhục Đạn Châm Chiến Xa (spiked rolling tank, two passes), Siêu Bội Hóa Chưởng Kích (giant palm slam),
 *          Tam Sắc Dược Hoàn (pill: chakra burst + buff), Bội Hóa Chi Thuật (giant body press + stomp),
 *          ultimate Điệp Đạn Bạo Kích (Butterfly Mode wings, giant chakra fist).
 * Ino    : Tâm Chuyển Thân (mind possession drags the victim), Hoa Bộc Liên (flower bombs), Tâm Hoại Tinh Thần Phá
 *          (mind-wave cone), Cảm Tri Truyền Tâm (sensory net + chakra spikes), ultimate Tâm Loạn Thân (disturbance field).
 * Kiba   : Thông Nha (zigzag drill), Động Thái Ký Hiệu (Akamaru's scent mark: the next Gatsūga homes), Nha Thông Nha
 *          (twin crossing drills), Thú Nhân Phân Thân · Yên Đạn (smoke + two Kibas), ultimate Song Đầu Lang · Nha Lang Nha.
 * Shino  : Trùng Vân (drifting swarm), Trùng Phân Thân (insect clones), Trùng Trụ (insect pillars), Thực Chakra (drain
 *          beam, heals him), ultimate Trùng Cầu Đại Quyển (closing insect sphere + swarm tornado).
 * Tenten : Song Thăng Long (twin scroll dragons, weapon rain), Liên Tỏa Chùy (chain ball + whip), Bộc Phù Khổ Vô
 *          (explosive kunai fan), Ba Tiêu Phiến (fire-wind fan wave), ultimate Thiên Binh Vạn Nhận (weapon storm). */
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
  const SK = window.AnimeSprites && window.AnimeSprites.kit;
  const SPEC = {};
  if (SK) (() => {
    const { paint, seg, line, lerp, lit, litN, dark, light, mix, rgba, SHADE, DEEP, DEEP2, GLOSS, CREASE, poly, smooth, ell, dot,
      plateSymbol, sweptHair, sweptBack, locks, HAIR, headPath, onFace, drawEye, fringeShadow } = SK;
    const T = Math.PI * 2;
    const spiral = (ctx, x, y, r, turns, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      const n = Math.round(turns * 12);
      for (let i = 0; i <= n; i++) { const a = i / 12 * T, rr = r * (i / n); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * .85; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    };

    // ---- Akimichi Chōji (Shippuden): long spiky red-brown hair down his back, the forehead protector with metal
    // ear guards, red spirals on his cheeks, red segmented armour over a black suit (食 on the chest plate),
    // big round shoulder pads, armoured skirt, forearm guards.
    function chojiSpec() {
      const O = '#2a1610', SKIN = '#f2c8a0', SKD = '#d49a78', HC = '#a2422a', RED = '#cc3a2c', REDD = '#8a1e1a', BLK = '#2a2930', PLATE = '#c9d1da';
      const pad = (ctx, pts, c) => paint(ctx, () => smooth(ctx, pts), c, O, .95, () => {
        ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-20, -9.8); ctx.quadraticCurveTo(-4, -8, 20, -10.4); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.fill();
        ctx.fillStyle = DEEP2; ctx.fillRect(-20, -9.2, 40, 2);
        ctx.fillStyle = 'rgba(255,220,200,.32)'; ell(ctx, pts[1][0] + 1, pts[1][1] + 1.6, 3.2, .8, -.1); ctx.fill();
        ctx.strokeStyle = rgba(REDD, .9); ctx.lineWidth = .4;
        ctx.beginPath(); ctx.moveTo(pts[0][0] + 1, pts[0][1] + 1.6); ctx.quadraticCurveTo(pts[1][0], pts[1][1] + 3.4, pts[2][0] - .6, pts[2][1] + 2.2); ctx.stroke();
      });
      return {
        outline: O, skin: SKIN, skinShade: SKD, bulk: 3.4, legK: .96, headScale: 1.06,
        legs: { thigh: BLK, shin: BLK, foot: '#2a2430', wrap: '#e2dacb', w1: 7.6, w2: 6.4 },
        arms: { upper: BLK, lower: BLK, w1: 6.8, w2: 6.2, guard: RED, hand: SKIN },
        torso: {
          base: RED,
          paint(ctx) {
            // black mesh collar in the neckline
            ctx.fillStyle = BLK; ctx.beginPath(); ctx.moveTo(-3.6, -13.6); ctx.lineTo(6.4, -13.6); ctx.lineTo(2.4, -10.4); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(150,150,170,.35)'; ctx.lineWidth = .25;
            for (let i = -3; i < 7; i += 1.1) { ctx.beginPath(); ctx.moveTo(i, -13.6); ctx.lineTo(i + 2, -11); ctx.stroke(); }
            // segmented armour rows bulging over the belly
            for (const [y, k] of [[-9.6, .5], [-6.4, .8], [-3.2, 1]]) {
              ctx.fillStyle = 'rgba(255,200,180,.22)';
              ctx.beginPath(); ctx.moveTo(-14, y + .1); ctx.quadraticCurveTo(2, y - 1.6 * k, 16, y + .1); ctx.lineTo(16, y + .8); ctx.quadraticCurveTo(2, y - .8 * k, -14, y + .8); ctx.fill();
              ctx.strokeStyle = REDD; ctx.lineWidth = .55;
              ctx.beginPath(); ctx.moveTo(-14, y); ctx.quadraticCurveTo(2, y - 1.8 * k, 16, y); ctx.stroke();
            }
            ctx.strokeStyle = rgba(REDD, .7); ctx.lineWidth = .4;
            for (const x of [-4.8, 9.4]) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.quadraticCurveTo(x + (x < 0 ? -1 : 1), -6, x, 0); ctx.stroke(); }
            // 食 in a pale disc on the chest plate
            dot(ctx, 3.2, -6.6, 2.7, '#f4ead8');
            ctx.strokeStyle = REDD; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(3.2, -6.6, 2.7, 0, T); ctx.stroke();
            ctx.font = 'bold 3.6px "Yu Mincho","MS Mincho",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#7a1414'; ctx.fillText('食', 3.2, -6.4);
            // dark belt with a buckle
            ctx.fillStyle = BLK; ctx.fillRect(-14, -1.6, 30, 2.2);
            ctx.fillStyle = 'rgba(160,160,190,.35)'; ctx.fillRect(-14, -1.6, 30, .4);
            ctx.fillStyle = '#c8b070'; ctx.fillRect(2, -1.5, 2.6, 2);
          },
          over(ctx) {
            // far shoulder pad, sitting on the shoulder behind the head
            pad(ctx, [[5.2, -13.6], [9.4, -15], [13.4, -12.4], [12.6, -8.8], [7.6, -9.4], [5, -11.6]], dark(RED, .18));
          }
        },
        skirt: {
          color: RED, hem: 5.6, flare: 2.6, opening: false, paint: (ctx, hem, hipY) => {
            ctx.strokeStyle = REDD; ctx.lineWidth = .5;
            for (const x of [-6.6, -2.2, 2.2, 6.6]) { ctx.beginPath(); ctx.moveTo(x * .8, hipY); ctx.lineTo(x * 1.1, hem + 1); ctx.stroke(); }
            ctx.fillStyle = dark(RED, .32); ctx.fillRect(-20, hem - 1.4, 40, 2);
            ctx.fillStyle = 'rgba(255,210,190,.3)'; ctx.fillRect(-20, hipY + .2, 40, .5);
          }
        },
        shoulder(ctx) {
          pad(ctx, [[-9.6, -13], [-4, -16.2], [1.8, -13.8], [1.8, -9.6], [-4, -8.2], [-10, -9.8]], RED);
          dot(ctx, -4, -12.6, .5, '#e8d090'); dot(ctx, -1.2, -12, .45, '#e8d090');
        },
        head: {
          drape: (ctx, spec) => HAIR.longBack(HC, 30, 13.4, { split: true })(ctx, spec),
          hair: (ctx, sp) => sweptHair(ctx, sp, HC, [[-28, 15.6], [-56, 17.8], [-84, 19], [-112, 19.2], [-140, 18.6], [-166, 18], [-192, 17.4], [-218, 16.2]], { valley: 12.6, sweep: .22 }),
          ear(ctx, spec) {
            // the protector's metal ear guard
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-5.6, -3); ctx.lineTo(-1.2, -3.2); ctx.quadraticCurveTo(-.6, 2, -1.4, 6.6); ctx.quadraticCurveTo(-3.6, 7.6, -5.8, 6.4); ctx.quadraticCurveTo(-6.4, 2, -5.6, -3); ctx.closePath(); }, PLATE, spec.outline, .8, () => {
              ctx.fillStyle = 'rgba(40,40,70,.28)'; ctx.fillRect(-7, 1.6, 7, 6);
              ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-5, -2.6, 3, .5);
            });
            dot(ctx, -3.4, 2, .5, dark(PLATE, .5));
          },
          band: { cloth: BLK, plate: PLATE, symbol: 'leaf', wide: true },
          eyes: { type: 'normal', iris: '#3a2214' }, browColor: dark(HC, .3), browW: 1.1, mouth: 'grin', attackMouth: 'shout',
          marks(ctx) { spiral(ctx, 2.2, 6.6, 1.9, 2.2, '#c22a2a', .45); spiral(ctx, 9.2, 6.2, 1.1, 1.8, '#c22a2a', .4); }
        }
      };
    }

    // ---- Yamanaka Ino (Shippuden): long blond ponytail, the long bang over her right eye, pale blue eyes, purple
    // zipped crop top showing the midriff, the forehead protector worn as a belt, long purple skirt, arm warmers.
    function inoSpec() {
      const O = '#2a1630', SKIN = '#fbe0cc', SKD = '#e6b2a0', HC = '#f8dc7a', PUR = '#8e52c0', PURD = '#6a3a96';
      return {
        outline: O, skin: SKIN, skinShade: SKD, bulk: -.8, legK: 1.16,
        legs: { thigh: SKIN, shin: SKIN, foot: '#4a3260', wrap: '#f2ebe0', w1: 4.4, w2: 3.6 },
        arms: { upper: SKIN, lower: SKIN, w1: 3.8, w2: 3.4, guard: PUR, hand: SKIN },
        torso: {
          base: PUR,
          paint(ctx) {
            // bare midriff under the crop top, navel, the protector-belt
            ctx.fillStyle = SKIN; ctx.fillRect(-12, -4.8, 26, 3.6);
            ctx.fillStyle = 'rgba(200,120,130,.35)'; ctx.fillRect(-12, -4.8, 26, .7);
            dot(ctx, 3.6, -3, .3, 'rgba(160,90,100,.7)');
            ctx.fillStyle = '#2a2236'; ctx.fillRect(-12, -1.4, 26, 2);
            ctx.fillStyle = '#cfd6de'; ctx.fillRect(1.6, -1.7, 4.4, 2.5);
            ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(1.6, -1.7, 4.4, .45);
            plateSymbol(ctx, 'leaf', 3.8, -.45, .5, '#58606c');
            // zipper and seams of the top
            line(ctx, [[3.4, -13.4], [3.4, -4.8]], 'rgba(230,220,255,.6)', .35);
            line(ctx, [[3.7, -13.4], [3.7, -4.8]], rgba(PURD, .9), .3);
            ctx.strokeStyle = rgba(PURD, .8); ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-4.6, -12.6); ctx.quadraticCurveTo(-3.4, -8.6, -4.2, -4.8); ctx.stroke();
            ctx.fillStyle = rgba(PURD, .9); ctx.fillRect(-12, -5.6, 26, .8);
          }
        },
        skirt: {
          color: PUR, hem: 12.4, flare: 1.4, paint: (ctx, hem, hipY) => {
            ctx.fillStyle = PURD; ctx.fillRect(-20, hem - 1.2, 40, 1.4);
            ctx.fillStyle = 'rgba(230,210,255,.3)'; ctx.fillRect(-20, hipY + .4, 40, .5);
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.ellipse(1.6, -13.3, 3.6, 1.3, 0, 0, T); }, PUR, O, .7, () => { ctx.fillStyle = SHADE; ctx.fillRect(-3, -13.4, 9, 2); });
        },
        head: {
          drape(ctx, spec, pose) {
            // the high ponytail falling down her back, tied at the crown
            const s = pose && pose.run ? 2.4 : 0;
            paint(ctx, () => smooth(ctx, [[-6.4, -12.4], [-11.4, -13.6], [-14.4, -8], [-15.6 - s, 4], [-15.8 - s * 1.4, 18], [-14.2 - s * 1.8, 30], [-12.4 - s * 2.2, 38.4], [-10.8 - s * 1.6, 31], [-10.6 - s, 18], [-10.4, 6], [-8.6, -4]]), HC, spec.outline, 1, () => {
              ctx.fillStyle = dark(HC, .26); ctx.fillRect(-12.4, -6, 8, 46);
              ctx.strokeStyle = dark(HC, .4); ctx.lineWidth = .45;
              for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10.6 - i * .9, -8); ctx.quadraticCurveTo(-14.6 - i * .5 - s, 12, -12.4 - i * .6 - s * 2, 34); ctx.stroke(); }
              ctx.strokeStyle = SK.hairGloss(HC); ctx.lineWidth = .8;
              ctx.beginPath(); ctx.moveTo(-13.2, -6); ctx.quadraticCurveTo(-15.2 - s, 6, -14.6 - s, 16); ctx.stroke();
            });
            paint(ctx, () => ell(ctx, -9, -11.4, 2, 1.7, .4), '#5a3a8a', spec.outline, .6);
          },
          hair: HAIR.smooth(HC, { nape: 5.4, bangs: [[-.4, 1.6, 6.2], [2.6, 1.3, 1.6]] }),
          eyes: { type: 'normal', iris: '#5aa6e8', fem: true }, mouth: 'lips', lipColor: '#e0809a', attackMouth: 'shout', browColor: '#d8b250', browW: .6,
          front(ctx, spec) {
            // the long bang sweeping over her right eye, and a small earring
            fringeShadow(ctx, [[5.6, -6], [12, -6], [11.6, 6], [8, 7.4], [6, 2]]);
            locks(ctx, spec, HC, [[5.8, -9, 10.6, 7.6, 2.9, 1.2], [8.6, -8.6, 11.6, 3.4, 1.8, .6], [3.6, -9.2, 6, -2.6, 1.5, .4]], .85);
            dot(ctx, -3.6, 5.2, .55, '#b48ae8'); dot(ctx, -3.7, 5.05, .2, '#ffffff');
          }
        }
      };
    }

    // ---- Inuzuka Kiba (Shippuden): wild brown spikes, red fang marks on both cheeks, the forehead protector, a dark
    // grey jacket with a fur-trimmed hood down behind the neck, dark trousers with shin wraps.
    function kibaSpec() {
      const O = '#1e1612', SKIN = '#e6bb92', SKD = '#c48f6c', HC = '#4a2e1e', JK = '#3c4048', JKL = '#5a616c', FUR = '#ddd5c4', PANTS = '#2c3038';
      const fang = (ctx, x, y, w, h) => { ctx.fillStyle = '#c8202a'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y - .2); ctx.lineTo(x + w * .1, y + h); ctx.closePath(); ctx.fill(); };
      const furEdge = (ctx, pts) => {
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) { const p = pts[i], q = pts[i - 1]; ctx.quadraticCurveTo((p[0] + q[0]) / 2 + (i % 2 ? .9 : -.9), (p[1] + q[1]) / 2 - 1.1, p[0], p[1]); }
          ctx.closePath();
        }, FUR, O, .75, () => {
          ctx.fillStyle = 'rgba(80,60,90,.3)'; ctx.fillRect(-20, -13, 40, 2.4);
          ctx.strokeStyle = 'rgba(120,100,90,.55)'; ctx.lineWidth = .3;
          for (let i = 0; i < pts.length - 1; i++) { const m = lerp(pts[i], pts[i + 1], .5); ctx.beginPath(); ctx.moveTo(m[0], m[1] + 1.2); ctx.lineTo(m[0] + .4, m[1] - .6); ctx.stroke(); }
        });
      };
      return {
        outline: O, skin: SKIN, skinShade: SKD, bulk: .6, legK: 1.12,
        legs: { thigh: PANTS, shin: PANTS, foot: '#22262e', wrap: '#d8d0c4', holster: '#2a2e36', w1: 5.4, w2: 4.5 },
        arms: { upper: JK, lower: JK, w1: 5.2, w2: 4.7, cuff: '#26292f', hand: SKIN },
        torso: {
          base: JK,
          paint(ctx) {
            // lighter side panels, the zip, a chest pocket
            ctx.fillStyle = JKL; ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(10, -12); ctx.lineTo(10, 1); ctx.lineTo(6.4, 1); ctx.quadraticCurveTo(7.4, -6, 6, -13); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-3.4, -13); ctx.quadraticCurveTo(-5, -6, -4.4, 1); ctx.lineTo(-9, 1); ctx.lineTo(-9, -13); ctx.fill();
            line(ctx, [[2.6, -13.4], [2.9, 0]], '#9aa0ac', .45);
            line(ctx, [[2.9, -13.4], [3.2, 0]], '#1c1e24', .3);
            ctx.fillStyle = dark(JK, .2); ctx.fillRect(-1.6, -9.6, 3.2, 2.6);
            ctx.strokeStyle = '#1c1e24'; ctx.lineWidth = .3; ctx.strokeRect(-1.6, -9.6, 3.2, 2.6);
            ctx.fillStyle = '#7a2a2a'; ctx.fillRect(-12, -2.2, 26, 1.8);
          }
        },
        collarBack(ctx, pose) {
          // the hood lying down behind the shoulders, fur round its rim
          const run = pose && pose.run ? 1 : 0;
          paint(ctx, () => smooth(ctx, [[-6.2, -12.4], [-9.6 - run, -16.6], [-6, -20.4 - run], [-.4, -20], [3, -17.4], [1.6, -13.2]]), dark(JK, .12), O, .9, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-12, -17, 8, 6);
          });
          furEdge(ctx, [[-8.8, -16.2], [-7.4, -19.4], [-4, -20.8], [-.4, -20.4], [2.4, -18.4], [1.4, -16.6], [-1.4, -18.4], [-4.4, -18.6], [-7, -15.4]]);
        },
        collar(ctx) {
          furEdge(ctx, [[-3.6, -12.2], [-3.4, -15.2], [-.4, -16.6], [3, -16.4], [5.6, -15], [5.4, -12.4], [2.6, -13.6], [-.6, -13.6]]);
        },
        head: {
          hair: HAIR.spiky(HC, { count: 9, tips: [5.6, 8.4, 10.2, 9.4, 10.8, 9.6, 8.6, 7.4, 5.6] }),
          band: { cloth: '#23262e', plate: '#c9d1da', symbol: 'leaf' },
          eyes: { type: 'normal', iris: '#3a2414' }, browAngle: 'angry', browW: .95, browColor: HC, mouth: 'grin', attackMouth: 'shout', blush: false,
          marks(ctx) {
            fang(ctx, 2.2, 4.8, 1.3, 3.8); fang(ctx, 9.2, 4.6, .8, 3.2);
            // a fang poking out of the grin
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(7.6, 6.9); ctx.lineTo(8.5, 6.8); ctx.lineTo(8.1, 8.2); ctx.closePath(); ctx.fill();
            // slit pupils
            ctx.fillStyle = '#100a08'; ell(ctx, 2.75, 2.5, .34, 1.6); ctx.fill(); ell(ctx, 8.2, 2.4, .26, 1.4); ctx.fill();
          },
          front(ctx, spec) { locks(ctx, spec, HC, [[-1.4, -8.6, -2.8, -1.6, 1.4, -.8], [9.6, -7.4, 11, -2.2, 1.2, .6]], .85); }
        }
      };
    }

    // ---- Aburame Shino (Shippuden): the long grey-green coat with its hood up, the tall collar hiding his mouth,
    // round black glasses, nothing of his face but the nose and cheeks.
    function shinoSpec() {
      const O = '#141a16', SKIN = '#ead2ba', COAT = '#7c8a72', COATD = '#5a6654', PANTS = '#33383e';
      return {
        outline: O, skin: SKIN, skinShade: '#c8aa94', bulk: .5, legK: 1.1,
        legs: { thigh: PANTS, shin: PANTS, foot: '#23262c', wrap: '#cfc8bc', w1: 5.2, w2: 4.4 },
        arms: { upper: COAT, lower: COAT, w1: 5.8, w2: 5.8, cuff: COATD, hand: SKIN },
        torso: {
          base: COAT,
          paint(ctx) {
            // coat front edge, toggles, a belt of dark cloth, long fold lines
            ctx.fillStyle = COATD; ctx.fillRect(2.6, -13.6, 1.4, 14);
            ctx.fillStyle = 'rgba(230,240,220,.25)'; ctx.fillRect(2.4, -13.6, .4, 14);
            for (const y of [-10.6, -7.2]) { ctx.fillStyle = '#2e342c'; ctx.fillRect(1.6, y, 3.4, .9); }
            ctx.strokeStyle = rgba(COATD, .9); ctx.lineWidth = .45;
            for (const [x0, x1] of [[-3.6, -4.4], [7.4, 8.2], [.4, -.2]]) { ctx.beginPath(); ctx.moveTo(x0, -12); ctx.quadraticCurveTo(x0 + .6, -6, x1, 0); ctx.stroke(); }
            ctx.fillStyle = '#3a4038'; ctx.fillRect(-12, -2.4, 26, 1.8);
          }
        },
        skirt: {
          color: COAT, hem: 14.6, flare: 2.2, paint: (ctx, hem) => {
            ctx.fillStyle = COATD; ctx.fillRect(-20, hem - 1.4, 40, 1.6);
            ctx.strokeStyle = rgba(COATD, .9); ctx.lineWidth = .45;
            for (const x of [-5, -1, 4.6]) { ctx.beginPath(); ctx.moveTo(x, hem - 14); ctx.quadraticCurveTo(x - .6, hem - 6, x - 1, hem - 1); ctx.stroke(); }
          }
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3.6, -12); ctx.lineTo(-4.2, -16); ctx.lineTo(5.8, -16.2); ctx.lineTo(5.6, -12); ctx.closePath(); }, COAT, O, .8, () => { ctx.fillStyle = SHADE; ctx.fillRect(-5, -16.4, 4, 5); });
        },
        head: {
          back(ctx, spec) {
            // hood mass behind the head
            paint(ctx, () => smooth(ctx, [[-4, -14.8], [-12.2, -12.8], [-14.4, -2], [-13, 8.4], [-6, 12.6], [2, 10]]), COATD, spec.outline, 1, () => {
              ctx.fillStyle = 'rgba(20,30,20,.25)'; ctx.fillRect(-16, -2, 10, 16);
            });
          },
          hair: HAIR.spiky('#26262c', { count: 7, tips: [3, 4, 5, 5, 4, 3, 3] }),
          noEyes: true, brows: false, blush: false,
          mask(ctx, spec) {
            // the tall coat collar standing up over the mouth and jaw
            paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-10.4, 2.4); ctx.quadraticCurveTo(0, 3.6, 6, 4.4); ctx.quadraticCurveTo(10, 4.2, 12.2, 3); ctx.lineTo(12, 15); ctx.quadraticCurveTo(0, 16.6, -10, 14.6); ctx.closePath(); }, COAT, spec.outline, 1.05, () => {
              ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(-3, 6, -3.4, 16); ctx.lineTo(-12, 16); ctx.fill();
              ctx.fillStyle = 'rgba(230,240,220,.3)'; ctx.beginPath(); ctx.moveTo(-6, 3.4); ctx.quadraticCurveTo(3, 4.6, 11.6, 3.6); ctx.lineTo(11.6, 4.6); ctx.quadraticCurveTo(3, 5.6, -6, 4.4); ctx.fill();
              ctx.strokeStyle = rgba(COATD, .9); ctx.lineWidth = .45;
              for (const x of [1, 6.8]) { ctx.beginPath(); ctx.moveTo(x, 5.4); ctx.lineTo(x - .4, 14.6); ctx.stroke(); }
            });
          },
          front(ctx, spec) {
            // hood rim over the forehead and ear
            paint(ctx, () => {
              ctx.beginPath(); ctx.moveTo(-11, 6.6); ctx.quadraticCurveTo(-13.6, -6, -6, -14.4); ctx.quadraticCurveTo(3, -17.4, 9.4, -12.4);
              ctx.quadraticCurveTo(12.8, -8.6, 12.2, -3.8); ctx.quadraticCurveTo(7, -6, 1.2, -5.6); ctx.quadraticCurveTo(-1.8, -3.6, -1.6, 1.4); ctx.quadraticCurveTo(-2.2, 4.4, -4, 6.8); ctx.closePath();
            }, COAT, spec.outline, 1.05, () => {
              ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-6, -2, -4, 8); ctx.lineTo(-14, 8); ctx.fill();
              ctx.fillStyle = DEEP2; ctx.fillRect(-14, 2, 6, 6);
              ctx.fillStyle = 'rgba(235,245,225,.28)'; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.quadraticCurveTo(3, -16.6, 9, -12); ctx.lineTo(8, -11); ctx.quadraticCurveTo(3, -15, -5, -12.8); ctx.fill();
              ctx.strokeStyle = rgba(COATD, .9); ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-1, -15.4); ctx.quadraticCurveTo(-6, -8, -6.6, 4); ctx.stroke();
            });
            // a few dark spikes escaping under the hood
            locks(ctx, spec, '#26262c', [[2.4, -6.4, 3.2, -3, 1.2, .2], [5.4, -6.2, 6.2, -2.8, 1.1, .3], [8.4, -5.6, 9.4, -2.6, 1, .3]], .7);
            // round black glasses with a cold glint
            const lens = (x, y, rx, ry) => {
              paint(ctx, () => ell(ctx, x, y, rx, ry), '#101214', spec.outline, .7, () => {
                ctx.fillStyle = 'rgba(110,130,160,.55)'; ctx.beginPath(); ctx.moveTo(x - rx, y - ry * .2); ctx.lineTo(x - rx * .1, y - ry); ctx.lineTo(x + rx * .4, y - ry); ctx.lineTo(x - rx * .6, y + ry * .2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,.75)'; ell(ctx, x - rx * .35, y - ry * .45, rx * .22, ry * .14, -.5); ctx.fill();
              });
            };
            lens(2.6, 2.4, 2.9, 2.5); lens(8.4, 2.2, 1.9, 2.3);
            line(ctx, [[5.4, 1.8], [6.6, 1.7]], '#101214', .7);
            line(ctx, [[-.2, 1.8], [-2.4, 1.4]], '#101214', .6);
          }
        }
      };
    }

    // ---- Tenten: twin buns, the forehead protector, a pink mandarin-collar top with red trim and frog buttons,
    // dark green trousers, red wristbands and the big weapon scroll strapped across her back.
    function tentenSpec() {
      const O = '#26141a', SKIN = '#f8dcc4', SKD = '#e2ac94', HC = '#5a3422', TOP = '#e8687e', TRIM = '#a8263a', PANTS = '#2f4a3c';
      const bun = (ctx, spec, x, y, r, far) => {
        const c = far ? dark(HC, .2) : HC;
        paint(ctx, () => ell(ctx, x, y, r, r * .92), c, spec.outline, 1, () => {
          ctx.fillStyle = dark(c, .3); ell(ctx, x - r * .3, y + r * .35, r * .9, r * .7); ctx.fill();
          ctx.strokeStyle = dark(c, .45); ctx.lineWidth = .4;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y, r * (.35 + i * .2), -2.6 + i * .3, .2 + i * .4); ctx.stroke(); }
          ctx.fillStyle = SK.hairGloss(c); ell(ctx, x + r * .25, y - r * .45, r * .4, r * .18, -.3); ctx.fill();
        });
      };
      return {
        outline: O, skin: SKIN, skinShade: SKD, bulk: -.4, legK: 1.14,
        legs: { thigh: PANTS, shin: PANTS, foot: '#2a2a34', holster: '#3a2a2a', w1: 4.9, w2: 4.1 },
        arms: { upper: SKIN, lower: SKIN, w1: 3.9, w2: 3.5, cuff: TRIM, hand: SKIN },
        torso: {
          base: TOP,
          paint(ctx) {
            // diagonal frog-button closure, trim at the hem, a red sash
            ctx.strokeStyle = TRIM; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(2.4, -13.2); ctx.quadraticCurveTo(6, -11.6, 7.6, -8.4); ctx.stroke();
            for (const [x, y] of [[4.6, -12.2], [6.6, -10.2]]) { ctx.fillStyle = '#f4e2b8'; ctx.fillRect(x - 1.2, y - .35, 2.4, .7); dot(ctx, x + 1.3, y, .38, '#f4e2b8'); }
            ctx.fillStyle = TRIM; ctx.fillRect(-12, -2.6, 26, 2.2);
            ctx.fillStyle = 'rgba(255,200,200,.3)'; ctx.fillRect(-12, -2.6, 26, .4);
            ctx.strokeStyle = rgba(dark(TOP, .4), .7); ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(-3.6, -12); ctx.quadraticCurveTo(-2.8, -8, -3.8, -3); ctx.stroke();
          }
        },
        back(ctx) {
          // the big scroll slung diagonally across her back
          ctx.save(); ctx.translate(-5.4, -8.6); ctx.rotate(-1.05);
          paint(ctx, () => { ctx.beginPath(); ctx.rect(-10.6, -3, 21.2, 6); }, '#efe4c8', O, .9, () => {
            ctx.fillStyle = 'rgba(120,90,60,.3)'; ctx.fillRect(-12, .8, 24, 3);
            ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-12, -2.6, 24, .8);
            ctx.fillStyle = TRIM; ctx.fillRect(-2, -3, 1.4, 6);
          });
          for (const x of [-11.4, 11.4]) paint(ctx, () => ell(ctx, x, 0, 1.4, 3.6), '#6a3a24', O, .8, () => { ctx.fillStyle = 'rgba(255,220,180,.3)'; ctx.fillRect(x - 1.4, -3.4, 2.8, 1); });
          ctx.restore();
        },
        collar(ctx) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-1.6, -12.4); ctx.lineTo(-1.4, -15.6); ctx.quadraticCurveTo(1.6, -16.4, 4.8, -15.4); ctx.lineTo(4.8, -12.6); ctx.closePath(); }, TRIM, O, .8, () => {
            ctx.fillStyle = SHADE; ctx.fillRect(-3, -16, 3, 4); ctx.fillStyle = 'rgba(255,210,210,.35)'; ctx.fillRect(-1, -15.6, 5.4, .45);
          });
        },
        head: {
          back(ctx, spec) { bun(ctx, spec, 6.8, -12.6, 3.6, true); },
          hair(ctx, spec) {
            HAIR.smooth(HC, { nape: 4.4, bangs: [[9.4, 1.4, 1.2], [5.4, 1.4, -.6], [1.2, 1.5, .4], [-1.2, 1.5, 5.6]] })(ctx, spec);
            bun(ctx, spec, -5.8, -11.6, 4.2, false);
          },
          band: { cloth: '#26324a', plate: '#c9d1da', symbol: 'leaf' },
          eyes: { type: 'normal', iris: '#7a4a2a', fem: true }, mouth: 'smile', attackMouth: 'shout', browColor: HC, browW: .65
        }
      };
    }

    SPEC.choji = chojiSpec(); SPEC.ino = inoSpec(); SPEC.kiba = kibaSpec(); SPEC.shino = shinoSpec(); SPEC.tenten = tentenSpec();
    const A = window.AnimeSprites;
    A.addSprite('choji', SPEC.choji, { scale: 1.42, box: [-48, -92, 48, 8] }, { hair: '#a2422a', fringe: 'spiky', accent: '#e05a3a' });
    A.addSprite('ino', SPEC.ino, { scale: 1.22, box: [-44, -90, 40, 8] }, { hair: '#f8dc7a', fringe: 'part', accent: '#c58cf0', long: true });
    A.addSprite('kiba', SPEC.kiba, { scale: 1.24, box: [-42, -88, 40, 8] }, { hair: '#4a2e1e', fringe: 'spiky', accent: '#d03a2a' });
    A.addSprite('shino', SPEC.shino, { scale: 1.26, box: [-42, -90, 42, 8] }, { hair: '#26262c', fringe: 'hood', accent: '#7a9a6a' });
    A.addSprite('tenten', SPEC.tenten, { scale: 1.2, box: [-42, -88, 40, 8] }, { hair: '#5a3422', fringe: 'part', accent: '#e8687e' });
  })();

  const members = {
    choji: { name: 'AKIMICHI CHŌJI — BỘI HÓA', accent: '#ff7a4a', hpScale: 3.0, damageScale: 1.72, armor: .85,
      moves: ['tank', 'harite', 'pill', 'baika', 'butterfly', 'tank', 'baika', 'harite', 'pill', 'butterfly'] },
    ino: { name: 'YAMANAKA INO — TÂM CHUYỂN', accent: '#ffd86a', hpScale: 2.7, damageScale: 1.66,
      moves: ['petals', 'mind', 'shinkai', 'sense', 'disturb', 'mind', 'petals', 'sense', 'shinkai', 'disturb'] },
    kiba: { name: 'INUZUKA KIBA & AKAMARU', accent: '#e8b07a', hpScale: 2.85, damageScale: 1.7,
      moves: ['tsuga', 'mark', 'gatsuga', 'smoke', 'wolf', 'tsuga', 'gatsuga', 'mark', 'smoke', 'wolf'] },
    shino: { name: 'ABURAME SHINO — KÝ GIẢI TRÙNG', accent: '#a8c890', hpScale: 2.9, damageScale: 1.64,
      moves: ['swarm', 'pillar', 'clones', 'drain', 'sphere', 'swarm', 'clones', 'pillar', 'drain', 'sphere'] },
    tenten: { name: 'TENTEN — THAO CỤ', accent: '#ff9ab0', hpScale: 2.7, damageScale: 1.7,
      moves: ['dragons', 'kunai', 'chain', 'fan', 'rain', 'kunai', 'dragons', 'fan', 'chain', 'rain'] }
  };
  const order = Object.keys(members);
  const pick = level => order[((level | 0) % order.length + order.length) % order.length];

  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    choji: {
      tank: { label: 'NHỤC ĐẠN CHÂM CHIẾN XA', rgb: '255,140,90', windup: .85, after: 1.0 },
      harite: { label: 'SIÊU BỘI HÓA · CHƯỞNG KÍCH', rgb: '255,180,120', windup: .95, after: 1.0 },
      pill: { label: 'TAM SẮC DƯỢC HOÀN', rgb: '255,90,70', windup: .75, after: .9 },
      baika: { label: 'BỘI HÓA CHI THUẬT', rgb: '255,130,90', windup: 1.0, after: 1.1 },
      butterfly: { label: 'ĐIỆP ĐẠN BẠO KÍCH', shout: 'TA KHÔNG BÉO, TA CHỈ XƯƠNG TO!', rgb: '255,170,90', windup: 1.5, after: 1.6 }
    },
    ino: {
      mind: { label: 'TÂM CHUYỂN THÂN CHI THUẬT', rgb: '200,160,255', windup: .9, after: 1.0 },
      petals: { label: 'HOA NHẪN PHÁP · HOA BỘC LIÊN', rgb: '255,150,205', windup: .8, after: 1.0 },
      shinkai: { label: 'TÂM HOẠI · TINH THẦN PHÁ', rgb: '175,130,255', windup: .85, after: 1.0 },
      sense: { label: 'CẢM TRI · TRUYỀN TÂM THUẬT', rgb: '140,205,255', windup: .8, after: 1.0 },
      disturb: { label: 'TÂM LOẠN THÂN CHI THUẬT', shout: 'TÂM TRÍ NGƯƠI LÀ CỦA TA!', rgb: '225,130,255', windup: 1.4, after: 1.6 }
    },
    kiba: {
      tsuga: { label: 'THÔNG NHA', rgb: '225,225,235', windup: .7, after: 1.0 },
      mark: { label: 'ĐỘNG THÁI KÝ HIỆU', rgb: '255,205,90', windup: .7, after: .9 },
      gatsuga: { label: 'NHA THÔNG NHA', rgb: '235,235,245', windup: .85, after: 1.0 },
      smoke: { label: 'THÚ NHÂN PHÂN THÂN · YÊN ĐẠN', rgb: '205,205,215', windup: .75, after: 1.0 },
      wolf: { label: 'SONG ĐẦU LANG · NHA LANG NHA', shout: 'ĐI NÀO, AKAMARU!', rgb: '240,240,255', windup: 1.5, after: 1.7 }
    },
    shino: {
      swarm: { label: 'KÝ GIẢI TRÙNG · TRÙNG VÂN', rgb: '150,190,120', windup: .8, after: 1.0 },
      clones: { label: 'TRÙNG PHÂN THÂN', rgb: '160,195,130', windup: .85, after: 1.0 },
      pillar: { label: 'KÝ SINH TRÙNG · TRÙNG TRỤ', rgb: '140,180,105', windup: .8, after: 1.0 },
      drain: { label: 'TRÙNG HẤP · THỰC CHAKRA', rgb: '170,220,125', windup: .7, after: .9 },
      sphere: { label: 'BÍ THUẬT · TRÙNG CẦU ĐẠI QUYỂN', shout: 'NGƯƠI ĐÃ Ở TRONG TỔ TRÙNG.', rgb: '150,195,115', windup: 1.4, after: 1.6 }
    },
    tenten: {
      dragons: { label: 'SONG THĂNG LONG', rgb: '255,205,130', windup: .9, after: 1.0 },
      chain: { label: 'THAO CỤ · LIÊN TỎA CHÙY', rgb: '215,220,235', windup: .8, after: 1.0 },
      kunai: { label: 'BỘC PHÙ KHỔ VÔ · PHIÊN HOA', rgb: '255,170,90', windup: .75, after: .9 },
      fan: { label: 'BA TIÊU PHIẾN · HỎA PHONG', rgb: '255,125,55', windup: 1.0, after: 1.1 },
      rain: { label: 'THAO CỤ · THIÊN BINH VẠN NHẬN', shout: 'VŨ KHÍ NÀO CŨNG NGHE LỜI TA!', rgb: '255,215,145', windup: 1.5, after: 1.7 }
    }
  };
  // Manual control (team mode): moves in key order 1..n, ultimate last.
  const MANUAL = {
    choji: ['tank', 'harite', 'pill', 'baika', 'butterfly'], ino: ['mind', 'petals', 'shinkai', 'sense', 'disturb'],
    kiba: ['tsuga', 'mark', 'gatsuga', 'smoke', 'wolf'], shino: ['swarm', 'clones', 'pillar', 'drain', 'sphere'],
    tenten: ['dragons', 'chain', 'kunai', 'fan', 'rain']
  };
  const moveLabels = {}, MOVE_LISTS = {};
  for (const id in MOVES) {
    for (const k in MOVES[id]) moveLabels[id + ':' + k] = MOVES[id][k].label;
    MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[id][k].label }));
  }
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }

  // ================================================================== state & helpers
  function state(z) {
    if (z.k11) return z.k11;
    const st = z.k11 = { t: 0, casts: 0, timer: 1.0, move: '', windup: 0, windMax: 1, aim: 0, tx: Math.round(z.x), ty: Math.round(z.y), tele: [], ev: [], fx: [],
      dash: null, arc: null, lift: 0, hold: 0, seed: 0, spots: null, form: '', formT: 0, vanish: 0, buff: 0, mark: 0, wings: 0, limp: 0, ctl: null, spin: 0, stomp: 0, lastDraw: 0 };
    if (z.bossId === 'kiba') st.dog = { x: Math.round(z.x - 40), y: Math.round(z.y - 10), f: 1, ph: 0, mv: 0, dash: null, arc: null, form: '', lift: 0, nip: 2.5, a: 0 };
    return st;
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = r1(Math.random() * 99);
    if (st.fx.length >= 22) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => { if (st.ev.length < 160) st.ev.push({ t, fn }); };
  const facingOf = z => Math.cos(z.angle || 0) >= 0 ? 1 : -1;
  const bodyH = id => (Spr() && Spr().has && Spr().has(id) ? Spr().height(id) : 80);
  const RX = v => Math.round(v);
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - x1) * dx + (py - y1) * dy) / l2);
    return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
  }
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
  function freeSpot(api, x, y, r) {
    if (!api.blocked(x, y, r)) return { x, y };
    for (let i = 1; i <= 8; i++) {
      const a = i * TAU / 8, d = 50 + i * 16;
      if (!api.blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, r)) return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    }
    return null;
  }
  // A real body near (x, y) to hold / drain: the target itself, or (manual mode: the cursor pseudo-target) the nearest foe.
  function victim(api, x, y, r) {
    const p = api.player;
    if (p && !p.pseudo && p.health > 0 && Math.hypot(p.x - x, p.y - y) < r + (p.r || 16)) return p;
    return api.nearestFoe ? api.nearestFoe(x, y, r) : null;
  }
  // Point toward (tx, ty) at most `max` px from (x, y).
  function within(x, y, tx, ty, max) {
    const d = Math.hypot(tx - x, ty - y);
    if (d <= max) return { x: RX(tx), y: RX(ty) };
    return { x: RX(x + (tx - x) / d * max), y: RX(y + (ty - y) / d * max) };
  }

  // ================================================================== telegraphs
  function teleFor(z, st, id, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty, ca = Math.cos(a), sa = Math.sin(a);
    const d = Math.hypot(tx - x, ty - y);
    const line = (len, w, aa = a, ox = x, oy = y) => ({ k: 'line', x: RX(ox), y: RX(oy), a: r1(aa), len: RX(len), w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: RX(cx), y: RX(cy), r, faint });
    const cone = (r, h, faint) => ({ k: 'cone', x: RX(x), y: RX(y), a: r1(a), r, h, faint });
    const sd = st.seed;
    if (id === 'choji') switch (move) {
      case 'tank': { const len = Math.max(420, Math.min(950, d + 220)); st.spots = [{ len }]; return [line(len, 74)]; }
      case 'harite': { const s = within(x, y, tx, ty, 560); st.spots = [s]; return [circ(s.x, s.y, 250), line(Math.hypot(s.x - x, s.y - y), 30)]; }
      case 'pill': return [circ(x, y, 300)];
      case 'baika': { const s = within(x, y, tx, ty, 620); st.spots = [s]; return [circ(s.x, s.y, 330), line(Math.hypot(s.x - x, s.y - y), 40)]; }
      case 'butterfly': { const s = within(x, y, tx, ty, 720); st.spots = [s]; return [circ(s.x, s.y, 480), circ(s.x, s.y, 650, true), line(Math.hypot(s.x - x, s.y - y), 60)]; }
    }
    if (id === 'ino') switch (move) {
      case 'mind': return [line(860, 38)];
      case 'petals': {
        const spots = [{ x: RX(tx), y: RX(ty), r: 130 }];
        for (let i = 0; i < 6; i++) { const b = sd + i * TAU / 6; spots.push({ x: RX(tx + Math.cos(b) * 200), y: RX(ty + Math.sin(b) * 200), r: 115 }); }
        st.spots = spots; return spots.map(s => circ(s.x, s.y, s.r));
      }
      case 'shinkai': return [cone(720, .42)];
      case 'sense': {
        const spots = [{ x: RX(tx), y: RX(ty) }];
        for (let i = 0; i < 4; i++) { const b = sd + i * TAU / 4 + .4; spots.push({ x: RX(tx + Math.cos(b) * 175), y: RX(ty + Math.sin(b) * 175) }); }
        st.spots = spots; return [circ(x, y, 720, true)].concat(spots.map(s => circ(s.x, s.y, 125)));
      }
      case 'disturb': return [circ(tx, ty, 500), circ(tx, ty, 330, true)];
    }
    if (id === 'kiba') switch (move) {
      case 'tsuga': {
        const nx = -sa, ny = ca, P = [[tx + nx * 160 - ca * 80, ty + ny * 160 - sa * 80], [tx - nx * 160 + ca * 40, ty - ny * 160 + sa * 40], [tx + ca * 230, ty + sa * 230]];
        st.spots = P.map(p => ({ x: RX(p[0]), y: RX(p[1]) }));
        return [{ k: 'poly', pts: [RX(x), RX(y)].concat(...st.spots.map(s => [s.x, s.y])), w: 50 }].concat(st.spots.map(s => circ(s.x, s.y, 120, true)));
      }
      case 'mark': { const dg = st.dog; return [circ(tx, ty, 200), line(Math.hypot(tx - dg.x, ty - dg.y), 26, Math.atan2(ty - dg.y, tx - dg.x), dg.x, dg.y)]; }
      case 'gatsuga': {
        const dg = st.dog, da = Math.atan2(ty - dg.y, tx - dg.x);
        return [line(d + 260, 62), line(Math.hypot(tx - dg.x, ty - dg.y) + 260, 58, da, dg.x, dg.y), circ(tx, ty, 140, true)];
      }
      case 'smoke': return [circ(tx, ty, 250), circ(tx, ty, 150, true)];
      case 'wolf': { const len = Math.max(600, Math.min(1150, d + 300)); st.spots = [{ len, a: r1(a) }]; return [line(len, 130), circ(x + ca * len, y + sa * len, 300, true)]; }
    }
    if (id === 'shino') switch (move) {
      case 'swarm': return [circ(tx, ty, 210), line(d, 24)];
      case 'clones': {
        const spots = [];
        for (let i = 0; i < 3; i++) { const b = sd + i * TAU / 3; spots.push({ x: RX(tx + Math.cos(b) * 185), y: RX(ty + Math.sin(b) * 185) }); }
        st.spots = spots; return spots.map(s => circ(s.x, s.y, 150)).concat([circ(tx, ty, 180, true)]);
      }
      case 'pillar': {
        const out = [];
        for (let i = 0; i < 5; i++) { const dd = 160 + i * 150, r = 105 + i * 6; out.push(circ(x + ca * dd, y + sa * dd, r)); }
        return out;
      }
      case 'drain': return [circ(x, y, 560, true), line(Math.min(d, 560), 22)];
      case 'sphere': return [circ(tx, ty, 460), circ(tx, ty, 150, true)];
    }
    if (id === 'tenten') switch (move) {
      case 'dragons': return [circ(tx, ty, 360), circ(tx, ty, 120, true)];
      case 'chain': return [line(640, 40), circ(x + ca * 640, y + sa * 640, 150), cone(560, 1.1, true)];
      case 'kunai': {
        const spots = [];
        for (let i = 0; i < 9; i++) { const aa = a + (i / 8 - .5) * .9, dd = 250 + hash(sd + i * 3.3) * 300; spots.push({ x: RX(x + Math.cos(aa) * dd), y: RX(y + Math.sin(aa) * dd) }); }
        st.spots = spots; return [cone(580, .5, true)].concat(spots.map(s => circ(s.x, s.y, 115)));
      }
      case 'fan': return [cone(760, .55)];
      case 'rain': return [circ(tx, ty, 580), circ(tx, ty, 280, true)];
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const id = z.bossId, move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[id][move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = r1(p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0);
    st.tx = Math.round(p ? p.x : z.x + Math.cos(st.aim) * 200); st.ty = Math.round(p ? p.y : z.y + Math.sin(st.aim) * 200);
    st.seed = r1(Math.random() * 99);
    st.tele = teleFor(z, st, id, move);
  }

  // ================================================================== movement helpers
  // Straight dash: houses on the way are smashed (heavy), walls stop it.
  function startDash(z, st, a, len, dur, dmg, w, end, o) {
    o = o || {};
    st.dash = { a: r1(a), speed: len / Math.max(.05, dur), left: dur, hit: 0, wt: 0, w, dmg, end, heavy: o.heavy ? 1 : 0 };
    for (const f of st.fx) if (f.kind === 'trail') f.live = 0;
    if (o.trail) addFx(st, { kind: 'trail', pts: [RX(z.x), RX(z.y)], dur: dur + .7, rgb: o.trail, w: o.tw || 30, live: 1 });
  }
  function startArc(z, st, x1, y1, dur, h, end) { st.arc = { t: 0, dur, h, x0: RX(z.x), y0: RX(z.y), x1: RX(x1), y1: RX(y1), end }; }
  function dogDash(st, a, len, dur, dmg, w, end, trail) {
    const dg = st.dog;
    dg.dash = { a: r1(a), speed: len / Math.max(.05, dur), left: dur, hit: 0, w, dmg, end };
    dg.a = r1(a);
    if (trail) addFx(st, { kind: 'trail', pts: [RX(dg.x), RX(dg.y)], dur: dur + .7, rgb: trail, w: 34, live: 2 });
  }
  function dogArc(st, x1, y1, dur, h, end) { const dg = st.dog; dg.arc = { t: 0, dur, h, x0: RX(dg.x), y0: RX(dg.y), x1: RX(x1), y1: RX(y1), end }; }

  // ================================================================== casting
  function cast(z, st, api) {
    const id = z.bossId, move = st.move, D = (api.damage || 60) * (st.buff > 0 ? 1.2 : 1), a = st.aim, ca = Math.cos(a), sa = Math.sin(a);
    if (id === 'choji') castChoji(z, st, api, move, D, a, ca, sa);
    else if (id === 'ino') castIno(z, st, api, move, D, a, ca, sa);
    else if (id === 'kiba') castKiba(z, st, api, move, D, a, ca, sa);
    else if (id === 'shino') castShino(z, st, api, move, D, a, ca, sa);
    else castTenten(z, st, api, move, D, a, ca, sa);
  }
  const impactFx = (st, x, y, r, rgb, dur = 1.4, o) => addFx(st, Object.assign({ kind: 'impact', x: RX(x), y: RX(y), r, dur, rgb }, o || {}));

  // ------------------------------------------------------------------ Chōji
  function castChoji(z, st, api, move, D, a) {
    switch (move) {
      case 'tank': {
        st.form = 'ball'; st.formT = 0;
        addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 130, dur: .8 });
        const roll = (aa, ll, last) => startDash(z, st, aa, ll, ll / 1500, D * 1.5, 84, api => {
          api.strike(z.x, z.y, 200, D * 2.0, null, 'crater', true);
          api.knockback(z, 210, 170, 0); api.shake(15);
          impactFx(st, z.x, z.y, 210, '255,150,100', 1.2);
          if (!last) later(st, .3, api => {
            const q = api.player, a2 = q ? Math.atan2(q.y - z.y, q.x - z.x) : aa + Math.PI, l2 = q ? Math.max(380, Math.min(820, Math.hypot(q.x - z.x, q.y - z.y) + 200)) : 500;
            addFx(st, { kind: 'lineMark', x: RX(z.x), y: RX(z.y), a: r1(a2), len: RX(l2), w: 70, dur: .45, rgb: '255,140,90' });
            later(st, .45, () => roll(a2, l2, true));
          });
          else later(st, .3, () => { st.form = ''; addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 120, dur: .8 }); st.hold = .4; });
        }, { heavy: 1, trail: '255,170,120', tw: 62 });
        roll(a, st.spots[0].len, false);
        st.hold = 3.4;
        break;
      }
      case 'harite': {
        const s = st.spots[0], f = facingOf(z);
        addFx(st, { kind: 'palm', x: s.x, y: s.y, a: r1(Math.atan2(s.y - z.y, s.x - z.x)), f, dur: 1.45 });
        later(st, .24, api => {
          api.strike(s.x, s.y, 250, D * 2.8, null, 'crater', true);
          api.knockback({ x: s.x, y: s.y }, 270, 210, 0); api.shake(22);
          impactFx(st, s.x, s.y, 270, '255,170,110', 1.5);
        });
        later(st, .55, api => { api.strike(s.x, s.y, 380, D * .8, null, 'shockwave', true); addFx(st, { kind: 'ring', x: s.x, y: s.y, r: 400, dur: .8, rgb: '255,200,150' }); });
        st.hold = 1.2;
        break;
      }
      case 'pill': {
        st.buff = 9; z.speedScale = 1.25;
        addFx(st, { kind: 'pill', dur: 1.7 });
        api.strike(z.x, z.y, 300, D * 1.6, null, 'shockwave', true);
        api.knockback(z, 310, 230, 0); api.shake(16);
        impactFx(st, z.x, z.y, 300, '255,90,60', 1.3, { hot: 1 });
        st.hold = .6;
        break;
      }
      case 'baika': {
        const s = st.spots[0];
        st.form = 'giant'; st.formT = 0;
        addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 220, dur: 1.0 });
        api.shake(10);
        later(st, .35, () => startArc(z, st, s.x, s.y, .75, 170, api => {
          api.strike(z.x, z.y, 330, D * 3.0, null, 'crater', true);
          api.knockback(z, 345, 250, 0); api.shake(26);
          impactFx(st, z.x, z.y, 340, '255,140,90', 1.6);
          st.stomp = .45;
          const q = api.player, aa = q ? Math.atan2(q.y - z.y, q.x - z.x) : a;
          const sx = RX(z.x + Math.cos(aa) * 200), sy = RX(z.y + Math.sin(aa) * 200);
          addFx(st, { kind: 'mark', x: sx, y: sy, r: 230, dur: .6, rgb: '255,130,90' });
          later(st, .6, api => {
            st.stomp = .45; z.angle = aa;
            api.strike(sx, sy, 230, D * 2.0, null, 'crater', true); api.shake(18);
            impactFx(st, sx, sy, 240, '255,150,100', 1.3);
          });
          later(st, 1.15, () => { addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 230, dur: 1.0 }); st.form = ''; st.hold = .35; });
        }));
        st.hold = 3.4;
        break;
      }
      case 'butterfly': {
        const s = st.spots[0];
        st.wings = 4.4;
        api.shake(8);
        addFx(st, { kind: 'fist', x: s.x, y: s.y, land: 1.1, dur: 2.6 });
        startArc(z, st, s.x, s.y, 1.1, 240, api => {
          api.strike(s.x, s.y, 480, D * 5.2, null, 'crater', true);
          api.knockback({ x: s.x, y: s.y }, 500, 330, 0); api.shake(34);
          impactFx(st, s.x, s.y, 500, '255,170,90', 2.0, { hot: 1 });
          addFx(st, { kind: 'flutter', x: s.x, y: s.y, r: 520, dur: 2.2 });
          for (let i = 0; i < 3; i++) { const b = i * TAU / 3 + .4; api.world(s.x + Math.cos(b) * 260, s.y + Math.sin(b) * 260, 200, D * 3, 'crater', b); }
          later(st, .35, api => { api.strike(s.x, s.y, 660, D * 1.0, null, 'shockwave', true); addFx(st, { kind: 'ring', x: s.x, y: s.y, r: 680, dur: 1.0, rgb: '255,190,120' }); api.shake(16); });
          st.hold = 1.1;
        });
        st.hold = 2.6;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Ino
  function castIno(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'mind': {
        const fx = addFx(st, { kind: 'spirit', x: RX(z.x), y: RX(z.y), a: r1(a), len: 860, sp: 1250, dur: 860 / 1250 + .45, hit: 0 });
        fx.upd = (f, dt, api) => {
          if (f.hit || f.age * f.sp > f.len) return;
          const dd = f.age * f.sp, px = f.x + Math.cos(f.a) * dd, py = f.y + Math.sin(f.a) * dd;
          const q = victim(api, px, py, 64);
          if (q) { f.hit = 1; f.dur = f.age + .35; f.hx = RX(q.x); f.hy = RX(q.y); possess(z, st, api, q, D); }
        };
        st.hold = .9;
        break;
      }
      case 'petals': {
        const list = st.spots.map((s, i) => ({ x: s.x, y: s.y, r: s.r, t0: r1(.08 + i * .07) }));
        addFx(st, { kind: 'petals', x: RX(z.x), y: RX(z.y), list, dur: 2.2 });
        list.forEach((s, i) => later(st, s.t0 + .5, api => { api.strike(s.x, s.y, s.r, D * 1.5, null, i === 0 ? 'shockwave' : null, true); api.shake(i ? 4 : 9); }));
        st.hold = .7;
        break;
      }
      case 'shinkai': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'mindCone', x: RX(x), y: RX(y), a: r1(a), r: 720, h: .42, dur: 1.5 });
        conePts(x, y, a, 720, .42).forEach(q => later(st, .06 + q.d / 1300, api => api.strike(q.x, q.y, q.r, D * 1.8, null, null, true)));
        later(st, .25, api => api.shake(10));
        st.hold = .8;
        break;
      }
      case 'sense': {
        const spots = st.spots.slice();
        addFx(st, { kind: 'sense', x: RX(z.x), y: RX(z.y), R: 720, list: spots, dur: 2.0 });
        spots.forEach((s, i) => later(st, .65 + i * .07, api => { api.strike(s.x, s.y, 125, D * 1.7, null, i ? null : 'shockwave', true); api.shake(i ? 4 : 9); }));
        st.hold = .9;
        break;
      }
      case 'disturb': {
        const cx = st.tx, cy = st.ty;
        const fx = addFx(st, { kind: 'field', x: cx, y: cy, r: 500, dur: 4.7, tick: .2, jt: .3, n: 0, boom: 0 });
        fx.upd = (f, dt, api) => {
          if (f.age < 3.4) {
            if ((f.tick -= dt) <= 0) { f.tick = .45; api.strike(f.x, f.y, f.r * .92, D * .7, null, null, true); f.n++; }
            if ((f.jt -= dt) <= 0) {
              f.jt = .32;
              const an = Math.random() * TAU;
              api.knockback({ x: f.x + Math.cos(an) * 150, y: f.y + Math.sin(an) * 150 }, f.r, f.n % 2 ? 70 : -70, 0);
            }
          }
          if (!f.boom && f.age >= 3.55) { f.boom = 1; api.knockback({ x: f.x, y: f.y }, f.r, -150, 0); }
          if (f.boom === 1 && f.age >= 3.85) {
            f.boom = 2;
            api.strike(f.x, f.y, 330, D * 3.6, null, 'shockwave', true); api.shake(26);
            api.world(f.x, f.y, 260, D * 3, 'vortex', 0);
            impactFx(st, f.x, f.y, 340, '225,130,255', 1.6, { hot: 1 });
          }
        };
        st.hold = 3.9;
        break;
      }
    }
  }
  // Mind Body Switch landed: the victim walks to her (dragged), her body goes limp meanwhile.
  function possess(z, st, api, q, D) {
    api.strike(q.x, q.y, 60, D * 1.3, null, null, true);
    st.ctl = { x: RX(q.x), y: RX(q.y) };
    st.hold = Math.max(st.hold, 1.8); st.limp = 1.8;
    const fx = addFx(st, { kind: 'possess', dur: 1.9, tick: .4, push: 0 });
    fx.upd = (f, dt, api) => {
      if (!st.ctl) return;
      if (f.age > 1.7 || !(q.health > 0)) { st.ctl = null; return; }
      const dx = z.x - q.x, dy = z.y - q.y, d = Math.hypot(dx, dy) || 1;
      if (d > 110 && !q.pseudo) {
        if (q.remote) { if ((f.push -= dt) <= 0) { f.push = .25; api.knockback(z, d + 40, -45, 0); } }
        else {
          const step = Math.min(d - 110, 170 * dt), nx = q.x + dx / d * step, ny = q.y + dy / d * step;
          if (!api.blocked(nx, ny, q.r || 14)) { q.x = nx; q.y = ny; }
        }
      }
      st.ctl.x = RX(q.x); st.ctl.y = RX(q.y);
      if ((f.tick -= dt) <= 0) { f.tick = .4; api.strike(q.x, q.y, 50, D * .35, null, null, true); }
    };
  }

  // ------------------------------------------------------------------ Kiba & Akamaru
  function castKiba(z, st, api, move, D, a) {
    const dg = st.dog;
    switch (move) {
      case 'tsuga': {
        st.form = 'drill'; st.formT = 0;
        const legs = st.spots.slice(); let i = 0;
        const go = () => {
          const P = legs[i++], dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy);
          startDash(z, st, Math.atan2(dy, dx), d, Math.max(.12, d / 1750), D * 1.4, 62, api => {
            api.strike(z.x, z.y, 120, D * 1.2, null, 'shockwave', true); api.shake(7);
            impactFx(st, z.x, z.y, 130, '230,230,240', .9, { small: 1 });
            if (i < legs.length) go(); else { st.form = ''; st.hold = .35; }
          }, { heavy: 1, trail: '235,235,245', tw: 42 });
        };
        go();
        st.hold = 2.2;
        break;
      }
      case 'mark': {
        const tx = st.tx, ty = st.ty, d = Math.hypot(tx - dg.x, ty - dg.y), aa = Math.atan2(ty - dg.y, tx - dg.x);
        dg.form = ''; dg.arc = null;
        dogDash(st, aa, Math.max(0, d - 70), Math.max(.15, d / 1400), D * .8, 56, () => {
          dogArc(st, tx, ty, .34, 60, api => {
            api.strike(tx, ty, 200, D * 1.4, null, null, true); api.shake(8);
            addFx(st, { kind: 'scent', x: tx, y: ty, r: 210, dur: 6.4 });
            st.mark = 6.4;
          });
        }, '255,215,120');
        st.hold = 1.0;
        break;
      }
      case 'gatsuga': {
        const marked = st.mark > 0, passes = marked ? 3 : 2;
        let n = 0;
        const pass = (tx, ty) => {
          n++;
          st.form = 'drill'; dg.form = 'drill'; dg.arc = null;
          const ka = Math.atan2(ty - z.y, tx - z.x), kd = Math.hypot(tx - z.x, ty - z.y) + 260;
          const da = Math.atan2(ty - dg.y, tx - dg.x), dd = Math.hypot(tx - dg.x, ty - dg.y) + 260;
          const trail = marked ? '255,215,120' : '235,235,245';
          dogDash(st, da, dd, dd / 1800, D * 1.3, 64, null, trail);
          startDash(z, st, ka, kd, kd / 1800, D * 1.5, 70, api => {
            api.strike(z.x, z.y, 130, D * 1.1, null, 'shockwave', true); api.shake(9);
            if (n < passes) {
              const q = api.player, nx = q ? q.x : tx, ny = q ? q.y : ty;
              addFx(st, { kind: 'lineMark', x: RX(z.x), y: RX(z.y), a: r1(Math.atan2(ny - z.y, nx - z.x)), len: RX(Math.hypot(nx - z.x, ny - z.y) + 260), w: 60, dur: .3, rgb: '235,235,245' });
              later(st, .3, () => pass(nx, ny));
            } else later(st, .15, () => { st.form = ''; dg.form = ''; st.hold = .35; });
          }, { heavy: 1, trail, tw: 46 });
        };
        pass(st.tx, st.ty);
        st.hold = 3.4;
        break;
      }
      case 'smoke': {
        const tx = st.tx, ty = st.ty, seed = st.seed;
        addFx(st, { kind: 'smoke', x0: RX(z.x), y0: RX(z.y), x: tx, y: ty, r: 250, dur: 3.5 });
        later(st, .3, () => { addFx(st, { kind: 'poof', x: RX(dg.x), y: RX(dg.y), r: 80, dur: .7 }); dg.form = 'kiba'; });
        const N = 6;
        const slash = (api, x, y) => {
          const sa = Math.atan2(ty - y, tx - x);
          api.strike(x, y, 145, D * 1.25, null, null, true); api.shake(6);
          addFx(st, { kind: 'claw', x: RX(x), y: RX(y), a: r1(sa), dur: .55 });
        };
        for (let i = 0; i < N; i++) later(st, .45 + i * .3, api => {
          const an = seed + i * 2.4, sp = freeSpot(api, tx + Math.cos(an) * 140, ty + Math.sin(an) * 110, 18) || { x: tx, y: ty };
          if (i % 2 === 0) startArc(z, st, sp.x, sp.y, .2, 60, api => slash(api, z.x, z.y));
          else dogArc(st, sp.x, sp.y, .2, 60, api => slash(api, dg.x, dg.y));
        });
        later(st, .45 + N * .3 + .2, () => { addFx(st, { kind: 'poof', x: RX(dg.x), y: RX(dg.y), r: 80, dur: .7 }); dg.form = ''; st.hold = .3; });
        st.hold = 2.8;
        break;
      }
      case 'wolf': {
        addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 300, dur: 1.2 });
        dg.form = 'gone'; dg.dash = null; dg.arc = null; st.form = 'wolf'; st.formT = 0;
        api.strike(z.x, z.y, 280, D * 1.4, null, 'shockwave', true); api.knockback(z, 300, 240, 0); api.shake(18);
        addFx(st, { kind: 'howl', dur: 1.1 });
        const s = st.spots[0];
        later(st, .85, () => {
          st.form = 'wolfdrill';
          startDash(z, st, s.a, s.len, s.len / 1650, D * 2.1, 130, api => {
            api.strike(z.x, z.y, 220, D * 1.8, null, 'crater', true); api.shake(16);
            const q = api.player, a2 = q ? Math.atan2(q.y - z.y, q.x - z.x) : s.a + Math.PI, l2 = q ? Math.max(500, Math.min(1000, Math.hypot(q.x - z.x, q.y - z.y) + 260)) : 700;
            addFx(st, { kind: 'lineMark', x: RX(z.x), y: RX(z.y), a: r1(a2), len: RX(l2), w: 120, dur: .45, rgb: '240,240,255' });
            later(st, .45, () => startDash(z, st, a2, l2, l2 / 1700, D * 2.1, 130, api => {
              api.strike(z.x, z.y, 360, D * 4.4, null, 'crater', true); api.knockback(z, 380, 300, 0); api.shake(30);
              impactFx(st, z.x, z.y, 380, '240,240,255', 1.8, { hot: 1 });
              api.world(z.x + Math.cos(a2) * 160, z.y + Math.sin(a2) * 160, 200, D * 3, 'crater', a2);
              st.form = 'wolf'; st.formT = 1;
              later(st, .55, () => {
                addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: 280, dur: 1.1 });
                st.form = ''; dg.form = ''; dg.x = RX(z.x - 40); dg.y = RX(z.y - 10); st.hold = .4;
              });
            }, { heavy: 1, trail: '240,240,255', tw: 110 }));
          }, { heavy: 1, trail: '240,240,255', tw: 110 });
        });
        st.hold = 5.2;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Shino
  function castShino(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'swarm': {
        const tx = st.tx, ty = st.ty;
        const fx = addFx(st, { kind: 'cloud', x: tx, y: ty, r: 210, x0: RX(z.x), y0: RX(z.y), t0: .5, dur: 4.4, tick: .6 });
        fx.upd = (f, dt, api) => {
          if (f.age < f.t0 || f.age > f.dur - .6) return;
          const q = api.player;
          if (q && !q.pseudo) {
            const dx = q.x - f.x, dy = q.y - f.y, d = Math.hypot(dx, dy);
            if (d > 20 && d < 520) { const s = Math.min(d, 75 * dt); f.x = r1(f.x + dx / d * s); f.y = r1(f.y + dy / d * s); }
          }
          if ((f.tick -= dt) <= 0) { f.tick = .4; api.strike(f.x, f.y, f.r * .9, D * .5, null, null, true); }
        };
        later(st, .5, api => api.strike(tx, ty, 210, D * 1.1, null, null, true));
        st.hold = .6;
        break;
      }
      case 'clones': {
        const list = st.spots.slice(), tx = st.tx, ty = st.ty;
        addFx(st, { kind: 'bugClone', list, cx: tx, cy: ty, f: facingOf(z), dur: 2.0 });
        list.forEach(s => later(st, 1.05, api => api.strike(s.x, s.y, 150, D * 1.5, null, null, true)));
        later(st, 1.35, api => { api.strike(tx, ty, 180, D * 1.6, null, 'vortex', true); api.shake(12); });
        later(st, 1.05, api => api.shake(8));
        st.hold = .7;
        break;
      }
      case 'pillar': {
        const x0 = z.x, y0 = z.y;
        for (let i = 0; i < 5; i++) {
          const dd = 160 + i * 150, r = 105 + i * 6, px = RX(x0 + ca * dd), py = RX(y0 + sa * dd);
          later(st, .1 + i * .13, api => { api.strike(px, py, r, D * 1.6, null, i === 4 ? 'vortex' : null, true); addFx(st, { kind: 'pillar', x: px, y: py, r, dur: 1.6 }); api.shake(5 + i); });
          later(st, .45 + i * .13, api => api.strike(px, py, r * .8, D * .6, null, null, true));
        }
        st.hold = .8;
        break;
      }
      case 'drain': {
        const q = victim(api, z.x, z.y, 560);
        if (q && Math.hypot(q.x - z.x, q.y - z.y) <= 580) {
          const fx = addFx(st, { kind: 'leech', qx: RX(q.x), qy: RX(q.y), dur: 2.4, tick: .1, cut: 0 });
          fx.upd = (f, dt, api) => {
            if (f.age > 2.05 || f.cut) return;
            if (!(q.health > 0) || Math.hypot(q.x - z.x, q.y - z.y) > 640) { f.cut = 1; f.dur = f.age + .4; return; }
            f.qx = RX(q.x); f.qy = RX(q.y);
            if ((f.tick -= dt) <= 0) {
              f.tick = .25;
              api.strike(q.x, q.y, 70, D * .45, null, null, true);
              z.health = Math.min(z.maxHealth, z.health + z.maxHealth * .005);
            }
          };
          st.hold = 2.0;
        } else {
          addFx(st, { kind: 'bugRing', x: RX(z.x), y: RX(z.y), r: 330, dur: 1.2 });
          later(st, .2, api => api.strike(z.x, z.y, 330, D * 1.4, null, null, true));
          st.hold = .6;
        }
        break;
      }
      case 'sphere': {
        const R = 460;
        const fx = addFx(st, { kind: 'sphere', x: st.tx, y: st.ty, R, rc: R, dur: 5.3, tick: .7, pt: .3, boom: 0 });
        fx.upd = (f, dt, api) => {
          const t = f.age;
          f.rc = RX(t < .6 ? R : t < 3.0 ? R - (R - 150) * easeInOut((t - .6) / 2.4) : 150);
          if (t > .6 && t < 4.4 && (f.tick -= dt) <= 0) { f.tick = t < 3 ? .32 : .25; api.strike(f.x, f.y, t < 3 ? f.rc : 220, D * (t < 3 ? .55 : .8), null, null, true); }
          if (t > .7 && t < 3.0 && (f.pt -= dt) <= 0) { f.pt = .3; api.knockback({ x: f.x, y: f.y }, f.rc + 40, -25, 0); }
          if (!f.boom && t >= 4.4) {
            f.boom = 1;
            api.strike(f.x, f.y, 300, D * 3.4, null, 'vortex', true); api.shake(26);
            api.world(f.x, f.y, 240, D * 3, 'vortex', 0);
            impactFx(st, f.x, f.y, 320, '150,195,115', 1.5);
          }
        };
        st.hold = 4.5;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Tenten
  // Weapon kinds: 0 kunai, 1 shuriken, 2 katana, 3 axe, 4 kama, 5 spiked mace, 6 trident.
  function weaponRain(st, list, api, D, r) {
    list.forEach((w, i) => later(st, w.t0 + .32, api => { api.strike(w.x, w.y, r, D, null, i % 7 === 0 ? 'blade' : null, true); if (i % 4 === 0) api.shake(5); }));
  }
  function castTenten(z, st, api, move, D, a, ca, sa) {
    switch (move) {
      case 'dragons': {
        const tx = st.tx, ty = st.ty, sd = st.seed, list = [];
        for (let i = 0; i < 18; i++) {
          const rr = i === 0 ? 0 : 340 * Math.sqrt(hash(sd + i * 3.1)), an = hash(sd + i * 7.7) * TAU;
          list.push({ x: RX(tx + Math.cos(an) * rr), y: RX(ty + Math.sin(an) * rr), t0: r1(.5 + i * .055), k: i % 7, a: r1((hash(i + sd) - .5) * .5) });
        }
        addFx(st, { kind: 'scrolls', dur: 1.9 });
        addFx(st, { kind: 'weapons', list, dur: 3.8 });
        weaponRain(st, list, api, D * 1.0, 74);
        startArc(z, st, z.x, z.y, 1.5, 130, null);
        st.hold = 1.2;
        break;
      }
      case 'chain': {
        const x0 = z.x, y0 = z.y, len = 640, sp = 2300, ex = x0 + ca * len, ey = y0 + sa * len;
        const fx = addFx(st, { kind: 'chain', x: RX(x0), y: RX(y0), a: r1(a), len, sp, dur: 1.75, tick: 0, ex: RX(ex), ey: RX(ey) });
        for (let d0 = 0; d0 < len; d0 += 160) later(st, d0 / sp, api => api.line(x0 + ca * d0, y0 + sa * d0, x0 + ca * Math.min(len, d0 + 160), y0 + sa * Math.min(len, d0 + 160), 40, D * 1.4));
        later(st, len / sp, api => { api.strike(ex, ey, 150, D * 2.2, null, 'crater', true); api.shake(14); impactFx(st, ex, ey, 160, '215,220,235', 1.1); });
        fx.upd = (f, dt, api) => {
          if (f.age < .55 || f.age > 1.05) return;
          const ang = f.a - 1.1 + 2.2 * easeInOut((f.age - .55) / .5);
          if ((f.tick -= dt) <= 0) { f.tick = .05; api.line(z.x, z.y, z.x + Math.cos(ang) * 560, z.y + Math.sin(ang) * 560, 36, D * 1.3); }
        };
        later(st, .8, api => api.shake(9));
        st.hold = 1.35;
        break;
      }
      case 'kunai': {
        const list = st.spots.map((s, i) => ({ x: s.x, y: s.y, t0: r1(.7 + i * .07) }));
        addFx(st, { kind: 'kunaiFan', x: RX(z.x), y: RX(z.y), list, dur: 2.1 });
        list.forEach((k, i) => later(st, k.t0, api => { api.strike(k.x, k.y, 115, D * 1.6, null, i % 3 === 0 ? 'fire' : null, true); api.shake(5); }));
        st.hold = .6;
        break;
      }
      case 'fan': {
        const x = z.x, y = z.y;
        addFx(st, { kind: 'fanSwing', a: r1(a), dur: .95 });
        const fx = addFx(st, { kind: 'fireWave', x: RX(x), y: RX(y), a: r1(a), r: 760, h: .55, dur: 2.8, tick: 1.0 });
        conePts(x, y, a, 760, .55).forEach(q => later(st, .12 + q.d / 900, api => api.strike(q.x, q.y, q.r, D * 1.9, null, null, true)));
        later(st, .5, api => {
          api.world(x + ca * 380, y + sa * 380, 170, D * 2.4, 'fire', a);
          api.world(x + ca * 620, y + sa * 620, 150, D * 2.4, 'fire', a); api.shake(12);
        });
        fx.upd = (f, dt, api) => {
          if (f.age < 1.1 || f.age > 2.4 || (f.tick -= dt) > 0) return;
          f.tick = .5;
          for (let i = 0; i < 3; i++) { const aa = f.a + (Math.random() - .5) * f.h * 1.6, dd = 200 + Math.random() * 480; api.strike(f.x + Math.cos(aa) * dd, f.y + Math.sin(aa) * dd, 95, D * .3, null, null, true); }
        };
        st.hold = 1.0;
        break;
      }
      case 'rain': {
        const tx = st.tx, ty = st.ty, sd = st.seed, list = [];
        for (let w = 0; w < 3; w++) for (let j = 0; j < 14; j++) {
          const i = w * 14 + j, rr = 560 * Math.sqrt(hash(sd + i * 2.7)), an = hash(sd + i * 5.3) * TAU;
          list.push({ x: RX(tx + Math.cos(an) * rr), y: RX(ty + Math.sin(an) * rr), t0: r1(.5 + w * .8 + j * .04), k: (i * 3) % 7, a: r1((hash(i * 1.3 + sd) - .5) * .6) });
        }
        addFx(st, { kind: 'scrollRing', dur: 3.5 });
        addFx(st, { kind: 'weapons', list, dur: 4.8 });
        weaponRain(st, list, api, D * 1.05, 82);
        startArc(z, st, z.x, z.y, 3.0, 170, null);
        later(st, 2.2, () => { addFx(st, { kind: 'mark', x: tx, y: ty, r: 280, dur: .75, rgb: '255,215,145' }); addFx(st, { kind: 'bigBlade', x: tx, y: ty, fall: .75, dur: 2.4 }); });
        later(st, 2.95, api => {
          api.strike(tx, ty, 280, D * 3.6, null, 'crater', true); api.knockback({ x: tx, y: ty }, 300, 240, 0); api.shake(30);
          impactFx(st, tx, ty, 300, '255,215,145', 1.6, { hot: 1 });
        });
        st.hold = 3.2;
        break;
      }
    }
  }

  // ================================================================== update
  function update(z, dt, api) {
    const m = members[z.bossId];
    if (!m) return;
    const st = state(z), dg = st.dog;
    st.t += dt;
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const fx = st.fx[i];
      fx.age += dt;
      if (fx.upd && z.health > 0) fx.upd(fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    if (z.health <= 0) {
      z.bossWindup = 0; z.kageDash = 0; st.dash = null; st.arc = null; st.ev.length = 0; st.windup = 0; st.move = ''; st.lift = 0;
      if (st.form) { addFx(st, { kind: 'poof', x: RX(z.x), y: RX(z.y), r: st.form === 'giant' || st.form.startsWith('wolf') ? 260 : 120, dur: 1.1 }); st.form = ''; }
      st.ctl = null; st.limp = 0; st.wings = 0;
      if (dg) { dg.dash = null; dg.arc = null; if (dg.form === 'gone') { dg.x = RX(z.x - 40); dg.y = RX(z.y - 10); } dg.form = ''; dg.lift = 0; }
      z.speedScale = 1; z.manualBusy = false;
      return;
    }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.mark = Math.max(0, st.mark - dt);
    st.wings = Math.max(0, st.wings - dt);
    st.limp = Math.max(0, st.limp - dt);
    st.stomp = Math.max(0, st.stomp - dt);
    if (st.buff > 0) { st.buff = Math.max(0, st.buff - dt); if (st.buff === 0) z.speedScale = 1; }
    if (st.form) { st.formT += dt; if (st.formT > 9 && !st.dash && !st.arc) { st.form = ''; if (dg) dg.form = ''; } }
    z.armorScale = (m.armor || 1) * (st.buff > 0 ? .7 : 1) * (st.form === 'giant' || st.form === 'wolf' || st.form === 'wolfdrill' ? .65 : 1);
    z.kageDash = 0;

    if (st.dash) {
      const ds = st.dash, D = api.damage || 60;
      const step = Math.min(ds.left, dt) * ds.speed, nx = z.x + Math.cos(ds.a) * step, ny = z.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (ds.heavy && (ds.wt -= dt) <= 0) { ds.wt = .1; api.world(nx, ny, ds.w, D * 2.2, 'shockwave', ds.a); }
      if (api.blocked(nx, ny, z.r)) ds.left = 0; else { z.x = nx; z.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      z.kageDash = Math.max(.01, ds.left);
      z.angle = ds.a;
      st.spin += step / 40;
      const tr = st.fx.find(f => f.kind === 'trail' && f.live === 1);
      if (tr) { tr.pts.push(RX(z.x), RX(z.y)); if (tr.pts.length > 24) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; st.dash = null; if (tr) tr.live = 0; if (end) end(api); }
    }
    if (st.arc) {
      const ar = st.arc;
      ar.t += dt;
      const k = clamp01(ar.t / ar.dur), e = easeInOut(k);
      const nx = ar.x0 + (ar.x1 - ar.x0) * e, ny = ar.y0 + (ar.y1 - ar.y0) * e;
      if (!api.blocked(nx, ny, z.r * .5)) { z.x = nx; z.y = ny; }
      st.lift = ar.h * Math.sin(Math.PI * k);
      z.kageDash = .05;
      if (ar.x1 !== ar.x0 || ar.y1 !== ar.y0) z.angle = Math.atan2(ar.y1 - ar.y0, ar.x1 - ar.x0);
      if (k >= 1) { const end = ar.end; st.arc = null; st.lift = 0; if (end) end(api); }
    }
    if (st.form || st.limp > 0) z.kageDash = Math.max(z.kageDash, .05);
    if (dg) updateDog(z, st, dg, dt, api);

    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, api);
        st.timer = MOVES[z.bossId][st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.arc && !st.form && st.hold <= 0) {
      if (z.manual) {
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const p = api.player;
        if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 950) announce(z, st, m, api);
      }
    }
    z.bossWindup = st.windup > 0 ? st.windup : st.hold;
    z.manualBusy = st.windup > 0 || st.hold > 0 || !!st.dash || !!st.arc || !!st.form;
  }

  // Akamaru: trots at Kiba's heels, runs his own dashes / leaps, nips at foes who come too close.
  function updateDog(z, st, dg, dt, api) {
    const D = api.damage || 60;
    if (dg.form === 'gone') { dg.x = RX(z.x); dg.y = RX(z.y); return; }
    dg.ph += dt * (dg.mv ? 9 : 2);
    if (dg.dash) {
      const ds = dg.dash, step = Math.min(ds.left, dt) * ds.speed, nx = dg.x + Math.cos(ds.a) * step, ny = dg.y + Math.sin(ds.a) * step;
      ds.left -= dt;
      if (api.blocked(nx, ny, 16)) ds.left = 0; else { dg.x = nx; dg.y = ny; }
      if ((ds.hit -= dt) <= 0) { ds.hit = .05; api.strike(dg.x, dg.y, ds.w, ds.dmg, null, null, true); }
      dg.f = Math.cos(ds.a) >= 0 ? 1 : -1; dg.mv = 1; dg.a = ds.a;
      const tr = st.fx.find(f => f.kind === 'trail' && f.live === 2);
      if (tr) { tr.pts.push(RX(dg.x), RX(dg.y)); if (tr.pts.length > 24) tr.pts.splice(0, 2); }
      if (ds.left <= 0) { const end = ds.end; dg.dash = null; if (tr) tr.live = 0; if (end) end(api); }
      return;
    }
    if (dg.arc) {
      const ar = dg.arc;
      ar.t += dt;
      const k = clamp01(ar.t / ar.dur), e = easeInOut(k);
      dg.x = ar.x0 + (ar.x1 - ar.x0) * e; dg.y = ar.y0 + (ar.y1 - ar.y0) * e;
      dg.lift = ar.h * Math.sin(Math.PI * k);
      if (ar.x1 !== ar.x0) dg.f = ar.x1 > ar.x0 ? 1 : -1;
      dg.mv = 1;
      if (k >= 1) { const end = ar.end; dg.arc = null; dg.lift = 0; if (end) end(api); }
      return;
    }
    if (dg.form === 'drill') return;
    // follow Kiba, a step behind on his back side
    const f = facingOf(z), hx = z.x - f * 42, hy = z.y - 12, dx = hx - dg.x, dy = hy - dg.y, d = Math.hypot(dx, dy);
    if (d > 6) {
      const sp = Math.min(d, Math.max(210, d * 5) * dt), nx = dg.x + dx / d * sp, ny = dg.y + dy / d * sp;
      dg.x = nx; dg.y = ny; dg.mv = d > 14 ? 1 : 0;
      if (Math.abs(dx) > 4) dg.f = dx > 0 ? 1 : -1;
      if (d > 400) { dg.x = hx; dg.y = hy; }
    } else { dg.mv = 0; dg.f = f; }
    // a quick bite when a foe comes close (not while the user drives Kiba)
    dg.nip -= dt;
    const p = api.player;
    if (!z.manual && !st.move && dg.form === '' && dg.nip <= 0 && p && !p.pseudo && p.health > 0) {
      const pd = Math.hypot(p.x - dg.x, p.y - dg.y);
      if (pd < 170) { dg.nip = 3.6; dogDash(st, Math.atan2(p.y - dg.y, p.x - dg.x), Math.min(150, pd), .18, D * .6, 40, null); }
    }
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.lift = 0; st.form = '';
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
  }

  // ================================================================== cached art
  const INK = '#221a1e';
  function blob(g, pts) {
    const n = pts.length, m = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    g.beginPath();
    let q = m(n - 1); g.moveTo(q[0], q[1]);
    for (let i = 0; i < n; i++) { q = m(i); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    g.closePath();
  }
  function cel(g, path, fill, shade, lw = 2.4, ink = INK) {
    path(); g.fillStyle = fill; g.fill();
    if (shade) { g.save(); path(); g.clip(); shade(); g.restore(); }
    path(); g.strokeStyle = ink; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  }

  // ---- Akamaru (Shippuden size): big white dog, brown floppy ears, black nose. Side view facing +x, feet at (0,0).
  const DOG = { fur: '#f6f3ee', sh: '#cbc6d8', deep: '#a9a2bc', ear: '#b87a4a', earD: '#8a542e', ink: '#2a2226' };
  function dogLegs(frame) {
    // [hipX, hipY, kneeX, kneeY, pawX, pawY] for far-back, far-front, near-back, near-front
    if (frame === 'leap') return [[-24, -28, -38, -20, -52, -16], [20, -28, 34, -30, 48, -26], [-20, -28, -34, -18, -48, -12], [24, -28, 40, -26, 54, -22]];
    if (frame === 'sit') return [[-22, -22, -14, -10, -8, 0], [18, -24, 20, -12, 20, 0], [-18, -22, -10, -8, -2, 0], [22, -24, 26, -12, 26, 0]];
    if (frame.startsWith('run')) {
      const i = +frame.slice(3), s = Math.sin(i * Math.PI / 2), c = Math.cos(i * Math.PI / 2);
      const leg = (hx, ph, sw) => { const ss = Math.sin(ph), cc = Math.cos(ph); return [hx, -28, hx + ss * sw * .5, -15 - Math.max(0, cc) * 4, hx + ss * sw, -Math.max(0, cc) * 9]; };
      void s; void c;
      const p = i * Math.PI / 2;
      return [leg(-26, p + Math.PI + .5, 18), leg(18, p + .5, 18), leg(-20, p + Math.PI, 20), leg(24, p, 20)];
    }
    return [[-28, -28, -28, -14, -30, 0], [16, -28, 16, -14, 14, 0], [-22, -28, -20, -14, -22, 0], [22, -28, 23, -14, 24, 0]];
  }
  function paintDog(g, frame) {
    const L = dogLegs(frame), lean = frame === 'leap' ? -.12 : 0;
    const leg = (l, far) => {
      const c = far ? DOG.sh : DOG.fur;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = DOG.ink; g.lineWidth = 10.4;
      g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.lineTo(l[4], l[5] - 2); g.stroke();
      g.strokeStyle = c; g.lineWidth = 8;
      g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.lineTo(l[4], l[5] - 2); g.stroke();
      g.strokeStyle = far ? DOG.deep : DOG.sh; g.lineWidth = 3;
      g.beginPath(); g.moveTo(l[0] - 2, l[1] + 2); g.lineTo(l[2] - 2.4, l[3]); g.lineTo(l[4] - 2, l[5] - 3); g.stroke();
      cel(g, () => { g.beginPath(); g.ellipse(l[4] + 2, l[5] - 2, 5.6, 3.2, 0, 0, TAU); }, c, null, 2, DOG.ink);
    };
    leg(L[0], true); leg(L[1], true);
    g.save(); g.rotate(lean);
    // tail curling up over the back
    g.lineCap = 'round';
    g.strokeStyle = DOG.ink; g.lineWidth = 11; g.beginPath(); g.moveTo(-36, -40); g.quadraticCurveTo(-56, -50, -50, -66); g.stroke();
    g.strokeStyle = DOG.fur; g.lineWidth = 8.4; g.stroke();
    g.strokeStyle = DOG.sh; g.lineWidth = 3; g.beginPath(); g.moveTo(-38, -38); g.quadraticCurveTo(-54, -46, -50, -60); g.stroke();
    // body
    const body = () => blob(g, [[-44, -46], [-16, -54], [14, -54], [32, -50], [40, -34], [32, -20], [4, -18], [-20, -19], [-40, -22], [-50, -34]]);
    cel(g, body, DOG.fur, () => {
      g.fillStyle = DOG.sh; g.beginPath(); g.moveTo(-60, -30); g.quadraticCurveTo(-10, -22, 44, -32); g.lineTo(44, 0); g.lineTo(-60, 0); g.fill();
      g.fillStyle = DOG.deep; g.fillRect(-60, -24, 110, 8);
      g.fillStyle = 'rgba(255,255,255,.7)'; blob(g, [[-30, -50], [0, -54], [24, -50], [0, -48]]); g.fill();
      g.strokeStyle = 'rgba(120,110,140,.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { const x = -34 + i * 11; g.beginPath(); g.moveTo(x, -44); g.quadraticCurveTo(x + 4, -36, x + 1, -30); g.stroke(); }
    });
    // chest ruff
    cel(g, () => { g.beginPath(); g.moveTo(26, -52); g.lineTo(40, -50); g.lineTo(36, -44); g.lineTo(44, -40); g.lineTo(38, -34); g.lineTo(42, -28); g.lineTo(32, -26); g.lineTo(28, -40); g.closePath(); }, DOG.fur, () => {
      g.fillStyle = DOG.sh; g.fillRect(24, -34, 24, 10);
    }, 2);
    // far ear behind the head
    cel(g, () => blob(g, [[34, -74], [42, -76], [40, -62], [34, -58], [30, -66]]), DOG.earD, null, 2);
    // head
    const head = () => blob(g, [[26, -64], [36, -76], [52, -76], [60, -66], [72, -58], [72, -50], [60, -46], [44, -46], [30, -50]]);
    cel(g, head, DOG.fur, () => {
      g.fillStyle = DOG.sh; g.fillRect(20, -52, 60, 10);
      g.fillStyle = 'rgba(255,255,255,.75)'; blob(g, [[40, -74], [52, -74], [56, -68], [44, -70]]); g.fill();
    });
    // nose, mouth, eye, tongue when running
    cel(g, () => { g.beginPath(); g.ellipse(71, -56, 3.6, 3, 0, 0, TAU); }, '#1a1416', null, 1.4);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(70, -57.2, 1, 0, TAU); g.fill();
    g.strokeStyle = DOG.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(70, -52); g.quadraticCurveTo(64, -47, 56, -49); g.stroke();
    if (frame.startsWith('run') || frame === 'leap') {
      cel(g, () => blob(g, [[60, -49], [66, -48], [66, -42], [62, -40], [59, -44]]), '#e86a7a', null, 1.2);
    }
    cel(g, () => { g.beginPath(); g.ellipse(54, -64, 2.6, 3.2, 0, 0, TAU); }, '#1a1416', null, 1);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(53.2, -65.2, 1, 0, TAU); g.fill();
    g.strokeStyle = DOG.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(50, -69); g.lineTo(57, -68); g.stroke();
    // near ear, flopping
    cel(g, () => blob(g, [[30, -74], [40, -78], [42, -66], [36, -56], [28, -62]]), DOG.ear, () => {
      g.fillStyle = DOG.earD; g.fillRect(20, -64, 30, 10);
      g.fillStyle = 'rgba(255,220,180,.35)'; g.fillRect(30, -78, 8, 3);
    }, 2);
    g.restore();
    leg(L[2], false); leg(L[3], false);
  }
  function dogSprite(frame) { return Kit().sprite('k11:dog:' + frame, 280, 180, g => { g.scale(2, 2); g.translate(64, 84); paintDog(g, frame); }); }

  // ---- Sōtōrō: the giant two-headed white wolf (Kiba + Akamaru). Base units, drawn ~2.6x.
  function paintWolf(g) {
    const fur = '#f2f2f6', sh = '#c4c4d8', deep = '#9c9cb8';
    const legs = [[-34, -30, -40, -14, -44, 0], [22, -32, 22, -16, 20, 0], [-26, -30, -24, -14, -28, 0], [30, -32, 32, -16, 34, 0]];
    const leg = (l, far) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = INK; g.lineWidth = 14; g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.lineTo(l[4], l[5] - 3); g.stroke();
      g.strokeStyle = far ? sh : fur; g.lineWidth = 11; g.stroke();
      cel(g, () => { g.beginPath(); g.ellipse(l[4] + 3, l[5] - 3, 8, 4.4, 0, 0, TAU); }, far ? sh : fur, null, 2);
      g.strokeStyle = INK; g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(l[4] + 5 + i * 2.6, l[5] - 1); g.lineTo(l[4] + 8 + i * 2.6, l[5] + 1.4); g.stroke(); }
    };
    leg(legs[0], true); leg(legs[1], true);
    // bushy tail
    cel(g, () => blob(g, [[-46, -46], [-70, -60], [-78, -84], [-66, -76], [-60, -62], [-44, -38]]), fur, () => { g.fillStyle = sh; g.fillRect(-90, -64, 40, 30); }, 2.4);
    // body with a spiky mane along the back
    cel(g, () => {
      g.beginPath(); g.moveTo(-52, -34);
      const top = [[-46, -54], [-38, -50], [-30, -64], [-20, -56], [-10, -70], [0, -60], [10, -74], [18, -64], [28, -76], [34, -62]];
      for (const [x, y] of top) g.lineTo(x, y);
      g.quadraticCurveTo(50, -50, 46, -28); g.quadraticCurveTo(30, -16, 0, -18); g.quadraticCurveTo(-36, -18, -52, -34); g.closePath();
    }, fur, () => {
      g.fillStyle = sh; g.beginPath(); g.moveTo(-60, -32); g.quadraticCurveTo(-6, -24, 52, -36); g.lineTo(52, 0); g.lineTo(-60, 0); g.fill();
      g.fillStyle = deep; g.fillRect(-60, -24, 120, 8);
      g.strokeStyle = 'rgba(120,120,160,.4)'; g.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const x = -38 + i * 11; g.beginPath(); g.moveTo(x, -52 - (i % 2) * 5); g.quadraticCurveTo(x + 4, -50, x + 6, -46); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.7)'; blob(g, [[-36, -52], [0, -58], [30, -60], [0, -54]]); g.fill();
    }, 2.6);
    const head = (hx, hy, s, kiba) => {
      g.save(); g.translate(hx, hy); g.scale(s, s);
      // ears
      cel(g, () => { g.beginPath(); g.moveTo(-10, -12); g.lineTo(-6, -32); g.lineTo(4, -14); g.closePath(); }, kiba ? fur : '#b87a4a', null, 2);
      // skull + long muzzle, jaws open in a snarl
      cel(g, () => blob(g, [[-16, -6], [-10, -18], [6, -20], [20, -12], [40, -10], [44, -2], [30, 2], [8, 6], [-12, 6]]), fur, () => {
        g.fillStyle = sh; g.fillRect(-20, 0, 70, 10);
        if (kiba) { g.fillStyle = '#d02a30'; g.beginPath(); g.moveTo(0, -4); g.lineTo(10, -4); g.lineTo(5, 4); g.closePath(); g.fill(); }
      }, 2.2);
      cel(g, () => blob(g, [[6, 4], [24, 4], [40, 8], [30, 14], [10, 12]]), '#3a1418', null, 1.8);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(14 + i * 6, 4); g.lineTo(16.5 + i * 6, 9); g.lineTo(19 + i * 6, 4); g.fill(); }
      g.beginPath(); g.moveTo(16, 12.6); g.lineTo(19, 8.4); g.lineTo(22, 12.6); g.fill();
      cel(g, () => { g.beginPath(); g.ellipse(43, -7, 3.4, 2.8, 0, 0, TAU); }, '#151015', null, 1.2);
      // fierce yellow slit eye
      cel(g, () => { g.beginPath(); g.moveTo(4, -11); g.quadraticCurveTo(10, -15, 16, -11); g.quadraticCurveTo(10, -8, 4, -11); g.closePath(); }, '#ffd23a', null, 1.4);
      g.fillStyle = '#151015'; g.fillRect(9.4, -13.4, 1.4, 4.4);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -15); g.lineTo(16, -14); g.stroke();
      // ruff of fur round the jaw
      cel(g, () => { g.beginPath(); g.moveTo(-14, -4); g.lineTo(-20, 4); g.lineTo(-12, 4); g.lineTo(-16, 12); g.lineTo(-6, 8); g.lineTo(-4, 14); g.lineTo(2, 6); g.closePath(); }, fur, null, 1.8);
      g.restore();
    };
    head(32, -88, 1.0, false);
    head(44, -62, 1.12, true);
    leg(legs[2], false); leg(legs[3], false);
  }
  function wolfSprite() { return Kit().sprite('k11:wolf', 540, 420, g => { g.scale(3, 3); g.translate(92, 132); paintWolf(g); }); }

  // ---- Gatsūga drill: a spinning tornado cone pointing +x. tone: 0 Kiba (grey-brown), 1 Akamaru (white), 2 wolf.
  const DRILL_TONES = [['#9a8f86', '#4c4038', '#efe6dc'], ['#f1eff4', '#a9a6c0', '#ffffff'], ['#eceef8', '#8c90b8', '#ffffff']];
  function drillSprite(tone, ph) {
    return Kit().sprite('k11:drill:' + tone + ':' + ph, 280, 160, g => {
      g.scale(2, 2); g.translate(70, 40);
      const [base, dk, hi] = DRILL_TONES[tone];
      const body = () => { g.beginPath(); g.moveTo(66, 0); g.bezierCurveTo(30, -18, -20, -34, -52, -28); g.quadraticCurveTo(-68, -14, -64, 4); g.quadraticCurveTo(-60, 26, -46, 30); g.bezierCurveTo(-14, 32, 30, 16, 66, 0); g.closePath(); };
      cel(g, body, base, () => {
        // spiral bands sweeping round the cone
        for (let k = -2; k < 9; k++) {
          const x = -64 + ((k + ph / 4) * 15);
          g.fillStyle = k % 2 ? dk : 'rgba(255,255,255,.35)';
          g.beginPath(); g.moveTo(x, -40); g.quadraticCurveTo(x + 16, 0, x + 4, 40); g.lineTo(x + 10, 40); g.quadraticCurveTo(x + 22, 0, x + 6, -40); g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(30,20,40,.3)'; g.fillRect(-70, 8, 140, 30);
        g.fillStyle = hi; g.globalAlpha = .7; blob(g, [[-50, -22], [0, -18], [50, -4], [0, -12]]); g.fill(); g.globalAlpha = 1;
      }, 2.4);
    });
  }
  // ---- Chōji's Human Bullet Tank: armoured ball wrapped in hair with kunai bristling out of it.
  function ballSprite() {
    return Kit().sprite('k11:ball', 240, 240, g => {
      g.translate(120, 120); g.scale(2, 2);
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10 + .2;
        g.save(); g.rotate(a);
        cel(g, () => { g.beginPath(); g.moveTo(40, -3.4); g.lineTo(57, 0); g.lineTo(40, 3.4); g.closePath(); }, '#cfd6e0', () => { g.fillStyle = '#7d8594'; g.fillRect(38, 0, 22, 4); }, 1.6);
        g.restore();
      }
      cel(g, () => { g.beginPath(); g.arc(0, 0, 44, 0, TAU); }, '#cc3a2c', () => {
        const gr = g.createRadialGradient(-14, -16, 4, 0, 0, 46);
        gr.addColorStop(0, 'rgba(255,200,170,.55)'); gr.addColorStop(.5, 'rgba(255,120,90,0)'); gr.addColorStop(1, 'rgba(60,10,20,.55)');
        g.fillStyle = gr; g.fillRect(-46, -46, 92, 92);
        g.strokeStyle = '#8a1e1a'; g.lineWidth = 2;
        for (const r of [16, 30]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
        // hair wrapped round in long brown swathes
        g.fillStyle = '#a2422a';
        for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * TAU / 4); blob(g, [[-10, -46], [10, -46], [26, -30], [12, -24], [-6, -30]]); g.fill(); g.restore(); }
        g.fillStyle = 'rgba(255,220,200,.3)'; g.beginPath(); g.ellipse(-16, -20, 12, 6, -.6, 0, TAU); g.fill();
      }, 3);
      // red spiral mark in the middle
      g.strokeStyle = '#f2d6b8'; g.lineWidth = 2.4; g.beginPath();
      for (let i = 0; i <= 30; i++) { const a = i * .45, r = i * .45; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    });
  }
  // ---- Chōji's expanded open palm seen from above, fingers toward -y.
  function palmSprite() {
    return Kit().sprite('k11:palm', 260, 280, g => {
      g.translate(130, 150); g.scale(2, 2);
      const skin = '#f2c8a0', sh = '#d49a78';
      const fingers = [[-34, -26, -40, -58, 9], [-14, -36, -16, -70, 9.6], [6, -36, 8, -72, 9.6], [26, -30, 32, -62, 8.6]];
      for (const [x0, y0, x1, y1, w] of fingers) {
        g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = w * 2 + 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.strokeStyle = skin; g.lineWidth = w * 2; g.stroke();
        g.strokeStyle = sh; g.lineWidth = w * .7; g.beginPath(); g.moveTo(x0 - w * .5, y0); g.lineTo(x1 - w * .5, y1 + 2); g.stroke();
        g.strokeStyle = 'rgba(120,60,40,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + (x1 - x0) * .55 - w * .6, y0 + (y1 - y0) * .55); g.lineTo(x0 + (x1 - x0) * .55 + w * .6, y0 + (y1 - y0) * .55); g.stroke();
      }
      g.strokeStyle = INK; g.lineWidth = 21; g.beginPath(); g.moveTo(38, 8); g.lineTo(58, -18); g.stroke();
      g.strokeStyle = skin; g.lineWidth = 18; g.stroke();
      cel(g, () => blob(g, [[-44, -30], [0, -44], [40, -30], [48, 10], [30, 40], [-30, 40], [-48, 10]]), skin, () => {
        g.fillStyle = sh; g.fillRect(-60, 14, 120, 40);
        g.strokeStyle = 'rgba(120,60,40,.45)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(-30, -8); g.quadraticCurveTo(0, 4, 30, -10); g.stroke();
        g.beginPath(); g.moveTo(-20, 14); g.quadraticCurveTo(4, 2, 24, 18); g.stroke();
        g.fillStyle = 'rgba(255,240,220,.4)'; g.beginPath(); g.ellipse(-10, -20, 18, 8, -.2, 0, TAU); g.fill();
      }, 3);
    });
  }
  // ---- Butterfly Mode: the giant chakra fist (side view, knuckles down).
  function fistSprite() {
    return Kit().sprite('k11:fist', 300, 300, g => {
      g.translate(150, 160); g.scale(2, 2);
      const skin = '#ffd0a0', sh = '#e8946a';
      cel(g, () => blob(g, [[-50, -60], [10, -70], [52, -46], [60, 10], [44, 52], [-36, 56], [-58, 20]]), skin, () => {
        g.fillStyle = sh; g.fillRect(-70, 20, 140, 50);
        g.strokeStyle = 'rgba(140,60,30,.6)'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const x = -34 + i * 24; g.beginPath(); g.moveTo(x, 10); g.quadraticCurveTo(x + 4, 34, x, 52); g.stroke(); }
        g.beginPath(); g.moveTo(-50, 8); g.quadraticCurveTo(0, 0, 56, 6); g.stroke();
        g.fillStyle = 'rgba(255,255,230,.5)'; g.beginPath(); g.ellipse(-12, -40, 30, 12, -.2, 0, TAU); g.fill();
      }, 3.4);
      cel(g, () => blob(g, [[30, -10], [56, -20], [66, 0], [54, 18], [34, 12]]), skin, () => { g.fillStyle = sh; g.fillRect(30, 6, 40, 14); }, 2.6);
    });
  }
  // ---- Butterfly chakra wing (right wing; mirrored for the left).
  function wingSprite() {
    return Kit().sprite('k11:wing', 300, 300, g => {
      g.translate(20, 160);
      const up = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(30, -150, 220, -170, 270, -110); g.bezierCurveTo(290, -60, 200, -20, 0, 0); g.closePath(); };
      const lo = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(120, 10, 220, 50, 200, 110); g.bezierCurveTo(170, 140, 60, 100, 0, 0); g.closePath(); };
      for (const [p, cx, cy] of [[lo, 110, 60], [up, 150, -90]]) {
        const gr = g.createRadialGradient(cx * .3, cy * .3, 4, cx, cy, 180);
        gr.addColorStop(0, 'rgba(255,250,210,.95)'); gr.addColorStop(.35, 'rgba(255,190,80,.85)'); gr.addColorStop(.7, 'rgba(255,110,90,.7)'); gr.addColorStop(1, 'rgba(255,80,160,.55)');
        p(); g.fillStyle = gr; g.fill();
        g.save(); p(); g.clip();
        g.strokeStyle = 'rgba(255,255,240,.8)'; g.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const a = (p === up ? -1.4 : .1) + i * .2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a) * 120, Math.sin(a) * 120 - 10, Math.cos(a) * 300, Math.sin(a) * 300); g.stroke(); }
        g.fillStyle = 'rgba(255,80,60,.55)';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + Math.cos(i * 1.6) * 40, cy + Math.sin(i * 1.6) * 26, 12 - i * 2, 0, TAU); g.fill(); }
        g.restore();
        p(); g.strokeStyle = 'rgba(150,30,40,.8)'; g.lineWidth = 3.5; g.stroke();
      }
    });
  }
  function butterflySprite() {
    return Kit().sprite('k11:bfly', 64, 64, g => {
      g.translate(32, 32);
      for (const s of [-1, 1]) {
        g.fillStyle = 'rgba(255,190,90,.95)'; g.beginPath(); g.ellipse(s * 12, -8, 12, 14, s * .5, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,110,150,.9)'; g.beginPath(); g.ellipse(s * 9, 10, 8, 9, -s * .5, 0, TAU); g.fill();
      }
      g.fillStyle = '#ffffff'; g.fillRect(-1.5, -14, 3, 26);
    });
  }
  // ---- Tenten's arsenal, each drawn tip-down (stuck-in-the-ground pose), 32x96 units.
  const STEEL = '#cfd6e0', STEEL_D = '#7c8494';
  function weaponSprite(k) {
    return Kit().sprite('k11:wpn:' + k, 64, 192, g => {
      g.scale(2, 2); g.translate(16, 92);
      const blade = path => cel(g, path, STEEL, () => { g.fillStyle = STEEL_D; g.fillRect(0, -100, 20, 110); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-2, -100, 1.2, 110); }, 1.6);
      const grip = (y0, y1, w, c) => { cel(g, () => { g.beginPath(); g.rect(-w / 2, y0, w, y1 - y0); }, c, () => { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let y = y0 + 2; y < y1; y += 3) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y + 2); g.stroke(); } }, 1.4); };
      if (k === 0) { blade(() => { g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -18); g.lineTo(0, -26); g.lineTo(-5, -18); g.closePath(); }); grip(-40, -26, 4, '#3a2a2a'); g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.arc(0, -44, 4, 0, TAU); g.stroke(); g.strokeStyle = STEEL; g.lineWidth = 1.4; g.stroke(); }
      else if (k === 1) { blade(() => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 4 : 13; g.lineTo(Math.cos(a) * r, -14 + Math.sin(a) * r); } g.closePath(); }); g.fillStyle = INK; g.beginPath(); g.arc(0, -14, 2.4, 0, TAU); g.fill(); }
      else if (k === 2) { blade(() => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, -30, 3, -62); g.lineTo(-3, -62); g.quadraticCurveTo(-2, -30, 0, 0); g.closePath(); }); cel(g, () => { g.beginPath(); g.ellipse(0, -63, 7, 2.4, 0, 0, TAU); }, '#c8a050', null, 1.4); grip(-82, -64, 4.6, '#26222a'); }
      else if (k === 3) { grip(-80, -4, 4, '#6a4a2a'); blade(() => { g.beginPath(); g.moveTo(2, -10); g.quadraticCurveTo(18, -8, 20, 6); g.quadraticCurveTo(10, 2, 2, 2); g.closePath(); }); }
      else if (k === 4) { grip(-60, -24, 4, '#5a3a24'); blade(() => { g.beginPath(); g.moveTo(-2, -26); g.quadraticCurveTo(-22, -20, -18, 0); g.quadraticCurveTo(-12, -14, 2, -20); g.closePath(); }); }
      else if (k === 5) { grip(-70, -12, 4, '#4a3426'); cel(g, () => { g.beginPath(); g.arc(0, -6, 9, 0, TAU); }, '#5a606c', () => { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(-3, -9, 3, 0, TAU); g.fill(); }, 1.6); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; blade(() => { g.beginPath(); g.moveTo(Math.cos(a - .3) * 8, -6 + Math.sin(a - .3) * 8); g.lineTo(Math.cos(a) * 15, -6 + Math.sin(a) * 15); g.lineTo(Math.cos(a + .3) * 8, -6 + Math.sin(a + .3) * 8); g.closePath(); }); } }
      else { grip(-84, -18, 3.6, '#6a4a2a'); for (const x of [-7, 0, 7]) blade(() => { g.beginPath(); g.moveTo(x, x ? -4 : 0); g.lineTo(x + 2, -18); g.lineTo(x - 2, -18); g.closePath(); }); cel(g, () => { g.beginPath(); g.rect(-9, -21, 18, 3.4); }, STEEL, null, 1.2); }
    });
  }
  function scrollSprite() {
    return Kit().sprite('k11:scroll', 120, 40, g => {
      g.translate(60, 20);
      cel(g, () => { g.beginPath(); g.rect(-44, -11, 88, 22); }, '#f2e7cc', () => { g.fillStyle = 'rgba(140,100,60,.3)'; g.fillRect(-46, 3, 92, 9); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-46, -10, 92, 3); g.fillStyle = '#a8263a'; g.fillRect(-6, -11, 6, 22); }, 2);
      for (const x of [-48, 48]) cel(g, () => { g.beginPath(); g.ellipse(x, 0, 6, 14, 0, 0, TAU); }, '#6a3a24', null, 2);
    });
  }
  function fanSprite() {
    return Kit().sprite('k11:fan', 200, 240, g => {
      g.translate(100, 210);
      cel(g, () => { g.beginPath(); g.rect(-6, -70, 12, 72); }, '#5a3420', null, 2.4);
      cel(g, () => blob(g, [[0, -70], [-70, -110], [-88, -170], [-50, -205], [0, -214], [50, -205], [88, -170], [70, -110]]), '#e2c46a', () => {
        g.fillStyle = 'rgba(160,90,30,.35)'; g.fillRect(-100, -120, 200, 60);
        g.strokeStyle = 'rgba(120,70,20,.7)'; g.lineWidth = 2.4;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, -72); g.quadraticCurveTo(i * 16, -140, i * 26, -206); g.stroke(); }
        g.fillStyle = 'rgba(255,250,220,.5)'; g.beginPath(); g.ellipse(-30, -170, 26, 12, -.5, 0, TAU); g.fill();
      }, 3);
      for (let i = 0; i < 5; i++) { g.fillStyle = '#c8282c'; g.beginPath(); g.arc(-40 + i * 20, -94 - Math.abs(i - 2) * 6, 5, 0, TAU); g.fill(); }
      g.strokeStyle = '#c8282c'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, 14, 4, 26); g.stroke();
    });
  }
  const PETAL_C = ['#ff9ec8', '#ffd86a', '#c79cff', '#ffffff'];
  function petalSprite(i) {
    return Kit().sprite('k11:petal:' + i, 24, 16, g => {
      g.translate(12, 8);
      g.fillStyle = 'rgba(80,30,60,.55)'; g.beginPath(); g.ellipse(0, .6, 10, 6, 0, 0, TAU); g.fill();
      g.fillStyle = PETAL_C[i]; g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -7, 10, 0); g.quadraticCurveTo(0, 7, -10, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-2, -2, 4, 1.4, 0, 0, TAU); g.fill();
    });
  }
  // Kikaichū haze: a dark cloud speckled with beetles.
  function hazeSprite() {
    return Kit().sprite('k11:haze', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(18,24,16,.8)'); gr.addColorStop(.5, 'rgba(22,30,20,.5)'); gr.addColorStop(.85, 'rgba(26,34,22,.12)'); gr.addColorStop(1, 'rgba(26,34,22,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 260; i++) {
        const a = hash(i * 1.7) * TAU, r = Math.sqrt(hash(i * 3.1)) * 58, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
        g.fillStyle = i % 5 ? '#0c100a' : '#4a6a3a'; g.fillRect(x, y, 2, 1.4);
      }
    });
  }
  function giantSprite(frame) {
    return Kit().sprite('k11:giant:' + frame, 340, 360, g => {
      g.scale(3.4, 3.4); g.translate(50, 98);
      try { SK.renderCharacter(g, SPEC.choji, SK.poseOf(SPEC.choji, frame)); } catch (e) { /* cosmetic */ }
    });
  }

  // ================================================================== shared painters
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,30,.42)'; ctx.lineWidth = faint ? 3.5 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3; ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
  }
  function sector(ctx, x, y, r0, r1, a0, a1) { ctx.beginPath(); ctx.arc(x, y, r1, a0, a1, a1 < a0); ctx.arc(x, y, r0, a1, a0, a1 >= a0); ctx.closePath(); }
  function markLine(ctx, x, y, a, len, w, rgb, k, time) {
    if (len < 4) return;
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -w, len, w * 2);
    ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -w, len * k, w * 2);
    ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -w, len, w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < len - 20; d += 120) { ctx.moveTo(d - 16, -w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function teleShape(ctx, s, rgb, k, time) {
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    if (s.k === 'line') { markLine(ctx, s.x, s.y, s.a, s.len, s.w, rgb, k, time); return; }
    if (s.k === 'poly') {
      const p = s.pts;
      for (let i = 0; i + 3 < p.length; i += 2) markLine(ctx, p[i], p[i + 1], Math.atan2(p[i + 3] - p[i + 1], p[i + 2] - p[i]), Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), s.w, rgb, k, time);
      return;
    }
    if (s.k === 'cone') {
      const pulse = .55 + Math.sin(time * 22) * .2, f = s.faint ? .5 : 1;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.fillStyle = `rgba(24,12,8,${.15 * f})`; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${(.14 + .16 * k) * f})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,30,.4)'; ctx.lineWidth = 5 * f; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3 * f; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.stroke();
      ctx.restore();
    }
  }
  function dustRing(ctx, x, y, r, t, seed, n = 12, kind = 'dust', a = .55) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.2), a0 = 1 - win(t, .6, 1.8);
    if (a0 <= 0 || t < 0) return;
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(i + seed) * .4, d = r * (.3 + e * (.62 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(an) * d, y + Math.sin(an) * d * .5 - 8 - hash(i * 4.4 + seed) * r * .1, r * (.07 + e * (.06 + hash(i * 6.1 + seed) * .05)), a0 * a, .75);
    }
  }
  function crater(ctx, x, y, r, a, seed) {
    if (a <= 0) return;
    ctx.fillStyle = `rgba(40,26,18,${.32 * a})`; ctx.beginPath(); ctx.ellipse(x, y, r * .62, r * .32, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(20,12,8,${.28 * a})`; ctx.beginPath(); ctx.ellipse(x, y + r * .04, r * .4, r * .19, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,18,12,${.5 * a})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const an = hash(i * 3.3 + seed) * TAU, l = r * (.5 + hash(i * 1.9 + seed) * .45), b = an + (hash(i + seed) - .5) * .5;
      ctx.moveTo(x + Math.cos(an) * r * .3, y + Math.sin(an) * r * .15);
      ctx.lineTo(x + Math.cos(b) * l * .7, y + Math.sin(b) * l * .35);
      ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l * .5);
    }
    ctx.stroke();
  }
  // A buzzing insect mass: one cached haze stamp per layer plus individually jittering beetles in a single path.
  function swarm(ctx, x, y, rx, ry, n, time, seed, alpha) {
    if (alpha <= .01) return;
    const K = Kit(), hz = hazeSprite();
    ctx.globalAlpha = alpha * .85;
    for (let i = 0; i < 3; i++) {
      const ox = Math.sin(time * 1.7 + i * 2 + seed) * rx * .12, oy = Math.cos(time * 1.3 + i * 3 + seed) * ry * .12;
      ctx.drawImage(hz, x + ox - rx * (1 - i * .15), y + oy - ry * (1 - i * .15), rx * 2 * (1 - i * .15), ry * 2 * (1 - i * .15));
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0a0d08'; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = (.8 + hash(i * 2.1 + seed) * 1.6) * (i % 2 ? 1 : -1), an = hash(i * 1.3 + seed) * TAU + time * sp, rr = Math.sqrt(hash(i * 3.7 + seed));
      const px = x + Math.cos(an) * rx * rr + Math.sin(time * 11 + i) * 2.5, py = y + Math.sin(an) * ry * rr + Math.cos(time * 13 + i * 1.7) * 2.5;
      ctx.rect(px, py, 2.6, 1.8);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(150,200,120,.9)'; ctx.beginPath();
    for (let i = 0; i < n; i += 6) {
      const an = hash(i * 5.1 + seed) * TAU - time * 1.4, rr = Math.sqrt(hash(i * 2.9 + seed));
      ctx.rect(x + Math.cos(an) * rx * rr, y + Math.sin(an) * ry * rr, 1.4, 1);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    void K;
  }
  // Bugs streaming along a quadratic curve from (x0,y0) to (x1,y1); head = 0..1 how far the front has got.
  function bugStream(ctx, x0, y0, x1, y1, head, tail, time, seed, n, w) {
    const mx = (x0 + x1) / 2 + (y1 - y0) * .25, my = (y0 + y1) / 2 - (x1 - x0) * .25 - 60;
    ctx.fillStyle = '#0a0d08'; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const u = tail + (head - tail) * ((i / n + time * .9 + hash(i + seed) * .3) % 1);
      if (u < 0 || u > 1) continue;
      const bx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, by = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1;
      const o = Math.sin(i * 1.7 + time * 9) * w * (hash(i * 3.3 + seed) - .5) * 2;
      ctx.rect(bx + o, by + Math.cos(i * 2.1 + time * 8) * w * .5, 2.6, 1.8);
    }
    ctx.fill();
  }
  function drawPetal(ctx, i, x, y, rot, s, a) {
    if (a <= .01) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * (.5 + .5 * Math.abs(Math.sin(rot * 1.7))));
    ctx.drawImage(petalSprite(i & 3), -12, -8); ctx.restore();
  }
  const rgbA = (rgb, a) => `rgba(${rgb},${a})`;

  // ================================================================== effect painters: [ground, overlay]
  const FX = {
    impact: [(ctx, f) => {
      const t = f.age, a = 1 - win(t, f.dur * .55, f.dur);
      crater(ctx, f.x, f.y, f.r * (f.small ? .7 : 1), a, f.seed);
      if (t < 1) Kit().fx.shockRing(ctx, f.x, f.y, f.r * 1.15, t * 1.4, Math.max(0, 1 - t * 1.2), f.rgb);
      if (t > .1 && t < 1.2) Kit().fx.shockRing(ctx, f.x, f.y, f.r * .8, (t - .1) * 1.6, Math.max(0, 1 - (t - .1) * 1.4) * .7, '255,255,255');
    }, (ctx, f) => {
      const K = Kit(), t = f.age;
      ctx.globalCompositeOperation = 'lighter';
      if (t < .35) K.glow(ctx, f.x, f.y - 14, f.r * (.55 + t * 2), f.rgb, (1 - t / .35) * (f.hot ? 1 : .75), true, .7);
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, f.x, f.y, f.r, t, f.seed, f.small ? 8 : 14);
      K.fx.debris(ctx, f.x, f.y, f.r * .9, t, f.seed, '#4c3c30', f.small ? 6 : 12);
    }],
    ring: [(ctx, f) => { Kit().fx.shockRing(ctx, f.x, f.y, f.r, f.age / f.dur, 1 - f.age / f.dur, f.rgb); }, null],
    poof: [null, (ctx, f) => { Kit().fx.smokePoof(ctx, f.x, f.y, f.r, f.age / f.dur); }],
    mark: [(ctx, f, time) => { markCircle(ctx, f.x, f.y, f.r, f.rgb, clamp01(f.age / f.dur), time, false); }, null],
    lineMark: [(ctx, f, time) => { markLine(ctx, f.x, f.y, f.a, f.len, f.w, f.rgb, clamp01(f.age / f.dur), time); }, null],
    trail: [(ctx, f) => {
      const p = f.pts, n = p.length / 2;
      if (n < 2) return;
      const a = 1 - f.age / f.dur;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(60,44,34,${.28 * a})`; ctx.lineWidth = f.w * 1.3;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] + 4); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1] + 4); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgbA(f.rgb, .35 * a); ctx.lineWidth = f.w * .8;
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - 22); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1] - 22); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // spiral wind streaks left behind
      ctx.strokeStyle = `rgba(255,255,255,${.6 * a})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 2; i < p.length; i += 4) {
        const dx = p[i] - p[i - 2], dy = p[i + 1] - p[i - 1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = f.w * .5 * (1 + f.age);
        ctx.moveTo(p[i] + nx * w, p[i + 1] - 22 + ny * w * .6); ctx.quadraticCurveTo(p[i] - dx * .5, p[i + 1] - 22 - dy * .5, p[i] - nx * w, p[i + 1] - 22 - ny * w * .6);
      }
      ctx.stroke();
    }, null],
    // ---- Chōji
    palm: [(ctx, f) => {
      const t = f.age, k = clamp01(t / .24), a = 1 - win(t, 1.0, f.dur);
      ctx.fillStyle = `rgba(20,10,8,${(.12 + .22 * k) * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 120 * (.5 + .5 * k), 60 * (.5 + .5 * k), 0, 0, TAU); ctx.fill();
    }, (ctx, f, time, z) => {
      const t = f.age, k = easeIn(t / .24), a = 1 - win(t, .95, f.dur), H = bodyH('choji');
      const sx = z.x + f.f * 16, sy = z.y - H * .62, hy = f.y - 30 - (1 - k) * 230, hx = f.x - Math.cos(f.a) * 30 * (1 - k);
      ctx.globalAlpha = a;
      // the swollen arm reaching out
      const mx = (sx + hx) / 2, my = Math.min(sy, hy) - 80;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 62; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hx, hy + 30); ctx.stroke();
      ctx.strokeStyle = '#2a2930'; ctx.lineWidth = 56; ctx.stroke();
      ctx.strokeStyle = '#3c3c46'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.quadraticCurveTo(mx, my - 14, hx, hy + 14); ctx.stroke();
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(f.a + Math.PI / 2);
      const s = 1.0 + .25 * k;
      ctx.drawImage(palmSprite(), -65 * s, -75 * s, 130 * s, 140 * s);
      ctx.restore();
      if (t > .22 && t < .5) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, f.x, f.y + 10, 220, '255,170,110', (1 - (t - .22) / .28) * .35, false, .5); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1;
    }],
    pill: [null, (ctx, f, time, z) => {
      const K = Kit(), t = f.age, H = bodyH('choji'), cx = z.x + facingOf(z) * 10, cy = z.y - H * .78;
      // the three Akimichi pills: green spinach, yellow curry, red chili, gulped one after another
      const cols = ['#4ac060', '#ffd040', '#e8282c'];
      for (let i = 0; i < 3; i++) {
        const tt = t - i * .12; if (tt < 0 || tt > .45) continue;
        const an = tt * 12 + i * 2, rr = 30 * (1 - tt / .45);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .6, 5.4, 0, TAU); ctx.fill();
        ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * .6, 4, 0, TAU); ctx.fill();
      }
      if (t > .3) {
        const k = win(t, .3, f.dur), steam = K.puff('steam');
        for (let i = 0; i < 12; i++) {
          const ph = (k * 1.4 + hash(i * 1.3)) % 1, an = hash(i * 2.7) * TAU;
          K.stamp(ctx, steam, z.x + Math.cos(an) * (20 + ph * 70), z.y - 30 - ph * 140, 18 + ph * 30, (1 - ph) * (1 - k) * .9);
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, z.x, z.y - H * .5, 120 * (1 - k * .5), '255,90,60', (1 - k) * .8, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    }],
    fist: [(ctx, f) => {
      const t = f.age, k = clamp01(t / f.land), a = 1 - win(t, f.land + .6, f.dur);
      ctx.fillStyle = `rgba(20,10,8,${(.1 + .3 * k) * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 200 * (.4 + .6 * k), 90 * (.4 + .6 * k), 0, 0, TAU); ctx.fill();
    }, (ctx, f, time) => {
      const K = Kit(), t = f.age, L = f.land, a = 1 - win(t, L + .5, f.dur);
      if (t < L * .35 || a <= 0) return;
      const k = easeIn(win(t, L * .35, L)), s = .5 + .7 * easeOut(win(t, L * .35, L * .8));
      const y = f.y - 60 - (1 - k) * 360;
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, y, 240 * s, '255,140,60', .32);
      K.glow(ctx, f.x, y, 360 * s, '255,80,140', .18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(fistSprite(), f.x - 150 * s, y - 160 * s, 300 * s, 300 * s);
      // chakra flames licking off the knuckles
      const fire = K.puff('fire');
      for (let i = 0; i < 8; i++) { const ph = (time * 2 + hash(i * 1.9)) % 1; K.stamp(ctx, fire, f.x - 100 * s + hash(i * 3.3) * 200 * s, y - 120 * s - ph * 80, (14 + ph * 20) * s, (1 - ph) * .8); }
      ctx.globalAlpha = 1;
    }],
    flutter: [null, (ctx, f) => {
      const t = f.age, k = t / f.dur, img = butterflySprite();
      for (let i = 0; i < 16; i++) {
        const an = hash(i * 2.3 + f.seed) * TAU, d = f.r * (.2 + easeOut(k * 1.4) * (.5 + hash(i * 1.7) * .5)), up = 40 + k * (120 + hash(i * 3.1) * 140);
        const x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d * .5 - up, fl = .4 + .6 * Math.abs(Math.sin(t * 18 + i));
        ctx.globalAlpha = (1 - k) * .95;
        ctx.drawImage(img, x - 16 * fl, y - 16, 32 * fl, 32);
      }
      ctx.globalAlpha = 1;
    }],
    // ---- Ino
    spirit: [(ctx, f) => {
      const d = Math.min(f.len, f.age * f.sp), x = f.x + Math.cos(f.a) * d, y = f.y + Math.sin(f.a) * d;
      ctx.fillStyle = 'rgba(40,20,70,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 26, 11, 0, 0, TAU); ctx.fill();
    }, (ctx, f, time) => {
      const K = Kit(), d = Math.min(f.len, f.age * f.sp), ca = Math.cos(f.a), sa = Math.sin(f.a);
      const x = f.x + ca * d, y = f.y + sa * d - 36, a = f.hit ? 1 - win(f.age, f.dur - .35, f.dur) : 1 - win(f.age, f.dur - .45, f.dur);
      // dark under-stroke then a ghostly wisp with three trailing ribbons
      ctx.lineCap = 'round';
      for (let r = 0; r < 3; r++) {
        ctx.strokeStyle = `rgba(40,20,70,${.35 * a})`; ctx.lineWidth = 9 - r * 2;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const u = i / 10, w = Math.sin(time * 14 + u * 6 + r * 2) * 10 * u; const px = x - ca * u * 140 - sa * w, py = y - sa * u * 140 + ca * w * .6; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.strokeStyle = `rgba(220,200,255,${.75 * a})`; ctx.lineWidth = 4 - r; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, 34, '220,190,255', .8 * a, true);
      K.glow(ctx, x, y, 90, '140,90,255', .35 * a);
      if (f.hit && f.hx != null) K.glow(ctx, f.hx, f.hy - 30, 90, '170,120,255', .5 * a);
      ctx.globalCompositeOperation = 'source-over';
    }],
    possess: [(ctx, f, time, z) => {
      const st = z.k11; if (!st || !st.ctl) return;
      const x = st.ctl.x, y = st.ctl.y, a = 1 - win(f.age, 1.6, f.dur);
      ctx.strokeStyle = `rgba(190,150,255,${.7 * a})`; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x, y, 40 + i * 14 + Math.sin(time * 8 + i) * 4, (40 + i * 14) * .45, 0, 0, TAU); ctx.stroke(); }
    }, (ctx, f, time, z) => {
      const st = z.k11, K = Kit(); if (!st || !st.ctl) return;
      const x = st.ctl.x, y = st.ctl.y - 40, a = 1 - win(f.age, 1.6, f.dur), H = bodyH('ino'), ix = z.x, iy = z.y - H * .7;
      // the mind thread from Ino's limp body to her puppet
      ctx.lineCap = 'round';
      for (const [w, c] of [[7, `rgba(40,20,70,${.4 * a})`], [3, `rgba(220,190,255,${.9 * a})`]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const u = i / 16, px = ix + (x - ix) * u, py = iy + (y - iy) * u - Math.sin(Math.PI * u) * 50 + Math.sin(time * 10 + u * 12) * 6; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, x, y, 60, '170,120,255', .45 * a);
      K.glow(ctx, ix, iy, 40, '170,120,255', .35 * a);
      ctx.globalCompositeOperation = 'source-over';
      // a Yamanaka diamond seal spinning over the victim's head
      ctx.save(); ctx.translate(x, y - 46); ctx.rotate(time * 2); ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(40,20,70,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(13, 0); ctx.lineTo(0, 16); ctx.lineTo(-13, 0); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = '#e8d8ff'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }],
    petals: [(ctx, f, time) => {
      for (const s of f.list) {
        const tt = f.age - s.t0;
        if (tt < .2 || tt > 1.5) continue;
        if (tt < .5) { ctx.fillStyle = `rgba(255,140,200,${.25 * win(tt, .2, .5)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .8, 0, TAU); ctx.fill(); }
        else crater(ctx, s.x, s.y, s.r * .7, 1 - win(tt, .9, 1.5), s.x);
      }
      void time;
    }, (ctx, f, time) => {
      const K = Kit();
      f.list.forEach((s, j) => {
        const tt = f.age - s.t0;
        if (tt < 0 || tt > 1.3) return;
        if (tt > .3 && tt < .56) {
          // a big flower opening on the ground just before it bursts
          const u = easeOut((tt - .3) / .18), fr = s.r * .62 * u;
          for (let q = 0; q < 6; q++) {
            const an = q * TAU / 6 + j, px = s.x + Math.cos(an) * fr * .55, py = s.y - 16 + Math.sin(an) * fr * .3;
            ctx.save(); ctx.translate(px, py); ctx.rotate(an); ctx.scale(fr / 26, fr / 46);
            ctx.drawImage(petalSprite(j % 3 === 1 ? 1 : j % 3 === 2 ? 2 : 0), -12, -8, 24, 16); ctx.restore();
          }
          ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(s.x, s.y - 16, 6 * u, 0, TAU); ctx.fill();
        }
        for (let i = 0; i < 16; i++) {
          const h = hash(i * 3.1 + j * 7.7), ph = i / 16 * TAU + time * 5;
          let x, y, a = 1;
          if (tt < .35) { const u = easeOut(tt / .35), sx = f.x + Math.cos(ph) * 30, sy = f.y - 50; x = sx + (s.x - sx) * u + Math.cos(ph) * 30 * u; y = sy + (s.y - 40 - sy) * u - Math.sin(Math.PI * u) * 80; }
          else if (tt < .5) { const rr = s.r * .5 * (1 - (tt - .35) / .15 * .6); x = s.x + Math.cos(ph) * rr; y = s.y - 30 + Math.sin(ph) * rr * .5; }
          else { const u = easeOut((tt - .5) / .8); x = s.x + Math.cos(ph + h) * s.r * (.3 + u * 1.1); y = s.y - 30 + Math.sin(ph + h) * s.r * .5 * (.3 + u * 1.1) - u * 40 + u * u * 50; a = 1 - u; }
          drawPetal(ctx, (i + j) & 3, x, y, ph * 2 + time * 4, 1.9, a);
        }
        if (tt > .48 && tt < .9) {
          const u = (tt - .48) / .42;
          ctx.globalCompositeOperation = 'lighter';
          K.glow(ctx, s.x, s.y - 26, s.r * (.6 + u), '255,120,190', (1 - u) * .45, false, .8);
          ctx.globalCompositeOperation = 'source-over';
          dustRing(ctx, s.x, s.y, s.r, tt - .48, s.x * .1, 8, 'poof', .4);
        }
      });
    }],
    mindCone: [(ctx, f, time) => {
      const t = f.age, a = 1 - win(t, 1.0, f.dur);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      const front = Math.min(f.r, t * 1300);
      ctx.fillStyle = `rgba(60,20,110,${.2 * a})`; sector(ctx, 0, 0, 0, front, -f.h, f.h); ctx.fill();
      ctx.fillStyle = `rgba(190,140,255,${.16 * a})`; sector(ctx, 0, 0, Math.max(0, front - 160), front, -f.h, f.h); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const r = ((t * 900 + i * 85) % (f.r + 60)), k = 1 - r / (f.r + 60);
        if (r > front || (t * 900 < i * 85 && t < .9)) continue;
        const wob = Math.sin(time * 9 + i) * .05;
        ctx.strokeStyle = `rgba(40,14,70,${.45 * a * k})`; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(0, 0, r, -f.h - wob, f.h + wob); ctx.stroke();
        ctx.strokeStyle = `rgba(195,150,255,${.9 * a * k})`; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,255,${.8 * a * k})`; ctx.lineWidth = 2; ctx.stroke();
      }
      // distortion streaks radiating out of her mind
      ctx.strokeStyle = `rgba(230,210,255,${.6 * a})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const aa = (hash(i * 1.3 + f.seed) - .5) * 2 * f.h * .9, d0 = ((t * 1100 + i * 70) % Math.max(60, front)); ctx.moveTo(Math.cos(aa) * d0, Math.sin(aa) * d0); ctx.lineTo(Math.cos(aa) * (d0 + 60), Math.sin(aa) * (d0 + 60)); }
      ctx.stroke();
      ctx.restore();
      void time;
    }, (ctx, f, time, z) => {
      const K = Kit(), a = 1 - win(f.age, .6, 1.2), H = bodyH('ino');
      if (a <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x + Math.cos(f.a) * 20, z.y - H * .6, 70, '170,120,255', a * .5);
      // ghostly hands of thought surging ahead
      for (let i = 0; i < 5; i++) {
        const d = 80 + ((f.age * 700 + i * 90) % 600), aa = f.a + (hash(i + f.seed) - .5) * f.h * 1.6;
        K.glow(ctx, f.x + Math.cos(aa) * d, f.y + Math.sin(aa) * d - 30, 50, '150,100,255', a * .35);
      }
      ctx.globalCompositeOperation = 'source-over';
      void time;
    }],
    sense: [(ctx, f, time) => {
      const t = f.age, a = 1 - win(t, 1.4, f.dur), r = f.R * easeOut(t / .6);
      ctx.strokeStyle = `rgba(30,30,70,${.35 * a})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * .5, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(150,210,255,${.8 * a * (1 - t / f.dur)})`; ctx.lineWidth = 3; ctx.stroke();
      // the chakra threads of the sensory network converging on each target
      if (t > .25) for (const s of f.list) {
        const k = win(t, .25, .6);
        ctx.strokeStyle = `rgba(30,30,70,${.4 * a})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + (s.x - f.x) * k, f.y + (s.y - f.y) * k); ctx.stroke();
        ctx.strokeStyle = `rgba(170,220,255,${.9 * a})`; ctx.lineWidth = 2; ctx.stroke();
        if (t > .6 && t < .65 + .6) { ctx.fillStyle = `rgba(150,210,255,${.25 * a})`; ctx.beginPath(); ctx.arc(s.x, s.y, 125 * win(t, .3, .65), 0, TAU); ctx.fill(); }
      }
      void time;
    }, (ctx, f, time) => {
      const K = Kit(), t = f.age;
      f.list.forEach((s, j) => {
        const tt = t - .65 - j * .07;
        if (tt < 0 || tt > 1.1) return;
        const a = 1 - win(tt, .6, 1.1), up = easeOut(tt / .15);
        // crystalline mind spikes stabbing up out of the ground
        for (let i = 0; i < 7; i++) {
          const an = hash(i * 2.3 + j) * TAU, d = 20 + hash(i * 1.7 + j) * 70, x = s.x + Math.cos(an) * d, y = s.y + Math.sin(an) * d * .5, h = (50 + hash(i * 4.1 + j) * 60) * up, w = 9;
          ctx.fillStyle = `rgba(30,30,70,${.6 * a})`; ctx.beginPath(); ctx.moveTo(x - w - 2, y + 2); ctx.lineTo(x, y - h - 4); ctx.lineTo(x + w + 2, y + 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(160,210,255,${.9 * a})`; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${.8 * a})`; ctx.beginPath(); ctx.moveTo(x - w * .3, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w * .2, y); ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, s.x, s.y - 30, 110, '150,210,255', a * .8, true, .8);
        ctx.globalCompositeOperation = 'source-over';
      });
      void time;
    }],
    field: [(ctx, f, time) => {
      const t = f.age, k = easeOut(t / .5), a = (1 - win(t, 4.0, f.dur)) * k, R = f.r;
      ctx.fillStyle = `rgba(70,20,90,${.22 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(f.x, f.y);
      for (const [rr, w, c] of [[R, 10, `rgba(40,10,60,${.5 * a})`], [R, 4, `rgba(230,150,255,${.9 * a})`], [R * .72, 3, `rgba(255,170,230,${.7 * a})`], [R * .42, 3, `rgba(230,150,255,${.6 * a})`]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      }
      // rotating Yamanaka diamonds and radial spokes
      ctx.rotate(time * .6);
      ctx.strokeStyle = `rgba(240,180,255,${.75 * a})`; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0, -R * .92); ctx.lineTo(R * .3, 0); ctx.lineTo(0, R * .92); ctx.lineTo(-R * .3, 0); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
      if (f.boom === 2) crater(ctx, f.x, f.y, 330, 1 - win(t, 4.2, f.dur), f.seed);
    }, (ctx, f, time) => {
      const K = Kit(), t = f.age, a = 1 - win(t, 3.9, f.dur), R = f.r;
      // petals whirling round the field, drawn into the centre at the end
      const pull = win(t, 3.5, 3.9);
      for (let i = 0; i < 34; i++) {
        const h = hash(i * 1.9 + f.seed), an = h * TAU + time * (1 + h) * (i % 2 ? 1 : -1), rr = R * (.2 + .8 * hash(i * 2.7)) * (1 - pull * .9);
        drawPetal(ctx, i & 3, f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * .5 - 30 - Math.sin(time * 3 + i) * 14, an * 2, 1.3, a * clamp01(t * 3));
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.x, f.y - 30, R * .5, '220,130,255', .35 * a * clamp01(t * 2));
      // flickering ghost-eyes of the genjutsu
      for (let i = 0; i < 4; i++) { const ph = (time * .8 + i * .25) % 1, an = hash(i * 3.7 + Math.floor(time * .8 + i * .25)) * TAU; K.glow(ctx, f.x + Math.cos(an) * R * .55, f.y + Math.sin(an) * R * .3 - 40, 36, '255,190,255', bell(ph) * a); }
      if (t > 3.8 && t < 4.4) K.glow(ctx, f.x, f.y - 30, 360, '240,170,255', (1 - (t - 3.8) / .6), true, .7);
      ctx.globalCompositeOperation = 'source-over';
    }],
    // ---- Kiba
    scent: [(ctx, f, time) => {
      const a = clamp01(f.age * 4) * (1 - win(f.age, f.dur - 1, f.dur));
      ctx.fillStyle = `rgba(200,150,40,${.18 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 40;
      ctx.strokeStyle = `rgba(90,60,10,${.4 * a})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,215,110,${.9 * a})`; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.setLineDash([]);
    }, (ctx, f, time) => {
      const a = clamp01(f.age * 4) * (1 - win(f.age, f.dur - 1, f.dur));
      // wavy scent lines rising off the marked ground
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const ph = (time * .5 + i / 6) % 1, x = f.x + (hash(i * 3.3) - .5) * f.r * 1.4, y = f.y + (hash(i * 1.7) - .5) * f.r * .6;
        for (const [w, c] of [[5, `rgba(90,60,10,${.3 * a * bell(ph)})`], [2.2, `rgba(255,220,120,${.9 * a * bell(ph)})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
          for (let j = 0; j <= 6; j++) { const u = j / 6, px = x + Math.sin(u * 7 + time * 4 + i) * 8, py = y - ph * 60 - u * 50; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          ctx.stroke();
        }
      }
    }],
    smoke: [null, (ctx, f, time) => {
      const K = Kit(), t = f.age;
      if (t < .35) {
        const u = t / .35, x = f.x0 + (f.x - f.x0) * u, y = f.y0 + (f.y - f.y0) * u - 40 - Math.sin(Math.PI * u) * 120;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a6e78'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 5.4, 0, TAU); ctx.fill();
        return;
      }
      const tt = t - .35, a = 1 - win(t, f.dur - .9, f.dur), sm = K.puff('smoke'), po = K.puff('poof');
      for (let i = 0; i < 16; i++) {
        const an = hash(i * 2.1 + f.seed) * TAU, d = f.r * (.15 + easeOut(tt * 2.5) * (.55 + hash(i * 3.7) * .4)), x = f.x + Math.cos(an) * d + Math.sin(time * .7 + i) * 10, y = f.y + Math.sin(an) * d * .5 - 30 - hash(i * 1.1) * 50;
        K.stamp(ctx, i % 3 ? po : sm, x, y, f.r * (.22 + hash(i * 5.3) * .18) * (.6 + .4 * easeOut(tt * 3)), a * (i % 3 ? .75 : .6));
      }
    }],
    claw: [(ctx, f) => {
      const a = 1 - win(f.age, .2, f.dur);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.strokeStyle = `rgba(40,24,18,${.45 * a})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-60, i * 14 - 20); ctx.lineTo(60, i * 14 + 20); ctx.stroke(); }
      ctx.restore();
    }, (ctx, f) => {
      const t = f.age, k = easeOut(t / .12), a = 1 - win(t, .15, f.dur);
      ctx.save(); ctx.translate(f.x, f.y - 34); ctx.rotate(f.a);
      for (const sgn of [1, -1]) for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = `rgba(40,20,30,${.6 * a})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-70 * k, sgn * (i * 13 - 30 * k)); ctx.quadraticCurveTo(0, sgn * i * 16, 70 * k, sgn * (i * 13 + 30 * k)); ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,245,${a})`; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.restore();
    }],
    howl: [null, (ctx, f, time, z) => {
      for (let i = 0; i < 3; i++) { const tt = f.age - i * .18; if (tt > 0) Kit().fx.shockRing(ctx, z.x + facingOf(z) * 90, z.y - 60, 330, tt * 1.4, Math.max(0, 1 - tt * 1.3), '240,240,255'); }
      void time;
    }],
    // ---- Shino
    cloud: [(ctx, f) => {
      if (f.age < f.t0 - .1) return;
      const a = clamp01((f.age - f.t0 + .1) * 3) * (1 - win(f.age, f.dur - .7, f.dur));
      ctx.fillStyle = `rgba(14,20,10,${.3 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .5, 0, 0, TAU); ctx.fill();
    }, (ctx, f, time) => {
      const t = f.age;
      if (t < f.t0 + .2) bugStream(ctx, f.x0, f.y0 - 40, f.x, f.y - 40, clamp01(t / f.t0), Math.max(0, (t - f.t0 * .6) / f.t0), time, f.seed, 90, 18);
      if (t < f.t0 - .1) return;
      const a = clamp01((t - f.t0 + .1) * 3) * (1 - win(t, f.dur - .7, f.dur));
      swarm(ctx, f.x, f.y - 44, f.r * .95, f.r * .62, 150, time, f.seed, a);
    }],
    bugClone: [(ctx, f) => {
      for (const s of f.list) { ctx.fillStyle = `rgba(14,20,10,${.25 * (1 - win(f.age, 1.2, 1.6))})`; ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 40, 16, 0, 0, TAU); ctx.fill(); }
    }, (ctx, f, time) => {
      const t = f.age, S = Spr();
      f.list.forEach((s, j) => {
        const sd = f.seed + j * 9;
        if (t < .45) { swarm(ctx, s.x, s.y - 40 * (t / .45), 50 * (1 - t), 50 * (1 - t) + 20, 50, time, sd, 1); }
        if (t > .35 && t < 1.1 && S) {
          ctx.globalAlpha = clamp01((t - .35) * 4) * .92;
          S.draw(ctx, 'shino', s.x, s.y, { facing: s.x < f.cx ? 1 : -1, frame: t > .8 ? 'seal' : 'idle' });
          ctx.globalAlpha = 1;
          swarm(ctx, s.x, s.y - 50, 26, 50, 30, time, sd, .55);
        }
        if (t >= 1.05) {
          const u = clamp01((t - 1.05) / .3);
          swarm(ctx, s.x + (f.cx - s.x) * u, s.y - 40 + (f.cy - s.y) * u, 60 + u * 30, 46 + u * 20, 70, time, sd, 1 - win(t, 1.45, 1.9));
        }
      });
    }],
    pillar: [(ctx, f) => {
      const a = 1 - win(f.age, 1.0, f.dur);
      ctx.fillStyle = `rgba(12,16,8,${.4 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * .8, f.r * .38, 0, 0, TAU); ctx.fill();
      crater(ctx, f.x, f.y, f.r * .6, a, f.seed);
    }, (ctx, f, time) => {
      const t = f.age, up = easeOut(t / .25), a = 1 - win(t, .8, f.dur), H = 230 * up;
      for (let i = 0; i < 5; i++) {
        const u = i / 4, w = f.r * (.55 - u * .25) * (1 + Math.sin(time * 6 + i) * .1);
        swarm(ctx, f.x + Math.sin(time * 4 + i * 1.3) * 10, f.y - 20 - H * u, w, w * .7, 28, time * 1.5, f.seed + i, a * (1 - u * .3));
      }
    }],
    leech: [null, (ctx, f, time, z) => {
      const K = Kit(), a = 1 - win(f.age, f.dur - .4, f.dur), H = bodyH('shino'), sx = z.x, sy = z.y - H * .55;
      ctx.globalAlpha = a;
      bugStream(ctx, sx, sy, f.qx, f.qy - 34, 1, 0, time, f.seed, 110, 14);
      ctx.globalAlpha = 1;
      swarm(ctx, f.qx, f.qy - 34, 38, 44, 60, time, f.seed, a);
      // stolen chakra flowing back along the swarm
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const u = 1 - ((time * 1.4 + i / 6) % 1), mx = (sx + f.qx) / 2 + (f.qy - sy) * .25, my = (sy + f.qy - 34) / 2 - (f.qx - sx) * .25 - 60;
        const bx = (1 - u) * (1 - u) * sx + 2 * u * (1 - u) * mx + u * u * f.qx, by = (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * my + u * u * (f.qy - 34);
        K.glow(ctx, bx, by, 22, '150,230,140', .9 * a);
      }
      K.glow(ctx, sx, sy, 50, '150,230,140', .5 * a);
      ctx.globalCompositeOperation = 'source-over';
    }],
    bugRing: [null, (ctx, f, time) => {
      const u = easeOut(f.age / .6), a = 1 - win(f.age, .7, f.dur);
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + time; swarm(ctx, f.x + Math.cos(an) * f.r * u, f.y + Math.sin(an) * f.r * .5 * u - 30, 34, 26, 16, time, f.seed + i, a); }
    }],
    sphere: [(ctx, f) => {
      const t = f.age, a = clamp01(t * 3) * (1 - win(t, 4.6, f.dur)), r = f.rc;
      ctx.fillStyle = `rgba(10,14,8,${.35 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(150,200,120,${.6 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
      if (f.boom) crater(ctx, f.x, f.y, 300, 1 - win(t, 4.8, f.dur), f.seed);
    }, (ctx, f, time) => {
      const t = f.age, a = clamp01(t * 2.5) * (1 - win(t, 4.5, f.dur)), r = f.rc;
      if (t < 3.2) {
        // the living wall: a ring of swarm around the target, the dome rising behind it
        const n = 24, hgt = Math.min(1, t / .6) * (r * .55);
        ctx.strokeStyle = `rgba(10,14,8,${.45 * a})`; ctx.lineWidth = Math.max(20, r * .16);
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 30, r, r * .92, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(14,20,12,${.22 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y - 30 - hgt * .4, r, r * .5 + hgt * .5, 0, Math.PI, TAU); ctx.lineTo(f.x + r, f.y - 30); ctx.ellipse(f.x, f.y - 30, r, r * .92, 0, 0, Math.PI); ctx.fill();
        for (let i = 0; i < n; i++) {
          const an = i * TAU / n + time * .4, x = f.x + Math.cos(an) * r, y = f.y + Math.sin(an) * r;
          swarm(ctx, x, y - 30 - hgt * .3 * (1 - Math.abs(Math.cos(an))), r * .22, r * .2 + 16, 26, time, f.seed + i, a * (Math.sin(an) < 0 ? .7 : 1));
        }
        swarm(ctx, f.x, f.y - 30 - hgt, r * .7, hgt * .5 + 20, 60, time, f.seed + 40, a * .5);
      } else {
        // the swarm tornado erupting at the centre
        const k = win(t, 3.0, 3.4), H = 420 * easeOut(k);
        for (let i = 0; i < 7; i++) {
          const u = i / 6, w = 70 + u * 110, an = time * 9 + i;
          swarm(ctx, f.x + Math.cos(an) * 18 * u, f.y - 20 - H * u, w, w * .35 + 10, 30, time * 2, f.seed + i, a);
        }
      }
    }],
    // ---- Tenten
    scrolls: [null, (ctx, f, time, z) => {
      const st = z.k11, lift = st ? st.lift : 0, t = f.age, a = 1 - win(t, f.dur - .4, f.dur), up = easeOut(t / .5);
      // two scroll ribbons spiralling up around her like rising dragons, drawn back half first
      for (const pass of [0, 1]) for (const side of [0, 1]) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 28; i++) {
          const u = i / 28, u2 = (i + 1) / 28;
          const ang = u * TAU * 2 + time * 7 + side * Math.PI, ang2 = u2 * TAU * 2 + time * 7 + side * Math.PI;
          if ((Math.sin(ang) > 0) !== !!pass) continue;
          const r = 34 + u * 26, h = 260 * up;
          const x1 = z.x + Math.cos(ang) * r, y1 = z.y - lift - 10 - u * h + Math.sin(ang) * 14, x2 = z.x + Math.cos(ang2) * (34 + u2 * 26), y2 = z.y - lift - 10 - u2 * h + Math.sin(ang2) * 14;
          ctx.globalAlpha = a * (u2 < up ? 1 : 0);
          ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.strokeStyle = pass ? '#f4ead2' : '#c8bc9e'; ctx.lineWidth = 11; ctx.stroke();
          if (i % 3 === 0) { ctx.strokeStyle = '#a8263a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x1, y1 - 4); ctx.lineTo(x2, y2 - 4); ctx.stroke(); }
          if (i % 4 === 1) { ctx.fillStyle = '#2a1a1a'; ctx.fillRect((x1 + x2) / 2 - 1.5, (y1 + y2) / 2 - 2, 3, 4); }
        }
      }
      ctx.globalAlpha = 1;
      // dragon heads of chakra at the top of each spiral
      ctx.globalCompositeOperation = 'lighter';
      for (const side of [0, 1]) { const ang = TAU * 2 + time * 7 + side * Math.PI; Kit().glow(ctx, z.x + Math.cos(ang) * 60, z.y - lift - 10 - 260 * up + Math.sin(ang) * 14, 40, '255,220,150', a * up, true); }
      ctx.globalCompositeOperation = 'source-over';
    }],
    weapons: [(ctx, f) => {
      for (const w of f.list) {
        const tt = f.age - w.t0;
        if (tt < 0) continue;
        if (tt < .32) { const k = tt / .32; ctx.fillStyle = `rgba(20,14,10,${.3 * k})`; ctx.beginPath(); ctx.ellipse(w.x, w.y, 6 + 14 * k, 3 + 6 * k, 0, 0, TAU); ctx.fill(); }
        else if (tt < f.dur - w.t0) { const a = 1 - win(f.age, f.dur - .5, f.dur); ctx.fillStyle = `rgba(30,20,14,${.35 * a})`; ctx.beginPath(); ctx.ellipse(w.x, w.y, 13, 5, 0, 0, TAU); ctx.fill(); }
      }
    }, (ctx, f, time) => {
      const K = Kit(), endA = 1 - win(f.age, f.dur - .5, f.dur);
      for (const w of f.list) {
        const tt = f.age - w.t0;
        if (tt < 0) continue;
        const img = weaponSprite(w.k), spin = w.k === 1;
        if (tt < .32) {
          const k = tt / .32, h = 560 * (1 - k * k), x = w.x + w.a * 60 * (1 - k), y = w.y - h;
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x, y - 160); ctx.stroke();
          ctx.save(); ctx.translate(x, y); ctx.rotate(spin ? time * 20 : w.a);
          ctx.drawImage(img, -20, spin ? -30 : -115, 40, 120); ctx.restore();
        } else {
          const st = tt - .32;
          if (st < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, w.x, w.y - 6, 40, '255,240,200', (1 - st / .25), true, .6); ctx.globalCompositeOperation = 'source-over'; dustRing(ctx, w.x, w.y, 70, st, w.x, 5); }
          ctx.globalAlpha = endA;
          ctx.save(); ctx.translate(w.x, w.y + 8); ctx.rotate(w.a * .6);
          ctx.drawImage(img, -20, spin ? -36 : -112, 40, 120); ctx.restore();
          ctx.globalAlpha = 1;
        }
      }
    }],
    chain: [null, (ctx, f, time, z) => {
      const t = f.age, H = bodyH('tenten'), hx = z.x + facingOf(z) * 12, hy = z.y - H * .5;
      let bx, by, a = 1;
      const out = f.len / f.sp;
      if (t < out) { const d = f.len * (t / out); bx = f.x + Math.cos(f.a) * d; by = f.y + Math.sin(f.a) * d - 30; }
      else if (t < .55) { bx = f.ex; by = f.ey - 30 + Math.sin(Math.PI * clamp01((t - out) / .2)) * -20; }
      else if (t < 1.05) { const ang = f.a - 1.1 + 2.2 * easeInOut((t - .55) / .5); bx = z.x + Math.cos(ang) * 560; by = z.y + Math.sin(ang) * 560 - 30; }
      else { const u = easeIn((t - 1.05) / .5), ang = f.a + 1.1; bx = z.x + Math.cos(ang) * 560 * (1 - u); by = z.y + Math.sin(ang) * 560 * (1 - u) - 30; a = 1 - win(t, 1.45, f.dur); }
      // chain links
      ctx.globalAlpha = a;
      const n = 22, sag = t > .55 && t < 1.05 ? 0 : 30;
      for (let i = 1; i < n; i++) {
        const u = i / n, x = hx + (bx - hx) * u, y = hy + (by - hy) * u + Math.sin(Math.PI * u) * sag;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, 5.4, 3.6, Math.atan2(by - hy, bx - hx) + (i % 2) * 1.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = STEEL; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(x, y, 3.6, 2.2, Math.atan2(by - hy, bx - hx) + (i % 2) * 1.2, 0, TAU); ctx.stroke();
      }
      if (t > .55 && t < 1.05) {
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(z.x, z.y - 30, 560, f.a - 1.1, f.a - 1.1 + 2.2 * easeInOut((t - .55) / .5)); ctx.stroke();
      }
      // spiked iron ball
      ctx.fillStyle = INK;
      for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + time * 8; ctx.beginPath(); ctx.moveTo(bx + Math.cos(an - .25) * 16, by + Math.sin(an - .25) * 16); ctx.lineTo(bx + Math.cos(an) * 30, by + Math.sin(an) * 30); ctx.lineTo(bx + Math.cos(an + .25) * 16, by + Math.sin(an + .25) * 16); ctx.fill(); }
      ctx.beginPath(); ctx.arc(bx, by, 21, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a606c'; ctx.beginPath(); ctx.arc(bx, by, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(bx - 6, by - 7, 6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }],
    kunaiFan: [(ctx, f) => {
      for (const k of f.list) { const tt = f.age - k.t0; if (tt > 0) crater(ctx, k.x, k.y, 90, 1 - win(f.age, f.dur - .5, f.dur), k.x); }
    }, (ctx, f, time) => {
      const K = Kit(), img = weaponSprite(0);
      f.list.forEach((k, i) => {
        const t = f.age, fl = .22;
        if (t < k.t0) {
          const u = clamp01(t / fl), x = f.x + (k.x - f.x) * u, y = f.y - 40 + (k.y - f.y + 40) * u - Math.sin(Math.PI * u) * 30;
          ctx.save(); ctx.translate(x, y); ctx.rotate(u < 1 ? Math.atan2(k.y - f.y, k.x - f.x) - Math.PI / 2 : .3);
          ctx.drawImage(img, -12, -70, 24, 72); ctx.restore();
          if (u >= 1) {
            // the explosive tag burning down
            ctx.fillStyle = '#f4ecd4'; ctx.fillRect(x - 4, y - 46, 8, 16);
            ctx.fillStyle = '#c8282c'; ctx.fillRect(x - 1.5, y - 44, 3, 12);
            ctx.globalCompositeOperation = 'lighter';
            K.glow(ctx, x, y - 46 + ((t - fl) / (k.t0 - fl)) * 14, 12, '255,200,90', .9 * (.6 + .4 * Math.sin(time * 40 + i)), true);
            ctx.globalCompositeOperation = 'source-over';
          }
        } else if (t < k.t0 + 1.0) K.fx.fireBlast(ctx, k.x, k.y, 115, t - k.t0, 1 - win(t - k.t0, .5, 1.0), time, k.x * .1);
      });
    }],
    fanSwing: [null, (ctx, f, time, z) => {
      const t = f.age, H = bodyH('tenten'), fac = facingOf(z), u = easeInOut(clamp01(t / .35)), a = 1 - win(t, .7, f.dur);
      const ang = f.a - 1.3 * (1 - u) + .3 * u;
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(z.x + fac * 10, z.y - H * .55); ctx.rotate(ang + Math.PI / 2);
      ctx.drawImage(fanSprite(), -60, -150, 120, 144);
      ctx.restore();
      ctx.globalAlpha = 1;
      void time;
    }],
    fireWave: [(ctx, f) => {
      const t = f.age, rf = f.r * easeOut(t / 1.0), a = 1 - win(t, 2.0, f.dur);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = `rgba(40,18,8,${.3 * a})`; sector(ctx, 0, 0, 40, Math.max(41, rf), -f.h, f.h); ctx.fill();
      ctx.restore();
    }, (ctx, f, time) => {
      const K = Kit(), t = f.age, rf = f.r * easeOut(t / 1.0), a = 1 - win(t, 1.6, f.dur), m = ctx.getTransform();
      if (a <= 0) return;
      // the wall of flame tongues at the advancing front, embers dying behind it
      const n = 22;
      for (const row of [.78, 1]) for (let i = 0; i < n; i++) {
        const u = (i + (row < 1 ? .5 : 0)) / (n - 1); if (u > 1) continue;
        const aa = f.a + (u - .5) * 2 * f.h, d = rf * row * (.93 + hash(i + f.seed + row) * .1), x = f.x + Math.cos(aa) * d, y = f.y + Math.sin(aa) * d;
        const hgt = (56 + d * .13) * (row < 1 ? .7 : 1) * (t < 1.1 ? 1 : 1 - win(t, 1.1, 1.8)), img = K.flame(i + Math.floor(time * 14));
        if (hgt > 4 && d > 50) K.flameAt(ctx, m, img, x, y, hgt * .6, hgt, Math.sin(time * 6 + i) * .2 + Math.cos(f.a) * .25);
      }
      ctx.setTransform(m);
      const fire = K.puff('fire');
      for (let i = 0; i < 10; i++) {
        const ph = (time * .9 + hash(i * 2.2)) % 1, aa = f.a + (hash(i * 3.1 + f.seed) - .5) * 2 * f.h, d = Math.min(rf, 120 + hash(i * 1.4) * f.r * .8);
        K.stamp(ctx, fire, f.x + Math.cos(aa) * d, f.y + Math.sin(aa) * d - 10 - ph * 50, 12 + ph * 16, (1 - ph) * a * .8);
      }
      // wind streaks of the fan swirling through
      ctx.strokeStyle = `rgba(255,255,255,${.5 * a})`; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const d = (t * 900 + i * 140) % f.r, aa = f.a + (hash(i * 7.1) - .5) * f.h * 1.6;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(aa) * d, f.y + Math.sin(aa) * d - 40, 30, aa - 1, aa + .6); ctx.stroke();
      }
    }],
    scrollRing: [null, (ctx, f, time, z) => {
      const st = z.k11, lift = st ? st.lift : 0, t = f.age, a = 1 - win(t, f.dur - .4, f.dur), K = Kit(), img = scrollSprite(), up = easeOut(t / .5);
      for (let i = 0; i < 6; i++) {
        const an = i * TAU / 6 + time * .8, x = z.x + Math.cos(an) * 110 * up, y = z.y - lift * .6 - 40 + Math.sin(an) * 50 * up;
        ctx.globalAlpha = a;
        ctx.save(); ctx.translate(x, y); ctx.rotate(an + Math.PI / 2);
        ctx.drawImage(img, -45, -15, 90, 30);
        ctx.restore();
        // weapons shooting skyward out of each unrolled scroll
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2.2;
        for (let j = 0; j < 2; j++) { const ph = (time * 2.2 + j * .5 + i * .13) % 1; ctx.beginPath(); ctx.moveTo(x, y - 20 - ph * 260); ctx.lineTo(x, y - 60 - ph * 260); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter';
        K.glow(ctx, x, y - 10, 34, '255,220,150', .6 * a);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }],
    bigBlade: [(ctx, f) => {
      const k = clamp01(f.age / f.fall), a = 1 - win(f.age, f.dur - .5, f.dur);
      ctx.fillStyle = `rgba(20,12,8,${.35 * k * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 40 + 60 * k, 16 + 22 * k, 0, 0, TAU); ctx.fill();
    }, (ctx, f) => {
      const k = clamp01(f.age / f.fall), a = 1 - win(f.age, f.dur - .5, f.dur), img = weaponSprite(2), h = 900 * (1 - easeIn(k));
      ctx.globalAlpha = a;
      if (k < 1) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(f.x, f.y - h - 300); ctx.lineTo(f.x, f.y - h - 700); ctx.stroke(); }
      ctx.drawImage(img, f.x - 60, f.y - h - 330 + (k >= 1 ? 40 : 0), 120, 360);
      ctx.globalAlpha = 1;
    }]
  };

  // ================================================================== bodies: forms, dog, wings, aura
  function drawDog(ctx, z, st, time, alpha) {
    const dg = st.dog; if (!dg || dg.form === 'gone') return;
    const K = Kit(), x = dg.x, y = dg.y + 3;
    ctx.fillStyle = 'rgba(16,20,10,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, TAU); ctx.fill();
    if (dg.form === 'drill') { drawDrill(ctx, x, y - 26 - dg.lift, dg.a, 1, 1.0, time); return; }
    if (dg.form === 'kiba') { const S = Spr(); if (S) S.draw(ctx, 'kiba', x, y - dg.lift, { facing: dg.f, frame: dg.arc ? 'attack' : dg.mv ? 'run' : 'idle', phase: dg.ph }); return; }
    const fr = z.health <= 0 ? 'sit' : dg.arc ? 'leap' : dg.dash ? 'leap' : dg.mv ? 'run' + (Math.floor(dg.ph) % 4) : 'idle';
    const img = dogSprite(fr), s = .82;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - dg.lift); ctx.scale(dg.f * s, s);
    ctx.drawImage(img, -64, -84, 140, 90);
    ctx.restore();
    void K;
  }
  function drawDrill(ctx, x, y, a, tone, s, time) {
    const K = Kit(), ph = Math.floor(time * 30) % 4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s * .9);
    // swirling wind rings round the drill
    ctx.strokeStyle = 'rgba(40,30,30,.35)'; ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 26, 0, 12, 38 - i * 8, 0, time * 20 + i, time * 20 + i + 4); ctx.stroke(); }
    ctx.drawImage(drillSprite(tone, ph), -70, -40, 140, 80);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-20 + i * 26, 0, 10, 34 - i * 8, 0, time * 20 + i + 2, time * 20 + i + 5); ctx.stroke(); }
    ctx.restore();
    // chips of ground thrown up
    ctx.fillStyle = '#5a4636';
    for (let i = 0; i < 6; i++) { const ph2 = (time * 3 + i / 6) % 1, an = a + Math.PI + (hash(i * 3.1) - .5) * 1.6; ctx.fillRect(x + Math.cos(an) * (30 + ph2 * 60) * s, y + 20 - Math.sin(Math.PI * ph2) * 30 + Math.sin(an) * ph2 * 30, 4, 3); }
    void K;
  }
  function wingK(z, st) {
    if (z.bossId !== 'choji') return 0;
    if (st.move === 'butterfly' && st.windup > 0) return easeOut(1 - st.windup / st.windMax);
    return st.wings > 0 ? Math.min(1, st.wings * 2) : 0;
  }
  function drawWings(ctx, z, st, time) {
    const k = wingK(z, st); if (k <= .01) return;
    const K = Kit(), H = bodyH('choji'), x = z.x, y = z.y + 3 - st.lift - H * .62, img = wingSprite();
    const flap = .78 + .22 * Math.sin(time * (st.arc ? 14 : 6));
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, 200 * k, '255,170,90', .45 * k);
    ctx.globalCompositeOperation = 'source-over';
    for (const s of [1, -1]) {
      ctx.save(); ctx.translate(x + s * 6, y); ctx.scale(s * k * flap * .78, k * .78); ctx.globalAlpha = .85;
      ctx.drawImage(img, -20, -160, 300, 300);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [1, -1]) K.glow(ctx, x + s * 120 * k * flap, y - 40, 90 * k, '255,200,120', .4 * k);
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawBuff(ctx, z, st, time) {
    if (!(st.buff > 0) || st.form) return;
    const K = Kit(), H = bodyH('choji'), a = Math.min(1, st.buff), steam = K.puff('steam');
    for (let i = 0; i < 7; i++) {
      const ph = (time * 1.2 + hash(i * 1.7)) % 1;
      K.stamp(ctx, steam, z.x + Math.sin(i * 2.3 + time * 2) * (18 + ph * 16), z.y - st.lift - 10 - ph * (H + 30), 10 + ph * 18, (1 - ph) * .55 * a);
    }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, z.y - st.lift - H * .5, H * .8, '255,90,60', .22 * a);
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawForm(ctx, z, st, time) {
    const K = Kit(), f = facingOf(z);
    if (st.form === 'ball') {
      const x = z.x, y = z.y + 3 - 44;
      ctx.save(); ctx.translate(x, y); ctx.rotate(st.spin * f);
      ctx.drawImage(ballSprite(), -60, -60, 120, 120);
      ctx.restore();
      const dust = K.puff('dust');
      for (let i = 0; i < 5; i++) { const ph = (time * 3 + i / 5) % 1; K.stamp(ctx, dust, x - Math.cos(z.angle || 0) * (40 + ph * 50), z.y - 4 - ph * 16, 16 + ph * 18, (1 - ph) * .7); }
    } else if (st.form === 'giant') {
      const grow = easeOut(Math.min(1, st.formT / .35)), GS = 1.42 * (1 + 1.35 * grow), s = GS / 3.4;
      const fr = st.stomp > 0 ? 'attack' : st.arc ? 'seal' : 'idle', img = giantSprite(fr), x = z.x, y = z.y + 3 - st.lift;
      ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
      ctx.drawImage(img, -50 * 3.4 * s, -98 * 3.4 * s, 340 * s, 360 * s);
      ctx.restore();
    } else if (st.form === 'drill') {
      drawDrill(ctx, z.x, z.y + 3 - 30 - st.lift, z.angle || 0, 0, 1.05, time);
    } else if (st.form === 'wolf') {
      const grow = easeOut(Math.min(1, st.formT / .3)), s = 1.55 * grow, img = wolfSprite();
      ctx.save(); ctx.translate(z.x, z.y + 3); ctx.scale(f * s, s);
      ctx.drawImage(img, -92, -132, 180, 140);
      ctx.restore();
    } else if (st.form === 'wolfdrill') {
      const a = z.angle || 0, nx = -Math.sin(a), ny = Math.cos(a), w = 46;
      // Garōga: the two heads become one twin drill, two cones winding round each other
      for (const s of [1, -1]) {
        const o = Math.sin(time * 18 + (s > 0 ? 0 : Math.PI)) * w;
        drawDrill(ctx, z.x + nx * o, z.y + 3 - 64 + ny * o * .5, a, 2, 2.0, time + (s > 0 ? 0 : .5));
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, z.x, z.y - 60, 160, '220,230,255', .45);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function shadowForm(ctx, z, st) {
    const r = st.form === 'giant' ? 110 : st.form === 'wolf' ? 120 : st.form === 'wolfdrill' ? 110 : st.form === 'ball' ? 50 : 40;
    ctx.fillStyle = 'rgba(16,20,10,.3)'; ctx.beginPath(); ctx.ellipse(z.x, z.y + 3, r, r * .36, 0, 0, TAU); ctx.fill();
  }

  // ================================================================== windup & label
  function windupFx(ctx, z, st, time, H) {
    const K = Kit(), id = z.bossId, k = 1 - st.windup / st.windMax, def = MOVES[id][st.move];
    const fy = z.y + 3 - st.lift, fac = facingOf(z);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - H * .5, 40 + 40 * k, def.rgb, .25 + .3 * k);
    ctx.strokeStyle = rgbA(def.rgb, .4 + .4 * k); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = i * TAU / 8 + time * 2, ph = (time * 2.4 + hash(i + st.seed)) % 1, d0 = 120 * (1 - ph) + 30;
      ctx.moveTo(z.x + Math.cos(an) * d0, fy - H * .5 + Math.sin(an) * d0 * .6); ctx.lineTo(z.x + Math.cos(an) * (d0 - 22), fy - H * .5 + Math.sin(an) * (d0 - 22) * .6);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (id === 'ino' && st.move !== 'petals') {
      // the Yamanaka hand sign: fingers framing a diamond, aimed at the target
      ctx.save(); ctx.translate(z.x + fac * 16, fy - H * .62); ctx.rotate(time * .5 * 0);
      ctx.strokeStyle = 'rgba(40,20,70,.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -14 - 6 * k); ctx.lineTo(12 + 4 * k, 0); ctx.lineTo(0, 14 + 6 * k); ctx.lineTo(-12 - 4 * k, 0); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,215,255,.95)'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.restore();
    }
    if (id === 'shino') swarm(ctx, z.x, fy - H * .55, 44 + 20 * k, 50 + 10 * k, 40, time, st.seed, .5 + .4 * k);
    if (id === 'tenten' && (st.move === 'dragons' || st.move === 'rain')) {
      const img = scrollSprite();
      for (const s of [1, -1]) { ctx.save(); ctx.translate(z.x + s * (26 + 10 * k), fy - 20); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -36, -12, 72, 24); ctx.restore(); }
    }
    if (id === 'tenten' && st.move === 'fan') { ctx.save(); ctx.translate(z.x - fac * 10, fy - H * .6); ctx.rotate(-fac * .5); ctx.drawImage(fanSprite(), -50 * k, -130 * k, 100 * k, 120 * k); ctx.restore(); }
    if (id === 'choji' && st.move === 'tank') { const dust = K.puff('dust'); for (let i = 0; i < 4; i++) { const ph = (time * 2 + i / 4) % 1; K.stamp(ctx, dust, z.x - Math.cos(st.aim) * (20 + ph * 30), z.y - ph * 10, 10 + ph * 14, (1 - ph) * .6 * k); } }
    if (id === 'kiba' && st.dog && st.dog.form === '') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, st.dog.x + st.dog.f * 40, st.dog.y - 50, 26 + 10 * k, '255,80,60', .5 * k, true);
      ctx.globalCompositeOperation = 'source-over';
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
  // Ino's limp body while her mind is away: a faint violet aura and a ghost rising from her.
  function drawLimp(ctx, z, st, time) {
    if (!(st.limp > 0)) return;
    const K = Kit(), H = bodyH('ino'), a = Math.min(1, st.limp * 2);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, z.y - H * .5, H * .7, '190,150,255', .3 * a);
    K.glow(ctx, z.x, z.y - H - 10 - Math.sin(time * 4) * 6, 30, '220,200,255', .6 * a, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ================================================================== module hooks
  function draw(ctx, z, time) {
    const st = z.k11;
    if (!st || !members[z.bossId] || !Kit()) return;
    visualAge(z, st, time);
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[z.bossId][st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
      }
      if (st.form) shadowForm(ctx, z, st);
      drawWings(ctx, z, st, time);
    }
    if (st.dog && st.dog.y <= z.y && st.dog.form !== 'drill') drawDog(ctx, z, st, time, z.health > 0 ? 1 : Math.max(0, Math.min(1, (z.deathTimer || 0) / .7)));
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const st = z.k11, m = members[z.bossId];
    if (!st || !m || !Kit()) return;
    ctx.save();
    if (st.dog && (st.dog.y > z.y || st.dog.form === 'drill')) drawDog(ctx, z, st, time, z.health > 0 ? 1 : Math.max(0, Math.min(1, (z.deathTimer || 0) / .7)));
    if (z.health > 0 && st.form) { drawForm(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0) {
      if (z.bossId === 'choji') drawBuff(ctx, z, st, time);
      if (z.bossId === 'ino') drawLimp(ctx, z, st, time);
      if (st.windup > 0 && st.move) {
        windupFx(ctx, z, st, time, bodyH(z.bossId));
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        label(ctx, z, st, m, time);
      }
    }
    ctx.restore();
  }

  const hidden = z => !!(z.k11 && z.health > 0 && (z.k11.form || z.k11.vanish > 0));
  const bodyLift = z => (z.k11 && z.health > 0 ? z.k11.lift || 0 : 0);

  window.KonohaElevenBosses = { members, order, pick, update, draw, drawOverlay, hidden, bodyLift, moveLabels, moves };
})();
