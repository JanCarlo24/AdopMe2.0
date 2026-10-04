# Auditoría de AdopMe (fase 1)

Fecha de la auditoría: 2026-10-04. Base revisada: `main` en el commit `f8a16d0` («el diablo»). El código de la aplicación vive en `AdopMe2.0-feature-adopme/`. No se eliminó comportamiento durante esta lectura: este documento describe el estado encontrado y el plan de refactor.

## 1. Estado actual

### Tecnología

| Pieza | Qué hay |
| --- | --- |
| Interfaz | HTML estático (`index.html`), sin framework |
| Lógica | JavaScript de navegador, módulo ES (`src/main.js`, ~1 230 líneas) más una clase auxiliar (`src/lib/adopta-mascota-lib.js`) |
| Estilos | Un solo `src/styles.css` (~621 líneas), variables CSS y modo oscuro con `data-theme` |
| Persistencia | `localStorage` y `sessionStorage`. No hay Firebase, ni API, ni backend |
| Mapa | Leaflet 1.9.4 y teselas de OpenStreetMap, ambos por CDN (`unpkg`) |
| Tipografía e imágenes | Google Fonts y fotos de Unsplash |
| Pruebas | Playwright (`tests/adopme.spec.js`): quiz de compatibilidad y listado de 4 refugios |
| Empaquetado | No hay bundler. `package.json` solo declara `@playwright/test` |

`node_modules/` (194 archivos) y `test-results/.last-run.json` están versionados. `package.json` apunta `main` a `index.js`, que no existe. El `README.md` del subdirectorio está vacío.

La rama `feature/adopme` es otra historia, anterior y no relacionada con este `main`. No se usa como base.

### Estructura

```
AdopMe2.0-feature-adopme/
  index.html
  package.json
  package-lock.json
  playwright.config.js
  src/main.js
  src/styles.css
  src/adopme-mark.svg
  src/lib/adopta-mascota-lib.js
  tests/adopme.spec.js
  node_modules/          # versionado por error
  test-results/          # versionado por error
```

No hay router. La navegación son anclas (`#inicio`, `#catalogo`, `#proceso`, `#refugios`). Los diálogos (`<dialog>`) cubren el resto de flujos.

### Features y de qué dependen

| Feature | Comportamiento actual | Dependencias |
| --- | --- | --- |
| Catálogo | 6 mascotas semilla. Búsqueda por nombre o raza, filtro por categoría, edad y tamaño, ocultar adoptadas, estado vacío, atajo `/` | DOM, `AdoptionTools.searchAndFilter`, `localStorage` `adopme-pets` |
| Ficha | Clic en la tarjeta abre detalle (foto, etiquetas, favorito, adoptar) | DOM, catálogo en memoria |
| Favoritos | Corazón, contador, filtro «solo favoritos» | `localStorage` `adopme-favorites` (array de ids) |
| Recomendaciones | Tres mascotas disponibles. Sin test: heurística perro/cachorro. Con test: puntuación | Catálogo, `adopme-compatibility` |
| Test de compatibilidad | Cuatro selects. Guarda preferencias y muestra 3 resultados | Misma puntuación, `localStorage` |
| Solicitud de adopción | Wizard de 3 pasos. Exige sesión. Guarda folio, estado «Recibida» y fecha ISO | `AdoptionTools.saveAdoptionRequest`, clave `adopme-adoptions`, sesión |
| Seguimiento | Lista las solicitudes de la cuenta, línea de tiempo o resultado «No aprobada» | Sesión + solicitudes |
| Panel del refugio | Alta de mascota (foto solo `https`), cambio de estado, borrado con `confirm`, cambio de estado de solicitud. Si el estado pasa a «Adopción completada», la mascota queda «Adoptado» | Catálogo + solicitudes. Sin autenticación (demo local) |
| Cuentas | Registro y login en el navegador. Contraseña con PBKDF2-SHA256, 120 000 iteraciones, sal de 16 bytes. Sesión solo con nombre y correo | `adopme-accounts` en `localStorage`, `adopme-session` en `sessionStorage` |
| Tema | Claro / oscuro | `adopme-theme` |
| Estadísticas | Disponibles, solicitudes, familias (adopciones completadas) | Derivado de catálogo y solicitudes |
| Refugios | 4 centros en Morelia, lista y mapa Leaflet. Clic centra el mapa | Datos fijos, `window.L` |
| Animación | `IntersectionObserver` en `.reveal` y parallax del héroe si no hay `prefers-reduced-motion` | DOM, CSS |

