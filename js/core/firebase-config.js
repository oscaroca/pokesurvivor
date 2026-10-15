/* ============ firebase-config.js — conexión con tu proyecto de Firebase ============
 * Pega aquí la configuración de tu app web de Firebase (Consola de Firebase >
 * Configuración del proyecto > Tus apps > SDK setup and configuration > Config).
 * Los pasos completos están en docs/FIREBASE.md.
 *
 * Estos datos NO son secretos: Firebase los diseña para ir en la web. Lo que
 * protege las partidas son las reglas de Firestore (firestore.rules).
 *
 * Si se pone a null, el juego funciona en modo local (sólo en el navegador).
 */
// PokéSurvivor Plus+ (fork de oscaroca): proyecto propio pokesurvivor-oscaroca (plan
// Spark, gratis). Autenticación normal, SIN Identity Platform: no pulsar nunca
// "Actualizar a Identity Platform" en la consola, que cobra por usuario.
G.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCvRT2FmCh8Pr95v-REPCRkx7zlDWAWX7Q',
  authDomain: 'pokesurvivor-oscaroca.firebaseapp.com',
  projectId: 'pokesurvivor-oscaroca',
  storageBucket: 'pokesurvivor-oscaroca.firebasestorage.app',
  messagingSenderId: '471351636400',
  appId: '1:471351636400:web:3d39752520069873f76675',
  databaseURL: 'https://pokesurvivor-oscaroca-default-rtdb.europe-west1.firebasedatabase.app'
};

/* Ejemplo de cómo debe quedar:
G.FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
};
*/
