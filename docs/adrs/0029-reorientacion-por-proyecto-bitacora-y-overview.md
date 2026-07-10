# ADR 0029: Reorientacion por proyecto, modulo Bitacora y overview del Home

Estado: Aceptado

Fecha: 2026-07-09

## Contexto

Prosecnur se percibia como "una app con modulos". Cada `.pulso` es en realidad
un proyecto de investigacion con estado, avance, bitacora y cronograma. La
suite tenia tres frustraciones concretas:

1. El selector de arranque (`BootGate`) solo mostraba hero + dos botones + lista
   plana de recientes, sin reflejar el peso de "elegir el proyecto del dia".
2. El Home posterior al proyecto era un lanzador (carrusel cinematografico),
   util para quien recien empieza pero mudo para quien ya esta trabajando y
   quiere ver "en procesamiento va esto, en monitoreo este ultimo corte".
3. El modulo ambar estaba sobrecargado: *Diseno del estudio* mezclaba
   expediente, bitacora, fuentes y biblioteca (ADR 0027), y el cronograma vivia
   aparte como modulo secundario oculto *Plan de trabajo* (ADR 0028).

El agregador de estado por modulo que necesitaba el Home ya existia dentro de
`router_diseno_estudio.R` (`.diseno_module_statuses`), y la bitacora y el
cronograma ya estaban implementados y persistidos en `.pulso`. El trabajo era
reencuadrar y consolidar, no reconstruir.

## Decision

Se reorienta la suite alrededor del proyecto en tres frentes:

1. **Modulo Bitacora unico.** *Diseno del estudio* pasa a llamarse **Bitacora**
   y absorbe el cronograma (`Plan de trabajo` deja de ser modulo del registro,
   grid y rail). El modulo expone tres pestanas: **Bitacora** (registro),
   **Cronograma** (Gantt/hitos/ventanas) y **Calendario** (grilla mensual tipo
   Notion). Se **eliminan** del modulo el Expediente, las Fuentes y la Biblioteca;
   la biblioteca metodologica sigue disponible en `/enciclopedia`.

2. **Home adaptativo.** Para proyectos nuevos/vacios el Home sigue siendo el
   carrusel cinematografico. Para proyectos en curso el Home es un *mission
   control* de estado (tarjetas por modulo con acento propio, chip de estado,
   resumen y "Continuar"; metricas de bases/registros/n objetivo/ultimo corte;
   proximos pasos), con el carrusel degradado a seccion "Explorar modulos". La
   madurez la determina el backend.

3. **Overview de proyecto.** El agregador de estado por modulo se expone en un
   endpoint propio `GET /api/project/overview` (`.project_overview_payload`),
   read-only, que reutiliza `.diseno_protocol_summary`/`.diseno_module_statuses`.

Contratos nuevos:

- `GET /api/project/overview` -> `project_overview_v1` (project, maturity,
  metrics, modules, next_actions, risks).
- `POST /api/plan-trabajo/tasks` y `DELETE /api/plan-trabajo/tasks/<id>` para
  crear y eliminar actividades a mano (antes solo se podia importar Excel y
  editar por tarea). Si no hay plan importado se hace scaffold de un plan vacio.
- Alias canonicos `GET/POST /api/bitacora` y `DELETE /api/bitacora/<id>`. La
  clave persistente sigue siendo `diseno_estudio_bitacora` (compat con `.pulso`
  existentes); las rutas viejas `/api/diseno-estudio/bitacora*` se conservan.
- `POST /api/project/manifest-peek`: lectura barata que descomprime solo
  `manifest.json` (nunca `state.rds`) para enriquecer las tarjetas de recientes
  del selector.

Rutas: `/bitacora` (con deep-link `?tab=`). `/diseno-estudio` redirige a
`/bitacora`; `/plan-trabajo` redirige a `/bitacora?tab=cronograma`. Acento
calido unico: Bitacora usa `--pulso-module-encyclopedia` (`#a16207`); el token
`--pulso-module-workplan` queda aliasado a ese valor.

## Consecuencias

Beneficios:

- Un solo lugar para bitacora, cronograma y calendario; menos sobrecarga.
- El Home informa el estado real del proyecto sin perder el lanzador para
  quien recien empieza.
- El overview es un contrato estable y liviano reutilizable por otras
  superficies (fichas, reportes) sin arrastrar el expediente completo.
- Se puede planificar sin un Excel de origen (creacion manual de actividades).

Costos y riesgos:

- El endpoint de overview conoce estructuras de varios modulos y debe degradar
  con cuidado; se mitiga reutilizando el agregador ya probado.
- La bitacora agrega/mantiene estado persistente en `.pulso`.
- El calendario es codigo nuevo (grilla + empaquetado de barras) sin libreria
  externa; su matematica de fechas comparte utilidades con el Gantt para evitar
  drift de zona horaria.

## Cumplimiento

- `GET /api/project/overview` es read-only: no serializa datos crudos, mapas
  pesados, secretos ni entregables. Tests en `test-project-overview.R`.
- `manifest-peek` lee unicamente `manifest.json`. Tests en
  `test-pulso-manifest-peek.R`.
- Las mutaciones de bitacora se limitan a la clave `diseno_estudio_bitacora`.
- `plan_trabajo` sigue guardando solo estado normalizado liviano; crear/eliminar
  tareas usa ids con prefijo `task_m_` (UUID) para no colisionar con
  `task_%03d`. Tests en `test-plan-trabajo.R`.
- `BootGate` permanece minimo (ADR 0021): el peek pasa por `bootClient.ts`, no
  importa codigo de `features/` ni de `api/client`, y es best-effort no
  bloqueante.
- El registro de warmup frontend enumera todos los modulos instalados; los
  perfiles de `plan-trabajo` y `diseno-estudio` se unificaron en `bitacora`
  (`ModuleWarmupBoundary`, `warmupRegistry`), cumpliendo las reglas de warm
  start de ADR 0021.
- Cambios que permitan a Bitacora escribir en otros modulos, o que muevan el
  overview a un contrato mutable, requieren nueva ADR.

## Notas

Reemplaza a ADR 0027 (Diseno del estudio como expediente y bitacora viva) y ADR
0028 (Plan de trabajo como cronograma sincronico). Relacionado con ADR 0002
(`.pulso`), ADR 0006 (modulos por dominio), ADR 0020 (ficha tecnica) y ADR 0021
(arranque con proyecto y warm start).
