import { ValidationError } from '../../shared/errors.js';

const REQUIRED_FIELDS = ['mascotaId', 'nombreAdoptante', 'correo', 'telefono', 'tipoVivienda', 'otrasMascotas', 'experiencia'];

export function assertAdoptionRequest(request) {
  if (!request?.cuentaCorreo) {
    throw new ValidationError('Inicia sesión para enviar la solicitud.');
  }
  if (REQUIRED_FIELDS.some((field) => !String(request[field] ?? '').trim())) {
    throw new ValidationError('Revisa los datos de la solicitud e inténtalo de nuevo.');
  }
}

export function createAdoptionService(repository, { createId, now = () => new Date().toISOString() } = {}) {
  return {
    list() {
      return repository.read();
    },
    migrate() {
      const current = repository.read();
      let migrated = false;
      current.forEach((request) => {
        if (!request.solicitudId) {
          request.solicitudId = createId();
          migrated = true;
        }
        if (!request.estadoSolicitud) {
          request.estadoSolicitud = 'Recibida';
          migrated = true;
        }
      });
      if (migrated) repository.write(current);
      return current;
    },
    save(request) {
      assertAdoptionRequest(request);
      const entry = { ...request, fecha: now() };
      const current = repository.read();
      current.push(entry);
      repository.write(current);
      return entry;
    },
    update(id, updates) {
      const current = repository.read();
      const index = current.findIndex((request) => String(request.solicitudId) === String(id));
      if (index === -1) return null;
      current[index] = { ...current[index], ...updates };
      repository.write(current);
      return current[index];
    },
    forAccount(email) {
      const normalized = String(email || '').toLowerCase();
      return this.list().filter((request) => String(request.cuentaCorreo || '').toLowerCase() === normalized);
    }
  };
}
