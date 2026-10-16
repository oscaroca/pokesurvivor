/* ============ natures.js — naturalezas ============
 * Cada Pokémon de tu colección tiene naturalezas desbloqueadas y eliges una
 * en su ficha. Como en los juegos, pero sobre los 3 stats de este:
 * una sube un stat un 10% y baja otro un 10%; las 3 neutras no tocan nada.
 *
 * Guardado (por FAMILIA desde el 16-10-2026: Charmander, Charmeleon y
 * Charizard comparten naturalezas; la clave es la raíz, G.Family.rootOf):
 *   save.nat[raíz]  = ['fuerte', 'audaz', ...]   desbloqueadas
 *   save.pnat[raíz] = 'audaz'                     la elegida
 * Una familia sin save.nat (partidas de antes) tiene 'fuerte'. Las que
 * estaban por Pokémon se juntan con fold() (unión; la elegida, la del compañero).
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

  const key = dex => G.Family ? G.Family.rootOf(dex) : +dex;

  /** Naturalezas desbloqueadas de un Pokémon (las de su familia, en el orden de ALL). */
  function owned(save, dex) {
    if (!save || !save.owned[dex]) return [];
    const l = save.nat && save.nat[key(dex)];
    const have = new Set(Array.isArray(l) && l.length ? l : ['fuerte']);
    return ALL.filter(n => have.has(n.id)).map(n => n.id);
  }

  /** Desbloquea `id` para `dex`. Devuelve true si es nueva. */
  function unlock(save, dex, id) {
    if (!BY[id]) return false;
    save.nat = save.nat || {};
    const l = owned(save, dex);
    if (l.includes(id)) { save.nat[key(dex)] = l; return false; }
    save.nat[key(dex)] = l.concat(id);
    return true;
  }

  /** Primera naturaleza al conseguir un Pokémon nuevo (sustituye a la de por defecto). */
  // Si la familia ya tenía naturalezas, la del nuevo se suma a ellas.
  function first(save, dex, id) {
    save.nat = save.nat || {};
    const k = key(dex), n = BY[id] ? id : random();
    const l = save.nat[k];
    save.nat[k] = Array.isArray(l) && l.length ? [...new Set(l.concat(n))] : [n];
  }

  /** La elegida para jugar (o la primera que tengas). */
  function chosen(save, dex) {
    const l = owned(save, dex);
    const c = save && save.pnat && save.pnat[key(dex)];
    return l.includes(c) ? c : l[0] || 'fuerte';
  }

  function choose(save, dex, id) {
    if (!owned(save, dex).includes(id)) return false;
    save.pnat = save.pnat || {};
    save.pnat[key(dex)] = id;
    return true;
  }

  /**
   * Junta las naturalezas guardadas por Pokémon en su familia (partidas de
   * antes del 16-10-2026, o una copia vieja al fusionar). La elegida: la del
   * compañero si es de la familia; si no, la de la raíz o la primera que haya.
   */
  function fold(save) {
    if (!G.Family || !save) return;
    for (const coll of ['nat', 'pnat']) {
      const src = save[coll];
      if (!src || typeof src !== 'object') continue;
      const out = {};
      const ids = Object.keys(src).sort((a, b) => (+a === +save.partner) - (+b === +save.partner) || (+a === key(a)) - (+b === key(b)));
      for (const d of ids) {
        const k = key(d);
        if (coll === 'nat') out[k] = [...new Set([...(out[k] || []), ...(Array.isArray(src[d]) ? src[d] : [])])];
        else out[k] = src[d];          // los últimos (compañero, raíz) mandan
      }
      save[coll] = out;
    }
  }

  return { ALL, BY, STAT_NAME, random, mul, effect, owned, unlock, first, chosen, choose, fold };
})();
