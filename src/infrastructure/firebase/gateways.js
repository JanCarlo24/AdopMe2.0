import { mapFirebaseError } from './errors.js';

async function run(action) {
  try {
    return await action();
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export function createAuthGateway(client) {
  const { auth, sdk } = client;
  return {
    async createUser(email, password) {
      const credential = await run(() => sdk.auth.createUserWithEmailAndPassword(auth, email, password));
      return { uid: credential.user.uid, email: credential.user.email };
    },
    async signIn(email, password) {
      const credential = await run(() => sdk.auth.signInWithEmailAndPassword(auth, email, password));
      return { uid: credential.user.uid, email: credential.user.email };
    },
    async signOut() {
      await run(() => sdk.auth.signOut(auth));
    },
    async sendPasswordResetEmail(email) {
      await run(() => sdk.auth.sendPasswordResetEmail(auth, email));
    },
    onAuthStateChanged(listener) {
      return sdk.auth.onAuthStateChanged(auth, (user) => {
        listener(user ? { uid: user.uid, email: user.email } : null);
      });
    }
  };
}

export function createStorageGateway(client) {
  const { storage, sdk } = client;
  return {
    async upload({ path, file, contentType }) {
      const ref = sdk.storage.ref(storage, path);
      await run(() => sdk.storage.uploadBytes(ref, file, { contentType }));
      return run(() => sdk.storage.getDownloadURL(ref));
    }
  };
}
