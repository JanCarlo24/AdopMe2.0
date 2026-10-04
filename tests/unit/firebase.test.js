import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appConfig } from '../../config/app.config.js';
import { selectBackend, withTimeout } from '../../src/core/backend.js';
import { initFirebase, resetFirebaseForTests } from '../../src/infrastructure/firebase/client.js';
import { createMemoryDocumentStore } from '../../src/infrastructure/firebase/document-store.js';
import { mapFirebaseError } from '../../src/infrastructure/firebase/errors.js';
import { assertImageFile, petPhotoPath } from '../../src/infrastructure/firebase/media.js';
import { planCatalogSeed } from '../../src/infrastructure/firebase/seed-plan.js';
import { validateFirebaseConfig } from '../../src/infrastructure/firebase/validate-config.js';
import { createMemoryStorage } from '../../src/infrastructure/storage/memory-storage.js';
import { createFirebaseAuthService } from '../../src/modules/remote/auth-service.js';
import { createRemoteCatalogService } from '../../src/modules/remote/catalog-service.js';
import {
  createRemoteAdoptionRepository,
  createRemoteFavoritesRepository,
  createRemotePetRepository,
  createUserRepository,
  profileDocument
} from '../../src/modules/remote/repositories.js';
import {
  createRemoteAdoptionService,
  createRemoteCompatibilityService,
  createRemoteFavoritesService
} from '../../src/modules/remote/user-data-service.js';
import { AuthError, ConnectionError, ValidationError } from '../../src/shared/errors.js';

const validConfig = {
  enabled: true,
  apiKey: 'key',
  authDomain: 'adopme-712e6.firebaseapp.com',
  projectId: 'adopme-712e6',
  storageBucket: 'adopme-712e6.firebasestorage.app',
  messagingSenderId: '952364050684',
  appId: '1:952364050684:web:abc'
};

function fakeSdk({ analyticsSupported = false, existing = false } = {}) {
  const apps = existing ? [{ name: 'existing' }] : [];
  const calls = { initializeApp: 0, getAnalytics: 0, setPersistence: 0 };
  return {
    calls,
    apps,
    app: {
      getApps: () => apps,
      initializeApp(config) {
        calls.initializeApp += 1;
        const app = { config };
        apps.push(app);
        return app;
      }
    },
    auth: {
      getAuth: () => ({ kind: 'auth' }),
      setPersistence: async () => {
        calls.setPersistence += 1;
      },
      browserLocalPersistence: 'local'
    },
    firestore: {
      getFirestore: () => ({ kind: 'db' })
    },
    storage: {
      getStorage: () => ({ kind: 'storage' })
    },
    analytics: {
      isSupported: async () => analyticsSupported,
      getAnalytics() {
        calls.getAnalytics += 1;
        return { kind: 'analytics' };
      }
    }
  };
}

function fakeGateway() {
  let user = null;
  const listeners = new Set();
  const resetEmails = [];
  function emit() {
    for (const listener of listeners) listener(user);
  }
  return {
    resetEmails,
    async createUser(email, password) {
      if (password === 'Existe123') {
        const error = new Error('exists');
        error.code = 'auth/email-already-in-use';
        throw error;
      }
      user = { uid: 'uid-1', email };
      emit();
      return user;
    },
    async signIn(email, password) {
      if (password !== 'Clave1234') {
        const error = new Error('bad');
        error.code = 'auth/invalid-credential';
        throw error;
      }
      user = { uid: 'uid-1', email };
      emit();
      return user;
    },
    async signOut() {
      user = null;
      emit();
    },
    async sendPasswordResetEmail(email) {
      if (email === 'ausente@correo.com') {
        const error = new Error('missing');
        error.code = 'auth/user-not-found';
        throw error;
      }
      if (email === 'red@correo.com') {
        const error = new Error('offline');
        error.code = 'auth/network-request-failed';
        throw error;
      }
      resetEmails.push(email);
    },
    onAuthStateChanged(listener) {
      listeners.add(listener);
      listener(user);
      return () => listeners.delete(listener);
    }
  };
}

function profileStore() {
  const saved = new Map();
  return {
    saved,
    async get(uid) {
      return saved.get(uid) || null;
    },
    async save(uid, profile) {
      if ('password' in profile || 'passwordHash' in profile) {
        throw new ValidationError('No se guarda la contraseña.');
      }
      saved.set(uid, profile);
    }
  };
}

