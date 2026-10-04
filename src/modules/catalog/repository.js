import { normalizePet } from './model.js';

export function createPetRepository(store, seedPets) {
  return {
    load() {
      const parsed = store.read();
      const source = parsed.ok && Array.isArray(parsed.value) ? parsed.value : seedPets;
      return source.map((pet) => normalizePet(pet));
    },
    save(pets) {
      store.write(pets);
    }
  };
}
