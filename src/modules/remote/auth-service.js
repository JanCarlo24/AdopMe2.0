import { AuthError, ValidationError } from '../../shared/errors.js';
import { isValidEmail, validateAuthAccount } from '../../shared/validators/auth.js';
import { mapFirebaseError } from '../../infrastructure/firebase/errors.js';

function nombreFromEmail(email) {
  const local = String(email || '').split('@')[0];
  return local || 'Cuenta';
}

export function createFirebaseAuthService({ gateway, profiles, admins }) {
  let session = null;
  let admin = false;
  let explicitSignOut = false;
  let ready = false;
  let resolveReady = () => {};
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const listeners = new Set();
  let seq = 0;
  let gate = Promise.resolve();
  let unsubscribe = () => {};
  let started = false;
  const waiters = new Set();

  function notifyWaiters() {
    for (const waiter of [...waiters]) waiter();
  }

  function emit(reason) {
    seq += 1;
    const event = {
      seq,
      reason,
      user: session ? { ...session } : null
    };
    for (const listener of listeners) listener(event);
    notifyWaiters();
    return event;
  }

  async function applyUser(user) {
    await gate;
    if (!user) {
      const reason = explicitSignOut ? 'explicit' : session ? 'expired' : 'signed-out';
      explicitSignOut = false;
      session = null;
      admin = false;
      return reason;
    }

    const profile = await profiles.get(user.uid);
    session = {
      uid: user.uid,
      correo: user.email,
      nombre: profile?.nombre || nombreFromEmail(user.email)
    };
    admin = await admins.isAdmin(user.uid);
    return 'signed-in';
  }

  function ensure() {
    if (started) return;
    started = true;
    unsubscribe = gateway.onAuthStateChanged((user) => {
      applyUser(user)
        .then((reason) => {
          if (!ready) {
            ready = true;
            resolveReady(session);
          }
          emit(reason);
        })
        .catch(() => {
          if (!ready) {
            ready = true;
            resolveReady(null);
          }
          emit('error');
        });
    });
  }

  function waitFor(predicate) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (!predicate()) return;
        waiters.delete(check);
        resolve();
      };
      waiters.add(check);
    });
  }

  return {
    whenReady() {
      ensure();
      return readyPromise;
    },
    subscribe(listener) {
      ensure();
      const since = seq;
      const wrapped = (event) => {
        if (event.seq <= since) return;
        listener(event);
      };
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
    current() {
      return session ? { ...session } : null;
    },
    canManageRefuge() {
      return admin;
    },
    async register({ nombre, correo, password }) {
      const validation = validateAuthAccount({ nombre, correo, password }, 'register');
      if (!validation.valid) throw new ValidationError(validation.message);
      ensure();

      let release = () => {};
      gate = new Promise((resolve) => {
        release = resolve;
      });
      let created = null;
      try {
        created = await gateway.createUser(validation.data.correo, validation.data.password);
        const creado = new Date().toISOString();
        await profiles.save(created.uid, {
          nombre: validation.data.nombre,
          correo: validation.data.correo,
          creado
        });
        release();
        gate = Promise.resolve();
        await waitFor(() => session?.uid === created.uid);
        return this.current();
      } catch (error) {
        release();
        gate = Promise.resolve();
        if (created) {
          try {
            await gateway.signOut();
          } catch {
            // Si el perfil no se guardó, no dejamos la sesión a medias.
          }
        }
        throw mapFirebaseError(error);
      }
    },
    async login({ correo, password }) {
      const validation = validateAuthAccount({ correo, password }, 'login');
      if (!validation.valid) throw new ValidationError(validation.message);
      ensure();
      try {
        const signed = await gateway.signIn(validation.data.correo, validation.data.password);
        await waitFor(() => session?.uid === signed.uid);
        return this.current();
      } catch (error) {
        throw mapFirebaseError(error);
      }
    },
    async logout() {
      explicitSignOut = true;
      try {
        await gateway.signOut();
        await waitFor(() => session === null);
      } catch (error) {
        explicitSignOut = false;
        throw mapFirebaseError(error);
      }
    },
    async resetPassword(correo) {
      const email = String(correo || '').trim().toLowerCase();
      if (!isValidEmail(email)) throw new ValidationError('Introduce un correo electrónico válido.');
      try {
        await gateway.sendPasswordResetEmail(email);
      } catch (error) {
        const mapped = mapFirebaseError(error);
        if (mapped.code === 'auth/user-not-found') return;
        throw mapped;
      }
    },
    destroy() {
      unsubscribe();
      unsubscribe = () => {};
      listeners.clear();
    }
  };
}

export function sessionExpiredMessage() {
  return new AuthError('Tu sesión expiró. Vuelve a iniciar sesión.', { code: 'auth/user-token-expired' }).message;
}
