export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = new.target.name;
    this.code = code;
  }
}

export class StorageError extends AppError {
  constructor(message, { code = 'STORAGE', cause } = {}) {
    super(message, { code, cause });
  }
}

export class ValidationError extends AppError {
  constructor(message, { code = 'VALIDATION', cause } = {}) {
    super(message, { code, cause });
  }
}

export class AuthError extends AppError {
  constructor(message, { code = 'AUTH', cause } = {}) {
    super(message, { code, cause });
  }
}

export class ConnectionError extends AppError {
  constructor(message, { code = 'CONNECTION', cause } = {}) {
    super(message, { code, cause });
  }
}

export function userMessage(error, fallback) {
  return error instanceof AppError && error.message ? error.message : fallback;
}
