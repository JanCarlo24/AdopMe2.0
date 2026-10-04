// La semilla local (Milo, Luna, …) se muestra si Firestore no tiene mascotas.
// Nunca se copia sola: haría falta confirmación explícita y una colección vacía.
export function planCatalogSeed({ remoteCount = 0, confirm = false } = {}) {
  if (remoteCount > 0) return { write: false, reason: 'remote-not-empty' };
  if (!confirm) return { write: false, reason: 'confirmation-required' };
  return { write: true, reason: 'empty-confirmed' };
}
