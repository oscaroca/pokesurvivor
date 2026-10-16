/* ============ talents-ui.js — pantalla de talentos por región ============
 * Pestaña por región: insignias (hitos), árbol (Proyectiles, Área y el nodo
 * de la región) y, debajo, lo del Entrenador (cuenta). Ver systems/talents.js.
 */
G.TalentsUI = (() => {
  const $ = G.UI.$;
  const T = G.Talents;
  let region = null;

  function open() {
    const s = G.DB.save;
    if (!region) region = s.partner ? T.regionOf(s.partner) : 1;
    G.UI.show('scr-talents', true);
    render();
  }

  function nodeBtn(s, g, n) {
    const r = ((s.tal && s.tal[g]) || {})[n.id] || 0;
    const why = T.blocked(s, g, n.id);
    const full = r >= n.max;
    const pips = n.max > 1 ? '●'.repeat(r) + '○'.repeat(n.max - r) : full ? '●' : '○';
    const cls = full ? 'full' : why ? 'no' : 'can';
    return `<button class="tal-node ${cls}" data-n="${n.id}"><span class="pips">${pips}</span>
      <b>${T.nodeName(g, n.id)}</b> <span class="mv-note">· ${n.cost} ${n.cost === 1 ? 'insignia' : 'insignias'}</span><br>
      <span>${T.nodeDesc(g, n.id)}</span>${!full && why ? `<span class="why">${why}</span>` : ''}</button>`;
  }

  function render() {
    const s = G.DB.save, g = region;
    const name = T.REGIONS[g - 1];
    const partnerReg = s.partner ? T.regionOf(s.partner) : 0;
    $('tal-regions').innerHTML = T.REGIONS.map((r, i) => {
      const f = T.free(s, i + 1);
      return `<button class="${i + 1 === g ? 'on' : ''}" data-g="${i + 1}">${r}${f > 0 ? `<b>+${f}</b>` : ''}</button>`;
    }).join('');
    $('tal-regions').querySelectorAll('[data-g]').forEach(b => {
      b.onclick = () => { region = +b.dataset.g; G.Audio.sfx('select'); render(); };
    });

    const earned = T.earned(s, g), used = T.spent(s, g);
    const hs = T.hitos(s, g);
    const fmt = x => x.h.key === 'time' ? G.U.mmss(x.value) + ' / ' + G.U.mmss(x.goal) : x.h.key === 'dex' ? x.value + '% / ' + x.goal + '%' : x.value + ' / ' + x.goal;
    const br = id => `<div class="tal-br"><h4>${T.BRANCH_NAME[id]}</h4>${T.NODES.filter(n => n.br === id).map(n => nodeBtn(s, g, n)).join('')}</div>`;
    $('tal-body').innerHTML = `
      <div class="tal-head">
        <div class="tal-pts">${G.Icons.html('medal2', 18)} <b class="gold">${name}</b> · Insignias: <b>${earned - used}</b> libres de <b>${earned}</b> / ${hs.length}</div>
        <button id="tal-reset" class="btn small ghost" ${used ? '' : 'disabled'}>Reiniciar</button>
      </div>
      <div class="mv-note">Se aplica jugando con Pokémon de familias de ${name}${partnerReg === g ? ' (como tu compañero)' : ''}. La región de una familia es la de su primer miembro (Pichu cuenta como Kanto). Reiniciar es gratis.</div>
      <details class="tal-hitos"${earned ? '' : ' open'}><summary>Cómo conseguir insignias de ${name} (${earned}/${hs.length})</summary>
        ${hs.map(x => `<div class="tal-hito${x.done ? ' done' : ''}"><span>${x.h.text}</span><span>${fmt(x)}</span></div>`).join('')}
      </details>
      <div class="tal-tree">${br('proj')}${br('area')}<div class="tal-cap"><h4 class="gold" style="margin:4px 0;font-size:14px">${T.BRANCH_NAME.cap}</h4>${nodeBtn(s, g, T.NODE.cap)}</div></div>
      <h3 style="margin:14px 0 2px">Entrenador</h3>
      <div class="mv-note">Mejoras de la cuenta para todos los Pokémon: se desbloquean solas al cumplir la condición.</div>
      <div class="tal-acc">${T.ACCOUNT.map(a => {
        const on = T.accountOn(s, a.id), v = Math.min(a.val(s), a.goal);
        return `<div class="tal-node ${on ? 'full' : 'no'}"><span class="pips">${on ? '●' : '○'}</span><b>${a.name}</b><br><span>${a.desc}</span>
          ${on ? '' : `<span class="why">${a.text} · ${a.time ? G.U.mmss(v) + ' / ' + G.U.mmss(a.goal) : v + ' / ' + a.goal}</span>`}</div>`;
      }).join('')}</div>`;

    $('tal-body').querySelectorAll('.tal-node[data-n]').forEach(b => {
      b.onclick = () => {
        const why = T.blocked(s, g, b.dataset.n);
        if (why) { if (why !== 'Al máximo') G.UI.toast(why); return; }
        T.buy(s, g, b.dataset.n);
        G.DB.commit();
        G.Audio.sfx('buy');
        render();
      };
    });
    $('tal-reset').onclick = () => {
      T.reset(s, g);
      G.DB.commit();
      G.Audio.sfx('select');
      render();
    };
  }

  /** Insignias sin gastar en todas las regiones (para el aviso del menú). */
  function freeTotal() {
    const s = G.DB.save;
    if (!s) return 0;
    let n = 0;
    for (let g = 1; g <= 9; g++) n += Math.max(0, T.free(s, g));
    return n;
  }

  if (G.I18n) G.I18n.add({
    'insignia': 'badge', 'insignias': 'badges', 'Insignias: {x}': 'Badges: {x}', 'libres de': 'free of',
    'Cómo conseguir insignias de {x}': 'How to earn {x} badges',
    'Mejoras de la cuenta para todos los Pokémon: se desbloquean solas al cumplir la condición.': 'Account upgrades for every Pokémon: they unlock by themselves when you meet the condition.',
    'Reiniciar es gratis.': 'Resetting is free.', '(como tu compañero)': '(like your partner)',
    'La región de una familia es la de su primer miembro (Pichu cuenta como Kanto).': 'A family’s region is that of its first member (Pichu counts as Kanto).',
    'Se aplica jugando con Pokémon de familias de {x}': 'Applies when playing Pokémon from {x} families',
    'Árbol de cada región sin oro: insignias por hitos': 'A gold-free tree for each region: badges from milestones',
    'Insignias por región, sin oro': 'Badges per region, no gold', 'Insignias sin gastar: {x}': 'Unspent badges: {x}',
    // Ficha del Pokémon (ui/menu.js) y cartas de nivel (ui/run-ui.js)
    'Empieza con': 'Starts with', '(de siempre)': '(default)', 'Ataque único: {x}': 'Signature move: {x}',
    'Elegir el movimiento inicial: Talentos → Entrenador (evoluciona 10 movimientos).': 'Choosing the starting move: Talents → Trainer (evolve 10 moves).',
    'Evoluciona en partida alguno de sus movimientos para poder empezar con él.': 'Evolve one of its moves in a run to be able to start with it.',
    'Desbloqueado: sale en las cartas.': 'Unlocked: it shows up in the cards.',
    'Bloqueado: derrótalo en una grieta o completa la misión de familia de 15 minutos.': 'Locked: defeat it in a rift or complete the 15-minute family mission.',
    'Bloqueado: completa la misión de familia «Aguanta 15 minutos» y recoge el premio.': 'Locked: complete the family mission «Survive 15 minutes» and claim the reward.',
    'Movimientos': 'Moves', '· Favoritos {x}': '· Favourites {x}', 'Favorito': 'Favourite',
    'Toca hasta 4 favoritos: salen más a menudo en las cartas de nivel (con los 4 marcados, al menos uno en algo más de la mitad de las subidas).': 'Tap up to 4 favourites: they show up more often in the level-up cards (with all 4 starred, at least one in a bit over half of level-ups).',
    'Ya tienes 4 favoritos: quita uno primero': 'You already have 4 favourites: remove one first',
    'Saltar (+10% vida) ·': 'Skip (+10% HP) ·'
  });

  return { open, freeTotal };
})();
