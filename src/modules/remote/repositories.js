import { ValidationError } from '../../shared/errors.js';
import { normalizePet } from '../catalog/model.js';
import { mapFirebaseError } from '../../infrastructure/firebase/errors.js';

function guard(error) {
  throw mapFirebaseError(error);
}

function toPet(id, data) {
  return normalizePet({ ...data, id });
}

export function profileDocument(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new ValidationError('El perfil no es válido.');
  }
  if ('password' in profile || 'passwordHash' in profile || 'salt' in profile) {
    throw new ValidationError('No se guarda la contraseña.');
  }
  return {
    nombre: profile.nombre,
    correo: profile.correo,
    creado: profile.creado
  };
}

export function createUserRepository(store) {
  return {
    async get(uid) {
      try {
        return await store.get(`users/${uid}`);
      } catch (error) {
        guard(error);
      }
    },
    async save(uid, profile) {
      try {
        await store.set(`users/${uid}`, profileDocument(profile));
      } catch (error) {
        guard(error);
      }
    }
  };
}

export function createAdminRepository(store) {
  return {
    async isAdmin(uid) {
      try {
        const record = await store.get(`admins/${uid}`);
        return Boolean(record);
      } catch (error) {
        guard(error);
      }
    }
  };
}

export function createRemotePetRepository(store) {
  return {
    async listPublic() {
      try {
        const rows = await store.list('pets', [{ field: 'estado', op: 'in', value: ['Disponible', 'En proceso'] }]);
        return rows.map((row) => toPet(row.id, row.data));
      } catch (error) {
        guard(error);
      }
    },
    async listAll() {
      try {
        const rows = await store.list('pets', []);
        return rows.map((row) => toPet(row.id, row.data));
      } catch (error) {
        guard(error);
      }
    },
    async create(pet) {
      try {
        const { id, ...data } = pet;
        await store.set(`pets/${id}`, data);
        return toPet(id, data);
      } catch (error) {
        guard(error);
      }
    },
    async update(id, patch) {
      try {
        await store.update(`pets/${id}`, patch);
      } catch (error) {
        guard(error);
      }
    },
    async remove(id) {
      try {
        await store.remove(`pets/${id}`);
      } catch (error) {
        guard(error);
      }
    }
  };
}

export function createRemoteAdoptionRepository(store) {
  function mapRow(row) {
    return { ...row.data, solicitudId: row.data.solicitudId || row.id };
  }

  return {
    async listByOwner(uid) {
      try {
        const rows = await store.list('adoptions', [{ field: 'ownerUid', op: '==', value: uid }]);
        return rows.map(mapRow);
      } catch (error) {
        guard(error);
      }
    },
    async listAll() {
      try {
        const rows = await store.list('adoptions', []);
        return rows.map(mapRow);
      } catch (error) {
        guard(error);
      }
    },
    async create(entry) {
      try {
        await store.set(`adoptions/${entry.solicitudId}`, entry);
        return entry;
      } catch (error) {
        guard(error);
      }
    },
    async update(id, patch) {
      try {
        await store.update(`adoptions/${id}`, patch);
      } catch (error) {
        guard(error);
      }
    }
  };
}

export function createRemoteFavoritesRepository(store) {
  function path(uid) {
    return `users/${uid}/favorites/ids`;
  }

  return {
    async load(uid) {
      try {
        const data = await store.get(path(uid));
        return Array.isArray(data?.ids) ? data.ids : [];
      } catch (error) {
        guard(error);
      }
    },
    async save(uid, ids) {
      try {
        await store.set(path(uid), { ids });
      } catch (error) {
        guard(error);
      }
    }
  };
}

export function createRemoteCompatibilityRepository(store) {
  function path(uid) {
    return `users/${uid}/compatibility/result`;
  }

  return {
    async load(uid) {
      try {
        return await store.get(path(uid));
      } catch (error) {
        guard(error);
      }
    },
    async save(uid, preferences) {
      try {
        await store.set(path(uid), preferences);
      } catch (error) {
        guard(error);
      }
    }
  };
}
