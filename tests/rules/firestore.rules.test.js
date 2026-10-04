import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const skip = !process.env.FIRESTORE_EMULATOR_HOST;
const projectId = 'adopme-rules-test';
let testEnv;

before(async () => {
  if (skip) return;
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

function profile() {
  return { nombre: 'Ana Pérez', correo: 'ana@correo.com', creado: '2026-01-01T00:00:00.000Z' };
}

function pet(ownerUid, estado = 'Disponible') {
  return {
    nombre: 'Canela',
    especie: 'Perro',
    raza: 'Mestizo',
    edad: '2 años',
    categoria: 'Perros',
    foto: 'https://images.unsplash.com/photo-1',
    descripcion: 'Tranquila',
    estado,
    ownerUid,
    creado: '2026-01-02T00:00:00.000Z'
  };
}

test('las reglas niegan escritura global y separan dueño, público y refugio', { skip }, async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins/admin-1'), { rol: 'refugio' });
    await setDoc(doc(context.firestore(), 'pets/oculto'), pet('admin-1', 'Adoptado'));
  });

  const anon = testEnv.unauthenticatedContext();
  const ana = testEnv.authenticatedContext('ana', { email: 'ana@correo.com' });
  const admin = testEnv.authenticatedContext('admin-1', { email: 'refugio@correo.com' });

  await assertFails(getDoc(doc(anon.firestore(), 'users/ana')));
  await assertFails(setDoc(doc(anon.firestore(), 'pets/libre'), pet('anon')));
  await assertFails(getDoc(doc(anon.firestore(), 'pets/oculto')));

  await assertSucceeds(setDoc(doc(ana.firestore(), 'users/ana'), profile()));
  await assertFails(setDoc(doc(ana.firestore(), 'users/ana'), { ...profile(), password: 'no' }));
  await assertFails(setDoc(doc(ana.firestore(), 'users/otro'), profile()));
  await assertSucceeds(setDoc(doc(ana.firestore(), 'users/ana/favorites/ids'), { ids: ['pet-1'] }));
  await assertFails(setDoc(doc(ana.firestore(), 'users/otro/favorites/ids'), { ids: ['pet-1'] }));

  await assertFails(setDoc(doc(ana.firestore(), 'pets/nueva'), pet('ana')));
  await assertSucceeds(setDoc(doc(admin.firestore(), 'pets/nueva'), pet('admin-1')));
  await assertFails(updateDoc(doc(ana.firestore(), 'pets/nueva'), { estado: 'Adoptado' }));
  await assertSucceeds(getDoc(doc(anon.firestore(), 'pets/nueva')));

  const adoption = {
    solicitudId: 'sol-1',
    ownerUid: 'ana',
    cuentaCorreo: 'ana@correo.com',
    correo: 'ana@correo.com',
    mascotaId: 'nueva',
    mascotaNombre: 'Canela',
    nombreAdoptante: 'Ana Pérez',
    telefono: '555',
    tipoVivienda: 'Casa',
    otrasMascotas: 'No',
    experiencia: 'Sí, actualmente',
    mensaje: '',
    consentimiento: true,
    estadoSolicitud: 'Recibida',
    fecha: '2026-04-01T00:00:00.000Z'
  };
  await assertSucceeds(setDoc(doc(ana.firestore(), 'adoptions/sol-1'), adoption));
  await assertFails(getDoc(doc(anon.firestore(), 'adoptions/sol-1')));
  await assertFails(updateDoc(doc(ana.firestore(), 'adoptions/sol-1'), {
    estadoSolicitud: 'Aprobada',
    actualizado: '2026-04-02T00:00:00.000Z'
  }));
  await assertSucceeds(updateDoc(doc(admin.firestore(), 'adoptions/sol-1'), {
    estadoSolicitud: 'Aprobada',
    actualizado: '2026-04-02T00:00:00.000Z'
  }));
  await assertFails(setDoc(doc(ana.firestore(), 'admins/ana'), { rol: 'refugio' }));
});
