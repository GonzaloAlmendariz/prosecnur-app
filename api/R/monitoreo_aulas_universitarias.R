# Perfil operativo para monitoreo de aulas universitarias.

monitoreo_aulas_estados <- function() {
  c(
    "planificada", "contactada", "agendada", "en_campo", "aplicada",
    "parcial", "sin_acceso", "cancelada", "reemplazo_pendiente",
    "reemplazada", "cerrada"
  )
}

monitoreo_aulas_motivos_reemplazo <- function() {
  c(
    "docente_no_autoriza", "aula_no_existe", "horario_cambio",
    "virtual_no_presencial", "baja_asistencia", "cruce_logistico",
    "aula_ya_aplicada", "incidencia_etica", "otro"
  )
}

.monitoreo_aulas_df <- function(x, label = "tabla") {
  if (is.null(x)) return(data.frame(stringsAsFactors = FALSE))
  if (is.data.frame(x)) return(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE))
  if (!is.list(x)) {
    stop(sprintf("El insumo '%s' debe ser una tabla o lista de filas.", label), call. = FALSE)
  }
  if (!length(x)) return(data.frame(stringsAsFactors = FALSE))
  rows <- vapply(x, function(item) is.list(item) || is.data.frame(item), logical(1))
  if (all(rows) && (is.null(names(x)) || !all(nzchar(names(x))))) {
    cols <- unique(unlist(lapply(x, names), use.names = FALSE))
    cols <- cols[!is.na(cols) & nzchar(cols)]
    out <- stats::setNames(lapply(cols, function(col) {
      vapply(x, function(row) .monitoreo_scalar(row[[col]], ""), character(1))
    }), cols)
    return(as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE))
  }
  as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE)
}

.monitoreo_aulas_records <- function(df, max_rows = Inf) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  if (is.finite(max_rows)) df <- utils::head(df, max_rows)
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

.monitoreo_aulas_col <- function(df, candidates) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  candidates <- .monitoreo_chr_vec(candidates)
  if (!length(candidates)) return("")
  nms <- names(df)
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  nms_key <- .monitoreo_text_key(nms)
  cand_key <- .monitoreo_text_key(candidates)
  idx <- match(cand_key, nms_key, nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  ""
}

.monitoreo_aulas_values <- function(df, col, default = "") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))
  col <- .monitoreo_scalar(col, "")
  if (!nzchar(col) || !col %in% names(df)) return(rep(default, nrow(df)))
  out <- as.character(df[[col]])
  out[is.na(out)] <- default
  trimws(out)
}

.monitoreo_aulas_num_values <- function(df, col, default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df)) return(numeric(0))
  col <- .monitoreo_scalar(col, "")
  if (!nzchar(col) || !col %in% names(df)) return(rep(default, nrow(df)))
  out <- suppressWarnings(as.numeric(df[[col]]))
  out[!is.finite(out)] <- default
  out
}

.monitoreo_aulas_status <- function(x, default = "planificada") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    planificada = "planificada",
    planificado = "planificada",
    contactada = "contactada",
    agendada = "agendada",
    campo = "en_campo",
    en_campo = "en_campo",
    aplicada = "aplicada",
    completo = "aplicada",
    completed = "aplicada",
    parcial = "parcial",
    sin_acceso = "sin_acceso",
    cancelada = "cancelada",
    reemplazo_pendiente = "reemplazo_pendiente",
    reemplazada = "reemplazada",
    cerrada = "cerrada"
  )
  out <- unname(aliases[[key]] %||% "")
  if (nzchar(out) && out %in% monitoreo_aulas_estados()) out else default
}

.monitoreo_aulas_reason <- function(x, default = "otro") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    docente_no_autoriza = "docente_no_autoriza",
    profesor_no_autoriza = "docente_no_autoriza",
    aula_no_existe = "aula_no_existe",
    horario_cambio = "horario_cambio",
    cambio_horario = "horario_cambio",
    virtual_no_presencial = "virtual_no_presencial",
    virtual = "virtual_no_presencial",
    baja_asistencia = "baja_asistencia",
    cruce_logistico = "cruce_logistico",
    aula_ya_aplicada = "aula_ya_aplicada",
    incidencia_etica = "incidencia_etica",
    otro = "otro"
  )
  out <- unname(aliases[[key]] %||% "")
  if (nzchar(out) && out %in% monitoreo_aulas_motivos_reemplazo()) out else default
}

