import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStorage } from '../../src/infrastructure/storage/memory-storage.js';
import { createBrowserStorage } from '../../src/infrastructure/storage/browser-storage.js';
import { createJsonStore } from '../../src/infrastructure/storage/json-store.js';
import { StorageError } from '../../src/shared/errors.js';
import { createPetRepository } from '../../src/modules/catalog/repository.js';
import { seedPets } from '../../src/modules/catalog/seed.js';
import { createAdoptionRepository } from '../../src/modules/adoptions/repository.js';
import { createAdoptionService } from '../../src/modules/adoptions/service.js';

test('el almacén en memoria cumple el mismo contrato que el del navegador', () => {
  const memory = createMemoryStorage({ 'adopme-theme': 'dark' });
  assert.equal(memory.getItem('adopme-theme'), 'dark');
  assert.equal(memory.getItem('ausente'), null);
  memory.setItem('adopme-theme', 'light');
  assert.equal(memory.getItem('adopme-theme'), 'light');
  memory.removeItem('adopme-theme');
  assert.equal(memory.getItem('adopme-theme'), null);
});

test('un JSON inválido no rompe la lectura y la cuota se traduce a StorageError', () => {
  const memory = createMemoryStorage({ 'adopme-pets': '{roto', 'adopme-adoptions': 'null' });
  const pets = createJsonStore(memory, 'adopme-pets');
  const adoptions = createJsonStore(memory, 'adopme-adoptions');
  assert.equal(pets.read().ok, false);
  assert.equal(adoptions.read().ok, true);
  assert.equal(adoptions.read().value, null);

  const full = {
    getItem() { return null; },
    setItem() {
      const error = new Error('full');
      error.name = 'QuotaExceededError';
      throw error;
    },
    removeItem() {}
  };
  const storage = createBrowserStorage(full);
  assert.throws(() => storage.setItem('adopme-favorites', '[]'), (error) => {
    return error instanceof StorageError && error.code === 'STORAGE_QUOTA';
  });
});

test('el repositorio de mascotas vuelve a la semilla si el JSON no es un array', () => {
  const memory = createMemoryStorage({ 'adopme-pets': '{"nombre":"x"}' });
  const repository = createPetRepository(createJsonStore(memory, 'adopme-pets'), seedPets);
  const pets = repository.load();
  assert.equal(pets.length, 6);
  assert.equal(pets[0].nombre, 'Milo');
  assert.equal(pets[0].estado, 'Disponible');
  assert.equal(seedPets[0].estado, undefined);
});

test('las solicitudes antiguas reciben folio y estado sin perder el resto de campos', () => {
  const memory = createMemoryStorage({
    'adopme-adoptions': JSON.stringify([{ mascotaId: 1, nombreAdoptante: 'Ana', correo: 'ana@correo.com' }])
  });
  const repository = createAdoptionRepository(createJsonStore(memory, 'adopme-adoptions'));
  const service = createAdoptionService(repository, { createId: () => 'folio-1', now: () => '2020-01-01T00:00:00.000Z' });
  const migrated = service.migrate();
  assert.equal(migrated[0].solicitudId, 'folio-1');
  assert.equal(migrated[0].estadoSolicitud, 'Recibida');
  assert.equal(migrated[0].nombreAdoptante, 'Ana');
  assert.equal(service.list()[0].correo, 'ana@correo.com');

  const saved = service.save({
    mascotaId: '2',
    nombreAdoptante: 'Luis',
    correo: 'luis@correo.com',
    telefono: '555',
    tipoVivienda: 'Casa',
    otrasMascotas: 'No',
    experiencia: 'Sí, actualmente',
    cuentaCorreo: 'luis@correo.com',
    solicitudId: 'folio-2',
    estadoSolicitud: 'Recibida'
  });
  assert.equal(saved.fecha, '2020-01-01T00:00:00.000Z');
  assert.equal(service.list().length, 2);
  assert.equal(service.update('folio-2', { estadoSolicitud: 'En revisión' }).estadoSolicitud, 'En revisión');
  assert.equal(service.update('no-existe', { estadoSolicitud: 'Aprobada' }), null);
});

test('guardar una solicitud sin sesión falla y no escribe', () => {
  const memory = createMemoryStorage();
  const service = createAdoptionService(
    createAdoptionRepository(createJsonStore(memory, 'adopme-adoptions')),
    { createId: () => 'x' }
  );
  assert.throws(() => service.save({ nombreAdoptante: 'Ana' }), /Inicia sesión/);
  assert.equal(memory.getItem('adopme-adoptions'), null);
});
