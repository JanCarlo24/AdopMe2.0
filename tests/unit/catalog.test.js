import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedPets } from '../../src/modules/catalog/seed.js';
import { filterCatalog, inferAgeGroup, inferPetSize, resultsLabel, searchAndFilter } from '../../src/modules/catalog/model.js';
import { createMemoryStorage } from '../../src/infrastructure/storage/memory-storage.js';
import { createJsonStore } from '../../src/infrastructure/storage/json-store.js';
import { createPetRepository } from '../../src/modules/catalog/repository.js';
import { createCatalogService } from '../../src/modules/catalog/service.js';
import { createFavoritesRepository } from '../../src/modules/favorites/repository.js';
import { createFavoritesService } from '../../src/modules/favorites/service.js';
import { StorageError } from '../../src/shared/errors.js';
import { computeImpactStats } from '../../src/modules/stats/service.js';

test('inferir edad y tamaño conserva las reglas anteriores', () => {
  assert.equal(inferAgeGroup('5 meses'), 'Cachorro');
  assert.equal(inferAgeGroup('8 meses'), 'Adulto');
  assert.equal(inferAgeGroup('1 año'), 'Cachorro');
  assert.equal(inferAgeGroup('8 años'), 'Senior');
  assert.equal(inferAgeGroup('3 años'), 'Adulto');
  assert.equal(inferPetSize({ especie: 'Gato' }), 'Pequeño');
  assert.equal(inferPetSize({ especie: 'Perro', raza: 'Labrador mestizo' }), 'Grande');
  assert.equal(inferPetSize({ especie: 'Perro', raza: 'Mestizo' }), 'Mediano');
});

test('buscar y filtrar el catálogo no incluye adoptados y respeta favoritos', () => {
  const pets = seedPets.map((pet) => ({ ...pet, estado: pet.id === 3 ? 'Adoptado' : 'Disponible' }));
  const byName = searchAndFilter(pets, 'lun', 'Todas').map((pet) => pet.nombre);
  assert.deepEqual(byName, ['Luna']);
  const dogs = filterCatalog(pets, {
    term: '',
    category: 'Perros',
    age: 'Todos',
    size: 'Todos',
    savedOnly: false,
    isSaved: () => false
  }).map((pet) => pet.nombre);
  assert.deepEqual(dogs, ['Milo', 'Bruno']);
  assert.equal(resultsLabel(dogs), '2 compañeros disponibles');
  assert.equal(resultsLabel([{ estado: 'Disponible' }]), '1 compañero disponible');
  assert.equal(resultsLabel([{ estado: 'Disponible' }, { estado: 'En proceso' }]), '1 disponibles · 1 en proceso');
});

test('publicar, cambiar estado y borrar pasa por el repositorio inyectado', () => {
  const memory = createMemoryStorage();
  const service = createCatalogService({
    repository: createPetRepository(createJsonStore(memory, 'adopme-pets'), seedPets),
    createId: () => 'nueva-1'
  });
  const created = service.addPet({
    nombre: '<Canela>',
    especie: 'Perro',
    raza: 'Mestizo',
    edad: '2 años',
    foto: 'https://images.unsplash.com/photo-1517849845537-4d257902454a',
    descripcion: 'Tranquila'
  });
  assert.equal(created.id, 'nueva-1');
  assert.equal(created.categoria, 'Perros');
  assert.equal(service.getPets()[0].nombre, '<Canela>');
  assert.equal(JSON.parse(memory.getItem('adopme-pets'))[0].id, 'nueva-1');

  assert.equal(service.setStatus('nueva-1', 'En proceso', ['Disponible', 'En proceso', 'Adoptado']).estado, 'En proceso');
  assert.equal(service.setStatus('nueva-1', 'Hack', ['Disponible', 'En proceso', 'Adoptado']), null);
  assert.equal(service.remove('nueva-1').nombre, '<Canela>');
  assert.equal(service.getPetById('nueva-1'), null);
  assert.equal(service.getPets()[0].nombre, 'Milo');
});

test('si el almacenamiento rechaza la escritura, el catálogo no se queda a medias', () => {
  const memory = createMemoryStorage();
  const base = createJsonStore(memory, 'adopme-pets');
  let fail = false;
  const store = {
    read: () => base.read(),
    write(value) {
      if (fail) throw new StorageError('lleno', { code: 'STORAGE_QUOTA' });
      base.write(value);
    }
  };
  const service = createCatalogService({
    repository: createPetRepository(store, seedPets),
    createId: () => 'id'
  });
  fail = true;
  assert.throws(() => service.addPet({
    nombre: 'Canela',
    especie: 'Gato',
    raza: 'Doméstico',
    edad: '1 año',
    foto: 'http://inseguro.example/foto.jpg',
    descripcion: 'Dulce'
  }), /https/);
  assert.equal(service.getPets().some((pet) => pet.nombre === 'Canela'), false);

  assert.throws(() => service.addPet({
    nombre: 'Canela',
    especie: 'Gato',
    raza: 'Doméstico',
    edad: '1 año',
    foto: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba',
    descripcion: 'Dulce'
  }), StorageError);
  assert.equal(service.getPetById('id'), null);
});

test('los favoritos comparan ids como texto y sobreviven a JSON inválido', () => {
  const memory = createMemoryStorage({ 'adopme-favorites': 'no-json' });
  const service = createFavoritesService(createFavoritesRepository(createJsonStore(memory, 'adopme-favorites')));
  assert.deepEqual(service.list(), []);
  service.toggle(1);
  service.toggle('1');
  assert.deepEqual(service.list(), []);
  service.toggle('2');
  assert.equal(service.has(2), true);
  assert.equal(service.count(), 1);
});

test('las estadísticas salen de mascotas disponibles y adopciones completadas', () => {
  const pets = [
    { estado: 'Disponible' },
    { estado: 'En proceso' },
    { estado: 'Adoptado' }
  ];
  const requests = [
    { estadoSolicitud: 'Recibida' },
    { estadoSolicitud: 'Adopción completada' }
  ];
  assert.deepEqual(computeImpactStats(pets, requests), { available: 1, requests: 2, families: 1 });
});
