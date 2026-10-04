export function inferAgeGroup(ageText) {
  const normalized = String(ageText || '').toLowerCase();
  const match = normalized.match(/(\d+)/);
  if (!match) return 'Adulto';

  const value = Number(match[1]);
  if (normalized.includes('mes')) return value <= 6 ? 'Cachorro' : 'Adulto';
  if (normalized.includes('año')) {
    if (value <= 1) return 'Cachorro';
    if (value >= 8) return 'Senior';
    return 'Adulto';
  }

  return 'Adulto';
}

export function inferPetSize(pet) {
  if (pet?.tamano) return pet.tamano;
  if (pet?.especie === 'Gato') return 'Pequeño';
  if (pet?.raza?.toLowerCase().includes('labrador')) return 'Grande';
  if (pet?.raza?.toLowerCase().includes('border')) return 'Grande';
  return 'Mediano';
}

export function categoryFromSpecies(especie) {
  return especie === 'Otro' ? 'Otros' : `${especie}s`;
}

export function searchAndFilter(pets, term = '', categoria = 'Todas') {
  const porCategoria = !categoria || categoria === 'Todas'
    ? pets
    : pets.filter((pet) => pet.categoria === categoria);
  const text = String(term).trim().toLowerCase();
  if (!text) return porCategoria;
  return porCategoria.filter((pet) =>
    (pet.nombre || '').toLowerCase().includes(text) ||
    (pet.raza || '').toLowerCase().includes(text)
  );
}

export function filterCatalog(pets, { term = '', category = 'Todas', age = 'Todos', size = 'Todos', savedOnly = false, isSaved }) {
  return searchAndFilter(pets, term, category)
    .filter((pet) => pet.estado !== 'Adoptado')
    .filter((pet) => !savedOnly || isSaved(pet.id))
    .filter((pet) => {
      const ageGroup = pet.edadGrupo || inferAgeGroup(pet.edad);
      return age === 'Todos' || ageGroup === age;
    })
    .filter((pet) => {
      const petSize = pet.tamano || inferPetSize(pet);
      return size === 'Todos' || petSize === size;
    });
}

export function resultsLabel(matchingPets) {
  const availableCount = matchingPets.filter((pet) => (pet.estado || 'Disponible') === 'Disponible').length;
  const pendingCount = matchingPets.length - availableCount;
  return pendingCount
    ? `${availableCount} disponibles · ${pendingCount} en proceso`
    : `${availableCount} ${availableCount === 1 ? 'compañero disponible' : 'compañeros disponibles'}`;
}

export function normalizePet(pet) {
  return { ...pet, estado: pet.estado || 'Disponible' };
}
