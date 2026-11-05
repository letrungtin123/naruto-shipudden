(() => {
  'use strict';

  // Sand & Mist (spawn panel group "LÀNG CÁT · LÀNG SƯƠNG MÙ", faction 'sunakiri'). Same contract as
  // new-kage-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints the ground layer,
  // drawOverlay(ctx, z, time) what stands above the characters. Per-boss state lives on z.sk as plain
  // JSON (co-op snapshots copy it whole): delayed hits are data events, effects are { kind, age, dur }.
  //  - Kankurō: Karasu blade assault, Karasu poison-needle rain, Kuroari capture, Sanshōuo shield,
  //    Sasori puppet (spinning blades + flame jets), ultimate Black Secret Technique: Iron Maiden.
  //  - Temari: Wind Scythe cut, Great Sickle Weasel gust, Kamatari summon, Dust Cloud, Cutting
  //    Whirlwinds, ultimate Summoning: Blade Dance (giant sweeping tornado).
  //  - Zabuza: Hidden Mist + Silent Killing, Water Dragon Bullet, Water Prison, Water Clones,
  //    Kubikiribōchō throw, ultimate Great Waterfall + silent kill.
  //  - Haku: senbon volleys, Thousand Needles of Death, Swallow Snowstorm, ice spike lanes,
  //    ice-mirror step, ultimate Demonic Ice Mirrors.
  const TAU = Math.PI * 2;

  // =================================================================================== SPRITES
  const AS = window.AnimeSprites, K = AS && AS.kit;
  if (K && AS.addSprite) {
    const { paint, line, dot, ell, poly, smooth, dark, light, rgba, SHADE, DEEP, DEEP2, HAIR, locks, fringeShadow, onFace, headPath,
      drawEye, plateSymbol, hairGloss, flakVest, spikeHair } = K;

    // ---------------------------------------------------------------- Kankurō
    // Black hooded suit with the two cat-ear points, Suna plate on the hood, purple kabuki paint,
    // Karasu wrapped in bandages on his back, a chakra-thread glint on the fingers when he attacks.
    function kankuroSpec() {
      const O = '#0c0b12', SKIN = '#efd1bb', SUIT = '#24222d', SUIT_L = '#3b3848', PAINT = '#7c3fb0', WRAP = '#e4dccb';
      const hood = (ctx, spec) => {
        // the two cat ears
        for (const [bx0, by0, tx, ty, bx1, by1] of [[-9.6, -8.6, -7.4, -20.4, -3.2, -12.6], [-.4, -12.8, 3.6, -20.8, 6.6, -10.8]]) {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.quadraticCurveTo((bx0 + tx) / 2 - .6, (by0 + ty) / 2, tx, ty); ctx.quadraticCurveTo((tx + bx1) / 2 + .8, (ty + by1) / 2, bx1, by1); ctx.closePath(); }, SUIT, O, 1, () => {
            ctx.fillStyle = dark(SUIT, .35); ctx.beginPath(); ctx.moveTo(bx0 + 1.6, by0 - .6); ctx.lineTo(tx + .2, ty + 2.6); ctx.lineTo(bx1 - 1.6, by1 - .4); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(tx, ty + .4); ctx.lineTo(bx1 - .4, by1 - .8); ctx.lineTo(bx1 - 1.4, by1 - .6); ctx.fill();
          });
        }
        // the hood shell: over the skull, the ear and down to the neck, framing the face
        paint(ctx, () => {
          ctx.beginPath(); ctx.moveTo(10.8, -3.4); ctx.quadraticCurveTo(11.6, -13.8, .4, -13.9); ctx.quadraticCurveTo(-12.8, -13.4, -13, .4);
          ctx.quadraticCurveTo(-12.6, 8.6, -7.6, 12.6); ctx.lineTo(-3.4, 12.4); ctx.quadraticCurveTo(-2.4, 6, -2.2, 1.6);
          ctx.quadraticCurveTo(-1.2, -3.6, 3.6, -5); ctx.quadraticCurveTo(8, -5.4, 10.8, -3.4); ctx.closePath();
        }, SUIT, O, 1.1, () => {
          ctx.fillStyle = dark(SUIT, .4); ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-6, -2, -5, 13); ctx.lineTo(-14, 13); ctx.fill();
          ctx.fillStyle = 'rgba(160,150,200,.18)'; ell(ctx, 2, -10.6, 7, 2.2, -.12); ctx.fill();
          ctx.strokeStyle = 'rgba(150,140,190,.22)'; ctx.lineWidth = .4;
          ctx.beginPath(); ctx.moveTo(-1.6, -13.4); ctx.quadraticCurveTo(-7, -8, -8.4, 4); ctx.stroke();
          ctx.fillStyle = DEEP; ctx.beginPath(); ctx.moveTo(-2.4, 12); ctx.quadraticCurveTo(-1.6, 4, -1.2, -.4); ctx.lineTo(.2, -.4); ctx.quadraticCurveTo(-.2, 5, -1, 12.4); ctx.fill();
        });
      };
      return {
        outline: O, skin: SKIN, skinShade: '#cfa592', bulk: .5, legK: 1.12,
        legs: { thigh: SUIT, shin: SUIT, foot: '#1a1920', wrap: WRAP, holster: '#2e2b36', w1: 5.4, w2: 4.5 },
        arms: { upper: SUIT, lower: SUIT, w1: 5, w2: 4.5, cuff: '#3a3644', hand: SKIN },
        torso: {
          base: SUIT, paint(ctx) {
            // zip seam, a grey pouch belt slung low, a faint chest highlight
            line(ctx, [[3.4, -13], [3.8, .2]], dark(SUIT, .5), .5); line(ctx, [[3.7, -13], [4.1, .2]], rgba(SUIT_L, .6), .25);
            ctx.fillStyle = 'rgba(170,160,210,.14)'; ell(ctx, 3, -9.4, 3.6, 2.2, -.2); ctx.fill();
            ctx.fillStyle = '#4a4656'; ctx.beginPath(); ctx.moveTo(-6.6, -3.4); ctx.lineTo(7.4, -2.6); ctx.lineTo(7.2, -.6); ctx.lineTo(-6.2, -1.2); ctx.fill();
            ctx.fillStyle = '#6a6578'; ctx.fillRect(-6, -3.3, 13, .5);
            ctx.fillStyle = '#5a5566'; ctx.fillRect(-5.6, -3.8, 3, 3.4); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-5.6, -1.2, 3, .6);
          }
        },
        collarBack(ctx) {
          // the bandaged Karasu bundle's top end over the shoulder
          paint(ctx, () => { ctx.save(); ctx.translate(-4, -18); ctx.rotate(-.42); ell(ctx, 0, 0, 3.2, 3.6); ctx.restore(); }, WRAP, O, .8, () => {
            ctx.strokeStyle = 'rgba(120,104,84,.8)'; ctx.lineWidth = .4;
            for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 1.6, -22); ctx.lineTo(-4 + i * 1.6, -14); ctx.stroke(); }
          });
        },
        back(ctx, pose) {
          // Karasu, wrapped like a mummy, strapped diagonally across the back
          ctx.save(); ctx.translate(-6.2, -9.6); ctx.rotate(-.42); ctx.scale(1.18, 1.1);
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(-3.6, -11); ctx.quadraticCurveTo(0, -13.6, 3.6, -11); ctx.lineTo(3.4, 13); ctx.quadraticCurveTo(0, 15, -3.4, 13); ctx.closePath(); }, WRAP, O, .9, () => {
            ctx.fillStyle = 'rgba(90,70,60,.3)'; ctx.fillRect(-4, -14, 2.6, 30);
            ctx.strokeStyle = 'rgba(120,104,84,.8)'; ctx.lineWidth = .42;
            for (let i = 0; i < 13; i++) { ctx.beginPath(); ctx.moveTo(-4, -11 + i * 2); ctx.lineTo(4, -12.4 + i * 2); ctx.stroke(); }
            ctx.fillStyle = '#5a4e44'; ctx.fillRect(-4, -3, 8, 1.3); ctx.fillRect(-4, 6, 8, 1.3);
          });
          ctx.restore();
        },
        head: {
          hair: hood, noHairShadow: true, blush: false,
          eyes: { type: 'normal', iris: '#5a3a2a' }, mouth: 'smirk', attackMouth: 'shout', browColor: '#3a2a22', browAngle: 'angry', browW: .8,
          band: { cloth: SUIT, plate: '#c9d1da', symbol: 'sand' },
          marks(ctx) {
            // purple kabuki paint: crown stripe down to the nose, a fork under each eye, lip and chin lines
            onFace(ctx, () => {
              ctx.fillStyle = PAINT; ctx.strokeStyle = PAINT; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
              ctx.beginPath(); ctx.moveTo(4.4, -3); ctx.lineTo(5.6, -3); ctx.lineTo(5.4, 1.6); ctx.lineTo(4.8, 1.6); ctx.closePath(); ctx.fill();
              ctx.lineWidth = .9;
              ctx.beginPath(); ctx.moveTo(.6, 4.8); ctx.lineTo(2.4, 6.8); ctx.lineTo(1.8, 9.6); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(3.6, 4.8); ctx.lineTo(3.2, 7.2); ctx.stroke();
              ctx.lineWidth = .7;
              ctx.beginPath(); ctx.moveTo(7.2, 4.6); ctx.lineTo(7.8, 6.2); ctx.moveTo(9.2, 4.4); ctx.lineTo(9.6, 5.8); ctx.stroke();
              ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(4.2, 7.4); ctx.quadraticCurveTo(6.6, 8.2, 8.8, 7.2); ctx.stroke();
              ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(5.4, 9); ctx.lineTo(5.8, 10.6); ctx.moveTo(7.2, 8.8); ctx.lineTo(7.4, 10.2); ctx.stroke();
            });
          }
        },
        front(ctx, pose, hand) {
          if (!(pose.attack || pose.seal)) return;
          // blue chakra threads streaming off the fingertips
          ctx.strokeStyle = 'rgba(120,200,255,.85)'; ctx.lineWidth = .35;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hand[0] + 1, hand[1] - .6 + i * .5); ctx.quadraticCurveTo(hand[0] + 7, hand[1] - 4 + i * 1.4, hand[0] + 13, hand[1] - 7 + i * 2.6); ctx.stroke(); }
          dot(ctx, hand[0] + 1.2, hand[1], 1.6, 'rgba(140,210,255,.4)');
        }
      };
    }

    // ---------------------------------------------------------------- Temari
    // Four short sandy ponytails, teal eyes, Suna plate, lavender dress with the red sash, mesh at the
    // elbows and knees, the giant iron fan strapped to her back (opened with its three moons on attack).
    function temariSpec() {
      const O = '#1c1420', SKIN = '#f6dcc6', HC = '#e6c46a', DRESS = '#b8a6d8', SASH = '#c2323a', FAN = '#3a3036', FAN_P = '#7a3aa0';
      const tuft = (ctx, spec, x, y, a, len) => {
        // one short ponytail: three pointed locks from a tie
        for (const [da, l, w] of [[-.32, .8, 1.5], [.3, .86, 1.5], [0, 1, 1.8]]) {
          const an = a + da, x1 = x + Math.cos(an) * len * l, y1 = y + Math.sin(an) * len * l;
          paint(ctx, () => { const nx = -Math.sin(an) * w, ny = Math.cos(an) * w; ctx.beginPath(); ctx.moveTo(x - nx, y - ny); ctx.quadraticCurveTo((x + x1) / 2 - nx * .9, (y + y1) / 2 - ny * .9 - 1, x1, y1); ctx.quadraticCurveTo((x + x1) / 2 + nx * .9, (y + y1) / 2 + ny * .9, x + nx, y + ny); ctx.closePath(); }, HC, spec.outline, .75, () => {
            ctx.fillStyle = dark(HC, .28); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.lineTo(x + Math.sin(an) * w * 2, y - Math.cos(an) * w * 2 + 3); ctx.fill();
          });
        }
        paint(ctx, () => ell(ctx, x, y, 1.6, 1.6), '#6a3a2c', spec.outline, .5);
      };
      // The war fan: origin at the grip, ribs along +x. open = 0..1.
      const fan = (ctx, x, y, rot, s, open) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
        if (open > 0) {
          const span = 1.25 * open, L = 30;
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, -span / 2, span / 2); ctx.closePath(); }, '#f1ebdc', O, .8, () => {
            ctx.fillStyle = 'rgba(90,70,90,.2)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L + 2, 0, span / 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(80,60,70,.55)'; ctx.lineWidth = .35;
            for (let i = 0; i <= 8; i++) { const an = -span / 2 + span * i / 8; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(Math.cos(an) * L, Math.sin(an) * L); ctx.stroke(); }
            // the three moons
            for (let i = 0; i < 3; i++) {
              const an = -span / 2 + span * (i + .5) / 3, d = L * .64;
              dot(ctx, Math.cos(an) * d, Math.sin(an) * d, 3.4 * open + .4, FAN_P);
              dot(ctx, Math.cos(an) * d - .8, Math.sin(an) * d - .8, 1.1 * open, 'rgba(255,255,255,.35)');
            }
          });
          ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, L, -span / 2, span / 2); ctx.stroke();
        } else {
          paint(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(30, -3.4); ctx.quadraticCurveTo(32.4, 0, 30, 3.4); ctx.lineTo(0, 2.2); ctx.closePath(); }, FAN, O, .85, () => {
            ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, -3, 31, 1);
            ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 1.2, 31, 2.4);
            ctx.fillStyle = '#c8b27a'; for (const bx of [6, 15, 24]) ctx.fillRect(bx, -3.4, 1.2, 6.8);
          });
        }
        paint(ctx, () => { ctx.beginPath(); ctx.rect(-3.6, -1.1, 4, 2.2); }, '#5a4430', O, .5);
        ctx.restore();
      };
      return {
        outline: O, skin: SKIN, skinShade: '#deae98', bulk: -.6, legK: 1.12,
        legs: { thigh: '#4d4560', shin: SKIN, foot: '#2e2638', w1: 4.8, w2: 3.9 },
        arms: {
          upper: DRESS, lower: SKIN, w1: 4.4, w2: 3.6, hand: SKIN,
          pattern(ctx, p0, p1, p2, far) {
            // mesh guard over the elbow
            const m = [p1[0] + (p2[0] - p1[0]) * .15, p1[1] + (p2[1] - p1[1]) * .15];
            ctx.fillStyle = far ? 'rgba(50,40,60,.5)' : 'rgba(60,50,70,.55)'; ell(ctx, m[0], m[1], 2.4, 2.4); ctx.fill();
            ctx.strokeStyle = 'rgba(200,190,210,.35)'; ctx.lineWidth = .2;
            ctx.beginPath(); ctx.moveTo(m[0] - 2, m[1] - 1); ctx.lineTo(m[0] + 2, m[1] + 1); ctx.moveTo(m[0] - 2, m[1] + 1); ctx.lineTo(m[0] + 2, m[1] - 1); ctx.stroke();
          }
        },
        torso: {
          base: DRESS, paint(ctx) {
            ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(.6, -13.2); ctx.lineTo(4, -8.6); ctx.lineTo(6.4, -13.2); ctx.fill();
            line(ctx, [[.6, -13.2], [4, -8.6], [6.4, -13.2]], dark(DRESS, .4), .5);
            // the red sash
            ctx.fillStyle = SASH; ctx.fillRect(-8, -4.8, 17, 3.4);
            ctx.fillStyle = light(SASH, .3); ctx.fillRect(-8, -4.6, 17, .6);
            ctx.fillStyle = dark(SASH, .3); ctx.fillRect(-8, -2, 17, .6);
          }
        },
        skirt: {
          color: DRESS, hem: 9.2, flare: .6, paint: (ctx, hem, hipY) => {
            ctx.strokeStyle = rgba(dark(DRESS, .4), .6); ctx.lineWidth = .35;
            for (const x of [-4, 1.4, 6]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.lineTo(x - .6, hem); ctx.stroke(); }
            ctx.fillStyle = dark(DRESS, .3); ctx.fillRect(-20, hem - 1, 40, 1.2);
          }
        },
        back(ctx, pose) {
          if (pose && pose.attack) return;
          fan(ctx, -10.6, 3.4, -1.36, 1, 0);
        },
        head: {
          back(ctx, spec) {
            tuft(ctx, spec, -8.4, -9.4, -2.3, 9);
            tuft(ctx, spec, -10.8, 6.6, 2.5, 8.4);
          },
          hair: HAIR.smooth(HC, { nape: 5.4, bangs: [[9.4, 1.4, 5.4], [-.4, 1.6, 6.2]] }),
          ear(ctx, spec) {
            tuft(ctx, spec, -6.4, -11.2, -1.9, 8);
            tuft(ctx, spec, -11.6, .6, 3.0, 8.4);
          },
          eyes: { type: 'normal', iris: '#2f8f7e', fem: true }, mouth: 'smirk', attackMouth: 'shout', browColor: '#b8963e', browW: .62, browAngle: 'angry',
          band: { cloth: '#2c2a36', plate: '#c9d1da', symbol: 'sand' },
          front(ctx, spec) {
            locks(ctx, spec, HC, [[-1, -8.4, -2.4, 3.6, 1.5, -.6], [9.6, -7.2, 10.8, 1.8, 1.2, .5], [2.4, -8.8, 2.6, -4.6, 1.1, 0], [6, -8.6, 6.6, -4.6, 1.1, .2]], .8);
          }
        },
        front(ctx, pose, hand) {
          if (pose.attack) fan(ctx, hand[0], hand[1], -.55, .9, 1);
        }
      };
    }

    // ---------------------------------------------------------------- Zabuza
    // Bare muscled chest with the sword harness, bandages over the lower face, no brows, the Mist plate
    // worn sideways, striped arm warmers, camo trousers, Kubikiribōchō on his back (in hand on attack).
    function zabuzaSpec() {
      const O = '#10141a', SKIN = '#e8cdb8', SH = '#c8a08e', PANTS = '#6d7480', WRAP = '#e6e0d2', STRAP = '#4a3a2e';
      // Kubikiribōchō: origin at the grip, blade along +x. A huge rectangular cleaver with a round hole
      // near the tip and a half-moon notch in the spine by the hilt.
      const cleaver = (ctx, x, y, rot, s) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
        line(ctx, [[-6, 0], [1, 0]], O, 2.6); line(ctx, [[-5.8, 0], [.8, 0]], '#2a2a32', 1.7);
        ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = .35;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-5.2 + i * 1.3, -.8); ctx.lineTo(-4.6 + i * 1.3, .8); ctx.stroke(); }
        const blade = () => {
          ctx.beginPath(); ctx.moveTo(1, -3); ctx.lineTo(3.2, -3);
          ctx.arc(5.6, -3, 2.4, Math.PI, 0, true); ctx.lineTo(33, -3); ctx.quadraticCurveTo(35, -3, 35, -1);
          ctx.lineTo(35, 6.6); ctx.lineTo(1, 6.6); ctx.closePath();
          ctx.moveTo(30.4, -.2); ctx.arc(28.4, -.2, 2, 0, TAU, true);
        };
        paint(ctx, blade, '#aeb6c0', O, .8, () => {
          ctx.fillStyle = 'rgba(40,50,70,.3)'; ctx.fillRect(0, 2.6, 36, 4.4);
          ctx.fillStyle = 'rgba(235,245,255,.85)'; ctx.fillRect(1, 5.4, 34, 1.1);
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(9, -2.8, 20, .7);
          ctx.fillStyle = 'rgba(80,90,110,.3)'; ctx.fillRect(1, -3, 2.4, 9.6);
        });
        ctx.restore();
      };
      return {
        outline: O, skin: SKIN, skinShade: SH, bulk: 1.2, legK: 1.14,
        legs: { thigh: PANTS, shin: PANTS, foot: '#2a2c34', wrap: WRAP, w1: 6, w2: 4.8 },
        arms: {
          upper: SKIN, lower: SKIN, bare: true, w1: 5.6, w2: 5, hand: SKIN, guard: '#8e939c',
          pattern(ctx, p0, p1, p2, far) {
            // the striped warmers: dark bands across the guard
            ctx.strokeStyle = far ? 'rgba(30,34,44,.7)' : 'rgba(40,44,56,.75)'; ctx.lineWidth = .7;
            for (const t of [.3, .45, .6, .75]) {
              const q = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t], dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1;
              const nx = -dy / L * 3, ny = dx / L * 3;
              ctx.beginPath(); ctx.moveTo(q[0] - nx, q[1] - ny); ctx.lineTo(q[0] + nx, q[1] + ny); ctx.stroke();
            }
          }
        },
        torso: {
          base: SKIN, paint(ctx) {
            // pecs, abs, a cel shade under the chest and the diagonal sword harness
            ctx.fillStyle = SH; ctx.beginPath(); ctx.moveTo(-6, -7.6); ctx.quadraticCurveTo(-1, -6.4, 2.6, -8); ctx.quadraticCurveTo(6, -6.4, 8, -7.8); ctx.lineTo(8, -6.6); ctx.quadraticCurveTo(4, -5.6, 2.6, -6.8); ctx.quadraticCurveTo(-1, -5.2, -6, -6.4); ctx.fill();
            ctx.strokeStyle = rgba(dark(SH, .2), .8); ctx.lineWidth = .4;
            ctx.beginPath(); ctx.moveTo(2.8, -12.4); ctx.lineTo(2.8, -.6); ctx.stroke();
            for (const y of [-4.6, -2.4]) { ctx.beginPath(); ctx.moveTo(.4, y); ctx.lineTo(5.4, y - .2); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,240,230,.3)'; ell(ctx, 4.6, -10, 2.6, 1.4, -.2); ctx.fill();
            ctx.fillStyle = STRAP; ctx.beginPath(); ctx.moveTo(-6.2, -12.8); ctx.lineTo(-3.4, -13.2); ctx.lineTo(7.6, -2.2); ctx.lineTo(6.6, .2); ctx.fill();
            ctx.fillStyle = light(STRAP, .25); ctx.beginPath(); ctx.moveTo(-5.4, -12.9); ctx.lineTo(-4.6, -13); ctx.lineTo(7.2, -1.8); ctx.lineTo(6.8, -1.2); ctx.fill();
            dot(ctx, 1.4, -7.4, .9, '#9a9aa4');
            // belt
            ctx.fillStyle = '#3c3a44'; ctx.fillRect(-7, -1.6, 15, 2.2);
            ctx.fillStyle = '#5e5c68'; ctx.fillRect(-7, -1.6, 15, .5);
          }
        },
        back(ctx, pose) {
          if (pose && pose.attack) return;
          cleaver(ctx, 6.6, -24, 1.95, .95);
        },
        head: {
          hair: HAIR.spiky('#1c1b22', { count: 7, len: .7, tips: [5, 6, 6.5, 6.5, 6, 5.5, 4.5] }),
          eyes: { type: 'normal', iris: '#3a3a40' }, browColor: null, brows: false, blush: false,
          band: { cloth: '#2c3240', plate: '#c9d1da', symbol: 'mist' },
          mask(ctx) {
            // bandages wound from under the eyes over the nose, mouth and jaw down into the neck
            ctx.save(); headPath(ctx); ctx.clip();
            const top = () => { ctx.moveTo(-10, 3.6); ctx.lineTo(-3, 4.4); ctx.quadraticCurveTo(2, 5.6, 6.4, 5.2); ctx.quadraticCurveTo(9, 4.8, 9.6, 3.8); ctx.quadraticCurveTo(10.8, 4.2, 11.4, 5.6); };
            ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath();
            ctx.fillStyle = WRAP; ctx.fill();
            ctx.save(); ctx.clip();
            ctx.fillStyle = 'rgba(110,96,80,.35)'; ctx.beginPath(); ctx.moveTo(-11, 3); ctx.quadraticCurveTo(-2, 6, -2.6, 14); ctx.lineTo(-11, 14); ctx.fill();
            ctx.strokeStyle = 'rgba(120,104,84,.75)'; ctx.lineWidth = .4;
            for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10, 5 + i * 1.6); ctx.quadraticCurveTo(2, 4.4 + i * 1.8, 12, 6.4 + i * 1.3); ctx.stroke(); }
            ctx.restore();
            ctx.beginPath(); top(); ctx.strokeStyle = O; ctx.lineWidth = .8; ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.beginPath(); top(); ctx.lineTo(12, 14); ctx.lineTo(-11, 14); ctx.closePath(); ctx.clip();
            headPath(ctx); ctx.strokeStyle = O; ctx.lineWidth = 1.15; ctx.stroke();
            ctx.restore();
          },
          marks(ctx) {
            // heavy lower lids, no brows: the demon's stare
            line(ctx, [[.2, 3.6], [4.4, 4.2]], 'rgba(120,70,70,.5)', .4);
            line(ctx, [[1, -1.6], [4, -1.2]], 'rgba(60,40,40,.45)', .5);
            line(ctx, [[6.6, -1.4], [9.2, -1.6]], 'rgba(60,40,40,.45)', .45);
          }
        },
        front(ctx, pose, hand) {
          if (pose.attack) cleaver(ctx, hand[0], hand[1], -1.0, 1.05);
        }
      };
    }

    // ---------------------------------------------------------------- Haku
    // Long dark hair loose down the back with a small bun and cream hair cloth, soft brown eyes, the
    // Kiri hunter-nin mask tied at the side of the head, dark-green kimono top with the light trim,
    // obi, a short checked over-skirt, senbon fanned between the fingers on attack.
    function hakuSpec() {
      const O = '#141018', SKIN = '#f4dccb', HC = '#1e1a24', KIMONO = '#3f6e52', TRIM = '#e8e4d2', OBI = '#2a3a34';
      return {
        outline: O, skin: SKIN, skinShade: '#dcb0a2', bulk: -.7, legK: 1.12,
        legs: { thigh: '#5e5648', shin: '#5e5648', foot: '#2a2622', wrap: '#d8d0c0', w1: 4.8, w2: 4 },
        arms: { upper: KIMONO, lower: KIMONO, w1: 4.6, w2: 4.4, cuff: TRIM, hand: SKIN },
        torso: {
          base: KIMONO, paint(ctx) {
            // crossed collar with the light trim, a pale under-layer at the neck, the obi
            ctx.fillStyle = TRIM; ctx.beginPath(); ctx.moveTo(-.4, -13.4); ctx.lineTo(1.4, -13.4); ctx.lineTo(5, -6.6); ctx.lineTo(4, -5.4); ctx.fill();
            ctx.beginPath(); ctx.moveTo(7.2, -13.2); ctx.lineTo(5.6, -13.4); ctx.lineTo(3.2, -8.6); ctx.lineTo(4.2, -7.4); ctx.fill();
            ctx.fillStyle = '#cfd8cf'; ctx.beginPath(); ctx.moveTo(1.4, -13.4); ctx.lineTo(5.6, -13.4); ctx.lineTo(3.8, -9.6); ctx.fill();
            ctx.strokeStyle = 'rgba(30,50,40,.5)'; ctx.lineWidth = .35;
            ctx.beginPath(); ctx.moveTo(-2, -10); ctx.quadraticCurveTo(-3.4, -6, -2.6, -4.6); ctx.stroke();
            ctx.fillStyle = OBI; ctx.fillRect(-8, -4.6, 17, 3.2);
            ctx.fillStyle = '#5a7a6a'; ctx.fillRect(-8, -3.4, 17, .6);
          }
        },
        skirt: {
          color: KIMONO, hem: 10.4, flare: .7, paint: (ctx, hem, hipY) => {
            // checked white band along the hem
            for (let x = -12, i = 0; x < 12; x += 1.6, i++) { ctx.fillStyle = i % 2 ? TRIM : '#2c4c3a'; ctx.fillRect(x, hem - 2.6 + (i % 2 ? 0 : 1.2), 1.6, 1.2); ctx.fillStyle = i % 2 ? '#2c4c3a' : TRIM; ctx.fillRect(x, hem - 1.4 + (i % 2 ? 0 : -1.2), 1.6, 1.2); }
            ctx.strokeStyle = rgba(dark(KIMONO, .4), .6); ctx.lineWidth = .35;
            for (const x of [-4, 2]) { ctx.beginPath(); ctx.moveTo(x, hipY + 1); ctx.lineTo(x - .8, hem - 2.6); ctx.stroke(); }
          }
        },
        head: {
          drape(ctx, spec) {
            // long straight hair down the back
            paint(ctx, () => smooth(ctx, [[-2.4, -6], [-9.6, -2], [-13.4, 10], [-13.2, 24], [-10.4, 31], [-6.4, 26], [-4.6, 16], [-3.6, 6]]), HC, spec.outline, .95, () => {
              ctx.fillStyle = dark(HC, .3); ctx.fillRect(-16, 8, 8, 26);
              ctx.strokeStyle = 'rgba(120,110,150,.45)'; ctx.lineWidth = .5;
              for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 - i * 2, 0); ctx.quadraticCurveTo(-10 - i * 1.4, 12, -9 - i * 1.4, 27); ctx.stroke(); }
            });
          },
          back(ctx, spec) {
            // the bun with its cream hair cloth on the crown-back
            paint(ctx, () => ell(ctx, -6.6, -10.4, 4.4, 3.8, -.5), TRIM, spec.outline, .85, () => {
              ctx.fillStyle = 'rgba(120,110,90,.35)'; ell(ctx, -7.6, -9.4, 3.4, 2.6, -.5); ctx.fill();
              ctx.strokeStyle = 'rgba(120,110,90,.7)'; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(-10, -11.6); ctx.quadraticCurveTo(-6.6, -8.6, -3, -12.6); ctx.stroke();
            });
            paint(ctx, () => poly(ctx, [[-9.6, -8.6], [-13.8, -4.2], [-12.8, -3.4], [-8.6, -7.6]]), TRIM, spec.outline, .6);
          },
          hair: HAIR.smooth(HC, { nape: 9.2, bangs: [[9.8, 1.6, 7.4], [-.8, 1.8, 9.6]] }),
          eyes: { type: 'normal', iris: '#5a3a30', fem: true }, mouth: 'neutral', attackMouth: 'frown', browColor: '#2a2430', browW: .55, browAngle: 'sad',
          marks(ctx, spec) {
            // the hunter-nin mask tied at the side of the head: white, eye slits, red flicks, the Mist mark
            ctx.save(); ctx.translate(-6.4, -1.6); ctx.rotate(-.25);
            paint(ctx, () => ell(ctx, 0, 0, 3.4, 4.8), '#f4f2ec', spec.outline, .6, () => {
              ctx.fillStyle = 'rgba(150,160,180,.35)'; ell(ctx, -1.4, .8, 2.2, 4); ctx.fill();
            });
            line(ctx, [[-1.6, -.4], [-.4, -.2]], '#202028', .5); line(ctx, [[.6, -.2], [1.8, -.4]], '#202028', .5);
            line(ctx, [[-1.8, 1.2], [-1.2, 2.6]], '#c8303a', .45); line(ctx, [[1.8, 1.2], [1.2, 2.6]], '#c8303a', .45);
            plateSymbol(ctx, 'mist', 0, -2.8, .5, '#5a6a8a');
            ctx.restore();
          },
          front(ctx, spec) {
            fringeShadow(ctx, [[-3, -6], [10.6, -5.4], [10.6, -2], [4, -2.6], [-3, -2]]);
            // long side locks framing the face, a soft centre part
            locks(ctx, spec, HC, [[-1, -8.6, -2.6, 10.4, 1.9, -.6], [10.2, -7, 11, 7.4, 1.4, .6], [2.4, -9, 1.6, -3.4, 1.3, -.2], [5.6, -8.8, 6, -4, 1.2, .1], [8.2, -8.2, 9, -3.8, 1.1, .3]], .8);
          }
        },
        front(ctx, pose, hand) {
          if (!pose.attack && !pose.seal) return;
          // three senbon fanned between the fingers
          for (let i = -1; i <= 1; i++) {
            const a = -.35 + i * .28, x1 = hand[0] + Math.cos(a) * 9, y1 = hand[1] + Math.sin(a) * 9;
            line(ctx, [[hand[0] + .6, hand[1] + i * .5], [x1, y1]], O, .9); line(ctx, [[hand[0] + .6, hand[1] + i * .5], [x1, y1]], '#e8f4ff', .42);
          }
        }
      };
    }

    const reg = (id, spec, meta, cu) => { try { AS.addSprite(id, spec, meta, cu); } catch (e) { /* sprite stays the fallback */ } };
    reg('kankuro', kankuroSpec(), { scale: 1.3, box: [-42, -94, 40, 8] }, { hair: '#24222d', fringe: 'hood', accent: '#a070d0' });
    reg('temari', temariSpec(), { scale: 1.24, box: [-44, -90, 40, 8] }, { hair: '#e6c46a', fringe: 'part', accent: '#e8d070' });
    reg('zabuza', zabuzaSpec(), { scale: 1.42, box: [-44, -90, 46, 8] }, { hair: '#1c1b22', fringe: 'spiky', accent: '#8ab0c8', mask: '#e6e0d2' });
    reg('haku', hakuSpec(), { scale: 1.22, box: [-42, -86, 38, 8] }, { hair: '#1e1a24', fringe: 'part', accent: '#a8e0ff', long: true });
  }

  // =================================================================================== BOSSES
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const frac = v => v - Math.floor(v);
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeBack = t => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const R = v => Math.round(v);
  const R1 = v => Math.round(v * 10) / 10;
  const R2 = v => Math.round(v * 100) / 100;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const Kit = () => window.VFXKit;
  const Spr = () => window.AnimeSprites;
  const HEIGHT = z => { const S = Spr(); return S && S.has && S.has(z.bossId) ? S.height(z.bossId) : 88; };

  const order = ['kankuro', 'temari', 'zabuza', 'haku'];
  const members = {
    kankuro: {
      name: 'KANKURŌ — KHÔI LỖI SƯ', short: 'KANKURŌ', accent: '#b98ae8', hpScale: 3.1, damageScale: 1.8, armor: .94,
      moves: ['karasu', 'poison', 'kuroari', 'sanshouo', 'sasori', 'maiden', 'karasu', 'sasori', 'kuroari', 'poison', 'sanshouo', 'maiden']
    },
    temari: {
      name: 'TEMARI — PHONG ĐỘN LÀNG CÁT', short: 'TEMARI', accent: '#f0d878', hpScale: 3.1, damageScale: 1.8, armor: .95,
      moves: ['cut', 'gust', 'kamatari', 'dust', 'whirl', 'blade', 'gust', 'cut', 'whirl', 'kamatari', 'dust', 'blade']
    },
    zabuza: {
      name: 'ZABUZA — QUỶ NHÂN SƯƠNG MÙ', short: 'ZABUZA', accent: '#9cc4dc', hpScale: 3.4, damageScale: 1.9, armor: .9,
      moves: ['mist', 'dragon', 'prison', 'clones', 'throw', 'fall', 'dragon', 'throw', 'clones', 'mist', 'prison', 'fall']
    },
    haku: {
      name: 'HAKU — BĂNG ĐỘN HUYẾT KẾ', short: 'HAKU', accent: '#b4e8ff', hpScale: 3.0, damageScale: 1.8, armor: .95,
      moves: ['senbon', 'needles', 'swallow', 'spikes', 'step', 'mirrors', 'swallow', 'senbon', 'step', 'spikes', 'needles', 'mirrors']
    }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    karasu:   { label: 'KHÔI LỖI · KARASU LIÊN TRẢM', rgb: '200,160,255', windup: .8, after: 1.1 },
    poison:   { label: 'KARASU · ĐỘC VỤ ĐỘC CHÂM', rgb: '205,120,255', windup: .85, after: 1.1 },
    kuroari:  { label: 'KHÔI LỖI · HẮC NGHĨ BẮT GIỮ', rgb: '190,170,240', windup: .9, after: 1.1 },
    sanshouo: { label: 'KHÔI LỖI · SƠN TIÊU NGƯ', rgb: '150,205,255', windup: .7, after: 1.0 },
    sasori:   { label: 'KHÔI LỖI · XÍCH SA HẠT', rgb: '255,150,110', windup: 1.0, after: 1.2 },
    maiden:   { label: 'HẮC BÍ KỸ · THIẾT NỮ', rgb: '215,135,255', windup: 1.3, after: 2.0 },
    cut:      { label: 'PHONG ĐỘN · LIÊM DỨU', rgb: '215,250,240', windup: .8, after: 1.0 },
    gust:     { label: 'PHONG ĐỘN · ĐẠI LIÊM DỨU', rgb: '205,245,235', windup: .9, after: 1.1 },
    kamatari: { label: 'KHẨU GIÁ · KAMATARI', rgb: '235,240,205', windup: .8, after: 1.1 },
    dust:     { label: 'PHONG ĐỘN · TRẦN VÂN', rgb: '240,215,160', windup: .85, after: 1.0 },
    whirl:    { label: 'PHONG ĐỘN · THIẾT TOÀN PHONG', rgb: '210,250,240', windup: .9, after: 1.1 },
    blade:    { label: 'KHẨU GIÁ · THIẾT THIẾT VŨ', rgb: '225,255,245', windup: 1.4, after: 2.0 },
    mist:     { label: 'ẨN VỤ · VÔ THANH SÁT NHÂN', rgb: '215,232,242', windup: .7, after: 1.0 },
    dragon:   { label: 'THỦY ĐỘN · THỦY LONG ĐẠN', rgb: '120,200,255', windup: 1.0, after: 1.1 },
    prison:   { label: 'THỦY ĐỘN · THỦY LAO THUẬT', rgb: '130,210,255', windup: .9, after: 1.0 },
    clones:   { label: 'THỦY ĐỘN · THỦY PHÂN THÂN', rgb: '140,210,255', windup: .8, after: 1.1 },
    throw:    { label: 'TRẢM THỦ ĐẠI ĐAO · PHI TRẢM', rgb: '225,235,250', windup: .75, after: 1.0 },
    fall:     { label: 'THỦY ĐỘN · ĐẠI BỘC BỐ', rgb: '110,190,255', windup: 1.4, after: 2.0 },
    senbon:   { label: 'THIÊN BẢN · BĂNG CHÂM LIÊN XẠ', rgb: '205,240,255', windup: .55, after: .9 },
    needles:  { label: 'BĂNG ĐỘN · THIÊN SÁT THỦY TƯỜNG', rgb: '170,230,255', windup: .9, after: 1.0 },
    swallow:  { label: 'BĂNG ĐỘN · YẾN XUY TUYẾT', rgb: '190,240,255', windup: .85, after: 1.0 },
    spikes:   { label: 'BĂNG ĐỘN · BĂNG THỨ TRẬN', rgb: '170,225,255', windup: .85, after: 1.1 },
    step:     { label: 'BĂNG KÍNH · THUẤN THÂN', rgb: '200,245,255', windup: .6, after: 1.0 },
    mirrors:  { label: 'BĂNG ĐỘN · MA KÍNH BĂNG TINH', rgb: '180,235,255', windup: 1.3, after: 2.1 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;
  // Manual control (team mode): each member's jutsu in key order 1..n, ultimate last.
  const MANUAL = {}, MOVE_LISTS = {};
  for (const id in members) {
    MANUAL[id] = [...new Set(members[id].moves)];
    MOVE_LISTS[id] = MANUAL[id].map(k => ({ id: k, label: MOVES[k].label }));
  }
  function moves(z) { return (z && MOVE_LISTS[z.bossId]) || []; }
  // While the user drives the boss, api.player is a cursor point: grabs take the nearest hostile unit instead.
  const victim = (api, x, y, r) => { const p = api.player; return p && p.pseudo ? (api.nearestFoe ? api.nearestFoe(x, y, r) : null) : p; };

  const MAIDEN_R = 300, CUT_L = 1100, CUT_SPD = 1500, GUST_L = 740, GUST_HALF = .55, GUST_SPD = 1100, DUST_R = 320;
  const BLADE_L = 1050, BLADE_R = 210, MIST_R = 680, DRAGON_L = 900, PRISON_R = 160, FALL_R = 440;
  const NEEDLE_R = 210, MIRROR_R = 270, MIRROR_N = 14, SPIKE_SPD = 1100;

  function pick(level) { return order[(level | 0) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;
  const faceOf = a => Math.cos(a) >= 0 ? 1 : -1;
  function inCone(p, x, y, a, len, half) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > len + (p.r || 12)) return false;
    if (d < 40) return true;
    return Math.abs(angDiff(Math.atan2(p.y - y, p.x - x), a)) <= half;
  }
  function reach(api, x, y, a, len, r) {
    const c = Math.cos(a), s = Math.sin(a);
    while (len > 40 && api.blocked(x + c * len, y + s * len, r)) len -= 30;
    return len;
  }

  function prewarm(id) {
    if (!Kit()) return;
    try {
      if (id === 'kankuro') { karasuSpr(); }
      else if (id === 'temari') { fanSpr(); kamaSpr(); }
      else if (id === 'zabuza') { mistSpr(); dragonHeadSpr(); cleaverSpr(); waterBall(); }
      else { mirrorSpr(); mirrorSheen(); swallowSpr(); for (let i = 0; i < 3; i++) iceSpr(i); }
    } catch (e) { /* cosmetic */ }
  }
  function state(z) {
    if (!z.sk) prewarm(z.bossId);
    return z.sk || (z.sk = { t: 0, casts: 0, timer: 1.3, move: '', windup: 0, windMax: 1, aim: 0, tx: R(z.x), ty: R(z.y),
      tele: [], plan: null, ev: [], fx: [], ghosts: [], hold: 0, holdMove: '', hide: 0, show: 0, guard: 0, pin: 0, patches: [], lastDraw: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (fx.seed == null) fx.seed = R(Math.random() * 99);
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, h, a) => st.ev.push({ t, h, a: a || {} });
  const dmg = (api, m) => (api.damage != null ? api.damage : 60) * m;
  const hitAt = (st, t, x, y, r, m, k, loud) => later(st, t, 's', { x: R(x), y: R(y), r: R(r), m, k, loud: loud ? 1 : 0 });
  const worldAt = (st, t, x, y, r, m, k, a) => later(st, t, 'w', { x: R(x), y: R(y), r, m, k, a: R2(a || 0) });
  // kind 0 = Kankurō's poison cloud, 1 = Haku's frost.
  function addPatch(st, x, y, r, life, kind) {
    if (st.patches.length >= 10) st.patches.shift();
    st.patches.push({ x: R(x), y: R(y), r: R(r), life, max: life, k: 0, kind, seed: R(Math.random() * 99) });
  }
  function ghost(st, z, f, m) { if (st.ghosts.length < 14) st.ghosts.push({ x: R(z.x), y: R(z.y), f, age: 0, m: m || 0 }); }
  // Pull a ninja toward (x, y) without a shove. Teammates' ninjas live in their own browsers and are left alone.
  function drag(api, p, x, y, sp, dt) {
    if (!p || p.remote || p.pseudo) return;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const m = Math.min(d, sp * dt), mx = dx / d * m, my = dy / d * m, r = p.r || 12;
    if (!api.blocked(p.x + mx, p.y, r)) p.x += mx;
    if (!api.blocked(p.x, p.y + my, r)) p.y += my;
  }
  // Needle flights (senbon, darts): n = [x0, y0, angle, t0 (fx age), max range, swept distance].
  function needleAdd(list, x0, y0, a, t0, max) { if (list.length < 44) list.push([R(x0), R(y0), R2(a), R2(t0), R(max), 0]); }
  function needleStep(api, fx, list, spd, m) {
    for (const n of list) {
      if (fx.age < n[3] || n[5] >= n[4]) continue;
      const nd = Math.min(n[4], (fx.age - n[3]) * spd);
      if (nd - n[5] < 46 && nd < n[4]) continue;
      const c = Math.cos(n[2]), s = Math.sin(n[2]);
      api.line(n[0] + c * n[5], n[1] + s * n[5], n[0] + c * nd, n[1] + s * nd, 14, dmg(api, m), null);
      n[5] = R(nd);
    }
  }

  // ------------------------------------------------------------------ events
  const EV = {
    s(z, st, api, a) { api.strike(a.x, a.y, a.r, dmg(api, a.m), a.loud ? '#ffffff' : null, a.k || null, !a.loud); },
    w(z, st, api, a) { api.world(a.x, a.y, a.r, dmg(api, a.m), a.k || 'crater', a.a || 0); },
    sh(z, st, api, a) { api.shake(a.n); },
    patch(z, st, api, a) { addPatch(st, a.x, a.y, a.r, a.life, a.kind); },
    // Zabuza in the mist: mark a cut beside the target, then appear and swing
    zamb(z, st, api, a) {
      const p = api.player;
      if (!p || z.health <= 0) return;
      const base = Math.atan2(p.y - z.y, p.x - z.x) + (a.i % 2 ? -1 : 1) * (1 + Math.random() * .7);
      let sx = p.x - Math.cos(base) * 118, sy = p.y - Math.sin(base) * 118, b = base;
      if (api.blocked(sx, sy, (z.r || 30) + 2)) { b = Math.atan2(p.y - z.y, p.x - z.x); sx = p.x - Math.cos(b) * 118; sy = p.y - Math.sin(b) * 118; }
      addFx(st, { kind: 'zmark', x: R(sx), y: R(sy), a: R2(b), dur: .62 });
      later(st, .56, 'zcut', { x: R(sx), y: R(sy), a: R2(b), last: a.last ? 1 : 0 });
    },
    zcut(z, st, api, a) {
      if (z.health <= 0) return;
      const r = (z.r || 30) + 2;
      ghost(st, z, faceOf(a.a), 1);
      if (!api.blocked(a.x, a.y, r)) { z.x = a.x; z.y = a.y; }
      const cx = z.x + Math.cos(a.a) * 105, cy = z.y + Math.sin(a.a) * 105;
      api.strike(cx, cy, 165, dmg(api, 2.1), null, a.last ? 'blade' : null, true);
      if (a.last) api.world(cx, cy, 130, dmg(api, 2), 'blade', a.a);
      addFx(st, { kind: 'zswing', x: R(z.x), y: R(z.y), a: a.a, big: 0, dur: .7 });
      st.show = .5; api.shake(12);
      if (a.last) { st.hide = 0; addFx(st, { kind: 'zreveal', x: R(z.x), y: R(z.y), dur: 1 }); }
    }
  };

  // ------------------------------------------------------------------ jutsu selection
  const circ = (x, y, r, faint, small) => ({ k: 'c', x: R(x), y: R(y), r, faint: faint ? 1 : 0, small: small ? 1 : 0 });
  const lineT = (x, y, a, len, w, faint) => ({ k: 'line', x: R(x), y: R(y), a: R2(a), len: R(len), w, faint: faint ? 1 : 0 });
  function teleFor(z, st, move, api) {
    const x = z.x, y = z.y, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), tx = st.tx, ty = st.ty, d = Math.hypot(tx - x, ty - y);
    st.plan = null;
    switch (move) {
      case 'karasu': return [lineT(x, y, a, Math.min(800, d + 120), 40, true), circ(tx, ty, 170)];
      case 'poison': return [circ(tx, ty, 250), circ(tx, ty, 140, true)];
      case 'kuroari': return [circ(tx, ty, 165), lineT(x, y, a, d, 16, true)];
      case 'sanshouo': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: 600, half: .42 }, circ(x, y, 240, true)];
      case 'sasori': {
        const len = R(reach(api, x, y, a, Math.min(760, d + 160), 24));
        st.plan = { len };
        return [lineT(x, y, a, len, 95), { k: 'cone', x: R(x + ca * len), y: R(y + sa * len), a: R2(a), len: 470, half: .34, faint: 1 }];
      }
      case 'maiden': {
        const L = [circ(tx, ty, MAIDEN_R), circ(tx, ty, 150, true)];
        for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + .2; L.push(lineT(tx + Math.cos(an) * MAIDEN_R, ty + Math.sin(an) * MAIDEN_R, an + Math.PI, MAIDEN_R - 40, 16, true)); }
        return L;
      }
      case 'cut': return [-.2, 0, .2].map(o => lineT(x, y, a + o, CUT_L, 36, o !== 0));
      case 'gust': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: GUST_L, half: GUST_HALF }];
      case 'kamatari': return [circ(tx, ty, 260, true), circ(tx, ty, 200)];
      case 'dust': return [circ(tx, ty, DUST_R), circ(tx, ty, DUST_R * .5, true)];
      case 'whirl': {
        const tw = [a - .45, a, a + .45].map(R2);
        st.plan = { tw };
        return tw.map(t => lineT(x, y, t, 720, 70, t !== tw[1]));
      }
      case 'blade': return [lineT(x, y, a, BLADE_L + 130, BLADE_R, false), circ(x + ca * (BLADE_L + 130), y + sa * (BLADE_L + 130), 360, true)];
      case 'mist': return [{ k: 'c', follow: 1, r: MIST_R, faint: 1 }];
      case 'dragon': {
        const L = Math.min(DRAGON_L, d + 60), nx = -sa, ny = ca, side = Math.random() < .5 ? 1 : -1, back = d < 380 ? 240 : 0;
        // up close the dragon rises behind Zabuza and arcs over him onto the target
        st.plan = { ex: R(x + ca * L), ey: R(y + sa * L), sx: R(x + nx * side * 70 - ca * back), sy: R(y + ny * side * 70 - sa * back), w: R2(side * (.6 + Math.random() * .4)) };
        return [lineT(x, y, a, L, 70), circ(st.plan.ex, st.plan.ey, 230)];
      }
      case 'prison': return [circ(tx, ty, PRISON_R), circ(tx, ty, PRISON_R * .55, true)];
      case 'clones': {
        const b = Math.random() * TAU, cl = [];
        for (let i = 0; i < 3; i++) {
          const an = b + i * TAU / 3;
          let cx = tx + Math.cos(an) * 250, cy = ty + Math.sin(an) * 250;
          if (api.blocked(cx, cy, 24)) { cx = tx + Math.cos(an) * 150; cy = ty + Math.sin(an) * 150; }
          cl.push([R(cx), R(cy)]);
        }
        st.plan = { cl };
        return [circ(tx, ty, 300, true)].concat(cl.map(c => circ(c[0], c[1], 70, true, true)), cl.map(c => lineT(c[0], c[1], Math.atan2(ty - c[1], tx - c[0]), 400, 30, true)));
      }
      case 'throw': {
        const len = Math.min(900, d + 250);
        st.plan = { len: R(len) };
        return [lineT(x, y, a, len, 60)];
      }
      case 'fall': return [circ(tx, ty, FALL_R), circ(tx, ty, 200, true)];
      case 'senbon': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: 820, half: .33 }];
      case 'needles': return [circ(tx, ty, NEEDLE_R), circ(tx, ty, 120, true)];
      case 'swallow': return [{ k: 'cone', x: R(x), y: R(y), a: R2(a), len: 380, half: 1.1, faint: 1 }, circ(tx, ty, 180)];
      case 'spikes': {
        const lanes = [-.3, 0, .3].map(o => ({ a: R2(a + o), len: R(760 * (o ? .88 : 1)) }));
        st.plan = { lanes };
        return lanes.map(l => lineT(x, y, l.a, l.len, 48));
      }
      case 'step': {
        const side = Math.random() < .5 ? 1 : -1;
        let mx = tx - sa * side * 150, my = ty + ca * side * 150;
        if (api.blocked(mx, my, 30)) { mx = tx - ca * 150; my = ty - sa * 150; }
        st.plan = { m: { x: R(mx), y: R(my) } };
        return [circ(mx, my, 150, true), circ(tx, ty, 190), lineT(mx, my, Math.atan2(ty - my, tx - mx), 540, 60, true)];
      }
      case 'mirrors': {
        const L = [circ(tx, ty, MIRROR_R + 30)];
        for (let i = 0; i < MIRROR_N; i++) { const an = i * TAU / MIRROR_N; L.push(circ(tx + Math.cos(an) * MIRROR_R, ty + Math.sin(an) * MIRROR_R, 24, true, true)); }
        return L;
      }
    }
    return [];
  }

  function announce(z, st, m, api, forced) {
    const move = forced || m.moves[st.casts % m.moves.length];
    if (!forced) st.casts++;
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = R2(aimAt(z, p)); st.tx = R(p ? p.x : z.x); st.ty = R(p ? p.y : z.y);
    st.tele = teleFor(z, st, move, api);
  }

  // ------------------------------------------------------------------ casting
  function cast(z, st, m, api) {
    const move = st.move, a = st.aim, ca = Math.cos(a), sa = Math.sin(a), plan = st.plan || {};
    const x = z.x, y = z.y, f = faceOf(a);
    switch (move) {
      // ============ Kankurō
      case 'karasu': {
        const d = Math.hypot(st.tx - x, st.ty - y), back = Math.min(140, d * .5);
        addFx(st, { kind: 'karasu', x0: R(x - f * 10), y0: R(y), ax: R(st.tx - ca * back), ay: R(st.ty - sa * back), px: R(x), py: R(y), tx: st.tx, ty: st.ty, f, i: 0, ln: null, cut: null, fan: 0, n: [], dur: 3.7 });
        st.hold = .9; st.holdMove = 'karasu'; api.shake(5);
        break;
      }
      case 'poison': {
        addFx(st, { kind: 'poison', x0: R(x), y0: R(y), tx: st.tx, ty: st.ty, px: R(x), py: R(y), f, gas: 0, dur: 3.0 });
        for (const t of [.62, 1.0, 1.38]) hitAt(st, t, st.tx, st.ty, 250, .75, null);
        st.hold = .75; st.holdMove = 'poison';
        break;
      }
      case 'kuroari': {
        addFx(st, { kind: 'kuroari', x0: R(x + f * 10), y0: R(y), x: st.tx, y: st.ty, caught: 0, k: 0, land: 0, stab: 0, gas: 0, dur: 3.1 });
        st.hold = 1.0; st.holdMove = 'kuroari'; api.shake(5);
        break;
      }
      case 'sanshouo': {
        addFx(st, { kind: 'sansho', x: R(x + ca * 58), y: R(y + sa * 58), a, v: 0, n: [], snap: 0, dur: 3.3 });
        st.guard = 3.0; st.hold = 2.8; st.pin = 2.8; st.holdMove = 'sanshouo';
        api.shake(6);
        break;
      }
      case 'sasori': {
        const len = plan.len || 600;
        addFx(st, { kind: 'sasori', x0: R(x + ca * 50), y0: R(y + sa * 50), a, len, px: R(x + ca * 50), py: R(y + sa * 50), k: 0, fa: a, fl: 0, fw: 0, dur: 3.4 });
        st.hold = 1.0; st.holdMove = 'sasori';
        break;
      }
      case 'maiden': {
        addFx(st, { kind: 'maiden', x: st.tx, y: st.ty, caught: 0, k: 0, s: 0, land: 0, dive: 0, boom: 0, dur: 3.9 });
        st.hold = 2.7; st.pin = 2.7; st.holdMove = 'maiden';
        api.shake(10);
        break;
      }
      // ============ Temari
      case 'cut': {
        addFx(st, { kind: 'cut', x: R(x + ca * 30), y: R(y + sa * 30), bl: [-.2, 0, .2].map(o => [R2(a + o), 0]), w: 0, dur: 1.5 });
        st.hold = .55; st.holdMove = 'cut'; api.shake(9);
        break;
      }
      case 'gust': {
        addFx(st, { kind: 'gust', x: R(x), y: R(y), a, dur: 1.6 });
        for (let d = 140; d <= GUST_L; d += 150) for (let j = -1; j <= 1; j++) {
          const an = a + j * GUST_HALF * .62;
          hitAt(st, d / GUST_SPD, x + Math.cos(an) * d, y + Math.sin(an) * d, 70 + d * .1, .9, null);
        }
        worldAt(st, 450 / GUST_SPD, x + ca * 450, y + sa * 450, 150, 2, 'shockwave', a);
        st.hold = .7; st.holdMove = 'gust'; api.shake(11);
        break;
      }
      case 'kamatari': {
        const nx = -sa, ny = ca;
        addFx(st, { kind: 'kama', px: R(x + nx * f * 50), py: R(y + ny * f * 50), sx: R(x + nx * f * 50), sy: R(y + ny * f * 50), tx: st.tx, ty: st.ty, f, i: 0, ln: null, cut: null, spin: 0, dur: 3.5 });
        st.hold = .8; st.holdMove = 'kamatari'; api.shake(5);
        break;
      }
      case 'dust': {
        addFx(st, { kind: 'dust', x: st.tx, y: st.ty, k: .3, dur: 4.2 });
        st.hold = .8; st.holdMove = 'dust'; api.shake(6);
        break;
      }
      case 'whirl': {
        const tw = (plan.tw || [a - .45, a, a + .45]).map(t => [R1(x + Math.cos(t) * 50), R1(y + Math.sin(t) * 50), R2(t), 0]);
        addFx(st, { kind: 'whirl', tw, k: 0, dur: 2.9 });
        st.hold = .8; st.holdMove = 'whirl'; api.shake(7);
        break;
      }
      case 'blade': {
        addFx(st, { kind: 'blade', x0: R(x + ca * 130), y0: R(y + sa * 130), a, len: BLADE_L, px: R(x + ca * 130), py: R(y + sa * 130), k: 0, wd: 0, boom: 0, dur: 4.1 });
        st.hold = 3.1; st.pin = 3.1; st.holdMove = 'blade'; api.shake(12);
        break;
      }
      // ============ Zabuza
      case 'mist': {
        addFx(st, { kind: 'zmist', x: R(x), y: R(y), dur: 5.4 });
        st.hide = 4.2;
        later(st, .95, 'zamb', { i: 0 }); later(st, 2.35, 'zamb', { i: 1, last: 1 });
        st.hold = 3.6; st.holdMove = 'mist';
        break;
      }
      case 'dragon': {
        const pl = plan.ex != null ? plan : { ex: R(x + ca * 600), ey: R(y + sa * 600), sx: R(x), sy: R(y), w: .8 };
        addFx(st, { kind: 'wdragon', x0: pl.sx, y0: pl.sy, ex: pl.ex, ey: pl.ey, w: pl.w, k: 0, hit: 0, dur: 2.4 });
        st.hold = 1.15; st.holdMove = 'dragon'; api.shake(8);
        break;
      }
      case 'prison': {
        const px = st.tx - ca * 95, py = st.ty - sa * 95;
        if (!api.blocked(px, py, (z.r || 30) + 2)) { ghost(st, z, f, 1); z.x = px; z.y = py; }
        addFx(st, { kind: 'zprison', x: st.tx, y: st.ty, zx: R(z.x), zy: R(z.y), caught: 0, k: 0, tk: 0, c: 0, pop: 0, dur: 3.4 });
        st.hold = 2.6; st.pin = 2.6; st.holdMove = 'prison'; api.shake(6);
        break;
      }
      case 'clones': {
        const cl = (plan.cl || [[R(x + 200), R(y)]]).map((c, i) => [c[0], c[1], R2(.1 + i * .38), 0, 0, 0, 0, 0]);
        addFx(st, { kind: 'zclones', cl, dur: 2.9 });
        st.hold = .8; st.holdMove = 'clones';
        break;
      }
      case 'throw': {
        addFx(st, { kind: 'zthrow', x0: R(x), y0: R(y), a, len: plan.len || 600, bx: R(x), by: R(y), k: 0, w: 0, dur: 1.45 });
        st.hold = 1.3; st.holdMove = 'throw'; api.shake(6);
        break;
      }
      case 'fall': {
        addFx(st, { kind: 'zfall', x: st.tx, y: st.ty, sx: R(x), sy: R(y), k: 0, w: 0, cut: 0, cx: 0, cy: 0, ca: 0, dur: 4.2 });
        st.hold = 3.0; st.pin = 2.3; st.holdMove = 'fall'; api.shake(14);
        break;
      }
      // ============ Haku
      case 'senbon': {
        const fx = addFx(st, { kind: 'ndl', st: 1, spd: 1500, m: .45, n: [], dur: 1.7 });
        for (let v = 0; v < 3; v++) for (let i = 0; i < 7; i++) needleAdd(fx.n, x + ca * 20, y + sa * 20, a + (i - 3) * .09 + (v - 1) * .045, v * .22, 820);
        st.hold = .7; st.holdMove = 'senbon';
        break;
      }
      case 'needles': {
        addFx(st, { kind: 'tneedle', x: st.tx, y: st.ty, hit: 0, dur: 1.6 });
        st.hold = .6; st.holdMove = 'needles';
        break;
      }
      case 'swallow': {
        const sw = [];
        for (let i = 0; i < 8; i++) { const an = a + (i - 3.5) * .3; sw.push([R1(x + Math.cos(an) * 30), R1(y + Math.sin(an) * 30), R2(an), 0, R2(i * .05)]); }
        addFx(st, { kind: 'swal', sw, dur: 2.5 });
        st.hold = .6; st.holdMove = 'swallow';
        break;
      }
      case 'spikes': {
        const lanes = plan.lanes || [{ a, len: 760 }];
        lanes.forEach((l, li) => {
          const c = Math.cos(l.a), s = Math.sin(l.a);
          for (let d = 80; d <= l.len; d += 95) hitAt(st, d / SPIKE_SPD, x + c * d, y + s * d, 62, 1.05, null);
          const te = l.len / SPIKE_SPD + .05, ex = x + c * (l.len + 30), ey = y + s * (l.len + 30);
          hitAt(st, te, ex, ey, 125, 1.5, 'earth');
          if (li === 1) worldAt(st, te, ex, ey, 120, 2.2, 'earth', l.a);
          later(st, te, 'patch', { x: R(ex), y: R(ey), r: 110, life: 3, kind: 1 });
          later(st, te, 'sh', { n: 8 });
        });
        addFx(st, { kind: 'ispk', x: R(x), y: R(y), lanes, dur: 2.8 });
        st.hold = .8; st.holdMove = 'spikes';
        break;
      }
      case 'step': {
        const mm = plan.m || { x: R(st.tx - ca * 150), y: R(st.ty - sa * 150) };
        addFx(st, { kind: 'step', ax: R(x), ay: R(y), mx: mm.x, my: mm.y, ph: 0, n: [], dur: 1.7 });
        st.hold = 1.0; st.holdMove = 'step';
        break;
      }
      case 'mirrors': {
        addFx(st, { kind: 'mirrors', x: st.tx, y: st.ty, b: 0, fl: [], n: [], end: 0, zx: R(x), zy: R(y), dur: 4.9 });
        st.hold = 4.1; st.pin = 4.0; st.holdMove = 'mirrors'; api.shake(10);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ per-effect updates
  // Slash passes shared by Karasu and Kamatari: plan a lane through the target, then cut through it.
  function lanePass(fx, api, ts, dash, n, w, m) {
    const p = api.player;
    if (!fx.ln && fx.age >= ts - .3) {
      const tx = p ? p.x : fx.tx, ty = p ? p.y : fx.ty, dd = Math.hypot(tx - fx.px, ty - fx.py);
      const an = dd > 20 ? Math.atan2(ty - fx.py, tx - fx.px) : fx.i * 2.1, L = Math.max(280, Math.min(620, dd + 200));
      fx.ln = [fx.px, fx.py, R(fx.px + Math.cos(an) * L), R(fx.py + Math.sin(an) * L), R2(an)];
      fx.f = Math.cos(an) >= 0 ? 1 : -1;
    }
    if (fx.ln && fx.age >= ts) {
      const k = clamp01((fx.age - ts) / dash), l = fx.ln;
      fx.px = R(lerp(l[0], l[2], easeOut(k))); fx.py = R(lerp(l[1], l[3], easeOut(k)));
      if (k >= 1) {
        api.line(l[0], l[1], l[2], l[3], w, dmg(api, m), fx.i === n - 1 ? 'blade' : null);
        fx.cut = l.concat([R2(fx.age)]); fx.i++; fx.ln = null; api.shake(7);
      }
    }
  }
  const FXU = {
    karasu(z, st, fx, dt, api) {
      const p = api.player;
      if (fx.age < .4) { const k = easeOut(fx.age / .4); fx.px = R(lerp(fx.x0, fx.ax, k)); fx.py = R(lerp(fx.y0, fx.ay, k)); return; }
      if (fx.i < 3) { lanePass(fx, api, .55 + fx.i * .55, .14, 3, 50, 1.3); return; }
      const tf = 2.3;
      if (!fx.fan && fx.age >= tf) {
        fx.fan = 1;
        const tx = p ? p.x : fx.tx, ty = p ? p.y : fx.ty, an = Math.atan2(ty - fx.py, tx - fx.px);
        fx.f = Math.cos(an) >= 0 ? 1 : -1;
        for (let i = 0; i < 7; i++) needleAdd(fx.n, fx.px, fx.py, an + (i - 3) * .12, fx.age, 640);
      }
      if (fx.fan) needleStep(api, fx, fx.n, 1300, .55);
      if (fx.age > tf + .6) { const k = clamp01((fx.age - tf - .6) / .5); fx.px = R(lerp(fx.px, z.x, k)); fx.py = R(lerp(fx.py, z.y, k)); }
    },
    poison(z, st, fx, dt, api) {
      if (fx.age < .45) { const k = easeOut(fx.age / .45); fx.px = R(lerp(fx.x0, fx.tx, k)); fx.py = R(lerp(fx.y0, fx.ty, k)); return; }
      if (!fx.gas && fx.age >= 1.55) {
        fx.gas = 1;
        api.strike(fx.tx, fx.ty, 210, dmg(api, .95), null, null, true);
        addPatch(st, fx.tx, fx.ty, 210, 4.2, 0);
        api.shake(8);
      }
      if (fx.age > 2.2) { const k = clamp01((fx.age - 2.2) / .6); fx.px = R(lerp(fx.px, z.x, k)); fx.py = R(lerp(fx.py, z.y, k)); }
    },
    kuroari(z, st, fx, dt, api) {
      if (fx.age < .45) return;
      if (!fx.land) { fx.land = 1; api.strike(fx.x, fx.y, 165, dmg(api, 1.1), null, null, true); api.shake(9); }
      if (fx.age >= .6 && fx.age < 1.75) {
        const v = victim(api, fx.x, fx.y, 190);
        if (v && !fx.caught && fx.age < 1.0 && Math.hypot(v.x - fx.x, v.y - fx.y) < 175 + (v.r || 12) * .5) fx.caught = 1;
        if (fx.caught && v) {
          drag(api, v, fx.x, fx.y, 900, dt);
          if ((fx.k -= dt) <= 0) { fx.k = .4; api.strike(fx.x, fx.y, 90, dmg(api, .34), null, null, true); }
        }
      }
      if (!fx.stab && fx.age >= 1.75) { fx.stab = 1; api.strike(fx.x, fx.y, 135, dmg(api, 1.75), null, 'blade', true); api.shake(11); }
      if (!fx.gas && fx.age >= 2.05) { fx.gas = 1; api.strike(fx.x, fx.y, 215, dmg(api, 1.0), null, null, true); addPatch(st, fx.x, fx.y, 170, 3.2, 0); }
    },
    sansho(z, st, fx, dt, api) {
      const p = api.player;
      while (fx.v < 3 && fx.age >= .5 + fx.v * .6) {
        const ox = fx.x + Math.cos(fx.a) * 26, oy = fx.y + Math.sin(fx.a) * 26;
        const an = p ? Math.atan2(p.y - oy, p.x - ox) : fx.a, aa = Math.abs(angDiff(an, fx.a)) < 1 ? an : fx.a;
        for (let i = 0; i < 5; i++) needleAdd(fx.n, ox, oy, aa + (i - 2) * .14, fx.age, 640);
        fx.v++; api.shake(4);
      }
      needleStep(api, fx, fx.n, 1150, .5);
      if (!fx.snap && fx.age >= 2.6) { fx.snap = 1; api.knockback(z, 240, 180, dmg(api, 1.1)); api.shake(10); }
    },
    sasori(z, st, fx, dt, api) {
      if (fx.age < .25) return;
      const c = Math.cos(fx.a), s = Math.sin(fx.a);
      if (fx.age < 1.45) {
        const k = easeInOut((fx.age - .25) / 1.2);
        fx.px = R(fx.x0 + c * fx.len * k); fx.py = R(fx.y0 + s * fx.len * k);
        if ((fx.k -= dt) <= 0) { fx.k = .12; api.strike(fx.px, fx.py, 120, dmg(api, .55), null, null, true); }
        if (!fx.fw && k > .5) { fx.fw = 1; api.world(fx.px, fx.py, 120, dmg(api, 2), 'blade', fx.a); }
        return;
      }
      const p = api.player;
      if (!fx.fl && fx.age >= 1.55) { fx.fl = 1; fx.fa = R2(p ? Math.atan2(p.y - fx.py, p.x - fx.px) : fx.a); fx.k = 0; }
      if (fx.fl && fx.age < 2.65) {
        if ((fx.k -= dt) <= 0) {
          fx.k = .2;
          for (const d of [110, 240, 370]) api.strike(fx.px + Math.cos(fx.fa) * d, fx.py + Math.sin(fx.fa) * d, 60 + d * .18, dmg(api, .48), null, null, true);
        }
        if (fx.fl === 1 && fx.age >= 2.0) { fx.fl = 2; api.world(fx.px + Math.cos(fx.fa) * 300, fx.py + Math.sin(fx.fa) * 300, 140, dmg(api, 2), 'fire', fx.fa); api.shake(8); }
      }
    },
    maiden(z, st, fx, dt, api) {
      if (fx.age >= .35 && !fx.land) {
        fx.land = 1;
        api.strike(fx.x, fx.y, MAIDEN_R, dmg(api, 1.3), null, 'crater', true);
        api.world(fx.x, fx.y, 190, dmg(api, 2), 'crater');
        api.shake(16);
      }
      if (fx.age >= .4 && fx.age < 2.45) {
        const v = victim(api, fx.x, fx.y, MAIDEN_R + 20);
        if (v && !fx.caught && fx.age < .75 && Math.hypot(v.x - fx.x, v.y - fx.y) < MAIDEN_R + (v.r || 12)) fx.caught = 1;
        if (fx.caught && v) {
          drag(api, v, fx.x, fx.y, 1300, dt);
          if ((fx.k -= dt) <= 0) { fx.k = .4; api.strike(fx.x, fx.y, 100, dmg(api, .35), null, null, true); }
        }
      }
      while (fx.s < 8 && fx.age >= .9 + fx.s * .13) {
        const an = fx.s * TAU / 8 + .2, rx = fx.x + Math.cos(an) * (MAIDEN_R - 40), ry = fx.y + Math.sin(an) * (MAIDEN_R - 40);
        api.line(rx, ry, fx.x, fx.y, 34, dmg(api, .7), null);
        fx.s++; api.shake(5);
      }
      if (!fx.dive && fx.age >= 2.1) { fx.dive = 1; api.strike(fx.x, fx.y, 170, dmg(api, 2.4), null, 'blade', true); api.shake(14); }
      if (!fx.boom && fx.age >= 2.5) {
        fx.boom = 1;
        api.strike(fx.x, fx.y, 400, dmg(api, 2.2), '#d9a8ff', 'crater');
        api.world(fx.x, fx.y, 260, dmg(api, 3), 'crater');
        addPatch(st, fx.x, fx.y, 280, 4, 0);
        api.shake(22);
      }
    },
    cut(z, st, fx, dt, api) {
      const front = Math.min(CUT_L, fx.age * CUT_SPD);
      for (const b of fx.bl) {
        if (b[1] >= CUT_L || (front - b[1] < 60 && front < CUT_L)) continue;
        const c = Math.cos(b[0]), s = Math.sin(b[0]);
        api.line(fx.x + c * b[1], fx.y + s * b[1], fx.x + c * front, fx.y + s * front, 38, dmg(api, 1.5), null);
        b[1] = R(front);
      }
      const mid = fx.bl[1];
      if (fx.w < 2 && front >= 480 + fx.w * 520) {
        const d = 480 + fx.w * 520;
        api.world(fx.x + Math.cos(mid[0]) * d, fx.y + Math.sin(mid[0]) * d, 130, dmg(api, 2.2), 'blade', mid[0]);
        fx.w++;
      }
    },
    gust(z, st, fx, dt, api) {
      if (fx.age > GUST_L / GUST_SPD + .1) return;
      const front = fx.age * GUST_SPD, v = victim(api, fx.x, fx.y, GUST_L);
      if (!v || !inCone(v, fx.x, fx.y, fx.a, front + 40, GUST_HALF)) return;
      const d = Math.hypot(v.x - fx.x, v.y - fx.y);
      if (d < front - 160) return;
      const an = Math.atan2(v.y - fx.y, v.x - fx.x);
      drag(api, v, v.x + Math.cos(an) * 200, v.y + Math.sin(an) * 200, 720, dt);
    },
    kama(z, st, fx, dt, api) {
      if (fx.i < 4) { if (fx.age >= .2) lanePass(fx, api, .5 + fx.i * .5, .13, 4, 56, 1.15); return; }
      if (!fx.spin && fx.age >= 2.55) {
        const p = api.player;
        fx.spin = 1; fx.tx = R(p ? p.x : fx.px); fx.ty = R(p ? p.y : fx.py); fx.st = R2(fx.age);
        api.strike(fx.tx, fx.ty, 200, dmg(api, 1.4), null, 'vortex', true);
        api.shake(10);
      }
    },
    dust(z, st, fx, dt, api) {
      if (fx.age < .3 || fx.age > 3.7) return;
      const v = victim(api, fx.x, fx.y, DUST_R + 20);
      if (v && Math.hypot(v.x - fx.x, v.y - fx.y) < DUST_R) drag(api, v, fx.x, fx.y, 70, dt);
      if ((fx.k -= dt) <= 0) { fx.k = .45; api.strike(fx.x, fx.y, DUST_R, dmg(api, .45), null, null, true); }
    },
    whirl(z, st, fx, dt, api) {
      const p = api.player;
      if (fx.age < 2.2) {
        const tick = (fx.k -= dt) <= 0;
        if (tick) fx.k = .2;
        for (const t of fx.tw) {
          if (t[3]) continue;
          if (p) t[2] = R2(t[2] + Math.max(-.9 * dt, Math.min(.9 * dt, angDiff(Math.atan2(p.y - t[1], p.x - t[0]), t[2]))));
          t[0] = R1(t[0] + Math.cos(t[2]) * 330 * dt); t[1] = R1(t[1] + Math.sin(t[2]) * 330 * dt);
          if (tick) api.strike(t[0], t[1], 82, dmg(api, .42), null, null, true);
          const v = victim(api, t[0], t[1], 110);
          if (v && Math.hypot(v.x - t[0], v.y - t[1]) < 110) drag(api, v, t[0], t[1], 220, dt);
        }
      } else if (!fx.burst) {
        fx.burst = 1;
        fx.tw.forEach((t, i) => {
          api.strike(t[0], t[1], 150, dmg(api, 1.0), null, i === 1 ? 'vortex' : null, true);
          if (i === 1) api.world(t[0], t[1], 130, dmg(api, 2), 'vortex');
        });
        api.shake(10);
      }
    },
    blade(z, st, fx, dt, api) {
      const c = Math.cos(fx.a), s = Math.sin(fx.a);
      if (fx.age < 3.0) {
        const u = easeInOut((fx.age - .5) / 2.5);
        fx.px = R(fx.x0 + c * fx.len * u); fx.py = R(fx.y0 + s * fx.len * u);
        if ((fx.k -= dt) <= 0) { fx.k = .12; api.strike(fx.px, fx.py, fx.age < .5 ? 140 : BLADE_R, dmg(api, .42), null, null, true); }
        if (fx.age >= .5) {
          const v = victim(api, fx.px, fx.py, 330);
          if (v && Math.hypot(v.x - fx.px, v.y - fx.py) < 330) drag(api, v, fx.px, fx.py, 260, dt);
          if (fx.wd < 5 && u * fx.len >= fx.wd * 210 + 100) { api.world(fx.px, fx.py, 170, dmg(api, 2.4), 'vortex', fx.a); fx.wd++; api.shake(9); }
        }
      } else if (!fx.boom) {
        fx.boom = 1;
        api.strike(fx.px, fx.py, 360, dmg(api, 2.6), '#ffffff', 'crater');
        api.world(fx.px, fx.py, 260, dmg(api, 3), 'vortex');
        api.shake(20);
      }
    },
    wdragon(z, st, fx, dt, api) {
      if (fx.age < .25 || fx.hit) return;
      const u = clamp01((fx.age - .25) / .85);
      if ((fx.k -= dt) <= 0) { fx.k = .08; const q = dragonPos(fx, u); api.strike(q[0], q[1], 85, dmg(api, .5), null, null, true); }
      if (u >= 1) {
        fx.hit = 1;
        api.strike(fx.ex, fx.ey, 230, dmg(api, 2.2), '#bfe8ff', 'vortex');
        api.world(fx.ex, fx.ey, 180, dmg(api, 2.2), 'vortex');
        api.shake(14);
      }
    },
    zprison(z, st, fx, dt, api) {
      if (fx.age < .3) return;
      if (fx.age < 2.6) {
        while (fx.c < 2 && fx.age >= 1.0 + fx.c * .8) { fx.c++; api.strike(fx.x, fx.y, 190, dmg(api, 1.0), null, 'blade', true); api.shake(8); }
        if ((fx.k -= dt) > 0) return;
        fx.k = .25;
        const v = victim(api, fx.x, fx.y, PRISON_R + 20);
        if (!v) return;
        if (Math.hypot(v.x - fx.x, v.y - fx.y) < PRISON_R + 20) {
          fx.caught = 1;
          drag(api, v, fx.x, fx.y, 1600, .25);
          if (++fx.tk % 2 === 0) api.strike(fx.x, fx.y, PRISON_R + 20, dmg(api, .36), null, null, true);
        }
      } else if (!fx.pop) {
        fx.pop = 1;
        api.strike(fx.x, fx.y, 230, dmg(api, 1.5), null, 'shockwave', true);
        api.shake(12);
      }
    },
    zclones(z, st, fx, dt, api) {
      const p = api.player;
      fx.cl.forEach((c, i) => {
        const t = fx.age - c[2];
        if (c[3] === 0 && t >= .3) {
          const tx = p ? p.x : c[0] + 200, ty = p ? p.y : c[1], an = Math.atan2(ty - c[1], tx - c[0]), L = Math.min(620, Math.hypot(tx - c[0], ty - c[1]) + 170);
          c[4] = R(c[0] + Math.cos(an) * L); c[5] = R(c[1] + Math.sin(an) * L); c[6] = R2(an); c[3] = 1;
        }
        if (c[3] === 1 && t >= .62) {
          c[3] = 2; c[7] = R2(fx.age);
          api.line(c[0], c[1], c[4], c[5], 58, dmg(api, 1.25), i === 2 ? 'blade' : null);
          api.shake(8);
        }
      });
    },
    zthrow(z, st, fx, dt, api) {
      const t = fx.age, c = Math.cos(fx.a), s = Math.sin(fx.a);
      if (t < .55) { const u = easeOut(t / .55); fx.bx = R(fx.x0 + c * fx.len * u); fx.by = R(fx.y0 + s * fx.len * u); }
      else if (t < .7) { fx.bx = R(fx.x0 + c * fx.len); fx.by = R(fx.y0 + s * fx.len); if (!fx.w) { fx.w = 1; api.world(fx.bx, fx.by, 110, dmg(api, 2), 'blade', fx.a); } }
      else { const u = easeIn((t - .7) / .55), ex = fx.x0 + c * fx.len, ey = fx.y0 + s * fx.len; fx.bx = R(lerp(ex, z.x, u)); fx.by = R(lerp(ey, z.y, u)); }
      if (t < 1.25 && (fx.k -= dt) <= 0) { fx.k = .07; api.strike(fx.bx, fx.by, 78, dmg(api, .6), null, null, true); }
    },
    zfall(z, st, fx, dt, api) {
      if (fx.age >= .6 && fx.age < 2.6) {
        if ((fx.k -= dt) <= 0) { fx.k = .25; api.strike(fx.x, fx.y, FALL_R, dmg(api, .42), null, null, true); }
        const v = victim(api, fx.x, fx.y, FALL_R);
        if (v && Math.hypot(v.x - fx.x, v.y - fx.y) < FALL_R) drag(api, v, fx.x, fx.y, 150, dt);
        while (fx.w < 3 && fx.age >= .8 + fx.w * .8) {
          const an = fx.w * 2.1 + fx.seed;
          api.world(fx.x + Math.cos(an) * 200, fx.y + Math.sin(an) * 200, 170, dmg(api, 2.2), 'vortex', an);
          fx.w++; api.shake(10);
        }
      }
      if (fx.age >= 2.25 && fx.age < 2.6) st.hide = Math.max(st.hide, .1);
      if (!fx.cut && fx.age >= 2.6) {
        fx.cut = 1;
        const v = victim(api, fx.x, fx.y, FALL_R + 200), px = v ? v.x : fx.x, py = v ? v.y : fx.y;
        const b = Math.atan2(py - z.y, px - z.x), sx = px + Math.cos(b) * 130, sy = py + Math.sin(b) * 130, back = b + Math.PI;
        ghost(st, z, faceOf(b), 1);
        if (!api.blocked(sx, sy, (z.r || 30) + 2)) { z.x = sx; z.y = sy; }
        const ex = z.x + Math.cos(back) * 700, ey = z.y + Math.sin(back) * 700;
        api.line(z.x, z.y, ex, ey, 72, dmg(api, 2.8), 'blade');
        api.strike(px, py, 200, dmg(api, 1.2), '#e6f6ff', 'crater');
        fx.cx = R(z.x); fx.cy = R(z.y); fx.ca = R2(back);
        addFx(st, { kind: 'zswing', x: R(z.x), y: R(z.y), a: R2(back), big: 1, dur: .9 });
        st.hide = 0; st.show = .6;
        api.shake(20);
      }
    },
    ndl(z, st, fx, dt, api) { needleStep(api, fx, fx.n, fx.spd, fx.m); },
    tneedle(z, st, fx, dt, api) {
      if (fx.hit || fx.age < .62) return;
      fx.hit = 1;
      api.strike(fx.x, fx.y, 120, dmg(api, 2.4), null, null, true);
      api.strike(fx.x, fx.y, NEEDLE_R + 10, dmg(api, .9), null, null, true);
      api.shake(10);
    },
    swal(z, st, fx, dt, api) {
      const p = api.player;
      for (const s of fx.sw) {
        if (s[3] || fx.age < s[4]) continue;
        if (p) s[2] = R2(s[2] + Math.max(-3.2 * dt, Math.min(3.2 * dt, angDiff(Math.atan2(p.y - s[1], p.x - s[0]), s[2]))));
        s[0] = R1(s[0] + Math.cos(s[2]) * 660 * dt); s[1] = R1(s[1] + Math.sin(s[2]) * 660 * dt);
        const near = p && Math.hypot(p.x - s[0], p.y - s[1]) < 44;
        if (near || fx.age - s[4] > 1.55 || api.blocked(s[0], s[1], 8)) {
          s[3] = R2(Math.max(.01, fx.age));
          api.strike(s[0], s[1], 78, dmg(api, .85), null, null, true);
        }
      }
    },
    step(z, st, fx, dt, api) {
      const p = api.player;
      if (fx.ph === 0 && fx.age >= .3) { fx.ph = 1; st.hide = .3; ghost(st, z, faceOf(Math.atan2(fx.my - z.y, fx.mx - z.x)), 1); }
      if (fx.ph === 1 && fx.age >= .45) {
        fx.ph = 2;
        if (!api.blocked(fx.mx, fx.my, (z.r || 30) + 2)) { z.x = fx.mx; z.y = fx.my; }
        st.hide = 0;
      }
      if (fx.ph === 2 && fx.age >= .55) {
        fx.ph = 3;
        const an = p ? Math.atan2(p.y - fx.my, p.x - fx.mx) : 0;
        for (let i = 0; i < 12; i++) needleAdd(fx.n, fx.mx, fx.my, an + (i - 5.5) * .12, fx.age, 540);
        api.shake(5);
      }
      if (fx.ph === 3 && fx.age >= 1.05) { fx.ph = 4; api.strike(fx.mx, fx.my, 150, dmg(api, 1.2), null, 'shockwave', true); api.shake(8); }
      needleStep(api, fx, fx.n, 1300, .5);
    },
    mirrors(z, st, fx, dt, api) {
      const cx = fx.x, cy = fx.y;
      if (fx.age >= .5 && fx.age < 3.95) st.hide = Math.max(st.hide, .1);
      if (fx.age >= .6 && fx.age < 3.95) {
        const v = victim(api, cx, cy, MIRROR_R + 60);
        if (v) { const d = Math.hypot(v.x - cx, v.y - cy); if (d < MIRROR_R + 60 && d > MIRROR_R - 45) drag(api, v, cx, cy, 420, dt); }
      }
      if (fx.n.length > 26) fx.n = fx.n.filter(n => fx.age - n[3] < n[4] / 1500 + .6);
      while (fx.b < 10 && fx.age >= .8 + fx.b * .3) {
        const p = api.player, px = p ? p.x : cx, py = p ? p.y : cy;
        let last = 0;
        for (let j = 0; j < 3; j++) {
          const mi = (Math.floor(hash(fx.b * 7.1 + j * 3.3 + fx.seed) * MIRROR_N) + j * 5) % MIRROR_N, an0 = mi * TAU / MIRROR_N;
          const mx = cx + Math.cos(an0) * MIRROR_R, my = cy + Math.sin(an0) * MIRROR_R, an = Math.atan2(py - my, px - mx);
          for (let k = -1; k <= 1; k++) needleAdd(fx.n, mx, my, an + k * .07, fx.age, MIRROR_R * 2 + 40);
          fx.fl.push([mi, R2(fx.age)]); if (fx.fl.length > 6) fx.fl.shift();
          last = mi;
        }
        // Haku really stands in the mirror he last threw from (his body can be hit there)
        const an0 = last * TAU / MIRROR_N, hx = cx + Math.cos(an0) * MIRROR_R, hy = cy + Math.sin(an0) * MIRROR_R;
        if (!api.blocked(hx, hy, (z.r || 30) + 2)) { z.x = R(hx); z.y = R(hy); }
        fx.b++; api.shake(4);
      }
      needleStep(api, fx, fx.n, 1500, .42);
      if (!fx.end && fx.age >= 3.95) {
        fx.end = 1;
        api.strike(cx, cy, MIRROR_R + 50, dmg(api, 2.4), '#e6faff', 'shockwave');
        api.world(cx, cy, 240, dmg(api, 2.5), 'shockwave');
        const an = Math.atan2(fx.zy - cy, fx.zx - cx), hx = cx + Math.cos(an) * MIRROR_R, hy = cy + Math.sin(an) * MIRROR_R;
        if (!api.blocked(hx, hy, (z.r || 30) + 2)) { z.x = R(hx); z.y = R(hy); }
        st.hide = 0;
        api.shake(18);
      }
    }
  };
  function dragonPos(fx, u) {
    const dx = fx.ex - fx.x0, dy = fx.ey - fx.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const k = easeIn(u) * .35 + u * .65, off = Math.sin(u * Math.PI * 2.2) * fx.w * 90 * (1 - u);
    return [fx.x0 + dx * k + nx * off, fx.y0 + dy * k + ny * off, 40 + bell(u) * 95 * (1 - u * .4)];
  }

  // ------------------------------------------------------------------ patches
  function patchUpdate(z, st, dt, api) {
    for (let i = st.patches.length - 1; i >= 0; i--) {
      const q = st.patches[i];
      q.life -= dt;
      if (q.life <= 0) { st.patches.splice(i, 1); continue; }
      if (q.max - q.life < .3 || z.health <= 0) continue;
      if ((q.k -= dt) <= 0) { q.k = .5; api.strike(q.x, q.y, q.r, dmg(api, q.kind ? .18 : .26), null, null, true); }
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
      const u = FXU[fx.kind];
      if (u && z.health > 0) u(z, st, fx, dt, api);
      if (fx.age >= fx.dur) st.fx.splice(i, 1);
    }
    for (let i = st.ghosts.length - 1; i >= 0; i--) if ((st.ghosts[i].age += dt) > .32) st.ghosts.splice(i, 1);
    if (st.patches.length) patchUpdate(z, st, dt, api);
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.ev.length = 0; st.hold = 0; st.hide = 0; st.pin = 0; z.manualBusy = false; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const e = st.ev[i];
      if ((e.t -= dt) <= 0) { st.ev.splice(i, 1); const h = EV[e.h]; if (h) h(z, st, api, e.a); }
    }
    st.hide = Math.max(0, st.hide - dt);
    st.show = Math.max(0, st.show - dt);
    st.guard = Math.max(0, st.guard - dt);
    st.pin = Math.max(0, st.pin - dt);
    z.armorScale = st.guard > 0 ? .4 : m.armor;
    st.hold = Math.max(0, st.hold - dt);
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .82 : 1);
        st.move = ''; st.tele = []; st.plan = null;
      }
    } else if (st.hold <= 0) {
      st.holdMove = '';
      if (z.manual) {
        // driven by the user: cast only what was asked for, aimed at the cursor
        const want = z.manualCast != null ? MANUAL[z.bossId][z.manualCast] : null;
        z.manualCast = null;
        if (want) announce(z, st, m, api, want);
      } else {
        st.timer -= dt;
        const p = api.player, d = p ? Math.hypot(z.x - p.x, z.y - p.y) : 9999;
        if (st.timer <= 0 && p && d < 950) announce(z, st, m, api);
      }
    }
    z.manualBusy = st.windup > 0 || st.hold > 0;
    z.kageDash = st.pin > 0 ? .05 : 0;
    z.bossWindup = st.windup > 0 ? st.windup : st.pin > 0 ? 0 : st.hold;
    z.speedScale = st.hide > 0 ? .45 : z.bossId === 'zabuza' ? .95 : .9;
    // The puppeteer, the fan user and the senbon thrower fight at range: they back off from a ninja who
    // closes in instead of trading blows (AI only; the user's WASD drives a controlled unit).
    const keep = KEEP[z.bossId], p = api.player;
    if (keep && p && !z.manual && !(st.pin > 0) && !(st.hide > 0)) {
      const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < keep) { z.speedScale = .05; api.move(dx / d * 165 * dt, dy / d * 165 * dt); }
      else if (d < keep + 90) z.speedScale = .15;
    }
  }
  const KEEP = { kankuro: 260, temari: 290, haku: 220 };

  // ================================================================== cached art
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // Karasu: the crow puppet. Ragged dark cloak, wooden mask face with three eyes and a hinged jaw,
  // a wild brown mane. Faces +x; origin bottom-centre (48, 104).
  function karasuSpr() {
    return Kit().sprite('sk:karasu', 96, 112, g => {
      const O = '#120e16';
      g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = O;
      // mane behind the head
      g.fillStyle = '#5a3c28'; g.lineWidth = 3;
      g.beginPath();
      const hx = 50, hy = 28;
      for (let i = 0; i <= 14; i++) {
        const an = Math.PI * .72 + i / 14 * Math.PI * 1.5, r = i % 2 ? 17 : 27 + (i % 4 === 0 ? 4 : 0);
        const px = hx - 4 + Math.cos(an) * r, py = hy + Math.sin(an) * r * .95;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,220,180,.18)'; g.beginPath(); g.ellipse(46, 12, 12, 5, -.3, 0, TAU); g.fill();
      // ragged cloak body
      g.fillStyle = '#3a2f46'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(36, 44); g.lineTo(62, 44); g.lineTo(73, 96); g.lineTo(65, 90); g.lineTo(59, 102); g.lineTo(51, 92); g.lineTo(43, 102); g.lineTo(37, 90); g.lineTo(25, 96); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.moveTo(36, 44); g.lineTo(46, 44); g.lineTo(40, 100); g.lineTo(25, 96); g.fill();
      g.strokeStyle = 'rgba(170,140,210,.28)'; g.lineWidth = 1.2;
      for (const x of [48, 56]) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 4, 92); g.stroke(); }
      // wooden collar
      g.strokeStyle = O; g.lineWidth = 2.4;
      g.fillStyle = '#8a6646'; rrect(g, 39, 42, 22, 9, 3); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,230,190,.35)'; g.fillRect(41, 43, 18, 2);
      // mask face
      g.fillStyle = '#cfc2ae'; rrect(g, 39, 14, 26, 27, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(80,60,50,.25)'; g.fillRect(40, 30, 24, 10);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(55, 18, 7, 2.4, -.2, 0, TAU); g.fill();
      // hinged jaw slit with teeth
      g.strokeStyle = O; g.lineWidth = 2;
      g.beginPath(); g.moveTo(41, 33); g.lineTo(65, 33); g.stroke();
      g.lineWidth = 1.2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(44 + i * 4.6, 31); g.lineTo(44 + i * 4.6, 35.5); g.stroke(); }
      g.beginPath(); g.moveTo(41, 33); g.lineTo(39, 37); g.moveTo(65, 33); g.lineTo(66, 37); g.stroke();
      // three eyes
      for (const [ex, ey, r] of [[47, 24, 3.2], [59, 24, 3.2], [53, 17.5, 2.6]]) {
        g.fillStyle = '#1a1018'; g.beginPath(); g.arc(ex, ey, r + 1.1, 0, TAU); g.fill();
        g.fillStyle = '#b8402c'; g.beginPath(); g.arc(ex, ey, r, 0, TAU); g.fill();
        g.fillStyle = '#ffe0a0'; g.beginPath(); g.arc(ex - .8, ey - .9, r * .35, 0, TAU); g.fill();
      }
      // joint seams on the cheeks
      g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(41, 22); g.lineTo(44, 28); g.moveTo(63, 22); g.lineTo(61, 28); g.stroke();
    });
  }
  // Temari's iron fan opened: three purple moons on cream paper. Pivot at (70, 128), opening upwards.
  function fanSpr() {
    return Kit().sprite('sk:fan', 140, 136, g => {
      const O = '#1c1420', cx = 70, cy = 128, L = 118, a0 = -Math.PI * .92, a1 = -Math.PI * .08;
      g.lineJoin = 'round';
      g.fillStyle = '#f2ecdc'; g.strokeStyle = O; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, L, a0, a1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(110,90,110,.18)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, L, (a0 + a1) / 2, a1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,70,80,.5)'; g.lineWidth = 1.4;
      for (let i = 1; i < 12; i++) { const an = a0 + (a1 - a0) * i / 12; g.beginPath(); g.moveTo(cx + Math.cos(an) * 14, cy + Math.sin(an) * 14); g.lineTo(cx + Math.cos(an) * L, cy + Math.sin(an) * L); g.stroke(); }
      for (let i = 0; i < 3; i++) {
        const an = a0 + (a1 - a0) * (i + .5) / 3, d = L * .66, mx = cx + Math.cos(an) * d, my = cy + Math.sin(an) * d;
        g.fillStyle = '#3a1450'; g.beginPath(); g.arc(mx, my, 15, 0, TAU); g.fill();
        g.fillStyle = '#7e3aa8'; g.beginPath(); g.arc(mx, my, 13, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(mx - 4, my - 4, 4.5, 0, TAU); g.fill();
      }
      g.strokeStyle = '#3a3036'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, L - 3, a0, a1); g.stroke();
      g.fillStyle = '#5a4430'; g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill(); g.stroke();
    });
  }
  // Kamatari: one-eyed white weasel with the giant sickle. Faces +x; origin (60, 62).
  function kamaSpr() {
    return Kit().sprite('sk:kama', 128, 84, g => {
      const O = '#1c1814';
      g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = O;
      // the sickle: long dark haft, huge silver crescent
      g.lineWidth = 6; g.beginPath(); g.moveTo(30, 70); g.lineTo(96, 18); g.stroke();
      g.strokeStyle = '#4a3828'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(30, 70); g.lineTo(96, 18); g.stroke();
      g.fillStyle = '#d8e2ea'; g.strokeStyle = O; g.lineWidth = 3;
      g.beginPath(); g.moveTo(94, 20); g.quadraticCurveTo(124, 22, 122, 56); g.quadraticCurveTo(112, 34, 90, 28); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(98, 22); g.quadraticCurveTo(118, 26, 119, 46); g.quadraticCurveTo(112, 32, 98, 25); g.fill();
      // tail
      g.fillStyle = '#eee6d6'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(26, 52); g.quadraticCurveTo(6, 40, 4, 22); g.quadraticCurveTo(16, 34, 30, 44); g.closePath(); g.fill(); g.stroke();
      // body
      g.fillStyle = '#f2ece0'; g.beginPath(); g.ellipse(48, 54, 26, 14, -.15, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#9a6a44'; g.beginPath(); g.ellipse(44, 46, 20, 6, -.15, Math.PI, TAU); g.fill();
      // legs
      g.fillStyle = '#e6dcc8'; for (const lx of [36, 58]) { g.beginPath(); g.ellipse(lx, 68, 5, 7, 0, 0, TAU); g.fill(); g.stroke(); }
      // head
      g.fillStyle = '#f4eee2'; g.beginPath(); g.ellipse(74, 40, 14, 11, -.2, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(84, 38); g.lineTo(96, 42); g.lineTo(84, 47); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#9a6a44'; g.beginPath(); g.moveTo(66, 30); g.lineTo(64, 20); g.lineTo(72, 28); g.closePath(); g.fill(); g.stroke();
      // one eye open, the other a scar
      g.fillStyle = '#1a1010'; g.beginPath(); g.arc(80, 38, 2.6, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(79.3, 37.2, .9, 0, TAU); g.fill();
      g.strokeStyle = '#7a3a30'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(70, 34); g.lineTo(74, 41); g.stroke();
      g.fillStyle = '#1a1010'; g.beginPath(); g.arc(95, 42, 1.6, 0, TAU); g.fill();
    });
  }
  function mistSpr() {
    return Kit().sprite('sk:mist', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(236,244,250,.95)'); gr.addColorStop(.5, 'rgba(220,234,244,.55)'); gr.addColorStop(1, 'rgba(210,228,240,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function poisonSpr() {
    return Kit().sprite('sk:poison', 96, 96, g => {
      const gr = g.createRadialGradient(40, 40, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(205,140,255,.9)'); gr.addColorStop(.45, 'rgba(140,60,190,.62)'); gr.addColorStop(.8, 'rgba(80,20,110,.25)'); gr.addColorStop(1, 'rgba(60,10,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function waterBall() {
    return Kit().sphere('sk:water', [[0, 'rgba(255,255,255,.55)'], [.35, 'rgba(170,230,255,.28)'], [.72, 'rgba(70,170,240,.36)'], [.9, 'rgba(200,240,255,.85)'], [.97, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']], .36, .3);
  }
  // Water dragon head facing +x, origin at the neck (34, 40).
  function dragonHeadSpr() {
    return Kit().sprite('sk:wdh', 120, 80, g => {
      const O = '#0a2a52';
      g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = O; g.lineWidth = 3.5;
      // horns swept back
      g.fillStyle = '#bfe8ff';
      g.beginPath(); g.moveTo(52, 26); g.quadraticCurveTo(30, 6, 8, 4); g.quadraticCurveTo(30, 14, 44, 32); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(50, 50); g.quadraticCurveTo(28, 66, 6, 70); g.quadraticCurveTo(28, 58, 42, 46); g.closePath(); g.fill(); g.stroke();
      // upper jaw / head
      const gr = g.createLinearGradient(0, 18, 0, 60); gr.addColorStop(0, '#a6e4ff'); gr.addColorStop(.5, '#3fa6ec'); gr.addColorStop(1, '#1c6cc4');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(30, 28); g.quadraticCurveTo(56, 14, 84, 22); g.quadraticCurveTo(108, 26, 116, 34); g.lineTo(84, 38); g.lineTo(64, 42); g.quadraticCurveTo(44, 48, 30, 48); g.closePath(); g.fill(); g.stroke();
      // lower jaw, open
      g.beginPath(); g.moveTo(40, 48); g.quadraticCurveTo(70, 50, 104, 58); g.quadraticCurveTo(84, 62, 62, 60); g.quadraticCurveTo(44, 58, 34, 52); g.closePath(); g.fill(); g.stroke();
      // mouth interior and fangs
      g.fillStyle = '#0c3a78'; g.beginPath(); g.moveTo(60, 42); g.lineTo(112, 36); g.lineTo(100, 56); g.quadraticCurveTo(76, 52, 60, 46); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) { const fx = 70 + i * 8; g.beginPath(); g.moveTo(fx, 39 - i * .6); g.lineTo(fx + 3, 46); g.lineTo(fx + 6, 38.6 - i * .6); g.fill(); g.beginPath(); g.moveTo(fx - 2, 55 + i * .5); g.lineTo(fx + 1, 49); g.lineTo(fx + 4, 55.5 + i * .5); g.fill(); }
      // brow ridge, eye, whisker
      g.fillStyle = '#ffe85a'; g.beginPath(); g.ellipse(66, 27, 5, 3, -.25, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#0a1a30'; g.beginPath(); g.ellipse(67, 27, 1.4, 2.6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(46, 24); g.quadraticCurveTo(70, 16, 96, 24); g.stroke();
      g.strokeStyle = '#d8f4ff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(104, 36); g.quadraticCurveTo(110, 48, 120, 52); g.stroke();
    });
  }
  // Kubikiribōchō for the throw: centred on (80, 24), blade along +x.
  function cleaverSpr() {
    return Kit().sprite('sk:cleaver', 160, 48, g => {
      const O = '#10141a';
      g.lineJoin = 'round';
      g.strokeStyle = O; g.lineWidth = 9; g.beginPath(); g.moveTo(6, 24); g.lineTo(36, 24); g.stroke();
      g.strokeStyle = '#2a2a32'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#8a8a96'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(9 + i * 4.4, 21); g.lineTo(11 + i * 4.4, 27); g.stroke(); }
      g.beginPath(); g.moveTo(36, 10); g.lineTo(46, 10); g.arc(55, 10, 8, Math.PI, 0, true); g.lineTo(148, 10); g.quadraticCurveTo(156, 10, 156, 18); g.lineTo(156, 42); g.lineTo(36, 42); g.closePath();
      g.moveTo(140, 20); g.arc(132, 20, 7, 0, TAU, true);
      g.fillStyle = '#b4bcc6'; g.fill('evenodd'); g.strokeStyle = O; g.lineWidth = 3; g.stroke();
      g.save(); g.clip('evenodd');
      g.fillStyle = 'rgba(40,50,70,.3)'; g.fillRect(36, 28, 122, 16);
      g.fillStyle = 'rgba(240,248,255,.9)'; g.fillRect(36, 37, 122, 4);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(64, 12, 70, 2.5);
      g.restore();
    });
  }
  function mirrorSpr() {
    return Kit().sprite('sk:mirror', 60, 112, g => {
      const gr = g.createLinearGradient(0, 0, 60, 112);
      gr.addColorStop(0, 'rgba(236,252,255,.94)'); gr.addColorStop(.5, 'rgba(162,216,246,.72)'); gr.addColorStop(1, 'rgba(118,186,236,.88)');
      rrect(g, 5, 5, 50, 102, 7); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(18,58,100,.9)'; g.lineWidth = 3.4; g.stroke();
      rrect(g, 9, 9, 42, 94, 5); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2;
      for (const [x, y, s] of [[10, 12, 1], [50, 100, -1]]) { g.beginPath(); g.moveTo(x, y + s * 10); g.lineTo(x, y); g.lineTo(x + s * 10, y); g.stroke(); }
    });
  }
  function mirrorSheen() {
    return Kit().sprite('sk:sheen', 60, 112, g => {
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(12, 70); g.lineTo(40, 12); g.lineTo(50, 12); g.lineTo(18, 82); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(22, 92); g.lineTo(48, 38); g.lineTo(51, 44); g.lineTo(27, 98); g.closePath(); g.fill();
      g.fillStyle = 'rgba(200,240,255,.25)'; g.fillRect(9, 9, 42, 94);
    });
  }
  // Ice swallow facing +x: swept wings and a forked tail. Origin (28, 20).
  function swallowSpr() {
    return Kit().sprite('sk:swallow', 52, 40, g => {
      const O = '#123a5c';
      g.lineJoin = 'round';
      g.fillStyle = '#e8faff'; g.strokeStyle = O; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(50, 20); g.lineTo(34, 15); g.lineTo(16, 2); g.lineTo(22, 16); g.lineTo(4, 10); g.lineTo(14, 20); g.lineTo(4, 30); g.lineTo(22, 24); g.lineTo(16, 38); g.lineTo(34, 25); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = 'rgba(120,200,240,.6)'; g.beginPath(); g.moveTo(34, 15); g.lineTo(16, 2); g.lineTo(22, 16); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(34, 25); g.lineTo(16, 38); g.lineTo(22, 24); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(50, 20); g.lineTo(36, 18); g.lineTo(36, 21); g.fill();
    });
  }
  // Ice crystal spike, base at (24, 92).
  function iceSpr(i) {
    return Kit().sprite('sk:ice' + (i % 3), 48, 96, g => {
      const lean = (hash(i * 3.3 + 1) - .5) * 10, w = 9 + hash(i * 1.7) * 5, top = 6 + hash(i * 5.1) * 14;
      g.lineJoin = 'round';
      g.fillStyle = '#7cc4ee'; g.beginPath(); g.moveTo(24 - w, 92); g.lineTo(24 + lean, top); g.lineTo(24 + w, 92); g.closePath(); g.fill();
      g.fillStyle = '#d6f4ff'; g.beginPath(); g.moveTo(24 - w + 3, 91); g.lineTo(24 + lean, top + 3); g.lineTo(24 + 1, 91); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(24 - w + 6, 88); g.lineTo(24 + lean, top + 6); g.lineTo(24 - w + 8, 88); g.closePath(); g.fill();
      g.strokeStyle = '#174a76'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(24 - w, 92); g.lineTo(24 + lean, top); g.lineTo(24 + w, 92); g.stroke();
      // a smaller side crystal
      g.fillStyle = '#a8e0fa'; g.beginPath(); g.moveTo(24 + w - 2, 92); g.lineTo(24 + w + 8, 60 + hash(i) * 10); g.lineTo(24 + w + 7, 92); g.closePath(); g.fill(); g.stroke();
    });
  }

  // ------------------------------------------------------------------ shared draw helpers
  function markCircle(ctx, x, y, r, rgb, k, time, faint, small) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .92);
    ctx.fillStyle = `rgba(18,16,30,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(0, 0, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = small ? 3.5 : faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = small ? 1.8 : faint ? 2 : 3;
    ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.moveTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14)); ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function markLine(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = `rgba(18,16,30,${s.faint ? .08 : .16})`; ctx.fillRect(0, -s.w, s.len, s.w * 2);
    ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; ctx.fillRect(0, -s.w, s.len * clamp01(k), s.w * 2);
    ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = s.faint ? 3.5 : 5; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = s.faint ? 1.8 : 2.5; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
    ctx.stroke();
    ctx.restore();
  }
  function markCone(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2, L = s.len, h = s.half;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    const wedge = r => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -h, h); ctx.closePath(); };
    wedge(L); ctx.fillStyle = `rgba(18,16,30,${s.faint ? .07 : .13})`; ctx.fill();
    wedge(L * clamp01(k)); ctx.fillStyle = `rgba(${rgb},${(s.faint ? .06 : .1) + .16 * k})`; ctx.fill();
    wedge(L); ctx.strokeStyle = 'rgba(20,20,40,.42)'; ctx.lineWidth = s.faint ? 3.5 : 5; ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = s.faint ? 1.8 : 2.5; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const ph = frac(time * 1.6 + i / 7), r = 50 + ph * (L - 70);
      ctx.moveTo(Math.cos(-h * .85) * r, Math.sin(-h * .85) * r); ctx.arc(0, 0, r, -h * .85, h * .85);
    }
    ctx.stroke();
    ctx.restore();
  }
  function cracks(ctx, x, y, r, n, seed, alpha, w = 2.5) {
    if (alpha <= .01 || r < 4) return;
    ctx.strokeStyle = `rgba(28,18,22,${.7 * alpha})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 4.7 + seed) * .5, l = r * (.55 + hash(i * 9.1 + seed) * .45);
      ctx.moveTo(x + Math.cos(a) * r * .12, y + Math.sin(a) * r * .06);
      for (let k = 1; k <= 5; k++) {
        const b = a + (hash(i * 3 + k * 1.7 + seed) - .5) * .5, d = l * k / 5;
        ctx.lineTo(x + Math.cos(b) * d, y + Math.sin(b) * d * .5);
      }
    }
    ctx.stroke();
  }
  function crater(ctx, x, y, r, alpha, seed) {
    if (alpha <= .01) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6a5848'; ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c221e'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .7, r * .34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,.35)'; ctx.beginPath(); ctx.ellipse(x, y - r * .36, r * .7, r * .08, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    cracks(ctx, x, y, r * 1.35, 9, seed, alpha, 3);
  }
  function dustRing(ctx, x, y, r, n, size, alpha, seed, rise = 10, kind = 'dust') {
    if (alpha <= .01) return;
    const K = Kit(), dust = K.puff(kind);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i * 2.3 + seed) * .35, d = r * (.9 + hash(i * 5.7 + seed) * .2);
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - rise - hash(i * 3.3 + seed) * size * .4, size * (.75 + hash(i * 1.1 + seed) * .5), alpha * .85, .75);
    }
  }
  function splash(ctx, x, y, r, age, seed, alpha = 1) {
    const K = Kit(), t = clamp01(age);
    if (t >= 1) return;
    const a = (1 - t) * alpha;
    K.fx.shockRing(ctx, x, y, r * 1.2, t, a, '120,210,255');
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + hash(i + seed) * .4, d = r * (.3 + .5 * easeOut(t)), bx = x + Math.cos(an) * d, by = y + Math.sin(an) * d * .5;
      const h = r * (.45 + hash(i * 3 + seed) * .6) * bell(Math.min(1, t * 1.25));
      if (h < 3) continue;
      const tx = bx + Math.cos(an) * h * .35, ty = by - h;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx, by - h * .6, tx, ty);
      ctx.strokeStyle = `rgba(16,70,140,${.5 * a})`; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = `rgba(140,215,255,${.85 * a})`; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 2.2; ctx.stroke();
    }
    ctx.fillStyle = `rgba(232,248,255,${a})`;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const an = hash(i * 5.1 + seed) * TAU, d = r * (.3 + t * (.7 + hash(i * 2.3 + seed) * .6));
      const h = Math.sin(Math.PI * Math.min(1, t * 1.3)) * r * (.4 + hash(i * 7 + seed) * .7), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - h, s = 2.5 + hash(i) * 3;
      ctx.moveTo(px + s, py); ctx.arc(px, py, s, 0, TAU);
    }
    ctx.fill();
    const w = K.puff('water');
    for (let i = 0; i < 3; i++) K.stamp(ctx, w, x + (hash(i * 5 + seed) - .5) * r * .6, y - 10 - t * r * .4, r * (.18 + t * .2), a * .4, .8);
  }
  // Ice shards bursting outward (dark-rimmed so they read on bright ground).
  function shards(ctx, x, y, r, t, seed, n, alpha = 1) {
    if (t <= 0 || t >= 1) return;
    const a = (1 - t) * alpha;
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? `rgba(220,248,255,${a})` : `rgba(20,70,120,${.7 * a})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + hash(i * 2.9 + seed) * .5, d = r * easeOut(t) * (.4 + hash(i * 1.3 + seed) * .7);
        const h = bell(t) * r * .5 * hash(i * 4.1 + seed), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .6 - h;
        const s = (pass ? 4 : 5.6) * (.6 + hash(i + seed)), rot = an + t * 9 * (hash(i * 7 + seed) - .5);
        ctx.moveTo(px + Math.cos(rot) * s * 1.8, py + Math.sin(rot) * s * 1.8);
        ctx.lineTo(px + Math.cos(rot + 2.2) * s, py + Math.sin(rot + 2.2) * s);
        ctx.lineTo(px + Math.cos(rot + 4) * s, py + Math.sin(rot + 4) * s);
        ctx.closePath();
      }
      ctx.fill();
    }
  }
  // A layered slash streak (dark under-stroke, colour, white core) along a segment, lifted by `lift`.
  function slashStreak(ctx, x0, y0, x1, y1, w, alpha, rgb, lift = 30) {
    if (alpha <= .01) return;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - lift, nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
    const bx = mx + nx / L * w * 1.4, by = my + ny / L * w * 1.4;
    ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0 - lift); ctx.quadraticCurveTo(bx, by, x1, y1 - lift); };
    path(); ctx.strokeStyle = `rgba(20,16,40,${.45 * alpha})`; ctx.lineWidth = w * 1.5; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    path(); ctx.strokeStyle = `rgba(${rgb},${.7 * alpha})`; ctx.lineWidth = w; ctx.stroke();
    path(); ctx.strokeStyle = `rgba(255,255,255,${.95 * alpha})`; ctx.lineWidth = Math.max(1.5, w * .3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Needles in flight (lifted) and stuck in the ground; style 1 = steel-ice, 2 = poison.
  function needleDraw(ctx, fx, list, spd, style) {
    if (!list || !list.length) return;
    const dark = style === 2 ? 'rgba(60,14,80,.8)' : 'rgba(16,40,70,.8)', core = style === 2 ? 'rgba(220,160,255,1)' : 'rgba(232,248,255,1)';
    const tipC = style === 2 ? '#c060ff' : '#ffffff';
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? core : dark; ctx.lineWidth = pass ? 2 : 4.6;
      ctx.beginPath();
      for (const n of list) {
        const t = fx.age - n[3];
        if (t < 0) continue;
        const d = t * spd, c = Math.cos(n[2]), s = Math.sin(n[2]);
        if (d < n[4]) {
          const u = d / n[4], lift = 26 * (1 - u * u), px = n[0] + c * d, py = n[1] + s * d - lift;
          ctx.moveTo(px - c * 42, py - s * 42 + 2); ctx.lineTo(px, py);
        } else {
          const la = t - n[4] / spd;
          if (la > .8) continue;
          const px = n[0] + c * n[4], py = n[1] + s * n[4];
          ctx.moveTo(px - c * 12, py - s * 12 - 10); ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
    ctx.fillStyle = tipC;
    ctx.beginPath();
    for (const n of list) {
      const t = fx.age - n[3], d = t * spd;
      if (t < 0 || d >= n[4]) continue;
      const u = d / n[4], px = n[0] + Math.cos(n[2]) * d, py = n[1] + Math.sin(n[2]) * d - 26 * (1 - u * u);
      ctx.moveTo(px + 3, py); ctx.arc(px, py, 3, 0, TAU);
    }
    ctx.fill();
  }
  // Blue chakra threads from Kankurō's fingers to a puppet.
  function strings(ctx, z, x, y, alpha, time) {
    if (!z || alpha <= .01) return;
    const f = x >= z.x ? 1 : -1, H = HEIGHT(z), hx = z.x + f * 14, hy = z.y - H * .52;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(150,220,255,${.85 * alpha})` : `rgba(10,30,70,${.35 * alpha})`; ctx.lineWidth = pass ? 1.1 : 2.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * 7, sag = 18 + Math.sin(time * 3 + i) * 6;
        ctx.moveTo(hx, hy + (i - 1.5) * 1.5); ctx.quadraticCurveTo((hx + x) / 2 + ox, (hy + y) / 2 - sag, x + ox, y);
      }
      ctx.stroke();
    }
  }
  function karasuDraw(ctx, x, y, f, open, time, alpha = 1) {
    const K = Kit(), img = karasuSpr(), bob = Math.sin(time * 7) * 3;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y + bob); ctx.scale(f, 1);
    if (open > 0) {
      // the hidden arms out, poisoned blades fanned
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const an = -.9 + i * .55 + Math.sin(time * 9 + i) * .08, l = 34 * open;
        const sx = 4, sy = -54 + i * 6, ex = sx + Math.cos(an) * l, ey = sy + Math.sin(an) * l;
        ctx.strokeStyle = '#120e16'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#8a6646'; ctx.lineWidth = 3.5; ctx.stroke();
        const bx = ex + Math.cos(an) * 26 * open, by = ey + Math.sin(an) * 26 * open;
        ctx.strokeStyle = '#120e16'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 2.6; ctx.stroke();
      }
    }
    ctx.drawImage(img, -48, -104);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - 50 + bob, 46, '150,90,220', .18 * alpha);
    ctx.globalCompositeOperation = 'source-over';
  }
  function kuroariDraw(ctx, x, y, o, time, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
    const O = '#0c0a10';
    if (o > .04) {
      // the hollow inside lined with spikes
      ctx.fillStyle = '#2a0c18'; ctx.beginPath(); ctx.ellipse(x, y - 60, 30 * o + 6, 52, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8b8d8'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const yy = y - 100 + i * 11; ctx.moveTo(x - 20 * o - 4, yy); ctx.lineTo(x - 6 * o, yy + 4); ctx.moveTo(x + 20 * o + 4, yy); ctx.lineTo(x + 6 * o, yy + 4); }
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(x, y - 6); ctx.rotate(side * o * .55);
      ctx.beginPath();
      if (side < 0) ctx.ellipse(0, -54, 40, 56, 0, Math.PI * .5, Math.PI * 1.5); else ctx.ellipse(0, -54, 40, 56, 0, -Math.PI * .5, Math.PI * .5);
      ctx.closePath();
      ctx.fillStyle = side < 0 ? '#16141c' : '#24212c'; ctx.fill();
      ctx.strokeStyle = O; ctx.lineWidth = 3.4; ctx.stroke();
      // carapace plates and a cold rim light
      ctx.strokeStyle = 'rgba(160,150,200,.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, -54, 30, 44, 0, side < 0 ? Math.PI * .6 : -Math.PI * .4, side < 0 ? Math.PI * 1.4 : Math.PI * .4); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.2;
      for (const yy of [-84, -60, -36]) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(side * 34, yy + 6); ctx.stroke(); }
      if (side > 0) {
        // the ant's head with horns and glinting eyes, on the right half
        ctx.fillStyle = '#1c1a22'; ctx.beginPath(); ctx.ellipse(6, -112, 14, 11, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = O; ctx.lineWidth = 3; ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -120); ctx.quadraticCurveTo(-6, -136, -14, -140); ctx.moveTo(12, -120); ctx.quadraticCurveTo(18, -138, 28, -140); ctx.stroke();
        ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(2, -112, 2.6, 0, TAU); ctx.arc(12, -112, 2.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    if (o <= .04) { ctx.strokeStyle = 'rgba(200,190,230,.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y - 108); ctx.lineTo(x, y - 6); ctx.stroke(); }
    ctx.restore();
  }
  function sasoriDraw(ctx, x, y, f, spin, time) {
    const O = '#140c0c';
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // spinning cable blades: back half first
    const blades = (front) => {
      for (let i = 0; i < 5; i++) {
        const an = spin + i * TAU / 5, s = Math.sin(an);
        if ((s > 0) !== front) continue;
        const bx = Math.cos(an) * 74, by = -50 + s * 30, tx = bx - Math.sin(an) * 26, ty = by + Math.cos(an) * 12;
        ctx.strokeStyle = 'rgba(30,20,20,.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-f * 6, -58); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = O; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#d8dee6'; ctx.lineWidth = 3; ctx.stroke();
      }
    };
    blades(false);
    ctx.scale(f, 1);
    // legs, wooden body with the chest core, red hair
    ctx.strokeStyle = O; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(-10, 0); ctx.moveTo(6, -36); ctx.lineTo(10, 0); ctx.stroke();
    ctx.strokeStyle = '#8a7462'; ctx.lineWidth = 4.4; ctx.stroke();
    ctx.fillStyle = '#7e6a5a'; ctx.strokeStyle = O; ctx.lineWidth = 3;
    rrect(ctx, -13, -78, 26, 44, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8dcc0'; rrect(ctx, -6, -70, 12, 18, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b02a2a'; ctx.fillRect(-2, -66, 4, 10);
    // arms forward, palms open (the flame jets)
    ctx.strokeStyle = O; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(8, -70); ctx.lineTo(26, -60); ctx.lineTo(36, -58); ctx.stroke();
    ctx.strokeStyle = '#9a8470'; ctx.lineWidth = 3.6; ctx.stroke();
    ctx.fillStyle = '#e8d6c2'; ctx.strokeStyle = O; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, -90, 11, 12, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c2342c';
    ctx.beginPath(); ctx.moveTo(-12, -86); for (let i = 0; i <= 8; i++) { const an = Math.PI * .95 + i / 8 * Math.PI * 1.15, r = i % 2 ? 11 : 16; ctx.lineTo(Math.cos(an) * r, -92 + Math.sin(an) * r); } ctx.lineTo(10, -94); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a3020'; ctx.beginPath(); ctx.arc(4, -89, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(x, y); blades(true); ctx.restore();
  }
  function sanshoDraw(ctx, x, y, a, open, time) {
    const O = '#10141c', c = Math.cos(a), s = Math.sin(a);
    ctx.save(); ctx.lineJoin = 'round';
    // the folded shell (body)
    ctx.fillStyle = '#4b5666'; ctx.strokeStyle = O; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.ellipse(x - c * 18, y - 34, 40, 32, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,215,235,.35)'; ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - c * 18 + i * 14, y - 64); ctx.lineTo(x - c * 18 + i * 18, y - 4); ctx.stroke(); }
    // head with the dart tube
    const hx = x + c * 30, hy = y - 26 + s * 14;
    ctx.fillStyle = '#5c6878'; ctx.strokeStyle = O; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(hx, hy, 16, 12, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(hx - 5, hy - 4, 2.4, 0, TAU); ctx.arc(hx + 5, hy - 4, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1e28'; ctx.beginPath(); ctx.ellipse(hx + c * 12, hy + 3, 5, 4, 0, 0, TAU); ctx.fill();
    // the shield wall unfolded in front: plates fanned across the aim, front ones drawn last
    if (open > 0) {
      const P = [];
      for (let i = 0; i < 7; i++) { const an = a + (i - 3) * .3 * open, px = x + Math.cos(an) * 62, py = y + Math.sin(an) * 56; P.push([px, py, an]); }
      P.sort((u, v) => u[1] - v[1]);
      for (const [px, py, an] of P) {
        const w = 20, h = 70 * open, nx = -Math.sin(an) * w, ny = Math.cos(an) * w * .5;
        ctx.fillStyle = '#5a6678'; ctx.strokeStyle = O; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px - nx, py - ny); ctx.lineTo(px + nx, py + ny); ctx.lineTo(px + nx, py + ny - h); ctx.lineTo(px - nx, py - ny - h); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(210,225,245,.4)'; ctx.beginPath(); ctx.moveTo(px - nx * .7, py - ny * .7 - h + 6); ctx.lineTo(px - nx * .2, py - ny * .2 - h + 6); ctx.lineTo(px - nx * .2, py - ny * .2 - 8); ctx.lineTo(px - nx * .7, py - ny * .7 - 8); ctx.fill();
        ctx.fillStyle = '#2e3644'; ctx.beginPath(); ctx.arc(px, py - h * .55, 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  // A tornado column: stacked spinning rings (dark under-stroke + pale wind), base dust, orbiting debris.
  function tornado(ctx, x, y, r0, r1, h, time, alpha, seed, n, debrisN) {
    if (alpha <= .01) return;
    const K = Kit();
    const rad = t => lerp(r0, r1, Math.pow(t, 1.3)), sw = t => Math.sin(time * 2.6 + t * 3 + seed) * h * .06 * t;
    dustRing(ctx, x, y, r0 * 1.4, 9, r0 * .6 + 12, alpha * .95, seed + (time * 3 | 0), 6);
    // the funnel body: a dark wind-grey silhouette with a paler core, so it reads on bright ground
    const body = k => {
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const t = i / 10; ctx.lineTo(x + sw(t) - rad(t) * k, y - t * h); }
      for (let i = 10; i >= 0; i--) { const t = i / 10; ctx.lineTo(x + sw(t) + rad(t) * k, y - t * h); }
      ctx.closePath();
    };
    body(1); ctx.fillStyle = `rgba(92,100,92,${.2 * alpha})`; ctx.fill();
    body(.62); ctx.fillStyle = `rgba(236,246,240,${.22 * alpha})`; ctx.fill();
    ctx.lineCap = 'round';
    // spiral streaks climbing the funnel
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(250,255,252,${.8 * alpha})` : `rgba(50,58,52,${.3 * alpha})`; ctx.lineWidth = pass ? 1.8 : 5;
      ctx.beginPath();
      for (let s2 = 0; s2 < 6; s2++) {
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, an = time * 7 + s2 * TAU / 6 + t * 7, px = x + sw(t) + Math.cos(an) * rad(t), py = y - t * h + Math.sin(an) * rad(t) * .3;
          if (i === 0 || Math.sin(an) < -.2) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
    // rings of wind round the funnel (front arcs bright, under-stroked)
    for (let pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? `rgba(60,66,60,${.3 * alpha})` : pass === 1 ? `rgba(225,240,232,${.65 * alpha})` : `rgba(255,255,255,${.9 * alpha})`;
      ctx.lineWidth = pass === 0 ? 7 : pass === 1 ? 3.6 : 1.4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), yy = y - t * h, rx = rad(t), ry = rx * .3;
        const ph = time * (7 - t * 2.5) + i * 1.3 + seed, span = pass === 2 ? 1.4 : 2.6 + hash(i + seed) * 1.2;
        ctx.moveTo(x + sw(t) + Math.cos(ph) * rx, yy + Math.sin(ph) * ry);
        ctx.ellipse(x + sw(t), yy, rx, ry, 0, ph, ph + span);
      }
      ctx.stroke();
    }
    // cap of churning air on top
    ctx.strokeStyle = `rgba(240,250,245,${.5 * alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x + sw(1), y - h, r1 * 1.05, r1 * .32, 0, -time * 4, -time * 4 + 4.6); ctx.stroke();
    // debris swirling up
    ctx.fillStyle = `rgba(70,54,40,${.9 * alpha})`;
    ctx.beginPath();
    for (let j = 0; j < debrisN; j++) {
      const t = frac(time * .35 + hash(j * 3.7 + seed)), yy = y - t * h * .9, rx = rad(t) * 1.05;
      const ph = time * 6 + j * 2.4, px = x + sw(t) + Math.cos(ph) * rx, py = yy + Math.sin(ph) * rx * .3, sz = 2.5 + hash(j) * 4.5;
      ctx.moveTo(px + sz, py); ctx.lineTo(px, py - sz * .8); ctx.lineTo(px - sz, py + sz * .3); ctx.closePath();
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - h * .5, r1 * 1.1, '200,240,230', .12 * alpha, false, 1.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  function fanAt(ctx, x, y, f, rot, s, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(f * s, s); ctx.rotate(rot);
    ctx.drawImage(fanSpr(), -70, -128);
    ctx.restore();
  }
  function cleaverAt(ctx, x, y, rot, s, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.drawImage(cleaverSpr(), -80, -24);
    ctx.restore();
  }
  function waterClone(ctx, x, y, f, frame, alpha, time) {
    const S = Spr(), K = Kit();
    if (!S || alpha <= .01) return;
    S.draw(ctx, 'zabuza', x, y, { facing: f, frame, alpha: alpha * .78 });
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y - 50, 60, '70,160,255', .28 * alpha, false, 1.5);
    ctx.globalCompositeOperation = 'source-over';
    const w = K.puff('water');
    for (let i = 0; i < 3; i++) K.stamp(ctx, w, x + (hash(i * 3) - .5) * 30, y - frac(time * 1.6 + i / 3) * 70, 6, .5 * alpha, 1);
  }

  // ================================================================== KANKURŌ
  function karasuG(ctx, fx, time) {
    if (fx.ln) markLine(ctx, { x: fx.ln[0], y: fx.ln[1], a: fx.ln[4], len: Math.hypot(fx.ln[2] - fx.ln[0], fx.ln[3] - fx.ln[1]), w: 40, faint: 1 }, '200,160,255', .6, time);
    if (fx.cut) {
      const t = fx.age - fx.cut[5];
      if (t < 1.2) { ctx.strokeStyle = `rgba(40,20,50,${.35 * (1 - t / 1.2)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fx.cut[0], fx.cut[1]); ctx.lineTo(fx.cut[2], fx.cut[3]); ctx.stroke(); }
    }
  }
  function karasuO(ctx, fx, time, z) {
    const open = fx.age > .4 && fx.age < 2.9 ? 1 : 0, lift = 40, ret = fx.age > 3.2 ? 1 - (fx.age - 3.2) / .5 : 1;
    strings(ctx, z, fx.px, fx.py - lift - 60, ret, time);
    if (fx.cut) {
      const t = fx.age - fx.cut[5];
      if (t < .35) {
        const a = 1 - t / .35, c = fx.cut;
        slashStreak(ctx, c[0], c[1], c[2], c[3], 22, a, '200,150,255', 36);
        Kit().fx.debris(ctx, c[2], c[3], 60, t / .35, fx.seed + fx.i, '#3a2a44', 6);
      }
    }
    karasuDraw(ctx, fx.px, fx.py - lift, fx.f || 1, open, time, ret);
    needleDraw(ctx, fx, fx.n, 1300, 2);
  }
  function poisonG(ctx, fx, time) {
    if (fx.age < .6) return;
    // needles bristling from the ground where the rain landed
    const a = 1 - win(fx.age, 2.2, fx.dur);
    ctx.strokeStyle = `rgba(40,16,50,${.7 * a})`; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const an = hash(i * 3.1 + fx.seed) * TAU, d = Math.sqrt(hash(i * 1.7 + fx.seed)) * 240, px = fx.tx + Math.cos(an) * d, py = fx.ty + Math.sin(an) * d * .9;
      if (fx.age < .6 + hash(i) * .8) continue;
      ctx.moveTo(px, py); ctx.lineTo(px - 3, py - 9);
    }
    ctx.stroke();
  }
  function poisonO(ctx, fx, time, z) {
    const K = Kit(), up = 130 * easeOut(Math.min(1, fx.age / .45)) * (fx.age > 2.2 ? 1 - win(fx.age, 2.2, 2.8) : 1);
    const ret = 1 - win(fx.age, 2.5, 3.0);
    strings(ctx, z, fx.px, fx.py - up - 60, ret, time);
    karasuDraw(ctx, fx.px, fx.py - up, fx.f || 1, fx.age > .45 && fx.age < 2 ? 1 : 0, time, ret);
    // needle rain spraying from the open jaw
    if (fx.age > .5 && fx.age < 1.6) {
      const mx = fx.px, my = fx.py - up - 70;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(230,180,255,.95)' : 'rgba(50,10,70,.7)'; ctx.lineWidth = pass ? 1.4 : 3.2;
        ctx.beginPath();
        for (let i = 0; i < 26; i++) {
          const ph = frac(fx.age * 2.6 + hash(i * 2.3 + fx.seed)), an = hash(i * 5.3 + fx.seed) * TAU, d = Math.sqrt(hash(i * 7.7 + fx.seed)) * 245;
          const gx = fx.tx + Math.cos(an) * d, gy = fx.ty + Math.sin(an) * d * .9, px = lerp(mx, gx, ph), py = lerp(my, gy, ph);
          const dx = gx - mx, dy = gy - my, L = Math.hypot(dx, dy) || 1;
          ctx.moveTo(px, py); ctx.lineTo(px - dx / L * 24, py - dy / L * 24);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, mx, my, 40, '200,120,255', .5); ctx.globalCompositeOperation = 'source-over';
    }
    // the gas bomb bursting from the jaw down onto the area
    if (fx.age > 1.5 && fx.age < 2.5) {
      const t = (fx.age - 1.5) / 1, img = poisonSpr(), dk = K.puff('violet');
      for (let i = 0; i < 12; i++) {
        const an = i * TAU / 12 + hash(i + fx.seed), d = 40 + easeOut(t) * 200 * (.6 + hash(i * 3) * .5);
        K.stamp(ctx, i % 3 ? img : dk, fx.tx + Math.cos(an) * d, fx.ty + Math.sin(an) * d * .55 - 30 - t * 30, 50 + t * 40, (1 - t) * .8, .75);
      }
    }
  }
  function kuroariPos(fx) {
    const k = clamp01(fx.age / .45);
    return [lerp(fx.x0, fx.x, k), lerp(fx.y0, fx.y, k) - bell(k) * 190 * (k < 1 ? 1 : 0)];
  }
  function kuroariOpen(fx) {
    if (fx.age < .45) return 0;
    if (fx.age < .62) return easeOut((fx.age - .45) / .17);
    if (fx.age < 1.0) return 1;
    if (fx.age < 1.15) return 1 - easeIn((fx.age - 1.0) / .15);
    return 0;
  }
  function kuroariG(ctx, fx, time) {
    const K = Kit(), a = 1 - win(fx.age, 2.6, fx.dur);
    ctx.fillStyle = `rgba(14,10,18,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 52 * (fx.age < .45 ? fx.age / .45 : 1), 20, 0, 0, TAU); ctx.fill();
    if (fx.age > .45) {
      const t = fx.age - .45;
      cracks(ctx, fx.x, fx.y, 120, 8, fx.seed, a * .8);
      if (t < .5) { K.fx.shockRing(ctx, fx.x, fx.y, 200, t / .5, 1 - t / .5, '190,160,255'); dustRing(ctx, fx.x, fx.y, 110 + t * 120, 9, 26, 1 - t / .5, fx.seed); }
      if (fx.caught && fx.age < 1.8) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, 90, '170,90,255', .3 + Math.sin(time * 18) * .1); ctx.globalCompositeOperation = 'source-over'; }
    }
  }
  function kuroariO(ctx, fx, time, z) {
    const K = Kit(), p = kuroariPos(fx), o = kuroariOpen(fx), a = 1 - win(fx.age, 2.6, fx.dur);
    strings(ctx, z, p[0], p[1] - 110, a, time);
    kuroariDraw(ctx, p[0], p[1], o, time, a);
    // Karasu's blades driven through the slits
    if (fx.age >= 1.7) {
      const k = easeOut((fx.age - 1.7) / .12);
      for (let i = 0; i < 4; i++) {
        const an = i * TAU / 4 + .6, cx = fx.x, cy = fx.y - 60, l = 70 * k;
        const x0 = cx + Math.cos(an) * 90, y0 = cy + Math.sin(an) * 60, x1 = x0 + (cx - x0) * k * 1.4, y1 = y0 + (cy - y0) * k * 1.4;
        ctx.strokeStyle = `rgba(18,10,24,${a})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = `rgba(210,170,255,${a})`; ctx.lineWidth = 3.4; ctx.stroke();
        if (l < 2) continue;
      }
      if (fx.age < 1.95) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 60, 80, '255,200,255', .7 * (1 - (fx.age - 1.7) / .25), true); ctx.globalCompositeOperation = 'source-over'; }
    }
    if (fx.age > 2.0 && fx.age < 2.9) {
      const t = (fx.age - 2.0) / .9, img = poisonSpr();
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10 + fx.seed, d = 30 + easeOut(t) * 170; K.stamp(ctx, img, fx.x + Math.cos(an) * d, fx.y - 50 + Math.sin(an) * d * .5 - t * 30, 40 + t * 30, (1 - t) * .85, .8); }
    }
    if (fx.age > 2.6) K.fx.smokePoof ? K.fx.smokePoof(ctx, fx.x, fx.y - 60, 80, (fx.age - 2.6) / .5) : null;
  }
  function sanshoG(ctx, fx, time) {
    const a = 1 - win(fx.age, 2.8, fx.dur);
    ctx.fillStyle = `rgba(14,16,26,${.25 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 4, 70, 26, 0, 0, TAU); ctx.fill();
    if (fx.snap) { const t = fx.age - 2.6; if (t < .5) { Kit().fx.shockRing(ctx, fx.x, fx.y, 260, t / .5, 1 - t / .5, '150,205,255'); dustRing(ctx, fx.x, fx.y, 150 + t * 200, 12, 26, 1 - t / .5, fx.seed); } }
  }
  function sanshoO(ctx, fx, time, z) {
    const K = Kit(), open = fx.age < .3 ? easeBack(fx.age / .3) : fx.age > 2.5 ? 1 - easeIn((fx.age - 2.5) / .15) : 1, a = 1 - win(fx.age, 2.8, fx.dur);
    ctx.globalAlpha = a;
    strings(ctx, z, fx.x, fx.y - 60, a, time);
    sanshoDraw(ctx, fx.x, fx.y, fx.a, Math.max(0, open), time);
    ctx.globalAlpha = 1;
    if (z && z.sk && z.sk.guard > 0) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x + Math.cos(fx.a) * 50, fx.y - 40, 90, '120,190,255', .22 + Math.sin(time * 10) * .06, false, 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    needleDraw(ctx, fx, fx.n, 1150, 2);
  }
  function sasoriG(ctx, fx, time) {
    const a = 1 - win(fx.age, 2.8, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
    // the furrow the blades cut, and the scorched cone of the flame jets
    const L = Math.hypot(fx.px - fx.x0, fx.py - fx.y0);
    if (L > 10) { ctx.strokeStyle = `rgba(40,26,20,${.4 * a})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x0 + c * L, fx.y0 + s * L); ctx.stroke(); }
    if (fx.fl) {
      const k = clamp01((fx.age - 1.55) / .3);
      ctx.save(); ctx.translate(fx.px, fx.py); ctx.rotate(fx.fa);
      ctx.fillStyle = `rgba(30,14,10,${.3 * a * k})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 440 * k, -.3, .3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  function sasoriO(ctx, fx, time, z) {
    const K = Kit(), a = 1 - win(fx.age, 2.8, fx.dur), f = Math.cos(fx.fl ? fx.fa : fx.a) >= 0 ? 1 : -1;
    const spin = time * (fx.age < 1.45 ? 22 : 6);
    strings(ctx, z, fx.px, fx.py - 90, a, time);
    ctx.globalAlpha = a;
    if (fx.age < 1.45 && fx.age > .25) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.px, fx.py - 50, 110, '255,240,230', .25);
      ctx.globalCompositeOperation = 'source-over';
      dustRing(ctx, fx.px, fx.py, 60, 6, 18, .7, (time * 8) | 0, 4);
    }
    sasoriDraw(ctx, fx.px, fx.py, f, spin, time);
    ctx.globalAlpha = 1;
    if (fx.fl && fx.age < 2.75) {
      // twin flame jets from the palms
      const k = clamp01((fx.age - 1.55) / .2) * (1 - win(fx.age, 2.5, 2.75)), fire = K.puff('fire'), c = Math.cos(fx.fa), s = Math.sin(fx.fa);
      const ox = fx.px + f * 36, oy = fx.py - 58;
      for (let j = 0; j < 2; j++) {
        const side = j ? 1 : -1;
        for (let i = 0; i < 9; i++) {
          const ph = frac(time * 2.4 + i / 9 + j * .5), d = 20 + ph * 420 * k, spread = (hash(i * 3 + j) - .5) * d * .32 + side * 8;
          const px = ox + c * d - s * spread, py = oy + s * d * .9 + c * spread * .5 + ph * 40;
          K.stamp(ctx, fire, px, py, (12 + ph * 46) * k, (1 - ph * .7) * .95, .8);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, ox + c * 160, oy + s * 140 + 20, 150 * k, '255,140,40', .4 * k, false, .7);
      K.glow(ctx, ox, oy, 30, '255,240,200', .9 * k, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function maidenG(ctx, fx, time) {
    const K = Kit(), a = 1 - win(fx.age, 3.2, fx.dur);
    if (fx.age < .35) {
      const k = fx.age / .35;
      ctx.fillStyle = `rgba(14,10,20,${.35 * k})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 60 + 40 * k, 24 + 16 * k, 0, 0, TAU); ctx.fill();
      return;
    }
    crater(ctx, fx.x, fx.y, 150, a * .9, fx.seed);
    // chakra-thread web of the ring
    if (fx.age < 2.6) {
      ctx.strokeStyle = `rgba(150,220,255,${.5 * a})`; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const an = i * TAU / 8 + .2 + time * .3; ctx.moveTo(fx.x, fx.y - 60); ctx.lineTo(fx.x + Math.cos(an) * (MAIDEN_R - 40), fx.y + Math.sin(an) * (MAIDEN_R - 40) * .9 - 40); }
      ctx.stroke();
    }
    const t = fx.age - .35;
    if (t < .5) { K.fx.shockRing(ctx, fx.x, fx.y, MAIDEN_R * 1.1, t / .5, 1 - t / .5, '200,150,255'); dustRing(ctx, fx.x, fx.y, 160 + t * 260, 14, 34, 1 - t / .5, fx.seed); }
    if (fx.boom) {
      const v = fx.age - 2.5;
      if (v < .9) { K.fx.shockRing(ctx, fx.x, fx.y, 460, v / .9, 1 - v / .9, '210,140,255'); K.fx.shockRing(ctx, fx.x, fx.y, 320, Math.min(1, v / .6), 1 - v / .9, '255,230,255'); }
      ctx.fillStyle = `rgba(70,20,90,${.25 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, 380, 340, 0, 0, TAU); ctx.fill();
    }
  }
  function maidenO(ctx, fx, time, z) {
    const K = Kit(), a = 1 - win(fx.age, 3.2, fx.dur);
    const drop = fx.age < .35 ? (1 - easeIn(fx.age / .35)) * 420 : 0;
    const o = fx.age < .35 ? .3 : fx.age < .55 ? .3 + .7 * easeOut((fx.age - .35) / .2) : fx.age < .8 ? 1 - easeIn((fx.age - .55) / .25) : 0;
    const shake = fx.caught && fx.age > .8 && fx.age < 2.5 ? Math.sin(time * 40) * 2.5 : 0;
    if (fx.age < 2.7) strings(ctx, z, fx.x, fx.y - 140 - drop, 1, time);
    if (!fx.boom || fx.age < 2.65) kuroariDraw(ctx, fx.x + shake, fx.y - drop, o, time, fx.boom ? 1 - (fx.age - 2.5) / .15 : 1);
    // Karasu, split into its parts, orbiting and stabbing the ant from eight sides
    if (fx.age > .7 && fx.age < 2.55) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const an = i * TAU / 8 + .2, stabT = .9 + i * .13, stuck = fx.age >= stabT;
        const orbit = MAIDEN_R - 40 + Math.sin(time * 5 + i) * 8, rx = fx.x + Math.cos(an + (stuck ? 0 : (stabT - fx.age) * 2)) * orbit, ry = fx.y + Math.sin(an + (stuck ? 0 : (stabT - fx.age) * 2)) * orbit * .9 - 70;
        const k = stuck ? easeOut((fx.age - stabT) / .1) : 0;
        const tx = lerp(rx, fx.x + Math.cos(an) * 26, k), ty = lerp(ry, fx.y - 60 + Math.sin(an) * 16, k);
        ctx.strokeStyle = 'rgba(18,10,24,.95)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(lerp(rx, tx, .3), lerp(ry, ty, .3)); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#d0a8ff'; ctx.lineWidth = 3.6; ctx.stroke();
        if (!stuck || fx.age - stabT < .12) {
          ctx.fillStyle = '#3a2f46'; ctx.strokeStyle = '#120e16'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.ellipse(rx, ry, 10, 8, an, 0, TAU); ctx.fill(); ctx.stroke();
        }
        if (stuck && fx.age - stabT < .18) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, tx, ty, 34, '255,210,255', .9, true); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    // the main body dives in from above
    if (fx.age > 1.8 && fx.age < 2.2) {
      const k = easeIn((fx.age - 1.8) / .3);
      karasuDraw(ctx, fx.x, fx.y - 60 - (1 - k) * 360, 1, 1, time, 1);
      if (k >= 1) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 60, 120, '255,220,255', .9, true); ctx.globalCompositeOperation = 'source-over'; }
    }
    // the poison explosion: violet billows, a white-hot core, flying plates
    if (fx.boom) {
      const v = fx.age - 2.5, t = clamp01(v / 1.3), img = poisonSpr(), dk = K.puff('violet');
      ctx.globalCompositeOperation = 'lighter';
      if (v < .35) K.glow(ctx, fx.x, fx.y - 70, 260 * (.5 + v), '255,220,255', (1 - v / .35), true);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 18; i++) {
        const an = i * TAU / 18 + hash(i + fx.seed) * .4, d = easeOut(t) * (150 + hash(i * 3.1) * 260), rise = t * (60 + hash(i * 5) * 90);
        K.stamp(ctx, i % 3 === 0 ? dk : img, fx.x + Math.cos(an) * d, fx.y - 50 + Math.sin(an) * d * .5 - rise, 50 + t * 90 * (.6 + hash(i)), (1 - t) * .9, .8);
      }
      K.fx.debris(ctx, fx.x, fx.y - 40, 300, Math.min(1, v / .9), fx.seed, '#1c1a22', 14);
      if (v < .8) shards(ctx, fx.x, fx.y - 60, 280, v / .8, fx.seed, 14, .8);
    }
  }
  function patchesG(ctx, st, time) {
    const K = Kit();
    for (const q of st.patches) {
      const a = Math.min(1, (q.max - q.life) / .4) * Math.min(1, q.life / .8);
      if (q.kind === 0) {
        ctx.fillStyle = `rgba(90,30,120,${.22 * a})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * .85, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(200,140,255,${.4 * a})`; ctx.lineWidth = 2; ctx.stroke();
        const img = poisonSpr();
        for (let i = 0; i < 7; i++) {
          const an = i * TAU / 7 + time * .3 + q.seed, d = q.r * (.2 + hash(i + q.seed) * .65);
          K.stamp(ctx, img, q.x + Math.cos(an) * d, q.y + Math.sin(an) * d * .8, q.r * .45, .38 * a, .6);
        }
      } else {
        ctx.fillStyle = `rgba(200,240,255,${.35 * a})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r, q.r * .8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(30,90,140,${.45 * a})`; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.7 * a})`; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + q.seed; ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.cos(an) * q.r * .8, q.y + Math.sin(an) * q.r * .64); }
        ctx.stroke();
      }
    }
  }
  function patchesO(ctx, st, time) {
    const K = Kit(), img = poisonSpr();
    for (const q of st.patches) {
      if (q.kind !== 0) continue;
      const a = Math.min(1, (q.max - q.life) / .4) * Math.min(1, q.life / .8);
      for (let i = 0; i < 5; i++) {
        const ph = frac(time * .4 + i / 5 + hash(q.seed)), an = hash(i * 3.7 + q.seed) * TAU, d = q.r * .6 * hash(i * 1.9 + q.seed);
        K.stamp(ctx, img, q.x + Math.cos(an) * d, q.y + Math.sin(an) * d * .7 - 20 - ph * 60, 30 + ph * 26, a * (1 - ph) * .5, .8);
      }
    }
  }

  // ================================================================== TEMARI
  function cutG(ctx, fx, time) {
    const a = 1 - win(fx.age, .9, fx.dur), front = Math.min(CUT_L, fx.age * CUT_SPD);
    ctx.lineCap = 'round';
    for (const b of fx.bl) {
      const c = Math.cos(b[0]), s = Math.sin(b[0]);
      ctx.strokeStyle = `rgba(40,36,30,${.35 * a})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx.x + c * 40, fx.y + s * 40); ctx.lineTo(fx.x + c * front, fx.y + s * front); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.25 * a})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const K = Kit(), dust = K.puff('dust');
    for (let i = 0; i < 9; i++) {
      const b = fx.bl[i % 3], d = front * (.25 + (i / 9) * .75), c = Math.cos(b[0]), s = Math.sin(b[0]);
      K.stamp(ctx, dust, fx.x + c * d + (hash(i) - .5) * 30, fx.y + s * d - 10, 18 + hash(i * 3) * 16, .45 * a, .7);
    }
  }
  function cutO(ctx, fx, time) {
    const front = Math.min(CUT_L, fx.age * CUT_SPD), a = 1 - win(fx.age, CUT_L / CUT_SPD, CUT_L / CUT_SPD + .25);
    if (a <= 0) return;
    for (const b of fx.bl) {
      const c = Math.cos(b[0]), s = Math.sin(b[0]), px = fx.x + c * front, py = fx.y + s * front - 28;
      // a crescent of compressed air, convex side forward, with speed streaks trailing
      ctx.save(); ctx.translate(px, py); ctx.rotate(b[0]);
      const crescent = () => { ctx.beginPath(); ctx.moveTo(0, -62); ctx.quadraticCurveTo(46, 0, 0, 62); ctx.quadraticCurveTo(22, 0, 0, -62); ctx.closePath(); };
      crescent(); ctx.fillStyle = `rgba(30,50,46,${.4 * a})`; ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.scale(.92, .92); crescent(); ctx.fillStyle = `rgba(190,250,235,${.55 * a})`; ctx.fill();
      ctx.scale(.8, .8); crescent(); ctx.fillStyle = `rgba(255,255,255,${.8 * a})`; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      ctx.strokeStyle = `rgba(235,255,250,${.6 * a})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * 22, l = 120 + hash(i * 3.3 + fx.seed) * 140;
        ctx.moveTo(px - s * off - c * 20, py + c * off - s * 20); ctx.lineTo(px - s * off - c * (20 + l), py + c * off - s * (20 + l));
      }
      ctx.stroke();
    }
  }
  function gustG(ctx, fx, time) {
    const K = Kit(), front = Math.min(GUST_L, fx.age * GUST_SPD), a = 1 - win(fx.age, 1.0, fx.dur), dust = K.puff('dust');
    for (let i = 0; i < 16; i++) {
      const an = fx.a + (hash(i * 2.1 + fx.seed) - .5) * GUST_HALF * 2, d = front * (.4 + hash(i * 3.7 + fx.seed) * .6);
      K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d - 8, 22 + hash(i) * 22, .6 * a, .7);
    }
  }
  function gustO(ctx, fx, time) {
    const K = Kit(), front = Math.min(GUST_L, fx.age * GUST_SPD), a = 1 - win(fx.age, .75, 1.3);
    if (a <= 0) return;
    ctx.save(); ctx.translate(fx.x, fx.y - 30); ctx.rotate(fx.a); ctx.lineCap = 'round';
    // nested crescent wave fronts and long wind streaks
    ctx.fillStyle = `rgba(235,250,245,${.2 * a})`; ctx.beginPath(); ctx.arc(0, 0, front, -GUST_HALF * .9, GUST_HALF * .9); ctx.arc(0, 0, Math.max(30, front - 220), GUST_HALF * .9, -GUST_HALF * .9, true); ctx.closePath(); ctx.fill();
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(240,255,250,${.75 * a})` : `rgba(40,60,56,${.3 * a})`; ctx.lineWidth = pass ? 3 : 8;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) { const r = front - j * 70; if (r < 40) continue; ctx.moveTo(Math.cos(-GUST_HALF * .9) * r, Math.sin(-GUST_HALF * .9) * r); ctx.arc(0, 0, r, -GUST_HALF * .9, GUST_HALF * .9); }
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${.55 * a})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const an = (hash(i * 1.3 + fx.seed) - .5) * GUST_HALF * 1.8, r1 = front * (.3 + hash(i * 7.1) * .7), r0 = Math.max(10, r1 - 90 - hash(i) * 80);
      ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
    }
    ctx.stroke();
    // leaves and grit tumbling in the gust
    ctx.fillStyle = `rgba(90,120,50,${.9 * a})`; ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const an = (hash(i * 4.3 + fx.seed) - .5) * GUST_HALF * 1.6, r = front * (.5 + hash(i * 2.9) * .5), px = Math.cos(an) * r, py = Math.sin(an) * r - hash(i) * 20, rot = time * 9 + i;
      ctx.moveTo(px + Math.cos(rot) * 6, py + Math.sin(rot) * 6); ctx.lineTo(px + Math.cos(rot + 2.6) * 3, py + Math.sin(rot + 2.6) * 3); ctx.lineTo(px + Math.cos(rot + 3.6) * 3, py + Math.sin(rot + 3.6) * 3);
    }
    ctx.fill();
    ctx.restore();
    K.fx.debris(ctx, fx.x + Math.cos(fx.a) * front * .7, fx.y + Math.sin(fx.a) * front * .7, 80, frac(fx.age * 1.5), fx.seed, '#6e5844', 8);
  }
  function kamaG(ctx, fx, time) {
    if (fx.ln) markLine(ctx, { x: fx.ln[0], y: fx.ln[1], a: fx.ln[4], len: Math.hypot(fx.ln[2] - fx.ln[0], fx.ln[3] - fx.ln[1]), w: 54, faint: 1 }, '235,240,205', .6, time);
    if (fx.cut) { const t = fx.age - fx.cut[5]; if (t < 1.4) { ctx.strokeStyle = `rgba(40,36,30,${.35 * (1 - t / 1.4)})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(fx.cut[0], fx.cut[1]); ctx.lineTo(fx.cut[2], fx.cut[3]); ctx.stroke(); } }
    if (fx.spin) { const t = fx.age - fx.st; if (t < .6) { Kit().fx.shockRing(ctx, fx.tx, fx.ty, 230, t / .6, 1 - t / .6, '230,250,240'); dustRing(ctx, fx.tx, fx.ty, 120 + t * 150, 12, 28, 1 - t / .6, fx.seed); } }
  }
  function kamaO(ctx, fx, time) {
    const K = Kit(), poof = fx.age < .3 ? fx.age / .3 : 0, a = fx.spin ? 1 - win(fx.age, fx.st + .3, fx.st + .8) : 1;
    if (poof > 0 && K.fx.smokePoof) K.fx.smokePoof(ctx, fx.sx, fx.sy - 40, 60, poof);
    if (fx.age < .15) return;
    if (fx.cut) {
      const t = fx.age - fx.cut[5];
      if (t < .4) slashStreak(ctx, fx.cut[0], fx.cut[1], fx.cut[2], fx.cut[3], 26, 1 - t / .4, '200,255,235', 40);
    }
    if (a <= 0) return;
    // Kamatari riding its little whirlwind
    const lift = 46 + Math.sin(time * 8) * 4;
    tornado(ctx, fx.px, fx.py, 18, 46, 60, time, .8 * a, fx.seed, 4, 3);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(fx.px, fx.py - lift); ctx.scale(fx.f || 1, 1);
    if (fx.ln || (fx.cut && fx.age - fx.cut[5] < .2)) ctx.rotate(-.25);
    ctx.drawImage(kamaSpr(), -60, -62);
    ctx.restore();
    if (fx.spin) {
      const t = fx.age - fx.st;
      if (t < .5) {
        ctx.save(); ctx.translate(fx.tx, fx.ty - 30); ctx.scale(1, .5);
        ctx.strokeStyle = `rgba(255,255,255,${1 - t / .5})`; ctx.lineWidth = 6;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 80 + i * 50 + t * 80, time * 12 + i * 2, time * 12 + i * 2 + 3.2); ctx.stroke(); }
        ctx.restore();
      }
    }
  }
  function dustA(fx) { return Math.min(1, fx.age / .4) * (1 - win(fx.age, 3.5, fx.dur)); }
  function dustG(ctx, fx, time) {
    const a = dustA(fx), K = Kit(), dust = K.puff('dust');
    ctx.fillStyle = `rgba(160,130,90,${.28 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, DUST_R, DUST_R * .85, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + time * .8 + fx.seed, d = DUST_R * (.3 + hash(i + fx.seed) * .65);
      K.stamp(ctx, dust, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .8, 60 + hash(i * 3) * 40, .55 * a, .6);
    }
  }
  function dustO(ctx, fx, time) {
    const a = dustA(fx), K = Kit(), dust = K.puff('dust'), smoke = K.puff('smoke');
    for (let i = 0; i < 16; i++) {
      const an = i * TAU / 16 + time * (1.1 + hash(i) * .6) + fx.seed, d = DUST_R * (.15 + hash(i * 2.7 + fx.seed) * .8), up = 20 + hash(i * 4.1) * 90;
      K.stamp(ctx, i % 5 ? dust : smoke, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .7 - up, 46 + hash(i * 5) * 36, .42 * a, .7);
    }
    // wind blades flickering inside the cloud
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const ph = frac(time * 2.2 + i / 5), an = hash(i * 9 + ((time * 2.2 + i / 5) | 0)) * TAU, d = DUST_R * .6 * hash(i * 3 + ((time * 2.2) | 0));
      const cx = fx.x + Math.cos(an) * d, cy = fx.y + Math.sin(an) * d * .7 - 50, b = an + 1.2, l = 70;
      if (ph > .4) continue;
      const al = (1 - ph / .4) * a;
      ctx.strokeStyle = `rgba(40,30,20,${.5 * al})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - Math.cos(b) * l, cy - Math.sin(b) * l * .5); ctx.lineTo(cx + Math.cos(b) * l, cy + Math.sin(b) * l * .5); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.9 * al})`; ctx.lineWidth = 2.2; ctx.stroke();
    }
  }
  function whirlG(ctx, fx, time) {
    const a = 1 - win(fx.age, 2.2, fx.dur);
    for (const t of fx.tw) {
      ctx.fillStyle = `rgba(40,40,36,${.22 * a})`; ctx.beginPath(); ctx.ellipse(t[0], t[1], 80, 34, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(230,250,240,${.4 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(t[0], t[1], 80, 34, 0, time * 6, time * 6 + 4); ctx.stroke();
    }
    if (fx.burst) { const v = fx.age - 2.2; if (v < .5) for (const t of fx.tw) Kit().fx.shockRing(ctx, t[0], t[1], 170, v / .5, 1 - v / .5, '220,250,240'); }
  }
  function whirlO(ctx, fx, time) {
    const a = fx.age < 2.2 ? Math.min(1, fx.age / .25) : 1 - (fx.age - 2.2) / .35;
    if (a <= 0) return;
    fx.tw.forEach((t, i) => tornado(ctx, t[0], t[1], 26, 78, 190, time + i * .7, a, fx.seed + i * 7, 7, 6));
  }
  function bladeG(ctx, fx, time) {
    const K = Kit(), a = 1 - win(fx.age, 3.4, fx.dur), c = Math.cos(fx.a), s = Math.sin(fx.a);
    const L = Math.hypot(fx.px - fx.x0, fx.py - fx.y0);
    // the ploughed, torn track behind the tornado
    if (L > 20) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(60,48,36,${.3 * a})`; ctx.lineWidth = BLADE_R * 1.2; ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.px, fx.py); ctx.stroke();
      ctx.strokeStyle = `rgba(30,22,16,${.5 * a})`; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const off = (i - 4) * BLADE_R * .14; ctx.moveTo(fx.x0 - s * off, fx.y0 + c * off); ctx.lineTo(fx.x0 + c * L - s * off * 1.2, fx.y0 + s * L + c * off * 1.2); }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(30,30,26,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.px, fx.py, BLADE_R * 1.1, BLADE_R * .5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(240,255,248,${.5 * a})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(fx.px, fx.py, BLADE_R * (1.1 + i * .25), BLADE_R * (.5 + i * .1), 0, -time * 5 + i, -time * 5 + i + 3.4); ctx.stroke(); }
    if (fx.boom) { const v = fx.age - 3.0; if (v < .8) { K.fx.shockRing(ctx, fx.px, fx.py, 420, v / .8, 1 - v / .8, '230,255,245'); dustRing(ctx, fx.px, fx.py, 200 + v * 300, 18, 40, 1 - v / .8, fx.seed); crater(ctx, fx.px, fx.py, 180, a, fx.seed); } }
  }
  function bladeO(ctx, fx, time) {
    const K = Kit(), form = Math.min(1, fx.age / .5), a = fx.age < 3.0 ? form : 1 - (fx.age - 3.0) / .5;
    if (a > 0) {
      const H = 300 + 160 * form;
      tornado(ctx, fx.px, fx.py, 50 * form + 20, 230 * form + 30, H, time, a, fx.seed, 13, 18);
      // blades of wind glinting inside the funnel
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const t = frac(time * .9 + i / 6), yy = fx.py - t * H * .85, rx = lerp(60, 220, t) * form, ph = time * 8 + i * 2.1;
        const bx = fx.px + Math.cos(ph) * rx, by = yy + Math.sin(ph) * rx * .3, b = ph + Math.PI / 2;
        ctx.strokeStyle = `rgba(30,40,40,${.4 * a})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx - Math.cos(b) * 26, by - Math.sin(b) * 8); ctx.lineTo(bx + Math.cos(b) * 26, by + Math.sin(b) * 8); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.95 * a})`; ctx.lineWidth = 2.4; ctx.stroke();
      }
      // Kamatari spinning up inside it, sickle out
      const kt = time * 5, kx = fx.px + Math.cos(kt) * 90 * form, ky = fx.py - H * .55 + Math.sin(kt) * 25;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(kx, ky); ctx.scale(Math.sin(kt) > 0 ? -1 : 1, 1); ctx.rotate(Math.sin(time * 9) * .4);
      ctx.drawImage(kamaSpr(), -60, -62); ctx.restore();
    }
    if (fx.boom) {
      const v = fx.age - 3.0, dust = K.puff('dust');
      if (v < 1) for (let i = 0; i < 16; i++) {
        const an = i * TAU / 16 + fx.seed, d = easeOut(v) * (180 + hash(i) * 220);
        K.stamp(ctx, dust, fx.px + Math.cos(an) * d, fx.py + Math.sin(an) * d * .5 - 20 - v * 60, 50 + v * 50, (1 - v) * .8, .75);
      }
      if (v < .9) K.fx.debris(ctx, fx.px, fx.py, 320, v / .9, fx.seed, '#5a4632', 14);
    }
  }

  // ================================================================== ZABUZA
  function zmistA(fx) { return Math.min(1, fx.age / .5) * (1 - win(fx.age, fx.dur - 1.2, fx.dur)); }
  function zmistG(ctx, fx, time) {
    const a = zmistA(fx), K = Kit(), img = mistSpr();
    ctx.fillStyle = `rgba(214,228,238,${.42 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, MIST_R * Math.min(1, fx.age / .5 + .2), MIST_R * .6, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + time * .05 + fx.seed, d = MIST_R * (.25 + hash(i + fx.seed) * .7);
      K.stamp(ctx, img, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .55, 210 + hash(i * 3) * 90, .72 * a, .55);
    }
  }
  function zmistO(ctx, fx, time) {
    const a = zmistA(fx), K = Kit(), img = mistSpr();
    for (let i = 0; i < 14; i++) {
      const an = i * TAU / 14 - time * .07 + fx.seed * 2, d = MIST_R * (.15 + hash(i * 2.7 + fx.seed) * .8);
      K.stamp(ctx, img, fx.x + Math.cos(an) * d + Math.sin(time * .5 + i) * 30, fx.y + Math.sin(an) * d * .55 - 40 - hash(i) * 50, 170 + hash(i * 5) * 80, .46 * a, .6);
    }
  }
  function zmarkG(ctx, fx, time) {
    // the cleaver's arc marked beside the target: a wedge in front of where he will appear
    const k = clamp01(fx.age / .56);
    markCone(ctx, { x: fx.x, y: fx.y, a: fx.a, len: 270, half: 1.0, faint: 0 }, '215,232,242', k, time);
  }
  function zswingO(ctx, fx, time) {
    const K = Kit(), t = fx.age / (fx.big ? .5 : .38);
    if (t >= 1.6) return;
    const R0 = fx.big ? 260 : 175, span = fx.big ? 2.6 : 2.2, k = easeOut(Math.min(1, t)), a = 1 - win(t, .7, 1.6);
    const a0 = fx.a - span / 2, a1 = a0 + span * k;
    ctx.save(); ctx.translate(fx.x, fx.y - 34); ctx.scale(1, .62); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(16,24,36,${.45 * a})`; ctx.lineWidth = fx.big ? 46 : 34; ctx.beginPath(); ctx.arc(0, 0, R0, a0, a1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(170,210,240,${.6 * a})`; ctx.lineWidth = fx.big ? 34 : 24; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.95 * a})`; ctx.lineWidth = fx.big ? 10 : 7; ctx.beginPath(); ctx.arc(0, 0, R0 + 4, Math.max(a0, a1 - .9), a1); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    if (t < 1) {
      const ex = fx.x + Math.cos(a1) * R0 * .8, ey = fx.y - 34 + Math.sin(a1) * R0 * .5;
      cleaverAt(ctx, ex, ey, a1 + Math.PI / 2, fx.big ? 1.25 : 1, 1);
    }
    if (t < 1.2) splash(ctx, fx.x + Math.cos(fx.a) * R0 * .6, fx.y + Math.sin(fx.a) * R0 * .5, fx.big ? 150 : 90, t / 1.2, fx.seed, .8);
    if (fx.big && t < 1.4) K.fx.debris(ctx, fx.x + Math.cos(fx.a) * 300, fx.y + Math.sin(fx.a) * 300, 200, t / 1.4, fx.seed, '#3a3a40', 12);
  }
  function zrevealO(ctx, fx, time) {
    const K = Kit(), img = mistSpr(), a = 1 - fx.age / fx.dur;
    for (let i = 0; i < 8; i++) { const an = i * TAU / 8; K.stamp(ctx, img, fx.x + Math.cos(an) * (30 + fx.age * 120), fx.y - 40 + Math.sin(an) * 20, 40, .6 * a, .8); }
  }
  function wdragonG(ctx, fx, time) {
    const K = Kit(), u = clamp01((fx.age - .25) / .85);
    // churning water where it rose, and its shadow racing over the ground
    const ra = 1 - win(fx.age, 1.0, 1.6);
    if (ra > 0) { ctx.fillStyle = `rgba(30,110,190,${.3 * ra})`; ctx.beginPath(); ctx.ellipse(fx.x0, fx.y0, 70, 32, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(220,245,255,${.6 * ra})`; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (!fx.hit && fx.age > .25) {
      const q = dragonPos(fx, u);
      ctx.fillStyle = 'rgba(10,40,80,.22)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 60, 22, 0, 0, TAU); ctx.fill();
    }
    if (fx.hit) {
      const v = fx.age - 1.1;
      if (v < 1.2) {
        ctx.fillStyle = `rgba(30,110,190,${.35 * (1 - v / 1.2)})`; ctx.beginPath(); ctx.ellipse(fx.ex, fx.ey, 230, 200, 0, 0, TAU); ctx.fill();
        K.fx.shockRing(ctx, fx.ex, fx.ey, 280, Math.min(1, v / .5), 1 - v / 1.2, '140,215,255');
      }
    }
  }
  function wdragonO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < .25) {
      // the water column twisting up out of the ground
      const k = fx.age / .25, w = K.puff('water');
      for (let i = 0; i < 6; i++) K.stamp(ctx, w, fx.x0 + Math.sin(time * 10 + i) * 14, fx.y0 - i * 18 * k, 26 - i * 2, .85, .9);
      return;
    }
    const u = clamp01((fx.age - .25) / .85), fade = fx.hit ? 1 - clamp01((fx.age - 1.1) / .25) : 1;
    if (fade > 0) {
      // the body: tapered segments trailing behind the head, layered strokes for depth
      const N = 14, P = [];
      for (let k = 0; k <= N; k++) {
        const uk = u - k * .055;
        if (uk < 0) { P.push([fx.x0, fx.y0, (1 + uk / .3) * 40]); continue; }
        const q = dragonPos(fx, uk); P.push([q[0], q[1], q[2]]);
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = fade;
      const passes = [[38, 'rgba(10,50,110,.6)'], [30, '#2a86d8'], [19, '#7cd0ff'], [6, 'rgba(255,255,255,.85)']];
      for (const [w, col] of passes) {
        ctx.strokeStyle = col;
        for (let k = 0; k < N; k++) {
          const t = 1 - k / N, a0 = P[k], a1 = P[k + 1];
          ctx.lineWidth = w * (.35 + .65 * t);
          ctx.beginPath(); ctx.moveTo(a0[0], a0[1] - a0[2]); ctx.lineTo(a1[0], a1[1] - a1[2] + (w === 6 ? -w : 0)); ctx.stroke();
        }
      }
      // dorsal fins
      ctx.fillStyle = '#bfe8ff'; ctx.strokeStyle = 'rgba(10,50,110,.8)'; ctx.lineWidth = 2;
      for (let k = 2; k < N - 2; k += 3) {
        const a0 = P[k], a1 = P[k + 1], an = Math.atan2((a1[1] - a1[2]) - (a0[1] - a0[2]), a1[0] - a0[0]), mx = a0[0], my = a0[1] - a0[2];
        const sz = 16 * (1 - k / N);
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(an - 2.3) * sz * 1.6, my + Math.sin(an - 2.3) * sz * 1.6 - sz); ctx.lineTo(mx + Math.cos(an) * sz, my + Math.sin(an) * sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // spray behind the head
      const w = K.puff('water');
      for (let i = 0; i < 6; i++) { const q = P[Math.min(N, 1 + i * 2)]; K.stamp(ctx, w, q[0] + (hash(i + (time * 9 | 0)) - .5) * 30, q[1] - q[2] + (hash(i * 3) - .5) * 20, 10 + i * 2, .6, .9); }
      // the head
      const h0 = P[0], h1 = P[1], an = Math.atan2((h0[1] - h0[2]) - (h1[1] - h1[2]), h0[0] - h1[0]);
      ctx.save(); ctx.translate(h0[0], h0[1] - h0[2]); ctx.rotate(an); if (Math.cos(an) < 0) ctx.scale(1, -1);
      ctx.drawImage(dragonHeadSpr(), -34, -40);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, h0[0], h0[1] - h0[2], 70, '90,190,255', .3); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (fx.hit) { const v = fx.age - 1.1; if (v < .9) splash(ctx, fx.ex, fx.ey, 230, v / .9, fx.seed); }
  }
  function zprisonG(ctx, fx, time) {
    const a = 1 - win(fx.age, 2.9, fx.dur), k = easeOut(fx.age / .3);
    ctx.fillStyle = `rgba(30,110,190,${.32 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, PRISON_R * k, PRISON_R * .6 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(220,245,255,${.55 * a})`; ctx.lineWidth = 3; ctx.stroke();
    if (fx.pop) { const v = fx.age - 2.6; if (v < .5) Kit().fx.shockRing(ctx, fx.x, fx.y, 280, v / .5, 1 - v / .5, '130,210,255'); }
  }
  function zprisonO(ctx, fx, time, z) {
    const K = Kit(), x = fx.x, y = fx.y - 52, w = K.puff('water');
    if (fx.age < 2.6) {
      const k = easeBack(fx.age / .32), r = 112 * k;
      if (fx.age < .4) for (let i = 0; i < 8; i++) {
        const an = i * TAU / 8 + fx.age * 8, rr = PRISON_R * (1 - fx.age / .4);
        K.stamp(ctx, w, x + Math.cos(an) * rr, fx.y + Math.sin(an) * rr * .5 - fx.age * 120, 20, .8, .8);
      }
      K.stamp(ctx, waterBall(), x, y, r, .95, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,240,255,.5)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, r * (.95 - i * .2), r * .3, time * (1.4 + i * .4) + i, 0, TAU); ctx.stroke(); }
      K.glow(ctx, x, y, r * 1.3, '80,180,255', .25);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(240,252,255,.85)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < (fx.caught ? 12 : 6); i++) {
        const ph = frac(time * .9 + hash(i + fx.seed)), bx = x + (hash(i * 3 + fx.seed) - .5) * r * 1.2, by = y + r * .7 - ph * r * 1.4;
        ctx.beginPath(); ctx.arc(bx + Math.sin(time * 4 + i) * 4, by, 2.5 + hash(i) * 4, 0, TAU); ctx.stroke();
      }
      // Zabuza's arm sunk into the sphere: a water channel from his hand
      if (z) {
        const f = fx.x >= z.x ? 1 : -1, hx = z.x + f * 16, hy = z.y - HEIGHT(z) * .5;
        ctx.strokeStyle = 'rgba(20,80,150,.5)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x - f * r * .7, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(180,235,255,.8)'; ctx.lineWidth = 4; ctx.stroke();
      }
      // the water clone guarding the prison: rises and cleaves twice
      const ca = fx.age - .6;
      if (ca > 0) {
        const cx = fx.x + (fx.x - fx.zx) * .9 + 30, cy = fx.y + (fx.y - fx.zy) * .9, cf = cx > fx.x ? -1 : 1;
        const swing = fx.c > 0 && ((fx.age - 1.0) % .8) < .25;
        waterClone(ctx, cx, cy, cf, swing ? 'attack' : 'idle', Math.min(1, ca / .3), time);
        if (swing) { const st = (fx.age - 1.0) % .8; zswingO(ctx, { x: cx, y: cy, a: Math.atan2(fx.y - cy, fx.x - cx), big: 0, age: st, seed: fx.seed }, time); }
      }
      return;
    }
    const v = fx.age - 2.6;
    if (v < .8) splash(ctx, fx.x, fx.y, 210, v / .8, fx.seed);
  }
  function zclonesG(ctx, fx, time) {
    for (const c of fx.cl) {
      const t = fx.age - c[2];
      if (t < 0) continue;
      const ra = 1 - win(t, 1.2, 1.8);
      if (ra > 0) { ctx.fillStyle = `rgba(30,110,190,${.3 * ra})`; ctx.beginPath(); ctx.ellipse(c[0], c[1], 50, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(220,245,255,${.55 * ra})`; ctx.lineWidth = 2; ctx.stroke(); }
      if (c[3] === 1) markLine(ctx, { x: c[0], y: c[1], a: c[6], len: Math.hypot(c[4] - c[0], c[5] - c[1]), w: 52, faint: 1 }, '140,210,255', clamp01((t - .3) / .32), time);
      if (c[3] === 2) { const v = fx.age - c[7]; if (v < 1.2) { ctx.strokeStyle = `rgba(20,60,110,${.3 * (1 - v / 1.2)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[4], c[5]); ctx.stroke(); } }
    }
  }
  function zclonesO(ctx, fx, time) {
    const K = Kit(), w = K.puff('water');
    for (const c of fx.cl) {
      const t = fx.age - c[2];
      if (t < 0) continue;
      const f = c[3] ? (Math.cos(c[6]) >= 0 ? 1 : -1) : 1;
      if (c[3] < 2) {
        // rising out of a puddle
        const k = clamp01(t / .3);
        for (let i = 0; i < 4; i++) K.stamp(ctx, w, c[0] + (hash(i) - .5) * 30, c[1] - i * 16 * k, 22 - i * 3, .7 * (1 - k * .6), .9);
        waterClone(ctx, c[0], c[1] + (1 - k) * 30, f, c[3] === 1 ? 'seal' : 'idle', k, time);
      } else {
        const v = fx.age - c[7];
        if (v < .14) { const k = easeOut(v / .14); waterClone(ctx, lerp(c[0], c[4], k), lerp(c[1], c[5], k), f, 'attack', 1, time); }
        if (v < .4) slashStreak(ctx, c[0], c[1], c[4], c[5], 24, 1 - v / .4, '150,215,255', 40);
        if (v >= .14 && v < .8) splash(ctx, c[4], c[5], 90, (v - .14) / .66, fx.seed + c[2] * 10);
      }
    }
  }
  function zthrowG(ctx, fx, time) {
    ctx.fillStyle = 'rgba(14,18,26,.25)'; ctx.beginPath(); ctx.ellipse(fx.bx, fx.by, 70, 22, 0, 0, TAU); ctx.fill();
    if (fx.w) { const v = fx.age - .55; if (v < .6) { const ex = fx.x0 + Math.cos(fx.a) * fx.len, ey = fx.y0 + Math.sin(fx.a) * fx.len; cracks(ctx, ex, ey, 100, 7, fx.seed, 1 - v / .6); } }
  }
  function zthrowO(ctx, fx, time) {
    if (fx.age >= 1.25) return;
    const spin = fx.age * 22 * (Math.cos(fx.a) >= 0 ? 1 : -1), y = fx.by - 40;
    // motion-blur ghosts at the previous angles, then the blade
    for (let i = 3; i >= 1; i--) cleaverAt(ctx, fx.bx, y, spin - i * .35, 1.05, .18 * (4 - i) / 3);
    cleaverAt(ctx, fx.bx, y, spin, 1.05, 1);
    ctx.save(); ctx.translate(fx.bx, y); ctx.scale(1, .5); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(16,24,36,.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 86, spin, spin + 2.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,250,255,.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
  function zfallG(ctx, fx, time) {
    const K = Kit(), k = easeOut(clamp01((fx.age - .45) / .4)), a = 1 - win(fx.age, 3.0, fx.dur);
    if (fx.age < .45) return;
    // a swirling flood: deep water, foam spirals, a churning white ring
    ctx.fillStyle = `rgba(24,96,176,${.4 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, FALL_R * k, FALL_R * .86 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(10,50,110,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, FALL_R * .45 * k, FALL_R * .38 * k, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? `rgba(235,250,255,${.8 * a})` : `rgba(10,60,120,${.4 * a})`; ctx.lineWidth = pass ? 3 : 7;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const b = s * TAU / 6 - time * 2.2;
        for (let i = 0; i <= 14; i++) {
          const t = i / 14, an = b + t * 3.2, r = FALL_R * k * (.95 - t * .85);
          const px = fx.x + Math.cos(an) * r, py = fx.y + Math.sin(an) * r * .86;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
      }
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${.6 * a})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(fx.x, fx.y, FALL_R * k, FALL_R * .86 * k, 0, time * 3, time * 3 + 5); ctx.stroke();
    if (fx.cut) {
      const v = fx.age - 2.6;
      if (v < 1.2) {
        const ex = fx.cx + Math.cos(fx.ca) * 700, ey = fx.cy + Math.sin(fx.ca) * 700;
        ctx.strokeStyle = `rgba(20,30,40,${.45 * (1 - v / 1.2)})`; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(fx.cx, fx.cy); ctx.lineTo(ex, ey); ctx.stroke();
        K.fx.shockRing(ctx, fx.x, fx.y, FALL_R * 1.1, Math.min(1, v / .5), 1 - v / 1.2, '170,225,255');
      }
    }
  }
  function zfallO(ctx, fx, time) {
    const K = Kit(), w = K.puff('water'), a = 1 - win(fx.age, 3.0, fx.dur);
    // the torrent: a huge arcing wall of water from behind Zabuza crashing onto the target
    if (fx.age < .95) {
      const k = clamp01(fx.age / .6), mx = (fx.sx + fx.x) / 2, my = Math.min(fx.sy, fx.y) - 420;
      const ex = lerp(fx.sx, fx.x, k), ey = lerp(fx.sy, fx.y, k);
      ctx.lineCap = 'round';
      const passes = [[110, 'rgba(10,50,110,.5)'], [86, 'rgba(40,140,230,.85)'], [52, 'rgba(140,215,255,.9)'], [14, 'rgba(255,255,255,.85)']];
      const fade = 1 - win(fx.age, .6, .95);
      ctx.globalAlpha = fade;
      for (const [lw, col] of passes) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(fx.sx, fx.sy - 30);
        const N = 16;
        for (let i = 1; i <= N; i++) {
          const t = i / N * k, bx = (1 - t) * (1 - t) * fx.sx + 2 * (1 - t) * t * mx + t * t * fx.x, by = (1 - t) * (1 - t) * (fx.sy - 30) + 2 * (1 - t) * t * my + t * t * (fx.y - 40);
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) K.stamp(ctx, w, ex + (hash(i * 3 + (time * 10 | 0)) - .5) * 120, ey - 60 - hash(i) * 120, 30 + hash(i * 7) * 30, .7 * fade, .9);
    }
    if (fx.age >= .45 && fx.age < 3.0) {
      const k = easeOut(clamp01((fx.age - .45) / .4));
      // falling sheets of water around the rim, foam crowns where they land
      for (let i = 0; i < 10; i++) {
        const an = i * TAU / 10 + fx.seed + time * .4, px = fx.x + Math.cos(an) * FALL_R * .85 * k, py = fx.y + Math.sin(an) * FALL_R * .73 * k;
        const h = 230 + hash(i) * 120;
        ctx.strokeStyle = `rgba(20,80,150,${.35 * a})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(px, py - h); ctx.lineTo(px, py); ctx.stroke();
        ctx.strokeStyle = `rgba(170,230,255,${.55 * a})`; ctx.lineWidth = 16; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.7 * a})`; ctx.lineWidth = 3;
        ctx.beginPath(); for (let j = 0; j < 3; j++) { const o = (j - 1) * 6, ph = frac(time * 2.5 + j * .3 + i * .1); ctx.moveTo(px + o, py - h + ph * h * .5); ctx.lineTo(px + o, py - h + ph * h * .5 + h * .4); } ctx.stroke();
        K.stamp(ctx, w, px, py - 12, 30 + Math.sin(time * 9 + i) * 6, .85 * a, .7);
      }
      // spray mist and swirling flotsam over the vortex
      for (let i = 0; i < 10; i++) {
        const an = i * TAU / 10 - time * 2.4, d = FALL_R * k * (.3 + hash(i * 3.3) * .55);
        K.stamp(ctx, w, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .86 - 30 - hash(i) * 40, 24 + hash(i * 2) * 20, .55 * a, .8);
      }
      K.fx.debris(ctx, fx.x, fx.y, FALL_R * .8, frac(fx.age * .8), fx.seed, '#4a3a2c', 12);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, FALL_R * .7, '80,170,255', .18 * a, false, .8); ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ================================================================== HAKU
  function ndlO(ctx, fx) { needleDraw(ctx, fx, fx.n, fx.spd, fx.st); }
  function tneedleG(ctx, fx, time) {
    const a = 1 - win(fx.age, 1.1, fx.dur);
    ctx.fillStyle = `rgba(190,235,255,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, NEEDLE_R, NEEDLE_R * .86, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,90,140,${.5 * a})`; ctx.lineWidth = 3; ctx.stroke();
    if (fx.hit) { const v = fx.age - .62; if (v < .5) Kit().fx.shockRing(ctx, fx.x, fx.y, 260, v / .5, 1 - v / .5, '200,240,255'); }
  }
  function tneedleO(ctx, fx, time) {
    const K = Kit(), N = 64;
    if (fx.age < .66) {
      const conv = clamp01((fx.age - .45) / .17), a = Math.min(1, fx.age / .2);
      const r = NEEDLE_R * (1 - easeIn(conv)) + 8;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? `rgba(230,250,255,${a})` : `rgba(16,50,90,${.8 * a})`; ctx.lineWidth = pass ? 2.2 : 5;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const an = i * TAU / N + fx.seed + (1 - conv) * fx.age * .6, lift = 14 + hash(i * 3.1) * 70 * (1 - conv), rr = r * (.85 + hash(i * 1.7) * .25);
          const px = fx.x + Math.cos(an) * rr, py = fx.y + Math.sin(an) * rr * .86 - lift, c = -Math.cos(an), s = -Math.sin(an) * .86;
          ctx.moveTo(px, py); ctx.lineTo(px - c * 32, py - s * 32);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, fx.x, fx.y - 30, NEEDLE_R * .9, '150,220,255', .18 * a, false, .9);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const v = (fx.age - .62) / .8;
    shards(ctx, fx.x, fx.y - 30, 200, v, fx.seed, 22);
    ctx.globalCompositeOperation = 'lighter';
    if (v < .4) K.glow(ctx, fx.x, fx.y - 30, 120, '220,250,255', 1 - v / .4, true);
    ctx.globalCompositeOperation = 'source-over';
  }
  function swalO(ctx, fx, time) {
    const K = Kit(), img = swallowSpr();
    for (const s of fx.sw) {
      if (fx.age < s[4]) continue;
      if (s[3]) {
        const v = (fx.age - s[3]) / .45;
        if (v < 1) { shards(ctx, s[0], s[1] - 26, 70, v, s[4] * 100, 8); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, s[0], s[1] - 26, 40, '200,240,255', 1 - v, true); ctx.globalCompositeOperation = 'source-over'; }
        continue;
      }
      const c = Math.cos(s[2]), sn = Math.sin(s[2]), x = s[0], y = s[1] - 30 - Math.sin(time * 9 + s[4] * 20) * 4;
      ctx.strokeStyle = 'rgba(20,60,100,.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - c * 10, y - sn * 10); ctx.lineTo(x - c * 60, y - sn * 60); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,250,255,.75)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(s[2]); if (c < 0) ctx.scale(1, -1);
      ctx.scale(1.45, 1.45); ctx.drawImage(img, -28, -20 + Math.sin(time * 30 + s[4] * 40) * 1.5);
      ctx.restore();
    }
  }
  function ispkG(ctx, fx, time) {
    const a = 1 - win(fx.age, 1.8, fx.dur);
    for (const l of fx.lanes) {
      const front = Math.min(l.len, fx.age * SPIKE_SPD), c = Math.cos(l.a), s = Math.sin(l.a);
      ctx.strokeStyle = `rgba(200,240,255,${.45 * a})`; ctx.lineWidth = 60; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x + c * 60, fx.y + s * 60); ctx.lineTo(fx.x + c * front, fx.y + s * front); ctx.stroke();
      ctx.strokeStyle = `rgba(30,90,140,${.35 * a})`; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  function ispkO(ctx, fx, time) {
    const K = Kit();
    const pts = [];
    for (let li = 0; li < fx.lanes.length; li++) {
      const l = fx.lanes[li], c = Math.cos(l.a), s = Math.sin(l.a);
      for (let d = 70, i = 0; d <= l.len + 30; d += 62, i++) {
        const t0 = d / SPIKE_SPD, t = fx.age - t0;
        if (t < 0) break;
        const off = (hash(i * 3.7 + li * 11 + fx.seed) - .5) * 44, px = fx.x + c * d - s * off, py = fx.y + s * d + c * off;
        pts.push([px, py, t, i + li * 7, d > l.len ? 1.5 : 1]);
      }
    }
    pts.sort((u, v) => u[1] - v[1]);
    for (const [px, py, t, i, big] of pts) {
      const grow = easeBack(Math.min(1, t / .14)), end = 1 - win(fx.age, 1.9, 2.3), sc = (.7 + hash(i * 1.3) * .5) * big;
      if (end <= 0) continue;
      const img = iceSpr(i);
      ctx.save(); ctx.globalAlpha = end; ctx.translate(px, py); ctx.scale(sc, sc * grow);
      ctx.drawImage(img, -24, -92); ctx.restore();
    }
    ctx.globalAlpha = 1;
    const sh = fx.age - 1.9;
    if (sh > 0 && sh < .6) for (const l of fx.lanes) shards(ctx, fx.x + Math.cos(l.a) * l.len * .6, fx.y + Math.sin(l.a) * l.len * .6 - 30, l.len * .45, sh / .6, l.a * 10, 14);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of fx.lanes) { const front = Math.min(l.len, fx.age * SPIKE_SPD); if (fx.age * SPIKE_SPD < l.len + 60) K.glow(ctx, fx.x + Math.cos(l.a) * front, fx.y + Math.sin(l.a) * front - 30, 60, '200,240,255', .6, true); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // An ice mirror standing at (x, y) (base), with Haku's reflection inside it.
  function mirrorAt(ctx, x, y, rise, f, frame, alpha, refl, time) {
    if (alpha <= .01 || rise <= .01) return;
    const S = Spr(), h = 112 * rise;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(mirrorSpr(), x - 30, y - h - 4, 60, h);
    if (refl > 0 && S && rise > .6) {
      ctx.save(); ctx.beginPath(); ctx.rect(x - 25, y - h + 1, 50, h - 10); ctx.clip();
      S.draw(ctx, 'haku', x, y - 8, { facing: f, frame, alpha: alpha * refl * .7 });
      ctx.restore();
    }
    ctx.drawImage(mirrorSheen(), x - 30, y - h - 4, 60, h);
    ctx.restore();
  }
  function stepO(ctx, fx, time) {
    const K = Kit(), ra = fx.age < .55 ? Math.min(1, fx.age / .2) : 1 - win(fx.age, .55, .8);
    const rb = fx.age < 1.05 ? Math.min(1, fx.age / .25) : 0, fa = fx.mx >= fx.ax ? 1 : -1;
    mirrorAt(ctx, fx.ax, fx.ay, easeBack(Math.min(1, fx.age / .2)), fa, 'seal', ra, fx.age > .2 && fx.age < .45 ? 1 : 0, time);
    mirrorAt(ctx, fx.mx, fx.my, easeBack(Math.min(1, fx.age / .25)), fa, 'idle', rb, fx.age > .3 && fx.age < .5 ? 1 : 0, time);
    if (fx.age >= 1.05) {
      const v = (fx.age - 1.05) / .6;
      shards(ctx, fx.mx, fx.my - 56, 160, v, fx.seed, 18);
      ctx.globalCompositeOperation = 'lighter'; if (v < .4) K.glow(ctx, fx.mx, fx.my - 56, 90, '220,250,255', 1 - v / .4, true); ctx.globalCompositeOperation = 'source-over';
    }
    needleDraw(ctx, fx, fx.n, 1300, 1);
  }
  function mirrorsG(ctx, fx, time) {
    const K = Kit(), a = 1 - win(fx.age, 4.0, fx.dur), k = easeOut(Math.min(1, fx.age / .5));
    ctx.fillStyle = `rgba(200,240,255,${.3 * a})`; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, (MIRROR_R + 30) * k, (MIRROR_R + 30) * .9 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(30,90,140,${.45 * a})`; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.55 * a})`; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const an = i * TAU / 12 + fx.seed; ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(an) * MIRROR_R * k, fx.y + Math.sin(an) * MIRROR_R * .9 * k); }
    ctx.stroke();
    if (fx.end) { const v = fx.age - 3.95; if (v < .8) { K.fx.shockRing(ctx, fx.x, fx.y, MIRROR_R * 1.5, v / .8, 1 - v / .8, '210,245,255'); K.fx.shockRing(ctx, fx.x, fx.y, MIRROR_R, Math.min(1, v / .5), 1 - v / .8, '255,255,255'); } }
  }
  function mirrorsO(ctx, fx, time) {
    const K = Kit();
    if (fx.age < 3.95) {
      // mirrors behind the centre first, front ones last, so the dome reads in depth
      const order = [];
      for (let i = 0; i < MIRROR_N; i++) order.push(i);
      order.sort((u, v) => Math.sin(u * TAU / MIRROR_N) - Math.sin(v * TAU / MIRROR_N));
      for (const i of order) {
        const an = i * TAU / MIRROR_N, mx = fx.x + Math.cos(an) * MIRROR_R, my = fx.y + Math.sin(an) * MIRROR_R, t0 = i * .03;
        const rise = easeBack(clamp01((fx.age - t0) / .3));
        // which mirror holds the real Haku right now: his image is sharp there, the rest are faint copies
        let refl = .35, frame = 'idle';
        for (const fl of fx.fl) if (fl[0] === i && fx.age - fl[1] < .25) { refl = 1; frame = 'attack'; }
        const f = Math.cos(an) > 0 ? -1 : 1;
        mirrorAt(ctx, mx, my, rise, f, frame, 1, fx.age > .5 ? refl : 0, time);
        if (refl === 1) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, mx, my - 56, 50, '200,240,255', .55, true); ctx.globalCompositeOperation = 'source-over'; }
      }
      // cold mist rolling inside the dome
      const img = mistSpr();
      for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + time * .3, d = MIRROR_R * .5; K.stamp(ctx, img, fx.x + Math.cos(an) * d, fx.y + Math.sin(an) * d * .8 - 20, 90, .18, .5); }
    } else {
      const v = (fx.age - 3.95) / .9;
      for (let i = 0; i < MIRROR_N; i += 2) { const an = i * TAU / MIRROR_N; shards(ctx, fx.x + Math.cos(an) * MIRROR_R, fx.y + Math.sin(an) * MIRROR_R - 56, 150, v, i * 3 + fx.seed, 10); }
      ctx.globalCompositeOperation = 'lighter'; if (v < .35) K.glow(ctx, fx.x, fx.y - 50, MIRROR_R * 1.2, '220,250,255', (1 - v / .35) * .8, true); ctx.globalCompositeOperation = 'source-over';
    }
    needleDraw(ctx, fx, fx.n, 1500, 1);
  }

  // ------------------------------------------------------------------ dispatch
  const FX = {
    karasu: [karasuG, karasuO], poison: [poisonG, poisonO], kuroari: [kuroariG, kuroariO], sansho: [sanshoG, sanshoO],
    sasori: [sasoriG, sasoriO], maiden: [maidenG, maidenO],
    cut: [cutG, cutO], gust: [gustG, gustO], kama: [kamaG, kamaO], dust: [dustG, dustO], whirl: [whirlG, whirlO], blade: [bladeG, bladeO],
    zmist: [zmistG, zmistO], zmark: [zmarkG, null], zswing: [null, zswingO], zreveal: [null, zrevealO], wdragon: [wdragonG, wdragonO],
    zprison: [zprisonG, zprisonO], zclones: [zclonesG, zclonesO], zthrow: [zthrowG, zthrowO], zfall: [zfallG, zfallO],
    ndl: [null, ndlO], tneedle: [tneedleG, tneedleO], swal: [null, swalO], ispk: [ispkG, ispkO], step: [null, stepO], mirrors: [mirrorsG, mirrorsO]
  };

  // Windup at the caster: a chakra aura, plus the jutsu's own tell.
  function windupG(ctx, z, st, time) {
    const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb, K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, z.y, 70 + 50 * k, rgb, .3 + .25 * k, false, .45);
    ctx.globalCompositeOperation = 'source-over';
    if (z.bossId === 'zabuza') {
      // water gathering round his feet
      ctx.strokeStyle = `rgba(200,240,255,${.6 * k})`; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(z.x, z.y, 40 + i * 22 + k * 20, 16 + i * 8, 0, time * (3 + i) + i, time * (3 + i) + i + 3.6); ctx.stroke(); }
    } else if (z.bossId === 'haku' && st.move === 'needles') {
      // the water round the target lifting into droplets before it freezes
      ctx.fillStyle = `rgba(40,130,210,${.3 * k})`; ctx.beginPath(); ctx.ellipse(st.tx, st.ty, NEEDLE_R, NEEDLE_R * .86, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(220,245,255,${.7 * k})`; ctx.lineWidth = 2; ctx.stroke();
    } else if (z.bossId === 'temari') {
      dustRing(ctx, z.x, z.y, 50 + 40 * k, 8, 18, .6 * k, (time * 6) | 0, 4);
    }
  }
  function windupO(ctx, z, st, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, f = faceOf(st.aim), H = HEIGHT(z);
    const hx = z.x + f * 16, hy = z.y - H * .52;
    if (z.bossId === 'kankuro') {
      // chakra threads flaring off the fingers, Karasu's bandages unwinding behind him
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(150,220,255,${.5 + .4 * k})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + (i - 3.5) * .35 + Math.sin(time * 6 + i) * .1, l = 40 + 80 * k; ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + Math.cos(an) * l * .5 + f * 20, hy + Math.sin(an) * l * .5, hx + Math.cos(an) * l, hy + Math.sin(an) * l); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(228,220,203,.9)'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) { const ph = time * 5 + i * 2; ctx.beginPath(); ctx.moveTo(z.x - f * 10, z.y - H * .6); ctx.bezierCurveTo(z.x - f * (30 + 20 * k), z.y - H * .8 + Math.sin(ph) * 20, z.x - f * (50 + 30 * k), z.y - H * .4 + Math.cos(ph) * 20, z.x - f * (70 + 40 * k), z.y - H * .7 + Math.sin(ph + 1) * 30); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 30 + 30 * k, '150,200,255', .6 * k, true); ctx.globalCompositeOperation = 'source-over';
    } else if (z.bossId === 'temari') {
      // the war fan opens and rises, wind spiralling into it
      const open = easeOut(Math.min(1, k * 1.6)), rot = -.6 + .5 * k;
      fanAt(ctx, hx + f * 6, hy + 10, f, rot, .32 + .2 * open, 1);
      ctx.strokeStyle = `rgba(240,255,250,${.7 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const an = time * 7 + i * TAU / 5, r = 70 - 40 * frac(time * 1.5 + i / 5); ctx.moveTo(hx + f * 20 + Math.cos(an) * r, hy - 20 + Math.sin(an) * r * .5); ctx.arc(hx + f * 20, hy - 20, r, an, an + 1.2); }
      ctx.stroke();
    } else if (z.bossId === 'zabuza') {
      const mist = mistSpr();
      for (let i = 0; i < 5; i++) K.stamp(ctx, mist, z.x + (hash(i) - .5) * 70, z.y - 20 - frac(time * .8 + i / 5) * 80, 30 + 10 * k, .35 * k, .8);
      if (st.move === 'throw' || st.move === 'fall') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, z.x - f * 10, z.y - H * .8, 30 + 30 * k, '220,240,255', .7 * k, true); ctx.globalCompositeOperation = 'source-over'; }
      if (st.move === 'dragon' || st.move === 'fall' || st.move === 'prison') {
        const w = K.puff('water');
        for (let i = 0; i < 6; i++) { const an = time * 4 + i * TAU / 6; K.stamp(ctx, w, z.x + Math.cos(an) * (60 - 30 * k), z.y - 30 + Math.sin(an) * 20 - k * 30, 12 + 8 * k, .55 + .3 * k, .8); }
      }
    } else {
      // frost crystals orbiting Haku's one-handed seal, cold breath
      ctx.strokeStyle = `rgba(230,250,255,${.9 * k})`; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const an = time * 3 + i * TAU / 6, r = 30 + 14 * k, cx = z.x + Math.cos(an) * r, cy = hy + Math.sin(an) * r * .5, s = 4 + 3 * k;
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.moveTo(cx - s * .7, cy - s * .7); ctx.lineTo(cx + s * .7, cy + s * .7);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 24 + 26 * k, '180,235,255', .7 * k, true); ctx.globalCompositeOperation = 'source-over';
    }
  }

  function label(ctx, z, st, m) {
    const move = st.windup > 0 && st.move ? st.move : st.hold > 0 ? st.holdMove : '';
    if (!move || !MOVES[move] || st.hide > 0) return;
    const top = z.y - HEIGHT(z) - 32;
    ctx.save();
    ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#10121a'; ctx.strokeText(MOVES[move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[move].label, z.x, top);
    ctx.restore();
  }

  // When the boss dies the game stops calling update; keep its effects playing out.
  function visualAge(z, st, time) {
    const dt = st.lastDraw ? Math.max(0, Math.min(.1, time - st.lastDraw)) : 0;
    st.lastDraw = time;
    if (z.health > 0 || !dt) return;
    st.windup = 0; st.move = ''; st.hold = 0; st.hide = 0;
    for (let i = st.fx.length - 1; i >= 0; i--) { st.fx[i].age += dt; if (st.fx[i].age >= st.fx[i].dur) st.fx.splice(i, 1); }
    for (let i = st.patches.length - 1; i >= 0; i--) if ((st.patches[i].life -= dt) <= 0) st.patches.splice(i, 1);
    st.ghosts.length = 0;
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.sk;
    if (!m || !st || !Kit()) return;
    visualAge(z, st, time);
    if (!st.fx.length && !st.patches.length && !(st.windup > 0) && z.health <= 0) return;
    ctx.save();
    if (st.patches.length) patchesG(ctx, st, time);
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[0]) { f[0](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && st.windup > 0 && st.move) {
      const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
      for (const s of st.tele) {
        if (s.k === 'c') markCircle(ctx, s.follow ? z.x : s.x, s.follow ? z.y : s.y, s.r, rgb, k, time, s.faint, s.small);
        else if (s.k === 'line') markLine(ctx, s, rgb, k, time);
        else if (s.k === 'cone') markCone(ctx, s, rgb, k, time);
      }
      windupG(ctx, z, st, time);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.sk;
    if (!m || !st || !Kit()) return;
    ctx.save();
    if (st.patches.length) patchesO(ctx, st, time);
    for (const fx of st.fx) {
      const f = FX[fx.kind];
      if (f && f[1]) { f[1](ctx, fx, time, z.health > 0 ? z : null); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    const S = Spr();
    if (S && st.ghosts.length) {
      for (const g of st.ghosts) S.draw(ctx, z.bossId, g.x, g.y + 3, { facing: g.f, frame: 'attack', alpha: (g.m ? .5 : .38) * (1 - g.age / .32) });
      ctx.globalAlpha = 1;
    }
    if (z.health > 0 && !hidden(z)) {
      if (st.windup > 0 && st.move) { windupO(ctx, z, st, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      // Temari keeps the fan swung out while her wind jutsu blow
      if (z.bossId === 'temari' && st.hold > 0 && st.holdMove) {
        const f = faceOf(st.aim), H = HEIGHT(z), sw = Math.min(1, (MOVES[st.holdMove].windup + 1 - st.hold) * 3);
        fanAt(ctx, z.x + f * 22, z.y - H * .48, f, -.1 + .9 * easeOut(sw), .5, 1);
      }
      label(ctx, z, st, m);
    }
    ctx.restore();
  }

  function hidden(z) { const st = z.sk; return !!(st && st.hide > 0 && !(st.show > 0)); }

  window.SunaKiriBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, hidden, moves };
})();
