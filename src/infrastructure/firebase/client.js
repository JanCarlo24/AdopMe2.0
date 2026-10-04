import { validateFirebaseConfig } from './validate-config.js';
import { loadFirebaseSdk } from './sdk.js';
import { mapFirebaseError } from './errors.js';

let singleton = null;

export function resetFirebaseForTests() {
  singleton = null;
}

export async function initFirebase(config, { loadSdk = loadFirebaseSdk } = {}) {
  if (singleton) return singleton;

  const options = validateFirebaseConfig(config);
  let sdk;
  try {
    sdk = await loadSdk();
  } catch (error) {
    throw mapFirebaseError(Object.assign(new Error('No se pudo cargar el SDK de Firebase.'), { code: 'unavailable', cause: error }));
  }

  const { initializeApp, getApps } = sdk.app;
  const existing = getApps();
  const app = existing.length > 0 ? existing[0] : initializeApp(options);
  const auth = sdk.auth.getAuth(app);
  await sdk.auth.setPersistence(auth, sdk.auth.browserLocalPersistence);
  const db = sdk.firestore.getFirestore(app);
  const storage = sdk.storage.getStorage(app);

  let analytics = null;
  if (sdk.analytics?.isSupported) {
    try {
      if (await sdk.analytics.isSupported()) analytics = sdk.analytics.getAnalytics(app);
    } catch {
      analytics = null;
    }
  }

  singleton = { app, auth, db, storage, analytics, sdk };
  return singleton;
}