monitoreo_aulas_default_config <- function() {
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = FALSE,
    selection_run_id = "",
    frame_hash = "",
    imported_at = "",
    anonymous_responses = TRUE,
    source_mapping = list(
      classroom_id_var = "",
      collector_var = "",
      link_var = "",
      date_var = "",
      status_var = "",
      valid_statuses = as.list(c("completed", "complete", "valid", "aprobado", "aplicada"))
    ),
    plan = list(),
    quotas = list(),
    variables_control = list(),
    methodology = list(),
    representativity = list(),
    alerts = list(
      min_valid_per_class = 1L,
      warn_partial_under_valid = 5L
    )
  )
}

monitoreo_aulas_normalize_config <- function(config = list()) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_aulas_default_config()
  mapping <- config$source_mapping %||% config$mapeo_fuentes %||% list()
  if (!is.list(mapping)) mapping <- list()
  alerts <- config$alerts %||% config$alertas %||% list()
  if (!is.list(alerts)) alerts <- list()
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = .monitoreo_bool(config$enabled %||% config$activo, defaults$enabled),
    selection_run_id = .monitoreo_scalar(config$selection_run_id %||% config$run_id, defaults$selection_run_id),
    frame_hash = .monitoreo_scalar(config$frame_hash, defaults$frame_hash),
    imported_at = .monitoreo_scalar(config$imported_at %||% config$importado_en, defaults$imported_at),
    anonymous_responses = .monitoreo_bool(config$anonymous_responses %||% config$respuestas_anonimas, defaults$anonymous_responses),
    source_mapping = list(
      classroom_id_var = .monitoreo_scalar(mapping$classroom_id_var %||% mapping$aula_var, defaults$source_mapping$classroom_id_var),
      collector_var = .monitoreo_scalar(mapping$collector_var %||% mapping$collector, defaults$source_mapping$collector_var),
      link_var = .monitoreo_scalar(mapping$link_var %||% mapping$link, defaults$source_mapping$link_var),
      date_var = .monitoreo_scalar(mapping$date_var %||% mapping$fecha_var, defaults$source_mapping$date_var),
      status_var = .monitoreo_scalar(mapping$status_var %||% mapping$estado_var, defaults$source_mapping$status_var),
      valid_statuses = as.list(.monitoreo_chr_vec(mapping$valid_statuses %||% mapping$estados_validos %||% defaults$source_mapping$valid_statuses))
    ),
    plan = monitoreo_aulas_normalize_plan(config$plan %||% config$agenda %||% defaults$plan),
    quotas = config$quotas %||% config$cuotas %||% defaults$quotas,
    variables_control = config$variables_control %||% config$variablesControl %||% defaults$variables_control,
    methodology = config$methodology %||% config$metodologia %||% defaults$methodology,
    representativity = config$representativity %||% config$representatividad %||% defaults$representativity,
    alerts = list(
      min_valid_per_class = max(1L, .monitoreo_int(alerts$min_valid_per_class %||% alerts$min_validas_aula, defaults$alerts$min_valid_per_class)),
      warn_partial_under_valid = max(1L, .monitoreo_int(alerts$warn_partial_under_valid %||% alerts$alerta_parcial_menor_a, defaults$alerts$warn_partial_under_valid))
    )
  )
}

