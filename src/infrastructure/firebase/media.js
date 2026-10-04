import { ValidationError } from '../../shared/errors.js';

export function assertImageFile(file, limits) {
  if (!file || typeof file !== 'object') {
    throw new ValidationError('Elige una foto para subir.');
  }
  if (!limits.mimeTypes.includes(file.type)) {
    throw new ValidationError('La foto debe ser JPEG, PNG o WebP.');
  }
  if (typeof file.size !== 'number' || file.size <= 0 || file.size > limits.maxBytes) {
    throw new ValidationError('La foto no puede superar 2 MB.');
  }
}

export function petPhotoPath({ uid, petId, fileName = 'foto' }) {
  const base = String(fileName).split(/[/\\]/).pop() || 'foto';
  const cleanName = base.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '') || 'foto';
  return `pets/${uid}/${petId}/${cleanName}`;
}
