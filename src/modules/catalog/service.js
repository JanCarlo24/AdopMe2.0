import { validateNewPet } from '../../shared/validators/pet.js';

export function createCatalogService({ repository, createId }) {
  let pets = repository.load();

  function save(next) {
    repository.save(next);
    pets = next;
  }

  return {
    getPets() {
      return pets;
    },
    getPetById(id) {
      return pets.find((pet) => String(pet.id) === String(id)) || null;
    },
    addPet(input) {
      const pet = validateNewPet(input, { createId });
      save([pet, ...pets]);
      return pet;
    },
    setStatus(id, status, allowedStatuses) {
      const pet = this.getPetById(id);
      if (!pet || !allowedStatuses.includes(status)) return null;
      const previous = pet.estado;
      pet.estado = status;
      try {
        repository.save(pets);
      } catch (error) {
        pet.estado = previous;
        throw error;
      }
      return pet;
    },
    markAdopted(id) {
      const pet = this.getPetById(id);
      if (!pet) return null;
      const previous = pet.estado;
      pet.estado = 'Adoptado';
      try {
        repository.save(pets);
      } catch (error) {
        pet.estado = previous;
        throw error;
      }
      return pet;
    },
    remove(id) {
      const pet = this.getPetById(id);
      if (!pet) return null;
      const next = pets.filter((entry) => String(entry.id) !== String(pet.id));
      save(next);
      return pet;
    }
  };
}
