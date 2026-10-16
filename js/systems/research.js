/* ============ research.js — investigación de especies (cadenas shiny) ============
 * Cada especie que derrotas suma a su investigación (como el bestiario de
 * Vampire Survivors y la Pokédex de Leyendas: Arceus). Al subir de nivel:
 *   - sale shiny más a menudo (SHINY[nivel], en systems/spawner.js);
 *   - hay un premio que se recoge en la ficha de ese Pokémon (aunque no lo tengas).
 *
 * Guardado: save.research[dex] = derrotados · save.researchC[dex] = último nivel recogido.
 * Cuenta también lo que derrotan tus compañeros en cooperativo (las copias).
 */
G.Research = (() => {
  const GOALS = [50, 200, 500, 1000];               // derrotados para los niveles 1-4
  const SHINY = [1, 1.5, 2, 3, 4];                  // probabilidad de shiny ×, por nivel
  const REWARD = [null, { t1: 1 }, { t1: 2 }, { t1: 3 }, { t10: 1 }];

  function kills(save, dex) { return (save && save.research && save.research[dex]) || 0; }
  function level(save, dex) { const k = kills(save, dex); let l = 0; while (l < GOALS.length && k >= GOALS[l]) l++; return l; }
  function shinyMul(dex) { return SHINY[level(G.DB.save, dex)]; }

  /** Un enemigo derrotado (Progress.kill). Avisa al subir de nivel. */
  function add(dex) {
    const s = G.DB.save;
    if (!s || !G.DEX_BY[dex]) return;
    s.research = s.research || {};
    const before = level(s, dex);
    s.research[dex] = (s.research[dex] || 0) + 1;
    const now = level(s, dex);
    if (now > before) {
      G.Spawner.say('Investigación de ' + G.DEX_BY[dex].name + ': nivel ' + now + ' · shiny ×' + SHINY[now], 3.2, true);
      G.Audio.sfx('coin');
    }
  }

  /** Premios de niveles alcanzados sin recoger. */
  function pendingLevels(save, dex) {
    const got = (save.researchC && save.researchC[dex]) || 0;
    return Math.max(0, level(save, dex) - got);
  }
  function claim(save, dex) {
    const got = (save.researchC && save.researchC[dex]) || 0, lv = level(save, dex);
    if (lv <= got) return null;
    save.researchC = save.researchC || {};
    const out = { t1: 0, t10: 0 };
    for (let l = got + 1; l <= lv; l++) { out.t1 += REWARD[l].t1 || 0; out.t10 += REWARD[l].t10 || 0; }
    save.researchC[dex] = lv;
    G.Progress.grant(out);
    return out;
  }
  /** Cuántas especies tienen premio por recoger (aviso en el menú). */
  function pendingTotal(save) {
    let n = 0;
    for (const d in (save && save.research) || {}) if (pendingLevels(save, d) > 0) n++;
    return n;
  }

  function sanitize(s) {
    for (const coll of ['research', 'researchC']) {
      if (!s[coll] || typeof s[coll] !== 'object') { delete s[coll]; continue; }
      for (const d of Object.keys(s[coll])) {
        const v = Math.floor(+s[coll][d] || 0);
        if (!G.DEX_BY[d] || v <= 0) delete s[coll][d];
        else s[coll][d] = coll === 'researchC' ? Math.min(GOALS.length, v) : Math.min(1e7, v);
      }
    }
  }
  /** Fusión de dos copias de la partida: lo mayor. */
  function merge(r, older) {
    for (const coll of ['research', 'researchC']) {
      r[coll] = r[coll] || {};
      for (const d in older[coll] || {}) r[coll][d] = Math.max(r[coll][d] || 0, older[coll][d] || 0);
    }
  }

  if (G.I18n) G.I18n.add({
    'Investigación de {x}: nivel {x} · shiny ×{x}': '{x} research: level {x} · shiny ×{x}',
    'Investigación': 'Research', 'Nivel de investigación': 'Research level'
  });

  return { GOALS, SHINY, REWARD, kills, level, shinyMul, add, pendingLevels, claim, pendingTotal, sanitize, merge };
})();
