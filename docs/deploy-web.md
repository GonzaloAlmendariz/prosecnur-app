# Publicacion web en HF

Este flujo publica artefactos separados en Hugging Face Spaces con SDK Docker.
La app principal sigue siendo local: Prosecnur arma un snapshot temporal del
`.pulso`, sube un runtime publico read-only y deja el Space sin login.

Hay dos familias:

- Dashboard: conserva el flujo existente y sirve el dashboard interactivo.
- Monitoreo: publica un visor minimo de snapshot agregado. El Space contiene
  `data/proyecto.pulso`, un runtime R reducido y un HTML publico; no sube el
  frontend ni los routers completos de la app local.

## Crear token de Hugging Face

1. Entra a https://huggingface.co/settings/tokens.
2. Crea un token con permiso `write`.
3. En Prosecnur abre Dashboard -> Deploy o Monitoreo -> Publicar web.
4. Ingresa usuario/organizacion, token `hf_...` y nombre del Space.

En la app de escritorio el token se guarda con `electron.safeStorage` dentro del
directorio `userData` de Electron. No se escribe en el repo.

## Publicar dashboard

1. Abre o guarda el proyecto `.pulso` local.
2. Entra al modulo Dashboard y verifica que la vista tenga datos.
3. Pulsa `Deploy`.
4. Define un nombre de Space, por ejemplo `pulso-cliente-giz`.
5. Pulsa `Publicar`.

La primera construccion de Docker suele tomar 10 a 15 minutos porque instala
paquetes R y dependencias Node. Los siguientes builds deberian ser mas rapidos
si solo cambia `data/proyecto.pulso`.

## Publicar Monitoreo

1. Sincroniza localmente el corte de Monitoreo.
2. Abre el modulo Monitoreo y pulsa `Publicar web`.
3. Usa un Space distinto por reporte, por ejemplo `acnur-avance-territorial`
   y `acnur-avance-acreditacion`.
4. Publica. Para actualizar el corte, vuelve a publicar al mismo Space.

El Space de Monitoreo no sincroniza Kobo ni Sheets. Solo lee el payload
agregado embebido en el `.pulso` publicado:

- acreditacion: resumen, avance por actor, brechas/meta, avance diario y
  fuentes agregadas;
- territorial: KPIs, avance por distrito, brechas, avance diario y fase activa.

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
  El dashboard publicado depende del deploy Docker; ya no hay export HTML
  standalone como fallback.

## Seguridad del artefacto publicado

El contenedor arranca con `PULSO_PUBLIC_MODE=1`. En ese modo Plumber aplica una
whitelist: solo pasan los endpoints read-only necesarios para tabs, filtros y
graficos del dashboard o el reporte agregado de Monitoreo. Uploads, edicion,
sync, Kobo/Sheets, PDF, exports, shutdown y publish responden `403`.

El reporte web de Monitoreo no expone respuestas individuales, GPS puntual,
correos, telefonos, `response_id`, `internal_queries`, auditorias de caso ni
trazabilidad cruda.

El frontend se construye con `VITE_PULSO_PUBLIC_MODE=true`, oculta la barra de
admin y agrega `noindex,nofollow` al HTML.

Este modo no habilita colaboracion remota ni convierte Prosecnur en SaaS. Es
una publicacion controlada de un dashboard derivado de un proyecto local.
