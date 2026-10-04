# Arquitectura

AdopMe es una sola página. El mapa pide teselas a OpenStreetMap y las fuentes salen de CDNs. Los datos de la app viven en `localStorage` o, si la config es válida y la red responde, en Firebase. El servicio no sabe cuál de los dos le tocó: `createApp` inyecta el repositorio. El detalle de consola, reglas y semilla está en [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Antes

`src/main.js` (unas 1 230 líneas) mezclaba datos semilla, reglas, `localStorage`, hashing, plantillas HTML y todos los eventos. `AdoptionTools` también escribía `localStorage` por su cuenta. La auditoría de ese estado está en [AUDIT.md](AUDIT.md).

## Ahora

```
index.html
   │
   ▼
src/main.js
   │
   ▼
src/core/app.js          crea adaptadores e inyecta dependencias
   │
   ├── infrastructure/storage
   │     browser-storage.js   localStorage / sessionStorage, errores de cuota
   │     memory-storage.js    mismo contrato, para pruebas
   │     json-store.js        JSON.parse protegido
   │
   ├── modules/<feature>
   │     repository   una clave, sin reglas de pantalla
   │     service      reglas (filtro, puntuación, alta, login, migración)
   │     controller   eventos y cuándo volver a pintar
   │
   └── ui/render      cadenas HTML ya escapadas
```

No hay router: `#catalogo` y `#refugios` son anclas del navegador. No hay bus de eventos. En viewports de 700px o menos, `src/ui/mobile-nav.js` muestra la misma navegación en un panel. El botón usa `aria-expanded` y `aria-controls`, y el cierre (enlace, Escape o clic fuera) devuelve el foco al botón. `app.js` pasa un objeto `actions` para que un controlador pida «abre la solicitud» o «repinta recomendaciones» sin importar al otro. Así no se forman ciclos.

## Inversión de dependencias

Los servicios reciben repositorios. Los repositorios reciben un almacén con tres operaciones:

```js
getItem(key)    // string | null
setItem(key, value)
removeItem(key)
```

`createBrowserStorage` adapta el almacenamiento del navegador y convierte `QuotaExceededError` en `StorageError`. `createMemoryStorage` hace lo mismo sobre un `Map`. Un repositorio no pregunta cuál de los dos le llegó. Las pruebas construyen el servicio con memoria y no necesitan DOM.

`createJsonStore` distingue tres casos: clave ausente, JSON válido y JSON corrupto. Un valor ilegible no tumba el arranque: el catálogo vuelve a la semilla, las listas vacías siguen vacías y las preferencias quedan en `null`.

## Features y dónde viven

| Feature | Reglas | Datos |
| --- | --- | --- |
| Catálogo, ficha, filtros | `modules/catalog` | `adopme-pets` |
| Favoritos | `modules/favorites` | `adopme-favorites` |
| Solicitudes y seguimiento | `modules/adoptions` | `adopme-adoptions` |
| Cuentas | `modules/auth` | `adopme-accounts` y `adopme-session` |
| Test y recomendaciones | `modules/compatibility` | `adopme-compatibility` |
| Mapa de refugios | `modules/refuges` | Datos fijos, sin almacenamiento |
| Panel del refugio | `modules/refuge-panel` | Reutiliza catálogo y solicitudes |
| Tema | `modules/theme` | `adopme-theme` |
| Estadísticas | `modules/stats/service.js` | Solo calcula, no guarda |

El panel de refugio sigue siendo una demo de este navegador: no pide sesión. Así estaba y así se conserva.

## Compatibilidad de datos

- Misma clave y mismos nombres de campo que antes (`mascotaId`, `cuentaCorreo`, `estadoSolicitud`, `fecha`, etc.).
- Al arrancar, una solicitud sin `solicitudId` o sin `estadoSolicitud` recibe `Recibida` y un folio, y se reescribe la clave.
- Las mascotas sin `estado` se tratan como `Disponible` en memoria. La semilla no se reescribe hasta que alguien publica, edita o borra.
- La contraseña se deriva con PBKDF2, SHA-256, sal de 16 bytes, 120 000 iteraciones y 256 bits. Esos números están en `config/app.config.js` y no deben bajar si ya hay cuentas guardadas.

## Errores y XSS

`ValidationError` es un dato mal formado (correo, foto que no es `https`, solicitud incompleta). `StorageError` es un fallo del navegador. Los controladores muestran el mensaje en el aviso, el `alert` de la solicitud o el texto del panel, y no dejan el catálogo a medias si la escritura falla.

El HTML dinámico se escapa con `escapeHtml`. Las URLs de foto solo se pintan si el esquema es `http` o `https` (`safeImageUrl`). El alta nueva exige `https`.

## Firebase y el respaldo local

`selectBackend` en `src/core/backend.js` devuelve `local` si `adopme-backend` vale `local`, si `config/firebase.config.js` tiene `enabled: false`, si faltan claves o si `initFirebase` / la primera lectura fallan. En ese caso se construyen los mismos servicios de siempre (`src/core/local-services.js`). Playwright guarda esa clave antes de cargar la página, así que la suite no abre el proyecto real.

Con Firebase, `src/infrastructure/firebase/stack.js` arma auth, catálogo, favoritos, test y solicitudes sobre un puerto de documentos. Los servicios de `src/modules/remote/` hablan con ese puerto, no con el SDK. El SDK modular 11.6.0 entra por CDN solo dentro de `client.js` (`initializeApp` con `getApps`, persistencia local, Analytics únicamente si `isSupported()`).

La contraseña no se escribe en Firestore ni en `localStorage` cuando manda Firebase. El perfil es `users/{uid}` (`nombre`, `correo`, `creado`). El modo local conserva PBKDF2 y 120 000 iteraciones para las cuentas que ya estaban en el navegador.

El panel de refugio en local no pide sesión. En Firebase solo publica y cambia estados si existe `admins/{uid}`, documento que se crea en la consola. Las reglas no dejan que cualquiera escriba mascotas o solicitudes ajenas.

La semilla de seis mascotas se enseña si `pets` está vacío y no se copia sola.

## Qué se dejó fuera a propósito

- Un bundler. El SDK entra por la URL de gstatic fijada en `sdk.js`.
- Un router y un bus de eventos: no aportan en una sola página.
- Custom claims. El rol de refugio es la colección `admins`, porque el navegador no puede firmar claims.
- Archivos vacíos «por si acaso». Cada archivo importa o lo importa alguien.
