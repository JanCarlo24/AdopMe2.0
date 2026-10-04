# AdopMe

AdopMe es una aplicación de adopción de mascotas que corre en el navegador. La persona busca perros, gatos y otros compañeros, guarda favoritos, responde un test de compatibilidad, envía una solicitud y el refugio da seguimiento.

Puede hablar con **Firebase** (Authentication, Firestore y Storage) o quedarse en **localStorage** si la config está apagada, si falta, o si el servicio no responde. Los servicios no eligen: `src/core/app.js` inyecta un adaptador u otro. La guía de consola y reglas está en [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Tecnologías

- HTML, CSS y JavaScript en módulos ES, sin React, Angular ni Vue y sin bundler.
- Firebase JS SDK 11.6.0 por el CDN modular de `gstatic`, solo si el backend activo es Firebase.
- Leaflet 1.9.4 por CDN para el mapa de refugios en Morelia.
- Playwright para las pruebas de extremo a extremo y `node:test` para servicios, validadores y repositorios.
- Un servidor estático cualquiera. Los módulos ES no funcionan abriendo `index.html` como archivo (`file://`).

## Requisitos

- Node.js 20 o superior (para las pruebas y `npm`).
- Python 3 (el comando `npm start` lo usa como servidor estático).

## Estructura

```
config/app.config.js          Claves de almacenamiento, estados y límites de foto
config/firebase.config.js     Config web pública (una sola copia)
index.html                    Página única
src/main.js                   Arranque
src/core/                     Elige backend, compone la app y mira el DOM
src/infrastructure/storage/   Puerto localStorage: navegador, memoria y JSON
src/infrastructure/firebase/  Init, SDK por CDN, errores y subida de fotos
src/modules/remote/           Repositorios y servicios que no importan el SDK
src/modules/<feature>/        Reglas, repositorio local y controlador
src/shared/                   Errores, validadores y utilidades
src/ui/                       HTML escapado, toasts y movimiento
firestore.rules               Lectura pública del catálogo y escrituras del dueño
storage.rules                 Fotos en pets/{uid}/{petId}/…
docs/FIREBASE_SETUP.md        Consola, dominios, reglas y semilla
```

La navegación de la página son anclas (`#catalogo`, `#refugios`, `#proceso`). No hay router.

## Instalación

```bash
npm install
```

`npm install` descarga Playwright y, si están declaradas, las herramientas del emulador. La página no empaqueta `node_modules`: el SDK de Firebase entra por CDN.

## Ejecutar en local

```bash
npm start
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173).

El mismo puerto usa la configuración de Playwright. Si ya hay un proceso escuchando en el 4173, ciérralo antes de correr las pruebas de extremo a extremo.

## Pruebas

```bash
npm test          # node:test y después Playwright, en respaldo local
npm run test:unit # solo servicios, validadores y repositorios
npm run test:e2e  # solo Playwright
npm run test:rules # emulador de Firestore; hace falta Java
```

Playwright escribe `adopme-backend=local` antes de abrir la página. Así la suite no registra usuarios en el proyecto real.

La primera vez que Playwright necesite el navegador:

```bash
npx playwright install chromium
```

## Arquitectura en una frase

`createApp` elige Firebase o `localStorage`, inyecta los repositorios y los servicios no importan el SDK ni llaman a `localStorage`. Los controladores escuchan la página y pintan con funciones de `src/ui`. El detalle está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Cómo agregar un módulo

1. Crea `src/modules/<nombre>/` con lo que de verdad haga falta: `service.js` para reglas, `repository.js` si guarda datos, `controller.js` si habla con el DOM.
2. Si persiste algo, añade la clave en `config/app.config.js` y usa `createJsonStore` con el adaptador que ya inyecta `createApp`. No llames a `localStorage` desde el servicio.
3. Conecta el controlador en `src/core/app.js` mediante el objeto `actions`, sin importar otros controladores.
4. Añade una prueba en `tests/unit` con `createMemoryStorage` y, si hay flujo visible, un caso en `tests/adopme.spec.js`.

## Convenciones

- JavaScript con módulos ES y funciones de fábrica. Hay clases solo para los errores (`AppError`, `StorageError`, `ValidationError`, `AuthError`, `ConnectionError`).
- El repositorio lee y escribe. El servicio decide. El controlador coordina. La UI arma HTML.
- Todo texto que venga de datos y se meta en `innerHTML` pasa por `escapeHtml`. Las fotos pasan por `safeImageUrl`.
- Las claves `adopme-*` y la forma de los JSON se mantienen para el modo local. Ahí el hash sigue siendo PBKDF2-SHA256 con 120 000 iteraciones.
- Con Firebase la contraseña no se guarda en Firestore ni en el navegador. El perfil es `users/{uid}`.
- No se suben secretos, `node_modules/` ni `test-results/`.

## Datos que ya entiende la aplicación

| Clave | Dónde | Contenido |
| --- | --- | --- |
| `adopme-pets` | `localStorage` | Catálogo. Si falta o el JSON no es un array, se usan las 6 mascotas semilla |
| `adopme-adoptions` | `localStorage` | Solicitudes. Si faltaba folio o estado, se completan al arrancar |
| `adopme-favorites` | `localStorage` | Ids de favoritos |
| `adopme-compatibility` | `localStorage` | Respuestas del test |
| `adopme-accounts` | `localStorage` | `{ nombre, correo, salt, passwordHash }` |
| `adopme-session` | `sessionStorage` | `{ nombre, correo }` |
| `adopme-theme` | `localStorage` | `dark` o `light` |
