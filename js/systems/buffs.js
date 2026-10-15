/* ============ buffs.js — Pokémon buffados de hoy ============
 * Cada día (hora de España) a cada jugador le tocan 3 familias de las que tiene
 * (systems/family.js). Jugar con un Pokémon de esas familias da, sólo ese día:
 *   +15% de vida · +15% de daño (Ataque y At. Esp.) · +10% de velocidad
 *   +25% de monedas al terminar la partida
 *
 * El sorteo es determinista: la fecha + la partida del jugador (save.created),
 * así todo el día salen las mismas y a cada uno le tocan otras. No se guarda
 * nada. Si tiene menos de 3 familias, le tocan las que tenga.
 */
G.Buffs = (() => {
  const N = 3;
  const BONUS = { hp: 1.15, atk: 1.15, spd: 1.10, coins: 1.25 };
  const TEXT = ['+15% vida, daño · +10% velocidad · +25% monedas', '+15% HP, damage · +10% speed · +25% coins'];

  /** Fecha de hoy en España: '2026-10-15'. */
  function today() {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }

  // Número pseudoaleatorio estable a partir de un texto.
  function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  let cache = { key: '', roots: [] };
  /** Raíces de las familias buffadas hoy para esta partida. */
  function roots(save) {
    save = save || G.DB.save;
    if (!save || !G.Family) return [];
    const owned = Object.keys(save.owned || {}).map(Number).filter(d => G.DEX_BY[d]);
    const key = today() + '|' + (save.created || save.name || '') + '|' + owned.length;
    if (cache.key === key) return cache.roots;
    const fams = [...new Set(owned.map(d => G.Family.rootOf(d)))].sort((a, b) => a - b);
    const r = rng(seedOf(today() + '|' + (save.created || save.name || '')));
    for (let i = fams.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [fams[i], fams[j]] = [fams[j], fams[i]]; }
    cache = { key, roots: fams.slice(0, N) };
    return cache.roots;
  }
  function isBuffed(dex, save) { return !!G.Family && roots(save).includes(G.Family.rootOf(dex)); }

  /** El Pokémon de la familia que se enseña: el compañero si es de ella; si no, el más evolucionado que tengas. */
  function face(root, save) {
    save = save || G.DB.save;
    const mem = G.Family.members(root).filter(d => save.owned[d]);
    return mem.includes(save.partner) ? save.partner : mem[mem.length - 1] || root;
  }

  /** Al empezar la partida (game.js). Devuelve true si se ha aplicado. */
  function apply(pl, dex) {
    if (!isBuffed(dex)) return false;
    pl.maxHp = Math.round(pl.maxHp * BONUS.hp); pl.hp = pl.maxHp;
    pl.atkMul *= BONUS.atk;
    pl.spdMul *= BONUS.spd;
    pl.buffedToday = true;
    return true;
  }
  const coinMul = pl => (pl && pl.buffedToday ? BONUS.coins : 1);

  if (G.I18n) G.I18n.add({
    'Buffados de hoy': 'Buffed today', [TEXT[0]]: TEXT[1], 'Buffado hoy': 'Buffed today',
    '¡Familia buffada hoy! {x}': 'Buffed family today! {x}', 'Cambian cada día': 'They change every day'
  });

  return { N, BONUS, TEXT: TEXT[0], today, roots, isBuffed, face, apply, coinMul };
})();
