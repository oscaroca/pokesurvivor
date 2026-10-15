/* ============ curses.js — maldiciones ============
 * Antes de una partida en solitario eliges maldiciones: la hacen más difícil,
 * y cada punto de maldición mejora el premio.
 *
 * Por punto:  +10% de monedas al terminar · +12,5% de probabilidad de shiny
 *             salvaje · +1 ticket cada 3 puntos (sólo si aguantas 5 minutos)
 *
 * Guardado: save.curses = [ids] (se recuerdan para la siguiente partida).
 * En cooperativo mandan las del anfitrión: van en el mensaje de inicio
 * ({ k:'start', ..., curses }) y todos aplican esa misma lista.
 */
G.Curses = (() => {
  const ALL = [
    { id: 'horde',   pts: 1, name: 'Hordas',          desc: '+30% de enemigos.' },
    { id: 'haste',   pts: 1, name: 'Prisa',           desc: 'Los enemigos van un 20% más rápido.' },
    { id: 'fog',     pts: 1, name: 'Niebla perpetua', desc: 'Niebla durante toda la partida.' },
    { id: 'noheal',  pts: 1, name: 'Sin curas',       desc: 'No salen bayas y los manantiales no curan.' },
    { id: 'tough',   pts: 2, name: 'Piel dura',       desc: 'Los enemigos tienen +40% de vida.' },
    { id: 'heavy',   pts: 2, name: 'Golpes duros',    desc: 'Los enemigos hacen +30% de daño.' },
    { id: 'fragile', pts: 2, name: 'Frágil',          desc: 'Tienes un 30% menos de vida máxima.' },
    { id: 'boss',    pts: 2, name: 'Jefes antes',     desc: 'Sale un jefe cada 2 minutos en vez de cada 3.' }
  ];
  const BY = {};
  for (const c of ALL) BY[c.id] = c;
  const TICKET_MIN_TIME = 300;

  let active = new Set();          // las de la partida en curso

  /** Las elegidas en el guardado (sólo ids que existan). */
  function chosen(save) { return (save && Array.isArray(save.curses) ? save.curses : []).filter(id => BY[id]); }
  function toggle(save, id) {
    const l = chosen(save);
    save.curses = l.includes(id) ? l.filter(x => x !== id) : l.concat(id);
  }
  /** Al empezar la partida. En grupo, `coop` es el inicio que manda el anfitrión. */
  function begin(save, coop) {
    active = new Set(coop ? (Array.isArray(coop.curses) ? coop.curses : []).filter(id => BY[id]) : chosen(save));
    fogT = 99;
  }
  function on(id) { return active.has(id); }
  function points(list) { return (list || [...active]).reduce((n, id) => n + (BY[id] ? BY[id].pts : 0), 0); }

  // ---------------- premio ----------------
  const coinMul = p => 1 + 0.10 * (p ?? points());
  const shinyMul = p => 1 + 0.125 * (p ?? points());
  const tickets = p => Math.floor((p ?? points()) / 3);

  // ---------------- dificultad ----------------
  function rateMul() { return on('horde') ? 1.3 : 1; }
  /** Enemigo recién creado (también los jefes). */
  function modEnemy(e) {
    if (on('tough')) e.maxHp = e.hp = Math.round(e.maxHp * 1.4);
    if (on('heavy')) e.dmg *= 1.3;
    if (on('haste')) e.spd *= 1.2;
  }
  function bossAtMul() { return on('boss') ? 2 / 3 : 1; }

  let fogT = 99;
  /** Cada fotograma: la niebla perpetua (sin volver a ponerla en cada uno). */
  function tick(dt) {
    if (!on('fog') || !G.Weather) return;
    fogT += dt;
    const c = G.Weather.current;
    if (fogT > 5 && !(c && c.kind === 'fog')) { fogT = 0; G.Weather.force('fog', 600); }
  }

  if (G.I18n) {
    const d = {
      'Maldiciones': 'Curses', 'Puntos de maldición': 'Curse points', '¡A la mazmorra!': 'To the dungeon!',
      'Hacen la partida más difícil, pero cada punto mejora el premio. Sólo en solitario.': 'They make the run harder, but each point improves the reward. Solo only.',
      'MALDICIÓN · {x} PUNTOS': 'CURSE · {x} POINTS', 'Sin maldiciones': 'No curses',
      'Más difícil, más premio': 'Harder, bigger reward', 'En grupo, las del anfitrión': 'In a group, the host\'s',
      '{x} puntos · en grupo, las del anfitrión': '{x} points · in a group, the host\'s', '{x} puntos · +{x}% monedas': '{x} points · +{x}% coins',
      'Estás en grupo: se usan las maldiciones del anfitrión. Si eres tú, estas se aplicarán a todos.': 'You are in a group: the host\'s curses are used. If that is you, these apply to everyone.',
      ' Tus maldiciones ({x} puntos) se aplicarán a todos.': ' Your curses ({x} points) will apply to everyone.',
      ' Se usarán las maldiciones del anfitrión.': ' The host\'s curses will be used.',
      'Maldiciones del grupo: {x} puntos': 'Group curses: {x} points',
      '+{x}% monedas': '+{x}% coins', 'shiny ×{x}': 'shiny ×{x}', '+{x} tickets si aguantas 5 min': '+{x} tickets if you survive 5 min',
      '{x} pt': '{x} pt', 'Hordas': 'Hordes', 'Prisa': 'Haste', 'Niebla perpetua': 'Perpetual fog', 'Sin curas': 'No healing',
      'Piel dura': 'Tough hide', 'Golpes duros': 'Heavy blows', 'Frágil': 'Fragile', 'Jefes antes': 'Early bosses',
      '+30% de enemigos.': '+30% enemies.', 'Los enemigos van un 20% más rápido.': 'Enemies are 20% faster.',
      'Niebla durante toda la partida.': 'Fog for the whole run.', 'No salen bayas y los manantiales no curan.': 'No berries drop and springs do not heal.',
      'Los enemigos tienen +40% de vida.': 'Enemies have +40% HP.', 'Los enemigos hacen +30% de daño.': 'Enemies deal +30% damage.',
      'Tienes un 30% menos de vida máxima.': 'You have 30% less max HP.', 'Sale un jefe cada 2 minutos en vez de cada 3.': 'A boss appears every 2 minutes instead of every 3.'
    };
    G.I18n.add(d);
  }

  return { ALL, BY, TICKET_MIN_TIME, chosen, toggle, begin, on, points, coinMul, shinyMul, tickets,
           rateMul, modEnemy, bossAtMul, tick };
})();
