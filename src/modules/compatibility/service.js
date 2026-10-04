import { inferAgeGroup, inferPetSize } from '../catalog/model.js';

export function scorePet(pet, preferences) {
  if (!preferences) return 0;

  const isDog = pet.especie === 'Perro';
  const isCat = pet.especie === 'Gato';
  const size = pet.tamano || inferPetSize(pet);
  const ageGroup = pet.edadGrupo || inferAgeGroup(pet.edad);
  let score = 60;

  if (preferences.preferencia === 'perro' && isDog) score += 20;
  if (preferences.preferencia === 'gato' && isCat) score += 20;
  if (preferences.preferencia === 'indistinto') score += 5;
  if (preferences.hogar === 'departamento' && (isCat || size === 'Pequeño')) score += 12;
  if (preferences.hogar === 'casa' && (isDog || size === 'Mediano')) score += 9;
  if (preferences.hogar === 'casa-jardin' && isDog) score += 14;
  if (preferences.tiempo === 'poco' && isCat) score += 12;
  if (preferences.tiempo === 'medio' && size !== 'Grande') score += 7;
  if (preferences.tiempo === 'mucho' && isDog) score += 12;
  if (preferences.experiencia === 'primera' && ageGroup === 'Adulto') score += 6;
  if (preferences.experiencia === 'algo' && ageGroup !== 'Cachorro') score += 5;
  if (preferences.experiencia === 'mucha' && (isDog || size === 'Grande')) score += 8;

  return Math.min(score, 99);
}

function fallbackRank(pet) {
  return (pet.especie === 'Perro' ? 2 : 1) + ((pet.edad || '').includes('mes') ? 1 : 0);
}

export function getRecommendedPets(pets, preferences) {
  return pets
    .filter((pet) => (pet.estado || 'Disponible') === 'Disponible')
    .sort((a, b) => {
      const matchA = preferences ? scorePet(a, preferences) : fallbackRank(a);
      const matchB = preferences ? scorePet(b, preferences) : fallbackRank(b);
      return matchB - matchA;
    })
    .slice(0, 3);
}

export function createCompatibilityRepository(store) {
  return {
    load() {
      const parsed = store.read();
      if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return null;
      return parsed.value;
    },
    save(preferences) {
      store.write(preferences);
    }
  };
}

export function createCompatibilityService(repository) {
  let preferences = repository.load();

  return {
    get() {
      return preferences;
    },
    save(next) {
      repository.save(next);
      preferences = next;
      return preferences;
    },
    score(pet) {
      return scorePet(pet, preferences);
    },
    recommended(pets) {
      return getRecommendedPets(pets, preferences);
    }
  };
}
