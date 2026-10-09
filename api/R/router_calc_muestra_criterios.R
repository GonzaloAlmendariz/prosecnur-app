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
                                               has_workspace, estudio, reporte,
                                               referencia_criterios = NULL) {
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
  # La referencia de CRITERIOS viaja por el mismo camino: sale de las hojas
  # `cuotas` y `diseno` que este endpoint ya lee, no de una entrada nueva. Sólo
  # se pisa la guardada cuando la nueva trae algo: un libro sin hoja `cuotas` no
  # debe borrar la comparación que ya estaba.
  if (!is.null(referencia_criterios)) {
    session_set(sid, "calc_muestra_referencia_criterios", referencia_criterios)
  }
}

.cm_criterios_frame_guardar <- function(sid, frame, referencia = NULL) {
  prepared <- .cm_criterios_frame_publico(frame, referencia)
  # Gate de llegada: el frame que esta por ser reemplazado es el baseline. Se
  # anota ANTES de pisarlo o el punto de comparacion se pierde para siempre.
  anterior <- session_get(sid, required = FALSE)[["calc_muestra_aulas_frame"]]
  prepared$frame <- calc_muestra_aulas_novedades_anotar(prepared$frame, anterior)
  # La config del frame es la TERCERA copia de la decisión de alumnos por CH
  # (los routers de Aulas validan contra frame$config): se re-sella antes de
  # persistir, o el frame nuevo carga el hash del marco anterior para siempre.
  prepared$frame$config <- .cm_alumnos_por_ch_resellar_config(
    prepared$frame$config, prepared$frame$frame_hash
  )
  # De que semestre son los datos de este marco. Un `.pulso` llamado HSVG2026
  # con la base de 2025 dentro calcula sin protestar y sólo se nota en cifras
  # fuera de rango; el porqué y las cifras, en `calc_muestra_aulas_periodo.R`.
  prepared$frame <- calc_muestra_aulas_declarar_periodo(
    prepared$frame, session_get(sid, required = FALSE)[["files"]] %||% list()
  )
  session_set(sid, "calc_muestra_aulas_config", prepared$frame$config)
  session_set(sid, "calc_muestra_aulas_frame", prepared$frame)
  session_set(sid, "calc_muestra_aulas_criterios_contexto", prepared$context)
  # El marco nuevo re-sella la decisión de alumnos por CH vigente: su firma lleva
  # el frame_hash y sin esto queda stale para siempre, borrando el objetivo de
  # cursos-horario en cada guardado. Lógica y porqué en
  # calc_muestra_alumnos_por_ch_resello.R.
  .cm_alumnos_por_ch_resellar(sid, prepared$frame$frame_hash)
  # Y los criterios que CONSTRUYERON este marco aterrizan en la copia del
  # workspace que la UI compara: sin esto, una config aplicada por API dejaba
  # el chip «criterios cambiados» en ámbar perpetuo. Porqué en
  # calc_muestra_criterios_sync_workspace.R.
  .cm_criterios_sincronizar_workspace(sid, prepared$frame$config)
  prepared$frame
}

mount_calc_muestra_criterios <- function(pr) {
  # Recuperar el recuento de ESTUDIANTES releyendo la base.
  #
  # El recorrido de curso-horario ya vive desde el marco guardado
  # (`.cm_criterios_contexto_desde_marco`), pero el efecto de un criterio de
  # alumno exige la tabla atómica, que no viaja en el `.pulso`. Se relee con las
  # fuentes que el marco firma. Medido sobre HSVG26DEF: 60 s parando en el paso 4
  # frente a 186 del build entero, y el resultado se verifica contra el marco
  # antes de adoptarse.
  #
  # Va como job porque plumber es monohilo: un minuto síncrono congela la app.
  pr <- plumber::pr_post(
    pr,
    "/api/calc-muestra/marco/criterios/rehidratar",
    wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      state <- session_get(sid)
      frame <- state$calc_muestra_aulas_frame
      if (!is.list(frame) || !is.data.frame(frame$aula_frame)) {
        stop_api(409, "E_CALC_MUESTRA_CRITERIOS_REHIDRATAR_SIN_MARCO",
                 "No hay marco construido que rehidratar.")
      }
      contexto <- state$calc_muestra_aulas_criterios_contexto
      atomica <- ((contexto %||% list())$criterios %||% list())$radiografia_contexto
      if (length((atomica %||% list())$filas %||% list())) {
        return(list(ok = TRUE, mode = "ya_vivo"))
      }
      tablas <- .cm_criterios_fuentes_del_marco(sid, frame)
      if (!length(tablas)) {
        stop_api(409, "E_CALC_MUESTRA_CRITERIOS_REHIDRATAR_SIN_FUENTES",
                 paste("El marco no declara con qué archivos se construyó, o ya no están",
                       "en el proyecto. Reconstruye el marco desde tus fuentes."))
      }
      job_id <- job_submit(
        sid = sid,
        kind = "calc_muestra_aulas_criterios_rehidratar",
        func = calc_muestra_aulas_criterios_rehidratar_job,
        args = list(tablas = tablas, frame = frame),
        on_complete = .cm_criterios_rehidratar_on_complete(sid)
      )
      list(ok = TRUE, mode = "job", job_id = job_id)
    })
  )
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
      # Contexto ausente o de otro marco: se reconstruye del marco GUARDADO.
      #
      # El contexto completo es `cache_stripped` —lleva la tabla atomica
      # estudiante x CH— asi que al abrir un `.pulso` NUNCA existe, y hasta aqui
      # eso dejaba el preview muerto para el resto de la sesion: el embudo caia
      # a la cascada ejecutada sin decirlo. La version reducida devuelve el
      # recorrido vivo para los pasos de curso-horario y declara los de alumno
      # como `sin_recuento`.
      if (is.list(frame) && nzchar(source_frame_hash) &&
          identical(source_frame_hash, frame_hash) &&
          (!is.list(context) || !identical(source_frame_hash, context_hash))) {
        rehidratado <- .cm_criterios_contexto_desde_marco(frame)
        if (is.list(rehidratado)) {
          context <- rehidratado
          context_hash <- .cm_aulas_scalar(context$source_frame_hash, "")
          context_criteria_hash <- .cm_aulas_scalar(context$current_criteria_hash, "")
          session_set(sid, "calc_muestra_aulas_criterios_contexto", context)
        }
      }
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
