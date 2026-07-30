# =============================================================================
# Project warmup en paralelo — unidad 5.2 del plan de performance 2026-07
# =============================================================================
# El warmup corre dentro de un worker `callr` sobre una COPIA de la sesion
# (el RDS que `.project_warmup_start` serializa UNA sola vez). Este modulo
# reparte el bloque territorial en sub-workers que leen ESE MISMO RDS: cada
# worker carga su propia copia de la sesion, asi el flip de
# `territorial$active_route_phase` que hace el prewarm queda aislado por
# proceso y nadie comparte estado mutable. El costo de serializar la sesion
# se paga una vez; cada sub-worker solo paga spawn + namespace + readRDS.
#
# Mapa de dependencias real (verificado en el codigo, no solo en la medicion
# de la unidad 5.0): `monitoreo_territorial_reportes` consume
# `context$geo_results` — el producto del layer gps_points del map cache — y
# si falta LO RECONSTRUYE inline (cruce sf completo). Por eso el cruce gps y
# la base compartida de campo NO son paralelizables entre si: viven juntos en
# el worker "pesado" y forman el camino critico. Lo que si reparte: ese
# worker pesado ∥ el resto del bloque territorial (scopes livianos de campo,
# que no necesitan gps, y la fase piloto completa) ∥ las demas tareas del
# warmup, que siguen corriendo en el worker principal mientras tanto.
#
# Por que DOS workers y no tres: medido en acnur_acg (M3, 8 nucleos, 16 GB),
# dos sub-workers concurrentes casi no se estorban (el pesado paso de 47.5 s
# solo a 51.3 s acompañado, +8%), pero con TRES el conjunto colapsa por
# presion de memoria/scheduling (el pesado subio a 113 s, 2.4x, y el warmup
# completo salio PEOR que el serial). El worker "resto" encadena sus tramos
# en serie dentro de un solo proceso.

.project_warmup_paralelo_scope_orden <- c(
  "source",
  "route_summary",
  "advance_summary",
  "validation_summary",
  "queries_summary"
)

.project_warmup_paralelo_activado <- function() {
  flag <- tolower(trimws(Sys.getenv("PULSO_WARMUP_PARALELO", "")))
  !flag %in% c("0", "false", "off", "no")
}

# Lee la familia del perfil sin pagar `monitoreo_normalize_config` completo
# (~1.5-1.9 s con data real): el config guardado casi siempre trae la familia
# cruda, y los alias se resuelven con la misma tabla que usa el normalizador.
# Solo cae al camino completo cuando la familia no viene declarada o el alias
# no mapea a una familia conocida (ahi si puede depender de la data).
.project_warmup_monitoreo_family_rapida <- function(sid) {
  s <- session_get(sid)
  cfg <- s[["monitoreo_config"]]
  snap <- s[["monitoreo_snapshot"]]
  raw <- ""
  if (is.list(cfg)) raw <- .monitoreo_scalar(cfg$monitoreo_profile$family, "")
  if (!nzchar(raw) && is.list(snap) && is.list(snap$config)) {
    raw <- .monitoreo_scalar(snap$config$monitoreo_profile$family, "")
  }
  if (nzchar(raw)) {
    key <- tryCatch(.monitoreo_publication_family_key(raw), error = function(e) "")
    if (key %in% c("territorial", "acreditacion", "telefonico", "aulas_universitarias")) {
      return(key)
    }
  }
  .project_warmup_monitoreo_family(sid)
}

# Los sub-workers heredan un entorno recortado por callr (rcmd_safe_env): en
# dev, PULSO_REPO_ROOT/PULSO_API_DIR se pierden dentro del warmup worker y los
# sub-jobs terminarian cargando el paquete INSTALADO (potencialmente viejo)
# mientras el warmup corre codigo dev — el skew clasico de jobs anidados.
# Si este proceso corre el paquete via load_all, propagamos su ruta fuente
# para que los sub-workers carguen el mismo codigo.
.project_warmup_paralelo_propagar_api_dir <- function() {
  if (nzchar(Sys.getenv("PULSO_API_DIR", "")) || nzchar(Sys.getenv("PULSO_REPO_ROOT", ""))) {
    return(invisible(FALSE))
  }
  dev <- tryCatch(
    requireNamespace("pkgload", quietly = TRUE) && pkgload::is_dev_package("prosecnurapp"),
    error = function(e) FALSE
  )
  if (!isTRUE(dev)) return(invisible(FALSE))
  path <- tryCatch(as.character(getNamespaceInfo("prosecnurapp", "path"))[1], error = function(e) "")
  if (is.na(path %||% NA_character_) || !nzchar(path) ||
      !file.exists(file.path(path, "DESCRIPTION"))) {
    return(invisible(FALSE))
  }
  Sys.setenv(PULSO_API_DIR = path)
  invisible(TRUE)
}