### Claves y formatos que hay que conservar

- `adopme-pets`: array de mascotas. Semilla si la clave no existe, no es array o el JSON es inválido. Cada ítem gana `estado: 'Disponible'` si no lo trae.
- `adopme-adoptions`: array. La librería usa el prefijo `adopme` y la clave `` `${prefix}-adoptions` ``. Al arrancar, si falta `solicitudId` se genera uno y si falta `estadoSolicitud` se pone `Recibida`, y se reescribe la clave.
- `adopme-favorites`: array de ids (número o string; la UI compara con `String`).
- `adopme-compatibility`: objeto `{ hogar, tiempo, experiencia, preferencia }`.
- `adopme-accounts`: `{ nombre, correo, salt, passwordHash }`. El correo se guarda en minúsculas.
- `adopme-session`: `{ nombre, correo }` en `sessionStorage`.
- `adopme-theme`: `'dark'` o cualquier otro valor tratado como `'light'`.

La solicitud guarda los nombres de campo del formulario (`mascotaId`, `mascotaNombre`, `nombreAdoptante`, `correo`, `telefono`, `tipoVivienda`, `otrasMascotas`, `experiencia`, `mensaje`, `consentimiento`) más `solicitudId`, `cuentaCorreo`, `estadoSolicitud` y `fecha`. Un cambio de estado añade `actualizado`.

## 2. Problemas críticos

1. **Un solo módulo hace todo.** `src/main.js` declara datos, lee y escribe almacenamiento, valida cuentas, hashea contraseñas, puntúa compatibilidad, pinta HTML y engancha todos los eventos. Cualquier cambio de una feature arrastra al resto.
2. **La lógica de negocio toca `localStorage`.** `AdoptionTools.saveAdoptionRequest`, `getAdoptionRequests` y `updateAdoptionRequest` llaman a `localStorage` directo. `main.js` vuelve a escribir `adopme-adoptions` en la migración (líneas 141-153), `adopme-pets`, `adopme-favorites`, `adopme-accounts`, `adopme-compatibility` y `adopme-theme`. No hay forma de probar las reglas con un doble en memoria sin un DOM y un `localStorage` real.
3. **`getAdoptionRequests` puede tumbar el arranque.** Hace `JSON.parse` sin `try/catch`. Un JSON corrupto en `adopme-adoptions` lanza en la migración y el resto de la página no inicia. Otras claves sí se protegen.
4. **`node_modules/` y `test-results/` están en git.** Ensucian el historial, dependen de la plataforma y no deben versionarse. El binario `.bin/playwright` llega sin permiso de ejecución.
5. **El panel de refugio y el alta de mascotas no distinguen errores de almacenamiento** salvo el alta (URL) y el envío de solicitud (`alert`). Un `QuotaExceededError` en favoritos, tema o catálogo se pierde.
6. **Marcadores duplicados en el mapa.** `focusRefuge` hace `L.marker(...).addTo` en cada clic, además de los marcadores creados en `initializeRefugeMap`.

## 3. Problemas de arquitectura

