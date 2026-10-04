import { createId } from '../shared/utils/id.js';
import { createBrowserStorage } from '../infrastructure/storage/browser-storage.js';
import { createJsonStore } from '../infrastructure/storage/json-store.js';
import { seedPets } from '../modules/catalog/seed.js';
import { createPetRepository } from '../modules/catalog/repository.js';
import { createCatalogService } from '../modules/catalog/service.js';
import { createFavoritesRepository } from '../modules/favorites/repository.js';
import { createFavoritesService } from '../modules/favorites/service.js';
import { createAdoptionRepository } from '../modules/adoptions/repository.js';
import { createAdoptionService } from '../modules/adoptions/service.js';
import { createAccountRepository, createSessionRepository } from '../modules/auth/repository.js';
import { createAuthService } from '../modules/auth/service.js';
import { createCompatibilityRepository, createCompatibilityService } from '../modules/compatibility/service.js';

export function createLocalServices({ window, localStorage, sessionStorage, config }) {
  const persistent = createBrowserStorage(localStorage);
  const sessions = createBrowserStorage(sessionStorage);
  return {
    kind: 'local',
    persistent,
    catalog: createCatalogService({
      repository: createPetRepository(createJsonStore(persistent, config.keys.pets), seedPets),
      createId: () => createId(window.crypto)
    }),
    favorites: createFavoritesService(
      createFavoritesRepository(createJsonStore(persistent, config.keys.favorites))
    ),
    adoptions: createAdoptionService(
      createAdoptionRepository(createJsonStore(persistent, config.keys.adoptions)),
      { createId: () => createId(window.crypto) }
    ),
    auth: createAuthService({
      accounts: createAccountRepository(createJsonStore(persistent, config.keys.accounts)),
      session: createSessionRepository(sessions, config.keys.session),
      crypto: window.crypto,
      password: config.password
    }),
    compatibility: createCompatibilityService(
      createCompatibilityRepository(createJsonStore(persistent, config.keys.compatibility))
    )
  };
}
