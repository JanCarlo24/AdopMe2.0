import { ValidationError } from '../errors.js';
import { categoryFromSpecies } from '../../modules/catalog/model.js';

const SPECIES = ['Perro', 'Gato', 'Otro'];

export function validateNewPet(input, { createId }) {
  const nombre = String(input.nombre ?? '').trim();
  const especie = String(input.especie ?? '');
  const raza = String(input.raza ?? '').trim();
  const edad = String(input.edad ?? '').trim();
  const descripcion = String(input.descripcion ?? '').trim();
  const foto = String(input.foto ?? '').trim();

  if (!nombre || !raza || !edad || !descripcion) {
    throw new ValidationError('Completa todos los campos de la mascota.');
  }

  if (!SPECIES.includes(especie)) {
    throw new ValidationError('Elige una especie válida.');
  }

  let imageUrl;
  try {
    imageUrl = new URL(foto);
  } catch (error) {
    throw new ValidationError('Escribe una URL válida para la foto.', { cause: error });
  }

  if (imageUrl.protocol !== 'https:') {
    throw new ValidationError('La foto debe usar una URL segura (https).');
  }

  return {
    id: createId(),
    nombre,
    especie,
    raza,
    edad,
    categoria: categoryFromSpecies(especie),
    foto: imageUrl.href,
    descripcion,
    estado: 'Disponible'
  };
}
