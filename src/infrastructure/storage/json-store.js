export function createJsonStore(storage, key) {
  return {
    read() {
      let raw;
      try {
        raw = storage.getItem(key);
      } catch (error) {
        return { ok: false, missing: false, value: null, error };
      }

      if (raw == null || raw === '') return { ok: true, missing: true, value: null };

      try {
        return { ok: true, missing: false, value: JSON.parse(raw) };
      } catch (error) {
        return { ok: false, missing: false, value: null, error };
      }
    },
    write(value) {
      storage.setItem(key, JSON.stringify(value));
    }
  };
}
