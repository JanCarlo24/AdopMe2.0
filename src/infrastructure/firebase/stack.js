import { createId } from '../../shared/utils/id.js';
import { createBrowserStorage } from '../storage/browser-storage.js';
import { initFirebase } from './client.js';
import { createSdkDocumentStore } from './document-store.js';
import { createAuthGateway, createStorageGateway } from './gateways.js';
import { createRemoteCatalogService } from '../../modules/remote/catalog-service.js';
import { createFirebaseAuthService } from '../../modules/remote/auth-service.js';
import {
  createRemoteAdoptionRepository,
  createRemoteCompatibilityRepository,
  createRemoteFavoritesRepository,
  createRemotePetRepository,
  createUserRepository,
  createAdminRepository
} from '../../modules/remote/repositories.js';
import {
  createRemoteAdoptionService,
  createRemoteCompatibilityService,
  createRemoteFavoritesService
} from '../../modules/remote/user-data-service.js';

export async function createRemoteStack({ window, localStorage, config, firebaseConfig }) {
  const client = await initFirebase(firebaseConfig);
  const store = createSdkDocumentStore(client);
  const auth = createFirebaseAuthService({
    gateway: createAuthGateway(client),
    profiles: createUserRepository(store),
    admins: createAdminRepository(store)
  });
  await auth.whenReady();

  const catalog = createRemoteCatalogService({
    repository: createRemotePetRepository(store),
    createId: () => createId(window.crypto),
    auth,
    uploader: createStorageGateway(client),
    photoLimits: config.photo
  });
  await catalog.hydrate({ asAdmin: auth.canManageRefuge() });

  const favorites = createRemoteFavoritesService(createRemoteFavoritesRepository(store), auth);
  const compatibility = createRemoteCompatibilityService(createRemoteCompatibilityRepository(store), auth);
  const adoptions = createRemoteAdoptionService(createRemoteAdoptionRepository(store), auth);
  if (auth.current()) {
    await Promise.all([favorites.hydrate(), compatibility.hydrate(), adoptions.hydrate()]);
  }

  return {
    kind: 'firebase',
    persistent: createBrowserStorage(localStorage),
    catalog,
    favorites,
    adoptions,
    auth,
    compatibility,
    notice: null
  };
}