monitoreo_aulas_normalize_plan <- function(plan = list()) {
  df <- .monitoreo_aulas_df(plan, "plan")
  if (!nrow(df)) return(list())
  col <- function(candidates) .monitoreo_aulas_col(df, candidates)
  get <- function(candidates, default = "") .monitoreo_aulas_values(df, col(candidates), default)
  getn <- function(candidates, default = NA_real_) .monitoreo_aulas_num_values(df, col(candidates), default)
  n <- nrow(df)
  out <- data.frame(
    selection_run_id = get(c("selection_run_id", "run_id"), ""),
    wave = get(c("wave", "ola"), "M1"),
    orden = getn(c("orden", "order"), seq_len(n)),
    classroom_id = get(c("classroom_id", "aula_id", "codigo_aula"), ""),
    label = get(c("label", "aula", "salon"), ""),
    course_id = get(c("course_id", "curso_id", "codigo_curso"), ""),
    course_name = get(c("course_name", "curso", "nombre_curso"), ""),
    section = get(c("section", "seccion"), ""),
    schedule = get(c("schedule", "horario"), ""),
    teacher = get(c("teacher", "docente"), ""),
    teacher_email = get(c("teacher_email", "correo_docente"), ""),
    faculty = get(c("faculty", "facultad"), ""),
    program = get(c("program", "programa", "carrera"), ""),
    level = get(c("level", "nivel"), ""),
    stratum = get(c("stratum", "estrato"), "global"),
    eligible_n = getn(c("eligible_n", "elegibles"), 0),
    expected_valid = getn(c("expected_valid", "meta_aula", "eligible_n"), 0),
    link = get(c("link", "url", "collector_link"), ""),
    qr = get(c("qr", "qr_url"), ""),
    collector_id = get(c("collector_id", "collector", "collectorId"), ""),
    responsible = get(c("responsible", "responsable"), ""),
    operational_status = get(c("operational_status", "estado", "estado_operativo"), "planificada"),
    replacement_for = get(c("replacement_for", "reemplazo_de"), ""),
    replacement_reason = get(c("replacement_reason", "motivo_reemplazo"), ""),
    replacement_note = get(c("replacement_note", "nota_reemplazo"), ""),
    representativity_score = getn(c("representativity_score", "score_representatividad"), NA_real_),
    representativity_distance = getn(c("representativity_distance", "distancia_representatividad"), NA_real_),
    pi_final = getn(c("pi_final", "probabilidad_final"), NA_real_),
    weight_classroom = getn(c("weight_classroom", "peso_aula"), NA_real_),
    updated_at = get(c("updated_at", "actualizado_en"), ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  out$operational_status <- vapply(out$operational_status, .monitoreo_aulas_status, character(1))
  out$replacement_reason <- vapply(out$replacement_reason, function(x) if (nzchar(x)) .monitoreo_aulas_reason(x) else "", character(1))
  out$expected_valid[!is.finite(out$expected_valid)] <- out$eligible_n[!is.finite(out$expected_valid)]
  out$eligible_n[!is.finite(out$eligible_n)] <- 0
  out$expected_valid[!is.finite(out$expected_valid)] <- 0
  out <- out[nzchar(out$classroom_id), , drop = FALSE]
  rownames(out) <- NULL
  .monitoreo_aulas_records(out)
}

monitoreo_aulas_from_calc <- function(estudio = NULL, selection = NULL, frame = NULL, config = list()) {
  sel <- selection$selection %||% selection
  plan <- monitoreo_aulas_normalize_plan(sel)
  cfg <- monitoreo_aulas_normalize_config(config)
  cfg$enabled <- TRUE
  cfg$selection_run_id <- .monitoreo_scalar(selection$selection_run_id %||% cfg$selection_run_id, "")
  cfg$frame_hash <- .monitoreo_scalar(selection$frame_hash %||% frame$frame_hash %||% cfg$frame_hash, "")
  cfg$imported_at <- .monitoreo_now_iso()
  cfg$plan <- plan
  cfg$quotas <- selection$quotas %||% cfg$quotas
  cfg$methodology <- list(
    calc_muestra = selection$methodology %||% list(),
    representativity = selection$representativity %||% list(),
    frame_hash = cfg$frame_hash,
    selection_run_id = cfg$selection_run_id,
    source = "calc-muestra"
  )
  cfg$representativity <- selection$representativity %||% cfg$representativity
  if (is.list(estudio)) {
    cfg$study_title <- .monitoreo_scalar(estudio$titulo %||% estudio$title, "")
    cfg$study_macro_family <- .monitoreo_scalar(estudio$macro_familia, "")
  }
  cfg
}

.monitoreo_aulas_distribution_distance <- function(planned, effective, var = "stratum", weight_col = "eligible_n") {
  if (!nrow(planned) || !nrow(effective) || !var %in% names(planned) || !var %in% names(effective)) {
    return(list(score = NA_real_, distance = NA_real_, table = data.frame(stringsAsFactors = FALSE), warning = "Sin datos suficientes para distancia efectiva."))
  }
  pv <- .monitoreo_aulas_values(planned, var, "sin_dato")
  ev <- .monitoreo_aulas_values(effective, var, "sin_dato")
  pw <- suppressWarnings(as.numeric(planned[[weight_col]] %||% rep(1, nrow(planned))))
  ew <- suppressWarnings(as.numeric(effective[[weight_col]] %||% rep(1, nrow(effective))))
  pw[!is.finite(pw) | pw < 0] <- 0
  ew[!is.finite(ew) | ew < 0] <- 0
  cats <- sort(unique(c(pv, ev)))
  rows <- lapply(cats, function(cat) {
    planned_n <- sum(pw[pv == cat], na.rm = TRUE)
    effective_n <- sum(ew[ev == cat], na.rm = TRUE)
    planned_prop <- planned_n / max(1, sum(pw, na.rm = TRUE))
    effective_prop <- effective_n / max(1, sum(ew, na.rm = TRUE))
    data.frame(
      variable = var,
      categoria = cat,
      planned_n = round(planned_n, 6),
      effective_n = round(effective_n, 6),
      planned_prop = round(planned_prop, 6),
      effective_prop = round(effective_prop, 6),
      abs_error = round(abs(effective_prop - planned_prop), 6),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  table <- if (length(rows)) do.call(rbind, rows) else data.frame(stringsAsFactors = FALSE)
  avg_abs <- if (nrow(table)) mean(table$abs_error, na.rm = TRUE) else NA_real_
  max_abs <- if (nrow(table)) max(table$abs_error, na.rm = TRUE) else NA_real_
  score <- if (is.finite(avg_abs)) round(max(0, 100 - min(100, 100 * avg_abs / 0.05)), 1) else NA_real_
  list(
    score = score,
    distance = round(avg_abs %||% NA_real_, 6),
    table = table,
    warning = if (is.finite(max_abs) && max_abs > 0.10) "La muestra efectiva se aleja mas de 10 pp en al menos una celda." else ""
  )
}

.monitoreo_aulas_effective_representativity <- function(plan_df, cfg) {
  planned <- plan_df[plan_df$wave == "M1", , drop = FALSE]
  active_status <- c("planificada", "contactada", "agendada", "en_campo", "aplicada", "parcial", "cerrada")
  effective <- rbind(
    planned[planned$operational_status %in% active_status & !planned$operational_status %in% c("reemplazada", "cancelada", "sin_acceso"), , drop = FALSE],
    plan_df[nzchar(plan_df$replacement_for) & plan_df$operational_status %in% active_status, , drop = FALSE]
  )
  distance <- .monitoreo_aulas_distribution_distance(planned, effective, "stratum", "eligible_n")
  planned_score <- suppressWarnings(as.numeric(planned$representativity_score[is.finite(planned$representativity_score)][1]))
  if (!is.finite(planned_score)) {
    planned_score <- suppressWarnings(as.numeric(cfg$representativity$representativity_score %||% cfg$representativity$overall_score %||% NA_real_))
  }
  score_loss <- if (is.finite(planned_score) && is.finite(distance$score)) round(planned_score - distance$score, 3) else NA_real_
  list(
    planned_score = if (is.finite(planned_score)) planned_score else NA_real_,
    effective_score = distance$score,
    effective_distance = distance$distance,
    score_loss = score_loss,
    planned_aulas = as.integer(nrow(planned)),
    effective_aulas = as.integer(nrow(effective)),
    distribution = .monitoreo_aulas_records(distance$table),
    warning = distance$warning
  )
}

.monitoreo_aulas_valid_response <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(rep(FALSE, 0L))
  mapping <- cfg$source_mapping %||% list()
  status_col <- .monitoreo_scalar(mapping$status_var, "")
  if (!nzchar(status_col) || !status_col %in% names(data)) {
    status_col <- .monitoreo_aulas_col(data, c("response_status", "validation_status", "estado", "status", "_status"))
  }
  if (!nzchar(status_col) || !status_col %in% names(data)) return(rep(TRUE, nrow(data)))
  valid <- .monitoreo_text_key(.monitoreo_chr_vec(mapping$valid_statuses %||% c("completed", "complete", "valid", "aprobado")))
  .monitoreo_text_key(data[[status_col]]) %in% valid
}

.monitoreo_aulas_response_classroom <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(character(0))
  mapping <- cfg$source_mapping %||% list()
  candidates <- c(mapping$classroom_id_var, "classroom_id", "aula_id", "codigo_aula", "aula", "collector_id", mapping$collector_var, mapping$link_var)
  col <- .monitoreo_aulas_col(data, candidates)
  .monitoreo_aulas_values(data, col, "")
}

monitoreo_aulas_dashboard <- function(plan = list(), responses = data.frame(), config = list()) {
  cfg <- monitoreo_aulas_normalize_config(config)
  plan_df <- .monitoreo_aulas_df(plan %||% cfg$plan, "plan")
  if (!nrow(plan_df)) {
    return(list(
      schema = "monitoreo_aulas_dashboard_v1",
      generated_at = .monitoreo_now_iso(),
      kpis = list(total_aulas = 0L, aulas_aplicadas = 0L, respuestas_validas = 0L, brechas = 0L),
      agenda = list(),
      avance_por_estrato = list(),
      brechas = list(),
      reemplazos = list(),
      validation = list()
    ))
  }
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan_df), "plan")
  status <- plan_df$operational_status
  valid_response <- .monitoreo_aulas_valid_response(responses, cfg)
  response_classroom <- .monitoreo_aulas_response_classroom(responses, cfg)
  valid_counts <- if (length(valid_response)) {
    table(response_classroom[valid_response & nzchar(response_classroom)])
  } else {
    integer(0)
  }
  plan_df$respuestas_validas <- as.integer(valid_counts[plan_df$classroom_id])
  plan_df$respuestas_validas[is.na(plan_df$respuestas_validas)] <- 0L
  plan_df$brecha <- pmax(0, suppressWarnings(as.numeric(plan_df$expected_valid)) - plan_df$respuestas_validas)
  plan_df$brecha[!is.finite(plan_df$brecha)] <- 0

  advance <- stats::aggregate(
    cbind(aulas = rep(1L, nrow(plan_df)), respuestas_validas = plan_df$respuestas_validas, brecha = plan_df$brecha) ~ stratum,
    data = plan_df,
    FUN = sum
  )
  applied_by_stratum <- stats::aggregate(
    aplicada ~ stratum,
    data = data.frame(stratum = plan_df$stratum, aplicada = status %in% c("aplicada", "cerrada", "parcial"), stringsAsFactors = FALSE),
    FUN = sum
  )
  advance <- merge(advance, applied_by_stratum, by = "stratum", all.x = TRUE, sort = FALSE)
  names(advance)[names(advance) == "aplicada"] <- "aulas_aplicadas"
  advance$avance_aulas_pct <- ifelse(advance$aulas > 0, round(100 * advance$aulas_aplicadas / advance$aulas, 1), NA_real_)
  advance$avance_respuestas_pct <- ifelse((advance$respuestas_validas + advance$brecha) > 0, round(100 * advance$respuestas_validas / (advance$respuestas_validas + advance$brecha), 1), NA_real_)

  brechas <- plan_df[plan_df$brecha > 0 | plan_df$operational_status %in% c("sin_acceso", "cancelada", "reemplazo_pendiente"), , drop = FALSE]
  replacements <- plan_df[nzchar(plan_df$replacement_for) | plan_df$operational_status %in% c("reemplazada", "reemplazo_pendiente"), , drop = FALSE]
  representativity <- .monitoreo_aulas_effective_representativity(plan_df, cfg)

  collector_col <- .monitoreo_aulas_col(responses, c(cfg$source_mapping$collector_var, "collector_id", "collector", "link", "aula_id", "classroom_id"))
  collector_values <- if (nzchar(collector_col)) .monitoreo_aulas_values(responses, collector_col, "") else character(0)
  validation <- data.frame(
    check = c("anonymous_responses", "student_id_required", "unmapped_valid_responses", "duplicate_collectors", "effective_representativity"),
    status = c(
      if (isTRUE(cfg$anonymous_responses)) "ok" else "review",
      "ok",
      if (length(valid_response) && any(valid_response & !nzchar(response_classroom))) "warning" else "ok",
      if (length(collector_values) && any(duplicated(collector_values[nzchar(collector_values)]))) "review" else "ok",
      if (nzchar(representativity$warning %||% "")) "warning" else "ok"
    ),
    detail = c(
      "El tablero agrega por aula/collector/link.",
      "No se exige identificador personal de estudiante.",
      as.character(sum(valid_response & !nzchar(response_classroom))),
      as.character(sum(duplicated(collector_values[nzchar(collector_values)]))),
      if (nzchar(representativity$warning %||% "")) representativity$warning else sprintf("Score efectivo %.1f.", representativity$effective_score %||% NA_real_)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  list(
    schema = "monitoreo_aulas_dashboard_v1",
    generated_at = .monitoreo_now_iso(),
    selection_run_id = cfg$selection_run_id,
    frame_hash = cfg$frame_hash,
    anonymous_responses = isTRUE(cfg$anonymous_responses),
    kpis = list(
      total_aulas = as.integer(nrow(plan_df)),
      aulas_titulares = as.integer(sum(plan_df$wave == "M1")),
      aulas_aplicadas = as.integer(sum(status %in% c("aplicada", "cerrada"))),
      aulas_parciales = as.integer(sum(status == "parcial")),
      reemplazos_usados = as.integer(sum(nzchar(plan_df$replacement_for) & status %in% c("agendada", "en_campo", "aplicada", "cerrada", "parcial"))),
      respuestas_validas = as.integer(sum(valid_response)),
      brechas = as.integer(sum(plan_df$brecha > 0)),
      representativity_effective_score = representativity$effective_score,
      representativity_score_loss = representativity$score_loss
    ),
    agenda = .monitoreo_aulas_records(plan_df),
    avance_por_estrato = .monitoreo_aulas_records(advance),
    brechas = .monitoreo_aulas_records(brechas),
    reemplazos = .monitoreo_aulas_records(replacements),
    representativity = representativity,
    validation = .monitoreo_aulas_records(validation)
  )
}

monitoreo_aulas_update_agenda <- function(current, updates = list()) {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  upd_df <- .monitoreo_aulas_df(updates, "updates")
  if (!nrow(upd_df)) return(monitoreo_aulas_normalize_plan(plan_df))
  if (!"classroom_id" %in% names(upd_df)) {
    id_col <- .monitoreo_aulas_col(upd_df, c("aula_id", "codigo_aula", "id"))
    if (nzchar(id_col)) names(upd_df)[names(upd_df) == id_col] <- "classroom_id"
  }
  if (!"classroom_id" %in% names(upd_df)) stop("Las actualizaciones requieren classroom_id.", call. = FALSE)
  for (i in seq_len(nrow(upd_df))) {
    cid <- .monitoreo_scalar(upd_df$classroom_id[[i]], "")
    if (!nzchar(cid)) next
    idx <- which(plan_df$classroom_id == cid)
    if (!length(idx)) next
    row <- upd_df[i, , drop = FALSE]
    for (nm in names(row)) {
      if (!nm %in% names(plan_df)) next
      value <- .monitoreo_scalar(row[[nm]], "")
      if (!nzchar(value) && !nm %in% c("link", "qr", "collector_id", "responsible", "replacement_note")) next
      plan_df[idx, nm] <- value
    }
    plan_df$operational_status[idx] <- .monitoreo_aulas_status(plan_df$operational_status[idx], plan_df$operational_status[idx])
    plan_df$updated_at[idx] <- .monitoreo_now_iso()
  }
  monitoreo_aulas_normalize_plan(plan_df)
}

monitoreo_aulas_apply_replacement <- function(current, classroom_id, replacement_id, reason = "otro", note = "") {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  classroom_id <- .monitoreo_scalar(classroom_id, "")
  replacement_id <- .monitoreo_scalar(replacement_id, "")
  if (!nzchar(classroom_id) || !nzchar(replacement_id)) {
    stop("Se requiere aula caida y aula de reemplazo.", call. = FALSE)
  }
  idx_old <- which(plan_df$classroom_id == classroom_id)
  idx_new <- which(plan_df$classroom_id == replacement_id)
  if (!length(idx_old)) stop("No se encontro el aula caida en el plan.", call. = FALSE)
  if (!length(idx_new)) stop("No se encontro el aula de reemplazo en el plan.", call. = FALSE)
  reason <- .monitoreo_aulas_reason(reason)
  plan_df$operational_status[idx_old] <- "reemplazada"
  plan_df$replacement_reason[idx_old] <- reason
  plan_df$replacement_note[idx_old] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_old] <- .monitoreo_now_iso()
  plan_df$operational_status[idx_new] <- "agendada"
  plan_df$replacement_for[idx_new] <- classroom_id
  plan_df$replacement_reason[idx_new] <- reason
  plan_df$replacement_note[idx_new] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_new] <- .monitoreo_now_iso()
  monitoreo_aulas_normalize_plan(plan_df)
}
