# Contrato: el equipo de campo y la asignación UMP → encuestador en Material territorial

Fecha: 2026-10-31. Decisiones de Gonzalo sobre I3 (`checklist-flujo-analista-2026-10-30.md`): **el equipo se asigna
en Material** y, ante B1, **«la de Monitoreo»**: la lista de encuestadores es una sola, la de Monitoreo.

Estado: **revisado por `guardian-contratos` (2026-10-31) y B1 decidido.** Lo que sigue es el contrato construido; el
borrador previo (equipo propio en Material) queda descartado.

## Problema

- El plan por encuestador de Material › Entrega reparte las jornadas entre «Encuestador 1…N»
  (`hojas_ruta_plan_campo`, sin identidad).
- Monitoreo territorial conoce al aplicador real por lo que llega del campo (`responsible_display`, «P844 · Nombre»,
  por UMP).
- Nadie cruza las dos cosas, así que no se puede saber si el plan se cumplió.

## Decisión

1. **La lista manda en Monitoreo**: `monitoreo_config$territorial$enumerator_roster` (se carga desde Excel en
   Monitoreo, con su `code_format` PXXX o DNI). Material no guarda personas: la lee con
   `.monitoreo_territorial_normalize_enumerator_roster` y expone sólo `{codigo, nombre}`, **nunca el DNI**.
   Si la lista usa `code_format = "DNI"`, el código ES el DNI: el GET no expone a nadie y la asignación queda
   bloqueada con un aviso que pide cargarla con códigos (hallazgo del `verificador`, 2026-10-31).
2. **Material guarda sólo la asignación UMP → código**, materializada por `id_manzana` sobre la foto enviada de la fase
   de la campaña. La UI de Entrega deja elegir un encuestador de esa lista para cada columna «Encuestador k» del
   calendario, y eso asigna todas las UMP de sus jornadas. «Encuestador k» no sigue a la persona (cambia al recalcular
   el plan), por eso se guarda por UMP.
3. **Un reemplazo hereda en lectura** el código de su titular, salvo que tenga uno propio.
4. **Monitoreo la lee** y compara con lo observado. Lo construye su sesión, coordinada por Meta B (B3, abajo).

## Persistencia

Clave de sesión **persistible** `material_territorial_asignacion`, schema `material_territorial_asignacion/v1`, aparte
para no abrir la lista cerrada `.MCAMP_ENTRY_KEYS` ni mover `registry_revision`. Dueño:
`api/R/collection_territorial_asignacion.R`, que la normaliza al leer.

```text
list(
  schema = "material_territorial_asignacion/v1",
  campaign_id = "territorial.principal", fase = "field",
  revision = <int>,                                   # concurrencia optimista propia
  asignacion = list(list(id_manzana = "…", codigo = "P844"), ...),
  sample_fingerprint = "sha256:…",                    # huella de la foto cuando se guardó
  updated_at = "<ISO>"
)
```

Un `.pulso` viejo no la trae y se lee vacía. Una asignación de otra campaña o fase se ignora.

## API

| Método y ruta | Qué hace |
|---|---|
| `GET /api/recopiladores/campaigns/territorial/asignacion?id=` | Lectura pura. `{equipo, code_format, asignacion[{id_manzana, label, role, codigo, origen: explicita\|heredada}], asignacion_revision, sample_fingerprint, sin_fuente, stale, desactualizada, huerfanas, codigos_fuera_del_equipo}`. Sin envío: 200 con `sin_fuente`. Sin campaña: 404 `E_COLLECTION_CAMPAIGN_NOT_FOUND`. |
| `PUT /api/recopiladores/campaigns/territorial/asignacion` | `{id, asignacion[{id_manzana, codigo}], expected_revision}`. Reemplaza la asignación entera; un código vacío deja la UMP sin asignar. Devuelve lo mismo que el GET más `descartadas` (las guardadas que ya no están en la foto). |

Errores del `PUT`:

- Sin envío: 409 `E_COLLECTION_TERRITORIAL_SIN_FUENTE`.
- Foto desactualizada (la muestra viva cambió desde el envío): 409 `E_COLLECTION_TERRITORIAL_DESACTUALIZADA`. Es la
  opción (b) de B2 mientras F4 siga sin empezar.
- Revisión desfasada: 409 `E_COLLECTION_TERRITORIAL_ASIGNACION_STALE`.
- UMP fuera de la foto o código fuera de la lista de Monitoreo (comparado limpio, con
  `.monitoreo_territorial_clean_code`): 422 `E_COLLECTION_TERRITORIAL_ASIGNACION_INVALIDA`, con el detalle por fila.
  Nada se descarta en silencio.

## UI (Material › Entrega)

- **Calendario del plan:** cada columna «Encuestador k» lleva un selector con la lista de Monitoreo
  («P844 · Nombre»). Elegir asigna todas las UMP de esa columna; «Guardar asignación» lo persiste.
- **Sin lista:** aviso que remite a cargar los encuestadores en Monitoreo. **Foto desactualizada o sin envío:** el
  selector se bloquea con el motivo.

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
- Un equipo aparte en Material sería una segunda lista para lo mismo. **Decidido por Gonzalo: «la de Monitoreo».**

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
