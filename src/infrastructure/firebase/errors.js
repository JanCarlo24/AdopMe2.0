import { AppError, AuthError, ConnectionError } from '../../shared/errors.js';

const MESSAGES = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/invalid-email': 'Introduce un correo electrónico válido.',
  'auth/missing-email': 'Escribe tu correo para restablecer la contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas y números.',
  'auth/user-not-found': 'No encontramos esa cuenta o la contraseña no coincide.',
  'auth/wrong-password': 'No encontramos esa cuenta o la contraseña no coincide.',
  'auth/invalid-credential': 'No encontramos esa cuenta o la contraseña no coincide.',
  'auth/invalid-login-credentials': 'No encontramos esa cuenta o la contraseña no coincide.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/network-request-failed': 'No hay conexión con Firebase. Revisa tu red e inténtalo de nuevo.',
  'auth/user-token-expired': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'auth/invalid-user-token': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'auth/requires-recent-login': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'permission-denied': 'Firebase rechazó la operación. Revisa que las reglas estén desplegadas y que tu cuenta tenga permiso.',
  'unauthenticated': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  unavailable: 'No hay conexión con Firebase. Revisa tu red e inténtalo de nuevo.',
  'deadline-exceeded': 'Firebase tardó demasiado en responder. Inténtalo de nuevo.',
  'storage/unauthorized': 'No puedes modificar archivos de otra cuenta.',
  'storage/unauthenticated': 'Inicia sesión para subir la foto.',
  'storage/retry-limit-exceeded': 'No hay conexión con Firebase. Revisa tu red e inténtalo de nuevo.',
  'storage/canceled': 'Se canceló la subida de la foto.',
  'storage/invalid-format': 'La foto debe ser JPEG, PNG o WebP.',
  'storage/quota-exceeded': 'No pudimos guardar la foto: el espacio del proyecto está lleno.'
};

const CONNECTION_CODES = new Set([
  'auth/network-request-failed',
  'unavailable',
  'deadline-exceeded',
  'storage/retry-limit-exceeded'
]);

const AUTH_CODES = new Set([
  'auth/email-already-in-use',
  'auth/invalid-email',
  'auth/missing-email',
  'auth/weak-password',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/too-many-requests',
  'auth/user-disabled',
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/requires-recent-login',
  'unauthenticated'
]);

export function mapFirebaseError(error) {
  if (error instanceof AppError) return error;
  const code = String(error?.code || '');
  const message = MESSAGES[code] || 'No pudimos completar la operación. Inténtalo de nuevo.';
  if (CONNECTION_CODES.has(code)) return new ConnectionError(message, { code, cause: error });
  if (AUTH_CODES.has(code) || code.startsWith('auth/')) return new AuthError(message, { code: code || 'AUTH', cause: error });
  return new AppError(message, { code: code || 'FIREBASE', cause: error });
}
