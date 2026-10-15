/* ============ natures.js — naturalezas ============
 * Cada Pokémon de tu colección tiene naturalezas desbloqueadas y eliges una
 * en su ficha. Como en los juegos, pero sobre los 3 stats de este:
 * una sube un stat un 10% y baja otro un 10%; las 3 neutras no tocan nada.
 *
 * Guardado:
 *   save.nat[dex]  = ['fuerte', 'audaz', ...]   desbloqueadas
 *   save.pnat[dex] = 'audaz'                     la elegida
 * Un Pokémon que tienes sin save.nat (partidas de antes) tiene 'fuerte'.
 *
 * Se consiguen al conseguir el Pokémon (una al azar) y con los repetidos del
 * gacha: si el repetido trae una naturaleza que no tenías, la desbloqueas.
 */
G.Natures = (() => {
  const STAT_NAME = { hp: 'Vida', atk: 'Ataque', spd: 'Velocidad' };
  const ALL = [
    { id: 'fuerte',  name: 'Fuerte' },
    { id: 'docil',   name: 'Dócil' },
    { id: 'seria',   name: 'Seria' },
    { id: 'hurana',  name: 'Huraña',  up: 'atk', down: 'hp' },
    { id: 'audaz',   name: 'Audaz',   up: 'atk', down: 'spd' },
    { id: 'osada',   name: 'Osada',   up: 'hp',  down: 'atk' },
    { id: 'placida', name: 'Plácida', up: 'hp',  down: 'spd' },
    { id: 'miedosa', name: 'Miedosa', up: 'spd', down: 'atk' },
    { id: 'activa',  name: 'Activa',  up: 'spd', down: 'hp' }
  ];
  const BY = {};
  for (const n of ALL) BY[n.id] = n;
  const STEP = 0.10;

  function random() { return G.U.pick(ALL).id; }

  /** Multiplicadores { hp, atk, spd } de una naturaleza (neutra si no existe). */
  function mul(id) {
    const m = { hp: 1, atk: 1, spd: 1 }, n = BY[id];
    if (n && n.up) { m[n.up] += STEP; m[n.down] -= STEP; }
    return m;
  }

  /** '+10% Ataque · −10% Vida', o 'Neutra'. */
  function effect(id) {
    const n = BY[id];
    if (!n || !n.up) return 'Neutra';
    return `+10% ${STAT_NAME[n.up]} · −10% ${STAT_NAME[n.down]}`;
  }

  /** Naturalezas desbloqueadas de un Pokémon (en el orden de ALL). */
  function owned(save, dex) {
    if (!save || !save.owned[dex]) return [];
    const l = save.nat && save.nat[dex];
    const have = new Set(Array.isArray(l) && l.length ? l : ['fuerte']);
    return ALL.filter(n => have.has(n.id)).map(n => n.id);
  }

  /** Desbloquea `id` para `dex`. Devuelve true si es nueva. */
  function unlock(save, dex, id) {
    if (!BY[id]) return false;
    save.nat = save.nat || {};
    const l = owned(save, dex);
    if (l.includes(id)) { save.nat[dex] = l; return false; }
    save.nat[dex] = l.concat(id);
    return true;
  }

  /** Primera naturaleza al conseguir un Pokémon nuevo (sustituye a la de por defecto). */
  function first(save, dex, id) {
    save.nat = save.nat || {};
    save.nat[dex] = [BY[id] ? id : random()];
  }

  /** La elegida para jugar (o la primera que tengas). */
  function chosen(save, dex) {
    const l = owned(save, dex);
    const c = save && save.pnat && save.pnat[dex];
    return l.includes(c) ? c : l[0] || 'fuerte';
  }

  function choose(save, dex, id) {
    if (!owned(save, dex).includes(id)) return false;
    save.pnat = save.pnat || {};
    save.pnat[dex] = id;
    return true;
  }

  return { ALL, BY, STAT_NAME, random, mul, effect, owned, unlock, first, chosen, choose };
})();
