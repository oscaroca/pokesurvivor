/* ============ plates.js — las Tablas de Arceus (reglas que cambian la partida) ============
 * Como las Arcanas de Vampire Survivors: en el minuto 10 y en el 20 eliges una
 * de 3 Tablas al azar. Cada una cambia una regla hasta el final de la partida.
 * Se suman (puedes acabar con dos). En grupo, cada uno elige las suyas a la vez.
 *
 * Lo que hace cada una está repartido en ganchos pequeños:
 *   onHit      cada golpe tuyo a un enemigo (combat.js)
 *   bounce     rebotes de tus proyectiles (projectile.js / combat.js)
 *   dmgMul     daño extra (Player.atkFor)
 *   applyMove  al aprender un movimiento (player.js) y al coger la Tabla
 *   onCast     al lanzar un ataque (combat.js)
 *   onHeal     al curarte (Player.heal)
 *   tick       cada fotograma (game.js): Terremoto y cuándo salen las Tablas
 */
G.Plates = (() => {
  const AT = [600, 1200];
  const LIST = [
    { id: 'draco',   type: 'dragon',   name: 'Tabla Draco',    rule: 'Rebote',            desc: 'Tus proyectiles rebotan una vez hacia otro enemigo al chocar.' },
    { id: 'puno',    type: 'fighting', name: 'Tabla Puño',     rule: 'Golpe certero',     desc: 'Cada quinto ataque hace el doble de daño.' },
    { id: 'llama',   type: 'fire',     name: 'Tabla Llama',    rule: 'Suelo ardiente',    desc: 'Tus auras y golpes cuerpo a cuerpo dejan el suelo en llamas.' },
    { id: 'pixie',   type: 'fairy',    name: 'Tabla Duende',   rule: 'Curación radiante', desc: 'Al curarte, dañas a los enemigos de alrededor.' },
    { id: 'trueno',  type: 'electric', name: 'Tabla Trueno',   rule: 'Electrocadena',     desc: 'Un 15% de tus golpes salta a otro enemigo cercano con la mitad de daño.' },
    { id: 'helada',  type: 'ice',      name: 'Tabla Helada',   rule: 'Escarcha',          desc: 'Todos tus golpes ralentizan.' },
    { id: 'toxica',  type: 'poison',   name: 'Tabla Tóxica',   rule: 'Veneno',            desc: 'Todos tus golpes envenenan.' },
    { id: 'terrax',  type: 'ground',   name: 'Tabla Terrax',   rule: 'Terremoto',         desc: 'Cada 6 s, una onda sísmica daña a todo lo que te rodea.' },
    { id: 'mental',  type: 'psychic',  name: 'Tabla Mental',   rule: 'Mente clara',       desc: '-15% de recarga en todos los movimientos.' },
    { id: 'acero',   type: 'steel',    name: 'Tabla Acero',    rule: 'Coraza',            desc: '+20% de vida máxima y -15% de daño recibido.' },
    { id: 'cielo',   type: 'flying',   name: 'Tabla Cielo',    rule: 'Viento a favor',    desc: '+20% de velocidad y tus proyectiles vuelan un 20% más rápido.' },
    { id: 'bicho',   type: 'bug',      name: 'Tabla Bicho',    rule: 'Enjambre',          desc: '+1 proyectil, bumerán, mina, orbe o meteoro en todos tus ataques.' },
    { id: 'oscura',  type: 'dark',     name: 'Tabla Oscura',   rule: 'Ejecución',         desc: 'Los enemigos normales con menos del 12% de vida caen al golpearlos.' }
  ];
  const BY = {};
  for (const p of LIST) BY[p.id] = p;

  let offers = null, idx = 0, quakeT = 0, healAcc = 0;
  const has = (pl, id) => !!(pl && pl.plates && pl.plates.includes(id));

  function reset() { offers = null; idx = 0; quakeT = 6; healAcc = 0; }

  // ---------------- cuándo salen ----------------
  function tick(pl, dt, t) {
    if (!pl || pl.remote || pl.dead) return;
    if (idx < AT.length && t >= AT[idx] && !G.Rift.inArena && !G.Judgment.active && !offers) open(pl);
    if (has(pl, 'terrax') && (quakeT -= dt) <= 0) { quakeT = 6; quake(pl); }
  }

  function open(pl) {
    if (!G.Game.pauseChoice()) return;            // si estás eligiendo otra cosa, en el siguiente fotograma
    idx++;
    const pool = LIST.filter(p => !has(pl, p.id));
    offers = G.U.pickN(pool, 3);
    const box = G.UI.$('plate-cards');
    box.innerHTML = '';
    offers.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="ico" style="background:${G.U.TYPE_COLOR[p.type]}33">${G.Icons.html('type:' + p.type, 32)}</div>
        <div class="txt"><div class="nm">${p.rule} <span class="tag-chip" style="background:${G.U.TYPE_COLOR[p.type]}">${p.name}</span></div>
        <div class="ds">${p.desc}</div></div><div class="key">${i + 1}</div>`;
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
    G.UI.$('plate-min').textContent = idx === 1 ? '10' : '20';
    G.UI.show('scr-plates');
    G.Audio.sfx('legend');
  }

  function pick(i) {
    const pl = G.Game.player, p = offers && offers[i];
    if (!p || !pl) return;
    offers = null;
    pl.plates = (pl.plates || []).concat(p.id);
    // Las que cambian números del jugador o de los movimientos que ya tienes.
    if (p.id === 'mental') pl.cdMul *= 0.85;
    if (p.id === 'acero') { pl.addMaxHp(Math.round(pl.maxHp * 0.2)); pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.15); }
    if (p.id === 'cielo') pl.spdMul *= 1.2;
    for (const m of pl.moves) applyOne(m, p.id);
    G.UI.hide('scr-plates');
    G.FX.ring(pl.x, pl.y, 10, 160, G.U.TYPE_COLOR[p.type], 0.9, 7);
    G.Spawner.say(p.name + ': ' + p.rule, 3, true);
    G.Game.endChoice();
  }

  // ---------------- efectos ----------------
  const EXTRA = { projectile: 1, nova: 3, cone: 2, boomerang: 1, mine: 1, meteor: 1, orbit: 1 };
  function applyOne(m, id) {
    if (id === 'bicho' && EXTRA[m.kind]) { m.count = (m.count || 1) + EXTRA[m.kind]; if (m.kind === 'projectile' && (m.spread || 0) < 0.2) m.spread = 0.2; }
    if (id === 'cielo' && m.speed && ['projectile', 'nova', 'cone', 'boomerang', 'turret'].includes(m.kind)) m.speed *= 1.2;
  }
  /** Al aprender un movimiento: las Tablas que ya tienes. */
  function applyMove(m, pl) { for (const id of (pl && pl.plates) || []) applyOne(m, id); }

  /** Rebotes que lleva un proyectil tuyo nuevo. */
  function bounce() { const pl = G.Game && G.Game.player; return has(pl, 'draco') ? 1 : 0; }

  /** Golpe certero: el quinto ataque, ×2. */
  function onCast(pl) {
    if (!has(pl, 'puno')) return;
    pl.plateN = (pl.plateN || 0) + 1;
    pl.plateCrit = pl.plateN % 5 === 0;
  }
  function dmgMul(pl) { return pl.plateCrit && has(pl, 'puno') ? 2 : 1; }
  function afterCast(pl) { pl.plateCrit = false; }

  /** Cada golpe tuyo (no los de los compañeros, que ya los hace su dueño). */
  function onHit(pl, e, dmg) {
    if (!pl || !pl.plates || !pl.plates.length || e.dead) return;
    if (has(pl, 'helada')) e.applySlow(0.25, 1.5);
    if (has(pl, 'toxica')) e.applyPoison(1);
    if (has(pl, 'oscura') && !e.boss && !e.shiny && e.hp > 0 && e.hp < e.maxHp * 0.12) e.hurt(e.hp + 1, '#7a5cff');
    if (has(pl, 'trueno') && Math.random() < 0.15) {
      let best = null, bd = 140 * 140;
      for (const o of G.EnemyMgr.queryCircle(e.x, e.y, 140)) {
        if (o === e || o.dead) continue;
        const d = G.U.dist2(o.x, o.y, e.x, e.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        best.hurt(dmg * 0.5, '#ffd21a');
        G.FX.sp('streak', 'electric', (e.x + best.x) / 2, (e.y + best.y) / 2 - 10, { life: 0.15, angle: Math.atan2(best.y - e.y, best.x - e.x) });
      }
    }
  }

  // Suelo ardiente: tras un aura o un golpe cuerpo a cuerpo, un charco de fuego.
  let fire = null;
  function onRun(pl, m, trail) {
    if (!has(pl, 'llama') || (m.kind !== 'aura' && m.kind !== 'melee')) return;
    if (!fire) fire = G.Moves.instance('flame-wheel', 1);
    fire.dmg = Math.max(6, m.dmg * 0.45);
    fire.radius = Math.min(60, (m.radius || 40) * 0.6);
    fire.dur = 2.5;
    trail(pl, fire);
  }

  /** Curación radiante: lo que te curas, en daño alrededor (acumulado, cada 5 de vida). */
  function onHeal(pl, got) {
    if (!has(pl, 'pixie') || got <= 0) return;
    healAcc += got;
    if (healAcc < 5) return;
    const dmg = healAcc * 3 * pl.spa;
    healAcc = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 120)) if (!e.dead) e.hurt(dmg, '#ff9ed8', e.x - pl.x, e.y - pl.y, 60);
    G.FX.ring(pl.x, pl.y, 10, 120, '#ff9ed8', 0.5, 4);
  }

  function quake(pl) {
    const dmg = (18 + pl.level * 3) * pl.atk;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 130)) if (!e.dead) e.hurt(dmg, '#c9a05a', e.x - pl.x, e.y - pl.y, 90);
    G.FX.ring(pl.x, pl.y, 12, 130, '#c9a05a', 0.6, 6);
    G.Camera.kick(0.25);
  }

  function init() {}

  const dict = {
    'Tablas de Arceus': 'Arceus Plates', 'Minuto {x}: elige una Tabla. Cambia una regla hasta el final de la partida.': 'Minute {x}: choose a Plate. It changes a rule until the end of the run.'
  };
  const EN = {
    draco: ['Draco Plate', 'Rebound', 'Your projectiles bounce once towards another enemy on impact.'],
    puno: ['Fist Plate', 'Sure Strike', 'Every fifth attack deals double damage.'],
    llama: ['Flame Plate', 'Burning Ground', 'Your auras and melee strikes set the ground on fire.'],
    pixie: ['Pixie Plate', 'Radiant Healing', 'Healing yourself damages nearby enemies.'],
    trueno: ['Zap Plate', 'Chain Lightning', '15% of your hits jump to another nearby enemy for half damage.'],
    helada: ['Icicle Plate', 'Frost', 'All your hits slow enemies.'],
    toxica: ['Toxic Plate', 'Venom', 'All your hits poison.'],
    terrax: ['Earth Plate', 'Earthquake', 'Every 6 s, a shockwave damages everything around you.'],
    mental: ['Mind Plate', 'Clear Mind', '-15% cooldown on all moves.'],
    acero: ['Iron Plate', 'Armour', '+20% max HP and -15% damage taken.'],
    cielo: ['Sky Plate', 'Tailwind', '+20% speed and your projectiles fly 20% faster.'],
    bicho: ['Insect Plate', 'Swarm', '+1 projectile, boomerang, mine, orb or meteor on all your attacks.'],
    oscura: ['Dread Plate', 'Execution', 'Normal enemies under 12% HP fall when you hit them.']
  };
  for (const p of LIST) { const e = EN[p.id]; dict[p.name] = e[0]; dict[p.rule] = e[1]; dict[p.desc] = e[2]; }
  dict['Minuto'] = 'Minute';
  dict[': elige una Tabla. Cambia una regla hasta el final de la partida.'] = ': choose a Plate. It changes a rule until the end of the run.';
  if (G.I18n) G.I18n.add(dict);

  return { LIST, BY, reset, tick, pick, applyMove, bounce, onCast, dmgMul, afterCast, onHit, onRun, onHeal, init };
})();
