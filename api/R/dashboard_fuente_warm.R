# =============================================================================
# Fuente del Dashboard — reconstrucción diferida (unidad 3.2 del plan de
# performance 2026-07)
# =============================================================================
# Los caches `dashboard_rp_inst` / `dashboard_rp_data` son tibbles gordos
# derivables del par XLSForm + data referenciado en `dashboard_source`, y por
# eso NO viajan en el .pulso (los strippea .pulso_strip_caches). Hasta esta
# unidad se re-importaban INLINE dentro de load_pulso, sumando 1-5 s a CADA
# apertura de un proyecto con dashboard configurado.
#
# Ahora la reconstrucción vive en dos caminos que no bloquean el open:
#   1. Paso "dashboard" del warmup (/api/project/warmup): corre en el worker
#      durante la pantalla de preparación (espera declarada con barra) y el
#      resultado vuelve a la sesión viva vía session_patch.
#   2. Fallback lazy en el primer uso real del dashboard, para clientes que
#      nunca llaman warmup (frontend viejo, scripts headless, modo público).
#
# El warm start del .pulso NO cambia: qué viaja y qué se cachea es idéntico;
# solo cambia CUÁNDO se regenera lo que nunca viajó.

# Memoria de fallos por sid dentro del proceso. Si la re-importación falla (archivo ausente o
# corrupto, típico en fixtures anonimizados), el dashboard muestra su estado
# "carga la fuente" — igual que siempre. Sin esta memoria, cada request del
# dashboard reintentaría la importación completa y pagaría el costo del fallo
# una y otra vez; con ella se reintenta solo si la fuente cambió. Vive fuera
# de la sesión a propósito: no es estado del proyecto (no viaja, no se censa
# en session_schema.R) sino un cortocircuito de runtime por proceso.
.dashboard_fuente_warm_fallos <- new.env(parent = emptyenv())

.dashboard_fuente_fingerprint <- function(src) {
  paste(
    as.character(src$xlsform_file_id %||% "")[1],
    as.character(src$data_file_id %||% "")[1],
    sep = "|"
  )
}

# ¿La sesión tiene una fuente declarada pero los caches todavía fríos?
.dashboard_fuente_pendiente <- function(s) {
  if (!is.null(s[["dashboard_rp_inst"]]) && !is.null(s[["dashboard_rp_data"]])) {
    return(FALSE)
  }
  src <- s$dashboard_source
  if (!is.list(src)) return(FALSE)
  nzchar(as.character(src$xlsform_file_id %||% "")[1]) &&
    nzchar(as.character(src$data_file_id %||% "")[1])
}

# Reconstruye los caches reusando .dashboard_import_source (mismo camino que
# la importación manual, con keep_curacion=TRUE porque el XLSForm no cambió).
# Devuelve TRUE/FALSE; nunca lanza. `context` etiqueta el log de timing para
# poder citar dónde se pagó el costo (warmup / lazy / load en modo público).
.dashboard_fuente_rebuild <- function(sid, context = "lazy") {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || !.dashboard_fuente_pendiente(s)) return(invisible(FALSE))

  fingerprint <- .dashboard_fuente_fingerprint(s$dashboard_source)
  fallo_previo <- .dashboard_fuente_warm_fallos[[sid]] %||% ""
  if (identical(fallo_previo, fingerprint)) return(invisible(FALSE))

  # La regeneración de un cache derivable no es una edición del usuario:
  # .dashboard_import_source pasa por session_set, que marca dirty, y eso
  # dejaba el proyecto "sin guardar" apenas abierto. Preservamos el flag.
  dirty_antes <- isTRUE(s$project_dirty)
  started_at <- Sys.time()
  ok <- tryCatch({
    .dashboard_import_source(
      sid,
      list(
        xlsform_file_id = as.character(s$dashboard_source$xlsform_file_id)[1],
        data_file_id = as.character(s$dashboard_source$data_file_id)[1]
      ),
      keep_curacion = TRUE
    )
    TRUE
  }, error = function(e) {
    # No-op deliberado: sin caches el dashboard responde su estado tolerante
    # ("Carga la base y el instrumento primero.") y el usuario puede
    # re-importar desde el panel de Datos. Nunca un 500 por esto.
    message(sprintf(
      "[pulso] fuente del dashboard no reconstruible (%s): %s",
      context, conditionMessage(e)
    ))
    FALSE
  })
  elapsed_ms <- as.integer(round(
    as.numeric(difftime(Sys.time(), started_at, units = "secs")) * 1000
  ))
  if (isTRUE(ok)) {
    if (exists(sid, envir = .dashboard_fuente_warm_fallos, inherits = FALSE)) {
      rm(list = sid, envir = .dashboard_fuente_warm_fallos)
    }
    if (!dirty_antes) {
      s_post <- session_get(sid, required = FALSE)
      if (!is.null(s_post)) {
        s_post$project_dirty <- FALSE
        .session_env[[sid]] <- s_post
      }
    }
    message(sprintf(
      "[pulso] fuente del dashboard reconstruida (%s) en %d ms",
      context, elapsed_ms
    ))
  } else {
    .dashboard_fuente_warm_fallos[[sid]] <- fingerprint
  }
  invisible(isTRUE(ok))
}

# Hook lazy para la capa de lectura del dashboard (.dashboard_ctx /
# .dashboard_source_payload). Si los caches están fríos y hay fuente
# declarada, reconstruye sobre la sesión viva y devuelve el estado fresco.
# Cuando los caches ya existen es un par de is.null() y sale — costo cero
# en el camino caliente.
.dashboard_fuente_lazy <- function(s) {
  if (!is.list(s) || !.dashboard_fuente_pendiente(s)) return(s)
  sid <- as.character(s$id %||% "")[1]
  if (!nzchar(sid)) return(s)
  if (is.null(session_get(sid, required = FALSE))) return(s)
  .dashboard_fuente_rebuild(sid, context = "lazy")
  session_get(sid, required = FALSE) %||% s
}
