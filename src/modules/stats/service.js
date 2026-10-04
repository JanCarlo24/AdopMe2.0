export function computeImpactStats(pets, requests) {
  const available = pets.filter((pet) => (pet.estado || 'Disponible') === 'Disponible').length;
  const families = requests.filter((request) => (request.estadoSolicitud || 'Recibida') === 'Adopción completada').length;
  return { available, requests: requests.length, families };
}
