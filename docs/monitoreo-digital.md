# Monitoreo como centro de control operativo

Monitoreo es el modulo local que consolida seguimiento operativo, supervision,
auditoria y reportes desde superficies de campo existentes. No exige que
supervisores o enumeradores instalen Prosecnur: pueden seguir trabajando en
Google Sheets, SurveyMonkey, Kobo, Excel local u hojas de ruta. Prosecnur lee
esas superficies como snapshots, aplica reglas versionadas y publica salidas
controladas.

Monitoreo no depende obligatoriamente de hojas de ruta. Segun el perfil, puede
consumir hojas de ruta, Google Sheets, Excel local, SurveyMonkey o Kobo.
Prosecnur sigue siendo la app local y el proyecto `.pulso` sigue siendo el
snapshot reproducible. Sheets es una superficie operativa externa, no el
backend canonico.

## Contrato del modulo

### Core

El nucleo transversal de Monitoreo contiene:

- fuentes normalizadas;
- snapshot reproducible de datos leidos;
- casos operativos;
- cruces entre universo, barrido, respuestas y avances;
- metas y minimos;
- alertas y auditoria;
- exportaciones XLSX/reportes;
- eventos de sincronizacion.

Estado persistido en `.pulso`:

- `monitoreo_sources`;
- `monitoreo_config`;
- `monitoreo_profile`;
- `monitoreo_snapshot`;
- IDs de hojas, nombres de pestanas, rangos, mapeos y hashes de snapshot.

Estado prohibido en `.pulso`:

- access tokens OAuth;
- refresh tokens;
- tokens SurveyMonkey/Kobo;
- secretos, claves o credenciales.

### Profiles

Los perfiles son especializaciones del motor, no modulos separados:

- `acreditacion`: v1 implementable de punta a punta.
- `territorial`: activo para Kobo + Hojas de Ruta.
- `telefonico`: planificado como perfil especializado.
- `digital_general`: planificado como tablero general.

`config.acreditacion` se mantiene como vista de compatibilidad, pero el modelo
canonico nuevo es `monitoreo_profile`.

Cada proyecto `.pulso` tiene una sola ruta de monitoreo. La UI inicia en un hub
de decision donde el usuario elige `acreditacion`, `territorial`, `telefonico`
o `digital_general`. `acreditacion` y `territorial` tienen flujo activo; las
otras rutas quedan visibles como planificadas. Una vez seleccionada una ruta,
el flujo posterior queda gobernado por ese perfil y cambiarlo implica crear un
proyecto nuevo o reiniciar el monitoreo, porque fuentes, reglas, reportes y
snapshot pertenecen a ese tipo unico.

### Surfaces

Las superficies soportadas o planificadas son:

- Google Sheets;
- Excel local;
- SurveyMonkey;
- KoboToolbox;
- hojas de ruta.

Cada fuente declara:

| Campo | Valores |
|---|---|
| `kind` | `google_sheets`, `surveymonkey`, `kobo` |
| `role` | `universo`, `barrido`, `respuestas`, `avance_interno`, `reporte_cliente`, `hoja_ruta` |
| `integration_mode` | `file`, `connected_read`, `controlled_write` |
| `sheet_binding` | spreadsheet id, pestana, fila de encabezado, rango opcional, ultima lectura y hash |

En `territorial`, una fuente Google Sheets con `role = hoja_ruta` representa la
hoja operativa generada por Hojas de Ruta. El preset esperado usa
`sheet_name = Hojas_de_ruta`, `header_row = 6`, `integration_mode =
connected_read` y, por defecto, `dimensions.territorial_phase = field`.

### Publicaciones

Monitoreo separa publicacion por audiencia y canal. Cada corte puede publicarse
como `web` y/o `sheets`, y cada canal puede salir para `client` y/o
`internal`:

- `client`: publica un Space de avance agregado para cliente, sin PII,
  contactos, GPS puntual, identificadores crudos, alertas, casos accionables ni
  auditoria.
- `internal`: publica un Space privado de solo lectura web para el equipo, con
  el snapshot operativo completo, incluyendo PII, GPS, IDs, alertas, auditoria
  y casos accionables.

La publicacion web interna exige `private = true`. Toda salida interna,
incluyendo Sheets, exige confirmacion manual explicita en Prosecnur antes de
subir el corte completo fuera de la maquina local. No hay autosync remoto: cada
corte se sincroniza localmente y luego se republica de forma manual.

