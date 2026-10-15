/* ============ curses-ui.js — pantalla de maldiciones antes de jugar ============
 * Al pulsar Jugar (en solitario) eliges maldiciones y ves el premio que dan.
 * Se recuerdan para la siguiente partida (save.curses). Ver systems/curses.js.
 */
G.CursesUI = (() => {
  const $ = G.UI.$;

  function open() {
    G.UI.show('scr-curses', true);
    render();
  }

  function render() {
    const s = G.DB.save, on = new Set(G.Curses.chosen(s));
    $('curse-group').classList.toggle('hidden', !G.Social.room);
    const list = $('curse-list');
    list.innerHTML = G.Curses.ALL.map(c => `<button class="curse${on.has(c.id) ? ' on' : ''}" data-c="${c.id}">
        <span class="pts">${c.pts} pt</span><b>${c.name}</b><span>${c.desc}</span></button>`).join('');
    list.querySelectorAll('.curse').forEach(b => {
      b.onclick = () => { G.Curses.toggle(s, b.dataset.c); G.DB.commit(); G.Audio.sfx('select'); render(); };
    });
    const p = G.Curses.points([...on]);
    const t = G.Curses.tickets(p);
    $('curse-sum').innerHTML = !p ? 'Sin maldiciones'
      : `Puntos de maldición: <b>${p}</b> · +${Math.round((G.Curses.coinMul(p) - 1) * 100)}% monedas · shiny ×${G.Curses.shinyMul(p).toFixed(2)}` +
        (t ? ` · +${t} tickets si aguantas 5 min` : '');
  }

  return { open };
})();
