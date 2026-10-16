/* ============ talents.js — árbol de talentos por región (sin oro) ============
 * Dos partes, ninguna se compra con Pokémonedas:
 *
 * 1. ÁRBOL DE CADA REGIÓN (Kanto … Paldea). Se aplica cuando juegas con un
 *    Pokémon de esa región. La región de una familia es la del primero de sus
 *    miembros que salió (Pichu cuenta como Kanto, por Pikachu).
 *    - Insignias: cada hito de HITOS conseguido con Pokémon de la región da 1.
 *      Se calculan de lo que ya guarda la partida (misiones de familia, Pokédex,
 *      legendarios), así que también cuenta lo jugado antes de que existieran.
 *    - Se gastan en NODES (Proyectiles, Área y el nodo final de la región).
 *      Hay menos insignias que coste total: hay que elegir. Reiniciar es gratis.
 *    Guardado: save.tal[región] = { nodo: rango }.
 *
 * 2. ENTRENADOR: mejoras de la cuenta que se desbloquean solas al cumplir su
 *    condición (ACCOUNT) y valen para todos los Pokémon.
 *
 * Otras cosas de aquí: el movimiento inicial elegido (save.pstart[dex], con el
 * nodo de Entrenador "start") y los favoritos (save.pfav[dex], hasta 4
 * movimientos que salen más en las cartas: systems/levelup.js).
 *
 * En partida: apply(pl) deja en pl.tal lo que toca; applyMove() retoca cada
 * movimiento al aprenderlo (player.js) y dmgMul() el daño (Player.atkFor).
 */
