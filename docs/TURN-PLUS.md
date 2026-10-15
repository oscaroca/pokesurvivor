# TURN de Cloudflare para PokéSurvivor Plus+

**Por qué:** el cooperativo conecta los navegadores directamente. Cuando la red no
lo deja (datos móviles, algunos routers), hace falta un servidor TURN que
retransmita. Cloudflare da **1.000 GB gratis al mes** (después, 0,05 $ por GB).

Piezas:
- `cloudflare/turn-worker-plus.js`: un Worker de Cloudflare (gratis) que da claves
  TURN temporales sólo a jugadores con cuenta de `pokesurvivor-oscaroca`.
- `js/net/net.js` (`TURN_URL`): el juego le pide las claves al entrar en una sala.
  Si el Worker no responde, todo sigue como antes (sólo conexión directa).

(`cloudflare/turn-worker.js` es el del juego original: más grande, con contadores
y Durable Objects. No hace falta.)

## Pasos (en https://dash.cloudflare.com, con tu cuenta personal)

### 1. Crear la clave TURN
1. Menú de la izquierda: **Realtime** (puede salir como *Calls*) → **TURN Server**.
2. **Create** → nombre `pokesurvivor-plus` → **Create**.
3. Copia y guarda los dos valores (el API Token sólo se ve una vez):
   - **Turn Token ID**
   - **API Token**

### 2. Crear el Worker
1. **Workers & Pages** → **Create** → **Create Worker** (*Start with Hello World*).
2. Nombre: `pokesurvivor-turn` → **Deploy**.
3. **Edit code**: borra todo, pega el contenido de `cloudflare/turn-worker-plus.js` → **Deploy**.

### 3. Guardar las claves en el Worker
1. En el Worker: **Settings** → **Variables and Secrets** → **Add**.
2. Tipo **Secret**, nombre `TURN_KEY_ID`, valor: el *Turn Token ID* → guardar.
3. **Add** otra vez: tipo **Secret**, nombre `TURN_KEY_API_TOKEN`, valor: el *API Token*.
4. **Deploy** si te lo pide.

### 4. (Opcional) No pasar nunca de lo gratis
Con estos dos secretos más, al llegar a 900 GB en el mes el Worker deja de dar
TURN (sólo STUN) y no se paga nada:
- `ACCOUNT_ID`: el ID de tu cuenta (sale a la derecha en la portada del panel).
- `CF_ANALYTICS_TOKEN`: **My Profile → API Tokens → Create Token → Custom**, con
  permiso **Account → Account Analytics → Read**.

### 5. Conectarlo al juego
La dirección del Worker es `https://pokesurvivor.mailoscaroca.workers.dev/` (en la guía se llamaba `pokesurvivor-turn`; el creado se llama `pokesurvivor`).
Va en `TURN_URL` de `js/net/net.js`; después `node tools/build.js` y subir.

Comprobación rápida: abrir esa dirección en el navegador debe dar
`{"error":"no autorizado"}` (está bien: sin cuenta no da claves).
