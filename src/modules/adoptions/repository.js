export function createAdoptionRepository(store) {
  return {
    read() {
      const parsed = store.read();
      return parsed.ok && Array.isArray(parsed.value) ? parsed.value : [];
    },
    write(requests) {
      store.write(requests);
    }
  };
}
