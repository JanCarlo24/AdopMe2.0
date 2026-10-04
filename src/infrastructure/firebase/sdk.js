// El sitio se sirve como módulos ES, sin empaquetador. El paquete npm `firebase`
// no se puede importar desde ese servidor estático. El SDK modular oficial se
// carga por CDN, con la versión fijada en un solo sitio.
export const FIREBASE_SDK_VERSION = '11.6.0';

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

export function sdkUrl(name) {
  return `${BASE}/firebase-${name}.js`;
}

export async function loadFirebaseSdk() {
  const [app, auth, firestore, storage, analytics] = await Promise.all([
    import(sdkUrl('app')),
    import(sdkUrl('auth')),
    import(sdkUrl('firestore')),
    import(sdkUrl('storage')),
    import(sdkUrl('analytics'))
  ]);
  return { app, auth, firestore, storage, analytics };
}
