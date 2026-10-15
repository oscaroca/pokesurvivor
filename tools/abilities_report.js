/* Lista las habilidades que aún no hacen nada en el juego.
 *   node tools/abilities_report.js
 * Escribe docs/habilidades-pendientes.md: cuántos Pokémon tienen efecto y,
 * de las que faltan, cuántos Pokémon arrastra cada una y cuáles son (las que
 * más Pokémon tienen, arriba: son las que más rinde adaptar).
 * Para adaptar una, se añade a TABLE en js/data/abilities.js.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
global.G = { I18n: { add() {} }, SPRITE_META: {} };
for (const f of ['js/core/util.js', 'js/data/pokedex.js', 'js/data/abilities-dex.js', 'js/data/megas.js', 'js/data/abilities.js']) require(path.join(ROOT, f));

const byAb = {};
for (const [dex, id] of Object.entries(G.ABILITY_DEX)) (byAb[id] = byAb[id] || []).push(+dex);
const total = Object.keys(G.ABILITY_DEX).length;
const done = Object.keys(byAb).filter(id => G.Abilities.TABLE[id]);
const todo = Object.keys(byAb).filter(id => !G.Abilities.TABLE[id]).sort((a, b) => byAb[b].length - byAb[a].length || a.localeCompare(b));
const covered = done.reduce((n, id) => n + byAb[id].length, 0);

const L = [];
L.push('# Habilidades pendientes');
L.push('');
L.push('Generado con `node tools/abilities_report.js`. No editar a mano.');
L.push('');
L.push(`- Habilidades con efecto: **${done.length}** de ${Object.keys(byAb).length}`);
L.push(`- Pokémon con habilidad que hace algo: **${covered}** de ${total} (${Math.round(covered * 100 / total)}%)`);
L.push(`- Pendientes: **${todo.length}** habilidades, ${total - covered} Pokémon`);
L.push('');
L.push('Para adaptar una: añadirla a `TABLE` en `js/data/abilities.js` (con una familia existente o una nueva) y volver a generar este archivo.');
L.push('');
L.push('| Habilidad | id | Pokémon | Cuáles |');
L.push('|---|---|---|---|');
for (const id of todo) {
  const names = byAb[id].sort((a, b) => a - b).map(d => (G.DEX_BY[d] || { name: d }).name);
  const list = names.length > 8 ? names.slice(0, 8).join(', ') + `… (+${names.length - 8})` : names.join(', ');
  L.push(`| ${(G.ABILITY_NAME[id] || [id])[0]} | \`${id}\` | ${names.length} | ${list} |`);
}
L.push('');
// Megas y primigenias: habilidades propias sin efecto (si la forma no tiene, usa la normal).
const megaTodo = {};
for (const list of Object.values(G.MEGA || {})) for (const f of list) {
  if (f.ab && !G.Abilities.TABLE[f.ab]) (megaTodo[f.ab] = megaTodo[f.ab] || []).push(f.name);
}
L.push('## Habilidades de megas y primigenias sin efecto');
L.push('');
L.push('| Habilidad | id | Formas |');
L.push('|---|---|---|');
for (const id of Object.keys(megaTodo).sort()) L.push(`| ${(G.ABILITY_NAME[id] || [id])[0]} | \`${id}\` | ${megaTodo[id].join(', ')} |`);
L.push('');
const megaNoSprite = Object.values(G.MEGA || {}).flat().filter(f => !f.spr).map(f => f.name);
L.push(`## Megas sin sprite en SpriteCollab (${megaNoSprite.length})`);
L.push('');
L.push('Usan el sprite del Pokémon normal con un tinte y un aura de mega. Si SpriteCollab las añade, `python tools/fetch_megas.py` las baja solo.');
L.push('');
L.push(megaNoSprite.join(', '));
L.push('');
const out = path.join(ROOT, 'docs', 'habilidades-pendientes.md');
fs.writeFileSync(out, L.join('\r\n'));
console.log(`${covered}/${total} Pokémon con efecto · ${todo.length} habilidades pendientes -> ${path.relative(ROOT, out)}`);
