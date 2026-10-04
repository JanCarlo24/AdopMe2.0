import { ValidationError } from '../../shared/errors.js';

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

function missing(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  return !trimmed || trimmed.startsWith('TU_') || trimmed.includes('XXXXXXXX');
}

export function firebaseOptions(config) {
  const options = { ...config };
  delete options.enabled;
  return options;
}

export function validateFirebaseConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ValidationError('Falta la configuración de Firebase. Revisa config/firebase.config.js.');
  }

  const invalid = REQUIRED.filter((key) => missing(config[key]));
  if (invalid.length > 0) {
    throw new ValidationError(`La configuración de Firebase no es válida: falta ${invalid.join(', ')}.`);
  }

  return firebaseOptions(config);
}