test('un arranque de Firebase que no responde cae por tiempo', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 20),
    (error) => error instanceof ConnectionError && /navegador/.test(error.message)
  );
});

test('la configuración exige las claves públicas y rechaza marcadores de ejemplo', () => {
  assert.equal(validateFirebaseConfig(validConfig).projectId, 'adopme-712e6');
  assert.equal('enabled' in validateFirebaseConfig({ ...validConfig, enabled: true }), false);
  assert.throws(() => validateFirebaseConfig({ ...validConfig, apiKey: 'TU_API_KEY' }), /apiKey/);
  assert.throws(() => validateFirebaseConfig(null), /Falta la configuración/);
});

test('el modo local gana a una config válida y una config rota no intenta Firebase', () => {
  const storage = createMemoryStorage({ 'adopme-backend': 'local' });
  assert.equal(selectBackend({ firebaseConfig: validConfig, storage, backendKey: 'adopme-backend' }).mode, 'local');
  assert.equal(selectBackend({ firebaseConfig: { ...validConfig, enabled: false }, storage: createMemoryStorage(), backendKey: 'adopme-backend' }).mode, 'local');
  const broken = selectBackend({
    firebaseConfig: { enabled: true, apiKey: '' },
    storage: createMemoryStorage(),
    backendKey: 'adopme-backend'
  });
  assert.equal(broken.mode, 'local');
  assert.match(broken.notice, /no es válida/);
  assert.equal(selectBackend({ firebaseConfig: validConfig, storage: createMemoryStorage(), backendKey: 'adopme-backend' }).mode, 'firebase');
});

test('initializeApp ocurre una vez y Analytics solo si el navegador lo soporta', async () => {
  resetFirebaseForTests();
  const sdk = fakeSdk();
  const loadSdk = async () => sdk;
  await assert.rejects(initFirebase({ enabled: true }, { loadSdk }), ValidationError);
  assert.equal(sdk.calls.initializeApp, 0);

  const first = await initFirebase(validConfig, { loadSdk });
  const second = await initFirebase(validConfig, { loadSdk: async () => { throw new Error('no repetir'); } });
  assert.equal(first, second);
  assert.equal(sdk.calls.initializeApp, 1);
  assert.equal(sdk.calls.setPersistence, 1);
  assert.equal(first.analytics, null);

  resetFirebaseForTests();
  const withAnalytics = fakeSdk({ analyticsSupported: true });
  const ready = await initFirebase(validConfig, { loadSdk: async () => withAnalytics });
  assert.equal(ready.analytics.kind, 'analytics');
  assert.equal(withAnalytics.calls.getAnalytics, 1);

  resetFirebaseForTests();
  const occupied = fakeSdk({ existing: true });
  await initFirebase(validConfig, { loadSdk: async () => occupied });
  assert.equal(occupied.calls.initializeApp, 0);
});

test('los errores de Firebase se leen en español y la semilla no pisa datos remotos', () => {
  assert.equal(mapFirebaseError({ code: 'auth/wrong-password' }).message, 'No encontramos esa cuenta o la contraseña no coincide.');
  assert.ok(mapFirebaseError({ code: 'auth/network-request-failed' }) instanceof ConnectionError);
  assert.equal(mapFirebaseError(new ValidationError('dato')).message, 'dato');
  assert.deepEqual(planCatalogSeed({ remoteCount: 2, confirm: true }), { write: false, reason: 'remote-not-empty' });
  assert.deepEqual(planCatalogSeed({ remoteCount: 0, confirm: false }), { write: false, reason: 'confirmation-required' });
  assert.deepEqual(planCatalogSeed({ remoteCount: 0, confirm: true }), { write: true, reason: 'empty-confirmed' });
  assert.throws(() => assertImageFile({ type: 'image/gif', size: 10 }, appConfig.photo), /JPEG/);
  assert.throws(() => assertImageFile({ type: 'image/png', size: appConfig.photo.maxBytes + 1 }, appConfig.photo), /2 MB/);
  assert.equal(petPhotoPath({ uid: 'abc', petId: 'pet-1', fileName: '../foto linda.png' }), 'pets/abc/pet-1/fotolinda.png');
});

