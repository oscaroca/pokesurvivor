#!/usr/bin/env node
/* ============ tickets.js — dar (o quitar) tickets del gacha a un jugador ============
 *
 *   node tools/admin/tickets.js <jugador> <tickets> [--t10 <n>] [--dry]
 *
 *   <jugador>   nombre de la cuenta (con el que entra), su apodo, su correo de
 *               Google o su UID. Se busca en ese orden y se dice cuál se encontró.
 *   <tickets>   tickets normales a sumar (negativo para quitar). 0 si sólo t10.
 *   --t10 <n>   tickets ×10 a sumar.
 *   --dry       sólo enseña lo que haría, sin cambiar nada.
 *
 * Ejemplos:
 *   node tools/admin/tickets.js oscar 50
 *   node tools/admin/tickets.js oscar 0 --t10 2
 *   node tools/admin/tickets.js amigo@gmail.com 20 --dry
 *
 * Necesita la clave de administración del proyecto (NUNCA en el repositorio):
 *   Firebase → Configuración del proyecto → Cuentas de servicio →
 *   Generar nueva clave privada, y guárdala como
 *   ~/.config/pokesurvivor-plus/service-account.json
 *   (o pon su ruta en la variable GOOGLE_APPLICATION_CREDENTIALS).
 * La primera vez: cd tools/admin && npm install
 *
 * Importante: el jugador debe tener el juego CERRADO. El juego guarda una copia
 * en el navegador y, al juntarla con la de la nube, gana la más reciente; por eso
 * el script pone también save.updated a "ahora".
 */
const fs = require('fs'), os = require('os'), path = require('path');
const admin = require('firebase-admin');

const PROJECT = 'pokesurvivor-oscaroca';
const NAME_DOMAIN = 'jugadores.pokesurvivor.net';        // como js/core/db.js (nameToEmail)
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(os.homedir(), '.config', 'pokesurvivor-plus', 'service-account.json');

function usage(msg) {
  if (msg) console.error('✗ ' + msg + '\n');
  console.error('Uso: node tools/admin/tickets.js <jugador> <tickets> [--t10 <n>] [--dry]');
  process.exit(1);
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const i10 = args.indexOf('--t10');
const t10 = i10 >= 0 ? parseInt(args[i10 + 1], 10) : 0;
const rest = args.filter((a, i) => a !== '--dry' && (i10 < 0 || (i !== i10 && i !== i10 + 1)));
const who = rest[0];
const t1 = parseInt(rest[1], 10);
if (!who || !Number.isInteger(t1) || !Number.isInteger(t10)) usage();
if (!t1 && !t10) usage('No hay nada que sumar.');

if (!fs.existsSync(KEY)) usage('No encuentro la clave de administración en ' + KEY + '\n  (Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada)');
const cred = JSON.parse(fs.readFileSync(KEY, 'utf8'));
if (cred.project_id !== PROJECT) usage(`La clave es del proyecto "${cred.project_id}", no de "${PROJECT}".`);
admin.initializeApp({ credential: admin.credential.cert(cred), projectId: PROJECT });
const db = admin.firestore(), auth = admin.auth();

const nameToEmail = n => [...new TextEncoder().encode(n.trim().toLowerCase())].map(b => b.toString(16).padStart(2, '0')).join('') + '@' + NAME_DOMAIN;
const tryGet = p => p.then(u => u).catch(() => null);

/** Busca la cuenta: nombre de cuenta, apodo, correo o UID. */
async function find(q) {
  const byName = await tryGet(auth.getUserByEmail(nameToEmail(q)));
  if (byName) return { uid: byName.uid, how: 'nombre de cuenta' };
  const nick = await db.collection('names').doc(q.trim().toLowerCase()).get();
  if (nick.exists && nick.data().uid) return { uid: nick.data().uid, how: 'apodo' };
  if (q.includes('@')) {
    const byMail = await tryGet(auth.getUserByEmail(q.trim()));
    if (byMail) return { uid: byMail.uid, how: 'correo' };
  }
  const byUid = await tryGet(auth.getUser(q.trim()));
  if (byUid) return { uid: byUid.uid, how: 'UID' };
  return null;
}

(async () => {
  const found = await find(who);
  if (!found) usage(`No encuentro a "${who}" (ni como nombre de cuenta, ni como apodo, ni como correo o UID).`);
  const ref = db.collection('saves').doc(found.uid);
  const res = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || !snap.data().save) throw new Error('Esa cuenta aún no tiene partida en la nube (que entre una vez al juego).');
    const save = snap.data().save;
    const before = Object.assign({ t1: 0, t10: 0 }, save.tickets);
    const after = { t1: Math.max(0, (before.t1 | 0) + t1), t10: Math.max(0, (before.t10 | 0) + t10) };
    if (!dry) {
      tx.update(ref, {
        'save.tickets.t1': after.t1,
        'save.tickets.t10': after.t10,
        'save.updated': Math.max(Date.now(), (save.updated || 0) + 1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return { name: save.name, before, after };
  });
  console.log(`${dry ? '[prueba, sin cambios] ' : ''}${res.name || who} (encontrado por ${found.how}, UID ${found.uid})`);
  console.log(`  tickets: ${res.before.t1} → ${res.after.t1}   ·   tickets ×10: ${res.before.t10} → ${res.after.t10}`);
  if (!dry) console.log('  Hecho. Que abra el juego (si lo tenía abierto, que lo recargue).');
  process.exit(0);
})().catch(e => { console.error('✗ ' + (e.message || e)); process.exit(1); });
