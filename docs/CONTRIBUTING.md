# Contribuir

## Rama

El trabajo nuevo sale de `main`. La rama `feature/adopme` es historia vieja y no se usa como base. Firebase vive en `feat/firebase-integration`.

## Entorno

```bash
npm install
npx playwright install chromium
npm start
```

Abre http://127.0.0.1:4173. Hace falta un servidor HTTP: el navegador bloquea los módulos ES en `file://`.

Antes de proponer un cambio:

```bash
npm test
```

`npm run test:unit` no abre el navegador. `npm run test:e2e` sí, y necesita el puerto 4173 libre.

## Cómo está partido el código

- No llames a `localStorage`, `sessionStorage` ni al SDK de Firebase fuera de `src/infrastructure/`.
- No guardes contraseñas, sales ni hashes en Firestore.
- No pongas reglas de negocio en los controladores ni HTML en los servicios.
- Pasa dependencias por argumentos (`createX({ repository })`). No uses variables globales.
- Si añades una clave, documéntala en `config/app.config.js` y en el README. Conserva las claves `adopme-*` ya existentes.
- Escapa cualquier dato que vaya a `innerHTML`.
- No subas `node_modules/`, `test-results/`, `.env` ni secretos. `.gitignore` ya los cubre.

## Un módulo nuevo

1. Carpeta `src/modules/<nombre>/`.
2. Servicio puro, fácil de probar con `createMemoryStorage`.
3. Repositorio solo si hay una clave nueva.
4. Controlador solo si hay DOM. Engánchalo en `src/core/app.js`.
5. Prueba unitaria y, si se ve en la página, un caso de Playwright.
6. Una línea en `docs/ARCHITECTURE.md` y en la tabla del README.

## Estilo

Nombres en español cuando describen el dominio (`estadoSolicitud`, `nombreAdoptante`) porque así están guardados. El código de infraestructura puede estar en inglés (`createJsonStore`, `StorageError`). Funciones cortas, `async/await` en el hash de contraseñas, y limpieza de listeners en el `destroy` de cada controlador.

## Firebase

No se añade. La decisión de producto es seguir con `localStorage`. Si en el futuro hubiera un backend, el cambio sería otro adaptador con el mismo contrato `getItem` / `setItem` / `removeItem` (o un repositorio nuevo inyectado en el servicio), no una llamada directa desde la interfaz.
