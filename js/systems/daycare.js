/* ============ daycare.js — Guardería: huevos en tiempo real ============
 * Dejas dos Pokémon tuyos de la misma familia (o uno cualquiera con Ditto) y,
 * con el tiempo REAL (aunque no juegues), ponen huevos: uno cada EGG_TIME,
 * hasta MAX_EGGS esperando. Al recogerlos nace la primera forma de la familia:
 *   - si no la tenías, es tuya (con una naturaleza al azar);
 *   - si la tenías, desbloquea una naturaleza nueva o, si ya las tiene todas
 *     las que salgan, da monedas;
 *   - SHINY_RATE de que salga shiny (el doble si tienes el shiny de un padre);
 *   - EGG_MOVE_RATE de enseñar a la familia un MOVIMIENTO HUEVO: un movimiento
 *     de otro tipo que desde entonces le sale en las cartas (hasta MAX_EGG_MOVES).
 *
 * Guardado: save.daycare = { a, b, since } (dex de los padres y desde cuándo
 * cuentan los huevos) · save.eggMoves[raíz] = [ids].
 * El reloj es el del dispositivo: un cambio de hora raro (más de un día en el
 * futuro) reinicia la cuenta.
 */
G.Daycare = (() => {
  const EGG_TIME = 2 * 3600 * 1000, MAX_EGGS = 3;
  const SHINY_RATE = 1 / 64, EGG_MOVE_RATE = 0.35, MAX_EGG_MOVES = 4;
  const DITTO = 132;

  const root = d => G.Family.rootOf(d);
  /** Dos Pokémon distintos de la misma familia, o uno cualquiera con Ditto. */
  function canPair(a, b) {
    if (!a || !b || a === b) return false;
    return a === DITTO || b === DITTO || root(a) === root(b);
  }
  /** Qué familia sale: la del que no es Ditto. */
  function babyOf(dc) {
    const p = dc.a === DITTO ? dc.b : dc.a;
    const r = root(p);
    return G.DEX_BY[r] ? r : p;
  }

  function state(save) {
    const dc = save && save.daycare;
    if (!dc || !dc.a || !dc.b) return { ready: 0, next: 0, pair: false };
    const now = Date.now();
    if (!(dc.since > 0) || dc.since > now + 86400000) dc.since = now;
    const el = Math.max(0, now - dc.since);
    const ready = Math.min(MAX_EGGS, Math.floor(el / EGG_TIME));
    return { ready, next: ready >= MAX_EGGS ? 0 : EGG_TIME - (el % EGG_TIME), pair: true, baby: babyOf(dc) };
  }

  /** Pone (o quita, con null) un padre en el hueco 'a' o 'b'. Reinicia la cuenta. */
  function setParent(save, slot, dex) {
    save.daycare = save.daycare || { a: null, b: null, since: 0 };
    save.daycare[slot] = dex ? +dex : null;
    save.daycare.since = Date.now();
  }

  /** Movimientos huevo de la familia de `dex` (los añade G.Moves.poolFor). */
  function eggMovesOf(save, dex) { return (save && save.eggMoves && save.eggMoves[root(dex)]) || []; }

  function eggMoveFor(save, baby) {
    const mon = G.DEX_BY[baby];
    const own = new Set(G.Moves.poolFor(mon, save));
    const pool = G.Moves.ALL.filter(m => !m.sig && !m.manual && m.kind !== 'buff' && m.type !== 'normal'
      && !mon.types.includes(m.type) && !own.has(m.id)).map(m => m.id);
    return pool.length ? G.U.pick(pool) : null;
  }

  /** Recoge los huevos listos. Devuelve lo que ha nacido: [{ dex, shiny, isNew, nature, newNature, coins, move }]. */
  function collect(save) {
    const st = state(save);
    if (!st.ready) return [];
    const dc = save.daycare;
    // El tiempo que sobra cuenta para el siguiente; si estaba lleno, empieza de cero.
    dc.since = st.ready >= MAX_EGGS ? Date.now() : dc.since + st.ready * EGG_TIME;
    const out = [];
    const shinyK = (G.DB.ownsShiny(dc.a) || G.DB.ownsShiny(dc.b)) ? 2 : 1;
    for (let i = 0; i < st.ready; i++) {
      const baby = st.baby;
      const nature = G.U.pick(G.Natures.ALL).id;
      const shiny = Math.random() < SHINY_RATE * shinyK && G.Sprites.hasShiny(baby);
      const r = { dex: baby, shiny, nature, isNew: !save.owned[baby], newNature: false, coins: 0, move: null };
      if (shiny) {
        const fresh = G.DB.grantShiny(baby, 'egg', nature);
        if (!fresh && !r.isNew) r.coins += 90;
        if (fresh) save.stats.shinies = (save.stats.shinies || 0) + 1;
      } else if (r.isNew) G.DB.grant(baby, 'egg', nature);
      if (!r.isNew) {
        r.newNature = G.Natures.unlock(save, baby, nature);
        if (!r.newNature && !shiny) r.coins += 30;
      }
      const em = save.eggMoves = save.eggMoves || {};
      const list = em[root(baby)] = em[root(baby)] || [];
      if (list.length < MAX_EGG_MOVES && Math.random() < EGG_MOVE_RATE) {
        const id = eggMoveFor(save, baby);
        if (id) { list.push(id); r.move = id; }
      }
      if (r.coins) save.coins += r.coins;
      out.push(r);
    }
    return out;
  }

  function sanitize(s) {
    const dc = s.daycare;
    if (dc && typeof dc === 'object') {
      for (const k of ['a', 'b']) if (dc[k] != null && (!G.DEX_BY[dc[k]] || !s.owned[dc[k]])) dc[k] = null;
      dc.since = Number.isFinite(+dc.since) && +dc.since > 0 ? Math.floor(+dc.since) : 0;
    } else delete s.daycare;
    if (s.eggMoves && typeof s.eggMoves === 'object') {
      for (const r of Object.keys(s.eggMoves)) {
        const l = Array.isArray(s.eggMoves[r]) ? s.eggMoves[r] : [];
        s.eggMoves[r] = [...new Set(l.filter(id => typeof id === 'string' && G.Moves && G.Moves.BY_ID[id]))].slice(0, MAX_EGG_MOVES);
        if (!s.eggMoves[r].length || !G.DEX_BY[r]) delete s.eggMoves[r];
      }
    } else delete s.eggMoves;
  }
  /** Fusión: los movimientos huevo se juntan; la guardería, la de la copia más nueva. */
  function merge(r, older) {
    r.eggMoves = r.eggMoves || {};
    for (const k in older.eggMoves || {}) r.eggMoves[k] = [...new Set([...(r.eggMoves[k] || []), ...older.eggMoves[k]])].slice(0, MAX_EGG_MOVES);
  }

  return { EGG_TIME, MAX_EGGS, SHINY_RATE, EGG_MOVE_RATE, MAX_EGG_MOVES, DITTO,
           canPair, state, setParent, collect, eggMovesOf, sanitize, merge };
})();

