(() => {
  'use strict';

  // The Hokage of the Leaf as spawnable enemies: the first four brought back by Edo Tensei, Tsunade and
  // Kakashi. Same contract as kage-bosses.js: update(z, dt, api) drives the jutsu, draw(ctx, z, time) paints
  // telegraphs and ground effects (and the giants that stand behind the boss: the Kannon statue, the
  // Shinigami, Kurama, Susanoo), drawOverlay(ctx, z, time) paints what flies above the characters.
  // All per-boss state lives on z.hk; the body is an AnimeSprites character drawn by the game.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const easeInOut = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const outBack = t => { t = clamp01(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const Kit = () => window.VFXKit;
  const LIFT = () => (window.AnimeSprites ? window.AnimeSprites.LIFT : 24);
  const FB = 114 / 128; // flame sprite base

  const order = ['hashirama', 'tobirama', 'hiruzen', 'minato', 'tsunade', 'kakashi'];
  const members = {
    hashirama: { name: 'HASHIRAMA SENJU — SHODAI HOKAGE', accent: '#7ccf52', hpScale: 3.9, damageScale: 2.05, armor: .65, regen: .006, edo: true,
      moves: ['h_dragon', 'h_forest', 'h_golem', 'h_pollen', 'h_dragon', 'h_kannon'] },
    tobirama: { name: 'TOBIRAMA SENJU — NIDAIME HOKAGE', accent: '#5ab4ff', hpScale: 3.1, damageScale: 1.95, armor: .8, edo: true,
      moves: ['t_dragon', 't_slash', 't_wall', 't_edo', 't_tags', 't_flood'] },
    hiruzen: { name: 'SARUTOBI HIRUZEN — SANDAIME HOKAGE', accent: '#ff9a4a', hpScale: 2.9, damageScale: 1.9, armor: .85, edo: true,
      moves: ['s_fire', 's_shuriken', 's_enma', 's_wall', 's_fire', 's_reaper'] },
    minato: { name: 'NAMIKAZE MINATO — YONDAIME HOKAGE', accent: '#ffd84a', hpScale: 3.3, damageScale: 2.05, armor: .8, edo: true,
      moves: ['m_web', 'm_rasengan', 'm_cloak', 'm_nidan', 'm_web', 'm_kurama'] },
    tsunade: { name: 'TSUNADE — GODAIME HOKAGE', accent: '#8fe06a', hpScale: 3.4, damageScale: 2.0, armor: .75,
      moves: ['ts_punch', 'ts_heel', 'ts_boulders', 'ts_katsuyu', 'ts_byakugo', 'ts_meteor'] },
    kakashi: { name: 'HATAKE KAKASHI — ROKUDAIME HOKAGE', accent: '#7fc0ff', hpScale: 3.1, damageScale: 1.95, armor: .85,
      moves: ['k_raikiri', 'k_kamui', 'k_hound', 'k_ninken', 'k_water', 'k_shiden', 'k_susanoo'] }
  };
  // windup = dodge window before the jutsu lands (s); after = pause before the next one.
  const MOVES = {
    h_dragon:   { label: 'MỘC ĐỘN · MỘC LONG CHI THUẬT', rgb: '150,220,100', windup: .95, after: 1.5 },
    h_forest:   { label: 'MỘC ĐỘN · THỤ GIỚI GIÁNG ĐẢN', rgb: '130,220,90', windup: 1.1, after: 2.0 },
    h_golem:    { label: 'MỘC ĐỘN · MỘC NHÂN CHI THUẬT', rgb: '214,170,110', windup: .9, after: 2.9 },
    h_pollen:   { label: 'MỘC ĐỘN · HOA THỤ GIỚI GIÁNG LÂM', rgb: '255,170,210', windup: 1.0, after: 2.4 },
    h_kannon:   { label: 'TIÊN PHÁP · MỘC ĐỘN · CHÂN SỐ THIÊN THỦ', rgb: '255,210,120', windup: 1.5, after: 3.8 },
    t_dragon:   { label: 'THỦY ĐỘN · THỦY LONG ĐẠN', rgb: '120,200,255', windup: .85, after: 1.4 },
    t_slash:    { label: 'PHI LÔI THẦN TRẢM', rgb: '170,225,255', windup: .6, after: 1.4 },
    t_wall:     { label: 'THỦY ĐỘN · THỦY TRẬN BÍCH', rgb: '120,200,255', windup: .7, after: 1.6 },
    t_edo:      { label: 'UẾ THỔ CHUYỂN SINH', rgb: '190,140,255', windup: 1.0, after: 2.2 },
    t_tags:     { label: 'BẠO PHÙ · LIÊN HOÀN BỘC', rgb: '255,160,80', windup: .75, after: 1.9 },
    t_flood:    { label: 'THỦY ĐỘN · BẠO THỦY XUNG BA · PHI LÔI THẦN TRẢM', rgb: '120,210,255', windup: 1.3, after: 3.2 },
    s_fire:     { label: 'HỎA ĐỘN · HỎA LONG VIÊM ĐẠN', rgb: '255,140,60', windup: .85, after: 1.5 },
    s_shuriken: { label: 'THỦ LÝ KIẾM ẢNH PHÂN THÂN CHI THUẬT', rgb: '220,230,240', windup: .7, after: 1.6 },
    s_enma:     { label: 'ENMA · KIM CƯƠNG NHƯ Ý · KIM CƯƠNG LAO BÍCH', rgb: '255,205,110', windup: .9, after: 2.0 },
    s_wall:     { label: 'THỔ ĐỘN · THỔ LƯU BÍCH', rgb: '214,180,130', windup: .8, after: 1.9 },
    s_reaper:   { label: 'PHONG ẤN THUẬT · THI QUỶ PHONG TẤN', rgb: '200,160,255', windup: 1.0, after: 3.4 },
    m_web:      { label: 'PHI LÔI THẦN · KUNAI TRẬN', rgb: '255,225,110', windup: .7, after: 1.5 },
    m_rasengan: { label: 'PHI LÔI THẦN · LOA TOÀN HOÀN', rgb: '140,210,255', windup: .6, after: 1.2 },
    m_nidan:    { label: 'PHI LÔI THẦN · NHỊ ĐOẠN', rgb: '255,225,110', windup: .55, after: 1.6 },
    m_cloak:    { label: 'CỬU VĨ CHAKRA · VĨ THÚ NGỌC', rgb: '255,180,60', windup: 1.0, after: 1.9 },
    m_kurama:   { label: 'ÂM CỬU VĨ · VĨ THÚ NGỌC', rgb: '255,120,40', windup: 1.5, after: 3.6 },
    ts_punch:   { label: 'ANH HOA XUNG', rgb: '255,170,200', windup: .8, after: 1.3 },
    ts_heel:    { label: 'THỐNG THIÊN CƯỚC', rgb: '214,180,130', windup: .85, after: 1.4 },
    ts_boulders:{ label: 'QUÁI LỰC · CỰ THẠCH PHI ĐẦU', rgb: '214,180,130', windup: .9, after: 1.8 },
    ts_katsuyu: { label: 'KHẨU KHÍ · KATSUYU · THIỆT XỈ NIÊM TOAN', rgb: '200,240,120', windup: 1.0, after: 2.3 },
    ts_byakugo: { label: 'BÁCH HÀO CHI THUẬT · SÁNG TẠO TÁI SINH', rgb: '170,120,255', windup: .7, after: 1.4 },
    ts_meteor:  { label: 'BÁCH HÀO · THIÊN QUYỀN CỰ VẪN', rgb: '160,255,170', windup: 1.4, after: 3.6 },
    k_raikiri:  { label: 'LÔI THIẾT', rgb: '150,210,255', windup: .6, after: 1.1 },
    k_kamui:    { label: 'THẦN UY', rgb: '170,130,220', windup: 1.05, after: 1.6 },
    k_hound:    { label: 'LÔI THIẾT · LÔI THÚ TRUY NHA', rgb: '150,210,255', windup: .75, after: 1.6 },
    k_ninken:   { label: 'THỔ ĐỘN · TRUY NHA CHI THUẬT', rgb: '214,180,130', windup: .8, after: 1.6 },
    k_water:    { label: 'THỦY ĐỘN · ĐẠI BỘC BỐ CHI THUẬT', rgb: '120,200,255', windup: .9, after: 1.7 },
    k_shiden:   { label: 'TỬ ĐIỆN', rgb: '200,140,255', windup: .75, after: 1.5 },
    k_susanoo:  { label: 'SUSANOO · THẦN UY THỦ LÝ KIẾM', rgb: '120,190,255', windup: 1.6, after: 3.8 }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  const BOLT_B = ['90,170,255', '170,220,255', '240,250,255'];
  const BOLT_P = ['150,60,255', '200,150,255', '250,235,255'];

  function pick(index) { return order[((index % order.length) + order.length) % order.length]; }
  const aimAt = (z, p) => p ? Math.atan2(p.y - z.y, p.x - z.x) : z.angle || 0;

  function state(z) {
    return z.hk || (z.hk = { t: 0, casts: 0, timer: .9, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      tele: [], ev: [], fx: [], fl: [], force: null, dash: null, jump: null, hold: 0, atk: 0, cloak: 0, byak: 0, heal: 0, healRate: 0 });
  }
  function addFx(st, fx) {
    fx.age = 0;
    if (st.fx.length >= 16) st.fx.shift();
    st.fx.push(fx);
    return fx;
  }
  const later = (st, t, fn) => st.ev.push({ t, fn });
  // Hiraishin: the body jumps straight to (x, y); a streak of yellow light marks the path.
  function blink(z, st, api, x, y, rgb) {
    const x0 = z.x, y0 = z.y;
    api.move(x - z.x, y - z.y);
    if (st.fl.length >= 10) st.fl.shift();
    st.fl.push({ x0, y0, x1: z.x, y1: z.y, age: 0, rgb: rgb || '255,225,110', id: z.bossId });
  }

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
  function ringStrikes(api, x, y, rho, dmg, kind, everyKind = 6) {
    const n = Math.max(6, Math.ceil(TAU * rho / 110)), r = Math.max(58, TAU * rho / n * .62);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      api.strike(x + Math.cos(a) * rho, y + Math.sin(a) * rho, r, dmg, null, i % everyKind === 0 ? kind : null, true);
    }
  }
  // Damage along a lane as a front sweeps down it (dragons, fissures, waves).
  function laneHits(st, x, y, a, len, halfW, speed, dmg, kind, t0 = 0, every = 3) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let d = 90, i = 0; d <= len + 1; d += 90, i++) {
      later(st, t0 + d / speed, api => api.line(x + ca * (d - 90), y + sa * (d - 90), x + ca * d, y + sa * d, halfW, dmg, i % every ? null : kind));
    }
  }
  const fakeShooter = (x, y) => ({ x, y, r: 18, type: 'boss' });

  // ------------------------------------------------------------------ jutsu selection
  function teleFor(z, st, move) {
    const x = z.x, y = z.y, a = st.aim, tx = st.tx, ty = st.ty;
    const line = (len, w) => ({ k: 'line', x, y, a, len, w });
    const circ = (cx, cy, r, faint) => ({ k: 'c', x: cx, y: cy, r, faint });
    const end = len => [x + Math.cos(a) * len, y + Math.sin(a) * len];
    switch (move) {
      case 'h_dragon': return [line(980, 105), circ(...end(980), 210)];
      case 'h_forest': return [circ(tx, ty, 440)];
      case 'h_golem': return [circ(tx, ty, 180)];
      case 'h_pollen': return [circ(x, y, 560, true)];
      case 'h_kannon': return [circ(tx, ty, 640, true), circ(tx, ty, 300)];
      case 't_dragon': return [line(1000, 100), circ(...end(1000), 220)];
      case 't_slash': return [circ(tx, ty, 270, true)];
      case 't_wall': return [circ(x, y, 640, true), circ(x, y, 300)];
      case 't_edo': return [circ(tx, ty, 300, true)];
      case 't_tags': return [line(880, 110), circ(tx, ty, 220, true)];
      case 't_flood': return [circ(x, y, 680)];
      case 's_fire': return [line(920, 112), circ(...end(920), 210)];
      case 's_shuriken': return [{ k: 'cone', x, y, a, r: 820, h: .55 }];
      case 's_enma': return [line(900, 52), circ(tx, ty, 230)];
      case 's_wall': {
        const wx = x + Math.cos(a) * 140, wy = y + Math.sin(a) * 140;
        return [{ k: 'line', x: wx - Math.cos(a + Math.PI / 2) * 300, y: wy - Math.sin(a + Math.PI / 2) * 300, a: a + Math.PI / 2, len: 600, w: 60 },
          { k: 'cone', x: wx, y: wy, a, r: 820, h: .42, faint: true }];
      }
      case 's_reaper': return [{ k: 'line', x, y, a, len: Math.hypot(tx - x, ty - y), w: 46 }, circ(tx, ty, 190), circ(x, y, 250, true)];
      case 'm_web': return [circ(tx, ty, 280)];
      case 'm_rasengan': return [circ(tx, ty, 180)];
      case 'm_nidan': return [line(Math.hypot(tx - x, ty - y), 40), circ(tx, ty, 150)];
      case 'm_cloak': return [line(950, 80), circ(...end(950), 260)];
      case 'm_kurama': return [line(1150, 120), circ(...end(1150), 430)];
      case 'ts_punch': return [circ(tx, ty, 240)];
      case 'ts_heel': return [line(880, 120)];
      case 'ts_boulders': {
        const out = [], th = st.aim;
        st.spots = [[tx, ty]];
        for (let i = 0; i < 5; i++) { const aa = th + (i - 2) * .9 + rand(-.2, .2), d = rand(180, 280); st.spots.push([tx + Math.cos(aa) * d, ty + Math.sin(aa) * d]); }
        for (const [sx, sy] of st.spots) out.push(circ(sx, sy, 125));
        return out;
      }
      case 'ts_katsuyu': return [{ k: 'cone', x, y, a, r: 740, h: .5 }];
      case 'ts_byakugo': return [circ(x, y, 300)];
      case 'ts_meteor': return [circ(tx, ty, 480), circ(tx, ty, 260)];
      case 'k_raikiri': return [line(720, 62)];
      case 'k_kamui': return [circ(tx, ty, 240)];
      case 'k_hound': return [line(700, 60)];
      case 'k_ninken': return [circ(tx, ty, 200)];
      case 'k_water': return [{ k: 'cone', x, y, a, r: 740, h: .55 }];
      case 'k_shiden': return [{ k: 'line', x, y, a: a - .2, len: 950, w: 50 }, line(950, 50), { k: 'line', x, y, a: a + .2, len: 950, w: 50 }];
      case 'k_susanoo': return [circ(tx, ty, 390), circ(tx, ty, 160)];
    }
    return [];
  }

  function announce(z, st, m, api) {
    let move = st.force;
    if (move && MOVES[move]) st.force = null; else { move = m.moves[st.casts % m.moves.length]; st.casts++; }
    const def = MOVES[move], p = api.player;
    st.move = move; st.windup = st.windMax = def.windup;
    st.aim = aimAt(z, p); st.tx = p ? p.x : z.x; st.ty = p ? p.y : z.y;
    st.tele = teleFor(z, st, move);
  }

  function startDash(z, st, a, len, speed, w, dmg, endR, endDmg) {
    const fx = addFx(st, { kind: 'raikiri', x0: z.x, y0: z.y, x1: z.x, y1: z.y, a, w, dur: len / speed + .9, seed: Math.random() * 99, end: -1 });
    st.dash = { a, speed, left: len / speed, hit: 0, w, dmg, endR, endDmg, fx };
  }

  function cast(z, st, m, api) {
    const move = st.move, D = api.damage || 60, s = st.tele[0] || { x: z.x, y: z.y, a: st.aim, r: 150, len: 600, w: 80 };
    const a = st.aim, ca = Math.cos(a), sa = Math.sin(a), seed = Math.random() * 99, x = z.x, y = z.y, tx = st.tx, ty = st.ty;
    api.burst(z.x, z.y - 20, m.accent, 10);
    switch (move) {
      // ---------------------------------------------------------- Hashirama
      case 'h_dragon': case 't_dragon': {
        const water = move === 't_dragon', len = s.len, speed = water ? 1250 : 1100;
        addFx(st, { kind: 'dragon', water, x, y, a, len, w: s.w, speed, dur: len / speed + (water ? 1.5 : 2.2), seed });
        laneHits(st, x, y, a, len, s.w * .62, speed, D * 1.5, water ? 'shockwave' : 'earth');
        later(st, len / speed + .1, api => {
          const ex = x + ca * len, ey = y + sa * len;
          api.strike(ex, ey, water ? 220 : 210, D * 1.8, null, water ? 'shockwave' : 'crater'); api.shake(13);
        });
        api.shake(6);
        break;
      }
      case 'h_forest': {
        const R = s.r, cx = s.x, cy = s.y, speed = R / 1.0;
        addFx(st, { kind: 'forest', x: cx, y: cy, R, speed, dur: 4.6, seed, trees: forestTrees(R, seed, 1) });
        api.strike(cx, cy, 110, D * 1.4, null, null, true);
        for (const r of [130, 230, 330, R - 40]) later(st, r / speed, api => ringStrikes(api, cx, cy, r, D * 1.25, r > 400 ? 'earth' : null, 7));
        later(st, .45, api => { api.world(cx, cy, R * .6, D * 2, 'earth'); api.shake(12); });
        st.hold = .7;
        break;
      }
      case 'h_golem': {
        const sd = Math.cos(a) >= 0 ? 1 : -1, gx = x - ca * 90 - sa * 150 * sd, gy = y - sa * 90 + ca * 150 * sd;
        const marks = [{ x: tx, y: ty, r: 180, t0: 0, t1: .95, side: 1 }, { x: tx, y: ty, r: 180, t0: 1.05, t1: 1.95, side: -1 }, { x: tx, y: ty, r: 250, t0: 2.05, t1: 3.05, side: 0 }];
        const fx = addFx(st, { kind: 'golem', x: gx, y: gy, marks, dur: 4.0, seed });
        marks.forEach((mk, i) => {
          if (i) later(st, mk.t0, api => { const p = api.player; if (p) { mk.x = p.x; mk.y = p.y; } });
          later(st, mk.t1, api => {
            api.strike(mk.x, mk.y, mk.r, D * (i === 2 ? 2.6 : 1.9), null, 'crater', true);
            api.shake(i === 2 ? 18 : 12); api.burst(mk.x, mk.y - 20, '#c8a070', 16);
          });
        });
        fx.front = false;
        st.hold = 3.1;
        break;
      }
      case 'h_pollen': {
        const R = 560;
        addFx(st, { kind: 'pollen', x, y, R, dur: 5.4, seed, trees: bloomTrees(R, seed) });
        for (const r of [150, 300, 450]) later(st, r / 650, api => ringStrikes(api, x, y, r, D * .95, null, 9));
        for (let t = 1.0; t < 4.7; t += .6) later(st, t, api => {
          const p = api.player;
          if (p && Math.hypot(p.x - x, p.y - y) < R) api.strike(p.x, p.y, 30, D * .2, null, null, true);
        });
        st.hold = .6;
        break;
      }
      case 'h_kannon': {
        const fists = [];
        for (let i = 0; i < 22; i++) {
          const aa = rand(0, TAU), d = i === 0 ? 0 : 120 + Math.sqrt(Math.random()) * 500;
          fists.push({ x: tx + Math.cos(aa) * d, y: ty + Math.sin(aa) * d, t: 1.05 + i * .115, r: 128, chase: i % 4 === 2, hand: i, seed: i * 7.3 + seed });
        }
        const big = { x: tx, y: ty, t: 4.05, r: 300, big: true, hand: 99, seed };
        addFx(st, { kind: 'kannon', x, y, dur: 6.0, fists, big, seed });
        fists.forEach((f, i) => {
          if (f.chase) later(st, f.t - .8, api => { const p = api.player; if (p && Math.hypot(p.x - tx, p.y - ty) < 760) { f.x = p.x; f.y = p.y; } });
          later(st, f.t, api => { api.strike(f.x, f.y, f.r, D * 1.35, null, i % 4 === 0 ? 'crater' : null, true); api.shake(9); });
        });
        later(st, big.t - 1.0, api => { const p = api.player; if (p && Math.hypot(p.x - tx, p.y - ty) < 900) { big.x = p.x; big.y = p.y; } });
        later(st, big.t, api => {
          api.strike(big.x, big.y, big.r, D * 3.0, '#e0b070', 'crater');
          for (let i = 0; i < 5; i++) api.world(big.x + Math.cos(i * TAU / 5) * 190, big.y + Math.sin(i * TAU / 5) * 190, 140, D * 2.4, 'crater');
          api.shake(24);
        });
        st.hold = 4.3;
        break;
      }
      // ---------------------------------------------------------- Tobirama
      case 't_slash': {
        const th = rand(0, TAU), K = [];
        for (let i = 0; i < 4; i++) K.push({ x: tx + Math.cos(th + i * Math.PI / 2) * 270, y: ty + Math.sin(th + i * Math.PI / 2) * 270, land: .22 + i * .05 });
        const path = [K[0], K[2], K[1], K[3]], t0 = .9;
        addFx(st, { kind: 'slash', x, y, kunai: K, path, t0, step: .2, dur: 2.4, seed });
        later(st, t0 - .08, api => blink(z, st, api, path[0].x, path[0].y, '170,225,255'));
        for (let i = 1; i < path.length; i++) later(st, t0 + i * .2, api => {
          const p0 = path[i - 1], p1 = path[i];
          blink(z, st, api, p1.x, p1.y, '170,225,255');
          api.line(p0.x, p0.y, p1.x, p1.y, 56, D * 1.5, i === 2 ? 'blade' : null); api.shake(9);
        });
        st.hold = 1.65;
        break;
      }
      case 't_wall': {
        addFx(st, { kind: 'waterwall', x, y, R0: 300, R1: 640, dur: 2.7, seed });
        later(st, .18, api => { api.strike(x, y, 300, D * 1.3, null, null, true); api.knockback(z, 320, 170, 0); api.shake(10); });
        for (const [t, r] of [[.58, 410], [.76, 520], [.94, 620]]) later(st, t, api => ringStrikes(api, x, y, r, D * 1.15, r > 600 ? 'shockwave' : null, 8));
        st.hold = .6;
        break;
      }
      case 't_edo': {
        const th = rand(0, TAU), cof = [];
        for (let i = 0; i < 6; i++) cof.push({ x: tx + Math.cos(th + i * TAU / 6) * 250, y: ty + Math.sin(th + i * TAU / 6) * 250, lag: i * .05 });
        addFx(st, { kind: 'edo', x: tx, y: ty, R: 250, cof, dur: 3.2, seed });
        later(st, .32, api => { for (const c of cof) api.strike(c.x, c.y, 72, D * 1.2, null, null, true); api.shake(7); });
        later(st, 1.2, api => { api.strike(tx, ty, 175, D * 2.0, null, 'vortex', true); api.shake(14); });
        st.hold = 1.3;
        break;
      }
      case 't_tags': {
        const tags = [], len = s.len;
        for (let i = 0; i < 10; i++) {
          const d = 110 + i * (len - 110) / 9, off = (i % 2 ? 1 : -1) * (40 + hash(i + seed) * 40);
          tags.push({ x: x + ca * d - sa * off, y: y + sa * d + ca * off, fly: .18 + i * .035, boom: .95 + i * .07 });
        }
        for (let i = 0; i < 6; i++) {
          const aa = i * TAU / 6 + seed;
          tags.push({ x: tx + Math.cos(aa) * 160, y: ty + Math.sin(aa) * 160, fly: .3 + i * .03, boom: 1.25 + i * .05 });
        }
        addFx(st, { kind: 'tags', x, y, tags, dur: 3.0, seed });
        tags.forEach((g, i) => later(st, g.boom, api => { api.strike(g.x, g.y, 110, D * 1.25, null, i % 4 === 0 ? 'fire' : null, true); api.shake(8); }));
        st.hold = .5;
        break;
      }
      case 't_flood': {
        const R = 680, speed = 620;
        const fx = addFx(st, { kind: 'flood', x, y, R, speed, dur: 4.0, seed, xs: null, xsT: 1.55 });
        for (const r of [200, 320, 440, 560, 680]) later(st, r / speed, api => ringStrikes(api, x, y, r, D * 1.35, r >= 560 ? 'shockwave' : null, 10));
        later(st, .35, api => api.knockback(z, 260, 140, 0));
        later(st, .95, api => { const p = api.player; if (p) fx.xs = { x: p.x, y: p.y, a: rand(0, Math.PI) }; });
        later(st, fx.xsT, api => {
          const c = fx.xs; if (!c) return;
          blink(z, st, api, c.x - Math.cos(c.a) * 60, c.y - Math.sin(c.a) * 60, '170,225,255');
          for (const da of [Math.PI / 4, -Math.PI / 4]) {
            const aa = c.a + da;
            api.line(c.x - Math.cos(aa) * 230, c.y - Math.sin(aa) * 230, c.x + Math.cos(aa) * 230, c.y + Math.sin(aa) * 230, 60, D * 2.2, 'blade');
          }
          api.shake(16);
        });
        st.hold = 1.75;
        break;
      }
      // ---------------------------------------------------------- Hiruzen
      case 's_fire': {
        const len = s.len, speed = 1000;
        addFx(st, { kind: 'fireDragon', x, y, a, len, w: s.w, speed, dur: len / speed + 1.9, seed });
        laneHits(st, x, y, a, len, s.w * .62, speed, D * 1.5, 'fire', 0, 4);
        later(st, len / speed + .08, api => { api.strike(x + ca * len, y + sa * len, 210, D * 1.8, null, 'fire'); api.shake(13); });
        break;
      }
      case 's_shuriken': {
        const half = .55, reach = 820;
        addFx(st, { kind: 'swarm', x, y, a, reach, half, dur: 1.7, seed });
        for (let v = 0; v < 3; v++) later(st, .08 + v * .16, api => {
          for (let i = 0; i < 13; i++) api.projectile(z, a + (i / 12 - .5) * 2 * half * .95 + rand(-.03, .03), 760, D * .5, 'shuriken', '#d6dde2', 1.15);
          api.burst(z.x, z.y - 24, '#e8eef2', 6);
        });
        later(st, .5, api => { for (const p of conePts(x, y, a, reach, half)) api.strike(p.x, p.y, p.r, D * .8, null, null, true); });
        break;
      }
      case 's_enma': {
        addFx(st, { kind: 'staff', x, y, a, len: 900, dur: 1.05, seed });
        later(st, .1, api => { api.line(x, y, x + ca * 900, y + sa * 900, 50, D * 1.8, 'crater'); api.shake(11); });
        addFx(st, { kind: 'cage', x: tx, y: ty, R: 230, slam: .8, crush: 1.5, dur: 2.5, seed });
        later(st, .8, api => { ringStrikes(api, tx, ty, 230, D * 1.2, 'earth', 8); api.shake(9); });
        later(st, 1.5, api => { api.strike(tx, ty, 215, D * 1.9, null, 'crater'); api.shake(15); });
        st.hold = .5;
        break;
      }
      case 's_wall': {
        const wx = x + ca * 140, wy = y + sa * 140, px = -sa, py = ca;
        const fx = addFx(st, { kind: 'earthwall', x: wx, y: wy, a, half: 300, dur: 3.4, seed });
        later(st, .12, api => { api.line(wx - px * 300, wy - py * 300, wx + px * 300, wy + py * 300, 62, D * 1.4, 'earth'); api.knockback(z, 260, 150, 0); api.shake(11); });
        for (let v = 0; v < 3; v++) later(st, .6 + v * .36, api => {
          fx.spit = fx.age;
          for (const o of [-190, 0, 190]) {
            const hx = wx + px * o + ca * 30, hy = wy + py * o + sa * 30, p = api.player;
            const aa = p ? Math.atan2(p.y - hy, p.x - hx) : a;
            for (const k of [-1, 0, 1]) api.projectile(fakeShooter(hx, hy), aa + k * .13, 640, D * .7, 'rock', '#8a6a4a', 1.4);
          }
        });
        break;
      }
      case 's_reaper': {
        addFx(st, { kind: 'reaper', x, y, a, tx, ty, dur: 3.8, seed });
        later(st, .85, api => { api.knockback(z, 250, 150, D * .6); api.shake(8); });
        later(st, 1.0, api => api.line(x, y, tx, ty, 46, D * 1.3, null));
        later(st, 1.25, api => { api.strike(tx, ty, 190, D * 3.2, null, 'vortex'); api.shake(18); });
        st.hold = 2.3;
        break;
      }
      // ---------------------------------------------------------- Minato
      case 'm_web': {
        const th = rand(0, TAU), K = [{ x: tx, y: ty, land: .32 }];
        for (let i = 0; i < 6; i++) K.push({ x: tx + Math.cos(th + i * TAU / 6) * 265, y: ty + Math.sin(th + i * TAU / 6) * 265, land: .16 + i * .03 });
        const path = [1, 4, 2, 5, 3, 6, 0].map(i => K[i]), t0 = .78, step = .14;
        addFx(st, { kind: 'web', x, y, kunai: K, path, t0, step, dur: 2.4, seed });
        later(st, t0 - .06, api => blink(z, st, api, path[0].x, path[0].y));
        for (let j = 1; j < path.length; j++) later(st, t0 + j * step, api => {
          const p0 = path[j - 1], p1 = path[j];
          blink(z, st, api, p1.x, p1.y);
          api.line(p0.x, p0.y, p1.x, p1.y, 50, D * 1.15, null); api.shake(6);
        });
        later(st, t0 + path.length * step + .05, api => { api.strike(tx, ty, 170, D * 1.7, null, 'vortex'); api.shake(14); });
        st.hold = t0 + path.length * step + .2;
        break;
      }
      case 'm_rasengan': {
        blink(z, st, api, tx - ca * 58, ty - sa * 58);
        addFx(st, { kind: 'rasen', x: tx, y: ty, r: 180, hit: .24, dur: 1.4, seed });
        later(st, .24, api => { api.strike(tx, ty, 180, D * 2.2, null, 'vortex'); api.shake(15); });
        st.atk = .45;
        break;
      }
      case 'm_nidan': {
        const fx = addFx(st, { kind: 'nidan', x, y, ex: tx, ey: ty, b: null, dur: 2.0, seed });
        addFx(st, { kind: 'rasen', x: tx, y: ty, r: 150, hit: .34, dur: 1.2, seed: seed + 3 });
        later(st, .3, api => { blink(z, st, api, tx - ca * 50, ty - sa * 50); });
        later(st, .34, api => { api.strike(tx, ty, 150, D * 1.7, null, 'vortex'); api.shake(11); });
        later(st, .5, api => {
          const p = api.player, d = p ? Math.hypot(p.x - tx, p.y - ty) : 0;
          const bx = p ? (d > 20 ? p.x + (p.x - tx) / d * 110 : p.x + ca * 110) : tx + ca * 110, by = p ? (d > 20 ? p.y + (p.y - ty) / d * 110 : p.y + sa * 110) : ty + sa * 110;
          fx.b = { x: bx, y: by, t: fx.age };
          addFx(st, { kind: 'rasen', x: bx, y: by, r: 165, hit: .48, dur: 1.3, seed: seed + 7, big: true });
        });
        later(st, .94, api => { if (fx.b) blink(z, st, api, fx.b.x - ca * 50, fx.b.y - sa * 50); });
        later(st, .98, api => { if (fx.b) { api.strike(fx.b.x, fx.b.y, 165, D * 1.9, null, 'vortex'); api.shake(14); } });
        st.atk = 1.1;
        break;
      }
      case 'm_cloak': {
        st.cloak = 9;
        const len = 950, speed = 950;
        addFx(st, { kind: 'tbb', x, y, a, len, speed, r: 260, dur: len / speed + 1.5, seed });
        laneHits(st, x, y, a, len, 52, speed, D * 1.3, null);
        later(st, len / speed, api => {
          const ex = x + ca * len, ey = y + sa * len;
          api.strike(ex, ey, 260, D * 2.3, null, 'crater');
          api.world(ex + 120, ey, 120, D * 2, 'crater'); api.world(ex - 120, ey, 120, D * 2, 'crater');
          api.shake(18);
        });
        break;
      }
      case 'm_kurama': {
        const len = 1150, speed = 1400, t0 = 1.3, R = 430;
        addFx(st, { kind: 'kurama', x, y, a, len, speed, t0, R, dur: t0 + len / speed + 2.2, seed });
        laneHits(st, x, y, a, len, 70, speed, D * 1.6, null, t0);
        later(st, t0 + len / speed, api => {
          const ex = x + ca * len, ey = y + sa * len;
          api.strike(ex, ey, R, D * 3.3, null, 'crater');
          for (let i = 0; i < 5; i++) api.world(ex + Math.cos(i * TAU / 5) * 260, ey + Math.sin(i * TAU / 5) * 260, 150, D * 2.4, 'crater');
          api.shake(24);
        });
        st.hold = 2.2;
        break;
      }
      // ---------------------------------------------------------- Tsunade
      case 'ts_punch':
        st.jump = { x0: x, y0: y, x1: tx, y1: ty, t: 0, dur: .5, high: 170, land: api => {
          api.strike(tx, ty, 240, D * 2.5, null, 'crater');
          for (let i = 0; i < 3; i++) api.world(tx + Math.cos(i * TAU / 3 + seed) * 200, ty + Math.sin(i * TAU / 3 + seed) * 200, 120, D * 2, 'earth');
          api.knockback(z, 300, 160, 0); api.shake(18);
          addFx(st, { kind: 'okasho', x: tx, y: ty, r: 240, dur: 2.6, seed });
        } };
        break;
      case 'ts_heel':
        st.jump = { x0: x, y0: y, x1: x + ca * 40, y1: y + sa * 40, t: 0, dur: .36, high: 140, land: api => {
          const fx0 = z.x, fy0 = z.y, len = 880, speed = 1700;
          addFx(st, { kind: 'fissure', x: fx0, y: fy0, a, len, w: 120, speed, dur: 2.8, seed });
          laneHits(st, fx0, fy0, a, len, 70, speed, D * 2.0, 'earth', 0, 3);
          api.strike(fx0, fy0, 130, D * 1.6, null, 'crater', true); api.shake(16);
        } };
        break;
      case 'ts_boulders': {
        const spots = st.spots || [[tx, ty]];
        const rocks = spots.map(([sx, sy], i) => ({ x1: sx, y1: sy, t0: .02 + i * .1, t1: .5 + i * .12, log: i === 2 || i === 4, seed: seed + i * 3.1 }));
        addFx(st, { kind: 'hurl', x, y, rocks, dur: 2.6, seed });
        rocks.forEach((r, i) => later(st, r.t1, api => { api.strike(r.x1, r.y1, 125, D * 1.5, null, i % 2 ? null : 'crater', true); api.shake(10); }));
        break;
      }
      case 'ts_katsuyu': {
        const sx = x - ca * 70 + sa * 80, sy = y - sa * 70 - ca * 80 - 10;
        const pud = [];
        for (const p of conePts(x, y, a, 740, .5)) if (hash(p.x * .13 + p.y * .07 + seed) < .3 && pud.length < 9) pud.push({ x: p.x, y: p.y, r: 60 + hash(p.x) * 40, t: .35 + p.d / 1400 });
        addFx(st, { kind: 'katsuyu', x, y, sx, sy, a, reach: 740, half: .5, pud, dur: 5.0, seed });
        later(st, .5, api => { for (const p of conePts(x, y, a, 740, .5)) api.strike(p.x, p.y, p.r, D * 1.3, null, null, true); api.shake(8); });
        for (let t = 1.0; t < 4.6; t += .6) later(st, t, api => {
          const p = api.player; if (!p) return;
          for (const q of pud) if (Math.hypot(p.x - q.x, p.y - q.y) < q.r + 10) { api.strike(p.x, p.y, 20, D * .22, null, null, true); break; }
        });
        st.hold = 1.1;
        break;
      }
      case 'ts_byakugo':
        st.byak = 7.5; st.heal = 3; st.healRate = z.maxHealth * .2 / 3;
        api.knockback(z, 300, 200, D * 1.0); api.shake(12);
        addFx(st, { kind: 'byakugo', x, y, r: 300, dur: 2.0, seed });
        break;
      case 'ts_meteor': {
        st.byak = Math.max(st.byak, 6);
        addFx(st, { kind: 'meteor', x: tx, y: ty, R: 480, t1: 1.2, dur: 4.0, seed });
        st.jump = { x0: x, y0: y, x1: tx, y1: ty, t: 0, dur: 1.2, high: 620, land: api => {
          api.strike(tx, ty, 260, D * 3.6, null, 'crater');
          ringStrikes(api, tx, ty, 420, D * 1.6, 'earth', 8);
          for (let i = 0; i < 6; i++) api.world(tx + Math.cos(i * TAU / 6) * 300, ty + Math.sin(i * TAU / 6) * 300, 150, D * 2.6, 'crater');
          api.knockback(z, 480, 190, 0); api.shake(26);
        } };
        break;
      }
      // ---------------------------------------------------------- Kakashi
      case 'k_raikiri':
        startDash(z, st, a, 720, 1500, 62, D * 1.3, 140, D * 2.0);
        break;
      case 'k_hound': {
        const fx = addFx(st, { kind: 'hound', x: x + ca * 30, y: y + sa * 30, h: a, life: 1.9, dur: 2.7, trail: [], seed, done: -1 });
        fx.upd = (f, dt, api) => {
          if (f.done >= 0) return;
          const p = api.player;
          if (p) {
            const want = Math.atan2(p.y - f.y, p.x - f.x), da = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
            f.h += Math.max(-2.7 * dt, Math.min(2.7 * dt, da));
          }
          f.x += Math.cos(f.h) * 760 * dt; f.y += Math.sin(f.h) * 760 * dt;
          f.trail.push(f.x, f.y); if (f.trail.length > 48) f.trail.splice(0, 2);
          if (p && Math.hypot(p.x - f.x, p.y - f.y) < 62) { f.done = f.age; api.strike(f.x, f.y, 120, D * 1.8, null, 'lightning'); api.shake(13); }
          else if (f.age > f.life) { f.done = f.age; api.strike(f.x, f.y, 150, D * 1.4, null, 'lightning'); api.shake(11); }
        };
        break;
      }
      case 'k_kamui':
        addFx(st, { kind: 'kamui', x: tx, y: ty, R: 240, hit: .55, dur: 1.7, seed });
        later(st, .55, api => { api.strike(tx, ty, 240, D * 2.6, null, 'vortex'); api.shake(16); });
        st.hold = .6;
        break;
      case 'k_ninken': {
        const th = rand(0, TAU), dogs = [];
        for (let i = 0; i < 8; i++) dogs.push({ a: th + i * TAU / 8, v: i, lag: hash(i + seed) * .08 });
        addFx(st, { kind: 'ninken', x: tx, y: ty, R: 185, dogs, dur: 2.3, seed });
        later(st, .18, api => ringStrikes(api, tx, ty, 185, D * .8, 'earth', 8));
        later(st, .48, api => { api.strike(tx, ty, 150, D * 1.7, null, null, true); api.shake(10); });
        break;
      }
      case 'k_water': {
        addFx(st, { kind: 'falls', x, y, a, r: 740, h: .55, speed: 900, dur: 2.5, seed });
        for (const p of conePts(x, y, a, 740, .55)) later(st, .1 + p.d / 900, api => api.strike(p.x, p.y, p.r, D * 1.5, null, p.d > 640 && hash(p.x) < .3 ? 'shockwave' : null, true));
        later(st, .3, api => api.shake(9));
        break;
      }
      case 'k_shiden': {
        const bolts = [-1, 0, 1].map((k, i) => ({ a: a + k * .2, t: i * .14, seed: seed + i * 13 }));
        addFx(st, { kind: 'shiden', x, y, bolts, len: 950, dur: 1.5, seed });
        bolts.forEach((b, i) => later(st, b.t, api => {
          api.line(x, y, x + Math.cos(b.a) * 950, y + Math.sin(b.a) * 950, 50, D * 1.3, i === 1 ? 'lightning' : null); api.shake(8);
        }));
        break;
      }
      case 'k_susanoo': {
        const d = Math.hypot(tx - x, ty - y) || 1;
        const sh = [-1, 1].map((side, i) => ({ side, t0: .75 + i * .3, dur: .62, cx: (x + tx) / 2 - (ty - y) / d * 380 * side, cy: (y + ty) / 2 + (tx - x) / d * 380 * side }));
        addFx(st, { kind: 'susanoo', x, y, a, tx, ty, sh, boom: 1.85, dur: 4.6, seed });
        for (const s2 of sh) for (let k = 1; k <= 6; k++) later(st, s2.t0 + s2.dur * k / 6, api => {
          const p = qbez(x, y, s2.cx, s2.cy, tx, ty, k / 6);
          api.strike(p[0], p[1], 95, D * 1.5, null, k === 6 ? 'vortex' : null, true);
          if (k === 6) api.shake(12);
        });
        later(st, 1.85, api => {
          api.strike(tx, ty, 390, D * 3.4, null, 'vortex');
          for (let i = 0; i < 6; i++) api.world(tx + Math.cos(i * TAU / 6) * 240, ty + Math.sin(i * TAU / 6) * 240, 150, D * 2.6, 'vortex');
          api.shake(25);
        });
        st.hold = 2.2;
        break;
      }
    }
  }
  function qbez(x0, y0, cx, cy, x1, y1, t) {
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
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
    for (let i = st.fl.length - 1; i >= 0; i--) if ((st.fl[i].age += dt) > .55) st.fl.splice(i, 1);
    if (z.health <= 0) { z.bossWindup = 0; z.kageDash = 0; st.dash = st.jump = null; st.ev.length = 0; st.cloak = st.byak = 0; return; }
    for (let i = st.ev.length - 1; i >= 0; i--) {
      const ev = st.ev[i];
      if ((ev.t -= dt) <= 0) { st.ev.splice(i, 1); ev.fn(api); }
    }
    st.hold = Math.max(0, st.hold - dt);
    st.atk = Math.max(0, st.atk - dt);
    st.cloak = Math.max(0, st.cloak - dt);
    st.byak = Math.max(0, st.byak - dt);
    if (st.heal > 0) { st.heal -= dt; z.health = Math.min(z.maxHealth, z.health + st.healRate * dt); }
    if (m.regen) z.health = Math.min(z.maxHealth, z.health + z.maxHealth * m.regen * dt);
    z.armorScale = (m.armor || 1) * (st.byak > 0 ? .5 : 1);
    z.speedScale = st.cloak > 0 ? 1.35 : 1;

    // Kakashi's Raikiri charge: he blurs across the ground, lightning in hand.
    let dash = 0;
    if (st.dash) {
      const ds = st.dash, step = Math.min(ds.left, dt) * ds.speed;
      ds.left -= dt;
      api.move(Math.cos(ds.a) * step, Math.sin(ds.a) * step);
      ds.fx.x1 = z.x; ds.fx.y1 = z.y;
      if ((ds.hit -= dt) <= 0) { ds.hit = .06; api.strike(z.x, z.y, ds.w, ds.dmg, null, null, true); }
      dash = Math.max(.01, ds.left);
      if (ds.left <= 0) {
        api.strike(z.x, z.y, ds.endR, ds.endDmg, null, 'lightning');
        api.shake(14);
        ds.fx.end = ds.fx.age;
        st.dash = null;
      }
    }
    // Tsunade's leaps: she arcs onto the marked spot and the landing does the damage.
    if (st.jump) {
      const j = st.jump, k0 = j.t / j.dur;
      j.t += dt;
      const k = Math.min(1, j.t / j.dur), e0 = easeInOut(k0), e1 = easeInOut(k);
      api.move((j.x1 - j.x0) * (e1 - e0), (j.y1 - j.y0) * (e1 - e0));
      dash = .05;
      if (k >= 1) { st.jump = null; j.land(api); st.atk = .3; }
    }
    if (st.windup > 0) {
      st.windup = Math.max(0, st.windup - dt);
      if (st.windup === 0) {
        cast(z, st, m, api);
        st.timer = MOVES[st.move].after * rand(.9, 1.1);
        st.move = '';
        st.tele = [];
      }
    } else if (!st.dash && !st.jump) {
      st.timer -= dt;
      const p = api.player;
      if (st.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 880) announce(z, st, m, api);
    }
    if (st.atk > 0) dash = Math.max(dash, .05);
    z.kageDash = dash;
    z.bossWindup = dash > 0 ? 0 : st.windup > 0 ? st.windup : st.hold;
  }

  // ------------------------------------------------------------------ shared shapes
  const WOOD = ['#3b2414', '#8a5a32', '#c48d55'];
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  // A filling danger mark: dark tint, coloured core that grows with k, pulsing rim.
  function markCircle(ctx, x, y, r, rgb, k, time, faint) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    ctx.fillStyle = `rgba(24,12,8,${faint ? .08 : .16})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${(faint ? .1 : .16) + .16 * k})`; ctx.beginPath(); ctx.arc(x, y, r * clamp01(k), 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,6,.35)'; ctx.lineWidth = faint ? 4 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.lineWidth = faint ? 2 : 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (!faint) {
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * .8;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14)); ctx.lineTo(x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12)); ctx.stroke();
      }
    }
  }
  function teleShape(ctx, s, rgb, k, time) {
    const pulse = .55 + Math.sin(time * 22) * .2;
    if (s.k === 'c') { markCircle(ctx, s.x, s.y, s.r, rgb, k, time, s.faint); return; }
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.a);
    if (s.k === 'line') {
      ctx.fillStyle = 'rgba(24,12,8,.16)'; ctx.fillRect(0, -s.w, s.len, s.w * 2);
      ctx.fillStyle = `rgba(${rgb},${.14 + .16 * k})`; ctx.fillRect(0, -s.w, s.len * k, s.w * 2);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,10,6,.3)'; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; ctx.strokeRect(0, -s.w, s.len, s.w * 2);
      ctx.lineWidth = 2.5; ctx.beginPath();
      for (let d = 60 + (time * 260) % 120; d < s.len - 20; d += 120) { ctx.moveTo(d - 16, -s.w * .4); ctx.lineTo(d, 0); ctx.lineTo(d - 16, s.w * .4); }
      ctx.stroke();
    } else if (s.k === 'cone') {
      ctx.fillStyle = `rgba(24,12,8,${s.faint ? .07 : .15})`; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${(s.faint ? .08 : .14) + .16 * k})`; sector(ctx, 0, 0, 0, s.r * k, -s.h, s.h); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,10,6,.3)'; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${rgb},${pulse})`; sector(ctx, 0, 0, 0, s.r, -s.h, s.h); ctx.stroke();
    }
    ctx.restore();
  }
  // Crater with a raised rim and a few cracks (ground).
  function craterG(ctx, x, y, r, alpha, seed) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6e5a46'; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r * .46, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c231c'; ctx.beginPath(); ctx.ellipse(x, y + 3, r * .68, r * .34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1f18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = hash(i * 4.7 + seed) * TAU;
      ctx.moveTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .35);
      const b = a + (hash(i * 9 + seed) - .5) * .5;
      ctx.lineTo(x + Math.cos(b) * r * 1.05, y + Math.sin(b) * r * .55);
      ctx.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * .66);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Rolling dust ring and debris after a heavy impact (overlay).
  function dustBurst(ctx, x, y, r, t, seed, kind = 'dust', n = 12) {
    const K = Kit(), dust = K.puff(kind), e = easeOut(t / 1.3), a0 = 1 - win(t, .7, 2.2);
    if (a0 <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .4, d = r * (.35 + e * (.6 + hash(i * 2.3 + seed) * .35));
      K.stamp(ctx, dust, x + Math.cos(a) * d, y + Math.sin(a) * d * .5 - 10 - hash(i * 4.4) * r * .12, r * (.11 + e * (.08 + hash(i * 6.1) * .08)), a0 * .8, .75);
    }
    if (t < 1.1) K.fx.debris(ctx, x, y, r * 1.2, t / 1.1, seed, '#3a2c22', 14);
  }
  // Radial cracks spreading from an impact (ground).
  function cracks(ctx, x, y, r, k, seed, n = 9, w = 3, color = '#2a1f18') {
    if (k <= 0) return;
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const a = hash(i * 3.3 + seed) * TAU, L = r * (.55 + hash(i * 1.7 + seed) * .55) * k;
      let px = x, py = y, ang = a;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 1; s <= 4; s++) {
        ang += (hash(i * 7 + s + seed) - .5) * .7;
        px = x + Math.cos(ang) * L * s / 4; py = y + Math.sin(ang) * L * s / 4 * .55;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  function ring(ctx, x, y, r, w, color, squash = .5) {
    if (r <= 0) return;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke();
  }
  function leaf(ctx, x, y, angle, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-size, 0);
    ctx.quadraticCurveTo(0, -size * .55, size * 1.4, 0);
    ctx.quadraticCurveTo(0, size * .55, -size, 0);
    ctx.fill(); ctx.restore();
  }
  function petal(ctx, x, y, angle, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.quadraticCurveTo(size * .9, -size * .3, 0, size); ctx.quadraticCurveTo(-size * .9, -size * .3, 0, -size); ctx.fill();
    ctx.restore();
  }
  function kunai(ctx, x, y, angle, scale = 1, prongs = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.fillStyle = '#1b1e27';
    ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-1, -5); ctx.lineTo(1, 0); ctx.lineTo(-1, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c3cad6';
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(0, -3.4); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
    if (prongs) {
      ctx.fillStyle = '#1b1e27';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(4, s * 2); ctx.lineTo(10, s * 9); ctx.lineTo(6, s * 2); ctx.closePath(); ctx.fill(); }
    }
    ctx.strokeStyle = '#e9e2c6'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-10, 0); ctx.stroke();
    ctx.strokeStyle = '#1b1e27'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-13, 0, 3, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // Hiraishin formula: a ring of script round a planted kunai (ground).
  function formula(ctx, x, y, r, alpha, time, rgb = '255,220,110') {
    if (alpha <= .02) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .5); ctx.rotate(time * 1.2);
    ctx.strokeStyle = `rgba(30,20,8,${.5 * alpha})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${.9 * alpha})`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * .74, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      ctx.moveTo(Math.cos(a) * r * .76, Math.sin(a) * r * .76); ctx.lineTo(Math.cos(a) * r * (i % 2 ? .88 : .98), Math.sin(a) * r * (i % 2 ? .88 : .98));
      if (i % 4 === 0) { ctx.moveTo(Math.cos(a) * r * .74, Math.sin(a) * r * .74); ctx.lineTo(Math.cos(a + .4) * r * .4, Math.sin(a + .4) * r * .4); }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Quadratic-bezier tube from t0 to t1 with width tapering w0 → w1; builds a closed path.
  const TL = new Float32Array(80), TR = new Float32Array(80);
  function tube(ctx, x0, y0, cx, cy, x1, y1, t0, t1, w0, w1, wave = 0, phase = 0) {
    const N = 13;
    for (let i = 0; i <= N; i++) {
      const k = i / N, t = t0 + (t1 - t0) * k, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      let dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const w = w0 + (w1 - w0) * k, sway = Math.sin(k * 9 + phase) * wave;
      TL[i * 2] = px - dy * (w + sway); TL[i * 2 + 1] = py + dx * (w + sway);
      TR[i * 2] = px + dy * (w - sway); TR[i * 2 + 1] = py - dx * (w - sway);
    }
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(TL[i * 2], TL[i * 2 + 1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(TR[i * 2], TR[i * 2 + 1]);
    ctx.closePath();
  }
  // Dragon head facing `angle` at (x, y): snout, jaw, horns, eye. Palette [outline, body, light, eye].
  function dragonHead(ctx, x, y, angle, s, pal, open = .5) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    ctx.lineJoin = 'round';
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(-s * .6, -s * .55); ctx.quadraticCurveTo(s * .2, -s * .75, s * 1.15, -s * .25);
    ctx.lineTo(s * .55, -s * .02 - open * s * .1); ctx.lineTo(s * 1.05, s * .2 + open * s * .45);
    ctx.quadraticCurveTo(s * .2, s * .55, -s * .6, s * .45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(-s * .5, -s * .45); ctx.quadraticCurveTo(s * .2, -s * .63, s * 1.02, -s * .24);
    ctx.lineTo(s * .48, -s * .03 - open * s * .1); ctx.lineTo(s * .94, s * .18 + open * s * .4);
    ctx.quadraticCurveTo(s * .2, s * .45, -s * .5, s * .36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[2];
    ctx.beginPath(); ctx.moveTo(-s * .3, -s * .4); ctx.quadraticCurveTo(s * .3, -s * .55, s * .9, -s * .25);
    ctx.quadraticCurveTo(s * .3, -s * .35, -s * .3, -s * .25); ctx.closePath(); ctx.fill();
    // mane / horns
    ctx.strokeStyle = pal[0]; ctx.lineWidth = Math.max(2, s * .16); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .2, -s * .5); ctx.quadraticCurveTo(-s * .7, -s * .95, -s * 1.2, -s * .85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .05, -s * .45); ctx.quadraticCurveTo(-s * .4, -s * 1.05, -s * .95, -s * 1.15); ctx.stroke();
    ctx.strokeStyle = pal[2]; ctx.lineWidth = Math.max(1.5, s * .09);
    ctx.beginPath(); ctx.moveTo(-s * .2, -s * .5); ctx.quadraticCurveTo(-s * .7, -s * .95, -s * 1.15, -s * .85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .05, -s * .45); ctx.quadraticCurveTo(-s * .4, -s * 1.05, -s * .9, -s * 1.1); ctx.stroke();
    // whiskers
    ctx.strokeStyle = pal[2]; ctx.lineWidth = Math.max(1, s * .05);
    ctx.beginPath(); ctx.moveTo(s * .95, -s * .2); ctx.quadraticCurveTo(s * 1.3, -s * .5, s * 1.55, -s * .3); ctx.stroke();
    // eye
    ctx.fillStyle = pal[3];
    ctx.beginPath(); ctx.ellipse(s * .3, -s * .3, s * .15, s * .075, -.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120808'; ctx.beginPath(); ctx.ellipse(s * .33, -s * .3, s * .04, s * .06, 0, 0, TAU); ctx.fill();
    // fangs
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(s * .7, -s * .12); ctx.lineTo(s * .76, s * .06); ctx.lineTo(s * .82, -s * .14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .8, s * .16 + open * s * .3); ctx.lineTo(s * .86, s * .0 + open * s * .2); ctx.lineTo(s * .92, s * .18 + open * s * .32); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ cached art
  // Wood Release trees (giant trunks bursting out of the ground into dense canopies).
  function canopySprite(K, bloom) {
    return K.sprite(bloom ? 'hkb:bloomCanopy' : 'hkb:canopy', 96, 96, g => {
      const gr = g.createRadialGradient(36, 32, 2, 48, 48, 48);
      if (bloom) { gr.addColorStop(0, '#fff4fa'); gr.addColorStop(.35, '#ffc2dc'); gr.addColorStop(.7, '#e67fae'); gr.addColorStop(.9, 'rgba(150,60,110,.85)'); gr.addColorStop(1, 'rgba(150,60,110,0)'); }
      else { gr.addColorStop(0, '#b8ef7c'); gr.addColorStop(.35, '#6fbf4a'); gr.addColorStop(.7, '#3d8a33'); gr.addColorStop(.9, 'rgba(28,80,30,.85)'); gr.addColorStop(1, 'rgba(28,80,30,0)'); }
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
      // leaf / blossom speckle for texture
      for (let i = 0; i < 26; i++) {
        const a = hash(i * 3.1) * TAU, d = Math.sqrt(hash(i * 5.3)) * 40;
        g.fillStyle = bloom ? (i % 3 ? 'rgba(255,240,248,.8)' : 'rgba(200,70,130,.55)') : (i % 3 ? 'rgba(200,255,150,.45)' : 'rgba(20,60,20,.4)');
        g.beginPath(); g.ellipse(48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 4, 2.6, a, 0, TAU); g.fill();
      }
    });
  }
  function giantTree(ctx, x, y, h, w, seed, K, bloom) {
    const top = y - h, lean = (hash(seed) - .5) * w * 2.4;
    ctx.fillStyle = WOOD[0]; tube(ctx, x, y + 2, x - lean * .3, y - h * .5, x + lean, top, 0, 1, w * 1.3 + 2, w * .55 + 1, w * .12, seed); ctx.fill();
    ctx.fillStyle = WOOD[1]; tube(ctx, x, y + 2, x - lean * .3, y - h * .5, x + lean, top, 0, 1, w * 1.3, w * .55, w * .12, seed); ctx.fill();
    ctx.fillStyle = WOOD[2]; tube(ctx, x - w * .4, y, x - lean * .3 - w * .4, y - h * .5, x + lean - w * .2, top, .05, .95, w * .3, w * .12); ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,10,.6)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { const yy = y - h * i / 7; ctx.beginPath(); ctx.moveTo(x - w * .9 + lean * i / 7, yy); ctx.quadraticCurveTo(x + lean * i / 7, yy + 4, x + w * .8 + lean * i / 7, yy - 1); ctx.stroke(); }
    ctx.strokeStyle = WOOD[0]; ctx.lineWidth = Math.max(2, w * .35); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -1; i <= 1; i += 2) { ctx.moveTo(x, y - w * .4); ctx.quadraticCurveTo(x + i * w * 1.4, y - w * .2, x + i * w * 2.4, y + w * .5); }
    ctx.stroke();
    const c = canopySprite(K, bloom), r = w * 3.3;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + seed, d = r * .55;
      K.stamp(ctx, c, x + lean + Math.cos(a) * d, top + Math.sin(a) * d * .55 - r * .15, r * .72, 1);
    }
    K.stamp(ctx, c, x + lean, top - r * .35, r * .82, 1);
  }
  const TREE_W = 170, TREE_H = 280;
  function treeSprite(v, bloom) {
    const K = Kit();
    return K.sprite('hkb:tree' + (bloom ? 'b' : '') + v, TREE_W, TREE_H, g => giantTree(g, TREE_W / 2, TREE_H - 12, 185 + v * 6, 11 + v * 1.3, v * 3.7 + 1, K, bloom));
  }
  function forestTrees(R, seed, dense) {
    const trees = [];
    for (let d = 60, ringI = 0; d < R; d += 80, ringI++) {
      const n = Math.floor(TAU * d / (dense ? 92 : 120));
      for (let i = 0; i < n; i++) {
        const h = k => hash(ringI * 131 + i * 17 + k + seed);
        const a = (i + h(1) * .7) / n * TAU, dd = d + (h(2) - .5) * 56;
        trees.push({ x: Math.cos(a) * dd, y: Math.sin(a) * dd, d: dd, v: Math.floor(h(3) * 4), s: .7 + h(4) * .55 + (dd < 200 ? .25 : 0), lag: h(5) * .12, flip: h(6) > .5 });
      }
    }
    trees.sort((p, q) => p.y - q.y);
    return trees;
  }
  function bloomTrees(R, seed) {
    const trees = [];
    for (let i = 0; i < 30; i++) {
      const a = hash(i * 2.7 + seed) * TAU, d = 110 + Math.sqrt(hash(i * 4.9 + seed)) * (R - 130);
      trees.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, d, v: i % 4, s: .65 + hash(i * 1.3 + seed) * .45, lag: hash(i * 8.1) * .2, flip: i % 2 === 0 });
    }
    trees.sort((p, q) => p.y - q.y);
    return trees;
  }
  // Rock sprite (boulders, wall rubble, fissure slabs).
  function rockSprite() {
    return Kit().sprite('hkb:rock', 160, 160, g => {
      const c = 80, R = 72, path = () => {
        g.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = i / 20 * TAU, r = R * (.82 + hash(i % 20 + 4) * .18);
          if (i) g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else g.moveTo(c + r, c);
        }
        g.closePath();
      };
      path(); g.fillStyle = '#5a4a3c'; g.fill();
      g.save(); path(); g.clip();
      g.fillStyle = '#7d6a56'; g.beginPath(); g.arc(c + 18, c - 22, R * .95, 0, TAU); g.fill();
      g.fillStyle = '#a58e72'; g.beginPath(); g.arc(c + 34, c - 42, R * .52, 0, TAU); g.fill();
      g.fillStyle = '#3a2f27'; g.beginPath(); g.arc(c - 36, c + 40, R * .78, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,22,16,.7)'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        let x = c - 40 + hash(i * 9.1) * 80, y = c - 40 + hash(i * 4.4) * 80;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (hash(i * 7 + k) - .5) * 34; y += 7 + hash(i * 3 + k * 5) * 14; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      path(); g.strokeStyle = '#1e1712'; g.lineWidth = 4; g.stroke();
    });
  }
  function rockAt(ctx, x, y, R, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(rockSprite(), -R, -R, R * 2, R * 2);
    ctx.restore();
  }
  // A torn-up tree trunk with roots (Tsunade throws these).
  function logSprite() {
    return Kit().sprite('hkb:log', 220, 70, g => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.fillStyle = WOOD[0]; g.beginPath(); g.moveTo(26, 14); g.lineTo(196, 18); g.quadraticCurveTo(212, 35, 196, 52); g.lineTo(26, 56); g.quadraticCurveTo(10, 35, 26, 14); g.fill();
      g.fillStyle = WOOD[1]; g.beginPath(); g.moveTo(28, 18); g.lineTo(194, 21); g.quadraticCurveTo(206, 35, 194, 48); g.lineTo(28, 52); g.quadraticCurveTo(16, 35, 28, 18); g.fill();
      g.fillStyle = WOOD[2]; g.fillRect(30, 22, 160, 7);
      g.strokeStyle = 'rgba(40,22,10,.6)'; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const x = 40 + i * 17; g.beginPath(); g.moveTo(x, 20); g.quadraticCurveTo(x + 6, 35, x - 2, 51); g.stroke(); }
      // roots at one end, a splintered break at the other
      g.strokeStyle = WOOD[0]; g.lineWidth = 6;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(24, 22 + i * 7); g.quadraticCurveTo(10, 14 + i * 9, 2 + hash(i) * 6, 6 + i * 13); g.stroke(); }
      g.fillStyle = '#e8c690'; g.beginPath(); g.ellipse(200, 35, 7, 16, 0, 0, TAU); g.fill();
      g.strokeStyle = '#8a5a32'; g.lineWidth = 1.5; for (const r of [4, 9, 13]) { g.beginPath(); g.ellipse(200, 35, r * .45, r, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#6fbf4a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(120 + i * 18, 14, 7, 4, -.4, 0, TAU); g.fill(); }
    });
  }

  // Mokujin: the wooden giant (body only, arms are drawn live). 320×420, origin at the feet (160, 410).
  const GOLEM_W = 320, GOLEM_H = 420;
  function golemSprite() {
    return Kit().sprite('hkb:golem', GOLEM_W, GOLEM_H, g => {
      g.translate(160, 410); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, lw = 4) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#24140a'; g.lineWidth = lw; g.stroke(); };
      const grain = (x0, y0, x1, y1, n) => {
        g.strokeStyle = 'rgba(40,20,8,.45)'; g.lineWidth = 1.6;
        for (let i = 0; i < n; i++) { const t = (i + .5) / n; g.beginPath(); g.moveTo(lerp(x0, x1, t), y0); g.quadraticCurveTo(lerp(x0, x1, t) + (hash(i) - .5) * 10, (y0 + y1) / 2, lerp(x0, x1, t) + (hash(i + 3) - .5) * 6, y1); g.stroke(); }
      };
      // legs: thick posts with knee plates
      for (const s of [-1, 1]) {
        shape(() => { g.beginPath(); g.moveTo(s * 18, -150); g.lineTo(s * 70, -150); g.lineTo(s * 78, -6); g.lineTo(s * 12, -6); g.closePath(); }, '#7a4e2a');
        grain(s * 20, -146, s * 74, -10, 4);
        shape(() => { g.beginPath(); g.ellipse(s * 46, -80, 30, 20, 0, 0, TAU); }, '#9a6a3a', 3);
        shape(() => { g.beginPath(); g.ellipse(s * 46, -4, 42, 12, 0, 0, TAU); }, '#5a3418', 3);
      }
      // plated skirt
      for (let i = -3; i <= 3; i++) shape(() => { g.beginPath(); g.moveTo(i * 26 - 15, -190); g.lineTo(i * 26 + 15, -190); g.lineTo(i * 29 + 16, -128); g.lineTo(i * 29 - 16, -128); g.closePath(); }, i % 2 ? '#8a5a32' : '#a06a3a', 3);
      // barrel torso
      shape(() => { g.beginPath(); g.moveTo(-96, -330); g.quadraticCurveTo(0, -352, 96, -330); g.quadraticCurveTo(112, -260, 82, -186); g.lineTo(-82, -186); g.quadraticCurveTo(-112, -260, -96, -330); g.closePath(); }, '#8a5a32', 5);
      g.save(); g.beginPath(); g.moveTo(-96, -330); g.quadraticCurveTo(0, -352, 96, -330); g.quadraticCurveTo(112, -260, 82, -186); g.lineTo(-82, -186); g.quadraticCurveTo(-112, -260, -96, -330); g.clip();
      g.fillStyle = 'rgba(30,14,4,.35)'; g.fillRect(30, -360, 90, 200);
      g.fillStyle = 'rgba(255,220,160,.18)'; g.fillRect(-100, -340, 50, 150);
      grain(-90, -330, 90, -190, 10);
      g.restore();
      // chest plates (lamellar rows)
      for (let r = 0; r < 4; r++) shape(() => { const yy = -318 + r * 30; g.beginPath(); g.moveTo(-88, yy); g.quadraticCurveTo(0, yy - 10, 88, yy); g.lineTo(86, yy + 22); g.quadraticCurveTo(0, yy + 14, -86, yy + 22); g.closePath(); }, r % 2 ? '#9a6a3a' : '#b07a44', 3);
      // belt with a round wooden boss
      shape(() => { g.beginPath(); g.rect(-86, -198, 172, 18); }, '#5a3418', 3);
      shape(() => { g.beginPath(); g.arc(0, -189, 16, 0, TAU); }, '#c48d55', 3);
      // pauldrons
      for (const s of [-1, 1]) for (let p = 2; p >= 0; p--) shape(() => {
        const cx = s * (104 + p * 6), cy = -318 + p * 18;
        g.beginPath(); g.moveTo(cx - s * 44, cy - 6); g.quadraticCurveTo(cx, cy - 40, cx + s * 46, cy); g.quadraticCurveTo(cx + s * 40, cy + 20, cx + s * 6, cy + 20); g.quadraticCurveTo(cx - s * 30, cy + 16, cx - s * 44, cy - 6); g.closePath();
      }, p ? '#8a5a32' : '#b07a44', 3.5);
      // head: kabuto helmet with a flared neck guard, a grim mask face, horn crest
      shape(() => { g.beginPath(); g.moveTo(-74, -344); g.quadraticCurveTo(-82, -372, -60, -384); g.lineTo(60, -384); g.quadraticCurveTo(82, -372, 74, -344); g.quadraticCurveTo(0, -330, -74, -344); g.closePath(); }, '#6a4022', 4);
      shape(() => { g.beginPath(); g.ellipse(0, -386, 44, 38, 0, 0, TAU); }, '#9a6a3a', 4);
      shape(() => { g.beginPath(); g.moveTo(-46, -394); g.quadraticCurveTo(0, -440, 46, -394); g.lineTo(42, -404); g.quadraticCurveTo(0, -446, -42, -404); g.closePath(); }, '#7a4e2a', 3);
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 16, -420); g.quadraticCurveTo(s * 44, -452, s * 70, -462); g.quadraticCurveTo(s * 40, -440, s * 26, -410); g.closePath(); }, '#c48d55', 3);
      // mask: deep eye slits, nose ridge, a grim mouth guard
      g.fillStyle = '#1a0d04';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, -392); g.lineTo(s * 32, -400); g.lineTo(s * 30, -386); g.lineTo(s * 8, -382); g.closePath(); g.fill(); }
      shape(() => { g.beginPath(); g.moveTo(-26, -374); g.lineTo(26, -374); g.lineTo(20, -356); g.lineTo(-20, -356); g.closePath(); }, '#5a3418', 2.5);
      g.strokeStyle = '#e8c690'; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 8, -372); g.lineTo(i * 8, -360); g.stroke(); }
      g.strokeStyle = '#24140a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -410); g.lineTo(0, -392); g.stroke();
    });
  }
  // A great wooden fist, knuckles toward +x. 140×120, centre at (70, 60).
  function fistSprite() {
    return Kit().sprite('hkb:fist', 140, 120, g => {
      g.translate(70, 60); g.lineJoin = 'round';
      const shape = (build, fill, lw = 4) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#24140a'; g.lineWidth = lw; g.stroke(); };
      shape(() => { g.beginPath(); g.moveTo(-60, -34); g.lineTo(-10, -44); g.quadraticCurveTo(40, -48, 52, -30); g.quadraticCurveTo(64, 0, 52, 34); g.quadraticCurveTo(30, 50, -10, 44); g.lineTo(-60, 34); g.closePath(); }, '#9a6a3a', 5);
      g.save(); g.beginPath(); g.rect(-70, 0, 140, 60); g.clip(); g.fillStyle = 'rgba(30,14,4,.3)'; g.fillRect(-70, 0, 140, 60); g.restore();
      // four curled fingers
      for (let i = 0; i < 4; i++) shape(() => { const yy = -32 + i * 21; g.beginPath(); g.ellipse(40, yy + 10, 22, 11, 0, 0, TAU); }, i % 2 ? '#b07a44' : '#a8723e', 3.5);
      // thumb over the fingers
      shape(() => { g.beginPath(); g.moveTo(-6, -40); g.quadraticCurveTo(30, -50, 34, -22); g.quadraticCurveTo(20, -14, -2, -22); g.closePath(); }, '#c48d55', 3.5);
      g.strokeStyle = 'rgba(40,20,8,.5)'; g.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-54, -24 + i * 16); g.quadraticCurveTo(-20, -28 + i * 16, 10, -22 + i * 16); g.stroke(); }
    });
  }
  // The Thousand-Armed Kannon: a towering wooden Buddha, palms joined, a vast halo of arms behind it.
  // 760×760, origin at the base (380, 750).
  const KAN_W = 760, KAN_H = 760, KAN_OX = 380, KAN_OY = 750;
  function kannonSprite() {
    return Kit().sprite('hkb:kannon', KAN_W, KAN_H, g => {
      g.translate(KAN_OX, KAN_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, lw = 4, ink = '#24140a') => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); };
      // halo of arms: two layers fanning out behind the shoulders, each ending in an open hand
      const arm = (x0, y0, a, L, w, c1, c2) => {
        const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L, mx = (x0 + x1) / 2 + Math.cos(a + 1.57) * L * .08, my = (y0 + y1) / 2 + Math.sin(a + 1.57) * L * .08;
        g.fillStyle = '#24140a'; tube(g, x0, y0, mx, my, x1, y1, 0, 1, w + 3, w * .7 + 3); g.fill();
        g.fillStyle = c1; tube(g, x0, y0, mx, my, x1, y1, 0, 1, w, w * .7); g.fill();
        g.fillStyle = c2; tube(g, x0 - Math.sin(a) * w * .3, y0 + Math.cos(a) * w * .3 - w * .3, mx, my - w * .3, x1, y1 - w * .2, .05, .95, w * .25, w * .15); g.fill();
        // open palm with fingers
        g.save(); g.translate(x1, y1); g.rotate(a);
        shape(() => { g.beginPath(); g.ellipse(w * 1.2, 0, w * 1.5, w * 1.15, 0, 0, TAU); }, c1, 2.5);
        g.strokeStyle = '#24140a'; g.lineWidth = w * .55 + 2.5;
        for (let f = 0; f < 4; f++) { const fa = (f - 1.5) * .28; g.beginPath(); g.moveTo(w * 2, Math.sin(fa) * w * .9); g.lineTo(w * 2 + Math.cos(fa) * w * 1.6, Math.sin(fa) * w * 2.2); g.stroke(); }
        g.strokeStyle = c1; g.lineWidth = w * .55;
        for (let f = 0; f < 4; f++) { const fa = (f - 1.5) * .28; g.beginPath(); g.moveTo(w * 2, Math.sin(fa) * w * .9); g.lineTo(w * 2 + Math.cos(fa) * w * 1.6, Math.sin(fa) * w * 2.2); g.stroke(); }
        g.restore();
      };
      // outer ring of the halo
      g.strokeStyle = '#24140a'; g.lineWidth = 22; g.beginPath(); g.arc(0, -420, 330, Math.PI * .92, Math.PI * 2.08); g.stroke();
      g.strokeStyle = '#a06a3a'; g.lineWidth = 15; g.beginPath(); g.arc(0, -420, 330, Math.PI * .92, Math.PI * 2.08); g.stroke();
      g.strokeStyle = '#d8a868'; g.lineWidth = 4; g.beginPath(); g.arc(0, -420, 326, Math.PI * .95, Math.PI * 2.05); g.stroke();
      for (let layer = 0; layer < 3; layer++) {
        const n = 13 - layer * 2, L = 300 - layer * 62, w = 13 - layer * 1.5;
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1), side = u < .5 ? -1 : 1, a = Math.PI * (1.04 + u * .92) + (layer ? .06 : 0);
          arm(side * 70, -330, a, L, w, layer === 0 ? '#7a4e2a' : layer === 1 ? '#946238' : '#b07a44', layer === 0 ? '#a06a3a' : '#d8a868');
        }
      }
      // lower arms reaching out to the sides
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) arm(s * 88, -300 + i * 30, s > 0 ? -.2 + i * .28 : Math.PI + .2 - i * .28, 230 - i * 30, 12, '#946238', '#d8a868');
      // lotus seat
      for (let i = 0; i < 11; i++) {
        const a = Math.PI + i / 10 * Math.PI, px = Math.cos(a) * 220, py = -30 + Math.sin(a) * 30;
        shape(() => { g.beginPath(); g.moveTo(px - 30, py + 22); g.quadraticCurveTo(px - 26, py - 30, px, py - 46); g.quadraticCurveTo(px + 26, py - 30, px + 30, py + 22); g.closePath(); }, i % 2 ? '#a06a3a' : '#b8844c', 3);
      }
      shape(() => { g.beginPath(); g.ellipse(0, -12, 240, 30, 0, 0, TAU); }, '#6a4022', 4);
      // folded legs
      shape(() => { g.beginPath(); g.ellipse(0, -84, 190, 56, 0, 0, TAU); }, '#8a5a32', 5);
      g.strokeStyle = 'rgba(40,20,8,.5)'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-160 + i * 70, -110); g.quadraticCurveTo(-140 + i * 70, -80, -150 + i * 70, -40); g.stroke(); }
      // robed torso
      shape(() => { g.beginPath(); g.moveTo(-104, -330); g.quadraticCurveTo(0, -352, 104, -330); g.quadraticCurveTo(128, -220, 118, -110); g.lineTo(-118, -110); g.quadraticCurveTo(-128, -220, -104, -330); g.closePath(); }, '#9a6a3a', 5);
      g.save(); g.beginPath(); g.moveTo(-104, -330); g.quadraticCurveTo(0, -352, 104, -330); g.quadraticCurveTo(128, -220, 118, -110); g.lineTo(-118, -110); g.quadraticCurveTo(-128, -220, -104, -330); g.clip();
      g.fillStyle = 'rgba(30,14,4,.3)'; g.fillRect(40, -360, 100, 260);
      g.strokeStyle = 'rgba(40,20,8,.55)'; g.lineWidth = 2.4;
      for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(-90 + i * 30, -300); g.quadraticCurveTo(-80 + i * 28, -200, -100 + i * 33, -112); g.stroke(); }
      g.restore();
      // sash across the chest
      shape(() => { g.beginPath(); g.moveTo(-104, -322); g.lineTo(-74, -334); g.lineTo(110, -150); g.lineTo(84, -134); g.closePath(); }, '#c48d55', 3);
      // palms joined in prayer
      shape(() => { g.beginPath(); g.moveTo(-60, -170); g.quadraticCurveTo(-40, -200, -12, -270); g.lineTo(0, -300); g.lineTo(12, -270); g.quadraticCurveTo(40, -200, 60, -170); g.quadraticCurveTo(0, -150, -60, -170); g.closePath(); }, '#b07a44', 4);
      g.strokeStyle = '#24140a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -298); g.lineTo(0, -196); g.stroke();
      // neck + head with a high topknot, long ears, closed eyes and an urna
      shape(() => { g.beginPath(); g.rect(-30, -372, 60, 44); }, '#9a6a3a', 4);
      shape(() => { g.beginPath(); g.ellipse(0, -430, 66, 74, 0, 0, TAU); }, '#b07a44', 5);
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.ellipse(s * 66, -420, 14, 40, s * .1, 0, TAU); }, '#9a6a3a', 3.5);
      shape(() => { g.beginPath(); g.ellipse(0, -506, 44, 30, 0, 0, TAU); }, '#6a4022', 4);
      shape(() => { g.beginPath(); g.ellipse(0, -540, 26, 22, 0, 0, TAU); }, '#7a4e2a', 4);
      g.save(); g.beginPath(); g.ellipse(0, -430, 66, 74, 0, 0, TAU); g.clip();
      g.fillStyle = 'rgba(30,14,4,.28)'; g.fillRect(14, -510, 60, 160);
      g.fillStyle = '#6a4022'; g.beginPath(); g.moveTo(-70, -470); g.quadraticCurveTo(0, -500, 70, -470); g.lineTo(70, -490); g.lineTo(-70, -490); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = '#24140a'; g.lineWidth = 4;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 12, -432); g.quadraticCurveTo(s * 28, -424, s * 44, -434); g.stroke(); }
      g.lineWidth = 3; g.beginPath(); g.moveTo(-34, -452); g.quadraticCurveTo(-22, -460, -8, -452); g.moveTo(8, -452); g.quadraticCurveTo(22, -460, 34, -452); g.stroke();
      g.beginPath(); g.moveTo(0, -440); g.lineTo(-6, -404); g.lineTo(4, -400); g.stroke();
      g.beginPath(); g.moveTo(-14, -384); g.quadraticCurveTo(0, -378, 14, -384); g.stroke();
      g.fillStyle = '#e8b04a'; g.beginPath(); g.arc(0, -466, 7, 0, TAU); g.fill(); g.stroke();
    });
  }
  // Edo Tensei coffin standing upright. 90×150, origin at the base (45, 146).
  function coffinSprite() {
    return Kit().sprite('hkb:coffin', 90, 150, g => {
      g.translate(45, 146); g.lineJoin = 'round';
      const shape = (build, fill, lw = 3) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#120a06'; g.lineWidth = lw; g.stroke(); };
      shape(() => { g.beginPath(); g.moveTo(14, -8); g.lineTo(34, -16); g.lineTo(34, -136); g.lineTo(14, -128); g.closePath(); }, '#2a1c14');
      shape(() => { g.beginPath(); g.moveTo(-34, -8); g.lineTo(14, -8); g.lineTo(14, -128); g.lineTo(-34, -128); g.closePath(); }, '#4a3426');
      shape(() => { g.beginPath(); g.moveTo(-34, -128); g.lineTo(14, -128); g.lineTo(34, -136); g.lineTo(-14, -136); g.closePath(); }, '#6a4c38');
      g.fillStyle = 'rgba(255,230,200,.12)'; g.fillRect(-30, -124, 8, 112);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.strokeRect(-28, -120, 36, 106);
      // name talisman
      shape(() => { g.beginPath(); g.rect(-18, -106, 16, 62); }, '#efe6cc', 1.5);
      g.fillStyle = '#7a1414'; g.font = 'bold 13px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('穢', -10, -92); g.fillText('土', -10, -74); g.fillText('転', -10, -56);
    });
  }
  // A reanimated shinobi rising out of the coffins: a dark cracked silhouette with pale eyes. 80×120, base (40, 116).
  function ghostSprite() {
    return Kit().sprite('hkb:ghost', 80, 120, g => {
      g.translate(40, 116);
      const gr = g.createLinearGradient(0, -110, 0, 0);
      gr.addColorStop(0, 'rgba(46,34,58,.95)'); gr.addColorStop(.7, 'rgba(36,26,46,.85)'); gr.addColorStop(1, 'rgba(36,26,46,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, -92, 14, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-22, -76); g.quadraticCurveTo(0, -84, 22, -76); g.lineTo(28, -40); g.lineTo(16, -42); g.lineTo(14, 0); g.lineTo(-14, 0); g.lineTo(-16, -42); g.lineTo(-28, -40); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(220,200,240,.45)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-6, -100); g.lineTo(-2, -92); g.lineTo(-7, -86); g.moveTo(8, -70); g.lineTo(4, -58); g.lineTo(10, -50); g.moveTo(-12, -60); g.lineTo(-6, -48); g.stroke();
      g.fillStyle = '#f2ecff'; g.fillRect(-9, -95, 6, 2.6); g.fillRect(3, -95, 6, 2.6);
    });
  }
  // Explosive tag (kibakufuda). 26×46, centre (13, 23).
  function tagSprite() {
    return Kit().sprite('hkb:tag', 26, 46, g => {
      g.fillStyle = '#f2ead2'; g.fillRect(2, 2, 22, 42);
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.4; g.strokeRect(2, 2, 22, 42);
      g.strokeStyle = '#b8262a'; g.lineWidth = 1; g.strokeRect(5, 5, 16, 36);
      g.fillStyle = '#1a1010'; g.font = 'bold 12px "Yu Mincho","MS Mincho",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('爆', 13, 16); g.fillStyle = '#b8262a'; g.fillText('封', 13, 32);
    });
  }
  function tinyShuriken() {
    return Kit().sprite('hkb:tinyShuriken', 28, 28, g => {
      g.translate(14, 14);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3.4 : 12.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath();
      g.fillStyle = '#3a414c'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#0e1116'; g.stroke();
      g.fillStyle = '#dfe6ee'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-11, -1); g.lineTo(-3, -3); g.lineTo(-1, -11); g.closePath(); g.fill();
      g.fillStyle = '#0e1116'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
    });
  }
  // The Shinigami (Reaper Death Seal): pale violet demon, wild white hair, horns, a tantō between its
  // teeth, prayer beads round the wrist, palms joined. 520×620, origin (260, 610), fading into mist below.
  const SHI_W = 520, SHI_H = 620, SHI_OX = 260, SHI_OY = 610;
  function shinigamiSprite() {
    return Kit().sprite('hkb:shinigami', SHI_W, SHI_H, g => {
      g.translate(SHI_OX, SHI_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const INK = '#1a0f22';
      const shape = (build, fill, lw = 4) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
      // wild white hair mass behind the head
      shape(() => {
        g.beginPath(); g.moveTo(-60, -430);
        for (let i = 0; i <= 16; i++) { const a = Math.PI * (1.0 + i / 16), r = i % 2 ? 120 : 175 + hash(i) * 60; g.lineTo(Math.cos(a) * r, -470 + Math.sin(a) * r * .85); }
        g.lineTo(150, -300); g.lineTo(120, -360); g.lineTo(96, -260); g.lineTo(60, -380); g.lineTo(-60, -380); g.lineTo(-96, -260); g.lineTo(-120, -360); g.lineTo(-150, -300); g.closePath();
      }, '#ece8f2', 5);
      g.strokeStyle = 'rgba(120,110,150,.55)'; g.lineWidth = 2.4;
      for (let i = 0; i < 14; i++) { const a = Math.PI * (1.05 + i / 15), r0 = 70, r1 = 150 + hash(i * 3) * 40; g.beginPath(); g.moveTo(Math.cos(a) * r0, -470 + Math.sin(a) * r0 * .8); g.quadraticCurveTo(Math.cos(a + .1) * r1 * .7, -470 + Math.sin(a + .1) * r1 * .6, Math.cos(a) * r1, -470 + Math.sin(a) * r1 * .8); g.stroke(); }
      // robe torso (white kimono, dark sash), the body fading into mist toward the bottom
      const robe = g.createLinearGradient(0, -360, 0, -20);
      robe.addColorStop(0, '#f1eef6'); robe.addColorStop(.6, 'rgba(220,214,232,.9)'); robe.addColorStop(1, 'rgba(200,190,220,0)');
      shape(() => { g.beginPath(); g.moveTo(-150, -350); g.quadraticCurveTo(0, -380, 150, -350); g.quadraticCurveTo(190, -180, 160, -20); g.lineTo(-160, -20); g.quadraticCurveTo(-190, -180, -150, -350); g.closePath(); }, robe, 4);
      g.fillStyle = '#9a8fb2'; g.beginPath(); g.moveTo(-40, -360); g.lineTo(0, -270); g.lineTo(40, -360); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,60,110,.5)'; g.lineWidth = 2.4;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-120 + i * 48, -300); g.quadraticCurveTo(-110 + i * 46, -170, -130 + i * 52, -40); g.stroke(); }
      shape(() => { g.beginPath(); g.moveTo(-160, -210); g.quadraticCurveTo(0, -190, 160, -210); g.lineTo(162, -180); g.quadraticCurveTo(0, -160, -162, -180); g.closePath(); }, '#3a2a52', 3);
      // arms in wide sleeves, palms joined in prayer, prayer beads round the near wrist
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 140, -340); g.quadraticCurveTo(s * 200, -260, s * 120, -210); g.lineTo(s * 30, -250); g.quadraticCurveTo(s * 80, -300, s * 100, -330); g.closePath(); }, '#e6e1ee', 4);
      shape(() => { g.beginPath(); g.moveTo(-36, -232); g.quadraticCurveTo(-26, -290, -4, -330); g.lineTo(4, -330); g.quadraticCurveTo(26, -290, 36, -232); g.quadraticCurveTo(0, -222, -36, -232); g.closePath(); }, '#a89cc0', 4);
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -328); g.lineTo(0, -238); g.stroke();
      for (let i = 0; i < 11; i++) { const a = Math.PI * .1 + i / 10 * Math.PI * .8; g.fillStyle = i % 5 === 0 ? '#c8402a' : '#2a2030'; g.beginPath(); g.arc(-34 + Math.cos(a) * 30, -248 + Math.sin(a) * 12, 6, 0, TAU); g.fill(); }
      // head: pale violet, two horns, sunken glaring eyes, a wide grin clamping a tantō
      shape(() => { g.beginPath(); g.moveTo(-64, -470); g.quadraticCurveTo(-70, -400, -40, -362); g.quadraticCurveTo(0, -340, 40, -362); g.quadraticCurveTo(70, -400, 64, -470); g.quadraticCurveTo(0, -530, -64, -470); g.closePath(); }, '#b3a6c8', 5);
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 22, -500); g.quadraticCurveTo(s * 34, -548, s * 20, -582); g.quadraticCurveTo(s * 50, -544, s * 42, -494); g.closePath(); }, '#efe6d6', 3);
      // hair fringe over the brow
      shape(() => { g.beginPath(); g.moveTo(-70, -470); g.lineTo(-50, -440); g.lineTo(-36, -470); g.lineTo(-18, -436); g.lineTo(0, -472); g.lineTo(18, -436); g.lineTo(36, -470); g.lineTo(50, -440); g.lineTo(70, -470); g.quadraticCurveTo(0, -520, -70, -470); g.closePath(); }, '#f4f1f8', 3);
      g.fillStyle = '#3a2048';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 10, -432); g.lineTo(s * 46, -444); g.lineTo(s * 44, -420); g.lineTo(s * 12, -414); g.closePath(); g.fill(); }
      g.fillStyle = '#ffe2a0';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 28, -428, 9, 5, s * -.15, 0, TAU); g.fill(); }
      g.fillStyle = '#120808'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 28, -428, 2.6, 0, TAU); g.fill(); }
      // grin with sharp teeth
      shape(() => { g.beginPath(); g.moveTo(-46, -390); g.quadraticCurveTo(0, -360, 46, -390); g.quadraticCurveTo(0, -372, -46, -390); g.closePath(); }, '#2a0a14', 3);
      g.fillStyle = '#ffffff';
      for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 9 - 4, -385 + Math.abs(i) * 1.2); g.lineTo(i * 9 + 4, -385 + Math.abs(i) * 1.2); g.lineTo(i * 9, -377 + Math.abs(i) * .8); g.closePath(); g.fill(); }
      // tantō clamped in the teeth, hilt to one side
      shape(() => { g.beginPath(); g.moveTo(-40, -383); g.lineTo(100, -392); g.lineTo(108, -386); g.lineTo(-40, -378); g.closePath(); }, '#d8dce6', 2.4);
      shape(() => { g.beginPath(); g.rect(-86, -386, 46, 10); }, '#3a2030', 2.4);
      shape(() => { g.beginPath(); g.rect(-42, -390, 6, 18); }, '#c8a040', 2);
    });
  }
  // Yin Kurama crouched behind Minato, facing +x, jaws open. 680×520, origin (340, 510).
  const KUR_W = 680, KUR_H = 520, KUR_OX = 340, KUR_OY = 510, KUR_MOUTH = [300, -230];
  function kuramaSprite() {
    return Kit().sprite('hkb:kurama', KUR_W, KUR_H, g => {
      g.translate(KUR_OX, KUR_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const INK = '#3a1206';
      const shape = (build, fill, lw = 5) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
      const fur = '#f07a1e', furD = '#b8460e', furL = '#ffb050';
      // nine tails fanning up behind
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.02 + i * .085), L = 250 + hash(i) * 40, bx = -150, by = -170;
        const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L * .9, cx = bx + Math.cos(a - .5) * L * .6, cy = by + Math.sin(a - .5) * L * .6;
        g.fillStyle = INK; tube(g, bx, by, cx, cy, ex, ey, 0, 1, 34, 8); g.fill();
        g.fillStyle = i % 2 ? furD : fur; tube(g, bx, by, cx, cy, ex, ey, 0, 1, 30, 5); g.fill();
        g.fillStyle = furL; tube(g, bx, by - 8, cx, cy - 8, ex, ey, .1, .95, 8, 2); g.fill();
      }
      // haunch and body, shaded darker underneath
      const bodyP = () => { g.beginPath(); g.ellipse(-20, -170, 190, 120, -.15, 0, TAU); };
      shape(() => { g.beginPath(); g.ellipse(-150, -110, 120, 100, -.2, 0, TAU); }, furD);
      shape(bodyP, fur);
      g.save(); bodyP(); g.clip();
      g.fillStyle = 'rgba(120,30,6,.4)'; g.beginPath(); g.ellipse(-20, -60, 220, 90, -.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,200,120,.35)'; g.beginPath(); g.ellipse(-40, -250, 140, 40, -.15, 0, TAU); g.fill();
      g.restore();
      // forelegs: thick furred limbs with paws and claws
      for (const [lx, sh] of [[30, furD], [120, fur]]) {
        shape(() => { g.beginPath(); g.moveTo(lx - 46, -190); g.quadraticCurveTo(lx - 62, -110, lx - 30, -40); g.quadraticCurveTo(lx - 36, -14, lx - 22, -8); g.lineTo(lx + 50, -8); g.quadraticCurveTo(lx + 54, -30, lx + 30, -48); g.quadraticCurveTo(lx + 40, -120, lx + 44, -190); g.closePath(); }, sh);
        g.strokeStyle = 'rgba(90,30,8,.6)'; g.lineWidth = 3;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(lx - 30 + k * 6, -150 + k * 30); g.lineTo(lx - 44 + k * 6, -130 + k * 30); g.stroke(); }
        g.fillStyle = '#f6eadc'; g.strokeStyle = '#3a1206'; g.lineWidth = 2;
        for (let cl = 0; cl < 4; cl++) { g.beginPath(); g.moveTo(lx - 18 + cl * 18, -12); g.quadraticCurveTo(lx - 10 + cl * 18, -4, lx - 8 + cl * 18, 6); g.lineTo(lx - 4 + cl * 18, -12); g.closePath(); g.fill(); g.stroke(); }
      }
      // chest ruff: a jagged mane of pale fur under the jaw
      shape(() => { g.beginPath(); g.moveTo(70, -290); for (let i = 0; i <= 9; i++) { const yy = -290 + i * 24, xo = 100 + Math.sin(i * .5) * 30; g.lineTo(xo + (i % 2 ? 18 : 48), yy + 12); g.lineTo(xo + 10, yy + 24); } g.lineTo(70, -60); g.quadraticCurveTo(40, -170, 70, -290); g.closePath(); }, furL, 4);
      g.strokeStyle = 'rgba(90,30,8,.55)'; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const x = -170 + i * 26; g.beginPath(); g.moveTo(x, -250 + hash(i) * 30); g.quadraticCurveTo(x - 6, -236 + hash(i) * 30, x - 16, -214 + hash(i) * 30); g.stroke(); }
      // head: broad skull, long snout, tall ears
      for (const [ex, ey, c] of [[120, -400, furD], [210, -420, fur]]) shape(() => { g.beginPath(); g.moveTo(ex - 40, ey + 110); g.lineTo(ex - 10, ey); g.lineTo(ex + 50, ey + 100); g.closePath(); }, c);
      g.fillStyle = '#3a1206'; for (const [ex, ey] of [[120, -400], [210, -420]]) { g.beginPath(); g.moveTo(ex - 18, ey + 90); g.lineTo(ex - 6, ey + 26); g.lineTo(ex + 24, ey + 86); g.closePath(); g.fill(); }
      shape(() => { g.beginPath(); g.ellipse(180, -290, 112, 88, 0, 0, TAU); }, fur);
      // upper jaw / snout
      shape(() => { g.beginPath(); g.moveTo(200, -330); g.quadraticCurveTo(300, -330, 336, -280); g.lineTo(326, -262); g.quadraticCurveTo(270, -258, 210, -250); g.closePath(); }, fur);
      // open lower jaw
      shape(() => { g.beginPath(); g.moveTo(200, -226); g.quadraticCurveTo(270, -200, 316, -184); g.lineTo(306, -168); g.quadraticCurveTo(250, -170, 190, -190); g.closePath(); }, furD);
      // mouth interior
      g.fillStyle = '#5a0a0a'; g.beginPath(); g.moveTo(210, -250); g.quadraticCurveTo(270, -258, 326, -262); g.lineTo(316, -184); g.quadraticCurveTo(270, -200, 200, -226); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { const x = 220 + i * 17; g.beginPath(); g.moveTo(x, -256 + i * -.6); g.lineTo(x + 6, -236); g.lineTo(x + 12, -257); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - 4, -200 + i * 2.4); g.lineTo(x + 2, -218 + i * 2); g.lineTo(x + 8, -198 + i * 2.4); g.closePath(); g.fill(); }
      // nose
      g.fillStyle = '#1a0804'; g.beginPath(); g.ellipse(334, -284, 12, 9, 0, 0, TAU); g.fill();
      // eye: black rim, red iris, slit
      g.fillStyle = '#1a0804'; g.beginPath(); g.moveTo(170, -330); g.quadraticCurveTo(220, -360, 262, -322); g.quadraticCurveTo(220, -306, 170, -330); g.closePath(); g.fill();
      g.fillStyle = '#ff3a18'; g.beginPath(); g.ellipse(222, -328, 20, 10, -.15, 0, TAU); g.fill();
      g.fillStyle = '#1a0804'; g.beginPath(); g.ellipse(224, -328, 3.4, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = '#1a0804'; g.lineWidth = 6; g.beginPath(); g.moveTo(150, -360); g.quadraticCurveTo(210, -390, 270, -350); g.stroke();
      // cheek fur spikes
      g.fillStyle = furL; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(100, -300 + i * 22); g.lineTo(58, -310 + i * 26); g.lineTo(104, -282 + i * 22); g.closePath(); g.fill(); }
    });
  }
  // Katsuyu, the giant slug, rearing up and facing +x. 380×300, origin (190, 290).
  const KAT_W = 380, KAT_H = 300, KAT_OX = 190, KAT_OY = 290, KAT_MOUTH = [150, -170];
  function katsuyuSprite() {
    return Kit().sprite('hkb:katsuyu', KAT_W, KAT_H, g => {
      g.translate(KAT_OX, KAT_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const INK = '#1c2a3a';
      const body = () => { g.beginPath(); g.moveTo(-180, -6); g.quadraticCurveTo(-170, -70, -60, -84); g.quadraticCurveTo(60, -100, 110, -190); g.quadraticCurveTo(150, -250, 186, -200); g.quadraticCurveTo(200, -150, 160, -60); g.quadraticCurveTo(140, -6, 100, -2); g.closePath(); };
      body(); g.fillStyle = '#eef3f6'; g.fill();
      g.save(); body(); g.clip();
      g.fillStyle = 'rgba(150,170,200,.35)'; g.fillRect(-200, -40, 400, 50);
      // two blue stripes along the back
      g.strokeStyle = '#2f6fd0'; g.lineWidth = 14;
      g.beginPath(); g.moveTo(-170, -36); g.quadraticCurveTo(-60, -80, 40, -110); g.quadraticCurveTo(110, -150, 150, -230); g.stroke();
      g.strokeStyle = '#5a92e6'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(-160, -16); g.quadraticCurveTo(-60, -50, 50, -78); g.quadraticCurveTo(130, -110, 176, -190); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(-140 + i * 38, -60 - i * 14, 12, 4, -.4, 0, TAU); g.fill(); }
      g.restore();
      body(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
      // eye stalks
      for (const [sx, lean] of [[146, -.2], [170, .25]]) {
        const ex = sx + Math.sin(lean) * 60, ey = -236 - Math.cos(lean) * 60;
        g.strokeStyle = INK; g.lineWidth = 12; g.beginPath(); g.moveTo(sx, -226); g.quadraticCurveTo(sx + lean * 30, -260, ex, ey); g.stroke();
        g.strokeStyle = '#eef3f6'; g.lineWidth = 7; g.stroke();
        g.fillStyle = '#eef3f6'; g.beginPath(); g.arc(ex, ey, 9, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#1a2230'; g.beginPath(); g.arc(ex + 2, ey, 3.6, 0, TAU); g.fill();
      }
      // mouth slit
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(150, -176); g.quadraticCurveTo(170, -168, 186, -184); g.stroke();
    });
  }
  // Ninken: Pakkun and the pack, facing +x. 80×60, origin at the feet (40, 56).
  const DOGS = [['#c99a5a', '#5a3a1a', .8], ['#d8d4cc', '#6a6460', 1.25], ['#8a6a4a', '#3a2a1a', 1], ['#3a3438', '#1a1618', 1], ['#e0c08a', '#8a6a3a', .95], ['#6a5a4a', '#2a2018', 1.05], ['#a88a6a', '#4a3a2a', .9], ['#efe8dc', '#7a6a5a', 1]];
  function dogSprite(v) {
    return Kit().sprite('hkb:dog' + v, 80, 60, g => {
      const [c, d] = DOGS[v % DOGS.length];
      g.translate(40, 56); g.lineJoin = 'round'; g.lineCap = 'round';
      const INK = '#1a120c';
      const shape = (build, fill, lw = 2.5) => { build(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
      g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(-22, -16); g.quadraticCurveTo(-34, -30, -30, -38); g.stroke();
      g.strokeStyle = c; g.lineWidth = 4; g.stroke();
      for (const [lx, ll] of [[-18, 1], [-8, -1], [10, 1], [20, -1]]) { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(lx, -14); g.lineTo(lx + ll * 4, -2); g.stroke(); g.strokeStyle = lx % 2 ? d : c; g.lineWidth = 4; g.stroke(); }
      shape(() => { g.beginPath(); g.ellipse(0, -20, 26, 12, -.08, 0, TAU); }, c);
      // blue ninken vest with the white mark
      shape(() => { g.beginPath(); g.moveTo(-14, -31); g.quadraticCurveTo(0, -34, 14, -30); g.lineTo(12, -10); g.lineTo(-12, -9); g.closePath(); }, '#2a4a8a', 2);
      g.strokeStyle = '#f2f2f2'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -21, 4, 0, TAU); g.stroke();
      shape(() => { g.beginPath(); g.ellipse(26, -32, 13, 11, 0, 0, TAU); }, c);
      shape(() => { g.beginPath(); g.ellipse(36, -28, 8, 6, 0, 0, TAU); }, d, 2);
      g.fillStyle = INK; g.beginPath(); g.arc(42, -30, 2.4, 0, TAU); g.fill();
      for (const [ex, ey] of [[18, -42], [26, -44]]) shape(() => { g.beginPath(); g.moveTo(ex - 4, ey + 6); g.lineTo(ex, ey - 6); g.lineTo(ex + 5, ey + 5); g.closePath(); }, d, 2);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(29, -35, 2.4, 0, TAU); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(29.6, -35, 1.3, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(34, -24); g.lineTo(36, -19); g.lineTo(38, -24); g.closePath(); g.fill();
    });
  }
  // Kakashi's Perfect Susanoo: sleek blue armour, a masked face guard, swept horns; right arm raised.
  // 680×760, origin (340, 750).
  const SUS_W = 680, SUS_H = 760, SUS_OX = 340, SUS_OY = 750, SUS_HAND = [190, -690];
  function susanooSprite() {
    return Kit().sprite('hkb:susanoo', SUS_W, SUS_H, g => {
      g.translate(SUS_OX, SUS_OY); g.lineJoin = 'round'; g.lineCap = 'round';
      const shape = (build, fill, w = 1) => {
        build(); g.fillStyle = fill; g.fill();
        g.strokeStyle = 'rgba(4,20,52,.92)'; g.lineWidth = 3.6 * w; g.stroke();
        g.strokeStyle = 'rgba(214,240,255,.95)'; g.lineWidth = 1.3 * w; g.stroke();
      };
      const vg = (y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
      // far arm hanging at the side
      shape(() => { g.beginPath(); g.moveTo(-118, -440); g.quadraticCurveTo(-176, -360, -160, -250); g.lineTo(-124, -250); g.quadraticCurveTo(-130, -350, -84, -420); g.closePath(); }, 'rgba(40,110,210,.62)');
      shape(() => { g.beginPath(); g.ellipse(-144, -238, 26, 20, 0, 0, TAU); }, 'rgba(70,140,230,.66)');
      // armoured skirt plates
      for (let i = -2; i <= 2; i++) {
        const x0 = i * 40, w = 25 - Math.abs(i) * 1.5;
        for (let r = 0; r < 3; r++) { const y = -250 + r * 40; shape(() => { g.beginPath(); g.moveTo(x0 - w, y); g.lineTo(x0 + w, y); g.lineTo(x0 + w * 1.08 + i * 4, y + 42); g.quadraticCurveTo(x0 + i * 5, y + 50, x0 - w * 1.08 + i * 4, y + 42); g.closePath(); }, vg(y, y + 42, 'rgba(90,170,255,.6)', 'rgba(30,90,200,.5)'), .8); }
      }
      // torso
      shape(() => { g.beginPath(); g.moveTo(-30, -470); g.quadraticCurveTo(-100, -468, -128, -430); g.lineTo(-104, -370); g.quadraticCurveTo(-98, -300, -74, -256); g.lineTo(74, -256); g.quadraticCurveTo(98, -300, 104, -370); g.lineTo(128, -430); g.quadraticCurveTo(100, -468, 30, -470); g.closePath(); }, vg(-470, -256, 'rgba(100,180,255,.72)', 'rgba(30,90,200,.66)'), 1.1);
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 8, -440); g.quadraticCurveTo(s * 80, -440, s * 88, -380); g.quadraticCurveTo(s * 50, -356, s * 8, -362); g.closePath(); }, 'rgba(150,210,255,.6)', .8);
      for (let i = 0; i < 3; i++) shape(() => { const y = -346 + i * 26, w = 66 - i * 6; g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y - 7, w, y); g.lineTo(w - 5, y + 20); g.quadraticCurveTo(0, y + 13, -w + 5, y + 20); g.closePath(); }, 'rgba(60,140,240,.6)', .7);
      // lightning-bolt chest crest
      g.strokeStyle = 'rgba(230,248,255,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -452); g.lineTo(8, -420); g.lineTo(-6, -414); g.lineTo(14, -380); g.stroke();
      shape(() => { g.beginPath(); g.moveTo(-80, -262); g.quadraticCurveTo(0, -246, 80, -262); g.lineTo(78, -240); g.quadraticCurveTo(0, -226, -78, -240); g.closePath(); }, 'rgba(20,60,150,.85)', .8);
      // pauldrons
      for (const s of [-1, 1]) for (let p = 2; p >= 0; p--) shape(() => {
        const cx = s * (128 + p * 8), cy = -436 + p * 20;
        g.beginPath(); g.moveTo(cx - s * 50, cy - 8); g.quadraticCurveTo(cx, cy - 40, cx + s * 54, cy - 2); g.quadraticCurveTo(cx + s * 46, cy + 18, cx + s * 8, cy + 20); g.quadraticCurveTo(cx - s * 34, cy + 16, cx - s * 50, cy - 8); g.closePath();
      }, p ? 'rgba(50,130,235,.7)' : vg(-470, -410, 'rgba(170,225,255,.8)', 'rgba(60,140,240,.75)'));
      // raised near arm, hand up holding the shuriken
      shape(() => { g.beginPath(); g.moveTo(110, -460); g.quadraticCurveTo(190, -520, 196, -600); g.lineTo(168, -606); g.quadraticCurveTo(160, -540, 90, -420); g.closePath(); }, 'rgba(60,140,240,.66)');
      shape(() => { g.beginPath(); g.moveTo(170, -600); g.lineTo(212, -600); g.lineTo(206, -680); g.lineTo(176, -680); g.closePath(); }, 'rgba(90,170,255,.7)', .8);
      shape(() => { g.beginPath(); g.ellipse(SUS_HAND[0], SUS_HAND[1] + 2, 24, 20, 0, 0, TAU); }, 'rgba(120,195,255,.72)', .8);
      // head: helmet with swept horns and a crest, a mask over the lower face like Kakashi's own
      for (const s of [-1, 1]) shape(() => { g.beginPath(); g.moveTo(s * 22, -560); g.quadraticCurveTo(s * 70, -590, s * 110, -650); g.quadraticCurveTo(s * 66, -600, s * 34, -540); g.closePath(); }, 'rgba(70,150,240,.8)', .85);
      shape(() => { g.beginPath(); g.ellipse(0, -520, 40, 44, 0, 0, TAU); }, vg(-564, -476, 'rgba(120,195,255,.85)', 'rgba(30,90,200,.85)'));
      shape(() => { g.beginPath(); g.moveTo(-6, -560); g.quadraticCurveTo(-20, -610, -4, -650); g.quadraticCurveTo(6, -606, 8, -560); g.closePath(); }, 'rgba(220,244,255,.9)', .8);
      shape(() => { g.beginPath(); g.moveTo(-38, -512); g.quadraticCurveTo(0, -500, 38, -512); g.lineTo(34, -484); g.quadraticCurveTo(0, -470, -34, -484); g.closePath(); }, 'rgba(20,60,150,.9)', .8);
      g.strokeStyle = 'rgba(200,236,255,.6)'; g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-30, -504 + i * 8); g.quadraticCurveTo(0, -496 + i * 8, 30, -504 + i * 8); g.stroke(); }
      shape(() => { g.beginPath(); g.moveTo(-36, -540); g.lineTo(0, -528); g.lineTo(36, -540); g.lineTo(34, -530); g.lineTo(0, -518); g.lineTo(-34, -530); g.closePath(); }, 'rgba(10,40,110,.95)', .7);
      shape(() => { g.beginPath(); g.ellipse(0, -478, 46, 14, 0, 0, TAU); }, 'rgba(40,110,220,.8)', .9);
    });
  }
  // Kamui shuriken: four curved blades round a dark spiral. 180×180, centre (90, 90).
  function kamuiShurikenSprite() {
    return Kit().sprite('hkb:kamuiShuriken', 180, 180, g => {
      g.translate(90, 90); g.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2);
        g.beginPath(); g.moveTo(10, -14); g.quadraticCurveTo(60, -40, 86, -6); g.quadraticCurveTo(52, -14, 30, 10); g.closePath();
        g.fillStyle = 'rgba(80,160,255,.92)'; g.fill();
        g.strokeStyle = 'rgba(4,20,52,.95)'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = 'rgba(220,244,255,.95)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, -14); g.quadraticCurveTo(60, -36, 84, -7); g.stroke();
        g.restore();
      }
      g.fillStyle = '#0a0612'; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(170,120,230,.85)'; g.lineWidth = 2.4;
      g.beginPath(); for (let i = 0; i <= 30; i++) { const a = i * .5, r = 2 + i * .75; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke();
      g.strokeStyle = 'rgba(4,20,52,.95)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke();
    });
  }
  // Water seen from above: deep blue with rings and caustic glints (stretched for floods and waves).
  function waterDisc() {
    return Kit().sprite('hkb:waterDisc', 384, 384, g => {
      const gr = g.createRadialGradient(192, 192, 10, 192, 192, 192);
      gr.addColorStop(0, 'rgba(120,200,250,.85)'); gr.addColorStop(.55, 'rgba(50,140,220,.8)'); gr.addColorStop(.86, 'rgba(30,100,190,.7)'); gr.addColorStop(.96, 'rgba(200,240,255,.75)'); gr.addColorStop(1, 'rgba(200,240,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(192, 192, 192, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(192, 192, 180, 0, TAU); g.clip();
      g.strokeStyle = 'rgba(220,248,255,.55)'; g.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const a = hash(i * 2.3) * TAU, d = Math.sqrt(hash(i * 4.1)) * 170, x = 192 + Math.cos(a) * d, y = 192 + Math.sin(a) * d;
        g.lineWidth = 1 + hash(i) * 2; g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x, y - 5, x + 9, y + 1); g.stroke();
      }
      g.strokeStyle = 'rgba(15,60,130,.35)'; g.lineWidth = 2;
      for (let r = 30; r < 180; r += 26) { g.beginPath(); g.arc(192, 192, r, 0, TAU); g.stroke(); }
      g.restore();
    });
  }
  function acidDisc() {
    return Kit().sprite('hkb:acidDisc', 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(236,250,170,.9)'); gr.addColorStop(.55, 'rgba(180,220,80,.8)'); gr.addColorStop(.85, 'rgba(110,150,40,.7)'); gr.addColorStop(1, 'rgba(90,120,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 64, 0, TAU); g.fill();
      for (let i = 0; i < 12; i++) {
        const a = hash(i * 3.7) * TAU, d = hash(i * 1.9) * 44, r = 3 + hash(i * 5.1) * 6;
        g.strokeStyle = 'rgba(250,255,220,.85)'; g.lineWidth = 1.4; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); g.stroke();
      }
    });
  }
  function pollenPuff() {
    return Kit().sprite('hkb:pollen', 96, 96, g => {
      const gr = g.createRadialGradient(42, 40, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(255,252,220,.9)'); gr.addColorStop(.4, 'rgba(255,230,150,.6)'); gr.addColorStop(.75, 'rgba(255,190,210,.25)'); gr.addColorStop(1, 'rgba(255,190,210,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  // Wooden arm tube (golem / Kannon arms reaching out).
  function woodArm(ctx, x0, y0, x1, y1, w, bend = 0) {
    const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2 - Math.abs(bend) * .3;
    ctx.fillStyle = WOOD[0]; tube(ctx, x0, y0, mx, my, x1, y1, 0, 1, w + 3, w * .8 + 3); ctx.fill();
    ctx.fillStyle = WOOD[1]; tube(ctx, x0, y0, mx, my, x1, y1, 0, 1, w, w * .8); ctx.fill();
    ctx.fillStyle = WOOD[2]; tube(ctx, x0, y0 - w * .3, mx, my - w * .3, x1, y1 - w * .25, .04, .96, w * .26, w * .18); ctx.fill();
  }

  // ------------------------------------------------------------------ dragons (wood / water)
  const DPX = new Float32Array(96), DPY = new Float32Array(96), DPH = new Float32Array(96);
  function dragonFront(fx) { return Math.min(fx.len, fx.age * fx.speed); }
  // Fills the shared buffers with the body's ground points and heights; returns the point count.
  function dragonPts(fx, time) {
    const front = dragonFront(fx), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    const arrive = fx.len / fx.speed, slam = win(fx.age, arrive - .05, arrive + .15), sink = win(fx.age, fx.dur - .9, fx.dur);
    const N = Math.max(2, Math.min(44, Math.ceil(front / 24) + 1)), H = fx.water ? 92 : 74;
    for (let i = 0; i < N; i++) {
      const d = front * i / (N - 1), wv = Math.sin(d * .011 + fx.seed) * fx.w * .5 * Math.min(1, d / 220);
      DPX[i] = fx.x + ca * d - sa * wv; DPY[i] = fx.y + sa * d + ca * wv;
      let h = (fx.water ? 34 + (H - 34) * Math.min(1, d / 160) : H * easeOut(d / 200)) + 16 * Math.sin(d * .02 - time * 6);
      const near = clamp01((d - (front - 260)) / 260);
      h *= 1 - slam * near * .95;
      DPH[i] = Math.max(0, h * (1 - sink));
    }
    return N;
  }
  function strokeBody(ctx, N, i0, i1, dy) {
    ctx.beginPath(); ctx.moveTo(DPX[i0], DPY[i0] - DPH[i0] + dy);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(DPX[i], DPY[i] - DPH[i] + dy);
    ctx.stroke();
  }
  function dragonG(ctx, fx, time) {
    const K = Kit(), N = dragonPts(fx, time), front = dragonFront(fx), fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // furrow and body shadow along the ground
    ctx.globalAlpha = fade;
    ctx.strokeStyle = fx.water ? 'rgba(20,70,130,.3)' : 'rgba(46,30,16,.42)'; ctx.lineWidth = fx.w * 1.0;
    ctx.beginPath(); ctx.moveTo(DPX[0], DPY[0]); for (let i = 1; i < N; i++) ctx.lineTo(DPX[i], DPY[i]); ctx.stroke();
    if (!fx.water) {
      ctx.strokeStyle = 'rgba(30,18,8,.65)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 1; i < N; i += 2) { const px = DPX[i], py = DPY[i], s = hash(i + fx.seed) * 2 - 1; ctx.moveTo(px - 20, py + s * 18); ctx.lineTo(px + 6, py - s * 10); ctx.lineTo(px + 26, py + s * 22); }
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(120,200,255,.25)'; ctx.lineWidth = fx.w * .7;
      ctx.beginPath(); ctx.moveTo(DPX[0], DPY[0]); for (let i = 1; i < N; i++) ctx.lineTo(DPX[i], DPY[i]); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    const arrive = fx.len / fx.speed, u = fx.age - arrive;
    if (u > 0) {
      const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
      if (fx.water) {
        ctx.fillStyle = `rgba(30,100,180,${.3 * fade})`; ctx.beginPath(); ctx.arc(ex, ey, 210 * easeOut(u * 2), 0, TAU); ctx.fill();
        if (u < 1.2) K.fx.shockRing(ctx, ex, ey, 260, u / 1.2, 1 - u / 1.2, '150,220,255');
      } else {
        craterG(ctx, ex, ey, 190, fade * .9, fx.seed);
        cracks(ctx, ex, ey, 300, easeOut(u * 3), fx.seed, 9, 4);
        if (u < 1.2) K.fx.shockRing(ctx, ex, ey, 260, u / 1.2, 1 - u / 1.2, '200,240,140');
      }
    }
    // the body tears out of the ground where it emerges
    if (!fx.water && front > 0) {
      const dust = K.puff('dust');
      for (let i = 0; i < 5; i++) K.stamp(ctx, dust, fx.x + Math.cos(fx.a) * 40 + (hash(i) - .5) * 70, fx.y + Math.sin(fx.a) * 40 + (hash(i + 2) - .5) * 40 - 8, 22 + 6 * Math.sin(time * 5 + i), .6 * fade);
    }
  }
  function dragonO(ctx, fx, time) {
    const K = Kit(), N = dragonPts(fx, time), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    if (N < 2) return;
    const W = fx.w * (fx.water ? .52 : .5);
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pal = fx.water ? ['rgba(8,50,110,.9)', 'rgba(52,150,232,.92)', 'rgba(190,240,255,.95)'] : ['#24140a', '#8a5a32', '#c48d55'];
    // tapering body: six chunks, root thinner than the head end
    const C = 6;
    for (let layer = 0; layer < 3; layer++) {
      ctx.strokeStyle = pal[layer];
      for (let c = 0; c < C; c++) {
        const i0 = Math.floor(c * (N - 1) / C), i1 = Math.floor((c + 1) * (N - 1) / C);
        if (i1 <= i0) continue;
        const k = .5 + .5 * (c + 1) / C;
        ctx.lineWidth = layer === 0 ? W * 2 * k + 8 : layer === 1 ? W * 2 * k : W * .7 * k;
        strokeBody(ctx, N, i0, i1, layer === 2 ? -W * .45 * k : 0);
      }
    }
    if (fx.water) {
      // spray streaming off the body, foam rings, dorsal fins
      const water = K.puff('water');
      for (let i = 1; i < N; i += 3) K.stamp(ctx, water, DPX[i] + Math.sin(i * 3 + time * 9) * W * .6, DPY[i] - DPH[i] - W * .5, W * .55, .55);
      ctx.fillStyle = 'rgba(200,245,255,.92)'; ctx.strokeStyle = 'rgba(8,50,110,.8)'; ctx.lineWidth = 2;
      for (let i = 2; i < N - 2; i += 3) {
        const dx = DPX[i + 1] - DPX[i - 1], dy = DPY[i + 1] - DPH[i + 1] - DPY[i - 1] + DPH[i - 1], dl = Math.hypot(dx, dy) || 1;
        const tx = dx / dl, ty = dy / dl, bx = DPX[i], by = DPY[i] - DPH[i] - W * .8, fh = W * (.9 + .25 * Math.sin(i - time * 12));
        ctx.beginPath(); ctx.moveTo(bx - tx * W * .6, by - ty * W * .6); ctx.lineTo(bx - tx * W * 1.1, by - fh); ctx.lineTo(bx + tx * W * .6, by + ty * W * .6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i += 4) K.glow(ctx, DPX[i], DPY[i] - DPH[i], W * 1.6, '110,200,255', .35);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // timber grain running along the body, a few knots, wooden spines along the back
      ctx.strokeStyle = 'rgba(40,20,8,.55)'; ctx.lineWidth = 2;
      for (const o of [-.15, .3]) strokeBody(ctx, N, Math.floor(N * .15), N - 2, W * o);
      ctx.strokeStyle = '#3b2414'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 2; i < N - 2; i += 3) {
        const dx = DPX[i + 1] - DPX[i - 1], dy = (DPY[i + 1] - DPH[i + 1]) - (DPY[i - 1] - DPH[i - 1]), dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl, ny = dx / dl, cx = DPX[i], cy = DPY[i] - DPH[i], k = (.6 + .4 * i / N) * (.55 + hash(i + fx.seed) * .4);
        ctx.moveTo(cx + nx * W * k, cy + ny * W * k); ctx.quadraticCurveTo(cx + dx / dl * 8, cy + dy / dl * 8, cx - nx * W * k * .7, cy - ny * W * k * .7);
      }
      ctx.stroke();
      for (let i = 2; i < N - 2; i += 2) {
        const dx = DPX[i + 1] - DPX[i - 1], dy = (DPY[i + 1] - DPH[i + 1]) - (DPY[i - 1] - DPH[i - 1]), dl = Math.hypot(dx, dy) || 1;
        const tx = dx / dl, ty = dy / dl, k = .6 + .4 * i / N, bx = DPX[i], by = DPY[i] - DPH[i] - W * k * .8, sp = W * k * (.9 + hash(i * 3 + fx.seed) * .5);
        ctx.fillStyle = '#24140a'; ctx.beginPath(); ctx.moveTo(bx + tx * W * .5, by + ty * W * .5 + 3); ctx.lineTo(bx - tx * sp * 1.1, by - sp - 2); ctx.lineTo(bx - tx * W * .5, by - ty * W * .5 + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i % 4 ? '#8a5a32' : '#a8743e'; ctx.beginPath(); ctx.moveTo(bx + tx * W * .38, by + ty * W * .38 + 2); ctx.lineTo(bx - tx * sp * .98, by - sp + 2); ctx.lineTo(bx - tx * W * .38, by - ty * W * .38 + 2); ctx.closePath(); ctx.fill();
        if (i % 6 === 2) { leaf(ctx, bx - tx * sp, by - sp, -1, 8, '#5fae45'); leaf(ctx, bx - tx * sp + 6, by - sp + 4, .6, 6, '#9be06c'); }
      }
    }
    // head
    const i = N - 1, j = Math.max(0, N - 3);
    const hx = DPX[i], hy = DPY[i] - DPH[i], ang = Math.atan2(hy - (DPY[j] - DPH[j]), hx - DPX[j]);
    ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, W * 4, fx.water ? '120,210,255' : '150,240,110', .45 * fade); ctx.globalCompositeOperation = 'source-over';
    dragonHead(ctx, hx, hy, ang, W * (fx.water ? 2.7 : 3.1), fx.water ? ['#0c3a70', '#3ea6e6', '#c9f4ff', '#fff6b0'] : ['#24140a', '#93633a', '#d5a066', '#ffde5a'], .45 + .35 * Math.sin(time * 9));
    if (fx.water) {
      const water = K.puff('water');
      for (let k = 0; k < 4; k++) K.stamp(ctx, water, hx + Math.cos(ang) * W * 2.6 + (hash(k + Math.floor(time * 20)) - .5) * W * 2, hy + (hash(k * 3 + Math.floor(time * 20)) - .5) * W * 1.6, W * .5, .7);
    }
    ctx.globalAlpha = 1;
    // impact
    const u = fx.age - fx.len / fx.speed;
    if (u > 0) {
      const ex = fx.x + Math.cos(fx.a) * fx.len, ey = fx.y + Math.sin(fx.a) * fx.len;
      if (fx.water) waterSplash(ctx, ex, ey, 220, u, fx.seed);
      else dustBurst(ctx, ex, ey, 220, u, fx.seed, 'dust', 14);
    }
  }
  // Splash crown, column and foam (overlay).
  function waterSplash(ctx, x, y, r, t, seed) {
    const K = Kit(), water = K.puff('water'), k = t / 1.2;
    if (k >= 1) return;
    for (let i = 0; i < 18; i++) {
      const a = i * TAU / 18 + hash(i + seed) * .4, tt = clamp01(k * 1.5 - hash(i * 3 + seed) * .2);
      if (tt <= 0 || tt >= 1) continue;
      const d = r * (.12 + tt * (.5 + hash(i * 5 + seed) * .3)), h = Math.sin(Math.PI * tt) * r * (.4 + hash(i * 7 + seed) * .35);
      K.stamp(ctx, water, x + Math.cos(a) * d, y + Math.sin(a) * d * .55 - h, r * .06 * (1.3 - tt * .6) + 3, 1 - tt * tt);
    }
    const col = Math.sin(Math.PI * clamp01(k * 1.8));
    for (let i = 0; i < 5; i++) K.stamp(ctx, water, x + (hash(i + seed) - .5) * r * .25, y - i * r * .14 * col, r * (.2 - i * .025) * (.6 + col * .4), col * .9);
    ctx.globalCompositeOperation = 'lighter';
    if (k < .25) K.glow(ctx, x, y - 30, r * 1.1, '200,240,255', (1 - k / .25) * .7, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ Hashirama: forest, golem, pollen, Kannon
  function onScreen(ctx, x, y, w, h) {
    const m = ctx.getTransform(), sx = m.a * x + m.e, sy = m.d * y + m.f;
    return sx > -w * m.a && sx < ctx.canvas.width + w * m.a && sy > -40 && sy < ctx.canvas.height + h * m.d;
  }
  function forestG(ctx, fx, time) {
    const K = Kit(), t = fx.age, R = fx.R, front = Math.min(R, t * fx.speed), sink = easeIn((t - (fx.dur - .9)) / .9), fade = 1 - sink;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, front * 1.1, '90,190,70', .32 * fade);
    if (front < R) {
      ctx.strokeStyle = 'rgba(190,255,140,.85)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(fx.x, fx.y, front, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,230,90,.35)'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(fx.x, fx.y, Math.max(1, front - 20), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(58,40,24,${.36 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, Math.max(1, front), 0, TAU); ctx.fill();
    // roots racing ahead of the front
    if (front < R) {
      ctx.strokeStyle = 'rgba(60,36,18,.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const a = i * TAU / 18 + fx.seed, r0 = front - 10, r1 = front + 34 + hash(i) * 30;
        ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
        ctx.quadraticCurveTo(fx.x + Math.cos(a + .06) * (r0 + r1) / 2, fx.y + Math.sin(a + .06) * (r0 + r1) / 2, fx.x + Math.cos(a - .03) * r1, fx.y + Math.sin(a - .03) * r1);
      }
      ctx.stroke();
    }
    const dust = K.puff('smoke');
    for (const tr of fx.trees) {
      const born = tr.d / fx.speed + tr.lag;
      if (t < born) continue;
      const w = TREE_W * tr.s * 1.18, h = TREE_H * tr.s * 1.18, X = fx.x + tr.x, Y = fx.y + tr.y;
      if (!onScreen(ctx, X, Y, w, h)) continue;
      const g = Math.min(1, outBack((t - born) / .45)) * (1 - sink * .9);
      if (g <= .02) continue;
      const hh = h * g;
      ctx.save(); ctx.translate(X, Y + 6); if (tr.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.drawImage(treeSprite(tr.v, false), 0, TREE_H * (1 - Math.min(1, g)), TREE_W, TREE_H * Math.min(1, g), -w / 2, -hh, w, hh);
      ctx.restore();
      const k = (t - born) / .6;
      if (k < 1) K.stamp(ctx, dust, X, Y - 10 - k * 30, 26 + k * 36, (1 - k) * .55);
    }
  }
  function forestO(ctx, fx, time) {
    // leaves shaken loose over the canopy
    const t = fx.age, front = Math.min(fx.R, t * fx.speed), fade = 1 - win(t, fx.dur - 1, fx.dur);
    for (let i = 0; i < 26; i++) {
      const a = hash(i * 9 + fx.seed) * TAU, d = Math.sqrt(hash(i * 3.3)) * front, ph = (time * .5 + hash(i)) % 1;
      leaf(ctx, fx.x + Math.cos(a) * d + Math.sin(time * 2 + i) * 20, fx.y + Math.sin(a) * d - 180 + ph * 160, time * 2 + i, 6, `rgba(${i % 2 ? '120,200,80' : '170,230,110'},${bell(ph) * fade})`);
    }
  }
  // Golem: shoulders and resting hands in sprite space (scale 1).
  const GS = .8;
  function golemPose(fx, side) {
    return { sx: fx.x + side * 112 * GS, sy: fx.y - 318 * GS, rx: fx.x + side * 128 * GS, ry: fx.y - 160 * GS };
  }
  function golemRise(fx) { return easeOut(fx.age / .6) * (1 - easeIn((fx.age - (fx.dur - .7)) / .7)); }
  function golemBody(ctx, fx, time) {
    const K = Kit(), g = golemRise(fx);
    if (g <= .01) return;
    const img = golemSprite(), hh = GOLEM_H * g;
    ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 160 * g, 220, '150,220,100', .2); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, 0, 0, GOLEM_W, hh, fx.x - GOLEM_W / 2 * GS, fx.y + 10 * GS - hh * GS, GOLEM_W * GS, hh * GS);
    // eyes burning in the mask
    ctx.globalCompositeOperation = 'lighter';
    const ey = fx.y + (10 - hh + 410 - 392) * GS;
    if (g > .9) for (const s of [-1, 1]) K.glow(ctx, fx.x + s * 19 * GS, ey, 14, '255,220,120', .8 + .2 * Math.sin(time * 9));
    ctx.globalCompositeOperation = 'source-over';
  }
  function golemG(ctx, fx, time) {
    const K = Kit();
    ctx.fillStyle = 'rgba(30,20,10,.3)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 6, 120 * golemRise(fx), 36 * golemRise(fx), 0, 0, TAU); ctx.fill();
    for (const mk of fx.marks) {
      if (fx.age >= mk.t0 && fx.age < mk.t1) markCircle(ctx, mk.x, mk.y, mk.r, '214,170,110', (fx.age - mk.t0) / (mk.t1 - mk.t0), time);
      const u = fx.age - mk.t1;
      if (u > 0) { craterG(ctx, mk.x, mk.y, mk.r * .8, .9 * (1 - win(fx.age, fx.dur - .6, fx.dur)), mk.t1 * 10); cracks(ctx, mk.x, mk.y, mk.r * 1.5, easeOut(u * 4), mk.t1 * 10, 8, 3.5); if (u < 1) K.fx.shockRing(ctx, mk.x, mk.y, mk.r * 1.5, u, 1 - u, '230,200,150'); }
    }
    if (!fx.front) golemBody(ctx, fx, time);
    if (fx.age < .7) { const dust = K.puff('dust'); for (let i = 0; i < 8; i++) K.stamp(ctx, dust, fx.x + (i - 3.5) * 40, fx.y - hash(i) * 20, 40 + fx.age * 40, (1 - fx.age / .7) * .8); }
  }
  function golemO(ctx, fx, time) {
    if (fx.front) golemBody(ctx, fx, time);
    const g = golemRise(fx);
    if (g < .55) return;
    const lift = GOLEM_H * GS * (1 - g);
    // each arm rests at the side or drives a fist into its mark
    for (const side of [-1, 1]) {
      const P = golemPose(fx, side);
      let fx1 = P.rx, fy1 = P.ry + lift, active = null;
      for (const mk of fx.marks) if ((mk.side === side || mk.side === 0) && fx.age > mk.t1 - .26 && fx.age < mk.t1 + .62) active = mk;
      if (active) {
        const e = fx.age < active.t1 ? easeIn((fx.age - (active.t1 - .26)) / .26) : 1 - easeInOut((fx.age - active.t1 - .3) / .32);
        const tx = active.x + (active.side === 0 ? side * 46 : 0), ty = active.y - 24;
        fx1 = lerp(P.rx, tx, e); fy1 = lerp(P.ry + lift, ty, e);
      }
      woodArm(ctx, P.sx, P.sy + lift, fx1, fy1, 24, side * 30);
      const ang = Math.atan2(fy1 - P.sy - lift, fx1 - P.sx);
      ctx.save(); ctx.translate(fx1, fy1); ctx.rotate(ang); ctx.drawImage(fistSprite(), -64, -55, 128, 110); ctx.restore();
    }
    for (const mk of fx.marks) { const u = fx.age - mk.t1; if (u > 0) dustBurst(ctx, mk.x, mk.y, mk.r * 1.1, u, mk.t1 * 10, 'dust', 12); }
  }
  function pollenG(ctx, fx, time) {
    const K = Kit(), t = fx.age, speed = 650, front = Math.min(fx.R, t * speed), sink = easeIn((t - (fx.dur - .9)) / .9), fade = 1 - sink;
    ctx.fillStyle = `rgba(150,60,110,${.12 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, front, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, front * 1.05, '255,170,210', .22 * fade);
    ctx.strokeStyle = `rgba(255,200,230,${.7 * fade})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(fx.x, fx.y, front, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const dust = K.puff('dust');
    for (const tr of fx.trees) {
      const born = tr.d / speed + tr.lag;
      if (t < born) continue;
      const w = TREE_W * tr.s, h = TREE_H * tr.s, X = fx.x + tr.x, Y = fx.y + tr.y;
      if (!onScreen(ctx, X, Y, w, h)) continue;
      const g = Math.min(1, outBack((t - born) / .5)) * (1 - sink * .9);
      if (g <= .02) continue;
      const hh = h * g;
      ctx.save(); ctx.translate(X, Y + 6); if (tr.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.drawImage(treeSprite(tr.v, true), 0, TREE_H * (1 - g), TREE_W, TREE_H * g, -w / 2, -hh, w, hh);
      ctx.restore();
      const k = (t - born) / .6;
      if (k < 1) K.stamp(ctx, dust, X, Y - 10 - k * 24, 20 + k * 30, (1 - k) * .5);
    }
  }
  function pollenO(ctx, fx, time) {
    const K = Kit(), t = fx.age, fade = bell(win(t, .3, fx.dur)) * Math.min(1, (fx.dur - t) * 2), puff = pollenPuff(), R = fx.R;
    if (fade <= 0) return;
    for (let i = 0; i < 18; i++) {
      const a = hash(i * 5.1 + fx.seed) * TAU + time * .15 * (i % 2 ? 1 : -1), d = (.2 + hash(i * 2.9) * .75) * R;
      K.stamp(ctx, puff, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d - 60 - 20 * Math.sin(time + i), 70 + hash(i) * 50, .55 * fade);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      const a = hash(i * 7.7) * TAU, d = Math.sqrt(hash(i * 1.3)) * R, ph = (time * .4 + hash(i * 3)) % 1;
      K.glow(ctx, fx.x + Math.cos(a) * d + Math.sin(time * 1.6 + i) * 18, fx.y + Math.sin(a) * d - 30 - ph * 140, 8, '255,236,140', bell(ph) * fade);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 36; i++) {
      const a = hash(i * 4.3 + 9) * TAU, d = Math.sqrt(hash(i * 2.1 + 5)) * R, ph = (time * .35 + hash(i * 6)) % 1;
      petal(ctx, fx.x + Math.cos(a) * d + Math.sin(time * 2 + i) * 26, fx.y + Math.sin(a) * d - 200 + ph * 200, time * 3 + i, 5, `rgba(${i % 3 ? '255,190,220' : '255,245,250'},${bell(ph) * fade})`);
    }
  }
  const KAN_S = .85;
  function kannonRise(fx) { return easeOut(fx.age / .9) * (1 - easeIn((fx.age - (fx.dur - .8)) / .8)); }
  function kannonHand(fx, f) {
    const h = f.hand, a = Math.PI * (1.08 + hash(h * 3.3) * .84), r = 200 + hash(h * 1.7) * 120;
    return [fx.x + Math.cos(a) * r * KAN_S, fx.y + 80 + (-420 + Math.sin(a) * r) * KAN_S * kannonRise(fx)];
  }
  function kannonG(ctx, fx, time) {
    const K = Kit(), g = kannonRise(fx), bx = fx.x, by = fx.y + 80;
    if (g > .01) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, bx, by - 420 * KAN_S * g, 520 * g, '255,200,90', .3);
      K.glow(ctx, bx, by - 430 * KAN_S * g, 200 * g, '255,240,170', .35);
      ctx.globalCompositeOperation = 'source-over';
      const img = kannonSprite(), hh = KAN_H * g;
      ctx.drawImage(img, 0, 0, KAN_W, hh, bx - KAN_OX * KAN_S, by + (KAN_H - KAN_OY) * KAN_S - hh * KAN_S, KAN_W * KAN_S, hh * KAN_S);
      if (fx.age < 1.1) { const dust = K.puff('dust'); for (let i = 0; i < 12; i++) K.stamp(ctx, dust, bx + (i - 5.5) * 60, by + 8 - hash(i) * 20, 50 + fx.age * 50, (1 - fx.age / 1.1) * .85); }
    }
    for (const f of fx.fists) {
      if (fx.age > f.t - .8 && fx.age < f.t) markCircle(ctx, f.x, f.y, f.r, '255,210,120', (fx.age - (f.t - .8)) / .8, time);
      const u = fx.age - f.t;
      if (u > 0 && u < 2.2) { craterG(ctx, f.x, f.y, f.r * .75, .85 * (1 - u / 2.2), f.seed); if (u < .8) K.fx.shockRing(ctx, f.x, f.y, f.r * 1.4, u / .8, 1 - u / .8, '255,220,150'); }
    }
    const b = fx.big;
    if (fx.age > b.t - 1.0 && fx.age < b.t) markCircle(ctx, b.x, b.y, b.r, '255,190,90', (fx.age - (b.t - 1.0)), time);
    const u = fx.age - b.t;
    if (u > 0) { craterG(ctx, b.x, b.y, b.r, .95 * (1 - win(fx.age, fx.dur - .6, fx.dur)), fx.seed); cracks(ctx, b.x, b.y, b.r * 1.8, easeOut(u * 3), fx.seed, 12, 5); if (u < 1.3) { K.fx.shockRing(ctx, b.x, b.y, b.r * 1.7, u / 1.3, 1 - u / 1.3, '255,220,150'); K.fx.shockRing(ctx, b.x, b.y, b.r * 2.3, u / 1.3 * .8, (1 - u / 1.3) * .7, '255,255,255'); } }
  }
  function fistDrop(ctx, fx, f, scale, time) {
    const fall = .36, u = (fx.age - (f.t - fall)) / fall;
    if (u <= 0 || fx.age > f.t + .45) return;
    const [hx, hy] = kannonHand(fx, f);
    const e = easeIn(Math.min(1, u)), sx = f.x + (hx - f.x) * .35, sy = f.y - 620 * (f.big ? 1.3 : 1);
    const px = lerp(sx, f.x, e), py = lerp(sy, f.y - 30 * scale, e);
    const out = fx.age > f.t ? 1 - (fx.age - f.t) / .45 : 1;
    ctx.globalAlpha = out;
    woodArm(ctx, hx, hy, px, py, (f.big ? 34 : 15), 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,230,170,${.35 * out})`; ctx.lineWidth = 40 * scale;
    ctx.beginPath(); ctx.moveTo(lerp(sx, px, .6), lerp(sy, py, .6)); ctx.lineTo(px, py); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(py - sy, px - sx)); ctx.drawImage(fistSprite(), -70 * scale, -60 * scale, 140 * scale, 120 * scale); ctx.restore();
    ctx.globalAlpha = 1;
  }
  function kannonO(ctx, fx, time) {
    for (const f of fx.fists) fistDrop(ctx, fx, f, 1.15, time);
    fistDrop(ctx, fx, fx.big, 3.0, time);
    for (const f of fx.fists) { const u = fx.age - f.t; if (u > 0 && u < 2) dustBurst(ctx, f.x, f.y, f.r * 1.05, u, f.seed, 'dust', 8); }
    const u = fx.age - fx.big.t;
    if (u > 0) {
      dustBurst(ctx, fx.big.x, fx.big.y, fx.big.r * 1.3, u, fx.seed, 'dust', 18);
      if (u < .3) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx.big.x, fx.big.y - 60, fx.big.r * 1.6, '255,240,200', (1 - u / .3) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
    }
  }

  // ------------------------------------------------------------------ Tobirama
  function slashStreak(ctx, x0, y0, x1, y1, k, rgb, seed) {
    // A sword cut: a thin bright crescent with an afterglow fan, fading with k (0 → 1).
    if (k >= 1) return;
    const K = Kit(), L = LIFT(), a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), f = 1 - k;
    ctx.save(); ctx.translate(x0, y0 - L); ctx.rotate(a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(10,30,60,${.35 * f})`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -34 * f - 8, len, 0); ctx.quadraticCurveTo(len * .5, -14 * f, 0, 0); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${rgb},${.55 * f})`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -30 * f - 6, len, 0); ctx.quadraticCurveTo(len * .5, -10 * f, 0, 0); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -18 * f - 4, len, 0); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${.6 * f})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const o = (hash(i + seed) - .5) * 60, s0 = hash(i * 3 + seed) * .5; ctx.moveTo(len * s0, o); ctx.lineTo(len * (s0 + .4), o * .6); }
    ctx.stroke();
    K.glow(ctx, len, 0, 60 * f + 10, rgb, f, true);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  function slashG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    for (const k of fx.kunai) {
      if (fx.age < k.land) continue;
      formula(ctx, k.x, k.y, 34, fade, time, '170,225,255');
      kunai(ctx, k.x, k.y - 8, -Math.PI / 2 - .3, 1.8);
    }
    const P = fx.path;
    for (let i = 1; i < P.length; i++) {
      const ti = fx.t0 + i * fx.step;
      if (fx.age > .3 && fx.age < ti) {
        const k = clamp01((fx.age - .3) / (ti - .3)), la = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x);
        ctx.fillStyle = `rgba(170,225,255,${.1 + .14 * k})`;
        ctx.save(); ctx.translate(P[i - 1].x, P[i - 1].y); ctx.rotate(la); ctx.fillRect(0, -56, Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y), 112); ctx.restore();
        ctx.save(); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 80;
        ctx.strokeStyle = 'rgba(10,30,60,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
        ctx.strokeStyle = `rgba(170,225,255,${.4 + .5 * k})`; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      } else if (fx.age >= ti) {
        const f = (1 - win(fx.age, ti, fx.dur)) * .7;
        ctx.strokeStyle = `rgba(30,24,20,${f})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
      }
    }
  }
  function slashO(ctx, fx, time) {
    const L = LIFT();
    for (const k of fx.kunai) if (fx.age < k.land) {
      const u = fx.age / k.land, px = lerp(fx.x, k.x, u), py = lerp(fx.y - L, k.y - 6, u) - bell(u) * 40;
      kunai(ctx, px, py, Math.atan2(k.y - fx.y, k.x - fx.x), 1.3);
    }
    const P = fx.path;
    for (let i = 1; i < P.length; i++) {
      const ti = fx.t0 + i * fx.step, u = fx.age - ti;
      if (u >= 0 && u < .4) slashStreak(ctx, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, u / .4, '150,215,255', i * 7 + fx.seed);
    }
  }
  // A ring wall of water (Suijinheki) seen in 3/4: base circle on the ground, crest lifted by h.
  function waterRingHalf(ctx, x, y, R, h, lean, front, time, alpha) {
    if (h < 3 || alpha <= .01) return;
    const K = Kit(), a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU, M = 26;
    const top = a => h * (.8 + .2 * Math.sin(a * 7 + time * 7) * Math.sin(a * 3 - time * 4));
    ctx.globalAlpha = alpha * (front ? .8 : 1);
    ctx.fillStyle = front ? 'rgba(40,130,215,.72)' : 'rgba(30,110,200,.82)'; ctx.beginPath();
    for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); }
    for (let k = M; k >= 0; k--) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(x + Math.cos(a) * R * (1 - lean), y + Math.sin(a) * R * (1 - lean) - top(a)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(8,50,110,.55)'; ctx.lineWidth = 6;
    ctx.beginPath(); for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(x + Math.cos(a) * R * (1 - lean), y + Math.sin(a) * R * (1 - lean) - top(a)); } ctx.stroke();
    ctx.strokeStyle = 'rgba(150,215,255,.75)'; ctx.lineWidth = Math.min(22, h * .2); ctx.stroke();
    ctx.strokeStyle = 'rgba(245,253,255,.95)'; ctx.lineWidth = 3; ctx.stroke();
    // vertical streaks of falling water on the face
    ctx.strokeStyle = 'rgba(220,245,255,.45)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < M; k += 2) { const a = a0 + (a1 - a0) * (k + .5) / M, bx = x + Math.cos(a) * R, by = y + Math.sin(a) * R, ph = (time * 2 + k * .37) % 1; ctx.moveTo(bx, by - top(a) * (.9 - ph * .5)); ctx.lineTo(bx, by - top(a) * (.55 - ph * .5)); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k <= M; k += 4) { const a = a0 + (a1 - a0) * k / M; K.glow(ctx, x + Math.cos(a) * R * (1 - lean), y + Math.sin(a) * R * (1 - lean) - top(a), 26, '235,250,255', .7 * alpha); }
    ctx.globalCompositeOperation = 'source-over';
    const water = K.puff('water');
    for (let k = 1; k < M; k += 3) { const a = a0 + (a1 - a0) * k / M; K.stamp(ctx, water, x + Math.cos(a) * R * (1 - lean) + Math.sin(time * 8 + k) * 6, y + Math.sin(a) * R * (1 - lean) - top(a) - 8, 16, .75 * alpha); }
    ctx.globalAlpha = 1;
  }
  function wallR(fx) { const t = fx.age; return t < .3 ? 150 + 150 * easeOut(t / .3) : fx.R0 + (fx.R1 - fx.R0) * easeOut((t - .3) / .75); }
  function wallH(fx) { const t = fx.age; return t < .3 ? 170 * easeOut(t / .3) : 170 * (1 - .55 * easeOut((t - .3) / .75)) * (1 - easeIn((t - 1.05) / .5)); }
  function waterwallG(ctx, fx, time) {
    const R = wallR(fx), fade = 1 - win(fx.age, fx.dur - .9, fx.dur);
    ctx.globalAlpha = .6 * fade; ctx.drawImage(waterDisc(), fx.x - R, fx.y - R, R * 2, R * 2); ctx.globalAlpha = 1;
    waterRingHalf(ctx, fx.x, fx.y, R, wallH(fx), .06, false, time, 1);
    if (fx.age > .3 && fx.age < 1.4) Kit().fx.shockRing(ctx, fx.x, fx.y, fx.R1 * 1.1, (fx.age - .3) / 1.1, 1 - (fx.age - .3) / 1.1, '150,220,255');
  }
  function waterwallO(ctx, fx, time) {
    waterRingHalf(ctx, fx.x, fx.y, wallR(fx), wallH(fx), .06, true, time, 1);
    const u = fx.age - 1.0;
    if (u > 0 && u < 1.2) {
      const K = Kit(), water = K.puff('water'), R = wallR(fx);
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + fx.seed, h = Math.sin(Math.PI * clamp01(u / 1.1)) * 80; K.stamp(ctx, water, fx.x + Math.cos(a) * R, fx.y + Math.sin(a) * R - h, 18, 1 - u / 1.2); }
    }
  }
  function edoG(ctx, fx, time) {
    const K = Kit(), t = fx.age;
    for (const c of fx.cof) if (t < .32) markCircle(ctx, c.x, c.y, 72, '190,140,255', t / .32, time);
    if (t > .3 && t < 1.2) markCircle(ctx, fx.x, fx.y, 175, '190,140,255', (t - .3) / .9, time);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, fx.x, fx.y, fx.R * 1.5, '120,60,200', .25 * bell(t / fx.dur));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(30,14,44,${.25 * bell(t / fx.dur)})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * 1.2, 0, TAU); ctx.fill();
    const img = coffinSprite(), sink = easeIn((t - (fx.dur - .8)) / .8), dust = K.puff('dust');
    const cof = fx.cof.slice().sort((p, q) => p.y - q.y);
    for (const c of cof) {
      const g = easeOut((t - c.lag) / .3) * (1 - sink);
      if (g <= .01) continue;
      const hh = 150 * g;
      ctx.drawImage(img, 0, 0, 90, hh, c.x - 45 * 1.2, c.y + 4 - hh * 1.2, 90 * 1.2, hh * 1.2);
      // the lid falls forward and the dead step out
      const lidT = clamp01((t - .55 - c.lag) / .25);
      if (lidT > 0 && lidT < 1) {
        ctx.save(); ctx.translate(c.x - 10, c.y + 4); ctx.rotate(lidT * 1.2);
        ctx.fillStyle = '#5a4030'; ctx.fillRect(-30, -150 * 1.2 * g, 50, 140 * g); ctx.strokeStyle = '#120a06'; ctx.lineWidth = 3; ctx.strokeRect(-30, -150 * 1.2 * g, 50, 140 * g);
        ctx.restore();
      }
      if (t - c.lag < .5) K.stamp(ctx, dust, c.x, c.y - 10, 36 + (t - c.lag) * 40, (1 - (t - c.lag) / .5) * .7);
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, c.x - 10, c.y - 80, 60, '160,90,255', .3 * g); ctx.globalCompositeOperation = 'source-over';
    }
    if (t > 1.2) craterG(ctx, fx.x, fx.y, 150, .8 * (1 - win(t, fx.dur - .6, fx.dur)), fx.seed);
  }
  function edoO(ctx, fx, time) {
    const K = Kit(), t = fx.age, img = ghostSprite(), smoke = K.puff('violet');
    for (const c of fx.cof) {
      const u = (t - .62 - c.lag) / .55;
      if (u <= 0 || u > 1.15) continue;
      const e = easeIn(Math.min(1, u)), px = lerp(c.x - 10, fx.x + (c.x - fx.x) * .15, e), py = lerp(c.y - 6, fx.y + (c.y - fx.y) * .15, e) - bell(u) * 30;
      const a = u < 1 ? Math.min(1, u * 4) : 1 - (u - 1) / .15;
      for (let k = 1; k <= 3; k++) K.stamp(ctx, smoke, lerp(c.x, px, 1 - k * .12), lerp(c.y, py, 1 - k * .12) - 50, 26 - k * 4, a * .5);
      ctx.globalAlpha = a;
      ctx.save(); if (px > c.x + 1) { ctx.translate(px, 0); ctx.scale(-1, 1); ctx.translate(-px, 0); }
      ctx.drawImage(img, px - 40 * 1.3, py - 116 * 1.3, 80 * 1.3, 120 * 1.3);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    const u = t - 1.2;
    if (u > 0 && u < 1.6) {
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + fx.seed, d = 40 + easeOut(u) * 150; K.stamp(ctx, smoke, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .55 - 30 - u * 30, 40 + u * 30, (1 - u / 1.6) * .7); }
      if (u < .8) K.fx.shockRing(ctx, fx.x, fx.y, 260, u / .8, 1 - u / .8, '190,140,255');
      ctx.globalCompositeOperation = 'lighter'; if (u < .3) K.glow(ctx, fx.x, fx.y - 40, 220, '200,150,255', (1 - u / .3) * .8, true); ctx.globalCompositeOperation = 'source-over';
    }
    // paper ash of the Impure World drifting up
    ctx.fillStyle = 'rgba(40,30,40,.75)';
    for (let i = 0; i < 24; i++) {
      const ph = (time * .5 + hash(i * 3.3)) % 1, a = hash(i) * TAU, d = hash(i * 7) * fx.R * 1.1;
      ctx.globalAlpha = bell(ph) * bell(t / fx.dur);
      ctx.save(); ctx.translate(fx.x + Math.cos(a) * d + Math.sin(time * 2 + i) * 12, fx.y + Math.sin(a) * d - 20 - ph * 160); ctx.rotate(time * 3 + i); ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function tagsG(ctx, fx, time) {
    const img = tagSprite(), K = Kit();
    for (const g of fx.tags) {
      if (fx.age < g.fly || fx.age >= g.boom) continue;
      const k = (fx.age - g.fly) / (g.boom - g.fly);
      ctx.fillStyle = `rgba(255,120,40,${.1 + .18 * k})`; ctx.beginPath(); ctx.arc(g.x, g.y, 110 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,150,70,${.4 + .3 * Math.sin(time * 24)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 110, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(hash(g.x) - .5); ctx.drawImage(img, -13, -23, 26, 46); ctx.restore();
      // the fuse burns down the tag
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, g.x, g.y - 23 + k * 40, 12 + 6 * Math.sin(time * 40 + g.x), '255,170,60', 1, true); ctx.globalCompositeOperation = 'source-over';
    }
    for (const g of fx.tags) { const u = fx.age - g.boom; if (u > 0 && u < 2) craterG(ctx, g.x, g.y, 80, .7 * (1 - u / 2), g.x); }
  }
  function tagsO(ctx, fx, time) {
    const img = tagSprite(), K = Kit(), L = LIFT();
    ctx.strokeStyle = 'rgba(255,200,120,.55)'; ctx.lineWidth = 1.5;
    let px = NaN, py = NaN;
    ctx.beginPath();
    for (const g of fx.tags) {
      if (fx.age >= g.fly) { px = NaN; continue; }
      const u = fx.age / g.fly, x = lerp(fx.x, g.x, u), y = lerp(fx.y - L, g.y, u) - bell(u) * 70;
      if (px === px) { ctx.moveTo(px, py); ctx.lineTo(x, y); }
      px = x; py = y;
    }
    ctx.stroke();
    for (const g of fx.tags) {
      if (fx.age >= g.fly) continue;
      const u = fx.age / g.fly, x = lerp(fx.x, g.x, u), y = lerp(fx.y - L, g.y, u) - bell(u) * 70;
      ctx.save(); ctx.translate(x, y); ctx.rotate(time * 9 + g.x); ctx.drawImage(img, -13, -23, 26, 46); ctx.restore();
    }
    for (const g of fx.tags) {
      const u = (fx.age - g.boom) / .9;
      if (u > 0 && u < 1) K.fx.fireBlast(ctx, g.x, g.y, 125, u, 1 - u, time, g.x * .01);
    }
  }
  function floodR(fx) { return Math.min(fx.R, fx.age * fx.speed + 60); }
  function floodG(ctx, fx, time) {
    const K = Kit(), R = floodR(fx), recede = win(fx.age, fx.dur - 1.6, fx.dur);
    ctx.globalAlpha = .82 * (1 - recede);
    ctx.drawImage(waterDisc(), fx.x - R, fx.y - R, R * 2, R * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const r = (R * (.3 + i * .25) + time * 60) % R; ctx.strokeStyle = `rgba(200,240,255,${.3 * (1 - recede)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    const h = 190 * (1 - .45 * R / fx.R) * (1 - easeIn((fx.age - fx.R / fx.speed) / .6));
    waterRingHalf(ctx, fx.x, fx.y, R, h, .05, false, time, 1);
    if (fx.xs) {
      const c = fx.xs, k = clamp01((fx.age - .95) / (fx.xsT - .95));
      if (fx.age < fx.xsT) for (const da of [Math.PI / 4, -Math.PI / 4]) {
        const aa = c.a + da;
        teleShape(ctx, { k: 'line', x: c.x - Math.cos(aa) * 230, y: c.y - Math.sin(aa) * 230, a: aa, len: 460, w: 60 }, '170,225,255', k, time);
      } else if (fx.age < fx.xsT + 1.6) {
        ctx.strokeStyle = `rgba(20,30,40,${.6 * (1 - (fx.age - fx.xsT) / 1.6)})`; ctx.lineWidth = 6;
        for (const da of [Math.PI / 4, -Math.PI / 4]) { const aa = c.a + da; ctx.beginPath(); ctx.moveTo(c.x - Math.cos(aa) * 230, c.y - Math.sin(aa) * 230); ctx.lineTo(c.x + Math.cos(aa) * 230, c.y + Math.sin(aa) * 230); ctx.stroke(); }
      }
    }
  }
  function floodO(ctx, fx, time) {
    const R = floodR(fx), h = 190 * (1 - .45 * R / fx.R) * (1 - easeIn((fx.age - fx.R / fx.speed) / .6));
    waterRingHalf(ctx, fx.x, fx.y, R, h, .05, true, time, 1);
    if (fx.xs) {
      const u = fx.age - fx.xsT, c = fx.xs;
      if (u >= 0 && u < .45) for (const da of [Math.PI / 4, -Math.PI / 4]) {
        const aa = c.a + da;
        slashStreak(ctx, c.x - Math.cos(aa) * 230, c.y - Math.sin(aa) * 230, c.x + Math.cos(aa) * 230, c.y + Math.sin(aa) * 230, u / .45, '150,215,255', da);
      }
      if (u >= 0 && u < 1.2) waterSplash(ctx, c.x, c.y, 160, u, fx.seed);
    }
  }

  // ------------------------------------------------------------------ Hiruzen
  function fireDragonG(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.len, fx.age * fx.speed), ca = Math.cos(fx.a), sa = Math.sin(fx.a), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    ctx.strokeStyle = `rgba(40,14,6,${.42 * fade})`; ctx.lineWidth = fx.w * 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + ca * front, fx.y + sa * front); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,110,30,${.25 * fade})`; ctx.lineWidth = fx.w * .8;
    ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + ca * front, fx.y + sa * front); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // flames left burning along the trail
    const m = ctx.getTransform(), ga = ctx.globalAlpha;
    for (let d = 60, i = 0; d < front; d += 64, i++) {
      const age = fx.age - d / fx.speed, life = 1 - clamp01(age / 1.6);
      if (life <= 0) continue;
      const off = (hash(i + fx.seed) - .5) * fx.w, px = fx.x + ca * d - sa * off, py = fx.y + sa * d + ca * off;
      const h = (40 + hash(i * 3) * 40) * life * (1 + .1 * Math.sin(time * 14 + i));
      ctx.globalAlpha = ga * Math.min(1, life * 1.5);
      K.flameAt(ctx, m, K.flame(i), px, py, h * .6, h, Math.sin(time * 5 + i) * .2);
    }
    ctx.setTransform(m); ctx.globalAlpha = ga;
  }
  function fireDragonO(ctx, fx, time) {
    const K = Kit(), front = Math.min(fx.len, fx.age * fx.speed), ca = Math.cos(fx.a), sa = Math.sin(fx.a), L = LIFT();
    const arrive = fx.len / fx.speed, fade = 1 - win(fx.age, arrive, arrive + .35);
    const fire = K.puff('fire'), ember = K.puff('ember');
    if (fade > 0) {
      // a stream of boiling flame from his mouth, thickening toward the head
      const n = Math.min(30, Math.ceil(front / 34));
      for (let i = n; i >= 0; i--) {
        const d = front * i / n + (time * 300) % 34 * 0, wv = Math.sin(d * .012 + time * 8 + fx.seed) * fx.w * .35;
        const h = L * 1.5 * (1 - d / Math.max(1, fx.len)) + 30 + 14 * Math.sin(d * .03 - time * 9);
        const px = fx.x + ca * d - sa * wv, py = fx.y + sa * d + ca * wv - h, s = fx.w * (.28 + .32 * d / Math.max(1, front));
        K.stamp(ctx, i % 3 === 0 ? ember : fire, px, py, s, fade * (.75 + .25 * d / Math.max(1, front)));
      }
      const hx = fx.x + ca * front, hy = fx.y + sa * front - 40, hs = fx.w * .9;
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, hs * 3, '255,120,40', .8 * fade); ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = fade;
      for (let i = 0; i < 9; i++) {
        const an = fx.a + Math.PI + (i / 8 - .5) * 2.2, len = hs * (2.4 + Math.sin(time * 15 + i * 1.9) * .2) * (1 - Math.abs(i / 8 - .5) * .6);
        ctx.save(); ctx.translate(hx - ca * hs * .2, hy - hs * .25); ctx.rotate(an + Math.PI / 2);
        ctx.drawImage(K.flame(i), -len * .24, -len * FB, len * .48, len); ctx.restore();
      }
      dragonHead(ctx, hx, hy, fx.a, hs, ['#6a0c04', '#f2420f', '#ffc23a', '#fffbe0'], .6 + .3 * Math.sin(time * 12));
      ctx.restore();
    }
    const u = fx.age - arrive;
    if (u > 0 && u < 1.1) K.fx.fireBlast(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, 230, u / 1.1, 1 - u / 1.1, time, fx.seed);
  }
  function swarmPos(fx, i) {
    const a = fx.a + (hash(i * 1.7 + fx.seed) - .5) * 2 * fx.half, delay = hash(i * 3.1 + fx.seed) * .4, sp = 950 + hash(i * 5.3) * 400;
    const stop = fx.reach * (.45 + hash(i * 2.2 + fx.seed) * .6), d = Math.min(stop, Math.max(0, fx.age - delay) * sp);
    return [fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, d >= stop, fx.age > delay, a];
  }
  function swarmG(ctx, fx, time) {
    const img = tinyShuriken(), fade = 1 - win(fx.age, fx.dur - .4, fx.dur);
    ctx.globalAlpha = fade;
    for (let i = 0; i < 150; i++) {
      const [x, y, stuck] = swarmPos(fx, i);
      if (!stuck) continue;
      ctx.fillStyle = 'rgba(20,16,12,.3)'; ctx.fillRect(x - 6, y - 1, 12, 3);
      ctx.drawImage(img, x - 8, y - 9, 16, 12);
    }
    ctx.globalAlpha = 1;
  }
  function swarmO(ctx, fx, time) {
    const img = tinyShuriken(), L = LIFT();
    ctx.strokeStyle = 'rgba(230,240,250,.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i < 150; i++) {
      const [x, y, stuck, live, a] = swarmPos(fx, i);
      if (stuck || !live) continue;
      const h = L * (.8 + hash(i) * .6);
      ctx.moveTo(x - Math.cos(a) * 34, y - h - Math.sin(a) * 34); ctx.lineTo(x, y - h);
      pts.push(x, y - h, i);
    }
    ctx.stroke();
    for (let k = 0; k < pts.length; k += 3) {
      const s = 16 + hash(pts[k + 2]) * 6;
      ctx.drawImage(img, pts[k] - s / 2, pts[k + 1] - s / 2, s, s);
    }
    // the first shuriken splitting: a flash of clones at his hand
    if (fx.age < .25) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx.x + Math.cos(fx.a) * 30, fx.y - L, 60, '230,240,255', 1 - fx.age / .25, true); ctx.globalCompositeOperation = 'source-over'; }
  }
  // Enma's Adamantine Staff: black rod with gold-capped ends.
  function rod(ctx, x0, y0, x1, y1, w) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) return;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.fillStyle = '#0b090e'; ctx.fillRect(-1, -w / 2 - 1.5, len + 2, w + 3);
    ctx.fillStyle = '#1d1824'; ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = 'rgba(150,140,175,.55)'; ctx.fillRect(0, -w / 2, len, w * .3);
    const cap = Math.min(len * .22, w * 2.8);
    ctx.fillStyle = '#e7b948'; ctx.fillRect(0, -w * .65, cap, w * 1.3); ctx.fillRect(len - cap, -w * .65, cap, w * 1.3);
    ctx.fillStyle = '#fff1b8'; ctx.fillRect(0, -w * .65, cap, w * .32); ctx.fillRect(len - cap, -w * .65, cap, w * .32);
    ctx.fillStyle = '#9c6c1e'; ctx.fillRect(cap, -w * .5, w * .4, w); ctx.fillRect(len - cap - w * .4, -w * .5, w * .4, w);
    ctx.restore();
  }
  // Enma's grinning face pushing out of the staff.
  function enmaFace(ctx, x, y, s, flip, time) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip * s, s); ctx.lineJoin = 'round';
    ctx.fillStyle = '#f2f0ea';
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const a = Math.PI * .3 + i / 14 * Math.PI * 1.6, r = i % 2 ? 13 : 18 + Math.sin(time * 6 + i); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#3a2b27'; ctx.beginPath(); ctx.ellipse(4, 1, 10, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a07a62'; ctx.beginPath(); ctx.ellipse(10, 7, 6.5, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5c0f0f'; ctx.beginPath(); ctx.ellipse(11, 10, 4, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(8.5, 8, 1.4, 1.8); ctx.fillRect(12.5, 8, 1.4, 1.8);
    ctx.strokeStyle = '#d0342a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(7, 6); ctx.moveTo(1, 1); ctx.lineTo(3, 6); ctx.stroke();
    ctx.fillStyle = '#ffd03a'; ctx.beginPath(); ctx.ellipse(8, -2, 2.8, 1.9, -.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#120c0a'; ctx.beginPath(); ctx.arc(8.8, -2, 1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b2d3a'; ctx.fillRect(-6, -11, 19, 4); ctx.fillStyle = '#c9cdd8'; ctx.fillRect(6, -12, 8, 5.5);
    ctx.restore();
  }
  function staffGeom(fx) {
    const L = LIFT(), out = easeOut(clamp01(fx.age / .14)), back = easeIn(clamp01((fx.age - .7) / .3));
    const len = fx.len * out * (1 - back), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    return { L, len, out, back, ca, sa, hx: fx.x + ca * 16, hy: fx.y - L - 4 + sa * 8 };
  }
  function staffG(ctx, fx, time) {
    const K = Kit(), g = staffGeom(fx), hit = clamp01((fx.age - .1) / .6);
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.fillStyle = `rgba(0,0,0,${.22 * (1 - g.back)})`; ctx.fillRect(14, -5, g.len, 10);
    ctx.restore();
    if (hit > 0 && hit < 1) {
      const tx = fx.x + g.ca * fx.len, ty = fx.y + g.sa * fx.len;
      K.fx.shockRing(ctx, tx, ty, 140, hit, 1 - hit, '255,205,120');
      K.fx.debris(ctx, tx, ty, 110, hit, fx.seed, '#5a4632', 9);
      craterG(ctx, tx, ty, 90, 1 - hit, fx.seed);
    }
  }
  function staffO(ctx, fx, time) {
    const K = Kit(), g = staffGeom(fx);
    if (g.len < 2) return;
    const tx = g.hx + g.ca * g.len, ty = g.hy + g.sa * g.len, w = 9 + g.out * 7 * (1 - g.back);
    const wake = 1 - clamp01((fx.age - .1) / .5);
    ctx.globalCompositeOperation = 'lighter';
    if (wake > 0) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,170,60,${.3 * wake})`; ctx.lineWidth = w * 3;
      ctx.beginPath(); ctx.moveTo(g.hx, g.hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = `rgba(255,245,200,${.7 * wake})`; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const o = (hash(i * 3.1) - .5) * w * 7, s0 = hash(i * 7.7) * .6, s1 = s0 + .25 + hash(i) * .2; ctx.moveTo(g.hx + (tx - g.hx) * s0 - g.sa * o, g.hy + (ty - g.hy) * s0 + g.ca * o); ctx.lineTo(g.hx + (tx - g.hx) * s1 - g.sa * o, g.hy + (ty - g.hy) * s1 + g.ca * o); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    rod(ctx, g.hx - g.ca * 30, g.hy - g.sa * 15, tx, ty, w);
    const face = clamp01((fx.age - .12) / .1) * (1 - g.back);
    if (face > .05) enmaFace(ctx, g.hx + (tx - g.hx) * .8, g.hy + (ty - g.hy) * .8 - w * .6, 1.6 * face, g.ca >= 0 ? 1 : -1, time);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, tx, ty, 26, '255,230,150', .9 * (1 - g.back), true);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Kongō Rōheki: Adamantine Staffs drop in a ring, lock with golden bands, then crush inward.
  function cagePts(fx, i, N) {
    const an = i * TAU / N + fx.seed, crushK = easeIn(clamp01((fx.age - (fx.crush - .3)) / .3)) * (fx.age < fx.crush + .05 ? 1 : 0);
    const R = fx.R * (1 - .45 * crushK);
    return [fx.x + Math.cos(an) * R, fx.y + Math.sin(an) * R, Math.sin(an), crushK];
  }
  function cageRods(ctx, fx, time, front) {
    const K = Kit(), N = 18, H = 230, dust = K.puff('dust');
    if (fx.age > fx.crush + .1) return;
    for (let i = 0; i < N; i++) {
      const [x, y, sn, ck] = cagePts(fx, i, N);
      if ((sn >= 0) !== front) continue;
      const land = fx.slam - .2 + hash(i * 1.7 + fx.seed) * .2, t = clamp01((fx.age - land + .18) / .18);
      if (t <= 0) continue;
      const drop = (1 - easeIn(t)) * 340, lean = ck * 40;
      rod(ctx, x - (x - fx.x) / fx.R * lean, y - H - drop, x, y - drop, 11);
      if (t >= 1) { const k = clamp01((fx.age - land) / .45); if (k < 1) K.stamp(ctx, dust, x, y - 6 - k * 10, 18 + k * 24, (1 - k) * .6); }
    }
  }
  function cageBands(ctx, fx, time, front) {
    const band = clamp01((fx.age - fx.slam) / .2) * (fx.age < fx.crush ? 1 : 0);
    if (band <= 0) return;
    const ck = easeIn(clamp01((fx.age - (fx.crush - .3)) / .3)), R = fx.R * (1 - .45 * ck);
    ctx.globalCompositeOperation = 'lighter';
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    for (const [h, wd] of [[200, 6], [110, 4.5]]) {
      ctx.strokeStyle = `rgba(255,190,70,${.4 * band})`; ctx.lineWidth = wd * 3;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y - h, R, R, 0, a0, a1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,190,${.95 * band})`; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y - h, R, R, 0, a0, a1); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function cageG(ctx, fx, time) {
    const K = Kit();
    if (fx.age < fx.slam) markCircle(ctx, fx.x, fx.y, fx.R, '255,205,110', fx.age / fx.slam, time);
    else if (fx.age < fx.crush) markCircle(ctx, fx.x, fx.y, 215, '255,170,80', (fx.age - fx.slam) / (fx.crush - fx.slam), time);
    if (fx.age > fx.slam - .1) { ctx.fillStyle = 'rgba(48,34,22,.35)'; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.R * 1.04, 0, TAU); ctx.fill(); }
    cageBands(ctx, fx, time, false);
    cageRods(ctx, fx, time, false);
    const u = fx.age - fx.crush;
    if (u > 0) { craterG(ctx, fx.x, fx.y, 180, .9 * (1 - win(fx.age, fx.dur - .5, fx.dur)), fx.seed); if (u < 1) K.fx.shockRing(ctx, fx.x, fx.y, 300, u, 1 - u, '255,210,120'); }
    const s = fx.age - fx.slam;
    if (s > 0 && s < .8) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.3, s / .8, 1 - s / .8, '255,210,120');
  }
  function cageO(ctx, fx, time) {
    cageRods(ctx, fx, time, true);
    cageBands(ctx, fx, time, true);
    const u = fx.age - fx.crush;
    if (u > 0) {
      dustBurst(ctx, fx.x, fx.y, 230, u, fx.seed, 'dust', 14);
      if (window.AnimeSprites && u < .7) for (let i = 0; i < 6; i++) window.AnimeSprites.drawSmoke(ctx, fx.x + Math.cos(i * TAU / 6) * 120, fx.y + Math.sin(i * TAU / 6) * 120 - 60, u / .7, 40);
      if (u < .25) { ctx.globalCompositeOperation = 'lighter'; Kit().glow(ctx, fx.x, fx.y - 80, 260, '255,220,140', (1 - u / .25) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
    }
  }
  // Doryūheki: a stone wall with three dragon heads; drawn as a lit 3D slab.
  function wallTex() {
    return Kit().sprite('hkb:wallTex', 256, 128, g => {
      g.fillStyle = '#8a7258'; g.fillRect(0, 0, 256, 128);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        const x = c * 46 + (r % 2) * 23 - 10, y = r * 32;
        g.fillStyle = ['#9a8266', '#7d6650', '#a68c6e', '#86705a'][(r + c) % 4]; g.fillRect(x + 2, y + 2, 42, 28);
        g.fillStyle = 'rgba(255,240,210,.18)'; g.fillRect(x + 2, y + 2, 42, 4);
        g.fillStyle = 'rgba(30,20,10,.3)'; g.fillRect(x + 2, y + 26, 42, 4);
      }
      g.strokeStyle = 'rgba(40,28,18,.6)'; g.lineWidth = 2;
      for (let i = 0; i < 8; i++) { let x = hash(i * 3) * 256, y = hash(i * 7) * 128; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (hash(i + k) - .5) * 30; y += 10; g.lineTo(x, y); } g.stroke(); }
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,240,210,.15)'); gr.addColorStop(1, 'rgba(20,12,6,.35)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    });
  }
  function earthwallG(ctx, fx, time) {
    const K = Kit(), ca = Math.cos(fx.a), sa = Math.sin(fx.a), px = -sa, py = ca, half = fx.half, T = 26;
    const crumble = easeIn(win(fx.age, fx.dur - .8, fx.dur)), H = 130 * easeOut(fx.age / .3) * (1 - crumble);
    if (H < 2) return;
    // footprint corners: A/B on the side facing the target, C/D behind
    const P = (o, t) => [fx.x + px * o + ca * t, fx.y + py * o + sa * t];
    const A = P(-half, T), B = P(half, T), C = P(half, -T), D = P(-half, -T);
    ctx.fillStyle = 'rgba(20,14,8,.3)'; ctx.beginPath(); ctx.moveTo(A[0], A[1] + 8); ctx.lineTo(B[0], B[1] + 8); ctx.lineTo(C[0], C[1] + 8); ctx.lineTo(D[0], D[1] + 8); ctx.closePath(); ctx.fill();
    const face = (p0, p1, shade) => {
      const m = ctx.getTransform(), ux = (p1[0] - p0[0]) / 256, uy = (p1[1] - p0[1]) / 256;
      ctx.transform(ux, uy, 0, H / 128, p0[0], p0[1] - H);
      ctx.drawImage(wallTex(), 0, 0);
      if (shade) { ctx.fillStyle = `rgba(20,12,6,${shade})`; ctx.fillRect(0, 0, 256, 128); }
      ctx.setTransform(m);
      ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p1[0], p1[1] - H); ctx.lineTo(p0[0], p0[1] - H); ctx.closePath(); ctx.stroke();
    };
    // the two long faces: draw whichever faces the viewer (normal pointing down-screen)
    if (sa > 0) face(A, B, 0); else face(C, D, .1);
    if (py >= 0) face(B, C, .3); else face(D, A, .3);
    ctx.fillStyle = '#b09878'; ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(A[0], A[1] - H); ctx.lineTo(B[0], B[1] - H); ctx.lineTo(C[0], C[1] - H); ctx.lineTo(D[0], D[1] - H); ctx.closePath(); ctx.fill(); ctx.stroke();
    // three stone dragon heads jutting from the face toward the target
    for (const o of [-190, 0, 190]) {
      const [bx, by] = P(o, T + 6), sp = fx.spit != null ? clamp01(1 - (fx.age - fx.spit) / .3) : 0;
      dragonHead(ctx, bx + ca * 14, by + sa * 14 - H * .55, fx.a, 46, ['#2a1e14', '#9a8266', '#c8b090', '#ff9a3a'], .3 + sp * .5);
      if (sp > 0) { const mud = K.puff('dust'); K.stamp(ctx, mud, bx + ca * 44, by + sa * 44 - H * .55, 22 * sp + 6, sp); }
    }
    if (fx.age < .5) { const dust = K.puff('dust'); for (let i = 0; i < 9; i++) { const [x, y] = P((i - 4) * half / 4, 0); K.stamp(ctx, dust, x, y - 10, 30 + fx.age * 60, (1 - fx.age / .5) * .8); } }
    if (crumble > 0) K.fx.debris(ctx, fx.x, fx.y - H * .5, 220, crumble, fx.seed, '#5a4632', 14);
  }
  function earthwallO(ctx, fx, time) {
    if (fx.age < .45) dustBurst(ctx, fx.x, fx.y, 260, fx.age * 1.6, fx.seed, 'dust', 10);
  }
  // Shiki Fūjin: the Shinigami looms behind Hiruzen and drives its arm through him to tear out a soul.
  const SHI_S = .8;
  function reaperAlpha(fx) { return easeOut(fx.age / .7) * (1 - easeIn(win(fx.age, fx.dur - .8, fx.dur))); }
  function reaperG(ctx, fx, time) {
    const K = Kit(), a = reaperAlpha(fx), bob = Math.sin(time * 2) * 6, bx = fx.x, by = fx.y + 140 + bob;
    if (fx.age < 1.0) teleShape(ctx, { k: 'line', x: fx.x, y: fx.y, a: Math.atan2(fx.ty - fx.y, fx.tx - fx.x), len: Math.hypot(fx.tx - fx.x, fx.ty - fx.y), w: 46 }, '200,160,255', fx.age, time);
    if (fx.age < 1.25) markCircle(ctx, fx.tx, fx.ty, 190, '200,160,255', fx.age / 1.25, time);
    if (a <= .01) return;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, bx, by - 330 * SHI_S, 420, '120,70,200', .35 * a);
    ctx.globalCompositeOperation = 'source-over';
    const smoke = K.puff('violet');
    for (let i = 0; i < 8; i++) K.stamp(ctx, smoke, bx + (i - 3.5) * 50, by - 20 - 20 * Math.sin(time * 2 + i), 70, .5 * a);
    ctx.globalAlpha = .9 * a;
    ctx.drawImage(shinigamiSprite(), bx - SHI_OX * SHI_S, by - SHI_OY * SHI_S, SHI_W * SHI_S, SHI_H * SHI_S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) K.glow(ctx, bx + s * 28 * SHI_S, by - 428 * SHI_S, 18, '255,220,150', a * (.8 + .2 * Math.sin(time * 7)), true);
    ctx.globalCompositeOperation = 'source-over';
    const u = fx.age - .85;
    if (u > 0 && u < .9) K.fx.shockRing(ctx, fx.x, fx.y, 300, u / .9, 1 - u / .9, '200,160,255');
    const g = fx.age - 1.25;
    if (g > 0 && g < 1.4) { ctx.fillStyle = `rgba(40,16,60,${.35 * (1 - g / 1.4)})`; ctx.beginPath(); ctx.arc(fx.tx, fx.ty, 190, 0, TAU); ctx.fill(); }
  }
  function reaperO(ctx, fx, time) {
    const K = Kit(), a = reaperAlpha(fx), L = LIFT();
    const sx = fx.x, sy = fx.y + 140 - 250 * SHI_S, tx = fx.tx, ty = fx.ty - L;
    const reach = easeOut(clamp01((fx.age - .85) / .38)), pull = easeInOut(clamp01((fx.age - 1.45) / .8));
    const k = reach * (1 - pull);
    if (k <= .01 || a <= .01) return;
    const ex = lerp(sx, tx, k), ey = lerp(sy, ty, k), mx = (sx + ex) / 2, my = (sy + ey) / 2 - 60 * k;
    ctx.globalAlpha = .85 * a;
    ctx.fillStyle = 'rgba(40,20,60,.6)'; tube(ctx, sx, sy, mx, my, ex, ey, 0, 1, 26, 14); ctx.fill();
    ctx.fillStyle = 'rgba(190,176,214,.8)'; tube(ctx, sx, sy, mx, my, ex, ey, 0, 1, 22, 11); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(160,110,255,.35)'; tube(ctx, sx, sy, mx, my, ex, ey, 0, 1, 36, 20); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // prayer beads round the wrist and a grasping hand
    for (let i = 0; i < 7; i++) { const t = .82 + i * .012, [bx, by] = qbez(sx, sy, mx, my, ex, ey, t); ctx.fillStyle = i % 3 ? '#2a2030' : '#c8402a'; ctx.beginPath(); ctx.arc(bx + (i - 3) * 2, by - 12 + Math.abs(i - 3) * 3, 5, 0, TAU); ctx.fill(); }
    const grip = fx.age > 1.25 ? 1 : 0;
    ctx.fillStyle = '#b3a6c8'; ctx.strokeStyle = '#1a0f22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(ex, ey, 20, 16, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let f = 0; f < 4; f++) { const fa = Math.atan2(ey - my, ex - mx) + (f - 1.5) * .45, L1 = grip ? 14 : 30; ctx.strokeStyle = '#1a0f22'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(fa) * L1, ey + Math.sin(fa) * L1); ctx.stroke(); }
    ctx.lineWidth = 4; ctx.strokeStyle = '#b3a6c8';
    for (let f = 0; f < 4; f++) { const fa = Math.atan2(ey - my, ex - mx) + (f - 1.5) * .45, L1 = grip ? 14 : 30; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(fa) * L1, ey + Math.sin(fa) * L1); ctx.stroke(); }
    // the torn soul: a pale wisp in the grip as it is dragged back
    if (fx.age > 1.25) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, ex, ey - 10, 40, '220,235,255', .9 * a, true);
      for (let i = 1; i <= 5; i++) K.glow(ctx, ex + (tx - ex) * i * .05 + Math.sin(time * 9 + i) * 6, ey - 10 + i * 6, 22 - i * 3, '190,210,255', .5 * a);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    if (fx.age > 1.25 && fx.age < 2.4) dustBurst(ctx, fx.tx, fx.ty, 200, fx.age - 1.25, fx.seed, 'violet', 10);
  }

  // ------------------------------------------------------------------ Minato
  function flyKunai(ctx, fx, k, time) {
    const L = LIFT(), u = fx.age / k.land, px = lerp(fx.x, k.x, u), py = lerp(fx.y - L, k.y - 6, u) - bell(u) * 50;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,230,140,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lerp(fx.x, px, .7), lerp(fx.y - L, py, .7)); ctx.lineTo(px, py); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    kunai(ctx, px, py, Math.atan2(k.y - fx.y, k.x - fx.x), 1.4, true);
  }
  function webG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur), P = fx.path;
    for (const k of fx.kunai) if (fx.age >= k.land) { formula(ctx, k.x, k.y, 38, fade, time); kunai(ctx, k.x, k.y - 8, -Math.PI / 2 - .25, 1.4, true); }
    for (let i = 1; i < P.length; i++) {
      const ti = fx.t0 + i * fx.step;
      if (fx.age > .3 && fx.age < ti) {
        const k = clamp01((fx.age - .3) / (ti - .3));
        ctx.save(); ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 90;
        ctx.strokeStyle = 'rgba(40,24,0,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,225,110,${.35 + .55 * k})`; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      } else if (fx.age >= ti) {
        ctx.strokeStyle = `rgba(40,24,0,${.5 * (1 - win(fx.age, ti, fx.dur))})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(P[i - 1].x, P[i - 1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
      }
    }
    const tEnd = fx.t0 + P.length * fx.step + .05, u = fx.age - tEnd, c = fx.kunai[0];
    if (fx.age > .3 && u < 0) markCircle(ctx, c.x, c.y, 170, '255,225,110', clamp01((fx.age - .3) / (tEnd - .3)), time);
    if (u > 0 && u < 1) { Kit().fx.shockRing(ctx, c.x, c.y, 260, u, 1 - u, '255,225,110'); craterG(ctx, c.x, c.y, 130, 1 - u, fx.seed); }
  }
  function webO(ctx, fx, time) {
    for (const k of fx.kunai) if (fx.age < k.land) flyKunai(ctx, fx, k, time);
    const tEnd = fx.t0 + fx.path.length * fx.step + .05, u = fx.age - tEnd, c = fx.kunai[0];
    if (u > -.25 && u < .7) rasenBlast(ctx, c.x, c.y, 170, u, time, fx.seed);
  }
  // Rasengan held into the target, then the blast (u < 0: grinding, u >= 0: burst).
  function rasenBlast(ctx, x, y, r, u, time, seed) {
    const K = Kit(), L = LIFT();
    if (u < 0) {
      const g = 1 + u / .25;
      ctx.save(); ctx.translate(x, y - L); K.fx.rasenganOrb(ctx, 18 + 16 * g, time, 1); ctx.restore();
      return;
    }
    if (u > 1) return;
    const e = easeOut(u * 1.6);
    ctx.globalCompositeOperation = 'lighter';
    if (u < .3) K.glow(ctx, x, y - L, r * (1 + u * 2), '170,225,255', (1 - u / .3), true);
    K.glow(ctx, x, y - 10, r * 1.3, '110,190,255', .5 * (1 - u));
    ctx.globalCompositeOperation = 'source-over';
    const sw = K.swirl('hkRasen', ['rgba(220,245,255,.9)', 'rgba(110,190,255,.85)', 'rgba(40,120,230,.8)'], 10, 1.2, .1, 256, 4);
    K.spin(ctx, sw, x, y - 10, r * (.4 + e * .7), -time * 14, (1 - u) * .9, .5);
    if (u < .7) { ctx.save(); ctx.translate(x, y - L); K.fx.rasenganOrb(ctx, 34 * (1 - u / .7) + 6, time, 1 - u / .7); ctx.restore(); }
    K.fx.debris(ctx, x, y, r * 1.2, u, seed, '#3a2c22', 12);
    dustBurst(ctx, x, y, r, u * 1.5, seed, 'dust', 10);
  }
  function rasenG(ctx, fx, time) {
    const K = Kit();
    if (fx.age < fx.hit) { markCircle(ctx, fx.x, fx.y, fx.r, '140,210,255', fx.age / fx.hit, time); formula(ctx, fx.x, fx.y, 40, 1, time); }
    const u = fx.age - fx.hit;
    if (u > 0) {
      craterG(ctx, fx.x, fx.y, fx.r * .8, .9 * (1 - win(fx.age, fx.dur - .4, fx.dur)), fx.seed);
      if (u < .9) { K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.6, u / .9, 1 - u / .9, '140,210,255'); K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 2.1, u / .9 * .8, (1 - u / .9) * .6, '255,255,255'); }
      const sw = K.swirl('hkScar', ['rgba(40,30,24,.8)', 'rgba(80,60,44,.6)'], 6, 1.1, .15, 192, 3);
      K.spin(ctx, sw, fx.x, fx.y, fx.r * .9, fx.seed, .7 * (1 - win(fx.age, fx.dur - .4, fx.dur)), 1);
    }
  }
  function rasenO(ctx, fx, time) {
    const u = fx.age - fx.hit;
    if (u > -.25 && u < 1) rasenBlast(ctx, fx.x, fx.y, fx.r, u, time, fx.seed);
  }
  function nidanG(ctx, fx, time) {
    if (fx.age >= .3) { formula(ctx, fx.ex, fx.ey, 34, 1 - win(fx.age, fx.dur - .5, fx.dur), time); kunai(ctx, fx.ex, fx.ey - 8, -Math.PI / 2 - .25, 1.4, true); }
    if (fx.b && fx.age < .98) { markCircle(ctx, fx.b.x, fx.b.y, 165, '255,225,110', clamp01((fx.age - fx.b.t) / (.98 - fx.b.t)), time); formula(ctx, fx.b.x, fx.b.y, 46, 1, time); }
  }
  function nidanO(ctx, fx, time) {
    if (fx.age < .3) flyKunai(ctx, fx, { x: fx.ex, y: fx.ey, land: .3 }, time);
  }
  // A Tailed Beast Ball: dark core, violet rim, a halo of red and blue chakra.
  function tbbSprite() { return Kit().sphere('hkTbb', [[0, '#5a3a7a'], [.35, '#1a0a26'], [.8, '#0a0410'], [.93, '#6a2a9a'], [1, 'rgba(160,90,255,.0)']], .38, .32); }
  function tbbBall(ctx, x, y, r, time, alpha = 1) {
    const K = Kit();
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x, y, r * 2.6, '255,90,40', .5 * alpha);
    K.glow(ctx, x, y, r * 1.8, '120,90,255', .55 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    const sw = K.swirl('hkTbbSw', ['rgba(255,120,60,.9)', 'rgba(150,110,255,.9)', 'rgba(255,255,255,.8)'], 8, 1.3, .2, 192, 3.4);
    K.spin(ctx, sw, x, y, r * 1.35, time * 9, .8 * alpha);
    K.stamp(ctx, tbbSprite(), x, y, r, alpha);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, x - r * .3, y - r * .35, r * .5, '230,200,255', .6 * alpha);
    ctx.globalCompositeOperation = 'source-over';
  }
  function tbbG(ctx, fx, time) {
    const K = Kit(), d = Math.min(fx.len, fx.age * fx.speed), ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (d < fx.len) {
      ctx.fillStyle = 'rgba(20,8,30,.35)'; ctx.beginPath(); ctx.ellipse(fx.x + ca * d, fx.y + sa * d, 40, 16, 0, 0, TAU); ctx.fill();
      teleShape(ctx, { k: 'c', x: fx.x + ca * fx.len, y: fx.y + sa * fx.len, r: fx.r }, '255,180,60', d / fx.len, time);
    }
    const u = fx.age - fx.len / fx.speed;
    if (u > 0) craterG(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r * .85, .9 * (1 - win(fx.age, fx.dur - .4, fx.dur)), fx.seed);
  }
  function tbbO(ctx, fx, time) {
    const K = Kit(), L = LIFT(), arrive = fx.len / fx.speed, ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    if (fx.age < arrive) {
      const d = fx.age * fx.speed, x = fx.x + ca * d, y = fx.y + sa * d - L * 1.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,140,60,.35)'; ctx.lineWidth = 40; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - ca * Math.min(d, 220), y - sa * Math.min(d, 220)); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      tbbBall(ctx, x, y, 30, time);
    }
    const u = (fx.age - arrive) / 1.3;
    if (u > 0 && u < 1) K.fx.beastBlast(ctx, fx.x + ca * fx.len, fx.y + sa * fx.len, fx.r, u, 1 - u, time, fx.seed);
  }
  const KUR_S = .8;
  function kuramaFrame(fx) {
    const facing = Math.cos(fx.a) >= 0 ? 1 : -1, bx = fx.x - facing * 90, by = fx.y + 70;
    return { facing, bx, by, mx: bx + facing * KUR_MOUTH[0] * KUR_S, my: by + KUR_MOUTH[1] * KUR_S };
  }
  function kuramaAlpha(fx) { return easeOut(fx.age / .7) * (1 - easeIn(win(fx.age, fx.dur - 1, fx.dur))); }
  function kuramaG(ctx, fx, time) {
    const K = Kit(), f = kuramaFrame(fx), a = kuramaAlpha(fx), ca = Math.cos(fx.a), sa = Math.sin(fx.a), ex = fx.x + ca * fx.len, ey = fx.y + sa * fx.len;
    const arrive = fx.t0 + fx.len / fx.speed;
    if (fx.age < arrive) {
      teleShape(ctx, { k: 'line', x: fx.x, y: fx.y, a: fx.a, len: fx.len, w: 120 }, '255,120,40', clamp01(fx.age / arrive), time);
      markCircle(ctx, ex, ey, fx.R, '255,120,40', clamp01(fx.age / arrive), time);
    }
    if (a > .01) {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.bx, f.by - 220, 420, '255,110,30', .3 * a);
      ctx.globalCompositeOperation = 'source-over';
      const smoke = K.puff('fire');
      if (fx.age < 1) for (let i = 0; i < 10; i++) K.stamp(ctx, smoke, f.bx + (i - 4.5) * 50, f.by - 40 - hash(i) * 200 - fx.age * 80, 60, (1 - fx.age) * .6);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(f.bx, f.by); ctx.scale(f.facing * KUR_S, KUR_S);
      ctx.drawImage(kuramaSprite(), -KUR_OX, -KUR_OY);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, f.bx + f.facing * 222 * KUR_S, f.by - 328 * KUR_S, 30, '255,80,40', a, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    const u = fx.age - arrive;
    if (u > 0) { craterG(ctx, ex, ey, fx.R * .8, .95 * (1 - win(fx.age, fx.dur - .5, fx.dur)), fx.seed); cracks(ctx, ex, ey, fx.R * 1.6, easeOut(u * 3), fx.seed, 12, 5); }
  }
  function kuramaO(ctx, fx, time) {
    const K = Kit(), f = kuramaFrame(fx), ca = Math.cos(fx.a), sa = Math.sin(fx.a), ex = fx.x + ca * fx.len, ey = fx.y + sa * fx.len;
    const arrive = fx.t0 + fx.len / fx.speed;
    if (fx.age > .3 && fx.age < fx.t0) {
      // chakra of both colours spirals into the jaws and condenses
      const k = (fx.age - .3) / (fx.t0 - .3);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const ph = (time * 1.3 + i / 14) % 1, ang = i * 2.4 + time * 3, d = (1 - ph) * 200;
        K.glow(ctx, f.mx + Math.cos(ang) * d, f.my + Math.sin(ang) * d * .7, 14, i % 2 ? '255,70,50' : '90,140,255', bell(ph));
      }
      ctx.globalCompositeOperation = 'source-over';
      tbbBall(ctx, f.mx + f.facing * 30, f.my, 14 + 50 * easeOut(k), time);
    } else if (fx.age >= fx.t0 && fx.age < arrive) {
      const u = (fx.age - fx.t0) / (arrive - fx.t0), gx = lerp(fx.x + ca * 60, ex, u), gy = lerp(fx.y + sa * 60, ey, u);
      const sx = lerp(f.mx + f.facing * 30, ex, u), sy = lerp(f.my, ey - 60, u);
      ctx.fillStyle = 'rgba(20,8,30,.35)'; ctx.beginPath(); ctx.ellipse(gx, gy, 70, 26, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,120,60,.3)'; ctx.lineWidth = 110; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lerp(f.mx, sx, .5), lerp(f.my, sy, .5)); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,120,255,.3)'; ctx.lineWidth = 50; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      tbbBall(ctx, sx, sy, 64, time);
    }
    const u = (fx.age - arrive) / 1.7;
    if (u > 0 && u < 1) {
      K.fx.beastBlast(ctx, ex, ey, fx.R, u, 1 - u, time, fx.seed);
      dustBurst(ctx, ex, ey, fx.R * 1.1, u * 2, fx.seed, 'dust', 16);
    }
  }

  // ------------------------------------------------------------------ Tsunade
  function slabs(ctx, x, y, r, k, seed, n, size, front) {
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + hash(i + seed) * .3, sn = Math.sin(a);
      if (front != null && (sn >= 0) !== front) continue;
      const g = easeOut(k * 2 - hash(i * 3 + seed) * .4);
      if (g <= 0) continue;
      const R = r * (.85 + hash(i * 5 + seed) * .25), s = size * (.7 + hash(i * 7 + seed) * .6) * g;
      const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
      ctx.save(); ctx.translate(px, py - s * .35); ctx.rotate(a + Math.PI / 2 + (hash(i) - .5) * .6); ctx.scale(1, .62);
      ctx.drawImage(rockSprite(), -s, -s, s * 2, s * 2);
      ctx.restore();
    }
  }
  function okashoG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .6, fx.dur), k = easeOut(fx.age * 4);
    craterG(ctx, fx.x, fx.y, fx.r * 1.05, .95 * fade, fx.seed);
    ctx.globalAlpha = fade; cracks(ctx, fx.x, fx.y, fx.r * 2.1, k, fx.seed, 13, 5); ctx.globalAlpha = 1;
    slabs(ctx, fx.x, fx.y, fx.r * .95, fx.age * (1 - win(fx.age, fx.dur - .6, fx.dur)) + (fx.age > fx.dur - .6 ? 1 : 0) * 0, fx.seed, 12, 34, false);
    if (fx.age < 1.2) { K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.8, fx.age / 1.2, 1 - fx.age / 1.2, '255,180,210'); K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 2.4, fx.age / 1.2 * .8, (1 - fx.age / 1.2) * .6, '255,255,255'); }
  }
  function okashoO(ctx, fx, time) {
    const K = Kit();
    slabs(ctx, fx.x, fx.y, fx.r * .95, fx.age, fx.seed, 12, 34, true);
    dustBurst(ctx, fx.x, fx.y, fx.r * 1.2, fx.age, fx.seed, 'dust', 16);
    if (fx.age < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 40, fx.r * 1.3, '150,255,160', (1 - fx.age / .3) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
    // cherry petals bursting out of the blow
    const e = easeOut(fx.age * 1.4), fade = 1 - win(fx.age, 1.2, 2.2);
    for (let i = 0; i < 30; i++) {
      const a = hash(i * 2.3 + fx.seed) * TAU, d = fx.r * (.3 + e * (.8 + hash(i * 4.1) * .9)), h = Math.sin(Math.PI * Math.min(1, fx.age * 1.1)) * (60 + hash(i) * 120);
      petal(ctx, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .7 - h, time * 4 + i, 6, `rgba(${i % 3 ? '255,170,205' : '255,235,245'},${fade})`);
    }
  }
  function fissureG(ctx, fx, time) {
    const front = Math.min(fx.len, fx.age * fx.speed), open = easeOut(fx.age * 2.5), fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), px = -sa, py = ca, n = Math.max(2, Math.ceil(front / 40));
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#6e5a46'; ctx.strokeStyle = '#2a1f18'; ctx.lineWidth = 3;
    const edge = (side, wd) => { for (let i = 0; i <= n; i++) { const d = front * i / n, w = wd * (1 - Math.pow(d / Math.max(1, fx.len), 2) * .6) * (.6 + hash(i * 3.3 + fx.seed + side) * .55); ctx.lineTo(fx.x + ca * d + px * w * side, fx.y + sa * d + py * w * side); } };
    for (const [wd, col] of [[fx.w * .5 * open, '#6e5a46'], [fx.w * .3 * open, '#1a120c']]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
      edge(1, wd);
      for (let i = n; i >= 0; i--) { const d = front * i / n, w = wd * (1 - Math.pow(d / Math.max(1, fx.len), 2) * .6) * (.6 + hash(i * 3.3 + fx.seed - 1) * .55); ctx.lineTo(fx.x + ca * d - px * w, fx.y + sa * d - py * w); }
      ctx.closePath(); ctx.fill(); if (col === '#6e5a46') ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // rock slabs heaved up along both lips (back side here, front side in the overlay)
    fissureSlabs(ctx, fx, front, py > 0 ? -1 : 1);
  }
  function fissureSlabs(ctx, fx, front, side) {
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a), px = -sa, py = ca, sink = win(fx.age, fx.dur - .7, fx.dur);
    for (let d = 50, i = 0; d < front; d += 70, i++) {
      const g = easeOut((fx.age - d / fx.speed) * 4) * (1 - sink), s = (24 + hash(i * 2.2 + fx.seed) * 20) * g;
      if (s < 2) continue;
      const w = fx.w * (.55 + hash(i + side) * .25), x = fx.x + ca * d + px * w * side, y = fx.y + sa * d + py * w * side;
      ctx.save(); ctx.translate(x, y - s * .4); ctx.rotate(fx.a + side * .5 + (hash(i * 9) - .5) * .5); ctx.scale(1, .6);
      ctx.drawImage(rockSprite(), -s, -s, s * 2, s * 2); ctx.restore();
    }
  }
  function fissureO(ctx, fx, time) {
    const front = Math.min(fx.len, fx.age * fx.speed), py = Math.cos(fx.a), K = Kit(), dust = K.puff('dust');
    fissureSlabs(ctx, fx, front, py > 0 ? 1 : -1);
    const ca = Math.cos(fx.a), sa = Math.sin(fx.a);
    for (let d = 40, i = 0; d < front; d += 80, i++) {
      const k = (fx.age - d / fx.speed) / 1.1;
      if (k > 0 && k < 1) K.stamp(ctx, dust, fx.x + ca * d + (hash(i) - .5) * 60, fx.y + sa * d - 20 - k * 40, 30 + k * 40, (1 - k) * .7);
    }
    if (fx.age < .35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 20, 160, '160,255,170', (1 - fx.age / .35) * .7, true); ctx.globalCompositeOperation = 'source-over'; }
  }
  function hurlG(ctx, fx, time) {
    for (const r of fx.rocks) {
      if (fx.age < r.t1) {
        markCircle(ctx, r.x1, r.y1, 125, '214,180,130', clamp01(fx.age / r.t1), time);
        if (fx.age > r.t0) { const u = (fx.age - r.t0) / (r.t1 - r.t0), gx = lerp(fx.x, r.x1, u), gy = lerp(fx.y, r.y1, u); ctx.fillStyle = 'rgba(20,14,8,.3)'; ctx.beginPath(); ctx.ellipse(gx, gy, 40 + 20 * u, 14 + 8 * u, 0, 0, TAU); ctx.fill(); }
      } else craterG(ctx, r.x1, r.y1, 100, .85 * (1 - win(fx.age, fx.dur - .5, fx.dur)), r.seed);
    }
  }
  function hurlO(ctx, fx, time) {
    const L = LIFT();
    for (const r of fx.rocks) {
      if (fx.age > r.t0 && fx.age < r.t1) {
        const u = (fx.age - r.t0) / (r.t1 - r.t0), gx = lerp(fx.x, r.x1, u), gy = lerp(fx.y, r.y1, u), h = bell(u) * 260 + (1 - u) * (L + 60);
        if (r.log) { ctx.save(); ctx.translate(gx, gy - h); ctx.rotate(time * 7 + r.seed); ctx.drawImage(logSprite(), -110, -35); ctx.restore(); }
        else rockAt(ctx, gx, gy - h, 62, time * 5 + r.seed);
      }
      const k = fx.age - r.t1;
      if (k > 0) dustBurst(ctx, r.x1, r.y1, 130, k, r.seed, 'dust', 10);
    }
  }
  const KAT_S = .85;
  function katsuyuAlpha(fx) { return easeOut(fx.age / .3) * (1 - easeIn(win(fx.age, fx.dur - .8, fx.dur))); }
  function acidPuff() {
    return Kit().sprite('hkb:acid', 96, 96, g => {
      const gr = g.createRadialGradient(40, 38, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(246,252,214,.95)'); gr.addColorStop(.4, 'rgba(214,236,150,.85)'); gr.addColorStop(.75, 'rgba(150,190,70,.45)'); gr.addColorStop(1, 'rgba(120,160,50,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function katsuyuG(ctx, fx, time) {
    const K = Kit(), a = katsuyuAlpha(fx), facing = Math.cos(fx.a) >= 0 ? 1 : -1, fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    for (const p of fx.pud) {
      const g = easeOut((fx.age - p.t) / .3);
      if (g <= 0) continue;
      const R = p.r * g;
      ctx.globalAlpha = .85 * fade; ctx.drawImage(acidDisc(), p.x - R, p.y - R * .7, R * 2, R * 1.4); ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(240,255,200,${.8 * fade})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const ph = (time * 2 + i / 3 + hash(p.x)) % 1, bx = p.x + (hash(i + p.x) - .5) * R, by = p.y + (hash(i * 3 + p.y) - .5) * R * .6; ctx.beginPath(); ctx.arc(bx, by, 2 + ph * 6, 0, TAU); ctx.stroke(); }
    }
    if (a > .01) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(fx.sx, fx.sy); ctx.scale(facing * KAT_S, KAT_S);
      ctx.drawImage(katsuyuSprite(), -KAT_OX, -KAT_OY + Math.sin(time * 3) * 3);
      ctx.restore();
    }
    if (window.AnimeSprites && fx.age < .6) window.AnimeSprites.drawSmoke(ctx, fx.sx, fx.sy - 90, fx.age / .6, 120);
  }
  function katsuyuO(ctx, fx, time) {
    const K = Kit(), facing = Math.cos(fx.a) >= 0 ? 1 : -1, mx = fx.sx + facing * KAT_MOUTH[0] * KAT_S, my = fx.sy + KAT_MOUTH[1] * KAT_S, puff = acidPuff();
    if (fx.age > .15 && fx.age < 1.3) {
      const live = 1 - win(fx.age, 1.0, 1.3);
      for (let s = -2; s <= 2; s++) {
        const ang = fx.a + s * fx.half * .45, reach = fx.reach * (.9 - Math.abs(s) * .08);
        for (let i = 0; i < 9; i++) {
          const ph = ((time * 2.6 + i / 9 + s * .13) % 1), d = ph * reach * Math.min(1, (fx.age - .15) * 3);
          const gx = fx.x + Math.cos(ang) * d, gy = fx.y + Math.sin(ang) * d, h = bell(ph) * 90 + (1 - ph) * (fx.y - my);
          K.stamp(ctx, puff, lerp(mx, gx, Math.min(1, ph * 1.4)), gy - h, 18 + ph * 26, live * (1 - ph * .4));
        }
      }
    }
    // steam rising from the dissolving ground
    const steam = K.puff('smoke'), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    for (const p of fx.pud) { if (fx.age < p.t) continue; for (let i = 0; i < 2; i++) { const ph = (time * .7 + i * .5 + hash(p.y)) % 1; K.stamp(ctx, steam, p.x + (hash(i + p.x) - .5) * p.r, p.y - 10 - ph * 60, 14 + ph * 20, bell(ph) * .35 * fade); } }
  }
  function byakugoG(ctx, fx, time) {
    const K = Kit(), u = fx.age / fx.dur;
    K.fx.shockRing(ctx, fx.x, fx.y, fx.r * 1.2, u * 1.3, 1 - u, '170,255,170');
    K.fx.shockRing(ctx, fx.x, fx.y, fx.r * .8, u * 1.6, 1 - u, '190,140,255');
    // the diamond seal glowing on the ground
    ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(1, .5); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = `rgba(190,140,255,${.8 * (1 - u)})`; ctx.lineWidth = 4; ctx.strokeRect(-60, -60, 120, 120);
    ctx.restore();
  }
  function byakugoO(ctx, fx, time) {
    const K = Kit(), u = fx.age / fx.dur;
    if (u < .3) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 70, 160, '190,140,255', (1 - u / .3) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
    dustBurst(ctx, fx.x, fx.y, fx.r, fx.age * 1.3, fx.seed, 'dust', 12);
  }
  function meteorG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .7, fx.dur);
    if (fx.age < fx.t1) { markCircle(ctx, fx.x, fx.y, fx.R, '160,255,170', fx.age / fx.t1, time, true); markCircle(ctx, fx.x, fx.y, 260, '160,255,170', fx.age / fx.t1, time); }
    const u = fx.age - fx.t1;
    if (u > 0) {
      craterG(ctx, fx.x, fx.y, 300, .95 * fade, fx.seed);
      ctx.globalAlpha = fade; cracks(ctx, fx.x, fx.y, fx.R * 1.5, easeOut(u * 3), fx.seed, 16, 6); ctx.globalAlpha = 1;
      slabs(ctx, fx.x, fx.y, 320, u * fade, fx.seed, 16, 44, false);
      if (u < 1.4) for (let i = 0; i < 3; i++) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * (1.3 + i * .5), clamp01(u / 1.4 - i * .1), (1 - u / 1.4) * (1 - i * .25), i === 1 ? '255,255,255' : '160,255,170');
    }
  }
  function meteorO(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.t1;
    if (fx.age > .35 && u < 0) {
      // the colossal chakra fist falling out of the sky
      const k = easeIn((fx.age - .35) / (fx.t1 - .35)), sx = fx.x - 260, sy = fx.y - 900, px = lerp(sx, fx.x, k), py = lerp(sy, fx.y - 90, k), s = 2.4 + k * 1.3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,255,170,.35)'; ctx.lineWidth = 120 * s / 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lerp(sx, px, .2), lerp(sy, py, .2)); ctx.lineTo(px, py); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 30; ctx.stroke();
      K.glow(ctx, px, py, 200 * s / 3, '170,255,180', .9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(py - sy, px - sx)); ctx.drawImage(fistSprite(), -70 * s, -60 * s, 140 * s, 120 * s);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(fistSprite(), -70 * s, -60 * s, 140 * s, 120 * s); ctx.restore();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(py - sy, px - sx));
      ctx.fillStyle = '#8a4fc8'; ctx.beginPath(); ctx.moveTo(-30, -14); ctx.lineTo(-18, 0); ctx.lineTo(-30, 14); ctx.lineTo(-42, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (u > 0) {
      if (u < .35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - 80, fx.R * 1.6, '220,255,220', (1 - u / .35), true); ctx.globalCompositeOperation = 'source-over'; }
      dustBurst(ctx, fx.x, fx.y, fx.R * 1.2, u, fx.seed, 'dust', 20);
      slabs(ctx, fx.x, fx.y, 320, u * (1 - win(fx.age, fx.dur - .7, fx.dur)), fx.seed, 16, 44, true);
      const e = easeOut(u * 1.2), fade = 1 - win(u, 1.2, 2.4);
      for (let i = 0; i < 36; i++) {
        const a = hash(i * 2.3 + fx.seed) * TAU, d = fx.R * (.2 + e * (.7 + hash(i * 4.1) * .7)), h = Math.sin(Math.PI * Math.min(1, u * .9)) * (80 + hash(i) * 160);
        petal(ctx, fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * .7 - h, time * 4 + i, 7, `rgba(${i % 3 ? '255,170,205' : '200,255,200'},${fade})`);
      }
    }
  }

  // ------------------------------------------------------------------ Kakashi
  function raikiriG(ctx, fx, time) {
    const K = Kit(), fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    ctx.strokeStyle = `rgba(20,24,40,${.45 * fade})`; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    K.forkedBolt(ctx, fx.x0, fx.y0, fx.x1, fx.y1, fx.seed, time, { jitter: 14, alpha: .7 * fade, width: 1.6, pal: BOLT_B, base: 'rgba(20,50,110,.6)', step: 20, forks: 3, forkLen: 24, rate: 22, snap: true });
    ctx.globalCompositeOperation = 'source-over';
    if (fx.end >= 0) { const u = fx.age - fx.end; if (u < 1) { craterG(ctx, fx.x1, fx.y1, 100, 1 - u, fx.seed); K.fx.shockRing(ctx, fx.x1, fx.y1, 200, u, 1 - u, '150,210,255'); } }
  }
  function raikiriO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    if (fx.end < 0) {
      const len = Math.hypot(fx.x1 - fx.x0, fx.y1 - fx.y0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(120,190,255,.28)'; ctx.lineWidth = 50; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x1 - Math.cos(fx.a) * Math.min(len, 300), fx.y1 - L - Math.sin(fx.a) * Math.min(len, 300)); ctx.lineTo(fx.x1, fx.y1 - L); ctx.stroke();
      for (let i = 0; i < 3; i++) K.forkedBolt(ctx, fx.x1 - Math.cos(fx.a) * Math.min(len, 260), fx.y1 - L + (i - 1) * 12, fx.x1, fx.y1 - L, fx.seed + i * 9, time, { jitter: 16, alpha: .9, width: 2, pal: BOLT_B, step: 18, forks: 2, forkLen: 26, rate: 26, snap: true });
      ctx.globalCompositeOperation = 'source-over';
      K.chidoriBall(ctx, fx.x1 + Math.cos(fx.a) * 22, fx.y1 - L, 26, time, fx.seed, { pal: BOLT_B, body: '120,190,255', base: 'rgba(20,50,110,.8)', power: 1, bolts: 10, width: 1.3 });
    } else {
      const u = (fx.age - fx.end) / .8;
      if (u < 1) K.fx.lightningBlast(ctx, fx.x1, fx.y1, 190, u, 1 - u, time, fx.seed);
    }
  }
  function houndG(ctx, fx, time) {
    const T = fx.trail, fade = 1 - win(fx.age, fx.dur - .5, fx.dur);
    if (T.length < 4) return;
    ctx.strokeStyle = `rgba(20,24,40,${.4 * fade})`; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(T[0], T[1]); for (let i = 2; i < T.length; i += 2) ctx.lineTo(T[i], T[i + 1]); ctx.stroke();
    if (fx.done >= 0) { const u = fx.age - fx.done; if (u < 1) { craterG(ctx, fx.x, fx.y, 100, 1 - u, fx.seed); Kit().fx.shockRing(ctx, fx.x, fx.y, 220, u, 1 - u, '150,210,255'); } }
  }
  // The lightning hound: a running wolf drawn in light, legs galloping, crackle trailing behind.
  function houndBody(ctx, x, y, h, time, s) {
    const K = Kit(), flip = Math.cos(h) < 0 ? -1 : 1, gal = time * 18;
    ctx.save(); ctx.translate(x, y); ctx.scale(flip * s, s);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-34, -22); ctx.quadraticCurveTo(-10, -34, 16, -30);
      ctx.lineTo(26, -42); ctx.lineTo(30, -32); ctx.lineTo(36, -44); ctx.lineTo(40, -30);
      ctx.quadraticCurveTo(56, -26, 62, -18); ctx.lineTo(44, -14); ctx.quadraticCurveTo(30, -12, 22, -16);
      ctx.quadraticCurveTo(0, -10, -30, -12); ctx.lineTo(-58, -26 + Math.sin(gal) * 4); ctx.lineTo(-40, -18); ctx.closePath();
    };
    ctx.globalCompositeOperation = 'source-over';
    path(); ctx.strokeStyle = 'rgba(10,30,80,.6)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.lineCap = 'round';
    for (const [lx, ph] of [[-24, 0], [-14, 1.6], [16, 3.1], [26, 4.7]]) { const sw = Math.sin(gal + ph); ctx.strokeStyle = 'rgba(10,30,80,.6)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx + sw * 14, 2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, 0, -20, 70, '90,160,255', .32);
    path(); ctx.fillStyle = 'rgba(90,160,255,.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,250,255,1)'; ctx.lineWidth = 2.4; ctx.stroke();
    for (const [lx, ph] of [[-24, 0], [-14, 1.6], [16, 3.1], [26, 4.7]]) { const sw = Math.sin(gal + ph); ctx.strokeStyle = 'rgba(220,240,255,.95)'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx + sw * 14, 2); ctx.stroke(); }
    K.glow(ctx, 44, -30, 10, '255,255,255', 1, true);
    for (let i = 0; i < 4; i++) K.forkedBolt(ctx, -30 + i * 20, -26, -10 + i * 22 + (hash(i + Math.floor(time * 20)) - .5) * 30, -50 - hash(i * 3) * 20, i * 7, time, { jitter: 6, alpha: .9, width: 1.1, pal: BOLT_B, step: 8, rate: 30, snap: true });
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  function houndO(ctx, fx, time) {
    const K = Kit(), T = fx.trail;
    if (fx.done < 0) {
      ctx.globalCompositeOperation = 'lighter';
      const n = T.length / 2;
      for (let i = Math.max(0, n - 12); i < n - 3; i += 3) K.forkedBolt(ctx, T[i * 2], T[i * 2 + 1] - 20, T[i * 2 + 6], T[i * 2 + 7] - 20, i + fx.seed, time, { jitter: 12, alpha: .8 * (i / n), width: 1.6, pal: BOLT_B, step: 12, forks: 1, forkLen: 20, rate: 26, snap: true });
      ctx.globalCompositeOperation = 'source-over';
      houndBody(ctx, fx.x, fx.y, fx.h, time, 1.25);
    } else {
      const u = (fx.age - fx.done) / .8;
      if (u < 1) K.fx.lightningBlast(ctx, fx.x, fx.y, 200, u, 1 - u, time, fx.seed);
    }
  }
  // Kamui: space twisting into a spiral around a point and swallowing everything inside.
  function kamuiVortex(ctx, x, y, R, k, time, seed) {
    if (k <= .01 || R < 2) return;
    const K = Kit();
    K.glow(ctx, x, y, R * 1.15, '30,10,50', .55 * k);
    const sw = K.swirl('hkKamui', ['rgba(16,6,30,.95)', 'rgba(110,70,190,.85)', 'rgba(40,20,70,.9)', 'rgba(220,200,255,.7)'], 11, 1.6, .05, 256, 4.4);
    K.spin(ctx, sw, x, y, R, time * 7 + seed, .9 * k);
    K.spin(ctx, sw, x, y, R * .62, -time * 10 + seed, .7 * k);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(200,170,255,${.55 * k})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const r = R * ((time * .8 + i / 3) % 1); ctx.globalAlpha = k * (1 - r / R); ctx.beginPath(); ctx.arc(x, y, R - r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    K.glow(ctx, x, y, R * .3, '180,140,255', .5 * k);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(6,2,12,${.9 * k})`; ctx.beginPath(); ctx.arc(x, y, R * .14, 0, TAU); ctx.fill();
  }
  function kamuiG(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.hit;
    if (u < 0) markCircle(ctx, fx.x, fx.y, fx.R, '170,130,220', fx.age / fx.hit + .3, time);
    else { craterG(ctx, fx.x, fx.y, fx.R * .7, .8 * (1 - win(fx.age, fx.dur - .4, fx.dur)), fx.seed); if (u < .9) K.fx.shockRing(ctx, fx.x, fx.y, fx.R * 1.5, u / .9, 1 - u / .9, '200,170,255'); }
    // the ground itself twists toward the centre
    const k = fx.age < fx.hit ? easeOut(fx.age / fx.hit) : 1 - easeIn(u / .5);
    if (k > 0) {
      ctx.strokeStyle = `rgba(40,20,50,${.45 * k})`; ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) { const a0 = i * TAU / 10 + time * 2; ctx.beginPath(); for (let s = 0; s <= 10; s++) { const r = fx.R * (1 - s / 10), a = a0 + s * .25 * k; ctx.lineTo(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r); } ctx.stroke(); }
    }
  }
  function kamuiO(ctx, fx, time) {
    const K = Kit(), u = fx.age - fx.hit, L = LIFT();
    const k = fx.age < fx.hit ? easeOut(fx.age / fx.hit) : 1 - easeIn(u / .45);
    kamuiVortex(ctx, fx.x, fx.y - L, fx.R * (.5 + .5 * k), k, time, fx.seed);
    // debris spiralling into the void
    if (k > 0) for (let i = 0; i < 12; i++) {
      const ph = (time * .9 + hash(i * 3.1 + fx.seed)) % 1, a = hash(i) * TAU + ph * 5, r = fx.R * (1 - ph);
      rockAt(ctx, fx.x + Math.cos(a) * r, fx.y - L + Math.sin(a) * r * .8, 8 * (1 - ph) + 3, time * 6 + i);
    }
    if (u > 0 && u < .25) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.x, fx.y - L, fx.R * 1.2, '220,200,255', (1 - u / .25) * .8, true); ctx.globalCompositeOperation = 'source-over'; }
  }
  function dogPos(fx, d, time) {
    const t = fx.age - d.lag, ca = Math.cos(d.a), sa = Math.sin(d.a);
    if (t < .2) return [fx.x + ca * fx.R, fx.y + sa * fx.R, 0, easeOut(t / .2), ca];
    if (t < .45) { const u = easeInOut((t - .2) / .25); return [fx.x + ca * lerp(fx.R, 34, u), fx.y + sa * lerp(fx.R, 34, u), bell(u) * 50, 1, -ca]; }
    return [fx.x + ca * 34 + Math.sin(time * 30 + d.v) * 2, fx.y + sa * 34, 0, 1, -ca];
  }
  function ninkenG(ctx, fx, time) {
    const K = Kit();
    if (fx.age < .48) markCircle(ctx, fx.x, fx.y, fx.R + 15, '214,180,130', fx.age / .48, time);
    const fade = 1 - win(fx.age, fx.dur - .5, fx.dur), dust = K.puff('dust');
    for (const d of fx.dogs) {
      const hx = fx.x + Math.cos(d.a) * fx.R, hy = fx.y + Math.sin(d.a) * fx.R;
      ctx.fillStyle = `rgba(30,20,12,${.55 * fade})`; ctx.beginPath(); ctx.ellipse(hx, hy, 26, 12, 0, 0, TAU); ctx.fill();
      const k = (fx.age - d.lag) / .5;
      if (k > 0 && k < 1) K.stamp(ctx, dust, hx, hy - 10 - k * 20, 22 + k * 24, (1 - k) * .75);
    }
    if (fx.age > .45) { ctx.fillStyle = `rgba(60,44,30,${.4 * fade})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, 80, 0, TAU); ctx.fill(); }
  }
  function ninkenO(ctx, fx, time) {
    const S = window.AnimeSprites;
    const order = fx.dogs.map(d => ({ d, p: dogPos(fx, d, time) })).sort((p, q) => p.p[1] - q.p[1]);
    const poof = fx.age - 1.35;
    for (const { d, p } of order) {
      if (poof > .15) continue;
      const [x, y, h, rise, face] = p, sc = DOGS[d.v % DOGS.length][2] * 1.05;
      ctx.save(); ctx.translate(x, y - h); if (face < 0) ctx.scale(-1, 1);
      const hh = 60 * rise;
      ctx.drawImage(dogSprite(d.v), 0, 0, 80, hh, -40 * sc, -hh * sc, 80 * sc, hh * sc);
      ctx.restore();
    }
    if (S && poof > 0 && poof < .6) for (const d of fx.dogs) { const p = dogPos(fx, d, time); S.drawSmoke(ctx, p[0], p[1] - 20, poof / .6, 26); }
  }
  function fallsFront(fx) { return Math.min(fx.r, fx.age * fx.speed); }
  function fallsG(ctx, fx, time) {
    const front = fallsFront(fx), fade = 1 - win(fx.age, fx.dur - .8, fx.dur);
    if (front < 4) return;
    ctx.save();
    sector(ctx, fx.x, fx.y, 0, front, fx.a - fx.h, fx.a + fx.h); ctx.clip();
    ctx.globalAlpha = .55 * fade; ctx.drawImage(waterDisc(), fx.x - front, fx.y - front, front * 2, front * 2);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function fallsO(ctx, fx, time) {
    const K = Kit(), front = fallsFront(fx), H = 150 * (1 - .4 * front / fx.r) * (1 - easeIn((fx.age - fx.r / fx.speed) / .5)), water = K.puff('water');
    if (H < 4) return;
    const a0 = fx.a - fx.h, a1 = fx.a + fx.h, M = 22;
    const grad = ctx.createLinearGradient(0, fx.y - H - 200, 0, fx.y + front);
    grad.addColorStop(0, 'rgba(230,250,255,.95)'); grad.addColorStop(.3, 'rgba(110,200,250,.88)'); grad.addColorStop(1, 'rgba(20,90,180,.8)');
    const top = a => H * (.82 + .18 * Math.sin(a * 9 + time * 8));
    ctx.fillStyle = grad; ctx.beginPath();
    for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(fx.x + Math.cos(a) * front, fx.y + Math.sin(a) * front); }
    for (let k = M; k >= 0; k--) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(fx.x + Math.cos(a) * (front - 40), fx.y + Math.sin(a) * (front - 40) - top(a)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(8,50,110,.55)'; ctx.lineWidth = 6;
    ctx.beginPath(); for (let k = 0; k <= M; k++) { const a = a0 + (a1 - a0) * k / M; ctx.lineTo(fx.x + Math.cos(a) * (front - 40), fx.y + Math.sin(a) * (front - 40) - top(a)); } ctx.stroke();
    ctx.strokeStyle = 'rgba(245,253,255,.95)'; ctx.lineWidth = 3; ctx.stroke();
    for (let k = 0; k <= M; k += 2) { const a = a0 + (a1 - a0) * k / M; K.stamp(ctx, water, fx.x + Math.cos(a) * (front - 40) + Math.sin(time * 9 + k) * 6, fx.y + Math.sin(a) * (front - 40) - top(a) - 10, 22, .8); }
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k <= M; k += 4) { const a = a0 + (a1 - a0) * k / M; K.glow(ctx, fx.x + Math.cos(a) * (front - 40), fx.y + Math.sin(a) * (front - 40) - top(a), 30, '235,250,255', .7); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function shidenG(ctx, fx, time) {
    const fade = 1 - win(fx.age, fx.dur - .6, fx.dur);
    for (const b of fx.bolts) {
      if (fx.age < b.t) continue;
      ctx.strokeStyle = `rgba(30,10,50,${.45 * fade})`; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(b.a) * fx.len, fx.y + Math.sin(b.a) * fx.len); ctx.stroke();
    }
  }
  function shidenO(ctx, fx, time) {
    const K = Kit(), L = LIFT();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of fx.bolts) {
      const u = (fx.age - b.t) / .5;
      if (u < 0 || u > 1) continue;
      const ex = fx.x + Math.cos(b.a) * fx.len, ey = fx.y + Math.sin(b.a) * fx.len - 10, f = 1 - u;
      ctx.strokeStyle = `rgba(160,80,255,${.25 * f})`; ctx.lineWidth = 60 * f; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - L); ctx.lineTo(ex, ey); ctx.stroke();
      for (let i = 0; i < 2; i++) K.forkedBolt(ctx, fx.x + Math.cos(b.a) * 20, fx.y - L, ex, ey, b.seed + i * 5, time, { jitter: 30, alpha: f, width: 3.4 - i, pal: BOLT_P, base: 'rgba(40,0,80,.8)', step: 26, forks: 5, forkLen: 50, rate: 24, snap: true });
      K.glow(ctx, ex, ey, 90 * f + 20, '200,140,255', f, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (fx.age < .7) K.chidoriBall(ctx, fx.x + Math.cos(fx.bolts[1].a) * 20, fx.y - L, 22, time, fx.seed, { pal: BOLT_P, body: '170,110,255', base: 'rgba(40,0,80,.8)', dark: '40,0,70', power: 1, alpha: 1 - fx.age / .7, bolts: 9, width: 1.2 });
  }
  const SUS_S = .9;
  const BLUE_FLAME = [[1, '#0a3a9a'], [.84, '#1a6ae0'], [.66, '#4aa0ff'], [.46, '#a0d8ff'], [.25, '#eaf8ff']];
  function susFrame(fx) {
    const facing = Math.cos(fx.a) >= 0 ? 1 : -1, bx = fx.x - facing * 40, by = fx.y + 90;
    return { facing, bx, by, hx: bx + facing * SUS_HAND[0] * SUS_S, hy: by + SUS_HAND[1] * SUS_S };
  }
  function susAlpha(fx) { return easeOut(fx.age / .6) * (1 - easeIn(win(fx.age, fx.dur - .9, fx.dur))); }
  function susanooG(ctx, fx, time) {
    const K = Kit(), f = susFrame(fx), a = susAlpha(fx);
    if (fx.age < fx.boom) { markCircle(ctx, fx.tx, fx.ty, 390, '120,190,255', fx.age / fx.boom, time, true); markCircle(ctx, fx.tx, fx.ty, 160, '120,190,255', fx.age / fx.boom, time); }
    const u = fx.age - fx.boom;
    if (u > 0) { craterG(ctx, fx.tx, fx.ty, 300, .95 * (1 - win(fx.age, fx.dur - .6, fx.dur)), fx.seed); cracks(ctx, fx.tx, fx.ty, 560, easeOut(u * 3), fx.seed, 14, 5); }
    if (a <= .01) return;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, f.bx, f.by - 360, 460, '60,140,255', .35 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = .92 * a; ctx.translate(f.bx, f.by); ctx.scale(f.facing * SUS_S, SUS_S);
    ctx.drawImage(susanooSprite(), -SUS_OX, -SUS_OY);
    const tick = Math.floor(time * 11);
    for (let i = 0; i < 8; i++) {
      const ox = (i - 3.5) * 34, h = (190 - Math.abs(i - 3.5) * 26 + hash(i * 2) * 30) * (.9 + .1 * Math.sin(time * 8 + i));
      ctx.globalAlpha = .6 * a;
      ctx.drawImage(K.flame((i + tick) % 6, BLUE_FLAME, 'hkblue'), ox - h * .28, -6 + Math.abs(i - 3.5) * 5 - h * FB, h * .56, h);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) K.glow(ctx, f.bx + s * 16 * SUS_S, f.by - 527 * SUS_S, 18, '255,60,60', a * (.8 + .2 * Math.sin(time * 7)), true);
    ctx.globalCompositeOperation = 'source-over';
  }
  function susanooO(ctx, fx, time) {
    const K = Kit(), f = susFrame(fx), img = kamuiShurikenSprite(), a = susAlpha(fx);
    for (const s of fx.sh) {
      const u = (fx.age - s.t0) / s.dur;
      if (u < 0) {
        if (a > .3) { const off = s.side * 26; K.spin(ctx, img, f.hx + off, f.hy - 40 + off * .5, 70, time * 3, a); }
        continue;
      }
      if (u > 1) continue;
      const [gx, gy] = qbez(fx.x, fx.y, s.cx, s.cy, fx.tx, fx.ty, u), H0 = fx.y - f.hy + 40;
      const px = gx + (f.hx - fx.x) * Math.pow(1 - u, 1.5), py = gy - H0 * Math.pow(1 - u, 1.3) - 40 * u;
      ctx.fillStyle = 'rgba(10,20,40,.3)'; ctx.beginPath(); ctx.ellipse(gx, gy, 60, 22, 0, 0, TAU); ctx.fill();
      for (let k = 3; k >= 1; k--) {
        const uu = Math.max(0, u - k * .05), [qx, qy] = qbez(fx.x, fx.y, s.cx, s.cy, fx.tx, fx.ty, uu);
        K.spin(ctx, img, qx + (f.hx - fx.x) * Math.pow(1 - uu, 1.5), qy - H0 * Math.pow(1 - uu, 1.3) - 40 * uu, 74, -time * 22 - k, .25 / k);
      }
      ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, px, py, 120, '90,160,255', .6); ctx.globalCompositeOperation = 'source-over';
      K.spin(ctx, img, px, py, 78, -time * 22, 1);
    }
    // space collapsing around the target as the blades bite, then the implosion
    const first = fx.sh[0].t0 + fx.sh[0].dur, u = fx.age - fx.boom;
    if (fx.age > first && u < .5) {
      const k = u < 0 ? easeOut((fx.age - first) / (fx.boom - first)) : 1 - easeIn(u / .5);
      kamuiVortex(ctx, fx.tx, fx.ty - 40, 120 + 280 * (u < 0 ? k : 1), k, time, fx.seed);
    }
    if (u > 0) {
      if (u < .35) { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, fx.tx, fx.ty - 60, 520, '200,220,255', 1 - u / .35, true); ctx.globalCompositeOperation = 'source-over'; }
      if (u < 1.4) for (let i = 0; i < 3; i++) K.fx.shockRing(ctx, fx.tx, fx.ty, 420 * (1.1 + i * .45), clamp01(u / 1.4 - i * .1), (1 - u / 1.4) * (1 - i * .25), i === 1 ? '255,255,255' : '150,200,255');
      dustBurst(ctx, fx.tx, fx.ty, 420, u, fx.seed, 'dust', 18);
    }
  }

  // ------------------------------------------------------------------ fx table
  const FX = {
    dragon: [dragonG, dragonO], forest: [forestG, forestO], golem: [golemG, golemO], pollen: [pollenG, pollenO], kannon: [kannonG, kannonO],
    slash: [slashG, slashO], waterwall: [waterwallG, waterwallO], edo: [edoG, edoO], tags: [tagsG, tagsO], flood: [floodG, floodO],
    fireDragon: [fireDragonG, fireDragonO], swarm: [swarmG, swarmO], staff: [staffG, staffO], cage: [cageG, cageO], earthwall: [earthwallG, earthwallO], reaper: [reaperG, reaperO],
    web: [webG, webO], rasen: [rasenG, rasenO], nidan: [nidanG, nidanO], tbb: [tbbG, tbbO], kurama: [kuramaG, kuramaO],
    okasho: [okashoG, okashoO], fissure: [fissureG, fissureO], hurl: [hurlG, hurlO], katsuyu: [katsuyuG, katsuyuO], byakugo: [byakugoG, byakugoO], meteor: [meteorG, meteorO],
    raikiri: [raikiriG, raikiriO], hound: [houndG, houndO], kamui: [kamuiG, kamuiO], ninken: [ninkenG, ninkenO], falls: [fallsG, fallsO], shiden: [shidenG, shidenO], susanoo: [susanooG, susanooO]
  };

  // ------------------------------------------------------------------ body auras
  function bodyLift(z) {
    const st = z && z.hk;
    if (!st || !st.jump) return 0;
    const j = st.jump;
    return Math.sin(Math.PI * Math.min(1, j.t / j.dur)) * (j.high || 150);
  }
  function handAt(z, st) {
    const f = Math.cos(st.aim) >= 0 ? 1 : -1;
    return [z.x + f * 14, z.y - bodyLift(z) - LIFT() - 6];
  }
  function chargeAura(ctx, z, st, m, time) {
    const K = Kit(), k = 1 - st.windup / st.windMax, lift = bodyLift(z), cx = z.x, cy = z.y - lift - 34, mv = st.move;
    const [hx, hy] = handAt(z, st);
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 60 + 40 * k, MOVES[mv].rgb, .35);
    ctx.globalCompositeOperation = 'source-over';
    if (z.bossId === 'hashirama') {
      for (let i = 0; i < 8; i++) { const a = time * 3 + i / 8 * TAU, r = 44 + 8 * Math.sin(time * 4 + i); leaf(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .5 + 10, a + 1.5, 7, i % 2 ? '#7ccf52' : '#b6ec86'); }
      if (mv === 'h_kannon') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx, cy - 10, 120 * k + 40, '255,200,90', .5); ctx.globalCompositeOperation = 'source-over'; }
    } else if (z.bossId === 'tobirama') {
      if (mv === 't_edo') { const sm = K.puff('violet'); for (let i = 0; i < 6; i++) { const ph = (time * 1.2 + i / 6) % 1; K.stamp(ctx, sm, cx + Math.sin(i * 2.3) * 26, cy + 30 - ph * 70, 12 + 8 * (1 - ph), bell(ph) * .8); } }
      else if (mv === 't_tags') { const img = tagSprite(); for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(hx, hy); ctx.rotate((i - 2) * .3); ctx.drawImage(img, -6, -30, 13, 23); ctx.restore(); } }
      else { const w = K.puff('water'); for (let i = 0; i < 7; i++) { const a = time * 4 + i / 7 * TAU; K.stamp(ctx, w, cx + Math.cos(a) * 40, cy + Math.sin(a) * 18 + 10, 7 + 3 * k, .8); } }
    } else if (z.bossId === 'hiruzen') {
      if (mv === 's_fire') { const fire = K.puff('fire'); for (let i = 0; i < 8; i++) { const ph = (time * 2 + i / 8) % 1, a = i * 2.4; K.stamp(ctx, fire, hx + Math.cos(a) * 50 * (1 - ph), hy - 10 + Math.sin(a) * 30 * (1 - ph), 8 + 10 * ph * k, .9); } }
      else if (mv === 's_shuriken') K.spin(ctx, tinyShuriken(), hx, hy, 14, time * 30, 1);
      else if (mv === 's_enma') { rod(ctx, hx - 6, hy - 60, hx + 6, hy + 40, 6); ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, hx, hy, 40, '255,210,110', .5 * k); ctx.globalCompositeOperation = 'source-over'; }
      else if (mv === 's_reaper') { const sm = K.puff('violet'); for (let i = 0; i < 8; i++) { const ph = (time * .8 + i / 8) % 1; K.stamp(ctx, sm, cx + Math.sin(i * 2.1) * 50, cy + 40 - ph * 120, 20 + 20 * ph, bell(ph) * .7); } }
      else { const dust = K.puff('dust'); for (let i = 0; i < 6; i++) K.stamp(ctx, dust, z.x + (i - 2.5) * 22, z.y - 6, 14 + 8 * k, .6); }
    } else if (z.bossId === 'minato') {
      if (mv === 'm_rasengan') { ctx.save(); ctx.translate(hx, hy); K.fx.rasenganOrb(ctx, 10 + 12 * k, time, 1); ctx.restore(); }
      else if (mv === 'm_cloak' || mv === 'm_kurama') {
        const fire = K.puff('fire');
        for (let i = 0; i < 6; i++) { const ph = (time * 1.6 + i / 6) % 1; K.stamp(ctx, fire, cx + Math.sin(i * 2.3) * 22, cy + 34 - ph * 80, 10 + 8 * (1 - ph), bell(ph) * .7); }
        if (mv === 'm_cloak') tbbBall(ctx, hx, hy - 40, 6 + 22 * easeOut(k), time);
      } else for (let i = 0; i < 3; i++) { const a = time * 7 + i * TAU / 3; kunai(ctx, cx + Math.cos(a) * 34, cy + Math.sin(a) * 16, a + Math.PI / 2, 1, true); }
    } else if (z.bossId === 'tsunade') {
      ctx.globalCompositeOperation = 'lighter';
      K.glow(ctx, hx, hy, 26 + 18 * k, '150,255,160', .9, true);
      ctx.globalCompositeOperation = 'source-over';
      if (mv === 'ts_boulders') rockAt(ctx, z.x, z.y - lift - 120 - 30 * k, 30 + 50 * easeOut(k), time * .4);
      if (mv === 'ts_katsuyu') { ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, .45); ctx.rotate(time); ctx.strokeStyle = 'rgba(30,20,10,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 50 * k + 10, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.lineTo(Math.cos(a) * (70 * k + 14), Math.sin(a) * (70 * k + 14)); ctx.stroke(); } ctx.restore(); }
      if (mv === 'ts_meteor' || mv === 'ts_byakugo') for (let i = 0; i < 8; i++) { const a = time * 3 + i / 8 * TAU; petal(ctx, cx + Math.cos(a) * 50, cy + Math.sin(a) * 22 + 10, a, 6, i % 2 ? '#ffb6d6' : '#c8ffd0'); }
    } else if (z.bossId === 'kakashi') {
      if (mv === 'k_raikiri' || mv === 'k_hound') K.chidoriBall(ctx, hx, hy, 12 + 12 * k, time, 7, { pal: BOLT_B, body: '120,190,255', base: 'rgba(20,50,110,.8)', power: k, bolts: 8, width: 1.1 });
      else if (mv === 'k_shiden') K.chidoriBall(ctx, hx, hy, 12 + 10 * k, time, 9, { pal: BOLT_P, body: '170,110,255', base: 'rgba(40,0,80,.8)', dark: '40,0,70', power: k, bolts: 8, width: 1.1 });
      else if (mv === 'k_water') { const w = K.puff('water'); for (let i = 0; i < 8; i++) { const a = time * 5 + i / 8 * TAU; K.stamp(ctx, w, cx + Math.cos(a) * 44, cy + Math.sin(a) * 20 + 12, 8 + 4 * k, .85); } }
      else if (mv === 'k_ninken') { const dust = K.puff('dust'); for (let i = 0; i < 6; i++) K.stamp(ctx, dust, z.x + (i - 2.5) * 20, z.y - 4, 12 + 8 * k, .65); }
      if (mv === 'k_kamui' || mv === 'k_susanoo') {
        const f = Math.cos(st.aim) >= 0 ? 1 : -1, ex = z.x + f * 1.2, ey = z.y - lift - 60;
        ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, ex, ey, 20 + 14 * k, '255,40,40', .9, true); ctx.globalCompositeOperation = 'source-over';
        if (mv === 'k_susanoo') { ctx.globalCompositeOperation = 'lighter'; K.glow(ctx, cx, cy - 40, 160 * k + 40, '80,150,255', .45); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
  }
  // Minato's golden Nine-Tails chakra cloak.
  function cloakAura(ctx, z, st, time) {
    const K = Kit(), lift = bodyLift(z), a = Math.min(1, st.cloak * 1.5), cx = z.x, cy = z.y - lift - 36, tick = Math.floor(time * 12);
    const GOLD = [[1, '#c06a08'], [.84, '#f0a020'], [.66, '#ffd040'], [.46, '#fff080'], [.25, '#fffbe0']];
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, cx, cy, 70, '255,200,60', .45 * a);
    for (let i = 0; i < 6; i++) {
      const ox = (i - 2.5) * 10, h = 54 + 18 * Math.sin(time * 9 + i * 1.7);
      ctx.globalAlpha = .45 * a;
      ctx.drawImage(K.flame((i + tick) % 6, GOLD, 'hkgold'), cx + ox - h * .25, z.y - lift + 2 - h * FB, h * .5, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(20,10,0,${.55 * a})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy + 6, 9, Math.PI * .1, Math.PI * .9); ctx.moveTo(cx - 12, cy - 4); ctx.lineTo(cx - 6, cy + 2); ctx.moveTo(cx + 12, cy - 4); ctx.lineTo(cx + 6, cy + 2); ctx.stroke();
  }
  // Byakugō active: the seal's black lines crawl over Tsunade, green regeneration chakra around her.
  function byakugoAura(ctx, z, st, time) {
    const K = Kit(), lift = bodyLift(z), a = Math.min(1, st.byak * 1.5), fy = z.y - lift, top = fy - 74;
    ctx.globalCompositeOperation = 'lighter';
    K.glow(ctx, z.x, fy - 38, 66, '140,255,160', .3 * a);
    K.glow(ctx, z.x + 4, top + 10, 12, '190,140,255', .9 * a, true);
    for (let i = 0; i < 6; i++) { const ph = (time * .9 + i / 6) % 1; K.glow(ctx, z.x + Math.sin(i * 2.7 + time) * 26, fy - 10 - ph * 70, 6, '170,255,180', bell(ph) * a); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(16,10,20,${.55 * a})`; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x0 = z.x - 8 + i * 3.2, side = i < 3 ? -1 : 1;
      ctx.moveTo(x0, top + 14); ctx.lineTo(x0 + side * 4, top + 24); ctx.lineTo(x0 + side * 2, top + 34); ctx.lineTo(x0 + side * 7, top + 46); ctx.lineTo(x0 + side * 5, top + 58);
    }
    ctx.stroke();
  }
  // Ash flaking off an Edo Tensei body.
  function edoFlakes(ctx, z, time) {
    const lift = bodyLift(z);
    ctx.fillStyle = 'rgba(46,38,44,.7)';
    for (let i = 0; i < 6; i++) {
      const ph = (time * .6 + i / 6) % 1;
      ctx.globalAlpha = bell(ph) * .8;
      ctx.save(); ctx.translate(z.x + Math.sin(i * 2.3 + time) * 16 + (i - 2.5) * 5, z.y - lift - 30 - ph * 60); ctx.rotate(time * 3 + i); ctx.fillRect(-2.5, -1.5, 5, 3); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // Hiraishin streaks: a line of yellow light along each jump and a fading afterimage at the start.
  function drawFlashes(ctx, z, st, time) {
    const K = Kit(), L = LIFT(), S = window.AnimeSprites;
    for (const f of st.fl) {
      const k = f.age / .55, a = 1 - k;
      if (S && k < .6) { ctx.save(); ctx.globalAlpha = (1 - k / .6) * .5; S.draw(ctx, f.id, f.x0, f.y0, { facing: f.x1 >= f.x0 ? 1 : -1, frame: 'run2', phase: 0 }); ctx.restore(); }
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      const tail = easeOut(k), x0 = lerp(f.x0, f.x1, tail), y0 = lerp(f.y0, f.y1, tail) - L;
      for (const [w, c] of [[26 * a, `rgba(${f.rgb},.25)`], [10 * a, `rgba(${f.rgb},.75)`], [3 * a + .5, 'rgba(255,255,245,1)']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(f.x1, f.y1 - L); ctx.stroke(); }
      if (k < .3) K.glow(ctx, f.x1, f.y1 - L, 70, f.rgb, 1 - k / .3, true);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function label(ctx, z, st, m) {
    if (!(st.windup > 0) || !st.move) return;
    const S = window.AnimeSprites, id = S && S.has && S.has(z.bossId) ? z.bossId : 'pain';
    const top = z.y - bodyLift(z) - (S && S.height ? S.height(id) : 100) - 34;
    ctx.save();
    ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(MOVES[st.move].label, z.x, top);
    ctx.fillStyle = m.accent; ctx.fillText(MOVES[st.move].label, z.x, top);
    ctx.restore();
  }

  // ------------------------------------------------------------------ draw entry points
  function draw(ctx, z, time) {
    const m = members[z.bossId], st = z.hk;
    if (!m || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[0]) { f[0](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (z.health > 0) {
      if (st.windup > 0 && st.move) {
        const k = 1 - st.windup / st.windMax, rgb = MOVES[st.move].rgb;
        for (const s of st.tele) teleShape(ctx, s, rgb, k, time);
        if (st.move === 'k_kamui') kamuiVortex(ctx, st.tx, st.ty - LIFT(), 50 + 110 * k, k * .8, time, 0);
      }
      if (st.jump) markCircle(ctx, st.jump.x1, st.jump.y1, 120, '160,255,170', clamp01(st.jump.t / st.jump.dur), time, true);
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = members[z.bossId], st = z.hk;
    if (!m || !st) return;
    ctx.save();
    for (const fx of st.fx) { const f = FX[fx.kind]; if (f && f[1]) { f[1](ctx, fx, time, z); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (st.fl.length) drawFlashes(ctx, z, st, time);
    if (z.health > 0) {
      if (m.edo) edoFlakes(ctx, z, time);
      if (st.cloak > 0) cloakAura(ctx, z, st, time);
      if (st.byak > 0) byakugoAura(ctx, z, st, time);
      if (st.windup > 0 && st.move) { chargeAura(ctx, z, st, m, time); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; label(ctx, z, st, m); }
    }
    ctx.restore();
  }

  window.HokageBosses = { members, order, moveLabels, pick, update, draw, drawOverlay, bodyLift };
})();
