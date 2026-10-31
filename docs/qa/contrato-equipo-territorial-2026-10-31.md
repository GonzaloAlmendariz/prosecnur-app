# Contrato: el equipo de campo y la asignación UMP → encuestador en Material territorial

Fecha: 2026-10-31. Decisión de Gonzalo sobre I3 (`checklist-flujo-analista-2026-10-30.md`): **el equipo se escribe en
Material**.

Estado: **revisado por `guardian-contratos` (2026-10-31): aprobado con cambios y requiere enmienda de ADR 0118.** No se construye hasta que Gonzalo decida B1 (ver «Revisión», al final).

## Problema

- El plan por encuestador de Material › Entrega reparte las jornadas entre «Encuestador 1…N»
  (`hojas_ruta_plan_campo`, sin identidad).
- Monitoreo territorial conoce al aplicador real por lo que llega del campo (`responsible_display`, «P844 · Nombre»,
  por UMP).
- Nadie cruza las dos cosas, así que no se puede saber si el plan se cumplió.

## Decisión de diseño

1. **El equipo vive en Material**, en la campaña territorial. Es una lista `{codigo, nombre}`. `codigo` es el que el
   encuestador usará en el formulario, el mismo que aparece después en `responsible_display`.
2. **La asignación también vive en Material**: una tabla UMP → `codigo`, guardada en la campaña. La UI de Entrega deja
   asignar un integrante del equipo a cada columna «Encuestador k» del calendario del plan, y eso asigna todas las UMP
   de sus jornadas. La asignación se guarda materializada por UMP; no se recalcula del plan.
3. **Monitoreo la lee** (sólo lectura) y compara con lo observado: «asignada a P844 · la hizo P930». La columna y el
   filtro de Monitoreo los hace su sesión, coordinada por Meta B. No se toca `features/monitoreo/**` desde aquí.

## Persistencia

Nueva clave de sesión **persistible** `material_territorial_equipo`, schema `material_territorial_equipo/v1`. Va en
una clave aparte para no abrir la lista cerrada `.MCAMP_ENTRY_KEYS` ni cambiar `material_campaigns/v1`.

```text
list(
  schema = "material_territorial_equipo/v1",
  revision = <int>,                       # concurrencia optimista, como material_campaigns
  equipo = list(list(codigo = "P844", nombre = "Ejemplo Prueba Dieciocho"), ...),
  asignacion = list(list(id_manzana = "15011703200032 0", hoja_num = 71L, codigo = "P844"), ...),
  sample_fingerprint = "sha256:…",        # huella de la foto enviada cuando se guardó
  updated_at = "<ISO>"
)
```

- Se declara en `session_schema.R` como `literal` / `persistible`, con su normalizador.
- Un `.pulso` viejo no la trae y se lee como vacía, sin marcar dirty.
- **Datos personales:** son nombres de encuestadores, el mismo dato que Monitoreo ya muestra en `responsible_display`.
  Viajan en el `.pulso` como el resto del estado. El anonimizador de proyectos de referencia
  (`api/scripts/pulso_anonimizar.R`) debe cubrir esta clave.

## API

| Método y ruta | Qué hace |
|---|---|
| `GET /api/recopiladores/campaigns/territorial/equipo` | Devuelve `{equipo, asignacion, revision, sample_fingerprint, desactualizada, huerfanas}`. `asignacion` sólo trae las UMP que siguen en la foto enviada; `huerfanas` cuenta las que ya no están; `desactualizada` es verdadero si la huella guardada difiere de la de la foto actual. Es lectura pura y la consume también Monitoreo. |
| `PUT /api/recopiladores/campaigns/territorial/equipo` | Recibe `{equipo, asignacion, expected_revision}` y guarda; marca `project_dirty`. |

Validación del `PUT` (errores con `stop_api`, códigos nuevos en `errors_registry.R`):

- **Equipo:** `codigo` obligatorio, único, de 1 a 20 caracteres, sin espacios a los lados; `nombre` de 0 a 80.
  Error `E_TERRITORIAL_EQUIPO_INVALIDO` (422).
- **Asignación:** cada `codigo` debe estar en el equipo y cada `id_manzana` en la foto enviada. Error
  `E_TERRITORIAL_ASIGNACION_INVALIDA` (422).
- **Sin campaña territorial o sin envío:** error 409, con los códigos existentes.
- **Revisión desfasada:** error `E_TERRITORIAL_EQUIPO_STALE` (409).

**Reenvío de la muestra:** la asignación de las UMP que siguen en la foto se conserva; las demás cuentan como
`huerfanas` hasta el siguiente guardado, que las descarta.

