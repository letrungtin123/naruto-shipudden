(() => {
  'use strict';

  // Canvas-native Akatsuki encounters. Every member has a full anime jutsu set (four jutsu + an
  // ultimate). Each cast is one plain-data effect on the boss (`z.ak.fx`) that carries its own
  // telegraph and its own visuals, plus scheduled hits (`z.ak.ev`). All state lives on the boss,
  // so switching waves or restarting never leaves timers behind in this module.
  const TAU = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
  const easeIn = t => { t = clamp01(t); return t * t; };
  const bell = t => Math.sin(Math.PI * clamp01(t));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const rand = (a, b) => a + Math.random() * (b - a);
  const K = () => window.VFXKit;

  const order = ['pain', 'itachi', 'kisame', 'deidara', 'sasori', 'kakuzu', 'konan', 'hidan'];
  // Cycle: four jutsu, the ultimate, the four again in a new order, the ultimate — every jutsu shows within ~30 s.
  const members = {
    pain:    { name: 'PAIN — THIÊN ĐẠO', accent: '#ca7bfb', hair: '#d87842', skin: '#d0a286', hpScale: 1.38, damageScale: 1.55, ability: 'Thần La Thiên Chinh',
      moves: ['rods', 'shinra', 'asura', 'bansho', 'chibaku', 'shinra', 'rods', 'bansho', 'asura', 'chibaku'] },
    itachi:  { name: 'ITACHI UCHIHA', accent: '#ff4c67', hair: '#101015', skin: '#c7a58e', hpScale: 1.18, damageScale: 1.45, ability: 'Thiên Chiếu',
      moves: ['amaterasu', 'crows', 'katon', 'tsukuyomi', 'susanoo', 'crows', 'amaterasu', 'tsukuyomi', 'katon', 'susanoo'] },
    kisame:  { name: 'KISAME HOSHIGAKI', accent: '#62c5f4', hair: '#253956', skin: '#7a9db1', hpScale: 1.5, damageScale: 1.28, ability: 'Thủy Độn',
      moves: ['sharks', 'suiro', 'samehada', 'daiko', 'sea', 'samehada', 'sharks', 'daiko', 'suiro', 'sea'] },
    deidara: { name: 'DEIDARA', accent: '#f8bf70', hair: '#e7ca71', skin: '#d8b49d', hpScale: 1.1, damageScale: 1.42, ability: 'Đất Sét Bộc Phá',
      moves: ['birds', 'c2', 'c3', 'c4', 'c0', 'c2', 'birds', 'c4', 'c3', 'c0'] },
    sasori:  { name: 'SASORI', accent: '#e18465', hair: '#a63b42', skin: '#c8a48d', hpScale: 1.2, damageScale: 1.3, ability: 'Khôi Lỗi Độc',
      moves: ['iron', 'puppets', 'poison', 'spikes', 'kaiho', 'puppets', 'iron', 'spikes', 'poison', 'kaiho'] },
    kakuzu:  { name: 'KAKUZU', accent: '#a8d390', hair: '#263c31', skin: '#807e70', hpScale: 1.47, damageScale: 1.52, ability: 'Ngũ Hành Mặt Nạ',
      moves: ['zukokku', 'jiongu', 'gian', 'atsugai', 'gotai', 'jiongu', 'zukokku', 'atsugai', 'gian', 'gotai'] },
    konan:   { name: 'KONAN', accent: '#d2b8ff', hair: '#5b5380', skin: '#ccb7ad', hpScale: 1.16, damageScale: 1.34, ability: 'Giấy Thiên Sứ',
      moves: ['shuriken', 'butterflies', 'wings', 'tornado', 'kami', 'butterflies', 'shuriken', 'tornado', 'wings', 'kami'] },
    hidan:   { name: 'HIDAN', accent: '#ff8093', hair: '#c7c8cf', skin: '#c6b3a4', hpScale: 1.35, damageScale: 1.5, ability: 'Nghi Lễ Tử Thần',
      moves: ['scythe', 'chain', 'jashin', 'blood', 'ritual', 'chain', 'scythe', 'blood', 'jashin', 'ritual'] }
  };

  // windup = time the boss stands still calling the jutsu; after = pause before the next one.
  const MOVES = {
    rods:      { label: 'HẮC BỔNG · THIÊN VŨ', rgb: '196,130,255', windup: .7, after: 1.9 },
    shinra:    { label: 'THẦN LA THIÊN CHINH', rgb: '205,150,255', windup: .95, after: 2.0 },
    asura:     { label: 'TU LA ĐẠO · PHI ĐẠN', rgb: '255,150,90', windup: .75, after: 1.9 },
    bansho:    { label: 'VẠN TƯỢNG THIÊN DẪN', rgb: '205,150,255', windup: .75, after: 2.0 },
    chibaku:   { label: 'ĐỊA BỘC THIÊN TINH', rgb: '190,120,255', windup: 1.0, after: 3.6, ult: true },
    amaterasu: { label: 'THIÊN CHIẾU', rgb: '220,40,70', windup: .7, after: 1.9 },
    crows:     { label: 'ẢO THUẬT · QUẠ ĐEN', rgb: '255,70,100', windup: .65, after: 1.9 },
    katon:     { label: 'HỎA ĐỘN · HÀO HỎA CẦU', rgb: '255,120,40', windup: .75, after: 2.0 },
    tsukuyomi: { label: 'NGUYỆT ĐỌC', rgb: '255,40,60', windup: .9, after: 2.4 },
    susanoo:   { label: 'SUSANOO · THẬP QUYỀN KIẾM', rgb: '255,100,70', windup: 1.15, after: 3.0, ult: true },
    sharks:    { label: 'THỦY ĐỘN · THỦY GIAO ĐẠN', rgb: '98,197,244', windup: .7, after: 1.8 },
    suiro:     { label: 'THỦY ĐỘN · THỦY LAO', rgb: '98,197,244', windup: .8, after: 2.2 },
    samehada:  { label: 'SAMEHADA · CUỒNG GIAO TRẢM', rgb: '120,210,255', windup: .65, after: 1.8 },
    daiko:     { label: 'THỦY ĐỘN · ĐẠI GIAO ĐẠN', rgb: '98,197,244', windup: .95, after: 2.2 },
    sea:       { label: 'ĐẠI BỘC THỦY XUNG BA', rgb: '80,180,255', windup: 1.25, after: 4.0, ult: true },
    birds:     { label: 'C1 · ĐIỂU BỘC', rgb: '255,200,120', windup: .6, after: 1.9 },
    c2:        { label: 'C2 · LONG BỘC', rgb: '255,190,110', windup: .8, after: 2.0 },
    c3:        { label: 'C3 · ĐẠI BỘC', rgb: '255,170,90', windup: .9, after: 2.4 },
    c4:        { label: 'C4 · CA LƯU LA', rgb: '235,225,255', windup: 1.0, after: 2.4 },
    c0:        { label: 'C0 · TỐI THƯỢNG NGHỆ THUẬT', rgb: '255,210,140', windup: 1.6, after: 3.6, ult: true },
    iron:      { label: 'SA THIẾT · THỜI VŨ', rgb: '170,150,200', windup: .7, after: 1.8 },
    puppets:   { label: 'XÍCH BÍ KỸ · BÁCH CƠ THAO DIỄN', rgb: '225,132,101', windup: .9, after: 2.0 },
    poison:    { label: 'ĐỘC VỤ KHÔI LỖI', rgb: '170,210,100', windup: .7, after: 2.0 },
    spikes:    { label: 'SA THIẾT · KẾT TÙNG', rgb: '170,150,200', windup: .65, after: 1.8 },
    kaiho:     { label: 'SA THIẾT · GIỚI PHÁP', rgb: '180,160,220', windup: 1.15, after: 3.2, ult: true },
    zukokku:   { label: 'HỎA ĐỘN · ĐẦU KHẮC KHỔ', rgb: '255,120,40', windup: .8, after: 2.0 },
    jiongu:    { label: 'ĐỊA OÁN NGU', rgb: '168,211,144', windup: .6, after: 1.8 },
    gian:      { label: 'LÔI ĐỘN · NGỤY ÁM', rgb: '130,180,255', windup: .7, after: 1.9 },
    atsugai:   { label: 'PHONG ĐỘN · ÁP HẠI', rgb: '170,240,200', windup: .75, after: 2.0 },
    gotai:     { label: 'NGŨ HÀNH HỢP KÍCH', rgb: '255,140,60', windup: 1.3, after: 3.4, ult: true },
    shuriken:  { label: 'THỨC GIẤY · PHI TIÊU BÃO', rgb: '210,184,255', windup: .6, after: 1.7 },
    butterflies: { label: 'GIẤY ĐIỆP BỘC', rgb: '210,184,255', windup: .6, after: 1.9 },
    wings:     { label: 'THIÊN SỨ GIẤY · THƯƠNG VŨ', rgb: '220,200,255', windup: .8, after: 2.0 },
    tornado:   { label: 'THỨC GIẤY · LỐC XOÁY', rgb: '210,184,255', windup: .7, after: 2.2 },
    kami:      { label: 'SÁU NGHÌN ỨC GIẤY BỘC', rgb: '255,150,110', windup: 1.5, after: 3.8, ult: true },
    scythe:    { label: 'TAM NGUYỆT LIÊM · HOÀNH TẢO', rgb: '255,90,110', windup: .6, after: 1.7 },
    chain:     { label: 'XÍCH LIÊM PHI TRẢM', rgb: '255,110,130', windup: .55, after: 1.7 },
    jashin:    { label: 'TÀ THẦN TRẬN', rgb: '220,30,60', windup: .8, after: 2.0 },
    blood:     { label: 'HUYẾT TẾ · TỰ THỨ', rgb: '230,40,70', windup: .7, after: 1.9 },
    ritual:    { label: 'NGHI LỄ TỬ THẦN · TÀ THẦN GIÁNG', rgb: '230,30,60', windup: 1.35, after: 3.4, ult: true }
  };
  const moveLabels = {};
  for (const k in MOVES) moveLabels[k] = MOVES[k].label;

  function pick(wave) {
    // The horde includes an Akatsuki leader on every wave from wave 2 onward.
    const index = Math.max(0, wave - 2);
    return order[index % order.length];
  }

  // ------------------------------------------------------------------ state & scheduling
  // Bake a member's art when it arrives so the first cast of each jutsu doesn't hitch.
  function warm(id) {
    const k = K();
    if (!k) return;
    ['fire', 'smoke', 'dust', 'water', 'steam', 'poof', 'violet'].forEach(p => k.puff(p));
    const W = {
      pain: () => { rockSpr(0); rockSpr(1); rockSpr(2); ballSpr(); },
      itachi: () => { crowSpr(0); crowSpr(1); for (let i = 0; i < 6; i++) { k.flame(i, AMA, 'ama'); k.flame(i); } },
      kisame: () => { sharkSpr(); causticSpr(); waterSphere(); },
      deidara: () => { birdSpr(0); birdSpr(1); dragonSpr(); c3Spr(); },
      sasori: () => { puppetSpr(0); puppetSpr(1); spikeSpr(0); poisonPuff(); ironSphere(); },
      kakuzu: () => { for (let i = 0; i < 5; i++) maskSpr(i); k.swirl('akfire', ['#ff8a2a', '#ffd060', '#e8401a', '#ff6a1a'], 10, 1.3, .08, 256, 4); },
      konan: () => { flySpr(); shuSpr(); wingSpr(); },
      hidan: () => { sigilSpr(); scytheSpr(); spikeSpr(1); }
    }[id];
    if (W) W();
  }
  function S(z) {
    if (!z.ak) warm(z.bossId);
    return z.ak || (z.ak = { casts: 0, timer: 1.0 + (z.id % 3) * .25, move: '', windup: 0, windMax: 1, aim: 0, tx: z.x, ty: z.y,
      ev: [], fx: [], guard: 0, guardK: 1, dash: 0, dashA: 0, dashV: 0, hold: 0, lastDraw: 0 });
  }
  function addFx(s, f) {
    f.age = 0; f.seed = Math.random() * 97;
    if (s.fx.length >= 14) s.fx.shift();
    s.fx.push(f);
    return f;
  }
  function findFx(s, k) { for (let i = s.fx.length - 1; i >= 0; i--) if (s.fx[i].k === k) return s.fx[i]; return null; }
  function ev(s, t, op, o) { o.t = t; o.op = op; if (s.ev.length < 140) s.ev.push(o); return o; }
  const hit = (s, t, x, y, r, dmg, kind) => ev(s, t, 'strike', { x, y, r, dmg, kind: kind || null });
  const lineHit = (s, t, x1, y1, x2, y2, w, dmg, kind) => ev(s, t, 'line', { x1, y1, x2, y2, w, dmg, kind: kind || null });
  // Cover a cone with strike circles that land as the wave passes (same geometry as the telegraph).
  function coneHits(s, x, y, a, reach, half, dmg, delay, speed, kind) {
    let n = 0;
    for (let d = 70; d <= reach; d += 90) {
      const cnt = Math.max(1, Math.ceil(2 * half * d / 130)), r = Math.max(52, (2 * half * d / cnt) * .62);
      for (let i = 0; i < cnt; i++) {
        const aa = a + (cnt === 1 ? 0 : (i / (cnt - 1) - .5) * 2 * half * .88);
        hit(s, delay + d / speed, x + Math.cos(aa) * d, y + Math.sin(aa) * d, r, dmg, n % 4 === 0 ? kind : null);
        n++;
      }
    }
  }
  // n points scattered over a disc, the first few right on the target.
  function scatter(x, y, r, n, onTarget) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const an = Math.random() * TAU, d = i < onTarget ? rand(0, 45) : r * (.2 + .8 * Math.sqrt(Math.random()));
      out.push({ x: x + Math.cos(an) * d, y: y + Math.sin(an) * d });
    }
    return out;
  }

  // ------------------------------------------------------------------ jutsu setup (called when the boss starts calling it)
  function start(z, s, api, move) {
    const D = api.damage || 60, w = s.windMax, a = s.aim, px = s.tx, py = s.ty, zx = z.x, zy = z.y;
    const ca = Math.cos(a), sa = Math.sin(a);
    switch (move) {
      // ============================== PAIN
      case 'rods': {
        const f = addFx(s, { k: 'rods', x: px, y: py, w, dur: w + 4.4, d: [] });
        scatter(px, py, 410, 16, 3).forEach((p, i) => {
          const t = w + .2 + i * .08;
          f.d.push({ x: p.x, y: p.y, t, l: rand(.15, .5) * (Math.random() < .5 ? -1 : 1) });
          hit(s, t, p.x, p.y, 52, D * 1.05, i % 4 === 0 ? 'crater' : null);
        });
        ev(s, w + .25, 'shake', { n: 8 });
        break;
      }
      case 'shinra':
        addFx(s, { k: 'shinra', x: zx, y: zy, r: 400, w, dur: w + 1.7 });
        ev(s, w, 'knock', { x: zx, y: zy, r: 400, d: 280, dmg: D * 2.5 });
        ev(s, w, 'world', { x: zx, y: zy, r: 400, p: D * 3, kind: 'shockwave' });
        ev(s, w, 'shake', { n: 18 });
        break;
      case 'bansho':
        addFx(s, { k: 'bansho', x: zx, y: zy, r: 175, w, dur: w + 1.3 });
        ev(s, w, 'pull', { x: zx, y: zy, r: 900, dmg: D * .45 });
        hit(s, w + .62, zx, zy, 175, D * 2.0, 'shockwave');
        ev(s, w + .62, 'shake', { n: 13 });
        break;
      case 'asura': {
        const f = addFx(s, { k: 'asura', x: zx, y: zy, w, dur: w + 2.5, ms: [] });
        scatter(px, py, 300, 9, 1).forEach((p, i) => {
          const t = w + .85 + i * .09;
          f.ms.push({ x: p.x, y: p.y, t });
          hit(s, t, p.x, p.y, 96, D * 1.25, i % 2 ? null : 'fire');
          if (i % 3 === 0) ev(s, t, 'shake', { n: 9 });
        });
        break;
      }
      case 'chibaku': {
        const T = w + 2.1;
        addFx(s, { k: 'chibaku', x: px, y: py, r: 420, x0: zx, y0: zy, w, T, dur: T + 3.2 });
        ev(s, w + .3, 'shake', { n: 6 });
        ev(s, w + .6, 'knock', { x: px, y: py, r: 560, d: -60, dmg: 0 });
        ev(s, w + 1.15, 'knock', { x: px, y: py, r: 560, d: -60, dmg: 0 });
        hit(s, T, px, py, 420, D * 3.8, 'crater');
        for (let i = 0; i < 4; i++) ev(s, T, 'world', { x: px + Math.cos(i * 1.57 + .7) * 240, y: py + Math.sin(i * 1.57 + .7) * 240, r: 200, p: D * 4, kind: 'earth' });
        ev(s, T, 'shake', { n: 24 });
        break;
      }
      // ============================== ITACHI
      case 'amaterasu': {
        const T = w + .2, sat = [];
        for (let i = 0; i < 4; i++) {
          const an = Math.random() * TAU, d = rand(190, 270);
          sat.push({ x: px + Math.cos(an) * d, y: py + Math.sin(an) * d, r: 92, t: T + .35 + i * .12 });
        }
        const pts = [{ x: px, y: py, r: 150 }].concat(sat.map(p => ({ x: p.x, y: p.y, r: p.r })));
        addFx(s, { k: 'ama', x: px, y: py, r: 150, w, T, dur: T + 5.2, sat, hz: { pts, dmg: D * .34, every: .45, tk: .45, from: T + .6, to: T + 5 } });
        hit(s, T, px, py, 150, D * 1.9, 'fire');
        sat.forEach((p, i) => hit(s, p.t, p.x, p.y, p.r, D * 1.0, i === 0 ? 'fire' : null));
        ev(s, T, 'shake', { n: 10 });
        break;
      }
      case 'crows':
        addFx(s, { k: 'crows', x: zx, y: zy, a, reach: 740, half: .55, w, dur: w + 1.5 });
        coneHits(s, zx, zy, a, 740, .55, D * 1.0, w, 950, null);
        break;
      case 'katon': {
        const len = 820, sp = 950, T = w + len / sp, ex = zx + ca * len, ey = zy + sa * len;
        addFx(s, { k: 'goka', x: zx, y: zy, a, len, r: 200, sp, w, T, dur: T + 3,
          hz: { pts: [{ x: ex, y: ey, r: 160 }], dmg: D * .3, every: .5, tk: .5, from: T + .4, to: T + 2.7 } });
        let n = 0;
        for (let d = 90; d <= len - 80; d += 140) hit(s, w + d / sp, zx + ca * d, zy + sa * d, 88, D * 1.2, n++ % 2 ? null : 'fire');
        hit(s, T, ex, ey, 200, D * 2.3, 'fire');
        ev(s, T, 'shake', { n: 15 });
        break;
      }
      case 'tsukuyomi':
        addFx(s, { k: 'tsuku', x: px, y: py, r: 340, w, dur: w + 2.7, hz: { r: 340, dmg: D * .58, every: .5, tk: 0, from: w, to: w + 2.1 } });
        ev(s, w, 'shake', { n: 8 });
        break;
      case 'susanoo': {
        addFx(s, { k: 'sus', x: zx, y: zy, a, len: 960, reach: 540, half: 1.25, w, dur: w + 2.7 });
        lineHit(s, w, zx, zy, zx + ca * 960, zy + sa * 960, 95, D * 3.2, 'blade');
        coneHits(s, zx, zy, a, 540, 1.25, D * 1.7, w + .55, 5000, 'blade');
        ev(s, w, 'guard', { d: 3, k: .35 });
        ev(s, w, 'shake', { n: 17 }); ev(s, w + .55, 'shake', { n: 12 });
        break;
      }
      // ============================== KISAME
      case 'sharks': {
        const f = addFx(s, { k: 'sharks', x: zx, y: zy, a, w, dur: w + 1.6, mv: [] });
        for (let i = 0; i < 5; i++) {
          const an = a + (i - 2) * .15;
          f.mv.push({ x: zx + Math.cos(an) * 30, y: zy + Math.sin(an) * 30, vx: Math.cos(an) * 1050, vy: Math.sin(an) * 1050,
            d: w + Math.abs(i - 2) * .06, l: .85, r: 46, dmg: D * 1.15, p: 1, cd: 0, e: -1 });
        }
        break;
      }
      case 'daiko': {
        const len = 920, sp = 760, T = w + len / sp, ex = zx + ca * len, ey = zy + sa * len;
        addFx(s, { k: 'daiko', x: zx, y: zy, a, len, sp, w, T, dur: T + 1.7 });
        let n = 0;
        for (let d = 110; d <= len - 60; d += 150) hit(s, w + d / sp, zx + ca * d, zy + sa * d, 115, D * 1.8, n++ % 2 ? null : 'vortex');
        hit(s, T, ex, ey, 240, D * 2.4, 'vortex');
        ev(s, T + .01, 'knock', { x: ex, y: ey, r: 280, d: 150, dmg: 0 });
        ev(s, T, 'shake', { n: 16 });
        break;
      }
      case 'suiro':
        addFx(s, { k: 'suiro', x: px, y: py, r: 220, w, dur: w + 2.7, hz: { r: 220, dmg: D * .42, every: .4, tk: .4, from: w + .1, to: w + 2.2 } });
        hit(s, w, px, py, 220, D * 1.3, 'vortex');
        ev(s, w + 2.2, 'shake', { n: 8 });
        break;
      case 'samehada': {
        const p = api.player, len = Math.min(600, Math.max(260, p ? Math.hypot(p.x - zx, p.y - zy) + 60 : 420));
        const ex = zx + ca * len, ey = zy + sa * len;
        addFx(s, { k: 'same', x: zx, y: zy, a, len, w, dur: w + 1.1 });
        ev(s, w, 'dash', { a, v: len / .28, dur: .28 });
        lineHit(s, w + .14, zx, zy, ex, ey, 70, D * 1.6, 'blade');
        hit(s, w + .3, ex, ey, 200, D * 1.9, 'blade');
        ev(s, w + .3, 'heal', { k: .03 });
        ev(s, w + .3, 'shake', { n: 12 });
        break;
      }
      case 'sea':
        addFx(s, { k: 'sea', x: zx, y: zy, r: 820, w, sp: 820 / 1.3, dmg: D * 2.3, dur: w + 5.6, hf: 0, wt: 0, bites: [],
          hz: { r: 820, dmg: D * .22, every: .6, tk: .6, from: w + 1.3, to: w + 5.1 } });
        for (let i = 0; i < 5; i++) ev(s, w + 1.5 + i * .55, 'bite', { dmg: D * 1.15 });
        ev(s, w, 'shake', { n: 14 }); ev(s, w + .7, 'shake', { n: 18 });
        break;
      // ============================== DEIDARA
      case 'birds': {
        const f = addFx(s, { k: 'birds', x: zx, y: zy, w, dmg: D * 1.25, dur: w + 3.6, b: [] });
        for (let i = 0; i < 7; i++) f.b.push({ x: zx, y: zy, a: a + (i - 3) * .42, e: -1 });
        break;
      }
      case 'c2': {
        const sp = 720, back = 350, f = addFx(s, { k: 'c2', x: zx - ca * back, y: zy - sa * back, a, sp, w, dur: w + 3.4, bombs: [] });
        for (let i = 0; i < 8; i++) {
          const d = 200 + i * 120, x = zx + ca * d + (Math.random() - .5) * 50, y = zy + sa * d + (Math.random() - .5) * 50;
          const t = w + (d + back) / sp + .45;
          f.bombs.push({ x, y, t });
          hit(s, t, x, y, 112, D * 1.45, i % 2 ? null : 'fire');
          if (i % 2 === 0) ev(s, t, 'shake', { n: 9 });
        }
        break;
      }
      case 'c3': {
        const T = w + 1.15;
        addFx(s, { k: 'c3', x: px, y: py, r: 330, x0: zx, y0: zy, w, T, dur: T + 2.8 });
        hit(s, T, px, py, 330, D * 3.0, 'fire');
        ev(s, T, 'world', { x: px, y: py, r: 330, p: D * 5, kind: 'crater' });
        ev(s, T, 'shake', { n: 22 });
        break;
      }
      case 'c4':
        addFx(s, { k: 'c4', x: px, y: py, r: 380, w, dur: w + 2.9, hz: { r: 380, dmg: D * .38, every: .35, tk: .15, from: w + .15, to: w + 2.5 } });
        ev(s, w, 'shake', { n: 6 });
        break;
      case 'c0':
        addFx(s, { k: 'c0', x: zx, y: zy, r: 650, w, dur: w + 2.9 });
        hit(s, w, zx, zy, 650, D * 4.0, 'fire');
        ev(s, w + .01, 'knock', { x: zx, y: zy, r: 650, d: 220, dmg: 0 });
        for (let i = 0; i < 6; i++) ev(s, w, 'world', { x: zx + Math.cos(i * 1.047) * 330, y: zy + Math.sin(i * 1.047) * 330, r: 220, p: D * 5, kind: 'crater' });
        ev(s, w, 'shake', { n: 26 });
        break;
      // ============================== SASORI
      case 'iron': {
        const f = addFx(s, { k: 'iron', x: px, y: py, w, dur: w + 3.6, d: [] });
        scatter(px, py, 390, 16, 3).forEach((p, i) => {
          const t = w + .1 + i * .065;
          f.d.push({ x: p.x, y: p.y, t });
          hit(s, t, p.x, p.y, 56, D * .95, i % 5 === 0 ? 'earth' : null);
        });
        ev(s, w + .2, 'shake', { n: 7 });
        break;
      }
      case 'puppets': {
        const f = addFx(s, { k: 'pup', x: px, y: py, r: 330, w, dur: w + 1.7, ps: [] });
        for (let i = 0; i < 12; i++) {
          const an = i * TAU / 12 + rand(-.1, .1), x = px + Math.cos(an) * 330, y = py + Math.sin(an) * 330;
          f.ps.push({ x, y, an });
          lineHit(s, w + i * .05, x, y, px, py, 34, D * .6, null);
        }
        hit(s, w + .55, px, py, 130, D * 1.6, 'blade');
        ev(s, w + .55, 'shake', { n: 11 });
        break;
      }
      case 'poison': {
        const pts = [];
        for (const [d, offs, r] of [[150, [0], 110], [320, [-.25, .25], 120], [500, [-.32, 0, .32], 125]])
          for (const o of offs) pts.push({ x: zx + Math.cos(a + o) * d, y: zy + Math.sin(a + o) * d, r });
        addFx(s, { k: 'poison', x: zx, y: zy, a, reach: 600, half: .55, w, dur: w + 4.5, pts,
          hz: { pts, dmg: D * .32, every: .5, tk: .5, from: w + .3, to: w + 4.2 } });
        coneHits(s, zx, zy, a, 600, .55, D * 1.2, w, 1100, null);
        break;
      }
      case 'spikes': {
        const len = 900, sp = 1400;
        addFx(s, { k: 'spk', x: zx, y: zy, a, len, sp, w, dur: w + 2.5 });
        for (let i = 0; i < 10; i++) {
          const d = 90 + i * 90;
          hit(s, w + d / sp, zx + ca * d, zy + sa * d, 80, D * 1.35, i % 2 ? null : 'earth');
        }
        ev(s, w + .2, 'shake', { n: 9 });
        break;
      }
      case 'kaiho': {
        const T = w + .95;
        addFx(s, { k: 'kaiho', x: px, y: py, r: 430, x0: zx, y0: zy, w, T, dur: T + 2.4 });
        hit(s, T, px, py, 430, D * 3.4, 'earth');
        for (let i = 0; i < 6; i++) ev(s, T, 'world', { x: px + Math.cos(i * 1.047 + .3) * 260, y: py + Math.sin(i * 1.047 + .3) * 260, r: 170, p: D * 4, kind: 'earth' });
        ev(s, T, 'shake', { n: 20 });
        break;
      }
      // ============================== KAKUZU
      case 'zukokku': {
        const T = w + .45;
        addFx(s, { k: 'zuk', x: px, y: py, r: 260, x0: zx, y0: zy, w, T, dur: T + 2.9,
          hz: { r: 200, dmg: D * .25, every: .5, tk: .5, from: T + .4, to: T + 2.6 } });
        hit(s, T, px, py, 260, D * 2.4, 'fire');
        ev(s, T, 'shake', { n: 16 });
        break;
      }
      case 'atsugai':
        addFx(s, { k: 'atsu', x: zx, y: zy, a, reach: 680, half: .6, w, dur: w + 1.3 });
        coneHits(s, zx, zy, a, 680, .6, D * 1.8, w, 1500, 'vortex');
        ev(s, w + .5, 'knockcone', { x: zx, y: zy, a, half: .6, r: 690, d: 170 });
        ev(s, w, 'shake', { n: 12 });
        break;
      case 'gian':
        addFx(s, { k: 'gian', x: zx, y: zy, a, len: 960, w, dur: w + .85 });
        lineHit(s, w, zx, zy, zx + ca * 960, zy + sa * 960, 60, D * 2.3, 'lightning');
        ev(s, w, 'shake', { n: 12 });
        break;
      case 'jiongu': {
        const tg = [{ x: px, y: py }];
        for (let i = 0; i < 4; i++) { const an = a + Math.PI / 2 + i * Math.PI / 2 + rand(-.3, .3); tg.push({ x: px + Math.cos(an) * 150, y: py + Math.sin(an) * 150 }); }
        addFx(s, { k: 'jio', x: zx, y: zy, w, dur: w + 1.4, tg });
        tg.forEach((p, i) => lineHit(s, w + i * .07, zx, zy, p.x, p.y, 36, D * 1.05, i === 0 ? 'blade' : null));
        ev(s, w, 'guard', { d: 3.2, k: .5 });
        break;
      }
      case 'gotai': {
        const bolts = scatter(px, py, 380, 6, 1).map((p, i) => ({ x: p.x, y: p.y, t: w + .25 + i * .17 }));
        addFx(s, { k: 'gotai', x: px, y: py, r: 400, x0: zx, y0: zy, w, dur: w + 3.3, bolts,
          hz: { r: 400, dmg: D * .5, every: .45, tk: .45, from: w + .15, to: w + 1.6 } });
        hit(s, w, px, py, 400, D * 2.2, 'fire');
        bolts.forEach(b => hit(s, b.t, b.x, b.y, 95, D * 1.2, 'lightning'));
        ev(s, w, 'shake', { n: 18 });
        break;
      }
      // ============================== KONAN
      case 'shuriken': {
        const f = addFx(s, { k: 'shu', x: zx, y: zy, a, w, dur: w + 1.5, mv: [] });
        for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) {
          const an = a + (i / 8 - .5) * 1.3 + (j % 2) * .07;
          f.mv.push({ x: zx + Math.cos(an) * 24, y: zy + Math.sin(an) * 24, vx: Math.cos(an) * 900, vy: Math.sin(an) * 900,
            d: w + j * .16, l: .85, r: 22, dmg: D * .62, p: 0, cd: 0, e: -1 });
        }
        break;
      }
      case 'wings':
        addFx(s, { k: 'wing', x: zx, y: zy, a, reach: 740, half: .7, w, dur: w + 1.5 });
        coneHits(s, zx, zy, a, 740, .7, D * 1.8, w, 1600, 'blade');
        ev(s, w, 'shake', { n: 10 });
        break;
      case 'butterflies': {
        const bs = [{ x: px, y: py }];
        const base = Math.random() * TAU;
        for (let i = 0; i < 8; i++) { const an = base + i * TAU / 8, d = rand(150, 260); bs.push({ x: px + Math.cos(an) * d, y: py + Math.sin(an) * d }); }
        bs.forEach((b, i) => { b.t = w + .6 + i * .06; hit(s, b.t, b.x, b.y, 90, D * 1.15, i % 3 ? null : 'fire'); });
        addFx(s, { k: 'fly', x: zx, y: zy, w, dur: w + 2.0, bs });
        ev(s, w + .7, 'shake', { n: 9 });
        break;
      }
      case 'tornado':
        addFx(s, { k: 'torn', x: px, y: py, r: 160, w, dur: w + 3.3, hz: { r: 160, dmg: D * .5, every: .4, tk: .05, from: w, to: w + 3.0 } });
        break;
      case 'kami': {
        const radii = [0, 165, 330, 495, 660, 820], rings = [];
        radii.forEach((R, j) => {
          const n = R ? Math.round(TAU * R / 185) : 1, t = w + j * .18;
          rings.push({ R, n, t });
          for (let i = 0; i < n; i++) {
            const an = i * TAU / n + j * .37;
            hit(s, t, zx + Math.cos(an) * R, zy + Math.sin(an) * R, 125, D * 2.4, i % 4 === 0 ? 'fire' : null);
          }
          ev(s, t, 'shake', { n: 10 + j * 2 });
        });
        addFx(s, { k: 'kami', x: zx, y: zy, r: 820, w, dur: w + 2.9, rings });
        break;
      }
      // ============================== HIDAN
      case 'scythe':
        addFx(s, { k: 'scy', x: zx, y: zy, a, r: 330, half: 1.45, w, dur: w + 1.1 });
        coneHits(s, zx, zy, a, 330, 1.45, D * 1.5, w, 6000, 'blade');
        coneHits(s, zx, zy, a, 330, 1.45, D * 1.5, w + .42, 6000, null);
        ev(s, w, 'shake', { n: 9 }); ev(s, w + .42, 'shake', { n: 11 });
        break;
      case 'chain': {
        const len = 840;
        addFx(s, { k: 'chain', x: zx, y: zy, a, len, w, dur: w + 1.15 });
        for (let d = 100; d <= len; d += 105) {
          hit(s, w + (d / len) * .42, zx + ca * d, zy + sa * d, 58, D * 1.45, d === 100 ? 'blade' : null);
          hit(s, w + .5 + (1 - d / len) * .42, zx + ca * d, zy + sa * d, 58, D * .8, null);
        }
        break;
      }
      case 'jashin':
        addFx(s, { k: 'jas', x: zx, y: zy, r: 270, w, dur: w + 4.6, hz: { r: 270, dmg: D * .42, every: .5, tk: .25, from: w, to: w + 4.4 } });
        ev(s, w, 'guard', { d: 4.4, k: .5 });
        for (let i = 1; i <= 4; i++) ev(s, w + i, 'heal', { k: .015 });
        break;
      case 'blood': {
        const rings = [{ R: 150, n: 7 }, { R: 285, n: 11 }, { R: 420, n: 15 }];
        rings.forEach((g, j) => {
          g.t = w + j * .2;
          for (let i = 0; i < g.n; i++) {
            const an = i * TAU / g.n + j * .4;
            hit(s, g.t, zx + Math.cos(an) * g.R, zy + Math.sin(an) * g.R, 74, D * 1.4, i % 3 === 0 ? 'blade' : null);
          }
          ev(s, g.t, 'shake', { n: 8 + j * 2 });
        });
        addFx(s, { k: 'blood', x: zx, y: zy, w, dur: w + 1.8, rings });
        ev(s, w, 'heal', { k: .08 });
        break;
      }
      case 'ritual':
        addFx(s, { k: 'rit', x: px, y: py, r: 470, w, dur: w + 2.6 });
        hit(s, w, px, py, 470, D * 3.6, 'crater');
        for (let j = 0; j < 4; j++) {
          const an = j * Math.PI / 4 + .2;
          lineHit(s, w + .35, px - Math.cos(an) * 470, py - Math.sin(an) * 470, px + Math.cos(an) * 470, py + Math.sin(an) * 470, 50, D * 1.2, j === 0 ? 'blade' : null);
        }
        ev(s, w, 'heal', { k: .05 });
        ev(s, w, 'shake', { n: 22 }); ev(s, w + .35, 'shake', { n: 12 });
        break;
    }
  }

  // ------------------------------------------------------------------ update
  function runEvent(z, s, api, e) {
    switch (e.op) {
      case 'strike': api.strike(e.x, e.y, e.r, e.dmg, null, e.kind, true); break;
      case 'line': api.line(e.x1, e.y1, e.x2, e.y2, e.w, e.dmg, e.kind); break;
      case 'knock': api.knockback({ x: e.x, y: e.y }, e.r, e.d, e.dmg || 0); break;
      case 'pull': {
        // Banshō Ten'in: drag the target across the field into Pain's reach.
        const p = api.player;
        if (!p) break;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < e.r && d > 95) api.knockback({ x: e.x, y: e.y }, e.r, -(d - 85), e.dmg);
        break;
      }
      case 'knockcone': {
        const p = api.player;
        if (!p) break;
        const d = Math.hypot(p.x - e.x, p.y - e.y), an = Math.atan2(p.y - e.y, p.x - e.x);
        if (d < e.r && Math.abs(Math.atan2(Math.sin(an - e.a), Math.cos(an - e.a))) < e.half + .1) api.knockback({ x: e.x, y: e.y }, e.r, e.d, 0);
        break;
      }
      case 'shake': api.shake(e.n); break;
      case 'world': api.world(e.x, e.y, e.r, e.p, e.kind); break;
      case 'heal': z.health = Math.min(z.maxHealth, z.health + z.maxHealth * e.k); break;
      case 'guard': s.guard = e.d; s.guardK = e.k; break;
      case 'dash': s.dash = e.dur; s.dashA = e.a; s.dashV = e.v; break;
      case 'bite': {
        // Senshokuzame: sharks surface under the target wherever they stand in the flood.
        const f = findFx(s, 'sea'), p = api.player;
        if (!f || !p || f.bites.length > 7) break;
        const x = p.x + rand(-40, 40), y = p.y + rand(-40, 40);
        if (Math.hypot(x - f.x, y - f.y) > f.r) break;
        f.bites.push({ x, y, t: f.age + .7 });
        hit(s, .7, x, y, 85, e.dmg, 'vortex');
        break;
      }
    }
  }

  function tickFx(z, s, f, dt, api) {
    const hz = f.hz;
    if (hz && f.age >= hz.from && f.age <= hz.to && (hz.tk -= dt) <= 0) {
      hz.tk += hz.every;
      if (hz.pts) for (const p of hz.pts) api.strike(p.x, p.y, p.r, hz.dmg, null, null, true);
      else api.strike(f.x, f.y, hz.r, hz.dmg, null, null, true);
    }
    if (f.mv) {
      const p = api.player;
      for (const m of f.mv) {
        if (m.l <= 0 || f.age < m.d) continue;
        m.x += m.vx * dt; m.y += m.vy * dt; m.l -= dt; m.cd -= dt;
        if (m.l <= 0) { m.e = f.age; continue; }
        if (p && m.cd <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + (p.r || 13)) {
          api.strike(m.x, m.y, m.r, m.dmg, null, null, true);
          if (m.p) m.cd = .45; else { m.l = 0; m.e = f.age; }
        }
      }
    }
    switch (f.k) {
      case 'birds': {
        if (f.age < f.w) break;
        const p = api.player;
        for (let i = 0; i < f.b.length; i++) {
          const b = f.b[i];
          if (b.e >= 0) continue;
          if (p) {
            const da = Math.atan2(p.y - b.y, p.x - b.x) - b.a, turn = 3.1 * dt;
            b.a += Math.max(-turn, Math.min(turn, Math.atan2(Math.sin(da), Math.cos(da))));
          }
          const sp = 320 + Math.min(1, f.age - f.w) * 160;
          b.x += Math.cos(b.a) * sp * dt; b.y += Math.sin(b.a) * sp * dt;
          if ((p && Math.hypot(p.x - b.x, p.y - b.y) < 58) || f.age > f.w + 2.4 + i * .08) {
            b.e = f.age;
            api.strike(b.x, b.y, 100, f.dmg, null, i % 2 ? null : 'fire', true);
            api.shake(7);
          }
        }
        break;
      }
      case 'torn':
        if (f.age > f.w && f.age < f.w + 3) {
          const p = api.player;
          if (p) { const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, 165 * dt); f.x += dx / d * st; f.y += dy / d * st; }
        }
        break;
      case 'sea':
        if (f.age > f.w && f.age < f.w + 1.35) {
          // the wave front of the flood hits once as it rolls over the target, smashing what it passes
          const front = (f.age - f.w) * f.sp, p = api.player;
          if (p && !f.hf) {
            const d = Math.hypot(p.x - f.x, p.y - f.y);
            if (d < f.r + 10 && Math.abs(d - front) < 75) { f.hf = 1; api.strike(p.x, p.y, 8, f.dmg, null, null, true); }
          }
          if ((f.wt -= dt) <= 0) {
            f.wt = .22;
            const off = Math.random() * TAU;
            for (let i = 0; i < 4; i++) api.world(f.x + Math.cos(off + i * 1.571) * front, f.y + Math.sin(off + i * 1.571) * front, 90, f.dmg, 'vortex');
          }
        }
        break;
    }
  }

  function announce(z, s, m, api) {
    const move = m.moves[s.casts % m.moves.length], def = MOVES[move], p = api.player;
    s.casts++;
    s.move = move; s.windup = s.windMax = def.windup;
    s.aim = p ? Math.atan2(p.y - z.y, p.x - z.x) : (z.angle || 0);
    s.tx = p ? p.x : z.x; s.ty = p ? p.y : z.y;
    start(z, s, api, move);
  }

  function update(z, dt, api) {
    const m = z && members[z.bossId];
    if (!m || !window.VFXKit) return;
    const s = S(z);
    for (let i = s.fx.length - 1; i >= 0; i--) {
      const f = s.fx[i];
      f.age += dt;
      if (z.health > 0) tickFx(z, s, f, dt, api);
      if (f.age >= f.dur) s.fx.splice(i, 1);
    }
    if (z.health <= 0) { z.akatsukiWindup = 0; s.windup = 0; s.move = ''; s.ev.length = 0; return; }
    for (let i = 0; i < s.ev.length; i++) {
      const e = s.ev[i];
      if ((e.t -= dt) <= 0) { s.ev.splice(i--, 1); runEvent(z, s, api, e); }
    }
    s.guard = Math.max(0, s.guard - dt);
    z.armorScale = s.guard > 0 ? s.guardK : 1;
    s.hold = Math.max(0, s.hold - dt);
    if (s.dash > 0) { s.dash -= dt; api.move(Math.cos(s.dashA) * s.dashV * dt, Math.sin(s.dashA) * s.dashV * dt); }
    const p = api.player;
    if (s.windup > 0) {
      if (s.move === 'bansho' && p) { s.tx = p.x; s.ty = p.y; }
      s.windup = Math.max(0, s.windup - dt);
      if (s.windup === 0) {
        s.timer = MOVES[s.move].after * rand(.9, 1.1) * (z.health < z.maxHealth * .5 ? .8 : 1);
        s.hold = .35; s.move = '';
      }
    } else {
      s.timer -= dt;
      if (s.timer <= 0 && p && Math.hypot(z.x - p.x, z.y - p.y) < 860) announce(z, s, m, api);
    }
    z.akatsukiWindup = s.windup;
    z.akatsukiSkill = s.move;
    // Frozen while calling a jutsu (so the telegraph stays honest), slowed just after.
    z.speedScale = s.windup > 0 ? .01 : s.hold > 0 ? .4 : 1;
  }

  // ------------------------------------------------------------------ cached art
  const Spr = (key, w, h, paint) => K().sprite('ak:' + key, w, h, paint);
  function polyRock(g, x, y, r, seed, fill, dark) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = i / 8 * TAU, rr = r * (.75 + hash(seed + i) * .3);
      const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * .85;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1.5, r * .1); g.strokeStyle = dark; g.stroke();
  }
  function rockSpr(v) {
    return Spr('rock' + v, 64, 64, g => {
      polyRock(g, 32, 32, 26, v * 9.3, '#54473e', '#1d1714');
      g.fillStyle = '#7a6858'; g.beginPath(); g.ellipse(26, 24, 11, 7, -.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,14,12,.5)'; g.beginPath(); g.ellipse(38, 40, 10, 6, .3, 0, TAU); g.fill();
    });
  }
  function ballSpr() {
    return Spr('ball', 256, 256, g => {
      const c = 128, R = 120;
      g.fillStyle = '#2b231f'; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(c, c, R, 0, TAU); g.clip();
      for (let i = 0; i < 60; i++) {
        const x = c + (hash(i * 3.1) - .5) * 2.1 * R, y = c + (hash(i * 7.7) - .5) * 2.1 * R, s = 14 + hash(i * 1.3) * 24;
        const tone = 60 + hash(i * 2.9) * 50 | 0;
        polyRock(g, x, y, s, i * 4.1, `rgb(${tone + 14},${tone},${tone - 10})`, '#1a1310');
      }
      const gr = g.createRadialGradient(c - 44, c - 50, 8, c, c, R);
      gr.addColorStop(0, 'rgba(255,236,210,.22)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,0,20,.7)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.restore();
      g.lineWidth = 4; g.strokeStyle = '#120d0b'; g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke();
    });
  }
  function crowSpr(fr) {
    return Spr('crow' + fr, 48, 40, g => {
      g.translate(24, 22);
      g.fillStyle = '#0c0a10';
      g.beginPath(); g.ellipse(0, 0, 11, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-8, -1); g.lineTo(-21, -6); g.lineTo(-18, 0); g.lineTo(-21, 5); g.closePath(); g.fill();
      g.beginPath(); g.arc(10, -2, 4.6, 0, TAU); g.fill();
      g.fillStyle = '#3a3230'; g.beginPath(); g.moveTo(13, -3.5); g.lineTo(21, -1); g.lineTo(13, .5); g.closePath(); g.fill();
      g.fillStyle = '#17121c';
      g.beginPath();
      if (fr === 0) { g.moveTo(-4, -2); g.lineTo(-12, -20); g.lineTo(-4, -17); g.lineTo(0, -21); g.lineTo(6, -3); }
      else { g.moveTo(-4, 1); g.lineTo(-14, 15); g.lineTo(-4, 12); g.lineTo(1, 16); g.lineTo(6, 2); }
      g.closePath(); g.fill();
      g.fillStyle = '#ff2338'; g.beginPath(); g.arc(11.2, -3, 1.4, 0, TAU); g.fill();
    });
  }
  function sharkSpr() {
    return Spr('shark', 140, 64, g => {
      g.translate(70, 34);
      const body = () => {
        g.beginPath(); g.moveTo(60, 0); g.quadraticCurveTo(42, -19, 0, -16); g.quadraticCurveTo(-36, -13, -50, -3);
        g.lineTo(-67, -19); g.lineTo(-60, 0); g.lineTo(-67, 17); g.lineTo(-50, 3); g.quadraticCurveTo(-30, 14, 0, 14); g.quadraticCurveTo(42, 14, 60, 0); g.closePath();
      };
      g.fillStyle = 'rgba(52,130,214,.95)'; body(); g.fill();
      g.beginPath(); g.moveTo(52, 3); g.quadraticCurveTo(18, 14, -24, 8); g.quadraticCurveTo(12, 5, 52, 3); g.fillStyle = 'rgba(214,246,255,.9)'; g.fill();
      g.fillStyle = 'rgba(40,104,190,.98)';
      g.beginPath(); g.moveTo(10, -15); g.lineTo(-10, -32); g.lineTo(-15, -14); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(16, 10); g.lineTo(2, 25); g.lineTo(-3, 10); g.closePath(); g.fill();
      g.lineWidth = 2.2; g.strokeStyle = 'rgba(225,250,255,.95)'; body(); g.stroke();
      g.strokeStyle = 'rgba(16,58,110,.85)'; g.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(28 - i * 5, -8); g.lineTo(26 - i * 5, 5); g.stroke(); }
      g.fillStyle = '#7a1424'; g.beginPath(); g.moveTo(59, 1); g.lineTo(34, 5); g.lineTo(53, 9); g.closePath(); g.fill();
      g.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { const x = 54 - i * 4; g.beginPath(); g.moveTo(x, 2.4); g.lineTo(x - 1.5, 5.8); g.lineTo(x - 3, 2.8); g.fill(); }
      g.beginPath(); g.arc(42, -5, 3.2, 0, TAU); g.fill(); g.fillStyle = '#05080c'; g.beginPath(); g.arc(43, -5, 1.6, 0, TAU); g.fill();
    });
  }
  function birdSpr(fr) {
    return Spr('bird' + fr, 52, 44, g => {
      g.translate(26, 24);
      g.fillStyle = '#f3eddf'; g.strokeStyle = '#8c8070'; g.lineWidth = 1.6;
      g.beginPath();
      if (fr === 0) { g.moveTo(-4, -2); g.lineTo(-10, -20); g.lineTo(2, -17); g.lineTo(8, -3); }
      else { g.moveTo(-4, 1); g.lineTo(-12, 17); g.lineTo(1, 14); g.lineTo(8, 2); }
      g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, 0, 13, 6.5, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-11, -1); g.lineTo(-23, -8); g.lineTo(-20, 0); g.lineTo(-23, 7); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(12, -3, 5, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#d8c9a8'; g.beginPath(); g.moveTo(16, -4); g.lineTo(24, -2); g.lineTo(16, 0); g.closePath(); g.fill();
      g.fillStyle = '#3a3028'; g.beginPath(); g.arc(13, -4, 1.3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,128,112,.6)'; g.beginPath(); g.moveTo(-6, 2); g.lineTo(6, 2); g.stroke();
    });
  }
  function dragonSpr() {
    return Spr('dragon', 280, 180, g => {
      g.fillStyle = '#f1ebdc'; g.strokeStyle = '#857a6a'; g.lineWidth = 2.4; g.lineJoin = 'round';
      // far wing
      g.fillStyle = '#d9d1c0';
      g.beginPath(); g.moveTo(150, 82); g.lineTo(190, 14); g.lineTo(196, 40); g.lineTo(214, 30); g.lineTo(206, 62); g.lineTo(226, 62); g.lineTo(176, 92); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f1ebdc';
      // tail
      g.beginPath(); g.moveTo(96, 92); g.quadraticCurveTo(50, 110, 22, 96); g.quadraticCurveTo(8, 88, 14, 76); g.quadraticCurveTo(24, 92, 52, 96); g.quadraticCurveTo(76, 96, 100, 82); g.closePath(); g.fill(); g.stroke();
      // body
      g.beginPath(); g.ellipse(132, 92, 46, 22, -.08, 0, TAU); g.fill(); g.stroke();
      // neck + head
      g.beginPath(); g.moveTo(160, 80); g.quadraticCurveTo(196, 58, 222, 66); g.lineTo(226, 82); g.quadraticCurveTo(198, 80, 172, 100); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(234, 72, 22, 12, .12, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(246, 76); g.lineTo(266, 82); g.lineTo(244, 84); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(226, 62); g.lineTo(214, 44); g.lineTo(232, 60); g.moveTo(236, 60); g.lineTo(232, 42); g.lineTo(242, 61); g.stroke();
      g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(240, 69, 3.5, 2, .2, 0, TAU); g.fill();
      // near wing
      g.fillStyle = '#f7f2e6';
      g.beginPath(); g.moveTo(120, 84); g.lineTo(70, 6); g.lineTo(98, 30); g.lineTo(104, 4); g.lineTo(124, 36); g.lineTo(140, 10); g.lineTo(146, 50); g.lineTo(162, 34); g.lineTo(150, 88); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(133,122,106,.7)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(124, 82); g.lineTo(98, 30); g.moveTo(130, 80); g.lineTo(124, 36); g.moveTo(138, 82); g.lineTo(146, 50); g.stroke();
      // legs + clay mouth mark
      g.strokeStyle = '#857a6a'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(120, 110); g.lineTo(114, 126); g.moveTo(146, 110); g.lineTo(150, 126); g.stroke();
      g.strokeStyle = '#a0907a'; g.beginPath(); g.moveTo(118, 96); g.quadraticCurveTo(132, 104, 146, 96); g.stroke();
    });
  }
  function c3Spr() {
    return Spr('c3', 180, 200, g => {
      g.fillStyle = '#f2ecdd'; g.strokeStyle = '#867a68'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(40, 120, 16, 10, -.6, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(140, 120, 16, 10, .6, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(90, 128, 62, 58, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(68, 186, 14, 10, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(112, 186, 14, 10, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.arc(90, 52, 40, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#d6cab2'; g.beginPath(); g.ellipse(90, 140, 40, 34, 0, 0, TAU); g.fill();
      g.fillStyle = '#2a201a';
      g.beginPath(); g.ellipse(76, 44, 5, 7, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(104, 44, 5, 7, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(66, 60); g.quadraticCurveTo(90, 84, 114, 60); g.quadraticCurveTo(90, 70, 66, 60); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const x = 72 + i * 9; g.beginPath(); g.moveTo(x, 62 + (i % 2)); g.lineTo(x + 4, 68); g.lineTo(x + 8, 62); g.fill(); }
      g.strokeStyle = '#a89a80'; g.lineWidth = 2; g.beginPath(); g.moveTo(70, 132); g.quadraticCurveTo(90, 150, 110, 132); g.stroke();
    });
  }
  function puppetSpr(v) {
    return Spr('pup' + v, 64, 88, g => {
      g.lineJoin = 'round';
      g.strokeStyle = '#c9ccd6'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(14, 40); g.lineTo(2, 30); g.moveTo(50, 40); g.lineTo(62, 30); g.stroke();
      g.fillStyle = v ? '#5d1d26' : '#3a3946'; g.strokeStyle = '#140d10'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(22, 30); g.lineTo(42, 30); g.lineTo(54, 82); g.lineTo(10, 82); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = v ? '#a8323f' : '#6a6a80'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 80); g.stroke();
      g.fillStyle = '#c99d72'; g.strokeStyle = '#4a3020';
      g.beginPath(); g.moveTo(14, 42); g.lineTo(8, 34); g.lineTo(12, 32); g.lineTo(20, 38); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(50, 42); g.lineTo(56, 34); g.lineTo(52, 32); g.lineTo(44, 38); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(32, 18, 11, 13, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = v ? '#2a1a16' : '#7a4a2a'; g.beginPath(); g.ellipse(32, 9, 12, 7, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#120a08'; g.beginPath(); g.arc(28, 18, 2, 0, TAU); g.arc(36, 18, 2, 0, TAU); g.fill();
      g.strokeStyle = '#4a3020'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(26, 25); g.lineTo(26, 30); g.moveTo(38, 25); g.lineTo(38, 30); g.stroke();
    });
  }
  function spikeSpr(v) {
    return Spr('spike' + v, 80, 100, g => {
      const fill = v ? '#76101c' : '#16141b', edge = v ? '#ff5468' : '#5d5868', dark = v ? '#3a040a' : '#050407';
      const spikes = [[40, 4, 11], [22, 30, 9], [58, 24, 9], [10, 56, 6], [70, 50, 6]];
      for (const [x, top, hw] of spikes.slice().reverse()) {
        g.beginPath(); g.moveTo(x - hw, 96); g.lineTo(x + (hash(x) - .5) * 6, top); g.lineTo(x + hw, 96); g.closePath();
        g.fillStyle = fill; g.fill(); g.lineWidth = 1.6; g.strokeStyle = dark; g.stroke();
        g.strokeStyle = edge; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - hw * .55, 92); g.lineTo(x - 1, top + 6); g.stroke();
      }
    });
  }
  const MASK_RGB = ['255,110,50', '160,240,190', '140,190,255', '90,140,255', '210,170,110'];
  function maskSpr(i) {
    return Spr('mask' + i, 44, 50, g => {
      const tint = ['#e0603a', '#8fd8a8', '#8cb8ff', '#4a7ad8', '#b0925e'][i];
      g.fillStyle = '#ece6d8'; g.strokeStyle = '#2a2420'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(22, 26, 17, 21, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = tint;
      g.beginPath(); g.ellipse(22, 26, 17, 21, 0, Math.PI * 1.15, Math.PI * 1.85); g.lineTo(22, 22); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(8, 34); g.quadraticCurveTo(22, 46, 36, 34); g.lineTo(32, 40); g.quadraticCurveTo(22, 48, 12, 40); g.closePath(); g.fill();
      g.fillStyle = '#0d0a0a';
      g.beginPath(); g.ellipse(15, 24, 4.5, 3, .3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(29, 24, 4.5, 3, -.3, 0, TAU); g.fill();
      g.strokeStyle = '#2a2420'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(16, 36); g.lineTo(28, 36); g.stroke();
    });
  }
  function flySpr() {
    return Spr('fly', 48, 40, g => {
      g.translate(24, 20); g.lineJoin = 'round';
      for (const sx of [-1, 1]) {
        g.fillStyle = '#f6f2ff'; g.strokeStyle = '#a28ad8'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(sx * 10, -20, sx * 21, -14); g.quadraticCurveTo(sx * 20, -2, 0, 0); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(0, 1); g.quadraticCurveTo(sx * 16, 4, sx * 15, 15); g.quadraticCurveTo(sx * 6, 14, 0, 2); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(162,138,216,.6)'; g.beginPath(); g.moveTo(0, -1); g.lineTo(sx * 15, -12); g.moveTo(0, 1); g.lineTo(sx * 11, 10); g.stroke();
      }
      g.fillStyle = '#4a3f66'; g.beginPath(); g.ellipse(0, 0, 2, 9, 0, 0, TAU); g.fill();
    });
  }
  function shuSpr() {
    return Spr('shu', 32, 32, g => {
      g.translate(16, 16); g.fillStyle = '#f7f4ff'; g.strokeStyle = '#9d86d6'; g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, r = i % 2 ? 4.5 : 14; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(157,134,214,.7)'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.moveTo(0, -10); g.lineTo(0, 10); g.stroke();
    });
  }
  const patterns = new WeakMap();
  function carpetPattern(ctx) {
    const img = Spr('carpet', 256, 256, g => {
      for (let i = 0; i < 46; i++) {
        const x = hash(i * 3.3) * 256, y = hash(i * 7.9) * 256, an = (hash(i * 1.7) - .5) * 1.4;
        g.save(); g.translate(x, y); g.rotate(an);
        g.fillStyle = hash(i * 5.1) < .5 ? '#f1e8d2' : '#e6dcc2'; g.fillRect(-15, -7, 30, 14);
        g.strokeStyle = '#9a8a6a'; g.lineWidth = 1; g.strokeRect(-15, -7, 30, 14);
        g.fillStyle = '#b8242a'; g.fillRect(-2, -6, 4, 12); g.fillRect(-11, -1, 22, 2);
        g.restore();
      }
    });
    let p = patterns.get(img);
    if (!p) { p = ctx.createPattern(img, 'repeat'); patterns.set(img, p); }
    return p;
  }
  function sigilSpr() {
    return Spr('sigil', 512, 512, g => {
      const c = 256, R = 236;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const stroke = (w, col) => {
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke();
        g.beginPath();
        for (let i = 0; i < 3; i++) { const an = Math.PI / 2 + i * TAU / 3; g.lineTo(c + Math.cos(an) * R, c + Math.sin(an) * R); }
        g.closePath(); g.stroke();
        g.beginPath(); g.arc(c, c, R * .5, 0, TAU); g.stroke();
      };
      stroke(26, 'rgba(70,0,10,.55)'); stroke(14, '#a5101f'); stroke(4, 'rgba(255,90,100,.7)');
      g.fillStyle = '#9a0e1c';
      for (let i = 0; i < 40; i++) {
        const an = hash(i * 2.3) * TAU, rr = hash(i * 4.1) < .5 ? R : R * .5;
        g.beginPath(); g.ellipse(c + Math.cos(an) * rr + (hash(i) - .5) * 14, c + Math.sin(an) * rr + (hash(i * 9) - .5) * 14, 4 + hash(i * 6) * 9, 3 + hash(i * 8) * 6, an, 0, TAU); g.fill();
      }
    });
  }
  function wingSpr() {
    return Spr('wing', 360, 230, g => {
      g.lineJoin = 'round';
      for (const sx of [-1, 1]) {
        for (let i = 7; i >= 0; i--) {
          const an = -Math.PI / 2 + sx * (.35 + i * .17), L = 150 - i * 9 + (i === 0 ? 10 : 0), wd = 20 - i * .8;
          g.save(); g.translate(180 + sx * 8, 150); g.rotate(an + Math.PI / 2);
          g.fillStyle = i % 2 ? '#efe9ff' : '#fbf9ff'; g.strokeStyle = '#a691dc'; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(-wd * .4, 0); g.lineTo(-wd, -L * .7); g.lineTo(0, -L); g.lineTo(wd, -L * .7); g.lineTo(wd * .4, 0); g.closePath(); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(166,145,220,.55)'; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -L * .92); g.stroke();
          g.restore();
        }
      }
    });
  }
  function scytheSpr() {
    return Spr('scythe', 100, 100, g => {
      g.lineCap = 'round';
      g.strokeStyle = '#2a1e1e'; g.lineWidth = 5; g.beginPath(); g.moveTo(50, 50); g.lineTo(50, 96); g.stroke();
      for (const [r, off] of [[40, 0], [30, .5], [22, 1]]) {
        g.save(); g.translate(50, 50 - off * 8);
        g.fillStyle = '#c3172b'; g.strokeStyle = '#4a0610'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.75); g.arc(r * .25, -r * .1, r * .78, Math.PI * 1.72, Math.PI * 1.1, true); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = '#ff8a96'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r - 2, Math.PI * 1.1, Math.PI * 1.65); g.stroke();
        g.restore();
      }
    });
  }
  function poisonPuff() {
    return Spr('poison', 96, 96, g => {
      const gr = g.createRadialGradient(40, 40, 0, 48, 48, 48);
      gr.addColorStop(0, 'rgba(180,120,210,.9)'); gr.addColorStop(.4, 'rgba(120,150,80,.7)');
      gr.addColorStop(.75, 'rgba(70,90,50,.3)'); gr.addColorStop(1, 'rgba(60,80,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 48, 0, TAU); g.fill();
    });
  }
  function causticSpr() {
    return Spr('caustic', 256, 256, g => {
      g.strokeStyle = 'rgba(210,245,255,.55)'; g.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        const x = hash(i * 2.7) * 256, y = hash(i * 5.3) * 256, L = 30 + hash(i * 3.1) * 50, an = hash(i * 9.1) * TAU;
        g.lineWidth = 1.5 + hash(i) * 2.5;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(an + 1) * L * .6, y + Math.sin(an + 1) * L * .6, x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke();
      }
    });
  }
  function waterSphere() {
    return K().sphere('ak:water', [[0, 'rgba(240,252,255,.9)'], [.25, 'rgba(150,220,255,.55)'], [.7, 'rgba(50,140,220,.42)'], [.92, 'rgba(30,100,200,.6)'], [1, 'rgba(200,240,255,.85)']]);
  }
  function ironSphere() {
    return K().sphere('ak:iron', [[0, '#7a7488'], [.18, '#2e2a38'], [.55, '#0d0b12'], [.9, '#050408'], [1, '#2a2632']]);
  }
  const AMA = [[1, '#4a0d33'], [.84, '#1d0617'], [.66, '#0a0209'], [.46, '#000000'], [.25, '#2a0714']];
  const FLAME_BASE = 114 / 128;
  function tongue(ctx, img, x, y, h, wf = .5) { ctx.drawImage(img, x - h * wf * .5, y - h * FLAME_BASE, h * wf, h); }

  // ------------------------------------------------------------------ draw helpers
  const RIM = 'rgba(15,6,18,.38)';
  function pulseA(time) { return .62 + .3 * Math.sin(time * 22); }
  function tCircle(ctx, x, y, r, k, rgb, time) {
    if (!(k < 1)) return;
    k = clamp01(k);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `rgba(${rgb},${.08 + .1 * k})`; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = RIM; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulseA(time)})`; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * k, 0, TAU); ctx.fillStyle = `rgba(${rgb},.2)`; ctx.fill();
  }
  function tLine(ctx, x, y, a, len, hw, k, rgb, time) {
    if (!(k < 1)) return;
    k = clamp01(k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(${rgb},${.08 + .1 * k})`; ctx.fillRect(0, -hw, len, hw * 2);
    ctx.fillStyle = `rgba(${rgb},.2)`; ctx.fillRect(0, -hw, len * k, hw * 2);
    ctx.lineWidth = 5; ctx.strokeStyle = RIM; ctx.strokeRect(0, -hw, len, hw * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulseA(time)})`; ctx.strokeRect(0, -hw, len, hw * 2);
    ctx.restore();
  }
  function sector(ctx, x, y, r0, r1, a0, a1) {
    ctx.beginPath(); ctx.arc(x, y, r1, a0, a1);
    if (r0 > 0) ctx.arc(x, y, r0, a1, a0, true); else ctx.lineTo(x, y);
    ctx.closePath();
  }
  function tCone(ctx, x, y, a, reach, half, k, rgb, time) {
    if (!(k < 1)) return;
    k = clamp01(k);
    sector(ctx, x, y, 0, reach, a - half, a + half);
    ctx.fillStyle = `rgba(${rgb},${.08 + .1 * k})`; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = RIM; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${rgb},${pulseA(time)})`; ctx.stroke();
    sector(ctx, x, y, 0, reach * k, a - half, a + half); ctx.fillStyle = `rgba(${rgb},.2)`; ctx.fill();
  }
  function tRing(ctx, x, y, r0, r1, k, rgb, time) {
    if (!(k < 1)) return;
    ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU); ctx.arc(x, y, r0, 0, TAU, true);
    ctx.fillStyle = `rgba(${rgb},${.08 + .14 * clamp01(k)})`; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${rgb},${pulseA(time)})`;
    ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r0, 0, TAU); ctx.stroke();
  }
  function scorch(ctx, x, y, r, a) {
    if (a <= .01) return;
    ctx.fillStyle = `rgba(26,14,10,${.42 * a})`;
    ctx.beginPath(); ctx.ellipse(x, y, r * .78, r * .4, 0, 0, TAU); ctx.fill();
  }
  // explosion: ground part (scorch + shock ring) and the fireball part above characters
  function boomG(ctx, x, y, r, t, rgb) {
    if (t < 0 || t > 1.4) return;
    scorch(ctx, x, y, r, 1 - win(t, .6, 1.4));
    if (t < .6) K().fx.shockRing(ctx, x, y, r * 1.3, t / .6, 1 - t / .6, rgb);
  }
  function boomO(ctx, x, y, r, t, seed, kind) {
    if (t < 0 || t > .95) return;
    const k = K(), e = easeOut(t / .45), a = 1 - win(t, .35, .95);
    ctx.globalCompositeOperation = 'lighter';
    if (t < .16) k.glow(ctx, x, y - r * .3, r * (1.1 + t * 4), kind === 'water' ? '200,240,255' : '255,236,190', 1 - t / .16, true);
    k.glow(ctx, x, y - r * .2, r * 1.15 * e, kind === 'water' ? '80,170,255' : kind === 'steam' ? '255,40,60' : '255,120,40', .55 * a, false, .7);
    ctx.globalCompositeOperation = 'source-over';
    const fire = k.puff(kind || 'fire'), smoke = k.puff(kind === 'water' ? 'poof' : 'smoke');
    for (let i = 0; i < 5; i++) {
      const an = i * 1.2566 + hash(seed + i) * .8, d = r * .48 * e;
      const px = x + Math.cos(an) * d, py = y + Math.sin(an) * d * .5 - r * .3 * e;
      k.stamp(ctx, smoke, px, py - r * .3 * e, r * (.3 + .12 * hash(seed + i * 3)) * (.6 + e * .6), a * .5 * win(t, .08, .3));
      k.stamp(ctx, fire, px, py, r * (.34 + .1 * hash(seed + i * 2)) * (1 - t * .45), a * (1 - win(t, .25, .7)));
    }
  }
  // A billowing cluster: three fire puffs boiling upward over a smoke cap (cheap, reads as an explosion).
  function billow(ctx, x, y, s, t, seed, a) {
    if (t < 0 || t > .9 || a <= 0) return;
    const k = K(), fire = k.puff('fire'), smoke = k.puff('smoke'), e = easeOut(t / .45);
    for (let i = 0; i < 3; i++) {
      const ox = (hash(seed + i * 3.1) - .5) * s * 1.1 * e, oy = -(hash(seed + i * 5.7) * .6 + .3) * s * e;
      k.stamp(ctx, smoke, x + ox, y + oy - s * .45 * e, s * (.4 + .3 * e), a * .55 * win(t, .08, .3) * (1 - win(t, .5, .9)));
    }
    for (let i = 0; i < 3; i++) {
      const ox = (hash(seed + i * 2.3) - .5) * s * .9 * e, oy = -(hash(seed + i * 4.1) * .5 + .12) * s * e;
      k.stamp(ctx, fire, x + ox, y + oy, s * (.36 + .22 * hash(seed + i)) * (1 - t * .45), a * (1 - win(t, .28, .7)));
    }
  }
  function ringPuffs(ctx, x, y, R, n, size, alpha, kind, seed, rise) {
    const img = K().puff(kind);
    for (let i = 0; i < n; i++) {
      const an = i * TAU / n + hash(seed + i) * .4;
      K().stamp(ctx, img, x + Math.cos(an) * R, y + Math.sin(an) * R * .5 - (rise || 0) * (.6 + hash(seed + i * 3) * .8), size * (.75 + hash(seed + i * 2) * .5), alpha, .8);
    }
  }
  function drawRod(ctx, bx, by, lean, len, alpha) {
    const tx = bx + Math.sin(lean) * len, ty = by - Math.cos(lean) * len;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(170,120,240,.55)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#0b0910'; ctx.lineWidth = 5.5; ctx.stroke();
    ctx.strokeStyle = '#6c6488'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(lerp(bx, tx, .1) - 1.5, lerp(by, ty, .1)); ctx.lineTo(lerp(bx, tx, .95) - 1.5, lerp(by, ty, .95)); ctx.stroke();
    ctx.fillStyle = '#0b0910';
    for (let i = 1; i < 4; i++) { const u = .2 + i * .18; ctx.beginPath(); ctx.arc(lerp(bx, tx, u), lerp(by, ty, u), 4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawSprite(ctx, img, x, y, w, h, rot, flip, alpha) {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(1, -1);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ------------------------------------------------------------------ PAIN
  function rodsG(ctx, f, time) {
    const fade = 1 - win(f.age, f.dur - .6, f.dur);
    for (const d of f.d) {
      const t = f.age - d.t;
      if (t < 0) tCircle(ctx, d.x, d.y, 52, f.age / d.t, '196,130,255', time);
      else {
        ctx.fillStyle = `rgba(22,12,28,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, 28, 13, 0, 0, TAU); ctx.fill();
        if (t < .5) K().fx.shockRing(ctx, d.x, d.y, 90, t / .5, 1 - t / .5, '200,150,255');
      }
    }
  }
  function rodsO(ctx, f, time) {
    const k = K(), fade = 1 - win(f.age, f.dur - .6, f.dur);
    for (const d of f.d) {
      const t = f.age - d.t;
      if (t > -.3 && t < 0) {
        const h = 560 * (-t / .3);
        drawRod(ctx, d.x + Math.sin(.32) * h, d.y - Math.cos(.32) * h, .32, 66, 1);
      } else if (t >= 0) {
        drawRod(ctx, d.x, d.y, .32 + d.l * .4, 58, fade);
        if (t < .3) {
          ctx.globalCompositeOperation = 'lighter';
          k.glow(ctx, d.x, d.y - 10, 70, '200,150,255', 1 - t / .3, true, .7);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (t < .9) k.fx.debris(ctx, d.x, d.y, 70, t / .9, d.x * .01, '#2c2234', 6);
      }
    }
  }
  function shinraG(ctx, f, time) {
    const k = K();
    if (f.age < f.w) {
      const p = f.age / f.w;
      tCircle(ctx, f.x, f.y, f.r, p, '205,150,255', time);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(220,180,255,.55)'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const an = i * TAU / 18 + hash(i) * .3, ph = (time * 1.8 + hash(i * 3.3)) % 1, d = f.r * (1 - ph);
        ctx.moveTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d); ctx.lineTo(f.x + Math.cos(an) * (d - 46), f.y + Math.sin(an) * (d - 46));
      }
      ctx.stroke();
      k.glow(ctx, f.x, f.y, 120 * p, '190,130,255', .4 * p, false, .5);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const t = f.age - f.w;
    scorch(ctx, f.x, f.y, f.r * .55, 1 - win(t, .9, 1.7));
    if (t < .9) k.fx.shockRing(ctx, f.x, f.y, f.r * 1.15, t / .9, 1 - t / .9, '200,160,255');
    if (t > .08 && t < 1) k.fx.shockRing(ctx, f.x, f.y, f.r * .85, (t - .08) / .92, (1 - t) * .8, '255,255,255');
    const e = easeOut(t / 1.1);
    ringPuffs(ctx, f.x, f.y, f.r * (.25 + e * .9), 16, 26 + e * 34, .75 * (1 - win(t, .5, 1.7)), 'dust', f.seed, 10);
  }
  function shinraO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), t = f.age - f.w, R = f.r * easeOut(t / .3), a = 1 - win(t, .2, .95);
    ctx.globalCompositeOperation = 'lighter';
    if (t < .2) k.glow(ctx, f.x, f.y - 50, 180 + t * 1100, '255,240,255', 1 - t / .2, true);
    if (a > 0) {
      k.glow(ctx, f.x, f.y - R * .3, R * 1.1, '170,120,255', .32 * a, false, .8);
      ctx.strokeStyle = `rgba(190,150,255,${.45 * a})`; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * .78, 0, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(245,230,255,${.85 * a})`; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(220,190,255,${.5 * a})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, R * .55, R * .78, 0, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(f.x, f.y, R * .12, R * .78, 0, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(f.x, f.y - R * .42, R * .85, R * .2, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (t < 1.4) {
      k.fx.debris(ctx, f.x, f.y, f.r * 1.2, t / 1.4, f.seed, '#3b3040', 18);
      const fl = easeOut(t * 1.3);
      for (let i = 0; i < 9; i++) {
        const an = i * TAU / 9 + hash(f.seed + i), d = f.r * (.15 + fl * (.85 + hash(i * 2.2) * .3)), h = bell(t * 1.2) * (60 + hash(i * 5) * 70);
        drawSprite(ctx, rockSpr(i % 3), f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .5 - h, 26, 26, t * 7 + i, false, 1 - win(t, .9, 1.4));
      }
    }
  }
  function banshoG(ctx, f, time, z, s) {
    const k = K();
    if (f.age < f.w + .62) tCircle(ctx, f.x, f.y, f.r, f.age / (f.w + .62), '205,150,255', time);
    if (f.age < f.w && s.move === 'bansho') {
      // gravity tether to the victim
      ctx.globalCompositeOperation = 'lighter';
      const dx = s.tx - f.x, dy = s.ty - f.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let j = 0; j < 3; j++) {
        ctx.strokeStyle = `rgba(${j ? '200,150,255' : '255,240,255'},${j ? .4 : .7})`; ctx.lineWidth = j ? 2 : 3;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const u = i / 20, off = Math.sin(u * 14 - time * 18 + j * 2) * 12 * Math.sin(Math.PI * u) * (j ? 1.6 : .6);
          ctx.lineTo(f.x + dx * u + nx * off, f.y + dy * u + ny * off);
        }
        ctx.stroke();
      }
      k.glow(ctx, s.tx, s.ty, 70, '200,150,255', .6, false, .6);
      ctx.globalCompositeOperation = 'source-over';
    }
    const t = f.age - f.w - .62;
    if (t >= 0 && t < .7) {
      k.fx.shockRing(ctx, f.x, f.y, f.r * 1.5, t / .7, 1 - t / .7, '210,160,255');
      scorch(ctx, f.x, f.y, f.r * .8, 1 - t / .7);
    }
  }
  function banshoO(ctx, f, time) {
    const k = K(), t = f.age - f.w;
    if (t >= 0 && t < .6) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(230,200,255,${.6 * (1 - t / .6)})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const an = i * TAU / 16, ph = (t * 2.4 + hash(i * 1.7)) % 1, d = 520 * (1 - ph);
        ctx.moveTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .6 - 30); ctx.lineTo(f.x + Math.cos(an) * (d - 70), f.y + Math.sin(an) * (d - 70) * .6 - 30);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    const t2 = t - .62;
    if (t2 >= 0 && t2 < .5) {
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, f.x, f.y - 30, f.r * 1.4, '210,160,255', 1 - t2 / .5, true, .8);
      ctx.globalCompositeOperation = 'source-over';
      k.fx.debris(ctx, f.x, f.y, f.r * 1.3, t2 / .5, f.seed, '#3b3040', 12);
    }
  }
  function asuraG(ctx, f, time) {
    for (const m of f.ms) {
      if (f.age < m.t) tCircle(ctx, m.x, m.y, 96, f.age / m.t, '255,150,90', time);
      else boomG(ctx, m.x, m.y, 96, f.age - m.t, '255,170,90');
    }
  }
  function asuraO(ctx, f, time) {
    const k = K(), smoke = k.puff('smoke');
    for (let i = 0; i < f.ms.length; i++) {
      const m = f.ms[i], u = (f.age - (m.t - .85)) / .85;
      if (u >= 1) { boomO(ctx, m.x, m.y, 96, f.age - m.t, f.seed + i, 'fire'); continue; }
      if (u < 0) continue;
      const pos = (uu) => { const h = 300 * Math.sin(Math.PI * uu); return [lerp(f.x, m.x, uu), lerp(f.y - 40, m.y, uu) - h]; };
      for (let j = 4; j >= 1; j--) { const uu = Math.max(0, u - j * .05), p = pos(uu); k.stamp(ctx, smoke, p[0], p[1], 9 + j * 4, .5 - j * .08); }
      const [x, y] = pos(u), [x2, y2] = pos(Math.min(1, u + .02)), ang = Math.atan2(y2 - y, x2 - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, -14, 0, 18, '255,150,60', .9, true); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#9aa0ac'; ctx.fillRect(-12, -3.5, 20, 7);
      ctx.fillStyle = '#c23a2a'; ctx.beginPath(); ctx.moveTo(8, -3.5); ctx.lineTo(15, 0); ctx.lineTo(8, 3.5); ctx.fill();
      ctx.fillStyle = '#5a5e68'; ctx.beginPath(); ctx.moveTo(-12, -3.5); ctx.lineTo(-16, -7); ctx.lineTo(-8, -3.5); ctx.moveTo(-12, 3.5); ctx.lineTo(-16, 7); ctx.lineTo(-8, 3.5); ctx.fill();
      ctx.restore();
    }
  }
  function chibakuG(ctx, f, time) {
    const k = K();
    if (f.age < f.T) {
      tCircle(ctx, f.x, f.y, f.r, f.age / f.T, '190,120,255', time);
      const g = win(f.age, f.w, f.T), sh = (30 + 120 * g) * (.6 + .4 * win(f.age, f.T - .45, f.T));
      ctx.fillStyle = `rgba(10,4,16,${.18 + .35 * g})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, sh * 1.1, sh * .5, 0, 0, TAU); ctx.fill();
      if (f.age > f.w) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(200,150,255,.35)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const an = i * TAU / 16 + hash(i), ph = (time * 1.2 + hash(i * 2.1)) % 1, d = f.r * (1 - ph * .8);
          ctx.moveTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d); ctx.lineTo(f.x + Math.cos(an) * (d - 40), f.y + Math.sin(an) * (d - 40));
        }
        ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    const t = f.age - f.T, fade = 1 - win(t, 2.2, 3.2);
    ctx.fillStyle = `rgba(40,30,28,${.6 * fade})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * .82, f.r * .42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(18,12,12,${.6 * fade})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, f.r * .6, f.r * .3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(20,12,16,${.8 * fade})`; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = hash(i * 4.7 + f.seed) * TAU;
      let x = f.x + Math.cos(an) * f.r * .5, y = f.y + Math.sin(an) * f.r * .25;
      ctx.moveTo(x, y);
      for (let j = 1; j <= 3; j++) { const aa = an + (hash(i * 9 + j) - .5) * .7, d = f.r * (.5 + j * .2); x = f.x + Math.cos(aa) * d; y = f.y + Math.sin(aa) * d * .5; ctx.lineTo(x, y); }
    }
    ctx.stroke();
    if (t < 1) { k.fx.shockRing(ctx, f.x, f.y, f.r * 1.4, t, 1 - t, '200,150,255'); k.fx.shockRing(ctx, f.x, f.y, f.r * 1.9, t, (1 - t) * .6, '255,240,230'); }
    const e = easeOut(t / 1.5);
    ringPuffs(ctx, f.x, f.y, f.r * (.6 + e * .6), 18, 40 + e * 40, .8 * (1 - win(t, 1, 3)), 'dust', f.seed, 20);
  }
  function chibakuO(ctx, f, time) {
    const k = K(), H = 300;
    if (f.age < f.T) {
      let cx, cy, R;
      if (f.age < f.w) { const u = easeOut(f.age / f.w); cx = lerp(f.x0, f.x, u); cy = lerp(f.y0 - 60, f.y - H, u); R = 14; }
      else {
        const g = win(f.age, f.w, f.T - .45), d = win(f.age, f.T - .45, f.T);
        R = 26 + 124 * easeOut(g);
        cx = f.x; cy = lerp(f.y - H, f.y - R * .55, easeIn(d));
        // rocks torn from the ground fly into the core
        for (let i = 0; i < 18; i++) {
          const st = f.w + hash(i * 3.7 + f.seed) * (f.T - .45 - f.w - .5), u = (f.age - st) / .65;
          if (u < 0 || u > 1) continue;
          const an = hash(i * 1.9 + f.seed) * TAU, rr = f.r * (.25 + hash(i * 5.3) * .75);
          const gx = f.x + Math.cos(an) * rr, gy = f.y + Math.sin(an) * rr, ee = easeIn(u);
          drawSprite(ctx, rockSpr(i % 3), lerp(gx, cx, ee), lerp(gy, cy, ee) - bell(u) * 40, 34 * (1 - u * .4), 34 * (1 - u * .4), u * 6 + i);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, cx, cy, Math.max(60, R * 1.7), '170,100,255', .4, false);
      ctx.globalCompositeOperation = 'source-over';
      if (R > 20) drawSprite(ctx, ballSpr(), cx, cy, R * 2, R * 2, time * .4);
      ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(cx, cy, Math.min(R, 14 + R * .1), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, cx, cy, 30, '220,180,255', .8, true);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const t = f.age - f.T, fade = 1 - win(t, 2.2, 3.2), R = 150;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.rect(f.x - R * 1.2, f.y - R * 2.4, R * 2.4, R * 2.4 + R * .1); ctx.clip();
    ctx.drawImage(ballSpr(), f.x - R, f.y - R * .9 - R + R * .45, R * 2, R * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) k.glow(ctx, f.x, f.y - 60, f.r * (1.4 + t * 3), '230,200,255', 1 - t / .35, true);
    ctx.globalCompositeOperation = 'source-over';
    if (t < 1.6) k.fx.debris(ctx, f.x, f.y, f.r * 1.4, t / 1.6, f.seed, '#3a2a22', 18);
    if (t < 3) {
      const smoke = k.puff('dust'), s = win(t, .2, 3);
      for (let i = 0; i < 6; i++) k.stamp(ctx, smoke, f.x + (hash(i + f.seed) - .5) * f.r, f.y - R * .5 - s * 160 - i * 20, 50 + s * 60, bell(s) * .5);
    }
  }

  // ------------------------------------------------------------------ ITACHI
  function amaG(ctx, f, time) {
    const k = K();
    if (f.age < f.T) tCircle(ctx, f.x, f.y, f.r, f.age / f.T, '220,40,70', time);
    for (const p of f.sat) if (f.age < p.t) tCircle(ctx, p.x, p.y, p.r, f.age / p.t, '220,40,70', time);
    const fade = 1 - win(f.age, f.dur - .8, f.dur);
    const patch = (x, y, r, on) => {
      if (on <= 0) return;
      const a = Math.min(1, on * 4) * fade;
      ctx.globalCompositeOperation = 'source-over';
      k.glow(ctx, x, y, r * 1.15, '18,0,14', .85 * a, false, .9);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, y, r * 1.1, '170,10,50', .3 * a * (.8 + .2 * Math.sin(time * 9 + x)), false, .8);
      ctx.globalCompositeOperation = 'source-over';
    };
    patch(f.x, f.y, f.r, f.age - f.T);
    for (const p of f.sat) patch(p.x, p.y, p.r, f.age - p.t);
  }
  function amaO(ctx, f, time) {
    const k = K(), fade = 1 - win(f.age, f.dur - .8, f.dur);
    const flames = (x, y, r, on, n, seed) => {
      if (on <= 0) return;
      const grow = easeOut(on / .35) * fade;
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, y - 26, r * 1.1, '200,20,70', .35 * grow, false, .8);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n; i++) {
        const an = hash(seed + i * 1.7) * TAU, d = r * .82 * Math.sqrt(hash(seed + i * 3.1));
        const h = (54 + hash(seed + i) * 50) * grow * (.85 + .15 * Math.sin(time * 13 + i * 2.1));
        tongue(ctx, k.flame((i + Math.floor(time * 11)) % 6, AMA, 'ama'), x + Math.cos(an) * d, y + Math.sin(an) * d * .9, h, .78);
      }
      if (on < .3) {
        ctx.globalCompositeOperation = 'lighter';
        k.glow(ctx, x, y - 20, r * 1.4, '255,60,90', (1 - on / .3) * .7, true);
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    flames(f.x, f.y, f.r, f.age - f.T, 15, f.seed);
    f.sat.forEach((p, i) => flames(p.x, p.y, p.r, f.age - p.t, 7, f.seed + i * 11));
  }
  function crowsG(ctx, f, time) {
    if (f.age < f.w) { tCone(ctx, f.x, f.y, f.a, f.reach, f.half, f.age / f.w, '255,70,100', time); return; }
    ctx.fillStyle = 'rgba(10,6,12,.25)';
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const c = crowPos(f, i);
      if (c) { ctx.moveTo(c.x + 9, c.y); ctx.ellipse(c.x, c.y, 9, 4, 0, 0, TAU); }
    }
    ctx.fill();
  }
  function crowPos(f, i) {
    const aa = f.a + (hash(i * 3.3 + f.seed) - .5) * 2 * f.half * .9, sp = 850 + hash(i * 7.1) * 250;
    const d = (f.age - f.w - hash(i * 2.3) * .15) * sp;
    if (d < 0 || d > f.reach + 80) return null;
    return { x: f.x + Math.cos(aa) * d, y: f.y + Math.sin(aa) * d, aa, h: 30 + hash(i * 5.9) * 46, d };
  }
  function crowsO(ctx, f, time) {
    for (let i = 0; i < 22; i++) {
      const fr = ((time * 14 + i * .5) | 0) % 2;
      if (f.age < f.w) {
        // the flock gathers around Itachi while he calls it
        const an = time * 3 + i * TAU / 22, rr = 46 + hash(i) * 26, k = easeOut(f.age / .3);
        const x = f.x + Math.cos(an) * rr, y = f.y - 46 - hash(i * 2) * 50 + Math.sin(an) * rr * .4;
        drawSprite(ctx, crowSpr(fr), x, y, 40 * k, 34 * k, 0, false);
        continue;
      }
      const c = crowPos(f, i);
      if (!c) continue;
      const left = Math.cos(c.aa) < 0;
      ctx.save(); ctx.translate(c.x, c.y - c.h); if (left) ctx.scale(-1, 1);
      ctx.globalAlpha = 1 - win(c.d, f.reach - 40, f.reach + 80);
      ctx.drawImage(crowSpr(fr), -22, -18, 44, 37);
      ctx.restore();
    }
    // feathers drifting where the flock passed
    if (f.age > f.w) {
      const t = f.age - f.w;
      ctx.fillStyle = '#120e16';
      for (let i = 0; i < 14; i++) {
        const aa = f.a + (hash(i * 4.4 + f.seed) - .5) * 2 * f.half, d = 120 + hash(i * 6.6) * (f.reach - 150), st = d / 950;
        if (t < st) continue;
        const u = (t - st) / 1.2;
        if (u > 1) continue;
        const x = f.x + Math.cos(aa) * d + Math.sin(u * 8 + i) * 10, y = f.y + Math.sin(aa) * d - 60 + u * 50;
        ctx.globalAlpha = 1 - u;
        ctx.beginPath(); ctx.ellipse(x, y, 6, 2, u * 5 + i, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  function gokaG(ctx, f, time) {
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (f.age < f.w) {
      const p = f.age / f.w;
      tLine(ctx, f.x, f.y, f.a, f.len, 88, p, '255,120,40', time);
      tCircle(ctx, ex, ey, f.r, p, '255,120,40', time);
      return;
    }
    const front = Math.min(f.len, (f.age - f.w) * f.sp), fade = 1 - win(f.age, f.dur - 1, f.dur);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
    ctx.fillStyle = `rgba(30,12,6,${.32 * fade})`; ctx.fillRect(30, -50, front - 30, 100);
    ctx.restore();
    if (f.age < f.T) tCircle(ctx, ex, ey, f.r, f.age / f.T, '255,120,40', time);
    else {
      const t = f.age - f.T;
      boomG(ctx, ex, ey, f.r, t, '255,170,90');
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, ex, ey, 190, '255,100,30', .4 * fade, false, .5);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function gokaO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (f.age < f.T) {
      const front = (f.age - f.w) * f.sp, x = f.x + ca * front, y = f.y + sa * front - 36, fire = k.puff('fire');
      for (let j = 6; j >= 1; j--) k.stamp(ctx, fire, x - ca * j * 26, y - sa * j * 26, 52 - j * 5, .55 - j * .06);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, y, 130, '255,120,30', .7, false);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) { const an = time * 6 + i * 1.05; k.stamp(ctx, fire, x + Math.cos(an) * 22, y + Math.sin(an) * 16, 40, .95); }
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, y, 46, '255,230,160', .9, true);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const t = f.age - f.T;
    if (t < 1.4) k.fx.fireBlast(ctx, ex, ey, f.r, t / 1.4, 1, time, f.seed);
    const on = win(t, .3, .6) * (1 - win(f.age, f.dur - 1, f.dur));
    if (on > 0) for (let i = 0; i < 8; i++) {
      const an = hash(f.seed + i * 1.3) * TAU, d = 150 * Math.sqrt(hash(f.seed + i * 2.9));
      tongue(ctx, k.flame((i + Math.floor(time * 10)) % 6), ex + Math.cos(an) * d, ey + Math.sin(an) * d * .8, (36 + hash(i) * 30) * on * (.85 + .15 * Math.sin(time * 12 + i)));
    }
  }
  function tsukuG(ctx, f, time) {
    if (f.age < f.w) { tCircle(ctx, f.x, f.y, f.r, f.age / f.w, '255,40,60', time); return; }
    const a = win(f.age, f.w, f.w + .25) * (1 - win(f.age, f.dur - .4, f.dur)), r = f.r;
    ctx.save();
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU);
    ctx.fillStyle = `rgba(110,0,16,${.55 * a})`; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(10,0,0,${.7 * a})`; ctx.stroke();
    ctx.clip();
    // inverted genjutsu world: black sharingan rings and tomoe turning on the red ground
    ctx.strokeStyle = `rgba(0,0,0,${.55 * a})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * .62, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(0,0,0,${.75 * a})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * .16, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const an = time * 1.6 + i * TAU / 3, cx = f.x + Math.cos(an) * r * .62, cy = f.y + Math.sin(an) * r * .62;
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(f.x, f.y, r * .62 + 12, an, an + .5); ctx.arc(f.x, f.y, r * .62 - 4, an + .5, an, true); ctx.fill();
    }
    const tick = Math.floor((f.age - f.w) / .5), ph = ((f.age - f.w) % .5) / .5;
    if (ph < .35 && f.age < f.w + 2.1) {
      ctx.strokeStyle = `rgba(255,235,235,${(1 - ph / .35) * a})`; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const sx = f.x + (hash(tick * 9 + i) - .5) * r * 1.6, sy = f.y + (hash(tick * 5 + i * 3) - .5) * r * 1.6, an = hash(tick + i * 7) * TAU;
        ctx.moveTo(sx - Math.cos(an) * 60, sy - Math.sin(an) * 60); ctx.lineTo(sx + Math.cos(an) * 60, sy + Math.sin(an) * 60);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,50,70,${.6 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  function tsukuO(ctx, f, time) {
    const k = K(), a = win(f.age, f.w * .4, f.w) * (1 - win(f.age, f.dur - .4, f.dur));
    if (a <= 0) return;
    const mx = f.x, my = f.y - 250, R = 62;
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, mx, my, R * 3, '255,30,50', .5 * a, false);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.fillStyle = '#c00018'; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a0010'; ctx.beginPath(); ctx.arc(mx + 14, my + 10, R * .8, 0, TAU); ctx.fill();
    // Itachi's Mangekyō: three curved blades round a dark pupil
    ctx.fillStyle = '#0a0002';
    ctx.save(); ctx.translate(mx, my); ctx.rotate(time * .8);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * .5, -R * .25, R * .78, R * .2); ctx.quadraticCurveTo(R * .36, R * .02, 0, R * .16); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * .18, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#2a0006'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function susLevel(f) { return win(f.age, 0, f.w * .8) * (1 - win(f.age, f.dur - .6, f.dur)); }
  function susG(ctx, f, time, z) {
    const k = K(), lvl = susLevel(f), fc = Math.cos(f.a) >= 0 ? 1 : -1;
    if (f.age < f.w) {
      const p = f.age / f.w;
      tLine(ctx, f.x, f.y, f.a, f.len, 95, p, '255,100,70', time);
      tCone(ctx, f.x, f.y, f.a, f.reach, f.half, p * .6, '255,100,70', time);
    }
    if (lvl <= 0) return;
    // the ribcage-and-armour Susanoo stays wrapped round Itachi
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(fc * 1.25, 1.25);
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, 0, -120, 190, '255,80,50', .4 * lvl, false, 1.1);
    for (let i = 0; i < 8; i++) {
      const an = -Math.PI / 2 + (i / 7 - .5) * 2.4, h = (60 + 30 * Math.sin(time * 9 + i)) * lvl;
      tongue(ctx, k.flame((i + Math.floor(time * 9)) % 6), Math.cos(an) * 92, -120 + Math.sin(an) * 110 + 40, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.moveTo(-74, 0); ctx.quadraticCurveTo(-100, -90, -76, -156); ctx.quadraticCurveTo(-44, -212, 0, -214);
    ctx.quadraticCurveTo(46, -212, 78, -156); ctx.quadraticCurveTo(104, -90, 76, 0); ctx.closePath();
    ctx.fillStyle = `rgba(220,50,36,${.4 * lvl})`; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,180,140,${.85 * lvl})`; ctx.stroke();
    ctx.strokeStyle = `rgba(255,120,90,${.7 * lvl})`; ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -66 - i * 24, 56 - i * 5, 15, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -170); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -238, 32, 36, 0, 0, TAU);
    ctx.fillStyle = `rgba(230,70,50,${.45 * lvl})`; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,190,150,${.9 * lvl})`; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -238); ctx.lineTo(56, -226); ctx.lineTo(20, -222); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, 10, -246, 16, '255,240,200', lvl, true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  function susO(ctx, f, time, z) {
    const k = K(), lvl = susLevel(f);
    if (lvl <= 0) return;
    const ca = Math.cos(f.a), sa = Math.sin(f.a), fc = ca >= 0 ? 1 : -1;
    const hx = z.x + ca * 76, hy = z.y - 140 + sa * 30;
    // Yata mirror on the far arm
    const mx = z.x - fc * 88, my = z.y - 150;
    ctx.globalAlpha = lvl;
    ctx.fillStyle = 'rgba(255,190,150,.35)'; ctx.strokeStyle = 'rgba(255,220,190,.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(mx, my, 30, 40, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + time; ctx.beginPath(); ctx.arc(mx + Math.cos(an) * 18, my + Math.sin(an) * 24, 6, 0, TAU); ctx.stroke(); }
    // sword arm + sake gourd
    ctx.strokeStyle = 'rgba(255,140,110,.8)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(z.x + fc * 62, z.y - 186); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,160,.85)';
    ctx.beginPath(); ctx.arc(hx, hy, 10, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(hx - ca * 12, hy - 12, 7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    let ext = 0, ba = 0;
    const t = f.age - f.w;
    if (t < 0) { ext = 70 + 20 * Math.sin(time * 8); ba = .8 * lvl; }
    else if (t < .62) { ext = 70 + (f.len - 70) * easeOut(t / .1); ba = 1 - win(t, .38, .62); }
    else ext = 0;
    if (ext > 0 && ba > 0) {
      const tx = f.x + ca * ext, ty = f.y + sa * ext - 46;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,90,60,${.35 * ba})`; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = `rgba(255,190,150,${.6 * ba})`; ctx.lineWidth = 20; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,240,${.95 * ba})`; ctx.lineWidth = 7; ctx.stroke();
      k.glow(ctx, tx, ty, 90, '255,200,160', ba, true);
      ctx.globalCompositeOperation = 'source-over';
    }
    const t2 = t - .5;
    if (t2 >= 0 && t2 < .45) {
      const p = easeOut(t2 / .16), a0 = f.a - f.half, a1 = a0 + 2 * f.half * p, al = 1 - win(t2, .15, .45);
      ctx.save(); ctx.translate(f.x, f.y - 30); ctx.scale(1, .8);
      ctx.globalCompositeOperation = 'lighter';
      sector(ctx, 0, 0, f.reach * .45, f.reach, a0, a1);
      ctx.fillStyle = `rgba(255,90,60,${.3 * al})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,240,220,${.9 * al})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, f.reach * .95, a0, a1); ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ KISAME
  function sharksG(ctx, f, time) {
    if (f.age < f.w) {
      for (let i = 0; i < 5; i++) tLine(ctx, f.x, f.y, f.a + (i - 2) * .15, 890, 46, f.age / f.w, '98,197,244', time);
      return;
    }
    const k = K(), water = k.puff('water');
    for (const m of f.mv) {
      if (m.l > 0 && f.age >= m.d) {
        ctx.fillStyle = 'rgba(10,30,50,.25)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, 40, 12, 0, 0, TAU); ctx.fill();
        for (let j = 1; j <= 4; j++) k.stamp(ctx, water, m.x - m.vx * .03 * j, m.y - m.vy * .03 * j, 22 - j * 3, .5 - j * .1, .6);
      } else if (m.e >= 0 && f.age - m.e < .6) {
        const t = f.age - m.e;
        k.fx.shockRing(ctx, m.x, m.y, 90, t / .6, 1 - t / .6, '120,210,255');
      }
    }
  }
  function sharksO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K();
    for (const m of f.mv) {
      if (m.l > 0 && f.age >= m.d) {
        const ang = Math.atan2(m.vy, m.vx);
        drawSprite(ctx, sharkSpr(), m.x, m.y - 24 + Math.sin(time * 20 + m.d * 9) * 3, 112, 51, ang, Math.cos(ang) < 0);
      } else if (m.e >= 0 && f.age - m.e < .5) {
        const t = (f.age - m.e) / .5;
        ringPuffs(ctx, m.x, m.y, 20 + t * 50, 6, 20, 1 - t, 'water', m.d * 30, t * 40);
      }
    }
  }
  function daikoG(ctx, f, time) {
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (f.age < f.w) { const p = f.age / f.w; tLine(ctx, f.x, f.y, f.a, f.len, 115, p, '98,197,244', time); tCircle(ctx, ex, ey, 240, p, '98,197,244', time); return; }
    if (f.age < f.T) tCircle(ctx, ex, ey, 240, f.age / f.T, '98,197,244', time);
    const front = Math.min(f.len, (f.age - f.w) * f.sp), water = k.puff('water'), fade = 1 - win(f.age, f.T, f.dur);
    for (let i = 0; i < 9; i++) {
      const d = front - i * 55;
      if (d < 20) break;
      k.stamp(ctx, water, f.x + ca * d + (hash(i + f.seed) - .5) * 40, f.y + sa * d + (hash(i * 2 + f.seed) - .5) * 40, 70 - i * 4, (.55 - i * .05) * fade, .55);
    }
    if (f.age >= f.T) {
      const t = f.age - f.T;
      if (t < .8) { k.fx.shockRing(ctx, ex, ey, 300, t / .8, 1 - t / .8, '120,210,255'); k.fx.shockRing(ctx, ex, ey, 200, t / .8, (1 - t / .8) * .7, '230,250,255'); }
      ctx.fillStyle = `rgba(30,90,150,${.35 * (1 - win(t, .3, 1.6))})`; ctx.beginPath(); ctx.ellipse(ex, ey, 200, 100, 0, 0, TAU); ctx.fill();
    }
  }
  function daikoO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (f.age < f.T) {
      const front = (f.age - f.w) * f.sp, x = f.x + ca * front, y = f.y + sa * front - 50 + Math.sin(time * 9) * 5;
      ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, x, y, 200, '80,170,255', .45, false, .8); ctx.globalCompositeOperation = 'source-over';
      drawSprite(ctx, sharkSpr(), x, y, 400, 182, f.a, ca < 0);
      ringPuffs(ctx, x + ca * 120, y + 30 + sa * 60, 70, 6, 32, .7, 'water', time * 3 | 0, 20);
      return;
    }
    const t = f.age - f.T;
    if (t < 1.2) {
      const u = t / 1.2;
      ringPuffs(ctx, ex, ey, 60 + easeOut(u) * 220, 14, 46 * (1 - u * .4), 1 - u, 'water', f.seed, bell(u) * 120);
      ctx.globalCompositeOperation = 'lighter';
      if (t < .25) k.glow(ctx, ex, ey - 60, 300, '200,240,255', 1 - t / .25, true);
      ctx.globalCompositeOperation = 'source-over';
      k.fx.debris(ctx, ex, ey, 300, u, f.seed, '#8fd0ff', 16);
    }
  }
  function suiroG(ctx, f, time) {
    if (f.age < f.w) { tCircle(ctx, f.x, f.y, f.r, f.age / f.w, '98,197,244', time); return; }
    const a = 1 - win(f.age, f.dur - .4, f.dur);
    ctx.fillStyle = `rgba(20,80,140,${.35 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(200,240,255,${.5 * a})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const ph = (time * .7 + i / 3) % 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * ph, 0, TAU); ctx.stroke(); }
  }
  function suiroO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), t = f.age - f.w, form = easeOut(t / .3), end = win(f.age, f.w + 2.2, f.dur);
    const r = f.r * form * (1 + end * .25), a = (1 - end);
    if (a > 0) {
      ctx.globalAlpha = .55 * a;
      ctx.drawImage(waterSphere(), f.x - r, f.y - r * 1.15, r * 2, r * 1.75);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(200,245,255,${.75 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - r * .275, r, r * .875, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.7 * a})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - r * .275, r * .8, r * .7, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = `rgba(220,250,255,${.6 * a})`;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const bx = f.x + (hash(i * 2.1) - .5) * r * 1.4, ph = (time * (.4 + hash(i) * .4) + hash(i * 3.3)) % 1, by = f.y - ph * r * 1.4;
        const br = 3 + hash(i * 5) * 5;
        ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU);
      }
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (end > 0) ringPuffs(ctx, f.x, f.y, f.r * (.6 + end * .7), 14, 34, 1 - end, 'water', f.seed, end * 90);
  }
  function sameG(ctx, f, time) {
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (f.age < f.w) tLine(ctx, f.x, f.y, f.a, f.len, 70, f.age / f.w, '120,210,255', time);
    if (f.age < f.w + .3) tCircle(ctx, ex, ey, 200, f.age / (f.w + .3), '120,210,255', time);
    const t = f.age - f.w;
    if (t > 0) {
      const a = 1 - win(t, .2, .9), water = k.puff('water');
      for (let i = 0; i < 8; i++) { const u = i / 8; if (u * .28 > t) break; k.stamp(ctx, water, lerp(f.x, ex, u), lerp(f.y, ey, u), 26, .5 * a, .5); }
      const t2 = t - .3;
      if (t2 > 0 && t2 < .6) k.fx.shockRing(ctx, ex, ey, 240, t2 / .6, 1 - t2 / .6, '140,220,255');
    }
  }
  function sameO(ctx, f, time, z) {
    const t = f.age - f.w;
    if (t < 0) return;
    const ca = Math.cos(f.a), sa = Math.sin(f.a), ex = f.x + ca * f.len, ey = f.y + sa * f.len;
    if (t < .3) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(140,220,255,.5)'; ctx.lineWidth = 30; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x, f.y - 40); ctx.lineTo(z.x, z.y - 40); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,255,255,.8)'; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    const t2 = t - .26;
    if (t2 > 0 && t2 < .5) {
      const al = 1 - win(t2, .25, .5), spin = t2 * 26;
      ctx.save(); ctx.translate(ex, ey - 30); ctx.scale(1, .55);
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = `rgba(${j ? '240,255,255' : '90,180,255'},${al * (j ? .9 : .5)})`; ctx.lineWidth = j ? 5 : 22;
        ctx.beginPath(); ctx.arc(0, 0, 180, spin, spin + 2.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 130, spin + Math.PI, spin + Math.PI + 2.2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // Samehada: the bandaged scale-blade swung round
      ctx.rotate(spin);
      ctx.fillStyle = '#3d5c7a'; ctx.fillRect(30, -14, 120, 28);
      ctx.fillStyle = '#8fb4cf';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 16, -14); ctx.lineTo(48 + i * 16, -24); ctx.lineTo(56 + i * 16, -14); ctx.fill(); ctx.beginPath(); ctx.moveTo(40 + i * 16, 14); ctx.lineTo(48 + i * 16, 24); ctx.lineTo(56 + i * 16, 14); ctx.fill(); }
      ctx.restore();
      ringPuffs(ctx, ex, ey, 120 + t2 * 160, 8, 26, al, 'water', f.seed, 40 * t2);
    }
  }
  function seaR(f) { return Math.min(f.r, Math.max(0, f.age - f.w) * f.sp); }
  function seaG(ctx, f, time) {
    const k = K();
    if (f.age < f.w) {
      const p = f.age / f.w;
      tCircle(ctx, f.x, f.y, f.r, p, '80,180,255', time);
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, f.x, f.y - 30, 90 + 60 * p, '90,190,255', .6, false, .7);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const R = seaR(f), a = 1 - win(f.age, f.dur - 1.1, f.dur);
    if (R < 4) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU);
    ctx.fillStyle = `rgba(24,96,170,${.66 * a})`; ctx.fill();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * a;
    const img = causticSpr(), S2 = 420, ox = (time * 30) % S2, oy = (time * 18) % S2;
    for (let gx = f.x - R - S2 + ox; gx < f.x + R; gx += S2) for (let gy = f.y - R - S2 + oy; gy < f.y + R; gy += S2) ctx.drawImage(img, gx, gy, S2, S2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(200,240,255,${.22 * a})`; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const ph = (time * .25 + i / 4) % 1; ctx.beginPath(); ctx.arc(f.x, f.y, R * ph, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    // fins of the thousand sharks circling in the flood
    for (let i = 0; i < 6; i++) {
      const rr = f.r * (.25 + hash(i * 3.1 + f.seed) * .6), an = time * (.5 + hash(i) * .5) * (i % 2 ? 1 : -1) + i;
      const fx = f.x + Math.cos(an) * rr, fy = f.y + Math.sin(an) * rr, dir = i % 2 ? 1 : -1;
      if (Math.hypot(fx - f.x, fy - f.y) > R - 10) continue;
      ctx.fillStyle = `rgba(40,70,110,${a})`; ctx.beginPath(); ctx.moveTo(fx - 10 * dir, fy); ctx.lineTo(fx + 4 * dir, fy - 22); ctx.lineTo(fx + 12 * dir, fy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(230,250,255,${.7 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy + 2, 16, 0, Math.PI); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(230,250,255,${.8 * a})`; ctx.lineWidth = R < f.r ? 12 : 4;
    ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const b of f.bites) {
      const t = f.age - b.t;
      if (t < 0) tCircle(ctx, b.x, b.y, 85, 1 + t / .7, '80,180,255', time);
      else if (t < .6) k.fx.shockRing(ctx, b.x, b.y, 110, t / .6, 1 - t / .6, '200,240,255');
    }
  }
  function seaO(ctx, f, time) {
    const k = K();
    if (f.age < f.w) {
      // Kisame spews the sea from his mouth
      const p = f.age / f.w;
      ringPuffs(ctx, f.x, f.y - 40, 30 + 40 * p, 8, 22 + 20 * p, .8, 'water', time * 4 | 0, 40 * p);
      return;
    }
    const R = seaR(f);
    if (R < f.r && R > 10) {
      const n = Math.min(26, 8 + R / 40 | 0), water = k.puff('water');
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + hash(i + f.seed) * .2;
        k.stamp(ctx, water, f.x + Math.cos(an) * R, f.y + Math.sin(an) * R - 20, 34 + hash(i * 3) * 18, .75, .7);
      }
    }
    for (const b of f.bites) {
      const t = f.age - b.t;
      if (t < -.15 || t > .45) continue;
      const u = clamp01((t + .15) / .6);
      drawSprite(ctx, sharkSpr(), b.x, b.y - 40 - bell(u) * 60, 150, 68, -Math.PI / 2 + .3, false, 1 - win(u, .7, 1));
      ringPuffs(ctx, b.x, b.y, 40 + u * 40, 8, 26, 1 - u, 'water', b.x, u * 50);
    }
  }

  // ------------------------------------------------------------------ DEIDARA
  function birdsG(ctx, f, time) {
    if (f.age < f.w) return;
    for (let i = 0; i < f.b.length; i++) {
      const b = f.b[i];
      if (b.e < 0) {
        ctx.fillStyle = 'rgba(20,14,8,.25)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 14, 6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,170,90,${.35 + .3 * Math.sin(time * 16 + i)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, TAU); ctx.stroke();
      } else boomG(ctx, b.x, b.y, 100, f.age - b.e, '255,190,110');
    }
  }
  function birdsO(ctx, f, time) {
    for (let i = 0; i < f.b.length; i++) {
      const b = f.b[i], fr = ((time * 12 + i * .5) | 0) % 2;
      if (f.age < f.w) {
        const k = easeOut(f.age / f.w), an = f.b[i].a, x = f.x + Math.cos(an) * 40 * k, y = f.y - 50 + Math.sin(an) * 20 * k;
        drawSprite(ctx, birdSpr(fr), x, y, 46 * k, 39 * k, 0, false);
      } else if (b.e < 0) {
        ctx.save(); ctx.translate(b.x, b.y - 40 + Math.sin(time * 8 + i) * 4); if (Math.cos(b.a) < 0) ctx.scale(-1, 1);
        ctx.drawImage(birdSpr(fr), -26, -22, 52, 44); ctx.restore();
      } else boomO(ctx, b.x, b.y, 100, f.age - b.e, f.seed + i, 'fire');
    }
  }
  function c2Pos(f) {
    const d = (f.age - f.w) * f.sp;
    return { x: f.x + Math.cos(f.a) * d, y: f.y + Math.sin(f.a) * d, d };
  }
  function c2G(ctx, f, time) {
    for (const b of f.bombs) { if (f.age < b.t) tCircle(ctx, b.x, b.y, 112, f.age / b.t, '255,190,110', time); else boomG(ctx, b.x, b.y, 112, f.age - b.t, '255,190,110'); }
    if (f.age > f.w) { const p = c2Pos(f); ctx.fillStyle = 'rgba(14,10,8,.28)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 110, 34, 0, 0, TAU); ctx.fill(); }
  }
  function c2O(ctx, f, time) {
    for (let i = 0; i < f.bombs.length; i++) {
      const b = f.bombs[i], u = (f.age - (b.t - .45)) / .45;
      if (u >= 1) { boomO(ctx, b.x, b.y, 112, f.age - b.t, f.seed + i, 'fire'); continue; }
      if (u < 0) continue;
      const y = lerp(b.y - 210, b.y, easeIn(u));
      ctx.fillStyle = '#efe7d6'; ctx.strokeStyle = '#857a6a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(b.x, y, 8, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(b.x, y - 12); ctx.lineTo(b.x, y - 40); ctx.stroke();
    }
    if (f.age > f.w) {
      const p = c2Pos(f), left = Math.cos(f.a) < 0;
      ctx.save(); ctx.translate(p.x, p.y - 210 + Math.sin(time * 5) * 8); if (left) ctx.scale(-1, 1);
      ctx.globalAlpha = 1 - win(f.age, f.dur - .5, f.dur);
      ctx.drawImage(dragonSpr(), -140, -90, 280, 180);
      ctx.restore();
    }
  }
  function c3G(ctx, f, time) {
    if (f.age < f.T) {
      tCircle(ctx, f.x, f.y, f.r, f.age / f.T, '255,170,90', time);
      const u = win(f.age, f.w * .4, f.T);
      ctx.fillStyle = `rgba(14,10,8,${.15 + .35 * u})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 30 + 80 * u, (30 + 80 * u) * .4, 0, 0, TAU); ctx.fill();
      return;
    }
    const k = K(), t = f.age - f.T;
    scorch(ctx, f.x, f.y, f.r * 1.1, 1 - win(t, 1.4, 2.8));
    if (t < 1) { k.fx.shockRing(ctx, f.x, f.y, f.r * 1.4, t, 1 - t, '255,190,110'); k.fx.shockRing(ctx, f.x, f.y, f.r * 1.9, t, (1 - t) * .6, '255,240,220'); }
  }
  function c3O(ctx, f, time) {
    const k = K();
    if (f.age < f.T) {
      if (f.age < f.w * .4) return;
      const u = win(f.age, f.w * .4, f.T), sz = lerp(50, 180, easeOut(u * 1.4));
      const y = lerp(f.y - 520, f.y - sz * .5, easeIn(u));
      drawSprite(ctx, c3Spr(), f.x, y, sz * .9, sz, Math.sin(time * 3) * .1);
      return;
    }
    const t = f.age - f.T;
    ctx.globalCompositeOperation = 'lighter';
    if (t < .3) k.glow(ctx, f.x, f.y - 80, f.r * (1.6 + t * 4), '255,250,230', 1 - t / .3, true);
    ctx.globalCompositeOperation = 'source-over';
    if (t < 1.6) k.fx.fireBlast(ctx, f.x, f.y, f.r, t / 1.6, 1, time, f.seed);
    if (t > .3 && t < 2.8) {
      const s = win(t, .3, 2.8), smoke = k.puff('smoke'), fire = k.puff('fire');
      for (let i = 0; i < 6; i++) k.stamp(ctx, smoke, f.x + (hash(i + f.seed) - .5) * 60, f.y - 60 - s * 260 * (i / 6 + .4), 40 + s * 40, bell(s) * .7);
      for (let i = 0; i < 8; i++) { const an = i * TAU / 8; k.stamp(ctx, smoke, f.x + Math.cos(an) * (60 + s * 110), f.y - 80 - s * 300 + Math.sin(an) * 30, 50 + s * 50, bell(s) * .65); }
      k.stamp(ctx, fire, f.x, f.y - 80 - s * 300, 70, (1 - s) * .8);
    }
    if (t < 1.4) k.fx.debris(ctx, f.x, f.y, f.r * 1.3, t / 1.4, f.seed, '#3a2a22', 16);
  }
  function c4G(ctx, f, time) {
    const k = K();
    if (f.age < f.w) tCircle(ctx, f.x, f.y, f.r, f.age / f.w, '235,225,255', time);
    const a = win(f.age, 0, f.w) * (1 - win(f.age, f.dur - .5, f.dur)), poof = k.puff('poof');
    for (let i = 0; i < 12; i++) {
      const an = hash(i * 2.2 + f.seed) * TAU, d = f.r * .78 * Math.sqrt(hash(i * 3.7)), dr = Math.sin(time * .8 + i) * 14;
      k.stamp(ctx, poof, f.x + Math.cos(an) * d + dr, f.y + Math.sin(an) * d, 90 + hash(i) * 40, .16 * a, .8);
    }
    if (f.age > f.w) {
      ctx.strokeStyle = `rgba(255,150,120,${.45 * a})`; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function c4O(ctx, f, time) {
    const k = K();
    if (f.age < f.w) return;
    const a = (1 - win(f.age, f.dur - .5, f.dur)) * win(f.age, f.w, f.w + .2), tick = Math.floor(time * 14);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const an = hash(tick * 3.1 + i * 1.7) * TAU, d = f.r * Math.sqrt(hash(tick * 1.3 + i * 5.1));
      const x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d - hash(i + tick) * 40;
      k.glow(ctx, x, y, 10 + hash(i * 7 + tick) * 16, '255,190,120', .9 * a, true);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(240,236,255,${.7 * a})`; ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const an = hash(i * 9.1) * TAU, d = f.r * Math.sqrt(hash(i * 4.3)), y = f.y + Math.sin(an) * d - ((time * 30 + hash(i) * 80) % 80);
      ctx.rect(f.x + Math.cos(an) * d, y, 2, 2);
    }
    ctx.fill();
  }
  function c0G(ctx, f, time, z) {
    const k = K();
    if (f.age < f.w) {
      const p = f.age / f.w;
      tCircle(ctx, f.x, f.y, f.r, p, '255,210,140', time);
      ctx.strokeStyle = `rgba(255,220,160,${.4 + .3 * Math.sin(time * 30)})`; ctx.lineWidth = 3; ctx.setLineDash([22, 14]);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - p) + 40, time * 2, time * 2 + TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    const t = f.age - f.w;
    scorch(ctx, f.x, f.y, f.r * 1.15, 1 - win(t, 1.6, 2.9));
    if (t < 1.1) {
      k.fx.shockRing(ctx, f.x, f.y, f.r * 1.3, t / 1.1, 1 - t / 1.1, '255,200,130');
      k.fx.shockRing(ctx, f.x, f.y, f.r * 1.7, t / 1.1, (1 - t / 1.1) * .6, '255,255,240');
    }
  }
  function c0O(ctx, f, time, z) {
    const k = K();
    if (f.age < f.w) {
      // Deidara's body swells with chakra-laced clay, light leaking through the cracks
      const p = f.age / f.w, x = z.x, y = z.y - 40;
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, x, y, 60 + 90 * p, '255,220,160', .5 + .4 * p * (.7 + .3 * Math.sin(time * 30)), true);
      ctx.strokeStyle = `rgba(255,245,220,${.5 * p})`; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 12; i++) { const an = i * TAU / 12 + time * .5, L = 60 + 120 * p * hash(i + Math.floor(time * 10)); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L * .7); }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const t = f.age - f.w, R = f.r * easeOut(t / .45), a = 1 - win(t, .3, 1.3);
    ctx.globalCompositeOperation = 'lighter';
    if (t < .35) k.glow(ctx, f.x, f.y - 60, f.r * 2, '255,255,240', 1 - t / .35, true);
    if (a > 0) {
      k.glow(ctx, f.x, f.y - R * .3, R * 1.3, '255,170,80', .75 * a, true, .8);
      ctx.strokeStyle = `rgba(255,200,140,${.45 * a})`; ctx.lineWidth = 26; ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * .8, 0, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,250,230,${.85 * a})`; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (t < 1.8) k.fx.fireBlast(ctx, f.x, f.y, f.r * .62, t / 1.8, 1, time, f.seed);
    // three rolling rings of boiling fire out to the edge of the blast
    [[.4, 8, 130], [.7, 12, 115], [.97, 18, 100]].forEach(([u, n, sz], j) => {
      for (let i = 0; i < n; i++) {
        const an = i * TAU / n + j * .5 + hash(i + j * 9) * .2;
        billow(ctx, f.x + Math.cos(an) * R * u, f.y + Math.sin(an) * R * u * .62, sz, (t - j * .07) * .8, f.seed + j * 40 + i * 3.3, 1);
      }
    });
    if (t > .3) {
      const s = win(t, .3, 2.9), smoke = k.puff('smoke'), fire = k.puff('fire');
      for (let i = 0; i < 7; i++) k.stamp(ctx, smoke, f.x + (hash(i + f.seed) - .5) * 90, f.y - 80 - s * 420 * (i / 7 + .3), 60 + s * 50, bell(s) * .75);
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10; k.stamp(ctx, smoke, f.x + Math.cos(an) * (90 + s * 170), f.y - 120 - s * 420 + Math.sin(an) * 40, 70 + s * 60, bell(s) * .7); }
      k.stamp(ctx, fire, f.x, f.y - 120 - s * 420, 110, (1 - s) * .8);
    }
    if (t < 1.6) k.fx.debris(ctx, f.x, f.y, f.r * 1.3, t / 1.6, f.seed, '#3a2a22', 20);
  }

  // ------------------------------------------------------------------ SASORI
  function ironG(ctx, f, time) {
    const fade = 1 - win(f.age, f.dur - .7, f.dur);
    for (const d of f.d) {
      const t = f.age - d.t;
      if (t < 0) tCircle(ctx, d.x, d.y, 56, f.age / d.t, '170,150,200', time);
      else {
        ctx.fillStyle = `rgba(12,10,16,${.55 * fade})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, 34, 15, 0, 0, TAU); ctx.fill();
        if (t < .4) K().fx.shockRing(ctx, d.x, d.y, 80, t / .4, 1 - t / .4, '150,140,170');
      }
    }
  }
  function ironO(ctx, f, time) {
    const k = K(), smoke = k.puff('violet');
    ctx.strokeStyle = '#121016'; ctx.lineCap = 'round';
    for (const d of f.d) {
      const t = f.age - d.t;
      if (t > -.22 && t < 0) {
        const u = 1 + t / .22;
        ctx.lineWidth = 3; ctx.beginPath();
        for (let j = 0; j < 4; j++) {
          const ox = (j - 1.5) * 9, h = (1 - u) * 380 + j * 14;
          ctx.moveTo(d.x + ox + h * .25, d.y - h); ctx.lineTo(d.x + ox + h * .25 + 9, d.y - h - 34);
        }
        ctx.stroke();
      } else if (t >= 0 && t < .5) {
        k.stamp(ctx, smoke, d.x, d.y - 10 - t * 30, 30 + t * 40, (1 - t / .5) * .8, .8);
        k.fx.debris(ctx, d.x, d.y, 60, t / .5, d.x, '#141218', 5);
      }
    }
  }
  function pupG(ctx, f, time) {
    if (f.age < f.w + .55) {
      tCircle(ctx, f.x, f.y, f.r, f.age / (f.w + .55), '225,132,101', time);
      tCircle(ctx, f.x, f.y, 130, f.age / (f.w + .55), '225,132,101', time);
    }
    const t = f.age - f.w - .55;
    if (t > 0 && t < .6) K().fx.shockRing(ctx, f.x, f.y, 180, t / .6, 1 - t / .6, '255,200,180');
  }
  function pupO(ctx, f, time, z) {
    const k = K(), fade = 1 - win(f.age, f.dur - .35, f.dur);
    // chakra threads from Sasori's fingers
    if (f.age < f.w + .7) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(130,200,255,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i < f.ps.length; i++) { const p = pupPos(f, i); ctx.moveTo(z.x, z.y - 54); ctx.lineTo(p.x, p.y - 74); }
      ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < f.ps.length; i++) {
      const p = pupPos(f, i), sc = easeOut(f.age / .3);
      ctx.fillStyle = 'rgba(10,6,6,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 18, 7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = fade;
      ctx.drawImage(puppetSpr(i % 2), p.x - 30 * sc, p.y - 84 * sc + Math.sin(time * 6 + i) * 3, 60 * sc, 82 * sc);
      ctx.globalAlpha = 1;
      if (f.age < .3) k.stamp(ctx, k.puff('poof'), p.x, p.y - 40, 40, 1 - f.age / .3);
    }
    const t = f.age - f.w - .55;
    if (t > -.05 && t < .35) {
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, f.x, f.y - 40, 160, '255,230,210', 1 - clamp01(t / .35), true);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const an = i * .8 + f.seed; ctx.moveTo(f.x - Math.cos(an) * 90, f.y - 40 - Math.sin(an) * 50); ctx.lineTo(f.x + Math.cos(an) * 90, f.y - 40 + Math.sin(an) * 50); }
      ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    }
  }
  function pupPos(f, i) {
    const p = f.ps[i], u = easeIn(win(f.age, f.w + i * .05, f.w + i * .05 + .22)) * .82;
    return { x: lerp(p.x, f.x, u), y: lerp(p.y, f.y, u) };
  }
  function poisonG(ctx, f, time) {
    if (f.age < f.w) { tCone(ctx, f.x, f.y, f.a, f.reach, f.half, f.age / f.w, '170,210,100', time); return; }
    const a = win(f.age, f.w, f.w + .4) * (1 - win(f.age, f.dur - .8, f.dur));
    for (const p of f.pts) K().glow(ctx, p.x, p.y, p.r * 1.2, '40,60,20', .55 * a, false, .9);
  }
  function poisonO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), img = poisonPuff(), t = f.age - f.w, a = win(t, 0, .3) * (1 - win(f.age, f.dur - .8, f.dur)), spread = easeOut(t / .7);
    for (let i = 0; i < 20; i++) {
      const aa = f.a + (hash(i * 3.9 + f.seed) - .5) * 2 * f.half * .9, d = f.reach * (.12 + .82 * hash(i * 1.7 + f.seed)) * spread;
      const x = f.x + Math.cos(aa) * d + Math.sin(time * .9 + i) * 16, y = f.y + Math.sin(aa) * d - 20 - Math.cos(time * .7 + i) * 8;
      k.stamp(ctx, img, x, y, (64 + hash(i * 6.3) * 64) * (.5 + .5 * spread), .78 * a, .75);
    }
  }
  function spkG(ctx, f, time) {
    if (f.age < f.w) { tLine(ctx, f.x, f.y, f.a, f.len, 80, f.age / f.w, '170,150,200', time); return; }
    const ca = Math.cos(f.a), sa = Math.sin(f.a), fade = 1 - win(f.age, f.dur - .6, f.dur);
    ctx.fillStyle = `rgba(12,10,16,${.45 * fade})`; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const d = 90 + i * 90;
      if (f.age < f.w + d / f.sp) break;
      const x = f.x + ca * d, y = f.y + sa * d;
      ctx.moveTo(x + 50, y); ctx.ellipse(x, y, 50, 22, 0, 0, TAU);
    }
    ctx.fill();
  }
  function spkO(ctx, f, time) {
    if (f.age < f.w) return;
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a), sink = 1 - win(f.age, f.dur - .6, f.dur);
    for (let i = 0; i < 10; i++) {
      const d = 90 + i * 90, t = f.age - f.w - d / f.sp;
      if (t < 0) break;
      const x = f.x + ca * d, y = f.y + sa * d, rise = easeOut(t / .09) * sink;
      for (let j = 0; j < 2; j++) {
        const ox = (j ? 22 : -18) + (hash(i * 3 + j) - .5) * 10, oy = j ? 8 : -6, sc = 1 + hash(i + j * 7) * .45;
        const h = 100 * sc * rise;
        if (h > 2) ctx.drawImage(spikeSpr(0), x + ox - 40 * sc, y + oy - h, 80 * sc, h);
      }
      if (t < .4) k.stamp(ctx, k.puff('violet'), x, y - 10, 40 + t * 60, (1 - t / .4) * .7, .7);
    }
  }
  function kaihoBranches(f) {
    if (f.br) return f.br;
    const br = [], sx = f.x, sy = f.y - 280;
    for (let i = 0; i < 12; i++) {
      const an = i * TAU / 12 + (hash(f.seed + i) - .5) * .4, rr = f.r * (.4 + hash(f.seed + i * 3) * .55);
      const ex = f.x + Math.cos(an) * rr, ey = f.y + Math.sin(an) * rr, pts = [sx, sy];
      for (let j = 1; j <= 4; j++) {
        const u = j / 4, jit = j < 4 ? (hash(f.seed + i * 7 + j) - .5) * 70 : 0;
        pts.push(lerp(sx, ex, u) + jit, lerp(sy, ey, Math.pow(u, .8)) + jit * .4);
      }
      br.push(pts);
    }
    Object.defineProperty(f, 'br', { value: br, enumerable: false, configurable: true });
    return br;
  }
  function kaihoG(ctx, f, time) {
    if (f.age < f.T) { tCircle(ctx, f.x, f.y, f.r, f.age / f.T, '180,160,220', time); return; }
    const k = K(), t = f.age - f.T, fade = 1 - win(f.age, f.dur - .8, f.dur);
    ctx.fillStyle = `rgba(12,10,18,${.5 * fade})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * .8, f.r * .42, 0, 0, TAU); ctx.fill();
    if (t < .9) { k.fx.shockRing(ctx, f.x, f.y, f.r * 1.3, t / .9, 1 - t / .9, '170,150,210'); }
  }
  function kaihoO(ctx, f, time) {
    const k = K(), sx = f.x, sy = f.y - 280;
    if (f.age < f.T) {
      const g = easeOut(f.age / f.T), R = 20 + 70 * g;
      ctx.strokeStyle = 'rgba(20,16,26,.8)'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const an = time * 3 + i * TAU / 22, ph = (time * 1.5 + hash(i)) % 1, d = R + (1 - ph) * 160;
        ctx.moveTo(sx + Math.cos(an) * d, sy + Math.sin(an) * d * .7); ctx.lineTo(sx + Math.cos(an + .2) * (d - 20), sy + Math.sin(an + .2) * (d - 20) * .7);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, sx, sy, R * 2, '120,90,180', .35, false); ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(ironSphere(), sx - R, sy - R, R * 2, R * 2);
      return;
    }
    const t = f.age - f.T, grow = easeOut(t / .14), fade = 1 - win(f.age, f.dur - .8, f.dur), br = kaihoBranches(f);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = fade;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#5a5468' : '#0e0c13';
      for (const pts of br) {
        const n = 1 + Math.floor(grow * 4 + .001);
        for (let j = 0; j < Math.min(4, n); j++) {
          ctx.lineWidth = pass ? 1.5 : 13 - j * 2.6;
          ctx.beginPath(); ctx.moveTo(pts[j * 2], pts[j * 2 + 1]); ctx.lineTo(pts[j * 2 + 2], pts[j * 2 + 3]); ctx.stroke();
          if (!pass && j >= 1 && j <= 2) {
            const bx = pts[j * 2], by = pts[j * 2 + 1], an = Math.atan2(pts[j * 2 + 3] - by, pts[j * 2 + 2] - bx) + (j % 2 ? .7 : -.7), L = 70 * grow;
            ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(an) * L, by + Math.sin(an) * L); ctx.stroke();
          }
        }
      }
    }
    for (const pts of br) if (grow > .9) ctx.drawImage(spikeSpr(0), pts[8] - 34, pts[9] - 80, 68, 84);
    ctx.globalAlpha = 1;
    if (t < .3) { ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, sx, sy, 220, '200,180,255', 1 - t / .3, true); ctx.globalCompositeOperation = 'source-over'; }
    if (t < 1.2) k.fx.debris(ctx, f.x, f.y, f.r * 1.2, t / 1.2, f.seed, '#141218', 16);
  }

  // ------------------------------------------------------------------ KAKUZU
  function maskAt(ctx, i, x, y, s, alpha, time) {
    ctx.globalCompositeOperation = 'lighter';
    K().glow(ctx, x, y, 38 * s, MASK_RGB[i], .55 * alpha * (.8 + .2 * Math.sin(time * 9 + i)), false);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha; ctx.drawImage(maskSpr(i), x - 22 * s, y - 25 * s, 44 * s, 50 * s); ctx.globalAlpha = 1;
  }
  function zukG(ctx, f, time) {
    if (f.age < f.T) { tCircle(ctx, f.x, f.y, f.r, f.age / f.T, '255,120,40', time); return; }
    const t = f.age - f.T, k = K();
    boomG(ctx, f.x, f.y, f.r, t, '255,170,90');
    ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, f.x, f.y, f.r, '255,100,30', .35 * (1 - win(f.age, f.dur - 1, f.dur)), false, .5); ctx.globalCompositeOperation = 'source-over';
  }
  function zukO(ctx, f, time) {
    const k = K();
    if (f.age < f.w + .2) maskAt(ctx, 0, f.x0, f.y0 - 100, 1.2, win(f.age, 0, .25) * (1 - win(f.age, f.w, f.w + .2)), time);
    if (f.age >= f.w && f.age < f.T) {
      const u = (f.age - f.w) / (f.T - f.w), x = lerp(f.x0, f.x, u), y = lerp(f.y0 - 90, f.y - 30, u) - bell(u) * 120, fire = k.puff('fire');
      for (let j = 4; j >= 1; j--) k.stamp(ctx, fire, lerp(f.x0, f.x, u - j * .06), lerp(f.y0 - 90, f.y - 30, u - j * .06) - bell(u - j * .06) * 120, 46 - j * 6, .6);
      ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, x, y, 110, '255,120,30', .8, true); ctx.globalCompositeOperation = 'source-over';
      k.stamp(ctx, fire, x, y, 56, 1);
    }
    if (f.age >= f.T) {
      const t = f.age - f.T;
      if (t < 1.4) k.fx.fireBlast(ctx, f.x, f.y, f.r, t / 1.4, 1, time, f.seed);
      const on = win(t, .3, .6) * (1 - win(f.age, f.dur - 1, f.dur));
      if (on > 0) for (let i = 0; i < 9; i++) {
        const an = hash(f.seed + i * 1.3) * TAU, d = 190 * Math.sqrt(hash(f.seed + i * 2.9));
        tongue(ctx, k.flame((i + Math.floor(time * 10)) % 6), f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .8, (34 + hash(i) * 30) * on * (.85 + .15 * Math.sin(time * 12 + i)));
      }
    }
  }
  function atsuG(ctx, f, time) {
    if (f.age < f.w) { tCone(ctx, f.x, f.y, f.a, f.reach, f.half, f.age / f.w, '170,240,200', time); return; }
    const t = f.age - f.w, d = Math.min(f.reach, t * 1500), a = 1 - win(t, .3, 1.2);
    ringArc(ctx, f, d, a, 'dust');
  }
  function ringArc(ctx, f, d, a, kind) {
    const k = K(), img = k.puff(kind);
    for (let i = 0; i < 9; i++) {
      const aa = f.a + (i / 8 - .5) * 2 * f.half;
      k.stamp(ctx, img, f.x + Math.cos(aa) * d, f.y + Math.sin(aa) * d, 30 + d * .05, .6 * a, .7);
    }
  }
  function atsuO(ctx, f, time) {
    const k = K();
    if (f.age < f.w + .2) maskAt(ctx, 1, f.x, f.y - 100, 1.2, win(f.age, 0, .25) * (1 - win(f.age, f.w, f.w + .2)), time);
    if (f.age < f.w) return;
    const t = f.age - f.w, d = Math.min(f.reach, t * 1500), a = 1 - win(t, .35, .9);
    if (a <= 0) return;
    ctx.save(); ctx.translate(f.x, f.y - 26);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let j = 0; j < 3; j++) {
      ctx.strokeStyle = `rgba(${j ? '210,255,235' : '140,230,190'},${a * (j ? .8 : .35)})`; ctx.lineWidth = j ? 4 : 26;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, d - j * 40), f.a - f.half, f.a + f.half); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(230,255,245,${.6 * a})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const aa = f.a + (hash(i * 2.7) - .5) * 2 * f.half, dd = d * (.4 + hash(i * 5.1) * .6);
      ctx.moveTo(Math.cos(aa) * dd, Math.sin(aa) * dd); ctx.lineTo(Math.cos(aa) * (dd - 90), Math.sin(aa) * (dd - 90));
    }
    ctx.stroke();
    ctx.restore();
  }
  const GIAN_PAL = ['110,160,255', '170,210,255', '255,255,255'];
  function gianG(ctx, f, time) {
    if (f.age < f.w) { tLine(ctx, f.x, f.y, f.a, f.len, 60, f.age / f.w, '130,180,255', time); return; }
    const k = K(), a = 1 - win(f.age, f.w + .3, f.dur), ca = Math.cos(f.a), sa = Math.sin(f.a);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const d = 60 + i * 140; k.glow(ctx, f.x + ca * d, f.y + sa * d, 110, '90,140,255', .35 * a, false, .45); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function gianO(ctx, f, time) {
    const k = K(), ca = Math.cos(f.a), sa = Math.sin(f.a);
    if (f.age < f.w + .2) {
      const al = win(f.age, 0, .25) * (1 - win(f.age, f.w, f.w + .2));
      maskAt(ctx, 2, f.x, f.y - 100, 1.2, al, time);
      if (f.age < f.w) k.chidoriBall(ctx, f.x + ca * 22, f.y - 40, 16 + 10 * (f.age / f.w), time, f.seed, { pal: GIAN_PAL, body: '120,170,255', base: 'rgba(40,70,190,.8)', power: f.age / f.w, alpha: al, bolts: 6 });
    }
    if (f.age < f.w) return;
    const t = f.age - f.w, a = 1 - win(t, .35, .8);
    if (a <= 0) return;
    const x1 = f.x + ca * 22, y1 = f.y - 38, x2 = f.x + ca * f.len, y2 = f.y + sa * f.len - 26;
    ctx.globalCompositeOperation = 'lighter';
    k.forkedBolt(ctx, x1, y1, x2, y2, f.seed, time, { jitter: 30, alpha: a, width: 5.5, pal: GIAN_PAL, base: 'rgba(40,70,200,.75)', forks: 7, forkLen: 80, rate: 30, snap: true, step: 34 });
    k.forkedBolt(ctx, x1, y1, x2, y2, f.seed + 9, time, { jitter: 46, alpha: a * .7, width: 3, pal: GIAN_PAL, forks: 4, forkLen: 60, rate: 24, snap: true, step: 40 });
    k.glow(ctx, x1, y1, 70, '200,225,255', a, true);
    ctx.globalCompositeOperation = 'source-over';
    if (t < .7) k.fx.lightningBlast(ctx, x2, y2 + 26, 130, t / .7, a, time, f.seed);
  }
  function jioG(ctx, f, time) {
    if (f.age >= f.w) return;
    const p = f.age / f.w;
    for (const g of f.tg) {
      const a = Math.atan2(g.y - f.y, g.x - f.x), L = Math.hypot(g.x - f.x, g.y - f.y);
      tLine(ctx, f.x, f.y, a, L, 36, p, '168,211,144', time);
    }
  }
  function jioO(ctx, f, time) {
    for (let i = 0; i < f.tg.length; i++) {
      const g = f.tg[i], ti = f.w + i * .07;
      const u = win(f.age, ti - .1, ti) * (1 - win(f.age, ti + .45, ti + .8));
      if (u <= 0) continue;
      const x0 = f.x, y0 = f.y - 40, tx = lerp(x0, g.x, u), ty = lerp(y0, g.y - 18, u);
      const dx = tx - x0, dy = ty - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(150,200,120,.25)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx, ty); ctx.stroke();
      for (let j = 0; j < 4; j++) {
        const off = Math.sin(time * 18 + j * 1.7 + i) * 26 * (j - 1.5) / 1.5;
        ctx.strokeStyle = j % 2 ? '#2e2436' : '#110c15'; ctx.lineWidth = 8 - j * 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + dx * .5 + nx * off, y0 + dy * .5 + ny * off, tx, ty); ctx.stroke();
      }
      ctx.fillStyle = '#0d0a10'; ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  function gotaiG(ctx, f, time) {
    const k = K();
    if (f.age < f.w) tCircle(ctx, f.x, f.y, f.r, f.age / f.w, '255,140,60', time);
    for (const b of f.bolts) if (f.age < b.t) tCircle(ctx, b.x, b.y, 95, f.age / b.t, '140,190,255', time);
    if (f.age < f.w) return;
    const t = f.age - f.w, a = win(t, 0, .2) * (1 - win(f.age, f.dur - .9, f.dur));
    scorch(ctx, f.x, f.y, f.r * 1.2, a);
    const sw = k.swirl('akfire', ['#ff8a2a', '#ffd060', '#e8401a', '#ff6a1a'], 10, 1.3, .08, 256, 4);
    ctx.globalCompositeOperation = 'lighter';
    k.spin(ctx, sw, f.x, f.y, f.r, -time * 4, .6 * a, .55);
    k.glow(ctx, f.x, f.y, f.r * 1.1, '255,110,30', .45 * a, false, .55);
    ctx.globalCompositeOperation = 'source-over';
    for (const b of f.bolts) { const tb = f.age - b.t; if (tb >= 0) boomG(ctx, b.x, b.y, 95, tb, '160,200,255'); }
  }
  function gotaiO(ctx, f, time) {
    const k = K();
    if (f.age < f.w + .6) {
      const al = win(f.age, 0, .3) * (1 - win(f.age, f.w + .2, f.w + .6));
      for (let i = 0; i < 5; i++) {
        const an = time * 2 + i * TAU / 5;
        maskAt(ctx, i, f.x0 + Math.cos(an) * 70, f.y0 - 80 + Math.sin(an) * 26, 1, al, time);
      }
    }
    if (f.age < f.w) return;
    const t = f.age - f.w, a = win(t, 0, .2) * (1 - win(f.age, f.dur - .9, f.dur)), fire = k.puff('fire');
    for (let i = 0; i < 14; i++) {
      const an = time * 5 + i * TAU / 14, d = f.r * .92;
      tongue(ctx, k.flame((i + Math.floor(time * 10)) % 6), f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * .55, (70 + 30 * Math.sin(time * 9 + i)) * a);
    }
    for (let i = 0; i < 12; i++) {
      const h = ((time * 220 + i * 40) % 480), an = time * 7 + i * 1.3, rr = 40 + h * .35;
      k.stamp(ctx, fire, f.x + Math.cos(an) * rr, f.y - h + Math.sin(an) * rr * .3, 50 + h * .06, a * (1 - h / 480));
    }
    for (const b of f.bolts) {
      const tb = f.age - b.t;
      if (tb < 0 || tb > .35) continue;
      const al = 1 - tb / .35;
      ctx.globalCompositeOperation = 'lighter';
      k.forkedBolt(ctx, b.x + 70, b.y - 560, b.x, b.y, b.x, time, { jitter: 34, alpha: al, width: 4.5, pal: GIAN_PAL, base: 'rgba(40,70,200,.7)', forks: 4, forkLen: 60, rate: 30, snap: true, step: 40 });
      k.glow(ctx, b.x, b.y - 10, 130, '180,210,255', al, true, .6);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------------------ KONAN
  function shuG(ctx, f, time) {
    if (f.age < f.w) { tCone(ctx, f.x, f.y, f.a, 760, .65, f.age / f.w, '210,184,255', time); return; }
    ctx.fillStyle = 'rgba(20,10,30,.22)'; ctx.beginPath();
    for (const m of f.mv) if (m.l > 0 && f.age >= m.d) { ctx.moveTo(m.x + 8, m.y); ctx.ellipse(m.x, m.y, 8, 3.5, 0, 0, TAU); }
    ctx.fill();
  }
  function shuO(ctx, f, time) {
    const img = shuSpr();
    if (f.age < f.w) {
      const k = easeOut(f.age / f.w);
      for (let i = 0; i < 8; i++) { const an = time * 4 + i * TAU / 8; drawSprite(ctx, img, f.x + Math.cos(an) * 46, f.y - 50 + Math.sin(an) * 20, 24 * k, 24 * k, time * 10); }
      return;
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(210,190,255,.45)'; ctx.lineWidth = 3; ctx.beginPath();
    for (const m of f.mv) if (m.l > 0 && f.age >= m.d) { ctx.moveTo(m.x, m.y - 26); ctx.lineTo(m.x - m.vx * .05, m.y - 26 - m.vy * .05); }
    ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    for (const m of f.mv) if (m.l > 0 && f.age >= m.d) drawSprite(ctx, img, m.x, m.y - 26, 34, 34, time * 22 + m.d * 9);
  }
  function wingOpen(f) { return easeOut(f.age / (f.w * .8)) * (1 - win(f.age, f.dur - .45, f.dur)); }
  function wingG(ctx, f, time) {
    if (f.age < f.w) tCone(ctx, f.x, f.y, f.a, f.reach, f.half, f.age / f.w, '220,200,255', time);
    const o = wingOpen(f);
    if (o <= 0) return;
    const k = K(), flap = 1 + Math.sin(time * 6) * .04;
    ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, f.x, f.y - 90, 170 * o, '210,190,255', .4 * o, false, .8); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, o * 1.3);
    ctx.drawImage(wingSpr(), f.x - 180 * o * flap, f.y - 64 - 150 * o, 360 * o * flap, 230 * o);
    ctx.globalAlpha = 1;
  }
  function wingO(ctx, f, time) {
    if (f.age < f.w) return;
    const t = f.age - f.w;
    ctx.lineJoin = 'round';
    for (let i = 0; i < 26; i++) {
      const aa = f.a + (hash(i * 3.7 + f.seed) - .5) * 2 * f.half * .92, st = hash(i * 1.9) * .12, d = (t - st) * (1500 + hash(i * 5.3) * 400);
      if (d < 20 || d > f.reach + 60) continue;
      const x = f.x + Math.cos(aa) * d, y = f.y + Math.sin(aa) * d - 34, al = 1 - win(d, f.reach - 60, f.reach + 60);
      ctx.save(); ctx.translate(x, y); ctx.rotate(aa); ctx.globalAlpha = al;
      ctx.fillStyle = '#faf8ff'; ctx.strokeStyle = '#9c86d8'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-34, -5); ctx.lineTo(-30, 0); ctx.lineTo(-34, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function flyG(ctx, f, time) {
    for (const b of f.bs) { if (f.age < b.t) tCircle(ctx, b.x, b.y, 90, f.age / b.t, '210,184,255', time); else boomG(ctx, b.x, b.y, 90, f.age - b.t, '255,190,150'); }
  }
  function flyO(ctx, f, time) {
    const k = K(), img = flySpr();
    for (let i = 0; i < f.bs.length; i++) {
      const b = f.bs[i];
      if (f.age >= b.t) { boomO(ctx, b.x, b.y, 90, f.age - b.t, f.seed + i, 'fire'); continue; }
      const u = easeOut(win(f.age, .05 + i * .03, f.w + .45)), x = lerp(f.x, b.x, u) + Math.sin(time * 5 + i) * 14 * (1 - u * .5), y = lerp(f.y - 50, b.y - 34, u) + Math.cos(time * 4 + i) * 8;
      const flap = .3 + .7 * Math.abs(Math.sin(time * 15 + i));
      ctx.save(); ctx.translate(x, y); ctx.scale(flap, 1); ctx.drawImage(img, -24, -20, 48, 40); ctx.restore();
      if (b.t - f.age < .25) { ctx.globalCompositeOperation = 'lighter'; k.glow(ctx, x, y, 40, '255,160,90', 1 - (b.t - f.age) / .25, true); ctx.globalCompositeOperation = 'source-over'; }
    }
  }
  function tornG(ctx, f, time) {
    if (f.age < f.w) { tCircle(ctx, f.x, f.y, f.r, f.age / f.w, '210,184,255', time); return; }
    const a = win(f.age, f.w, f.w + .3) * (1 - win(f.age, f.dur - .4, f.dur));
    ctx.fillStyle = `rgba(30,20,50,${.25 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(220,200,255,${.6 * a})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.4 + i * .3), time * 6 + i, time * 6 + i + 2.2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function tornO(ctx, f, time) {
    if (f.age < f.w) return;
    const a = win(f.age, f.w, f.w + .3) * (1 - win(f.age, f.dur - .4, f.dur)), H = 340;
    // funnel of wind
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3;
    for (let j = 0; j < 6; j++) {
      const h = (j + .5) / 6 * H, rr = 34 + h * .55;
      ctx.strokeStyle = `rgba(235,225,255,${.35 * a})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - h, rr, rr * .3, 0, time * 7 + j, time * 7 + j + 3.6); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a; ctx.lineWidth = 1;
    for (let i = 0; i < 52; i++) {
      const sp = .6 + hash(i * 2.1) * .6, h = (hash(i) * H + time * 150 * sp) % H;
      const an = time * (4.5 + hash(i * 3) * 3) + hash(i * 5) * TAU, rr = 30 + h * .6;
      const x = f.x + Math.cos(an) * rr, y = f.y + Math.sin(an) * rr * .3 - h;
      ctx.save(); ctx.translate(x, y); ctx.rotate(an * 2 + i);
      ctx.fillStyle = i % 3 ? '#f6f2ff' : '#e2d8ff'; ctx.strokeStyle = '#a08ad8';
      ctx.fillRect(-9, -6, 18, 12); ctx.strokeRect(-9, -6, 18, 12);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function kamiG(ctx, f, time) {
    const k = K(), last = f.rings[f.rings.length - 1];
    const cover = f.r * easeOut(f.age / (f.w * .85)), burnt = f.age < f.w ? 0 : Math.min(f.r + 10, f.r * win(f.age, f.w, last.t + .05) + 60);
    const fade = 1 - win(f.age, last.t + .3, last.t + .9);
    if (cover > burnt && fade > 0) {
      ctx.save(); ctx.globalAlpha = .95 * fade;
      ctx.beginPath(); ctx.arc(f.x, f.y, cover, 0, TAU); if (burnt > 0) ctx.arc(f.x, f.y, burnt, 0, TAU, true);
      ctx.translate(f.x, f.y); ctx.fillStyle = carpetPattern(ctx); ctx.fill('evenodd');
      ctx.restore();
    }
    if (f.age < f.w) {
      ctx.lineWidth = 5; ctx.strokeStyle = RIM; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,120,90,${pulseA(time)})`; ctx.stroke();
    }
    if (burnt > 0) scorch(ctx, f.x, f.y, Math.min(burnt, f.r) * 1.25, 1 - win(f.age, f.dur - .8, f.dur));
    for (const g of f.rings) {
      const t = f.age - g.t;
      if (t >= 0 && t < .6 && g.R > 0) k.fx.shockRing(ctx, f.x, f.y, (g.R + 90) * 2, .5 + t / 1.2, (1 - t / .6) * .7, '255,170,110');
    }
  }
  function kamiO(ctx, f, time) {
    const k = K();
    if (f.age < f.w) {
      // sheets of paper peeling off Konan in a storm as the sea spreads
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const an = time * 2 + i * TAU / 18, rr = 60 + ((time * 120 + i * 30) % 220);
        ctx.save(); ctx.translate(f.x + Math.cos(an) * rr, f.y - 40 + Math.sin(an) * rr * .4 - hash(i) * 40); ctx.rotate(an * 3);
        ctx.fillStyle = '#efe6d0'; ctx.fillRect(-8, -4, 16, 8); ctx.fillStyle = '#b8242a'; ctx.fillRect(-1, -4, 2, 8);
        ctx.restore();
      }
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    f.rings.forEach((g, j) => {
      const t = f.age - g.t;
      if (t < 0 || t > .45) return;
      const a = 1 - t / .45;
      for (let i = 0; i < g.n; i++) {
        const an = i * TAU / g.n + j * .37, x = f.x + Math.cos(an) * g.R, y = f.y + Math.sin(an) * g.R - 20;
        if (t < .1) k.glow(ctx, x, y, 90, '255,240,200', 1 - t / .1, true);
        k.glow(ctx, x, y, 130, '255,130,40', .45 * a, false, .7);
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    f.rings.forEach((g, j) => {
      const t = f.age - g.t;
      if (t < 0 || t > .9) return;
      for (let i = 0; i < g.n; i++) {
        const an = i * TAU / g.n + j * .37;
        billow(ctx, f.x + Math.cos(an) * g.R, f.y + Math.sin(an) * g.R, 88 + hash(i * 3 + j) * 30, t - hash(i + j * 7) * .06, j * 31 + i * 7.3, 1);
      }
    });
  }

  // ------------------------------------------------------------------ HIDAN
  function scyG(ctx, f, time) {
    if (f.age < f.w) tCone(ctx, f.x, f.y, f.a, f.r, f.half, f.age / f.w, '255,90,110', time);
  }
  function scyO(ctx, f, time) {
    const swing = (t0, dir) => {
      const t = f.age - t0;
      if (t < 0 || t > .55) return;
      const p = easeOut(t / .14), al = 1 - win(t, .18, .55), from = f.a - dir * f.half, to = from + dir * 2 * f.half * p;
      ctx.save(); ctx.translate(f.x, f.y - 24);
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 3; j++) {
        const rr = f.r * (1 - j * .14);
        sector(ctx, 0, 0, rr * .55, rr, Math.min(from, to), Math.max(from, to));
        ctx.fillStyle = `rgba(255,${40 + j * 30},${60 + j * 20},${.22 * al})`; ctx.fill();
        ctx.strokeStyle = `rgba(255,${200 - j * 50},${210 - j * 50},${.9 * al})`; ctx.lineWidth = 4 - j;
        ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(from, to), Math.max(from, to)); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      drawSprite(ctx, scytheSpr(), Math.cos(to) * 70, Math.sin(to) * 70 - 10, 80, 80, to + Math.PI / 2);
      ctx.restore();
    };
    swing(f.w, 1); swing(f.w + .42, -1);
  }
  function chainTip(f) {
    const t = f.age - f.w;
    let d = 0;
    if (t < 0) d = 0;
    else if (t < .42) d = f.len * easeOut(t / .42);
    else if (t < .5) d = f.len;
    else d = f.len * (1 - easeIn((t - .5) / .42));
    return Math.max(0, d);
  }
  function chainG(ctx, f, time) {
    if (f.age < f.w) tLine(ctx, f.x, f.y, f.a, f.len, 58, f.age / f.w, '255,110,130', time);
  }
  function chainO(ctx, f, time, z) {
    if (f.age < f.w) return;
    const d = chainTip(f), ca = Math.cos(f.a), sa = Math.sin(f.a);
    if (d < 4) return;
    const hx = z.x + ca * 14, hy = z.y - 44, tx = f.x + ca * d, ty = f.y + sa * d - 30;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2428'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#a8a2ac'; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
    drawSprite(ctx, scytheSpr(), tx, ty, 74, 74, time * 24);
  }
  function jasG(ctx, f, time) {
    const k = K(), img = sigilSpr(), r = f.r;
    const fade = 1 - win(f.age, f.dur - .5, f.dur);
    if (f.age < f.w) {
      tCircle(ctx, f.x, f.y, r, f.age / f.w, '220,30,60', time);
      const p = f.age / f.w;
      ctx.save(); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, r + 20, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.closePath(); ctx.clip();
      ctx.drawImage(img, f.x - r, f.y - r, r * 2, r * 2); ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, f.x, f.y, r * 1.2, '220,20,50', (.35 + .15 * Math.sin(time * 6)) * fade, false, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade; ctx.drawImage(img, f.x - r, f.y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    const mist = k.puff('steam');
    for (let i = 0; i < 6; i++) { const an = time * .6 + i * TAU / 6, ph = (time * .5 + hash(i)) % 1; k.stamp(ctx, mist, f.x + Math.cos(an) * r * .8, f.y + Math.sin(an) * r * .8 - ph * 40, 30 + ph * 20, bell(ph) * .35 * fade); }
  }
  function bloodG(ctx, f, time) {
    for (const g of f.rings) {
      if (f.age < g.t) tRing(ctx, f.x, f.y, Math.max(0, g.R - 74), g.R + 74, f.age / g.t, '230,40,70', time);
      else {
        const fade = 1 - win(f.age, f.dur - .5, f.dur);
        ctx.fillStyle = `rgba(110,0,14,${.5 * fade})`; ctx.beginPath();
        for (let i = 0; i < g.n; i++) { const an = i * TAU / g.n + f.rings.indexOf(g) * .4, x = f.x + Math.cos(an) * g.R, y = f.y + Math.sin(an) * g.R; ctx.moveTo(x + 30, y); ctx.ellipse(x, y, 30, 13, 0, 0, TAU); }
        ctx.fill();
      }
    }
  }
  function bloodO(ctx, f, time, z) {
    const k = K();
    if (f.age < f.w) {
      const steam = k.puff('steam');
      for (let i = 0; i < 4; i++) k.stamp(ctx, steam, z.x + (hash(i + Math.floor(time * 8)) - .5) * 30, z.y - 50 - hash(i * 3 + Math.floor(time * 8)) * 30, 14, .7);
    }
    const sink = 1 - win(f.age, f.dur - .4, f.dur);
    f.rings.forEach((g, j) => {
      const t = f.age - g.t;
      if (t < 0) return;
      const rise = easeOut(t / .08) * sink;
      for (let i = 0; i < g.n; i++) {
        const an = i * TAU / g.n + j * .4, x = f.x + Math.cos(an) * g.R, y = f.y + Math.sin(an) * g.R, h = 92 * rise;
        if (h > 2) ctx.drawImage(spikeSpr(1), x - 36, y - h, 72, h);
        if (t < .4) k.stamp(ctx, k.puff('steam'), x, y - 30 - t * 60, 22 + t * 30, (1 - t / .4) * .7);
      }
    });
  }
  function ritG(ctx, f, time) {
    const k = K(), img = sigilSpr(), r = f.r;
    if (f.age < f.w) {
      const p = f.age / f.w;
      tCircle(ctx, f.x, f.y, r, p, '230,30,60', time);
      ctx.save(); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, r + 20, -Math.PI / 2, -Math.PI / 2 + TAU * easeOut(p * 1.3)); ctx.closePath(); ctx.clip();
      ctx.drawImage(img, f.x - r, f.y - r, r * 2, r * 2); ctx.restore();
      return;
    }
    const t = f.age - f.w, fade = 1 - win(f.age, f.dur - .8, f.dur);
    ctx.globalCompositeOperation = 'lighter';
    k.glow(ctx, f.x, f.y, r * 1.3, '255,30,60', .8 * (1 - win(t, 0, .8)) + .2 * fade, false, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade; ctx.drawImage(img, f.x - r, f.y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    if (t < 1) { k.fx.shockRing(ctx, f.x, f.y, r * 1.4, t, 1 - t, '255,60,80'); k.fx.shockRing(ctx, f.x, f.y, r * 1.9, t, (1 - t) * .5, '255,220,220'); }
    scorch(ctx, f.x, f.y, r * .6, fade);
  }
  function ritO(ctx, f, time) {
    const k = K(), t = f.age - f.w;
    if (t > -.18 && t < .1) {
      // the black stake of the ritual plunges into the heart of the sigil
      const u = clamp01((t + .18) / .18), y = lerp(f.y - 760, f.y, easeIn(u));
      ctx.fillStyle = '#0c0608'; ctx.strokeStyle = 'rgba(255,60,80,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, y); ctx.lineTo(f.x - 12, y - 200); ctx.lineTo(f.x + 12, y - 200); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (t >= 0 && t < .45) {
      const a = 1 - t / .45;
      ctx.globalCompositeOperation = 'lighter';
      k.glow(ctx, f.x, f.y - 60, f.r * 1.2, '255,60,80', a, true);
      k.forkedBolt(ctx, f.x + 40, f.y - 620, f.x, f.y, f.seed, time, { jitter: 40, alpha: a, width: 6, pal: ['255,30,50', '255,120,130', '255,240,240'], base: 'rgba(120,0,20,.8)', forks: 6, forkLen: 90, rate: 30, snap: true, step: 44 });
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t >= 0 && t < 1.4) {
      const u = t / 1.4;
      ringPuffs(ctx, f.x, f.y, f.r * (.5 + u * .5), 14, 50, 1 - u, 'steam', f.seed, bell(u) * 150);
      k.fx.debris(ctx, f.x, f.y, f.r * 1.2, u, f.seed, '#4a0610', 16);
    }
    const t2 = t - .35;
    if (t2 >= 0 && t2 < .45) {
      const a = 1 - t2 / .45;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let j = 0; j < 4; j++) {
        const an = j * Math.PI / 4 + .2, dx = Math.cos(an) * f.r, dy = Math.sin(an) * f.r;
        ctx.strokeStyle = `rgba(255,40,70,${.5 * a})`; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(f.x - dx, f.y - dy - 20); ctx.lineTo(f.x + dx, f.y + dy - 20); ctx.stroke();
        ctx.strokeStyle = `rgba(255,230,230,${.9 * a})`; ctx.lineWidth = 6; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------------------ draw passes
  const GROUND = { rods: rodsG, shinra: shinraG, bansho: banshoG, asura: asuraG, chibaku: chibakuG,
    ama: amaG, crows: crowsG, goka: gokaG, tsuku: tsukuG, sus: susG,
    sharks: sharksG, daiko: daikoG, suiro: suiroG, same: sameG, sea: seaG,
    birds: birdsG, c2: c2G, c3: c3G, c4: c4G, c0: c0G,
    iron: ironG, pup: pupG, poison: poisonG, spk: spkG, kaiho: kaihoG,
    zuk: zukG, atsu: atsuG, gian: gianG, jio: jioG, gotai: gotaiG,
    shu: shuG, wing: wingG, fly: flyG, torn: tornG, kami: kamiG,
    scy: scyG, chain: chainG, jas: jasG, blood: bloodG, rit: ritG };
  const OVER = { rods: rodsO, shinra: shinraO, bansho: banshoO, asura: asuraO, chibaku: chibakuO,
    ama: amaO, crows: crowsO, goka: gokaO, tsuku: tsukuO, sus: susO,
    sharks: sharksO, daiko: daikoO, suiro: suiroO, same: sameO, sea: seaO,
    birds: birdsO, c2: c2O, c3: c3O, c4: c4O, c0: c0O,
    iron: ironO, pup: pupO, poison: poisonO, spk: spkO, kaiho: kaihoO,
    zuk: zukO, atsu: atsuO, gian: gianO, jio: jioO, gotai: gotaiO,
    shu: shuO, wing: wingO, fly: flyO, torn: tornO, kami: kamiO,
    scy: scyO, chain: chainO, rit: ritO, blood: bloodO };
  // Ground layers in back-to-front order: big floods and carpets first, telegraphs on top.
  const LAYER = { sea: 0, kami: 0, tsuku: 1, jas: 1, gotai: 1, poison: 1 };

  // When the boss is dead the game stops calling update; keep effects aging so nothing freezes mid-air.
  function visualAge(z, s, time) {
    const dt = s.lastDraw ? Math.max(0, Math.min(.1, time - s.lastDraw)) : 0;
    s.lastDraw = time;
    if (z.health > 0 || !dt) return;
    s.windup = 0; s.move = ''; s.ev.length = 0;
    for (let i = s.fx.length - 1; i >= 0; i--) { s.fx[i].age += dt; if (s.fx[i].age >= s.fx[i].dur) s.fx.splice(i, 1); }
  }

  function draw(ctx, z, time) {
    const m = z && members[z.bossId], s = z && z.ak;
    if (!m || !s || !window.VFXKit) return;
    visualAge(z, s, time);
    if (!s.fx.length) return;
    ctx.save();
    for (let pass = 0; pass < 3; pass++) {
      for (const f of s.fx) {
        const layer = LAYER[f.k] === undefined ? 2 : LAYER[f.k];
        if (layer !== pass) continue;
        const fn = GROUND[f.k];
        if (fn) { fn(ctx, f, time, z, s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx, z, time) {
    const m = z && members[z.bossId], s = z && z.ak;
    if (!m || !s || !window.VFXKit) return;
    ctx.save();
    for (const f of s.fx) {
      const fn = OVER[f.k];
      if (fn) { fn(ctx, f, time, z, s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (z.health > 0 && s.guard > 0) {
      // Yata mirror / Doton Domu / Jashin's blessing: the boss shrugs off most damage
      const rgb = z.bossId === 'kakuzu' ? '150,130,110' : z.bossId === 'hidan' ? '230,30,60' : '255,150,110';
      ctx.globalCompositeOperation = 'lighter';
      K().glow(ctx, z.x, z.y - 46, 70, rgb, .35 * Math.min(1, s.guard * 2) * (.8 + .2 * Math.sin(time * 8)), false, 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (z.health > 0 && s.windup > 0 && s.move) {
      // Jutsu name called out above the boss's head, anime-style.
      const def = MOVES[s.move], label = def.label, labelY = z.y - 132;
      ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#160f1d'; ctx.strokeText(label, z.x, labelY);
      ctx.fillStyle = def.ult ? '#fff1c8' : m.accent; ctx.fillText(label, z.x, labelY);
    }
    ctx.restore();
  }

  window.AkatsukiBosses = { members, order, moveLabels, pick, update, draw, drawOverlay };
})();
