/* ============ elites.js — enemigos élite con modificadores ============
 * Desde el minuto 2, de vez en cuando un enemigo normal sale ÉLITE: más
 * grande o más duro, con un aura de color, su nombre encima y una habilidad
 * (como los de Halls of Torment). Dan más experiencia, monedas y, a veces,
 * un objeto raro (systems/../entities/pickup.js).
 *
 *   fast    Veloz       mucho más rápido
 *   tank    Coloso      enorme, muchísima vida, pega más
 *   split   Divisor     al caer se parte en 3 más pequeños
 *   bomb    Explosivo   al caer estalla (aviso rojo de 0,7 s): apártate
 *   healer  Sanador     cura a los enemigos de alrededor
 *   shield  Escudado    se pone un escudo cada pocos segundos
 *
 * Cooperativo: los decide el anfitrión (va en el evento 'ne'); la explosión
 * se manda a todos ('eb') y cada uno se hace daño a sí mismo si le pilla.
 */
G.Elites = (() => {
  const AFFIX = {
    fast:   { name: 'Veloz',     color: '#7fe0ff', hp: 3,   spd: 1.6 },
    tank:   { name: 'Coloso',    color: '#ff9a3d', hp: 7,   spd: 0.8, dmg: 1.5, scale: 1.4 },
    split:  { name: 'Divisor',   color: '#5fe08a', hp: 3 },
    bomb:   { name: 'Explosivo', color: '#ff5f6d', hp: 2.5 },
    healer: { name: 'Sanador',   color: '#ff8ad8', hp: 3 },
    shield: { name: 'Escudado',  color: '#9fd8ff', hp: 3 }
  };
  const IDS = Object.keys(AFFIX);
  const FROM = 120, MAX_ALIVE = 3, BLAST_R = 80;
  let blasts = [];

  function alive() { return G.EnemyMgr.all().filter(e => e.elite && !e.dead).length; }

  /** Probabilidad de que un enemigo nuevo salga élite: 1,2% al minuto 2, hasta 3% al 20. */
  function chance(t) { return t < FROM ? 0 : Math.min(0.03, 0.012 + (t - FROM) / 1080 * 0.018); }

  /** Al crear un enemigo (anfitrión o solitario). */
  function roll(e, t) {
    if (e.boss || e.shiny || e.behavior === 'thief' || G.Rift.inArena || G.Judgment.active) return;
    if (Math.random() >= chance(t) || alive() >= MAX_ALIVE) return;
    make(e, G.U.pick(IDS));
  }

  /** Convierte a `e` en élite (en las copias del cooperativo, sólo lo que se ve). */
  function make(e, id, visualOnly = false) {
    const a = AFFIX[id];
    if (!a) return;
    e.elite = id;
    if (a.scale) {
      e.scale = a.scale;
      e.anim = new G.Sprites.Animator(e.dex, e.scale, e.shiny);
      e.r = G.Sprites.bodyRadius(e.dex, e.scale);
      e.bodyH = G.Sprites.bodyHeight(e.dex, e.scale);
    }
    if (visualOnly) return;
    e.maxHp = e.hp = Math.round(e.maxHp * a.hp);
    if (a.spd) e.spd *= a.spd;
    if (a.dmg) e.dmg *= a.dmg;
    e.xp = Math.round(e.xp * 4);
    e.eliteT = 1;
  }

  /** Cada fotograma (sólo quien manda en los enemigos). */
  function tick(e, dt) {
    if (!e.elite || e.dead) return;
    if ((e.eliteT -= dt) > 0) return;
    if (e.elite === 'healer') {
      e.eliteT = 2.5;
      let n = 0;
      for (const o of G.EnemyMgr.queryCircle(e.x, e.y, 140)) {
        if (o === e || o.dead || o.hp >= o.maxHp) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12);
        n++;
      }
      if (n && G.Camera.sees(e.x, e.y, 40)) G.FX.ring(e.x, e.y, 10, 140, '#ff8ad8', 0.35, 3);
    } else if (e.elite === 'shield') {
      e.eliteT = 4;
      e.shield = Math.max(e.shield, e.maxHp * 0.3); e.shieldT = 3;
    } else e.eliteT = 99;
  }

  /** Al caer (anfitrión o solitario): habilidad final y premio. */
  function onDeath(e) {
    if (!e.elite) return;
    const x = e.x, y = e.y;
    if (e.elite === 'split') {
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * 6.2832;
        const c = new G.Enemy(e.def, x + Math.cos(a) * 18, y + Math.sin(a) * 18, e.sc);
        c.maxHp = c.hp = Math.max(1, Math.round(e.maxHp / 9));
        c.dmg = e.dmg * 0.6; c.xp = Math.max(1, Math.round(e.xp / 12));
        G.EnemyMgr.add(c);
      }
    } else if (e.elite === 'bomb') {
      blast(x, y, e.dmg * 2.5);
      if (G.Coop.isHost) G.Coop.broadcast(['eb', Math.round(x), Math.round(y), Math.round(e.dmg * 2.5)]);
    }
    G.Pickups.drop('coin', x + G.U.rand(-10, 10), y, 3 + Math.floor(Math.random() * 4));
    if (Math.random() < 0.25) G.Pickups.drop(G.U.pick(['candy', 'clock', 'potion', 'amulet']), x, y - 10, 0);
  }

  /** Explosión con aviso (también la que llega del anfitrión). */
  function blast(x, y, dmg) { blasts.push({ x, y, dmg, t: 0.7 }); }

  function update(dt, pl) {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      if ((b.t -= dt) > 0) continue;
      blasts.splice(i, 1);
      G.FX.ring(b.x, b.y, 10, BLAST_R, '#ff5f6d', 0.5, 6);
      G.FX.burst(b.x, b.y - 10, '#ff7b3d', 22, 200);
      if (G.Camera.sees(b.x, b.y, 60)) G.Audio.sfx('break');
      if (pl && !pl.dead && G.U.dist2(pl.x, pl.y, b.x, b.y) < BLAST_R * BLAST_R) pl.hurt(b.dmg, null);
    }
  }

  function drawGround(ctx) {
    for (const b of blasts) {
      const k = 1 - b.t / 0.7;
      ctx.save();
      ctx.globalAlpha = 0.18 + k * 0.3;
      ctx.fillStyle = '#ff3048';
      ctx.beginPath(); ctx.ellipse(b.x, b.y, BLAST_R, BLAST_R * 0.55, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff5f6d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, BLAST_R * k, BLAST_R * 0.55 * k, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
  }

  /** Aura y nombre del élite (lo llama Enemy.draw). */
  function drawAura(ctx, e) {
    const a = AFFIX[e.elite];
    if (!a || e.dead) return;
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(e.bob * 0.6) * 0.08;
    ctx.fillStyle = a.color;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.8, e.r * 0.7, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  function drawLabel(ctx, e) {
    const a = AFFIX[e.elite];
    if (!a || e.dead) return;
    ctx.save();
    ctx.font = '700 8px Pixelify,"Segoe UI",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    const y = e.y - e.bodyH - 6;
    ctx.strokeText(a.name, e.x, y);
    ctx.fillStyle = a.color;
    ctx.fillText(a.name, e.x, y);
    ctx.restore();
  }

  function clear() { blasts = []; }

  if (G.I18n) G.I18n.add({ 'Veloz': 'Swift', 'Coloso': 'Colossus', 'Divisor': 'Splitter', 'Explosivo': 'Explosive',
                           'Sanador': 'Healer', 'Escudado': 'Shielded' });

  return { AFFIX, roll, make, tick, onDeath, blast, update, drawGround, drawAura, drawLabel, clear };
})();
