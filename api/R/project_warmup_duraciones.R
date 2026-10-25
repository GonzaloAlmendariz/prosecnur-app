# =============================================================================
# Project warmup — duración aprendida de la apertura anterior (Meta B, L23)
# =============================================================================
# El warm start es intencional (prepara caches para que los módulos abran sin
# recalcular), pero con un proyecto real tarda minutos. Para que la espera se
# pueda leer, cada warmup que termina deja anotado cuánto tardó, y el siguiente
# lo publica como estimación. Sin apertura anterior no se publica nada: la UI
# muestra sólo el tiempo transcurrido, nunca una cifra inventada.
#
# Dónde vive: `s$warmup_duraciones`, un campo más del estado de sesión. NO es un
# cache derivable —una duración medida no se puede recalcular desde los
# inputs—, así que `.pulso_strip_caches()` no lo toca y viaja en `state.rds` en
# el próximo guardado explícito, como cualquier otro campo. Medirlo no marca
# `project_dirty`: abrir un proyecto no lo edita.
#
# Forma:
#   aperturas: { "<ids ordenados>": { elapsed_ms, at } }   un total por juego
#              de módulos pedido (la apertura completa y cada módulo difieren)
#   tareas:    { "<id>": elapsed_ms }                      la última duración
#              de cada fase, para mostrar la duración prevista de las que faltan

.project_warmup_duraciones_max_aperturas <- 16L

.project_warmup_clave_modulos <- function(task_ids) {
  ids <- sort(unique(as.character(unlist(task_ids %||% character(0), use.names = FALSE))))
  ids <- ids[nzchar(ids)]
  if (!length(ids)) return("")
  paste(ids, collapse = ",")
}

# Los ids de tarea que correrá `.project_warmup_run()` para los módulos
# pedidos; replica su filtro (vacío = todas; filtro sin coincidencias = la
# primera) para que la clave que se consulta sea la misma que se anota.
.project_warmup_task_ids_para <- function(module_ids = character(0)) {
  all_ids <- vapply(.project_warmup_tasks(), `[[`, character(1), "id")
  module_ids <- unique(as.character(unlist(module_ids %||% character(0), use.names = FALSE)))
  module_ids <- module_ids[nzchar(module_ids)]
  if (!length(module_ids)) return(all_ids)
  ids <- all_ids[all_ids %in% module_ids]
  if (!length(ids)) all_ids[1] else ids
}

.project_warmup_ms_valido <- function(x) {
  value <- suppressWarnings(as.numeric(x %||% NA_real_)[1])
  if (length(value) != 1L || !is.finite(value) || value <= 0) return(NA_real_)
  value
}

.project_warmup_registrar_duracion <- function(sid, result) {
  if (!is.list(result)) return(invisible(FALSE))
  elapsed <- .project_warmup_ms_valido(result$elapsed_ms)
  tasks <- result$tasks %||% list()
  task_ids <- vapply(tasks, function(t) as.character(t$id %||% ""), character(1))
  clave <- .project_warmup_clave_modulos(task_ids)
  if (is.na(elapsed) || !nzchar(clave)) return(invisible(FALSE))

  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(invisible(FALSE))
  previo <- s$warmup_duraciones
  if (!is.list(previo)) previo <- list()
  aperturas <- if (is.list(previo$aperturas)) previo$aperturas else list()
  tareas <- if (is.list(previo$tareas)) previo$tareas else list()

  aperturas[[clave]] <- NULL
  aperturas[[clave]] <- list(
    elapsed_ms = as.integer(round(elapsed)),
    at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  )
  if (length(aperturas) > .project_warmup_duraciones_max_aperturas) {
    aperturas <- utils::tail(aperturas, .project_warmup_duraciones_max_aperturas)
  }
  for (task in tasks) {
    id <- as.character(task$id %||% "")
    status <- as.character(task$status %||% "")
    ms <- .project_warmup_ms_valido(task$elapsed_ms)
    # Una fase que falló o se cortó por presupuesto no dice cuánto tarda.
    if (!nzchar(id) || !status %in% c("ready", "skipped") || is.na(ms)) next
    tareas[[id]] <- as.integer(round(ms))
  }

  # Asignación directa al env: igual que la fusión de caches, sin pasar por
  # helpers que marquen el proyecto como editado.
  s$warmup_duraciones <- list(aperturas = aperturas, tareas = tareas)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

# Lo que se publica junto al job y en el plan: la apertura anterior del mismo
# juego de módulos (o NULL) y la última duración de cada fase involucrada.
.project_warmup_estimacion <- function(sid, module_ids = character(0)) {
  s <- session_get(sid, required = FALSE)
  registro <- if (is.list(s)) s$warmup_duraciones else NULL
  task_ids <- .project_warmup_task_ids_para(module_ids)
  vacio <- list(ultima_apertura = NULL, tareas_ms = structure(list(), names = character(0)))
  if (!is.list(registro)) return(vacio)

  clave <- .project_warmup_clave_modulos(task_ids)
  aperturas <- if (is.list(registro$aperturas)) registro$aperturas else list()
  previa <- if (nzchar(clave)) aperturas[[clave]] else NULL
  ultima <- NULL
  if (is.list(previa) && !is.na(.project_warmup_ms_valido(previa$elapsed_ms))) {
    ultima <- list(
      elapsed_ms = as.integer(previa$elapsed_ms),
      at = as.character(previa$at %||% "")
    )
  }
  tareas <- if (is.list(registro$tareas)) registro$tareas else list()
  tareas <- tareas[intersect(names(tareas), task_ids)]
  tareas <- tareas[!vapply(tareas, function(v) is.na(.project_warmup_ms_valido(v)), logical(1))]
  list(
    ultima_apertura = ultima,
    tareas_ms = if (length(tareas)) lapply(tareas, as.integer) else vacio$tareas_ms
  )
}
