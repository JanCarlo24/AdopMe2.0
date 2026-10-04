import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedPets } from '../../src/modules/catalog/seed.js';
import { getRecommendedPets, scorePet } from '../../src/modules/compatibility/service.js';
import { validateAuthAccount } from '../../src/shared/validators/auth.js';
import { createMemoryStorage } from '../../src/infrastructure/storage/memory-storage.js';
import { createJsonStore } from '../../src/infrastructure/storage/json-store.js';
import { createBrowserStorage } from '../../src/infrastructure/storage/browser-storage.js';
import { createAccountRepository, createSessionRepository } from '../../src/modules/auth/repository.js';
import { createAuthService } from '../../src/modules/auth/service.js';
import { appConfig } from '../../config/app.config.js';
import { escapeHtml } from '../../src/shared/utils/html.js';
import { ValidationError } from '../../src/shared/errors.js';

test('sin preferencias el match conserva el orden histórico y con test prioriza gatos de departamento', () => {
  const available = seedPets.map((pet) => ({ ...pet, estado: 'Disponible' }));
  assert.deepEqual(getRecommendedPets(available, null).map((pet) => pet.nombre), ['Milo', 'Toby', 'Nala']);
  assert.equal(scorePet(available[0], null), 0);

  const preferences = { hogar: 'departamento', tiempo: 'poco', experiencia: 'primera', preferencia: 'gato' };
  assert.equal(scorePet(available.find((pet) => pet.nombre === 'Luna'), preferences), 99);
  assert.equal(scorePet(available.find((pet) => pet.nombre === 'Milo'), preferences), 66);
  assert.deepEqual(
    getRecommendedPets(available, preferences).map((pet) => pet.nombre),
    ['Luna', 'Nala', 'Mora']
  );
});

test('la validación de cuentas distingue login y registro', () => {
  assert.equal(validateAuthAccount({ correo: 'mal', password: '1234567' }, 'login').valid, false);
  assert.match(validateAuthAccount({ nombre: 'Ana', correo: 'ana@correo.com', password: 'corta' }, 'register').message, /mayúsculas/);
  const ok = validateAuthAccount({ nombre: ' Ana Pérez ', correo: 'Ana@Correo.com', password: 'Clave1234' }, 'register');
  assert.equal(ok.valid, true);
  assert.equal(ok.data.correo, 'ana@correo.com');
  assert.equal(ok.data.nombre, 'Ana Pérez');
});

test('registrar e iniciar sesión guarda hash y no la contraseña', async () => {
  const memory = createMemoryStorage();
  const sessions = createMemoryStorage();
  const auth = createAuthService({
    accounts: createAccountRepository(createJsonStore(memory, 'adopme-accounts')),
    session: createSessionRepository(createBrowserStorage(sessions), 'adopme-session'),
    crypto: globalThis.crypto,
    password: { iterations: 1000, bits: 256, saltBytes: 16 }
  });

  const account = await auth.register({ nombre: 'Ana Pérez', correo: 'Ana@Correo.com', password: 'Clave1234' });
  assert.equal(account.password, undefined);
  assert.equal(account.passwordHash.length, 64);
  assert.equal(auth.current().correo, 'ana@correo.com');
  auth.logout();
  assert.equal(auth.current(), null);

  await assert.rejects(auth.login({ correo: 'ana@correo.com', password: 'Clave1235' }), ValidationError);
  const logged = await auth.login({ correo: 'ana@correo.com', password: 'Clave1234' });
  assert.equal(logged.nombre, 'Ana Pérez');
  await assert.rejects(auth.register({ nombre: 'Ana Pérez', correo: 'ana@correo.com', password: 'Clave1234' }), /Ya existe/);
});

test('las iteraciones de producción siguen en 120000 para no invalidar cuentas guardadas', () => {
  assert.equal(appConfig.password.iterations, 120000);
  assert.equal(appConfig.keys.adoptions, 'adopme-adoptions');
  assert.equal(appConfig.keys.session, 'adopme-session');
});

test('escapeHtml neutraliza marcado en texto y atributos', () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml(`a&b`), 'a&amp;b');
});