Los ejecutivos tabulares por audiencia se publican desde Prosecnur hacia Google
Sheets como pestanas controladas de cliente o internas. El Space interno no
expone descargas XLSX/CSV; muestra datos completos solo como vista web privada.

## KoboToolbox

KoboToolbox se configura desde la Configuracion global de Prosecnur como
perfiles de conexion. Cada perfil combina alias, servidor KPI y token local:
por ejemplo `Kobo EU` con `https://eu.kobotoolbox.org` o `Kobo UNHCR` con
`https://kobo.unhcr.org`. El token se guarda fuera del `.pulso`; las fuentes de
Monitoreo solo guardan `base_url`, `asset_uid` y `connection_profile_id`.

Endpoints:

- `POST /api/connections/kobo/profiles`: guarda un perfil Kobo con
  `token`, `alias`, `base_url`, `profile_id` y `make_default`.
- `GET /api/connections/kobo/profiles`: lista perfiles con token enmascarado y
  servidor, sin exponer secretos.
- `POST /api/monitoreo/kobo/assets`: lista proyectos visibles para el perfil y
  servidor seleccionados.

Reglas:

- El token antiguo `kobo_token` se expone como perfil legado para no romper
  instalaciones previas.
- Al sincronizar una fuente Kobo, Prosecnur resuelve el token por
  `connection_profile_id`; si no existe, usa el perfil predeterminado.
- `connection_profile_id` y `base_url` pueden viajar en `.pulso`; el token no.

## Google Sheets

Google Sheets se trata como integracion saliente fuerte. El usuario autoriza
la conexion localmente desde la Configuracion global de Prosecnur. Monitoreo
solo consume el estado de esa conexion para inspeccionar, registrar y
sincronizar fuentes. El material OAuth se guarda fuera del proyecto usando los
helpers de secretos definidos por ADR 0005.

Endpoints:

- `GET /api/connections`: estado global de SurveyMonkey, Kobo y Google
  Sheets, siempre enmascarado.
- `POST /api/connections/google_sheets/oauth`: inicia la autorizacion OAuth
  local y guarda secretos fuera de `.pulso`.
- `GET /api/monitoreo/sheets/status`: compatibilidad para que Monitoreo
  consulte si Google Sheets ya esta autorizado.
- `POST /api/monitoreo/sheets/list`: lista hojas autorizadas cuando existe
  credencial.
- `POST /api/monitoreo/sheets/inspect`: lee metadatos de pestanas y
  encabezados.
- `POST /api/monitoreo/sheets/source`: registra una pestana como fuente.
- `POST /api/monitoreo/sheets/sync`: lee la fuente como snapshot local.
- `POST /api/monitoreo/sheets/publish`: publica solo pestanas Prosecnur.

Reglas de escritura:

- Prosecnur nunca modifica la pestana viva de campo.
- Solo crea o reemplaza pestanas propias con prefijo `Prosecnur - `.
- Las pestanas controladas v1 son `Prosecnur - Resumen`,
  `Prosecnur - Alertas`, `Prosecnur - Auditoria` y
  `Prosecnur - Reporte`.
- En Monitoreo Territorial, `hoja_ruta` se lee como snapshot local para
  diagnosticar asignaciones, UMP sin primera encuesta y posibles errores de
  UMP/Codigo Pulso; no altera el avance oficial hasta que el usuario aplique
  una reconciliacion.

## Perfil `acreditacion`

El perfil `acreditacion` tiene dos variantes canónicas.

### `multi_actor`

Inspirada en `Code.gs`. Representa estudios con actores activos como
Administrativos, Docentes, Egresados y Estudiantes. Cada actor puede tener su
universo, una o mas fuentes de respuestas y variables de control. Las unidades
de reporte pueden ser actores, segmentos o grupos.

Reglas principales:

- cruce universo-respuestas por llaves normalizadas;
- deduplicacion por prioridad `Completa > Parcial > Rechazo > Sin respuesta`;
- rechazo por reglas de consentimiento o autorizacion;
- avance por unidad y detalle por variables de control;
- alertas de coherencia entre barrido, campo y plataforma.

### `segmentada_por_carrera`

