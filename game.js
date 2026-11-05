(() => {
  'use strict';

  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('minimap');
  const mctx = mapCanvas.getContext('2d');
  const ui = {
    start: document.getElementById('startScreen'), pause: document.getElementById('pauseScreen'),
    over: document.getElementById('gameOverScreen'), hud: document.getElementById('hud'),
    health: document.getElementById('healthBar'), healthValue: document.getElementById('healthValue'),
    armor: document.getElementById('armorBar'),
    wave: document.getElementById('wave'), kills: document.getElementById('kills'),
    score: document.getElementById('score'), weapon: document.getElementById('weapon'),
    bossBar: document.getElementById('bossBar'), bossHealth: document.getElementById('bossHealthBar'),
    bossName: document.getElementById('bossName'), eventText: document.getElementById('eventText'),
    prompt: document.getElementById('prompt'), toast: document.getElementById('toast'),
    nineTailsStatus: document.getElementById('nineTailsStatus'), gatesStatus: document.getElementById('gatesStatus'),
    rinneganStatus: document.getElementById('rinneganStatus'), sixPathsStatus: document.getElementById('sixPathsStatus'),
    susanooStatus: document.getElementById('susanooStatus'),
    skillB: document.getElementById('skillB'),
    skillBar: document.getElementById('skillBar'), skillG: document.getElementById('skillG'),
    skillE: document.getElementById('skillE'), skillV: document.getElementById('skillV'), skillH: document.getElementById('skillH'),
    skillQ: document.getElementById('skillQ'), skillSpace: document.getElementById('skillSpace'), skillX: document.getElementById('skillX')
  };

  // The shinobi world: Konoha (14x14 blocks) in the Land of Fire, linked by roads to Suna, Kiri,
  // Kumo and Iwa (10x10 blocks each), plus the minor villages Ame, Oto, Taki, Kusa and Yu (7x7).
  // world-map.js owns the layout and the land between villages.
  const LAYOUT = window.WorldMap.layout;
  const WORLD = { w: LAYOUT.world.w, h: LAYOUT.world.h, road: 150, block: 520 };
  const KONOHA = LAYOUT.konoha;
  // Players start on the road beside the Hokage Residence.
  const START = { x: KONOHA.x + 6 * 520 + 75, y: KONOHA.y + 4 * 520 + 75 };
  // Konoha's own buildings/grid in its local coordinates (konoha-world.js draws in those).
  const konohaWorld = { WORLD: { w: KONOHA.size, h: KONOHA.size }, buildings: [], buildingGrid: [], lanterns: [] };
  const villageList = [];
  let regionName = '', regionTimer = 0;
  let largeMapRect = null;
  const keys = Object.create(null);
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
  let W = 0, H = 0, dpr = 1, running = false, paused = false, last = 0, loopActive = false;
  let shake = 0, elapsed = 0, gameTime = 16, toastTimer = 0, largeMap = false;
  let hudTimer = 0, renderBounds = null;
  const frameStats = { fps: 0, avgUpdateMs: 0, avgRenderMs: 0, maxFrameMs: 0, loops: 0 };
  let sampleStarted = 0, sampleFrames = 0, sampleUpdateMs = 0, sampleRenderMs = 0, sampleMaxFrameMs = 0;
  window.shinobiStats = frameStats;
  const camera = { x: 0, y: 0 };
  // The static world (ground, houses, trees) is cached in 512px tiles. Only tiles scrolling into
  // view, or whose houses collapsed, get painted — a few per frame — so moving never hitches.
  const TILE = 512, TILE_PAD = 320, MAX_TILES = 56;
  const tiles = new Map(), tilePool = [];
  let tileClock = 0;

  // `me` is this browser's ninja. On the co-op host, enemy logic briefly rebinds
  // `player` to whichever teammate an enemy is fighting; it is `me` everywhere else.
  const me = {
    x: 75, y: 420, r: 13, angle: 0, health: 100, maxHealth: 100, armor: 35, score: 0, kills: 0,
    speed: 0, weapon: 'staff', fireCooldown: 0, invuln: 0, nineTails: false, gates: false, punch: 0, punchCount: 0, rinnegan: false, rinPulse: 0, rinCount: 0, bCount: 0, sixPaths: false, spLift: 0, spCount: 0, susanoo: false, suCount: 0, clickMode: null,
    flash: 0, swing: 0, swingAngle: 0, castPose: 0, stride: 0, down: 0
  };
  let player = me;
  // Characters are upright sprites: projectiles and hand-held jutsu travel at chest height.
  const LIFT = window.AnimeSprites ? window.AnimeSprites.LIFT : 0;
  const HAND_HEIGHT = 20;
  const HOKAGE_SPRITES = ['hashirama', 'tobirama', 'hiruzen', 'minato'];
  const HOKAGE_LABELS = ['HASHIRAMA · ĐỆ I', 'TOBIRAMA · ĐỆ II', 'HIRUZEN · ĐỆ III', 'MINATO · ĐỆ IV'];
  const HOKAGE_COLORS = ['#85d367', '#78d8ff', '#ff9a54', '#ffe179'];
  const drawQueue = [];
  const minimapBase = document.createElement('canvas');
  let minimapReady = false;
  const zombies = [], bullets = [], particles = [], effects = [], bloodDecals = [];
  const destructionState = { ruins: [], scars: [], view: null };
  const MAX_GROUND_SCARS = 110;
  const BOSS_POWER_MULTIPLIER = 5;
  // Every enemy hits harder and takes more to bring down than its base stats.
  const ENEMY_HP_POWER = 1.8, ENEMY_DAMAGE_POWER = 1.5;
  const BARYON_DAMAGE_MULTIPLIER = 2.4;
  // Eight Gates mode (Y).
  const GATES_SPEED = 1.85, GATES_PUNCH_INTERVAL = .2, GATES_PUNCH_DAMAGE = 380, GATES_HEALTH = 30, GATES_REGEN = .03;
  // The player's gate techniques reach this much further than Guy's; a plain punch hits this far.
  const GATES_REACH = 1.8, GATES_PUNCH_RANGE = 300;
  // Left click in the Eight Gates walks this twelve-step combo; held down, it loops.
  const GATES_COMBO = ['punch', 'senpu', 'punch', 'peacock', 'entry', 'punch', 'elephant', 'lotus', 'punch', 'tiger', 'ranbu', 'yagai'];
  const SENPU = { radius: 520, tick: 420, final: 950 };
  const ENTRY = { range: 760, radius: 420, damage: 1800, air: .42 };
  const LOTUS = { hops: 12, hop: 520, damage: 1300, radius: 480, bloom: 2600, step: .07 };
  const RANBU = { range: 650, rings: [[0, 1], [240, 6], [470, 10]], radius: 130, damage: 1050, step: .03, life: 1.6 };
  const YAGAI = { range: 1050, path: 150, radius: 620, damage: 5400 };
  // Six Paths mode (I): its jutsu live in six-paths-mode.js.
  const SIXPATHS_HEALTH = 100, SIXPATHS_REGEN = .025, SIXPATHS_SPEED = 2.3;
  // Susanoo mode (O): its jutsu live in susanoo-mode.js. The ribcage and armour soak most of every hit.
  const SUSANOO_HEALTH = 40, SUSANOO_REGEN = .02, SUSANOO_GUARD = .35;
  // Rinnegan mode (U).
  const RINNEGAN_HEALTH = 20, RINNEGAN_REGEN = .02, SHINRA_RADIUS = 320, BANSHO_RANGE = 620, BANSHO_RADIUS = 190;
  const CHIBAKU_RADIUS = 300, CHIBAKU_LIFE = 3.4, CHIBAKU_RANGE = 560, GAKIDO_RADIUS = 85;
  // Baryon mode's own taijutsu on left click (damage before the Baryon ×2.4 multiplier).
  const BARYON_FIST_RANGE = 260, BARYON_TAILS_RANGE = 300, BARYON_ARM_RADIUS = 240, BARYON_ARM_RANGE = 620, BARYON_ARM_LIFE = 1.3;
  const MAX_CHARGE_SECONDS = 2.4;
  const MAX_PURPLE_CHARGE_SECONDS = 2.4;
  // These clocks drive entrance/finisher VFX; summoned allies no longer expire.
  const MIGHT_GUY_VFX_SPAN = 18;
  const MAX_CLONES = 8;
  // Clones are frailer than Naruto: 30% of his max health (Baryon included).
  const CLONE_HEALTH = .3;
  let nextCloneId = 0;
  // Waves no longer start on their own: players call enemies in from the spawn panel (N).
  const AUTO_WAVES = false;
  const MAX_ALIVE = 600, MAX_SPAWN_REQUEST = 500;
  const spawnQueue = [];
  const HOKAGE_VFX_SPAN = 18;
  // Hiruzen summons Enma .5s after arriving; the Monkey King turns into the Adamantine Staff at ENMA_READY.
  const ENMA_APPEAR = .5, ENMA_READY = 2.3;
  const NIGHT_GUY_COOLDOWN = 15;
  const waveState = { number: 0, total: 0, spawned: 0, spawnTimer: 0, intermission: 0, boss: null };
  const SKILLS = {
    KeyQ: { name: 'HỎA ĐỘN' },
    KeyE: { name: 'ẢNH PHÂN THÂN' },
    KeyC: { name: 'TRIỆU HỒI THẬP VĨ' },
    KeyV: { name: 'MIGHT GUY · BÁT MÔN TỬ MÔN' },
    KeyH: { name: 'TRIỆU HỒI TỨ ĐẠI HOKAGE' },
    KeyF: { name: 'CHIDORI' },
    Space: { name: 'RASENGAN' },
    KeyX: { name: 'RASEN SHURIKEN' },
    KeyG: { name: 'VĨ THÚ NGỌC' },
    KeyB: { name: 'TRIỆU HỒI SASUKE · INDRA' }
  };
  const skillState = {
    fireballs: [], fireSeas: [], tags: [], beastBombs: [], rasenShurikens: [], clones: [], summons: [],
    trails: [], vortices: [], explosions: [], charge: null
  };
  const purpleChidoriState = { trails: [], bursts: [], charge: null, player: me };
  const mightGuyState = { ally: null, afterimages: [], finishers: [], tigers: [], moves: [] };
  const rinneganState = { effects: [] };
  const baryonState = { effects: [] };
  // Six Paths mode (I) and the summoned Sasuke (B). Both must stay plain JSON: they are sent to co-op teammates.
  const sixPathsState = { effects: [] };
  const indraState = { ally: null, effects: [] };
  const susanooState = { effects: [] };
  const hokageState = { allies: [], effects: [] };
  const skillEffectLimits = { fireballs: 12, fireSeas: 3, tags: 24, beastBombs: 4, rasenShurikens: 6,
    clones: 8, summons: 1, trails: 32, vortices: 4, explosions: 16 };
  let nextZombieId = 0;
  const WEAPONS = {
    staff: { name: 'TRƯỢNG LỤC ĐẠO', interval: .44, damage: 115, range: 125, arc: 1.7, color: '#ac9dff' },
    susano: { name: 'SONG KIẾM SUSANO', interval: .27, damage: 170, range: 155, arc: 1.95, color: '#b37bff' },
    // Thrown shinobi tools: shuriken fly fast and pierce; a Baryon throws a fan of three.
    shuriken: { name: 'PHI TIÊU', interval: .15, damage: 40, pellets: 1, fan: 3, spread: .14, velocity: 980, life: .8, color: '#cfd8dc', pierce: 2 },
    // Kunai with an explosive tag stick where they land and blow up a moment later.
    kunai: { name: 'KUNAI BÙA NỔ', interval: .5, damage: 55, pellets: 1, spread: .02, velocity: 820, life: .75, color: '#f2d24a', pierce: 1, tag: true }
  };
  const ZOMBIE_TYPES = {
    walker: { name: 'Ninja phi tiêu', hp: 98, speed: 98, damage: 14, radius: 17, score: 100, color: '#4b6975' },
    runner: { name: 'Ninja Lôi Độn', hp: 82, speed: 178, damage: 16, radius: 15, score: 150, color: '#5b87ae' },
    brute: { name: 'Ninja Thổ Độn', hp: 330, speed: 76, damage: 28, radius: 25, score: 350, color: '#8c7154' },
    spitter: { name: 'Ninja Hỏa Độn', hp: 120, speed: 92, damage: 20, radius: 18, score: 220, color: '#aa5a43' },
    boss: { name: 'BOSS AKATSUKI', hp: 1250, speed: 100, damage: 42, radius: 40, score: 3000, color: '#6b4b8f' },
    // Tailed beasts: giant, very tanky; each tail adds 15% more health.
    beast: { name: 'VĨ THÚ', hp: 26000, speed: 66, damage: 55, radius: 48, score: 12000, color: '#c9a05a' },
    // Village defenders: elite ninjas with their land's signature jutsu.
    suna_ninja: { name: 'Ninja Làng Cát', hp: 640, speed: 125, damage: 32, radius: 17, score: 600, color: '#c9a66a', style: 'suna', fallback: 'walker' },
    kiri_ninja: { name: 'Ninja Làng Sương Mù', hp: 720, speed: 145, damage: 36, radius: 17, score: 650, color: '#6f9aa8', style: 'kiri', fallback: 'spitter' },
    kumo_ninja: { name: 'Ninja Làng Mây', hp: 680, speed: 175, damage: 34, radius: 17, score: 650, color: '#e8e4d0', style: 'kumo', fallback: 'runner' },
    iwa_ninja: { name: 'Ninja Làng Đá', hp: 920, speed: 105, damage: 40, radius: 20, score: 700, color: '#9a5a3a', style: 'iwa', fallback: 'brute' },
    // Minor villages: lighter defenders; `jutsu` borrows a great village's move set.
    ame_ninja: { name: 'Ninja Làng Mưa', hp: 560, speed: 140, damage: 30, radius: 17, score: 500, color: '#5d6b80', style: 'ame', jutsu: 'kiri', fallback: 'walker' },
    oto_ninja: { name: 'Ninja Làng Âm Thanh', hp: 540, speed: 150, damage: 31, radius: 17, score: 500, color: '#6a5a7a', style: 'oto', jutsu: 'suna', fallback: 'spitter' },
    taki_ninja: { name: 'Ninja Làng Thác Nước', hp: 580, speed: 135, damage: 30, radius: 17, score: 500, color: '#4f8f86', style: 'taki', jutsu: 'kiri', fallback: 'walker' },
    kusa_ninja: { name: 'Ninja Làng Cỏ', hp: 520, speed: 155, damage: 28, radius: 17, score: 480, color: '#6f9a4a', style: 'kusa', jutsu: 'iwa', fallback: 'runner' },
    zetsu_white: { name: 'Bạch Zetsu', hp: 150, speed: 128, damage: 16, radius: 16, score: 140, color: '#e6e4da', fallback: 'walker' },
    konoha_ninja: { name: 'Ninja Làng Lá', hp: 760, speed: 150, damage: 36, radius: 17, score: 650, color: '#5d7a3b', style: 'konoha', fallback: 'walker' },
    yu_ninja: { name: 'Ninja Làng Suối Nóng', hp: 600, speed: 130, damage: 32, radius: 18, score: 520, color: '#b0664a', style: 'yu', jutsu: 'kumo', fallback: 'brute' }
  };
  const VILLAGE_NINJA = { konoha: 'konoha_ninja', suna: 'suna_ninja', kiri: 'kiri_ninja', kumo: 'kumo_ninja', iwa: 'iwa_ninja',
    ame: 'ame_ninja', oto: 'oto_ninja', taki: 'taki_ninja', kusa: 'kusa_ninja', yu: 'yu_ninja' };
  const STYLE_ACCENT = { konoha: '#8fd062', suna: '#e0b46a', kiri: '#7fd0ff', kumo: '#ffe45a', iwa: '#c8956a',
    ame: '#9fb4d8', oto: '#b58aff', taki: '#6fe0c8', kusa: '#9fe06a', yu: '#ff9a6a' };
  // Minor villages have no Kage; an Akatsuki member born there answers the alarm instead.
  const VILLAGE_LEADER = { ame: 'pain', taki: 'kakuzu', yu: 'hidan' };
  const VILLAGE_NINJA_TYPES = Object.values(VILLAGE_NINJA);
  function bossModuleFor(faction) {
    return faction === 'otsutsuki' ? window.OtsutsukiBosses : faction === 'kage' ? window.KageBosses
      : faction === 'madara' ? window.MadaraBosses : faction === 'sannin' ? window.SanninBosses
      : faction === 'hokage' ? window.HokageBosses : faction === 'legend' ? window.LegendBosses
      : faction === 'bee' ? window.KillerBeeBoss : faction === 'nagato' ? window.NagatoBoss
      : faction === 'sasuke' ? window.SasukeBoss : faction === 'tobi' ? window.TobiBoss : faction === 'zetsu' ? window.ZetsuBoss
      : faction === 'danzo' ? window.DanzoBoss : faction === 'jubi' ? window.TenTailsBoss : window.AkatsukiBosses;
  }
  function bossModuleOf(z) {
    if (!z || z.type !== 'boss' || !z.bossId) return null;
    return bossModuleFor(z.bossFaction);
  }
  // Set while enemies act, so houses they knock down don't raise a village alarm.
  let enemyAction = false;
  const villageAlert = {};
  const isGiant = z => z.type === 'boss' || z.type === 'beast';
  let nextBeast = 0;
  // Co-op session (see the "Co-op" section below). role: 'solo' | 'host' | 'client'.
  const COOP_COLORS = window.CoopNet ? window.CoopNet.COLORS : ['#ffb43a', '#5fc8ff', '#8fd062', '#ff6f91'];
  const net = { role: 'solo', id: 0, slot: 0, peers: new Map(), hits: new Map(), impacts: [],
    hostile: [], fx: [], proxies: new Map(), applying: false, sendTimer: 0, snapTimer: 0, snapSeq: 0, over: false };
  const coop = () => net.role !== 'solo';
  // Players enemies may attack this frame (the host fills it with teammates too).
  const targetList = [me];
  // Collision footprints; konoha-world.js paints the village and fills `lanterns` with glow spots.
  const buildings = [], lanterns = [];
  const SOLID_HEALTH = 2600;
  const buildingGrid = [];

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const roadCenter = n => Math.round((n - WORLD.road / 2) / WORLD.block) * WORLD.block + WORLD.road / 2;
  const onRoad = (x, y) => (x % WORLD.block < WORLD.road || y % WORLD.block < WORLD.road);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (window.PostFX) window.PostFX.resize();
  }

  function buildCity() {
    buildings.length = lanterns.length = 0;
    buildingGrid.length = 0;
    const B = WORLD.block;
    const addBuilding = foot => {
      const cellX = Math.floor(foot.x / B), cellY = Math.floor(foot.y / B), index = cellX + cellY;
      // roof/wall/type only tint the rubble when a building collapses (DestructionVFX).
      const building = {
        x: foot.x, y: foot.y, w: foot.w, h: foot.h,
        roof: foot.roof || ['#d6673c', '#3f8c84', '#4a6ea6', '#b9472f'][index % 4],
        wall: foot.wall || ['#efe3c8', '#e8d7b4', '#f2ead8', '#dccaa6'][index % 4],
        // Village walls, cliffs and rock spires are "solid": far tougher than a house, but big jutsu still bring them down.
        type: index % 4, health: foot.solid ? SOLID_HEALTH : 420, maxHealth: foot.solid ? SOLID_HEALTH : 420, solid: !!foot.solid,
        destroyed: false, collapseLife: 0, collapseMaxLife: .85
      };
      buildings.push(building);
      if (!buildingGrid[cellX]) buildingGrid[cellX] = [];
      buildingGrid[cellX][cellY] = building;
      return building;
    };
    // Konoha: forest and valley blocks have no house; the valley statues are solid, unbreakable stone.
    konohaWorld.buildings.length = konohaWorld.buildingGrid.length = konohaWorld.lanterns.length = 0;
    const cells = KONOHA.size / B;
    for (let cx = 0; cx < cells; cx++) for (let cy = 0; cy < cells; cy++) {
      const foot = window.KonohaWorld.footprint(cx, cy);
      if (!foot) continue;
      const b = addBuilding({ ...foot, x: foot.x + KONOHA.x, y: foot.y + KONOHA.y });
      if (!konohaWorld.buildingGrid[cx]) konohaWorld.buildingGrid[cx] = [];
      konohaWorld.buildingGrid[cx][cy] = b;
      konohaWorld.buildings.push(b);
      b.village = 'konoha';
    }
    window.KonohaWorld.init(konohaWorld);
    for (const l of konohaWorld.lanterns) lanterns.push({ x: l.x + KONOHA.x, y: l.y + KONOHA.y });
    // The other hidden villages (village-*.js), each in its slot of the layout.
    villageList.length = 0;
    for (const [id, slot] of Object.entries(LAYOUT.villages)) {
      const mod = window.ShinobiVillages && window.ShinobiVillages[id];
      if (!mod) continue;
      try {
        mod.init();
        const list = mod.footprints().map(f => addBuilding({ ...f, x: f.x + slot.x, y: f.y + slot.y }));
        for (const b of list) b.village = id;
        villageList.push({ id, mod, x: slot.x, y: slot.y, size: slot.size || LAYOUT.villageSize, buildings: list });
        for (const l of mod.lanterns || []) lanterns.push({ x: l.x + slot.x, y: l.y + slot.y });
      } catch (error) { console.error('village', id, error); }
    }
    window.WorldMap.init();
    minimapReady = false;
    invalidateStatic();
  }

  function resetGame() {
    player = me;
    // Co-op teammates start side by side at the village's west road.
    Object.assign(me, { x: START.x, y: START.y + (net.role === 'solo' ? 0 : net.slot * 34), health: 100, maxHealth: 100, armor: 35, score: 0, kills: 0,
      speed: 0, weapon: 'staff', fireCooldown: 0, invuln: 1, nineTails: false, gates: false, punch: 0, punchCount: 0, rinnegan: false, rinPulse: 0, rinCount: 0, bCount: 0, sixPaths: false, spLift: 0, spCount: 0, susanoo: false, suCount: 0, clickMode: null,
      flash: 0, swing: 0, swingAngle: 0, castPose: 0, stride: 0, down: 0 });
    net.hits.clear(); net.impacts.length = 0; net.hostile.length = 0; net.fx.length = 0;
    net.proxies.clear(); net.over = false;
    paintPortrait();
    zombies.length = bullets.length = particles.length = effects.length = bloodDecals.length = 0;
    enemyBuckets.clear();
    skillState.fireballs.length = skillState.fireSeas.length = skillState.tags.length = skillState.beastBombs.length = skillState.rasenShurikens.length =
      skillState.clones.length = skillState.summons.length = skillState.trails.length =
      skillState.vortices.length = skillState.explosions.length = 0;
    skillState.charge = null;
    purpleChidoriState.trails.length = purpleChidoriState.bursts.length = 0;
    purpleChidoriState.charge = null;
    mightGuyState.ally = null;
    mightGuyState.afterimages.length = mightGuyState.finishers.length = mightGuyState.tigers.length = mightGuyState.moves.length = 0;
    me.leap = null; me.jump = 0; gateTimers.length = 0; gruntFx.length = gruntHits.length = 0;
    hokageState.allies.length = hokageState.effects.length = 0;
    rinneganState.effects.length = 0;
    baryonState.effects.length = 0;
    for (const k of Object.keys(sixPathsState)) delete sixPathsState[k];
    sixPathsState.effects = [];
    indraState.ally = null; indraState.effects.length = 0;
    for (const k of Object.keys(susanooState)) delete susanooState[k];
    susanooState.effects = [];
    endWar(true);
    destructionState.ruins.length = destructionState.scars.length = 0;
    destructionState.view = null;
    for (const b of buildings) { b.health = b.maxHealth; b.destroyed = false; b.collapseLife = 0; }
    camera.x = clamp(me.x - W / 2, 0, WORLD.w - W); camera.y = clamp(me.y - H / 2, 0, WORLD.h - H);
    invalidateStatic(); minimapReady = false;
    mouse.down = false;
    nextZombieId = 0;
    nextBeast = 0;
    elapsed = 0; gameTime = 16; shake = 0; hudTimer = 0; largeMap = false;
    Object.assign(waveState, { number: 0, total: 0, spawned: 0, spawnTimer: 0, intermission: 0, boss: null });
    // Co-op guests receive waves from the host instead of spawning their own.
    spawnQueue.length = 0;
    if (net.role !== 'client' && AUTO_WAVES) startWave();
    else waveState.number = 1;
  }

  function circleRect(x, y, r, b) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    return (x - nx) ** 2 + (y - ny) ** 2 < r ** 2;
  }

  function blocked(x, y, r = 12) {
    if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
    // The Hokage Rock cliff north of Konoha can't be walked through.
    if (y < KONOHA.y + r && y > KONOHA.y - 600 && x > KONOHA.x - 60 && x < KONOHA.x + KONOHA.size + 60) return true;
    const column = buildingGrid[Math.floor(x / WORLD.block)];
    const building = column && column[Math.floor(y / WORLD.block)];
    return !!building && !building.destroyed && circleRect(x, y, r, building);
  }

  function addGroundScar(x, y, radius, kind = 'crater', angle = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (coop() && !net.applying) net.impacts.push(['s', Math.round(x), Math.round(y), Math.round(radius), kind, +angle.toFixed(2)]);
    const scars = destructionState.scars;
    const r = clamp(radius, 10, 240);
    const last = scars[scars.length - 1];
    if (last && last.kind === kind && Math.hypot(last.x - x, last.y - y) < Math.min(32, r * .2)) {
      last.radius = Math.max(last.radius, r);
      return;
    }
    if (scars.length >= MAX_GROUND_SCARS) scars.shift();
    scars.push({ x, y, radius: r, kind, angle });
  }

  function damageBuildings(x, y, radius, power, kind = 'crater') {
    if (power <= 0 || radius <= 0) return 0;
    // Every player applies every hit on the village, so all copies collapse the same houses.
    if (coop() && !net.applying) net.impacts.push(['b', Math.round(x), Math.round(y), Math.round(radius), Math.round(power), kind]);
    const minX = clamp(Math.floor((x - radius) / WORLD.block), 0, buildingGrid.length - 1);
    const maxX = clamp(Math.floor((x + radius) / WORLD.block), 0, buildingGrid.length - 1);
    const minY = clamp(Math.floor((y - radius) / WORLD.block), 0, Math.ceil(WORLD.h / WORLD.block) - 1);
    const maxY = clamp(Math.floor((y + radius) / WORLD.block), 0, Math.ceil(WORLD.h / WORLD.block) - 1);
    let collapsed = 0;
    for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
      const b = buildingGrid[gx]?.[gy];
      if (!b || b.destroyed) continue;
      const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
      const distance = Math.hypot(x - nx, y - ny);
      if (distance > radius) continue;
      b.health -= power * (1 - .4 * distance / radius);
      if (b.health > 0) continue;
      b.health = 0; b.destroyed = true; b.collapseLife = b.collapseMaxLife;
      if (b.village && !enemyAction && net.role !== 'client') villageAlarm(b.village, b);
      destructionState.ruins.push(b);
      addGroundScar(b.x + b.w * .5, b.y + b.h * .5, Math.min(b.w, b.h) * .65, 'earth');
      effects.push({ x: b.x + b.w * .5, y: b.y + b.h * .5, radius: Math.max(b.w, b.h) * .6,
        life: .72, max: .72, color: kind === 'fire' ? '#e98657' : '#bea78f' });
      if (effects.length > 40) effects.shift();
      burst(nx, ny, kind === 'fire' ? '#d38661' : '#bca78d', 15);
      // Repaint only the tiles this house was drawn on, and grey it out on the map.
      invalidateStatic({ x: b.x - 140, y: b.y - 180, w: b.w + 280, h: b.h + 300 });
      paintMapRuin(b);
      collapsed++;
    }
    if (collapsed) shake = Math.max(shake, Math.min(12, 6 + collapsed * 2));
    return collapsed;
  }

  function worldImpact(x, y, radius, power, kind = 'crater', angle = 0) {
    addGroundScar(x, y, radius * .74, kind, angle);
    if (radius >= 60) postShock(x, y, radius * 1.6, Math.min(26, 6 + radius * .06));
    return damageBuildings(x, y, radius, power, kind);
  }

  function moveCircle(obj, dx, dy, radius = obj.r || 12) {
    // A guest's knockback on a host-owned enemy is replayed on the host.
    if (obj.netProxy) recordHit(obj, 0, 0, dx, dy);
    if (!blocked(obj.x + dx, obj.y, radius)) obj.x += dx;
    if (!blocked(obj.x, obj.y + dy, radius)) obj.y += dy;
  }

  // Blows of the player's gate techniques that land a moment after the click.
  const gateTimers = [];
  function gateLater(delay, run) { gateTimers.push({ at: elapsed + delay, run }); }
  function updateGateTimers() {
    for (let i = 0; i < gateTimers.length; i++) {
      if (gateTimers[i].at > elapsed) continue;
      const t = gateTimers.splice(i--, 1)[0];
      if (me.down > 0) continue;
      t.run();
    }
  }

  function updatePlayer(dt) {
    updateGateTimers();
    player.fireCooldown -= dt; player.invuln -= dt; player.flash -= dt; player.swing = Math.max(0, player.swing - dt);
    player.castPose = Math.max(0, player.castPose - dt);
    player.punch = Math.max(0, (player.punch || 0) - dt);
    player.rinPulse = Math.max(0, (player.rinPulse || 0) - dt);
    if (player.down > 0) {
      // Knocked out in co-op: wait for the respawn timer.
      player.speed = 0;
      player.down -= dt;
      if (player.down <= 0) respawn();
      return;
    }
    if (player.nineTails) player.health = Math.min(player.maxHealth, player.health + player.maxHealth * .02 * dt);
    if (player.gates) player.health = Math.min(player.maxHealth, player.health + player.maxHealth * GATES_REGEN * dt);
    if (player.rinnegan) player.health = Math.min(player.maxHealth, player.health + player.maxHealth * RINNEGAN_REGEN * dt);
    if (player.sixPaths) player.health = Math.min(player.maxHealth, player.health + player.maxHealth * SIXPATHS_REGEN * dt);
    if (player.susanoo) player.health = Math.min(player.maxHealth, player.health + player.maxHealth * SUSANOO_REGEN * dt);
    // In co-op the match keeps running behind the pause menu and big map, without input.
    const input = !paused && !largeMap;
    if (player.leap) { updateLeap(dt); return; }
    let dx = input ? (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) : 0;
    let dy = input ? (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) : 0;
    const len = Math.hypot(dx, dy) || 1;
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 265 : 185) * (player.nineTails ? 1.7 : 1) * (player.gates ? GATES_SPEED : 1) * (player.sixPaths ? SIXPATHS_SPEED : 1);
    moveCircle(player, dx / len * sp * dt, dy / len * sp * dt);
    player.speed = (dx || dy) ? sp : 0;
    if (player.gates && player.speed > 0) {
      // Moving faster than the eye: red-hot afterimages and dust kicked up behind.
      player.gateTrail = (player.gateTrail || 0) - dt;
      if (player.gateTrail <= 0) {
        player.gateTrail = .06;
        addMightGuyAfterimage(player.x, player.y, player.angle, narutoId(player));
        if (Math.random() < .35) burst(player.x - dx / len * 14, player.y + 4 - dy / len * 14, '#c9a97a', 2);
      }
    }
    player.stride += player.speed * dt;
    const aimWorldX = mouse.x + camera.x;
    const aimWorldY = mouse.y + camera.y;
    player.angle = Math.atan2(aimWorldY - player.y, aimWorldX - player.x);
    const firing = mouse.down && input;
    if (firing && player.fireCooldown <= 0) shoot();
  }

  function shoot() {
    const weapon = WEAPONS[player.weapon];
    player.fireCooldown = weapon.interval * (player.nineTails ? .65 : 1);
    const mode = clickMode(player);
    if (mode === 'sixpaths') { window.SixPathsMode?.click(sixPathsState, player, heroApi()); return; }
    if (mode === 'susanoo') { window.SusanooMode?.click(susanooState, player, heroApi()); return; }
    if (mode === 'rinnegan') { rinneganCast(); return; }
    if (mode === 'gates') { gatesPunch(); return; }
    if (mode === 'baryon') { baryonCast(); return; }
    if (player.weapon === 'staff') { swingStaff(); return; }
    if (player.weapon === 'susano') { swingSusanoBlades(); return; }
    // A throwing flick of the wrist; shuriken spin out, kunai fly point first.
    player.flash = .1; player.swing = .14; player.swingAngle = player.angle;
    const count = player.nineTails && weapon.fan ? weapon.fan : weapon.pellets;
    for (let i = 0; i < count; i++) {
      const fan = count > 1 ? (i / (count - 1) - .5) * weapon.spread * 2 : 0;
      const angle = player.angle + fan + rand(-.03, .03);
      const x = player.x + Math.cos(angle) * 22;
      const y = player.y + Math.sin(angle) * 22;
      bullets.push({ x, y, vx: Math.cos(angle) * weapon.velocity, vy: Math.sin(angle) * weapon.velocity,
        life: weapon.life, friendly: true, damage: weapon.damage, pierce: weapon.pierce,
        hitIds: new Set(), kind: player.weapon, color: weapon.color, splash: 0, tag: !!weapon.tag });
    }
    shake = Math.max(shake, 1.2);
  }

  // Eight Gates taijutsu: left click walks GATES_COMBO. Between plain fists come Guy's techniques:
  // Leaf Great Whirlwind, Morning Peacock, Dynamic Entry, Evening Elephant, Reverse Lotus,
  // Daytime Tiger, a rain of air elephants and, last, Night Guy.
  function gatesPunch() {
    const p = player;
    const move = GATES_COMBO[(p.punchCount || 0) % GATES_COMBO.length];
    p.punchCount = (p.punchCount || 0) + 1;
    if (move === 'peacock' || move === 'elephant' || move === 'tiger') {
      (move === 'peacock' ? guyPeacock : move === 'elephant' ? guyElephant : guyTiger)(p, GATES_REACH);
      p.punch = p.attackPulse; p.fireCooldown = p.attackTimer * .7;
      return;
    }
    if (move === 'senpu') return gateSenpu(p);
    if (move === 'entry') return gateEntry(p);
    if (move === 'lotus') return gateLotus(p);
    if (move === 'ranbu') return gateRanbu(p);
    if (move === 'yagai') return gateYagai(p);
    gateFist(p);
  }

  function gateFist(p) {
    const a = p.angle;
    p.punch = .2; p.fireCooldown = GATES_PUNCH_INTERVAL;
    const fx = p.x + Math.cos(a) * 30, fy = p.y + Math.sin(a) * 30;
    if (p.punchCount % 3 === 0) worldImpact(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, 110, 260, 'shockwave', a);
    else damageBuildings(p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 130, 70, 70, 'blade');
    addGuyMove('punch', fx, fy, a, 70, .4, { combo: p.punchCount % 3, scale: 1.5, reach: GATES_PUNCH_RANGE });
    burst(fx, fy, '#ffb16d', 6);
    const hits = hitCone(p.x, p.y, a, GATES_PUNCH_RANGE, 1.05, GATES_PUNCH_DAMAGE, 24, 18);
    shake = Math.max(shake, hits ? 4.5 : 2);
  }

  // Where the cursor points on the ground, no further than `range` from the player.
  function aimPoint(p, range) {
    const d = Math.min(range, Math.hypot(mouse.x + camera.x - p.x, mouse.y + camera.y - p.y));
    return { x: p.x + Math.cos(p.angle) * d, y: p.y + Math.sin(p.angle) * d, d };
  }

  // Runs along a straight line, smashing any building in the way; returns the furthest clear spot.
  function clearPath(sx, sy, angle, distance, r, power) {
    let x = sx, y = sy;
    for (let d = 0; d < distance; d += 12) {
      const nx = x + Math.cos(angle) * 12, ny = y + Math.sin(angle) * 12;
      if (blocked(nx, ny, r)) {
        worldImpact(nx, ny, 90, power, 'fire', angle);
        if (blocked(nx, ny, r)) break;
      }
      x = nx; y = ny;
    }
    return { x, y };
  }

  function ringHit(x, y, radius, damage, push, falloff = 0) {
    let hits = 0;
    forEachEnemyNear(x, y, radius, z => {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d > radius + z.r) return;
      const away = Math.atan2(z.y - y, z.x - x);
      hurtZombie(z, Math.round(damage * (1 - falloff * Math.min(1, d / radius))), away);
      if (z.health > 0 && push && z.type !== 'beast') moveCircle(z, Math.cos(away) * push, Math.sin(away) * push, z.r);
      hits++;
    });
    return hits;
  }

  // Konoha Daisenpū: a spinning kick that whips up a whirlwind of leaves, drags everything nearby
  // into it for three blows, then flings it all outward.
  function gateSenpu(p) {
    const R = SENPU.radius, x = p.x, y = p.y;
    p.punch = .9; p.fireCooldown = .85; p.castPose = .8; p.castFrame = 'attack';
    addGuyMove('senpu', x, y, p.angle, R, 1.25);
    for (let i = 0; i < 3; i++) gateLater(i * .22, () => {
      forEachEnemyNear(x, y, R, z => {
        const d = Math.hypot(z.x - x, z.y - y);
        if (d > R + z.r) return;
        const toward = Math.atan2(y - z.y, x - z.x);
        hurtZombie(z, SENPU.tick, toward + Math.PI / 2);
        if (z.health > 0 && z.type !== 'beast' && d > 60) moveCircle(z, Math.cos(toward + .5) * 38, Math.sin(toward + .5) * 38, z.r);
      });
      shake = Math.max(shake, 6);
    });
    gateLater(.72, () => {
      ringHit(x, y, R, SENPU.final, 110);
      worldImpact(x, y, R * .45, 900, 'shockwave');
      shake = Math.max(shake, 13);
    });
    worldImpact(x, y, 160, 420, 'shockwave');
    burst(x, y, '#9fd16a', 26);
    shake = Math.max(shake, 8);
  }

  // Dynamic Entry: a flying kick that sails to the cursor and lands in a crater of fire.
  function gateEntry(p) {
    const aim = aimPoint(p, ENTRY.range), a = p.angle;
    const end = clearPath(p.x, p.y, a, Math.max(120, aim.d), p.r, 1200);
    p.leap = { sx: p.x, sy: p.y, ex: end.x, ey: end.y, t: 0, dur: ENTRY.air, h: 90 + aim.d * .12 };
    p.invuln = Math.max(p.invuln, ENTRY.air + .4);
    p.punch = ENTRY.air; p.fireCooldown = ENTRY.air + .45; p.castPose = ENTRY.air; p.castFrame = 'attack';
    addGuyMove('entry', end.x, end.y, a, ENTRY.radius, ENTRY.air + 1.05, { land: ENTRY.air / (ENTRY.air + 1.05), fromX: p.x, fromY: p.y });
    burst(p.x, p.y, '#c9a97a', 14);
    gateLater(ENTRY.air, () => {
      ringHit(end.x, end.y, ENTRY.radius, ENTRY.damage, 80, .35);
      worldImpact(end.x, end.y, ENTRY.radius * .62, 1500, 'shockwave', a);
      burst(end.x, end.y, '#ff8a3a', 34);
      shake = Math.max(shake, 16);
    });
  }

  function updateLeap(dt) {
    const L = player.leap;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    player.x = L.sx + (L.ex - L.sx) * k; player.y = L.sy + (L.ey - L.sy) * k;
    player.jump = Math.sin(Math.PI * k) * L.h;
    player.speed = 0;
    player.gateTrail = (player.gateTrail || 0) - dt;
    if (player.gateTrail <= 0) { player.gateTrail = .04; addMightGuyAfterimage(player.x, player.y - player.jump, player.angle, narutoId(player)); }
    if (k >= 1) { player.leap = null; player.jump = 0; }
  }

  // Ura Renge: Naruto blurs from foe to foe, striking each one, then the last blow opens a lotus
  // of red chakra that blasts everything around it.
  function gateLotus(p) {
    const pts = [], hit = new Set();
    let x = p.x, y = p.y;
    for (let i = 0; i < LOTUS.hops; i++) {
      let best = null, bestD = LOTUS.hop;
      forEachEnemyNear(x, y, LOTUS.hop, z => {
        if (hit.has(z)) return;
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < bestD) { best = z; bestD = d; }
      });
      if (!best) break;
      hit.add(best);
      x = best.x; y = best.y;
      pts.push(best);
    }
    if (!pts.length) {
      const end = clearPath(p.x, p.y, p.angle, aimPoint(p, LOTUS.hop).d || LOTUS.hop, p.r, 900);
      pts.push({ x: end.x, y: end.y, health: 0 });
    }
    const n = pts.length, fx = pts[n - 1].x, fy = pts[n - 1].y;
    const rel = [p.x - fx, p.y - fy];
    for (const z of pts) rel.push(Math.round(z.x - fx), Math.round(z.y - fy));
    const life = n * LOTUS.step + 1.2;
    addGuyMove('lotus', fx, fy, p.angle, LOTUS.radius, life, { pts: rel, bloom: (n * LOTUS.step + .05) / life });
    p.invuln = Math.max(p.invuln, n * LOTUS.step + .5);
    p.punch = .3; p.fireCooldown = n * LOTUS.step + .55;
    pts.forEach((z, i) => gateLater(i * LOTUS.step, () => {
      const from = i ? pts[i - 1] : p;
      const a = Math.atan2(z.y - from.y, z.x - from.x);
      const tx = z.x - Math.cos(a) * ((z.r || 0) + 14), ty = z.y - Math.sin(a) * ((z.r || 0) + 14);
      if (!blocked(tx, ty, player.r)) { player.x = tx; player.y = ty; }
      player.angle = a; player.punch = .2;
      addMightGuyAfterimage(player.x, player.y, a, narutoId(player));
      if (z.health > 0) hurtZombie(z, LOTUS.damage, a);
      ringHit(z.x, z.y, 120, LOTUS.damage * .3, 0);
      shake = Math.max(shake, 5);
    }));
    gateLater(n * LOTUS.step + .05, () => {
      ringHit(fx, fy, LOTUS.radius, LOTUS.bloom, 120, .3);
      worldImpact(fx, fy, LOTUS.radius * .55, 1400, 'fire');
      burst(fx, fy, '#ff5d8a', 40);
      shake = Math.max(shake, 15);
    });
  }

  // Sekizō rain: a flurry of air punches that drops rings of compressed-air pillars around the cursor.
  function gateRanbu(p) {
    const c = aimPoint(p, RANBU.range), cols = [], spots = [];
    for (const [r, count] of RANBU.rings)
      for (let i = 0; i < count; i++) {
        const an = i / count * Math.PI * 2 + r * .01;
        spots.push({ x: c.x + Math.cos(an) * r, y: c.y + Math.sin(an) * r * .8 });
      }
    for (const s of spots) cols.push(Math.round(s.x - p.x), Math.round(s.y - p.y));
    addGuyMove('elephant', p.x, p.y, p.angle, RANBU.radius, RANBU.life, { cols, scale: 1.6, step: RANBU.step, fist: .4 });
    p.punch = .6; p.fireCooldown = 1.05; p.castPose = .6; p.castFrame = 'attack';
    spots.forEach((s, i) => gateLater((i * RANBU.step + .12) * RANBU.life, () => {
      ringHit(s.x, s.y, RANBU.radius, RANBU.damage, 36);
      // Only every third pillar ripples the screen; seventeen shockwaves at once would stall the GPU.
      if (i % 3) { addGroundScar(s.x, s.y, RANBU.radius * .45, 'shockwave'); damageBuildings(s.x, s.y, RANBU.radius * .6, 650, 'shockwave'); }
      else worldImpact(s.x, s.y, RANBU.radius * .6, 650, 'shockwave');
      shake = Math.max(shake, 9);
    }));
  }

  // Night Guy (Yagai): the eighth gate's dragon kick, tearing a straight line across the map.
  function gateYagai(p) {
    const sx = p.x, sy = p.y, a = p.angle;
    const end = clearPath(sx, sy, a, YAGAI.range, p.r, 2200);
    p.x = end.x; p.y = end.y;
    const dash = Math.hypot(p.x - sx, p.y - sy);
    for (let d = 0; d < dash; d += 60) addMightGuyAfterimage(sx + Math.cos(a) * d, sy + Math.sin(a) * d, a, narutoId(p));
    for (let d = 90; d < dash; d += 110) addGroundScar(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 80, 'fire', a);
    if (mightGuyState.finishers.length >= 2) mightGuyState.finishers.shift();
    mightGuyState.finishers.push({ x: p.x, y: p.y, angle: a, radius: YAGAI.radius, life: 1.5, maxLife: 1.5 });
    const struck = new Set();
    forEachEnemyNear((sx + p.x) / 2, (sy + p.y) / 2, dash / 2 + YAGAI.path, z => {
      if (!segmentHitsCircle(sx, sy, p.x, p.y, z, z.r + YAGAI.path)) return;
      struck.add(z);
      hurtZombie(z, YAGAI.damage * .5, a);
    });
    forEachEnemyNear(p.x, p.y, YAGAI.radius, z => {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (d > YAGAI.radius + z.r) return;
      hurtZombie(z, Math.round(YAGAI.damage * (struck.has(z) ? .6 : 1) * (1 - .3 * Math.min(1, d / YAGAI.radius))), a);
    });
    worldImpact(p.x, p.y, YAGAI.radius * .6, 2200, 'fire', a);
    p.invuln = Math.max(p.invuln, 1.2);
    p.punch = .7; p.fireCooldown = 1.6; p.castPose = .7; p.castFrame = 'attack';
    burst(p.x, p.y, '#ff5035', 56);
    shake = Math.max(shake, 22);
  }

  // The newest mode switched on owns left click; when it is switched off, an older one takes over.
  function clickMode(p) {
    const on = { baryon: p.nineTails, gates: p.gates, rinnegan: p.rinnegan, sixpaths: p.sixPaths, susanoo: p.susanoo };
    if (p.clickMode && on[p.clickMode]) return p.clickMode;
    return p.susanoo ? 'susanoo' : p.sixPaths ? 'sixpaths' : p.rinnegan ? 'rinnegan' : p.gates ? 'gates' : p.nineTails ? 'baryon' : null;
  }

  // What the Six Paths mode and the summoned Sasuke may do to enemies and the world (never to teammates).
  //   circle(x, y, r, dmg, push, falloff)          hurt every enemy in a circle and push it away (negative push pulls in)
  //   line(x1, y1, x2, y2, halfWidth, dmg, push, kind) hurt every enemy along a thick segment, push it along; kind scars/smashes the ground
  //   cone(x, y, angle, len, half, dmg, push)      hurt every enemy in a fan
  //   pull(x, y, r, step)                          drag enemies up to `step` px toward a point (giants and beasts resist)
  //   nearest(x, y, r, preferBoss)                 the closest live enemy, or the closest boss/beast first
  //   world(x, y, r, power, kind, angle)           craters and destroyed buildings only
  //   clearShots(x, y, r)                          delete enemy projectiles in a circle; returns how many
  //   aim(range)                                   the cursor's spot on the ground, at most `range` from Naruto
  //   moveAlly(obj, dx, dy)                        move a summon with wall collision; walk(obj, tx, ty, speed, dt) steps it toward a point
  //   heal(share)                                  heal Naruto by a share of his max health
  //   shake(n), burst(x, y, color, n), blocked(x, y, r), player, time, enemies (live list, read only)
  let heroApiCache = null;
  function heroApi() {
    if (heroApiCache) return heroApiCache;
    const shove = (z, a, push) => {
      const k = z.type === 'beast' ? .15 : isGiant(z) ? .4 : 1, d = push * k, n = Math.max(1, Math.ceil(Math.abs(d) / 40));
      for (let s = 0; s < n; s++) moveCircle(z, Math.cos(a) * d / n, Math.sin(a) * d / n, z.r);
    };
    return heroApiCache = {
      get player() { return player; }, get time() { return elapsed; }, get enemies() { return zombies; },
      circle(x, y, r, damage, push = 0, falloff = 0) {
        let hits = 0;
        forEachEnemyNear(x, y, r, z => {
          const d = Math.hypot(z.x - x, z.y - y);
          if (d > r + z.r) return;
          const away = Math.atan2(z.y - y, z.x - x);
          hurtZombie(z, Math.round(damage * (1 - falloff * Math.min(1, d / r))), away);
          if (z.health > 0 && push) shove(z, away, push < 0 ? Math.max(push, -d) : push);
          hits++;
        });
        return hits;
      },
      line(x1, y1, x2, y2, halfWidth, damage, push = 0, kind) {
        const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
        let hits = 0;
        forEachEnemyNear((x1 + x2) / 2, (y1 + y2) / 2, len / 2 + halfWidth, z => {
          if (!segmentHitsCircle(x1, y1, x2, y2, z, halfWidth + z.r)) return;
          hurtZombie(z, damage, a);
          if (z.health > 0 && push) shove(z, a, push);
          hits++;
        });
        if (kind) for (let d = 0; d <= len; d += 160) {
          const t = len ? d / len : 0, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          addGroundScar(x, y, halfWidth * .8, kind, a);
          damageBuildings(x, y, halfWidth, damage * 1.3, kind);
        }
        return hits;
      },
      cone(x, y, angle, len, half, damage, push = 0) { return hitCone(x, y, angle, len, half, damage, push); },
      pull(x, y, r, step) {
        forEachEnemyNear(x, y, r, z => {
          const d = Math.hypot(z.x - x, z.y - y);
          if (d > r + z.r || d < 4) return;
          shove(z, Math.atan2(y - z.y, x - z.x), Math.min(step, d - 4));
        });
      },
      nearest(x, y, r, preferBoss) {
        if (!preferBoss) return nearestEnemy(x, y, r);
        let best = null, bestSq = r * r, big = null, bigSq = r * r;
        forEachEnemyNear(x, y, r, z => {
          const dSq = (z.x - x) ** 2 + (z.y - y) ** 2;
          if (dSq < bestSq) { best = z; bestSq = dSq; }
          if (isGiant(z) && dSq < bigSq) { big = z; bigSq = dSq; }
        });
        return big || best;
      },
      world: worldImpact,
      clearShots(x, y, r) {
        let n = 0;
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          if (!b.friendly && Math.hypot(b.x - x, b.y - y) < r) { bullets.splice(i, 1); n++; }
        }
        return n;
      },
      aim: range => aimPoint(player, range),
      moveAlly: (obj, dx, dy) => moveCircle(obj, dx, dy, obj.r || 14),
      walk(obj, tx, ty, speed, dt) {
        const dx = tx - obj.x, dy = ty - obj.y, d = Math.hypot(dx, dy);
        if (d < 1) return 0;
        const step = Math.min(d, speed * dt);
        moveCircle(obj, dx / d * step, dy / d * step, obj.r || 14);
        return d - step;
      },
      heal(share) { player.health = Math.min(player.maxHealth, player.health + player.maxHealth * share); },
      shake(n) { shake = Math.max(shake, n); },
      burst, blocked
    };
  }

  function addBaryonEffect(kind, props) {
    const list = baryonState.effects;
    if (list.length >= 14) list.shift();
    list.push(Object.assign({ kind, maxLife: props.life }, props));
  }

  // Baryon taijutsu in a cycle of six: chakra fist, nine-tails lash, fist, lash, fist, Kurama's arm.
  function baryonCast() {
    const p = player;
    p.bCount = (p.bCount || 0) + 1;
    const step = p.bCount % 6;
    p.castPose = .3; p.castFrame = step === 0 ? 'raise' : 'attack';
    if (step === 0) baryonArm();
    else if (step % 2) baryonFist();
    else baryonTails();
  }

  // A fist of Kurama's chakra punched out far ahead of Naruto's own.
  function baryonFist() {
    const p = player, a = p.angle, R = BARYON_FIST_RANGE;
    p.fireCooldown = .3;
    addBaryonEffect('fist', { x: p.x, y: p.y, angle: a, radius: R, life: .5 });
    const hits = hitCone(p.x, p.y, a, R, .55, 300, 30, 20);
    worldImpact(p.x + Math.cos(a) * R * .72, p.y + Math.sin(a) * R * .72, 90, 380, 'fire', a);
    shake = Math.max(shake, hits ? 6 : 3);
  }

  // The nine chakra tails whip out across the front in one wide sweep.
  function baryonTails() {
    const p = player, a = p.angle;
    p.fireCooldown = .42;
    addBaryonEffect('tails', { x: p.x, y: p.y, angle: a, radius: BARYON_TAILS_RANGE, life: .6 });
    const hits = hitCone(p.x, p.y, a, BARYON_TAILS_RANGE, 1.35, 260, 40, 30);
    damageBuildings(p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 180, 110, 90, 'blade');
    shake = Math.max(shake, hits ? 7 : 3);
  }

  // Kurama's giant chakra arm reaches down from above and slams the aimed spot flat.
  function baryonArm() {
    const p = player, a = p.angle;
    p.fireCooldown = 1;
    const d = Math.min(BARYON_ARM_RANGE, Math.hypot(mouse.x + camera.x - p.x, mouse.y + camera.y - p.y));
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    addBaryonEffect('arm', { x, y, fromX: p.x, fromY: p.y, radius: BARYON_ARM_RADIUS, life: BARYON_ARM_LIFE, landed: false });
  }

  function updateBaryon(dt) {
    const list = baryonState.effects;
    for (let i = list.length - 1; i >= 0; i--) {
      const fx = list[i];
      fx.life -= dt;
      // The hand lands about a third of the way in.
      if (fx.kind === 'arm' && !fx.landed && 1 - fx.life / fx.maxLife >= .35) {
        fx.landed = true;
        forEachEnemyNear(fx.x, fx.y, fx.radius, z => {
          if (z.health <= 0 || Math.hypot(z.x - fx.x, z.y - fx.y) > fx.radius + z.r) return;
          const away = Math.atan2(z.y - fx.y, z.x - fx.x);
          hurtZombie(z, 1000, away);
          if (z.health > 0 && z.type !== 'beast') moveCircle(z, Math.cos(away) * 50, Math.sin(away) * 50, z.r);
        });
        worldImpact(fx.x, fx.y, fx.radius * .7, 1200, 'fire');
        shake = Math.max(shake, 14);
      }
      if (fx.life <= 0) list.splice(i, 1);
    }
  }

  function swingStaff() {
    const weapon = WEAPONS.staff;
    player.swing = .26;
    player.swingAngle = player.angle;
    player.flash = .12;
    damageBuildings(player.x + Math.cos(player.angle) * 108, player.y + Math.sin(player.angle) * 108, 62, 65, 'blade');
    let hits = 0;
    forEachEnemyNear(player.x, player.y, weapon.range, z => {
      if (z.health <= 0) return;
      const d = dist(player, z);
      if (d > weapon.range + z.r || d < 1) return;
      const angle = Math.atan2(z.y - player.y, z.x - player.x);
      if (Math.abs(wrapAngle(angle - player.angle)) > weapon.arc / 2 + z.r / d) return;
      if (blocked((player.x + z.x) / 2, (player.y + z.y) / 2, 5)) return;
      hurtZombie(z, weapon.damage, angle);
      const push = z.type === 'beast' ? 0 : z.type === 'boss' ? 7 : 14;
      moveCircle(z, Math.cos(angle) * push, Math.sin(angle) * push, z.r);
      hits++;
    });
    if (hits) shake = Math.max(shake, Math.min(6, 2 + hits * 1.3));
    else burst(player.x + Math.cos(player.angle) * 98, player.y + Math.sin(player.angle) * 98, '#ac9dff', 4);
  }

  function swingSusanoBlades() {
    const weapon = WEAPONS.susano;
    player.swing = .26;
    player.swingAngle = player.angle;
    player.flash = .15;
    worldImpact(player.x + Math.cos(player.angle) * 120, player.y + Math.sin(player.angle) * 120, 72, 115, 'blade', player.angle);
    let hits = 0;
    forEachEnemyNear(player.x, player.y, weapon.range, z => {
      if (z.health <= 0) return;
      const d = dist(player, z);
      if (d > weapon.range + z.r || d < 1) return;
      const angle = Math.atan2(z.y - player.y, z.x - player.x);
      if (Math.abs(wrapAngle(angle - player.angle)) > weapon.arc / 2 + z.r / d) return;
      if (blocked((player.x + z.x) / 2, (player.y + z.y) / 2, 5)) return;
      hurtZombie(z, weapon.damage, angle);
      const shove = z.type === 'beast' ? 0 : z.type === 'boss' ? 9 : 20;
      moveCircle(z, Math.cos(angle) * shove, Math.sin(angle) * shove, z.r);
      hits++;
    });
    if (hits) shake = Math.max(shake, Math.min(7, 2 + hits * 1.2));
    else burst(player.x + Math.cos(player.angle) * 105, player.y + Math.sin(player.angle) * 105, weapon.color, 5);
  }

  function activateSkill(code) {
    const skill = SKILLS[code];
    if (!skill) return false;
    if (code === 'KeyG' && !player.nineTails) { showToast('BẬT BARYON MODE BẰNG PHÍM T ĐỂ DÙNG VĨ THÚ NGỌC', 1.3); return false; }
    player.angle = Math.atan2(mouse.y + camera.y - player.y, mouse.x + camera.x - player.x);
    let cast = false;
    if (code === 'KeyQ') cast = castFireball();
    else if (code === 'KeyE') cast = castClones();
    else if (code === 'KeyC') cast = castSummon();
    else if (code === 'KeyV') cast = castMightGuy();
    else if (code === 'KeyH') cast = castHokageSquad();
    else if (code === 'KeyF') cast = castLightningDash();
    else if (code === 'KeyG') cast = castBeastBomb();
    else if (code === 'KeyB') cast = castIndra();
    if (!cast) return false;
    // Hand-seal pose for ninjutsu; Chidori and the Bijūdama read as a forward strike.
    player.castPose = .32;
    player.castFrame = code === 'KeyF' || code === 'KeyG' ? 'attack' : 'seal';
    if (code === 'KeyE' || code === 'KeyV' || code === 'KeyH' || code === 'KeyB') updateHUD();
    return true;
  }

  function beginCharge(code) {
    if (skillState.charge || !running || paused || largeMap || me.down > 0) return false;
    const kind = code === 'Space' ? 'rasengan' : code === 'KeyX' ? 'shuriken' : code === 'KeyQ' ? 'fire' : code === 'KeyG' ? 'bijuu' : null;
    if (!kind) return false;
    if (kind === 'bijuu' && !player.nineTails) { showToast('BẬT BARYON MODE BẰNG PHÍM T ĐỂ DÙNG VĨ THÚ NGỌC', 1.3); return false; }
    skillState.charge = { code, kind, startedAt: performance.now(), time: 0,
      ratio: 0, radius: kind === 'rasengan' ? 20 : 24 };
    updateHUD();
    return true;
  }

  function releaseCharge(code) {
    const charge = skillState.charge;
    if (!charge || charge.code !== code) return;
    skillState.charge = null;
    if (!running || paused || largeMap) { updateHUD(); return; }
    charge.ratio = clamp((performance.now() - charge.startedAt) / (MAX_CHARGE_SECONDS * 1000), 0, 1);
    player.angle = Math.atan2(mouse.y + camera.y - player.y, mouse.x + camera.x - player.x);
    if (charge.kind === 'fire') {
      // A quick tap still throws the fireball; holding Q breathes Madara's sea of fire.
      if (charge.ratio < .1) castFireball(); else castFireSea(charge.ratio);
      player.castPose = .45; player.castFrame = 'attack';
      updateHUD();
      return;
    }
    if (charge.kind === 'bijuu') {
      if (!player.nineTails) { updateHUD(); return; }
      castBeastBomb(charge.ratio);
      player.castPose = .45; player.castFrame = 'attack';
      updateHUD();
      return;
    }
    if (charge.kind === 'rasengan') castRasengan(charge.ratio); else castRasenShuriken(charge.ratio);
    updateHUD();
  }

  function cancelCharge() {
    if (!skillState.charge) return;
    skillState.charge = null;
    if (running) updateHUD();
  }

  function toggleNineTails() {
    player.nineTails = !player.nineTails;
    player.fireCooldown = 0; player.bCount = 0;
    if (player.nineTails) player.clickMode = 'baryon';
    rescaleMaxHealth();
    burst(player.x, player.y, player.nineTails ? '#ff433f' : '#ffcd78', 36);
    if (player.nineTails) worldImpact(player.x, player.y, 125, 510, 'fire');
    shake = Math.max(shake, player.nineTails ? 11 : 4);
    player.castPose = .4; player.castFrame = 'seal';
    paintPortrait();
    updateHUD();
  }

  // Baryon (×100), the Eight Gates (×30), the Rinnegan (×20) and Six Paths (×50) each multiply max health; current health keeps its ratio.
  function rescaleMaxHealth() {
    const max = 100 * (player.nineTails ? 100 : 1) * (player.gates ? GATES_HEALTH : 1) * (player.rinnegan ? RINNEGAN_HEALTH : 1) * (player.sixPaths ? SIXPATHS_HEALTH : 1) * (player.susanoo ? SUSANOO_HEALTH : 1);
    player.health = Math.min(max, player.health * max / (player.maxHealth || 100));
    player.maxHealth = max;
  }

  function toggleGates() {
    player.gates = !player.gates;
    player.fireCooldown = 0; player.punchCount = 0;
    if (!player.gates) gateTimers.length = 0;
    if (player.gates) player.clickMode = 'gates';
    rescaleMaxHealth();
    if (player.gates) {
      worldImpact(player.x, player.y, 150, 620, 'shockwave');
      burst(player.x, player.y, '#ff3b2a', 40);
      shake = Math.max(shake, 12);
    } else burst(player.x, player.y, '#ffcd78', 18);
    player.castPose = .4; player.castFrame = 'seal';
    updateHUD();
  }

  // Six Paths Sage Mode: Naruto floats, the truth-seeking balls ring his back and left click becomes Six Paths jutsu.
  function toggleSixPaths() {
    player.sixPaths = !player.sixPaths;
    player.fireCooldown = 0; player.spCount = 0;
    if (player.sixPaths) player.clickMode = 'sixpaths';
    rescaleMaxHealth();
    window.SixPathsMode?.toggle(sixPathsState, player, player.sixPaths, heroApi());
    player.castPose = .4; player.castFrame = 'seal';
    paintPortrait();
    updateHUD();
  }

  // Susanoo (O): a violet chakra giant forms around Naruto; left click becomes Susanoo jutsu.
  function toggleSusanoo() {
    player.susanoo = !player.susanoo;
    player.fireCooldown = 0; player.suCount = 0;
    if (player.susanoo) player.clickMode = 'susanoo';
    rescaleMaxHealth();
    window.SusanooMode?.toggle(susanooState, player, player.susanoo, heroApi());
    player.castPose = .4; player.castFrame = 'seal';
    updateHUD();
  }

  // Sasuke (Indra's reincarnation) fights beside Naruto until B is pressed again.
  function castIndra() {
    const S = window.SasukeIndra;
    if (!S) return false;
    if (indraState.ally) { S.dismiss(indraState, heroApi()); return true; }
    let x = player.x, y = player.y;
    for (const offset of [72, 54, 36, 0]) {
      const tx = player.x - Math.cos(player.angle) * offset, ty = player.y - Math.sin(player.angle) * offset;
      if (!blocked(tx, ty, 14)) { x = tx; y = ty; break; }
    }
    S.summon(indraState, x, y, player.angle, heroApi());
    return true;
  }

  function toggleRinnegan() {
    player.rinnegan = !player.rinnegan;
    player.fireCooldown = 0; player.rinCount = 0;
    if (player.rinnegan) player.clickMode = 'rinnegan';
    rescaleMaxHealth();
    if (player.rinnegan) {
      addRinneganEffect('awaken', { x: player.x, y: player.y, radius: 420, life: 1.3 });
      worldImpact(player.x, player.y, 120, 420, 'shockwave');
      burst(player.x, player.y, '#b48cff', 30);
      shake = Math.max(shake, 9);
    } else burst(player.x, player.y, '#d8c8ff', 16);
    player.castPose = .4; player.castFrame = 'seal';
    paintPortrait();
    updateHUD();
  }

  function addRinneganEffect(kind, props) {
    const list = rinneganState.effects;
    if (list.length >= 18) list.shift();
    list.push(Object.assign({ kind, maxLife: props.life }, props));
  }

  // Deva Path on left click, in a cycle of six: push, pull, push, pull, push, planetary devastation.
  function rinneganCast() {
    const p = player;
    p.rinCount = (p.rinCount || 0) + 1;
    const step = p.rinCount % 6;
    p.rinPulse = .35; p.castPose = .3; p.castFrame = step === 0 ? 'raise' : 'attack';
    if (step === 0) castChibakuTensei();
    else if (step % 2) castShinraTensei();
    else castBanshoTenin();
  }

  // Shinra Tensei: everything round Naruto is hurled away by a sphere of repulsive force.
  function castShinraTensei() {
    const p = player, R = SHINRA_RADIUS;
    p.fireCooldown = .55;
    addRinneganEffect('shinra', { x: p.x, y: p.y, radius: R, life: .85 });
    forEachEnemyNear(p.x, p.y, R, z => {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (z.health <= 0 || d > R + z.r) return;
      const away = Math.atan2(z.y - p.y, z.x - p.x);
      hurtZombie(z, 420, away);
      if (z.health <= 0) return;
      const push = (R + 90 - d) * (z.type === 'beast' ? .15 : isGiant(z) ? .35 : 1);
      for (let s = 0; s < 4; s++) moveCircle(z, Math.cos(away) * push / 4, Math.sin(away) * push / 4, z.r);
    });
    // The force also swats enemy shots out of the air.
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.friendly && Math.hypot(b.x - p.x, b.y - p.y) < R) bullets.splice(i, 1);
    }
    worldImpact(p.x, p.y, R * .55, 650, 'shockwave');
    shake = Math.max(shake, 9);
  }

  // Banshō Ten'in: enemies round the aimed spot are yanked straight to Naruto.
  function castBanshoTenin() {
    const p = player, a = p.angle;
    p.fireCooldown = .5;
    const d = Math.min(BANSHO_RANGE, Math.hypot(mouse.x + camera.x - p.x, mouse.y + camera.y - p.y));
    const tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d, R = BANSHO_RADIUS, from = [];
    forEachEnemyNear(tx, ty, R, z => {
      if (z.health <= 0 || from.length >= 48 || Math.hypot(z.x - tx, z.y - ty) > R + z.r) return;
      from.push(Math.round(z.x - p.x), Math.round(z.y - p.y));
      const toward = Math.atan2(p.y - z.y, p.x - z.x), gap = Math.hypot(p.x - z.x, p.y - z.y) - (70 + z.r);
      hurtZombie(z, 300, toward + Math.PI);
      if (z.health <= 0 || gap <= 0) return;
      const pull = gap * (z.type === 'beast' ? .1 : isGiant(z) ? .4 : 1);
      for (let s = 0; s < 6; s++) moveCircle(z, Math.cos(toward) * pull / 6, Math.sin(toward) * pull / 6, z.r);
    });
    addRinneganEffect('bansho', { x: p.x, y: p.y, tx, ty, radius: R, from, life: .7 });
    burst(tx, ty, '#c8a8ff', 14);
    shake = Math.max(shake, 5);
  }

  // Chibaku Tensei: a black core rises over the aimed spot and drags everything into a sphere of rock.
  function castChibakuTensei() {
    const p = player, a = p.angle;
    p.fireCooldown = 1.1;
    const d = Math.min(CHIBAKU_RANGE, Math.hypot(mouse.x + camera.x - p.x, mouse.y + camera.y - p.y));
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    addRinneganEffect('chibaku', { x, y, radius: CHIBAKU_RADIUS, life: CHIBAKU_LIFE, tick: 0, crushed: false });
    shake = Math.max(shake, 6);
  }

  function updateChibaku(fx, dt) {
    const age = 1 - fx.life / fx.maxLife;
    if (age < .85) {
      fx.tick -= dt;
      const tick = fx.tick <= 0;
      if (tick) fx.tick = .25;
      forEachEnemyNear(fx.x, fx.y, fx.radius, z => {
        const d = Math.hypot(z.x - fx.x, z.y - fx.y);
        if (z.health <= 0 || d > fx.radius + z.r) return;
        const to = Math.atan2(fx.y - z.y, fx.x - z.x);
        const pull = Math.min(d, 260 * dt) * (z.type === 'beast' ? .15 : isGiant(z) ? .4 : 1);
        moveCircle(z, Math.cos(to) * pull, Math.sin(to) * pull, z.r);
        if (tick) hurtZombie(z, 70, to + Math.PI);
      });
    } else if (!fx.crushed) {
      fx.crushed = true;
      forEachEnemyNear(fx.x, fx.y, fx.radius * .75, z => {
        if (z.health <= 0 || Math.hypot(z.x - fx.x, z.y - fx.y) > fx.radius * .75 + z.r) return;
        hurtZombie(z, 1800, Math.atan2(z.y - fx.y, z.x - fx.x));
      });
      worldImpact(fx.x, fx.y, fx.radius * .6, 1200, 'shockwave');
      shake = Math.max(shake, 13);
    }
  }

  function updateRinnegan(dt) {
    const list = rinneganState.effects;
    for (let i = list.length - 1; i >= 0; i--) {
      const fx = list[i];
      fx.life -= dt;
      if (fx.kind === 'chibaku') updateChibaku(fx, dt);
      if (fx.life <= 0) list.splice(i, 1);
    }
    // Gakidō: enemy shots that reach Naruto are drunk in as chakra and heal him.
    if (!me.rinnegan || me.down > 0) return;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.friendly || Math.hypot(b.x - me.x, b.y - me.y) > GAKIDO_RADIUS) continue;
      bullets.splice(i, 1);
      me.health = Math.min(me.maxHealth, me.health + me.maxHealth * .015);
      addRinneganEffect('absorb', { x: b.x, y: b.y, tx: me.x, ty: me.y, life: .4 });
    }
  }

  function addSkillEffect(name, effect) {
    const list = skillState[name];
    if (list.length >= skillEffectLimits[name]) list.shift();
    list.push(effect);
  }

  function castFireball() {
    const a = player.angle;
    const x = player.x + Math.cos(a) * 32, y = player.y + Math.sin(a) * 32;
    addSkillEffect('fireballs', { x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
      angle: a, r: 20, life: 1.35, maxLife: 1.35 });
    burst(x, y, '#ffab3d', 10);
    shake = Math.max(shake, 3);
    return true;
  }

  // Madara's Katon: Gōka Mekkyaku — a wall of flame rolls forward and keeps burning.
  function castFireSea(chargeRatio) {
    const charge = clamp(chargeRatio, 0, 1), a = player.angle;
    const life = 2.2 + charge;
    addSkillEffect('fireSeas', { x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, angle: a, charge,
      maxRange: 380 + charge * 720, spread: .42 + charge * .3, grow: .55 + charge * .45,
      damage: Math.round(70 + charge * 130), life, maxLife: life, tick: 0 });
    burst(player.x + Math.cos(a) * 26, player.y + Math.sin(a) * 26, '#ff8a2a', 24 + Math.round(charge * 20));
    player.invuln = Math.max(player.invuln, .4);
    shake = Math.max(shake, 7 + charge * 9);
    return true;
  }

  // Explosive tags (kibaku fuda): sizzle for a moment, then blow up.
  function addTag(x, y, stuckTo) {
    addSkillEffect('tags', { x, y, stuckTo, life: .65, maxLife: .65 });
  }

  function updateTags(dt) {
    const tags = skillState.tags;
    for (let i = tags.length - 1; i >= 0; i--) {
      const tag = tags[i];
      tag.life -= dt;
      if (tag.stuckTo && tag.stuckTo.health > 0) { tag.x = tag.stuckTo.x; tag.y = tag.stuckTo.y; }
      if (tag.life > 0) continue;
      tags.splice(i, 1);
      explodeTag(tag.x, tag.y);
    }
  }

  function explodeTag(x, y) {
    const radius = 95;
    worldImpact(x, y, radius * .8, 230, 'fire');
    addSkillEffect('explosions', { x, y, radius, life: .45, maxLife: .45, kind: 'fire' });
    burst(x, y, '#ff7a2a', 14); burst(x, y, '#ffe08a', 6);
    forEachEnemyNear(x, y, radius, z => {
      if (z.health <= 0) return;
      const d = dist(z, { x, y });
      if (d > radius + z.r || blocked((x + z.x) / 2, (y + z.y) / 2, 4)) return;
      hurtZombie(z, Math.round(150 * (1 - Math.min(d, radius) / radius * .4)), Math.atan2(z.y - y, z.x - x));
    });
    shake = Math.max(shake, 4);
  }

  function updateFireSeas(dt) {
    const seas = skillState.fireSeas;
    for (let i = seas.length - 1; i >= 0; i--) {
      const sea = seas[i];
      sea.life -= dt; sea.tick -= dt;
      if (sea.life <= 0) { seas.splice(i, 1); continue; }
      if (sea.tick > 0) continue;
      sea.tick = .25;
      // Same ease-out the VFX uses, so damage follows the visible flame front.
      const t = Math.min(1, (sea.maxLife - sea.life) / sea.grow), range = sea.maxRange * (1 - (1 - t) * (1 - t));
      forEachEnemyNear(sea.x, sea.y, range + 60, z => {
        if (z.health <= 0) return;
        const dx = z.x - sea.x, dy = z.y - sea.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (d > range + z.r || Math.abs(wrapAngle(a - sea.angle)) > sea.spread + z.r / Math.max(d, 1)) return;
        hurtZombie(z, sea.damage, a);
      });
      // The fire sets the village alight along its front.
      for (let k = 0; k < 2; k++) {
        const a = sea.angle + rand(-sea.spread, sea.spread), r = range * rand(.5, 1);
        worldImpact(sea.x + Math.cos(a) * r, sea.y + Math.sin(a) * r, 70 + sea.charge * 40, 140 + sea.charge * 260, 'fire', a);
      }
      shake = Math.max(shake, 2 + sea.charge * 4);
    }
  }

  // Held G compresses a bigger, slower Bijūdama: up to ~2.6x the size, radius and ~3.5x the damage.
  function castBeastBomb(chargeRatio = 0) {
    const charge = clamp(chargeRatio, 0, 1), a = player.angle;
    const r = 27 + charge * 44, speed = 490 - charge * 150, offset = 38 + charge * 80;
    const x = player.x + Math.cos(a) * offset, y = player.y + Math.sin(a) * offset;
    addSkillEffect('beastBombs', { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      angle: a, r, charge, life: 1.5 + charge * .5, maxLife: 1.5 + charge * .5 });
    burst(x, y, '#c685ff', 12 + Math.round(charge * 18));
    shake = Math.max(shake, 5 + charge * 7);
    return true;
  }

  function explodeBeastBomb(x, y, charge = 0) {
    const radius = Math.round(210 + charge * 330), damage = 480 + charge * 1200;
    worldImpact(x, y, radius, 710 + charge * 1400, 'beast');
    addSkillEffect('explosions', { x, y, radius, charge, life: .72 + charge * .5, maxLife: .72 + charge * .5, kind: 'beast' });
    burst(x, y, '#a85aff', 28 + Math.round(charge * 24));
    burst(x, y, '#ffce79', 12 + Math.round(charge * 12));
    forEachEnemyNear(x, y, radius, z => {
      if (z.health <= 0) return;
      const d = dist(z, { x, y });
      if (d > radius + z.r || blocked((x + z.x) / 2, (y + z.y) / 2, 4)) return;
      hurtZombie(z, Math.round(damage * (1 - Math.min(d, radius) / radius * .4)), Math.atan2(z.y - y, z.x - x));
    });
    shake = Math.max(shake, 9 + charge * 9);
  }

  function explodeFireball(x, y) {
    const radius = 108;
    worldImpact(x, y, radius, 255, 'fire');
    addSkillEffect('explosions', { x, y, radius, life: .55, maxLife: .55, kind: 'fire' });
    burst(x, y, '#ff6932', 22);
    burst(x, y, '#ffd370', 10);
    forEachEnemyNear(x, y, radius, z => {
      if (z.health <= 0) return;
      const d = dist(z, { x, y });
      if (d > radius + z.r || blocked((x + z.x) / 2, (y + z.y) / 2, 4)) return;
      hurtZombie(z, Math.round(170 * (1 - Math.min(d, radius) / radius * .55)), Math.atan2(z.y - y, z.x - x));
    });
    shake = Math.max(shake, 6);
  }

  // Shadow Clones: E calls eight clones that copy Naruto's form, weapon and jutsu; E again recalls them.
  function castClones() {
    if (skillState.clones.length) {
      for (const clone of skillState.clones)
        addSkillEffect('explosions', { x: clone.x, y: clone.y, radius: 46, life: .42, maxLife: .42, kind: 'smoke' });
      skillState.clones.length = 0;
      return true;
    }
    for (let index = 0; index < MAX_CLONES; index++) {
      const phase = index * Math.PI * 2 / MAX_CLONES;
      const x = player.x + Math.cos(phase) * 46, y = player.y + Math.sin(phase) * 46;
      const free = !blocked(x, y, 13);
      const hp = (player.maxHealth || 100) * CLONE_HEALTH;
      skillState.clones.push({ id: ++nextCloneId, isClone: true, health: hp, maxHealth: hp,
        x: free ? x : player.x, y: free ? y : player.y, r: 13, angle: player.angle, phase, age: 0,
        weapon: player.weapon, nineTails: player.nineTails, fireCooldown: index * .07, skillTimer: 1 + index * .4,
        seekTimer: 0, target: null, invuln: 0, flash: 0, swing: 0, swingAngle: 0, castPose: 0, castFrame: 'seal',
        stride: 0, speed: 0 });
    }
    addSkillEffect('explosions', { x: player.x, y: player.y, radius: 110, life: .5, maxLife: .5, kind: 'smoke' });
    addGroundScar(player.x, player.y, 60, 'earth');
    burst(player.x, player.y, '#b4e9ff', 26);
    return true;
  }

  // Each clone hunts like Might Guy: it runs at the nearest enemy, attacks with
  // Naruto's current weapon and now and then casts one of his jutsu.
  const CLONE_JUTSU = ['fire', 'rasengan', 'shuriken', 'chidori'];
  function cloneJutsu(clone, target, gap) {
    const pool = me.nineTails ? CLONE_JUTSU.concat('bomb') : CLONE_JUTSU;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    clone.angle = Math.atan2(target.y - clone.y, target.x - clone.x);
    let cast = false;
    if (pick === 'rasengan' && gap < 170) cast = castRasengan(rand(.15, .55));
    else if (pick === 'chidori' && gap < 300) cast = castLightningDash();
    else if (pick === 'shuriken') cast = castRasenShuriken(rand(.1, .45));
    else if (pick === 'bomb') cast = castBeastBomb();
    else cast = castFireball();
    if (cast) { clone.castPose = .32; clone.castFrame = pick === 'chidori' || pick === 'rasengan' ? 'attack' : 'seal'; }
    return cast;
  }

  function updateClones(dt) {
    const clones = skillState.clones;
    if (!clones.length) return;
    const calm = shake;
    try {
      clones.forEach((clone, index) => {
        player = clone;
        clone.age += dt;
        clone.nineTails = me.nineTails; clone.weapon = me.weapon;
        const maxHealth = (me.maxHealth || 100) * CLONE_HEALTH;
        if (clone.maxHealth !== maxHealth) { clone.health *= maxHealth / clone.maxHealth; clone.maxHealth = maxHealth; }
        clone.fireCooldown -= dt; clone.skillTimer -= dt; clone.seekTimer -= dt; clone.invuln -= dt; clone.flash -= dt;
        clone.swing = Math.max(0, clone.swing - dt); clone.castPose = Math.max(0, clone.castPose - dt);
        if (clone.seekTimer <= 0 || !clone.target || clone.target.health <= 0) {
          let best = null, bestSq = 900 ** 2;
          forEachEnemyNear(clone.x, clone.y, 900, z => {
            if (z.health <= 0 || dist(z, me) > 1200) return;
            const dSq = (z.x - clone.x) ** 2 + (z.y - clone.y) ** 2;
            if (dSq < bestSq) { bestSq = dSq; best = z; }
          });
          clone.target = best;
          clone.seekTimer = .2 + index * .02;
        }
        const target = clone.target?.health > 0 ? clone.target : null;
        const thrown = clone.weapon !== 'staff' && clone.weapon !== 'susano';
        const reach = thrown ? 280 : (clone.weapon === 'susano' ? 120 : 95);
        const orbit = elapsed * .9 + clone.phase;
        const tx = target ? target.x : me.x + Math.cos(orbit) * 60;
        const ty = target ? target.y : me.y + Math.sin(orbit) * 60;
        const dx = tx - clone.x, dy = ty - clone.y, distance = Math.hypot(dx, dy);
        const desired = target ? reach * .8 + target.r : 16;
        clone.speed = 0;
        if (distance > desired && distance > 0) {
          const sp = 300 * (clone.nineTails ? 1.7 : 1), step = Math.min(distance - desired, sp * dt);
          const ox = clone.x, oy = clone.y;
          moveCircle(clone, dx / distance * step, dy / distance * step, clone.r);
          clone.speed = Math.hypot(clone.x - ox, clone.y - oy) / Math.max(dt, .001);
          clone.stride += clone.speed * dt;
        }
        clone.angle = target ? Math.atan2(target.y - clone.y, target.x - clone.x) : me.angle;
        if (!target) return;
        const gap = dist(clone, target);
        if (clone.skillTimer <= 0 && gap < 560) {
          if (cloneJutsu(clone, target, gap)) clone.skillTimer = rand(3.5, 6.5);
          else clone.skillTimer = .5;
        } else if (clone.fireCooldown <= 0 && gap < reach + target.r) shoot();
      });
    } finally {
      player = me;
      // Eight clones fighting at once would never stop the screen shaking.
      shake = Math.max(calm, Math.min(shake, calm + 1.5));
    }
  }

  function castSummon() {
    const side = skillState.summons.length % 2 ? -1 : 1;
    const a = player.angle + side * Math.PI / 2;
    let x = player.x, y = player.y;
    for (const offset of [102, 78, 56, 34]) {
      const tx = player.x + Math.cos(a) * offset;
      const ty = player.y + Math.sin(a) * offset;
      if (!blocked(tx, ty, 43)) { x = tx; y = ty; break; }
    }
    addSkillEffect('summons', { x, y, angle: player.angle, r: 43,
      side, life: 15, maxLife: 15, attackTimer: .35, seekTimer: 0,
      target: null, hitFlash: 0, attackCount: 0, attackKind: '',
      beamPulse: 0, beamTargetX: x, beamTargetY: y });
    addSkillEffect('explosions', { x, y, radius: 150, life: .68, maxLife: .68, kind: 'smoke' });
    worldImpact(x, y, 150, 430, 'earth');
    burst(x, y, '#b483ff', 25);
    shake = Math.max(shake, 8);
    return true;
  }

  function addHokageEffect(kind, x, y, radius, angle = 0, signature = false, fromX = x, fromY = y) {
    const list = hokageState.effects;
    // Jukai Kōtan forests outlive many small jutsu: drop the oldest small one first.
    if (list.length >= 24) { const i = list.findIndex(f => f.kind !== 'forest'); list.splice(i < 0 ? 0 : i, 1); }
    const life = kind === 'forest' ? JUKAI.life : kind === 'staff' ? .95 : kind === 'prison' ? 1.9 : kind === 'flash' ? (signature ? .9 : .48) : signature ? 1.3 : .74;
    list.push({ kind, x, y, radius, angle, signature, fromX, fromY, life, maxLife: life });
  }

  function castHokageSquad() {
    if (hokageState.allies.length) {
      for (const ally of hokageState.allies) burst(ally.x, ally.y, '#e9f3e1', 8);
      hokageState.allies.length = hokageState.effects.length = 0;
      return true;
    }
    hokageState.allies.length = hokageState.effects.length = 0;
    woodWaves.length = 0;
    const kinds = ['wood', 'water', 'fire', 'flash'];
    for (let order = 1; order <= 4; order++) {
      const angle = player.angle + Math.PI / 4 + (order - 1) * Math.PI / 2;
      let x = player.x, y = player.y;
      for (const offset of [84, 60, 38, 0]) {
        const tx = player.x + Math.cos(angle) * offset;
        const ty = player.y + Math.sin(angle) * offset;
        if (!blocked(tx, ty, 13)) { x = tx; y = ty; break; }
      }
      hokageState.allies.push({ order, x, y, r: 13, angle: player.angle,
        life: HOKAGE_VFX_SPAN, maxLife: HOKAGE_VFX_SPAN,
        attackTimer: .18 + order * .16, seekTimer: 0, target: null,
        attackPulse: 0, attackCount: 0, stuck: 0, enma: 0, staffOut: 0 });
      addHokageEffect(kinds[order - 1], x, y, 76, angle);
    }
    worldImpact(player.x, player.y, 105, 180, 'shockwave');
    burst(player.x, player.y, '#e9f3e1', 26);
    shake = Math.max(shake, 8);
    return true;
  }

  // Jukai Kōtan: a forest bursts out of the ground around Hashirama and races outward across the
  // whole battlefield; every enemy the wave front reaches is struck and bound by the roots.
  // cooldown: seconds between forests.
  const JUKAI = { radius: 1150, speed: 1050, damage: 640, life: 4.6, cooldown: 13 };
  const woodWaves = [];
  function hashiramaForest(ally, angle) {
    ally.attackTimer = 2.4; ally.attackPulse = .9; ally.forestAt = elapsed;
    addHokageEffect('forest', ally.x, ally.y, JUKAI.radius, angle, true, ally.x, ally.y);
    woodWaves.push({ x: ally.x, y: ally.y, t: 0, hit: new Set() });
    worldImpact(ally.x, ally.y, 220, 900, 'earth', angle);
    burst(ally.x, ally.y, '#8bbb69', 30);
    shake = Math.max(shake, 14);
  }
  function updateWoodWaves(dt) {
    for (let i = woodWaves.length - 1; i >= 0; i--) {
      const w = woodWaves[i];
      w.t += dt;
      const front = Math.min(JUKAI.radius, w.t * JUKAI.speed);
      forEachEnemyNear(w.x, w.y, front, z => {
        if (z.health <= 0 || w.hit.has(z)) return;
        w.hit.add(z);
        const a = Math.atan2(z.y - w.y, z.x - w.x);
        hurtZombie(z, z.type === 'boss' ? JUKAI.damage * 2.5 : JUKAI.damage, a);
        if (z.health > 0) z.rootTimer = Math.max(z.rootTimer || 0, isGiant(z) ? 1.8 : 3.4);
      });
      // the ground rumbles while the front rolls out
      if (front < JUKAI.radius) shake = Math.max(shake, 6);
      else woodWaves.splice(i, 1);
    }
  }

  function hokageAttack(ally, target) {
    const order = ally.order;
    const kind = ['wood', 'water', 'fire', 'flash'][order - 1];
    const cx = target.x, cy = target.y;
    const originX = ally.x, originY = ally.y;
    const angle = Math.atan2(cy - originY, cx - originX);
    const signature = ++ally.attackCount % 5 === 0;
    ally.angle = angle;
    if (order === 1 && signature && !(elapsed - (ally.forestAt ?? -Infinity) < JUKAI.cooldown)) return hashiramaForest(ally, angle);
    if (order === 3 && !signature && ally.enma >= ENMA_READY) {
      const step = ally.attackCount % 5;
      if (step === 2) return hiruzenStaff(ally, target, angle);
      if (step === 4) return hiruzenPrison(ally, target, angle);
    }
    if (order === 4) {
      const arrivalX = cx - Math.cos(angle) * (target.r + 36);
      const arrivalY = cy - Math.sin(angle) * (target.r + 36);
      addHokageEffect('flash', originX, originY, 52, angle);
      if (!blocked(arrivalX, arrivalY, ally.r)) {
        ally.x = arrivalX;
        ally.y = arrivalY;
      }
    }
    const baseRadius = order === 1 ? 330 : order === 2 ? 160 : order === 3 ? 148 : 112;
    const radius = Math.round(baseRadius * (signature ? 1.5 : 1));
    const baseDamage = order === 1 ? 260 : order === 2 ? 310 : order === 3 ? 460 : 660;
    const damage = Math.round(baseDamage * (signature ? 2.2 : 1));
    const interval = order === 1 ? 1.32 : order === 2 ? 1.02 : order === 3 ? 1.18 : .78;
    ally.attackTimer = interval * (signature ? 1.45 : 1);
    ally.attackPulse = signature ? .58 : .3;
    addHokageEffect(kind, cx, cy, radius, angle, signature, originX, originY);
    if (order === 1) worldImpact(cx, cy, 160, 420, 'earth', angle);
    else if (order === 3) worldImpact(cx, cy, radius, signature ? 850 : 430, 'fire', angle);
    else addGroundScar(cx, cy, radius * .52, order === 2 ? 'vortex' : 'lightning', angle);
    burst(cx, cy, ['#8bbb69', '#7bd4ff', '#ff9148', '#ffe28e'][order - 1], signature ? 23 : order === 4 ? 12 : 9);
    let hits = 0;
    const strike = z => {
      if (z.health <= 0 || Math.hypot(z.x - cx, z.y - cy) > radius + z.r) return;
      const impactAngle = Math.atan2(z.y - cy, z.x - cx);
      hurtZombie(z, damage, impactAngle);
      if (z.health > 0 && order === 1) z.rootTimer = Math.max(z.rootTimer || 0, isGiant(z) ? (signature ? 1.4 : .85) : (signature ? 2.4 : 1.6));
      if (z.health > 0 && order === 2) {
        z.soakedTimer = Math.max(z.soakedTimer || 0, signature ? 2.2 : 1.3);
        moveCircle(z, Math.cos(impactAngle) * (signature ? 56 : 22), Math.sin(impactAngle) * (signature ? 56 : 22), z.r);
      }
      hits++;
    };
    strike(target);
    const maxHits = order === 1 ? 80 : 24;
    forEachEnemyNear(cx, cy, radius, z => {
      if (hits >= maxHits) return false;
      if (z !== target) strike(z);
    });
    if (signature && order === 4) hits += minatoChain(ally, target, damage);
    if (signature) {
      shake = Math.max(shake, 9);
    }
    if (hits) shake = Math.max(shake, order === 4 ? 5.5 : 4.5);
  }

  // Kongōnyoi: Enma as the Adamantine Staff shoots out from Hiruzen's hands and rams through the line.
  function hiruzenStaff(ally, target, angle) {
    const reach = Math.min(640, Math.hypot(target.x - ally.x, target.y - ally.y) + 170);
    const ex = ally.x + Math.cos(angle) * reach, ey = ally.y + Math.sin(angle) * reach;
    ally.attackTimer = 1.05; ally.attackPulse = .45; ally.staffOut = .95;
    addHokageEffect('staff', ally.x, ally.y, reach, angle);
    let hits = 0;
    forEachEnemyNear((ally.x + ex) / 2, (ally.y + ey) / 2, reach / 2 + 40, z => {
      if (hits >= 20) return false;
      if (z.health <= 0 || !segmentHitsCircle(ally.x, ally.y, ex, ey, z, z.r + 26)) return;
      hurtZombie(z, 560, angle);
      if (z.health > 0) moveCircle(z, Math.cos(angle) * 48, Math.sin(angle) * 48, z.r);
      hits++;
    });
    worldImpact(ex, ey, 80, 560, 'shockwave', angle);
    burst(ex, ey, '#ffd27a', 14);
    shake = Math.max(shake, hits ? 7 : 4);
  }

  // Kongō Rōheki: a ring of Adamantine Staffs slams down around the target and cages everyone inside.
  function hiruzenPrison(ally, target, angle) {
    const cx = target.x, cy = target.y, radius = 150;
    ally.attackTimer = 1.35; ally.attackPulse = .55;
    addHokageEffect('prison', cx, cy, radius, angle, false, ally.x, ally.y);
    let hits = 0;
    forEachEnemyNear(cx, cy, radius, z => {
      if (hits >= 24) return false;
      if (z.health <= 0 || Math.hypot(z.x - cx, z.y - cy) > radius + z.r) return;
      const away = Math.atan2(z.y - cy, z.x - cx);
      hurtZombie(z, 430, away);
      if (z.health > 0) {
        z.rootTimer = Math.max(z.rootTimer || 0, isGiant(z) ? 1.3 : 2.8);
        moveCircle(z, (cx - z.x) * .35, (cy - z.y) * .35, z.r);
      }
      hits++;
    });
    worldImpact(cx, cy, radius * .55, 300, 'earth', angle);
    burst(cx, cy, '#ffd27a', 18);
    shake = Math.max(shake, 7);
  }

  // Minato's signature: he flashes between marked kunai, putting a Rasengan into each ninja on the way.
  function minatoChain(ally, first, damage) {
    let fromX = first.x, fromY = first.y, hits = 0;
    const struck = new Set([first]);
    for (let jump = 0; jump < 5; jump++) {
      let next = null, best = 400 ** 2;
      forEachEnemyNear(fromX, fromY, 400, z => {
        if (z.health <= 0 || struck.has(z)) return;
        const d = (z.x - fromX) ** 2 + (z.y - fromY) ** 2;
        if (d < best) { best = d; next = z; }
      });
      if (!next) break;
      struck.add(next);
      const a = Math.atan2(next.y - fromY, next.x - fromX);
      addHokageEffect('flash', next.x, next.y, 96, a, false, fromX, fromY);
      hurtZombie(next, Math.round(damage * .6), a);
      fromX = next.x; fromY = next.y; hits++;
    }
    if (hits && !blocked(fromX, fromY, ally.r)) { ally.x = fromX - 30; ally.y = fromY; }
    return hits;
  }

  function updateHokageSquad(dt) {
    updateWoodWaves(dt);
    const effects = hokageState.effects;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
    const allies = hokageState.allies;
    for (let i = allies.length - 1; i >= 0; i--) {
      const ally = allies[i];
      // Stop the visual clock above zero: H is the only in-game dismissal.
      ally.life = Math.max(1, ally.life - dt);
      ally.attackTimer -= dt;
      ally.seekTimer -= dt;
      ally.attackPulse = Math.max(0, ally.attackPulse - dt);
      ally.staffOut = Math.max(0, (ally.staffOut || 0) - dt);
      // Keep counting a moment past ENMA_READY so the transformation smoke can finish drawing.
      if (ally.order === 3 && ally.enma < ENMA_READY + 1) {
        const before = ally.enma;
        ally.enma += dt;
        if (ally.enma < ENMA_APPEAR) ally.attackPulse = Math.max(ally.attackPulse, .1);
        const side = Math.cos(ally.angle || 0) >= 0 ? -1 : 1;
        if (before < ENMA_APPEAR && ally.enma >= ENMA_APPEAR) {
          worldImpact(ally.x + side * 34, ally.y - 4, 70, 160, 'shockwave');
          shake = Math.max(shake, 6);
        }
        if (before < ENMA_READY - .4 && ally.enma >= ENMA_READY - .4) burst(ally.x + side * 34, ally.y - 30, '#f2f0e6', 14);
      }
      if (ally.seekTimer <= 0 || !ally.target || ally.target.health <= 0 ||
          dist(ally, ally.target) > 850 || dist(player, ally.target) > 1050) {
        let target = nearestEnemy(ally.x, ally.y, 690);
        if (target && dist(player, target) > 1000) target = null;
        const boss = waveState.boss;
        if (ally.order === 4 && boss?.health > 0 && dist(ally, boss) < 740 && dist(player, boss) < 1050)
          target = boss;
        ally.target = target;
        ally.seekTimer = .26;
      }
      const target = ally.target?.health > 0 ? ally.target : null;
      const formation = player.angle + Math.PI / 4 + (ally.order - 1) * Math.PI / 2;
      const tx = target ? target.x : player.x + Math.cos(formation) * 60;
      const ty = target ? target.y : player.y + Math.sin(formation) * 60;
      const dx = tx - ally.x, dy = ty - ally.y, distance = Math.hypot(dx, dy);
      const desired = target ? (ally.order === 4 ? 235 : 220) : 12;
      ally.moving = distance > desired + 2;
      if (distance > desired && distance > 0) {
        const speed = [270, 345, 255, 410][ally.order - 1];
        const step = Math.min(distance - desired, speed * dt);
        const oldX = ally.x, oldY = ally.y;
        moveCircle(ally, dx / distance * step, dy / distance * step, ally.r);
        if (target && Math.hypot(ally.x - oldX, ally.y - oldY) < step * .18) {
          ally.stuck += dt;
          if (ally.stuck > .65) {
            worldImpact(ally.x + dx / distance * 20, ally.y + dy / distance * 20, 75, 620, 'earth', ally.angle);
            ally.stuck = 0;
          }
        } else ally.stuck = 0;
      }
      ally.angle = target ? Math.atan2(target.y - ally.y, target.x - ally.x) : player.angle;
      const attackRange = ally.order === 4 ? 630 : ally.order === 1 ? 660 : 400;
      if (target && ally.attackTimer <= 0 && dist(ally, target) < attackRange)
        hokageAttack(ally, target);
    }
  }

  function castMightGuy() {
    if (mightGuyState.ally) {
      burst(mightGuyState.ally.x, mightGuyState.ally.y, '#e94839', 12);
      mightGuyState.ally = null;
      mightGuyState.afterimages.length = mightGuyState.finishers.length = mightGuyState.tigers.length = mightGuyState.moves.length = 0;
      return true;
    }
    let x = player.x, y = player.y;
    for (const offset of [72, 54, 36, 0]) {
      const tx = player.x + Math.cos(player.angle) * offset;
      const ty = player.y + Math.sin(player.angle) * offset;
      if (!blocked(tx, ty, 14)) { x = tx; y = ty; break; }
    }
    mightGuyState.ally = { x, y, r: 14, angle: player.angle,
      life: MIGHT_GUY_VFX_SPAN, maxLife: MIGHT_GUY_VFX_SPAN,
      attackTimer: .25, seekTimer: 0, afterimageTimer: 0, crashTimer: 0,
      target: null, attackPulse: 0, hitFlash: 0, nightTimer: 2.6, punchCount: 0 };
    mightGuyState.afterimages.length = mightGuyState.finishers.length = mightGuyState.tigers.length = mightGuyState.moves.length = 0;
    worldImpact(x, y, 110, 220, 'fire');
    burst(x, y, '#ff453c', 28);
    shake = Math.max(shake, 8);
    return true;
  }

  function addGuyMove(kind, x, y, angle, radius, life, extra) {
    const list = mightGuyState.moves;
    if (list.length >= 14) list.shift();
    list.push(Object.assign({ kind, x, y, angle, radius, life, maxLife: life }, extra));
  }

  function hitCone(x, y, angle, range, halfAngle, damage, push, limit = 40) {
    let hits = 0;
    forEachEnemyNear(x, y, range, z => {
      if (hits >= limit || z.health <= 0) return;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d > range + z.r) return;
      let da = Math.atan2(z.y - y, z.x - x) - angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d > z.r + 20 && Math.abs(da) > halfAngle) return;
      hurtZombie(z, damage, angle);
      if (z.health > 0 && push) moveCircle(z, Math.cos(angle) * push, Math.sin(angle) * push, z.r);
      hits++;
    });
    return hits;
  }

  // Asa Kujaku: a fan of flaming fists, so fast the air ignites into a peacock's tail.
  function guyPeacock(guy, k = 1) {
    const a = guy.angle, R = 300 * k;
    guy.attackTimer = .85; guy.attackPulse = .55; guy.hitFlash = .3;
    addGuyMove('peacock', guy.x, guy.y, a, R, 1, { scale: k });
    const hits = hitCone(guy.x, guy.y, a, R, .62 + (k - 1) * .25, 820, 26, Math.round(40 * k));
    worldImpact(guy.x + Math.cos(a) * R * .57, guy.y + Math.sin(a) * R * .57, 120 * k, 700, 'fire', a);
    if (k > 1) worldImpact(guy.x + Math.cos(a) * R * .9, guy.y + Math.sin(a) * R * .9, 90 * k, 500, 'fire', a);
    burst(guy.x + Math.cos(a) * 60, guy.y + Math.sin(a) * 60, '#ff8a3a', 26);
    shake = Math.max(shake, hits ? 10 : 7);
  }

  // Sekizō: five punches of compressed air, each one an invisible pillar slamming the ground.
  function guyElephant(guy, k = 1) {
    const a = guy.angle, cols = [], n = k > 1 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const d = (95 + i * 80) * k, side = (i % 2 ? 1 : -1) * (i ? 28 * k * (1 + i * .12) : 0);
      const cx = guy.x + Math.cos(a) * d - Math.sin(a) * side, cy = guy.y + Math.sin(a) * d + Math.cos(a) * side;
      cols.push(Math.round(cx - guy.x), Math.round(cy - guy.y));
      worldImpact(cx, cy, 78 * k, 620, 'shockwave', a);
      forEachEnemyNear(cx, cy, 92 * k, z => {
        if (z.health <= 0 || Math.hypot(z.x - cx, z.y - cy) > 92 * k + z.r) return;
        hurtZombie(z, 640, a);
        if (z.health > 0) moveCircle(z, Math.cos(a) * 34, Math.sin(a) * 34, z.r);
      });
    }
    guy.attackTimer = .95; guy.attackPulse = .6; guy.hitFlash = .3;
    addGuyMove('elephant', guy.x, guy.y, a, 90 * k, 1.05 + (n - 5) * .1, { cols, scale: k });
    shake = Math.max(shake, 11);
  }

  // Hirudora: a single punch that compresses the air into a roaring tiger.
  function guyTiger(guy, k = 1) {
    const a = guy.angle, range = 470 * k, radius = 235 * k;
    const ex = guy.x + Math.cos(a) * range, ey = guy.y + Math.sin(a) * range;
    guy.attackTimer = 1.05; guy.attackPulse = .7; guy.hitFlash = .35;
    if (mightGuyState.tigers.length >= 2) mightGuyState.tigers.shift();
    mightGuyState.tigers.push({ x: ex, y: ey, fromX: guy.x, fromY: guy.y, angle: a, radius, life: 1.15, maxLife: 1.15 });
    forEachEnemyNear((guy.x + ex) / 2, (guy.y + ey) / 2, range / 2 + 70 * k, z => {
      if (z.health <= 0 || !segmentHitsCircle(guy.x, guy.y, ex, ey, z, z.r + 70 * k)) return;
      hurtZombie(z, 1100, a);
      if (z.health > 0) moveCircle(z, Math.cos(a) * 90, Math.sin(a) * 90, z.r);
    });
    forEachEnemyNear(ex, ey, radius, z => {
      if (z.health <= 0 || Math.hypot(z.x - ex, z.y - ey) > radius + z.r) return;
      const away = Math.atan2(z.y - ey, z.x - ex);
      hurtZombie(z, 1300, away);
      if (z.health > 0) moveCircle(z, Math.cos(away) * 60, Math.sin(away) * 60, z.r);
    });
    worldImpact(ex, ey, radius * .8, 1300, 'shockwave', a);
    burst(guy.x + Math.cos(a) * 40, guy.y + Math.sin(a) * 40, '#dff8ff', 30);
    shake = Math.max(shake, 14);
  }

  function addMightGuyAfterimage(x, y, angle, id = 'guy') {
    if (mightGuyState.afterimages.length >= 14) mightGuyState.afterimages.shift();
    mightGuyState.afterimages.push({ x, y, angle, id, life: .29, maxLife: .29 });
  }

  function castNightGuy(guy, target) {
    guy.nightTimer = NIGHT_GUY_COOLDOWN;
    const sx = guy.x, sy = guy.y;
    const angle = Math.atan2(target.y - sy, target.x - sx);
    guy.angle = angle;
    const distance = Math.min(650, Math.hypot(target.x - sx, target.y - sy) + 35);
    for (let traveled = 0; traveled < distance; traveled += 10) {
      const nx = guy.x + Math.cos(angle) * 10;
      const ny = guy.y + Math.sin(angle) * 10;
      if (blocked(nx, ny, guy.r)) {
        worldImpact(nx, ny, 95, 1550, 'fire', angle);
        if (blocked(nx, ny, guy.r)) break;
      }
      guy.x = nx; guy.y = ny;
      if (Math.floor(traveled) % 50 < 10) addMightGuyAfterimage(guy.x, guy.y, angle);
    }
    const dashDistance = Math.hypot(guy.x - sx, guy.y - sy);
    for (let offset = 90; offset < dashDistance; offset += 110)
      addGroundScar(sx + Math.cos(angle) * offset, sy + Math.sin(angle) * offset, 62, 'fire', angle);
    const radius = 315;
    worldImpact(guy.x, guy.y, radius, 1450, 'fire', angle);
    if (mightGuyState.finishers.length >= 2) mightGuyState.finishers.shift();
    mightGuyState.finishers.push({ x: guy.x, y: guy.y, angle, radius,
      life: 1.1, maxLife: 1.1 });
    const struck = new Set();
    forEachEnemyNear((sx + guy.x) / 2, (sy + guy.y) / 2, dashDistance / 2 + 82, z => {
      if (z.health <= 0 || !segmentHitsCircle(sx, sy, guy.x, guy.y, z, z.r + 82)) return;
      struck.add(z.id);
      hurtZombie(z, 950, angle);
    });
    forEachEnemyNear(guy.x, guy.y, radius, z => {
      if (z.health <= 0 || dist(z, guy) > radius + z.r) return;
      const alreadyStruck = struck.has(z.id);
      const damage = alreadyStruck ? 2100 : 2750;
      hurtZombie(z, damage, angle);
    });
    guy.attackTimer = .75;
    guy.attackPulse = .7;
    guy.hitFlash = .4;
    burst(guy.x, guy.y, '#ff5035', 48);
    shake = Math.max(shake, 17);
  }

  function updateMightGuy(dt) {
    for (const list of [mightGuyState.afterimages, mightGuyState.finishers, mightGuyState.tigers, mightGuyState.moves]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
    const guy = mightGuyState.ally;
    if (!guy) return;
    // Preserve Night Guy's elapsed-life trigger without expiring the ally.
    guy.life = Math.max(1, guy.life - dt);
    guy.attackTimer -= dt;
    guy.seekTimer -= dt;
    guy.afterimageTimer -= dt;
    guy.crashTimer -= dt;
    guy.nightTimer -= dt;
    guy.attackPulse = Math.max(0, guy.attackPulse - dt);
    guy.hitFlash = Math.max(0, guy.hitFlash - dt);
    if (guy.seekTimer <= 0 || !guy.target || guy.target.health <= 0) {
      let closest = null, closestBoss = null, nearestSq = 850 ** 2, bossSq = 850 ** 2;
      forEachEnemyNear(guy.x, guy.y, 850, z => {
        if (z.health <= 0 || dist(z, player) > 1100) return;
        const dSq = (z.x - guy.x) ** 2 + (z.y - guy.y) ** 2;
        if (z.type === 'boss' && dSq < bossSq) { closestBoss = z; bossSq = dSq; }
        if (dSq < nearestSq) { closest = z; nearestSq = dSq; }
      });
      guy.target = closestBoss || closest;
      guy.seekTimer = .18;
    }
    const target = guy.target?.health > 0 ? guy.target : null;
    const tx = target ? target.x : player.x + Math.cos(elapsed * 2.1) * 48;
    const ty = target ? target.y : player.y + Math.sin(elapsed * 2.1) * 48;
    const dx = tx - guy.x, dy = ty - guy.y, distance = Math.hypot(dx, dy);
    const desiredGap = target ? target.r + 45 : 18;
    guy.moving = distance > desiredGap + 2;
    if (distance > desiredGap && distance > 0) {
      const step = Math.min(distance - desiredGap, (target ? 650 : 480) * dt);
      const mx = dx / distance * step, my = dy / distance * step;
      if (guy.crashTimer <= 0 && blocked(guy.x + mx, guy.y + my, guy.r)) {
        worldImpact(guy.x + mx, guy.y + my, 80, 900, 'fire', guy.angle);
        guy.crashTimer = .2;
      }
      const oldX = guy.x, oldY = guy.y;
      moveCircle(guy, mx, my, guy.r);
      if (guy.afterimageTimer <= 0 && Math.hypot(guy.x - oldX, guy.y - oldY) > 4) {
        addMightGuyAfterimage(oldX, oldY, guy.angle);
        guy.afterimageTimer = .055;
      }
    }
    guy.angle = target ? Math.atan2(target.y - guy.y, target.x - guy.x) : player.angle;
    if (!target) return;
    if (guy.nightTimer <= 0 && dist(guy, target) < 610) {
      castNightGuy(guy, target);
      return;
    }
    if (guy.attackTimer > 0 || dist(guy, target) > target.r + 85) return;
    guy.punchCount++;
    // Every ten hits: Morning Peacock on the 4th, Evening Elephant on the 7th, Daytime Tiger on the 10th.
    const step = guy.punchCount % 10;
    if (step === 4) { guyPeacock(guy); return; }
    if (step === 7) { guyElephant(guy); return; }
    if (step === 0) { guyTiger(guy); return; }
    guy.attackTimer = .33;
    guy.attackPulse = .23;
    guy.hitFlash = .14;
    if (guy.punchCount % 3 === 0) worldImpact(guy.x, guy.y, 88, 260, 'fire', guy.angle);
    else addGroundScar(guy.x, guy.y, 35, 'crater', guy.angle);
    addGuyMove('punch', guy.x + Math.cos(guy.angle) * 30, guy.y + Math.sin(guy.angle) * 30, guy.angle, 70, .32, { combo: guy.punchCount % 3 });
    burst(guy.x + Math.cos(guy.angle) * 33, guy.y + Math.sin(guy.angle) * 33, '#ffb16d', 7);
    let hits = 0;
    forEachEnemyNear(guy.x, guy.y, 120, z => {
      if (hits >= 12 || z.health <= 0 || dist(z, guy) > 120 + z.r) return;
      hurtZombie(z, 530, Math.atan2(z.y - guy.y, z.x - guy.x));
      hits++;
    });
    if (hits) shake = Math.max(shake, 5);
  }

  function beginPurpleChidoriCharge() {
    if (!running || paused || largeMap || purpleChidoriState.charge || me.down > 0) return false;
    purpleChidoriState.charge = { startedAt: performance.now(), ratio: 0 };
    return true;
  }

  function cancelPurpleChidoriCharge() {
    purpleChidoriState.charge = null;
  }

  function releasePurpleChidoriCharge() {
    const charge = purpleChidoriState.charge;
    if (!charge) return false;
    purpleChidoriState.charge = null;
    if (!running || paused || largeMap) return false;
    const ratio = clamp((performance.now() - charge.startedAt) / (MAX_PURPLE_CHARGE_SECONDS * 1000), 0, 1);
    return castPurpleChidori(ratio);
  }

  function castPurpleChidori(chargeRatio = 0) {
    const charge = clamp(chargeRatio, 0, 1);
    const sx = player.x, sy = player.y;
    const angle = Math.atan2(mouse.y + camera.y - sy, mouse.x + camera.x - sx);
    player.angle = angle;
    const maxSteps = Math.ceil((320 + charge * 680) / 10);
    for (let step = 0; step < maxSteps; step++) {
      const nx = player.x + Math.cos(angle) * 10, ny = player.y + Math.sin(angle) * 10;
      if (blocked(nx, ny, player.r)) {
        worldImpact(nx, ny, 80 + charge * 65, 560 + charge * 960, 'lightning', angle);
        if (blocked(nx, ny, player.r)) break;
      }
      player.x = nx; player.y = ny;
    }
    const dashDistance = Math.hypot(player.x - sx, player.y - sy);
    const pathRadius = 43 + charge * 95;
    const impactRadius = 100 + charge * 330;
    for (let offset = 135; offset < dashDistance; offset += 145)
      addGroundScar(sx + Math.cos(angle) * offset, sy + Math.sin(angle) * offset,
        40 + charge * 48, 'lightning', angle);
    worldImpact(player.x, player.y, impactRadius, 390 + charge * 1300, 'lightning', angle);
    player.invuln = Math.max(player.invuln, .65 + charge * .5);
    const trails = purpleChidoriState.trails, bursts = purpleChidoriState.bursts;
    if (trails.length >= 6) trails.shift();
    trails.push({ x1: sx, y1: sy, x2: player.x, y2: player.y,
      life: .52 + charge * .4, maxLife: .52 + charge * .4, charge });
    if (bursts.length >= 4) bursts.shift();
    bursts.push({ x: player.x, y: player.y, radius: impactRadius,
      life: .55 + charge * .5, maxLife: .55 + charge * .5, charge });
    const criticalDamage = Math.round((120 + charge * 280) * 3 * (player.nineTails ? 1.5 : 1));
    const cx = (sx + player.x) / 2, cy = (sy + player.y) / 2;
    let hits = 0;
    const hitIds = new Set();
    forEachEnemyNear(cx, cy, dashDistance / 2 + pathRadius, z => {
      if (z.health <= 0 || !segmentHitsCircle(sx, sy, player.x, player.y, z, z.r + pathRadius)) return;
      hurtZombie(z, criticalDamage, angle);
      hitIds.add(z.id);
      hits++;
    });
    forEachEnemyNear(player.x, player.y, impactRadius, z => {
      if (z.health <= 0 || hitIds.has(z.id)) return;
      const distance = dist(z, player);
      if (distance > impactRadius + z.r || blocked((z.x + player.x) / 2, (z.y + player.y) / 2, 4)) return;
      hurtZombie(z, Math.round(criticalDamage * (1 - .35 * Math.min(1, distance / impactRadius))), angle);
      hits++;
    });
    burst(player.x, player.y, '#b85cff', 18 + Math.round(charge * 32));
    shake = Math.max(shake, (hits ? 9 : 6) + charge * 8);
    return true;
  }

  function castLightningDash() {
    const sx = player.x, sy = player.y;
    const a = player.angle;
    for (let step = 0; step < 24; step++) {
      const nx = player.x + Math.cos(a) * 10, ny = player.y + Math.sin(a) * 10;
      if (blocked(nx, ny, player.r)) {
        worldImpact(nx, ny, 66, 290, 'lightning', a);
        if (blocked(nx, ny, player.r)) break;
      }
      player.x = nx; player.y = ny;
    }
    if (Math.hypot(player.x - sx, player.y - sy) < 16) return false;
    worldImpact(player.x, player.y, 72, 205, 'lightning', a);
    player.invuln = Math.max(player.invuln, .6);
    addSkillEffect('trails', { x1: sx, y1: sy, x2: player.x, y2: player.y, life: .42, maxLife: .42 });
    addSkillEffect('explosions', { x: player.x, y: player.y, radius: 60, life: .34, maxLife: .34, kind: 'lightning' });
    const cx = (sx + player.x) / 2, cy = (sy + player.y) / 2;
    forEachEnemyNear(cx, cy, Math.hypot(player.x - sx, player.y - sy) / 2 + 37, z => {
      if (z.health > 0 && segmentHitsCircle(sx, sy, player.x, player.y, z, z.r + 37))
        hurtZombie(z, 120, a);
    });
    burst(player.x, player.y, '#9cf5ff', 17);
    shake = Math.max(shake, 5);
    return true;
  }

  function castRasengan(chargeRatio = 0) {
    const charge = clamp(chargeRatio, 0, 1);
    let x = player.x + Math.cos(player.angle) * (66 + charge * 25);
    let y = player.y + Math.sin(player.angle) * (66 + charge * 25);
    if (blocked(x, y, 16)) { x = player.x + Math.cos(player.angle) * 30; y = player.y + Math.sin(player.angle) * 30; }
    const radius = Math.round(125 + charge * 175);
    const damage = Math.round(190 + charge * 510);
    worldImpact(x, y, radius, 350 + charge * 930, 'vortex');
    addSkillEffect('vortices', { x, y, radius, life: .72 + charge * .22, maxLife: .72 + charge * .22 });
    addSkillEffect('explosions', { x, y, radius, life: .58 + charge * .2, maxLife: .58 + charge * .2, kind: 'vortex' });
    forEachEnemyNear(x, y, radius, z => {
      if (z.health <= 0 || dist(z, { x, y }) > radius + z.r) return;
      if (blocked((x + z.x) / 2, (y + z.y) / 2, 4)) return;
      const angle = Math.atan2(z.y - y, z.x - x);
      hurtZombie(z, damage, angle);
      moveCircle(z, Math.cos(angle) * (30 + charge * 36), Math.sin(angle) * (30 + charge * 36), z.r);
    });
    burst(x, y, '#70dfff', 25 + Math.round(charge * 16));
    player.invuln = Math.max(player.invuln, .32 + charge * .3);
    shake = Math.max(shake, 7 + charge * 6);
    return true;
  }

  function castRasenShuriken(chargeRatio = 0) {
    const charge = clamp(chargeRatio, 0, 1), angle = player.angle;
    const r = 28 + charge * 56;
    const speed = 540 + charge * 175;
    const life = 1.5 + charge * .35;
    const x = player.x + Math.cos(angle) * (player.r + r * .72 + 12);
    const y = player.y + Math.sin(angle) * (player.r + r * .72 + 12);
    addSkillEffect('rasenShurikens', { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      angle, r, charge, life, maxLife: life });
    burst(x, y, '#b4f7ff', 12 + Math.round(charge * 13));
    shake = Math.max(shake, 3 + charge * 4);
    return true;
  }

  function explodeRasenShuriken(x, y, chargeRatio = 0) {
    const charge = clamp(chargeRatio, 0, 1);
    const radius = Math.round(140 + charge * 230);
    const damage = Math.round(250 + charge * 750);
    worldImpact(x, y, radius, 430 + charge * 1050, 'vortex');
    addSkillEffect('vortices', { x, y, radius: radius * .72, life: .72, maxLife: .72 });
    addSkillEffect('explosions', { x, y, radius, life: .78, maxLife: .78, kind: 'shuriken' });
    forEachEnemyNear(x, y, radius, z => {
      if (z.health <= 0 || dist(z, { x, y }) > radius + z.r) return;
      if (blocked((x + z.x) / 2, (y + z.y) / 2, 4)) return;
      const angle = Math.atan2(z.y - y, z.x - x);
      hurtZombie(z, damage, angle);
      moveCircle(z, Math.cos(angle) * (24 + charge * 45), Math.sin(angle) * (24 + charge * 45), z.r);
    });
    burst(x, y, '#b9f6ff', 28 + Math.round(charge * 20));
    shake = Math.max(shake, 8 + charge * 7);
  }

  function updateSkills(dt) {
    if (cutInState.life > 0) cutInState.life -= dt;
    updateMightGuy(dt);
    updateRinnegan(dt);
    updateBaryon(dt);
    window.SixPathsMode?.update(sixPathsState, me, dt, heroApi());
    window.SasukeIndra?.update(indraState, dt, heroApi());
    window.SusanooMode?.update(susanooState, me, dt, heroApi());
    updateFireSeas(dt);
    updateTags(dt);
    updateHokageSquad(dt);
    const charge = skillState.charge;
    if (charge) {
      charge.time = Math.min(MAX_CHARGE_SECONDS, (performance.now() - charge.startedAt) / 1000);
      charge.ratio = charge.time / MAX_CHARGE_SECONDS;
      charge.radius = (charge.kind === 'rasengan' ? 20 : 24) + charge.ratio * (charge.kind === 'rasengan' ? 58 : 62);
    }
    if (purpleChidoriState.charge)
      purpleChidoriState.charge.ratio = clamp(
        (performance.now() - purpleChidoriState.charge.startedAt) / (MAX_PURPLE_CHARGE_SECONDS * 1000), 0, 1);
    for (let i = skillState.beastBombs.length - 1; i >= 0; i--) {
      const bomb = skillState.beastBombs[i], ox = bomb.x, oy = bomb.y;
      bomb.x += bomb.vx * dt; bomb.y += bomb.vy * dt; bomb.life -= dt;
      let hit = bomb.life <= 0 || blocked(bomb.x, bomb.y, bomb.r) ||
        blocked((ox + bomb.x) / 2, (oy + bomb.y) / 2, bomb.r);
      if (!hit) forEachEnemyNear((ox + bomb.x) / 2, (oy + bomb.y) / 2,
        Math.hypot(bomb.x - ox, bomb.y - oy) / 2 + bomb.r, z => {
          if (segmentHitsCircle(ox, oy, bomb.x, bomb.y, z, z.r + bomb.r)) { hit = true; return false; }
        });
      if (hit) {
        explodeBeastBomb(blocked(bomb.x, bomb.y, 4) ? ox : bomb.x,
          blocked(bomb.x, bomb.y, 4) ? oy : bomb.y, bomb.charge || 0);
        skillState.beastBombs.splice(i, 1);
      }
    }
    for (let i = skillState.fireballs.length - 1; i >= 0; i--) {
      const fireball = skillState.fireballs[i], ox = fireball.x, oy = fireball.y;
      fireball.x += fireball.vx * dt; fireball.y += fireball.vy * dt; fireball.life -= dt;
      let hit = fireball.life <= 0 || blocked(fireball.x, fireball.y, fireball.r) ||
        blocked((ox + fireball.x) / 2, (oy + fireball.y) / 2, fireball.r);
      if (!hit) forEachEnemyNear((ox + fireball.x) / 2, (oy + fireball.y) / 2,
        Math.hypot(fireball.x - ox, fireball.y - oy) / 2 + fireball.r, z => {
          if (segmentHitsCircle(ox, oy, fireball.x, fireball.y, z, z.r + fireball.r)) { hit = true; return false; }
        });
      if (hit) {
        explodeFireball(blocked(fireball.x, fireball.y, 4) ? ox : fireball.x,
          blocked(fireball.x, fireball.y, 4) ? oy : fireball.y);
        skillState.fireballs.splice(i, 1);
      }
    }
    for (let i = skillState.rasenShurikens.length - 1; i >= 0; i--) {
      const shuriken = skillState.rasenShurikens[i], ox = shuriken.x, oy = shuriken.y;
      shuriken.x += shuriken.vx * dt; shuriken.y += shuriken.vy * dt; shuriken.life -= dt;
      const hitTerrain = blocked(shuriken.x, shuriken.y, shuriken.r * .62) ||
        blocked((ox + shuriken.x) / 2, (oy + shuriken.y) / 2, shuriken.r * .62);
      let hit = shuriken.life <= 0 || hitTerrain;
      if (!hit) forEachEnemyNear((ox + shuriken.x) / 2, (oy + shuriken.y) / 2,
        Math.hypot(shuriken.x - ox, shuriken.y - oy) / 2 + shuriken.r, z => {
          if (segmentHitsCircle(ox, oy, shuriken.x, shuriken.y, z, z.r + shuriken.r)) {
            hit = true; return false;
          }
        });
      if (hit) {
        explodeRasenShuriken(hitTerrain ? ox : shuriken.x, hitTerrain ? oy : shuriken.y, shuriken.charge);
        skillState.rasenShurikens.splice(i, 1);
      }
    }
    updateClones(dt);
    for (let i = skillState.summons.length - 1; i >= 0; i--) {
      const summon = skillState.summons[i];
      summon.life -= dt; summon.attackTimer -= dt; summon.seekTimer -= dt;
      summon.hitFlash = Math.max(0, summon.hitFlash - dt);
      summon.attackPulse = Math.max(0, (summon.attackPulse || 0) - dt);
      if (summon.life <= 0) { skillState.summons.splice(i, 1); continue; }
      if (summon.seekTimer <= 0 || !summon.target || summon.target.health <= 0 || dist(summon, summon.target) > 620) {
        summon.target = nearestEnemy(summon.x, summon.y, 600);
        summon.seekTimer = .25;
      }
      const target = summon.target;
      const chasing = target && dist(player, target) < 480;
      const tx = chasing ? target.x : player.x + Math.cos(elapsed * .7 + summon.side * 1.7) * 80;
      const ty = chasing ? target.y : player.y + Math.sin(elapsed * .7 + summon.side * 1.7) * 80;
      const dx = tx - summon.x, dy = ty - summon.y, distance = Math.hypot(dx, dy);
      if (distance > (chasing ? 88 : 20)) {
        const step = Math.min(distance, 170 * dt);
        moveCircle(summon, dx / distance * step, dy / distance * step, summon.r);
      }
      summon.angle = target ? Math.atan2(target.y - summon.y, target.x - summon.x) : player.angle;
      if (!target || summon.attackTimer > 0) continue;
      const gap = dist(summon, target);
      if (gap < 205) {
        summon.attackTimer = 1.05;
        summon.hitFlash = .2;
        summon.attackPulse = .24;
        const radius = 175;
        worldImpact(summon.x, summon.y, radius, 205, 'beast');
        effects.push({ x: summon.x, y: summon.y, radius, life: .4, max: .4, color: '#ac72ff' });
        if (effects.length > 40) effects.shift();
        burst(summon.x, summon.y, '#c99bff', 12);
        let hits = 0;
        forEachEnemyNear(summon.x, summon.y, radius + 44, z => {
          if (hits >= 28 || z.health <= 0 || dist(summon, z) > radius + z.r) return;
          hurtZombie(z, 235, Math.atan2(z.y - summon.y, z.x - summon.x));
          hits++;
        });
      } else if (gap < 600) {
        summon.attackTimer = .95;
        summon.hitFlash = .16;
        summon.attackPulse = .18;
        const a = summon.angle;
        bullets.push({ x: summon.x + Math.cos(a) * 47, y: summon.y + Math.sin(a) * 47,
          vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, life: .93, friendly: true,
          damage: 175, pierce: 2, hitIds: new Set(), kind: 'summon', color: '#ae7dff', splash: 72 });
      }
    }
    for (const name of ['trails', 'vortices', 'explosions']) {
      const list = skillState[name];
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
    for (const list of [purpleChidoriState.trails, purpleChidoriState.bursts]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
  }

  function startWave() {
    waveState.number++;
    waveState.boss = null;
    waveState.spawned = 0;
    waveState.total = waveState.number === 1 ? 250 : waveState.number === 2 ? 400 : 500;
    waveState.spawnTimer = 0;
    waveState.intermission = 0;
    showToast(`ĐỢT ${waveState.number} — ${waveState.total} NINJA ĐỊCH TẤN CÔNG`);
  }

  function pickZombieType() {
    const roll = Math.random();
    if (roll < .19) return 'spitter';
    if (roll < .37) return 'brute';
    if (roll < .69) return 'runner';
    return 'walker';
  }

  function spawnZombie(type, choice = null) {
    const spec = ZOMBIE_TYPES[type];
    // In co-op the horde closes in around a random teammate.
    const anchor = choice?.at || (targetList.length ? targetList[Math.floor(Math.random() * targetList.length)] : me);
    let x = anchor.x, y = anchor.y;
    for (let tries = 0; tries < 30; tries++) {
      const angle = rand(0, Math.PI * 2), range = choice?.at ? rand(140, 520) : rand(400, Math.min(1450, 850 + waveState.number * 150));
      x = clamp(anchor.x + Math.cos(angle) * range, 45, WORLD.w - 45);
      y = clamp(anchor.y + Math.sin(angle) * range, 45, WORLD.h - 45);
      if (!blocked(x, y, spec.radius + 3) && (choice?.at || Math.hypot(x - anchor.x, y - anchor.y) > 260)) break;
      x = clamp(roadCenter(x), 45, WORLD.w - 45);
      y = clamp(roadCenter(y), 45, WORLD.h - 45);
      if (!blocked(x, y, spec.radius + 3) && Math.hypot(x - anchor.x, y - anchor.y) > 260) break;
    }
    const level = Math.max(1, waveState.number);
    const otsutsukiWave = type === 'boss' && level >= 3 && level % 2 === 1;
    const bossFaction = type === 'boss' ? (choice?.faction || (otsutsukiWave ? 'otsutsuki' : 'akatsuki')) : null;
    const bossModule = bossModuleFor(bossFaction);
    const bossId = type === 'boss' ? (choice?.id || bossModule?.pick?.(level)) : null;
    const member = bossId ? bossModule?.members?.[bossId] : null;
    const beastId = type === 'beast' ? (choice?.id || window.TailedBeasts.pick(nextBeast++)) : null;
    const tails = beastId ? window.TailedBeasts.members[beastId].tails : 0;
    const scale = type === 'boss' ? 1 + Math.max(0, Math.floor((level - 2) / 3)) * .28
      : type === 'beast' ? (1 + tails * .15) * (1 + (level - 1) * .2)
      : 1 + Math.floor((level - 1) / 4) * .12;
    const maxHealth = Math.round(spec.hp * scale * (member?.hpScale || 1) * (type === 'boss' ? BOSS_POWER_MULTIPLIER : 1) * ENEMY_HP_POWER);
    const z = { id: ++nextZombieId, type, bossId, bossFaction, beastId, x, y, r: spec.radius, health: maxHealth, maxHealth,
      damage: spec.damage * (member?.damageScale || 1) * (type === 'boss' ? BOSS_POWER_MULTIPLIER : 1) * ENEMY_DAMAGE_POWER,
      angle: 0, color: spec.color, attackTimer: rand(.1, .6), spitTimer: rand(1, 2), pulse: rand(0, 6), deathTimer: 0,
      stuck: 0, sidestep: Math.random() < .5 ? -1 : 1, chargeTimer: rand(2.8, 4.2), skillWindup: 0,
      skillKind: '', dashTimer: 0, dashAngle: 0,
      hitFlash: 0, woundLevel: 0, seed: rand(0, Math.PI * 2) };
    zombies.push(z);
    if (type === 'boss') { waveState.boss = z; showToast(`${member?.name || 'BOSS'} XUẤT HIỆN!`); }
    if (type === 'beast') {
      showToast(`${window.TailedBeasts.members[beastId].name} XUẤT HIỆN!`);
      shake = Math.max(shake, 10);
    }
    return z;
  }

  // Tailed beasts arrive spread through each wave: one in wave 1, two in wave 2, three after.
  function beastSpawnIndices() {
    const count = Math.min(3, waveState.number);
    const list = [];
    for (let k = 1; k <= count; k++) list.push(Math.floor(waveState.total * k / (count + 1)) + 1);
    return list;
  }

  function updateWaves(dt) {
    if (!AUTO_WAVES) { spawnFromQueue(); return; }
    if (waveState.intermission > 0) {
      waveState.intermission -= dt;
      if (waveState.intermission <= 0) startWave();
      return;
    }
    waveState.spawnTimer -= dt;
    let alive = 0;
    for (const z of zombies) if (z.health > 0) alive++;
    const interval = waveState.number === 1 ? .03 : waveState.number === 2 ? .025 : .02;
    const bossSpawnIndex = Math.min(80, Math.floor(waveState.total * .2));
    const beastIndices = beastSpawnIndices();
    let batch = 0;
    while (waveState.spawned < waveState.total && waveState.spawnTimer <= 0 && alive < 500 && batch < 6) {
      const bossWave = waveState.number >= 2 && waveState.spawned === bossSpawnIndex;
      const beastTurn = window.TailedBeasts && beastIndices.includes(waveState.spawned);
      spawnZombie(bossWave ? 'boss' : beastTurn ? 'beast' : pickZombieType());
      waveState.spawned++; alive++; batch++;
      waveState.spawnTimer += interval;
    }
    if (waveState.spawned === waveState.total && alive === 0) {
      waveState.intermission = 4;
      healMe(.18, 12);
      if (coop()) netSend({ t: 'heal', h: .18, a: 12 });
      showToast(`ĐỢT ${waveState.number} HOÀN TẤT — HỒI MÁU`);
    }
  }

  // Enemies picked in the spawn panel arrive a few per frame so a big batch never hitches.
  function spawnFromQueue() {
    if (!spawnQueue.length) return;
    let alive = 0;
    for (const z of zombies) if (z.health > 0) alive++;
    for (let batch = 0; spawnQueue.length && alive < MAX_ALIVE && batch < 8; batch++, alive++) {
      const entry = spawnQueue.shift();
      const z = spawnZombie(entry.type, entry);
      if (entry.alert) villageAlert[entry.alert].leaders[entry.id] = z || null;
    }
  }

  function queueSpawns(list) {
    let added = 0;
    for (const entry of list) {
      if (added >= MAX_SPAWN_REQUEST) break;
      if (!ZOMBIE_TYPES[entry.type]) continue;
      spawnQueue.push({ type: entry.type, faction: entry.faction, id: entry.id });
      added++;
    }
    return added;
  }

  // Wrecking a house in another hidden village brings its ninjas — and its Kage — after you.
  function villageAlarm(id, b) {
    const alert = villageAlert[id] || (villageAlert[id] = { houses: 0, leaders: {} });
    alert.houses++;
    const first = alert.houses === 1;
    const at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    for (let i = 0; i < (first ? 40 : 14); i++) spawnQueue.push({ type: VILLAGE_NINJA[id], at });
    // Konoha sends every Hokage; a great village its Kage; a minor one the Akatsuki member born there.
    const H = window.HokageBosses, K = window.KageBosses, A = window.AkatsukiBosses;
    const leaders = id === 'konoha' ? (H?.order || []).map(lid => ['hokage', lid, H.members[lid].name])
      : K?.byVillage?.[id] ? [['kage', K.byVillage[id], K.members[K.byVillage[id]].name]]
      : A && VILLAGE_LEADER[id] ? [['akatsuki', VILLAGE_LEADER[id], A.members[VILLAGE_LEADER[id]].name]] : [];
    // A leader still queued counts as present, so one alarm never sends the same Kage twice.
    const absent = lid => { const z = alert.leaders[lid]; return z !== 'queued' && (!z || z.health <= 0 || !zombies.includes(z)); };
    const called = first || alert.houses % 4 === 0 ? leaders.filter(([, lid]) => absent(lid)) : [];
    called.forEach(([faction, lid], i) => {
      const a = i / called.length * Math.PI * 2;
      const spot = called.length > 1 ? { x: at.x + Math.cos(a) * 170, y: at.y + Math.sin(a) * 120 } : at;
      alert.leaders[lid] = 'queued';
      spawnQueue.splice(i, 0, { type: 'boss', faction, id: lid, at: spot, alert: id });
    });
    const village = villageLabel(id);
    if (called.length) {
      const who = id === 'konoha' && called.length > 2 ? 'CÁC ĐỜI HOKAGE' : called.map(c => c[2]).join(', ');
      showToast(`${village} BÁO ĐỘNG! ${who} XUẤT HIỆN!`, 3.2);
      if (coop()) netSend({ t: 'toast', text: `${village} BÁO ĐỘNG! ${who} XUẤT HIỆN!` });
    } else if (first) showToast(`${village} BÁO ĐỘNG!`, 2.4);
  }

  function clearEnemies() {
    zombies.length = 0; bullets.length = 0; spawnQueue.length = 0;
    for (const a of Object.values(villageAlert)) for (const k in a.leaders) if (a.leaders[k] === 'queued') a.leaders[k] = null;
    waveState.boss = null;
    enemyBuckets.clear();
  }

  // Rebuilt once after enemy movement; all player skills can share these buckets.
  const ENEMY_CELL = 160;
  const enemyBuckets = new Map();
  function enemyBucketKey(cx, cy) { return cx * 64 + cy; }

  function rebuildEnemyBuckets() {
    for (const bucket of enemyBuckets.values()) bucket.length = 0;
    for (const z of zombies) {
      if (z.health <= 0) continue;
      const key = enemyBucketKey(Math.floor(z.x / ENEMY_CELL), Math.floor(z.y / ENEMY_CELL));
      let bucket = enemyBuckets.get(key);
      if (!bucket) { bucket = []; enemyBuckets.set(key, bucket); }
      bucket.push(z);
    }
  }

  // Returns early when the callback returns false. Radius includes each enemy's body.
  function forEachEnemyNear(x, y, radius, callback) {
    if (!enemyBuckets.size && zombies.length) rebuildEnemyBuckets();
    const cellReach = radius + ZOMBIE_TYPES.boss.radius;
    const minX = Math.floor((x - cellReach) / ENEMY_CELL);
    const maxX = Math.floor((x + cellReach) / ENEMY_CELL);
    const minY = Math.floor((y - cellReach) / ENEMY_CELL);
    const maxY = Math.floor((y + cellReach) / ENEMY_CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = enemyBuckets.get(enemyBucketKey(cx, cy));
        if (!bucket) continue;
        for (const z of bucket) {
          if (z.health <= 0) continue;
          const dx = z.x - x, dy = z.y - y, reach = radius + z.r;
          if (dx * dx + dy * dy <= reach * reach && callback(z) === false) return;
        }
      }
    }
  }

  function nearestEnemy(x, y, radius) {
    let nearest = null, best = radius * radius;
    forEachEnemyNear(x, y, radius, z => {
      const dx = z.x - x, dy = z.y - y, distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < best) { best = distanceSquared; nearest = z; }
    });
    return nearest;
  }

  function addHostileProjectile(z, angle, speed, damage, kind, color, life = 1.5) {
    let hostileCount = 0;
    for (const b of bullets) if (!b.friendly) hostileCount++;
    // Keep the horde affordable while reserving a few visible shots for its boss.
    if (hostileCount >= (isGiant(z) ? 88 : 64)) return null;
    const shot = { x: z.x + Math.cos(angle) * (z.r + 5), y: z.y + Math.sin(angle) * (z.r + 5),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life,
      friendly: false, damage, kind, color, sourceBoss: isGiant(z) };
    bullets.push(shot);
    return shot;
  }

  function enemyPulse(z, radius, damage, color) {
    effects.push({ x: z.x, y: z.y, radius, life: .42, max: .42, color });
    if (effects.length > 40) effects.shift();
    burst(z.x, z.y, color, z.type === 'boss' ? 18 : 11);
    const fighting = player;
    for (const target of targetList) {
      player = target;
      if (dist(z, player) < radius + player.r && !blocked((z.x + player.x) / 2, (z.y + player.y) / 2, 4))
        damagePlayer(damage);
    }
    player = fighting;
    if (z.type !== 'boss' || !z.bossId) worldImpact(z.x, z.y, radius, damage * 1.25, z.type === 'brute' ? 'earth' : 'shockwave');
    shake = Math.max(shake, z.type === 'boss' ? 8 : 5);
  }

  function bossImpact(z, radius, power, color, move) {
    const kind = move === 'repel' ? 'shockwave' : move === 'amaterasu' || move === 'blast' ? 'fire' :
      move === 'tide' ? 'vortex' : move === 'scythe' || move === 'ritual' ? 'blade' :
      move === 'hearts' ? 'lightning' : 'crater';
    worldImpact(z.x, z.y, radius, power, kind, z.angle);
    shake = Math.max(shake, move === 'repel' ? 15 : 10);
  }

  // Shockwaves throw every teammate caught in them, not just the boss's current target.
  function bossKnockback(z, radius, distance, damage) {
    const fighting = player;
    for (const target of targetList) { player = target; knockbackOne(z, radius, distance, damage); }
    player = fighting;
  }

  function knockbackOne(z, radius, distance, damage) {
    if (dist(z, player) > radius + player.r) return;
    if (blocked((z.x + player.x) / 2, (z.y + player.y) / 2, 4)) return;
    if (player.invuln <= 0) damagePlayer(damage);
    const angle = Math.atan2(player.y - z.y, player.x - z.x);
    if (player.remote) netSend({ t: 'shove', to: player.peerId, a: +angle.toFixed(3), d: Math.round(distance) });
    applyShove(angle, distance);
  }

  function applyShove(angle, distance) {
    for (let step = 0; step < 14; step++)
      moveCircle(player, Math.cos(angle) * distance / 14, Math.sin(angle) * distance / 14, player.r);
    addGroundScar(player.x, player.y, Math.min(74, distance * .34), 'shockwave', angle);
    player.invuln = Math.max(player.invuln, .5);
  }

  function updateZombies(dt) {
    collectTargets();
    enemyAction = true;
    try {
      updateGruntJutsu(dt);
      for (let i = zombies.length - 1; i >= 0; i--) updateZombie(zombies[i], i, dt);
    } finally { player = me; enemyAction = false; }
  }

  // A Kage jutsu landing on a spot: hits every teammate (and clone) inside the radius.
  function enemyStrike(x, y, radius, damage, color, kind, quiet) {
    if (color && !quiet) { effects.push({ x, y, radius, life: .45, max: .45, color }); if (effects.length > 40) effects.shift(); burst(x, y, color, 14); }
    if (kind) worldImpact(x, y, radius, damage * 1.3, kind);
    const fighting = player;
    for (const target of targetList) {
      player = target;
      if (Math.hypot(x - player.x, y - player.y) < radius + player.r) damagePlayer(damage);
    }
    player = fighting;
    // In the war, Madara's jutsu hurl the Allied Shinobi caught in them through the air.
    if (warState.active && radius >= 50 && window.WarAllies?.blast) window.WarAllies.blast(warState.forces, x, y, radius * 1.2, warAllyApi());
    if (!quiet) shake = Math.max(shake, 7);
  }

  // What a boss or tailed beast module may do to the world. `player` is the ninja it is fighting.
  //   strike(x, y, r, dmg, color, kind, quiet)  hit every teammate inside a circle (kind also scars/smashes the ground)
  //   line(x1, y1, x2, y2, halfWidth, dmg, kind) hit every teammate along a thick segment
  //   world(x, y, r, power, kind, angle)         craters and destroyed buildings only, no damage
  //   shake(amount)                              camera shake
  //   time                                       game clock in seconds (for VFX seeds)
  function giantApi(z) {
    return { player, damage: z.damage, time: elapsed,
      projectile: addHostileProjectile, pulse: enemyPulse, impact: bossImpact,
      knockback: bossKnockback, burst, blocked, damagePlayer, strike: enemyStrike, line: enemyLine,
      world: worldImpact, shake: n => { shake = Math.max(shake, n); },
      move: (dx, dy) => moveCircle(z, dx, dy, z.r),
      summon: (type, x, y) => { if (!ZOMBIE_TYPES[type] || type === 'boss' || type === 'beast' || spawnQueue.length > 40) return false; spawnQueue.push({ type, at: { x, y } }); return true; } };
  }

  function enemyLine(x1, y1, x2, y2, halfWidth, damage, kind) {
    const fighting = player;
    for (const target of targetList) {
      player = target;
      if (segmentHitsCircle(x1, y1, x2, y2, player, halfWidth + player.r)) damagePlayer(damage);
    }
    player = fighting;
    if (!kind) return;
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d <= len; d += 150) {
      const t = len ? d / len : 0, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      addGroundScar(x, y, halfWidth * .8, kind, Math.atan2(y2 - y1, x2 - x1));
      damageBuildings(x, y, halfWidth, damage * 1.3, kind);
    }
  }

  // Like enemyLine, for a wedge: hits (and optionally shoves) every teammate inside the cone.
  function enemyCone(x, y, angle, len, half, damage, push, kind) {
    const fighting = player;
    for (const target of targetList) {
      player = target;
      const d = Math.hypot(player.x - x, player.y - y);
      if (d > len + player.r) continue;
      const da = Math.atan2(Math.sin(Math.atan2(player.y - y, player.x - x) - angle), Math.cos(Math.atan2(player.y - y, player.x - x) - angle));
      if (d > 30 && Math.abs(da) > half) continue;
      if (push && player.invuln <= 0) {
        damagePlayer(damage);
        if (player.remote) netSend({ t: 'shove', to: player.peerId, a: +angle.toFixed(3), d: Math.round(push) });
        applyShove(angle, push);
      } else damagePlayer(damage);
    }
    player = fighting;
    if (kind) for (let d = 120; d <= len; d += 140)
      damageBuildings(x + Math.cos(angle) * d, y + Math.sin(angle) * d, 60 + d * half * .6, damage * 1.3, kind);
  }

  // Signature jutsu of the spawnable ninja. Each type (or village style) has one or two; they come
  // round every 8–12 s, show their danger zone on the ground first, then land. The effects live in
  // gruntFx (drawn by enemy-jutsu-vfx.js) and the delayed blows in gruntHits.
  const gruntFx = [], gruntHits = [];
  const GRUNT_FX_CAP = 36;
  const GRUNT_SIGS = {
    walker: ['kunaiRain', 'tagKunai'], runner: ['raiBeam'], brute: ['earthSpikes'], spitter: ['fireDragon', 'greatFireball'],
    konoha: ['greatFireball', 'tagKunai', 'fireDragon'], suna: ['windCone', 'sandBind'], kiri: ['waterDragon', 'waterWave'], kumo: ['boltRain', 'raiBeam'], iwa: ['boulder', 'spikeRing'],
    ame: ['needleRain'], oto: ['soundWave'], taki: ['waterfall'], kusa: ['thorns'], yu: ['geysers']
  };
  const GRUNT_LABELS = {
    kunaiRain: 'PHI TIÊU VŨ', tagKunai: 'BỘC PHÙ KHỔ VÔ', raiBeam: 'LÔI ĐỘN · LÔI XÀ', earthSpikes: 'THỔ ĐỘN · NHAM THƯƠNG',
    fireDragon: 'HỎA ĐỘN · HỎA LONG VIÊM', greatFireball: 'HỎA ĐỘN · HÀO HỎA CẦU', windCone: 'PHONG ĐỘN · ĐẠI ĐỘT PHÁ', sandBind: 'SA PHƯỢC CỮU',
    waterDragon: 'THỦY ĐỘN · THỦY LONG ĐẠN', waterWave: 'THỦY ĐỘN · ĐẠI BỘC BỐ', boltRain: 'LÔI ĐỘN · LÔI HẢI', boulder: 'THỔ ĐỘN · GIA TRỌNG NHAM',
    spikeRing: 'THỔ ĐỘN · ĐỊA THỨ', needleRain: 'THIÊN THỦY CHÂM', soundWave: 'HƯỞNG MINH XUYÊN', waterfall: 'THỦY ĐỘN · BỘC BỐ KÍCH',
    thorns: 'GAI CỎ TRÓI THÂN', geysers: 'BỘC NHIỆT · NHIỆT TUYỀN'
  };
  function gruntSigs(spec, type) {
    const own = GRUNT_SIGS[spec.style] || GRUNT_SIGS[type] || [];
    return spec.jutsu ? own.concat(GRUNT_SIGS[spec.jutsu]) : own;
  }

  function addGruntFx(fx) {
    gruntFx.push(Object.assign({ seed: Math.random() * 100, life: fx.warn + fx.dur, maxLife: fx.warn + fx.dur }, fx));
    if (gruntFx.length > GRUNT_FX_CAP) gruntFx.shift();
  }
  function gruntLater(t, run) { gruntHits.push({ at: elapsed + t, run }); }

  // Starts signature `sig` from z at the ninja it is fighting; returns the windup in seconds.
  function castGruntSig(z, sig, dmg) {
    const p = player, a = Math.atan2(p.y - z.y, p.x - z.x), px = p.x, py = p.y, zx = z.x, zy = z.y;
    z.sigLabel = GRUNT_LABELS[sig]; z.sigLabelTimer = 1.2;
    switch (sig) {
      case 'kunaiRain':
        addGruntFx({ kind: 'rain', style: 'kunai', x: px, y: py, r: 200, warn: .8, dur: .9 });
        gruntLater(.95, () => enemyStrike(px, py, 200, dmg * 1.9, null, 'blade', true));
        return .8;
      case 'needleRain':
        addGruntFx({ kind: 'rain', style: 'needle', x: px, y: py, r: 260, warn: .8, dur: .9 });
        for (let i = 0; i < 3; i++) gruntLater(.9 + i * .22, () => enemyStrike(px, py, 260, dmg * .85, null, null, true));
        return .8;
      case 'tagKunai':
        gruntLater(.35, () => {
          for (const off of [-.25, 0, .25]) { const s = addHostileProjectile(z, a + off, 460, dmg * 1.3, 'shuriken', '#ffdd8a', 1.3); if (s) s.blast = 110; }
          burst(z.x, z.y, '#ffd27a', 8);
        });
        return .35;
      case 'raiBeam': {
        const len = 600;
        addGruntFx({ kind: 'beam', style: 'lightning', shape: 'line', x: zx, y: zy, angle: a, len, w: 42, warn: .65, dur: .8 });
        gruntLater(.65, () => { enemyLine(zx, zy, zx + Math.cos(a) * len, zy + Math.sin(a) * len, 42, dmg * 2.1, 'lightning'); shake = Math.max(shake, 7); });
        return .65;
      }
      case 'waterDragon': {
        const len = 660;
        addGruntFx({ kind: 'beam', style: 'water', shape: 'line', x: zx, y: zy, angle: a, len, w: 54, warn: .7, dur: 1.2 });
        gruntLater(.85, () => { enemyLine(zx, zy, zx + Math.cos(a) * len, zy + Math.sin(a) * len, 54, dmg * 2.2, 'vortex'); shake = Math.max(shake, 8); });
        return .7;
      }
      case 'earthSpikes': {
        const len = 540;
        addGruntFx({ kind: 'spikes', style: 'earth', shape: 'line', x: zx, y: zy, angle: a, len, w: 48, warn: .7, dur: 1.1 });
        for (let i = 0; i < 6; i++) {
          const d = 50 + i * 90;
          gruntLater(.7 + i * .06, () => enemyStrike(zx + Math.cos(a) * d, zy + Math.sin(a) * d, 60, dmg * 1.9, null, i % 2 ? 'earth' : null, true));
        }
        return .7;
      }
      case 'spikeRing':
        addGruntFx({ kind: 'spikes', style: 'earth', x: px, y: py, r: 240, warn: .85, dur: 1.2 });
        gruntLater(.9, () => { enemyStrike(px, py, 240, dmg * 1.9, null, 'earth', true); shake = Math.max(shake, 8); });
        return .85;
      case 'thorns':
        addGruntFx({ kind: 'spikes', style: 'thorn', x: px, y: py, r: 230, warn: .8, dur: 2 });
        for (let i = 0; i < 4; i++) gruntLater(.85 + i * .4, () => enemyStrike(px, py, 230, dmg * .7, null, null, true));
        return .8;
      case 'fireDragon':
        addGruntFx({ kind: 'cone', style: 'fire', shape: 'cone', x: zx, y: zy, angle: a, len: 420, half: .45, warn: .7, dur: 1.1 });
        gruntLater(.8, () => { enemyCone(zx, zy, a, 420, .45, dmg * 2, 0, 'fire'); shake = Math.max(shake, 6); });
        return .7;
      case 'greatFireball':
        gruntLater(.45, () => {
          const s = addHostileProjectile(z, a, 380, dmg * 2.2, 'enemyFire', '#ff7a2a', 1.8);
          if (s) { s.blast = 150; s.big = true; }
          burst(z.x, z.y, '#ff8b3d', 12);
        });
        return .45;
      case 'windCone':
        addGruntFx({ kind: 'cone', style: 'wind', shape: 'cone', x: zx, y: zy, angle: a, len: 460, half: .5, warn: .6, dur: 1.1 });
        gruntLater(.65, () => { enemyCone(zx, zy, a, 460, .5, dmg * 1.7, 150, 'shockwave'); shake = Math.max(shake, 6); });
        return .6;
      case 'waterWave':
        addGruntFx({ kind: 'cone', style: 'water', shape: 'cone', x: zx, y: zy, angle: a, len: 440, half: .7, warn: .7, dur: 1.1 });
        gruntLater(.8, () => { enemyCone(zx, zy, a, 440, .7, dmg * 1.6, 130, 'vortex'); shake = Math.max(shake, 6); });
        return .7;
      case 'soundWave':
        addGruntFx({ kind: 'cone', style: 'sound', shape: 'cone', x: zx, y: zy, angle: a, len: 480, half: .55, warn: .6, dur: 1.2 });
        gruntLater(.65, () => enemyCone(zx, zy, a, 480, .55, dmg * 1.8, 90, 'shockwave'));
        return .6;
      case 'sandBind':
        addGruntFx({ kind: 'zone', style: 'sand', x: px, y: py, r: 190, warn: .85, dur: 2.6 });
        for (let i = 0; i < 6; i++) gruntLater(.9 + i * .4, () => enemyStrike(px, py, 190, dmg * .55, null, null, true));
        return .85;
      case 'boltRain': {
        const pts = [0, 0];
        for (let i = 1; i < 6; i++) { const an = i * 1.26 + Math.random(), d = 110 + Math.random() * 130; pts.push(Math.round(Math.cos(an) * d), Math.round(Math.sin(an) * d)); }
        addGruntFx({ kind: 'bolts', style: 'lightning', x: px, y: py, r: 80, pts, stagger: .1, warn: .75, dur: 1.1 });
        for (let i = 0; i < pts.length; i += 2) gruntLater(.75 + i / 2 * .1, () => enemyStrike(px + pts[i], py + pts[i + 1], 80, dmg * 1.6, null, 'lightning', true));
        return .75;
      }
      case 'boulder':
        addGruntFx({ kind: 'boulder', style: 'rock', x: px, y: py, r: 170, warn: 1, dur: 1.2 });
        gruntLater(1.36, () => { enemyStrike(px, py, 170, dmg * 2.5, null, 'crater', true); shake = Math.max(shake, 10); });
        return 1;
      case 'waterfall':
        addGruntFx({ kind: 'geyser', style: 'waterfall', x: px, y: py, r: 150, warn: .85, dur: 1.1 });
        gruntLater(.95, () => { enemyStrike(px, py, 150, dmg * 2.2, null, 'vortex', true); shake = Math.max(shake, 7); });
        return .85;
      case 'geysers': {
        const pts = [0, 0];
        for (let i = 1; i < 4; i++) { const an = i * 2.1 + Math.random(), d = 120 + Math.random() * 60; pts.push(Math.round(Math.cos(an) * d), Math.round(Math.sin(an) * d)); }
        pts.forEach((v, i) => {
          if (i % 2) return;
          const gx = px + pts[i], gy = py + pts[i + 1];
          addGruntFx({ kind: 'geyser', style: 'steam', x: gx, y: gy, r: 100, warn: .7 + i / 2 * .22, dur: 1.2 });
          gruntLater(.75 + i / 2 * .22, () => enemyStrike(gx, gy, 100, dmg * 1.7, null, 'shockwave', true));
        });
        return .7;
      }
    }
    return 0;
  }

  // The jutsu name in small letters over a ninja while it casts its signature.
  function drawGruntLabels() {
    ctx.save(); ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#160f1d';
    for (const z of zombies) {
      if (!(z.sigLabelTimer > 0) || z.health <= 0 || !visible(z.x - 80, z.y - 110, 160, 120)) continue;
      ctx.globalAlpha = Math.min(1, z.sigLabelTimer * 3);
      ctx.fillStyle = STYLE_ACCENT[ZOMBIE_TYPES[z.type].style] || '#ffd27a';
      ctx.strokeText(z.sigLabel, z.x, z.y - 74); ctx.fillText(z.sigLabel, z.x, z.y - 74);
    }
    ctx.restore();
  }

  function updateGruntJutsu(dt) {
    for (let i = gruntFx.length - 1; i >= 0; i--) if ((gruntFx[i].life -= dt) <= 0) gruntFx.splice(i, 1);
    for (let i = 0; i < gruntHits.length; i++) {
      if (gruntHits[i].at > elapsed) continue;
      gruntHits.splice(i--, 1)[0].run();
    }
  }

  // Each enemy fights the nearest standing teammate: `player` is bound to that ninja.
  function updateZombie(z, i, dt) {
    {
      if (z.health <= 0) { z.deathTimer -= dt; if (z.deathTimer <= 0) zombies.splice(i, 1); return; }
      if (!targetList.length) return;
      player = nearestTarget(z);
      const spec = ZOMBIE_TYPES[z.type], d = dist(z, player), damage = z.damage || spec.damage;
      const bossModule = bossModuleOf(z);
      const customBoss = !!(bossModule && typeof bossModule.update === 'function');
      const desired = Math.atan2(player.y - z.y, player.x - z.x);
      z.angle = desired; z.pulse += dt * (z.type === 'runner' ? 11 : 5);
      z.attackTimer -= dt; z.spitTimer -= dt; z.chargeTimer -= dt;
      z.hitFlash = Math.max(0, z.hitFlash - dt);
      if (customBoss) bossModule.update(z, dt, giantApi(z));
      if (z.type === 'beast') window.TailedBeasts.update(z, dt, giantApi(z));

      const oldWindup = z.skillWindup;
      z.skillWindup = Math.max(0, z.skillWindup - dt);
      if (oldWindup > 0 && z.skillWindup === 0) {
        if (z.skillKind === 'dash') {
          z.dashTimer = .22;
          burst(z.x, z.y, '#93dcff', 7);
        } else if (z.skillKind === 'stomp') enemyPulse(z, 125, damage * 1.45, '#d4a871');
        else if (z.skillKind === 'bossPulse' && !customBoss) enemyPulse(z, 185, damage * 1.4, '#af8cff');
        else if (z.skillKind === 'shuriken') {
          addHostileProjectile(z, desired + rand(-.06, .06), 420, damage, 'shuriken', '#c7d7dc', 1.35);
          burst(z.x, z.y, '#d5e6ec', 3);
        } else if (z.skillKind === 'fire') {
          addHostileProjectile(z, desired + rand(-.05, .05), 315, damage, 'enemyFire', '#ff813a', 1.7);
          burst(z.x, z.y, '#ff8b3d', 5);
        } else if (z.skillKind === 'wind') {
          // Suna's Kamaitachi: three crescent wind blades.
          for (const offset of [-.22, 0, .22]) addHostileProjectile(z, desired + offset, 540, damage * .75, 'wind', '#f2e2b8', 1.15);
          burst(z.x, z.y, '#f2e2b8', 6);
        } else if (z.skillKind === 'gust') {
          enemyPulse(z, 150, damage * 1.1, '#e8d8a8');
          bossKnockback(z, 150, 140, 0);
        } else if (z.skillKind === 'water') {
          addHostileProjectile(z, desired + rand(-.04, .04), 600, damage * 1.1, 'water', '#7fd0ff', 1.4);
          burst(z.x, z.y, '#a8e2ff', 5);
        } else if (z.skillKind === 'bolt') {
          addHostileProjectile(z, desired + rand(-.03, .03), 780, damage * .95, 'chakra', '#ffe45a', 1.1);
          burst(z.x, z.y, '#fff3a0', 6);
        } else if (z.skillKind === 'rock') {
          const shot = addHostileProjectile(z, desired, 430, damage * 1.25, 'rock', '#9a7a5a', 1.5);
          if (shot) shot.blast = 70;
          burst(z.x, z.y, '#b8956a', 5);
        } else if (z.skillKind === 'fan' && !customBoss) {
          for (const offset of [-.28, -.14, 0, .14, .28])
            addHostileProjectile(z, desired + offset, 400, damage * .55, 'chakra', '#b58aff', 1.7);
          burst(z.x, z.y, '#bb95ff', 9);
        }
        z.skillKind = '';
      }

      z.sigLabelTimer = Math.max(0, (z.sigLabelTimer || 0) - dt);
      if (z.sigTimer === undefined) z.sigTimer = rand(3, 8);
      z.sigTimer -= dt;
      const sigs = !z.netProxy && z.type !== 'boss' && z.type !== 'beast' ? gruntSigs(spec, z.type) : null;
      if (sigs?.length && z.sigTimer <= 0 && z.skillWindup <= 0 && z.dashTimer <= 0 && d < 560 && gruntFx.length < GRUNT_FX_CAP - 4) {
        z.sigCount = (z.sigCount || 0) + 1;
        const windup = castGruntSig(z, sigs[z.sigCount % sigs.length], damage);
        z.skillKind = 'sig'; z.skillWindup = windup;
        z.sigTimer = rand(8, 12);
      }
      const style = spec.jutsu || spec.style;
      if (style && z.spitTimer <= 0 && z.skillWindup <= 0 && z.dashTimer <= 0 && d < 520) {
        const near = d < 170, mid = d > 70 && d < 320;
        z.skillKind = style === 'suna' ? (near && Math.random() < .4 ? 'gust' : 'wind')
          : style === 'kiri' ? (mid && Math.random() < .45 ? 'dash' : 'water')
          : style === 'kumo' ? (mid && Math.random() < .55 ? 'dash' : 'bolt')
          : near ? 'stomp' : 'rock';
        if (z.skillKind === 'dash') z.dashAngle = desired;
        z.skillWindup = z.skillKind === 'stomp' || z.skillKind === 'gust' ? .45 : .32;
        z.spitTimer = rand(1.6, 2.4);
      } else if (z.type === 'runner' && z.spitTimer <= 0 && d > 70 && d < 340 && z.skillWindup <= 0 && z.dashTimer <= 0) {
        z.skillKind = 'dash'; z.skillWindup = .3; z.dashAngle = desired; z.spitTimer = rand(2.5, 3.2);
      } else if (z.type === 'brute' && z.spitTimer <= 0 && d < 170 && z.skillWindup <= 0) {
        z.skillKind = 'stomp'; z.skillWindup = .5; z.spitTimer = rand(3, 3.8);
      } else if (z.type === 'boss' && !customBoss && z.chargeTimer <= 0 && d < 225 && z.skillWindup <= 0) {
        z.skillKind = 'bossPulse'; z.skillWindup = .65; z.chargeTimer = rand(4.2, 5);
      }

      let speed = spec.speed * (z.type === 'boss' ? 1.35 : 1) * (1 + Math.min(waveState.number - 1, 12) * .025);
      if (z.rootTimer > 0) {
        z.rootTimer = Math.max(0, z.rootTimer - dt);
        speed *= z.type === 'boss' ? .5 : .14;
      }
      if (z.soakedTimer > 0) {
        z.soakedTimer = Math.max(0, z.soakedTimer - dt);
        speed *= .65;
      }
      if (z.skillWindup > 0 || z.akatsukiWindup > 0 || z.otsuWindup > 0 || z.kageWindup > 0 || z.bossWindup > 0) speed *= .25;
      if (z.kageDash > 0) speed = 0;
      if (z.beastWindup > 0) speed *= .15;
      if (z.beastDashTimer > 0) speed = 0;
      const dashing = z.dashTimer > 0;
      if (z.speedScale) speed *= z.speedScale;
      if (dashing) { speed *= 3.3; z.dashTimer = Math.max(0, z.dashTimer - dt); }
      const approach = z.type !== 'spitter' || d > 260;
      const retreat = z.type === 'spitter' && d < 170;
      if (dashing || (d > z.r + player.r + 5 && (approach || retreat))) {
        const direction = retreat ? -1 : 1;
        const moveAngle = dashing ? z.dashAngle : desired;
        const ox = z.x, oy = z.y;
        moveCircle(z, Math.cos(moveAngle) * speed * dt * direction, Math.sin(moveAngle) * speed * dt * direction, z.r);
        if (dashing && z.attackTimer <= 0 && segmentHitsCircle(ox, oy, z.x, z.y, player, z.r + player.r + 5)) {
          damagePlayer(damage * 1.5); z.attackTimer = .65;
          effects.push({ x: z.x, y: z.y, radius: 42, life: .3, max: .3, color: '#83dbff' });
          if (effects.length > 40) effects.shift();
        }
        if (!dashing && Math.hypot(z.x - ox, z.y - oy) < speed * dt * .2) {
          z.stuck += dt;
          const sideAngle = desired + z.sidestep * Math.PI / 2;
          moveCircle(z, Math.cos(sideAngle) * speed * dt, Math.sin(sideAngle) * speed * dt, z.r);
          if (z.stuck > 1.1) { z.sidestep *= -1; z.stuck = 0; }
        } else z.stuck = 0;
      }

      if (z.skillWindup <= 0 && z.type === 'walker' && d < 430 && z.spitTimer <= 0) {
        z.spitTimer = rand(2.1, 2.8);
        z.skillKind = 'shuriken'; z.skillWindup = .25;
      } else if (z.skillWindup <= 0 && z.type === 'spitter' && d < 510 && z.spitTimer <= 0) {
        z.spitTimer = rand(1.9, 2.5);
        z.skillKind = 'fire'; z.skillWindup = .38;
      } else if (z.skillWindup <= 0 && z.type === 'boss' && !customBoss && d < 570 && z.spitTimer <= 0) {
        z.spitTimer = rand(2.5, 3.1);
        z.skillKind = 'fan'; z.skillWindup = .5;
      }

      if (d < z.r + player.r + 6 && z.attackTimer <= 0) {
        damagePlayer(damage); z.attackTimer = z.type === 'runner' ? .7 : z.type === 'boss' ? .82 : z.type === 'beast' ? 1.1 : 1.0;
        if (isGiant(z)) shake = Math.max(shake, 8);
        if (z.type === 'beast') z.beastPulse = .35;
      }
    }
  }

  function killZombie(z) {
    z.health = 0; z.deathTimer = 2.2;
    // Kills and score are shared by the whole co-op team; the host keeps the tally.
    me.kills++; me.score += ZOMBIE_TYPES[z.type].score;
    addBloodDecal(z.x, z.y, isGiant(z) ? 34 : z.type === 'brute' ? 20 : 13);
    bloodBurst(z.x, z.y, rand(0, Math.PI * 2), isGiant(z) ? 30 : 10);
    burst(z.x, z.y, z.type === 'boss' ? '#ff5272' : '#7d463f', isGiant(z) ? 15 : 4);
    if (z.type === 'beast') {
      // Felling a tailed beast collapses it back into chakra and restores whoever landed the blow.
      addSkillEffect('explosions', { x: z.x, y: z.y, radius: 220, life: .9, maxLife: .9, kind: 'smoke' });
      shake = Math.max(shake, 14);
    }
    if (z.type === 'boss') waveState.boss = null;
    if (!isGiant(z)) return;
    const name = z.type === 'beast' ? window.TailedBeasts.members[z.beastId].name : bossName(z);
    if (coop()) netSend({ t: 'reward', kind: z.type, name, killer: z.lastHitBy || net.id });
    grantReward(z.type, name, z.lastHitBy || net.id);
  }

  function bossName(z) {
    return bossModuleOf({ type: 'boss', bossId: z.bossId, bossFaction: z.bossFaction })?.members?.[z.bossId]?.name || ZOMBIE_TYPES.boss.name;
  }

  // Tailed beasts and bosses heal and armor whoever lands the final blow.
  function grantReward(kind, name, killer) {
    if (killer !== net.id) {
      showToast(`${peerName(killer)} ĐÃ HẠ ${name}!`);
      return;
    }
    if (kind === 'beast') {
      healMe(.35, 25);
      showToast(`ĐÃ HẠ ${name}! +MÁU +GIÁP`);
      return;
    }
    healMe(.3, 25);
    showToast(`HẠ BOSS ${name}! +MÁU +GIÁP`);
  }

  function healMe(fraction, armor) {
    if (me.down > 0) return;
    me.health = Math.min(me.maxHealth || 100, me.health + (me.maxHealth || 100) * fraction);
    me.armor = Math.min(100, me.armor + armor);
  }

  function hurtZombie(z, damage, impactAngle = 0) {
    if (z.health <= 0) return;
    if (player.nineTails) damage *= BARYON_DAMAGE_MULTIPLIER;
    if (z.netProxy) {
      // Guests only predict the hit; the host applies it and decides the kill.
      recordHit(z, damage, impactAngle, 0, 0);
      z.health = Math.max(1, z.health - damage);
      z.hitFlash = .12;
      bloodBurst(z.x, z.y, impactAngle, damage > 80 ? 9 : 4);
      return;
    }
    z.lastHitBy = 0;
    applyHit(z, damage, impactAngle);
  }

  function applyHit(z, damage, impactAngle) {
    if (z.armorScale) damage *= z.armorScale;
    z.health = Math.max(0, z.health - damage);
    z.hitFlash = .12;
    z.woundLevel = 1 - z.health / z.maxHealth;
    bloodBurst(z.x, z.y, impactAngle, damage > 80 ? 9 : 4);
    if (damage > 80 || Math.random() < .38) addBloodDecal(z.x + rand(-8, 8), z.y + rand(-8, 8), damage > 80 ? 9 : 5);
    if (z.health <= 0) killZombie(z);
  }

  function segmentHitsCircle(x1, y1, x2, y2, target, radius) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = clamp(((target.x - x1) * dx + (target.y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x1 + dx * t - target.x, y1 + dy * t - target.y) < radius;
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i], ox = b.x, oy = b.y;
      enemyAction = !b.friendly;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const hitTerrain = blocked(b.x, b.y, 3) || blocked((ox + b.x) / 2, (oy + b.y) / 2, 3);
      let remove = b.life <= 0 || hitTerrain;
      if (hitTerrain && b.friendly && b.kind === 'summon')
        worldImpact(b.x, b.y, b.splash || 45, b.damage * 1.4, 'beast');
      if (hitTerrain && b.sourceBoss && b.kind !== 'enemyFire')
        worldImpact(b.x, b.y, 48, b.damage * .95, 'crater');
      if (!remove && b.friendly) {
        const midpointX = (ox + b.x) / 2, midpointY = (oy + b.y) / 2;
        const halfTravel = Math.hypot(b.x - ox, b.y - oy) / 2;
        forEachEnemyNear(midpointX, midpointY, halfTravel + 3, z => {
          if (b.hitIds.has(z.id) || !segmentHitsCircle(ox, oy, b.x, b.y, z, z.r + 3)) return;
          b.hitIds.add(z.id);
          const impactAngle = Math.atan2(b.vy, b.vx);
          hurtZombie(z, b.damage, impactAngle);
          burst(z.x, z.y, b.color, 2);
          if (b.tag && !b.tagged) { b.tagged = true; addTag(z.x, z.y, z); }
          if (b.splash) {
            effects.push({ x: b.x, y: b.y, radius: b.splash, life: .28, max: .28, color: b.color });
            if (effects.length > 40) effects.shift();
            const splashSq = b.splash * b.splash;
            forEachEnemyNear(z.x, z.y, b.splash, other => {
              const dx = other.x - z.x, dy = other.y - z.y;
              if (other !== z && dx * dx + dy * dy < splashSq)
                hurtZombie(other, b.damage * .55, impactAngle);
            });
          }
          b.pierce--;
          if (b.pierce <= 0) { remove = true; return false; }
        });
      } else if (!b.friendly) {
        const struck = remove ? null : targetList.find(t => segmentHitsCircle(ox, oy, b.x, b.y, t, t.r + 3));
        const hitPlayer = !!struck;
        if ((b.kind === 'enemyFire' || b.blast) && (remove || hitPlayer)) {
          // Fireballs and the beasts' Tailed Beast Bombs detonate on contact or at range's end.
          const blast = b.blast || 66;
          const look = b.kind === 'bijuudama' ? ['#b85cff', '#c685ff', 'beast', 'beast'] : b.kind === 'rock' ? ['#b8956a', '#c8a880', 'smoke', 'crater'] : ['#ff813a', '#ff9d4f', 'fire', 'fire'];
          effects.push({ x: b.x, y: b.y, radius: blast, life: .38, max: .38, color: look[0] });
          if (effects.length > 40) effects.shift();
          burst(b.x, b.y, look[1], b.blast ? 28 : 12);
          if (b.blast) {
            addSkillEffect('explosions', { x: b.x, y: b.y, radius: blast, life: .7, maxLife: .7, kind: look[2] });
            shake = Math.max(shake, b.kind === 'bijuudama' ? 12 : 6);
          }
          worldImpact(b.x, b.y, blast, b.sourceBoss ? b.damage * 1.25 : 45, look[3]);
          for (const target of targetList) {
            player = target;
            if (Math.hypot(b.x - player.x, b.y - player.y) < blast + player.r &&
                !blocked((b.x + player.x) / 2, (b.y + player.y) / 2, 3)) damagePlayer(b.damage);
          }
          player = me;
          remove = true;
        } else if (hitPlayer) {
          player = struck; damagePlayer(b.damage); player = me;
          remove = true; burst(b.x, b.y, b.color, b.kind === 'chakra' ? 7 : 4);
        }
      }
      // A kunai that misses still plants its tag where it lands.
      if (remove && b.tag && !b.tagged) { b.tagged = true; addTag(hitTerrain ? ox : b.x, hitTerrain ? oy : b.y, null); }
      if (remove) bullets.splice(i, 1);
    }
    enemyAction = false;
  }

  function damagePlayer(amount) {
    if (player.isClone) { hurtClone(player, amount); return; }
    if (player.invuln > 0 || player.down > 0) return;
    player.invuln = .38;
    if (player.remote) {
      // A teammate's ninja lives in their own browser: tell them how hard they were hit.
      netSend({ t: 'hurt', to: player.peerId, a: Math.round(amount) });
      bloodBurst(player.x, player.y, rand(0, Math.PI * 2), 5);
      return;
    }
    if (player.susanoo) amount *= SUSANOO_GUARD;
    if (player.armor > 0) { const used = Math.min(player.armor, amount); player.armor -= used; amount -= used; }
    player.health = Math.max(0, player.health - amount);
    if (amount > 0) { bloodBurst(player.x, player.y, rand(0, Math.PI * 2), 5); addBloodDecal(player.x, player.y, 6); }
    shake = Math.max(shake, 5);
    if (player.health <= 0) { if (coop()) knockOut(); else gameOver(); }
  }

  // Particles are recycled through a pool so heavy fights don't churn the garbage collector.
  const particlePool = [];
  function spawnParticle(x, y, vx, vy, life, max, color, size) {
    const p = particlePool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = max; p.color = color; p.size = size;
    if (particles.length >= 550) particlePool.push(particles.shift());
    particles.push(p);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) spawnParticle(x, y, rand(-120,120), rand(-120,120), rand(.25,.7), .7, color, rand(2,5));
  }

  function addBloodDecal(x, y, radius) {
    bloodDecals.push({ x, y, radius: radius * rand(.8, 1.3), angle: rand(0, Math.PI * 2), seed: Math.random() });
    if (bloodDecals.length > 180) bloodDecals.shift();
  }

  function bloodBurst(x, y, angle, count) {
    const palette = ['#8a1325', '#b51d2e', '#d43a3d', '#501219'];
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-1.1, 1.1), speed = rand(45, 190);
      spawnParticle(x + rand(-4, 4), y + rand(-4, 4), Math.cos(a) * speed, Math.sin(a) * speed, rand(.24, .68), .68, palette[i % palette.length], rand(2, 5));
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt;
      if (p.life <= 0) { particlePool.push(p); particles[i] = particles[particles.length - 1]; particles.pop(); }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
  }

  function update(dt) {
    elapsed += dt; gameTime = (gameTime + dt * .035) % 24;
    updatePlayer(dt);
    if (net.role === 'client') updateProxies(dt);
    else { updateWaves(dt); updateZombies(dt); }
    rebuildEnemyBuckets();
    updateSkills(dt);
    if (net.role !== 'client') updateWar(dt);
    updateBullets(dt); updateParticles(dt);
    if (coop()) updateNet(dt);
    for (const b of destructionState.ruins) b.collapseLife = Math.max(0, b.collapseLife - dt);
    camera.x += (player.x - W / 2 + Math.cos(player.angle) * 30 - camera.x) * Math.min(1, dt * 5);
    camera.y += (player.y - H / 2 + Math.sin(player.angle) * 30 - camera.y) * Math.min(1, dt * 5);
    // Let the camera peek past the edges: Hokage Rock to the north, the A-Un gate south, forest east/west.
    camera.x = clamp(camera.x, 0, WORLD.w - W); camera.y = clamp(camera.y, 0, WORLD.h - H);
    updateRegion(dt);
    hudTimer -= dt;
    if (hudTimer <= 0) { updateHUD(); drawMap(); hudTimer = .1; }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
  }

  // DOM writes are only made when a value actually changes (the HUD refreshes 10x a second).
  function setText(el, text) {
    if (el && el.__text !== text) { el.textContent = text; el.__text = text; }
  }
  function setStyle(el, prop, value) {
    const key = '__' + prop;
    if (el && el[key] !== value) { if (prop.startsWith('--')) el.style.setProperty(prop, value); else el.style[prop] = value; el[key] = value; }
  }

  function updateHUD() {
    setStyle(ui.health, 'width', `${clamp(player.health / player.maxHealth * 100, 0, 100)}%`);
    if (ui.healthValue) setText(ui.healthValue, `${Math.ceil(player.health).toLocaleString('en-US')} / ${player.maxHealth.toLocaleString('en-US')} HP`);
    setStyle(ui.armor, 'width', `${clamp(player.armor, 0, 100)}%`);
    let aliveCount = 0;
    for (const z of zombies) if (z.health > 0) aliveCount++;
    setText(ui.wave, AUTO_WAVES ? `ĐỢT ${waveState.number}` : `${aliveCount} KẺ ĐỊCH`);
    setText(ui.kills, `${player.kills} NINJA ĐỊCH HẠ GỤC`);
    setText(ui.score, `${player.score.toLocaleString('en-US')} ĐIỂM`);
    if (ui.nineTailsStatus) {
      setText(ui.nineTailsStatus, player.nineTails ? 'T · CỬU VĨ ĐỎ (BARYON): BẬT' : 'T · CỬU VĨ ĐỎ (BARYON): TẮT');
      ui.nineTailsStatus.classList.toggle('active', player.nineTails);
    }
    if (ui.gatesStatus) {
      setText(ui.gatesStatus, player.gates ? 'Y · BÁT MÔN ĐỘN GIÁP: MỞ' : 'Y · BÁT MÔN ĐỘN GIÁP: ĐÓNG');
      ui.gatesStatus.classList.toggle('active', !!player.gates);
    }
    if (ui.rinneganStatus) {
      setText(ui.rinneganStatus, player.rinnegan ? 'U · LUÂN HỒI NHÃN: BẬT' : 'U · LUÂN HỒI NHÃN: TẮT');
      ui.rinneganStatus.classList.toggle('active', !!player.rinnegan);
    }
    if (ui.skillG) ui.skillG.classList.toggle('active', player.nineTails);
    if (ui.skillE) ui.skillE.classList.toggle('active', skillState.clones.length > 0);
    if (ui.sixPathsStatus) {
      setText(ui.sixPathsStatus, player.sixPaths ? 'I · LỤC ĐẠO TIÊN NHÂN: BẬT' : 'I · LỤC ĐẠO TIÊN NHÂN: TẮT');
      ui.sixPathsStatus.classList.toggle('active', !!player.sixPaths);
    }
    if (ui.susanooStatus) {
      setText(ui.susanooStatus, player.susanoo ? 'O · SUSANOO: BẬT' : 'O · SUSANOO: TẮT');
      ui.susanooStatus.classList.toggle('active', !!player.susanoo);
    }
    if (ui.skillB) ui.skillB.classList.toggle('active', !!indraState.ally);
    if (ui.skillV) ui.skillV.classList.toggle('active', !!mightGuyState.ally);
    if (ui.skillH) ui.skillH.classList.toggle('active', hokageState.allies.length === 4);
    if (ui.skillBar) ui.skillBar.classList.toggle('nine-tails-active', player.nineTails);
    if (ui.skillQ) {
      const active = skillState.charge?.kind === 'fire';
      ui.skillQ.classList.toggle('charging', active);
      setStyle(ui.skillQ, '--charge', `${active ? Math.round(skillState.charge.ratio * 100) : 0}%`);
    }
    if (ui.skillSpace) {
      const active = skillState.charge?.kind === 'rasengan';
      ui.skillSpace.classList.toggle('charging', active);
      setStyle(ui.skillSpace, '--charge', `${active ? Math.round(skillState.charge.ratio * 100) : 0}%`);
    }
    if (ui.skillG) {
      const active = skillState.charge?.kind === 'bijuu';
      ui.skillG.classList.toggle('charging', active);
      setStyle(ui.skillG, '--charge', `${active ? Math.round(skillState.charge.ratio * 100) : 0}%`);
    }
    if (ui.skillX) {
      const active = skillState.charge?.kind === 'shuriken';
      ui.skillX.classList.toggle('charging', active);
      setStyle(ui.skillX, '--charge', `${active ? Math.round(skillState.charge.ratio * 100) : 0}%`);
    }
    setText(ui.weapon, player.weapon === 'staff'
      ? 'TRƯỢNG LỤC ĐẠO · CẬN CHIẾN'
      : player.weapon === 'susano' ? 'SONG KIẾM SUSANO · CẬN CHIẾN' : `${WEAPONS[player.weapon].name} · NÉM`);
    const remaining = Math.max(0, waveState.total - waveState.spawned) + zombies.filter(z => z.health > 0).length;
    if (!AUTO_WAVES) setText(ui.eventText, aliveCount || spawnQueue.length
      ? `Còn ${aliveCount + spawnQueue.length} kẻ địch · bấm TẠO ĐỊCH (phím N) để gọi thêm.`
      : 'Chưa có kẻ địch · bấm TẠO ĐỊCH (phím N) để chọn loại và số lượng.');
    else setText(ui.eventText, waveState.intermission > 0
      ? `Đợt tiếp theo trong ${Math.ceil(waveState.intermission)} giây · +máu, +giáp`
      : `Còn ${remaining} ninja địch · ${waveState.boss && waveState.boss.health > 0 ? 'HẠ THỦ LĨNH ĐỂ HỒI MÁU VÀ GIÁP!' : 'Tiêu diệt toàn bộ để qua đợt.'}`);
    // The boss bar follows the wave's Akatsuki/Ōtsutsuki leader, or else the nearest live tailed beast.
    let boss = waveState.boss && waveState.boss.health > 0 ? waveState.boss : null;
    if (!boss) {
      let best = Infinity;
      for (const z of zombies) if (z.type === 'beast' && z.health > 0) {
        const d = (z.x - player.x) ** 2 + (z.y - player.y) ** 2;
        if (d < best) { best = d; boss = z; }
      }
    }
    ui.bossBar.classList.toggle('active', !!boss);
    ui.bossBar.classList.toggle('otsutsuki', !!boss && boss.bossFaction === 'otsutsuki');
    ui.bossBar.classList.toggle('beast', !!boss && boss.type === 'beast');
    ui.bossBar.classList.toggle('kage', !!boss && boss.bossFaction === 'kage');
    ui.bossBar.classList.toggle('madara', !!boss && boss.bossFaction === 'madara');
    // Living bosses get their own heading; only the reanimated ones read "Uế Thổ".
    const barFaction = { bee: 'war', nagato: 'legend', sasuke: 'rival', tobi: 'rival', zetsu: 'rival', danzo: 'rival', jubi: 'rival' }[boss?.bossFaction] || boss?.bossFaction;
    for (const f of ['sannin', 'hokage', 'legend', 'war', 'rival']) ui.bossBar.classList.toggle(f, !!boss && barFaction === f);
    if (boss) {
      const module = boss.type === 'beast' ? window.TailedBeasts : bossModuleOf(boss);
      const member = module?.members?.[boss.type === 'beast' ? boss.beastId : boss.bossId];
      setText(ui.bossName, member?.name || ZOMBIE_TYPES.boss.name);
      setStyle(ui.bossHealth, 'width', `${boss.health / boss.maxHealth * 100}%`);
    }
    setText(ui.prompt, '');
    ui.prompt.classList.remove('show');
    updateCoopPanel();
  }


  // Gun or blade held at chest height, pointed at the cursor. `player` is the ninja being drawn.
  function drawHeldWeapon(facing, firing) {
    ctx.save();
    ctx.translate(player.x + facing * 3, player.y - HAND_HEIGHT);
    ctx.rotate(player.angle);
    if (player.weapon === 'staff') {
      if (window.SixPathsStaff) window.SixPathsStaff.drawWeapon(ctx, player, elapsed);
      ctx.restore(); return;
    }
    if (player.weapon === 'susano') {
      if (window.SusanoBlades) window.SusanoBlades.draw(ctx, player, elapsed);
      ctx.restore(); return;
    }
    // Thrown tools stay upright when aiming to the left; the hand is empty for a moment after a throw.
    if (facing < 0) ctx.scale(1, -1);
    if (player.swing > .04 && firing) { ctx.restore(); return; }
    if (player.weapon === 'shuriken') { ctx.translate(14, 0); ctx.rotate(elapsed * 3); drawShurikenShape(9, '#cfd8dc'); }
    else drawKunaiShape(true);
    ctx.restore();
  }

  // A four-pointed shuriken centred on the origin.
  function drawShurikenShape(r, color) {
    ctx.fillStyle = color; ctx.strokeStyle = '#2a343c'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? r * .32 : r;
      if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(rr, 0);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a343c'; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, Math.PI * 2); ctx.fill();
  }

  // A kunai pointing along +x, with its explosive tag tied to the ring.
  function drawKunaiShape(tag) {
    ctx.fillStyle = '#3a3f46'; ctx.fillRect(-2, -1.6, 9, 3.2);
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-4, 0, 2.6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c9d2da'; drawPoly([[7, -4], [22, 0], [7, 4]]); ctx.fill();
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#eef3f6'; drawPoly([[8, -2.4], [19, 0], [8, 0]]); ctx.fill();
    if (!tag) return;
    const flap = Math.sin(elapsed * 14) * 2;
    ctx.fillStyle = '#f2e3b0'; drawPoly([[-6, -3], [-18, -4 + flap], [-18, 4 + flap], [-6, 3]]); ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = .8; ctx.stroke();
    ctx.fillStyle = '#c62828'; ctx.fillRect(-15, -1 + flap * .6, 7, 2.2);
  }

  // A tag stuck in an enemy or the ground: crackling paper, then boom.
  function drawTag(tag) {
    const k = clamp(1 - tag.life / tag.maxLife, 0, 1), y = tag.y - (tag.stuckTo ? LIFT : 4);
    ctx.save(); ctx.translate(tag.x, y);
    ctx.fillStyle = '#f2e3b0'; ctx.fillRect(-5, -8, 10, 16);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.strokeRect(-5, -8, 10, 16);
    ctx.fillStyle = '#c62828'; ctx.font = '900 9px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('爆', 0, 1);
    // The fuse burns down from the top edge, throwing sparks.
    ctx.fillStyle = 'rgba(40,20,10,.7)'; ctx.fillRect(-5, -8, 10, 16 * k);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = elapsed * 20 + i * 1.6, r = 4 + (i % 2) * 4;
      ctx.fillStyle = i % 2 ? 'rgba(255,220,120,.9)' : 'rgba(255,120,40,.9)';
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, -8 + 16 * k + Math.sin(a) * r * .6, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Naruto's sprite for his current form: Baryon and the Rinnegan each change his look.
  function narutoId(p) {
    if (p.sixPaths && window.AnimeSprites?.has('naruto_rikudo')) return 'naruto_rikudo';
    return (p.nineTails ? 'naruto_baryon' : 'naruto') + (p.rinnegan ? '_rinnegan' : '');
  }

  // Draws one ninja: this player's or a co-op teammate's (n.p is its body, n.sk its jutsu).
  function drawPlayer(n) {
    const S = window.AnimeSprites;
    const p = n.p;
    const feetY = p.y + 3 - (p.jump || 0) - (p.sixPaths ? p.spLift || 0 : 0);
    if (coop()) {
      // A coloured ring tells the four Narutos apart.
      ctx.strokeStyle = n.color; ctx.lineWidth = 2.5; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.ellipse(p.x, feetY, 17, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.down > 0) {
      S.drawFallen(ctx, narutoId(p), p.x, feetY, { facing: 1, alpha: .8 });
      drawNameTag(n, feetY - 30, `HỒI SINH ${Math.ceil(p.down)}s`);
      return;
    }
    player = p;
    const facing = Math.cos(p.angle) >= 0 ? 1 : -1;
    const thrown = p.weapon !== 'staff' && p.weapon !== 'susano';
    const charging = !!(n.sk.charge || n.pc.charge);
    const frame = n.sk.charge?.kind === 'shuriken' ? 'raise' : n.sk.charge?.kind === 'fire' ? 'seal'
      : p.gates && p.punch > 0 ? 'attack'
      : p.swing > 0 || charging || (thrown && n.firing) ? 'attack'
      : p.castPose > 0 ? p.castFrame || 'seal' : p.speed > 0 ? 'run' : 'idle';
    const id = narutoId(p);
    S.shadow(ctx, p.x, p.y + 3, 13 * (1 - Math.min(.5, (p.jump || 0) / 300)));
    if (p.nineTails) S.drawBaryonBehind(ctx, p.x, feetY, facing, elapsed);
    const gatePunch = p.gates ? clamp((p.punch || 0) / .2, 0, 1) : 0;
    if (p.gates) S.drawGatesAura(ctx, p.x, feetY, facing, elapsed, 1.05, gatePunch);
    if (p.rinnegan && window.RinneganVFX) window.RinneganVFX.drawAura(ctx, p, feetY, facing, elapsed, false);
    if (p.sixPaths) window.SixPathsMode?.drawAura(ctx, p, feetY, facing, elapsed, false);
    if (p.susanoo) window.SusanooMode?.drawAura(ctx, p, feetY, facing, elapsed, false);
    const bareHands = !!clickMode(p);
    const weaponBehind = Math.sin(p.angle) < -.45;
    if (weaponBehind && !bareHands) drawHeldWeapon(facing, n.firing);
    const blink = p.invuln > 0 && Math.floor(elapsed * 22) % 2 === 0;
    S.draw(ctx, id, p.x, feetY, { facing, frame, phase: p.stride / 15, alpha: blink ? .55 : 1 });
    if (!weaponBehind && !bareHands) drawHeldWeapon(facing, n.firing);
    if (p.gates) S.drawGatesAura(ctx, p.x, feetY, facing, elapsed, 1.05, gatePunch, true);
    if (p.rinnegan && window.RinneganVFX) window.RinneganVFX.drawAura(ctx, p, feetY, facing, elapsed, true);
    if (p.sixPaths) window.SixPathsMode?.drawAura(ctx, p, feetY, facing, elapsed, true);
    if (p.susanoo) window.SusanooMode?.drawAura(ctx, p, feetY, facing, elapsed, true);
    if (p.nineTails) S.drawBaryonAbove(ctx, p.x, feetY, facing, elapsed);
    player = me;
    if (!n.local) drawNameTag(n, feetY - S.height(id) - 10, null);
  }

  function drawNameTag(n, y, note) {
    const p = n.p;
    ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = '#120d0a';
    const label = note ? `${n.name} · ${note}` : n.name;
    ctx.strokeText(label, p.x, y); ctx.fillStyle = n.color; ctx.fillText(label, p.x, y);
    ctx.textBaseline = 'alphabetic';
    if (note) return;
    const w = 40, ratio = clamp(p.health / (p.maxHealth || 100), 0, 1);
    ctx.fillStyle = 'rgba(8,13,20,.82)'; ctx.fillRect(p.x - w / 2 - 1, y + 1, w + 2, 5);
    ctx.fillStyle = n.color; ctx.fillRect(p.x - w / 2, y + 2, w * ratio, 3);
  }

  function enemySpriteId(z) {
    if (z.type !== 'boss') {
      const spec = ZOMBIE_TYPES[z.type];
      return spec?.fallback && !window.AnimeSprites.has(z.type) ? spec.fallback : z.type;
    }
    return window.AnimeSprites.has(z.bossId) ? z.bossId : 'pain';
  }

  function enemyFrame(z) {
    if (z.kageDash > 0) return 'attack';
    if (z.skillWindup > 0 || z.akatsukiWindup > 0 || z.otsuWindup > 0 || z.kageWindup > 0 || z.madaraWindup > 0 || z.bossWindup > 0) return 'seal';
    const swing = z.type === 'runner' ? .7 : z.type === 'boss' ? .82 : 1;
    if (z.attackTimer > swing - .2) return 'attack';
    if (z.rootTimer > 0) return 'idle';
    return 'run';
  }

  // Ground-level warning shapes for grunt jutsu (boss modules draw their own).
  function drawEnemyTelegraph(z) {
    if (z.health <= 0 || z.skillWindup <= 0) return;
    const accent = STYLE_ACCENT[ZOMBIE_TYPES[z.type]?.style] || (z.type === 'brute' ? '#caa477' : z.type === 'spitter' ? '#ff844b' : z.type === 'runner' ? '#67d7ff' : '#be82f7');
    const pulse = .5 + Math.sin(elapsed * 24) * .16;
    const area = z.skillKind === 'bossPulse' ? 185 : z.skillKind === 'stomp' ? 125 : z.skillKind === 'gust' ? 150 : 0;
    ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = accent; ctx.lineWidth = z.type === 'boss' ? 4 : 3;
    if (area) {
      ctx.beginPath(); ctx.arc(z.x, z.y, area, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(z.x, z.y, area * .55, 0, Math.PI * 2); ctx.stroke();
    } else if (z.skillKind === 'dash') {
      ctx.beginPath(); ctx.moveTo(z.x, z.y);
      ctx.lineTo(z.x + Math.cos(z.dashAngle) * 180, z.y + Math.sin(z.dashAngle) * 180);
      ctx.stroke();
    } else if (['shuriken', 'fire', 'fan', 'wind', 'water', 'bolt', 'rock'].includes(z.skillKind)) {
      const reach = z.skillKind === 'fan' ? 260 : z.skillKind === 'fire' || z.skillKind === 'rock' ? 220 : 200;
      for (const offset of z.skillKind === 'fan' || z.skillKind === 'wind' ? [-.22, 0, .22] : [0]) {
        const a = z.angle + offset;
        ctx.beginPath(); ctx.moveTo(z.x, z.y);
        ctx.lineTo(z.x + Math.cos(a) * reach, z.y + Math.sin(a) * reach); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawEnemy(z, detail) {
    const S = window.AnimeSprites;
    const id = enemySpriteId(z), boss = z.type === 'boss';
    const facing = Math.cos(z.angle || 0) >= 0 ? 1 : -1;
    const feetY = z.y + 3;
    if (z.health <= 0) {
      S.drawFallen(ctx, id, z.x, feetY, { facing, alpha: clamp(z.deathTimer / .7, 0, 1) });
      return;
    }
    S.shadow(ctx, z.x, feetY, boss ? 24 : z.type === 'brute' ? 17 : 12);
    if (boss && z.bossFaction === 'otsutsuki') {
      // Ōtsutsuki hover in a pale chakra halo.
      ctx.fillStyle = 'rgba(214,190,255,.16)';
      ctx.beginPath(); ctx.ellipse(z.x, feetY - 40, 40, 62, 0, 0, Math.PI * 2); ctx.fill();
    }
    // A boss that turned invisible (Mu) leaves only its shadow.
    if (boss && bossModuleOf(z)?.hidden?.(z)) return;
    const hover = boss ? bossModuleOf(z)?.bodyLift?.(z) || 0 : 0;
    S.draw(ctx, id, z.x, feetY - hover, { facing, frame: enemyFrame(z), phase: z.pulse * 1.6 + z.seed,
      flash: z.hitFlash > 0 ? z.hitFlash * 6 : 0 });
    if (z.rootTimer > 0) {
      // Wood Release roots binding the legs.
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(z.x + i * 8, feetY + 2);
        ctx.quadraticCurveTo(z.x + i * 12, feetY - 10, z.x - i * 4, feetY - 18); ctx.stroke();
      }
    }
    if (z.soakedTimer > 0) {
      ctx.fillStyle = 'rgba(120,200,255,.35)';
      ctx.beginPath(); ctx.ellipse(z.x, feetY, z.r * 1.3, z.r * .5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!detail && !boss) return;
    const top = feetY - hover - S.height(id);
    const barW = boss ? 100 : Math.max(30, z.r * 2.2), barH = boss ? 7 : 4;
    const barX = z.x - barW / 2, barY = top - (boss ? 14 : 8);
    const accent = boss ? bossModuleOf(z)?.members?.[z.bossId]?.accent || '#be82f7'
      : z.type === 'brute' ? '#caa477' : z.type === 'spitter' ? '#ff844b' : z.type === 'runner' ? '#67d7ff' : '#8aaedf';
    ctx.fillStyle = 'rgba(8,13,20,.82)'; ctx.fillRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3);
    ctx.fillStyle = accent; ctx.fillRect(barX, barY, barW * clamp(z.health / z.maxHealth, 0, 1), barH);
    if (boss) {
      const member = bossModuleOf(z)?.members?.[z.bossId];
      ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#0d0a10';
      ctx.strokeText((member?.name || ZOMBIE_TYPES.boss.name).toUpperCase(), z.x, barY - 6);
      ctx.fillStyle = '#fff2f4'; ctx.fillText((member?.name || ZOMBIE_TYPES.boss.name).toUpperCase(), z.x, barY - 6);
    }
  }

  // Clones are drawn exactly like Naruto, poofing in from a cloud of smoke.
  const cloneView = { p: null, sk: { charge: null }, pc: { charge: null }, local: true, firing: false, color: '#b4e9ff', name: '' };
  function drawClone(clone) {
    const age = clone.age || 0;
    if (age > .12) {
      cloneView.p = clone;
      cloneView.firing = clone.fireCooldown > -.05 && clone.weapon !== 'staff' && clone.weapon !== 'susano';
      drawPlayer(cloneView);
      if (clone.weapon === 'staff' && window.SixPathsStaff) { ctx.save(); ctx.translate(0, -HAND_HEIGHT); window.SixPathsStaff.drawSwing(ctx, clone, elapsed); ctx.restore(); }
      if (clone.weapon === 'susano' && window.SusanoBlades) { ctx.save(); ctx.translate(0, -HAND_HEIGHT); window.SusanoBlades.drawSwing(ctx, clone, elapsed); ctx.restore(); }
    }
    if (age > .12 && clone.health < clone.maxHealth) {
      const w = 30, ratio = clamp(clone.health / clone.maxHealth, 0, 1), top = clone.y + 3 - window.AnimeSprites.height('naruto') - 8;
      ctx.fillStyle = 'rgba(8,13,20,.82)'; ctx.fillRect(clone.x - w / 2 - 1, top - 1, w + 2, 5);
      ctx.fillStyle = '#7fd4ff'; ctx.fillRect(clone.x - w / 2, top, w * ratio, 3);
    }
    if (age < .45) window.AnimeSprites.drawSmoke(ctx, clone.x, clone.y - 15, age / .45, 26);
  }

  function drawHokageAlly(ally) {
    const S = window.AnimeSprites;
    const order = clamp(Math.floor(ally.order || 1), 1, 4);
    const facing = Math.cos(ally.angle || 0) >= 0 ? 1 : -1;
    const feetY = ally.y + 3;
    S.shadow(ctx, ally.x, feetY, 13);
    if (window.HokageVFX?.drawAura) window.HokageVFX.drawAura(ctx, ally, elapsed);
    const frame = ally.attackPulse > 0 ? (order === 4 ? 'attack' : 'seal') : ally.moving ? 'run' : 'idle';
    S.draw(ctx, HOKAGE_SPRITES[order - 1], ally.x, feetY, { facing, frame, phase: elapsed * 9 + order });
    if (order === 3 && window.HokageVFX?.drawEnma) window.HokageVFX.drawEnma(ctx, ally, feetY, facing, elapsed, ENMA_APPEAR, ENMA_READY);
    const top = feetY - S.height(HOKAGE_SPRITES[order - 1]) - 6;
    ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = '#101519'; ctx.strokeText(HOKAGE_LABELS[order - 1], ally.x, top);
    ctx.fillStyle = HOKAGE_COLORS[order - 1]; ctx.fillText(HOKAGE_LABELS[order - 1], ally.x, top);
    ctx.textBaseline = 'alphabetic';
  }

  function drawMightGuyAlly(guy) {
    const S = window.AnimeSprites;
    const facing = Math.cos(guy.angle || 0) >= 0 ? 1 : -1;
    const feetY = guy.y + 3;
    const punch = clamp(guy.attackPulse / .23, 0, 1);
    S.shadow(ctx, guy.x, feetY, 14);
    S.drawGatesAura(ctx, guy.x, feetY, facing, elapsed, 1.18, punch);
    S.draw(ctx, 'guy', guy.x, feetY, { facing, frame: guy.attackPulse > 0 ? 'attack' : guy.moving ? 'run' : 'idle',
      phase: elapsed * 14, flash: guy.hitFlash > 0 ? guy.hitFlash * 3 : 0 });
    S.drawGatesAura(ctx, guy.x, feetY, facing, elapsed, 1.18, punch, true);
    const top = feetY - S.height('guy') - 6;
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = '#24120f'; ctx.strokeText('GUY · BÁT MÔN', guy.x, top);
    ctx.fillStyle = '#ffba75'; ctx.fillText('GUY · BÁT MÔN', guy.x, top);
    ctx.textBaseline = 'alphabetic';
  }

  // Everything that stands on the ground is depth-sorted by its feet.
  function queueDraw(kind, ref, y, count) {
    let entry = drawQueue[count];
    if (!entry) entry = drawQueue[count] = { kind: '', ref: null, y: 0 };
    entry.kind = kind; entry.ref = ref; entry.y = y;
    return count + 1;
  }

  function drawCharacters() {
    let count = 0;
    const horde = zombies.length > 110;
    for (const z of zombies) {
      if (z.type === 'beast') {
        // Tailed beasts tower over the street, so cull them with a much taller box.
        if (!visible(z.x - 140, z.y - 260, 280, 290)) continue;
        if (z.health > 0) window.TailedBeasts.drawTelegraph(ctx, z, elapsed);
        count = queueDraw('beast', z, z.y, count);
        continue;
      }
      if (!visible(z.x - 60, z.y - 150, 120, 175)) continue;
      if (z.health <= 0) { drawEnemy(z, false); continue; }
      drawEnemyTelegraph(z);
      count = queueDraw('enemy', z, z.y, count);
    }
    for (const n of ninjas()) {
      count = queueDraw('player', n, n.p.y, count);
      for (const clone of n.sk.clones) count = queueDraw('clone', clone, clone.y, count);
      for (const ally of n.hk.allies) count = queueDraw('hokage', ally, ally.y, count);
      if (n.mg.ally) count = queueDraw('guy', n.mg.ally, n.mg.ally.y, count);
      if (n.ix?.ally) count = queueDraw('indra', n.ix.ally, n.ix.ally.y, count);
      for (const summon of n.sk.summons) count = queueDraw('summon', summon, summon.y, count);
    }
    if (warState.active && window.WarAllies)
      for (const a of warState.forces.allies) if (visible(a.x - 80, a.y - 160, 160, 200)) count = queueDraw('warAlly', a, a.y, count);
    drawQueue.length = count;
    drawQueue.sort((a, b) => a.y - b.y);
    for (const entry of drawQueue) {
      const ref = entry.ref;
      if (entry.kind === 'enemy') {
        // In a big horde only wounded or nearby ninjas show a health bar, to keep the crowd readable.
        const near = (ref.x - player.x) ** 2 + (ref.y - player.y) ** 2 < 260 ** 2;
        drawEnemy(ref, !horde || near || ref.health < ref.maxHealth);
      } else if (entry.kind === 'beast') window.TailedBeasts.draw(ctx, ref, elapsed);
      else if (entry.kind === 'player') drawPlayer(ref);
      else if (entry.kind === 'clone') drawClone(ref);
      else if (entry.kind === 'hokage') drawHokageAlly(ref);
      else if (entry.kind === 'guy') drawMightGuyAlly(ref);
      else if (entry.kind === 'indra') window.SasukeIndra?.drawAlly(ctx, ref, elapsed);
      else if (entry.kind === 'warAlly') window.WarAllies.drawAlly(ctx, ref, elapsed);
      else if (entry.kind === 'summon' && window.SummonVFX) window.SummonVFX.drawOne(ctx, ref, elapsed);
    }
  }

  function invalidateStatic(rect) {
    for (const t of tiles.values())
      if (!rect || (rect.x < (t.tx + 1) * TILE && rect.x + rect.w > t.tx * TILE && rect.y < (t.ty + 1) * TILE && rect.y + rect.h > t.ty * TILE)) t.dirty = true;
  }

  // Tiles are 2px larger than the grid so neighbours overlap and no seam shows at fractional scroll.
  function paintTile(t) {
    const live = ctx;
    renderBounds = { x: t.tx * TILE - TILE_PAD, y: t.ty * TILE - TILE_PAD, w: TILE + TILE_PAD * 2, h: TILE + TILE_PAD * 2 };
    try {
      ctx = t.ctx;
      ctx.setTransform(1, 0, 0, 1, -t.tx * TILE + 1, -t.ty * TILE + 1);
      drawStaticWorld(renderBounds);
      t.dirty = false; t.ready = true;
    } finally {
      ctx = live;
      renderBounds = null;
    }
  }

  function tileAt(tx, ty) {
    const key = tx * 1024 + ty;
    let t = tiles.get(key);
    if (!t) {
      if (tiles.size >= MAX_TILES) {
        // Reuse the canvas of the tile seen longest ago.
        let oldest = null;
        for (const v of tiles.values()) if (!oldest || v.used < oldest.used) oldest = v;
        tiles.delete(oldest.key);
        t = oldest;
      } else t = tilePool.pop() || makeTileCanvas();
      Object.assign(t, { key, tx, ty, ready: false, dirty: true });
      tiles.set(key, t);
    }
    t.used = tileClock;
    return t;
  }

  function makeTileCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE + 2;
    const tctx = canvas.getContext('2d', { alpha: false });
    tctx.fillRect(0, 0, 1, 1);
    return { canvas, ctx: tctx };
  }

  function drawStaticTiles() {
    tileClock++;
    const tx0 = Math.floor(camera.x / TILE), ty0 = Math.floor(camera.y / TILE);
    const tx1 = Math.floor((camera.x + W) / TILE), ty1 = Math.floor((camera.y + H) / TILE);
    let repaint = 2;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tileAt(tx, ty);
      // A tile entering the view must be painted now; one with a collapsed house can wait a frame or two.
      if (!t.ready || (t.dirty && repaint-- > 0)) paintTile(t);
      ctx.drawImage(t.canvas, tx * TILE - 1, ty * TILE - 1);
    }
    // Paint one tile of the ring just outside the view ahead of time.
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
      if (tx >= tx0 && tx <= tx1 && ty >= ty0 && ty <= ty1) continue;
      const t = tileAt(tx, ty);
      if (!t.ready || t.dirty) { paintTile(t); return; }
    }
  }

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function drawStaticWorld(view) {
    window.WorldMap.drawStatic(ctx, view);
    // Konoha with its Hokage Rock above and the wall and A-Un gate below.
    const k = { x: KONOHA.x - 140, y: KONOHA.y - 560, w: KONOHA.size + 280, h: KONOHA.size + 560 + 330 };
    if (overlaps(view, k)) {
      ctx.save();
      ctx.beginPath(); ctx.rect(k.x, k.y, k.w, k.h); ctx.clip();
      ctx.translate(KONOHA.x, KONOHA.y);
      window.KonohaWorld.drawStatic(ctx, { x: view.x - KONOHA.x, y: view.y - KONOHA.y, w: view.w, h: view.h }, konohaWorld);
      ctx.restore();
    }
    for (const v of villageList) {
      const size = v.size, r = { x: v.x - 160, y: v.y - 160, w: size + 320, h: size + 320 };
      if (!overlaps(view, r)) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.translate(v.x, v.y);
      try { v.mod.drawStatic(ctx, { x: view.x - v.x, y: view.y - v.y, w: view.w, h: view.h }, i => !!v.buildings[i]?.destroyed); }
      catch (error) { console.error('village draw', v.id, error); }
      ctx.restore();
    }
    window.WorldMap.drawRoadStubs(ctx, view);
  }

  function drawWorldAmbient() {
    const view = { x: camera.x, y: camera.y, w: W, h: H };
    window.WorldMap.drawAmbient(ctx, view, elapsed);
    const k = { x: KONOHA.x - 200, y: KONOHA.y - 600, w: KONOHA.size + 400, h: KONOHA.size + 900 };
    if (overlaps(view, k)) {
      ctx.save(); ctx.translate(KONOHA.x, KONOHA.y);
      window.KonohaWorld.drawAmbient(ctx, { x: view.x - KONOHA.x, y: view.y - KONOHA.y, w: W, h: H }, elapsed);
      ctx.restore();
    }
    for (const v of villageList) {
      const size = v.size;
      if (!v.mod.drawAmbient || !overlaps(view, { x: v.x - 200, y: v.y - 200, w: size + 400, h: size + 400 })) continue;
      ctx.save(); ctx.translate(v.x, v.y);
      try { v.mod.drawAmbient(ctx, { x: view.x - v.x, y: view.y - v.y, w: W, h: H }, elapsed); } catch (error) { console.error(error); }
      ctx.restore();
    }
  }

  function drawBloodDecals() {
    for (const stain of bloodDecals) {
      const r = stain.radius;
      if (!visible(stain.x-r*2, stain.y-r*2, r*4, r*4)) continue;
      ctx.save();ctx.translate(stain.x,stain.y);ctx.rotate(stain.angle);
      ctx.fillStyle='rgba(43,3,10,.72)';ctx.beginPath();ctx.ellipse(0,0,r*1.15,r*.64,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(174,16,35,.78)';ctx.beginPath();ctx.ellipse(-r*.1,-r*.08,r*.78,r*.4,.1,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(238,49,61,.43)';ctx.beginPath();ctx.ellipse(-r*.34,-r*.17,r*.32,r*.12,-.2,0,Math.PI*2);ctx.fill();
      for (let j=0;j<3;j++) {
        const a=stain.seed*12+j*2.3, distance=r*(1.1+j*.28);
        ctx.fillStyle=j===1?'rgba(119,13,25,.58)':'rgba(64,5,14,.6)';
        ctx.beginPath();ctx.arc(Math.cos(a)*distance,Math.sin(a)*distance,r*(.12+(j%2)*.08),0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  }

  // Radial glows are painted once into small canvases and reused, instead of building a
  // gradient for every shot every frame. stops: [[offset, colour], ...].
  const glowCache = new Map();
  function glowSprite(key, radius, stops, inner = 0) {
    let sprite = glowCache.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = Math.ceil(radius * 2);
      const g = sprite.getContext('2d'), grad = g.createRadialGradient(radius, radius, inner, radius, radius, radius);
      for (const [offset, color] of stops) grad.addColorStop(offset, color);
      g.fillStyle = grad; g.fillRect(0, 0, sprite.width, sprite.height);
      glowCache.set(key, sprite);
    }
    return sprite;
  }
  function drawGlow(key, radius, stops, x, y, inner) {
    const sprite = glowSprite(key, radius, stops, inner);
    ctx.drawImage(sprite, x - radius, y - radius);
  }
  // The water bolt is one pre-drawn sprite, rotated per shot.
  let waterBoltSprite = null;
  function waterBolt() {
    if (waterBoltSprite) return waterBoltSprite;
    const c = waterBoltSprite = document.createElement('canvas');
    c.width = 44; c.height = 20;
    const g = c.getContext('2d'); g.translate(32, 10);
    const grad = g.createLinearGradient(-30, 0, 10, 0);
    grad.addColorStop(0, 'rgba(120,200,255,0)'); grad.addColorStop(1, 'rgba(170,230,255,.95)');
    g.fillStyle = grad; g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(0, -8, -30, 0); g.quadraticCurveTo(0, 8, 10, 0); g.fill();
    g.fillStyle = '#e8f8ff'; g.beginPath(); g.arc(4, -1, 3, 0, Math.PI * 2); g.fill();
    return c;
  }

  // Projectiles fly at chest height with a small shadow on the ground beneath them.
  function drawProjectile(b) {
    ctx.fillStyle = 'rgba(16,20,10,.22)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, 6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    const y = b.y - LIFT;
    if (b.kind === 'shuriken' && !b.friendly) {
      ctx.save();
      ctx.translate(b.x, y);
      ctx.rotate(elapsed * 14);
      ctx.fillStyle = b.color || '#d7e8e7';
      ctx.strokeStyle = '#3a4a50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const r = i % 2 ? 3.2 : 10;
        const x = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#394d54'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b.kind === 'wind') {
      // Kamaitachi: a pale crescent blade of wind.
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,248,225,.85)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(-6, 0, 16, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,210,160,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-14, 0, 14, -1, 1); ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'water') {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(a);
      ctx.drawImage(waterBolt(), -32, -10);
      ctx.restore();
    } else if (b.kind === 'rock' || b.kind === 'sand') {
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(elapsed * (b.kind === 'rock' ? 6 : 2));
      if (b.kind === 'rock') {
        ctx.fillStyle = '#8a6a4a'; ctx.strokeStyle = '#3b2a22'; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = 11 + (i % 2) * 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b8956a'; ctx.beginPath(); ctx.arc(-3, -4, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? 'rgba(216,176,112,.85)' : 'rgba(240,214,160,.8)'; ctx.beginPath(); ctx.arc(Math.cos(i) * 7, Math.sin(i * 1.7) * 6, 7 - i * .6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    } else if (b.kind === 'lava') {
      ctx.save(); ctx.translate(b.x, y);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('lava', 20, [[0, 'rgba(255,240,170,1)'], [.45, 'rgba(255,110,30,.95)'], [1, 'rgba(160,30,10,0)']], 0, 0, 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(60,20,10,.7)'; ctx.beginPath(); ctx.arc(4, 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b.friendly && b.kind === 'shuriken') {
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(elapsed * 26); drawShurikenShape(9, b.color || '#cfd8dc'); ctx.restore();
    } else if (b.kind === 'kunai') {
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(Math.atan2(b.vy, b.vx)); drawKunaiShape(true); ctx.restore();
    } else if (b.kind === 'enemyFire') {
      // Katon fireball: churning flame head with a tail opposite its travel.
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const w = Math.sin(elapsed * 20 + i * 1.7) * 3;
        ctx.fillStyle = i % 2 ? 'rgba(255,90,20,.55)' : 'rgba(255,170,40,.6)';
        ctx.beginPath(); ctx.moveTo(0, -8 + i * 4);
        ctx.quadraticCurveTo(-14, -6 + i * 4 + w, -24 - i * 3, w);
        ctx.quadraticCurveTo(-12, 2 + i * 2, 0, 6 - i * 2); ctx.fill();
      }
      drawGlow('fire' + (b.color || '#ff8a3a'), 14, [[0, 'rgba(255,250,210,1)'], [.45, b.color || '#ff8a3a'], [1, 'rgba(255,60,10,0)']], 0, 0, 1);
      ctx.restore();
    } else if (b.kind === 'chakra') {
      ctx.save();
      ctx.translate(b.x, y);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('chakra' + (b.color || '#9e73ee'), 13, [[0, 'rgba(255,255,255,.95)'], [.4, b.color || '#9e73ee'], [1, 'rgba(80,40,160,0)']], 0, 0, 1);
      ctx.strokeStyle = b.color || '#d0b5ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 9 + Math.sin(elapsed * 18) * 2, elapsed * 9, elapsed * 9 + 4); ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'bijuudama') {
      // A tailed beast's Bijūdama: a big black sphere wrapped in a violet corona.
      ctx.fillStyle = 'rgba(40,10,60,.35)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(b.x, y - 10);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('bijuu', 46, [[0, 'rgba(200,110,255,.65)'], [1, 'rgba(110,20,200,0)']], 0, 0, 10);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0c0412'; ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(elapsed * 20) * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d58cff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,140,200,.8)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const a = elapsed * 7 + i * 2.1; ctx.beginPath(); ctx.arc(0, 0, 14 + i * 3, a, a + 1.6); ctx.stroke(); }
      ctx.restore();
    } else if (b.kind === 'summon') {
      // Ten-Tails' miniature Tailed Beast Bomb: black core, violet corona.
      ctx.save(); ctx.translate(b.x, y);
      drawGlow('summon', 16, [[0, '#12061a'], [.55, 'rgba(120,40,170,.85)'], [1, 'rgba(200,110,255,0)']], 0, 0, 2);
      ctx.strokeStyle = '#e4b8ff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 10, elapsed * 8, elapsed * 8 + 3.6); ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'clone') {
      // Shadow clones hurl spinning shuriken.
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(elapsed * 22);
      ctx.fillStyle = '#c9d4dc'; ctx.strokeStyle = '#2a343c'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 2.6 : 8; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(r, 0); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = b.color || '#fff2a0';
      ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(b.x, y);
      ctx.lineTo(b.x - b.vx * .016, y - b.vy * .016); ctx.stroke();
    }
  }

  // Anime cut-in for big jutsu: a flash, speed lines rushing at the jutsu and a slanted title banner.
  const cutInState = { title: '', jp: '', rgb: '255,255,255', x: 0, y: 0, life: 0, max: 1, big: false, who: '', eye: '' };
  // who: sprite id whose eyes fill an anime close-up panel above the banner; eye overrides the eye type.
  function cutIn(title, jp, rgb, x, y, big = false, who = '', eye = '') {
    if (cutInState.life > .35 && cutInState.big && !big) return;
    const life = big ? 1.6 : 1.15;
    Object.assign(cutInState, { title, jp, rgb, x, y, life, max: life, big, who, eye });
    if (big && window.PostFX) window.PostFX.flash([1, 1, 1], .18, .14);
  }

  // Close-ups are vector-drawn at the panel's device size once, then reused.
  const closeUps = new Map();
  function closeUpArt(id, eye, w, h) {
    const S = window.AnimeSprites;
    if (!id || !S || !S.drawCloseUp || !S.has(id)) return null;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr), key = `${id}|${eye}|${pw}x${ph}`;
    let c = closeUps.get(key);
    if (c === undefined) {
      c = document.createElement('canvas'); c.width = pw; c.height = ph;
      try {
        const raw = document.createElement('canvas'); raw.width = pw; raw.height = ph;
        S.drawCloseUp(raw.getContext('2d'), id, pw, ph, eye ? { eye } : {});
        // pulled just under the bloom threshold so pale skin and sclera stay crisp instead of glowing
        const g = c.getContext('2d'); g.filter = 'brightness(.9) contrast(1.06)'; g.drawImage(raw, 0, 0);
      } catch (error) { console.warn('closeUp', id, error); c = null; }
      if (closeUps.size > 24) closeUps.delete(closeUps.keys().next().value);
      closeUps.set(key, c);
    }
    return c;
  }
  // The anime's pre-jutsu eye shot: a slanted letterbox that slams in from the right,
  // pushes in slowly while it holds, then slides away with the banner.
  function drawCloseUp(c, age, by, bh) {
    const pw = Math.min(W * (c.big ? .66 : .5), c.big ? 680 : 500), ph = Math.round(pw * .25);
    const art = closeUpArt(c.who, c.eye, pw, ph);
    if (!art) return;
    const slide = 1 - Math.pow(1 - clamp((age - .04) / .18, 0, 1), 3), fade = clamp(c.life / .3, 0, 1);
    const push = 1 + age * .05;
    ctx.save();
    ctx.globalAlpha = fade;
    // under the player, clear of the toast and the banner, above the skill bar
    ctx.translate(W / 2 + (1 - slide) * W * .9, Math.max(by + bh / 2 + ph / 2 + 12, H * .66)); ctx.rotate(-.05);
    const sk = ph * .22;
    ctx.beginPath(); ctx.moveTo(-pw / 2 + sk, -ph / 2); ctx.lineTo(pw / 2 + sk, -ph / 2); ctx.lineTo(pw / 2 - sk, ph / 2); ctx.lineTo(-pw / 2 - sk, ph / 2); ctx.closePath();
    ctx.fillStyle = '#07060a'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.drawImage(art, -pw / 2 * push, -ph / 2 * push, pw * push, ph * push);
    // a colour-keyed rim of light sweeping across, like the anime's flash frame
    const sweep = ((age * 1.6) % 1.4) - .2, g = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
    g.addColorStop(clamp(sweep - .08, 0, 1), `rgba(${c.rgb},0)`); g.addColorStop(clamp(sweep, 0, 1), `rgba(${c.rgb},.28)`); g.addColorStop(clamp(sweep + .08, 0, 1), `rgba(${c.rgb},0)`);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-pw, -ph, pw * 2, ph * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = '#050407'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${c.rgb},.95)`; ctx.stroke();
    ctx.restore();
  }

  function drawCutIn() {
    const c = cutInState;
    if (c.life <= 0 || largeMap) return;
    const age = c.max - c.life, k = c.life / c.max;
    const fx = clamp(c.x - camera.x, 0, W), fy = clamp(c.y - camera.y - LIFT, 0, H);
    ctx.save();
    if (age < .16) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${c.rgb},${(1 - age / .16) * (c.big ? .5 : .26)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Speed lines: thin wedges converging on the jutsu, re-rolled 20 times a second.
    const lineA = c.big ? Math.min(1, k * 2.2) * .55 : Math.max(0, 1 - age / .55) * .42;
    if (lineA > .01) {
      const R = Math.hypot(W, H), roll = Math.floor(elapsed * 20);
      ctx.fillStyle = `rgba(255,255,255,${lineA})`;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const h = Math.sin((i + roll * 7.31) * 12.9898) * 43758.5453, r = h - Math.floor(h);
        const a = i * Math.PI * 2 / 46 + r * .12, r0 = R * (.2 + r * .22), w = .004 + r * .009;
        ctx.moveTo(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0);
        ctx.lineTo(fx + Math.cos(a - w) * R, fy + Math.sin(a - w) * R);
        ctx.lineTo(fx + Math.cos(a + w) * R, fy + Math.sin(a + w) * R);
      }
      ctx.fill();
    }
    // Banner slides in, holds, then fades.
    const slide = 1 - Math.pow(1 - clamp(age / .2, 0, 1), 3), fade = clamp(c.life / .3, 0, 1);
    const bh = c.big ? 78 : 56, closeUp = c.big && c.who && window.AnimeSprites && window.AnimeSprites.drawCloseUp, by = Math.max(150, H * (c.big ? .3 : .32));
    if (closeUp) drawCloseUp(c, age, by, bh);
    ctx.globalAlpha = fade;
    ctx.translate(W / 2 + (1 - slide) * -W * .8, by); ctx.rotate(-.05);
    const band = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
    band.addColorStop(0, 'rgba(8,6,10,.0)'); band.addColorStop(.18, 'rgba(8,6,10,.82)');
    band.addColorStop(.82, 'rgba(8,6,10,.82)'); band.addColorStop(1, 'rgba(8,6,10,0)');
    ctx.fillStyle = band; ctx.fillRect(-W, -bh / 2, W * 2, bh);
    ctx.fillStyle = `rgba(${c.rgb},.95)`;
    ctx.fillRect(-W, -bh / 2 + 6, W * 2, 2); ctx.fillRect(-W, bh / 2 - 8, W * 2, 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `900 ${c.big ? 40 : 28}px "Yu Gothic", "Meiryo", system-ui, sans-serif`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(c.jp, 0, -bh * .14);
    ctx.fillStyle = `rgb(${c.rgb})`; ctx.fillText(c.jp, 0, -bh * .14);
    ctx.font = `800 ${c.big ? 15 : 12}px system-ui, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeText(c.title, 0, bh * .26);
    ctx.fillStyle = '#fff'; ctx.fillText(c.title, 0, bh * .26);
    ctx.restore();
  }

  function drawGuyAfterimages(guyState) {
    if (!guyState.afterimages.length) return;
    const S = window.AnimeSprites;
    ctx.globalCompositeOperation = 'lighter';
    for (const img of guyState.afterimages) {
      const k = clamp(img.life / (img.maxLife || .29), 0, 1);
      S.draw(ctx, img.id || 'guy', img.x, img.y + 3, { facing: Math.cos(img.angle || 0) >= 0 ? 1 : -1, frame: 'run', phase: img.x * .05, alpha: k * .45 });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWorld() {
    ctx.save();
    const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0; shake *= .82;
    ctx.translate(-camera.x + sx, -camera.y + sy);
    drawStaticTiles();
    if (window.DestructionVFX) {
      if (!destructionState.view) destructionState.view = { x: 0, y: 0, w: 0, h: 0 };
      Object.assign(destructionState.view, { x: camera.x - 100, y: camera.y - 100, w: W + 200, h: H + 200 });
      window.DestructionVFX.draw(ctx, destructionState, elapsed);
    }
    drawBloodDecals();
    // Ground-level jutsu and warnings go under everyone's feet.
    const team = ninjas();
    for (const n of team) if (window.HokageVFX && n.hk.effects.length) window.HokageVFX.drawEffects(ctx, n.hk, elapsed);
    for (const n of team) if (window.RinneganVFX && n.rn?.effects?.length) window.RinneganVFX.drawGround(ctx, n.rn, elapsed);
    for (const n of team) if (window.BaryonVFX && n.by?.effects?.length) window.BaryonVFX.drawGround(ctx, n.by, elapsed);
    for (const n of team) if (n.sp) window.SixPathsMode?.drawGround(ctx, n.sp, n.p, elapsed);
    for (const n of team) if (n.ix) window.SasukeIndra?.drawGround(ctx, n.ix, elapsed);
    for (const n of team) if (n.su) window.SusanooMode?.drawGround(ctx, n.su, n.p, elapsed);
    if (warState.active && window.WarScene?.drawCrowd) {
      Object.assign(warState.view, { x: camera.x - 50, y: camera.y - 50, w: W + 100, h: H + 100 });
      window.WarScene.drawCrowd(ctx, warState.view, elapsed, warState, LAYOUT.battlefield, me);
    }
    if (warState.active && window.WarAllies) window.WarAllies.drawGround(ctx, warState.forces, elapsed);
    const boss = waveState.boss;
    // Every boss on screen shows its telegraphs and ground jutsu.
    // Madara's meteors and fire seas reach far from his body, so his effects are culled with a wider box.
    for (const z of zombies) { const reach = z.bossFaction === 'madara' ? 1600 : 1300; if (z.type === 'boss' && visible(z.x - reach, z.y - reach, reach * 2, reach * 2)) bossModuleOf(z)?.draw?.(ctx, z, elapsed); }
    for (const z of zombies) if (z.type === 'beast' && visible(z.x - 1300, z.y - 1300, 2600, 2600)) window.TailedBeasts.drawGround?.(ctx, z, elapsed);
    window.EnemyJutsuVFX?.drawGround(ctx, gruntFx, elapsed);
    for (const n of team) drawGuyAfterimages(n.mg);
    drawCharacters();
    for (const n of team) if (window.HokageVFX?.drawOverlay && n.hk.effects.length) window.HokageVFX.drawOverlay(ctx, n.hk, elapsed);
    for (const z of zombies) { const reach = z.bossFaction === 'madara' ? 1700 : 1300; if (z.type === 'boss' && visible(z.x - reach, z.y - reach, reach * 2, reach * 2)) bossModuleOf(z)?.drawOverlay?.(ctx, z, elapsed); }
    for (const z of zombies) if (z.type === 'beast' && visible(z.x - 1300, z.y - 1300, 2600, 2600)) window.TailedBeasts.drawOverlay?.(ctx, z, elapsed);
    window.EnemyJutsuVFX?.drawOverlay(ctx, gruntFx, elapsed);
    drawGruntLabels();
    if (warState.active) drawWarOverlay();
    for (const n of team) {
      const p = n.p;
      if (window.MightGuyVFX && (n.mg.tigers.length || n.mg.finishers.length || n.mg.moves?.length))
        window.MightGuyVFX.drawEffects(ctx, n.mg, elapsed);
      if (window.RinneganVFX && n.rn?.effects?.length) window.RinneganVFX.drawOverlay(ctx, n.rn, elapsed);
      if (window.BaryonVFX && n.by?.effects?.length) window.BaryonVFX.drawOverlay(ctx, n.by, elapsed);
      if (n.sp) window.SixPathsMode?.drawOverlay(ctx, n.sp, p, elapsed);
      if (n.ix) window.SasukeIndra?.drawOverlay(ctx, n.ix, elapsed);
      if (n.su) window.SusanooMode?.drawOverlay(ctx, n.su, p, elapsed);
      ctx.save(); ctx.translate(0, -HAND_HEIGHT);
      if (p.weapon === 'staff' && window.SixPathsStaff) window.SixPathsStaff.drawSwing(ctx, p, elapsed);
      if (p.weapon === 'susano' && window.SusanoBlades) window.SusanoBlades.drawSwing(ctx, p, elapsed);
      ctx.restore();
      // Hand-held jutsu (Rasengan, purple Chidori) sit in Naruto's palm.
      const hand = n.sk.hand || (n.sk.hand = { x: 0, y: 0 });
      hand.x = p.x + Math.cos(p.angle) * 16;
      hand.y = p.y - HAND_HEIGHT + Math.sin(p.angle) * 8;
      n.pc.hand = hand;
      n.pc.player = p;
      if (window.PurpleChidoriVFX && !(p.down > 0)) window.PurpleChidoriVFX.draw(ctx, n.pc, elapsed);
      if (window.NinjaVFX) {
        n.sk.elapsed = elapsed;
        n.sk.player = p;
        window.NinjaVFX.draw(ctx, n.sk);
      }
      if (n.sk.tags) for (const tag of n.sk.tags) if (visible(tag.x - 20, tag.y - 60, 40, 80)) drawTag(tag);
      // A teammate's thrown tools (this player's own live in `bullets`).
      if (n.bullets) for (const b of n.bullets) if (visible(b.x - 20, b.y - 20 - LIFT, 40, 40 + LIFT)) drawProjectile(b);
    }
    for (const b of bullets) {
      if (visible(b.x - 20, b.y - 20 - LIFT, 40, 40 + LIFT)) drawProjectile(b);
    }
    for (const b of net.hostile) {
      if (visible(b.x - 20, b.y - 20 - LIFT, 40, 40 + LIFT)) drawProjectile(b);
    }
    for (const list of [effects, net.fx]) for (const e of list) {ctx.globalAlpha=clamp(e.life/e.max,0,1)*.55;ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,e.radius*(1-e.life/e.max),0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
    // Hit sparks and blood spray burst from bodies, not from feet.
    for (const p of particles) { ctx.globalAlpha = clamp(p.life/p.max,0,1); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y-LIFT*.7,p.size,p.size); } ctx.globalAlpha=1;
    drawWorldAmbient();
    ctx.restore();
  }


  // The warm tint, night grade and vignette change slowly, so they are painted into one
  // screen-sized canvas and only repainted when the window or the hour changes noticeably.
  const atmosphere = { canvas: document.createElement('canvas'), key: '' };
  function atmosphereOverlay(night) {
    const n = Math.round(night * 40) / 40, key = `${W}x${H}:${n}`;
    if (atmosphere.key === key) return atmosphere.canvas;
    atmosphere.key = key;
    const c = atmosphere.canvas, g = c.getContext('2d');
    c.width = Math.ceil(W); c.height = Math.ceil(H);
    g.fillStyle = 'rgba(245,205,138,.055)'; g.fillRect(0, 0, W, H);
    if (n > .05) {
      const grade = g.createLinearGradient(0, 0, W, H);
      grade.addColorStop(0, `rgba(26,29,40,${n * .57})`); grade.addColorStop(1, `rgba(44,29,40,${n * .65})`);
      g.fillStyle = grade; g.fillRect(0, 0, W, H);
    }
    const vignette = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, `rgba(27,21,17,${.27 + n * .13})`);
    g.fillStyle = vignette; g.fillRect(0, 0, W, H);
    return c;
  }

  function drawAtmosphere() {
    if (!W || !H) return;
    const night = nightAmount();
    ctx.drawImage(atmosphereOverlay(night), 0, 0, W, H);
    ctx.fillStyle=`rgba(237,188,101,${.18-night*.08})`;
    for(let i=0;i<23;i++){
      const x=(i*191+elapsed*(13+i%3*7))%(W+80)-40,y=(i*127+elapsed*(6+i%4*3))%(H+80)-40;
      ctx.save();ctx.translate(x,y);ctx.rotate(i*.9+elapsed*.35);ctx.beginPath();ctx.ellipse(0,0,3+i%3,1.2,.4,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  function nightAmount(){return Math.max(0,Math.cos((gameTime-1)/24*Math.PI*2)*.78);}

  function drawLightBloom(){
    const night=nightAmount();if(night<.08)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(-camera.x,-camera.y);
    ctx.globalAlpha=night*.3;
    for(const l of lanterns){if(!visible(l.x-65,l.y-70,130,140))continue;drawGlow('lantern',62,[[0,'rgba(255,201,112,1)'],[1,'rgba(255,173,81,0)']],l.x,l.y-5,1);}
    ctx.globalAlpha=1;
    ctx.restore();ctx.globalCompositeOperation='source-over';
  }

  function drawCrosshair(){
    if(!running||paused||largeMap)return;
    const gap=7+(mouse.down?Math.sin(elapsed*28)*1.5:0),len=7;
    ctx.save();ctx.translate(mouse.x,mouse.y);ctx.strokeStyle=player.nineTails?'#ff595f':player.weapon==='susano'?'#bd87ff':player.weapon==='staff'?'#b9aaff':player.weapon==='kunai'?'#ffcf5a':'#dfe8ee';ctx.lineWidth=1.7;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=6;
    ctx.beginPath();ctx.moveTo(-gap-len,0);ctx.lineTo(-gap,0);ctx.moveTo(gap,0);ctx.lineTo(gap+len,0);ctx.moveTo(0,-gap-len);ctx.lineTo(0,-gap);ctx.moveTo(0,gap);ctx.lineTo(0,gap+len);ctx.stroke();
    ctx.fillStyle=player.nineTails?'#fff1d0':player.weapon==='susano'?'#f4e8ff':player.weapon==='staff'?'#f2ecff':mouse.down?'#fff7c9':'#d9ff43';ctx.beginPath();ctx.arc(0,0,1.7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.restore();
  }

  // The village layout never changes during a run, so the map base is painted once.
  function buildMinimapBase() {
    const s = 1400 / WORLD.w;
    minimapBase.width = 1400; minimapBase.height = Math.round(WORLD.h * s);
    const g = minimapBase.getContext('2d');
    g.save(); g.scale(s, s); window.WorldMap.drawMinimap(g); g.restore();
    const k = document.createElement('canvas'); k.width = k.height = 600;
    window.KonohaWorld.drawMinimap(k.getContext('2d'), 600, konohaWorld);
    g.drawImage(k, KONOHA.x * s, KONOHA.y * s, KONOHA.size * s, KONOHA.size * s);
    for (const v of villageList) {
      g.save(); g.scale(s, s); g.translate(v.x, v.y);
      try { v.mod.drawMinimap(g); } catch (error) { console.error(error); }
      g.restore();
      for (const b of v.buildings) if (b.destroyed) { g.fillStyle = '#6f6458'; g.fillRect(b.x * s, b.y * s, b.w * s, b.h * s); }
    }
    minimapReady = true;
  }

  function ensureMinimap() {
    if (!minimapReady) buildMinimapBase();
  }

  // A collapsed house turns grey on the map without repainting the whole world.
  function paintMapRuin(b) {
    if (!minimapReady) return;
    const s = minimapBase.width / WORLD.w, g = minimapBase.getContext('2d');
    g.fillStyle = '#6f6458'; g.fillRect(b.x * s, b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s));
  }

  const MINIMAP_SPAN = 9000;
  function drawMap() {
    const size = mapCanvas.width, s = 1400 / WORLD.w;
    ensureMinimap();
    // The corner map shows a 9000px window around the player.
    const ox = player.x - MINIMAP_SPAN / 2, oy = player.y - MINIMAP_SPAN / 2, k = size / MINIMAP_SPAN;
    mctx.fillStyle = '#1d2a1a'; mctx.fillRect(0, 0, size, size);
    mctx.drawImage(minimapBase, ox * s, oy * s, MINIMAP_SPAN * s, MINIMAP_SPAN * s, 0, 0, size, size);
    for (const z of zombies) if (z.health > 0) {
      const px = (z.x - ox) * k, py = (z.y - oy) * k;
      if (px < -6 || py < -6 || px > size + 6 || py > size + 6) continue;
      mctx.fillStyle = z.type === 'beast' ? '#ffa62b' : z.type === 'boss' ? '#ff315d' : '#9bd979';
      mctx.beginPath(); mctx.arc(px, py, z.type === 'beast' ? 5 : z.type === 'boss' ? 4 : 1.6, 0, Math.PI * 2); mctx.fill();
    }
    for (const peer of net.peers.values()) if (peer.view) { const p = peer.view.p; mctx.fillStyle = peer.view.color; mctx.strokeStyle = '#120d0a'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc((p.x - ox) * k, (p.y - oy) * k, 4.5, 0, Math.PI * 2); mctx.fill(); mctx.stroke(); }
    mctx.save(); mctx.translate(size / 2, size / 2); mctx.rotate(player.angle); mctx.fillStyle = player.nineTails ? '#ff595f' : '#d9ff43';
    mctx.beginPath(); mctx.moveTo(8, 0); mctx.lineTo(-5, -5); mctx.lineTo(-3, 0); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill(); mctx.restore();
  }

  function villageLabel(id) {
    if (id === 'konoha') return 'LÀNG LÁ · 木ノ葉';
    const mod = window.ShinobiVillages && window.ShinobiVillages[id];
    return mod ? `${mod.name} · ${mod.jp}` : id.toUpperCase();
  }

  // M: the whole shinobi world. Click anywhere to travel there with the Flying Thunder God.
  function drawLargeMap() {
    if (!largeMap) { largeMapRect = null; return; }
    ensureMinimap();
    const scale = Math.min(W * .9 / WORLD.w, (H * .82) / WORLD.h), w = WORLD.w * scale, h = WORLD.h * scale;
    const x = (W - w) / 2, y = (H - h) / 2 + 14;
    largeMapRect = { x, y, scale };
    ctx.fillStyle = 'rgba(23,19,17,.9)'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(minimapBase, x, y, w, h);
    ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    for (const z of zombies) if (z.health > 0) { ctx.fillStyle = z.type === 'beast' ? '#ffa62b' : z.type === 'boss' ? '#ff315d' : '#9bd979'; ctx.beginPath(); ctx.arc(x + z.x * scale, y + z.y * scale, z.type === 'beast' ? 6 : z.type === 'boss' ? 5 : 1.6, 0, Math.PI * 2); ctx.fill(); }
    // village names
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 13px "Oswald", sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#120d0a';
    const labels = [['LÀNG LÁ · 木ノ葉隠れの里', KONOHA.x + KONOHA.size / 2, KONOHA.y - 300]];
    for (const [id, v] of Object.entries(LAYOUT.villages)) labels.push([villageLabel(id), v.x + v.size / 2, v.y + (v.y < KONOHA.y ? -260 : v.size + 260)]);
    for (const [text, lx, ly] of labels) { ctx.strokeText(text, x + lx * scale, y + ly * scale); ctx.fillStyle = '#ffe5b7'; ctx.fillText(text, x + lx * scale, y + ly * scale); }
    for (const peer of net.peers.values()) if (peer.view) { const p = peer.view.p; ctx.fillStyle = peer.view.color; ctx.beginPath(); ctx.arc(x + p.x * scale, y + p.y * scale, 6, 0, Math.PI * 2); ctx.fill(); ctx.font = '800 12px sans-serif'; ctx.fillText(peer.view.name, x + p.x * scale, y + p.y * scale - 12); }
    ctx.fillStyle = '#d9ff43'; ctx.strokeStyle = '#120d0a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + player.x * scale, y + player.y * scale, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe5b7'; ctx.font = '900 17px sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('THẾ GIỚI NHẪN GIẢ — bấm vào bản đồ để dịch chuyển (Phi Lôi Thần) · M để đóng', W / 2, y - 12);
  }

  function travelTo(wx, wy) {
    let x = clamp(wx, 60, WORLD.w - 60), y = clamp(wy, 60, WORLD.h - 60);
    // Land on the nearest open ground if the click hit a building.
    for (let ring = 0; ring < 12 && blocked(x, y, me.r + 4); ring++) {
      const a = ring * 2.4, d = 60 + ring * 40;
      if (!blocked(x + Math.cos(a) * d, y + Math.sin(a) * d, me.r + 4)) { x += Math.cos(a) * d; y += Math.sin(a) * d; break; }
    }
    if (blocked(x, y, me.r + 4)) { showToast('KHÔNG THỂ DỊCH CHUYỂN VÀO ĐÓ', 1.2); return; }
    addSkillEffect('explosions', { x: me.x, y: me.y, radius: 70, life: .4, maxLife: .4, kind: 'lightning' });
    for (const clone of skillState.clones) { clone.x = x + (clone.x - me.x); clone.y = y + (clone.y - me.y); if (blocked(clone.x, clone.y, 13)) { clone.x = x; clone.y = y; } }
    me.x = x; me.y = y; me.invuln = Math.max(me.invuln, 1);
    camera.x = clamp(x - W / 2, 0, WORLD.w - W); camera.y = clamp(y - H / 2, 0, WORLD.h - H);
    addSkillEffect('explosions', { x, y, radius: 90, life: .5, maxLife: .5, kind: 'lightning' });
    largeMap = false; ui.hud.classList.remove('map-open'); last = performance.now();
  }

  // A banner when you walk into another village or land.
  function updateRegion(dt) {
    regionTimer -= dt;
    if (regionTimer > 0) return;
    regionTimer = .5;
    const names = {};
    for (const id of Object.keys(LAYOUT.villages)) names[id] = villageLabel(id);
    const name = window.WorldMap.regionAt(me.x, me.y, names);
    if (name !== regionName) { if (regionName) showToast(`→ ${name}`, 2.4); regionName = name; }
  }

  function visible(x,y,w=0,h=0){const b=renderBounds||{x:camera.x-100,y:camera.y-100,w:W+200,h:H+200};return x+w>b.x&&y+h>b.y&&x<b.x+b.w&&y<b.y+b.h;}
  function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):(c.rect(x,y,w,h));}
  function drawPoly(points){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();}
  // GPU post pass (postfx.js): impacts refract the frame, heavy shakes split the colours.
  function postShock(x, y, radius, strength, life = .6) {
    if (!window.PostFX || !window.PostFX.enabled) return;
    const sx = x - camera.x, sy = y - camera.y;
    if (sx < -radius || sy < -radius || sx > W + radius || sy > H + radius) return;
    window.PostFX.shock(sx, sy, radius, strength, life);
  }
  function postOptions() {
    const war = warState.active ? warState.phase : 0;
    return { bloom: 1.05 + nightAmount() * .45 + (war === 2 || war === 3 ? .25 : 0), threshold: .9 - nightAmount() * .08 };
  }
  function render(){if(window.PostFX&&shake>7)window.PostFX.aberrate(Math.min(.011,(shake-6)*.0008),.25);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c1114';ctx.fillRect(0,0,W,H);drawWorld();drawAtmosphere();drawLightBloom();if(warState.active&&window.WarScene)window.WarScene.drawScreen(ctx,W,H,elapsed,warState);drawCutIn();drawCrosshair();drawLargeMap();if(window.PostFX)window.PostFX.render(postOptions());}

  function loop(now){
    if(!running){loopActive=false;frameStats.loops=0;return;}
    const frameMs=now-last, dt=Math.min(.033,frameMs/1000||0);last=now;
    const updateStarted=performance.now();
    if((coop()&&!net.over)||(!paused&&!largeMap)){try{update(dt);}catch(error){player=me;console.error(error);}}
    sampleUpdateMs+=performance.now()-updateStarted;
    const renderStarted=performance.now();render();
    sampleFrames++;sampleRenderMs+=performance.now()-renderStarted;
    sampleMaxFrameMs=Math.max(sampleMaxFrameMs,frameMs);
    if(!sampleStarted)sampleStarted=now;
    if(now-sampleStarted>=2000){
      frameStats.fps=Math.round(sampleFrames*1000/(now-sampleStarted));
      frameStats.avgUpdateMs=Math.round(sampleUpdateMs/sampleFrames*10)/10;
      frameStats.avgRenderMs=Math.round(sampleRenderMs/sampleFrames*10)/10;
      frameStats.maxFrameMs=Math.round(sampleMaxFrameMs);
      canvas.dataset.fps=String(frameStats.fps);
      canvas.dataset.updateMs=String(frameStats.avgUpdateMs);
      canvas.dataset.renderMs=String(frameStats.avgRenderMs);
      canvas.dataset.maxFrameMs=String(frameStats.maxFrameMs);
      canvas.dataset.loops=String(frameStats.loops);
      let activeEnemies=0;for(const z of zombies)if(z.health>0)activeEnemies++;
      canvas.dataset.activeEnemies=String(activeEnemies);
      sampleStarted=now;sampleFrames=0;sampleUpdateMs=0;sampleRenderMs=0;sampleMaxFrameMs=0;
    }
    requestAnimationFrame(loop);
  }
  // HUD portrait: Naruto's bust, swapped for the Baryon look while transformed.
  function paintPortrait() {
    const portrait = document.getElementById('hudPortrait');
    if (!portrait || !window.AnimeSprites) return;
    const g = portrait.getContext('2d');
    g.clearRect(0, 0, portrait.width, portrait.height);
    window.AnimeSprites.drawPortrait(g, narutoId(player), portrait.width);
  }

  // Start-screen banner: the Hokage and Naruto facing the Akatsuki and Kaguya.
  function paintTitleArt() {
    const art = document.getElementById('titleArt');
    if (!art || !window.AnimeSprites) return;
    const g = art.getContext('2d'), S = window.AnimeSprites;
    const w = art.width, h = art.height, ground = h - 18;
    g.clearRect(0, 0, w, h);
    const k = h / 150;
    const cast = [
      ['hashirama', .08, 1], ['tobirama', .17, 1], ['minato', .27, 1], ['guy', .37, 1],
      ['kaguya', .9, -1], ['pain', .81, -1], ['itachi', .72, -1], ['kisame', .63, -1]
    ];
    for (const [id, fx, facing] of cast) {
      const x = w * fx, scale = k / ((S.META[id] && S.META[id].scale) || 1);
      S.shadow(g, x, ground, 12 * k);
      S.draw(g, id, x, ground, { facing, frame: id === 'pain' || id === 'minato' ? 'attack' : 'idle', scale });
    }
    const nx = w * .5;
    S.shadow(g, nx, ground, 15 * k);
    S.drawBaryonBehind(g, nx, ground, 1, 1.2, 1.25 * k);
    S.draw(g, 'naruto', nx, ground, { facing: 1, frame: 'seal', scale: 1.25 * k / S.META.naruto.scale });
  }

  // ---------------------------------------------------------------------------
  // Co-op (up to 4 players, relayed by server.js). The host's browser runs the
  // waves, enemies and bosses. Every player runs their own ninja, jutsu and
  // summons; guests send the damage they deal to the host, and everyone shares
  // a picture of their ninja about 20 times a second so teammates can see it.
  // ---------------------------------------------------------------------------
  const ENEMY_KINDS = ['walker', 'runner', 'brute', 'spitter', 'boss', 'beast'];
  const ENEMY_SKILLS = ['', 'dash', 'stomp', 'bossPulse', 'shuriken', 'fire', 'fan'];
  const NET_SKIP_KEYS = new Set(['target', 'stuckTo', 'hitIds', 'player', 'hand', 'elapsed', 'startedAt', 'netProxy']);
  const localNinja = { p: me, sk: skillState, pc: purpleChidoriState, mg: mightGuyState, hk: hokageState, rn: rinneganState, by: baryonState, sp: sixPathsState, ix: indraState, su: susanooState,
    local: true, firing: false, color: COOP_COLORS[0], name: '' };
  const ninjaList = [localNinja];

  // This player's ninja plus every teammate's, each with its jutsu state.
  function ninjas() {
    ninjaList.length = 1;
    localNinja.firing = mouse.down && !paused && !largeMap;
    localNinja.color = COOP_COLORS[net.slot] || COOP_COLORS[0];
    for (const peer of net.peers.values()) if (peer.view) ninjaList.push(peer.view);
    return ninjaList;
  }

  // Numbers are rounded and object links (enemy targets, hit sets) dropped to keep packets small.
  function netJSON(value) {
    return JSON.stringify(value, (key, v) => NET_SKIP_KEYS.has(key) ? undefined
      : typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  }
  function netSend(msg) { if (coop() && window.CoopNet) window.CoopNet.send(msg); }
  function peerName(id) { return net.peers.get(id)?.name || window.CoopNet?.nameOf(id) || 'Ninja'; }

  function collectTargets() {
    targetList.length = 0;
    if (!(me.down > 0)) targetList.push(me);
    for (const peer of net.peers.values()) if (peer.view && !(peer.view.p.down > 0)) targetList.push(peer.view.p);
    // Shadow clones draw enemy fire like real ninjas.
    for (const clone of skillState.clones) if (clone.health > 0 && clone.age > .3) targetList.push(clone);
    for (const peer of net.peers.values()) for (const clone of peer.view?.sk?.clones || []) {
      if (!(clone.health > 0)) continue;
      clone.isClone = true; clone.ownerId = peer.id;
      targetList.push(clone);
    }
  }

  function nearestTarget(z) {
    let best = targetList[0], bestSq = Infinity;
    for (const t of targetList) {
      const d = (t.x - z.x) ** 2 + (t.y - z.y) ** 2;
      if (d < bestSq) { bestSq = d; best = t; }
    }
    return best;
  }

  // Guests batch their hits and knockbacks per enemy and send them to the host.
  function recordHit(z, damage, angle, px, py) {
    let hit = net.hits.get(z.id);
    if (!hit) { hit = { z, d: 0, a: 0, px: 0, py: 0 }; net.hits.set(z.id, hit); }
    hit.d += damage; if (damage) hit.a = angle; hit.px += px; hit.py += py;
  }

  function flushHits() {
    if (!net.hits.size) return;
    const list = [];
    for (const [id, h] of net.hits) list.push([id, Math.round(h.d), +h.a.toFixed(2), Math.round(h.px), Math.round(h.py),
      +(h.z.rootTimer || 0).toFixed(1), +(h.z.soakedTimer || 0).toFixed(1)]);
    net.hits.clear();
    netSend({ t: 'hits', to: 'host', h: list });
  }

  function applyRemoteHits(from, list) {
    const byId = new Map();
    for (const z of zombies) if (z.health > 0) byId.set(z.id, z);
    for (const [id, damage, angle, px, py, root, soak] of list) {
      const z = byId.get(id);
      if (!z || z.health <= 0) continue;
      if (px || py) moveCircle(z, px, py, z.r);
      if (root) z.rootTimer = Math.max(z.rootTimer || 0, root);
      if (soak) z.soakedTimer = Math.max(z.soakedTimer || 0, soak);
      if (damage > 0) { z.lastHitBy = from; applyHit(z, damage, angle); }
    }
  }

  function applyImpacts(list) {
    net.applying = true;
    try {
      for (const e of list) {
        if (e[0] === 'b') damageBuildings(e[1], e[2], e[3], e[4], e[5]);
        else if (e[0] === 's') addGroundScar(e[1], e[2], e[3], e[4], e[5]);
      }
    } finally { net.applying = false; }
  }

  function sendPlayerState() {
    const own = [];
    for (const b of bullets) if (b.friendly && own.length < 60) own.push(b);
    const p = me, sk = skillState;
    window.CoopNet.send(netJSON({ t: 'p', i: net.impacts.length ? net.impacts : undefined,
      p: { x: p.x, y: p.y, angle: p.angle, weapon: p.weapon, nineTails: p.nineTails, gates: p.gates, punch: p.punch, rinnegan: p.rinnegan, rinPulse: p.rinPulse, sixPaths: p.sixPaths, spLift: p.spLift, susanoo: p.susanoo, clickMode: p.clickMode, castPose: p.castPose,
        castFrame: p.castFrame, stride: p.stride, speed: p.speed, swing: p.swing, swingAngle: p.swingAngle,
        flash: p.flash, jump: p.jump, health: p.health, maxHealth: p.maxHealth, armor: p.armor, invuln: p.invuln, down: p.down, fireCooldown: p.fireCooldown },
      f: localNinja.firing ? 1 : 0,
      sk: { fireballs: sk.fireballs, fireSeas: sk.fireSeas, tags: sk.tags, beastBombs: sk.beastBombs, rasenShurikens: sk.rasenShurikens, clones: sk.clones,
        summons: sk.summons, trails: sk.trails, vortices: sk.vortices, explosions: sk.explosions, charge: sk.charge },
      pc: { trails: purpleChidoriState.trails, bursts: purpleChidoriState.bursts, charge: purpleChidoriState.charge },
      mg: mightGuyState, hk: hokageState, rn: rinneganState, by: baryonState, sp: sixPathsState, ix: indraState, su: susanooState, b: own }));
    net.impacts.length = 0;
  }

  function ensurePeer(id) {
    let peer = net.peers.get(id);
    if (!peer) {
      peer = { id, name: window.CoopNet.nameOf(id), slot: window.CoopNet.slotOf(id), view: null };
      net.peers.set(id, peer);
    }
    return peer;
  }

  // Keep the teammate list in step with the room roster.
  function syncPeers() {
    const roster = window.CoopNet.state.players;
    for (const entry of roster) if (entry.id !== net.id) {
      const peer = ensurePeer(entry.id);
      peer.name = entry.name; peer.slot = entry.slot;
      if (peer.view) { peer.view.name = entry.name; peer.view.color = COOP_COLORS[entry.slot]; }
    }
    for (const id of [...net.peers.keys()]) if (!roster.some(entry => entry.id === id)) net.peers.delete(id);
  }

  function applyPeerState(from, msg) {
    if (msg.i) applyImpacts(msg.i);
    const peer = ensurePeer(from);
    let view = peer.view;
    if (!view) {
      view = peer.view = { p: { r: 13, remote: true, peerId: from, x: msg.p.x, y: msg.p.y }, local: false,
        sk: null, pc: null, mg: null, hk: null, rn: null, by: null, sp: null, ix: null, su: null, bullets: [], firing: false, color: COOP_COLORS[peer.slot], name: peer.name };
    }
    const body = view.p, ox = body.x, oy = body.y;
    Object.assign(body, msg.p);
    body.tx = msg.p.x; body.ty = msg.p.y;
    // Glide toward the reported spot; Chidori dashes and respawns snap straight there.
    if (Math.hypot(body.tx - ox, body.ty - oy) < 220) { body.x = ox; body.y = oy; }
    view.sk = msg.sk; view.pc = msg.pc; view.mg = msg.mg; view.hk = msg.hk; view.rn = msg.rn || { effects: [] }; view.by = msg.by || { effects: [] };
    view.sp = msg.sp || { effects: [] }; view.ix = msg.ix || { ally: null, effects: [] }; view.su = msg.su || { effects: [] };
    view.bullets = msg.b || []; view.firing = !!msg.f;
  }

  function advanceList(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (o.vx !== undefined) { o.x += o.vx * dt; o.y += o.vy * dt; }
      if (o.attackPulse > 0) o.attackPulse = Math.max(0, o.attackPulse - dt);
      if (o.hitFlash > 0) o.hitFlash = Math.max(0, o.hitFlash - dt);
      if (o.flash > 0) o.flash = Math.max(0, o.flash - dt);
      if (typeof o.life === 'number') { o.life -= dt; if (o.life <= 0) list.splice(i, 1); }
    }
  }

  // Between packets, teammates' ninjas glide and their jutsu keep flying.
  function advanceViews(dt) {
    const k = Math.min(1, dt * 14);
    for (const peer of net.peers.values()) {
      const view = peer.view;
      if (!view) continue;
      const p = view.p;
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
      p.invuln -= dt; p.stride += (p.speed || 0) * dt;
      p.swing = Math.max(0, (p.swing || 0) - dt); p.castPose = Math.max(0, (p.castPose || 0) - dt);
      if (p.down > 0) p.down = Math.max(.01, p.down - dt);
      for (const state of [view.sk, view.pc, view.mg, view.hk, view.rn, view.by])
        for (const key in state) if (Array.isArray(state[key])) advanceList(state[key], dt);
      advanceList(view.bullets, dt);
    }
  }

  // Host → everyone: the horde in a flat number array, giants and hostile shots as objects.
  function sendSnapshot() {
    const flat = [], giants = [], hostile = [];
    for (const z of zombies) {
      if (isGiant(z)) { giants.push(z); continue; }
      const swing = z.type === 'runner' ? .7 : 1;
      flat.push(z.id, ENEMY_KINDS.indexOf(z.type), Math.round(z.x), Math.round(z.y), Math.round((z.angle || 0) * 100),
        Math.round(z.health), Math.round(z.maxHealth), Math.round(z.skillWindup * 100), Math.max(0, ENEMY_SKILLS.indexOf(z.skillKind)),
        Math.round((z.dashAngle || 0) * 100), z.attackTimer > swing - .2 ? 1 : 0, Math.round((z.rootTimer || 0) * 10),
        Math.round((z.soakedTimer || 0) * 10), Math.round(Math.max(0, z.deathTimer) * 100));
    }
    for (const b of bullets) if (!b.friendly) hostile.push(b);
    window.CoopNet.send(netJSON({ t: 'snap', w: [waveState.number, waveState.total, waveState.spawned, waveState.intermission],
      boss: waveState.boss?.id || 0, sc: me.score, k: me.kills, gt: gameTime, z: flat, g: giants, hb: hostile, fx: effects }));
  }

  function setProxyHealth(z, health) {
    if (z.hostHealth !== undefined && health < z.hostHealth) z.hitFlash = Math.max(z.hitFlash || 0, .1);
    if (z.health > 0 && health <= 0) {
      addBloodDecal(z.x, z.y, isGiant(z) ? 34 : z.type === 'brute' ? 20 : 13);
      bloodBurst(z.x, z.y, rand(0, Math.PI * 2), isGiant(z) ? 30 : 10);
    }
    z.hostHealth = health; z.health = health;
  }

  function applySnapshot(msg) {
    const seq = ++net.snapSeq, f = msg.z;
    for (let i = 0; i < f.length; i += 14) {
      const id = f[i], type = ENEMY_KINDS[f[i + 1]] || 'walker';
      let z = net.proxies.get(id);
      if (!z) {
        z = { id, type, netProxy: true, r: ZOMBIE_TYPES[type].radius, color: ZOMBIE_TYPES[type].color,
          x: f[i + 2], y: f[i + 3], pulse: rand(0, 6), seed: rand(0, Math.PI * 2), hitFlash: 0, attackTimer: 0, health: f[i + 5] };
        net.proxies.set(id, z);
      }
      z.tx = f[i + 2]; z.ty = f[i + 3]; z.angle = f[i + 4] / 100;
      setProxyHealth(z, f[i + 5]); z.maxHealth = f[i + 6];
      z.skillWindup = f[i + 7] / 100; z.skillKind = ENEMY_SKILLS[f[i + 8]] || ''; z.dashAngle = f[i + 9] / 100;
      if (f[i + 10]) z.attackTimer = type === 'runner' ? .7 : 1;
      z.rootTimer = f[i + 11] / 10; z.soakedTimer = f[i + 12] / 10; z.deathTimer = f[i + 13] / 100;
      z.seq = seq;
    }
    for (const g of msg.g) {
      let z = net.proxies.get(g.id);
      if (!z) {
        z = { netProxy: true, x: g.x, y: g.y, hitFlash: 0, health: g.health, pulse: 0 };
        net.proxies.set(g.id, z);
        const name = g.type === 'beast' ? window.TailedBeasts.members[g.beastId]?.name : bossName(g);
        if (g.health > 0) { showToast(`${name} XUẤT HIỆN!`); if (g.type === 'beast') shake = Math.max(shake, 10); }
      }
      const x = z.x, y = z.y, pulse = z.pulse, health = g.health;
      delete g.health; delete g.hitFlash;
      Object.assign(z, g);
      z.x = x; z.y = y; z.pulse = pulse; z.tx = g.x; z.ty = g.y;
      setProxyHealth(z, health);
      z.seq = seq;
    }
    for (const [id, z] of net.proxies) if (z.seq !== seq) net.proxies.delete(id);
    zombies.length = 0;
    for (const z of net.proxies.values()) zombies.push(z);
    const wave = waveState.number;
    [waveState.number, waveState.total, waveState.spawned, waveState.intermission] = msg.w;
    if (waveState.number !== wave && waveState.number > 0) showToast(`ĐỢT ${waveState.number} — ${waveState.total} NINJA ĐỊCH TẤN CÔNG`);
    waveState.boss = msg.boss ? net.proxies.get(msg.boss) || null : null;
    me.score = msg.sc; me.kills = msg.k; gameTime = msg.gt;
    net.hostile = msg.hb || [];
    net.fx = msg.fx || [];
  }

  // Guests animate the host's enemies between snapshots.
  function updateProxies(dt) {
    const k = Math.min(1, dt * 12);
    for (const z of zombies) {
      if (z.tx !== undefined) {
        const dx = z.tx - z.x, dy = z.ty - z.y;
        if (dx * dx + dy * dy > 200 * 200) { z.x = z.tx; z.y = z.ty; } else { z.x += dx * k; z.y += dy * k; }
      }
      z.hitFlash = Math.max(0, (z.hitFlash || 0) - dt);
      z.pulse = (z.pulse || 0) + dt * (z.type === 'runner' ? 11 : 5);
      z.attackTimer = Math.max(0, (z.attackTimer || 0) - dt);
      if (z.skillWindup > 0) z.skillWindup = Math.max(0, z.skillWindup - dt);
      if (z.health <= 0) z.deathTimer = Math.max(0, (z.deathTimer || 0) - dt);
    }
    for (const b of net.hostile) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (let i = net.fx.length - 1; i >= 0; i--) { net.fx[i].life -= dt; if (net.fx[i].life <= 0) net.fx.splice(i, 1); }
  }

  function updateNet(dt) {
    advanceViews(dt);
    net.sendTimer -= dt;
    if (net.sendTimer <= 0) {
      net.sendTimer = .05;
      sendPlayerState();
      if (net.role === 'client') flushHits();
    }
    if (net.role !== 'host') return;
    net.snapTimer -= dt;
    if (net.snapTimer <= 0) { net.snapTimer = 1 / 15; sendSnapshot(); }
    // The run is lost only when the whole team is down at the same time.
    if (!net.over && me.down > 0 && [...net.peers.values()].every(peer => !peer.view || peer.view.p.down > 0)) {
      net.over = true;
      netSend({ t: 'over' });
      gameOver();
    }
  }

  // A clone that runs out of health vanishes in a puff of smoke.
  function hurtClone(clone, amount) {
    if (clone.invuln > 0 || !(clone.health > 0)) return;
    clone.invuln = .3;
    if (clone.ownerId) { netSend({ t: 'clonehurt', to: clone.ownerId, id: clone.id, a: Math.round(amount) }); return; }
    clone.health -= amount;
    clone.hitFlash = .15;
    bloodBurst(clone.x, clone.y, rand(0, Math.PI * 2), 3);
    if (clone.health > 0) return;
    const index = skillState.clones.indexOf(clone);
    if (index >= 0) skillState.clones.splice(index, 1);
    addSkillEffect('explosions', { x: clone.x, y: clone.y, radius: 50, life: .45, maxLife: .45, kind: 'smoke' });
    burst(clone.x, clone.y, '#e8eef2', 10);
    // Refresh the HUD next frame: `player` may still be bound to an enemy's target here.
    if (!skillState.clones.length) hudTimer = 0;
  }

  function knockOut() {
    me.down = 6; me.health = 0; me.speed = 0; me.leap = null; me.jump = 0; gateTimers.length = 0; me.gates = me.rinnegan = me.sixPaths = me.susanoo = false; me.spLift = 0; me.maxHealth = me.nineTails ? 10000 : 100;
    cancelCharge(); cancelPurpleChidoriCharge();
    bloodBurst(me.x, me.y, rand(0, Math.PI * 2), 16);
    showToast('BẠN ĐÃ GỤC — HỒI SINH CẠNH ĐỒNG ĐỘI SAU 6 GIÂY', 3);
  }

  function respawn() {
    me.down = 0;
    const standing = [...net.peers.values()].map(peer => peer.view?.p).filter(p => p && !(p.down > 0));
    const buddy = standing[Math.floor(Math.random() * standing.length)];
    if (buddy) {
      for (const offset of [46, 30, 0]) {
        const a = rand(0, Math.PI * 2), x = buddy.x + Math.cos(a) * offset, y = buddy.y + Math.sin(a) * offset;
        if (!blocked(x, y, me.r)) { me.x = x; me.y = y; break; }
      }
    }
    me.health = me.maxHealth * .6; me.armor = Math.max(me.armor, 25); me.invuln = 2.5;
    addSkillEffect('explosions', { x: me.x, y: me.y, radius: 80, life: .5, maxLife: .5, kind: 'smoke' });
    showToast('ĐÃ HỒI SINH!', 1.4);
    updateHUD();
  }

  function updateCoopPanel() {
    const panel = document.getElementById('coopPanel');
    if (!panel || !coop()) return;
    document.getElementById('coopRoomCode').textContent = `PHÒNG ${window.CoopNet.state.code}`;
    const list = document.getElementById('coopTeam');
    const rows = [{ name: `${window.CoopNet.nameOf(net.id)} (BẠN)`, color: COOP_COLORS[net.slot], p: me }];
    for (const peer of net.peers.values()) rows.push({ name: peer.name, color: COOP_COLORS[peer.slot], p: peer.view?.p });
    // Rebuild the list only when a name, health or knocked-out state changed.
    const key = rows.map(r => `${r.name}|${r.p ? Math.ceil(r.p.health) : '-'}|${r.p?.down > 0}`).join(';');
    if (list.__key === key) return;
    list.__key = key;
    list.replaceChildren(...rows.map(row => {
      const li = document.createElement('li');
      li.style.setProperty('--slot', row.color);
      li.classList.toggle('down', row.p?.down > 0);
      const name = document.createElement('span'); name.className = 'name'; name.textContent = row.name;
      const hp = document.createElement('span'); hp.className = 'hp';
      hp.textContent = row.p ? `${Math.ceil(Math.max(0, row.p.health))} HP` : 'ĐANG VÀO…';
      const track = document.createElement('span'); track.className = 'track';
      const fill = document.createElement('span');
      fill.style.width = `${row.p ? clamp(row.p.health / (row.p.maxHealth || 100) * 100, 0, 100) : 0}%`;
      track.append(fill);
      li.append(name, hp, track);
      return li;
    }));
  }

  function startPayload() {
    return { bh: buildings.map(b => Math.round(b.health)) };
  }

  function setRole(role) {
    const state = window.CoopNet?.state;
    net.role = role;
    net.id = role === 'solo' ? 0 : state.id;
    net.slot = role === 'solo' ? 0 : window.CoopNet.slotOf(net.id);
    net.peers.clear();
    if (role !== 'solo') syncPeers();
    targetList.length = 0; targetList.push(me);
    document.getElementById('coopPanel').hidden = role === 'solo';
    document.getElementById('pauseCoopNote').hidden = role === 'solo';
    document.getElementById('pauseLeave').hidden = role === 'solo';
    const restart = document.querySelector('#restartButton .headband-label');
    if (restart) restart.textContent = role === 'host' ? 'CHƠI LẠI CẢ ĐỘI' : role === 'client' ? 'CHỜ CHỦ PHÒNG…' : 'CHƠI LẠI';
  }

  function hostStart() {
    if (window.CoopNet?.state.role !== 'host') return;
    start('host');
    netSend({ t: 'start', ...startPayload() });
  }

  // A guest joins a run in progress: copy which houses are already damaged or down.
  function startAsGuest(msg) {
    start('client');
    if (!msg.bh) return;
    buildings.forEach((b, i) => {
      if (typeof msg.bh[i] !== 'number') return;
      b.health = msg.bh[i];
      if (b.health <= 0 && !b.destroyed) { b.destroyed = true; b.collapseLife = 0; destructionState.ruins.push(b); }
    });
    invalidateStatic(); minimapReady = false;
  }

  function leaveToMenu(text) {
    setRole('solo');
    running = false; paused = false; largeMap = false; ui.hud.classList.remove('map-open');
    zombies.length = 0;
    ui.hud.classList.add('hidden'); ui.pause.classList.remove('visible'); ui.over.classList.remove('visible');
    ui.start.classList.add('visible');
    const error = document.getElementById('coopError');
    if (error) error.textContent = text || '';
  }

  function onNetMessage(msg) {
    switch (msg.t) {
      case 'start': if (window.CoopNet.state.role === 'client') startAsGuest(msg); break;
      case 'p': if (running && coop()) applyPeerState(msg.from, msg); break;
      case 'snap': if (running && net.role === 'client') applySnapshot(msg); break;
      case 'hits': if (running && net.role === 'host') applyRemoteHits(msg.from, msg.h); break;
      case 'hurt': if (running && coop()) { player = me; damagePlayer(msg.a); } break;
      case 'clonehurt': if (running && coop()) { const clone = skillState.clones.find(c => c.id === msg.id); if (clone) hurtClone(clone, msg.a); } break;
      case 'shove': if (running && coop() && !(me.down > 0)) { player = me; applyShove(msg.a, msg.d); } break;
      case 'heal': if (running) { healMe(msg.h, msg.a); showToast(`ĐỢT ${waveState.number} HOÀN TẤT — HỒI MÁU`); } break;
      case 'reward': if (running && coop()) grantReward(msg.kind, msg.name, msg.killer); break;
      case 'over': if (running && net.role === 'client') { net.over = true; gameOver(); } break;
      case 'toast': if (running) showToast(String(msg.text || '').slice(0, 120), 3); break;
      case 'spawn': if (running && net.role === 'host' && Array.isArray(msg.list)) {
        const n = queueSpawns(msg.list);
        showToast(`${peerName(msg.from)} TRIỆU TẬP ${n} KẺ ĐỊCH`, 1.6);
      } break;
      case 'clear': if (running && net.role === 'host') { clearEnemies(); showToast(`${peerName(msg.from)} ĐÃ XOÁ HẾT KẺ ĐỊCH`, 1.6); } break;
      case 'peer-join':
        if (!coop()) break;
        syncPeers();
        showToast(`${msg.name} ĐÃ VÀO PHÒNG`, 1.6);
        if (net.role === 'host' && running) netSend({ t: 'start', to: msg.id, ...startPayload() });
        break;
      case 'peer-leave':
        if (!coop()) break;
        showToast(`${peerName(msg.id)} ĐÃ RỜI PHÒNG`, 1.6);
        net.peers.delete(msg.id);
        syncPeers();
        break;
      case 'host-left': if (coop()) leaveToMenu('Chủ phòng đã rời, phòng co-op đã đóng.'); break;
    }
  }
  if (window.CoopNet) window.CoopNet.on(onNetMessage);
  window.ShinobiGame = { hostStart };

  // ---------------------------------------------------------------------------
  // Fourth Great Ninja War (toggle in the spawn panel): the battlefield south of the Suna–Kiri road,
  // the Allied Shinobi Forces with the five Kage and the four Hokage at the player's side, a White
  // Zetsu army, reanimated Madara, then — after a rebirth cinematic — Six Paths Madara.
  // phase: 0 off · 1 Edo Madara · 2 rebirth · 3 Six Paths Madara · 4 victory.
  // ---------------------------------------------------------------------------
  // White Zetsu kept on the field per phase (the scenery in war-scene.js fills the rest of the plain).
  const WAR_REBIRTH = 4.2, WAR_ZETSU = [0, 170, 0, 120, 0];
  const warState = { active: false, phase: 0, boss: null, corpse: null, transform: 0, transformK: 0, banner: 0,
    zetsuTimer: 0, forces: { allies: [], fx: [] }, view: { x: 0, y: 0, w: 0, h: 0 } };

  function startWar() {
    if (coop()) { showToast('ĐẠI CHIẾN NINJA HIỆN CHỈ CHƠI ĐƠN', 1.8); return false; }
    if (!window.MadaraBosses) { showToast('THIẾU madara-bosses.js', 1.8); return false; }
    clearEnemies();
    window.AnimeSprites?.prewarm?.(['madara', 'madara_rikudo', 'tsunade', 'zetsu_white', 'shinobi_ally', 'shinobi_ally_suna',
      'shinobi_ally_kumo', 'shinobi_ally_kiri', 'shinobi_ally_iwa', 'gaara', 'mei', 'ay', 'onoki']);
    const bf = LAYOUT.battlefield, cx = bf.x + bf.w / 2;
    // The Alliance holds the south of the plain; Madara comes from the north.
    me.x = cx; me.y = bf.y + bf.h * .72; me.angle = -Math.PI / 2;
    camera.x = clamp(me.x - W / 2, 0, WORLD.w - W); camera.y = clamp(me.y - H / 2, 0, WORLD.h - H);
    Object.assign(warState, { active: true, phase: 1, corpse: null, transform: 0, transformK: 0, banner: 0, zetsuTimer: 0 });
    warState.forces.allies.length = warState.forces.fx.length = 0;
    warState.boss = spawnWarBoss('madara', cx, bf.y + bf.h * .3);
    for (let i = 0; i < 120; i++) spawnQueue.push({ type: 'zetsu_white', at: { x: cx + rand(-1700, 1700), y: bf.y + bf.h * rand(.15, .48) } });
    if (window.WarAllies) {
      // The Alliance fights hard, but Naruto should still land the decisive blows.
      Object.assign(window.WarAllies.tuning, { kageDamage: .55, shinobiVsBoss: .12 });
      window.WarAllies.createForces(warState.forces, me.x, me.y + 40, warAllyApi());
    }
    if (!hokageState.allies.length) castHokageSquad();
    invalidateStatic();
    shake = Math.max(shake, 10);
    cutIn('ĐẠI CHIẾN NINJA LẦN THỨ TƯ', '第四次忍界大戦', '240,190,110', me.x, me.y, true);
    showToast('LIÊN QUÂN NHẪN GIẢ XUẤT TRẬN! MADARA UCHIHA (UẾ THỔ CHUYỂN SINH) ĐANG TỚI', 3.2);
    return true;
  }

  function endWar(silent) {
    if (!warState.active) return;
    warState.active = false; warState.phase = 0; warState.boss = null; warState.corpse = null;
    warState.forces.allies.length = warState.forces.fx.length = 0;
    if (!silent) {
      for (const z of zombies) if (z.bossFaction === 'madara' || z.type === 'zetsu_white') { z.health = 0; z.deathTimer = .7; }
      if (waveState.boss?.bossFaction === 'madara') waveState.boss = null;
      showToast('ĐÃ KẾT THÚC ĐẠI CHIẾN NINJA', 1.6);
    }
  }

  function spawnWarBoss(id, x, y) {
    const z = spawnZombie('boss', { faction: 'madara', id, at: { x, y } });
    if (z && !blocked(x, y, z.r)) { z.x = x; z.y = y; }
    return z;
  }

  // What the Kage and the Allied Shinobi see of the battle; rebuilt in place every frame.
  let warApi = null;
  function warAllyApi() {
    if (!warApi) warApi = {
      players: [], leader: me, boss: null, time: 0,
      nearestEnemy(x, y, range) {
        let best = null, bestD = range * range;
        forEachEnemyNear(x, y, range, z => {
          if (z.health <= 0) return;
          const d = (z.x - x) ** 2 + (z.y - y) ** 2;
          if (d < bestD) { bestD = d; best = z; }
        });
        return best;
      },
      forEachEnemyNear: (x, y, r, fn) => forEachEnemyNear(x, y, r, z => z.health > 0 ? fn(z) : undefined),
      // Allies hit with their own strength: undo the Baryon multiplier hurtZombie adds for the player.
      hurt: (z, damage, angle) => hurtZombie(z, me.nineTails ? damage / BARYON_DAMAGE_MULTIPLIER : damage, angle),
      push: (z, dx, dy) => moveCircle(z, dx, dy, z.r),
      move: (a, dx, dy) => moveCircle(a, dx, dy, a.r || 14),
      impact: (x, y, radius, power, kind, angle) => worldImpact(x, y, radius, power, kind, angle),
      burst, blocked,
      shake: v => { shake = Math.max(shake, v); },
      heal: f => healMe(f, 0)
    };
    warApi.time = elapsed; warApi.leader = me;
    warApi.players.length = 0;
    for (const p of targetList) warApi.players.push(p);
    if (!warApi.players.length) warApi.players.push(me);
    warApi.boss = warState.boss && warState.boss.health > 0 ? warState.boss : null;
    return warApi;
  }

  function updateWar(dt) {
    if (!warState.active) return;
    if (window.WarAllies) window.WarAllies.update(warState.forces, dt, warAllyApi());
    const boss = warState.boss;
    // Knockbacks from the whole Alliance add up: keep Madara on the battlefield.
    if (boss && boss.health > 0) {
      const bf = LAYOUT.battlefield;
      boss.x = clamp(boss.x, bf.x + 240, bf.x + bf.w - 240);
      boss.y = clamp(boss.y, bf.y + 240, bf.y + bf.h - 240);
    }
    // Jutsu are not announced on screen; drop the boss modules' callouts.
    for (const z of zombies) z.bossCallout = null;
    // Keep the White Zetsu army coming from the north while Madara stands.
    const want = WAR_ZETSU[warState.phase] || 0;
    warState.zetsuTimer -= dt;
    if (want && warState.zetsuTimer <= 0) {
      warState.zetsuTimer = .6;
      let alive = 0;
      for (const z of zombies) if (z.type === 'zetsu_white' && z.health > 0) alive++;
      const bf = LAYOUT.battlefield;
      for (let i = 0; i < Math.min(24, want - alive - spawnQueue.length); i++)
        spawnQueue.push({ type: 'zetsu_white', at: { x: bf.x + bf.w * rand(.15, .85), y: bf.y + bf.h * rand(.1, .3) } });
    }
    if (warState.phase === 1 && boss && boss.health <= 0) {
      // Edo Madara falls — and rises again as the Ten-Tails' jinchūriki.
      warState.phase = 2; warState.transform = 0; warState.corpse = { x: boss.x, y: boss.y };
      cutIn('MADARA HỒI SINH · JINCHŪRIKI THẬP VĨ', '輪廻天生', '200,190,255', boss.x, boss.y, true, 'madara_rikudo');
      showToast('MADARA ĐÃ HỒI SINH VÀ PHONG ẤN THẬP VĨ VÀO NGƯỜI!', 3);
      shake = Math.max(shake, 12);
    } else if (warState.phase === 2) {
      warState.transform += dt;
      warState.transformK = clamp(warState.transform / WAR_REBIRTH, 0, 1);
      shake = Math.max(shake, 2 + warState.transformK * 6);
      if (warState.transform >= WAR_REBIRTH) {
        const c = warState.corpse;
        warState.phase = 3;
        warState.boss = spawnWarBoss('madara_rikudo', c.x, c.y);
        worldImpact(c.x, c.y, 260, 1400, 'shockwave');
        shake = Math.max(shake, 16);
        cutIn('LỤC ĐẠO MADARA', '六道マダラ', '235,235,255', c.x, c.y, true, 'madara_rikudo');
        showToast('LỤC ĐẠO MADARA XUẤT HIỆN! MIGHT GUY MỞ BÁT MÔN ĐẾN TRỢ CHIẾN!', 3.2);
        if (!mightGuyState.ally) castMightGuy();
        if (!hokageState.allies.length) castHokageSquad();
      }
    } else if (warState.phase === 3 && boss && boss.health <= 0) {
      warState.phase = 4; warState.banner = 8;
      for (const z of zombies) if (z.type === 'zetsu_white' && z.health > 0) { z.health = 0; z.deathTimer = .7; }
      spawnQueue.length = 0;
      cutIn('LIÊN QUÂN NHẪN GIẢ CHIẾN THẮNG!', '忍連合軍勝利', '255,214,120', me.x, me.y, true);
      showToast('ĐÃ ĐÁNH BẠI LỤC ĐẠO MADARA — ĐẠI CHIẾN NINJA KẾT THÚC!', 4);
      healMe(1, 100);
    }
    if (warState.banner > 0) warState.banner -= dt;
  }

  function drawWarOverlay() {
    if (window.WarAllies) window.WarAllies.drawOverlay(ctx, warState.forces, elapsed);
    if (warState.phase === 2 && warState.corpse && window.MadaraBosses?.drawTransform)
      window.MadaraBosses.drawTransform(ctx, warState.corpse.x, warState.corpse.y, warState.transformK, elapsed);
    if (window.WarScene) {
      Object.assign(warState.view, { x: camera.x - 50, y: camera.y - 50, w: W + 100, h: H + 100 });
      window.WarScene.drawWorld(ctx, warState.view, elapsed, warState, LAYOUT.battlefield);
    }
  }

  // ---------------------------------------------------------------------------
  // Spawn panel (N): pick which enemies to call in and how many of each.
  // ---------------------------------------------------------------------------
  const spawnUI = { screen: document.getElementById('spawnScreen'), groups: document.getElementById('spawnGroups'), war: document.getElementById('warToggle'),
    total: document.getElementById('spawnTotal'), counts: new Map(), inputs: new Map(), built: false };

  function spawnCatalog() {
    const A = window.AkatsukiBosses, O = window.OtsutsukiBosses, T = window.TailedBeasts;
    const tone = { walker: '#8aaedf', runner: '#67d7ff', brute: '#caa477', spitter: '#ff844b' };
    return [
      { title: 'NINJA ĐỊCH', items: ['walker', 'runner', 'brute', 'spitter', 'zetsu_white'].map(type =>
        ({ key: type, type, name: ZOMBIE_TYPES[type].name, sprite: type, tone: tone[type] || ZOMBIE_TYPES[type].color, bulk: true })) },
      { title: 'NINJA CÁC LÀNG', items: VILLAGE_NINJA_TYPES.map(type =>
        ({ key: type, type, name: ZOMBIE_TYPES[type].name, sprite: window.AnimeSprites?.has(type) ? type : ZOMBIE_TYPES[type].fallback, tone: STYLE_ACCENT[ZOMBIE_TYPES[type].style], bulk: true })) },
      { title: 'KAGE', items: (window.KageBosses?.order || []).map(id =>
        ({ key: 'k:' + id, type: 'boss', faction: 'kage', id, name: window.KageBosses.members[id].name, sprite: window.AnimeSprites?.has(id) ? id : 'pain', tone: window.KageBosses.members[id].accent })) },
      { title: 'AKATSUKI', items: (A?.order || []).map(id =>
        ({ key: 'a:' + id, type: 'boss', faction: 'akatsuki', id, name: A.members[id].name, sprite: id, tone: A.members[id].accent || '#c8102e' })) },
      ...[['SANNIN · TAM NINJA HUYỀN THOẠI', 'sannin', window.SanninBosses], ['HOKAGE LÀNG LÁ', 'hokage', window.HokageBosses],
        ['HUYỀN THOẠI', 'legend', window.LegendBosses]].filter(([, , M]) => M?.order?.length).map(([title, faction, M]) => ({ title, items: M.order.map(id =>
        ({ key: faction[0] + faction[1] + ':' + id, type: 'boss', faction, id, name: M.members[id].name, sprite: window.AnimeSprites?.has(id) ? id : 'pain', tone: M.members[id].accent || '#e8c070' })) })),
      { title: 'ĐẠI CHIẾN NHẪN GIẢ LẦN 4', items: [['madara', window.MadaraBosses], ['nagato', window.NagatoBoss], ['bee', window.KillerBeeBoss]]
        .flatMap(([faction, M]) => (M?.order || []).map(id => ({ key: 'w' + faction[0] + ':' + id, type: 'boss', faction, id, name: M.members[id].name,
          sprite: window.AnimeSprites?.has(M.members[id].sprite || id) ? M.members[id].sprite || id : 'pain', tone: M.members[id].accent || '#e8c070' }))) },
      { title: 'KẺ THÙ TRUYỀN KIẾP', items: [['sasuke', window.SasukeBoss], ['tobi', window.TobiBoss], ['zetsu', window.ZetsuBoss], ['danzo', window.DanzoBoss], ['jubi', window.TenTailsBoss]]
        .flatMap(([faction, M]) => (M?.order || []).map(id => ({ key: 'x' + faction + ':' + id, type: 'boss', faction, id, name: M.members[id].name,
          sprite: window.AnimeSprites?.has(M.members[id].sprite || id) ? M.members[id].sprite || id : 'pain', tone: M.members[id].accent || '#e8c070' }))) },
      { title: 'ŌTSUTSUKI', items: (O?.order || []).map(id =>
        ({ key: 'o:' + id, type: 'boss', faction: 'otsutsuki', id, name: O.members[id].name, sprite: id, tone: O.members[id].accent || '#d6beff' })) },
      { title: 'VĨ THÚ', items: (T?.order || []).map(id =>
        ({ key: 'b:' + id, type: 'beast', id, name: T.members[id].name, tails: T.members[id].tails, tone: T.members[id].accent || '#ffa62b' })) }
    ];
  }

  function buildSpawnPanel() {
    spawnUI.groups.replaceChildren();
    spawnUI.catalog = spawnCatalog();
    for (const group of spawnUI.catalog) {
      const section = document.createElement('section'); section.className = 'spawn-group';
      const h = document.createElement('h3'); h.textContent = group.title;
      const grid = document.createElement('div'); grid.className = 'spawn-grid';
      for (const item of group.items) {
        const card = document.createElement('div'); card.className = 'spawn-item';
        card.style.setProperty('--tone', item.tone);
        const thumb = document.createElement(item.sprite ? 'canvas' : 'span');
        thumb.className = 'spawn-thumb';
        if (item.sprite && window.AnimeSprites?.has(item.sprite)) {
          thumb.width = thumb.height = 88;
          window.AnimeSprites.drawPortrait(thumb.getContext('2d'), item.sprite, 88);
        } else { thumb.textContent = `${item.tails || ''}尾`; thumb.style.background = item.tone; }
        const name = document.createElement('div'); name.className = 'spawn-name'; name.textContent = item.name; name.title = item.name;
        const row = document.createElement('div'); row.className = 'spawn-count';
        const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−';
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(MAX_SPAWN_REQUEST); input.value = '0';
        input.setAttribute('aria-label', `Số lượng ${item.name}`);
        const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
        const set = value => {
          const v = clamp(Math.round(Number(value) || 0), 0, MAX_SPAWN_REQUEST);
          spawnUI.counts.set(item.key, v); input.value = String(v);
          card.classList.toggle('picked', v > 0);
          updateSpawnTotal();
        };
        minus.addEventListener('click', () => set((spawnUI.counts.get(item.key) || 0) - 1));
        plus.addEventListener('click', () => set((spawnUI.counts.get(item.key) || 0) + 1));
        input.addEventListener('input', () => set(input.value));
        row.append(minus, input, plus);
        if (item.bulk) for (const n of [10, 50]) {
          const quick = document.createElement('button'); quick.type = 'button'; quick.textContent = `+${n}`;
          quick.addEventListener('click', () => set((spawnUI.counts.get(item.key) || 0) + n));
          row.append(quick);
        }
        spawnUI.inputs.set(item.key, set);
        card.append(thumb, name, row);
        grid.append(card);
      }
      section.append(h, grid);
      spawnUI.groups.append(section);
    }
    spawnUI.built = true;
  }

  function updateSpawnTotal() {
    let total = 0;
    for (const v of spawnUI.counts.values()) total += v;
    spawnUI.total.textContent = total
      ? `Sẽ tạo ${Math.min(total, MAX_SPAWN_REQUEST)} kẻ địch${total > MAX_SPAWN_REQUEST ? ` (tối đa ${MAX_SPAWN_REQUEST} mỗi lần)` : ''}`
      : 'Chưa chọn kẻ địch nào';
  }

  function openSpawnPanel() {
    if (!running || net.over) return;
    if (!spawnUI.built) buildSpawnPanel();
    paused = true; largeMap = false; ui.hud.classList.remove('map-open');
    cancelCharge(); cancelPurpleChidoriCharge(); mouse.down = false;
    ui.pause.classList.remove('visible');
    spawnUI.screen.classList.add('visible');
    if (spawnUI.war) spawnUI.war.checked = warState.active;
    updateSpawnTotal();
  }

  function closeSpawnPanel() {
    if (!spawnUI.screen.classList.contains('visible')) return;
    spawnUI.screen.classList.remove('visible');
    paused = false;
    last = performance.now();
  }

  function submitSpawns() {
    const list = [];
    for (const group of spawnUI.catalog || []) for (const item of group.items) {
      const n = spawnUI.counts.get(item.key) || 0;
      for (let i = 0; i < n && list.length < MAX_SPAWN_REQUEST; i++) list.push({ type: item.type, faction: item.faction, id: item.id });
    }
    const warOn = !!spawnUI.war?.checked;
    if (warOn !== warState.active) {
      if (warOn) { if (!startWar()) spawnUI.war.checked = false; } else endWar();
      if (!list.length) { closeSpawnPanel(); return; }
    }
    if (!list.length) { showToast('HÃY CHỌN ÍT NHẤT MỘT KẺ ĐỊCH', 1.4); return; }
    // Bosses and beasts first so they show up before the horde fills the queue.
    list.sort((a, b) => isGiant(b) - isGiant(a));
    if (net.role === 'client') netSend({ t: 'spawn', to: 'host', list });
    else queueSpawns(list);
    closeSpawnPanel();
    showToast(`ĐÃ TRIỆU TẬP ${list.length} KẺ ĐỊCH!`, 1.6);
  }

  function requestClearEnemies() {
    if (net.role === 'client') netSend({ t: 'clear', to: 'host' });
    else clearEnemies();
    closeSpawnPanel();
    showToast('ĐÃ XOÁ HẾT KẺ ĐỊCH', 1.4);
  }

  document.getElementById('spawnButton').addEventListener('click', openSpawnPanel);
  document.getElementById('spawnClose').addEventListener('click', closeSpawnPanel);
  document.getElementById('spawnGo').addEventListener('click', submitSpawns);
  document.getElementById('spawnClearAll').addEventListener('click', requestClearEnemies);
  document.getElementById('spawnReset').addEventListener('click', () => { for (const set of spawnUI.inputs.values()) set(0); });
  spawnUI.screen.addEventListener('keydown', e => {
    // Typing counts must not trigger jutsu; Escape and Enter still work.
    if (e.code === 'Escape') { closeSpawnPanel(); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') submitSpawns();
    e.stopPropagation();
  });

  function showToast(text,duration=2.2){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=duration;}
  function gameOver(){
    paused=true;
    cancelPurpleChidoriCharge();
    const summary=document.getElementById('endSummary');
    if(summary)summary.textContent=`${coop()?'Cả đội đã gục · ':''}${AUTO_WAVES?`Sống sót đến đợt ${waveState.number} · `:''}Hạ ${me.kills} ninja địch · ${me.score.toLocaleString('en-US')} điểm`;
    ui.over.classList.add('visible');ui.hud.classList.add('hidden');
  }
  function restart(){
    if(net.role==='host')hostStart();
    else if(net.role==='client')showToast('CHỈ CHỦ PHÒNG MỚI BẮT ĐẦU LẠI ĐƯỢC',1.4);
    else start();
  }
  function start(role='solo'){setRole(role);resetGame();running=true;paused=false;largeMap=false;ui.hud.classList.remove('map-open');ui.start.classList.remove('visible');ui.over.classList.remove('visible');ui.pause.classList.remove('visible');ui.hud.classList.remove('hidden');updateHUD();drawMap();last=performance.now();if(!loopActive){loopActive=true;frameStats.loops=1;requestAnimationFrame(loop);}showToast(role==='solo'?'BẤM N HOẶC NÚT TẠO ĐỊCH ĐỂ CHỌN KẺ ĐỊCH':'CO-OP BẮT ĐẦU — BẤM N ĐỂ GỌI KẺ ĐỊCH!',3);}

  addEventListener('resize',resize);
  addEventListener('keydown',e=>{
    if(spawnUI.screen.classList.contains('visible')){if(e.code==='Escape')closeSpawnPanel();return;}
    keys[e.code]=true;
    const canAct=running&&!paused&&!largeMap&&!(me.down>0);
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&SKILLS[e.code]) {
      if(e.code==='Space'||e.code==='KeyX'||e.code==='KeyQ'||e.code==='KeyG') beginCharge(e.code);
      else activateSkill(e.code);
    }
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyT') toggleNineTails();
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyY') toggleGates();
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyU') toggleRinnegan();
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyI') toggleSixPaths();
    if(!e.repeat&&canAct&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyO') toggleSusanoo();
    if(!e.repeat&&canAct&&e.code==='Digit1'){
      player.weapon='staff';player.fireCooldown=0;updateHUD();showToast('ĐÃ RÚT TRƯỢNG LỤC ĐẠO');
    }
    if(!e.repeat&&canAct&&(e.code==='Digit2'||e.code==='Digit4')){
      player.weapon=e.code==='Digit2'?'shuriken':'kunai';player.fireCooldown=0;updateHUD();showToast(`ĐÃ RÚT ${WEAPONS[player.weapon].name}`);
    }
    if(!e.repeat&&canAct&&e.code==='Digit3'){
      player.weapon='susano';player.fireCooldown=0;updateHUD();showToast('ĐÃ TRANG BỊ SONG KIẾM SUSANO');
    }
    if(e.code==='KeyP'&&!e.repeat&&window.PostFX&&window.PostFX.available){window.PostFX.setEnabled(!window.PostFX.enabled);showToast(window.PostFX.enabled?'ĐỒ HOẠ WEBGL: BẬT (PHÁT SÁNG, SÓNG XUNG KÍCH)':'ĐỒ HOẠ WEBGL: TẮT');}
    if(e.code==='KeyN'&&!e.repeat&&running&&!paused&&!net.over){openSpawnPanel();e.preventDefault();return;}
    if(e.code==='KeyM'&&running&&!paused){largeMap=!largeMap;ui.hud.classList.toggle('map-open',largeMap);if(largeMap){cancelCharge();cancelPurpleChidoriCharge();}}
    if(e.code==='KeyR'&&running&&!e.repeat)restart();
    if(e.code==='Escape'&&running&&!largeMap){paused=!paused;ui.pause.classList.toggle('visible',paused);if(paused){cancelCharge();cancelPurpleChidoriCharge();}}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  });
  addEventListener('keyup',e=>{
    keys[e.code]=false;
    if(e.code==='Space'||e.code==='KeyX'||e.code==='KeyQ'||e.code==='KeyG') releaseCharge(e.code);
  });
  addEventListener('blur',()=>{
    for(const code in keys) keys[code]=false;
    mouse.down=false;
    cancelCharge();
    cancelPurpleChidoriCharge();
  });
  canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
  canvas.addEventListener('mousedown',e=>{
    mouse.x=e.clientX;mouse.y=e.clientY;
    if(largeMap&&largeMapRect&&e.button===0&&running&&!(me.down>0)){travelTo((e.clientX-largeMapRect.x)/largeMapRect.scale,(e.clientY-largeMapRect.y)/largeMapRect.scale);return;}
    if(e.button===0)mouse.down=true;
    else if(e.button===2){e.preventDefault();beginPurpleChidoriCharge();}
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('mouseup',e=>{
    if(e.button===0)mouse.down=false;
    else if(e.button===2){e.preventDefault();releasePurpleChidoriCharge();}
  });
  document.getElementById('startButton').addEventListener('click',()=>start('solo'));
  document.getElementById('restartButton').addEventListener('click',restart);
  document.getElementById('pauseLeave').addEventListener('click',()=>{window.CoopNet?.leave();leaveToMenu('');});
  document.getElementById('resumeButton').addEventListener('click',()=>{paused=false;ui.pause.classList.remove('visible');last=performance.now();});
  // While the title screen is up, draw each village once at a tiny scale so the browser uploads
  // all building art to the GPU now, instead of stalling the first time the player walks in.
  function warmTextures() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    const jobs = [
      // Allocate the tile canvases up front, a few at a time.
      ...Array.from({ length: 7 }, () => () => { for (let i = 0; i < 8 && tilePool.length + tiles.size < MAX_TILES; i++) tilePool.push(makeTileCanvas()); }),
      () => { g.setTransform(.05, 0, 0, .05, 0, 0); window.KonohaWorld.drawStatic(g, { x: -200, y: -600, w: KONOHA.size + 400, h: KONOHA.size + 1000 }, konohaWorld); },
      ...villageList.map(v => () => { g.setTransform(.08, 0, 0, .08, 0, 0); v.mod.drawStatic(g, { x: -200, y: -200, w: v.size + 400, h: v.size + 400 }, () => false); }),
      () => { g.setTransform(.015, 0, 0, .015, 0, 0); window.WorldMap.drawStatic(g, { x: 0, y: 0, w: WORLD.w, h: WORLD.h }); }
    ];
    const next = () => {
      const job = jobs.shift();
      if (!job) return;
      try { job(); } catch (error) { console.error(error); }
      setTimeout(next, 150);
    };
    setTimeout(next, 500);
  }

  buildCity();resize();if (window.PostFX) window.PostFX.init(canvas);warmTextures();
  if (window.AnimeSprites) {
    window.AnimeSprites.prewarm(['naruto', 'walker', 'runner', 'brute', 'spitter']);
    paintTitleArt(); paintPortrait();
    // Bake the rarer casts in the background so the first boss or summon doesn't hitch.
    const later = ['naruto_baryon', 'naruto_rinnegan', 'pain', 'itachi', 'kisame', 'deidara', 'sasori', 'kakuzu', 'konan', 'hidan',
      'momoshiki', 'kinshiki', 'isshiki', 'kaguya', 'hashirama', 'tobirama', 'hiruzen', 'minato', 'guy',
      ...VILLAGE_NINJA_TYPES, 'gaara', 'mei', 'ay', 'onoki', ...['naruto_rikudo', 'sasuke_indra', 'tsunade', 'jiraiya', 'orochimaru', 'kabuto', 'kakashi', 'kazekage1', 'mu', 'obito_rikudo', 'madara', 'madara_rikudo', 'nagato', 'killer_bee', 'sasuke', 'tobi', 'zetsu', 'danzo', 'jubi', 'zetsu_white'].filter(id => window.AnimeSprites.has(id))];
    const bake = () => { if (later.length) { window.AnimeSprites.prewarm([later.shift()]); setTimeout(bake, 30); } };
    setTimeout(bake, 400);
  }
  render();
})();
