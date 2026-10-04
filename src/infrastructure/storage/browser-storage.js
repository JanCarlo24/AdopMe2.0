import { StorageError } from '../../shared/errors.js';

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22;
}

export function createBrowserStorage(backend) {
  if (!backend || typeof backend.getItem !== 'function') {
    throw new StorageError('El almacenamiento del navegador no está disponible.', { code: 'STORAGE_UNAVAILABLE' });
  }

  return {
    getItem(key) {
      try {
        return backend.getItem(key);
      } catch (error) {
        throw new StorageError('No se pudo leer el almacenamiento de este navegador.', { code: 'STORAGE_READ', cause: error });
      }
    },
    setItem(key, value) {
      try {
        backend.setItem(key, value);
      } catch (error) {
        const quota = isQuotaError(error);
        throw new StorageError(
          quota
            ? 'El almacenamiento del navegador está lleno. Libera espacio e inténtalo de nuevo.'
            : 'No se pudo guardar la información en este navegador.',
          { code: quota ? 'STORAGE_QUOTA' : 'STORAGE_WRITE', cause: error }
        );
      }
    },
    removeItem(key) {
      try {
        backend.removeItem(key);
      } catch (error) {
        throw new StorageError('No se pudo actualizar el almacenamiento de este navegador.', { code: 'STORAGE_REMOVE', cause: error });
      }
    }
  };
}