- **SRP.** `renderPets` filtra, cuenta, decide textos, escapa HTML y observa animaciones. `registerForm` / `loginForm` validan, hashean, persisten y navegan el flujo pendiente (ficha o seguimiento).
- **DIP.** La UI y `AdoptionTools` dependen del almacenamiento concreto del navegador. No hay puerto intercambiable.
- **Duplicación.** El toggle de favoritos está copiado en la cuadrícula, en recomendaciones y en la ficha. La lectura JSON con `try/catch` se repite en favoritos, sesión, cuentas, compatibilidad y catálogo.
- **Estado en el módulo.** Unas veinte variables `let` (`activeCategory`, `authSession`, `savedPets`, `applicationStep`, `refugeMap`, etc.) son estado global del módulo. No hay `window.*` de aplicación, salvo el uso de `window.L`, `window.crypto`, `window.confirm` y `window.alert`.
- **Presentación mezclada con reglas.** La puntuación del match, `inferAgeGroup`, `inferPetSize`, `validateAuthAccount` y los estados permitidos viven junto al `innerHTML`.
- **Dependencias circulares.** Hoy no las hay: solo `main.js` importa la librería y la librería no importa nada. El riesgo aparece si se parte el archivo sin una dirección clara (UI → servicio → repositorio → almacenamiento).
- **Funciones largas.** `renderPets`, `renderTracking`, los submits de login/registro y el alta de mascota concentran varias responsabilidades.
- **Código poco usado de la librería.** La app no llama `searchPets`, `getCategories`, `clearAdoptionRequests` ni `filterByCategory` por separado (`searchAndFilter` sí los cubre por dentro). `package.json` `main: index.js` no corresponde a ningún archivo.
- **Vistas derivadas a destiempo.** Cambiar el estado o borrar una mascota actualiza el catálogo y, a veces, las estadísticas, pero no siempre las recomendaciones. Tras marcar «Adopción completada» puede seguir apareciendo el match anterior hasta recargar.
- **CSS.** Un archivo único mezcla tokens, layout, catálogo, diálogos y tres breakpoints. El orden de las reglas importa; al partirlo hay que conservar la cascada.
- **Onboarding.** La app está anidada en `AdopMe2.0-feature-adopme/` mientras la raíz del repo solo tiene ese directorio. Quien clona el fork no ve un `README` útil ni un comando de arranque.

## 4. Seguridad y accesibilidad

- Casi todo el HTML dinámico pasa por `escapeHtml` antes de `innerHTML`. Eso cubre nombre, descripción, mensajes y folios. Las opciones de estado de mascota (`getPetStatusOptions`) no escapan, aunque hoy salen de una lista fija.
- La foto se valida como `https` solo al publicar. Al pintar, `src` se escapa, pero una ficha ya guardada con un esquema no http(s) se volvería a inyectar en el atributo.
- No hay backend: las cuentas y el panel de refugio son una demo de este navegador. Cualquiera abre el panel. Es intencional en la UI («Solo este navegador»), no un control de acceso.
- Contraseñas: no se guarda el texto plano. Hay que mantener sal, iteraciones (120 000), hash SHA-256 y longitud de bits (256) para no invalidar cuentas ya creadas.
- Accesibilidad que ya está: `lang="es"`, labels en formularios, `aria-pressed` en filtros, diálogos con nombre, botón de tema con `aria-label`, texto alternativo en fotos, `prefers-reduced-motion`.
- Huecos: la tarjeta no es operable por teclado (solo el botón de adoptar y el corazón); no hay enlace para saltar al contenido; en ≤700px la navegación principal desaparece (`display: none`) y no hay menú equivalente (el pie conserva parte de las acciones); el foco visible de la tarjeta no está definido.

## 5. Riesgos de regresión

