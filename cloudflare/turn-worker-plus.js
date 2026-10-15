/* ============ turn-worker-plus.js — claves TURN para PokéSurvivor Plus+ ============
 * Worker de Cloudflare (plan gratuito) para el cooperativo de este fork. Versión
 * reducida de cloudflare/turn-worker.js (el del juego original): SÓLO da claves
 * TURN temporales, y sólo a jugadores con cuenta del proyecto de Firebase
 * pokesurvivor-oscaroca (comprueba su token). Sin contador de cuentas ni de gente
 * en línea, sin Durable Objects.
 *
 * Secretos (Worker -> Settings -> Variables and Secrets, tipo Secret):
 *   TURN_KEY_ID          el "Turn Token ID" de Cloudflare Realtime -> TURN Server
 *   TURN_KEY_API_TOKEN   su "API Token"
 * Opcionales, para no pasar nunca del TURN gratis del mes (1.000 GB):
 *   ACCOUNT_ID           el ID de tu cuenta de Cloudflare
 *   CF_ANALYTICS_TOKEN   un token de API con permiso "Account Analytics: Read"
 * Si están, al llegar a TURN_CAP_GB en el mes se dejan de dar servidores TURN
 * (sólo STUN): el cooperativo sigue para quien pueda conectar directo.
 *
 * GET /budget: ¿está activo el tope y cuántos GB de TURN van este mes? Sin
 * secretos en la respuesta y con caché de 30 min (no gasta consultas aunque
 * alguien lo llame mil veces).
 *
 * El juego lo llama desde js/net/net.js (TURN_URL). Pasos: docs/TURN-PLUS.md.
 */
const PROJECTS = ['pokesurvivor-oscaroca'];
const ORIGINS = ['https://oscaroca-pokesurvivor.vercel.app'];
const TTL = 4 * 3600;                         // segundos que valen las credenciales
const TURN_CAP_GB = 900;                      // margen bajo los 1.000 GB gratis
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let keys = null, keysAt = 0;                  // claves públicas de Google (caché)

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

/** ¿Es un token de Firebase válido de este proyecto? Devuelve el uid o null. */
async function verify(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(new TextDecoder().decode(b64url(parts[0]))); body = JSON.parse(new TextDecoder().decode(b64url(parts[1]))); }
  catch (e) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (head.alg !== 'RS256' || !PROJECTS.includes(body.aud) || body.iss !== 'https://securetoken.google.com/' + body.aud) return null;
  if (!body.sub || body.exp < now || body.iat > now + 300) return null;
  if (!keys || Date.now() - keysAt > 3600e3) {
    const r = await fetch(JWKS);
    keys = (await r.json()).keys; keysAt = Date.now();
  }
  const jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  return ok ? body.sub : null;
}

export default {
  async fetch(req, env) {
    const h = cors(req.headers.get('Origin') || '');
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...h, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (new URL(req.url).pathname === '/budget') {
      const u = await turnUsage(env);
      return json({ capActive: u.configured && u.ok, configured: u.configured, readOk: u.ok,
                    gbThisMonth: u.gb == null ? null : Math.round(u.gb * 1000) / 1000, capGb: TURN_CAP_GB, full: !!u.full,
                    checkedAt: u.at || null });
    }
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ error: 'faltan los secretos TURN_KEY_ID / TURN_KEY_API_TOKEN' }, 500);
    const uid = await verify((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!uid) return json({ error: 'no autorizado' }, 401);
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: TTL })
    });
    if (!r.ok) return json({ error: 'turn ' + r.status }, 502);
    let ice = (await r.json()).iceServers;
    // Cupo gratis del mes casi gastado: sólo STUN (sin TURN, que es lo que se paga).
    if (await turnFull(env)) {
      ice = [].concat(ice).map(s => Object.assign({}, s, { urls: [].concat(s.urls).filter(u => /^stuns?:/.test(u)) }))
        .filter(s => s.urls.length);
    }
    return json({ iceServers: ice, ttl: TTL });
  }
};

/**
 * Gasto de TURN del mes según la API de analíticas de Cloudflare, guardado 30 min
 * en la caché: { configured, ok, gb, full, at }. Si no están los secretos
 * opcionales, o algo falla, nunca corta nada (full: false).
 */
async function turnUsage(env) {
  if (!env.CF_ANALYTICS_TOKEN || !env.ACCOUNT_ID) return { configured: false, ok: false, gb: null, full: false };
  const month = new Date().toISOString().slice(0, 7);
  const cacheKey = new Request('https://turn-budget.internal/v2/' + month);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();
  let res = { configured: true, ok: false, gb: null, full: false, at: new Date().toISOString() };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const query = `{ viewer { accounts(filter: { accountTag: "${env.ACCOUNT_ID}" }) {
      callsTurnUsageAdaptiveGroups(limit: 40, filter: { date_geq: "${month}-01", date_leq: "${today}" }) { sum { egressBytes } } } } }`;
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.CF_ANALYTICS_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const j = await r.json();
    const acc = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
    if (r.ok && acc && !(j.errors && j.errors.length)) {
      const rows = acc.callsTurnUsageAdaptiveGroups || [];
      const gb = rows.reduce((a, x) => a + (x.sum.egressBytes || 0), 0) / 1e9;
      res = { ...res, ok: true, gb, full: gb >= TURN_CAP_GB };
    }
  } catch (e) { /* res.ok = false: no corta nada */ }
  // Si no se pudo leer, sólo 5 min: así, al corregir el token, se nota pronto.
  await cache.put(cacheKey, new Response(JSON.stringify(res), { headers: { 'cache-control': 'max-age=' + (res.ok ? 1800 : 300) } }));
  return res;
}

async function turnFull(env) { return (await turnUsage(env)).full; }
