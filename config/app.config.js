export const appConfig = {
  storagePrefix: 'adopme',
  keys: {
    pets: 'adopme-pets',
    adoptions: 'adopme-adoptions',
    favorites: 'adopme-favorites',
    compatibility: 'adopme-compatibility',
    accounts: 'adopme-accounts',
    theme: 'adopme-theme',
    session: 'adopme-session',
    backend: 'adopme-backend'
  },
  photo: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  categories: ['Todas', 'Perros', 'Gatos', 'Otros'],
  ageFilters: ['Todos', 'Cachorro', 'Adulto', 'Senior'],
  sizeFilters: ['Todos', 'Pequeño', 'Mediano', 'Grande'],
  requestStatuses: ['Recibida', 'En revisión', 'Visita pendiente', 'Aprobada', 'No aprobada', 'Adopción completada'],
  progressSteps: ['Recibida', 'En revisión', 'Visita pendiente', 'Aprobada', 'Adopción completada'],
  petStatuses: ['Disponible', 'En proceso', 'Adoptado'],
  password: {
    iterations: 120000,
    bits: 256,
    saltBytes: 16
  },
  map: {
    center: [19.695, -101.19],
    zoom: 13,
    focusZoom: 14,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap'
  }
};
