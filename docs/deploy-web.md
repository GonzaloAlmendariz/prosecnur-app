# Deploy web del dashboard

Este flujo publica el dashboard actual como un Hugging Face Space con SDK Docker.
La app local arma un snapshot temporal del `.pulso`, sube el codigo minimo del
servidor Plumber + frontend React y deja el Space en modo publico/read-only.

## Crear token de Hugging Face

1. Entra a https://huggingface.co/settings/tokens.
2. Crea un token con permiso `write`.
3. En Prosecnur abre Dashboard -> Deploy.
4. Ingresa usuario/organizacion, token `hf_...` y nombre del Space.

En la app de escritorio el token se guarda con `electron.safeStorage` dentro del
directorio `userData` de Electron. No se escribe en el repo.

## Publicar

1. Abre o guarda el proyecto `.pulso` local.
2. Entra al modulo Dashboard y verifica que la vista tenga datos.
3. Pulsa `Deploy`.
4. Define un nombre de Space, por ejemplo `pulso-cliente-giz`.
5. Pulsa `Publicar`.

La primera construccion de Docker suele tomar 10 a 15 minutos porque instala
paquetes R y dependencias Node. Los siguientes builds deberian ser mas rapidos
si solo cambia `data/proyecto.pulso`.

## Logs de build

Los logs viven en la pagina del Space:

`https://huggingface.co/spaces/<usuario>/<space>/logs`

Tambien puedes abrir el Space desde el link que devuelve Prosecnur y entrar a
la pestana `Logs`.

## Borrar o regenerar un Space

Para borrar:

1. Entra a `https://huggingface.co/spaces/<usuario>/<space>/settings`.
2. Baja hasta `Delete this Space`.
3. Confirma el nombre del Space.

Para regenerar, publica de nuevo con el mismo nombre. El endpoint usa
`existOk=true`; si el Space ya existe, sube los archivos encima.

## Recuperacion si HF falla

- Si el publish falla antes de crear el Space, revisa que el token tenga permiso
  `write` y que el usuario/organizacion tenga permisos para crear Spaces.
- Si falla durante upload, espera unos minutos y vuelve a publicar con el mismo
  nombre. El proceso es idempotente: los archivos existentes se sobrescriben.
- Si el build queda colgado, abre `Settings -> Factory reboot` en el Space.
- Si HF esta caido o saturado, espera y vuelve a publicar con el mismo nombre.
  El dashboard web depende del deploy Docker; ya no hay export HTML standalone
  como fallback.

## Seguridad del modo publico

El contenedor arranca con `PULSO_PUBLIC_MODE=1`. En ese modo Plumber aplica una
whitelist: solo pasan los endpoints read-only necesarios para tabs, filtros y
graficos del dashboard. Uploads, edicion, exports masivos, shutdown y publish
responden `403`.

El frontend se construye con `VITE_PULSO_PUBLIC_MODE=true`, oculta la barra de
admin y agrega `noindex,nofollow` al HTML.
