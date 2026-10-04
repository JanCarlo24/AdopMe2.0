# Firebase en AdopMe

La aplicación sigue siendo una página estática de módulos ES. No hay empaquetador: `npm start` sirve los archivos con Python y el navegador importa `src/main.js`. Por eso el SDK no sale del paquete npm `firebase` (está pensado para un bundler). Se carga el SDK modular **11.6.0** desde `https://www.gstatic.com/firebasejs/11.6.0/`, con la versión fijada en `src/infrastructure/firebase/sdk.js`.

La configuración web pública vive en un solo módulo, `config/firebase.config.js`. No es un secreto de servidor: Firebase la entrega al navegador y quien protege los datos son las reglas. No se lee `process.env` en el cliente. `config/firebase.config.example.js` muestra la forma para otro proyecto; copia ese archivo sobre el config real y no hace falta tocar servicios ni controladores.

## Qué se guardaba antes

| Dato | Antes | Con Firebase | Respaldo local |
| --- | --- | --- | --- |
| Cuenta | `adopme-accounts` con sal y hash PBKDF2 | Authentication email/contraseña. El hash ya no se escribe | Sigue el hash PBKDF2, 120 000 iteraciones |
| Sesión | `sessionStorage` `adopme-session` | Persistencia local de Firebase (`onAuthStateChanged`) | Igual que antes |
| Perfil | nombre dentro de la cuenta | `users/{uid}` sin contraseña | Dentro de la cuenta local |
| Mascotas | `adopme-pets` | `pets/{petId}` | Semilla si la clave falta o está corrupta |
| Solicitudes | `adopme-adoptions` | `adoptions/{solicitudId}` con `ownerUid` | Igual que antes |
| Favoritos | `adopme-favorites` | `users/{uid}/favorites/ids` | Igual que antes |
| Test | `adopme-compatibility` | `users/{uid}/compatibility/result` | Igual que antes |
| Tema | `adopme-theme` | Sigue en `localStorage` | Igual |
| Refugios del mapa | Cuatro fichas fijas en código | No se suben | Igual |
| Foto | Solo URL `https` | URL `https` o archivo JPEG/PNG/WebP de hasta 2 MB en `pets/{uid}/{petId}/…` | Solo URL `https` |

`src/core/app.js` elige el backend. Si `localStorage['adopme-backend']` es `local`, si `enabled` no es `true`, si la config no valida, si el SDK o Firestore fallan, o si no responden en 8 segundos, se usan los adaptadores de `localStorage` y un toast explica el fallo. Las pruebas de Playwright fijan `adopme-backend=local` para no tocar el proyecto real.

## Modelo

```
users/{uid}                         nombre, correo, creado
users/{uid}/favorites/ids           { ids: string[] }
users/{uid}/compatibility/result    hogar, tiempo, experiencia, preferencia
admins/{uid}                        lo crea un administrador en la consola; la app no puede escribirlo
pets/{petId}                        nombre, especie, raza, edad, categoria, foto, descripcion,
                                    estado, ownerUid, creado, edadGrupo?, tamano?
adoptions/{solicitudId}             campos del formulario, ownerUid, cuentaCorreo,
                                    estadoSolicitud, fecha, actualizado?
```

Estados de mascota: `Disponible`, `En proceso`, `Adoptado`.
Estados de solicitud: `Recibida`, `En revisión`, `Visita pendiente`, `Aprobada`, `No aprobada`, `Adopción completada`.

La lectura pública de `pets` solo cubre `Disponible` y `En proceso`. Un adoptado lo ve el dueño o una cuenta de `admins`. Las solicitudes las lee su `ownerUid` o un admin. Solo un admin cambia el estado. El panel de refugio, en local, sigue siendo la demo de este navegador. Con Firebase solo escribe si existe `admins/{uid}` (no hay custom claim: no hace falta Admin SDK en el navegador). Ese documento se crea a mano en la consola; las reglas rechazan que un usuario se dé de alta solo.

Las fotos del catálogo se pueden leer sin sesión porque la ficha es pública. Escribir solo puede el uid que figura en la ruta, con tipo `image/jpeg`, `image/png` o `image/webp` y menos de 2 MB. El resto de rutas de Storage queda cerrado.

## Semilla

Milo, Luna, Toby, Nala, Bruno y Mora siguen en `src/modules/catalog/seed.js`. Si `pets` está vacío, la app las muestra en memoria y **no las copia** a Firestore. Publicar la primera mascota pasa el catálogo a lo que haya en remoto. `scripts/seed-firestore.mjs` (o `npm run seed:plan`) solo imprime el plan: sin `--confirm`, o si ya hay documentos, no escribe. No incluye credenciales de administrador.

## Arranque en la consola (proyecto `adopme-712e6`)

Estas reglas **no están desplegadas** desde este repositorio. Hay que hacerlo en la consola y con la CLI.

1. Entra a [Firebase Console](https://console.firebase.google.com/) → proyecto **adopme-712e6**.
2. **Authentication → Sign-in method → Correo electrónico/contraseña**: actívalo. El enlace de contraseña olvidada usa el mismo método.
3. **Authentication → Settings → Authorized domains**: añade `localhost` y `127.0.0.1`. `firebaseapp.com` ya suele estar.
4. **Firestore Database**: crea la base en modo producción (las reglas de este repo niegan todo lo que no esté descrito). Región cercana, por ejemplo `us-central1` si la consola no ofrece otra.
5. **Storage**: activa el bucket. El config usa `adopme-712e6.firebasestorage.app`.
6. **Authentication → Settings → Plantillas**: revisa el idioma del correo de restablecimiento si quieres el texto en español.
7. Para el panel de refugio, **Firestore → iniciar colección `admins`** y crea el documento cuyo id es el `uid` de esa cuenta (lo ves en Authentication después de registrarte). El contenido puede ser `{ "rol": "refugio" }`. No lo puede crear el cliente.
8. Instala la CLI y despliega solo reglas (no se despliegan solas al abrir la app):

```bash
npm install
npx firebase login
npx firebase deploy --only firestore:rules,storage
```

El proyecto por defecto está en `.firebaserc` (`adopme-712e6`).

9. Arranque local:

```bash
npm start
```

Abre http://127.0.0.1:4173 **sin** `adopme-backend=local`. Si las reglas o la red fallan, la app vuelve a `localStorage` y lo dice en el toast.

Para forzar el respaldo en el navegador:

```js
localStorage.setItem('adopme-backend', 'local')
```

Recarga. Para volver a Firebase, borra esa clave.

## Código

- `src/infrastructure/firebase/client.js` llama a `initializeApp` una vez (`getApps`), deja `auth`, `db` y `storage`, y solo crea Analytics si `isSupported()` resuelve verdadero.
- Los servicios de `src/modules/remote/` reciben repositorios. No importan el SDK.
- El SDK se usa en `client.js`, `gateways.js` y `document-store.js`.
- Errores de auth, red y permisos se traducen en `src/infrastructure/firebase/errors.js`. La interfaz usa el toast y `#auth-feedback`. No hay `alert()`.
- Contraseña olvidada: botón en el formulario de entrada. Llama a `sendPasswordResetEmail`.

## Probar reglas en el emulador

Hace falta Java (el emulador de Firestore) y las dependencias de desarrollo `firebase-tools`, `firebase` y `@firebase/rules-unit-testing`. Ese paquete `firebase` no lo carga la página: el navegador sigue usando el CDN.

```bash
npm run test:rules
```

Ese comando no forma parte de `npm test`. `npm test` cubre los servicios con dobles en memoria y Playwright contra el respaldo local, sin crear usuarios en el proyecto real.
