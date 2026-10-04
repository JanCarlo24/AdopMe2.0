export function createFavoritesService(repository) {
  let ids = repository.load();

  return {
    list() {
      return ids.slice();
    },
    count() {
      return ids.length;
    },
    has(id) {
      return ids.some((savedId) => String(savedId) === String(id));
    },
    toggle(id) {
      const next = this.has(id)
        ? ids.filter((savedId) => String(savedId) !== String(id))
        : [...ids, id];
      repository.save(next);
      ids = next;
      return this.list();
    },
    persist() {
      repository.save(ids);
    }
  };
}
