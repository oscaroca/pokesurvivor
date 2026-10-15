/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null;

  function init() {
    const ICON = { play: 'ball', curses: 'bomb', dex: 'book', upgrades: 'up', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'curses') G.CursesUI.open();
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- menú principal ----------------

  function open() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity) +
      `<div style="font-size:13px;color:var(--muted);margin-top:2px">${G.Natures.BY[G.Natures.chosen(s, mon.dex)].name}</div>`;
    // Normal / shiny a mano, aquí mismo (en el móvil no se encontraba en la ficha).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');

    socialLine();
    // Premios de misiones por recoger.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // Con cuenta en la nube: amigos en línea, invitaciones y (una vez) el apodo.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
      });
    }
    G.InvitePop.refresh();
  }

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  /** Menú lateral: las maldiciones elegidas, o que en grupo no cuentan. */
  function curseLine() {
    const sub = $('menu-curse-sub');
    if (!sub) return;
    const p = G.Curses.points(G.Curses.chosen(G.DB.save));
    sub.textContent = G.Social.room ? (p ? p + ' puntos · desactivadas en grupo' : 'En grupo no se aplican')
      : p ? p + ' puntos · +' + Math.round((G.Curses.coinMul(p) - 1) * 100) + '% monedas' : 'Más difícil, más premio';
    sub.parentElement.classList.toggle('cursed', !!p && !G.Social.room);
  }

  function socialLine() {
    curseLine();
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- colección ----------------

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;

    // Pestañas de generación, con cuántos tienes de cada una.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    const F = [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan'], ['shiny', 'Shiny'],
               ['5', 5], ['4', 4], ['3', 3], ['2', 2], ['1', 1]];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny'
                  : typeof label === 'number' ? G.Icons.rarity(label, 12) + ' ' + G.Gacha.RARITY_NAME[label] : label;
      c.onclick = () => { dexFilter = k; openDex(); };
      fb.appendChild(c);
    }
    renderGrid();
    showDetail(dexSel);
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    for (const p of G.DEX) {
      if (p.gen !== dexGen) continue;
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      if (/^\d$/.test(dexFilter) && p.rarity !== +dexFilter) continue;

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
  }

  // Variante que se está viendo en la ficha (normal o shiny) y forma (null o la clave de una mega).
  let viewShiny = false;
  let viewForm = null;

  /** Etiqueta corta de una mega para su botón: 'Mega', 'Mega X', 'Primigenio'. */
  const formLabel = f => f.item === 'red-orb' || f.item === 'blue-orb' ? 'Primigenio'
    : 'Mega' + (f.key.includes('-mega-') ? ' ' + f.key.split('-mega-')[1].toUpperCase() : '');
  const MEGA_HOW = { 'stone': 'la Megapiedra', 'red-orb': 'el Orbe Rojo', 'blue-orb': 'el Orbe Azul', 'dragon-ascent': 'Ascenso Draco' };

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    if (dex !== showDetail.last) viewForm = null;
    showDetail.last = dex;

    // Megas: vista previa (se consiguen en partida, ver systems/levelup.js).
    const forms = own ? (G.MEGA && G.MEGA[dex]) || [] : [];
    const form = forms.find(f => f.key === viewForm) || null;
    if (!form) viewForm = null;
    // Lo que se enseña: la especie o la mega (stats, tipos, habilidad).
    const v = form ? Object.assign({}, p, { name: form.name, types: form.types, hp: form.hp, atk: form.atk, spa: form.spa, spd: form.spd }) : p;
    // Evoluciones: a qué y a qué nivel (data/evolutions.js); los que no tienes, ocultos.
    const evos = (G.EVO && G.EVO[dex] || []).filter(e => G.DEX_BY[e.to]);
    const evoName = d => s.owned[d] ? G.DEX_BY[d].name : '???';
    const known = evos.filter(e => s.owned[e.to]).map(e => `<b class="gold">${G.DEX_BY[e.to].name}</b>`);
    const evoLine = !evos.length ? ''
      : evos.length > 3 && new Set(evos.map(e => e.lvl)).size === 1
        ? `Evoluciona al nivel <b class="gold">${evos[0].lvl}</b> en una de sus ${evos.length} evoluciones` + (known.length ? ` (tienes ${known.join(', ')})` : '')
      : new Set(evos.map(e => e.lvl)).size === 1
        ? `Evoluciona a ${evos.map(e => `<b class="gold">${evoName(e.to)}</b>`).join(', ')} al nivel <b class="gold">${evos[0].lvl}</b>`
        : 'Evoluciona a ' + evos.map(e => `<b class="gold">${evoName(e.to)}</b> (nv. ${e.lvl})`).join(', ');

    const max = { hp: 183, atk: 1.55, spd: 137 };
    // Stats con la naturaleza elegida: verde lo que sube, rojo lo que baja.
    const nat = own ? G.Natures.chosen(s, dex) : 'fuerte';
    const nm = G.Natures.mul(nat);
    const natC = k => nm[k] > 1 ? ' style="color:#5fe08a"' : nm[k] < 1 ? ' style="color:#ff7b7b"' : '';
    const bar = (label, v, m, txt, k) =>
      `<div class="stat"><span${natC(k)}>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span${natC(k)}>${txt}</span></div>`;
    const natHave = new Set(G.Natures.owned(s, dex));
    const ab = (form && form.ab && G.Abilities.byId(form.ab)) || G.Abilities.of(dex);
    // Misiones de la familia (systems/family.js): progreso, premio y recoger.
    const famVal = (m, v) => m.stat === 'time' ? G.U.mmss(v) + ' / ' + G.U.mmss(m.goal) : m.stat === 'final' ? (v ? '1 / 1' : '0 / 1') : v + ' / ' + m.goal;
    const famBox = own ? `<div class="fam-box"><p style="font-size:14px;margin:10px 0 2px"><b class="gold">Misiones de la familia</b></p>
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Avanzan jugando con cualquier Pokémon de su familia.</div>
        ${G.Family.status(s, dex).map(st => `<div class="fam-row${st.claimed ? ' claimed' : ''}">
          <div class="fam-txt">${st.def.text}<div class="bar"><i style="width:${Math.min(100, st.value / st.def.goal * 100)}%"></i></div>
            <span class="fam-num">${famVal(st.def, st.value)} · ${G.Progress.rewardText(st.def.reward)}</span></div>
          ${st.claimed ? `<span class="fam-ok">✓</span>` : st.done ? `<button class="btn gold fam-claim" data-fam="${st.def.id}">Recoger</button>` : ''}
        </div>`).join('')}</div>` : '';
    const natGrid = G.Natures.ALL.map(n => natHave.has(n.id)
      ? `<button class="${n.id === nat ? 'on' : ''}" data-nat="${n.id}" title="${G.Natures.effect(n.id)}">${n.name}</button>`
      : `<button disabled title="Sácala con un repetido en el gacha">?</button>`).join('');
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      ${forms.length ? `<div class="seg mega-seg">
          <button class="${form ? '' : 'on'}" data-form="">Base</button>
          ${forms.map(f => `<button class="${f === form ? 'on' : ''}" data-form="${f.key}">${formLabel(f)}</button>`).join('')}</div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? v.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(v.types) : ''}</div>
        ${evoLine ? `<div style="font-size:13px;margin:2px 0 6px">${evoLine}</div>` : ''}
        ${form ? `<div style="font-size:13px;color:var(--muted);margin:2px 0 6px">Vista previa: en partida, a partir del nivel 10 y en su forma final, puede salirte ${MEGA_HOW[form.item]} en las cartas de nivel (muy rara).</div>`
          : forms.length && !evos.length ? `<div style="font-size:13px;color:var(--muted);margin:2px 0 6px">Puede megaevolucionar en partida: pulsa el botón de arriba para verla.</div>` : ''}
      </div>
      ${own ? `
        ${bar('Vida', v.hp * nm.hp, max.hp, Math.round(v.hp * nm.hp), 'hp')}
        ${bar('Ataque', v.atk * nm.atk, max.atk, '×' + (v.atk * nm.atk).toFixed(2), 'atk')}
        ${bar('At. Esp.', v.spa * nm.atk, max.atk, '×' + (v.spa * nm.atk).toFixed(2), 'atk')}
        ${bar('Velocidad', v.spd * nm.spd, max.spd, Math.round(v.spd * nm.spd), 'spd')}
        <p style="font-size:14px;margin:10px 0 4px">Naturaleza <b class="gold">${G.Natures.BY[nat].name}</b>
          <span style="color:var(--muted)">· ${G.Natures.effect(nat)} · ${natHave.size}/${G.Natures.ALL.length}</span></p>
        <div class="nat-grid">${natGrid}</div>
        ${ab ? `<p style="font-size:14px;margin:6px 0 4px">Habilidad <b class="gold">${ab.name}</b><br>
          <span style="color:${ab.fam ? 'var(--text, #dfe8ff)' : 'var(--muted)'};font-size:13px">${ab.desc}</span></p>` : ''}
        ${famBox}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b>
          ${G.Moves.favors(p) ? `<span style="color:var(--muted)">· Pega más con movimientos ${G.Moves.favors(p) === 'physical' ? 'físicos' : 'especiales'}</span>` : ''}</p>
        <p class="move-icons" title="Movimientos que puede aprender">
          ${G.Moves.poolFor(p).map(id => { const d = G.Moves.BY_ID[id]; return `<span title="${d.name}${d.cat ? ' · ' + G.Moves.CAT_NAME[d.cat] : ''}">${G.Icons.html('move:' + id, 16)}</span>`; }).join('')}</p>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    $('dex-big').classList.toggle('mega', !!form);
    G.UI.sprite($('dex-big'), form && form.spr ? form.key : dex,
      { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny, mega: !!form, megaTint: !!form && !form.spr });
    box.querySelectorAll('.seg button[data-v]').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    box.querySelectorAll('.fam-claim').forEach(b => {
      b.onclick = () => {
        if (!G.Family.claim(s, dex, b.dataset.fam)) return;
        G.DB.commit();
        G.Audio.sfx('buy');
        G.UI.toast('¡Premio recogido!');
        showDetail(dex);
      };
    });
    box.querySelectorAll('.mega-seg button').forEach(b => {
      b.onclick = () => { viewForm = b.dataset.form || null; G.Audio.sfx('select'); showDetail(dex); };
    });
    box.querySelectorAll('.nat-grid button[data-nat]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.nat === nat || !G.Natures.choose(s, dex, b.dataset.nat)) return;
        G.DB.commit();
        G.Audio.sfx('select');
        showDetail(dex);
      };
    });
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
  }

  // ---------------- mejoras ----------------

  let upgDex = null;

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    if (!upgDex || !s.owned[upgDex]) upgDex = s.partner;
    // Selector con tus Pokémon: el compañero primero, luego los que ya tienen mejoras.
    const sel = $('upg-mon');
    const lv = d => Object.values(s.pupg[d] || {}).reduce((a, b) => a + b, 0);
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || lv(b) - lv(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (compañero)' : ''}${lv(d) ? ' · ' + lv(d) + ' niveles' : ''}</option>`).join('');
    sel.value = upgDex;
    sel.onchange = () => { upgDex = +sel.value; G.Audio.sfx('select'); renderUpgrades(); };
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const levels = G.DB.upgradesOf(upgDex);
    const mon = G.DEX_BY[upgDex];
    const shiny = upgDex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(upgDex);
    G.UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
    $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of G.Upgrades.LIST) {
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : G.Upgrades.cost(u.id, lvl);
      const el = document.createElement('div');
      el.className = 'panel upg-item';
      el.innerHTML = `
        <div class="ic">${G.Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Elegir (${banList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      el.querySelector('[data-buy]').onclick = () => {
        // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
        const sv = G.DB.save, lv = G.DB.upgradesOf(upgDex), now = lv[u.id] || 0;
        if (now >= u.max) { renderUpgrades(); return; }
        const price = G.Upgrades.cost(u.id, now);
        if (sv.coins < price) { renderUpgrades(); return; }
        sv.coins -= price;
        lv[u.id] = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${mon.name} · ${u.name}: nivel ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
    }
    box.appendChild(bindPanel());
  }

  // ---------------- atajos: hueco fijo para cada movimiento ----------------
  // save.pbind[dex] = [movimiento del hueco 1, del 2, del 3, del 4] (o null).
  function bindPanel() {
    const s = G.DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = G.DEX_BY[upgDex];
    const ids = G.Moves.poolFor(mon).concat([G.startMoveOf(upgDex)]).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Atajos de movimientos</b>
      <p class="sub" style="margin:2px 0 8px">Elige qué movimiento va siempre en cada hueco (teclas 1-4 o los iconos de abajo), para la memoria muscular. Si aún no tienes tantos movimientos, va al hueco más cercano.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Libre</option>${ids.map(id =>
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name}</option>`).join('')}</select></label>`).join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot, id = sel.value || null;
        // Un movimiento sólo puede estar en un hueco.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: movimientos bloqueados ----------------
  // Lista por Pokémon en save.pban[dex]; con N niveles de Veto, N movimientos.
  let banOpen = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('Ya tienes ' + max + ' vetados: quita uno primero'); return; }
        else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, GEN_NAMES };
})();
