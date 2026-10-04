import { ValidationError } from '../../shared/errors.js';
import { validateAuthAccount } from '../../shared/validators/auth.js';
import { hashPassword, toHex } from './password.js';

export function createAuthService({ accounts, session, crypto, password }) {
  return {
    current() {
      return session.read();
    },
    async register({ nombre, correo, password: plainPassword }) {
      const validation = validateAuthAccount({ nombre, correo, password: plainPassword }, 'register');
      if (!validation.valid) throw new ValidationError(validation.message);

      const all = accounts.all();
      if (all.some((account) => account.correo === validation.data.correo)) {
        throw new ValidationError('Ya existe una cuenta con ese correo.');
      }

      const salt = toHex(crypto.getRandomValues(new Uint8Array(password.saltBytes)));
      const passwordHash = await hashPassword(validation.data.password, salt, crypto, password);
      const account = {
        nombre: validation.data.nombre,
        correo: validation.data.correo,
        salt,
        passwordHash
      };
      all.push(account);
      accounts.saveAll(all);
      session.write({ nombre: account.nombre, correo: account.correo });
      return account;
    },
    async login({ correo, password: plainPassword }) {
      const validation = validateAuthAccount({ correo, password: plainPassword }, 'login');
      if (!validation.valid) throw new ValidationError(validation.message);

      const account = accounts.all().find((entry) => entry.correo === validation.data.correo);
      const passwordHash = account
        ? await hashPassword(validation.data.password, account.salt, crypto, password)
        : '';
      if (!account || passwordHash !== account.passwordHash) {
        throw new ValidationError('No encontramos esa cuenta o la contraseña no coincide.');
      }

      session.write({ nombre: account.nombre, correo: account.correo });
      return account;
    },
    logout() {
      session.clear();
    }
  };
}
