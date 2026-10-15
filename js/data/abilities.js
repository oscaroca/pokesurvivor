/* ============ abilities.js — habilidades ============
 * Cada Pokémon tiene su habilidad principal de los juegos (data/abilities-dex.js,
 * sacada de PokeAPI). Aquí está lo que HACE cada una en este juego.
 *
 * No se programa habilidad por habilidad: hay FAMILIAS de efecto con números
 * ajustables, y la tabla TABLE dice a qué familia va cada habilidad. Las que
 * no están en TABLE no hacen nada todavía: se ven en la ficha como "sin efecto
 * todavía" y se listan en docs/habilidades-pendientes.md
 * (node tools/abilities_report.js).
 *
 * Familias:
 *   pinch        con poca vida, más daño (de un tipo o de todo)
 *   typeBoost    más daño con los movimientos de un tipo
 *   kindBoost    más daño con ciertas formas de ataque (cuerpo a cuerpo, rayo...)
 *   stab         más daño con los movimientos de tus tipos
 *   technician   más daño con los movimientos de poco daño
 *   weatherSpeed / weatherGuard / weatherHeal / weatherPower   con un clima
 *   absorb       los ataques de un tipo te curan en vez de dañarte
 *   resist       recibes menos daño de unos tipos
 *   guard        recibes menos daño de todo
 *   touchGuard   recibes menos daño de los que te tocan
 *   contact      quien te toca se quema, se envenena, se frena o se hace daño
 *   sturdy       aguanta un golpe mortal con 1 de vida (una vez cada 60 s)
 *   levitate     el agua no te frena, la lava no te quema y no pisas trampas
 *   lavaProof    la lava no te quema
 *   noSlow       nada te frena (agua, trampas pegajosas)
 *   pressure     los enemigos cercanos atacan más despacio
 *   onKill       cada derrota sube un stat un rato (acumulable)
 *   onHurt       recibir daño sube un stat un rato (acumulable)
 *   speedBoost   ganas velocidad poco a poco
 *   weatherSet   invocas un clima (las primigenias, toda la partida)
 *   berry        las bayas curan más
 *   stat         mejora fija: atk, spd, cd, magnet, coin, xp, crit, regen
 */
