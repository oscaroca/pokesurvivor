/* ============ family.js — misiones por familia de Pokémon ============
 * Una familia es una cadena evolutiva (data/evolutions.js): Charmander,
 * Charmeleon y Charizard comparten misiones, y jugar con cualquiera cuenta.
 * Un Pokémon que no evoluciona es una familia él solo.
 *
 * Cada familia tiene las misiones de DEFS (la de forma final, sólo si la
 * familia evoluciona). Avanzan jugando con un Pokémon de la familia; el premio
 * se recoge en la ficha del Pokémon. Así se anima a probar Pokémon distintos.
 *
 * Guardado: save.fam[raíz] = { time, level, bosses, final, c: [ids recogidas] }
 *   time    mejor tiempo en una run (s)      level   mejor nivel en una run
 *   bosses  jefes derrotados en total        final   1 si evolucionó a forma final en una run
 */
G.Family = (() => {
  const DEFS = [
    { id: 't5',    stat: 'time',   goal: 300, reward: { t1: 2 },  text: 'Aguanta 5 minutos en una run' },
    { id: 'lv20',  stat: 'level',  goal: 20,  reward: { t1: 2 },  text: 'Llega al nivel 20 en una run' },
    { id: 'boss5', stat: 'bosses', goal: 5,   reward: { t1: 3 },  text: 'Derrota a 5 jefes' },
    { id: 'final', stat: 'final',  goal: 1,   reward: { t1: 3 },  text: 'Evoluciona hasta su forma final en una run', evolves: true },
    { id: 't12',   stat: 'time',   goal: 720, reward: { t10: 1 }, text: 'Aguanta 12 minutos en una run' },
    // Sólo las familias con ataque único (data/signatures.js): el premio es desbloquearlo.
    { id: 'sig',   stat: 'time',   goal: 900, reward: { sig: 1 }, text: 'Aguanta 15 minutos en una run', sig: true }
  ];

  // dex -> raíz de su familia (sube por las evoluciones hasta el primero).
  let parent = null;
  function build() {
    parent = {};
    for (const from in G.EVO || {}) for (const e of G.EVO[from]) if (parent[e.to] == null) parent[e.to] = +from;
  }
  function rootOf(dex) {
    if (!parent) build();
    let d = +dex, guard = 0;
    while (parent[d] != null && guard++ < 5) d = parent[d];
    return d;
  }
  /** Todos los de la familia, de la raíz a las formas finales (los que hay en el juego). */
  function members(root) {
    const out = [], q = [+root];
    while (q.length) {
      const d = q.shift();
      if (out.includes(d)) continue;
      if (G.DEX_BY[d]) out.push(d);
      for (const e of (G.EVO && G.EVO[d]) || []) q.push(e.to);
    }
    return out;
  }
  /** ¿La familia evoluciona? */
  function evolves(root) { return !!(G.EVO && G.EVO[root] && G.EVO[root].length); }
  /** Misiones de la familia de `dex`. */
  function defsFor(dex) {
    const r = rootOf(dex);
    return DEFS.filter(m => (!m.evolves || evolves(r)) && (!m.sig || (G.Signatures && G.Signatures.idFor(r))));
  }

  function rec(save, dex) {
    save.fam = save.fam || {};
    const r = rootOf(dex);
    return save.fam[r] || (save.fam[r] = { time: 0, level: 0, bosses: 0, final: 0, c: [] });
  }
  /** Valor actual de una misión (con lo de la run en curso si se pasa `live`). */
  function value(f, m, live) {
    if (!live) return f[m.stat] || 0;
    if (m.stat === 'bosses') return (f.bosses || 0) + live.bosses;
    return Math.max(f[m.stat] || 0, live[m.stat] || 0);
  }

  /** Lista para la ficha: [{ def, value, done, claimed }]. */
  function status(save, dex) {
    const f = rec(save, dex);
    return defsFor(dex).map(m => {
      const v = value(f, m);
      return { def: m, value: Math.min(v, m.goal), done: v >= m.goal, claimed: f.c.includes(m.id) };
    });
  }

  /** Recoge el premio de una misión hecha. Devuelve el premio o null. */
  function claim(save, dex, id) {
    const f = rec(save, dex);
    const m = defsFor(dex).find(d => d.id === id);
    if (!m || f.c.includes(id) || value(f, m) < m.goal) return null;
    f.c.push(id);
    G.Progress.grant(m.reward);
    return m.reward;
  }

  /** Cuántas hay hechas sin recoger (en todas las familias que tienes). */
  function pending(save) {
    let n = 0;
    for (const r in save.fam || {}) {
      if (!save.owned[r] && !Object.keys(save.owned).some(d => rootOf(d) === +r)) continue;
      for (const s of status(save, r)) if (s.done && !s.claimed) n++;
    }
    return n;
  }

  // ---------------- en partida ----------------
  let told = new Set();
  /** Lo de esta run para la familia del Pokémon con el que juegas. */
  function liveOf(pl, time) {
    const species = pl.mon && pl.mon.dex || pl.dex;
    return { time: Math.floor(time), level: pl.level, bosses: pl.bosses,
             final: pl.evos > 0 && !(G.EVO[species] || []).length ? 1 : 0 };
  }
  function runStart() { told = new Set(); }
  /** Cada segundo o así: avisa de las misiones que se acaban de cumplir. */
  function tick(pl, time) {
    const save = G.DB.save;
    if (!save || !pl || pl.remote) return;
    const dex = pl.baseMon ? pl.baseMon.dex : pl.dex;
    const f = rec(save, dex), live = liveOf(pl, time);
    for (const m of defsFor(dex)) {
      if (told.has(m.id) || value(f, m) >= m.goal) continue;
      if (value(f, m, live) >= m.goal) {
        told.add(m.id);
        G.Spawner.say('Misión de familia cumplida: ' + m.text + ' (recógela en la ficha)', 3.5, true);
        G.Audio.sfx('coin');
      }
    }
  }
  /** Al terminar la run: guarda lo conseguido. */
  function runEnd(pl, time) {
    const save = G.DB.save;
    if (!save || !pl) return;
    const dex = pl.baseMon ? pl.baseMon.dex : pl.dex;
    const f = rec(save, dex), live = liveOf(pl, time);
    f.time = Math.max(f.time || 0, live.time);
    f.level = Math.max(f.level || 0, live.level);
    f.bosses = (f.bosses || 0) + live.bosses;
    f.final = Math.max(f.final || 0, live.final);
  }

  if (G.I18n) G.I18n.add({
    'Aguanta 5 minutos en una run': 'Survive 5 minutes in a run', 'Llega al nivel 20 en una run': 'Reach level 20 in a run',
    'Derrota a 5 jefes': 'Defeat 5 bosses', 'Evoluciona hasta su forma final en una run': 'Evolve into its final form in a run',
    'Aguanta 12 minutos en una run': 'Survive 12 minutes in a run', 'Misiones de la familia': 'Family missions',
    'Misión de familia cumplida: {x} (recógela en la ficha)': 'Family mission complete: {x} (claim it on the Pokémon page)',
    'Recoger': 'Claim', 'Recogida': 'Claimed',
    'Avanzan jugando con cualquier Pokémon de su familia.': 'They progress by playing with any Pokémon of its family.',
    'Misiones de familia listas para recoger: {x}': 'Family missions ready to claim: {x}',
    'Se recogen en la ficha de cada Pokémon (menú Pokémon).': 'Claim them on each Pokémon’s page (Pokémon menu).'
  });

  return { DEFS, rootOf, members, defsFor, status, claim, pending, runStart, tick, runEnd };
})();