Inspirada en `Code_Ingenieria.gs`. Representa un actor principal, usualmente
Egresados, abierto por carrera/programa. Cada segmento tiene valor de universo,
pestana de barrido y minimo operativo. El reporte muestra avance contra minimo
y avance contra universo total.

Reglas principales:

- dimension principal, por ejemplo `Carrera`;
- segmentos activos y grupos de segmentos;
- minimos por segmento;
- puente universo-barrido para mapear codigo institucional a `CodPulso`;
- validacion de encuestas por segmento y canal;
- alerta cuando hay respuestas en correo y telefonico para el mismo caso.

## Alertas canónicas de acreditacion

Monitoreo debe producir alertas equivalentes a las reglas operativas de los
Apps Script, pero expresadas como salida del motor:

- llave faltante en barrido;
- llave duplicada en barrido;
- enlace con id distinto a la llave del caso;
- campo reporta efectiva pero plataforma no confirma;
- plataforma confirma efectiva pero campo no la marca;
- respuesta de plataforma sin llave;
- respuesta de plataforma inexistente en barrido;
- caso con respuesta en doble canal;
- caso sin puente universo-barrido;
- responsable con muchos no barridos;
- casos sin responsable asignado;
- no contesta con pocos intentos;
- diferencias de efectivas por dia entre campo y plataforma.

## Casos de aceptación basados en Apps Script

Los archivos `Code.gs` y `Code_Ingenieria.gs` son referencias de dominio, no
codigo a copiar. No se incorporan sus URLs reales, IDs reales ni tokens.

Fixture `acreditacion_multi_actor`:

- contiene cuatro actores;
- mezcla respuestas completas, parciales y rechazos;
- usa varias llaves de cruce;
- permite fallback por nombre si el perfil lo declara;
- genera resumen por actor y alertas de barrido.

Fixture `acreditacion_segmentada_por_carrera`:

- contiene actor principal `Egresados`;
- abre la dimension `Carrera`;
- define minimos por segmento;
- usa puente universo-barrido;
- detecta doble canal y casos sin puente.

## UI v1

La pantalla `Monitoreo operativo` debe:

- abrir con un hub inicial de rutas: `Acreditacion`, `Territorial`,
  `Telefonico`, `General`;
- indicar que cada proyecto tiene un tipo unico de monitoreo;
- habilitar completo `Acreditacion` y `Territorial`, y mostrar las otras rutas
  como planificadas;
- bloquear la mesa posterior a la ruta elegida y mostrar la ruta activa como
  insignia, no como selector editable;
- indicar que campo edita en Sheets y Prosecnur audita y reporta;
- no pedir credenciales ni tokens dentro de Monitoreo;
- ofrecer un acceso claro a Configuracion global para autorizar APIs;
- reemplazar el card deshabilitado de Google Sheets por un flujo real de
  seleccion de conexion autorizada, inspeccion, registro de fuente y
  publicacion controlada.

En el perfil `territorial`, `Avance territorial` mide avance operativo:
respuestas que pasan el filtro de consentimiento o aptitud contra la meta de
Hojas de Ruta. La pestana `Validacion` concentra auditoria y tiene tres
subpestanas: `Resumen`, `Geolocalizacion` y `Duracion de tiempo`. Las
respuestas con GPS ausente/lejos o duracion fuera de umbral quedan `En
observacion`; un visto bueno auditado puede aprobar la observacion sin cambiar
el total de avance operativo.

La hoja operativa `Hojas_de_ruta` puede conectarse opcionalmente como evidencia
diagnostica. Monitoreo la normaliza a asignaciones por encuestador/UMP, la cruza
contra la ruta activa y el roster, y expone recomendaciones de reconciliacion
sin aplicarlas automaticamente.

## Pruebas

Cobertura minima:

- normalizacion de `google_sheets`, `role`, `integration_mode` y
  `sheet_binding`;
- persistencia `.pulso` sin tokens OAuth;
- perfil `acreditacion` multi-actor y segmentado por carrera;
- deduplicacion, rechazo, minimos y alertas;
- endpoints `/api/monitoreo/sheets/*`;
- tipos TypeScript y envio de payloads de Sheets desde frontend;
- perfil `territorial`: avance operativo separado de observaciones GPS/tiempo
  y visto bueno persistido en `config.territorial.validation_decisions`;
- perfil `territorial`: fuente opcional `hoja_ruta` no cuenta como respuesta y
  produce diagnosticos/recomendaciones de reconciliacion.