/* ---------------- pantalla ---------------- */
G.DaycareUI = (() => {
  const $ = id => document.getElementById(id);
  let timer = null;

  function open() {
    G.UI.show('scr-daycare', true);
    render();
    clearInterval(timer);
    timer = setInterval(() => { if (G.UI.isOpen('scr-daycare')) tickTime(); else clearInterval(timer); }, 1000);
  }

  const hms = ms => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h + ' h ' + String(m).padStart(2, '0') + ' min'; };

  function tickTime() {
    const st = G.Daycare.state(G.DB.save);
    const el = $('dc-next');
    if (el) el.textContent = st.ready >= G.Daycare.MAX_EGGS ? 'La guardería está llena: recoge los huevos' : 'Siguiente huevo en ' + hms(st.next);
    if (st.ready !== +($('dc-body').dataset.ready || 0)) render();
  }

  function options(sel, other) {
    const s = G.DB.save;
    const own = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => G.DEX_BY[a].name.localeCompare(G.DEX_BY[b].name, 'es'));
    const ok = other ? own.filter(d => G.Daycare.canPair(d, other)) : own;
    return `<option value="">— Elige —</option>` + ok.map(d => `<option value="${d}" ${d === sel ? 'selected' : ''}>${G.DEX_BY[d].name}</option>`).join('');
  }

  function render() {
    const s = G.DB.save, D = G.Daycare;
    const dc = s.daycare || { a: null, b: null };
    const st = D.state(s);
    const box = $('dc-body');
    box.dataset.ready = st.ready;
    const pairOk = st.pair && D.canPair(dc.a, dc.b);
    const baby = pairOk ? G.DEX_BY[st.baby] : null;
    const em = baby ? D.eggMovesOf(s, baby.dex) : [];
    box.innerHTML = `
      <p class="sub">Deja dos Pokémon de la misma familia, o uno cualquiera con Ditto. Ponen un huevo cada 2 horas reales, aunque no juegues (hasta 3 esperando).</p>
      <p class="sub">Del huevo nace la primera forma de la familia: naturalezas nuevas, shinies (1 de cada 64; 1 de cada 32 si tienes el shiny de un padre) y movimientos huevo, que la familia podrá aprender en las cartas.</p>
      <div class="dc-pair">
        <div class="dc-slot"><canvas id="dc-a" width="110" height="96"></canvas><select class="field" id="dc-sel-a">${options(dc.a, dc.b)}</select></div>
        <div class="dc-heart">${G.Icons.html('heart', 26)}</div>
        <div class="dc-slot"><canvas id="dc-b" width="110" height="96"></canvas><select class="field" id="dc-sel-b">${options(dc.b, dc.a)}</select></div>
      </div>
      ${!st.pair ? '<p class="center mv-note">Elige los dos padres para empezar.</p>'
        : !pairOk ? '<p class="center" style="color:#ff9a9a">Tienen que ser de la misma familia (o uno, Ditto).</p>'
        : `<div class="dc-eggs">${Array.from({ length: D.MAX_EGGS }, (_, i) => `<span class="dc-egg${i < st.ready ? ' on' : ''}"></span>`).join('')}</div>
           <p class="center gold" id="dc-next"></p>
           <p class="center mv-note">Nacerá: <b>${baby.name}</b>${em.length ? ` · movimientos huevo de la familia: ${em.map(id => G.Moves.BY_ID[id].name).join(', ')}` : ''}</p>
           <div class="center"><button id="dc-collect" class="btn gold" ${st.ready ? '' : 'disabled'}>Recoger ${st.ready || ''} ${st.ready === 1 ? 'huevo' : 'huevos'}</button></div>`}
      <div id="dc-result" class="dc-result"></div>`;
    for (const k of ['a', 'b']) {
      const cv = $('dc-' + k);
      if (dc[k]) G.UI.sprite(cv, dc[k], { lively: true, scale: 2, shiny: false });
      $('dc-sel-' + k).onchange = e => {
        const v = e.target.value ? +e.target.value : null;
        if (!G.Daycare.state(s).ready || confirm('Al cambiar de padres se pierden los huevos que estén esperando. ¿Seguir?')) {
          G.Daycare.setParent(s, k, v);
          G.DB.commit();
          G.Audio.sfx('select');
        }
        render();
      };
    }
    const c = $('dc-collect');
    if (c) c.onclick = () => {
      const got = D.collect(s);
      if (!got.length) return;
      G.DB.commit();
      G.Audio.sfx(got.some(g => g.shiny) ? 'shiny' : 'legend');
      render();
      showResult(got);
      if (G.UI.refreshCoins) G.UI.refreshCoins();
    };
    tickTime();
  }

  function showResult(got) {
    const box = $('dc-result');
    box.innerHTML = '';
    for (const g of got) {
      const w = document.createElement('div');
      w.className = 'dc-born' + (g.shiny ? ' shiny' : '');
      w.appendChild(G.UI.spriteCanvas(g.dex, 90, 72, { shiny: g.shiny, lively: true, scale: 2 }));
      const bits = [];
      if (g.isNew) bits.push('¡Nuevo!');
      if (g.shiny) bits.push('¡Shiny!');
      bits.push('Naturaleza ' + G.Natures.BY[g.nature].name + (g.newNature ? ' (nueva)' : ''));
      if (g.move) bits.push('Movimiento huevo: ' + G.Moves.BY_ID[g.move].name);
      if (g.coins) bits.push('+' + g.coins + ' monedas');
      w.insertAdjacentHTML('beforeend', `<b>${G.DEX_BY[g.dex].name}</b><small>${bits.join(' · ')}</small>`);
      box.appendChild(w);
    }
  }

  /** Huevos listos (aviso del menú). */
  function ready() { const s = G.DB.save; return s ? G.Daycare.state(s).ready : 0; }

  function init() {}

  if (G.I18n) G.I18n.add({
    'Guardería': 'Day Care', '— Elige —': '— Choose —', 'Recoger': 'Collect', 'huevo': 'egg', 'huevos': 'eggs',
    'Elige los dos padres para empezar.': 'Choose both parents to start.',
    'Tienen que ser de la misma familia (o uno, Ditto).': 'They must be from the same family (or one of them a Ditto).',
    'La guardería está llena: recoge los huevos': 'The Day Care is full: collect your eggs',
    'Siguiente huevo en {x}': 'Next egg in {x}', 'Nacerá:': 'Will hatch:', '¡Nuevo!': 'New!', '¡Shiny!': 'Shiny!',
    'Naturaleza {x}': 'Nature {x}', '(nueva)': '(new)', 'Movimiento huevo: {x}': 'Egg move: {x}', '+{x} monedas': '+{x} coins',
    'Al cambiar de padres se pierden los huevos que estén esperando. ¿Seguir?': 'Changing parents loses the eggs that are waiting. Continue?',
    'movimientos huevo de la familia: {x}': 'family egg moves: {x}', 'Mov. huevo': 'Egg move',
    'Huevos listos: {x}': 'Eggs ready: {x}',
    'Deja dos Pokémon de la misma familia, o uno cualquiera con Ditto. Ponen un huevo cada 2 horas reales, aunque no juegues (hasta 3 esperando).': 'Leave two Pokémon from the same family, or any one with a Ditto. They lay an egg every 2 real hours, even when you are not playing (up to 3 waiting).',
    'Del huevo nace la primera forma de la familia: naturalezas nuevas, shinies (1 de cada 64; 1 de cada 32 si tienes el shiny de un padre) y movimientos huevo, que la familia podrá aprender en las cartas.': 'The first form of the family hatches from the egg: new natures, shinies (1 in 64; 1 in 32 if you own a parent’s shiny) and egg moves, which the family can then learn from the cards.', 'Huevos, shinies y naturalezas': 'Eggs, shinies and natures'
  });

  return { open, ready, init };
})();