# Particion del bloque territorial en dos workers:
# - `field_pesado`: el camino critico (cruce gps de campo + base compartida
#   de advance/validation/queries). Se lanza primero.
# - `resto`: tramos EN SERIE dentro del mismo proceso — los scopes de campo
#   que no necesitan gps (source + route) y la fase piloto completa.
# `map_phases` declara que fases del map cache aporta cada worker al merge;
# lo demas se poda para que ningun worker pise las capas de otro.
.project_warmup_paralelo_especificaciones <- function() {
  list(
    field_pesado = list(
      tramos = list(
        list(phase = "field", scopes = c("advance_summary", "validation_summary", "queries_summary"))
      ),
      map_phases = "field"
    ),
    resto = list(
      tramos = list(
        list(phase = "field", scopes = c("source", "route_summary")),
        list(phase = "pilot", scopes = .project_warmup_paralelo_scope_orden)
      ),
      map_phases = "pilot"
    )
  )
}

# Entry del sub-worker: hidrata la copia de sesion UNA vez y corre sus tramos
# en serie con el prewarm territorial existente. El `state` light que ese
# prewarm calcula al final no viaja de vuelta (se recalcula en la sesion
# viva); el patch sale del estado final acumulado del worker.
.project_warmup_paralelo_prewarm_job <- function(session_path,
                                                 tramos,
                                                 map_phases = character(0),
                                                 progress_path = NULL) {
  worker_started <- Sys.time()
  s <- readRDS(session_path)
  sid <- as.character(s$id %||% "")
  if (!nzchar(sid)) stop("Sesion invalida para el warmup territorial paralelo.", call. = FALSE)
  .session_env[[sid]] <- s
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else NULL
  tramo_results <- vector("list", length(tramos))
  for (idx in seq_along(tramos)) {
    tramo <- tramos[[idx]]
    tramo_progress <- if (is.function(report)) {
      .project_warmup_phase_progress(
        report,
        phase_index = idx,
        phase_total = length(tramos),
        phase_label = sprintf("Preparando seguimiento %s...", tramo$phase)
      )
    } else {
      NULL
    }
    result <- .monitoreo_territorial_prewarm_scopes(
      sid,
      phase = tramo$phase,
      scopes = tramo$scopes,
      progress = tramo_progress
    )
    tramo_results[[idx]] <- list(
      phase = tramo$phase,
      scopes = result$scopes %||% list(),
      map_cache = result$map_cache %||% list()
    )
  }
  s_final <- session_get(sid)
  snapshot_final <- s_final$monitoreo_snapshot %||% list()
  list(
    ok = TRUE,
    tramos = tramo_results,
    worker_ms = as.numeric(difftime(Sys.time(), worker_started, units = "secs")) * 1000,
    session_patch = list(
      territorial_report_cache = snapshot_final$territorial_report_cache %||% NULL,
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}
attr(.project_warmup_paralelo_prewarm_job, "prosecnur_job_function_name") <- ".project_warmup_paralelo_prewarm_job"

.project_warmup_paralelo_iniciar_seguro <- function(sid, session_path, task_ids = character(0)) {
  tryCatch(
    .project_warmup_paralelo_iniciar(sid, session_path = session_path, task_ids = task_ids),
    error = function(e) NULL
  )
}

.project_warmup_paralelo_iniciar <- function(sid, session_path, task_ids = character(0)) {
  if (!"monitoreo_territorial" %in% task_ids) return(NULL)
  if (!.project_warmup_paralelo_activado()) return(NULL)
  session_path <- as.character(session_path %||% "")[1]
  if (is.na(session_path) || !nzchar(session_path) || !file.exists(session_path)) return(NULL)
  if (!exists(".monitoreo_territorial_prewarm_scopes", mode = "function")) return(NULL)
  if (!requireNamespace("callr", quietly = TRUE)) return(NULL)
  family <- tryCatch(.project_warmup_monitoreo_family_rapida(sid), error = function(e) "")
  if (!identical(family, "territorial")) return(NULL)
  .project_warmup_paralelo_propagar_api_dir()
  specs <- .project_warmup_paralelo_especificaciones()
  jobs <- list()
  for (nm in names(specs)) {
    spec <- specs[[nm]]
    job_id <- tryCatch(
      job_submit(
        sid = sid,
        kind = paste0("project.warmup.territorial.", nm),
        func = .project_warmup_paralelo_prewarm_job,
        args = list(
          session_path = session_path,
          tramos = spec$tramos,
          map_phases = spec$map_phases
        )
      ),
      error = function(e) e
    )
    if (inherits(job_id, "error")) {
      # Si un worker no arranca, se degrada COMPLETO al camino serial: mezclar
      # mitad paralelo y mitad serial duplicaria trabajo sin garantia de orden.
      for (job in jobs) tryCatch(job_cancel(job$id), error = function(e) NULL)
      return(NULL)
    }
    jobs[[nm]] <- list(
      id = job_id,
      worker = nm,
      tramos = spec$tramos,
      map_phases = spec$map_phases
    )
  }
  handle <- new.env(parent = emptyenv())
  handle$jobs <- jobs
  handle$harvested <- FALSE
  handle$started_at <- Sys.time()
  handle
}

# Task sintetico que reemplaza al serial de monitoreo_territorial cuando los
# sub-workers ya estan corriendo: cosecha, mezcla y reporta.
.project_warmup_paralelo_task <- function(handle) {
  list(
    id = "monitoreo_territorial",
    module = "Monitoreo territorial",
    run = function(sid, remaining_ms, progress = NULL) {
      .project_warmup_paralelo_cosechar(sid, handle, remaining_ms = remaining_ms, progress = progress)
    }
  )
}

# Cancela sub-workers que nadie cosecho (p. ej. presupuesto agotado antes de
# llegar a la tarea territorial). Idempotente.
.project_warmup_paralelo_abandonar <- function(handle) {
  if (is.null(handle) || !is.environment(handle) || isTRUE(handle$harvested)) {
    return(invisible(FALSE))
  }
  for (job in handle$jobs %||% list()) {
    tryCatch(job_cancel(job$id), error = function(e) NULL)
  }
  handle$harvested <- TRUE
  invisible(TRUE)
}

# Espera a que los sub-workers terminen dentro del presupuesto. Devuelve un
# estado por worker: done (con resultado y timing), error o timeout (cancelado
# al agotarse el presupuesto, misma degradacion que las tareas seriales).
.project_warmup_paralelo_esperar <- function(handle,
                                             remaining_ms,
                                             progress = NULL,
                                             reserve_ms = 1500L,
                                             poll_ms = 250L) {
  jobs <- handle$jobs %||% list()
  states <- setNames(vector("list", length(jobs)), names(jobs))
  remaining_ms <- suppressWarnings(as.numeric(remaining_ms %||% 0))
  if (!is.finite(remaining_ms)) remaining_ms <- 0
  deadline <- Sys.time() + max(0, (remaining_ms - reserve_ms) / 1000)
  repeat {
    for (nm in names(jobs)) {
      if (!is.null(states[[nm]])) next
      j <- tryCatch(job_poll(jobs[[nm]]$id), error = function(e) NULL)
      if (is.null(j)) {
        states[[nm]] <- list(status = "error", error = "No se pudo consultar el worker de warmup.")
        next
      }
      if (identical(j$status, "done")) {
        wall_ms <- as.numeric(difftime(j$finished_at %||% Sys.time(), j$started_at, units = "secs")) * 1000
        worker_ms <- suppressWarnings(as.numeric(j$result_data$worker_ms %||% NA_real_))
        states[[nm]] <- list(
          status = "done",
          result = j$result_data,
          wall_ms = round(wall_ms),
          worker_ms = if (is.finite(worker_ms)) round(worker_ms) else NULL,
          overhead_ms = if (is.finite(worker_ms)) round(max(0, wall_ms - worker_ms)) else NULL
        )
      } else if (j$status %in% c("error", "cancelled")) {
        states[[nm]] <- list(
          status = "error",
          error = .project_warmup_compact(j$error %||% "Worker de warmup fallo.", 220)
        )
      }
    }
    n_final <- sum(!vapply(states, is.null, logical(1)))
    if (is.function(progress)) {
      progress(
        phase = "running",
        current = n_final,
        total = length(jobs),
        percent = if (length(jobs)) round(100 * n_final / length(jobs)) else 100,
        message = sprintf("Preparando Monitoreo territorial (%d de %d bloques listos)...", n_final, length(jobs))
      )
    }
    if (n_final >= length(jobs)) break
    if (Sys.time() >= deadline) {
      for (nm in names(jobs)) {
        if (!is.null(states[[nm]])) next
        tryCatch(job_cancel(jobs[[nm]]$id), error = function(e) NULL)
        states[[nm]] <- list(
          status = "timeout",
          error = "Quedo para background al agotarse el presupuesto inicial."
        )
      }
      break
    }
    Sys.sleep(poll_ms / 1000)
  }
  states
}

# Recorta el patch de un worker a SUS claves (sus tramos fase+scope y sus
# fases de mapa declaradas) antes de mezclar: los merges quedan disjuntos por
# construccion y un worker jamas pisa lo que produjo otro (p. ej. la copia
# stale de la fase field que viaja dentro del map cache del worker del resto).
# Las entradas del report cache ya vienen indexadas por hash de data+config,
# asi que una entrada vieja mezclada por error nunca se sirve: el lookup
# valida fase/scope/hashes campo por campo.
.project_warmup_paralelo_podar_patch <- function(patch, tramos, map_phases = character(0)) {
  if (!is.list(patch) || !length(patch)) return(NULL)
  tramos <- Filter(is.list, tramos %||% list())
  map_phases <- as.character(map_phases %||% character(0))
  out <- list()
  report_cache <- patch$territorial_report_cache
  if (is.list(report_cache) && is.list(report_cache$entries)) {
    keep <- Filter(function(entry) {
      if (!is.list(entry)) return(FALSE)
      any(vapply(tramos, function(tramo) {
        identical(as.character(entry$phase %||% ""), as.character(tramo$phase %||% "")) &&
          as.character(entry$report_scope %||% "") %in% as.character(tramo$scopes %||% character(0))
      }, logical(1)))
    }, report_cache$entries)
    if (length(keep)) {
      report_cache$entries <- keep
      out$territorial_report_cache <- report_cache
    }
  }
  map_cache <- patch$territorial_map_cache
  if (is.list(map_cache) && is.list(map_cache$phases)) {
    map_cache$phases <- map_cache$phases[intersect(names(map_cache$phases), map_phases)]
    if (length(map_cache$phases)) out$territorial_map_cache <- map_cache
  }
  if (!length(out)) return(NULL)
  out
}

.project_warmup_paralelo_scopes_sinteticos <- function(scopes, status, error = NULL) {
  lapply(as.character(scopes), function(scope) {
    item <- list(
      scope = scope,
      status = status,
      cache_hit = FALSE,
      cache_source = status
    )
    if (!is.null(error) && nzchar(as.character(error %||% ""))) {
      item$error <- .project_warmup_compact(error, 180)
    }
    item
  })
}

# Reconstruye el detalle por fase con la misma forma que el camino serial
# (phases$field / phases$pilot con scopes + map_cache).
.project_warmup_paralelo_fases <- function(jobs, states) {
  phase_names <- unique(unlist(lapply(jobs, function(job) {
    vapply(job$tramos %||% list(), function(tramo) as.character(tramo$phase %||% ""), character(1))
  }), use.names = FALSE))
  phase_names <- phase_names[nzchar(phase_names)]
  phases <- setNames(vector("list", length(phase_names)), phase_names)
  for (ph in phase_names) {
    scope_items <- list()
    map_cache <- list()
    for (nm in names(jobs)) {
      job <- jobs[[nm]]
      st <- states[[nm]] %||% list(status = "error", error = "Sin estado del worker.")
      tramo_specs <- Filter(function(tramo) identical(as.character(tramo$phase %||% ""), ph), job$tramos %||% list())
      if (!length(tramo_specs)) next
      if (identical(st$status, "done") && is.list(st$result)) {
        for (tramo_result in st$result$tramos %||% list()) {
          if (!identical(as.character(tramo_result$phase %||% ""), ph)) next
          scope_items <- c(scope_items, tramo_result$scopes %||% list())
          mc <- tramo_result$map_cache %||% list()
          if (!length(map_cache) && is.list(mc) && length(mc)) map_cache <- mc
        }
      } else {
        for (tramo in tramo_specs) {
          scope_items <- c(
            scope_items,
            .project_warmup_paralelo_scopes_sinteticos(tramo$scopes, st$status %||% "error", st$error)
          )
        }
      }
    }
    orden <- order(match(
      vapply(scope_items, function(item) as.character(item$scope %||% ""), character(1)),
      .project_warmup_paralelo_scope_orden
    ))
    phases[[ph]] <- list(
      phase = ph,
      scopes = scope_items[orden],
      map_cache = map_cache
    )
  }
  phases
}

.project_warmup_paralelo_cosechar <- function(sid, handle, remaining_ms, progress = NULL) {
  handle$harvested <- TRUE
  jobs <- handle$jobs %||% list()
  if (!length(jobs)) {
    return(.project_warmup_skip("Sin workers territoriales que cosechar."))
  }
  states <- .project_warmup_paralelo_esperar(handle, remaining_ms, progress = progress)
  for (nm in names(jobs)) {
    st <- states[[nm]]
    if (!is.list(st) || !identical(st$status, "done") || !is.list(st$result)) next
    patch <- .project_warmup_paralelo_podar_patch(
      st$result$session_patch %||% list(),
      tramos = jobs[[nm]]$tramos,
      map_phases = jobs[[nm]]$map_phases
    )
    if (is.list(patch)) {
      # Mismo camino de merge que usa el proceso principal al completar el
      # warmup: entrada por entrada en el report cache, fase/layer en el map.
      tryCatch(
        .project_warmup_merge_session_patch(sid, list(monitoreo_territorial = patch)),
        error = function(e) FALSE
      )
    }
  }
  phases <- .project_warmup_paralelo_fases(jobs, states)
  scope_status <- unlist(lapply(phases, function(phase) {
    vapply(phase$scopes %||% list(), function(item) {
      as.character(item$status %||% "skipped")
    }, character(1))
  }), use.names = FALSE)
  all_ready <- length(scope_status) > 0L && all(scope_status == "ready")
  status <- if (isTRUE(all_ready)) {
    "ready"
  } else if (any(scope_status == "ready") || any(scope_status == "timeout")) {
    "timeout"
  } else if (any(scope_status == "error")) {
    "error"
  } else {
    "skipped"
  }
  s_final <- session_get(sid)
  snapshot_final <- s_final$monitoreo_snapshot %||% list()
  list(
    status = status,
    message = if (isTRUE(all_ready)) {
      "Monitoreo territorial local preparado."
    } else {
      "Monitoreo territorial quedo parcialmente preparado."
    },
    details = list(
      parallel = TRUE,
      phases = phases,
      workers = lapply(names(jobs), function(nm) {
        st <- states[[nm]] %||% list()
        list(
          worker = nm,
          tramos = lapply(jobs[[nm]]$tramos, function(tramo) {
            list(phase = tramo$phase, scopes = as.list(tramo$scopes))
          }),
          status = st$status %||% "unknown",
          wall_ms = st$wall_ms %||% NULL,
          worker_ms = st$worker_ms %||% NULL,
          overhead_ms = st$overhead_ms %||% NULL
        )
      })
    ),
    session_patch = list(
      territorial_report_cache = snapshot_final$territorial_report_cache %||% NULL,
      territorial_map_cache = s_final$monitoreo_territorial_map_cache %||% NULL
    )
  )
}
