import { ValidationError } from '../../shared/errors.js';
import { validateNewPet } from '../../shared/validators/pet.js';
import { normalizePet } from '../catalog/model.js';
import { seedPets } from '../catalog/seed.js';
import { assertImageFile, petPhotoPath } from '../../infrastructure/firebase/media.js';
import { mapFirebaseError } from '../../infrastructure/firebase/errors.js';

function byNewest(pets) {
  return [...pets].sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
}

export function createRemoteCatalogService({ repository, createId, auth, uploader, photoLimits }) {
  let pets = seedPets.map((pet) => normalizePet(pet));
  let showingSeed = true;

  function requireManaged(pet) {
    if (!pet?.ownerUid) {
      throw new ValidationError('Esta mascota es del catálogo local de demostración. No se copia ni se modifica en Firebase.');
    }
  }

  return {
    getPets() {
      return pets;
    },
    getPetById(id) {
      return pets.find((pet) => String(pet.id) === String(id)) || null;
    },
    isShowingSeed() {
      return showingSeed;
    },
    async hydrate({ asAdmin = false } = {}) {
      const remote = asAdmin ? await repository.listAll() : await repository.listPublic();
      if (!remote.length) {
        pets = seedPets.map((pet) => normalizePet(pet));
        showingSeed = true;
        return { source: 'seed' };
      }
      pets = byNewest(remote);
      showingSeed = false;
      return { source: 'remote' };
    },
    async addPet(input) {
      if (!auth.canManageRefuge()) {
        throw new ValidationError('Solo una cuenta de refugio puede publicar mascotas.');
      }
      const id = createId();
      let foto = String(input.foto ?? '').trim();
      const file = input.fotoArchivo;
      if (file && file.size) {
        assertImageFile(file, photoLimits);
        const uid = auth.current()?.uid;
        if (!uid) throw new ValidationError('Inicia sesión para subir una foto.');
        try {
          foto = await uploader.upload({
            path: petPhotoPath({ uid, petId: id, fileName: file.name }),
            file,
            contentType: file.type
          });
        } catch (error) {
          throw mapFirebaseError(error);
        }
      }

      const pet = validateNewPet({ ...input, foto }, { createId: () => id });
      const record = {
        ...pet,
        ownerUid: auth.current().uid,
        creado: new Date().toISOString()
      };
      const saved = await repository.create(record);
      if (showingSeed) {
        pets = [saved];
        showingSeed = false;
      } else {
        pets = [saved, ...pets];
      }
      return saved;
    },
    async setStatus(id, status, allowedStatuses) {
      const pet = this.getPetById(id);
      if (!pet || !allowedStatuses.includes(status)) return null;
      requireManaged(pet);
      const previous = pet.estado;
      pet.estado = status;
      try {
        await repository.update(id, { estado: status });
      } catch (error) {
        pet.estado = previous;
        throw mapFirebaseError(error);
      }
      return pet;
    },
    async markAdopted(id) {
      return this.setStatus(id, 'Adoptado', ['Disponible', 'En proceso', 'Adoptado']);
    },
    async remove(id) {
      const pet = this.getPetById(id);
      if (!pet) return null;
      requireManaged(pet);
      await repository.remove(id);
      pets = pets.filter((entry) => String(entry.id) !== String(id));
      return pet;
    }
  };
}
