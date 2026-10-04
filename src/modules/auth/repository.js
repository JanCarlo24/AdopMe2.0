export function createAccountRepository(store) {
  return {
    all() {
      const parsed = store.read();
      return parsed.ok && Array.isArray(parsed.value) ? parsed.value : [];
    },
    saveAll(accounts) {
      store.write(accounts);
    }
  };
}

export function createSessionRepository(storage, key) {
  return {
    read() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value) || !value.correo) return null;
        return { nombre: value.nombre, correo: value.correo };
      } catch {
        return null;
      }
    },
    write(session) {
      storage.setItem(key, JSON.stringify({ nombre: session.nombre, correo: session.correo }));
    },
    clear() {
      storage.removeItem(key);
    }
  };
}
