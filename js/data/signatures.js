/* ============ signatures.js — ataques únicos de algunas familias ============
 * Cada uno es de UNA familia (la de `of`, cualquiera de sus miembros) y usa
 * los gráficos de su forma (`kind`, ver data/moves.js): no hacen falta
 * sprites nuevos. Son más fuertes que un movimiento normal del mismo estilo
 * pero no evolucionan.
 *
 * Se desbloquean:
 *   - con la misión de familia "sig" (systems/family.js): aguanta 15 min con
 *     cualquier Pokémon de la familia y recoge el premio en la ficha;
 *   - los legendarios, también derrotándolos en una grieta (save.legends).
 *
 * Desbloqueado, entra en las cartas de esa familia (G.Moves.poolFor), se puede
 * marcar como favorito y elegir de movimiento inicial (systems/talents.js).
 */
G.Signatures = (() => {
  const LIST = [
    { of: 1, id: 'frenzy-plant', name: 'Planta Feroz', en: 'Frenzy Plant', type: 'grass', kind: 'meteor', cat: 'special',
      desc: 'Raíces gigantes brotan bajo los enemigos y los frenan.', descEn: 'Giant roots burst under enemies and slow them.',
      cd: 1.25, dmg: 30, count: 4, radius: 56, knock: 60, slow: 0.3 },
    { of: 4, id: 'blast-burn', name: 'Anillo Ígneo', en: 'Blast Burn', type: 'fire', kind: 'nova', cat: 'special',
      desc: 'Estallido de fuego en todas direcciones que quema y atraviesa.', descEn: 'A burst of fire in every direction that burns and pierces.',
      cd: 1.2, dmg: 18, speed: 260, count: 14, pierce: 2, life: 1.2, size: 9, burn: 1 },
    { of: 7, id: 'aqua-tail', name: 'Acua Cola', en: 'Aqua Tail', type: 'water', kind: 'melee', cat: 'physical',
      desc: 'Coletazo de agua a tu alrededor que empuja con fuerza.', descEn: 'A watery tail swipe all around you that knocks enemies back.',
      cd: 0.55, dmg: 26, radius: 90, arc: 3.2, knock: 110 },
    { of: 25, id: 'volt-tackle', name: 'Placaje Eléctrico', en: 'Volt Tackle', type: 'electric', kind: 'dash', cat: 'physical',
      desc: 'Cruzas como un rayo arrasando todo lo que pillas.', descEn: 'You streak through like lightning, flattening everything.',
      cd: 0.8, dmg: 32, radius: 140, width: 42, knock: 70 },
    { of: 92, id: 'nightmare', name: 'Pesadilla', en: 'Nightmare', type: 'ghost', kind: 'chain', cat: 'special',
      desc: 'Salta de enemigo en enemigo sembrando el terror.', descEn: 'Leaps from enemy to enemy, spreading terror.',
      cd: 0.85, dmg: 24, count: 6, radius: 170 },
    { of: 133, id: 'last-resort', name: 'Última Baza', en: 'Last Resort', type: 'normal', kind: 'projectile', cat: 'physical',
      desc: '+25% de daño por cada otro movimiento que tengas al nivel máximo.', descEn: '+25% damage for each other move you have at max level.',
      cd: 0.6, dmg: 22, speed: 380, count: 1, spread: 0.1, pierce: 2, life: 1.5, size: 9, perMax: 0.25 },
    { of: 147, id: 'outrage', name: 'Enfado', en: 'Outrage', type: 'dragon', kind: 'melee', cat: 'physical',
      desc: 'Furia de dragón que golpea a todo lo que te rodea.', descEn: 'Draconic fury that hits everything around you.',
      cd: 0.6, dmg: 34, radius: 85, arc: 6.3, knock: 80 },
    { of: 150, id: 'psystrike', name: 'Onda Mental', en: 'Psystrike', type: 'psychic', kind: 'beam', cat: 'special',
      desc: 'Rayo psíquico enorme que lo atraviesa todo.', descEn: 'A huge psychic beam that goes through everything.',
      cd: 1.0, dmg: 36, radius: 270, width: 44 },
    { of: 249, id: 'aeroblast', name: 'Aerochorro', en: 'Aeroblast', type: 'flying', kind: 'cone', cat: 'special',
      desc: 'Chorro de aire comprimido que perfora filas enteras.', descEn: 'A jet of compressed air that pierces whole rows.',
      cd: 0.6, dmg: 10, count: 9, arc: 0.7, speed: 460, life: 0.5, size: 7, pierce: 3 },
    { of: 382, id: 'origin-pulse', name: 'Pulso Primigenio', en: 'Origin Pulse', type: 'water', kind: 'nova', cat: 'special',
      desc: 'Ondas del océano primigenio en todas direcciones que frenan.', descEn: 'Waves of the primordial sea in every direction that slow.',
      cd: 1.1, dmg: 17, speed: 280, count: 16, pierce: 2, life: 1.3, size: 8, slow: 0.3 },
    { of: 383, id: 'precipice-blades', name: 'Filo del Abismo', en: 'Precipice Blades', type: 'ground', kind: 'meteor', cat: 'physical',
      desc: 'Cuchillas de roca brotan del suelo bajo los enemigos.', descEn: 'Blades of stone burst from the ground under enemies.',
      cd: 1.2, dmg: 38, count: 4, radius: 58, knock: 90 },
    { of: 384, id: 'dragon-ascent', name: 'Ascenso Draco', en: 'Dragon Ascent', type: 'flying', kind: 'dash', cat: 'physical',
      desc: 'Te lanzas desde el cielo a toda velocidad.', descEn: 'You dive from the sky at full speed.',
      cd: 0.75, dmg: 36, radius: 150, width: 46, knock: 80 },
    { of: 483, id: 'roar-of-time', name: 'Distorsión', en: 'Roar of Time', type: 'dragon', kind: 'beam', cat: 'special',
      desc: 'Distorsiona el tiempo: rayo enorme que frena mucho.', descEn: 'Warps time itself: a huge beam that slows a lot.',
      cd: 1.3, dmg: 46, radius: 280, width: 50, slow: 0.5 },
    { of: 484, id: 'spacial-rend', name: 'Corte Vacío', en: 'Spacial Rend', type: 'dragon', kind: 'boomerang', cat: 'special',
      desc: 'Rasga el espacio: dos cortes que van y vuelven.', descEn: 'Tears through space: two cuts that fly out and back.',
      cd: 0.85, dmg: 22, speed: 380, count: 2, spread: 0.7, radius: 240, size: 10 },
    { of: 656, id: 'water-shuriken', name: 'Shuriken de Agua', en: 'Water Shuriken', type: 'water', kind: 'projectile', cat: 'special',
      desc: 'Tres estrellas de agua rapidísimas.', descEn: 'Three lightning-fast stars of water.',
      cd: 0.42, dmg: 12, speed: 520, count: 3, spread: 0.25, pierce: 1, life: 1.2, size: 6 },
    { of: 722, id: 'spirit-shackle', name: 'Puntada Sombría', en: 'Spirit Shackle', type: 'ghost', kind: 'projectile', cat: 'physical',
      desc: 'Una flecha de sombra que atraviesa y frena.', descEn: 'A shadow arrow that pierces and slows.',
      cd: 0.65, dmg: 26, speed: 420, count: 1, spread: 0.1, pierce: 4, life: 1.6, size: 8, slow: 0.5 },
    { of: 725, id: 'darkest-lariat', name: 'Lariat Oscuro', en: 'Darkest Lariat', type: 'dark', kind: 'melee', cat: 'physical',
      desc: 'Giras con los brazos abiertos golpeando a todo tu alrededor.', descEn: 'You spin with arms out, hitting everything around you.',
      cd: 0.6, dmg: 30, radius: 80, arc: 6.3, knock: 90 },
    { of: 728, id: 'sparkling-aria', name: 'Aria Burbuja', en: 'Sparkling Aria', type: 'water', kind: 'nova', cat: 'special',
      desc: 'Un canto que llena todo de burbujas que estallan.', descEn: 'A song that fills the air with bursting bubbles.',
      cd: 1.0, dmg: 14, speed: 230, count: 14, pierce: 1, life: 1.4, size: 9, slow: 0.35 },
    { of: 906, id: 'flower-trick', name: 'Truco Floral', en: 'Flower Trick', type: 'grass', kind: 'projectile', cat: 'physical',
      desc: 'Ramos que persiguen al enemigo y nunca fallan.', descEn: 'Bouquets that chase enemies and never miss.',
      cd: 0.5, dmg: 18, speed: 330, count: 2, spread: 0.4, pierce: 0, life: 2.2, size: 8, homing: 3 },
    { of: 909, id: 'torch-song', name: 'Canto Ardiente', en: 'Torch Song', type: 'fire', kind: 'cone', cat: 'special',
      desc: 'Un canto de llamas en abanico que quema.', descEn: 'A fan of singing flames that burns.',
      cd: 0.65, dmg: 9, count: 9, arc: 1.0, speed: 400, life: 0.5, size: 7, pierce: 1, burn: 1 },
    { of: 912, id: 'aqua-step', name: 'Danza Acuática', en: 'Aqua Step', type: 'water', kind: 'dash', cat: 'physical',
      desc: 'Pasos de baile entre las olas que lo arrasan todo.', descEn: 'Dance steps across the waves that sweep everything away.',
      cd: 0.7, dmg: 28, radius: 130, width: 40, knock: 60 },
    { of: 1007, id: 'collision-course', name: 'Nitrochoque', en: 'Collision Course', type: 'fighting', kind: 'dash', cat: 'physical',
      desc: 'Embestida brutal que lo arrolla todo.', descEn: 'A brutal charge that runs everything over.',
      cd: 0.8, dmg: 38, radius: 150, width: 46, knock: 100 },
    { of: 1008, id: 'electro-drift', name: 'Electroderrape', en: 'Electro Drift', type: 'electric', kind: 'dash', cat: 'special',
      desc: 'Derrape eléctrico a toda velocidad.', descEn: 'An electric drift at full speed.',
      cd: 0.8, dmg: 38, radius: 150, width: 46, knock: 80 }
  ];

  // Sólo los de Pokémon que estén en el juego.
  const ACTIVE = LIST.filter(s => G.DEX_BY && G.DEX_BY[s.of]);
  const BY_ID = {};
  const dict = {};
  for (const s of ACTIVE) {
    const def = Object.assign({}, s, { sig: true });
    delete def.of; delete def.en; delete def.descEn;
    G.Moves.register(def);
    BY_ID[s.id] = s;
    dict[s.name] = s.en;
    dict[s.desc] = s.descEn;
  }

  // raíz de la familia -> ataque único (se calcula al usarse: hace falta G.Family).
  let byRoot = null;
  function rootMap() {
    if (!byRoot) {
      byRoot = {};
      for (const s of ACTIVE) byRoot[G.Family.rootOf(s.of)] = s;
    }
    return byRoot;
  }

  /** Ataque único de la familia de `dex` (o null). */
  function of(dex) { return G.Family ? rootMap()[G.Family.rootOf(dex)] || null : null; }
  function idFor(dex) { const s = of(dex); return s ? s.id : null; }

  /** ¿Lo tiene desbloqueado esta partida? */
  function unlocked(save, dex) {
    const s = of(dex);
    if (!s || !save) return false;
    const f = save.fam && save.fam[G.Family.rootOf(dex)];
    if (f && Array.isArray(f.c) && f.c.includes('sig')) return true;
    return !!(G.DEX_BY[s.of].leg && save.legends && save.legends[s.of]);
  }

  /** Id del ataque único si está desbloqueado (lo usa G.Moves.poolFor). */
  function forDex(dex, save) { return unlocked(save, dex) ? idFor(dex) : null; }

  if (G.I18n) G.I18n.add(Object.assign(dict, {
    'Ataque único': 'Signature move', 'Su ataque único': 'Its signature move',
    'Aguanta 15 minutos en una run': 'Survive 15 minutes in a run'
  }));

  return { LIST: ACTIVE, BY_ID, of, idFor, unlocked, forDex };
})();
