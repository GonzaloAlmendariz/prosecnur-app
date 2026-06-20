# Publicacion web en HF

Este flujo publica Dashboards en Hugging Face Spaces con SDK Docker. La app
principal sigue siendo local: Prosecnur arma un snapshot temporal del `.pulso`,
sube un runtime publico read-only y deja el Space sin login.

Monitoreo no usa Hugging Face. Sus salidas vigentes son workbooks de Google
Sheets cliente e interno publicados desde el modulo Monitoreo.

## Crear token de Hugging Face

1. Entra a https://huggingface.co/settings/tokens.
2. Crea un token con permiso `write`.
3. En Prosecnur abre Dashboard -> Deploy.
4. Elige el namespace destino, pega el token `hf_...` y define el nombre del
   Space.

En la app de escritorio el token se guarda con `electron.safeStorage` dentro del
directorio `userData` de Electron. No se escribe en el repo. La lista visible
de tokens guarda solo metadatos no secretos, como nombre, alias/cuenta y
mascara; el valor cifrado se descifra solo cuando el usuario selecciona un token
guardado o publica con el.

La credencial y el destino son conceptos separados. Un token puede pertenecer a
una cuenta personal y publicar en una organizacion, por ejemplo el token local
puede figurar como `GonzaloAlmVill` mientras el destino sea
`pulsopucp/resultados-de-la-encuesta-de-satisfaccion`. Prosecnur recuerda
destinos recientes y un namespace por defecto como metadata no secreta.

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

Monitoreo se publica desde `Monitoreo -> Salidas` exclusivamente a Google
Sheets:

- `Cliente / Sheets`: avance agregado para acreditacion o territorial.
- `Interno / Sheets`: workbook operativo con confirmacion manual.

Cuando exista monitoreo telefonico, debe agregarse como otra familia de tablas
Sheets. No debe agregarse como Space ni como flujo HF.

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
