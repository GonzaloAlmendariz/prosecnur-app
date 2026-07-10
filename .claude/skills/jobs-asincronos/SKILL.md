---
name: jobs-asincronos
description: Sistema de jobs asíncronos de Prosecnur (callr::r_bg) - cómo crear un job con progreso, las dos trampas críticas (namespace re-resuelto y locale UTF-8) y el polling del frontend. Usar al crear o depurar cualquier operación pesada (exports PPT/Word, cálculos de muestra, warmup) o cuando un job corre "una versión vieja" del código o muere con errores de encoding.
---

# Jobs asíncronos

Motor en `api/R/jobs.R` (374 líneas), router `router_jobs.R`, frontend `useJob.ts` + sección Jobs de `client.ts`. Lo usan 8 routers (graficos, calc_muestra, monitoreo, codificacion, analitica, validacion, hojas_ruta, warmup).

## Patrón canónico

1. **Backend**: `job_submit(sid, kind, func, args, result_filename, on_complete)` → `job_id`. Lanza `callr::r_bg` supervisado; progreso vía archivo `<job_id>.progress`; stdout/err a `.out`/`.err`. Payloads grandes van por disco con `job_save_rds(sid, prefix, value)`, **nunca dentro del closure**.
2. **Progreso**: dentro del `func`, obtener el reporter con `job_progress_writer(progress_path)` y llamar `report("running", percent=, message=)`. El bootstrap dropea `progress_path` de los args si el `func` no lo declara en sus `formals()` (salvo `...`).
3. **Endpoints**: `GET /api/jobs/<id>`, `POST /api/jobs/<id>/cancel`, `GET /api/jobs/<id>/result` (el nombre original se reconstruye quitando el prefijo `<job_id>__`).
4. **Frontend**: hook `useJob<T>(jobId)` con backoff 400ms→800ms→1500ms; corta en `done|error|cancelled`. No reinventes el `setInterval`.

## Trampa 1 — Namespace re-resuelto (síntoma: "corre código viejo")

`callr::r_bg` arranca un R limpio. El closure se serializa con referencia a `namespace:prosecnurapp` que el worker resuelve AL DESERIALIZAR, **antes** del bootstrap — enganchando el paquete INSTALADO (viejo), no el dev de `load_all`. Mitigaciones ya implementadas que debes seguir:
- Funciones top-level del paquete: `job_submit` les pega `attr(func, "prosecnur_job_function_name")` y el bootstrap las re-obtiene frescas con `get(name, envir=asNamespace("prosecnurapp"))` tras `load_all`.
- Closures inline (patrón de `router_graficos.R`): dentro del `func` NO recargar el paquete y resolver toda función del paquete de forma **dinámica** — `.pkg_fn <- function(nm) get(nm, envir=asNamespace("prosecnurapp"))` — nunca por nombre pelado (queda ligado léxicamente al namespace viejo).

## Trampa 2 — Locale UTF-8 (síntoma: `no binding for ".transformar_según_modo"`)

`callr` arranca en locale `C`: (a) al deserializar, los bindings con nombres no-ASCII del paquete instalado se manglean; (b) `pkgload::load_all` falla al parsear archivos con tildes. `job_submit` ya fuerza `LC_ALL`/`LANG` UTF-8 en `env` y el bootstrap hace `Sys.setlocale` con fallback `C.UTF-8` + `options(encoding="UTF-8")`. **No toques esa configuración**; el test guardián es `test-jobs-encoding.R`.

## Reglas de la casa

1. Operación >2s o con render de archivos → job, nunca inline en el endpoint.
2. Todo cambio en `jobs.R` pasa `test-jobs.R` + `test-jobs-encoding.R` antes de declararse listo.
3. `POST /api/jobs/_selftest` existe para smoke rápido del sistema completo.
4. Un job nuevo define su `kind` con prefijo de módulo (`graficos.ppt_all`) y deriva `result_public` en `on_complete`.
