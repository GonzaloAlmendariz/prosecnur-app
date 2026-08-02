# Seam HTTP del preview de criterios. La semantica vive en los engines; este
# router valida frescura, no persiste el borrador y devuelve solo agregados.

.cm_criterios_frame_publico <- function(frame, referencia = NULL) {
  if (!is.list(frame)) return(list(frame = frame, context = NULL))
  context <- attr(frame, .cm_criterios_contexto_attr, exact = TRUE)
  attr(frame, .cm_criterios_contexto_attr) <- NULL
  list(frame = .cm_criterios_frame_actualizar_anclas(frame, referencia), context = context)
}

.cm_criterios_frame_actualizar_anclas <- function(frame, referencia) {
  if (!is.list(frame)) return(frame)
  anchors <- calc_muestra_criterios_anclas_historicas(frame, referencia)
  if (is.null(anchors)) {
    frame[["criterios_anclas_historicas"]] <- NULL
  } else {
    frame$criterios_anclas_historicas <- anchors
  }
  frame
}

.cm_criterios_referencia_guardar <- function(sid, state, referencia,
                                               has_workspace, estudio, reporte) {
  updates <- if (has_workspace) {
    list(
      calc_muestra_estudio = estudio,
      calc_muestra_reporte = reporte
    )
  } else {
    list()
  }
  if (is.list(state$calc_muestra_aulas_frame)) {
    updates$calc_muestra_aulas_frame <- .cm_criterios_frame_actualizar_anclas(
      state$calc_muestra_aulas_frame, referencia
    )
  }
  if (length(updates)) session_set_many(sid, updates)
  session_set(sid, "calc_muestra_referencia_asistencia", referencia)
}

.cm_criterios_frame_guardar <- function(sid, frame, referencia = NULL) {
  prepared <- .cm_criterios_frame_publico(frame, referencia)
  session_set(sid, "calc_muestra_aulas_config", prepared$frame$config)
  session_set(sid, "calc_muestra_aulas_frame", prepared$frame)
  session_set(sid, "calc_muestra_aulas_criterios_contexto", prepared$context)
  prepared$frame
}

mount_calc_muestra_criterios <- function(pr) {
  plumber::pr_post(
    pr,
    "/api/calc-muestra/marco/criterios/preview",
    wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      state <- session_get(sid)
      frame <- state$calc_muestra_aulas_frame
      context <- state$calc_muestra_aulas_criterios_contexto
      source_frame_hash <- calc_str(body$source_frame_hash, "")
      criteria_hash <- calc_str(body$criteria_hash, "")
      frame_hash <- .cm_aulas_scalar((frame %||% list())$frame_hash, "")
      context_hash <- .cm_aulas_scalar((context %||% list())$source_frame_hash, "")
      context_criteria_hash <- .cm_aulas_scalar(
        (context %||% list())$current_criteria_hash, ""
      )
      if (!is.list(frame) || !is.list(context) ||
          !nzchar(source_frame_hash) || !nzchar(criteria_hash) ||
          !identical(source_frame_hash, frame_hash) ||
          !identical(source_frame_hash, context_hash) ||
          !identical(criteria_hash, context_criteria_hash)) {
        stop_api(
          409, "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE",
          "El preview requiere el contexto transitorio del marco y criterios vigentes."
        )
      }
      config <- body$config
      if (!is.list(config)) {
        stop_api(
          400, "E_CALC_MUESTRA_CRITERIOS_PREVIEW_INPUT",
          "config debe ser un objeto de configuración de cursos-horario."
        )
      }
      preview <- calc_muestra_aulas_criterios_preview(
        context = context,
        config = config,
        source_frame_hash = source_frame_hash,
        criteria_hash = criteria_hash
      )
      list(ok = TRUE, preview = preview)
    })
  )
}
