import { ValidationError } from '../../shared/errors.js';
import { getRecommendedPets, scorePet } from '../compatibility/service.js';
import { assertAdoptionRequest } from '../adoptions/service.js';

const ALLOWED_PREFERENCES = {
  hogar: ['departamento', 'casa', 'casa-jardin'],
  tiempo: ['poco', 'medio', 'mucho'],
  experiencia: ['primera', 'algo', 'mucha'],
  preferencia: ['indistinto', 'perro', 'gato']
};

export function sanitizePreferences(input) {
  const next = {};
  for (const [key, allowed] of Object.entries(ALLOWED_PREFERENCES)) {
    const value = String(input?.[key] ?? '');
    if (!allowed.includes(value)) return null;
    next[key] = value;
  }
  return next;
}

export function createRemoteFavoritesService(repository, auth) {
  let ids = [];

  function uid() {
    return auth.current()?.uid || null;
  }

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
    replace(next) {
      ids = Array.isArray(next) ? next.slice() : [];
      return this.list();
    },
    async hydrate() {
      const current = uid();
      ids = current ? await repository.load(current) : [];
      return this.list();
    },
    async toggle(id) {
      const current = uid();
      if (!current) throw new ValidationError('Inicia sesión para guardar favoritos en tu cuenta.');
      const previous = ids.slice();
      const next = this.has(id)
        ? ids.filter((savedId) => String(savedId) !== String(id))
        : [...ids, id];
      ids = next;
      try {
        await repository.save(current, next);
      } catch (error) {
        ids = previous;
        throw error;
      }
      return this.list();
    },
    async persist() {
      const current = uid();
      if (current) await repository.save(current, ids);
    }
  };
}

export function createRemoteCompatibilityService(repository, auth) {
  let preferences = null;

  function uid() {
    return auth.current()?.uid || null;
  }

  return {
    get() {
      return preferences;
    },
    replace(next) {
      preferences = next;
      return preferences;
    },
    async hydrate() {
      const current = uid();
      const loaded = current ? await repository.load(current) : null;
      preferences = loaded ? sanitizePreferences(loaded) : null;
      return preferences;
    },
    async save(input) {
      const current = uid();
      if (!current) throw new ValidationError('Inicia sesión para guardar tu test en tu cuenta.');
      const next = sanitizePreferences(input);
      if (!next) throw new ValidationError('Revisa las respuestas del test e inténtalo de nuevo.');
      const previous = preferences;
      preferences = next;
      try {
        await repository.save(current, next);
      } catch (error) {
        preferences = previous;
        throw error;
      }
      return preferences;
    },
    score(pet) {
      return scorePet(pet, preferences);
    },
    recommended(pets) {
      return getRecommendedPets(pets, preferences);
    }
  };
}

export function createRemoteAdoptionService(repository, auth, { now = () => new Date().toISOString() } = {}) {
  let requests = [];

  return {
    list() {
      return requests.slice();
    },
    migrate() {
      return requests;
    },
    replace(next) {
      requests = Array.isArray(next) ? next.slice() : [];
      return this.list();
    },
    async hydrate() {
      const session = auth.current();
      if (!session) {
        requests = [];
        return this.list();
      }
      requests = auth.canManageRefuge()
        ? await repository.listAll()
        : await repository.listByOwner(session.uid);
      return this.list();
    },
    forAccount(email) {
      const normalized = String(email || '').toLowerCase();
      return this.list().filter((request) => String(request.cuentaCorreo || '').toLowerCase() === normalized);
    },
    async save(request) {
      assertAdoptionRequest(request);
      const session = auth.current();
      if (!session?.uid) throw new ValidationError('Inicia sesión para enviar la solicitud.');
      const entry = {
        solicitudId: request.solicitudId,
        mascotaId: String(request.mascotaId),
        mascotaNombre: String(request.mascotaNombre || ''),
        nombreAdoptante: String(request.nombreAdoptante || '').trim(),
        correo: session.correo,
        telefono: String(request.telefono || '').trim(),
        tipoVivienda: String(request.tipoVivienda || ''),
        otrasMascotas: String(request.otrasMascotas || ''),
        experiencia: String(request.experiencia || ''),
        mensaje: String(request.mensaje || '').slice(0, 500),
        consentimiento: request.consentimiento === true || request.consentimiento === 'on' || request.consentimiento === 'true',
        estadoSolicitud: 'Recibida',
        ownerUid: session.uid,
        cuentaCorreo: session.correo,
        fecha: now()
      };
      await repository.create(entry);
      requests = [...requests, entry];
      return entry;
    },
    async update(id, updates) {
      if (!auth.canManageRefuge()) {
        throw new ValidationError('Solo una cuenta de refugio puede actualizar solicitudes.');
      }
      const current = requests.find((request) => String(request.solicitudId) === String(id));
      if (!current) return null;
      const next = { ...current, ...updates };
      await repository.update(id, updates);
      requests = requests.map((request) => (String(request.solicitudId) === String(id) ? next : request));
      return next;
    }
  };
}
