export function createFavoritesRepository(store) {
  return {
    load() {
      const parsed = store.read();
      return parsed.ok && Array.isArray(parsed.value) ? parsed.value : [];
    },
    save(ids) {
      store.write(ids);
    }
  };
}
