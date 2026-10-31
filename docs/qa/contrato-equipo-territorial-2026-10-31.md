# Contrato: el equipo de campo y la asignación UMP → encuestador en Material territorial

Fecha: 2026-10-31. Decisión de Gonzalo sobre I3 (`checklist-flujo-analista-2026-10-30.md`): **el equipo se escribe en
Material**.

Estado: **propuesta, pendiente de revisión de `guardian-contratos`** antes de construir.

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