- Cambiar nombres de clave o la forma de los JSON borra o vuelve ilegibles los datos de quien ya usa la demo.
- Cambiar PBKDF2 impide entrar a cuentas existentes.
- Los tests actuales dependen de `#compatibility-form`, `#quiz-result`, `.quiz-result-item` (exactamente 3), `#refuges-title` y `.refuge-list-item` (exactamente 4), servidos en `http://127.0.0.1:4173/`.
- Los ids del HTML (`#pet-grid`, `#adoption-form`, `#auth-trigger`, `data-open-quiz`, `data-open-requests`, `data-open-refuge`, `data-category`) son contrato de la interfaz y de las pruebas.
- El correo de la solicitud sale de la sesión y el campo va `readonly`. El wizard exige validez nativa (`reportValidity`) en el paso activo.
- Las mascotas adoptadas no se listan en el catálogo público; «En proceso» sí, con el botón deshabilitado. La ficha sigue ofreciendo «Me gustaría conocerle».
- Sin preferencias guardadas, el badge dice «Match ideal» porque la puntuación es 0. Con preferencias, el mínimo práctico es 60 y se muestra el porcentaje (tope 99).
- Leaflet se carga con `defer` antes del módulo. Si el CDN falla, el mapa muestra el texto de respaldo y la lista sigue.
- El servidor de pruebas es `python -m http.server` desde el directorio de la app. Mover la app obliga a mover también Playwright y los paths de los estáticos.

## 6. Estructura modular propuesta

Sin frameworks. Cada archivo con responsabilidad real. El almacenamiento se inyecta; los servicios no conocen `localStorage`.

```
index.html
config/app.config.js                 claves, estados, parámetros de hash y mapa
src/main.js                          arranque
src/core/app.js                      composición e inyección
src/core/dom.js                      referencias al documento
src/infrastructure/storage/          puerto getItem/setItem/removeItem
  browser-storage.js                 adapta localStorage/sessionStorage y cuota
  memory-storage.js                  doble en memoria (tests)
  json-store.js                      JSON seguro
src/shared/errors.js
src/shared/utils/                    escape HTML, ids
src/shared/validators/               auth y alta de mascota
src/modules/catalog/                 semilla, reglas de filtro, repositorio, servicio, controlador
src/modules/favorites/
src/modules/adoptions/
src/modules/auth/                    incluye PBKDF2
src/modules/compatibility/
src/modules/refuges/                 datos y mapa
src/modules/refuge-panel/
src/modules/theme/
src/modules/stats/service.js         números derivados, sin DOM
src/ui/render/                       HTML escapado
src/ui/toast.js
src/ui/motion.js                     reveal y parallax
src/styles/                          base, componentes, movimiento, responsive
src/styles.css                       importa las partes en el orden original
```

No se añade un router: no hay rutas más allá de las anclas. No se añade un bus de eventos: `app.js` conecta controladores con callbacks. No se añade Firebase.

La app sale del subdirectorio `AdopMe2.0-feature-adopme/` a la raíz del repositorio (`git mv`) para que clonar, servir y probar sea un solo directorio.

### SOLID aplicado al caso

- **SRP.** Repositorio = leer/escribir una clave. Servicio = reglas (puntuación, migración, alta, login). Controlador = eventos y cuándo pintar. UI = strings HTML.
- **OCP.** Un flujo nuevo se compone en `createApp` sin reescribir los servicios existentes.
- **LSP.** `memory-storage` y `browser-storage` cumplen el mismo contrato (`getItem`, `setItem`, `removeItem`). Los repositorios no distinguen cuál reciben.
- **ISP.** El catálogo no recibe la API de cuentas. Cada servicio ve el repositorio que necesita.
- **DIP.** `createApp({ localStorage, sessionStorage })` construye los adaptadores y los inyecta. Los servicios reciben repositorios, no `window`.

## 7. Qué no se va a hacer

- No se introduce Firebase ni otro backend. La decisión de producto es seguir en el navegador.
- No se reescriben las features ni se añaden pantallas nuevas.
- No se cambia el diseño visual salvo foco visible, enlace de salto y el arreglo de marcadores duplicados en el mapa.
- No se toca la rama `feature/adopme`.