G.Abilities = (() => {
  const W = { rain: ['lluvia', 'rain'], sun: ['sol', 'sun'], sand: ['tormenta de arena', 'sandstorm'], snow: ['nieve', 'snow'] };
  const STAT = { atk: ['ATAQUE y AT. ESP.', 'ATTACK and SP. ATK'], spd: ['VELOCIDAD', 'SPEED'], def: ['DEFENSA', 'DEFENSE'] };
  const TYPE_EN = { normal: 'Normal', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric', ice: 'Ice',
    fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
    rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy' };
  const typeEs = t => (G.U.TYPE_NAME && G.U.TYPE_NAME[t]) || t;
  const pct = k => Math.round(Math.abs(k - 1) * 100);
  const KIND_LBL = {
    melee: ['cuerpo a cuerpo y de embestida', 'melee and dash'], dash: ['de embestida', 'dash'],
    ranged: ['de proyectil y de rayo', 'projectile and beam']
  };
  const KINDS = { melee: ['melee', 'dash'], dash: ['dash'], ranged: ['projectile', 'beam', 'cone', 'chain'] };
  const FX = {
    burn: ['puede quemarse', 'may get burned'], poison: ['puede envenenarse', 'may get poisoned'],
    slow: ['puede quedarse frenado', 'may get slowed down'], recoil: ['se hace daño', 'gets hurt'],
    spore: ['puede envenenarse o quedarse frenado', 'may get poisoned or slowed down']
  };

  /** Texto [español, inglés] de cada familia con sus números. */
  const DESC = {
    pinch: a => a.type
      ? [`Con poca vida, +${pct(a.mult)}% de daño con movimientos de tipo ${typeEs(a.type)}.`, `When low on HP, +${pct(a.mult)}% damage with ${TYPE_EN[a.type]}-type moves.`]
      : [`Con menos de la mitad de vida, +${pct(a.mult)}% de daño.`, `Below half HP, +${pct(a.mult)}% damage.`],
    typeBoost: a => [`+${pct(a.mult)}% de daño con movimientos de tipo ${typeEs(a.type)}.`, `+${pct(a.mult)}% damage with ${TYPE_EN[a.type]}-type moves.`],
    kindBoost: a => [`+${pct(a.mult)}% de daño con movimientos ${KIND_LBL[a.kinds][0]}.`, `+${pct(a.mult)}% damage with ${KIND_LBL[a.kinds][1]} moves.`],
    stab: a => [`+${pct(a.mult)}% de daño con movimientos de tus tipos.`, `+${pct(a.mult)}% damage with moves of your own types.`],
    technician: a => [`+${pct(a.mult)}% de daño con los movimientos de poco daño.`, `+${pct(a.mult)}% damage with low-damage moves.`],
    weatherSpeed: a => [`+${pct(a.mult)}% de velocidad con ${W[a.w][0]}.`, `+${pct(a.mult)}% speed in ${W[a.w][1]}.`],
    weatherGuard: a => [`-${pct(1 - a.red)}% de daño recibido con ${W[a.w][0]}.`, `-${pct(1 - a.red)}% damage taken in ${W[a.w][1]}.`],
    weatherHeal: a => [`Recuperas vida poco a poco con ${W[a.w][0]}.`, `Slowly recover HP in ${W[a.w][1]}.`],
    weatherPower: a => [`+${pct(a.mult)}% de daño con ${W[a.w][0]}.`, `+${pct(a.mult)}% damage in ${W[a.w][1]}.`],
    absorb: a => [`Los ataques de tipo ${typeEs(a.type)} te curan en vez de dañarte.`, `${TYPE_EN[a.type]}-type attacks heal you instead of hurting you.`],
    resist: a => [`Recibes un ${pct(a.mult)}% menos de daño de ${a.types.map(typeEs).join(' y ')}.`, `Take ${pct(a.mult)}% less damage from ${a.types.map(t => TYPE_EN[t]).join(' and ')}.`],
    guard: a => [`Recibes un ${Math.round(a.red * 100)}% menos de daño.`, `Take ${Math.round(a.red * 100)}% less damage.`],
    touchGuard: a => [`Recibes un ${Math.round(a.red * 100)}% menos de daño de los enemigos que te tocan.`, `Take ${Math.round(a.red * 100)}% less damage from enemies that touch you.`],
    contact: a => [`Quien te toca ${FX[a.fx][0]}.`, `Whoever touches you ${FX[a.fx][1]}.`],
    sturdy: () => ['Aguantas con 1 de vida un golpe que te derrotaría (una vez cada 60 s).', 'You survive a knockout blow with 1 HP (once every 60 s).'],
    levitate: () => ['Flotas: el agua no te frena, la lava no te quema y no pisas trampas.', 'You float: water does not slow you, lava does not burn you and you do not trigger traps.'],
    lavaProof: () => ['La lava no te quema.', 'Lava does not burn you.'],
    noSlow: () => ['Nada te frena: ni el agua ni las trampas pegajosas.', 'Nothing slows you down: neither water nor sticky traps.'],
    pressure: a => [`Los enemigos cercanos atacan un ${pct(a.mult)}% más despacio.`, `Nearby enemies attack ${pct(a.mult)}% slower.`],
    onKill: a => [`Cada enemigo derrotado sube tu ${STAT[a.stat][0]} un rato (acumulable).`, `Each defeated enemy raises your ${STAT[a.stat][1]} for a while (stacks).`],
    onHurt: a => [`Al recibir daño sube tu ${STAT[a.stat][0]} un rato (acumulable).`, `Taking damage raises your ${STAT[a.stat][1]} for a while (stacks).`],
    speedBoost: () => ['Ganas velocidad poco a poco durante la partida (hasta +30%).', 'You gain speed little by little during the run (up to +30%).'],
    berry: a => [`Las bayas te curan un ${pct(a.mult)}% más.`, `Berries heal you ${pct(a.mult)}% more.`],
    weatherSet: a => a.every
      ? [`Cada ${a.every} s invocas ${W[a.w][0]} durante ${a.dur} s.`, `Every ${a.every} s you summon ${W[a.w][1]} for ${a.dur} s.`]
      : [`Hay ${W[a.w][0]} mientras estés en la partida.`, `There is ${W[a.w][1]} for as long as you are in the run.`],
    stat: a => a.desc
  };

  const st = (o, es, en) => Object.assign({ fam: 'stat', desc: [es, en] }, o);
  const TABLE = {
    // --- con poca vida ---
    'overgrow': { fam: 'pinch', type: 'grass', mult: 1.3 }, 'blaze': { fam: 'pinch', type: 'fire', mult: 1.3 },
    'torrent': { fam: 'pinch', type: 'water', mult: 1.3 }, 'swarm': { fam: 'pinch', type: 'bug', mult: 1.3 },
    'guts': { fam: 'pinch', mult: 1.25, below: 0.5 },
    // --- más daño ---
    'steelworker': { fam: 'typeBoost', type: 'steel', mult: 1.3 }, 'transistor': { fam: 'typeBoost', type: 'electric', mult: 1.3 },
    'dragons-maw': { fam: 'typeBoost', type: 'dragon', mult: 1.3 },
    'iron-fist': { fam: 'kindBoost', kinds: 'melee', mult: 1.2 }, 'strong-jaw': { fam: 'kindBoost', kinds: 'melee', mult: 1.2 },
    'tough-claws': { fam: 'kindBoost', kinds: 'melee', mult: 1.2 }, 'rock-head': { fam: 'kindBoost', kinds: 'dash', mult: 1.25 },
    'reckless': { fam: 'kindBoost', kinds: 'dash', mult: 1.25 }, 'mega-launcher': { fam: 'kindBoost', kinds: 'ranged', mult: 1.2 },
    'adaptability': { fam: 'stab', mult: 1.25 }, 'technician': { fam: 'technician', mult: 1.4, max: 12 },
    // --- clima ---
    'swift-swim': { fam: 'weatherSpeed', w: 'rain', mult: 1.35 }, 'chlorophyll': { fam: 'weatherSpeed', w: 'sun', mult: 1.35 },
    'sand-rush': { fam: 'weatherSpeed', w: 'sand', mult: 1.35 },
    'sand-veil': { fam: 'weatherGuard', w: 'sand', red: 0.75 }, 'snow-cloak': { fam: 'weatherGuard', w: 'snow', red: 0.75 },
    'hydration': { fam: 'weatherHeal', w: 'rain', regen: 2 }, 'dry-skin': { fam: 'weatherHeal', w: 'rain', regen: 2 },
    'ice-body': { fam: 'weatherHeal', w: 'snow', regen: 2 },
    'protosynthesis': { fam: 'weatherPower', w: 'sun', mult: 1.25 },
    // --- absorber ---
    'water-absorb': { fam: 'absorb', type: 'water' }, 'volt-absorb': { fam: 'absorb', type: 'electric' },
    'lightning-rod': { fam: 'absorb', type: 'electric' }, 'motor-drive': { fam: 'absorb', type: 'electric' },
    'flash-fire': { fam: 'absorb', type: 'fire' }, 'well-baked-body': { fam: 'absorb', type: 'fire' },
    'sap-sipper': { fam: 'absorb', type: 'grass' }, 'earth-eater': { fam: 'absorb', type: 'ground' },
    // --- defensa ---
    'thick-fat': { fam: 'resist', types: ['fire', 'ice'], mult: 0.5 }, 'water-bubble': { fam: 'resist', types: ['fire'], mult: 0.5 },
    'purifying-salt': { fam: 'resist', types: ['ghost'], mult: 0.5 },
    'intimidate': { fam: 'guard', red: 0.15 }, 'battle-armor': { fam: 'guard', red: 0.08 }, 'shell-armor': { fam: 'guard', red: 0.08 },
    'marvel-scale': { fam: 'guard', red: 0.1 }, 'dauntless-shield': { fam: 'guard', red: 0.12 },
    'full-metal-body': { fam: 'guard', red: 0.15 }, 'prism-armor': { fam: 'guard', red: 0.15 }, 'shadow-shield': { fam: 'guard', red: 0.15 },
    'fluffy': { fam: 'touchGuard', red: 0.3 }, 'fur-coat': { fam: 'touchGuard', red: 0.5 },
    'sturdy': { fam: 'sturdy' },
    // --- contacto ---
    'poison-point': { fam: 'contact', fx: 'poison', chance: 0.4 }, 'flame-body': { fam: 'contact', fx: 'burn', chance: 0.4 },
    'static': { fam: 'contact', fx: 'slow', chance: 0.4 }, 'cute-charm': { fam: 'contact', fx: 'slow', chance: 0.4 },
    'cursed-body': { fam: 'contact', fx: 'slow', chance: 0.3 }, 'stench': { fam: 'contact', fx: 'slow', chance: 0.25 },
    'gooey': { fam: 'contact', fx: 'slow', chance: 1 }, 'cotton-down': { fam: 'contact', fx: 'slow', chance: 1 },
    'effect-spore': { fam: 'contact', fx: 'spore', chance: 0.35 },
    'rough-skin': { fam: 'contact', fx: 'recoil', chance: 1 }, 'iron-barbs': { fam: 'contact', fx: 'recoil', chance: 1 },
    // --- terreno ---
    'levitate': { fam: 'levitate' }, 'magma-armor': { fam: 'lavaProof' },
    'inner-focus': { fam: 'noSlow' }, 'oblivious': { fam: 'noSlow' }, 'own-tempo': { fam: 'noSlow' }, 'limber': { fam: 'noSlow' },
    // --- enemigos ---
    'pressure': { fam: 'pressure', mult: 0.7 }, 'unnerve': { fam: 'pressure', mult: 0.8 },
    // --- acumulables ---
    'beast-boost': { fam: 'onKill', stat: 'atk' }, 'chilling-neigh': { fam: 'onKill', stat: 'atk' },
    'grim-neigh': { fam: 'onKill', stat: 'atk' }, 'soul-heart': { fam: 'onKill', stat: 'atk' },
    'defiant': { fam: 'onHurt', stat: 'atk' }, 'justified': { fam: 'onHurt', stat: 'atk' }, 'berserk': { fam: 'onHurt', stat: 'atk' },
    'thermal-exchange': { fam: 'onHurt', stat: 'atk' }, 'stamina': { fam: 'onHurt', stat: 'def' },
    'steadfast': { fam: 'onHurt', stat: 'spd' }, 'weak-armor': { fam: 'onHurt', stat: 'spd' }, 'rattled': { fam: 'onHurt', stat: 'spd' },
    'speed-boost': { fam: 'speedBoost' },
    // --- bayas ---
    'gluttony': { fam: 'berry', mult: 1.5 }, 'cheek-pouch': { fam: 'berry', mult: 1.5 }, 'ripen': { fam: 'berry', mult: 2 },
    // --- mejoras fijas ---
    'keen-eye': st({ magnet: 1.3 }, '+30% de radio de recogida de experiencia.', '+30% experience pickup radius.'),
    'magnet-pull': st({ magnet: 1.5 }, '+50% de radio de recogida de experiencia.', '+50% experience pickup radius.'),
    'run-away': st({ spd: 1.1 }, '+10% de velocidad.', '+10% speed.'),
    'pickup': st({ coin: 1.25 }, '+25% de monedas.', '+25% coins.'),
    'honey-gather': st({ coin: 1.15 }, '+15% de monedas.', '+15% coins.'),
    'illuminate': st({ xp: 1.1 }, '+10% de experiencia.', '+10% experience.'),
    'compound-eyes': st({ crit: 0.06 }, '+6% de probabilidad de golpe crítico.', '+6% critical hit chance.'),
    'shed-skin': st({ regen: 0.8 }, 'Recuperas un poco de vida sin parar.', 'You constantly recover a little HP.'),
    'natural-cure': st({ regen: 0.6 }, 'Recuperas un poco de vida sin parar.', 'You constantly recover a little HP.'),
    'healer': st({ regen: 0.5 }, 'Recuperas un poco de vida sin parar.', 'You constantly recover a little HP.'),
    'hustle': st({ atk: 1.2, cd: 1.1 }, '+20% de daño, pero atacas un 10% más despacio.', '+20% damage, but you attack 10% slower.'),
    'pure-power': st({ atk: 1.4 }, '+40% de daño.', '+40% damage.'),
    'sheer-force': st({ atk: 1.15 }, '+15% de daño.', '+15% damage.'),
    'intrepid-sword': st({ atk: 1.15 }, '+15% de daño.', '+15% damage.'),
    'rivalry': st({ atk: 1.1 }, '+10% de daño.', '+10% damage.'),
    // --- habilidades de megas ---
    'huge-power': st({ atk: 1.5 }, '+50% de daño.', '+50% damage.'),
    'parental-bond': st({ atk: 1.25 }, '+25% de daño.', '+25% damage.'),
    'regenerator': st({ regen: 1.2 }, 'Recuperas vida sin parar.', 'You constantly recover HP.'),
    'multiscale': { fam: 'guard', red: 0.15 }, 'filter': { fam: 'guard', red: 0.12 },
    'solar-power': { fam: 'weatherPower', w: 'sun', mult: 1.3 },
    'protean': { fam: 'stab', mult: 1.2 },
    'sharpness': { fam: 'kindBoost', kinds: 'melee', mult: 1.25 },
    'skill-link': { fam: 'kindBoost', kinds: 'ranged', mult: 1.2 },
    // --- clima ---
    'desolate-land': { fam: 'weatherSet', w: 'sun' }, 'primordial-sea': { fam: 'weatherSet', w: 'rain' },
    'drought': { fam: 'weatherSet', w: 'sun', every: 45, dur: 15 }, 'drizzle': { fam: 'weatherSet', w: 'rain', every: 45, dur: 15 },
    'sand-stream': { fam: 'weatherSet', w: 'sand', every: 45, dur: 15 }, 'snow-warning': { fam: 'weatherSet', w: 'snow', every: 45, dur: 15 }
  };

  for (const id in TABLE) TABLE[id].id = id;

  // Nombres y descripciones al inglés (ver core/i18n.js).
  if (G.I18n) {
    const dict = {};
    for (const id in G.ABILITY_NAME || {}) dict[G.ABILITY_NAME[id][0]] = G.ABILITY_NAME[id][1];
    for (const id in TABLE) { const [es, en] = DESC[TABLE[id].fam](TABLE[id]); dict[es] = en; }
    Object.assign(dict, { 'Habilidad': 'Ability', 'Sin efecto todavía': 'No effect yet',
      'Habilidad · {x}: {x}': 'Ability · {x}: {x}', 'Nueva habilidad · {x}: {x}': 'New ability · {x}: {x}' });
    G.I18n.add(dict);
  }

  /** Habilidad de un Pokémon: { id, name, desc, fam, ... } o con fam null si aún no hace nada. */
  function of(dex) { return byId(G.ABILITY_DEX && G.ABILITY_DEX[dex]); }
  function byId(id) {
    if (!id) return null;
    const name = (G.ABILITY_NAME[id] || [id])[0];
    const t = TABLE[id];
    return t ? Object.assign({ name, desc: DESC[t.fam](t)[0] }, t) : { id, name, fam: null, desc: 'Sin efecto todavía' };
  }

  const fam = (pl, f) => pl && pl.ability && pl.ability.fam === f ? pl.ability : null;
  const weatherIs = w => { const c = G.Weather && G.Weather.current; return !!(c && c.kind === w); };

  // ---------------- mejoras fijas (al empezar y al evolucionar) ----------------
  /** Pone (sign 1) o quita (sign -1) las mejoras fijas de la familia `stat`. */
  function applyStatic(pl, sign) {
    const a = fam(pl, 'stat');
    if (!a) return;
    const m = (k, v) => { pl[k] = sign > 0 ? pl[k] * v : pl[k] / v; };
    if (a.magnet) m('magnet', a.magnet);
    if (a.coin) m('coinMul', a.coin);
    if (a.xp) m('xpMul', a.xp);
    if (a.atk) m('atkMul', a.atk);
    if (a.spd) m('spdMul', a.spd);
    if (a.cd) m('cdMul', a.cd);
    if (a.crit) pl.critChance += sign * a.crit;
    if (a.regen) pl.regenFlat += sign * a.regen;
  }

  // ---------------- daño que haces ----------------
  function dmgMul(pl, m) {
    const a = pl && pl.ability;
    if (!a || !a.fam || !m) return 1;
    switch (a.fam) {
      case 'pinch': return pl.hp < pl.maxHp * (a.below || 1 / 3) && (!a.type || m.type === a.type) ? a.mult : 1;
      case 'typeBoost': return m.type === a.type ? a.mult : 1;
      case 'kindBoost': return KINDS[a.kinds].includes(m.kind) ? a.mult : 1;
      case 'stab': return pl.mon.types.includes(m.type) ? a.mult : 1;
      case 'technician': return m.def && m.def.dmg <= a.max ? a.mult : 1;
      case 'weatherPower': return weatherIs(a.w) ? a.mult : 1;
    }
    return 1;
  }

  // ---------------- daño que recibes ----------------
  /** ¿Este ataque te cura en vez de dañarte? */
  function absorbs(pl, type) { const a = fam(pl, 'absorb'); return !!(a && type === a.type); }
  /** Multiplicador del daño recibido (tipos y clima). */
  function takenMul(pl, type) {
    const a = pl && pl.ability;
    if (!a || !a.fam) return 1;
    if (a.fam === 'resist' && type && a.types.includes(type)) return a.mult;
    if (a.fam === 'weatherGuard' && weatherIs(a.w)) return a.red;
    return 1;
  }
  function guard(pl) { const a = fam(pl, 'guard'); return a ? a.red : 0; }
  function touchMul(pl) { const a = fam(pl, 'touchGuard'); return a ? 1 - a.red : 1; }
  function sturdy(pl) { return !!fam(pl, 'sturdy'); }

  /** Un enemigo te ha tocado. */
  function onTouch(pl, e) {
    const a = fam(pl, 'contact');
    if (!a || e.dead || Math.random() > a.chance) return;
    const fx = a.fx === 'spore' ? (Math.random() < 0.5 ? 'poison' : 'slow') : a.fx;
    if (fx === 'burn') e.applyBurn(2);
    else if (fx === 'poison') e.applyPoison(3);
    else if (fx === 'slow') e.applySlow(0.5, 2);
    else if (fx === 'recoil') e.hurt(e.dmg * 1.5 + 4, '#9aa6b5', e.x - pl.x, e.y - pl.y, 60);
  }

  function onHurt(pl) {
    const a = fam(pl, 'onHurt');
    if (a) pl.addBuff(a.stat, a.stat === 'def' ? 0.06 : 0.08, 5, 5);
  }
  function onKill(pl) {
    const a = fam(pl, 'onKill');
    if (a) pl.addBuff(a.stat, 0.05, 6, 6);
  }

  // ---------------- movimiento y terreno ----------------
  function spdMul(pl) {
    const a = pl && pl.ability;
    if (!a || !a.fam) return 1;
    if (a.fam === 'weatherSpeed' && weatherIs(a.w)) return a.mult;
    if (a.fam === 'speedBoost') return Math.min(1.3, 1 + 0.02 * Math.floor((pl.abT || 0) / 10));
    return 1;
  }
  function regen(pl) { const a = fam(pl, 'weatherHeal'); return a && weatherIs(a.w) ? a.regen : 0; }
  function floats(pl) { return !!fam(pl, 'levitate'); }
  function lavaProof(pl) { return !!(fam(pl, 'levitate') || fam(pl, 'lavaProof')); }
  function noSlow(pl) { return !!(fam(pl, 'noSlow') || fam(pl, 'levitate')); }
  /** Presión: multiplicador de las recargas de los enemigos cerca de `pl`. */
  function enemyCdMul(pl, d2) { const a = fam(pl, 'pressure'); return a && d2 < 260 * 260 ? a.mult : 1; }
  function berryMul(pl) { const a = fam(pl, 'berry'); return a ? a.mult : 1; }

  /** Cada fotograma (player.update): climas invocados. */
  function tick(pl, dt) {
    const a = fam(pl, 'weatherSet');
    if (!a || !G.Weather || pl.remote) return;
    // (Un clima recién puesto aún no cuenta como activo: se espera antes de volver a mirar.)
    pl.wsT = (pl.wsT ?? 1e9) + dt;
    if (!a.every) { if (pl.wsT > 5 && !weatherIs(a.w)) { pl.wsT = 0; G.Weather.force(a.w, 600); } return; }
    if (pl.wsT >= a.every) { pl.wsT = 0; if (!G.Weather.current) G.Weather.force(a.w, a.dur); }
  }

  return { TABLE, DESC, of, byId, applyStatic, dmgMul, absorbs, takenMul, guard, touchMul, sturdy, onTouch, onHurt, onKill,
           spdMul, regen, floats, lavaProof, noSlow, enemyCdMul, berryMul, tick };
})();