G.Talents = (() => {
  const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  const FAV_MAX = 4;

  // ---------------- árbol (igual en todas las regiones) ----------------
  // need: insignias ya gastadas en esa rama (o en la región, para el final).
  const NODES = [
    { id: 'calibre', br: 'proj', max: 3, cost: 1, name: 'Calibre',      desc: '+8% de tamaño de los proyectiles (por rango).' },
    { id: 'impulso', br: 'proj', max: 3, cost: 1, name: 'Impulso',      desc: '+10% de velocidad de los proyectiles (por rango).' },
    { id: 'perfor',  br: 'proj', max: 1, cost: 2, need: 3, name: 'Perforación', desc: '+1 perforación en disparos, novas, abanicos y torretas.' },
    { id: 'rafaga',  br: 'proj', max: 1, cost: 3, need: 6, name: 'Ráfaga',  desc: '+1 proyectil, bumerán, mina, orbe o meteoro (+3 en novas, +2 en abanicos).' },
    { id: 'alcance', br: 'area', max: 3, cost: 1, name: 'Alcance',      desc: '+8% de radio en golpes, auras, rayos, minas, meteoros y rastros (por rango).' },
    { id: 'persist', br: 'area', max: 3, cost: 1, name: 'Persistencia', desc: '+12% de duración de minas, torretas, rastros y potenciadores (por rango).' },
    { id: 'cadena',  br: 'area', max: 1, cost: 2, need: 3, name: 'Cadena',  desc: '+1 salto en ataques en cadena y +15% de distancia en embestidas.' },
    { id: 'eco',     br: 'area', max: 1, cost: 3, need: 6, name: 'Eco',     desc: 'Un 12% de las veces, el ataque se repite al momento.' },
    { id: 'cap',     br: 'cap',  max: 1, cost: 3, need: 10, name: null,     desc: null }
  ];
  const NODE = {};
  for (const n of NODES) NODE[n.id] = n;
  const BRANCH_NAME = { proj: 'Proyectiles', area: 'Área', cap: 'Nodo de la región' };

  // Nodo final de cada región (uno por generación).
  const CAP = [
    { name: 'Evolución Clásica', desc: 'Cada evolución en la partida da +30% de vida y daño (en vez de +20%).' },
    { name: 'Bayas de Johto',    desc: 'Las bayas curan el doble.' },
    { name: 'Clima Primigenio',  desc: '+20% de daño mientras haya un clima activo.' },
    { name: 'Escisión',          desc: '+15% de daño con la categoría que le va a tu Pokémon (física o especial).' },
    { name: 'Rotación',          desc: 'Al cambiar de movimiento, +25% de daño durante 2,5 s.' },
    { name: 'Megavínculo',       desc: 'La carta de megaevolución sale el triple de a menudo y desde el nivel 8.' },
    { name: 'Movimiento Z',      desc: 'Cada 40 s, tu siguiente ataque hace el triple de daño.' },
    { name: 'Dinamax',           desc: 'Al bajar del 35% de vida: 8 s con +40% de daño y la mitad de daño recibido (cada 90 s).' },
    { name: 'Teracristal',       desc: '+25% de daño con movimientos del tipo principal de tu Pokémon.' }
  ];

  // ---------------- entrenador (cuenta) ----------------
  const ACCOUNT = [
    { id: 'skip',   name: 'Saltar carta',        desc: 'Botón para no coger ninguna carta de nivel y curarte un 10%.',
      text: 'Juega 10 partidas',               val: s => s.stats.runs || 0, goal: 10 },
    { id: 'loot',   name: 'Buscador',            desc: '+30% de bayas, imanes y bombas de los enemigos.',
      text: 'Derrota a 50 jefes',              val: s => s.stats.bossesTotal || 0, goal: 50 },
    { id: 'start',  name: 'Movimiento inicial',  desc: 'Elige en la ficha con qué movimiento empiezas: cualquiera de los suyos que hayas evolucionado alguna vez, o su ataque único.',
      text: 'Evoluciona 10 movimientos',       val: s => s.stats.evolutions || 0, goal: 10 },
    { id: 'card4',  name: 'Cuarta carta',        desc: 'En cada subida de nivel eliges entre 4 cartas.',
      text: 'Llega al nivel 40 en una run',    val: s => s.stats.bestLevel || 0, goal: 40 },
    { id: 'revive', name: 'Segunda oportunidad', desc: 'Una vez por partida, al caer te levantas con la mitad de la vida.',
      text: 'Aguanta 25 minutos en una run',   val: s => s.stats.bestTime || 0, goal: 1500, time: true }
  ];
  const ACC = {};
  for (const a of ACCOUNT) ACC[a.id] = a;
  function accountOn(save, id) { const a = ACC[id]; return !!(save && save.stats && a && a.val(save) >= a.goal); }

  // ---------------- regiones ----------------
  const regCache = {};
  /** Región (1-9) de la familia de `dex`: la del primero de sus miembros que salió. */
  function regionOf(dex) {
    const root = G.Family.rootOf(dex);
    if (regCache[root]) return regCache[root];
    let g = 99;
    for (const d of G.Family.members(root)) g = Math.min(g, G.DEX_BY[d].gen || 99);
    if (g === 99) g = (G.DEX_BY[dex] && G.DEX_BY[dex].gen) || 1;
    return (regCache[root] = g);
  }

  // ---------------- insignias ----------------
  const pct = n => n + '%';
  const HITOS = [
    ...[5, 10, 15, 20, 30].map(m => ({ id: 't' + m, text: 'Aguanta ' + m + ' minutos en una run', key: 'time', goal: m * 60 })),
    ...[10, 40, 120].map(n => ({ id: 'b' + n, text: 'Derrota a ' + n + ' jefes', key: 'bosses', goal: n })),
    ...[20, 35].map(n => ({ id: 'l' + n, text: 'Llega al nivel ' + n + ' en una run', key: 'level', goal: n })),
    ...[25, 50, 75, 100].map(n => ({ id: 'd' + n, text: 'Consigue el ' + pct(n) + ' de su Pokédex', key: 'dex', goal: n })),
    { id: 'g1', text: 'Derrota a un legendario de la región en una grieta', key: 'legends', goal: 1 },
    { id: 'g3', text: 'Derrota a 3 legendarios de la región en grietas', key: 'legends', goal: 3, all: true },
    ...[5, 15].map(n => ({ id: 'm' + n, text: 'Recoge ' + n + ' misiones de familia', key: 'missions', goal: n }))
  ];

  /** Lo conseguido en una región: { time, level, bosses, missions, dex (%), legends, legendsTotal }. */
  function regionStats(save, g) {
    const st = { time: 0, level: 0, bosses: 0, missions: 0, dex: 0, legends: 0, legendsTotal: 0 };
    if (!save) return st;
    for (const r in save.fam || {}) {
      if (!G.DEX_BY[r] || regionOf(+r) !== g) continue;
      const f = save.fam[r];
      st.time = Math.max(st.time, f.time || 0);
      st.level = Math.max(st.level, f.level || 0);
      st.bosses += f.bosses || 0;
      st.missions += (f.c || []).length;
    }
    let tot = 0, own = 0;
    for (const p of G.DEX) {
      if (p.gen !== g) continue;
      tot++;
      if (save.owned[p.dex]) own++;
      if (p.leg && G.SPRITE_META && G.SPRITE_META[p.dex]) {
        st.legendsTotal++;
        if (save.legends && save.legends[p.dex]) st.legends++;
      }
    }
    st.dex = tot ? Math.floor(own / tot * 100) : 0;
    return st;
  }

  /** Hitos de una región con su estado: [{ h, value, goal, done }]. */
  function hitos(save, g) {
    const st = regionStats(save, g);
    return HITOS.filter(h => h.key !== 'legends' || st.legendsTotal > 0).map(h => {
      const goal = h.all ? Math.min(h.goal, st.legendsTotal) : h.goal;
      return { h, value: Math.min(st[h.key], goal), goal, done: st[h.key] >= goal };
    });
  }
  function earned(save, g) { return hitos(save, g).filter(x => x.done).length; }

  function tree(save, g) {
    save.tal = save.tal || {};
    return save.tal[g] || (save.tal[g] = {});
  }
  function spent(save, g, br) {
    const t = (save.tal && save.tal[g]) || {};
    let n = 0;
    for (const id in t) if (NODE[id] && (!br || NODE[id].br === br)) n += t[id] * NODE[id].cost;
    return n;
  }
  function free(save, g) { return earned(save, g) - spent(save, g); }

  /** ¿Se puede subir este nodo? → '' o el motivo. */
  function blocked(save, g, id) {
    const n = NODE[id], t = tree(save, g);
    if ((t[id] || 0) >= n.max) return 'Al máximo';
    if (n.need && (n.br === 'cap' ? spent(save, g) : spent(save, g, n.br)) < n.need)
      return n.br === 'cap' ? 'Gasta ' + n.need + ' insignias en la región' : 'Gasta ' + n.need + ' en esta rama';
    if (free(save, g) < n.cost) return 'Te faltan insignias';
    return '';
  }
  function buy(save, g, id) {
    if (blocked(save, g, id)) return false;
    const t = tree(save, g);
    t[id] = (t[id] || 0) + 1;
    return true;
  }
  function reset(save, g) { if (save.tal) save.tal[g] = {}; }

  function nodeName(g, id) { return id === 'cap' ? CAP[g - 1].name : NODE[id].name; }
  function nodeDesc(g, id) { return id === 'cap' ? CAP[g - 1].desc : NODE[id].desc; }

  // ---------------- favoritos y movimiento inicial ----------------
  function favs(save, dex) { return (save && save.pfav && save.pfav[dex]) || []; }
  /** Marca o desmarca un favorito. Devuelve false si ya hay 4. */
  function toggleFav(save, dex, id) {
    save.pfav = save.pfav || {};
    const l = save.pfav[dex] = (save.pfav[dex] || []).slice();
    const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else if (l.length >= FAV_MAX) return false;
    else {
      l.push(id);
      // Un favorito no puede estar vetado.
      if (save.pban && save.pban[dex]) save.pban[dex] = save.pban[dex].filter(x => x !== id);
    }
    if (!l.length) delete save.pfav[dex];
    return true;
  }

  /** Movimientos con los que puede empezar: el de siempre, los evolucionados alguna vez y su ataque único. */
  function startOptions(save, dex) {
    const def = G.startMoveOf(dex);
    const out = [def];
    if (!accountOn(save, 'start')) return out;
    const sig = G.Signatures && G.Signatures.forDex(dex, save);
    for (const id of G.Moves.poolFor(G.DEX_BY[dex], save)) {
      // Ni potenciadores ni embestidas (van con Espacio: no atacarías solo).
      if (out.includes(id) || G.Moves.BY_ID[id].kind === 'buff' || G.Moves.BY_ID[id].manual) continue;
      if (id === sig || (save.evoMoves && save.evoMoves[id])) out.push(id);
    }
    return out;
  }
  function startMove(save, dex) {
    const pick = save && save.pstart && save.pstart[dex];
    return pick && startOptions(save, dex).includes(pick) ? pick : G.startMoveOf(dex);
  }
  function setStart(save, dex, id) {
    save.pstart = save.pstart || {};
    if (!id || id === G.startMoveOf(dex)) delete save.pstart[dex];
    else save.pstart[dex] = id;
  }

  // ---------------- en partida ----------------

  /** Lo que se aplica en esta run (pl.tal). */
  function forRun(save, dex) {
    const g = regionOf(dex), t = (save && save.tal && save.tal[g]) || {};
    const r = id => Math.min(NODE[id].max, t[id] | 0);
    // Si se gastó más de lo que hay (una copia vieja al fusionar), el árbol no cuenta.
    const ok = save && spent(save, g) <= earned(save, g);
    const on = id => ok ? r(id) : 0;
    return {
      region: g,
      calibre: on('calibre'), impulso: on('impulso'), perfor: on('perfor'), rafaga: on('rafaga'),
      alcance: on('alcance'), persist: on('persist'), cadena: on('cadena'), eco: on('eco'),
      cap: on('cap') ? g : 0,
      skip: accountOn(save, 'skip'), loot: accountOn(save, 'loot'), card4: accountOn(save, 'card4'),
      revive: accountOn(save, 'revive')
    };
  }

  function apply(pl, save, dex) {
    pl.tal = forRun(save, dex);
    pl.revives = pl.tal.revive ? 1 : 0;
    pl.zT = 0;
    return pl.tal;
  }

  const SHOTS = ['projectile', 'nova', 'cone', 'boomerang', 'orbit', 'turret'];
  const PIERCE = ['projectile', 'nova', 'cone', 'turret'];
  const RADIUS = ['melee', 'aura', 'beam', 'mine', 'meteor', 'trail'];
  const DUR = ['mine', 'turret', 'trail', 'buff'];
  const EXTRA = { projectile: 1, nova: 3, cone: 2, boomerang: 1, mine: 1, meteor: 1, orbit: 1 };

  /** Retoca un movimiento recién aprendido con el árbol de la región. */
  function applyMove(m, t) {
    if (!t || !m) return;
    const k = m.kind;
    if (t.calibre && m.size && SHOTS.includes(k)) m.size *= 1 + 0.08 * t.calibre;
    if (t.impulso && m.speed && SHOTS.includes(k) && k !== 'orbit') m.speed *= 1 + 0.10 * t.impulso;
    if (t.perfor && PIERCE.includes(k)) m.pierce = (m.pierce | 0) + 1;
    if (t.rafaga && EXTRA[k]) {
      m.count = (m.count || 1) + EXTRA[k];
      if (k === 'projectile' && (m.spread || 0) < 0.2) m.spread = 0.2;
    }
    if (t.alcance && m.radius && RADIUS.includes(k)) {
      m.radius *= 1 + 0.08 * t.alcance;
      if (k === 'beam' && m.width) m.width *= 1 + 0.08 * t.alcance;
    }
    if (t.persist && m.dur && DUR.includes(k)) m.dur *= 1 + 0.12 * t.persist;
    if (t.cadena) {
      if (k === 'chain') m.count = (m.count || 1) + 1;
      if (k === 'dash' && m.radius) m.radius *= 1.15;
    }
  }

  /** Multiplicador de daño por el nodo final de la región (y Movimiento Z / Dinamax). */
  function dmgMul(pl, m) {
    const t = pl.tal;
    if (!t || !t.cap) return 1;
    switch (t.cap) {
      case 3: return G.Weather.current ? 1.2 : 1;
      case 4: { const f = G.Moves.favors(pl.mon); return !f || (m && m.cat === f) ? 1.15 : 1; }
      case 5: return performance.now() < (pl.rotUntil || 0) ? 1.25 : 1;
      case 7: return pl.zOn ? 3 : 1;
      case 8: return performance.now() < (pl.dmaxUntil || 0) ? 1.4 : 1;
      case 9: return m && m.type === pl.mon.types[0] ? 1.25 : 1;
    }
    return 1;
  }

  /** Daño recibido (Dinamax). */
  function takenMul(pl) {
    return pl.tal && pl.tal.cap === 8 && performance.now() < (pl.dmaxUntil || 0) ? 0.5 : 1;
  }
  /** Tras recibir daño: ¿entra en Dinamax? */
  function onHurt(pl) {
    if (!pl.tal || pl.tal.cap !== 8 || pl.hp <= 0 || pl.hp > pl.maxHp * 0.35) return;
    const now = performance.now();
    if (now - (pl.dmaxAt || -1e9) < 90000) return;
    pl.dmaxAt = now; pl.dmaxUntil = now + 8000;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Dinamax!', '#ff3d6e', true);
    G.FX.ring(pl.x, pl.y, 10, 140, '#ff3d6e', 0.8, 6);
    G.Audio.sfx('legend');
  }

  /** Al ir a caer: Segunda oportunidad. Devuelve true si se salva. */
  function saveFromDeath(pl) {
    if (!(pl.revives > 0)) return false;
    pl.revives--;
    pl.hp = Math.round(pl.maxHp * 0.5);
    pl.invuln = 2.5;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Segunda oportunidad!', '#5fe08a', true);
    G.FX.ring(pl.x, pl.y, 8, 120, '#5fe08a', 0.8, 6);
    G.Audio.sfx('legend');
    return true;
  }

  /** Movimiento Z: cada 40 s se carga; el siguiente ataque hace ×3. */
  function zTick(pl, dt) {
    if (!pl.tal || pl.tal.cap !== 7) return;
    const was = pl.zT >= 40;
    pl.zT = (pl.zT || 0) + dt;
    if (!was && pl.zT >= 40) G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, 'Movimiento Z listo', '#ffd23f');
  }
  function zBegin(pl) {
    if (!pl.tal || pl.tal.cap !== 7 || pl.zT < 40) return false;
    pl.zOn = true; pl.zT = 0;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, '¡Movimiento Z!', '#ffd23f', true);
    G.FX.ring(pl.x, pl.y, 8, 110, '#ffd23f', 0.6, 5);
    return true;
  }
  function zEnd(pl) { pl.zOn = false; }

  function evoStep(pl) { return pl.tal && pl.tal.cap === 1 ? 0.3 : 0.2; }
  function berryMul(pl) { return pl && pl.tal && pl.tal.cap === 2 ? 2 : 1; }
  function megaChance(pl, base) { return pl.tal && pl.tal.cap === 6 ? base * 3 : base; }
  function megaLevel(pl, base) { return pl.tal && pl.tal.cap === 6 ? 8 : base; }
  function lootMul() { const p = G.Game && G.Game.player; return p && p.tal && p.tal.loot ? 1.3 : 1; }
  function cards(pl) { return pl && pl.tal && pl.tal.card4 ? 4 : 3; }

  // ---------------- partida guardada ----------------
  function sanitize(s) {
    const okMove = id => typeof id === 'string' && G.Moves && G.Moves.BY_ID[id];
    if (s.tal && typeof s.tal === 'object') {
      for (const g of Object.keys(s.tal)) {
        const t = s.tal[g];
        if (!(+g >= 1 && +g <= 9) || !t || typeof t !== 'object') { delete s.tal[g]; continue; }
        for (const id of Object.keys(t)) {
          if (!NODE[id]) delete t[id];
          else t[id] = Math.max(0, Math.min(NODE[id].max, Math.floor(+t[id] || 0)));
        }
      }
    } else delete s.tal;
    if (s.pfav && typeof s.pfav === 'object') {
      for (const d of Object.keys(s.pfav)) {
        const l = Array.isArray(s.pfav[d]) ? s.pfav[d] : [];
        s.pfav[d] = [...new Set(l.filter(okMove))].slice(0, FAV_MAX);
        if (!s.pfav[d].length) delete s.pfav[d];
      }
    } else delete s.pfav;
    if (s.pstart && typeof s.pstart === 'object') {
      for (const d of Object.keys(s.pstart)) if (!okMove(s.pstart[d])) delete s.pstart[d];
    } else delete s.pstart;
  }

  if (G.I18n) G.I18n.add({
    'Talentos': 'Talents', 'Insignias': 'Badges', 'Entrenador': 'Trainer', 'Proyectiles': 'Projectiles', 'Área': 'Area',
    'Nodo de la región': 'Region node', 'Reiniciar': 'Reset', 'Al máximo': 'Maxed', 'Te faltan insignias': 'Not enough badges',
    'Gasta {x} insignias en la región': 'Spend {x} badges in this region', 'Gasta {x} en esta rama': 'Spend {x} in this branch',
    'Calibre': 'Caliber', 'Impulso': 'Momentum', 'Perforación': 'Piercing', 'Ráfaga': 'Barrage', 'Alcance': 'Reach',
    'Persistencia': 'Persistence', 'Cadena': 'Chain', 'Eco': 'Echo',
    '+8% de tamaño de los proyectiles (por rango).': '+8% projectile size (per rank).',
    '+10% de velocidad de los proyectiles (por rango).': '+10% projectile speed (per rank).',
    '+1 perforación en disparos, novas, abanicos y torretas.': '+1 pierce on shots, novas, fans and turrets.',
    '+1 proyectil, bumerán, mina, orbe o meteoro (+3 en novas, +2 en abanicos).': '+1 projectile, boomerang, mine, orb or meteor (+3 on novas, +2 on fans).',
    '+8% de radio en golpes, auras, rayos, minas, meteoros y rastros (por rango).': '+8% radius on strikes, auras, beams, mines, meteors and trails (per rank).',
    '+12% de duración de minas, torretas, rastros y potenciadores (por rango).': '+12% duration of mines, turrets, trails and boosts (per rank).',
    '+1 salto en ataques en cadena y +15% de distancia en embestidas.': '+1 jump on chain attacks and +15% dash distance.',
    'Un 12% de las veces, el ataque se repite al momento.': '12% of the time, the attack repeats instantly.',
    'Evolución Clásica': 'Classic Evolution', 'Bayas de Johto': 'Johto Berries', 'Clima Primigenio': 'Primal Weather',
    'Escisión': 'Split', 'Rotación': 'Rotation', 'Megavínculo': 'Mega Bond', 'Movimiento Z': 'Z-Move', 'Teracristal': 'Terastal',
    'Cada evolución en la partida da +30% de vida y daño (en vez de +20%).': 'Each evolution in a run gives +30% HP and damage (instead of +20%).',
    'Las bayas curan el doble.': 'Berries heal twice as much.',
    '+20% de daño mientras haya un clima activo.': '+20% damage while any weather is active.',
    '+15% de daño con la categoría que le va a tu Pokémon (física o especial).': '+15% damage with the category that suits your Pokémon (physical or special).',
    'Al cambiar de movimiento, +25% de daño durante 2,5 s.': 'When you switch moves, +25% damage for 2.5 s.',
    'La carta de megaevolución sale el triple de a menudo y desde el nivel 8.': 'The Mega Evolution card shows up three times as often, from level 8.',
    'Cada 40 s, tu siguiente ataque hace el triple de daño.': 'Every 40 s, your next attack deals triple damage.',
    'Al bajar del 35% de vida: 8 s con +40% de daño y la mitad de daño recibido (cada 90 s).': 'When you drop below 35% HP: 8 s of +40% damage and half damage taken (every 90 s).',
    '+25% de daño con movimientos del tipo principal de tu Pokémon.': '+25% damage with moves of your Pokémon’s main type.',
    'Saltar carta': 'Skip card', 'Buscador': 'Scavenger', 'Movimiento inicial': 'Starting move', 'Cuarta carta': 'Fourth card',
    'Segunda oportunidad': 'Second chance',
    'Botón para no coger ninguna carta de nivel y curarte un 10%.': 'A button to take no level-up card and heal 10%.',
    '+30% de bayas, imanes y bombas de los enemigos.': '+30% berries, magnets and bombs from enemies.',
    'Elige en la ficha con qué movimiento empiezas: cualquiera de los suyos que hayas evolucionado alguna vez, o su ataque único.': 'Choose your starting move on the Pokémon page: any of its moves you have ever evolved, or its signature move.',
    'En cada subida de nivel eliges entre 4 cartas.': 'Choose from 4 cards on each level-up.',
    'Una vez por partida, al caer te levantas con la mitad de la vida.': 'Once per run, when you faint you get back up with half your HP.',
    'Juega 10 partidas': 'Play 10 runs', 'Derrota a 50 jefes': 'Defeat 50 bosses', 'Evoluciona 10 movimientos': 'Evolve 10 moves',
    'Llega al nivel 40 en una run': 'Reach level 40 in a run', 'Aguanta 25 minutos en una run': 'Survive 25 minutes in a run',
    'Aguanta {x} minutos en una run': 'Survive {x} minutes in a run', 'Derrota a {x} jefes': 'Defeat {x} bosses',
    'Llega al nivel {x} en una run': 'Reach level {x} in a run', 'Consigue el {x} de su Pokédex': 'Get {x} of its Pokédex',
    'Derrota a un legendario de la región en una grieta': 'Defeat one of the region’s legendaries in a rift',
    'Derrota a 3 legendarios de la región en grietas': 'Defeat 3 of the region’s legendaries in rifts',
    'Recoge {x} misiones de familia': 'Claim {x} family missions',
    '¡Dinamax!': 'Dynamax!', '¡Segunda oportunidad!': 'Second chance!', 'Movimiento Z listo': 'Z-Move ready', '¡Movimiento Z!': 'Z-Move!',
    'Teselia': 'Unova'
  });

  return { REGIONS, NODES, NODE, BRANCH_NAME, CAP, ACCOUNT, HITOS, FAV_MAX,
           regionOf, regionStats, hitos, earned, spent, free, blocked, buy, reset, nodeName, nodeDesc, accountOn,
           favs, toggleFav, startOptions, startMove, setStart,
           forRun, apply, applyMove, dmgMul, takenMul, onHurt, saveFromDeath, zTick, zBegin, zEnd,
           evoStep, berryMul, megaChance, megaLevel, lootMul, cards, sanitize };
})();
