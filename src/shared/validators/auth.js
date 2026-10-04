const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value) && value.length <= 120;
}

export function isStrongPassword(value) {
  return STRONG_PASSWORD.test(value);
}

export function validateAuthAccount({ nombre = '', correo = '', password = '' }, mode) {
  const trimmedName = String(nombre).trim();
  const trimmedEmail = String(correo).trim().toLowerCase();
  const trimmedPassword = String(password).trim();

  if (mode === 'register' && trimmedName.length < 2) {
    return { valid: false, message: 'Escribe tu nombre completo para continuar.' };
  }

  if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
    return { valid: false, message: 'Introduce un correo electrónico válido.' };
  }

  if (!trimmedPassword || (mode === 'register' ? !isStrongPassword(trimmedPassword) : trimmedPassword.length < 8)) {
    return {
      valid: false,
      message: mode === 'register'
        ? 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas y números.'
        : 'La contraseña debe tener al menos 8 caracteres.'
    };
  }

  return {
    valid: true,
    message: '',
    data: { nombre: trimmedName, correo: trimmedEmail, password: trimmedPassword }
  };
}
