function segments(path) {
  return String(path).split('/').filter(Boolean);
}

function matches(data, filters) {
  return filters.every((filter) => {
    const value = data?.[filter.field];
    if (filter.op === '==') return value === filter.value;
    if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(value);
    return false;
  });
}

export function createMemoryDocumentStore() {
  const docs = new Map();

  return {
    async get(path) {
      return docs.has(path) ? structuredClone(docs.get(path)) : null;
    },
    async set(path, data) {
      docs.set(path, structuredClone(data));
    },
    async update(path, patch) {
      if (!docs.has(path)) {
        const error = new Error('missing');
        error.code = 'not-found';
        throw error;
      }
      docs.set(path, structuredClone({ ...docs.get(path), ...patch }));
    },
    async remove(path) {
      docs.delete(path);
    },
    async list(collectionPath, filters = []) {
      const prefix = `${collectionPath.replace(/\/$/, '')}/`;
      const rows = [];
      for (const [path, data] of docs) {
        if (!path.startsWith(prefix)) continue;
        const id = path.slice(prefix.length);
        if (!id || id.includes('/')) continue;
        if (!matches(data, filters)) continue;
        rows.push({ id, data: structuredClone(data) });
      }
      return rows;
    }
  };
}

export function createSdkDocumentStore(client) {
  const { db, sdk } = client;
  const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } = sdk.firestore;

  return {
    async get(path) {
      const snap = await getDoc(doc(db, ...segments(path)));
      return snap.exists() ? snap.data() : null;
    },
    async set(path, data) {
      await setDoc(doc(db, ...segments(path)), data);
    },
    async update(path, patch) {
      await updateDoc(doc(db, ...segments(path)), patch);
    },
    async remove(path) {
      await deleteDoc(doc(db, ...segments(path)));
    },
    async list(collectionPath, filters = []) {
      const constraints = filters.map((filter) => where(filter.field, filter.op, filter.value));
      const ref = collection(db, ...segments(collectionPath));
      const snap = await getDocs(constraints.length ? query(ref, ...constraints) : ref);
      return snap.docs.map((item) => ({ id: item.id, data: item.data() }));
    }
  };
}
