import { seedPets } from '../src/modules/catalog/seed.js';
import { planCatalogSeed } from '../src/infrastructure/firebase/seed-plan.js';

const confirm = process.argv.includes('--confirm');
const remoteCount = Number(process.env.ADOPME_REMOTE_PET_COUNT || 0);
const plan = planCatalogSeed({ remoteCount, confirm });

if (!plan.write) {
  const reasons = {
    'remote-not-empty': 'Firestore ya tiene mascotas. No se sobrescribe nada.',
    'confirmation-required': 'Sin --confirm no se escribe. La semilla local sigue como catálogo de respaldo.'
  };
  console.log(reasons[plan.reason] || plan.reason);
  console.log('Para copiar la semilla hace falta una colección pets vacía, una cuenta en admins/{uid} y ejecutar la copia desde un entorno con credenciales de administrador. Este script no llama a Firebase por sí solo.');
  process.exit(0);
}

console.log(`Listo para copiar ${seedPets.length} mascotas. Este repositorio no incluye credenciales de administrador: publícalas desde el panel con una cuenta admin o usa la consola. No se escribió nada.`);
process.exit(0);
