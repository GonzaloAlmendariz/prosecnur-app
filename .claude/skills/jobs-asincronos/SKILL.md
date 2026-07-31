---
name: jobs-asincronos
description: Sistema de jobs asíncronos de Prosecnur (callr::r_bg) - cómo crear un job con progreso, las dos trampas críticas (namespace re-resuelto y locale UTF-8) y el polling del frontend. Usar al crear o depurar cualquier operación pesada (exports PPT/Word, cálculos de muestra, warmup) o cuando un job corre "una versión vieja" del código o muere con errores de encoding.
---

# Jobs asíncronos

Motor en `api/R/jobs.R`, endpoints en `api/R/router_jobs.R`, cliente en
`frontend/src/api/jobs.ts` y polling en los hooks `useJob` de los dominios. Los
módulos de `frontend/src/api/` importan tipos/helpers de `jobs.ts`; el archivo
`frontend/src/api/client.ts` solo reexporta por compatibilidad y no recibe
código nuevo.

## Patrón canónico

1. **Submit**:
   `job_submit(sid, kind, func, args, result_filename, on_complete)` devuelve
   `job_id` y lanza `callr::r_bg` supervisado.
2. **Payload**: valores grandes se guardan con
   `job_save_rds(sid, prefix, value)` y el closure recibe paths/IDs. No captures
   una sesión o data frame grande dentro del closure serializado.
3. **Progreso**: el worker usa `job_progress_writer(progress_path)` y reporta
   fase, porcentaje y mensaje. Declara `progress_path` en `formals()` o acepta
   `...`.
4. **Resultado**: un archivo termina en el file store y se registra; un payload
   pequeño viaja como `result_data`. `on_complete` actualiza estado solo
   después de validar el resultado.
5. **Endpoints**: status, cancel y result viven bajo `/api/jobs/<id>`.
6. **Frontend**: `frontend/src/api/jobs.ts` posee `JobSnapshot`,
   `apiJobStatus()`, `apiJobCancel()` y `jobResultUrl()`. El hook del dominio
   corta al llegar a `done`, `error` o `cancelled`; no abras un segundo polling
   ad hoc.

## Trampa 1 — Namespace re-resuelto (síntoma: "corre código viejo")

`callr::r_bg` arranca un R limpio. Una referencia serializada al namespace puede
resolverse contra el paquete instalado antes del bootstrap.

- Para funciones top-level, `job_submit()` conserva el nombre y el worker la
  vuelve a obtener con `get(name, envir = asNamespace("prosecnurapp"))`.
- En un closure inline, resuelve funciones del paquete dinámicamente con
  `get(nm, envir = asNamespace("prosecnurapp"))`.
- No recargues el paquete dentro del closure ni llames por nombre pelado a una
  función que podría quedar ligada al namespace anterior.

## Trampa 2 — Locale UTF-8 (síntoma: `no binding for ".transformar_según_modo"`)

El worker puede arrancar en locale `C`, romper bindings no ASCII o impedir que
el código con tildes se cargue. `job_submit()` fuerza `LC_ALL`/`LANG` UTF-8 y
el bootstrap configura locale/encoding con fallback. No alteres esa secuencia
sin ampliar `api/tests/testthat/test-jobs-encoding.R`.

## Errores, cancelación y artefactos

- Un error técnico termina el job en `error`. Un error de dominio que necesita
  conservar `E_*`, status y details viaja estructurado en `result_data`; el
  frontend lo lee con `jobResultDomainError()`.
- La cancelación debe matar el proceso supervisado, cerrar polling y no aplicar
  `on_complete`.
- Un resultado de archivo se registra con `file_id`, nombre público y hash. No
  expongas el path temporal.
- Cada `kind` lleva prefijo de módulo, por ejemplo `graficos.ppt_all`.
- `POST /api/jobs/_selftest` sirve como smoke del circuito completo.

## Checklist para un job nuevo

1. Operación costosa o render de archivo fuera del endpoint.
2. `kind`, args serializables y resultado definidos.
3. Payload grande en RDS, no capturado.
4. Funciones del paquete resueltas en el namespace fresco.
5. Progreso monotónico y mensajes útiles.
6. Cancelación y cleanup idempotentes.
7. `on_complete` valida antes de mutar estado.
8. Módulo frontend de dominio + `frontend/src/api/jobs.ts`; sin crecimiento del
   barrel.
9. `test-jobs.R`, `test-jobs-encoding.R`, `test-jobs-cancel.R` y el test focal
   del router/engine afectados en verde.
