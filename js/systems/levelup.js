/* ============ levelup.js — las tres cartas de subida de nivel ============
 * Tipos de carta:
 *   new   aprender un movimiento nuevo (sólo si quedan huecos de los 4; un vínculo libera huecos)
 *   up    mejorar un movimiento que ya tienes
 *   stat  mejora permanente de la run
 */
G.LevelUp = (() => {

  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+20 de vida máxima (y la recupera).',
      apply: pl => pl.addMaxHp(20) },
    { id: 'atk',  icon: 'fist', title: 'Potencia',     desc: '+10% de daño con todos los movimientos.',
      apply: pl => pl.atkMul *= 1.10, max: 40 },
    { id: 'spd',  icon: 'boot', title: 'Carrera',      desc: '+7% de velocidad de movimiento.',
      apply: pl => pl.spdMul *= 1.07, max: 8 },
    { id: 'cd',   icon: 'clock', title: 'Reflejos',     desc: '-8% de recarga en todos los movimientos.',
      apply: pl => pl.cdMul *= 0.92, max: 10 },
    { id: 'def',  icon: 'shield', title: 'Coraza',       desc: '+6% de reducción de daño recibido.',
      apply: pl => pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.06), max: 12 },
    { id: 'rgn',  icon: 'sprout', title: 'Síntesis',     desc: '+0.9 de vida regenerada por segundo.',
      apply: pl => pl.regenFlat += 0.9 },
    { id: 'mag',  icon: 'magnet', title: 'Imán',         desc: '+30% de radio de recogida de experiencia.',
      apply: pl => pl.magnet *= 1.30, max: 6 },
    { id: 'xp',   icon: 'book', title: 'Aprendizaje',  desc: '+12% de experiencia ganada.',
      apply: pl => pl.xpMul *= 1.12, max: 8 },
    { id: 'heal', icon: 'berry', title: 'Baya Zidra',   desc: 'Recupera el 45% de tu vida ahora mismo.',
      apply: pl => pl.heal(pl.maxHp * 0.45) }
  ];

  // Megaevolución (data/megas.js): probabilidad de que salga la carta en cada
  // subida de nivel, si estás en forma final, desde este nivel.
  const MEGA_CHANCE = 0.02, MEGA_MIN_LEVEL = 10;
  const MEGA_ITEM = {
    'stone':         { name: 'Megapiedra',    icon: 'star', color: '#e98cff' },
    'red-orb':       { name: 'Orbe Rojo',     icon: 'fire', color: '#ff5a3d' },
    'blue-orb':      { name: 'Orbe Azul',     icon: 'water', color: '#4d9bff' },
    'dragon-ascent': { name: 'Ascenso Draco', icon: 'dragon', color: '#5fe08a' }
  };
  if (G.I18n && G.MEGA) {
    const dict = { 'Megapiedra': 'Mega Stone', 'Orbe Rojo': 'Red Orb', 'Orbe Azul': 'Blue Orb', 'Ascenso Draco': 'Dragon Ascent',
      'Megaevolución': 'Mega Evolution',
      'te conviertes en {x} hasta el final de la partida.': 'you become {x} until the end of the run.',
      'Regresión primigenia: te conviertes en {x} hasta el final de la partida.': 'Primal Reversion: you become {x} until the end of the run.' };
    for (const f of Object.values(G.MEGA).flat()) dict[f.name] = f.en;
    G.I18n.add(dict);
  }

  /** Construye el conjunto de cartas candidatas, con pesos. */
  function candidates(pl) {
    const out = [];

    // --- movimientos nuevos ---
    if (pl.slots.length < pl.maxMoves) {
      // Con 2 potenciadores ya no se ofrecen más: los buff no hacen daño y
      // llenar los 4 huecos con ellos deja la run sin salida.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      const pool = G.Moves.poolFor(pl.baseMon || pl.mon).filter(id =>
        !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff'));
      // Los de la categoría que le conviene (Ataque o Ataque Especial) salen más.
      const fav = G.Moves.favors(pl.mon);
      for (const id of G.U.pickN(pool, 6)) {
        const d = G.Moves.BY_ID[id];
        out.push({
          w: !fav || !d.cat ? 10 : d.cat === fav ? 14 : 6, type: 'new', key: 'new:' + id,
          icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
          tag: G.U.TYPE_NAME[d.type] + (d.cat ? ' · ' + G.Moves.CAT_NAME[d.cat] : ''),
          title: d.name, desc: d.desc,
          apply: p => p.addMove(id)
        });
      }
    }

    // --- evoluciones: movimiento al máximo + su condición cumplida ---
    const waiting = {};                   // stat -> movimiento que la espera para evolucionar
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + m.id,
        icon: 'move:' + m.id, color: '#ffd23f', tag: 'EVOLUCIÓN',
        title: m.name + ' → ' + ev.name, desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.FX.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- mejoras de movimientos que ya tienes ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: 8, type: 'up', key: 'up:' + m.id,
        icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
        tag: 'Nv.' + m.lvl + ' > ' + (m.lvl + 1),
        title: m.name, desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }

    // --- stats ---
    // Las que desbloquean una evolución salen siempre y con aviso.
    // Cada mejora tiene un tope de veces (`max`): en partidas muy largas se
    // acumulaban sin fin (velocidad, recarga y experiencia por las nubes) y el
    // juego acababa colgándose. Las que piden una evolución salen siempre.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s)), 5).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      out.push({
        w: evoFor ? 14 : pl.slots.length < pl.maxMoves ? 4 : 7,
        type: 'stat', key: 'stat:' + s.id,
        icon: s.icon, color: evoFor ? '#ffd23f' : '#8fa3c4', tag: evoFor ? 'Evoluciona ' + evoFor.name : 'Mejora',
        title: s.title, desc: s.desc,
        apply: p => { s.apply(p); p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1; }
      });
    }

    // --- megaevolución: muy rara, sólo en forma final ---
    const megas = pl.level >= MEGA_MIN_LEVEL ? pl.megaOptions() : [];
    if (megas.length && Math.random() < MEGA_CHANCE) {
      const f = G.U.pick(megas);
      const it = MEGA_ITEM[f.item];
      out.push({
        w: 0, type: 'mega', key: 'mega:' + f.key,
        icon: it.icon, color: it.color, tag: 'Megaevolución',
        title: it.name,
        desc: (f.item === 'red-orb' || f.item === 'blue-orb' ? 'Regresión primigenia: ' : '') +
              'te conviertes en ' + f.name + ' hasta el final de la partida.',
        apply: p => {
          p.megaEvolve(f);
          G.Sprites.preload([p.dex], 8000, p.shiny);
          G.Coop.formChanged(p);         // que los compañeros vean la mega
          G.FX.ring(p.x, p.y, 10, 170, it.color, 1, 7);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffffff', 60, 300);
          G.Audio.sfx('legend');
          G.Spawner.say('¡' + f.name + '!' + (p.ability && p.ability.fam ? ' · ' + p.ability.name + ': ' + p.ability.desc : ''), 4.5, true);
        }
      });
    }

    return out;
  }

  /** Devuelve 3 cartas distintas, elegidas por peso. */
  function offer(pl, n = 3) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // Si hay una evolución lista, su carta dorada sale siempre.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) { const c = pool.splice(evo, 1)[0]; used.add(c.key); picked.push(c); }
    // Y la de megaevolución, si ha tocado (ya es rara de por sí).
    const mega = pool.findIndex(c => c.type === 'mega');
    if (mega >= 0) { const c = pool.splice(mega, 1)[0]; used.add(c.key); picked.push(c); }

    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  return { offer, STATS, MEGA_CHANCE };
})();
