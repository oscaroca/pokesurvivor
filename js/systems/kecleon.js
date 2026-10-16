/* ============ kecleon.js — la tienda de Kecleon en plena partida ============
 * Como el mercader de Vampire Survivors: desde el minuto 3, cada ~5 minutos,
 * Kecleon abre su tienda cerca de ti durante 60 s (camuflado: se ve poco hasta
 * que te acercas). Ponte a su lado y se abre la tienda, que para la partida
 * (en grupo, para todos, como al elegir objeto).
 *
 * Se paga con las monedas de ESTA partida (las que te llevas al acabar), así
 * que comprar es renunciar a parte del premio. Los precios suben con el tiempo.
 * En grupo las monedas son del equipo: la compra se descuenta en el anfitrión.
 * Cada Kecleon es de cada jugador (como los altares).
 */
G.Kecleon = (() => {
  const DEX = 352, FIRST = 180, EVERY = 300, STAY = 60, NEAR = 46;
  // solo: sólo en solitario (en grupo el nivel, los tickets y el Amuleto los lleva el anfitrión).
  const GOODS = [
    { id: 'up',     icon: 'up',         base: 40,  name: 'Clase particular', desc: 'Tu movimiento activo sube un nivel.' },
    { id: 'potion', icon: 'potion',     base: 30,  name: 'Hiperpoción',      desc: 'Te cura toda la vida.' },
    { id: 'reroll', icon: 'cards',      base: 45,  name: 'Barajar',          desc: '+1 cambio de cartas de nivel en esta partida.' },
    { id: 'item',   icon: 'star',       base: 90,  name: 'Objeto sorpresa',  desc: 'Un objeto equipable al azar (puedes quedarte con el tuyo).' },
    { id: 'candy',  icon: 'candy',      base: 60,  name: 'Caramelo Raro',    desc: 'Subes un nivel.', solo: true },
    { id: 'amulet', icon: 'amuletcoin', base: 35,  name: 'Moneda Amuleto',   desc: 'Las monedas valen doble durante 30 s.', solo: true },
    { id: 'ticket', icon: 'ticket',     base: 120, name: 'Ticket del gacha', desc: 'Un ticket ×1 para el gacha.', solo: true }
  ];
  let k = null, nextAt = FIRST, anim = null, near = 0;

  function reset() { k = null; nextAt = FIRST + G.U.rand(-20, 40); near = 0; }
  const price = (g, t) => Math.round(g.base * (1 + t / 900) / 5) * 5;

  function update(dt, pl, t) {
    if (!pl || pl.remote) return;
    if (k) {
      k.t += dt;
      if (anim) anim.update(dt);
      if (k.t >= STAY) { G.FX.burst(k.x, k.y - 12, '#7fe08a', 14, 120); k = null; G.Spawner.say('Kecleon ha cerrado la tienda', 2, true); return; }
      const d2 = G.U.dist2(pl.x, pl.y, k.x, k.y);
      if (!pl.dead && d2 < (NEAR + pl.r) ** 2 && !k.shopped) {
        near += dt;
        if (near > 0.5) open(pl, t);
      } else near = 0;
      return;
    }
    if (t < nextAt || G.Rift.inArena || G.Judgment.active || pl.dead) return;
    nextAt = t + EVERY + G.U.rand(-60, 60);
    // Un sitio libre a 220-340 de ti.
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * 6.2832, r = G.U.rand(220, 340);
      const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      if (!G.World.isFree(x, y, 16, false)) continue;
      k = { x, y, t: 0, shopped: false };
      anim = new G.Sprites.Animator(DEX, 1, false);
      G.Sprites.preload([DEX], 4000, false);
      G.Spawner.say('¡Kecleon ha abierto su tienda cerca! (60 s)', 3.2, true);
      G.Audio.sfx('coin');
      return;
    }
  }

  // ---------------- tienda ----------------
  let offers = [], bought = new Set(), t0 = 0;

  function open(pl, t) {
    if (!G.Game.pauseChoice()) return;
    k.shopped = true;
    t0 = t;
    const coop = G.Coop.active;
    const pool = GOODS.filter(g => !(coop && g.solo) && !(g.id === 'potion' && G.Curses.on('noheal')));
    offers = [pool[0]].concat(G.U.pickN(pool.slice(1), 3));
    bought = new Set();
    render();
    G.UI.show('scr-shop');
    G.Audio.sfx('confirm');
  }

  function render() {
    const pl = G.Game.player;
    const $ = G.UI.$;
    $('shop-coins').innerHTML = `<span class="coin"></span> ${pl.coins}`;
    const box = $('shop-cards');
    box.innerHTML = '';
    offers.forEach((g, i) => {
      const p = price(g, t0), got = bought.has(g.id);
      const cant = got || pl.coins < p || (g.id === 'up' && !canUp(pl));
      const el = document.createElement('div');
      el.className = 'card' + (cant ? ' off' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(g.icon, 32)}</div>
        <div class="txt"><div class="nm">${g.name} <span class="tag-chip" style="background:#ffd23f;color:#20160a">${got ? 'Comprado' : p + ' monedas'}</span></div>
        <div class="ds">${g.desc}</div></div><div class="key">${i + 1}</div>`;
      el.onclick = () => buy(i);
      box.appendChild(el);
    });
  }
  function canUp(pl) { const m = pl.activeMove && pl.activeMove(); return !!m && m.lvl < m.def.maxLvl; }

  function buy(i) {
    const pl = G.Game.player, g = offers[i];
    if (!g || bought.has(g.id)) return;
    const p = price(g, t0);
    if (pl.coins < p) { G.UI.toast('No te llegan las monedas'); return; }
    if (g.id === 'up' && !canUp(pl)) { G.UI.toast('Tu movimiento activo ya está al máximo'); return; }
    pl.coins -= p;
    if (G.Coop.active && !G.Coop.isHost) G.Coop.toHost(['buy', p]);
    bought.add(g.id);
    G.Audio.sfx('buy');
    if (g.id === 'up') { const m = pl.activeMove(); G.Moves.levelUp(m); G.Spawner.say(m.name + ' sube a Nv.' + m.lvl, 2.2, true); }
    else if (g.id === 'potion') pl.heal(pl.maxHp);
    else if (g.id === 'reroll') pl.rerollBonus = (pl.rerollBonus || 0) + 1;
    else if (g.id === 'candy') G.Game.giveLevel();
    else if (g.id === 'amulet') G.Pickups.drop('amulet', pl.x, pl.y, 0);
    else if (g.id === 'ticket') { pl.t1++; }
    else if (g.id === 'item') {
      // El objeto se elige al cerrar la tienda (la elección también para el juego).
      const ids = Object.keys(G.Items.BY).filter(id => id !== pl.item);
      pendingItem = G.U.pick(ids);
    }
    render();
  }
  let pendingItem = null;

  function close() {
    G.UI.hide('scr-shop');
    G.Game.endChoice();
    if (pendingItem) { const id = pendingItem; pendingItem = null; G.Game.offerItem(id); }
  }

  /** Para el bucle del juego (orden por Y, como los demás). */
  function drawable() {
    if (!k || !anim) return null;
    return {
      y: k.y,
      draw(ctx) {
        const pl = G.Game.player;
        const d = pl ? Math.sqrt(G.U.dist2(pl.x, pl.y, k.x, k.y)) : 999;
        // Camuflado: casi invisible de lejos.
        const a = k.shopped ? 0.5 : G.U.clamp(1.15 - d / 260, 0.3, 1);
        G.Sprites.drawShadow(ctx, DEX, k.x, k.y, 1);
        anim.draw(ctx, k.x, k.y, { alpha: a });
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '700 9px Pixelify,"Segoe UI",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
        const txt = k.shopped ? 'Gracias' : 'Tienda · ' + Math.ceil(STAY - k.t) + ' s';
        ctx.strokeText(txt, k.x, k.y - 44); ctx.fillStyle = '#7fe08a'; ctx.fillText(txt, k.x, k.y - 44);
        ctx.restore();
      }
    };
  }

  /** Flecha en el borde de la pantalla si no se ve (HUD). */
  function drawHud(ctx, w, h) {
    if (!k || k.shopped) return;
    const cam = G.Camera;
    const sx = (k.x - cam.left()) * cam.scale, sy = (k.y - 20 - cam.top()) * cam.scale;
    if (sx > 0 && sx < w && sy > 0 && sy < h) return;
    const M = 40, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
    const a = Math.atan2(sy - ey, sx - ex);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.fillStyle = '#7fe08a';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
    ctx.lineTo(Math.cos(a + 2.5) * 11, Math.sin(a + 2.5) * 11);
    ctx.lineTo(Math.cos(a - 2.5) * 11, Math.sin(a - 2.5) * 11);
    ctx.fill();
    ctx.font = '800 10px Pixelify,"Segoe UI",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText('KECLEON', -Math.cos(a) * 26, -Math.sin(a) * 18 + 4);
    ctx.fillText('KECLEON', -Math.cos(a) * 26, -Math.sin(a) * 18 + 4);
    ctx.restore();
  }

  function init() {
    G.UI.$('shop-close').onclick = close;
  }
  const isOpen = () => G.UI.isOpen('scr-shop');

  if (G.I18n) G.I18n.add({
    'Tienda de Kecleon': 'Kecleon’s shop', 'Clase particular': 'Private lesson', 'Tu movimiento activo sube un nivel.': 'Your active move goes up a level.',
    'Hiperpoción': 'Hyper Potion', 'Te cura toda la vida.': 'Restores all your HP.', 'Barajar': 'Shuffle',
    '+1 cambio de cartas de nivel en esta partida.': '+1 level-up card reroll for this run.', 'Objeto sorpresa': 'Mystery item',
    'Un objeto equipable al azar (puedes quedarte con el tuyo).': 'A random held item (you can keep yours).',
    'Caramelo Raro': 'Rare Candy', 'Subes un nivel.': 'You go up a level.', 'Moneda Amuleto': 'Amulet Coin',
    'Las monedas valen doble durante 30 s.': 'Coins are worth double for 30 s.', 'Ticket del gacha': 'Gacha ticket',
    'Un ticket ×1 para el gacha.': 'One ×1 gacha ticket.', 'Comprado': 'Bought', '{x} monedas': '{x} coins',
    'No te llegan las monedas': 'Not enough coins', 'Tu movimiento activo ya está al máximo': 'Your active move is already maxed',
    '{x} sube a Nv.{x}': '{x} goes up to Lv.{x}', '¡Kecleon ha abierto su tienda cerca! (60 s)': 'Kecleon has opened a shop nearby! (60 s)',
    'Kecleon ha cerrado la tienda': 'Kecleon has closed the shop', 'Gracias': 'Thanks', 'Tienda · {x} s': 'Shop · {x} s',
    'Se paga con las monedas de esta partida: lo que gastes no te lo llevas al acabar.': 'You pay with this run’s coins: what you spend you won’t take home.',
    'Salir de la tienda': 'Leave the shop'
  });

  return { reset, update, drawable, drawHud, init, close, buy, get isOpen() { return isOpen(); } };
})();