## UI (Material › Entrega)

- **Bloque «Equipo»:** tabla del kit con código y nombre, para agregar y quitar integrantes.
- **Calendario del plan:** cada columna «Encuestador k» tiene un selector del equipo. Elegir asigna todas las UMP de
  esa columna. Las UMP ya asignadas muestran el código.
- **Guardar:** botón «Guardar equipo y asignación», con su estado.

## Gate

- **testthat:** normalizador; validaciones; ida y vuelta por `.pulso` (save, load); reenvío con UMP que salen;
  revisión desfasada; `.pulso` sin la clave.
- **vitest:** asignar por columna del calendario.
- **En vivo** sobre acnur_acg con la muestra enviada.
- **Gates del área:** `make gate-area AREA=recopiladores` (o el patrón de campañas) y
  `make gate-front AREA=recopiladores`.

## Revisión de guardian-contratos (2026-10-31)

### Bloqueos

**B1. Ya existe una lista de encuestadores, la de Monitoreo.**
- Vive en `monitoreo_config$territorial$enumerator_roster` con `{codigo_pulso, nombre, nombre_normalizado, dni,
  source_row}` y `code_format` (PXXX o DNI).
- Se carga desde Excel (`router_monitoreo.R:3615`), tiene su libro de códigos (`:3693`) y se reconcilia (`:3717`).
- De ella sale `responsible_display` (`monitoreo_engine.R:14449-14459`). Un código que no esté en esa lista se pinta
  «Responsable no identificado».
- Un equipo aparte en Material sería una segunda lista para lo mismo. **Decisión de Gonzalo:** qué lista manda.

**B2. El plan de Material se arma con la muestra viva de la fase activa, no con la foto enviada.**
- `EntregaTerritorial.tsx:30` y `router_hojas_ruta_plan_campo.R:10-16` usan la muestra viva.
- Con la foto desactualizada, o con otra fase activa, asignar una columna manda UMP que no están en la foto.
- Dos caminos:
  - (a) armar el plan con la foto. Es el F4 de Meta B, que dijo «no la empieces».
  - (b) bloquear la asignación mientras la foto esté desactualizada, como ya hace F2b para generar.
- Mientras F4 siga sin empezar, va **(b)**.

**B3. Cómo compara Monitoreo.**
- Sólo compara si la huella de su muestra coincide con `sample_fingerprint`; si no, muestra «asignación de otra
  muestra».
- Compara contra el código limpio (`.monitoreo_territorial_clean_code`), no contra el texto de `responsible_display`.
- La columna nueva se llama `codigo_planificado`, para no chocar con `enumerator_assigned`.

### Cambios aceptados (se aplican al construir)

1. **Clave aparte** con `campaign_id` y `fase`, y su propia `equipo_revision`.
2. **Normalizador** en un archivo nuevo del dueño (no en `session_schema.R`), aplicado al leer.
3. **Asignación** sólo por `id_manzana` (sin `hoja_num`, que choca entre titulares y reemplazos). Un reemplazo hereda
   el código de su titular.
4. **Códigos** validados con las reglas de Monitoreo (`code_format`) mediante un helper compartido. Errores
   `E_COLLECTION_TERRITORIAL_EQUIPO_INVALIDO`, `E_COLLECTION_TERRITORIAL_ASIGNACION_INVALIDA` y
   `E_COLLECTION_TERRITORIAL_EQUIPO_STALE`.
5. **GET:**
   - lectura pura;
   - 200 con `sin_fuente` cuando no hay envío, y 404 cuando no hay campaña;
   - `hoja_num` y etiqueta derivados de la foto;
   - `codigos_no_reconocidos_en_monitoreo` mientras existan dos listas.
6. **PUT:** devuelve `descartadas` (nada se descarta en silencio) y responde 409 con
   `E_COLLECTION_TERRITORIAL_SIN_FUENTE` cuando no hay envío.
7. **«Encuestador k» no sigue a la persona**: cambia al recalcular el plan. Por eso la asignación se guarda por UMP.
8. **Datos personales:** sólo `codigo` y `nombre`, nunca DNI. El anonimizador necesita una función explícita y un
   detector para esta clave, porque hoy sólo recorre data.frames. **Hueco previo, sin verificar:** el
   `enumerator_roster` de Monitoreo, con nombres y DNI, probablemente tampoco pasa por el anonimizador.
9. **Enmienda de ADR 0118** con: dueño de la lista, plan desde la foto o bloqueo, lectura de Monitoreo, política de
   datos personales y herencia de los reemplazos. `monitoreo_engine.R` y `router_monitoreo.R` no crecen.