test('el perfil remoto no acepta contraseñas y el catálogo público oculta adoptados', async () => {
  const store = createMemoryDocumentStore();
  const users = createUserRepository(store);
  await users.save('uid-1', { nombre: 'Ana Pérez', correo: 'ana@correo.com', creado: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(await users.get('uid-1'), {
    nombre: 'Ana Pérez',
    correo: 'ana@correo.com',
    creado: '2026-01-01T00:00:00.000Z'
  });
  assert.throws(() => profileDocument({ nombre: 'Ana', correo: 'ana@correo.com', password: 'x' }), /contraseña/);

  const pets = createRemotePetRepository(store);
  await pets.create({
    id: 'pet-1',
    nombre: 'Canela',
    especie: 'Perro',
    raza: 'Mestizo',
    edad: '2 años',
    categoria: 'Perros',
    foto: 'https://images.unsplash.com/photo-1',
    descripcion: 'Tranquila',
    estado: 'Disponible',
    ownerUid: 'uid-1',
    creado: '2026-01-02T00:00:00.000Z'
  });
  await pets.create({
    id: 'pet-2',
    nombre: 'Sol',
    especie: 'Gato',
    raza: 'Doméstico',
    edad: '4 años',
    categoria: 'Gatos',
    foto: 'https://images.unsplash.com/photo-2',
    descripcion: 'Ya tiene hogar',
    estado: 'Adoptado',
    ownerUid: 'uid-1',
    creado: '2026-01-03T00:00:00.000Z'
  });
  assert.deepEqual((await pets.listPublic()).map((pet) => pet.nombre), ['Canela']);
  assert.equal((await pets.listAll()).length, 2);
  await pets.update('pet-1', { estado: 'En proceso' });
  assert.equal((await pets.listPublic())[0].estado, 'En proceso');
  await pets.remove('pet-1');
  assert.equal((await pets.listPublic()).length, 0);

  const favorites = createRemoteFavoritesRepository(store);
  await favorites.save('uid-1', ['pet-2']);
  assert.deepEqual(await favorites.load('uid-1'), ['pet-2']);

  const adoptions = createRemoteAdoptionRepository(store);
  await adoptions.create({
    solicitudId: 'sol-1',
    ownerUid: 'uid-1',
    cuentaCorreo: 'ana@correo.com',
    estadoSolicitud: 'Recibida'
  });
  assert.equal((await adoptions.listByOwner('uid-1'))[0].solicitudId, 'sol-1');
  assert.equal((await adoptions.listByOwner('otro')).length, 0);
});

test('auth remoto registra, entra, sale y restablece sin guardar la contraseña', async () => {
  const gateway = fakeGateway();
  const profiles = profileStore();
  const admins = { async isAdmin(uid) { return uid === 'uid-1' && profiles.saved.get(uid)?.admin === true; } };
  const auth = createFirebaseAuthService({ gateway, profiles, admins });
  await auth.whenReady();
  assert.equal(auth.current(), null);

  const account = await auth.register({ nombre: 'Ana Pérez', correo: 'Ana@Correo.com', password: 'Clave1234' });
  assert.equal(account.correo, 'ana@correo.com');
  assert.equal(account.uid, 'uid-1');
  assert.equal(account.password, undefined);
  assert.equal(account.passwordHash, undefined);
  assert.equal(profiles.saved.get('uid-1').password, undefined);
  assert.equal(auth.canManageRefuge(), false);

  await auth.logout();
  assert.equal(auth.current(), null);

  await assert.rejects(auth.login({ correo: 'ana@correo.com', password: 'Clave1235' }), (error) => {
    assert.ok(error instanceof AuthError);
    assert.match(error.message, /no coincide/);
    return true;
  });
  const logged = await auth.login({ correo: 'ana@correo.com', password: 'Clave1234' });
  assert.equal(logged.nombre, 'Ana Pérez');

  await auth.resetPassword('ausente@correo.com');
  await assert.rejects(auth.resetPassword('red@correo.com'), ConnectionError);
  await assert.rejects(auth.resetPassword('mal'), ValidationError);
  await auth.resetPassword('ana@correo.com');
  assert.deepEqual(gateway.resetEmails, ['ana@correo.com']);
  await assert.rejects(auth.register({ nombre: 'Ana Pérez', correo: 'ana@correo.com', password: 'Existe123' }), /Ya existe/);
  auth.destroy();
});

test('servicios remotos usan el repositorio inyectado y no copian la semilla', async () => {
  const store = createMemoryDocumentStore();
  const repository = createRemotePetRepository(store);
  const session = { uid: 'uid-1', nombre: 'Ana', correo: 'ana@correo.com' };
  let admin = true;
  const auth = {
    current: () => session,
    canManageRefuge: () => admin
  };
  const uploads = [];
  const catalog = createRemoteCatalogService({
    repository,
    createId: () => 'pet-9',
    auth,
    photoLimits: appConfig.photo,
    uploader: {
      async upload(file) {
        uploads.push(file.path);
        return 'https://firebasestorage.googleapis.com/v0/b/adopme/o/foto.jpg?alt=media';
      }
    }
  });

  assert.equal((await catalog.hydrate()).source, 'seed');
  assert.equal(catalog.getPets().some((pet) => pet.nombre === 'Milo'), true);
  await assert.rejects(catalog.setStatus(1, 'En proceso', appConfig.petStatuses), /demostración/);

  const created = await catalog.addPet({
    nombre: 'Canela',
    especie: 'Perro',
    raza: 'Mestizo',
    edad: '2 años',
    foto: '',
    descripcion: 'Tranquila',
    fotoArchivo: { type: 'image/webp', size: 1200, name: 'canela.webp' }
  });
  assert.equal(created.ownerUid, 'uid-1');
  assert.equal(created.foto.startsWith('https://'), true);
  assert.equal(uploads[0], 'pets/uid-1/pet-9/canela.webp');
  assert.equal(catalog.isShowingSeed(), false);
  assert.equal(catalog.getPets().some((pet) => pet.nombre === 'Milo'), false);
  assert.equal((await catalog.setStatus('pet-9', 'En proceso', appConfig.petStatuses)).estado, 'En proceso');

  admin = false;
  await assert.rejects(catalog.addPet({
    nombre: 'Otra',
    especie: 'Gato',
    raza: 'Doméstico',
    edad: '1 año',
    foto: 'https://images.unsplash.com/photo-1',
    descripcion: 'Dulce'
  }), /refugio/);

  const favorites = createRemoteFavoritesService(createRemoteFavoritesRepository(store), auth);
  await favorites.hydrate();
  await favorites.toggle('pet-9');
  await favorites.toggle('pet-9');
  await favorites.toggle('pet-2');
  assert.deepEqual(favorites.list(), ['pet-2']);

  const compatibility = createRemoteCompatibilityService({
    async load() { return null; },
    async save(uid, value) { savedPrefs = { uid, value }; }
  }, auth);
  let savedPrefs = null;
  await compatibility.save({ hogar: 'departamento', tiempo: 'poco', experiencia: 'primera', preferencia: 'gato' });
  assert.equal(savedPrefs.uid, 'uid-1');
  assert.equal(compatibility.score({ especie: 'Gato', edad: '1 año', tamano: 'Pequeño' }) > 60, true);

  const adoptions = createRemoteAdoptionService(createRemoteAdoptionRepository(store), auth, {
    now: () => '2026-04-01T00:00:00.000Z'
  });
  const entry = await adoptions.save({
    solicitudId: 'sol-9',
    mascotaId: 'pet-9',
    mascotaNombre: 'Canela',
    nombreAdoptante: 'Ana Pérez',
    correo: 'ana@correo.com',
    telefono: '555',
    tipoVivienda: 'Casa',
    otrasMascotas: 'No',
    experiencia: 'Sí, actualmente',
    mensaje: 'Hola',
    consentimiento: 'on',
    cuentaCorreo: 'ana@correo.com',
    estadoSolicitud: 'Recibida'
  });
  assert.equal(entry.ownerUid, 'uid-1');
  assert.equal(entry.consentimiento, true);
  assert.equal(entry.password, undefined);
  assert.equal(adoptions.forAccount('ana@correo.com').length, 1);
  admin = false;
  await assert.rejects(adoptions.update('sol-9', { estadoSolicitud: 'Aprobada' }), /refugio/);
});
