# Motor de Monitoreo Digital.

.monitoreo_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.monitoreo_scalar <- function(x, default = "") {
  if (is.null(x) || length(x) == 0L) return(default)
  out <- as.character(x)[1]
  if (is.na(out)) default else out
}

.monitoreo_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.data.frame(x)) x <- unlist(x, use.names = FALSE)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  out <- as.character(x)
  out <- out[!is.na(out) & nzchar(trimws(out))]
  unique(trimws(out))
}

.monitoreo_num <- function(x, default = NA_real_) {
  out <- suppressWarnings(as.numeric(x %||% default)[1])
  if (is.finite(out)) out else default
}

.monitoreo_int <- function(x, default = 0L) {
  out <- suppressWarnings(as.integer(x %||% default)[1])
  if (is.finite(out)) out else default
}

.monitoreo_bool <- function(x, default = FALSE) {
  if (is.null(x)) return(default)
  if (is.logical(x)) return(isTRUE(x[1]))
  tolower(as.character(x)[1]) %in% c("1", "true", "t", "yes", "si", "sí")
}

.monitoreo_safe_name <- function(x) {
  x <- tolower(trimws(as.character(x %||% "")))
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("^_+|_+$", "", x)
  if (is.na(x) || !nzchar(x)) "campo" else x
}

.monitoreo_variable_label_map <- function(data) {
  if (is.null(data) || !is.data.frame(data)) return(character(0))
  raw <- attr(data, "variable_labels", exact = TRUE)
  out <- character(0)
  if (!is.null(raw)) {
    if (is.list(raw)) raw <- unlist(raw, use.names = TRUE)
    nms <- names(raw)
    raw <- as.character(raw)
    if (!is.null(nms)) {
      keep <- nzchar(nms) & !is.na(raw) & nzchar(trimws(raw))
      out <- stats::setNames(trimws(raw[keep]), nms[keep])
    }
  }
  for (nm in names(data)) {
    label <- attr(data[[nm]], "label", exact = TRUE)
    label <- .monitoreo_scalar(label, "")
    if (nzchar(label) && !(nm %in% names(out))) out[[nm]] <- label
  }
  out
}

.monitoreo_restore_variable_labels <- function(data, labels) {
  if (is.null(data) || !is.data.frame(data) || !length(labels)) return(data)
  nms <- names(labels)
  labels <- as.character(labels)
  if (is.null(nms)) return(data)
  keep <- nzchar(nms) & !is.na(labels) & nzchar(trimws(labels)) & nms %in% names(data)
  labels <- stats::setNames(trimws(labels[keep]), nms[keep])
  if (!length(labels)) return(data)
  attr(data, "variable_labels") <- labels
  for (nm in names(labels)) attr(data[[nm]], "label") <- unname(labels[[nm]])
  data
}

.monitoreo_source_dimensions <- function(src) {
  raw <- src$dimensions %||% src$dimensiones %||% list()
  if (is.data.frame(raw)) raw <- as.list(raw[1, , drop = FALSE])
  if (!is.list(raw)) raw <- list()

  for (key in c("actor", "servicio", "municipalidad")) {
    if (is.null(raw[[key]]) && !is.null(src[[key]])) raw[[key]] <- src[[key]]
  }

  out <- list()
  nms <- names(raw)
  if (is.null(nms)) nms <- rep("", length(raw))
  for (i in seq_along(raw)) {
    key <- .monitoreo_safe_name(nms[[i]])
    if (!nzchar(key) || identical(key, "campo")) next
    value <- .monitoreo_scalar(raw[[i]], "")
    if (!nzchar(trimws(value))) next
    out[[key]] <- trimws(value)
  }
  out
}

.monitoreo_dimension_columns <- function(dimensions) {
  dimensions <- dimensions %||% list()
  if (!is.list(dimensions) || !length(dimensions)) return(list())
  out <- list()
  for (key in names(dimensions)) {
    value <- .monitoreo_scalar(dimensions[[key]], "")
    if (!nzchar(trimws(value))) next
    out[[paste0("dim_", .monitoreo_safe_name(key))]] <- trimws(value)
  }
  out
}

.monitoreo_allowed_source_roles <- function() {
  c("universo", "barrido", "respuestas", "avance_interno", "reporte_cliente", "hoja_ruta")
}

.monitoreo_allowed_integration_modes <- function() {
  c("file", "connected_read", "controlled_write")
}

.monitoreo_source_role <- function(src, kind = "") {
  role <- .monitoreo_safe_name(src$role %||% src$rol %||% "")
  role <- switch(role,
    universo = "universo",
    barrido = "barrido",
    respuestas = "respuestas",
    respuesta = "respuestas",
    avanceinterno = "avance_interno",
    avance_interno = "avance_interno",
    reportecliente = "reporte_cliente",
    reporte_cliente = "reporte_cliente",
    hojaruta = "hoja_ruta",
    hoja_ruta = "hoja_ruta",
    ""
  )
  if (!nzchar(role)) {
    role <- if (identical(kind, "google_sheets")) "barrido" else "respuestas"
  }
  if (!role %in% .monitoreo_allowed_source_roles()) role <- "respuestas"
  role
}

.monitoreo_integration_mode <- function(src, kind = "") {
  mode <- .monitoreo_safe_name(src$integration_mode %||% src$integrationMode %||% src$modo_integracion %||% "")
  mode <- switch(mode,
    file = "file",
    archivo = "file",
    connectedread = "connected_read",
    connected_read = "connected_read",
    lecturaconectada = "connected_read",
    controlledwrite = "controlled_write",
    controlled_write = "controlled_write",
    escrituracontrolada = "controlled_write",
    ""
  )
  if (!nzchar(mode)) {
    mode <- if (identical(kind, "google_sheets")) "connected_read" else "connected_read"
  }
  if (!mode %in% .monitoreo_allowed_integration_modes()) mode <- "connected_read"
  mode
}

.monitoreo_extract_spreadsheet_id <- function(x) {
  text <- trimws(as.character(x %||% "")[1])
  if (is.na(text)) text <- ""
  hit <- regmatches(text, regexpr("/d/([A-Za-z0-9_-]+)", text, perl = TRUE))
  if (length(hit) && nzchar(hit)) {
    return(sub("^/d/", "", hit))
  }
  text
}

.monitoreo_sheet_binding <- function(src) {
  raw <- src$sheet_binding %||% src$sheetBinding %||% list()
  if (is.data.frame(raw)) raw <- as.list(raw[1, , drop = FALSE])
  if (!is.list(raw)) raw <- list()
  spreadsheet_id <- raw$spreadsheet_id %||% raw$spreadsheetId %||% src$spreadsheet_id %||% src$spreadsheetId %||% src$url %||% ""
  sheet_name <- raw$sheet_name %||% raw$sheetName %||% raw$pestana %||% src$sheet_name %||% src$sheetName %||% src$pestana %||% ""
  header_row <- .monitoreo_int(raw$header_row %||% raw$headerRow %||% src$header_row %||% src$headerRow, 1L)
  if (!is.finite(header_row) || header_row < 1L) header_row <- 1L
  list(
    spreadsheet_id = .monitoreo_extract_spreadsheet_id(spreadsheet_id),
    sheet_name = .monitoreo_scalar(sheet_name, ""),
    header_row = as.integer(header_row),
    range = .monitoreo_scalar(raw$range %||% raw$rango %||% src$range, ""),
    last_read_at = .monitoreo_scalar(raw$last_read_at %||% raw$lastReadAt, ""),
    snapshot_hash = .monitoreo_scalar(raw$snapshot_hash %||% raw$snapshotHash, "")
  )
}

monitoreo_snapshot_hash <- function(data) {
  if (is.null(data) || !is.data.frame(data)) return("")
  if (requireNamespace("digest", quietly = TRUE)) {
    return(digest::digest(data, algo = "sha256"))
  }
  as.character(utils::object.size(data))
}

.monitoreo_normalize_profile_list <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) x <- lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))
  if (!is.list(x)) return(list())
  if (!length(x)) return(list())
  if (is.null(names(x)) || any(!nzchar(names(x)))) {
    return(Filter(is.list, x))
  }
  if (all(vapply(x, is.list, logical(1)))) return(unname(x))
  list(x)
}

monitoreo_normalize_profile <- function(profile = list(), acreditacion = NULL) {
  if (is.null(profile) || !is.list(profile)) profile <- list()
  family <- .monitoreo_safe_name(profile$family %||% profile$familia %||% "acreditacion")
  if (!family %in% c("acreditacion", "territorial", "telefonico", "digital_general")) family <- "acreditacion"
  variant <- .monitoreo_safe_name(profile$variant %||% profile$variante %||% "")
  if (!variant %in% c("multi_actor", "segmentada_por_carrera")) {
    variant <- if (length(profile$segments %||% profile$segmentos %||% list())) "segmentada_por_carrera" else "multi_actor"
  }

  units <- lapply(.monitoreo_normalize_profile_list(profile$units %||% profile$unidades), function(item) {
    list(
      id = .monitoreo_scalar(item$id %||% item$unidad, .monitoreo_safe_name(item$label %||% item$etiqueta %||% "")),
      type = .monitoreo_scalar(item$type %||% item$tipo, "actor"),
      label = .monitoreo_scalar(item$label %||% item$etiqueta %||% item$unidad, ""),
      actor = .monitoreo_scalar(item$actor, ""),
      segment = .monitoreo_scalar(item$segment %||% item$segmento, ""),
      group = .monitoreo_scalar(item$group %||% item$grupo, "")
    )
  })
  segments <- lapply(.monitoreo_normalize_profile_list(profile$segments %||% profile$segmentos), function(item) {
    list(
      id = .monitoreo_scalar(item$id %||% item$segment %||% item$segmento, ""),
      label = .monitoreo_scalar(item$label %||% item$etiqueta %||% item$segmento, ""),
      actor = .monitoreo_scalar(item$actor, ""),
      field = .monitoreo_scalar(item$field %||% item$campo, ""),
      universe_value = .monitoreo_scalar(item$universe_value %||% item$valorUniverso %||% item$valor_universo, ""),
      sweep_sheet = .monitoreo_scalar(item$sweep_sheet %||% item$pestanaBarrido %||% item$pestana_barrido, "")
    )
  })
  groups <- lapply(.monitoreo_normalize_profile_list(profile$groups %||% profile$grupos), function(item) {
    list(
      id = .monitoreo_scalar(item$id %||% item$group %||% item$grupo, ""),
      label = .monitoreo_scalar(item$label %||% item$etiqueta %||% item$grupo, ""),
      actor = .monitoreo_scalar(item$actor, ""),
      segments = as.list(.monitoreo_chr_vec(item$segments %||% item$segmentos))
    )
  })
  minimums_raw <- profile$minimums %||% profile$minimos %||% profile$minimos_por_segmento %||% list()
  minimums <- list()
  if (is.data.frame(minimums_raw)) minimums_raw <- lapply(seq_len(nrow(minimums_raw)), function(i) as.list(minimums_raw[i, , drop = FALSE]))
  if (is.list(minimums_raw) && length(minimums_raw)) {
    if (!is.null(names(minimums_raw)) && all(nzchar(names(minimums_raw)))) {
      for (nm in names(minimums_raw)) minimums[[nm]] <- max(0L, .monitoreo_int(minimums_raw[[nm]], 0L))
    } else {
      for (item in minimums_raw) {
        if (!is.list(item)) next
        id <- .monitoreo_scalar(item$segment %||% item$segmento %||% item$id, "")
        if (nzchar(id)) minimums[[id]] <- max(0L, .monitoreo_int(item$minimum %||% item$minimo, 0L))
      }
    }
  }

  key_rules_raw <- profile$key_rules %||% profile$llaves_cruce %||% list()
  if (!is.list(key_rules_raw)) key_rules_raw <- list()
  dedup_raw <- profile$deduplication %||% profile$deduplicacion %||% list()
  if (!is.list(dedup_raw)) dedup_raw <- list()
  alerts_raw <- profile$alerts %||% profile$alertas %||% list()
  if (!is.list(alerts_raw)) alerts_raw <- list()
  reconciliation_raw <- profile$reconciliation_decisions %||% profile$decisiones_conciliacion %||% list()
  if (!is.list(reconciliation_raw)) reconciliation_raw <- list()
  rejection_rules <- lapply(.monitoreo_normalize_profile_list(profile$rejection_rules %||% profile$reglas_rechazo), function(item) {
    list(
      enabled = .monitoreo_bool(item$enabled %||% item$activo, TRUE),
      actor = .monitoreo_scalar(item$actor, ""),
      question_patterns = as.list(.monitoreo_chr_vec(item$question_patterns %||% item$patronesPregunta %||% item$patrones_pregunta)),
      rejection_answers = as.list(.monitoreo_chr_vec(item$rejection_answers %||% item$respuestasRechazo %||% item$respuestas_rechazo))
    )
  })

  out <- list(
    family = family,
    variant = variant,
    status = .monitoreo_scalar(profile$status %||% profile$estado, if (identical(family, "acreditacion")) "active" else "planned"),
    route_selected = .monitoreo_bool(profile$route_selected %||% profile$ruta_seleccionada %||% profile$selected, FALSE),
    locked_at = .monitoreo_scalar(profile$locked_at %||% profile$bloqueado_en, ""),
    units = units,
    segments = segments,
    groups = groups,
    minimums = minimums,
    rejection_rules = rejection_rules,
    key_rules = list(
      universe_fields = as.list(.monitoreo_chr_vec(key_rules_raw$universe_fields %||% key_rules_raw$campos_universo %||% c("CodPulso", "id", "ID", "codigo", "Codigo", "Código", "correo", "email", "telefono", "celular"))),
      response_fields = as.list(unique(c(
        .monitoreo_chr_vec(key_rules_raw$response_fields %||% key_rules_raw$campos_respuesta %||% c("CodPulso", "Código PUCP", "Codigo PUCP", "email_address", "custom_value")),
        "cv_id"
      ))),
      use_name_fallback = .monitoreo_bool(key_rules_raw$use_name_fallback %||% key_rules_raw$usar_nombre_fallback, FALSE),
      automatic_detection = .monitoreo_bool(key_rules_raw$automatic_detection %||% key_rules_raw$deteccion_automatica, TRUE)
    ),
    deduplication = list(
      priority = as.list(.monitoreo_chr_vec(dedup_raw$priority %||% dedup_raw$prioridad %||% c("Completa", "Parcial", "Rechazo", "Sin respuesta")))
    ),
    alerts = list(
      no_answer_min_attempts = max(0L, .monitoreo_int(alerts_raw$no_answer_min_attempts %||% alerts_raw$noContestaIntentosMinimos, 4L)),
      unassigned_cases_min = max(0L, .monitoreo_int(alerts_raw$unassigned_cases_min %||% alerts_raw$casosSinResponsableMinimo, 5L)),
      no_sweep_min_cases = max(0L, .monitoreo_int(alerts_raw$no_sweep_min_cases %||% alerts_raw$responsableNoBarridosMinimoCasos, 20L)),
      no_sweep_pct = max(0, .monitoreo_num(alerts_raw$no_sweep_pct %||% alerts_raw$responsableNoBarridosPorcentaje, 0.5)),
      daily_effective_diff_min = max(0L, .monitoreo_int(alerts_raw$daily_effective_diff_min %||% alerts_raw$diferenciaEfectivasDiaMinima, 1L))
    ),
    reconciliation_decisions = list(
      include_response_ids = as.list(unique(.monitoreo_chr_vec(reconciliation_raw$include_response_ids %||% reconciliation_raw$incluir_response_ids %||% reconciliation_raw$incluir_respuestas))),
      exclude_response_ids = as.list(unique(.monitoreo_chr_vec(reconciliation_raw$exclude_response_ids %||% reconciliation_raw$excluir_response_ids %||% reconciliation_raw$excluir_respuestas)))
    )
  )
  attr(out, "compat_acreditacion") <- acreditacion
  out
}

.monitoreo_text_key <- function(x) {
  x <- trimws(tolower(as.character(x %||% "")))
  x[is.na(x)] <- ""
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[`'´’]", "", x)
  x <- gsub("\\s+", " ", x)
  x
}

.monitoreo_email_key <- function(x) {
  x <- .monitoreo_text_key(x)
  if (!grepl("@", x, fixed = TRUE)) return("")
  x
}

.monitoreo_phone_key <- function(x) {
  x <- gsub("\\D+", "", as.character(x %||% "")[1])
  if (is.na(x) || !nzchar(x)) "" else x
}

.monitoreo_code_keys <- function(x) {
  code <- toupper(gsub("[^A-Za-z0-9]+", "", as.character(x %||% "")[1]))
  if (is.na(code) || !nzchar(code)) return(character(0))
  out <- c(paste0("codigo:", code))
  no_zero <- sub("^0+", "", code)
  if (nzchar(no_zero) && !identical(no_zero, code)) out <- c(out, paste0("codigo:", no_zero))
  unique(out)
}

.monitoreo_field_match <- function(name, configured, automatic = TRUE) {
  clean <- .monitoreo_text_key(name)
  configured <- .monitoreo_text_key(.monitoreo_chr_vec(configured))
  if (clean %in% configured) return(TRUE)
  if (!isTRUE(automatic)) return(FALSE)
  grepl("mail|correo|telefono|celular|phone|codigo|cod|pulso|cv_id|^cv$|^id$", clean)
}

.monitoreo_response_key_aliases <- function(configured = character(0)) {
  unique(c(
    .monitoreo_chr_vec(configured),
    "cv_id", "custom_value",
    "recipient_email", "recipient_custom_value", "recipient_cv_id", "recipient_cv_codpulso",
    "CodPulso", "Código PUCP", "Codigo PUCP", "email_address"
  ))
}

.monitoreo_response_key_label_allowed <- function(name, label) {
  clean <- .monitoreo_text_key(name)
  label_clean <- .monitoreo_text_key(label)
  if (!nzchar(label_clean)) return(FALSE)
  if (!grepl("^q[0-9]+$", clean)) return(FALSE)
  optional_contact <- grepl("en caso|desee|resultados|envi|envie|enviar", label_clean) &&
    grepl("mail|correo|email", label_clean)
  if (optional_contact) return(FALSE)
  grepl("codigo pucp|codigo pulso|codpulso|cod pulso|cod pucp", label_clean)
}

.monitoreo_response_key_name_allowed <- function(name, configured = character(0)) {
  clean <- .monitoreo_text_key(name)
  clean %in% .monitoreo_text_key(.monitoreo_response_key_aliases(configured)) ||
    grepl("^recipient_cv_(id|cod|codigo|codpulso|codigo_pucp|cod_pucp)$", clean)
}

monitoreo_acreditacion_case_keys <- function(row, profile = list(), origin = c("universo", "respuesta")) {
  origin <- match.arg(origin)
  profile <- monitoreo_normalize_profile(profile)
  key_rules <- profile$key_rules %||% list()
  fields <- if (identical(origin, "respuesta")) key_rules$response_fields else key_rules$universe_fields
  automatic <- isTRUE(key_rules$automatic_detection)
  ignored_response <- c(
    "survey_id", "response_id", "collector_id", "nombre recopilador",
    "tipo recopilador", "recipient_id", "estado", "completa", "parcial",
    "rechazo", "total_time"
  )
  keys <- character(0)
  if (is.null(row) || !is.list(row)) return(keys)
  for (nm in names(row)) {
    value <- row[[nm]]
    if (is.null(value) || length(value) == 0L || !nzchar(trimws(as.character(value)[1]))) next
    clean <- .monitoreo_text_key(nm)
    if (identical(origin, "respuesta") && clean %in% ignored_response) next
    if (identical(origin, "respuesta")) {
      if (!.monitoreo_response_key_name_allowed(nm, fields)) next
    } else if (!.monitoreo_field_match(nm, fields, automatic)) {
      next
    }
    email <- .monitoreo_email_key(value)
    phone <- .monitoreo_phone_key(value)
    if (nzchar(email) && grepl("mail|correo", clean)) keys <- c(keys, paste0("email:", email))
    if (nzchar(phone) && grepl("telefono|celular|phone|fono", clean)) keys <- c(keys, paste0("telefono:", phone))
    if (grepl("codigo|cod|pulso|^id$", clean) || (!nzchar(email) && !nzchar(phone))) {
      keys <- c(keys, .monitoreo_code_keys(value))
    }
  }
  if (isTRUE(key_rules$use_name_fallback)) {
    name_parts <- character(0)
    for (nm in names(row)) {
      clean <- .monitoreo_text_key(nm)
      if (grepl("nombre|apellido|first_name|last_name", clean)) {
        name_parts <- c(name_parts, as.character(row[[nm]] %||% ""))
      }
    }
    name_key <- .monitoreo_text_key(paste(name_parts, collapse = " "))
    if (nzchar(name_key)) keys <- c(keys, paste0("nombre:", name_key))
  }
  unique(keys[nzchar(sub("^[^:]+:", "", keys))])
}

.monitoreo_acreditacion_state <- function(row) {
  if (is.null(row) || !is.list(row)) return("Sin respuesta")
  bool <- function(x) .monitoreo_bool(x, FALSE)
  role <- .monitoreo_text_key(row$.source_role %||% row$source_role %||% "")
  status <- if (identical(role, "respuestas")) {
    .monitoreo_text_key(row$response_status %||% row$Estado %||% row$estado %||% row$Estatus %||% row$estatus %||% row$status %||% row$Status %||% "")
  } else {
    .monitoreo_text_key(row$Status %||% row$Estado %||% row$estado %||% row$Estatus %||% row$estatus %||% row$response_status %||% row$status %||% "")
  }
  complete_values <- if (identical(role, "respuestas")) {
    c("completed", "complete", "completa", "completado", "valid", "aprobado", "approved")
  } else {
    c("completed", "complete", "completa", "completado", "valid", "aprobado", "approved", "efectivo", "efectiva")
  }
  if (bool(row$Completa %||% row$completa) || status %in% complete_values) {
    return("Completa")
  }
  if (bool(row$Parcial %||% row$parcial) || status %in% c("partial", "parcial", "incomplete", "sin completar")) {
    return("Parcial")
  }
  if (bool(row$Rechazo %||% row$rechazo) || status %in% c("rejected", "rechazo", "refusal", "disqualified", "descalificado")) {
    return("Rechazo")
  }
  if (status %in% c("sin respuesta", "no respuesta", "pendiente", "no barrido", "nobarrido", "not responded")) {
    return("Sin respuesta")
  }
  "Sin respuesta"
}

monitoreo_acreditacion_response_priority <- function(row) {
  state <- .monitoreo_acreditacion_state(row)
  switch(state, Completa = 3L, Parcial = 2L, Rechazo = 1L, 0L)
}

monitoreo_acreditacion_deduplicate <- function(rows, profile = list()) {
  if (is.data.frame(rows)) rows <- lapply(seq_len(nrow(rows)), function(i) as.list(rows[i, , drop = FALSE]))
  if (!is.list(rows)) return(list())
  profile <- monitoreo_normalize_profile(profile)
  index <- list()
  for (row in rows) {
    if (!is.list(row)) next
    keys <- monitoreo_acreditacion_case_keys(row, profile, "respuesta")
    key <- if (length(keys)) keys[[1]] else paste0("response_id:", .monitoreo_scalar(row$response_id %||% row$id, ""))
    if (!nzchar(sub("^[^:]+:", "", key))) next
    current <- index[[key]]
    if (is.null(current) ||
        monitoreo_acreditacion_response_priority(row) > monitoreo_acreditacion_response_priority(current)) {
      index[[key]] <- row
    }
  }
  unname(index)
}

monitoreo_acreditacion_is_rejection <- function(row, profile = list(), actor = "") {
  profile <- monitoreo_normalize_profile(profile)
  if (is.null(row) || !is.list(row)) return(FALSE)
  if (!identical(.monitoreo_acreditacion_state(row), "Completa")) return(FALSE)
  actor <- .monitoreo_scalar(actor %||% row$Actor %||% row$actor, "")
  for (rule in profile$rejection_rules %||% list()) {
    if (!isTRUE(rule$enabled)) next
    if (nzchar(rule$actor) && nzchar(actor) && !identical(.monitoreo_text_key(rule$actor), .monitoreo_text_key(actor))) next
    patterns <- .monitoreo_text_key(.monitoreo_chr_vec(rule$question_patterns))
    answers <- .monitoreo_text_key(.monitoreo_chr_vec(rule$rejection_answers))
    if (!length(patterns) || !length(answers)) next
    for (nm in names(row)) {
      clean_question <- .monitoreo_text_key(nm)
      if (!all(vapply(patterns, function(p) grepl(p, clean_question, fixed = TRUE), logical(1)))) next
      clean_answer <- .monitoreo_text_key(gsub("\\s*[|/]\\s*", " ", as.character(row[[nm]] %||% "")))
      if (clean_answer %in% answers) return(TRUE)
    }
  }
  FALSE
}

monitoreo_acreditacion_alerts <- function(barrido = NULL, respuestas = NULL, profile = list()) {
  profile <- monitoreo_normalize_profile(profile)
  if (is.data.frame(barrido)) barrido <- lapply(seq_len(nrow(barrido)), function(i) as.list(barrido[i, , drop = FALSE]))
  if (is.data.frame(respuestas)) respuestas <- lapply(seq_len(nrow(respuestas)), function(i) as.list(respuestas[i, , drop = FALSE]))
  barrido <- barrido %||% list()
  respuestas <- respuestas %||% list()
  alerts <- list()
  add <- function(level, type, detail, key = "", owner = "") {
    alerts[[length(alerts) + 1L]] <<- list(
      level = level,
      type = type,
      key = key,
      owner = owner,
      detail = detail
    )
  }
  barrido_by_key <- list()
  owner_counts <- list()
  for (row in barrido) {
    if (!is.list(row)) next
    keys <- monitoreo_acreditacion_case_keys(row, profile, "universo")
    owner <- .monitoreo_scalar(row$responsable %||% row$Responsable %||% row$Encuestador %||% "Sin responsable", "Sin responsable")
    status <- .monitoreo_text_key(row$status %||% row$Status %||% row$estado %||% row$Estado %||% "")
    key <- if (length(keys)) keys[[1]] else ""
    if (!nzchar(key)) {
      add("Alta", "llave_faltante_barrido", "Fila de barrido sin llave para cruzar.", "", owner)
    } else if (!is.null(barrido_by_key[[key]])) {
      add("Alta", "llave_duplicada_barrido", "La llave aparece mas de una vez en barrido.", key, owner)
    }
    if (nzchar(key)) barrido_by_key[[key]] <- row
    item <- owner_counts[[owner]] %||% list(total = 0L, no_barrido = 0L)
    item$total <- item$total + 1L
    if (status %in% c("no barrido", "nobarrido")) item$no_barrido <- item$no_barrido + 1L
    owner_counts[[owner]] <- item
  }
  response_channels <- list()
  for (row in respuestas) {
    if (!is.list(row)) next
    if (monitoreo_acreditacion_is_rejection(row, profile)) row$Rechazo <- TRUE
    keys <- monitoreo_acreditacion_case_keys(row, profile, "respuesta")
    key <- if (length(keys)) keys[[1]] else ""
    channel <- .monitoreo_text_key(row$Canal %||% row$canal %||% row$channel %||% "")
    if (!nzchar(key)) {
      add("Alta", "llave_faltante_respuesta", "Respuesta de plataforma sin llave.", "", "")
      next
    }
    if (is.null(barrido_by_key[[key]]) && length(barrido)) {
      add("Alta", "respuesta_fuera_de_barrido", "Respuesta de plataforma inexistente en barrido.", key, "")
    }
    if (nzchar(channel)) {
      item <- response_channels[[key]] %||% character(0)
      response_channels[[key]] <- unique(c(item, channel))
    }
  }
  for (key in names(response_channels)) {
    channels <- response_channels[[key]]
    if (all(c("correo", "telefonico") %in% channels)) {
      add("Alta", "doble_canal", "Caso con respuesta en correo y telefonico.", key, "")
    }
  }
  thresholds <- profile$alerts %||% list()
  for (owner in names(owner_counts)) {
    item <- owner_counts[[owner]]
    total <- as.integer(item$total %||% 0L)
    no_sweep <- as.integer(item$no_barrido %||% 0L)
    pct <- if (total > 0L) no_sweep / total else 0
    if (.monitoreo_text_key(owner) %in% c("", "sin responsable", "sin asignar") &&
        total >= as.integer(thresholds$unassigned_cases_min %||% 5L)) {
      add("Media", "casos_sin_responsable", sprintf("%d casos sin responsable asignado.", total), "", owner)
    } else if (no_sweep >= as.integer(thresholds$no_sweep_min_cases %||% 20L) ||
               pct >= as.numeric(thresholds$no_sweep_pct %||% 0.5)) {
      add("Baja", "responsable_no_barridos", sprintf("%d de %d casos siguen No barrido.", no_sweep, total), "", owner)
    }
  }
  alerts
}

monitoreo_estado_cumplimiento <- function(n_efectivo, n_objetivo) {
  n_efectivo <- .monitoreo_int(n_efectivo, 0L)
  n_objetivo <- .monitoreo_int(n_objetivo, NA_integer_)
  if (!is.finite(n_objetivo) || n_objetivo <= 0L) {
    return(list(
      estado = "sin_objetivo",
      brecha_absoluta = NA_integer_,
      brecha_porcentual = NA_real_
    ))
  }
  brecha_abs <- as.integer(n_objetivo - n_efectivo)
  brecha_pct <- brecha_abs / n_objetivo
  estado <- if (n_efectivo >= n_objetivo) {
    "cumple_meta"
  } else if (brecha_pct < 0.05) {
    "brecha_menor_documentada"
  } else {
    "brecha_relevante"
  }
  list(
    estado = estado,
    brecha_absoluta = brecha_abs,
    brecha_porcentual = brecha_pct
  )
}

.monitoreo_actor_id <- function(actor, actor_id = "") {
  raw <- .monitoreo_scalar(actor_id, "")
  if (!nzchar(raw)) raw <- .monitoreo_scalar(actor, "")
  id <- .monitoreo_safe_name(raw)
  if (grepl("admin", id)) return("administrativos")
  if (grepl("docent", id)) return("docentes")
  if (grepl("estudiant", id)) return("estudiantes")
  if (grepl("egresad", id)) return("egresados")
  id
}

.monitoreo_acreditacion_benchmark <- function(actor_id) {
  benchmarks <- list(
    estudiantes = list(rango = "58% a 97%", promedio_historico = 0.713, mediana_historica = 0.69),
    docentes = list(rango = "66% a 100%", promedio_historico = 0.893, mediana_historica = 0.985),
    egresados = list(rango = "62% a 75%", promedio_historico = 0.682, mediana_historica = 0.67),
    administrativos = list(rango = "64% a 100%", promedio_historico = 0.946, mediana_historica = 0.97)
  )
  benchmarks[[actor_id]] %||% NULL
}

.monitoreo_canal_intentos <- function(x = list()) {
  aliases <- list(
    email = c("email", "correo"),
    whatsapp = c("whatsapp", "wa"),
    sms = c("sms"),
    telefono = c("telefono", "phone", "llamada"),
    presencial = c("presencial")
  )
  if (is.null(x) || !is.list(x)) x <- list()
  out <- list(email = 0L, whatsapp = 0L, sms = 0L, telefono = 0L, presencial = 0L)
  for (nm in names(aliases)) {
    val <- NULL
    for (key in aliases[[nm]]) {
      if (!is.null(x[[key]])) {
        val <- x[[key]]
        break
      }
    }
    out[[nm]] <- max(0L, .monitoreo_int(val, 0L))
  }
  out
}

.monitoreo_acreditacion_subcuotas <- function(raw = NULL, cuotas = NULL) {
  if (is.null(raw)) raw <- list()
  if (is.data.frame(raw)) {
    raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  }
  out <- list()
  if (is.list(raw) && length(raw)) {
    if (is.null(names(raw)) || any(!nzchar(names(raw)))) {
      for (item in raw) {
        if (!is.list(item)) next
        celda <- .monitoreo_scalar(item$celda %||% item$id %||% item$name, "")
        if (!nzchar(celda)) next
        cuota <- .monitoreo_int(item$cuota %||% item$meta, 0L)
        logrado <- .monitoreo_int(item$logrado %||% item$n, 0L)
        estado <- .monitoreo_scalar(item$estado, "")
        if (!estado %in% c("completa", "parcial", "vacia")) {
          estado <- if (logrado >= cuota && cuota > 0L) "completa" else if (logrado > 0L) "parcial" else "vacia"
        }
        out[[celda]] <- list(cuota = cuota, logrado = logrado, estado = estado)
      }
    } else {
      for (celda in names(raw)) {
        item <- raw[[celda]]
        if (is.list(item)) {
          cuota <- .monitoreo_int(item$cuota %||% item$meta, 0L)
          logrado <- .monitoreo_int(item$logrado %||% item$n, 0L)
          estado <- .monitoreo_scalar(item$estado, "")
        } else {
          cuota <- .monitoreo_int(item, 0L)
          logrado <- 0L
          estado <- "vacia"
        }
        if (!estado %in% c("completa", "parcial", "vacia")) {
          estado <- if (logrado >= cuota && cuota > 0L) "completa" else if (logrado > 0L) "parcial" else "vacia"
        }
        out[[celda]] <- list(cuota = cuota, logrado = logrado, estado = estado)
      }
    }
  }
  if (!length(out) && is.list(cuotas) && length(cuotas)) {
    for (celda in names(cuotas)) {
      out[[celda]] <- list(
        cuota = max(0L, .monitoreo_int(cuotas[[celda]], 0L)),
        logrado = 0L,
        estado = "vacia"
      )
    }
  }
  out
}

.monitoreo_acreditacion_bolsa <- function(raw = NULL) {
  if (is.null(raw)) return(list())
  if (is.data.frame(raw)) raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  if (!is.list(raw)) return(list())
  out <- list()
  for (i in seq_along(raw)) {
    item <- raw[[i]]
    if (!is.list(item)) next
    tipo <- .monitoreo_scalar(item$tipo, "titular")
    if (!tipo %in% c("titular", "reemplazo")) tipo <- "titular"
    estado <- .monitoreo_scalar(item$estado, "pendiente")
    if (!estado %in% c("pendiente", "activado", "completado", "descartado")) estado <- "pendiente"
    out[[length(out) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("unidad-", i)),
      tipo = tipo,
      prioridad = max(1L, .monitoreo_int(item$prioridad, if (tipo == "titular") 1L else i)),
      estado = estado,
      fecha_activacion = .monitoreo_scalar(item$fecha_activacion, ""),
      motivo_descarte = .monitoreo_scalar(item$motivo_descarte, "")
    )
  }
  out
}

.monitoreo_strategy_phases <- function(raw = NULL, cols = character(0)) {
  if (is.null(raw)) return(list())
  if (is.data.frame(raw)) {
    raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  }
  if (!is.list(raw)) return(list())

  allowed_modalities <- c("email", "whatsapp", "sms", "telefono", "presencial", "mixto")
  allowed_modules <- c(
    "progress",
    "distribution",
    "enumerator_activity",
    "contact_efficiency",
    "non_effective_attempts",
    "delivery",
    "response_quality"
  )
  keep_phase_cols <- function(x) {
    v <- .monitoreo_chr_vec(x)
    if (length(cols)) v <- intersect(v, cols)
    as.list(v)
  }
  keep_phase_col <- function(x) {
    v <- .monitoreo_scalar(x, "")
    if (length(cols) && nzchar(v) && !v %in% cols) return("")
    v
  }
  out <- list()
  for (i in seq_along(raw)) {
    item <- raw[[i]]
    if (!is.list(item)) next

    modality <- .monitoreo_safe_name(item$modality %||% item$modalidad %||% "mixto")
    if (!modality %in% allowed_modalities) modality <- "mixto"

    start_week <- .monitoreo_int(item$start_week %||% item$semana_inicio, NA_integer_)
    end_week <- .monitoreo_int(item$end_week %||% item$semana_fin, start_week)
    if (!is.finite(start_week) || start_week < 1L) start_week <- NA_integer_
    if (!is.finite(end_week) || end_week < 1L) end_week <- NA_integer_
    if (is.finite(start_week) && is.finite(end_week) && end_week < start_week) {
      end_week <- start_week
    }

    phase <- list(
      id = .monitoreo_scalar(item$id, paste0("fase-", i)),
      stratum = .monitoreo_scalar(item$stratum %||% item$estrato %||% item$corte, ""),
      modality = modality,
      start_week = start_week,
      end_week = end_week,
      target_rule = .monitoreo_scalar(item$target_rule %||% item$regla_poblacion %||% item$regla, ""),
      kpi_focus = as.list(.monitoreo_chr_vec(item$kpi_focus %||% item$kpis %||% item$indicadores)),
      kpi_modules = as.list(intersect(
        .monitoreo_chr_vec(item$kpi_modules %||% item$modulos_kpi %||% item$modulos),
        allowed_modules
      )),
      breakdown_vars = keep_phase_cols(item$breakdown_vars %||% item$variables_desglose %||% item$desagregaciones),
      attempts_var = keep_phase_col(item$attempts_var %||% item$variable_intentos),
      outcome_var = keep_phase_col(item$outcome_var %||% item$variable_resultado)
    )

    if (
      !nzchar(phase$stratum) &&
      !nzchar(phase$target_rule) &&
      !length(phase$kpi_focus) &&
      !length(phase$kpi_modules) &&
      !length(phase$breakdown_vars)
    ) next
    out[[length(out) + 1L]] <- phase
  }
  out
}

.monitoreo_operational_model <- function(model = list(), cols = character(0)) {
  if (is.null(model) || !is.list(model)) model <- list()
  keep_col <- function(x) {
    v <- .monitoreo_scalar(x, "")
    if (length(cols) && nzchar(v) && !v %in% cols) return("")
    v
  }
  keep_cols <- function(x) {
    v <- .monitoreo_chr_vec(x)
    if (length(cols)) v <- intersect(v, cols)
    as.list(v)
  }

  normalize_list <- function(raw) {
    if (is.null(raw)) return(list())
    if (is.data.frame(raw)) {
      raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
    }
    if (!is.list(raw)) return(list())
    if (!length(raw)) return(list())
    raw
  }

  raw_strata <- normalize_list(model$strata %||% model$cortes)
  strata <- list()
  for (i in seq_along(raw_strata)) {
    item <- raw_strata[[i]]
    if (!is.list(item)) next
    label <- .monitoreo_scalar(item$label %||% item$nombre, "")
    variable <- keep_col(item$variable %||% item$var)
    value <- .monitoreo_scalar(item$value %||% item$valor, "")
    if (!nzchar(label) && !nzchar(variable) && !nzchar(value)) next
    strata[[length(strata) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("corte-", i)),
      label = label,
      source_id = .monitoreo_scalar(item$source_id %||% item$fuente_id, ""),
      variable = variable,
      value = value,
      notes = .monitoreo_scalar(item$notes %||% item$notas, "")
    )
  }

  raw_targets <- normalize_list(model$targets %||% model$metas)
  targets <- list()
  for (i in seq_along(raw_targets)) {
    item <- raw_targets[[i]]
    if (!is.list(item)) next
    filters <- item$filters %||% item$filtros %||% list()
    if (!is.list(filters)) filters <- list()
    filters <- filters[!vapply(filters, is.null, logical(1))]
    filters <- lapply(filters, function(v) .monitoreo_scalar(v, ""))
    filters <- filters[vapply(filters, nzchar, logical(1))]
    meta <- .monitoreo_int(item$meta %||% item$target %||% item$objetivo %||% item$n, NA_integer_)
    if (!is.finite(meta) || meta < 0L) next
    targets[[length(targets) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("meta-", i)),
      label = .monitoreo_scalar(item$label %||% item$nombre, ""),
      stratum_id = .monitoreo_scalar(item$stratum_id %||% item$corte_id, ""),
      filters = filters,
      meta = as.integer(meta),
      notes = .monitoreo_scalar(item$notes %||% item$notas, "")
    )
  }

  cases_raw <- model$cases %||% model$personas_o_casos %||% list()
  if (is.null(cases_raw) || !is.list(cases_raw)) cases_raw <- list()
  cases <- list(
    enabled = .monitoreo_bool(cases_raw$enabled %||% cases_raw$habilitado, FALSE),
    case_id_var = keep_col(cases_raw$case_id_var %||% cases_raw$variable_id_caso),
    person_label_var = keep_col(cases_raw$person_label_var %||% cases_raw$variable_nombre),
    status_var = keep_col(cases_raw$status_var %||% cases_raw$variable_estado),
    contact_vars = keep_cols(cases_raw$contact_vars %||% cases_raw$variables_contacto),
    sensitive_vars = keep_cols(cases_raw$sensitive_vars %||% cases_raw$variables_sensibles),
    roster_source = .monitoreo_scalar(cases_raw$roster_source %||% cases_raw$origen_padron, "none"),
    notes = .monitoreo_scalar(cases_raw$notes %||% cases_raw$notas, "")
  )
  if (!cases$roster_source %in% c("none", "uploaded", "responses", "external_local")) {
    cases$roster_source <- "none"
  }

  raw_strategies <- normalize_list(model$strategies %||% model$estrategias)
  strategies <- list()
  for (i in seq_along(raw_strategies)) {
    item <- raw_strategies[[i]]
    if (!is.list(item)) next
    label <- .monitoreo_scalar(item$label %||% item$nombre, "")
    objective <- .monitoreo_scalar(item$objective %||% item$objetivo, "")
    if (!nzchar(label) && !nzchar(objective)) next
    status <- .monitoreo_scalar(item$status %||% item$estado, "draft")
    if (!status %in% c("draft", "active", "paused", "closed")) status <- "draft"
    strategies[[length(strategies) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("estrategia-", i)),
      label = label,
      objective = objective,
      owner = .monitoreo_scalar(item$owner %||% item$responsable, ""),
      status = status
    )
  }

  use_to_modality <- function(use) {
    switch(use,
      correo_autoaplicado = "email",
      telefono_asistido = "telefono",
      presencial_qr = "presencial",
      sms = "sms",
      mixto = "mixto",
      enlace_abierto = "mixto",
      "mixto"
    )
  }
  raw_link_collectors <- normalize_list(
    model$link_collectors %||%
      model$colectores_enlaces %||%
      model$collectors %||%
      model$colectores
  )
  link_collectors <- list()
  for (i in seq_along(raw_link_collectors)) {
    item <- raw_link_collectors[[i]]
    if (!is.list(item)) next
    source_id <- .monitoreo_scalar(item$source_id %||% item$fuente_id, "")
    survey_id <- .monitoreo_scalar(item$survey_id %||% item$surveyId, "")
    collector_id <- .monitoreo_scalar(item$collector_id %||% item$collectorId, "")
    if (!nzchar(source_id) && !nzchar(survey_id) && !nzchar(collector_id)) next
    operational_use <- .monitoreo_safe_name(item$operational_use %||% item$uso_operativo)
    if (!operational_use %in% c("correo_autoaplicado", "telefono_asistido", "presencial_qr", "enlace_abierto", "sms", "mixto", "sin_clasificar")) {
      operational_use <- "sin_clasificar"
    }
    modality <- .monitoreo_safe_name(item$modality %||% item$modalidad %||% use_to_modality(operational_use))
    if (!modality %in% c("email", "whatsapp", "sms", "telefono", "presencial", "mixto")) {
      modality <- use_to_modality(operational_use)
    }
    link_collectors[[length(link_collectors) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste(source_id, collector_id, sep = "::")),
      source_id = source_id,
      source_label = .monitoreo_scalar(item$source_label %||% item$fuente_label, ""),
      survey_id = survey_id,
      collector_id = collector_id,
      collector_name = .monitoreo_scalar(item$collector_name %||% item$label %||% item$nombre, ""),
      collector_type = .monitoreo_scalar(item$collector_type %||% item$tipo_colector, ""),
      operational_use = operational_use,
      modality = modality,
      roster_required = .monitoreo_bool(item$roster_required %||% item$requiere_base_casos, identical(operational_use, "telefono_asistido"))
    )
  }

  default_events <- list(
    list(id = "call_no_answer", label = "Llamada no contesta", modality = "telefono", outcome = "no_efectivo", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = FALSE),
    list(id = "call_later", label = "Contactar despues", modality = "telefono", outcome = "pendiente_contacto", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = FALSE),
    list(id = "call_whatsapp_contact", label = "Contactado por WhatsApp", modality = "whatsapp", outcome = "contactado_whatsapp", counts_attempt = TRUE, counts_contact = TRUE, counts_complete = FALSE, stop_contact = FALSE),
    list(id = "phone_wrong_number", label = "Numero incorrecto", modality = "telefono", outcome = "numero_incorrecto", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = TRUE),
    list(id = "phone_out_of_service", label = "No efectivo / fuera de servicio", modality = "telefono", outcome = "fuera_de_servicio", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = TRUE),
    list(id = "call_completed", label = "Encuesta completa por llamada", modality = "telefono", outcome = "completo", counts_attempt = TRUE, counts_contact = TRUE, counts_complete = TRUE, stop_contact = TRUE),
    list(id = "email_sent", label = "Correo enviado", modality = "email", outcome = "enviado", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = FALSE),
    list(id = "email_bounced", label = "Correo rebotado", modality = "email", outcome = "rebote", counts_attempt = TRUE, counts_contact = FALSE, counts_complete = FALSE, stop_contact = FALSE)
  )
  append_default_items <- function(items, defaults) {
    items <- normalize_list(items)
    if (!length(items)) return(defaults)
    seen <- character(0)
    for (item in items) {
      if (!is.list(item)) next
      id <- .monitoreo_scalar(item$id, "")
      if (nzchar(id)) seen <- c(seen, id)
    }
    out <- items
    for (item in defaults) {
      id <- .monitoreo_scalar(item$id, "")
      if (nzchar(id) && !id %in% seen) out[[length(out) + 1L]] <- item
    }
    out
  }
  raw_events <- append_default_items(model$events %||% model$eventos %||% list(), default_events)
  events <- list()
  for (i in seq_along(raw_events)) {
    item <- raw_events[[i]]
    if (!is.list(item)) next
    label <- .monitoreo_scalar(item$label %||% item$nombre, "")
    if (!nzchar(label)) next
    modality <- .monitoreo_safe_name(item$modality %||% item$modalidad %||% "mixto")
    if (!modality %in% c("email", "whatsapp", "sms", "telefono", "presencial", "mixto")) modality <- "mixto"
    events[[length(events) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("evento-", i)),
      label = label,
      modality = modality,
      outcome = .monitoreo_scalar(item$outcome %||% item$resultado, ""),
      counts_attempt = .monitoreo_bool(item$counts_attempt %||% item$cuenta_intento, FALSE),
      counts_contact = .monitoreo_bool(item$counts_contact %||% item$cuenta_contacto, FALSE),
      counts_complete = .monitoreo_bool(item$counts_complete %||% item$cuenta_completo, FALSE),
      stop_contact = .monitoreo_bool(item$stop_contact %||% item$detiene_contacto, FALSE)
    )
  }

  default_rules <- list(
    list(id = "valid_complete", label = "Completa valida", final_state = "complete", priority = 10L, outcome_values = c("completed", "complete", "valid", "approved", "aprobado", "efectivo", "completo")),
    list(id = "operational_pending", label = "Pendiente operativo", final_state = "pending", priority = 15L, outcome_values = c("no_barrido", "contactar_despues", "contactado_whatsapp", "pendiente_contacto")),
    list(id = "refusal", label = "Rechazo", final_state = "refusal", priority = 20L, outcome_values = c("rejected", "rechazo", "refusal")),
    list(id = "non_effective_contact", label = "Contacto no efectivo", final_state = "non_effective", priority = 25L, outcome_values = c("no_contesta", "apagado", "colgo_corto", "no_efectivo", "fuera_de_servicio", "numero_incorrecto", "numero_suspendido", "no_existe_numero")),
    list(id = "not_eligible", label = "No elegible", final_state = "excluded", priority = 30L, outcome_values = c("not_eligible", "no_elegible"))
  )
  raw_rules <- append_default_items(model$state_rules %||% model$reglas_de_estado %||% list(), default_rules)
  state_rules <- list()
  for (i in seq_along(raw_rules)) {
    item <- raw_rules[[i]]
    if (!is.list(item)) next
    label <- .monitoreo_scalar(item$label %||% item$nombre, "")
    final_state <- .monitoreo_scalar(item$final_state %||% item$estado_final, "")
    if (!nzchar(label) && !nzchar(final_state)) next
    state_rules[[length(state_rules) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("regla-", i)),
      label = label,
      final_state = final_state,
      priority = max(1L, .monitoreo_int(item$priority %||% item$prioridad, i)),
      outcome_values = as.list(.monitoreo_chr_vec(item$outcome_values %||% item$valores_resultado)),
      stop_contact = .monitoreo_bool(item$stop_contact %||% item$detiene_contacto, FALSE)
    )
  }

  privacy_raw <- model$privacy %||% model$privacidad %||% list()
  privacy <- list(
    local_sensitive = .monitoreo_bool(privacy_raw$local_sensitive %||% privacy_raw$sensible_local, TRUE),
    export_policy = .monitoreo_scalar(privacy_raw$export_policy %||% privacy_raw$politica_exportacion, "aggregate_or_redacted")
  )
  if (!privacy$export_policy %in% c("aggregate_or_redacted", "aggregate_only", "allow_case_level_local")) {
    privacy$export_policy <- "aggregate_or_redacted"
  }

  list(
    schema_version = "monitoreo_operativo_v1",
    strata = strata,
    targets = targets,
    cases = cases,
    strategies = strategies,
    link_collectors = link_collectors,
    events = events,
    state_rules = state_rules,
    privacy = privacy
  )
}

.monitoreo_acreditacion_componente <- function(comp = list()) {
  if (is.null(comp) || !is.list(comp)) comp <- list()
  actor <- .monitoreo_scalar(comp$actor, "Componente")
  actor_id <- .monitoreo_actor_id(actor, comp$actor_id %||% "")
  resultado <- comp$resultado %||% list()
  meta_raw <- comp$meta %||% list()
  marco_raw <- comp$marco %||% list()
  n_objetivo <- .monitoreo_int(
    comp$n_objetivo %||% meta_raw$n_objetivo %||% comp$meta_efectiva %||%
      resultado$n_objetivo %||% resultado$n_operativo %||% meta_raw$valor,
    NA_integer_
  )
  tecnica <- .monitoreo_scalar(comp$tecnica %||% resultado$tecnica, "")
  variable_control <- .monitoreo_scalar(
    comp$variable_control %||% resultado$variable_control %||% meta_raw$variable_control,
    ""
  )
  tasa_respuesta_esperada <- .monitoreo_num(
    comp$tasa_respuesta_esperada %||% resultado$tasa_respuesta_esperada %||%
      comp$parametros$tasa_respuesta,
    NA_real_
  )

  seguimiento_raw <- comp$seguimiento %||% list()
  n_efectivo <- max(0L, .monitoreo_int(seguimiento_raw$n_efectivo %||% comp$n_efectivo, 0L))
  cumplimiento <- monitoreo_estado_cumplimiento(n_efectivo, n_objetivo)
  benchmark <- .monitoreo_acreditacion_benchmark(actor_id)
  benchmark_comparado <- NULL
  if (!is.null(benchmark) && is.finite(n_objetivo) && n_objetivo > 0L) {
    cobertura_actual <- n_efectivo / n_objetivo
    benchmark_comparado <- c(
      benchmark,
      list(
        cobertura_actual = cobertura_actual,
        desviacion_actual = cobertura_actual - benchmark$promedio_historico
      )
    )
  }
  cumplimiento$benchmark_comparado <- benchmark_comparado

  cuotas <- resultado$sub_cuotas %||% meta_raw$sub_cuotas %||% NULL
  subcuotas <- .monitoreo_acreditacion_subcuotas(
    seguimiento_raw$sub_cuotas_progreso %||% comp$sub_cuotas_progreso,
    cuotas
  )
  intentos <- .monitoreo_canal_intentos(seguimiento_raw$intentos_canal %||% comp$intentos_canal)

  list(
    id = .monitoreo_scalar(comp$id, paste0("cmp-", actor_id)),
    actor = actor,
    actor_id = actor_id,
    tecnica = tecnica,
    variable_control = variable_control,
    habilita_margen = .monitoreo_bool(comp$habilita_margen, identical(tecnica, "prob_conglomerado_multietapico")),
    marco = list(
      universo_bruto = .monitoreo_int(marco_raw$universo_bruto, NA_integer_),
      marco_actualizado = .monitoreo_int(marco_raw$marco_actualizado %||% marco_raw$marco_validado, NA_integer_),
      marco_contactable = .monitoreo_int(marco_raw$marco_contactable, NA_integer_),
      meta_efectiva = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      tasa_respuesta_esperada = tasa_respuesta_esperada
    ),
    meta = list(
      n_objetivo = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      tipo = .monitoreo_scalar(meta_raw$tipo, "objetivo"),
      variable_control = variable_control
    ),
    seguimiento = list(
      n_efectivo = as.integer(n_efectivo),
      fecha_actualizacion = .monitoreo_scalar(seguimiento_raw$fecha_actualizacion, ""),
      notas_campo = .monitoreo_scalar(seguimiento_raw$notas_campo, ""),
      intentos_canal = intentos,
      tasa_contacto_efectiva = .monitoreo_num(seguimiento_raw$tasa_contacto_efectiva, NA_real_),
      cumplimiento = cumplimiento,
      bolsa_operativa = .monitoreo_acreditacion_bolsa(seguimiento_raw$bolsa_operativa %||% comp$bolsa_operativa),
      sub_cuotas_progreso = subcuotas
    )
  )
}

monitoreo_acreditacion_dashboard <- function(acreditacion = list()) {
  comps <- acreditacion$componentes %||% list()
  cards <- list()
  alertas <- list()
  add_alerta <- function(severidad, componente_id, actor, tipo, mensaje) {
    alertas[[length(alertas) + 1L]] <<- list(
      severidad = severidad,
      componente_id = componente_id,
      actor = actor,
      tipo = tipo,
      mensaje = mensaje
    )
  }
  for (comp in comps) {
    seg <- comp$seguimiento %||% list()
    meta <- comp$meta %||% list()
    cum <- seg$cumplimiento %||% monitoreo_estado_cumplimiento(seg$n_efectivo, meta$n_objetivo)
    n_objetivo <- .monitoreo_int(meta$n_objetivo, NA_integer_)
    n_efectivo <- .monitoreo_int(seg$n_efectivo, 0L)
    avance_pct <- if (is.finite(n_objetivo) && n_objetivo > 0L) round(100 * n_efectivo / n_objetivo, 1) else NA_real_
    cards[[length(cards) + 1L]] <- list(
      id = comp$id,
      actor = comp$actor,
      actor_id = comp$actor_id,
      tecnica = comp$tecnica,
      n_efectivo = n_efectivo,
      n_objetivo = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      avance_pct = avance_pct,
      estado = cum$estado,
      brecha_absoluta = cum$brecha_absoluta,
      brecha_porcentual = cum$brecha_porcentual,
      benchmark_comparado = cum$benchmark_comparado,
      ultima_actualizacion = seg$fecha_actualizacion %||% ""
    )
    if (identical(cum$estado, "brecha_relevante")) {
      add_alerta("bloqueante", comp$id, comp$actor, "brecha_relevante",
                 "Brecha relevante: requiere refuerzo o aprobacion metodologica.")
    } else if (identical(cum$estado, "brecha_menor_documentada")) {
      add_alerta("advertencia", comp$id, comp$actor, "brecha_menor",
                 "Brecha menor: documentar justificacion antes del cierre.")
    } else if (identical(cum$estado, "sin_objetivo")) {
      add_alerta("advertencia", comp$id, comp$actor, "sin_objetivo",
                 "Sin meta efectiva configurada.")
    }
    if (n_efectivo > 0L && n_efectivo < 30L) {
      add_alerta("advertencia", comp$id, comp$actor, "minimo_estadistico",
                 "Avance bajo n=30 para analisis estadistico.")
    }
    bench <- cum$benchmark_comparado
    if (!is.null(bench) && is.finite(bench$cobertura_actual) &&
        is.finite(bench$mediana_historica) &&
        (bench$cobertura_actual - bench$mediana_historica) <= -0.15) {
      add_alerta("advertencia", comp$id, comp$actor, "benchmark_bajo",
                 "Cobertura 15pp o mas por debajo de la mediana historica interna.")
    }
    subcuotas <- seg$sub_cuotas_progreso %||% list()
    if (length(subcuotas)) {
      estados <- vapply(subcuotas, function(x) .monitoreo_scalar(x$estado, ""), character(1))
      if (any(estados %in% c("vacia", "parcial"))) {
        add_alerta("advertencia", comp$id, comp$actor, "subcuotas_incompletas",
                   "Hay subcuotas vacias o parciales.")
      }
    }
    bolsa <- seg$bolsa_operativa %||% list()
    if (length(bolsa)) {
      sin_motivo <- vapply(bolsa, function(x) {
        identical(x$tipo, "reemplazo") &&
          x$estado %in% c("activado", "completado") &&
          !nzchar(.monitoreo_scalar(x$motivo_descarte, ""))
      }, logical(1))
      if (any(sin_motivo)) {
        add_alerta("advertencia", comp$id, comp$actor, "reemplazo_sin_motivo",
                   "Hay reemplazos activados sin motivo documentado.")
      }
    }
  }
  bloqueos <- vapply(alertas, function(a) identical(a$severidad, "bloqueante"), logical(1))
  list(
    cards = cards,
    alertas = alertas,
    cierre_habilitado = length(cards) > 0L && !any(bloqueos),
    bloqueos = as.integer(sum(bloqueos))
  )
}

monitoreo_normalize_acreditacion <- function(acreditacion = list()) {
  if (is.null(acreditacion) || !is.list(acreditacion)) acreditacion <- list()
  comps_raw <- acreditacion$componentes %||% list()
  if (is.data.frame(comps_raw)) {
    comps_raw <- lapply(seq_len(nrow(comps_raw)), function(i) as.list(comps_raw[i, , drop = FALSE]))
  }
  comps <- lapply(comps_raw, .monitoreo_acreditacion_componente)
  modo <- .monitoreo_scalar(acreditacion$modo_trabajo, "seguimiento_campo")
  if (!modo %in% c("seguimiento_campo", "cierre_campo")) modo <- "seguimiento_campo"
  estudio_raw <- acreditacion$estudio %||% list()
  out <- list(
    enabled = .monitoreo_bool(acreditacion$enabled, length(comps) > 0L),
    modo_trabajo = modo,
    estudio = list(
      id = .monitoreo_scalar(estudio_raw$id %||% acreditacion$estudio_id, ""),
      titulo = .monitoreo_scalar(estudio_raw$titulo %||% acreditacion$titulo, "Estudio de acreditacion"),
      cliente = .monitoreo_scalar(estudio_raw$cliente %||% estudio_raw$contexto$cliente, ""),
      macro_familia = .monitoreo_scalar(estudio_raw$macro_familia, "acreditacion"),
      creado_desde_calc_muestra = .monitoreo_bool(estudio_raw$creado_desde_calc_muestra, FALSE)
    ),
    componentes = comps,
    plan_refuerzo = .monitoreo_scalar(acreditacion$plan_refuerzo, ""),
    aprobacion_metodologica = .monitoreo_bool(acreditacion$aprobacion_metodologica, FALSE),
    cierre_at = .monitoreo_scalar(acreditacion$cierre_at, "")
  )
  out$dashboard <- monitoreo_acreditacion_dashboard(out)
  out
}

monitoreo_acreditacion_from_calc <- function(estudio) {
  if (is.null(estudio) || !is.list(estudio)) stop("No hay estudio de calculador para importar.", call. = FALSE)
  comps <- estudio$componentes %||% list()
  if (!length(comps)) stop("El estudio del calculador no tiene componentes.", call. = FALSE)
  acreditacion <- list(
    enabled = TRUE,
    modo_trabajo = "seguimiento_campo",
    estudio = list(
      id = .monitoreo_scalar(estudio$id, ""),
      titulo = .monitoreo_scalar(estudio$titulo, "Estudio de acreditacion"),
      cliente = .monitoreo_scalar(estudio$contexto$cliente, ""),
      macro_familia = .monitoreo_scalar(estudio$macro_familia, "acreditacion"),
      creado_desde_calc_muestra = TRUE
    ),
    componentes = comps
  )
  monitoreo_normalize_acreditacion(acreditacion)
}

monitoreo_acreditacion_update_seguimiento <- function(acreditacion, payload = list()) {
  acr <- monitoreo_normalize_acreditacion(acreditacion)
  id <- .monitoreo_scalar(payload$id %||% payload$componente_id, "")
  if (!nzchar(id)) stop("Falta id de componente.", call. = FALSE)
  ids <- vapply(acr$componentes, function(comp) comp$id, character(1))
  idx <- match(id, ids)
  if (is.na(idx)) stop("Componente no existe en el seguimiento.", call. = FALSE)
  comp <- acr$componentes[[idx]]
  seg <- comp$seguimiento %||% list()
  if ("n_efectivo" %in% names(payload)) seg$n_efectivo <- max(0L, .monitoreo_int(payload$n_efectivo, 0L))
  if ("notas_campo" %in% names(payload)) seg$notas_campo <- .monitoreo_scalar(payload$notas_campo, "")
  if ("intentos_canal" %in% names(payload)) {
    current <- seg$intentos_canal %||% list()
    incoming <- payload$intentos_canal %||% list()
    if (is.list(incoming)) {
      for (nm in names(incoming)) current[[nm]] <- incoming[[nm]]
    }
    seg$intentos_canal <- .monitoreo_canal_intentos(current)
  }
  if ("tasa_contacto_efectiva" %in% names(payload)) {
    seg$tasa_contacto_efectiva <- .monitoreo_num(payload$tasa_contacto_efectiva, NA_real_)
  }
  if ("sub_cuotas_progreso" %in% names(payload)) {
    seg$sub_cuotas_progreso <- payload$sub_cuotas_progreso
  }
  if ("bolsa_operativa" %in% names(payload)) {
    seg$bolsa_operativa <- payload$bolsa_operativa
  }
  seg$fecha_actualizacion <- .monitoreo_scalar(payload$fecha_actualizacion, .monitoreo_now_iso())
  comp$seguimiento <- seg
  acr$componentes[[idx]] <- .monitoreo_acreditacion_componente(comp)
  monitoreo_normalize_acreditacion(acr)
}

monitoreo_acreditacion_cerrar <- function(acreditacion, plan_refuerzo = "", aprobar_brechas = FALSE) {
  acr <- monitoreo_normalize_acreditacion(acreditacion)
  dashboard <- acr$dashboard %||% monitoreo_acreditacion_dashboard(acr)
  bloqueado <- !isTRUE(dashboard$cierre_habilitado)
  plan_refuerzo <- .monitoreo_scalar(plan_refuerzo, acr$plan_refuerzo %||% "")
  aprobar_brechas <- .monitoreo_bool(aprobar_brechas, acr$aprobacion_metodologica %||% FALSE)
  if (isTRUE(bloqueado) && !aprobar_brechas && !nzchar(plan_refuerzo)) {
    stop("Hay brechas relevantes sin plan de refuerzo o aprobacion metodologica.", call. = FALSE)
  }
  acr$modo_trabajo <- "cierre_campo"
  acr$plan_refuerzo <- plan_refuerzo
  acr$aprobacion_metodologica <- aprobar_brechas
  acr$cierre_at <- .monitoreo_now_iso()
  monitoreo_normalize_acreditacion(acr)
}

monitoreo_territorial_default_crosswalk <- function() {
  list(
    list(kobo_code = "smp", kobo_label = "San Martin de Porres", ubigeo = "150135", distrito = "SAN MARTIN DE PORRES"),
    list(kobo_code = "sjl", kobo_label = "San Juan de Lurigancho", ubigeo = "150132", distrito = "SAN JUAN DE LURIGANCHO"),
    list(kobo_code = "chorrillos", kobo_label = "Chorrillos", ubigeo = "150108", distrito = "CHORRILLOS"),
    list(kobo_code = "olivos", kobo_label = "Los Olivos", ubigeo = "150117", distrito = "LOS OLIVOS"),
    list(kobo_code = "ate", kobo_label = "Ate", ubigeo = "150103", distrito = "ATE"),
    list(kobo_code = "sjm", kobo_label = "San Juan de Miraflores", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES")
  )
}

.monitoreo_territorial_crosswalk_df <- function(crosswalk = NULL) {
  rows <- crosswalk %||% monitoreo_territorial_default_crosswalk()
  if (is.data.frame(rows)) {
    df <- rows
  } else {
    if (!is.list(rows) || !length(rows)) rows <- monitoreo_territorial_default_crosswalk()
    fields <- unique(unlist(lapply(rows, names), use.names = FALSE))
    fields <- fields[nzchar(fields)]
    df <- if (length(fields)) {
      do.call(rbind, lapply(rows, function(row) {
        row <- row %||% list()
        as.data.frame(as.list(vapply(fields, function(field) {
          .monitoreo_scalar(row[[field]], "")
        }, character(1))), stringsAsFactors = FALSE)
      }))
    } else {
      data.frame()
    }
  }
  if (!nrow(df)) {
    df <- do.call(rbind, lapply(monitoreo_territorial_default_crosswalk(), as.data.frame, stringsAsFactors = FALSE))
  }
  for (col in c("kobo_code", "kobo_label", "ubigeo", "distrito")) {
    if (!col %in% names(df)) df[[col]] <- ""
    df[[col]] <- trimws(as.character(df[[col]]))
  }
  df$kobo_key <- vapply(df$kobo_code, .monitoreo_safe_name, character(1))
  df$distrito_key <- vapply(df$distrito, .monitoreo_safe_name, character(1))
  df <- df[nzchar(df$kobo_key) & nzchar(df$ubigeo), , drop = FALSE]
  df <- df[!duplicated(df$kobo_key), , drop = FALSE]
  rownames(df) <- NULL
  df
}

monitoreo_territorial_default_config <- function(data = NULL) {
  cols <- if (is.data.frame(data)) names(data) else character(0)
  pick <- function(patterns, fallback = "") {
    for (pat in patterns) {
      exact <- cols[tolower(cols) == tolower(pat)]
      if (length(exact)) return(exact[[1]])
      hit <- grep(pat, cols, ignore.case = TRUE, value = TRUE)
      if (length(hit)) return(hit[[1]])
    }
    fallback
  }
  list(
    schema_version = "monitoreo_territorial_v1",
    active_route_phase = "pilot",
    asset_uid = "",
    kobo_version_id = "",
    kobo_asset_name = "",
    source_id = "",
    inspected_at = "",
    snapshot_hash = "",
    district_var = pick(c("^Core/M5_district$", "M5_district", "district"), "Core/M5_district"),
    gps_var = pick(c("^_geolocation$", "gps_inicio", "gps_background", "geolocation"), "_geolocation"),
    consent_var = pick(c("^consent$", "consentimiento", "acepta"), "consent"),
    age_var = pick(c("^Core/E1_age$", "E1_age", "edad", "age"), "Core/E1_age"),
    status_var = pick(c("^_status$", "status", "estado"), "_status"),
    id_var = pick(c("^_uuid$", "^_id$", "submission_id", "uuid"), "_uuid"),
    submitted_by_var = pick(c("^_submitted_by$", "submitted_by", "enumerador", "encuestador"), "_submitted_by"),
    submission_time_var = pick(c("^kobo_timestamp_iso$", "^_submission_time$", "submission_time", "fecha", "end$"), "_submission_time"),
    start_var = pick(c("^start$", "inicio", "start_time"), "start"),
    end_var = pick(c("^end$", "fin", "end_time"), "end"),
    duration_var = pick(c("^total_time$", "duration", "duracion", "tiempo"), ""),
    platform_effective_var = "",
    platform_effective_values = list(),
    valid_statuses = list("submitted_via_web", "submitted_via_kobocollect", "submitted_via_enketo", "submitted"),
    district_crosswalk = monitoreo_territorial_default_crosswalk(),
    geo_thresholds_m = list(cerca = 150, revision = 300),
    min_duration_seconds = 60,
    max_duration_seconds = 7200,
    high_age_review = 95,
    count_review_in_official_progress = FALSE,
    validation_decisions = list(
      approved_response_ids = list(),
      approval_reasons = list(),
      approved_at = list()
    )
  )
}

monitoreo_territorial_normalize_config <- function(config = list(), data = NULL) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_territorial_default_config(data)
  cols <- if (is.data.frame(data)) names(data) else character(0)
  keep_col <- function(value, fallback = "") {
    v <- .monitoreo_scalar(value, fallback)
    if (length(cols) && nzchar(v) && !v %in% cols) return("")
    v
  }
  phase <- .monitoreo_scalar(config$active_route_phase %||% config$phase, defaults$active_route_phase)
  if (!phase %in% c("pilot", "field")) phase <- defaults$active_route_phase
  thresholds <- config$geo_thresholds_m %||% config$umbrales_geo_m %||% defaults$geo_thresholds_m
  if (!is.list(thresholds)) thresholds <- list()
  cerca <- .monitoreo_num(thresholds$cerca %||% thresholds$near %||% thresholds$geo_cerca, defaults$geo_thresholds_m$cerca)
  revision <- .monitoreo_num(thresholds$revision %||% thresholds$review %||% thresholds$geo_revision, defaults$geo_thresholds_m$revision)
  if (!is.finite(cerca) || cerca < 0) cerca <- 150
  if (!is.finite(revision) || revision < cerca) revision <- 300
  cw <- .monitoreo_territorial_crosswalk_df(config$district_crosswalk %||% config$crosswalk %||% defaults$district_crosswalk)
  validation_decisions <- .monitoreo_territorial_normalize_validation_decisions(
    config$validation_decisions %||% config$decisiones_validacion %||% defaults$validation_decisions
  )
  list(
    schema_version = .monitoreo_scalar(config$schema_version, defaults$schema_version),
    active_route_phase = phase,
    asset_uid = .monitoreo_scalar(config$asset_uid %||% config$assetUid, defaults$asset_uid),
    kobo_version_id = .monitoreo_scalar(config$kobo_version_id %||% config$koboVersionId, defaults$kobo_version_id),
    kobo_asset_name = .monitoreo_scalar(config$kobo_asset_name %||% config$koboAssetName, defaults$kobo_asset_name),
    source_id = .monitoreo_scalar(config$source_id %||% config$sourceId, defaults$source_id),
    inspected_at = .monitoreo_scalar(config$inspected_at %||% config$inspectedAt, defaults$inspected_at),
    snapshot_hash = .monitoreo_scalar(config$snapshot_hash %||% config$snapshotHash, defaults$snapshot_hash),
    district_var = keep_col(config$district_var %||% config$distrito_var, defaults$district_var),
    gps_var = keep_col(config$gps_var %||% config$geolocation_var, defaults$gps_var),
    consent_var = keep_col(config$consent_var %||% config$consentimiento_var, defaults$consent_var),
    age_var = keep_col(config$age_var %||% config$edad_var, defaults$age_var),
    status_var = keep_col(config$status_var %||% config$estado_var, defaults$status_var),
    id_var = keep_col(config$id_var, defaults$id_var),
    submitted_by_var = keep_col(config$submitted_by_var %||% config$enumerator_var, defaults$submitted_by_var),
    submission_time_var = keep_col(config$submission_time_var %||% config$date_var, defaults$submission_time_var),
    start_var = keep_col(config$start_var, defaults$start_var),
    end_var = keep_col(config$end_var, defaults$end_var),
    duration_var = keep_col(config$duration_var, defaults$duration_var),
    platform_effective_var = keep_col(config$platform_effective_var %||% config$effective_filter_var, defaults$platform_effective_var),
    platform_effective_values = as.list(head(.monitoreo_chr_vec(config$platform_effective_values %||% config$effective_filter_values %||% defaults$platform_effective_values), 1)),
    valid_statuses = as.list(.monitoreo_chr_vec(config$valid_statuses %||% defaults$valid_statuses)),
    district_crosswalk = unname(lapply(seq_len(nrow(cw)), function(i) as.list(cw[i, intersect(c("kobo_code", "kobo_label", "ubigeo", "distrito"), names(cw)), drop = FALSE]))),
    geo_thresholds_m = list(cerca = as.numeric(cerca), revision = as.numeric(revision)),
    min_duration_seconds = max(0, .monitoreo_num(config$min_duration_seconds, defaults$min_duration_seconds)),
    max_duration_seconds = max(0, .monitoreo_num(config$max_duration_seconds, defaults$max_duration_seconds)),
    high_age_review = max(0, .monitoreo_num(config$high_age_review, defaults$high_age_review)),
    count_review_in_official_progress = .monitoreo_bool(config$count_review_in_official_progress, defaults$count_review_in_official_progress),
    validation_decisions = validation_decisions
  )
}

monitoreo_default_config <- function(data = NULL) {
  cols <- if (is.data.frame(data)) names(data) else character(0)
  pick <- function(patterns) {
    for (pat in patterns) {
      hit <- grep(pat, cols, ignore.case = TRUE, value = TRUE)
      if (length(hit)) return(hit[1])
    }
    ""
  }
  status_var <- pick(c("^response_status$", "validation_status", "estado", "status"))
  list(
    enumerator_var = pick(c("enumerador", "encuestador", "interviewer", "enumerator", "username", "submitted_by")),
    date_var = pick(c("^kobo_timestamp_iso$", "_submission_time", "submission_time", "date_modified", "date_created", "fecha", "end$")),
    start_var = pick(c("^start$", "inicio", "start_time")),
    end_var = pick(c("^end$", "fin", "end_time")),
    duration_var = pick(c("^total_time$", "duration", "duracion", "tiempo")),
    status_var = status_var,
    valid_statuses = if (identical(status_var, "response_status")) c("completed") else c("completed", "complete", "valid", "approved", "aprobado"),
    id_var = pick(c("^_uuid$", "^_id$", "^response_id$", "submission_id", "uuid")),
    contact_var = pick(c("telefono", "phone", "celular", "contact")),
    control_vars = list(),
    critical_vars = list(),
    goals = list(),
    strategy_phases = list(),
    operational_model = .monitoreo_operational_model(list(), cols = cols),
    objetivo_total = NA_integer_,
    min_duration_seconds = 60,
    max_duration_seconds = 7200,
    supervision_n = 20,
    supervision_seed = 20260514,
    monitoreo_profile = monitoreo_normalize_profile(list()),
    acreditacion = monitoreo_normalize_acreditacion(list()),
    territorial = monitoreo_territorial_default_config(data)
  )
}

monitoreo_normalize_config <- function(config = list(), data = NULL) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_default_config(data)
  cols <- if (is.data.frame(data)) names(data) else character(0)
  keep_col <- function(x, default = "") {
    v <- .monitoreo_scalar(x, default)
    if (length(cols) && nzchar(v) && !v %in% cols) return("")
    v
  }
  keep_cols <- function(x) {
    v <- .monitoreo_chr_vec(x)
    if (length(cols)) v <- intersect(v, cols)
    as.list(v)
  }

  goals_raw <- config$goals %||% config$metas %||% list()
  if (is.data.frame(goals_raw)) {
    goals_raw <- lapply(seq_len(nrow(goals_raw)), function(i) as.list(goals_raw[i, , drop = FALSE]))
  }
  goals <- list()
  if (is.list(goals_raw) && length(goals_raw)) {
    for (g in goals_raw) {
      if (!is.list(g)) next
      filters <- g$filters %||% g$filtros %||% list()
      if (!is.list(filters)) filters <- list()
      filters <- filters[!vapply(filters, is.null, logical(1))]
      filters <- lapply(filters, function(v) .monitoreo_scalar(v, ""))
      filters <- filters[vapply(filters, nzchar, logical(1))]
      meta <- .monitoreo_int(g$meta %||% g$objetivo %||% g$n, NA_integer_)
      if (!is.finite(meta) || meta < 0L) next
      meta_pct <- .monitoreo_num(
        g$meta_pct %||% g$meta_percent %||% g$porcentaje_meta %||% g$porcentaje,
        NA_real_
      )
      goal <- list(filters = filters, meta = as.integer(meta))
      if (is.finite(meta_pct) && meta_pct >= 0) {
        goal$meta_pct <- as.numeric(meta_pct)
      }
      goals[[length(goals) + 1L]] <- goal
    }
  }

  objetivo_total <- .monitoreo_int(config$objetivo_total %||% config$target_total, defaults$objetivo_total)
  if (!is.finite(objetivo_total) || objetivo_total < 0L) objetivo_total <- NA_integer_
  strategy_phases <- .monitoreo_strategy_phases(
    config$strategy_phases %||% config$fases_estrategia %||% defaults$strategy_phases,
    cols = cols
  )
  operational_model_raw <- config$operational_model %||% config$modelo_operativo %||% defaults$operational_model
  if (is.null(operational_model_raw) || !is.list(operational_model_raw)) operational_model_raw <- list()
  if ((is.null(operational_model_raw$targets) || !length(operational_model_raw$targets)) &&
      is.null(operational_model_raw$metas) && length(goals)) {
    operational_model_raw$targets <- goals
  }
  operational_model <- .monitoreo_operational_model(
    operational_model_raw,
    cols = cols
  )
  acreditacion <- monitoreo_normalize_acreditacion(config$acreditacion %||% defaults$acreditacion)
  profile <- monitoreo_normalize_profile(
    config$monitoreo_profile %||% config$profile %||% defaults$monitoreo_profile,
    acreditacion = acreditacion
  )
  territorial <- monitoreo_territorial_normalize_config(
    config$territorial %||% config$monitoreo_territorial %||% defaults$territorial,
    data
  )

  list(
    enumerator_var = keep_col(config$enumerator_var %||% config$col_enumerador, defaults$enumerator_var),
    date_var = keep_col(config$date_var %||% config$fecha_var, defaults$date_var),
    start_var = keep_col(config$start_var, defaults$start_var),
    end_var = keep_col(config$end_var, defaults$end_var),
    duration_var = keep_col(config$duration_var %||% config$tiempo_var, defaults$duration_var),
    status_var = keep_col(config$status_var %||% config$estado_var, defaults$status_var),
    valid_statuses = as.list(.monitoreo_chr_vec(config$valid_statuses %||% defaults$valid_statuses)),
    id_var = keep_col(config$id_var, defaults$id_var),
    contact_var = keep_col(config$contact_var, defaults$contact_var),
    control_vars = keep_cols(config$control_vars %||% config$variables_control),
    critical_vars = keep_cols(config$critical_vars %||% config$campos_criticos),
    goals = goals,
    strategy_phases = strategy_phases,
    operational_model = operational_model,
    objetivo_total = objetivo_total,
    min_duration_seconds = max(0, .monitoreo_num(config$min_duration_seconds, defaults$min_duration_seconds)),
    max_duration_seconds = max(0, .monitoreo_num(config$max_duration_seconds, defaults$max_duration_seconds)),
    supervision_n = max(1L, .monitoreo_int(config$supervision_n, defaults$supervision_n)),
    supervision_seed = .monitoreo_int(config$supervision_seed, defaults$supervision_seed),
    monitoreo_profile = profile,
    acreditacion = acreditacion,
    territorial = territorial
  )
}

monitoreo_variables <- function(data) {
  if (is.null(data) || !is.data.frame(data)) return(list())
  labels <- .monitoreo_variable_label_map(data)
  lapply(names(data), function(nm) {
    x <- data[[nm]]
    label <- if (nm %in% names(labels)) .monitoreo_scalar(unname(labels[nm]), "") else ""
    values <- unique(trimws(as.character(x)))
    values <- values[!is.na(values) & nzchar(values)]
    values <- sort(values)
    values <- if (length(values) <= 30L) as.list(values) else list()
    list(
      name = nm,
      label = label,
      tipo = paste(class(x), collapse = "/"),
      n_missing = as.integer(sum(is.na(x) | !nzchar(trimws(as.character(x))))),
      n_unique = as.integer(length(unique(as.character(x)))),
      values = values
    )
  })
}

monitoreo_demo_dataset <- function(seed = 20260514L, n = 96L) {
  set.seed(.monitoreo_int(seed, 20260514L))
  n <- max(24L, .monitoreo_int(n, 96L))
  keep_idx <- function(idx) idx[idx <= n]
  enumeradores <- c("Ana Torres", "Luis Quispe", "Marta Rojas", "Diego Flores", "Rosa Medina")
  distritos <- c("Norte", "Centro", "Sur")
  zonas <- c("Urbano", "Periurbano")
  edades <- c("18-29", "30-44", "45-59", "60+")
  fuentes <- ifelse(seq_len(n) <= ceiling(n * 0.58), "demo_kobo", "demo_sm")
  fecha_base <- as.POSIXct("2026-05-01 08:00:00", tz = "UTC")
  inicio <- fecha_base + sample(0:(7 * 24 * 3600), n, replace = TRUE)
  duracion <- sample(seq(180, 1500, by = 30), n, replace = TRUE)
  duracion[keep_idx(c(4, 18))] <- c(35, 8400)[seq_along(keep_idx(c(4, 18)))]
  fin <- inicio + duracion
  estado <- sample(c("completed", "approved", "rejected", "incomplete"), n, replace = TRUE, prob = c(0.72, 0.12, 0.10, 0.06))
  idx_estado <- keep_idx(c(9, 33, 62))
  estado[idx_estado] <- c("rejected", "incomplete", "rejected")[seq_along(idx_estado)]
  telefono <- sprintf("9%08d", sample.int(90000000L, n, replace = TRUE) + 9999999L)
  telefono[keep_idx(c(6, 27, 71))] <- ""
  consentimiento <- sample(c("si", "no", ""), n, replace = TRUE, prob = c(0.91, 0.05, 0.04))
  consentimiento[keep_idx(c(12, 48))] <- ""
  response_id <- sprintf("demo_%03d", seq_len(n))
  if (n >= 22L) response_id[22] <- response_id[21]
  data.frame(
    response_id = response_id,
    enumerador = sample(enumeradores, n, replace = TRUE),
    distrito = sample(distritos, n, replace = TRUE, prob = c(0.36, 0.30, 0.34)),
    zona = sample(zonas, n, replace = TRUE, prob = c(0.68, 0.32)),
    edad_grupo = sample(edades, n, replace = TRUE),
    estado = estado,
    fecha = format(inicio, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    inicio = format(inicio, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    fin = format(fin, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    duracion = as.integer(duracion),
    telefono = telefono,
    consentimiento = consentimiento,
    comentario = sample(c("", "Revisar direccion", "Contacto pide llamada tarde", "Sin observacion"), n, replace = TRUE),
    .source_id = fuentes,
    .source_kind = ifelse(fuentes == "demo_kobo", "kobo", "surveymonkey"),
    .source_label = ifelse(fuentes == "demo_kobo", "Demo Kobo", "Demo SurveyMonkey"),
    stringsAsFactors = FALSE
  )
}

monitoreo_demo_acreditacion <- function() {
  monitoreo_normalize_acreditacion(list(
    enabled = TRUE,
    modo_trabajo = "seguimiento_campo",
    estudio = list(
      id = "demo-acreditacion",
      titulo = "Acreditacion multi-corte demo",
      cliente = "PUCP",
      macro_familia = "acreditacion",
      creado_desde_calc_muestra = FALSE
    ),
    componentes = list(
      list(
        id = "cmp-admin",
        actor = "Administrativos",
        actor_id = "administrativos",
        tecnica = "intencion_censal",
        marco = list(universo_bruto = 100L, marco_actualizado = 96L, marco_contactable = 92L),
        meta = list(tipo = "cobertura", valor = 80L, variable_control = "condicion_laboral"),
        seguimiento = list(
          n_efectivo = 78L,
          notas_campo = "Pendiente refuerzo con coordinacion de carrera.",
          intentos_canal = list(email = 96L, whatsapp = 44L, telefono = 12L)
        )
      ),
      list(
        id = "cmp-docentes",
        actor = "Docentes",
        actor_id = "docentes",
        tecnica = "no_prob_cuotas",
        marco = list(universo_bruto = 280L, marco_actualizado = 268L, marco_contactable = 260L),
        meta = list(
          tipo = "cuota",
          valor = 150L,
          variable_control = "dedicacion_docente",
          sub_cuotas = list(TC = 50L, TPA = 50L, TPC = 50L)
        ),
        seguimiento = list(
          n_efectivo = 135L,
          intentos_canal = list(email = 260L, whatsapp = 120L, telefono = 32L),
          sub_cuotas_progreso = list(
            TC = list(cuota = 50L, logrado = 48L, estado = "parcial"),
            TPA = list(cuota = 50L, logrado = 50L, estado = "completa"),
            TPC = list(cuota = 50L, logrado = 37L, estado = "parcial")
          )
        )
      ),
      list(
        id = "cmp-estudiantes",
        actor = "Estudiantes",
        actor_id = "estudiantes",
        tecnica = "prob_conglomerado_multietapico",
        marco = list(universo_bruto = 4200L, marco_actualizado = 4100L, marco_contactable = 3900L),
        meta = list(tipo = "objetivo", valor = 900L, variable_control = "nivel_curricular"),
        seguimiento = list(
          n_efectivo = 920L,
          intentos_canal = list(email = 3900L, whatsapp = 1800L, presencial = 22L),
          bolsa_operativa = list(
            list(id = "AULA-101", tipo = "titular", prioridad = 1L, estado = "completado"),
            list(id = "AULA-204", tipo = "reemplazo", prioridad = 2L, estado = "activado")
          )
        )
      ),
      list(
        id = "cmp-egresados",
        actor = "Egresados",
        actor_id = "egresados",
        tecnica = "no_prob_cuotas",
        marco = list(universo_bruto = 520L, marco_actualizado = 480L, marco_contactable = 420L),
        meta = list(tipo = "cuota", valor = 150L, variable_control = "ciclo_egreso"),
        seguimiento = list(
          n_efectivo = 110L,
          notas_campo = "Canal telefonico en refuerzo.",
          intentos_canal = list(email = 420L, whatsapp = 210L, telefono = 170L)
        )
      )
    )
  ))
}

monitoreo_demo_config <- function(data = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- monitoreo_demo_dataset()
  monitoreo_normalize_config(list(
    id_var = "response_id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    start_var = "inicio",
    end_var = "fin",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed", "approved"),
    contact_var = "telefono",
    control_vars = c("distrito", "zona"),
    critical_vars = c("telefono", "consentimiento"),
    objetivo_total = 120L,
    goals = list(
      list(filters = list(distrito = "Norte"), meta = 42L),
      list(filters = list(distrito = "Centro"), meta = 36L),
      list(filters = list(distrito = "Sur"), meta = 42L)
    ),
    strategy_phases = list(
      list(
        id = "fase-egresados-telefono",
        stratum = "Egresados",
        modality = "telefono",
        start_week = 1L,
        end_week = 3L,
        target_rule = "Pendientes contactables con telefono valido",
        kpi_focus = c("contacto efectivo", "conversion despues de contacto", "maximo de intentos"),
        kpi_modules = c("progress", "distribution", "enumerator_activity", "contact_efficiency", "non_effective_attempts"),
        breakdown_vars = c("zona"),
        outcome_var = "estado"
      ),
      list(
        id = "fase-egresados-correo",
        stratum = "Egresados",
        modality = "email",
        start_week = 4L,
        end_week = 4L,
        target_rule = "No respondieron, no rechazaron y tienen correo valido",
        kpi_focus = c("envios", "rebotes", "respuesta posterior al envio"),
        kpi_modules = c("progress", "distribution", "delivery"),
        breakdown_vars = c("distrito")
      )
    ),
    operational_model = list(
      strata = list(
        list(id = "corte-norte", label = "Norte", variable = "distrito", value = "Norte", notes = "Meta territorial demo."),
        list(id = "corte-centro", label = "Centro", variable = "distrito", value = "Centro", notes = "Meta territorial demo."),
        list(id = "corte-sur", label = "Sur", variable = "distrito", value = "Sur", notes = "Meta territorial demo.")
      ),
      cases = list(
        enabled = TRUE,
        case_id_var = "response_id",
        status_var = "estado",
        contact_vars = c("telefono"),
        sensitive_vars = c("telefono"),
        roster_source = "responses",
        notes = "Demo local con identificadores y telefono simulados."
      ),
      strategies = list(
        list(
          id = "estrategia-refuerzo-egresados",
          label = "Refuerzo telefonico y correo",
          objective = "Cerrar brechas por corte territorial sin exponer datos sensibles en reportes.",
          owner = "Coordinacion de campo",
          status = "active"
        )
      ),
      privacy = list(local_sensitive = TRUE, export_policy = "aggregate_or_redacted")
    ),
    min_duration_seconds = 90,
    max_duration_seconds = 5400,
    supervision_n = 12,
    supervision_seed = 20260514L,
    acreditacion = monitoreo_demo_acreditacion()
  ), data)
}

monitoreo_demo_payload <- function(seed = 20260514L, n = 96L) {
  data <- monitoreo_demo_dataset(seed = seed, n = n)
  cfg <- monitoreo_demo_config(data)
  synced_at <- .monitoreo_now_iso()
  sources <- monitoreo_normalize_sources(list(
    list(
      id = "demo_kobo",
      kind = "kobo",
      label = "Demo Kobo",
      enabled = FALSE,
      asset_uid = "demo_asset_uid",
      base_url = kobo_api_default_base_url(),
      created_at = synced_at,
      last_sync_at = synced_at
    ),
    list(
      id = "demo_sm",
      kind = "surveymonkey",
      label = "Demo SurveyMonkey",
      enabled = FALSE,
      survey_id = "demo_survey_id",
      base_url = "https://api.surveymonkey.com/v3",
      created_at = synced_at,
      last_sync_at = synced_at
    )
  ))
  dashboard <- monitoreo_build_dashboard(data, cfg)
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    snapshot = list(
      synced_at = synced_at,
      data = data,
      config = cfg,
      dashboard = dashboard,
      variables = monitoreo_variables(data),
      errors = list()
    )
  )
}

monitoreo_normalize_sources <- function(sources = list()) {
  if (is.null(sources) || !is.list(sources)) return(list())
  if (is.data.frame(sources)) {
    sources <- lapply(seq_len(nrow(sources)), function(i) as.list(sources[i, , drop = FALSE]))
  }
  out <- list()
  for (src in sources) {
    if (!is.list(src)) next
    kind <- .monitoreo_scalar(src$kind, "")
    if (!kind %in% c("kobo", "surveymonkey", "google_sheets")) next
    id <- .monitoreo_scalar(src$id, "")
    if (!nzchar(id)) {
      raw <- if (identical(kind, "kobo")) {
        src$asset_uid %||% src$assetUid
      } else if (identical(kind, "surveymonkey")) {
        src$survey_id %||% src$surveyId
      } else {
        paste(.monitoreo_sheet_binding(src)$spreadsheet_id, .monitoreo_sheet_binding(src)$sheet_name, sep = "_")
      }
      id <- paste(kind, .monitoreo_safe_name(raw), sep = "_")
    }
    role <- .monitoreo_source_role(src, kind)
    integration_mode <- .monitoreo_integration_mode(src, kind)
    sheet_binding <- .monitoreo_sheet_binding(src)
    item <- list(
      id = id,
      kind = kind,
      label = .monitoreo_scalar(src$label, if (identical(kind, "kobo")) "Kobo" else if (identical(kind, "surveymonkey")) "SurveyMonkey" else "Google Sheets"),
      enabled = .monitoreo_bool(src$enabled, TRUE),
      asset_uid = .monitoreo_scalar(src$asset_uid %||% src$assetUid, ""),
      survey_id = .monitoreo_scalar(src$survey_id %||% src$surveyId, ""),
      survey_title = .monitoreo_scalar(src$survey_title %||% src$surveyTitle, ""),
      base_url = .monitoreo_scalar(src$base_url %||% src$baseUrl, if (identical(kind, "kobo")) kobo_api_default_base_url() else if (identical(kind, "surveymonkey")) "https://api.surveymonkey.com/v3" else ""),
      connection_profile_id = .monitoreo_scalar(src$connection_profile_id %||% src$connectionProfileId %||% src$profile_id %||% src$profileId, ""),
      role = role,
      integration_mode = integration_mode,
      sheet_binding = sheet_binding,
      dimensions = .monitoreo_source_dimensions(src),
      created_at = .monitoreo_scalar(src$created_at, .monitoreo_now_iso()),
      last_sync_at = .monitoreo_scalar(src$last_sync_at, "")
    )
    out[[item$id]] <- item
  }
  unname(out)
}

monitoreo_upsert_source <- function(sources, source) {
  current <- monitoreo_normalize_sources(sources)
  incoming <- monitoreo_normalize_sources(list(source))
  if (!length(incoming)) stop("Fuente de monitoreo invalida.", call. = FALSE)
  src <- incoming[[1]]
  ids <- vapply(current, `[[`, character(1), "id")
  idx <- match(src$id, ids)
  if (is.na(idx)) current[[length(current) + 1L]] <- src else current[[idx]] <- src
  current
}

.monitoreo_add_source_columns <- function(data, source) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  variable_labels <- .monitoreo_variable_label_map(data)
  n <- nrow(data)
  values <- c(
    list(
      .source_id = .monitoreo_scalar(source$id, ""),
      .source_kind = .monitoreo_scalar(source$kind, ""),
      .source_label = .monitoreo_scalar(source$label, ""),
      .source_role = .monitoreo_scalar(source$role, ""),
      .integration_mode = .monitoreo_scalar(source$integration_mode, "")
    ),
    .monitoreo_dimension_columns(source$dimensions)
  )
  for (nm in names(values)) {
    data[[nm]] <- if (n > 0L) rep(.monitoreo_scalar(values[[nm]], ""), n) else character(0)
  }
  .monitoreo_restore_variable_labels(data, variable_labels)
}

.monitoreo_bind_rows <- function(dfs) {
  dfs <- Filter(function(x) is.data.frame(x) && nrow(x) > 0L, dfs)
  if (!length(dfs)) return(data.frame())
  variable_labels <- character(0)
  for (df in dfs) {
    labels <- .monitoreo_variable_label_map(df)
    for (nm in names(labels)) {
      if (!(nm %in% names(variable_labels)) && nzchar(labels[[nm]])) {
        variable_labels[nm] <- labels[[nm]]
      }
    }
  }
  cols <- unique(unlist(lapply(dfs, names), use.names = FALSE))
  aligned <- lapply(dfs, function(df) {
    for (nm in setdiff(cols, names(df))) df[[nm]] <- NA
    df[, cols, drop = FALSE]
  })
  out <- do.call(rbind, aligned)
  rownames(out) <- NULL
  out <- as.data.frame(out, stringsAsFactors = FALSE, optional = TRUE)
  .monitoreo_restore_variable_labels(out, variable_labels)
}

.monitoreo_sheets_secret_name <- function() {
  "google_sheets_oauth"
}

.monitoreo_sheets_client_secret_name <- function() {
  "google_sheets_oauth_client"
}

.monitoreo_sheets_state_secret_name <- function() {
  "google_sheets_oauth_state"
}

monitoreo_sheets_oauth_status <- function() {
  raw <- tryCatch(prosecnur_secret_load(.monitoreo_sheets_secret_name()), error = function(e) NA_character_)
  if (is.na(raw)) raw <- ""
  list(
    ok = TRUE,
    provider = "google_sheets",
    label = "Google Sheets",
    has_token = nzchar(raw),
    masked_token = if (nzchar(raw)) .connections_mask_secret(raw) else "",
    persisted = nzchar(raw),
    ephemeral = FALSE
  )
}

.monitoreo_sheets_oauth_payload <- function(required = TRUE) {
  raw <- tryCatch(prosecnur_secret_load(.monitoreo_sheets_secret_name()), error = function(e) NA_character_)
  if (is.na(raw) || !nzchar(raw)) {
    if (isTRUE(required)) stop("Falta autorizacion local de Google Sheets.", call. = FALSE)
    return(NULL)
  }
  parsed <- tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE), error = function(e) NULL)
  if (!is.list(parsed)) parsed <- list(access_token = raw)
  parsed
}

.monitoreo_sheets_oauth_client <- function(required = TRUE) {
  raw <- tryCatch(prosecnur_secret_load(.monitoreo_sheets_client_secret_name()), error = function(e) NA_character_)
  if (is.na(raw) || !nzchar(raw)) {
    if (isTRUE(required)) stop("Falta cliente OAuth local de Google Sheets.", call. = FALSE)
    return(NULL)
  }
  client <- tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE), error = function(e) NULL)
  if (!is.list(client)) {
    if (isTRUE(required)) stop("El cliente OAuth local no es valido.", call. = FALSE)
    return(NULL)
  }
  client
}

.monitoreo_sheets_parse_time <- function(value) {
  value <- .monitoreo_scalar(value, "")
  if (!nzchar(value)) return(as.POSIXct(NA))
  parsed <- suppressWarnings(as.POSIXct(value, tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ"))
  if (is.na(parsed)) parsed <- suppressWarnings(as.POSIXct(value, tz = "UTC"))
  parsed
}

.monitoreo_sheets_token_expired <- function(payload, skew_seconds = 90) {
  if (!is.list(payload)) return(FALSE)
  expires_at <- payload$expires_at %||% payload$expiry %||% payload$expiresAt
  if (!is.null(expires_at)) {
    if (is.numeric(expires_at)) {
      return(isTRUE(as.numeric(Sys.time()) >= (as.numeric(expires_at)[1] - skew_seconds)))
    }
    parsed_at <- .monitoreo_sheets_parse_time(expires_at)
    if (!is.na(parsed_at)) return(isTRUE(Sys.time() >= (parsed_at - skew_seconds)))
  }
  expires_in <- suppressWarnings(as.numeric(payload$expires_in %||% payload$expiresIn %||% NA_real_))
  saved_at <- .monitoreo_sheets_parse_time(payload$saved_at %||% payload$savedAt)
  if (is.finite(expires_in) && !is.na(saved_at)) {
    return(isTRUE(Sys.time() >= (saved_at + expires_in - skew_seconds)))
  }
  FALSE
}

monitoreo_sheets_oauth_save <- function(oauth) {
  if (is.environment(oauth)) {
    payload <- as.list.environment(oauth, all.names = TRUE)
    token <- .monitoreo_scalar(payload$access_token %||% payload$accessToken %||% payload$token, "")
  } else if (is.list(oauth)) {
    payload <- as.list(oauth)
    token <- .monitoreo_scalar(payload$access_token %||% payload$accessToken %||% payload$token, "")
  } else {
    token <- .monitoreo_scalar(oauth, "")
    payload <- list(access_token = token)
  }
  if (!nzchar(token)) stop("Falta access_token OAuth de Google Sheets.", call. = FALSE)
  payload$provider <- NULL
  payload$saved_at <- NULL
  payload <- c(payload, list(provider = "google_sheets", saved_at = .monitoreo_now_iso()))
  prosecnur_secret_save(
    .monitoreo_sheets_secret_name(),
    jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null")
  )
  monitoreo_sheets_oauth_status()
}

.monitoreo_sheets_client_from_config <- function(config) {
  if (!is.list(config)) stop("El cliente OAuth debe ser un JSON valido.", call. = FALSE)
  client <- config$installed %||% config$web %||% config
  client_id <- .monitoreo_scalar(client$client_id, "")
  client_secret <- .monitoreo_scalar(client$client_secret, "")
  auth_uri <- .monitoreo_scalar(client$auth_uri, "https://accounts.google.com/o/oauth2/v2/auth")
  token_uri <- .monitoreo_scalar(client$token_uri, "https://oauth2.googleapis.com/token")
  if (!nzchar(client_id) || !nzchar(client_secret)) {
    stop("El JSON OAuth debe incluir client_id y client_secret.", call. = FALSE)
  }
  list(
    client_id = client_id,
    client_secret = client_secret,
    auth_uri = auth_uri,
    token_uri = token_uri
  )
}

.monitoreo_sheets_is_client_config <- function(config) {
  if (is.environment(config)) config <- as.list.environment(config, all.names = TRUE)
  if (!is.list(config)) return(FALSE)
  client <- config$installed %||% config$web %||% config
  if (is.environment(client)) client <- as.list.environment(client, all.names = TRUE)
  is.list(client) &&
    nzchar(.monitoreo_scalar(client$client_id, "")) &&
    nzchar(.monitoreo_scalar(client$client_secret, ""))
}

.monitoreo_sheets_oauth_scopes <- function() {
  c(
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.metadata.readonly"
  )
}

.monitoreo_random_state <- function() {
  paste(sample(c(letters, LETTERS, 0:9), 40L, replace = TRUE), collapse = "")
}

monitoreo_sheets_oauth_accept <- function(payload, redirect_uri = "") {
  if (is.environment(payload)) payload <- as.list.environment(payload, all.names = TRUE)
  if (is.list(payload) && !is.null(payload$client_config)) {
    return(monitoreo_sheets_oauth_prepare(payload$client_config, payload$redirect_uri %||% redirect_uri %||% ""))
  }
  if (.monitoreo_sheets_is_client_config(payload)) {
    return(monitoreo_sheets_oauth_prepare(payload, redirect_uri %||% ""))
  }
  monitoreo_sheets_oauth_save(payload)
}

monitoreo_sheets_oauth_prepare <- function(client_config, redirect_uri) {
  redirect_uri <- .monitoreo_scalar(redirect_uri, "")
  if (!nzchar(redirect_uri) || !grepl("^https?://", redirect_uri)) {
    stop("Falta redirect_uri local para iniciar OAuth.", call. = FALSE)
  }
  client <- .monitoreo_sheets_client_from_config(client_config)
  state <- .monitoreo_random_state()
  prosecnur_secret_save(
    .monitoreo_sheets_client_secret_name(),
    jsonlite::toJSON(client, auto_unbox = TRUE, null = "null")
  )
  prosecnur_secret_save(
    .monitoreo_sheets_state_secret_name(),
    jsonlite::toJSON(list(state = state, redirect_uri = redirect_uri, saved_at = .monitoreo_now_iso()), auto_unbox = TRUE)
  )
  qs <- utils::URLencode
  auth_url <- paste0(
    client$auth_uri,
    "?client_id=", qs(client$client_id, reserved = TRUE),
    "&redirect_uri=", qs(redirect_uri, reserved = TRUE),
    "&response_type=code",
    "&scope=", qs(paste(.monitoreo_sheets_oauth_scopes(), collapse = " "), reserved = TRUE),
    "&access_type=offline",
    "&prompt=consent",
    "&state=", qs(state, reserved = TRUE)
  )
  list(
    ok = TRUE,
    provider = "google_sheets",
    authorization_required = TRUE,
    auth_url = auth_url,
    redirect_uri = redirect_uri,
    scopes = as.list(.monitoreo_sheets_oauth_scopes()),
    status = monitoreo_sheets_oauth_status()
  )
}

monitoreo_sheets_oauth_exchange <- function(code, state = "", redirect_uri = "", token_response = NULL) {
  code <- .monitoreo_scalar(code, "")
  if (!nzchar(code)) stop("Falta codigo OAuth de Google.", call. = FALSE)
  raw_client <- tryCatch(prosecnur_secret_load(.monitoreo_sheets_client_secret_name()), error = function(e) NA_character_)
  raw_state <- tryCatch(prosecnur_secret_load(.monitoreo_sheets_state_secret_name()), error = function(e) NA_character_)
  if (is.na(raw_client) || !nzchar(raw_client) || is.na(raw_state) || !nzchar(raw_state)) {
    stop("Falta iniciar OAuth con el JSON del cliente.", call. = FALSE)
  }
  client <- jsonlite::fromJSON(raw_client, simplifyVector = FALSE)
  expected <- jsonlite::fromJSON(raw_state, simplifyVector = FALSE)
  expected_state <- .monitoreo_scalar(expected$state, "")
  state <- .monitoreo_scalar(state, "")
  if (nzchar(expected_state) && nzchar(state) && !identical(state, expected_state)) {
    stop("El estado OAuth no coincide. Inicia la autorizacion nuevamente.", call. = FALSE)
  }
  redirect_uri <- .monitoreo_scalar(redirect_uri, "")
  if (!nzchar(redirect_uri)) redirect_uri <- .monitoreo_scalar(expected$redirect_uri, "")
  if (!nzchar(redirect_uri)) stop("Falta redirect_uri para canjear OAuth.", call. = FALSE)

  if (!is.null(token_response)) {
    parsed <- if (is.environment(token_response)) {
      as.list.environment(token_response, all.names = TRUE)
    } else if (is.list(token_response)) {
      as.list(token_response)
    } else {
      stop("token_response debe ser lista o environment.", call. = FALSE)
    }
  } else {
    handle <- curl::new_handle(
      post = TRUE,
      httpheader = c("Accept: application/json", "Content-Type: application/x-www-form-urlencoded")
    )
    curl::handle_setopt(handle, postfields = paste0(
      "code=", utils::URLencode(code, reserved = TRUE),
      "&client_id=", utils::URLencode(client$client_id, reserved = TRUE),
      "&client_secret=", utils::URLencode(client$client_secret, reserved = TRUE),
      "&redirect_uri=", utils::URLencode(redirect_uri, reserved = TRUE),
      "&grant_type=authorization_code"
    ))
    res <- curl::curl_fetch_memory(client$token_uri %||% "https://oauth2.googleapis.com/token", handle = handle)
    text <- rawToChar(res$content)
    parsed <- if (nzchar(text)) tryCatch(jsonlite::fromJSON(text, simplifyVector = FALSE), error = function(e) list(raw = text)) else list()
    if (res$status_code >= 300L) {
      msg <- parsed$error_description %||% parsed$error$message %||% sprintf("Google OAuth respondio HTTP %s.", res$status_code)
      stop(msg, call. = FALSE)
    }
  }
  token_payload <- if (is.environment(parsed)) as.list.environment(parsed, all.names = TRUE) else as.list(parsed)
  token_payload$client_id <- NULL
  token_payload$provider <- NULL
  token_payload$saved_at <- NULL
  monitoreo_sheets_oauth_save(c(token_payload, list(client_id = client$client_id)))
}

.monitoreo_sheets_refresh_access_token <- function(payload = NULL, token_response = NULL) {
  if (is.null(payload)) payload <- .monitoreo_sheets_oauth_payload(required = TRUE)
  if (!is.list(payload)) stop("OAuth de Google Sheets no es valido.", call. = FALSE)
  refresh_token <- .monitoreo_scalar(payload$refresh_token %||% payload$refreshToken, "")
  if (!nzchar(refresh_token)) stop("La autorizacion de Google Sheets no tiene refresh_token. Autoriza nuevamente.", call. = FALSE)
  client <- .monitoreo_sheets_oauth_client(required = TRUE)
  token_uri <- .monitoreo_scalar(client$token_uri, "https://oauth2.googleapis.com/token")
  if (is.null(token_response)) {
    handle <- curl::new_handle(
      post = TRUE,
      httpheader = c("Accept: application/json", "Content-Type: application/x-www-form-urlencoded")
    )
    curl::handle_setopt(handle, postfields = paste0(
      "client_id=", utils::URLencode(.monitoreo_scalar(client$client_id, ""), reserved = TRUE),
      "&client_secret=", utils::URLencode(.monitoreo_scalar(client$client_secret, ""), reserved = TRUE),
      "&refresh_token=", utils::URLencode(refresh_token, reserved = TRUE),
      "&grant_type=refresh_token"
    ))
    res <- curl::curl_fetch_memory(token_uri, handle = handle)
    text <- rawToChar(res$content)
    parsed <- if (nzchar(text)) tryCatch(jsonlite::fromJSON(text, simplifyVector = FALSE), error = function(e) list(raw = text)) else list()
    if (res$status_code >= 300L) {
      msg <- parsed$error_description %||% parsed$error$message %||% sprintf("Google OAuth refresh respondio HTTP %s.", res$status_code)
      stop(msg, call. = FALSE)
    }
  } else {
    parsed <- if (is.environment(token_response)) {
      as.list.environment(token_response, all.names = TRUE)
    } else if (is.list(token_response)) {
      as.list(token_response)
    } else {
      stop("token_response debe ser lista o environment.", call. = FALSE)
    }
  }
  updated <- utils::modifyList(payload, parsed)
  if (!nzchar(.monitoreo_scalar(updated$refresh_token %||% updated$refreshToken, ""))) {
    updated$refresh_token <- refresh_token
  }
  updated$client_id <- client$client_id %||% payload$client_id %||% ""
  updated$provider <- NULL
  updated$saved_at <- NULL
  monitoreo_sheets_oauth_save(updated)
  .monitoreo_sheets_access_token(refresh_if_needed = FALSE)
}

.monitoreo_sheets_access_token <- function(refresh_if_needed = TRUE) {
  payload <- .monitoreo_sheets_oauth_payload(required = TRUE)
  if (isTRUE(refresh_if_needed) &&
      .monitoreo_sheets_token_expired(payload) &&
      nzchar(.monitoreo_scalar(payload$refresh_token %||% payload$refreshToken, ""))) {
    return(.monitoreo_sheets_refresh_access_token(payload))
  }
  token <- .monitoreo_scalar(payload$access_token %||% payload$accessToken %||% payload$token, "")
  if (!nzchar(token)) stop("La credencial de Google Sheets no contiene access_token.", call. = FALSE)
  token
}

.monitoreo_google_api_once <- function(url, method = "GET", body = NULL, token = NULL) {
  token <- token %||% .monitoreo_sheets_access_token()
  handle <- curl::new_handle(
    customrequest = method,
    httpheader = c(
      sprintf("Authorization: Bearer %s", token),
      "Accept: application/json",
      "Content-Type: application/json"
    )
  )
  if (!is.null(body)) {
    curl::handle_setopt(handle, postfields = jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))
  }
  res <- curl::curl_fetch_memory(url, handle = handle)
  text <- rawToChar(res$content)
  parsed <- if (nzchar(text)) tryCatch(jsonlite::fromJSON(text, simplifyVector = FALSE), error = function(e) list(raw = text)) else list()
  list(status_code = res$status_code, parsed = parsed)
}

.monitoreo_google_api <- function(url, method = "GET", body = NULL) {
  first <- .monitoreo_google_api_once(url, method = method, body = body)
  if (identical(as.integer(first$status_code), 401L)) {
    refreshed <- tryCatch(.monitoreo_sheets_refresh_access_token(), error = function(e) NULL)
    if (nzchar(.monitoreo_scalar(refreshed, ""))) {
      first <- .monitoreo_google_api_once(url, method = method, body = body, token = refreshed)
    }
  }
  parsed <- first$parsed
  if (first$status_code >= 300L) {
    msg <- parsed$error$message %||% parsed$error_description %||% sprintf("Google Sheets respondio HTTP %s.", first$status_code)
    stop(msg, call. = FALSE)
  }
  parsed
}

.monitoreo_sheets_api_base <- function(spreadsheet_id) {
  paste0(
    "https://sheets.googleapis.com/v4/spreadsheets/",
    utils::URLencode(.monitoreo_extract_spreadsheet_id(spreadsheet_id), reserved = TRUE)
  )
}

.monitoreo_sheets_quote_sheet <- function(sheet_name) {
  paste0("'", gsub("'", "''", .monitoreo_scalar(sheet_name, "")), "'")
}

.monitoreo_sheets_batch_update <- function(spreadsheet_id, requests) {
  if (!length(requests)) return(list())
  .monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(spreadsheet_id), ":batchUpdate"),
    method = "POST",
    body = list(requests = requests)
  )
}

.monitoreo_sheets_metadata <- function(spreadsheet_id) {
  fields <- "spreadsheetId,properties.title,sheets(properties(sheetId,title),developerMetadata(metadataKey,metadataValue,location))"
  .monitoreo_google_api(paste0(
    .monitoreo_sheets_api_base(spreadsheet_id),
    "?fields=",
    utils::URLencode(fields, reserved = TRUE)
  ))
}

.monitoreo_sheets_controlled_tab_names <- function() {
  c(
    "Prosecnur - Resumen",
    "Prosecnur - Alertas",
    "Prosecnur - Auditoria",
    "Prosecnur - Reporte",
    "Reporte",
    "Avance por actor",
    "Efectivas por fecha",
    "Fuentes por actor"
  )
}

.monitoreo_sheets_owner_key <- function() {
  "prosecnur.owner"
}

.monitoreo_sheets_owner_value <- function() {
  "monitoreo"
}

.monitoreo_sheets_validate_controlled_tabs <- function(tab_names) {
  tab_names <- as.character(tab_names %||% character(0))
  if (!length(tab_names)) stop("No hay pestanas Prosecnur para publicar.", call. = FALSE)
  allowed <- .monitoreo_sheets_controlled_tab_names()
  invalid <- tab_names[!tab_names %in% allowed]
  if (length(invalid)) {
    stop(
      sprintf("La publicacion solo puede escribir pestanas controladas de monitoreo: %s.", paste(invalid, collapse = ", ")),
      call. = FALSE
    )
  }
  invisible(TRUE)
}

.monitoreo_sheets_tab_map <- function(meta) {
  sheets <- meta$sheets %||% list()
  out <- lapply(sheets, function(item) {
    props <- item$properties %||% list()
    list(
      title = .monitoreo_scalar(props$title, ""),
      sheet_id = props$sheetId %||% NA_integer_,
      developer_metadata = item$developerMetadata %||% list()
    )
  })
  names(out) <- vapply(out, function(item) item$title, character(1))
  out
}

.monitoreo_sheets_has_owner_metadata <- function(tab) {
  metadata <- tab$developer_metadata %||% list()
  key <- .monitoreo_sheets_owner_key()
  value <- .monitoreo_sheets_owner_value()
  any(vapply(metadata, function(item) {
    identical(.monitoreo_scalar(item$metadataKey, ""), key) &&
      identical(.monitoreo_scalar(item$metadataValue, ""), value)
  }, logical(1)))
}

.monitoreo_sheets_values_rows <- function(rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  lapply(rows, function(row) {
    cells <- as.character(unlist(row %||% character(0), use.names = FALSE))
    cells[is.na(cells)] <- ""
    as.list(cells)
  })
}

monitoreo_sheets_publish_tabs <- function(spreadsheet_id, tabs) {
  spreadsheet_id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(spreadsheet_id)) stop("Falta spreadsheet_id para publicar.", call. = FALSE)
  tab_names <- names(tabs)
  .monitoreo_sheets_validate_controlled_tabs(tab_names)

  meta <- .monitoreo_sheets_metadata(spreadsheet_id)
  tab_map <- .monitoreo_sheets_tab_map(meta)
  missing_tabs <- setdiff(tab_names, names(tab_map))
  if (length(missing_tabs)) {
    .monitoreo_sheets_batch_update(
      spreadsheet_id,
      lapply(missing_tabs, function(tab_name) {
        list(addSheet = list(properties = list(title = tab_name)))
      })
    )
    meta <- .monitoreo_sheets_metadata(spreadsheet_id)
    tab_map <- .monitoreo_sheets_tab_map(meta)
  }

  metadata_requests <- list()
  for (tab_name in tab_names) {
    tab <- tab_map[[tab_name]]
    if (is.null(tab) || is.na(tab$sheet_id)) {
      stop(sprintf("No se pudo preparar la pestana controlada %s.", tab_name), call. = FALSE)
    }
    if (!.monitoreo_sheets_has_owner_metadata(tab)) {
      metadata_requests[[length(metadata_requests) + 1L]] <- list(
        createDeveloperMetadata = list(
          developerMetadata = list(
            metadataKey = .monitoreo_sheets_owner_key(),
            metadataValue = .monitoreo_sheets_owner_value(),
            visibility = "DOCUMENT",
            location = list(sheetId = tab$sheet_id)
          )
        )
      )
    }
  }
  .monitoreo_sheets_batch_update(spreadsheet_id, metadata_requests)

  written_ranges <- list()
  for (tab_name in tab_names) {
    range <- .monitoreo_sheets_quote_sheet(tab_name)
    encoded_range <- utils::URLencode(range, reserved = TRUE)
    clear_url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values/", encoded_range, ":clear")
    update_url <- paste0(
      .monitoreo_sheets_api_base(spreadsheet_id),
      "/values/",
      encoded_range,
      "?valueInputOption=RAW"
    )
    .monitoreo_google_api(clear_url, method = "POST", body = structure(list(), names = character()))
    .monitoreo_google_api(
      update_url,
      method = "PUT",
      body = list(majorDimension = "ROWS", values = .monitoreo_sheets_values_rows(tabs[[tab_name]]))
    )
    written_ranges[[length(written_ranges) + 1L]] <- list(
      tab = tab_name,
      range = range,
      rows = length(tabs[[tab_name]] %||% list())
    )
  }

  list(
    ok = TRUE,
    spreadsheet_id = spreadsheet_id,
    controlled_tabs = as.list(tab_names),
    written_ranges = written_ranges,
    updated_at = .monitoreo_now_iso(),
    mode = "controlled_write"
  )
}

monitoreo_sheets_list_spreadsheets <- function(limit = 50L) {
  # Drive API list is optional for v1. It is useful when the token has Drive
  # scope; otherwise callers can register by spreadsheet id directly.
  url <- paste0(
    "https://www.googleapis.com/drive/v3/files?",
    "q=", utils::URLencode("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", reserved = TRUE),
    "&fields=files(id,name,modifiedTime,webViewLink)&pageSize=",
    max(1L, min(100L, .monitoreo_int(limit, 50L)))
  )
  payload <- .monitoreo_google_api(url)
  list(ok = TRUE, spreadsheets = payload$files %||% list())
}

monitoreo_sheets_inspect <- function(spreadsheet_id, sheet_name = "", header_row = 1L, range = "") {
  spreadsheet_id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(spreadsheet_id)) stop("Falta spreadsheet_id.", call. = FALSE)
  meta_url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "?fields=spreadsheetId,properties.title,sheets.properties")
  meta <- .monitoreo_google_api(meta_url)
  sheets <- lapply(meta$sheets %||% list(), function(item) {
    props <- item$properties %||% list()
    list(
      sheet_id = props$sheetId %||% NA_integer_,
      title = .monitoreo_scalar(props$title, ""),
      row_count = props$gridProperties$rowCount %||% NA_integer_,
      column_count = props$gridProperties$columnCount %||% NA_integer_
    )
  })
  header <- character(0)
  selected <- .monitoreo_scalar(sheet_name, "")
  if (nzchar(selected)) {
    header_row <- max(1L, .monitoreo_int(header_row, 1L))
    header_range <- if (nzchar(range)) range else sprintf("'%s'!%s:%s", gsub("'", "''", selected), header_row, header_row)
    values_url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values/", utils::URLencode(header_range, reserved = TRUE))
    values <- .monitoreo_google_api(values_url)
    header <- as.character((values$values %||% list(list()))[[1]] %||% character(0))
  }
  list(
    ok = TRUE,
    spreadsheet_id = spreadsheet_id,
    title = .monitoreo_scalar(meta$properties$title, ""),
    sheets = sheets,
    headers = as.list(header)
  )
}

.monitoreo_values_to_dataframe <- function(values, header_row = 1L) {
  if (is.null(values) || !length(values)) return(data.frame())
  rows <- lapply(values, function(row) as.character(row %||% character(0)))
  header_row <- max(1L, .monitoreo_int(header_row, 1L))
  if (length(rows) < header_row) return(data.frame())
  headers <- rows[[header_row]]
  if (!length(headers)) return(data.frame())
  headers <- ifelse(nzchar(trimws(headers)), trimws(headers), paste0("col_", seq_along(headers)))
  headers <- make.unique(headers, sep = "_")
  if (length(rows) <= header_row) {
    return(as.data.frame(setNames(rep(list(character(0)), length(headers)), headers), stringsAsFactors = FALSE))
  }
  data_rows <- rows[(header_row + 1L):length(rows)]
  aligned <- lapply(data_rows, function(row) {
    length(row) <- length(headers)
    row[is.na(row)] <- ""
    row
  })
  out <- as.data.frame(do.call(rbind, aligned), stringsAsFactors = FALSE, optional = TRUE)
  names(out) <- headers
  out
}

monitoreo_sheets_read_source <- function(source) {
  binding <- source$sheet_binding %||% .monitoreo_sheet_binding(source)
  spreadsheet_id <- .monitoreo_scalar(binding$spreadsheet_id, "")
  sheet_name <- .monitoreo_scalar(binding$sheet_name, "")
  if (!nzchar(spreadsheet_id) || !nzchar(sheet_name)) {
    stop("Fuente Google Sheets sin spreadsheet_id o sheet_name.", call. = FALSE)
  }
  range <- .monitoreo_scalar(binding$range, "")
  if (!nzchar(range)) range <- sprintf("'%s'", gsub("'", "''", sheet_name))
  url <- paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values/", utils::URLencode(range, reserved = TRUE))
  payload <- .monitoreo_google_api(url)
  data <- .monitoreo_values_to_dataframe(payload$values %||% list(), binding$header_row %||% 1L)
  binding$last_read_at <- .monitoreo_now_iso()
  binding$snapshot_hash <- monitoreo_snapshot_hash(data)
  attr(data, "sheet_binding") <- binding
  data
}

monitoreo_sync_source <- function(source, since = NULL, progress = NULL) {
  kind <- .monitoreo_scalar(source$kind, "")
  if (identical(kind, "kobo")) {
    profile_id <- .monitoreo_scalar(source$connection_profile_id %||% source$profile_id, "")
    token <- .connections_token_require("kobo", profile_id = profile_id)
    base_url <- .monitoreo_scalar(source$base_url, "")
    if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
    if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
    payload <- kobo_api_fetch_all_asset_data(
      asset_uid = source$asset_uid,
      token = token,
      base_url = base_url,
      progress = progress
    )
    data <- kobo_api_flatten_results(payload$results)
    data <- monitoreo_enrich_kobo_datetime_columns(data)
  } else if (identical(kind, "surveymonkey")) {
    token <- .connections_token_require("surveymonkey")
    details <- sm_api_fetch_survey_details(source$survey_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3")
    source$survey_title <- .monitoreo_scalar(details$title, source$survey_title %||% "")
    payload <- sm_api_fetch_all_responses_bulk(
      survey_id = source$survey_id,
      token = token,
      since = since,
      progress = progress,
      base_url = source$base_url %||% "https://api.surveymonkey.com/v3"
    )
    data <- sm_api_flatten_responses(details, payload$data)
    data <- sm_api_enrich_response_recipients(
      data,
      token = token,
      base_url = source$base_url %||% "https://api.surveymonkey.com/v3",
      include_details = TRUE
    )
  } else if (identical(kind, "google_sheets")) {
    data <- monitoreo_sheets_read_source(source)
  } else {
    stop("Tipo de fuente no soportado.", call. = FALSE)
  }
  sheet_binding <- attr(data, "sheet_binding", exact = TRUE)
  if (identical(kind, "surveymonkey") && nzchar(source$survey_title %||% "")) attr(data, "survey_title") <- source$survey_title
  data <- .monitoreo_add_source_columns(data, source)
  if (is.list(sheet_binding)) attr(data, "sheet_binding") <- sheet_binding
  data
}

monitoreo_sync_sources <- function(sources, config = list(), since = NULL, progress_path = NULL) {
  sources <- Filter(function(s) isTRUE(s$enabled), monitoreo_normalize_sources(sources))
  if (!length(sources)) stop("Configura al menos una fuente activa de monitoreo.", call. = FALSE)
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  dfs <- list()
  errors <- list()
  for (i in seq_along(sources)) {
    src <- sources[[i]]
    report("loading", current = i, total = length(sources),
           percent = round(80 * (i - 1) / max(1, length(sources))),
           message = sprintf("Sincronizando %s...", src$label))
    local_progress <- function(current, total, message) {
      pct <- if (is.finite(total) && total > 0) {
        round(80 * (i - 1) / length(sources) + 80 * (current / total) / length(sources))
      } else {
        round(80 * i / length(sources))
      }
      report("loading", current = current, total = total, percent = pct, message = message)
    }
    df <- tryCatch(monitoreo_sync_source(src, since = since, progress = local_progress), error = function(e) {
      errors[[length(errors) + 1L]] <<- list(source_id = src$id, source_label = src$label, message = conditionMessage(e))
      NULL
    })
    if (!is.null(df)) {
      binding <- attr(df, "sheet_binding", exact = TRUE)
      if (is.list(binding)) sources[[i]]$sheet_binding <- binding
      survey_title <- attr(df, "survey_title", exact = TRUE)
      if (is.character(survey_title) && nzchar(survey_title[[1]] %||% "")) sources[[i]]$survey_title <- survey_title[[1]]
      dfs[[length(dfs) + 1L]] <- df
    }
  }
  if (!length(dfs)) {
    msg <- if (length(errors)) paste(vapply(errors, `[[`, character(1), "message"), collapse = " | ") else "No se obtuvieron datos."
    stop(msg, call. = FALSE)
  }
  data <- .monitoreo_bind_rows(dfs)
  cfg <- monitoreo_normalize_config(config, data)
  report("evaluate", percent = 88, message = "Calculando avance y calidad...")
  dashboard <- monitoreo_build_dashboard(data, cfg)
  list(
    ok = TRUE,
    synced_at = .monitoreo_now_iso(),
    n_rows = as.integer(nrow(data)),
    n_sources = as.integer(length(dfs)),
    errors = errors,
    data = data,
    sources = sources,
    config = cfg,
    dashboard = dashboard,
    variables = monitoreo_variables(data)
  )
}

.monitoreo_parse_time_vec <- function(x) {
  if (is.null(x)) return(as.POSIXct(rep(NA_real_, 0), origin = "1970-01-01", tz = "UTC"))
  if (inherits(x, "POSIXt")) return(as.POSIXct(x, tz = "UTC"))
  if (inherits(x, "Date")) return(as.POSIXct(x, tz = "UTC"))
  ch <- as.character(x)
  out <- as.POSIXct(rep(NA_real_, length(ch)), origin = "1970-01-01", tz = "UTC")
  candidates <- list(
    ch,
    sub("Z$", "+0000", ch),
    sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", ch, perl = TRUE)
  )
  fmts <- c(
    "%Y-%m-%dT%H:%M:%OS%z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%OSZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%OS",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d"
  )
  safe_parse <- function(value, fmt) {
    tryCatch(
      suppressWarnings(as.POSIXct(value, format = fmt, tz = "UTC")),
      error = function(e) as.POSIXct(rep(NA_real_, length(value)), origin = "1970-01-01", tz = "UTC")
    )
  }
  for (fmt in fmts) {
    for (candidate in candidates) {
      idx <- is.na(out) & !is.na(candidate) & nzchar(candidate)
      if (!any(idx)) next
      parsed <- safe_parse(candidate[idx], fmt)
      idx_pos <- which(idx)
      ok <- !is.na(parsed)
      if (any(ok)) out[idx_pos[ok]] <- parsed[ok]
    }
  }
  out
}

.monitoreo_datetime_display_tz <- function(raw) {
  raw <- trimws(as.character(raw %||% ""))
  raw[is.na(raw)] <- ""
  has_zone <- grepl("(Z|[+-][0-9]{2}:?[0-9]{2})$", raw, perl = TRUE)
  ifelse(has_zone, "America/Lima", "UTC")
}

.monitoreo_datetime_has_clock <- function(raw, n) {
  if (is.null(raw)) return(rep(TRUE, n))
  raw <- trimws(as.character(raw %||% ""))
  raw[is.na(raw)] <- ""
  grepl("([T[:space:]][0-9]{1,2}:[0-9]{2})", raw, perl = TRUE)
}

.monitoreo_format_date_label_vec <- function(parsed, raw = NULL) {
  parsed <- as.POSIXct(parsed, origin = "1970-01-01", tz = "UTC")
  out <- rep("", length(parsed))
  ok <- !is.na(parsed)
  if (!any(ok)) return(out)
  months <- c("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
              "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")
  tzs <- if (is.null(raw)) rep("UTC", length(parsed)) else .monitoreo_datetime_display_tz(raw)
  for (tz in unique(tzs[ok])) {
    idx <- ok & tzs == tz
    parts <- as.POSIXlt(parsed[idx], tz = tz)
    out[idx] <- paste(parts$mday, months[pmax(1L, pmin(12L, parts$mon + 1L))])
  }
  out
}

.monitoreo_format_time_label_vec <- function(parsed, raw = NULL) {
  parsed <- as.POSIXct(parsed, origin = "1970-01-01", tz = "UTC")
  out <- rep("", length(parsed))
  ok <- !is.na(parsed) & .monitoreo_datetime_has_clock(raw, length(parsed))
  if (!any(ok)) return(out)
  tzs <- if (is.null(raw)) rep("UTC", length(parsed)) else .monitoreo_datetime_display_tz(raw)
  for (tz in unique(tzs[ok])) {
    idx <- ok & tzs == tz
    out[idx] <- tolower(format(parsed[idx], "%I:%M%p", tz = tz))
  }
  out
}

.monitoreo_date_iso_vec <- function(parsed, raw = NULL) {
  parsed <- as.POSIXct(parsed, origin = "1970-01-01", tz = "UTC")
  out <- rep("", length(parsed))
  ok <- !is.na(parsed)
  if (!any(ok)) return(out)
  tzs <- if (is.null(raw)) rep("UTC", length(parsed)) else .monitoreo_datetime_display_tz(raw)
  for (tz in unique(tzs[ok])) {
    idx <- ok & tzs == tz
    out[idx] <- as.character(as.Date(parsed[idx], tz = tz))
  }
  out
}

.monitoreo_timestamp_iso_vec <- function(parsed) {
  parsed <- as.POSIXct(parsed, origin = "1970-01-01", tz = "UTC")
  out <- rep("", length(parsed))
  ok <- !is.na(parsed)
  out[ok] <- format(parsed[ok], "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  out
}

.monitoreo_format_datetime_label_vec <- function(parsed, raw = NULL) {
  date <- .monitoreo_format_date_label_vec(parsed, raw)
  time <- .monitoreo_format_time_label_vec(parsed, raw)
  out <- trimws(paste(date, time))
  out[!nzchar(out)] <- ""
  out
}

.monitoreo_kobo_timestamp_col <- function(data) {
  if (is.null(data) || !is.data.frame(data) || !length(names(data))) return("")
  priority <- c(
    "_submission_time", "submission_time", "submitted_at", "date_submitted",
    "end", "end_time", "start", "start_time",
    "date_modified", "date_created", "modified_at", "created_at"
  )
  clean_names <- .monitoreo_text_key(names(data))
  clean_priority <- .monitoreo_text_key(priority)
  for (alias in clean_priority) {
    hit <- which(clean_names == alias)
    if (length(hit)) return(names(data)[hit[[1]]])
  }
  for (alias in clean_priority) {
    hit <- which(grepl(alias, clean_names, fixed = TRUE))
    if (length(hit)) return(names(data)[hit[[1]]])
  }
  ""
}

monitoreo_enrich_kobo_datetime_columns <- function(data) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data)
  labels <- .monitoreo_variable_label_map(data)
  col <- .monitoreo_kobo_timestamp_col(data)
  if (!nzchar(col) || !col %in% names(data)) return(data)
  raw <- trimws(as.character(data[[col]]))
  raw[is.na(raw)] <- ""
  parsed <- .monitoreo_parse_time_vec(raw)
  if (!any(!is.na(parsed))) return(data)
  data$kobo_timestamp_iso <- .monitoreo_timestamp_iso_vec(parsed)
  data$kobo_fecha_iso <- .monitoreo_date_iso_vec(parsed, raw)
  data$kobo_fecha <- .monitoreo_format_date_label_vec(parsed, raw)
  data$kobo_hora <- .monitoreo_format_time_label_vec(parsed, raw)
  data$kobo_fecha_hora <- .monitoreo_format_datetime_label_vec(parsed, raw)
  labels <- c(labels, c(
    kobo_timestamp_iso = "Timestamp Kobo normalizado",
    kobo_fecha_iso = "Fecha Kobo ISO",
    kobo_fecha = "Fecha Kobo",
    kobo_hora = "Hora Kobo",
    kobo_fecha_hora = "Fecha y hora Kobo"
  ))
  .monitoreo_restore_variable_labels(data, labels)
}

.monitoreo_duration_seconds <- function(data, cfg) {
  n <- nrow(data)
  if (n == 0L) return(numeric(0))
  dur_var <- cfg$duration_var
  if (nzchar(dur_var) && dur_var %in% names(data)) {
    val <- suppressWarnings(as.numeric(data[[dur_var]]))
    return(val)
  }
  if (nzchar(cfg$start_var) && nzchar(cfg$end_var) &&
      cfg$start_var %in% names(data) && cfg$end_var %in% names(data)) {
    st <- .monitoreo_parse_time_vec(data[[cfg$start_var]])
    en <- .monitoreo_parse_time_vec(data[[cfg$end_var]])
    return(as.numeric(difftime(en, st, units = "secs")))
  }
  rep(NA_real_, n)
}

.monitoreo_valid_mask <- function(data, cfg) {
  if (!nrow(data)) return(logical(0))
  status_var <- cfg$status_var
  if (!nzchar(status_var) || !status_var %in% names(data)) return(rep(TRUE, nrow(data)))
  valid <- tolower(.monitoreo_chr_vec(cfg$valid_statuses))
  if (!length(valid)) return(rep(TRUE, nrow(data)))
  tolower(trimws(as.character(data[[status_var]]))) %in% valid
}

.monitoreo_empty_mask <- function(x) {
  is.na(x) | !nzchar(trimws(as.character(x)))
}

.monitoreo_goal_meta_for_row <- function(row, goals) {
  if (!length(goals)) return(NA_integer_)
  total <- 0L
  matched <- FALSE
  for (g in goals) {
    filters <- g$filters %||% list()
    ok <- TRUE
    for (nm in names(filters)) {
      if (!nm %in% names(row) || !identical(as.character(row[[nm]]), as.character(filters[[nm]]))) {
        ok <- FALSE
        break
      }
    }
    if (ok) {
      total <- total + as.integer(g$meta %||% 0L)
      matched <- TRUE
    }
  }
  if (matched) total else NA_integer_
}

.monitoreo_territorial_rows_df <- function(rows) {
  if (is.null(rows) || !length(rows)) return(data.frame())
  if (is.data.frame(rows)) {
    out <- rows
    rownames(out) <- NULL
    return(out)
  }
  if (exists(".hojas_ruta_rows_df", mode = "function")) {
    out <- tryCatch(.hojas_ruta_rows_df(rows), error = function(e) data.frame())
    if (is.data.frame(out)) return(out)
  }
  rows <- rows[!vapply(rows, is.null, logical(1))]
  if (!length(rows)) return(data.frame())
  fields <- unique(unlist(lapply(rows, names), use.names = FALSE))
  fields <- fields[nzchar(fields)]
  if (!length(fields)) return(data.frame())
  out <- do.call(rbind, lapply(rows, function(row) {
    row <- row %||% list()
    as.data.frame(as.list(vapply(fields, function(field) {
      value <- row[[field]]
      if (is.null(value) || !length(value)) return(NA_character_)
      if (is.data.frame(value) || (is.list(value) && !is.atomic(value))) {
        return(as.character(jsonlite::toJSON(value, dataframe = "rows", auto_unbox = TRUE, null = "null", na = "null")))
      }
      .monitoreo_scalar(value, NA_character_)
    }, character(1))), stringsAsFactors = FALSE)
  }))
  rownames(out) <- NULL
  out
}

.monitoreo_territorial_df_rows <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  unname(lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    lapply(row, function(v) {
      if (length(v) == 0L) return(NA)
      v <- v[[1]]
      if (is.factor(v)) as.character(v) else v
    })
  }))
}

.monitoreo_territorial_block_id_variants <- function(id) {
  id <- trimws(as.character(id %||% ""))
  id <- id[!is.na(id) & nzchar(id)]
  if (!length(id)) return(character(0))
  variants <- unique(c(id, sub("0$", "", id, perl = TRUE)))
  variants[!is.na(variants) & nzchar(variants)]
}

.monitoreo_territorial_feature_id_col <- function(features) {
  intersect(c("IDMANZANA", "id_manzana_norm", "id_manzana", "ID_MANZANA", "IDMZNAR", "cartografia_id"), names(features))[1]
}

.monitoreo_territorial_resolve_blocks <- function(blocks, features = NULL) {
  blocks <- .monitoreo_territorial_rows_df(blocks)
  if (!nrow(blocks)) return(blocks)
  for (col in c("id_manzana", "ubigeo", "zona", "manzana", "distrito", "entrevistas", "tipo_manzana")) {
    if (!col %in% names(blocks)) blocks[[col]] <- ""
  }
  blocks$resolved_id_manzana <- ""
  blocks$match_method <- "geometry_unresolved"
  blocks$geometry_unresolved <- TRUE
  if (is.null(features) || !is.data.frame(features) || !nrow(features)) return(blocks)
  id_col <- .monitoreo_territorial_feature_id_col(features)
  if (is.na(id_col) || !nzchar(id_col)) return(blocks)
  feature_ids <- trimws(as.character(features[[id_col]]))
  feature_norm <- sub("0$", "", feature_ids, perl = TRUE)
  feature_zona <- trimws(as.character(features$CODZONA %||% features$zona %||% features$ZONA %||% ""))
  feature_manzana <- trimws(as.character(features$CODMZNA %||% features$manzana %||% features$MANZANA %||% ""))
  feature_ubigeo <- trimws(as.character(features$UBIGEO %||% features$ubigeo %||% ""))
  for (i in seq_len(nrow(blocks))) {
    original_id <- trimws(as.character(blocks$id_manzana[[i]] %||% ""))
    normalized_id <- sub("0$", "", original_id, perl = TRUE)
    idx <- match(original_id, feature_ids, nomatch = 0L)
    method <- "id_manzana_exact"
    if (is.na(idx) || !is.finite(idx) || idx <= 0L) {
      idx <- match(normalized_id, feature_ids, nomatch = 0L)
      if (is.na(idx) || !is.finite(idx) || idx <= 0L) {
        idx <- match(normalized_id, feature_norm, nomatch = 0L)
      }
      method <- "id_manzana_drop_operational_zero"
    }
    if (is.na(idx) || !is.finite(idx) || idx <= 0L) {
      key <- paste(trimws(as.character(blocks$ubigeo[[i]])), trimws(as.character(blocks$zona[[i]])), trimws(as.character(blocks$manzana[[i]])), sep = "\r")
      feature_key <- paste(feature_ubigeo, feature_zona, feature_manzana, sep = "\r")
      idx <- match(key, feature_key, nomatch = 0L)
      method <- "ubigeo_zona_manzana"
    }
    if (!is.na(idx) && is.finite(idx) && idx > 0L) {
      blocks$resolved_id_manzana[[i]] <- feature_ids[[idx]]
      blocks$match_method[[i]] <- method
      blocks$geometry_unresolved[[i]] <- FALSE
    }
  }
  blocks
}

.monitoreo_territorial_parse_gps_cell <- function(value) {
  if (is.null(value) || !length(value)) return(c(lat = NA_real_, lon = NA_real_))
  if (is.list(value) && !is.data.frame(value)) value <- unlist(value, use.names = FALSE)
  if (is.numeric(value) && length(value) >= 2L) {
    lat <- suppressWarnings(as.numeric(value[[1]]))
    lon <- suppressWarnings(as.numeric(value[[2]]))
    if (is.finite(lat) && is.finite(lon)) return(c(lat = lat, lon = lon))
  }
  ch <- trimws(as.character(value[[1]] %||% ""))
  if (!nzchar(ch) || is.na(ch)) return(c(lat = NA_real_, lon = NA_real_))
  if (grepl("^\\[|^\\{", ch)) {
    parsed <- tryCatch(jsonlite::fromJSON(ch, simplifyVector = TRUE), error = function(e) NULL)
    if (!is.null(parsed)) {
      vals <- suppressWarnings(as.numeric(unlist(parsed, use.names = FALSE)))
      vals <- vals[is.finite(vals)]
      if (length(vals) >= 2L) return(c(lat = vals[[1]], lon = vals[[2]]))
    }
  }
  nums <- regmatches(ch, gregexpr("-?[0-9]+(?:[.][0-9]+)?", ch, perl = TRUE))[[1]]
  vals <- suppressWarnings(as.numeric(nums))
  vals <- vals[is.finite(vals)]
  if (length(vals) < 2L) return(c(lat = NA_real_, lon = NA_real_))
  lat <- vals[[1]]
  lon <- vals[[2]]
  if (abs(lat) > 90 && abs(lon) <= 90) {
    tmp <- lat
    lat <- lon
    lon <- tmp
  }
  c(lat = lat, lon = lon)
}

.monitoreo_territorial_gps_df <- function(data, gps_var) {
  n <- nrow(data)
  if (!n || !nzchar(gps_var) || !gps_var %in% names(data)) {
    return(data.frame(lat = rep(NA_real_, n), lon = rep(NA_real_, n)))
  }
  vals <- lapply(data[[gps_var]], .monitoreo_territorial_parse_gps_cell)
  data.frame(
    lat = vapply(vals, `[[`, numeric(1), "lat"),
    lon = vapply(vals, `[[`, numeric(1), "lon")
  )
}

.monitoreo_territorial_source_value <- function(data, col, default = NA_character_) {
  if (!nrow(data)) return(character(0))
  if (nzchar(col) && col %in% names(data)) return(as.character(data[[col]]))
  rep(default, nrow(data))
}

.monitoreo_territorial_source_validity <- function(data, tcfg, kobo_schema = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  n <- nrow(data)
  field <- .monitoreo_scalar(tcfg$platform_effective_var, "")
  values <- .monitoreo_chr_vec(tcfg$platform_effective_values)
  field_present <- nzchar(field) && field %in% names(data)
  schema_fields <- kobo_schema$survey_fields %||% list()
  schema_field <- NULL
  if (nzchar(field) && length(schema_fields)) {
    for (item in schema_fields) {
      if (!is.list(item)) next
      if (identical(.monitoreo_scalar(item$xpath, ""), field) || identical(.monitoreo_scalar(item$name, ""), field)) {
        schema_field <- item
        break
      }
    }
  }
  field_label <- .monitoreo_scalar(schema_field$label %||% field, field)
  list_name <- .monitoreo_scalar(schema_field$list_name, "")
  schema_options <- if (nzchar(list_name)) kobo_schema$choices_by_list[[list_name]] %||% list() else list()
  raw <- if (field_present) as.character(data[[field]]) else rep(NA_character_, n)
  raw_trim <- trimws(raw)
  missing <- is.na(raw_trim) | !nzchar(raw_trim)
  normalized_raw <- vapply(raw_trim, .monitoreo_safe_name, character(1))
  normalized_values <- unique(vapply(values, .monitoreo_safe_name, character(1)))
  normalized_values <- normalized_values[nzchar(normalized_values)]
  configured <- field_present && length(normalized_values) > 0L
  options <- list()
  if (length(schema_options)) {
    counts <- stats::setNames(rep(0L, length(schema_options)), vapply(schema_options, function(x) .monitoreo_safe_name(x$name), character(1)))
    if (field_present && n) {
      tab <- table(normalized_raw[!missing])
      for (key in intersect(names(counts), names(tab))) counts[[key]] <- as.integer(tab[[key]])
    }
    options <- unname(lapply(schema_options, function(option) {
      key <- .monitoreo_safe_name(option$name)
      count_value <- if (nzchar(key) && key %in% names(counts)) counts[[key]] else 0L
      list(
        value = .monitoreo_scalar(option$name, ""),
        label = .monitoreo_scalar(option$label, .monitoreo_scalar(option$name, "")),
        count = as.integer(count_value)
      )
    }))
  } else if (field_present && n) {
    option_values <- raw_trim[!missing]
    option_keys <- normalized_raw[!missing]
    if (length(option_values)) {
      first_label <- stats::setNames(option_values, option_keys)
      counts <- sort(table(option_keys), decreasing = TRUE)
      options <- unname(lapply(names(counts), function(key) {
        list(
          value = .monitoreo_scalar(first_label[[key]], key),
          label = .monitoreo_scalar(first_label[[key]], key),
          count = as.integer(counts[[key]])
        )
      }))
    }
  }
  effective <- if (configured) !missing & normalized_raw %in% normalized_values else rep(FALSE, n)
  list(
    field = field,
    field_label = field_label,
    values = as.list(values),
    effective_count = if (configured) as.integer(sum(effective, na.rm = TRUE)) else NA_integer_,
    non_effective_count = if (configured) as.integer(sum(!missing & !effective, na.rm = TRUE)) else NA_integer_,
    missing_count = if (configured) as.integer(sum(missing, na.rm = TRUE)) else NA_integer_,
    total_responses = as.integer(n),
    options = options
  )
}

.monitoreo_territorial_named_chr <- function(value) {
  if (is.null(value) || !is.list(value) || !length(value)) return(list())
  nms <- names(value)
  if (is.null(nms)) return(list())
  out <- list()
  for (nm in nms) {
    key <- trimws(as.character(nm %||% ""))
    if (!nzchar(key)) next
    out[[key]] <- .monitoreo_scalar(value[[nm]], "")
  }
  out
}

.monitoreo_territorial_normalize_validation_decisions <- function(value = list()) {
  if (is.null(value) || !is.list(value)) value <- list()
  approved <- unique(.monitoreo_chr_vec(
    value$approved_response_ids %||%
      value$approved_ids %||%
      value$aprobadas %||%
      value$aprobadas_response_ids
  ))
  approved <- approved[!is.na(approved) & nzchar(trimws(approved))]
  reasons <- .monitoreo_territorial_named_chr(value$approval_reasons %||% value$reasons %||% list())
  approved_at <- .monitoreo_territorial_named_chr(value$approved_at %||% value$decided_at %||% list())
  reasons <- reasons[intersect(names(reasons), approved)]
  approved_at <- approved_at[intersect(names(approved_at), approved)]
  list(
    approved_response_ids = as.list(approved),
    approval_reasons = reasons,
    approved_at = approved_at
  )
}

.monitoreo_territorial_validation_decision_ids <- function(tcfg) {
  decisions <- .monitoreo_territorial_normalize_validation_decisions(tcfg$validation_decisions %||% list())
  unique(.monitoreo_chr_vec(decisions$approved_response_ids))
}

.monitoreo_territorial_effective_mask <- function(data, tcfg, consent_yes) {
  n <- if (is.data.frame(data)) nrow(data) else length(consent_yes)
  if (!n) return(logical(0))
  consent_yes <- consent_yes %in% TRUE
  if (length(consent_yes) != n) consent_yes <- rep(FALSE, n)
  field <- .monitoreo_scalar(tcfg$platform_effective_var, "")
  values <- .monitoreo_chr_vec(tcfg$platform_effective_values)
  normalized_values <- unique(vapply(values, .monitoreo_safe_name, character(1)))
  normalized_values <- normalized_values[nzchar(normalized_values)]
  if (nzchar(field) && field %in% names(data) && length(normalized_values)) {
    raw <- trimws(as.character(data[[field]]))
    raw[is.na(raw)] <- ""
    return(vapply(raw, .monitoreo_safe_name, character(1)) %in% normalized_values)
  }
  consent_yes
}

.monitoreo_territorial_observation_reasons <- function(geo_estado, duration_status) {
  n <- length(geo_estado)
  out <- vector("list", n)
  for (i in seq_len(n)) {
    reasons <- character(0)
    state <- .monitoreo_scalar(geo_estado[[i]], "")
    if (identical(state, "geo_sin_gps")) reasons <- c(reasons, "gps_sin_cruce")
    if (identical(state, "geo_revision")) reasons <- c(reasons, "gps_revision")
    if (identical(state, "geo_no_defendible")) reasons <- c(reasons, "gps_lejos")
    time_state <- .monitoreo_scalar(duration_status[[i]], "")
    if (identical(time_state, "muy_corta")) reasons <- c(reasons, "duracion_muy_corta")
    if (identical(time_state, "corta")) reasons <- c(reasons, "duracion_corta")
    out[[i]] <- unique(reasons)
  }
  out
}

.monitoreo_territorial_duration_source <- function(data, tcfg) {
  dur_var <- .monitoreo_scalar(tcfg$duration_var, "")
  start_var <- .monitoreo_scalar(tcfg$start_var, "")
  end_var <- .monitoreo_scalar(tcfg$end_var, "")
  if (is.data.frame(data) && nzchar(dur_var) && dur_var %in% names(data)) {
    return(list(type = "duration_field", label = dur_var))
  }
  if (is.data.frame(data) && nzchar(start_var) && nzchar(end_var) && start_var %in% names(data) && end_var %in% names(data)) {
    return(list(type = "start_end", label = paste(start_var, end_var, sep = " -> ")))
  }
  list(type = "missing", label = "")
}

.monitoreo_territorial_duration_status <- function(duration, tcfg) {
  out <- rep("sin_dato", length(duration))
  ok <- is.finite(duration)
  min_duration <- .monitoreo_num(tcfg$min_duration_seconds, 60)
  max_duration <- .monitoreo_num(tcfg$max_duration_seconds, 7200)
  if (!is.finite(min_duration) || min_duration < 0) min_duration <- 60
  if (!is.finite(max_duration) || max_duration <= 0) max_duration <- 7200
  short_duration <- max(300, min_duration * 5)
  out[ok] <- "esperada"
  out[ok & duration < short_duration] <- "corta"
  out[ok & duration < min_duration] <- "muy_corta"
  out[ok & duration > max_duration] <- "larga"
  out[ok & duration > max(max_duration * 3, 12 * 3600)] <- "extrema"
  out
}

.monitoreo_territorial_advance_progress <- function(district_goals, blocks, audit, target_total) {
  advance_valid <- audit$advance_valid %in% TRUE
  observed_pending <- audit$observation_status %in% "en_observacion"
  approved <- audit$observation_status %in% "aprobada"

  district_progress <- lapply(seq_len(nrow(district_goals)), function(i) {
    u <- as.character(district_goals$ubigeo[[i]])
    rows <- audit[audit$ubigeo == u, , drop = FALSE]
    meta <- suppressWarnings(as.integer(district_goals$meta[[i]]))
    valids <- sum(rows$advance_valid %in% TRUE, na.rm = TRUE)
    list(
      ubigeo = u,
      distrito = as.character(district_goals$distrito[[i]]),
      meta = if (is.finite(meta)) meta else NA_integer_,
      total = as.integer(nrow(rows)),
      validas = as.integer(valids),
      revision = as.integer(sum(rows$observation_status %in% "en_observacion", na.rm = TRUE)),
      no_defendibles = as.integer(sum(!(rows$advance_valid %in% TRUE), na.rm = TRUE)),
      avance_pct = if (is.finite(meta) && meta > 0) round(100 * valids / meta, 1) else NA_real_,
      brecha = if (is.finite(meta)) as.integer(max(0, meta - valids)) else NA_integer_
    )
  })

  date_values <- audit$advance_date %||% rep("sin_fecha", nrow(audit))
  daily_rows <- split(audit, date_values)
  daily <- unname(lapply(names(daily_rows), function(day) {
    rows <- daily_rows[[day]]
    list(
      date = day,
      total = as.integer(nrow(rows)),
      validas = as.integer(sum(rows$advance_valid %in% TRUE, na.rm = TRUE)),
      revision = as.integer(sum(rows$observation_status %in% "en_observacion", na.rm = TRUE))
    )
  }))

  list(
    total_respuestas = as.integer(nrow(audit)),
    validas = as.integer(sum(advance_valid, na.rm = TRUE)),
    observacion = as.integer(sum(observed_pending, na.rm = TRUE)),
    observacion_aprobada = as.integer(sum(approved, na.rm = TRUE)),
    no_validas = as.integer(sum(!advance_valid, na.rm = TRUE)),
    meta = if (is.finite(target_total)) as.integer(target_total) else NA_integer_,
    avance_pct = if (is.finite(target_total) && target_total > 0) round(100 * sum(advance_valid, na.rm = TRUE) / target_total, 1) else NA_real_,
    brecha = if (is.finite(target_total)) as.integer(max(0, target_total - sum(advance_valid, na.rm = TRUE))) else NA_integer_,
    district_progress = district_progress,
    block_progress = .monitoreo_territorial_block_progress(blocks, audit, status_col = "advance_status"),
    daily = daily
  )
}

.monitoreo_territorial_block_goal_df <- function(context, include_replacements = FALSE) {
  blocks <- .monitoreo_territorial_rows_df(context$blocks %||% list())
  replacements <- .monitoreo_territorial_rows_df(context$replacement_blocks %||% list())
  if (nrow(blocks)) blocks$tipo_manzana <- if ("tipo_manzana" %in% names(blocks)) as.character(blocks$tipo_manzana) else "titular"
  if (nrow(replacements)) replacements$tipo_manzana <- if ("tipo_manzana" %in% names(replacements)) as.character(replacements$tipo_manzana) else "reemplazo"
  out <- if (isTRUE(include_replacements) && nrow(blocks) && nrow(replacements)) {
    .monitoreo_territorial_rows_df(c(.monitoreo_territorial_df_rows(blocks), .monitoreo_territorial_df_rows(replacements)))
  } else if (nrow(blocks)) {
    blocks
  } else if (isTRUE(include_replacements)) {
    replacements
  } else {
    blocks
  }
  if (!nrow(out)) return(out)
  for (col in c(
    "id_manzana", "ubigeo", "distrito", "zona", "manzana", "entrevistas", "tipo_manzana",
    "departamento", "provincia", "viviendas", "poblacion", "territorio_muestral",
    "metodo", "orden_seleccion", "hoja_num", "rango_inicio", "rango_fin",
    "medida_tamano", "lat", "lon", "replacement_policy", "replacement_order",
    "replacement_total", "titular_id_manzana", "titular_orden_seleccion",
    "titular_ubigeo", "titular_zona", "titular_hoja_num", "titular_rango_inicio",
    "titular_rango_fin", "replacement_label", "replacement_fallback", "esquina_codigo",
    "esquina_inicio", "esquina_coordenada", "sentido_recorrido", "vivienda_inicio",
    "domicilio_inicio", "constante_salto", "constante_salto_unidad",
    "constante_salto_modo", "modo_seleccion_vivienda", "nse_codigo", "nse_nivel"
  )) {
    if (!col %in% names(out)) out[[col]] <- ""
  }
  out$entrevistas <- suppressWarnings(as.integer(out$entrevistas))
  out$entrevistas[is.na(out$entrevistas) | out$entrevistas < 1L] <- 1L
  out
}

.monitoreo_territorial_packaged_block_path <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  if (exists(".hojas_ruta_cartografia_profile_for_ubigeo", mode = "function") &&
      exists(".hojas_ruta_block_map_packaged_file", mode = "function")) {
    profile <- tryCatch(.hojas_ruta_cartografia_profile_for_ubigeo(ubigeo), error = function(e) NULL)
    if (!is.null(profile)) {
      path <- tryCatch(.hojas_ruta_block_map_packaged_file(profile, ubigeo), error = function(e) "")
      if (nzchar(path) && file.exists(path)) return(path)
    }
  }
  roots <- unique(c(
    file.path(getwd(), "api", "inst", "hojas_ruta", "cartografia", "manzanas_inei2017_lima_callao"),
    file.path(getwd(), "inst", "hojas_ruta", "cartografia", "manzanas_inei2017_lima_callao"),
    if (exists(".app_api_dir", mode = "function")) file.path(.app_api_dir(), "inst", "hojas_ruta", "cartografia", "manzanas_inei2017_lima_callao") else ""
  ))
  for (root in roots[nzchar(roots)]) {
    for (candidate in c(file.path(root, paste0(ubigeo, ".geojson.gz")), file.path(root, paste0(ubigeo, ".geojson")))) {
      if (file.exists(candidate)) return(candidate)
    }
  }
  ""
}

.monitoreo_territorial_read_block_sf <- function(ubigeo) {
  if (!requireNamespace("sf", quietly = TRUE)) return(NULL)
  path <- .monitoreo_territorial_packaged_block_path(ubigeo)
  if (!nzchar(path) || !file.exists(path)) return(NULL)
  read_path <- if (grepl("[.]gz$", path)) paste0("/vsigzip/", normalizePath(path, mustWork = TRUE)) else path
  sf_obj <- tryCatch(sf::st_read(read_path, quiet = TRUE, stringsAsFactors = FALSE), error = function(e) NULL)
  if (is.null(sf_obj) || !nrow(sf_obj)) return(NULL)
  id_col <- .monitoreo_territorial_feature_id_col(sf_obj)
  if (is.na(id_col) || !nzchar(id_col)) return(NULL)
  sf_obj$.__id_manzana <- trimws(as.character(sf_obj[[id_col]]))
  sf_obj$.__id_norm <- sub("0$", "", sf_obj$.__id_manzana, perl = TRUE)
  sf_obj$.__ubigeo <- trimws(as.character(sf_obj$UBIGEO %||% sf_obj$ubigeo %||% ubigeo))
  sf_obj$.__zona <- trimws(as.character(sf_obj$CODZONA %||% sf_obj$zona %||% ""))
  sf_obj$.__manzana <- trimws(as.character(sf_obj$CODMZNA %||% sf_obj$manzana %||% ""))
  tryCatch(sf::st_make_valid(sf::st_transform(sf_obj, 4326)), error = function(e) sf_obj)
}

.monitoreo_territorial_selected_sf <- function(blocks) {
  if (!requireNamespace("sf", quietly = TRUE) || !nrow(blocks)) return(NULL)
  pieces <- list()
  for (ubigeo in unique(as.character(blocks$ubigeo))) {
    if (!nzchar(ubigeo) || is.na(ubigeo)) next
    sf_obj <- .monitoreo_territorial_read_block_sf(ubigeo)
    if (is.null(sf_obj) || !nrow(sf_obj)) next
    local <- blocks[as.character(blocks$ubigeo) == ubigeo, , drop = FALSE]
    resolved <- .monitoreo_territorial_resolve_blocks(local, sf::st_drop_geometry(sf_obj))
    ids <- unique(trimws(as.character(resolved$resolved_id_manzana[!resolved$geometry_unresolved])))
    ids <- ids[nzchar(ids)]
    if (!length(ids)) next
    selected <- sf_obj[sf_obj$.__id_manzana %in% ids, , drop = FALSE]
    if (!nrow(selected)) next
    meta <- resolved[match(selected$.__id_manzana, resolved$resolved_id_manzana), , drop = FALSE]
    selected$.__target <- suppressWarnings(as.integer(meta$entrevistas))
    selected$.__target[is.na(selected$.__target) | selected$.__target < 1L] <- 1L
    selected$.__tipo_manzana <- as.character(meta$tipo_manzana %||% "titular")
    pieces[[length(pieces) + 1L]] <- selected
  }
  if (!length(pieces)) return(NULL)
  do.call(rbind, pieces)
}

.monitoreo_territorial_geo_status <- function(data, tcfg, district_ubigeo, context) {
  n <- nrow(data)
  gps <- .monitoreo_territorial_gps_df(data, tcfg$gps_var)
  out <- data.frame(
    lat = gps$lat,
    lon = gps$lon,
    gps_parseable = is.finite(gps$lat) & is.finite(gps$lon),
    geo_estado = rep("geo_sin_gps", n),
    distance_m = rep(NA_real_, n),
    nearest_block_id = rep("", n),
    nearest_block_type = rep("", n),
    geometry_match = rep("", n),
    stringsAsFactors = FALSE
  )
  precomputed <- context$geo_results %||% NULL
  if (is.data.frame(precomputed) && nrow(precomputed) == n) {
    for (col in intersect(names(out), names(precomputed))) out[[col]] <- precomputed[[col]]
    return(out)
  }
  blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  if (!nrow(blocks)) {
    out$geo_estado[out$gps_parseable] <- "geo_revision"
    out$geometry_match[out$gps_parseable] <- "route_context_missing"
    return(out)
  }
  selected <- .monitoreo_territorial_selected_sf(blocks)
  if (is.null(selected) || !nrow(selected) || !requireNamespace("sf", quietly = TRUE)) {
    out$geo_estado[out$gps_parseable] <- "geo_revision"
    out$geometry_match[out$gps_parseable] <- "geometry_unresolved"
    return(out)
  }
  selected_m <- tryCatch(sf::st_transform(selected, 3857), error = function(e) selected)
  near_thr <- .monitoreo_num(tcfg$geo_thresholds_m$cerca, 150)
  review_thr <- .monitoreo_num(tcfg$geo_thresholds_m$revision, 300)
  for (i in seq_len(n)) {
    if (!isTRUE(out$gps_parseable[[i]])) next
    ubigeo <- .monitoreo_scalar(district_ubigeo[[i]], "")
    if (!nzchar(ubigeo)) {
      out$geo_estado[[i]] <- "geo_sin_gps"
      out$geometry_match[[i]] <- "district_unresolved"
      next
    }
    sel_idx <- which(as.character(selected$.__ubigeo) == ubigeo)
    if (!length(sel_idx)) {
      out$geo_estado[[i]] <- "geo_no_defendible"
      out$geometry_match[[i]] <- "district_outside_route"
      next
    }
    pt <- tryCatch(sf::st_sfc(sf::st_point(c(out$lon[[i]], out$lat[[i]])), crs = 4326), error = function(e) NULL)
    if (is.null(pt)) next
    intersects <- tryCatch(as.logical(sf::st_intersects(pt, selected[sel_idx, ], sparse = FALSE)[1, ]), error = function(e) rep(FALSE, length(sel_idx)))
    if (any(intersects, na.rm = TRUE)) {
      local_idx <- sel_idx[which(intersects)[1]]
      out$geo_estado[[i]] <- "geo_ok"
      out$distance_m[[i]] <- 0
      out$nearest_block_id[[i]] <- selected$.__id_manzana[[local_idx]]
      out$nearest_block_type[[i]] <- selected$.__tipo_manzana[[local_idx]]
      out$geometry_match[[i]] <- "inside_selected_block"
      next
    }
    pt_m <- tryCatch(sf::st_transform(pt, 3857), error = function(e) pt)
    distances <- tryCatch(as.numeric(sf::st_distance(pt_m, selected_m[sel_idx, ])), error = function(e) rep(NA_real_, length(sel_idx)))
    if (!any(is.finite(distances))) {
      out$geo_estado[[i]] <- "geo_revision"
      out$geometry_match[[i]] <- "distance_unavailable"
      next
    }
    best_pos <- which.min(distances)
    best_idx <- sel_idx[[best_pos]]
    d <- distances[[best_pos]]
    out$distance_m[[i]] <- round(d, 1)
    out$nearest_block_id[[i]] <- selected$.__id_manzana[[best_idx]]
    out$nearest_block_type[[i]] <- selected$.__tipo_manzana[[best_idx]]
    out$geo_estado[[i]] <- if (d <= 1) {
      "geo_ok"
    } else if (d <= near_thr) {
      "geo_cerca"
    } else if (d <= review_thr) {
      "geo_revision"
    } else {
      "geo_no_defendible"
    }
    out$geometry_match[[i]] <- if (d <= 1) "inside_selected_block_tolerance" else if (d <= near_thr) "near_150m" else if (d <= review_thr) "review_150_300m" else "far_gt_300m"
  }
  out
}

.monitoreo_territorial_detected_fields <- function(data, tcfg) {
  required <- list(
    district = tcfg$district_var,
    gps = tcfg$gps_var,
    consent = tcfg$consent_var,
    age = tcfg$age_var,
    status = tcfg$status_var,
    id = tcfg$id_var,
    submitted_by = tcfg$submitted_by_var,
    start = tcfg$start_var,
    end = tcfg$end_var
  )
  lapply(required, function(col) list(name = col, present = nzchar(col) && col %in% names(data)))
}

.monitoreo_territorial_status_counts <- function(x) {
  values <- c("validada", "revision", "no_defendible")
  stats::setNames(vapply(values, function(v) sum(x == v, na.rm = TRUE), integer(1)), values)
}

.monitoreo_territorial_block_progress <- function(blocks, audit, status_col = "validation_status") {
  block_progress <- list()
  if (is.null(blocks) || !is.data.frame(blocks) || !nrow(blocks)) return(block_progress)
  nearest_key <- audit$nearest_block_id %||% character(0)
  cell <- function(i, col, default = "") {
    if (!col %in% names(blocks)) return(default)
    value <- blocks[[col]][[i]]
    if (is.null(value) || length(value) == 0L || (length(value) == 1L && is.na(value))) return(default)
    value
  }
  chr_cell <- function(i, col, default = "") trimws(as.character(cell(i, col, default)))
  int_cell <- function(i, col) {
    value <- suppressWarnings(as.integer(cell(i, col, NA_integer_)))
    if (length(value) == 0L || is.na(value)) NA_integer_ else value
  }
  num_cell <- function(i, col) {
    value <- suppressWarnings(as.numeric(cell(i, col, NA_real_)))
    if (length(value) == 0L || is.na(value)) NA_real_ else value
  }
  for (i in seq_len(nrow(blocks))) {
    block_id <- chr_cell(i, "id_manzana")
    target <- int_cell(i, "entrevistas")
    orden_value <- int_cell(i, "orden_seleccion")
    hoja_num_value <- int_cell(i, "hoja_num")
    ump_value <- if (!is.na(hoja_num_value)) {
      as.character(hoja_num_value)
    } else if (!is.na(orden_value)) {
      as.character(orden_value)
    } else {
      chr_cell(i, "territorio_muestral", block_id)
    }
    rows <- audit[nearest_key == block_id | nearest_key %in% .monitoreo_territorial_block_id_variants(block_id), , drop = FALSE]
    status <- if (status_col %in% names(rows)) rows[[status_col]] else rows$validation_status
    cts <- .monitoreo_territorial_status_counts(status)
    block_progress[[length(block_progress) + 1L]] <- list(
      id_manzana = block_id,
      ubigeo = chr_cell(i, "ubigeo"),
      distrito = chr_cell(i, "distrito"),
      zona = chr_cell(i, "zona"),
      manzana = chr_cell(i, "manzana"),
      tipo_manzana = chr_cell(i, "tipo_manzana", "titular"),
      departamento = chr_cell(i, "departamento"),
      provincia = chr_cell(i, "provincia"),
      viviendas = int_cell(i, "viviendas"),
      poblacion = int_cell(i, "poblacion"),
      territorio_muestral = chr_cell(i, "territorio_muestral"),
      metodo = chr_cell(i, "metodo"),
      orden_seleccion = orden_value,
      hoja_num = hoja_num_value,
      rango_inicio = int_cell(i, "rango_inicio"),
      rango_fin = int_cell(i, "rango_fin"),
      entrevistas = target,
      medida_tamano = num_cell(i, "medida_tamano"),
      lat = num_cell(i, "lat"),
      lon = num_cell(i, "lon"),
      ump = ump_value,
      replacement_policy = chr_cell(i, "replacement_policy"),
      replacement_order = int_cell(i, "replacement_order"),
      replacement_total = int_cell(i, "replacement_total"),
      titular_id_manzana = chr_cell(i, "titular_id_manzana"),
      titular_orden_seleccion = int_cell(i, "titular_orden_seleccion"),
      titular_ubigeo = chr_cell(i, "titular_ubigeo"),
      titular_zona = chr_cell(i, "titular_zona"),
      titular_hoja_num = int_cell(i, "titular_hoja_num"),
      titular_rango_inicio = int_cell(i, "titular_rango_inicio"),
      titular_rango_fin = int_cell(i, "titular_rango_fin"),
      replacement_label = chr_cell(i, "replacement_label"),
      replacement_fallback = chr_cell(i, "replacement_fallback"),
      esquina_codigo = int_cell(i, "esquina_codigo"),
      esquina_inicio = chr_cell(i, "esquina_inicio"),
      esquina_coordenada = chr_cell(i, "esquina_coordenada"),
      sentido_recorrido = chr_cell(i, "sentido_recorrido"),
      vivienda_inicio = int_cell(i, "vivienda_inicio"),
      domicilio_inicio = int_cell(i, "domicilio_inicio"),
      constante_salto = int_cell(i, "constante_salto"),
      constante_salto_unidad = chr_cell(i, "constante_salto_unidad"),
      constante_salto_modo = chr_cell(i, "constante_salto_modo"),
      modo_seleccion_vivienda = chr_cell(i, "modo_seleccion_vivienda"),
      nse_codigo = chr_cell(i, "nse_codigo"),
      nse_nivel = chr_cell(i, "nse_nivel"),
      meta = target,
      validas = as.integer(cts[["validada"]]),
      revision = as.integer(cts[["revision"]]),
      no_defendibles = as.integer(cts[["no_defendible"]]),
      avance_pct = if (is.finite(target) && target > 0) round(100 * cts[["validada"]] / target, 1) else NA_real_,
      brecha = if (is.finite(target)) as.integer(max(0, target - cts[["validada"]])) else NA_integer_
    )
  }
  block_progress
}

.monitoreo_territorial_table_payload <- function(payload, max_rows = 500L) {
  if (is.null(payload) || !is.list(payload)) return(list(cells = list(), table = list()))
  cells <- .monitoreo_territorial_rows_df(payload$cells %||% list())
  table <- .monitoreo_territorial_rows_df(payload$table %||% list())
  list(
    cells = .monitoreo_territorial_df_rows(utils::head(cells, max_rows)),
    table = .monitoreo_territorial_df_rows(utils::head(table, max_rows)),
    total_poblacion = as.integer(payload$total_poblacion %||% payload$total_population %||% NA_integer_),
    n_cells = as.integer(payload$n_cells %||% nrow(cells) %||% 0L),
    alerts = payload$alerts %||% list()
  )
}

.monitoreo_territorial_allocate_integer <- function(weights, n) {
  if (exists(".hojas_ruta_allocate_integer", mode = "function")) {
    out <- tryCatch(.hojas_ruta_allocate_integer(weights, n), error = function(e) NULL)
    if (!is.null(out)) return(as.integer(out))
  }
  n <- as.integer(n)
  if (!length(weights)) return(integer(0))
  weights <- suppressWarnings(as.numeric(weights))
  weights[is.na(weights) | weights < 0] <- 0
  if (is.na(n) || n <= 0L || sum(weights, na.rm = TRUE) <= 0) return(rep(0L, length(weights)))
  raw <- n * weights / sum(weights)
  out <- floor(raw)
  rem <- n - sum(out)
  if (rem > 0L) {
    ord <- order(raw - out, weights, decreasing = TRUE)
    out[ord[seq_len(min(rem, length(ord)))]] <- out[ord[seq_len(min(rem, length(ord)))]] + 1L
  }
  as.integer(out)
}

.monitoreo_territorial_row_chr <- function(row, col, default = "") {
  if (!col %in% names(row)) return(default)
  .monitoreo_scalar(row[[col]], default)
}

.monitoreo_territorial_route_quota_payload <- function(context, operational_blocks) {
  payload <- context$quota %||% list()
  cells <- .monitoreo_territorial_rows_df(payload$cells %||% list())
  if (!nrow(cells) || !is.data.frame(operational_blocks) || !nrow(operational_blocks)) return(payload)
  if ("cuota" %in% names(cells) && any(c("id_manzana", "manzana") %in% names(cells))) return(payload)

  source_col <- function(df, cols, default = "") {
    for (col in cols) {
      if (col %in% names(df)) return(trimws(as.character(df[[col]])))
    }
    rep(default, nrow(df))
  }
  source_num <- function(df, cols, default = NA_real_) {
    for (col in cols) {
      if (col %in% names(df)) return(suppressWarnings(as.numeric(df[[col]])))
    }
    rep(default, nrow(df))
  }
  block_value <- function(i, col, default = "") {
    if (!col %in% names(operational_blocks)) return(default)
    .monitoreo_scalar(operational_blocks[[col]][[i]], default)
  }
  block_int <- function(i, col, default = NA_integer_) {
    value <- suppressWarnings(as.integer(block_value(i, col, default)))
    if (length(value) == 0L || is.na(value)) default else value
  }

  cell_ubigeo <- source_col(cells, c("ubigeo", "UBIGEO"))
  cell_distrito <- source_col(cells, c("distrito", "Distrito", "territorio"))
  cell_territorio <- source_col(cells, c("territorio", "territorio_muestral", "UMP", "ump"))
  cell_zona <- source_col(cells, c("zona", "Zona"))
  cell_cuota <- source_num(cells, c("cuota", "meta", "n"), 0)
  cell_pop <- source_num(cells, c("poblacion", "poblacion_referencia", "population"), 0)

  out <- list()
  for (i in seq_len(nrow(operational_blocks))) {
    ubigeo <- block_value(i, "ubigeo")
    distrito <- block_value(i, "distrito")
    zona <- block_value(i, "zona")
    manzana <- block_value(i, "manzana")
    id_manzana <- block_value(i, "id_manzana")
    territorio <- block_value(i, "territorio_muestral")
    if (!nzchar(territorio) && nzchar(ubigeo) && nzchar(zona)) territorio <- paste(ubigeo, zona, sep = "-")
    entrevistas <- block_int(i, "entrevistas", 0L)
    if (is.na(entrevistas) || entrevistas <= 0L) entrevistas <- block_int(i, "meta", 0L)
    if (is.na(entrevistas) || entrevistas <= 0L) next

    territory_keys <- unique(c(territorio, zona, distrito, ubigeo))
    territory_keys <- territory_keys[nzchar(territory_keys)]
    idx <- rep(FALSE, nrow(cells))
    if (nzchar(territorio)) idx <- idx | cell_territorio == territorio
    if (nzchar(ubigeo)) idx <- idx | cell_ubigeo == ubigeo
    if (nzchar(zona)) idx <- idx | cell_zona == zona | cell_territorio == zona
    if (nzchar(distrito)) idx <- idx | cell_distrito == distrito | cell_territorio == distrito
    if (!any(idx)) next

    local <- cells[idx, , drop = FALSE]
    weights <- cell_cuota[idx]
    if (!any(is.finite(weights) & weights > 0, na.rm = TRUE)) weights <- cell_pop[idx]
    assigned <- .monitoreo_territorial_allocate_integer(weights, entrevistas)
    if (!length(assigned)) next

    for (j in seq_len(nrow(local))) {
      row <- as.list(local[j, , drop = FALSE])
      cuota_base <- suppressWarnings(as.integer(.monitoreo_territorial_row_chr(row, "cuota", "0")))
      poblacion_ref <- suppressWarnings(as.integer(.monitoreo_territorial_row_chr(row, "poblacion", NA_character_)))
      out[[length(out) + 1L]] <- list(
        id_manzana = id_manzana,
        ubigeo = ubigeo,
        distrito = distrito,
        zona = zona,
        manzana = manzana,
        territorio = territorio,
        tipo_manzana = block_value(i, "tipo_manzana", "titular"),
        ump = block_value(i, "ump", block_value(i, "hoja_num")),
        rango = paste0(block_value(i, "rango_inicio"), "-", block_value(i, "rango_fin")),
        rango_inicio = block_int(i, "rango_inicio", NA_integer_),
        rango_fin = block_int(i, "rango_fin", NA_integer_),
        rango_edad = .monitoreo_territorial_row_chr(row, "rango_edad", .monitoreo_territorial_row_chr(row, "rango_id", "")),
        sexo = .monitoreo_territorial_row_chr(row, "sexo", "Total"),
        nse = block_value(i, "nse_nivel", block_value(i, "nse_codigo", "")),
        cuota = as.integer(assigned[[j]]),
        cuota_base = if (is.na(cuota_base)) NA_integer_ else cuota_base,
        poblacion_referencia = if (is.na(poblacion_ref)) NA_integer_ else poblacion_ref
      )
    }
  }
  if (!length(out)) return(payload)
  list(
    cells = out,
    table = list(),
    total_poblacion = payload$total_poblacion %||% payload$total_population %||% NA_integer_,
    n_cells = length(out),
    alerts = payload$alerts %||% list()
  )
}

.monitoreo_territorial_responsible_summary <- function(data, tcfg, kobo_schema = NULL, audit = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  field <- .monitoreo_scalar(tcfg$submitted_by_var, "")
  field_present <- nzchar(field) && field %in% names(data)
  values <- if (field_present) as.character(data[[field]]) else character(0)
  values <- trimws(values)
  values <- values[!is.na(values) & nzchar(values)]
  if (!length(values) && is.data.frame(audit) && "submitted_by" %in% names(audit)) {
    values <- trimws(as.character(audit$submitted_by))
    values <- values[!is.na(values) & nzchar(values)]
  }
  values <- values[!vapply(values, function(x) identical(.monitoreo_safe_name(x), "sin enumerador"), logical(1))]
  schema_fields <- kobo_schema$survey_fields %||% list()
  schema_field <- NULL
  if (nzchar(field) && length(schema_fields)) {
    for (item in schema_fields) {
      if (!is.list(item)) next
      if (identical(.monitoreo_scalar(item$xpath, ""), field) || identical(.monitoreo_scalar(item$name, ""), field)) {
        schema_field <- item
        break
      }
    }
  }
  counts <- if (length(values)) sort(table(values), decreasing = TRUE) else integer(0)
  top <- unname(lapply(utils::head(names(counts), 12L), function(name) {
    list(value = name, label = name, count = as.integer(counts[[name]]))
  }))
  list(
    field = field,
    field_label = .monitoreo_scalar(schema_field$label %||% field, field),
    configured = isTRUE(field_present),
    distinct_count = as.integer(length(unique(values))),
    total_with_value = as.integer(length(values)),
    top = top
  )
}

.monitoreo_territorial_route_overview <- function(context, blocks, operational_blocks, district_progress, responsible_summary) {
  titular_count <- if (nrow(blocks)) nrow(blocks) else 0L
  replacement_count <- if (nrow(operational_blocks)) sum(as.character(operational_blocks$tipo_manzana %||% "") != "titular", na.rm = TRUE) else 0L
  replacement_per_route <- if (titular_count > 0L) round(replacement_count / titular_count, 2) else NA_real_
  by_district <- if (nrow(blocks)) {
    tab <- table(as.character(blocks$distrito))
    unname(lapply(names(tab), function(name) list(distrito = name, blocks = as.integer(tab[[name]]))))
  } else {
    list()
  }
  list(
    phase = .monitoreo_scalar(context$phase, ""),
    route_count = as.integer(titular_count),
    operational_block_count = as.integer(if (nrow(operational_blocks)) nrow(operational_blocks) else titular_count),
    replacement_count = as.integer(replacement_count),
    replacement_per_route = replacement_per_route,
    district_count = as.integer(length(district_progress)),
    blocks_by_district = by_district,
    responsible_count = as.integer(responsible_summary$distinct_count %||% 0L),
    total_entrevistas = as.integer(context$total_entrevistas %||% sum(suppressWarnings(as.integer(blocks$entrevistas)), na.rm = TRUE)),
    total_replacement_interviews = as.integer(context$total_replacement_interviews %||% sum(suppressWarnings(as.integer(operational_blocks$entrevistas)), na.rm = TRUE))
  )
}

monitoreo_territorial_reportes <- function(data, cfg, hojas_ruta_context = NULL, kobo_schema = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(cfg, data)
  tcfg <- cfg$territorial %||% monitoreo_territorial_default_config(data)
  context <- hojas_ruta_context %||% list()
  n <- nrow(data)
  crosswalk <- .monitoreo_territorial_crosswalk_df(tcfg$district_crosswalk)
  district_raw <- .monitoreo_territorial_source_value(data, tcfg$district_var)
  district_key <- vapply(district_raw, .monitoreo_safe_name, character(1))
  cw_idx <- match(district_key, crosswalk$kobo_key)
  ubigeo <- ifelse(!is.na(cw_idx), crosswalk$ubigeo[cw_idx], "")
  distrito <- ifelse(!is.na(cw_idx), crosswalk$distrito[cw_idx], "")
  duration_cfg <- cfg
  duration_cfg$duration_var <- tcfg$duration_var
  duration_cfg$start_var <- tcfg$start_var
  duration_cfg$end_var <- tcfg$end_var
  duration <- .monitoreo_duration_seconds(data, duration_cfg)
  duration_source <- .monitoreo_territorial_duration_source(data, tcfg)
  duration_status <- .monitoreo_territorial_duration_status(duration, tcfg)
  geo <- .monitoreo_territorial_geo_status(data, tcfg, ubigeo, context)
  consent_raw <- .monitoreo_territorial_source_value(data, tcfg$consent_var)
  age <- suppressWarnings(as.numeric(.monitoreo_territorial_source_value(data, tcfg$age_var)))
  status_raw <- .monitoreo_territorial_source_value(data, tcfg$status_var)
  id_raw <- .monitoreo_territorial_source_value(data, tcfg$id_var)
  submitted_by <- .monitoreo_territorial_source_value(data, tcfg$submitted_by_var, "Sin encuestador asignado")
  submitted_by[is.na(submitted_by) | !nzchar(trimws(submitted_by))] <- "Sin encuestador asignado"
  submission_time <- .monitoreo_territorial_source_value(data, tcfg$submission_time_var)
  date_values <- .monitoreo_parse_time_vec(submission_time)
  submission_date_iso <- .monitoreo_date_iso_vec(date_values, submission_time)
  submission_date <- .monitoreo_format_date_label_vec(date_values, submission_time)
  submission_hour <- .monitoreo_format_time_label_vec(date_values, submission_time)
  submission_datetime <- .monitoreo_format_datetime_label_vec(date_values, submission_time)
  id_key <- trimws(as.character(id_raw))
  duplicated_id <- nzchar(id_key) & (duplicated(id_key) | duplicated(id_key, fromLast = TRUE))
  consent_key <- vapply(consent_raw, .monitoreo_safe_name, character(1))
  consent_yes <- consent_key %in% c("1", "si", "sí", "yes", "true", "acepta", "acepto", "accepted")
  consent_no <- consent_key %in% c("0", "no", "false", "rechaza", "rechazo")
  status_key <- vapply(status_raw, .monitoreo_safe_name, character(1))
  valid_status <- !nzchar(tcfg$status_var) | !tcfg$status_var %in% names(data) |
    !length(tcfg$valid_statuses) | status_key %in% vapply(.monitoreo_chr_vec(tcfg$valid_statuses), .monitoreo_safe_name, character(1))
  district_ok <- nzchar(ubigeo)
  duration_review <- duration_status %in% c("muy_corta", "corta")
  age_review <- is.finite(age) & age > tcfg$high_age_review
  underage <- is.finite(age) & age < 18
  source_validity <- .monitoreo_territorial_source_validity(data, tcfg, kobo_schema)
  effective_mask <- .monitoreo_territorial_effective_mask(data, tcfg, consent_yes)
  response_id <- ifelse(nzchar(id_key), id_key, paste0("row-", seq_len(n)))
  advance_valid <- effective_mask & !underage & district_ok & valid_status & !duplicated_id
  observation_reasons <- .monitoreo_territorial_observation_reasons(geo$geo_estado, duration_status)
  has_observation <- advance_valid & (lengths(observation_reasons) > 0L)
  validation_decisions <- .monitoreo_territorial_normalize_validation_decisions(tcfg$validation_decisions %||% list())
  approved_ids <- .monitoreo_territorial_validation_decision_ids(tcfg)
  approved_observation <- has_observation & response_id %in% approved_ids
  approval_reason <- vapply(response_id, function(id) {
    .monitoreo_scalar(validation_decisions$approval_reasons[[id]], "")
  }, character(1))
  approval_at <- vapply(response_id, function(id) {
    .monitoreo_scalar(validation_decisions$approved_at[[id]], "")
  }, character(1))
  observation_status <- rep("sin_observacion", n)
  observation_status[!advance_valid] <- "no_valida"
  observation_status[has_observation] <- "en_observacion"
  observation_status[approved_observation] <- "aprobada"
  validation_status <- rep("validada", n)
  issues <- vector("list", n)
  add_issue <- function(mask, code) {
    idx <- which(mask %in% TRUE)
    if (!length(idx)) return(invisible(NULL))
    for (i in idx) issues[[i]] <<- c(issues[[i]], code)
    invisible(NULL)
  }
  add_issue(consent_no, "consentimiento_no")
  add_issue(!consent_yes & !consent_no, "consentimiento_no_confirmado")
  add_issue(underage, "menor_edad")
  add_issue(!district_ok, "distrito_fuera_marco")
  add_issue(!valid_status, "estado_kobo_no_aceptable")
  add_issue(duplicated_id, "id_duplicado")
  add_issue(geo$geo_estado == "geo_no_defendible", "gps_no_defendible")
  add_issue(geo$geo_estado %in% c("geo_revision", "geo_sin_gps"), "gps_revision")
  add_issue(duration_review, "duracion_revision")
  add_issue(age_review, "edad_revision")
  add_issue(!effective_mask, "filtro_avance_no_valido")
  add_issue(approved_observation, "observacion_aprobada")
  no_def <- !advance_valid
  review <- advance_valid & has_observation & !approved_observation
  validation_status[review] <- "revision"
  validation_status[no_def] <- "no_defendible"
  issues_text <- vapply(issues, function(x) paste(unique(x), collapse = ";"), character(1))
  observation_reasons_text <- vapply(observation_reasons, function(x) paste(unique(x), collapse = ";"), character(1))
  advance_status <- ifelse(advance_valid, "validada", "no_defendible")
  advance_date <- submission_date_iso
  advance_date[!nzchar(advance_date) | is.na(advance_date)] <- "sin_fecha"

  audit <- data.frame(
    row_index = seq_len(n),
    response_id = response_id,
    district_code = district_raw,
    distrito = distrito,
    ubigeo = ubigeo,
    consent = consent_raw,
    age = age,
    status = status_raw,
    submitted_by = submitted_by,
    submission_time = submission_time,
    submission_date_iso = submission_date_iso,
    submission_date = submission_date,
    submission_hour = submission_hour,
    submission_datetime = submission_datetime,
    duration_seconds = round(duration, 1),
    duration_status = duration_status,
    duration_source = rep(.monitoreo_scalar(duration_source$label, ""), n),
    duration_source_type = rep(.monitoreo_scalar(duration_source$type, ""), n),
    lat = round(geo$lat, 7),
    lon = round(geo$lon, 7),
    gps_parseable = geo$gps_parseable,
    geo_estado = geo$geo_estado,
    distance_m = geo$distance_m,
    nearest_block_id = geo$nearest_block_id,
    nearest_block_type = geo$nearest_block_type,
    geometry_match = geo$geometry_match,
    advance_valid = advance_valid,
    advance_status = advance_status,
    advance_date = advance_date,
    observation_status = observation_status,
    observation_reasons = observation_reasons_text,
    validation_decision = ifelse(approved_observation, "visto_bueno", ""),
    validation_decision_reason = ifelse(approved_observation, approval_reason, ""),
    validation_decision_at = ifelse(approved_observation, approval_at, ""),
    validation_status = validation_status,
    issues = issues_text,
    stringsAsFactors = FALSE
  )

  blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = FALSE)
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  target_total <- if (nrow(blocks)) sum(suppressWarnings(as.integer(blocks$entrevistas)), na.rm = TRUE) else cfg$objetivo_total
  if (!is.finite(target_total)) target_total <- NA_integer_
  gps_crossable <- audit$gps_parseable & nzchar(audit$ubigeo)
  geo_counts <- table(factor(audit$geo_estado, levels = c("geo_ok", "geo_cerca", "geo_revision", "geo_no_defendible", "geo_sin_gps")))
  counts <- .monitoreo_territorial_status_counts(audit$validation_status)
  kpis <- list(
    total_respuestas = as.integer(n),
    consentidas = as.integer(sum(consent_yes, na.rm = TRUE)),
    validas = as.integer(counts[["validada"]]),
    revision = as.integer(counts[["revision"]]),
    no_defendibles = as.integer(counts[["no_defendible"]]),
    meta = if (is.finite(target_total)) as.integer(target_total) else NA_integer_,
    avance_pct = if (is.finite(target_total) && target_total > 0) round(100 * counts[["validada"]] / target_total, 1) else NA_real_,
    gps_crossable = as.integer(sum(gps_crossable, na.rm = TRUE)),
    geo_ok = as.integer(geo_counts[["geo_ok"]]),
    geo_cerca = as.integer(geo_counts[["geo_cerca"]]),
    geo_revision = as.integer(geo_counts[["geo_revision"]]),
    geo_no_defendible = as.integer(geo_counts[["geo_no_defendible"]]),
    geo_sin_cruce = as.integer(sum(!gps_crossable, na.rm = TRUE)),
    duration_median = if (any(is.finite(duration))) round(stats::median(duration, na.rm = TRUE), 1) else NA_real_,
    duration_p95 = if (sum(is.finite(duration)) > 1L) round(stats::quantile(duration, 0.95, na.rm = TRUE, names = FALSE), 1) else NA_real_
  )

  district_goals <- if (nrow(blocks)) {
    stats::aggregate(blocks["entrevistas"], by = blocks[c("ubigeo", "distrito")], FUN = sum, na.rm = TRUE)
  } else {
    data.frame(ubigeo = crosswalk$ubigeo, distrito = crosswalk$distrito, entrevistas = NA_integer_)
  }
  names(district_goals)[names(district_goals) == "entrevistas"] <- "meta"
  advance <- .monitoreo_territorial_advance_progress(
    district_goals = district_goals,
    blocks = blocks,
    audit = audit,
    target_total = target_total
  )
  district_progress <- lapply(seq_len(nrow(district_goals)), function(i) {
    u <- as.character(district_goals$ubigeo[[i]])
    rows <- audit[audit$ubigeo == u, , drop = FALSE]
    cts <- .monitoreo_territorial_status_counts(rows$validation_status)
    meta <- suppressWarnings(as.integer(district_goals$meta[[i]]))
    list(
      ubigeo = u,
      distrito = as.character(district_goals$distrito[[i]]),
      meta = if (is.finite(meta)) meta else NA_integer_,
      total = as.integer(nrow(rows)),
      validas = as.integer(cts[["validada"]]),
      revision = as.integer(cts[["revision"]]),
      no_defendibles = as.integer(cts[["no_defendible"]]),
      avance_pct = if (is.finite(meta) && meta > 0) round(100 * cts[["validada"]] / meta, 1) else NA_real_,
      brecha = if (is.finite(meta)) as.integer(max(0, meta - cts[["validada"]])) else NA_integer_
    )
  })

  block_progress <- .monitoreo_territorial_block_progress(blocks, audit)
  map_block_progress <- .monitoreo_territorial_block_progress(operational_blocks, audit)

  team_rows <- split(audit, audit$submitted_by)
  team <- unname(lapply(team_rows, function(rows) {
    cts <- .monitoreo_territorial_status_counts(rows$validation_status)
    list(
      submitted_by = rows$submitted_by[[1]],
      total = as.integer(nrow(rows)),
      validas = as.integer(cts[["validada"]]),
      revision = as.integer(cts[["revision"]]),
      no_defendibles = as.integer(cts[["no_defendible"]]),
      duration_median = if (any(is.finite(rows$duration_seconds))) round(stats::median(rows$duration_seconds, na.rm = TRUE), 1) else NA_real_
    )
  }))
  responsible_summary <- .monitoreo_territorial_responsible_summary(data, tcfg, kobo_schema, audit)
  route_overview <- .monitoreo_territorial_route_overview(context, blocks, operational_blocks, district_progress, responsible_summary)

  date_chr <- submission_date_iso
  date_chr[is.na(date_chr) | !nzchar(date_chr)] <- "sin_fecha"
  daily_rows <- split(audit, date_chr)
  daily <- unname(lapply(names(daily_rows), function(day) {
    rows <- daily_rows[[day]]
    cts <- .monitoreo_territorial_status_counts(rows$validation_status)
    labels <- rows$submission_date[.monitoreo_report_nonempty(rows$submission_date)]
    label <- if (length(labels)) labels[[1]] else ""
    list(
      date = day,
      date_label = if (nzchar(label)) label else if (identical(day, "sin_fecha")) "Sin fecha" else day,
      total = as.integer(nrow(rows)),
      validas = as.integer(cts[["validada"]]),
      revision = as.integer(cts[["revision"]])
    )
  }))

  point_cols <- c("response_id", "submitted_by", "submission_date", "submission_hour", "submission_datetime", "ubigeo", "distrito", "lat", "lon", "geo_estado", "distance_m", "nearest_block_id", "advance_valid", "observation_status", "observation_reasons", "validation_status", "issues")
  points <- audit[, intersect(point_cols, names(audit)), drop = FALSE]
  source_fields <- .monitoreo_territorial_detected_fields(data, tcfg)
  kobo_districts <- kobo_schema$district_choices %||% NULL
  if (is.null(kobo_districts)) {
    kobo_districts <- lapply(seq_len(nrow(crosswalk)), function(i) list(name = crosswalk$kobo_code[[i]], label = crosswalk$kobo_label[[i]]))
  }
  district_codes <- vapply(kobo_districts, function(x) .monitoreo_scalar(x$name %||% x$kobo_code, ""), character(1))
  drift <- list()
  if ("vmt" %in% vapply(district_codes, .monitoreo_safe_name, character(1))) {
    drift[[length(drift) + 1L]] <- list(severity = "error", code = "vmt_in_live_kobo", message = "La lista viva de Kobo contiene VMT; revisar crosswalk antes de validar.")
  }
  if (!"sjm" %in% vapply(district_codes, .monitoreo_safe_name, character(1))) {
    drift[[length(drift) + 1L]] <- list(severity = "warning", code = "sjm_missing", message = "La lista viva de Kobo no expone SJM.")
  }
  geometry_alerts <- unique(audit$geometry_match[audit$geometry_match %in% c("geometry_unresolved", "route_context_missing")])
  for (alert in geometry_alerts) {
    drift[[length(drift) + 1L]] <- list(severity = "warning", code = alert, message = "Hay respuestas o manzanas sin geometria defendible para clasificar distancia.")
  }

  list(
    schema = "monitoreo_territorial_dashboard_v1",
    generated_at = .monitoreo_now_iso(),
    active_route_phase = .monitoreo_scalar(context$phase, tcfg$active_route_phase),
    phase_note = .monitoreo_scalar(context$phase_note, if (identical(.monitoreo_scalar(context$phase, tcfg$active_route_phase), "pilot")) "Piloto operativo activo; campo queda como referencia." else ""),
    kpis = kpis,
    advance = advance,
    source_coherence = list(
      asset_uid = .monitoreo_scalar(kobo_schema$asset_uid %||% tcfg$asset_uid, ""),
      asset_name = .monitoreo_scalar(kobo_schema$name %||% tcfg$kobo_asset_name, ""),
      version_id = .monitoreo_scalar(kobo_schema$version_id %||% tcfg$kobo_version_id, ""),
      date_modified = .monitoreo_scalar(kobo_schema$date_modified, ""),
      deployment_active = kobo_schema$deployment_active %||% NA,
      survey_count = as.integer(kobo_schema$survey_count %||% length(kobo_schema$survey_fields %||% list())),
      choices_count = as.integer(kobo_schema$choices_count %||% 0L),
      district_field = tcfg$district_var,
      district_list_name = .monitoreo_scalar(kobo_schema$district_list_name, "district"),
      district_choices = kobo_districts,
      survey_fields = kobo_schema$survey_fields %||% list(),
      choices_by_list = kobo_schema$choices_by_list %||% list(),
      detected_fields = source_fields,
      drift = drift
    ),
    source_validity = source_validity,
    route_overview = route_overview,
    responsible_summary = responsible_summary,
    route_blocks = map_block_progress,
    selected_block_context = list(default_block_id = if (length(block_progress)) .monitoreo_scalar(block_progress[[1]]$id_manzana, "") else ""),
    route_population = .monitoreo_territorial_table_payload(context$population %||% list()),
    route_quota = .monitoreo_territorial_table_payload(.monitoreo_territorial_route_quota_payload(context, operational_blocks), max_rows = 5000L),
    district_progress = district_progress,
    block_progress = block_progress,
    response_audit = .monitoreo_territorial_df_rows(utils::head(audit, 500L)),
    team = team,
    daily = daily,
    map = list(
      phase = .monitoreo_scalar(context$phase, tcfg$active_route_phase),
      blocks = map_block_progress,
      points = .monitoreo_territorial_df_rows(points),
      alerts = drift,
      legend = list(
        list(key = "geo_ok", label = "Validada en manzana"),
        list(key = "geo_cerca", label = "Cerca <=150 m"),
        list(key = "geo_revision", label = "Revision 150-300 m"),
        list(key = "geo_no_defendible", label = "Fuera >300 m"),
        list(key = "geo_sin_gps", label = "Sin GPS/cruce")
      )
    ),
    internal_queries = list(
      incomplete_blocks = Filter(function(x) isTRUE((x$brecha %||% 0L) > 0L), advance$block_progress %||% list()),
      far_gps = .monitoreo_territorial_df_rows(audit[audit$geo_estado == "geo_no_defendible", intersect(point_cols, names(audit)), drop = FALSE]),
      lagging_districts = Filter(function(x) isTRUE((x$brecha %||% 0L) > 0L), advance$district_progress %||% list())
    )
  )
}

monitoreo_territorial_map_payload <- function(data, cfg, hojas_ruta_context = NULL, kobo_schema = NULL, ubigeo = "") {
  reports <- monitoreo_territorial_reportes(data, cfg, hojas_ruta_context, kobo_schema)
  payload <- reports$map %||% list()
  ubigeo <- .monitoreo_scalar(ubigeo, "")
  if (nzchar(ubigeo)) {
    payload$blocks <- Filter(function(x) identical(.monitoreo_scalar(x$ubigeo, ""), ubigeo), payload$blocks %||% list())
    payload$points <- Filter(function(x) identical(.monitoreo_scalar(x$ubigeo, ""), ubigeo), payload$points %||% list())
  }
  payload
}

monitoreo_build_dashboard <- function(data, config = list(), include_reports = TRUE, territorial_context = NULL, kobo_schema = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(config, data)
  n <- nrow(data)
  valid <- .monitoreo_valid_mask(data, cfg)
  valid_n <- sum(valid, na.rm = TRUE)
  duration <- .monitoreo_duration_seconds(data, cfg)
  date_values <- if (nzchar(cfg$date_var) && cfg$date_var %in% names(data)) .monitoreo_parse_time_vec(data[[cfg$date_var]]) else rep(as.POSIXct(NA), n)
  n_days <- length(unique(as.Date(date_values[!is.na(date_values)])))
  if (n_days == 0L && n > 0L) n_days <- 1L
  target <- cfg$objetivo_total
  if (!is.finite(target) && length(cfg$goals)) {
    target <- sum(vapply(cfg$goals, function(g) as.integer(g$meta %||% 0L), integer(1)))
  }
  avance_pct <- if (is.finite(target) && target > 0L) round(100 * valid_n / target, 1) else NA_real_

  progress <- .monitoreo_progress_table(data, cfg, valid)
  production <- .monitoreo_production_table(data, cfg, valid, date_values)
  inconsistencies <- .monitoreo_inconsistencies(data, cfg, valid, duration)
  family <- cfg$monitoreo_profile$family %||% "acreditacion"
  acreditacion_reports <- if (isTRUE(include_reports) && identical(family, "acreditacion")) {
    monitoreo_acreditacion_reportes(data, cfg)
  } else {
    NULL
  }
  territorial_reports <- if (isTRUE(include_reports) && identical(family, "territorial")) {
    monitoreo_territorial_reportes(data, cfg, territorial_context, kobo_schema)
  } else {
    NULL
  }

  list(
    ok = TRUE,
    kpis = list(
      total = as.integer(n),
      valid = as.integer(valid_n),
      invalid = as.integer(n - valid_n),
      target = if (is.finite(target)) as.integer(target) else NA_integer_,
      avance_pct = avance_pct,
      ritmo_diario = if (n_days > 0L) round(valid_n / n_days, 1) else NA_real_,
      duration_median = if (any(is.finite(duration))) round(stats::median(duration, na.rm = TRUE), 1) else NA_real_,
      duration_p95 = if (sum(is.finite(duration)) > 1L) round(stats::quantile(duration, 0.95, na.rm = TRUE, names = FALSE), 1) else NA_real_,
      inconsistencies = as.integer(nrow(inconsistencies))
    ),
    progress = progress,
    production = production,
    inconsistencies = utils::head(inconsistencies, 500L),
    acreditacion_reports = acreditacion_reports,
    territorial_reports = territorial_reports
  )
}

.monitoreo_progress_table <- function(data, cfg, valid) {
  ctrl <- unlist(cfg$control_vars, use.names = FALSE)
  ctrl <- ctrl[ctrl %in% names(data)]
  if (!length(ctrl)) {
    dim_cols <- sort(grep("^dim_", names(data), value = TRUE))
    ctrl <- unique(c(dim_cols, intersect(".source_label", names(data))))
  }
  if (!length(ctrl)) {
    meta <- cfg$objetivo_total
    return(data.frame(
      grupo = "Total",
      observado = as.integer(sum(valid)),
      meta = if (is.finite(meta)) as.integer(meta) else NA_integer_,
      faltante = if (is.finite(meta)) max(0L, as.integer(meta) - as.integer(sum(valid))) else NA_integer_,
      cumplimiento = if (is.finite(meta) && meta > 0L) round(100 * sum(valid) / meta, 1) else NA_real_,
      stringsAsFactors = FALSE
    ))
  }
  df <- data[, ctrl, drop = FALSE]
  for (nm in ctrl) {
    df[[nm]] <- as.character(df[[nm]])
    df[[nm]][.monitoreo_empty_mask(df[[nm]])] <- "Sin dato"
  }
  df$.valid <- valid
  agg <- stats::aggregate(.valid ~ ., data = df, FUN = function(x) sum(x, na.rm = TRUE))
  names(agg)[names(agg) == ".valid"] <- "observado"
  agg$grupo <- apply(agg[, ctrl, drop = FALSE], 1, paste, collapse = " / ")
  agg$meta <- vapply(seq_len(nrow(agg)), function(i) {
    .monitoreo_goal_meta_for_row(as.list(agg[i, ctrl, drop = FALSE]), cfg$goals)
  }, integer(1))
  agg$faltante <- ifelse(is.na(agg$meta), NA_integer_, pmax(0L, agg$meta - agg$observado))
  agg$cumplimiento <- ifelse(!is.na(agg$meta) & agg$meta > 0, round(100 * agg$observado / agg$meta, 1), NA_real_)
  agg[, c("grupo", ctrl, "observado", "meta", "faltante", "cumplimiento"), drop = FALSE]
}

.monitoreo_production_table <- function(data, cfg, valid, date_values) {
  n <- nrow(data)
  if (n == 0L) return(data.frame())
  enum <- if (nzchar(cfg$enumerator_var) && cfg$enumerator_var %in% names(data)) {
    as.character(data[[cfg$enumerator_var]])
  } else {
    rep("Sin enumerador", n)
  }
  enum[.monitoreo_empty_mask(enum)] <- "Sin enumerador"
  day <- as.character(as.Date(date_values))
  day[is.na(day)] <- "Sin fecha"
  df <- data.frame(enumerador = enum, fecha = day, valido = valid, stringsAsFactors = FALSE)
  agg <- stats::aggregate(valido ~ enumerador + fecha, data = df, FUN = function(x) sum(x, na.rm = TRUE))
  names(agg)[3] <- "entrevistas_validas"
  agg <- agg[order(agg$enumerador, agg$fecha), , drop = FALSE]
  rownames(agg) <- NULL
  agg
}

.monitoreo_inconsistencies <- function(data, cfg, valid, duration) {
  n <- nrow(data)
  if (n == 0L) return(data.frame())
  id <- if (nzchar(cfg$id_var) && cfg$id_var %in% names(data)) as.character(data[[cfg$id_var]]) else as.character(seq_len(n))
  enum <- if (nzchar(cfg$enumerator_var) && cfg$enumerator_var %in% names(data)) as.character(data[[cfg$enumerator_var]]) else rep(NA_character_, n)
  add <- function(idx, tipo, campo = "", valor = NA_character_) {
    if (!length(idx)) return(NULL)
    data.frame(
      row = as.integer(idx),
      id = id[idx],
      enumerador = enum[idx],
      tipo = tipo,
      campo = campo,
      valor = as.character(valor),
      stringsAsFactors = FALSE
    )
  }
  parts <- list()
  if (nzchar(cfg$status_var) && cfg$status_var %in% names(data)) {
    idx <- which(!valid)
    parts[[length(parts) + 1L]] <- add(idx, "estado_invalido", cfg$status_var, data[[cfg$status_var]][idx])
  }
  for (nm in unlist(cfg$critical_vars, use.names = FALSE)) {
    if (!nm %in% names(data)) next
    idx <- which(.monitoreo_empty_mask(data[[nm]]))
    parts[[length(parts) + 1L]] <- add(idx, "campo_critico_vacio", nm, "")
  }
  if (length(duration)) {
    idx <- which(is.finite(duration) & duration < cfg$min_duration_seconds)
    parts[[length(parts) + 1L]] <- add(idx, "duracion_muy_corta", cfg$duration_var, duration[idx])
    idx <- which(is.finite(duration) & duration > cfg$max_duration_seconds)
    parts[[length(parts) + 1L]] <- add(idx, "duracion_muy_larga", cfg$duration_var, duration[idx])
  }
  if (nzchar(cfg$id_var) && cfg$id_var %in% names(data)) {
    ids <- as.character(data[[cfg$id_var]])
    idx <- which(!.monitoreo_empty_mask(ids) & duplicated(ids))
    parts[[length(parts) + 1L]] <- add(idx, "id_duplicado", cfg$id_var, ids[idx])
  }
  parts <- Filter(Negate(is.null), parts)
  if (!length(parts)) return(data.frame(row = integer(), id = character(), enumerador = character(), tipo = character(), campo = character(), valor = character()))
  out <- do.call(rbind, parts)
  rownames(out) <- NULL
  out
}

.monitoreo_report_records <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    row[] <- lapply(row, function(x) if (length(x) && !is.na(x[1])) x[[1]] else "")
    row
  })
}

.monitoreo_report_block <- function(id, title, df, note = "") {
  if (is.null(df) || !is.data.frame(df)) df <- data.frame()
  list(
    id = id,
    title = title,
    columns = as.list(names(df)),
    rows = .monitoreo_report_records(df),
    note = .monitoreo_scalar(note, "")
  )
}

.monitoreo_report_sheet <- function(id, title, description, blocks, scope = "interno") {
  list(
    id = id,
    title = title,
    description = description,
    scope = scope,
    blocks = Filter(function(block) length(block$columns %||% list()) || length(block$rows %||% list()), blocks)
  )
}

.monitoreo_report_col <- function(data, aliases) {
  if (is.null(data) || !is.data.frame(data) || !ncol(data)) return("")
  clean_names <- .monitoreo_text_key(names(data))
  clean_aliases <- .monitoreo_text_key(.monitoreo_chr_vec(aliases))
  for (alias in clean_aliases) {
    idx <- which(clean_names == alias)
    if (length(idx)) return(names(data)[idx[[1]]])
  }
  for (alias in clean_aliases) {
    idx <- which(grepl(alias, clean_names, fixed = TRUE))
    if (length(idx)) return(names(data)[idx[[1]]])
  }
  ""
}

.monitoreo_report_source_unit <- function(x) {
  text <- trimws(as.character(x %||% "")[1])
  text <- sub("^.*[·-]\\s*", "", text)
  trimws(text)
}

.monitoreo_report_generic_unit_label <- function(x) {
  key <- .monitoreo_safe_name(x)
  key %in% c(
    "campo", "sin_actor", "sin_dato", "sin_asignar", "sin_respuestas",
    "sin_respuestas_conectadas", "respuesta", "respuestas", "encuesta",
    "encuestas", "surveymonkey", "google_sheets", "google_sheet", "sheets",
    "base", "base_trabajada", "barrido", "barrido_telefonico", "correo",
    "email", "mail", "telefono", "telefonico", "whatsapp", "sms", "qr",
    "ficha_qr", "presencial"
  )
}

.monitoreo_report_source_actor <- function(actor, source_label, profile = list(), channel = "") {
  actor <- trimws(.monitoreo_scalar(actor, ""))
  if (nzchar(actor) && !.monitoreo_report_generic_unit_label(actor)) return(actor)

  profile <- monitoreo_normalize_profile(profile)
  label <- trimws(.monitoreo_scalar(source_label, ""))
  if (!nzchar(label)) return("Sin actor")

  label_key <- .monitoreo_safe_name(label)
  units <- c(
    vapply(profile$segments %||% list(), function(seg) .monitoreo_scalar(seg$label %||% seg$id, ""), character(1)),
    vapply(profile$units %||% list(), function(unit) .monitoreo_scalar(unit$label %||% unit$id, ""), character(1))
  )
  units <- units[nzchar(trimws(units))]
  if (length(units)) {
    order_idx <- order(nchar(units), decreasing = TRUE)
    for (unit in units[order_idx]) {
      unit_key <- .monitoreo_safe_name(unit)
      if (nzchar(unit_key) && grepl(unit_key, label_key, fixed = TRUE)) return(trimws(unit))
    }
  }

  channel_key <- .monitoreo_safe_name(channel)
  parts <- trimws(unlist(strsplit(label, "\\s*[·-]\\s*", perl = TRUE), use.names = FALSE))
  parts <- parts[nzchar(parts)]
  for (part in parts) {
    part_key <- .monitoreo_safe_name(part)
    if (!identical(part_key, channel_key) && !.monitoreo_report_generic_unit_label(part)) return(part)
  }

  fallback <- .monitoreo_report_source_unit(label)
  if (nzchar(fallback) && !identical(.monitoreo_safe_name(fallback), channel_key) && !.monitoreo_report_generic_unit_label(fallback)) {
    return(fallback)
  }
  "Sin actor"
}

.monitoreo_report_unit_key <- function(x) {
  .monitoreo_safe_name(.monitoreo_report_source_unit(x))
}

.monitoreo_report_units <- function(profile, data) {
  profile <- monitoreo_normalize_profile(profile)
  out <- list()
  add <- function(id, label, type = "actor", minimum = NA_integer_) {
    label <- .monitoreo_scalar(label, "")
    if (!nzchar(label)) return(NULL)
    key <- .monitoreo_report_unit_key(label)
    if (is.null(out[[key]])) {
      out[[key]] <<- list(
        id = .monitoreo_scalar(id, key),
        key = key,
        label = label,
        type = type,
        minimum = if (is.finite(minimum)) as.integer(minimum) else NA_integer_
      )
    }
    invisible(NULL)
  }
  if (identical(profile$variant, "segmentada_por_carrera") && length(profile$segments)) {
    for (seg in profile$segments) {
      label <- .monitoreo_scalar(seg$label %||% seg$id, "")
      min_key <- .monitoreo_scalar(seg$id %||% label, "")
      add(min_key, label, "segmento", .monitoreo_int(profile$minimums[[min_key]] %||% profile$minimums[[label]], NA_integer_))
    }
  }
  if (!length(out) && length(profile$units)) {
    for (unit in profile$units) {
      label <- .monitoreo_scalar(unit$label %||% unit$id, "")
      add(unit$id %||% label, label, .monitoreo_scalar(unit$type, "actor"), .monitoreo_int(profile$minimums[[unit$id]] %||% profile$minimums[[label]], NA_integer_))
    }
  }
  if (!length(out) && "dim_actor" %in% names(data)) {
    actors <- unique(trimws(as.character(data$dim_actor %||% "")))
    actors <- actors[nzchar(actors) & !is.na(actors)]
    for (actor in actors) add(actor, actor, "actor", NA_integer_)
  }
  if (!length(out) && ".source_label" %in% names(data)) {
    labels <- unique(as.character(data$.source_label))
    labels <- labels[nzchar(trimws(labels))]
    for (label in labels) add(label, .monitoreo_report_source_unit(label), "fuente", NA_integer_)
  }
  unname(out)
}

.monitoreo_report_match_unit <- function(labels, unit) {
  label_key <- vapply(as.character(labels %||% ""), .monitoreo_safe_name, character(1))
  unit_key <- .monitoreo_scalar(unit$key, "")
  unit_label <- .monitoreo_safe_name(unit$label)
  label_key == unit_key | grepl(unit_key, label_key, fixed = TRUE) | grepl(unit_label, label_key, fixed = TRUE)
}

.monitoreo_report_role_mask <- function(data, roles) {
  if (!".source_role" %in% names(data)) return(rep(FALSE, nrow(data)))
  as.character(data$.source_role) %in% roles
}

.monitoreo_report_unit_mask <- function(data, unit, roles = NULL) {
  mask <- rep(TRUE, nrow(data))
  if (!is.null(roles)) mask <- mask & .monitoreo_report_role_mask(data, roles)
  unit_key <- .monitoreo_scalar(unit$key, "")
  unit_label <- .monitoreo_safe_name(unit$label)
  unit_type <- .monitoreo_safe_name(unit$type %||% "actor")
  dim_candidates <- switch(unit_type,
    actor = c("dim_actor", "dim_unidad"),
    segmento = c("dim_segmento", "dim_segment", "dim_carrera", "dim_unidad"),
    segment = c("dim_segmento", "dim_segment", "dim_carrera", "dim_unidad"),
    grupo = c("dim_group", "dim_grupo", "dim_segmento", "dim_segment", "dim_unidad"),
    group = c("dim_group", "dim_grupo", "dim_segmento", "dim_segment", "dim_unidad"),
    character(0)
  )
  dim_cols <- intersect(dim_candidates, names(data))
  dim_present <- rep(FALSE, nrow(data))
  dim_match <- rep(FALSE, nrow(data))
  for (col in dim_cols) {
    values <- trimws(as.character(data[[col]] %||% ""))
    value_keys <- vapply(values, .monitoreo_safe_name, character(1))
    present <- nzchar(values) & !is.na(values)
    dim_present <- dim_present | present
    dim_match <- dim_match | (present & (value_keys == unit_key | value_keys == unit_label))
  }
  label_match <- if (".source_label" %in% names(data)) {
    .monitoreo_report_match_unit(as.character(data$.source_label), unit)
  } else {
    rep(FALSE, nrow(data))
  }
  if (length(dim_cols)) {
    mask <- mask & ((dim_present & dim_match) | (!dim_present & label_match))
  } else if (".source_label" %in% names(data)) {
    mask <- mask & label_match
  }
  mask
}

.monitoreo_report_first_values <- function(df, aliases) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  out <- rep("", nrow(df))
  clean_names <- .monitoreo_text_key(names(df))
  for (alias in .monitoreo_text_key(aliases)) {
    idx <- which(clean_names == alias)
    if (!length(idx)) next
    for (col in names(df)[idx]) {
      raw <- trimws(as.character(df[[col]] %||% ""))
      raw[is.na(raw)] <- ""
      needs <- !nzchar(out) & nzchar(raw)
      if (any(needs)) out[needs] <- raw[needs]
    }
  }
  out
}

.monitoreo_report_person_values <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  out <- rep("", nrow(df))
  clean_names <- .monitoreo_text_key(names(df))
  label_map <- .monitoreo_variable_label_map(df)
  labels <- rep("", length(clean_names))
  names(labels) <- names(df)
  if (length(label_map)) {
    matched_labels <- label_map[names(df)]
    labels[!is.na(matched_labels)] <- matched_labels[!is.na(matched_labels)]
  }
  clean_labels <- .monitoreo_text_key(labels)

  valid_person <- function(value) {
    value <- trimws(as.character(value %||% ""))
    value[is.na(value)] <- ""
    has_letters <- grepl("[[:alpha:]]", value)
    technical <- grepl("@", value, fixed = TRUE) |
      grepl("^\\+?[0-9() .-]{6,}$", value) |
      grepl("^[A-Za-z]?\\d{4,}[A-Za-z0-9-]*$", value)
    has_letters & !technical
  }

  assign_from_positions <- function(positions) {
    positions <- unique(positions[positions > 0L])
    if (!length(positions)) return(invisible(NULL))
    for (pos in positions) {
      raw <- trimws(as.character(df[[pos]] %||% ""))
      raw[is.na(raw)] <- ""
      ok <- !nzchar(out) & valid_person(raw)
      if (any(ok)) out[ok] <<- raw[ok]
    }
    invisible(NULL)
  }

  find_positions <- function(aliases) {
    keys <- .monitoreo_text_key(aliases)
    positions <- integer(0)
    for (key in keys) {
      if (!nzchar(key)) next
      positions <- c(positions, which(clean_names == key | clean_labels == key))
    }
    unique(positions)
  }

  full_name_aliases <- c(
    "Apellidos y nombres", "Apellidos, Nombres", "Nombre completo", "Nombre2",
    "Nombre", "Nombres", "name", "full_name", "full name", "recipient_name",
    "recipient_first_name", "first_name", "Nombre del Docente"
  )
  assign_from_positions(find_positions(full_name_aliases))

  if (any(!nzchar(out))) {
    first_positions <- find_positions(c("Nombres", "Nombre", "Nombre del Docente", "recipient_first_name", "first_name"))
    last_positions <- find_positions(c("Apellidos", "Apellido", "Apellidos del docente", "recipient_last_name", "last_name"))
    if (length(first_positions) && length(last_positions)) {
      first <- rep("", nrow(df))
      last <- rep("", nrow(df))
      for (pos in first_positions) {
        raw <- trimws(as.character(df[[pos]] %||% ""))
        raw[is.na(raw)] <- ""
        first[!nzchar(first) & nzchar(raw)] <- raw[!nzchar(first) & nzchar(raw)]
      }
      for (pos in last_positions) {
        raw <- trimws(as.character(df[[pos]] %||% ""))
        raw[is.na(raw)] <- ""
        last[!nzchar(last) & nzchar(raw)] <- raw[!nzchar(last) & nzchar(raw)]
      }
      combined <- trimws(paste(last, first))
      ok <- !nzchar(out) & valid_person(combined)
      if (any(ok)) out[ok] <- combined[ok]
    }
  }

  out
}

.monitoreo_report_state_from_status <- function(status, platform = FALSE) {
  status <- .monitoreo_text_key(status)
  out <- rep("Sin respuesta", length(status))
  complete_values <- if (isTRUE(platform)) {
    c("completed", "complete", "completa", "completado", "valid", "aprobado", "approved")
  } else {
    c("completed", "complete", "completa", "completado", "valid", "aprobado", "approved", "efectivo", "efectiva")
  }
  out[status %in% complete_values] <- "Completa"
  out[status %in% c("partial", "parcial", "incomplete", "sin completar")] <- "Parcial"
  out[status %in% c("rejected", "rechazo", "rechazado", "rechazada", "rechazados", "rechazadas", "refusal", "disqualified", "descalificado")] <- "Rechazo"
  out[status %in% c("sin respuesta", "no respuesta", "pendiente", "no barrido", "nobarrido", "not responded")] <- "Sin respuesta"
  out
}

.monitoreo_report_rejection_mask <- function(df, profile = list()) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  profile <- monitoreo_normalize_profile(profile)
  rules <- profile$rejection_rules %||% list()
  if (!length(rules)) return(rep(FALSE, nrow(df)))
  response_status <- .monitoreo_report_first_values(df, c("response_status", "Estado", "estado", "Estatus", "estatus", "status", "Status"))
  completed_mask <- .monitoreo_report_state_from_status(response_status, platform = TRUE) == "Completa"
  complete_col <- .monitoreo_report_col(df, c("Completa", "completa"))
  if (nzchar(complete_col)) {
    complete_values <- df[[complete_col]]
    completed_mask <- completed_mask | if (is.logical(complete_values)) {
      !is.na(complete_values) & complete_values
    } else {
      .monitoreo_text_key(complete_values) %in% c("1", "true", "t", "yes", "si", "sí", "x")
    }
  }
  clean_names <- .monitoreo_text_key(names(df))
  label_map <- .monitoreo_variable_label_map(df)
  labels <- rep("", length(clean_names))
  names(labels) <- names(df)
  if (length(label_map)) {
    matched_labels <- label_map[names(df)]
    labels[!is.na(matched_labels)] <- matched_labels[!is.na(matched_labels)]
  }
  clean_labels <- .monitoreo_text_key(labels)
  actor_values <- .monitoreo_report_first_values(df, c("Actor", "actor", "dim_actor", "Unidad", "unidad"))
  actor_keys <- .monitoreo_text_key(actor_values)
  out <- rep(FALSE, nrow(df))
  for (rule in rules) {
    if (!isTRUE(rule$enabled)) next
    patterns <- .monitoreo_text_key(.monitoreo_chr_vec(rule$question_patterns))
    answers <- .monitoreo_text_key(.monitoreo_chr_vec(rule$rejection_answers))
    if (!length(patterns) || !length(answers)) next
    question_cols <- which(vapply(seq_along(clean_names), function(pos) {
      haystack <- paste(clean_names[[pos]], clean_labels[[pos]])
      all(vapply(patterns, function(p) grepl(p, haystack, fixed = TRUE), logical(1)))
    }, logical(1)))
    if (!length(question_cols)) next
    rule_actor <- .monitoreo_text_key(rule$actor)
    actor_match <- if (nzchar(rule_actor)) !nzchar(actor_keys) | actor_keys == rule_actor else rep(TRUE, nrow(df))
    for (pos in question_cols) {
      clean_answer <- .monitoreo_text_key(gsub("\\s*[|/]\\s*", " ", as.character(df[[pos]] %||% "")))
      out <- out | (completed_mask & actor_match & clean_answer %in% answers)
    }
  }
  out
}

.monitoreo_report_states <- function(df, profile = list()) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  out <- rep("Sin respuesta", nrow(df))
  role <- if (".source_role" %in% names(df)) .monitoreo_text_key(df$.source_role) else rep("", nrow(df))
  response_idx <- role == "respuestas"
  if (any(response_idx)) {
    response_status <- .monitoreo_report_first_values(df, c("response_status", "Estado", "estado", "Estatus", "estatus", "status", "Status"))
    out[response_idx] <- .monitoreo_report_state_from_status(response_status[response_idx], platform = TRUE)
  }
  operational_idx <- !response_idx
  if (any(operational_idx)) {
    operational_status <- .monitoreo_report_first_values(df, c("Status", "Estado", "estado", "Estatus", "estatus", "Estado campo", "Estado avance", "response_status", "status"))
    out[operational_idx] <- .monitoreo_report_state_from_status(operational_status[operational_idx], platform = FALSE)
  }
  bool_vec <- function(col) {
    if (!nzchar(col)) return(rep(FALSE, nrow(df)))
    x <- df[[col]]
    if (is.logical(x)) return(isTRUE(x) | (!is.na(x) & x))
    .monitoreo_text_key(x) %in% c("1", "true", "t", "yes", "si", "sí", "x")
  }
  complete_col <- .monitoreo_report_col(df, c("Completa", "completa"))
  partial_col <- .monitoreo_report_col(df, c("Parcial", "parcial"))
  rejection_col <- .monitoreo_report_col(df, c("Rechazo", "rechazo"))
  out[bool_vec(complete_col)] <- "Completa"
  out[bool_vec(partial_col)] <- "Parcial"
  out[bool_vec(rejection_col)] <- "Rechazo"
  profile <- monitoreo_normalize_profile(profile)
  if (length(profile$rejection_rules %||% list())) {
    response_idx <- which(role == "respuestas")
    if (length(response_idx)) {
      rejected <- .monitoreo_report_rejection_mask(df[response_idx, , drop = FALSE], profile)
      out[response_idx[rejected]] <- "Rechazo"
    }
  }
  out
}

.monitoreo_report_rejection_origin <- function(df, states) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  states <- as.character(states %||% rep("", nrow(df)))
  if (length(states) != nrow(df)) states <- rep("", nrow(df))
  role <- if (".source_role" %in% names(df)) .monitoreo_text_key(df$.source_role) else rep("", nrow(df))
  out <- rep("", nrow(df))
  rejection <- states == "Rechazo"
  out[rejection & role == "respuestas"] <- "plataforma"
  out[rejection & role == "barrido"] <- "telefono"
  out[rejection & !nzchar(out)] <- "sin_origen"
  out
}

.monitoreo_report_nonempty <- function(x) {
  x <- trimws(as.character(x %||% ""))
  !is.na(x) & nzchar(x)
}

.monitoreo_report_date_values <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  aliases <- c(
    "kobo_timestamp_iso", "kobo_fecha_iso", "kobo_fecha", "kobo_fecha_hora",
    "Fecha", "Fecha barrido", "Fecha de contacto", "Fecha creacion", "Fecha creación",
    "Fecha envio", "Fecha envío", "Fecha respuesta", "Fecha plataforma",
    "_submission_time", "submission_time", "submitted_at", "date_submitted",
    "date_modified", "date_created", "modified_at", "created_at",
    "end_time", "start_time", "end", "start", "date"
  )
  clean_names <- .monitoreo_text_key(names(df))
  clean_aliases <- .monitoreo_text_key(aliases)
  candidate_cols <- character(0)
  for (alias in clean_aliases) {
    idx <- which(clean_names == alias)
    if (length(idx)) candidate_cols <- c(candidate_cols, names(df)[idx])
  }
  for (alias in clean_aliases) {
    idx <- which(grepl(alias, clean_names, fixed = TRUE))
    if (length(idx)) candidate_cols <- c(candidate_cols, names(df)[idx])
  }
  candidate_cols <- unique(candidate_cols)
  if (!length(candidate_cols)) return(rep("Sin fecha", nrow(df)))
  parsed_out <- as.POSIXct(rep(NA_real_, nrow(df)), origin = "1970-01-01", tz = "UTC")
  raw_out <- rep("", nrow(df))
  for (col in candidate_cols) {
    raw <- trimws(as.character(df[[col]] %||% ""))
    raw[is.na(raw)] <- ""
    parsed <- .monitoreo_parse_time_vec(raw)
    needs_time <- is.na(parsed_out) & !is.na(parsed)
    if (any(needs_time)) parsed_out[needs_time] <- parsed[needs_time]
    needs_raw <- !nzchar(raw_out) & nzchar(raw)
    if (any(needs_raw)) raw_out[needs_raw] <- raw[needs_raw]
  }
  out <- ifelse(!is.na(parsed_out), as.character(as.Date(parsed_out)), raw_out)
  out[!nzchar(out) | is.na(out)] <- "Sin fecha"
  out
}

.monitoreo_report_status_values <- function(df) {
  col <- .monitoreo_report_col(df, c("Status", "Estatus", "Estado", "Estado campo", "Estado avance", "response_status"))
  if (!nzchar(col) || !nrow(df)) return(rep("Sin status", nrow(df)))
  out <- trimws(as.character(df[[col]]))
  out[!nzchar(out) | is.na(out)] <- "Sin status"
  out
}

.monitoreo_report_attempt_values <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(numeric(0))
  col <- .monitoreo_report_col(df, c(
    "Intentos", "Nro intentos", "Nro. intentos", "Numero de intentos",
    "Número de intentos", "# intentos", "Cantidad intentos", "Intento",
    "attempts", "call_attempts", "n_attempts"
  ))
  if (!nzchar(col)) return(rep(NA_real_, nrow(df)))
  raw <- trimws(as.character(df[[col]] %||% ""))
  raw[is.na(raw)] <- ""
  raw <- gsub(",", ".", raw, fixed = TRUE)
  raw <- sub("^.*?(-?\\d+(?:\\.\\d+)?).*$", "\\1", raw, perl = TRUE)
  out <- suppressWarnings(as.numeric(raw))
  out[!is.finite(out) | out < 0] <- NA_real_
  out
}

.monitoreo_report_case_keys <- function(row, profile = list(), origin = c("universo", "respuesta")) {
  origin <- match.arg(origin)
  if (is.null(row) || !is.list(row) || !length(row)) return(character(0))
  profile <- monitoreo_normalize_profile(profile)
  key_rules <- profile$key_rules %||% list()
  configured <- if (identical(origin, "respuesta")) key_rules$response_fields else key_rules$universe_fields
  aliases <- if (identical(origin, "respuesta")) {
    .monitoreo_response_key_aliases(configured)
  } else {
    c(configured, "CodPulso", "Código PUCP", "Codigo PUCP", "Código", "Codigo", "ID", "id", "correo", "email", "E-mail", "CORREO PUCP", "telefono", "celular", "TELÉFONO 1", "TELÉFONO 2", "TELÉFONO 3", "Teléfonos")
  }
  clean_names <- .monitoreo_text_key(names(row))
  keys <- character(0)
  for (alias in unique(.monitoreo_text_key(aliases))) {
    idx <- which(clean_names == alias)
    if (!length(idx)) next
    for (pos in idx) {
      value <- row[[pos]]
      if (is.null(value) || !length(value)) next
      value <- as.character(value[[1]] %||% "")
      if (is.na(value) || !nzchar(trimws(value))) next
      clean <- clean_names[[pos]]
      if (identical(origin, "respuesta") && !.monitoreo_response_key_name_allowed(names(row)[[pos]], configured)) next
      email <- .monitoreo_email_key(value)
      phone <- .monitoreo_phone_key(value)
      if (nzchar(email) && grepl("mail|correo|email", clean)) keys <- c(keys, paste0("email:", email))
      if (nzchar(phone) && grepl("telefono|celular|phone|fono", clean)) keys <- c(keys, paste0("telefono:", phone))
      if (grepl("codigo|cod|pulso|cv_id|custom_value|^id$", clean) || (!nzchar(email) && !nzchar(phone))) {
        keys <- c(keys, .monitoreo_code_keys(value))
      }
    }
  }
  unique(keys[nzchar(sub("^[^:]+:", "", keys))])
}

.monitoreo_report_key_list <- function(df, profile = list(), origin = c("universo", "respuesta")) {
  details <- .monitoreo_report_key_details(df, profile, origin)
  lapply(details, function(items) {
    if (!length(items)) return(character(0))
    unique(vapply(items, function(item) item$key %||% "", character(1)))
  })
}

.monitoreo_report_key_details <- function(df, profile = list(), origin = c("universo", "respuesta")) {
  origin <- match.arg(origin)
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  profile <- monitoreo_normalize_profile(profile)
  key_rules <- profile$key_rules %||% list()
  configured <- if (identical(origin, "respuesta")) key_rules$response_fields else key_rules$universe_fields
  aliases <- if (identical(origin, "respuesta")) {
    .monitoreo_response_key_aliases(configured)
  } else {
    c(configured, "CodPulso", "Código PUCP", "Codigo PUCP", "Código", "Codigo", "ID", "id", "correo", "email", "E-mail", "CORREO PUCP", "telefono", "celular", "TELÉFONO 1", "TELÉFONO 2", "TELÉFONO 3", "Teléfonos")
  }
  clean_names <- .monitoreo_text_key(names(df))
  label_map <- .monitoreo_variable_label_map(df)
  labels <- rep("", length(clean_names))
  names(labels) <- names(df)
  if (length(label_map)) {
    matched_labels <- label_map[names(df)]
    labels[!is.na(matched_labels)] <- matched_labels[!is.na(matched_labels)]
  }
  clean_labels <- .monitoreo_text_key(labels)
  positions <- integer(0)
  for (alias in unique(.monitoreo_text_key(aliases))) {
    if (!nzchar(alias)) next
    if (identical(origin, "respuesta")) {
      positions <- c(positions, which(clean_names == alias))
    } else {
      positions <- c(positions, which(
        clean_names == alias |
          clean_labels == alias |
          grepl(alias, clean_labels, fixed = TRUE)
      ))
    }
  }
  if (identical(origin, "respuesta")) {
    label_positions <- which(vapply(seq_along(clean_names), function(pos) {
      .monitoreo_response_key_label_allowed(names(df)[[pos]], labels[[pos]])
    }, logical(1)))
    positions <- c(positions, label_positions)
  }
  positions <- unique(positions)
  out <- vector("list", nrow(df))
  if (!length(positions)) return(out)
  append_key <- function(row_idx, keys, type, column, label, value) {
    keys <- unique(keys[nzchar(sub("^[^:]+:", "", keys))])
    if (!length(keys)) return(NULL)
    display_label <- if (nzchar(label)) label else column
    for (key in keys) {
      out[[row_idx]] <<- c(out[[row_idx]], list(list(
        key = key,
        type = type,
        column = column,
        label = display_label,
        value = value
      )))
    }
    invisible(NULL)
  }
  for (pos in positions) {
    clean <- clean_names[[pos]]
    label_clean <- clean_labels[[pos]]
    haystack <- paste(clean, label_clean)
    response_key_by_name <- !identical(origin, "respuesta") || .monitoreo_response_key_name_allowed(names(df)[[pos]], configured)
    response_key_by_label <- identical(origin, "respuesta") && .monitoreo_response_key_label_allowed(names(df)[[pos]], labels[[pos]])
    if (identical(origin, "respuesta") && !response_key_by_name && !response_key_by_label) next
    values <- trimws(as.character(df[[pos]] %||% ""))
    values[is.na(values)] <- ""
    idx <- which(nzchar(values))
    if (!length(idx)) next
    is_email_col <- if (identical(origin, "respuesta")) {
      response_key_by_name && grepl("mail|correo|email", clean)
    } else {
      grepl("mail|correo|email", haystack)
    }
    is_phone_col <- grepl("telefono|celular|phone|fono", haystack)
    is_explicit_code_col <- grepl("codigo|cod|pulso|cv_id|custom_value|^id$", clean)
    is_label_code_col <- !is_explicit_code_col && grepl("codigo|cod|pulso", label_clean)
    is_code_col <- is_explicit_code_col || is_label_code_col
    for (i in idx) {
      value <- values[[i]]
      keys <- character(0)
      email <- if (is_email_col) .monitoreo_email_key(value) else ""
      phone <- if (is_phone_col) .monitoreo_phone_key(value) else ""
      if (nzchar(email)) {
        key <- paste0("email:", email)
        keys <- c(keys, key)
        append_key(i, key, "email", names(df)[[pos]], labels[[pos]], value)
      }
      if (nzchar(phone)) {
        key <- paste0("telefono:", phone)
        keys <- c(keys, key)
        append_key(i, key, "telefono", names(df)[[pos]], labels[[pos]], value)
      }
      if (is_code_col && (!is_label_code_col || grepl("\\d", value))) {
        code_keys <- .monitoreo_code_keys(value)
        keys <- c(keys, code_keys)
        append_key(i, code_keys, "codigo", names(df)[[pos]], labels[[pos]], value)
      } else if (!is_code_col && !nzchar(email) && !nzchar(phone)) {
        code_keys <- .monitoreo_code_keys(value)
        keys <- c(keys, code_keys)
        append_key(i, code_keys, "codigo", names(df)[[pos]], labels[[pos]], value)
      }
    }
  }
  out <- lapply(out, function(items) {
    if (!length(items)) return(items)
    seen <- character(0)
    keep <- list()
    for (item in items) {
      fingerprint <- paste(item$key %||% "", item$column %||% "", item$value %||% "", sep = "\r")
      if (fingerprint %in% seen) next
      seen <- c(seen, fingerprint)
      keep[[length(keep) + 1L]] <- item
    }
    keep
  })
  out
}

.monitoreo_report_key_set <- function(keys_list) {
  unique(unlist(keys_list, use.names = FALSE))
}

.monitoreo_report_has_key <- function(keys, key_set) {
  length(keys) > 0L && length(key_set) > 0L && any(keys %in% key_set)
}

.monitoreo_reconciliation_decision_ids <- function(profile, field) {
  raw <- profile$reconciliation_decisions %||% profile$decisiones_conciliacion %||% list()
  if (!is.list(raw)) raw <- list()
  unique(.monitoreo_chr_vec(raw[[field]]))
}

.monitoreo_report_response_ids <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  out <- .monitoreo_report_first_values(df, c("response_id", "id_respuesta", "id respuesta", "id"))
  out[is.na(out)] <- ""
  trimws(out)
}

.monitoreo_report_apply_reconciliation_decisions <- function(out, data, response_mask, profile = list()) {
  if (!length(out) || !any(response_mask, na.rm = TRUE)) return(out)
  response_rows <- data[response_mask, , drop = FALSE]
  response_ids <- .monitoreo_report_response_ids(response_rows)
  if (!length(response_ids)) return(out)

  include_ids <- .monitoreo_reconciliation_decision_ids(profile, "include_response_ids")
  exclude_ids <- .monitoreo_reconciliation_decision_ids(profile, "exclude_response_ids")
  if (!length(include_ids) && !length(exclude_ids)) return(out)

  current <- out[response_mask]
  has_id <- nzchar(response_ids)
  if (length(include_ids)) current <- current | (has_id & response_ids %in% include_ids)
  if (length(exclude_ids)) current <- current & !(has_id & response_ids %in% exclude_ids)
  out[response_mask] <- current
  out
}

.monitoreo_reconciliation_decision <- function(result, response_id, profile = list()) {
  response_id <- trimws(.monitoreo_scalar(response_id, ""))
  include_ids <- .monitoreo_reconciliation_decision_ids(profile, "include_response_ids")
  exclude_ids <- .monitoreo_reconciliation_decision_ids(profile, "exclude_response_ids")
  if (nzchar(response_id) && response_id %in% exclude_ids) {
    return(list(
      label = "Excluido del avance",
      note = "Decision auditada: esta respuesta queda fuera del avance."
    ))
  }
  if (nzchar(response_id) && response_id %in% include_ids) {
    return(list(
      label = "Incluido en avance",
      note = "Decision auditada: esta respuesta se incluye en avance con salvedad contra base."
    ))
  }
  if (identical(result, "Cruzó")) {
    return(list(
      label = "Incluido en avance",
      note = "Incluido automaticamente: esta en base por llave exacta."
    ))
  }
  list(
    label = "Excluido del avance",
    note = "Excluido por defecto hasta corregir la llave, completar la base o decidir incluirlo en avance con salvedad."
  )
}

.monitoreo_report_base_mask <- function(data, unit = NULL) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(logical(0))
  unit_mask <- if (is.null(unit)) rep(TRUE, nrow(data)) else .monitoreo_report_unit_mask(data, unit)
  universe_mask <- unit_mask & .monitoreo_report_role_mask(data, "universo")
  barrido_mask <- unit_mask & .monitoreo_report_role_mask(data, "barrido")
  base_mask <- universe_mask | barrido_mask
  if (any(base_mask, na.rm = TRUE)) return(base_mask)
  rep(FALSE, nrow(data))
}

.monitoreo_report_response_reconciled_mask <- function(data, profile = list(), unit = NULL) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(logical(0))
  response_mask <- .monitoreo_report_role_mask(data, "respuestas")
  out <- rep(FALSE, nrow(data))
  if (!any(response_mask, na.rm = TRUE)) return(out)

  base_mask <- .monitoreo_report_base_mask(data, unit)
  if (!any(base_mask, na.rm = TRUE)) {
    out[response_mask] <- TRUE
    return(.monitoreo_report_apply_reconciliation_decisions(out, data, response_mask, profile))
  }

  base_rows <- data[base_mask, , drop = FALSE]
  base_keys <- .monitoreo_report_key_set(.monitoreo_report_key_list(base_rows, profile, "universo"))
  if (!length(base_keys)) {
    out[response_mask] <- TRUE
    return(.monitoreo_report_apply_reconciliation_decisions(out, data, response_mask, profile))
  }

  response_rows <- data[response_mask, , drop = FALSE]
  response_keys <- .monitoreo_report_key_list(response_rows, profile, "respuesta")
  out[response_mask] <- vapply(response_keys, .monitoreo_report_has_key, logical(1), key_set = base_keys)
  .monitoreo_report_apply_reconciliation_decisions(out, data, response_mask, profile)
}

.monitoreo_report_phone_reconciliation <- function(phone, responses, profile = list()) {
  phone_states <- .monitoreo_report_states(phone, profile)
  response_states <- .monitoreo_report_states(responses, profile)
  phone_keys <- .monitoreo_report_key_list(phone, profile, "universo")
  response_keys <- .monitoreo_report_key_list(responses, profile, "respuesta")
  response_complete_keys <- .monitoreo_report_key_set(response_keys[response_states == "Completa"])
  response_partial_keys <- .monitoreo_report_key_set(response_keys[response_states == "Parcial"])
  response_any_keys <- .monitoreo_report_key_set(response_keys[response_states %in% c("Completa", "Parcial", "Rechazo")])
  phone_effective <- phone_states == "Completa"
  phone_rejection <- phone_states == "Rechazo"
  phone_platform_complete <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_complete_keys)
  phone_platform_partial <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_partial_keys)
  phone_platform_any <- vapply(phone_keys, .monitoreo_report_has_key, logical(1), key_set = response_any_keys)
  effective_conciliated <- phone_platform_complete & phone_effective
  effective_partial <- phone_platform_partial & phone_effective
  rejection_with_response <- phone_platform_any & phone_rejection
  list(
    phone_effective = as.integer(sum(phone_effective, na.rm = TRUE)),
    phone_conciliated = as.integer(sum(effective_conciliated, na.rm = TRUE)),
    phone_without_complete = as.integer(sum(phone_effective & !effective_conciliated, na.rm = TRUE)),
    phone_effective_partial = as.integer(sum(effective_partial, na.rm = TRUE)),
    phone_rejection_with_response = as.integer(sum(rejection_with_response, na.rm = TRUE)),
    phone_platform_complete = phone_platform_complete,
    phone_platform_partial = phone_platform_partial,
    phone_platform_any = phone_platform_any,
    phone_effective_conciliated = effective_conciliated,
    phone_effective_partial_mask = effective_partial,
    phone_rejection_with_response_mask = rejection_with_response,
    phone_keys = phone_keys,
    response_keys = response_keys,
    response_states = response_states,
    phone_states = phone_states
  )
}

.monitoreo_report_trace_actor_values <- function(df) {
  actors <- .monitoreo_report_first_values(df, c("dim_actor", "Actor", "actor", "Unidad", "unidad"))
  if (!length(actors)) actors <- rep("", nrow(df))
  source_labels <- if (".source_label" %in% names(df)) as.character(df$.source_label %||% "") else rep("", nrow(df))
  needs <- !nzchar(trimws(actors)) | is.na(actors)
  if (any(needs)) {
    actors[needs] <- vapply(source_labels[needs], .monitoreo_report_source_unit, character(1))
  }
  actors[!nzchar(trimws(actors)) | is.na(actors)] <- "Sin actor"
  actors
}

.monitoreo_report_reconciliation_trace_df <- function(data, profile = list(), max_rows = 1200L) {
  empty <- data.frame(
    Actor = character(0),
    `Estado plataforma` = character(0),
    `Fuente respuesta` = character(0),
    response_id = character(0),
    `Fila respuesta` = integer(0),
    Resultado = character(0),
    `Llave usada` = character(0),
    `Tipo llave` = character(0),
    `Columna respuesta` = character(0),
    `Etiqueta respuesta` = character(0),
    `Valor respuesta` = character(0),
    `Registro base` = character(0),
    `Fuente base` = character(0),
    `Fila base` = integer(0),
    `Columna base` = character(0),
    `Etiqueta base` = character(0),
    `Valor base` = character(0),
    Confianza = character(0),
    `Decision avance` = character(0),
    `Motivo decision` = character(0),
    Nota = character(0),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(empty)

  response_mask <- .monitoreo_report_role_mask(data, "respuestas")
  if (!any(response_mask, na.rm = TRUE)) return(empty)

  base_mask <- .monitoreo_report_base_mask(data)
  response_rows <- data[response_mask, , drop = FALSE]
  response_idx <- which(response_mask)
  response_states <- .monitoreo_report_states(response_rows, profile)
  relevant <- response_states %in% c("Completa", "Parcial", "Rechazo")
  if (!any(relevant, na.rm = TRUE)) return(empty)

  response_details <- .monitoreo_report_key_details(response_rows, profile, "respuesta")
  response_sources <- if (".source_label" %in% names(response_rows)) as.character(response_rows$.source_label %||% "") else rep("", nrow(response_rows))
  response_ids <- .monitoreo_report_first_values(response_rows, c("response_id", "id_respuesta", "id respuesta", "id"))
  response_actors <- .monitoreo_report_trace_actor_values(response_rows)

  base_index <- list()
  if (any(base_mask, na.rm = TRUE)) {
    base_rows <- data[base_mask, , drop = FALSE]
    base_idx <- which(base_mask)
    base_details <- .monitoreo_report_key_details(base_rows, profile, "universo")
    base_sources <- if (".source_label" %in% names(base_rows)) as.character(base_rows$.source_label %||% "") else rep("", nrow(base_rows))
    base_ids <- .monitoreo_report_first_values(base_rows, c(
      "CodPulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP",
      "Código", "Codigo", "ID", "id", "correo", "email", "E-mail", "CORREO PUCP",
      "Nombre", "Nombres", "Apellidos"
    ))
    base_ids[!nzchar(trimws(base_ids)) | is.na(base_ids)] <- paste0("Fila base ", base_idx[!nzchar(trimws(base_ids)) | is.na(base_ids)])
    for (i in seq_along(base_details)) {
      items <- base_details[[i]]
      if (!length(items)) next
      for (item in items) {
        key <- item$key %||% ""
        if (!nzchar(key) || !is.null(base_index[[key]])) next
        base_index[[key]] <- c(item, list(
          row = base_idx[[i]],
          identifier = base_ids[[i]],
          source = base_sources[[i]]
        ))
      }
    }
  }

  rows <- list()
  make_row <- function(i, result, detail = NULL, base = NULL) {
    response_detail <- detail %||% list(key = "", type = "", column = "", label = "", value = "")
    base_detail <- base %||% list(key = "", type = "", column = "", label = "", value = "", row = NA_integer_, identifier = "", source = "")
    decision <- .monitoreo_reconciliation_decision(result, response_ids[[i]] %||% "", profile)
    note <- switch(result,
      "Cruzó" = "Respuesta vinculada al universo base por coincidencia exacta de llave.",
      "Sin cruce" = "La respuesta trae llave, pero no aparece en la base/barrido configurado.",
      "Sin llave" = "No se detecto una llave reconciliable en la respuesta.",
      ""
    )
    data.frame(
      Actor = response_actors[[i]],
      `Estado plataforma` = response_states[[i]],
      `Fuente respuesta` = response_sources[[i]],
      response_id = response_ids[[i]] %||% "",
      `Fila respuesta` = response_idx[[i]],
      Resultado = result,
      `Llave usada` = response_detail$key %||% "",
      `Tipo llave` = response_detail$type %||% "",
      `Columna respuesta` = response_detail$column %||% "",
      `Etiqueta respuesta` = response_detail$label %||% "",
      `Valor respuesta` = response_detail$value %||% "",
      `Registro base` = base_detail$identifier %||% "",
      `Fuente base` = base_detail$source %||% "",
      `Fila base` = suppressWarnings(as.integer(base_detail$row %||% NA_integer_)),
      `Columna base` = base_detail$column %||% "",
      `Etiqueta base` = base_detail$label %||% "",
      `Valor base` = base_detail$value %||% "",
      Confianza = if (identical(result, "Cruzó")) "Exacta por llave" else "Pendiente de revisión",
      `Decision avance` = decision$label %||% "",
      `Motivo decision` = decision$note %||% "",
      Nota = note,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }

  for (i in which(relevant)) {
    details <- response_details[[i]]
    if (!length(details)) {
      rows[[length(rows) + 1L]] <- make_row(i, "Sin llave")
      next
    }
    matched_detail <- NULL
    matched_base <- NULL
    for (detail in details) {
      base <- base_index[[detail$key %||% ""]]
      if (is.null(base)) next
      matched_detail <- detail
      matched_base <- base
      break
    }
    if (!is.null(matched_detail)) {
      rows[[length(rows) + 1L]] <- make_row(i, "Cruzó", matched_detail, matched_base)
    } else {
      rows[[length(rows) + 1L]] <- make_row(i, "Sin cruce", details[[1L]])
    }
  }

  if (!length(rows)) return(empty)
  out <- do.call(rbind, rows)
  order_key <- match(out$Resultado, c("Sin llave", "Sin cruce", "Cruzó"))
  order_key[is.na(order_key)] <- 4L
  out <- out[order(order_key, out$Actor, out$`Fuente respuesta`, out$`Estado plataforma`, out$response_id), , drop = FALSE]
  rownames(out) <- NULL
  utils::head(out, max(1L, as.integer(max_rows)))
}

.monitoreo_report_responsable_values <- function(df) {
  col <- .monitoreo_report_col(df, c("Responsable", "Encuestador", "Enumerador", "Operador"))
  if (!nzchar(col) || !nrow(df)) return(rep("Sin responsable", nrow(df)))
  out <- trimws(as.character(df[[col]]))
  out[!nzchar(out) | is.na(out)] <- "Sin responsable"
  out
}

.monitoreo_report_summary_df <- function(data, profile) {
  units <- .monitoreo_report_units(profile, data)
  roles <- as.character(data$.source_role %||% "")
  states_all <- .monitoreo_report_states(data, profile)
  rows <- lapply(units, function(unit) {
    unit_mask <- .monitoreo_report_unit_mask(data, unit)
    universe_mask <- unit_mask & roles == "universo"
    sweep_mask <- unit_mask & roles == "barrido"
    response_mask <- unit_mask & roles == "respuestas"
    total <- sum(universe_mask, na.rm = TRUE)
    if (!total && sum(sweep_mask, na.rm = TRUE)) total <- sum(sweep_mask, na.rm = TRUE)
    reconciled_mask <- .monitoreo_report_response_reconciled_mask(data, profile, unit)
    response_states <- states_all[response_mask]
    response_reconciled <- reconciled_mask[response_mask]
    sweep_states <- states_all[sweep_mask]
    completed_unlinked <- sum(response_states == "Completa" & !response_reconciled, na.rm = TRUE)
    partial_unlinked <- sum(response_states == "Parcial" & !response_reconciled, na.rm = TRUE)
    refusal_unlinked <- sum(response_states == "Rechazo" & !response_reconciled, na.rm = TRUE)
    completas <- sum(response_states == "Completa" & response_reconciled, na.rm = TRUE)
    parciales <- sum(response_states == "Parcial" & response_reconciled, na.rm = TRUE)
    rechazos_plataforma <- sum(response_states == "Rechazo", na.rm = TRUE)
    rechazos_telefono <- sum(sweep_states == "Rechazo", na.rm = TRUE)
    respondidas_plataforma <- completas + parciales + rechazos_plataforma
    sin_respuesta_plataforma <- max(0L, as.integer(total) - respondidas_plataforma)
    reconciliation <- .monitoreo_report_phone_reconciliation(
      data[sweep_mask, , drop = FALSE],
      data[response_mask, , drop = FALSE],
      profile
    )
    has_platform <- any(response_mask, na.rm = TRUE)
    effective_main <- if (has_platform) completas else reconciliation$phone_effective
    partial_main <- if (has_platform) parciales else 0L
    rejection_main <- if (has_platform) rechazos_plataforma else rechazos_telefono
    sin_respuesta <- max(0L, as.integer(total) - effective_main - partial_main - rejection_main)
    advance_origin <- if (has_platform) {
      "Plataforma"
    } else if (any(sweep_mask, na.rm = TRUE)) {
      "Barrido telefónico"
    } else {
      "Sin avance"
    }
    minimo <- .monitoreo_int(unit$minimum, NA_integer_)
    avance_minimo <- if (is.finite(minimo) && minimo > 0L) round(effective_main / minimo, 4) else NA_real_
    avance_total <- if (total > 0L) round(effective_main / total, 4) else NA_real_
    data.frame(
      Unidad = unit$label,
      Universo = as.integer(total),
      `Mínimo` = if (is.finite(minimo)) as.integer(minimo) else NA_integer_,
      `Respondidas plataforma` = as.integer(respondidas_plataforma),
      Efectivas = as.integer(effective_main),
      Completas = as.integer(effective_main),
      Parciales = as.integer(partial_main),
      Rechazos = as.integer(rejection_main),
      `Rechazos plataforma` = as.integer(rechazos_plataforma),
      `Rechazos telefónicos` = as.integer(rechazos_telefono),
      `Sin respuesta plataforma` = as.integer(sin_respuesta_plataforma),
      `Sin respuesta` = as.integer(sin_respuesta),
      `Efectivas telefónicas` = as.integer(reconciliation$phone_effective),
      `Efectivas telefónicas conciliadas` = as.integer(reconciliation$phone_conciliated),
      `Efectivas telefónicas sin plataforma completa` = as.integer(reconciliation$phone_without_complete),
      `Respuestas plataforma sin cruce base` = as.integer(completed_unlinked + partial_unlinked + refusal_unlinked),
      `Efectivas sin cruce base` = as.integer(completed_unlinked),
      `Parciales sin cruce base` = as.integer(partial_unlinked),
      `Rechazos plataforma sin cruce base` = as.integer(refusal_unlinked),
      `Origen avance` = advance_origin,
      `Avance mínimo` = avance_minimo,
      `Avance total` = avance_total,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_report_daily_df <- function(data, profile, effective_only = FALSE) {
  units <- .monitoreo_report_units(profile, data)
  response_mask_all <- .monitoreo_report_role_mask(data, "respuestas")
  use_responses <- any(response_mask_all, na.rm = TRUE)
  work <- if (use_responses) {
    data[response_mask_all, , drop = FALSE]
  } else {
    data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  }
  if (!nrow(work) || !length(units)) return(data.frame())
  states <- .monitoreo_report_states(work, profile)
  dates <- .monitoreo_report_date_values(work)
  dates_sorted <- sort(unique(dates[nzchar(dates)]))
  if (!length(dates_sorted)) dates_sorted <- "Sin fecha"
  state_rows <- if (effective_only) {
    list(Completa = "Efectivas")
  } else {
    list(Completa = "Efectivas", Parcial = "Parciales", Rechazo = if (use_responses) "Rechazos plataforma" else "Rechazos telefónicos")
  }
  rows <- list()
  for (unit in units) {
    unit_mask <- .monitoreo_report_unit_mask(work, unit)
    reconciled_mask <- if (use_responses) {
      .monitoreo_report_response_reconciled_mask(data, profile, unit)[response_mask_all]
    } else {
      rep(TRUE, nrow(work))
    }
    for (state in names(state_rows)) {
      values <- vapply(dates_sorted, function(day) {
        state_mask <- states == state
        if (!identical(state, "Rechazo")) state_mask <- state_mask & reconciled_mask
        sum(unit_mask & state_mask & dates == day, na.rm = TRUE)
      }, integer(1))
      rows[[length(rows) + 1L]] <- as.data.frame(as.list(c(
        Unidad = unit$label,
        Estado = state_rows[[state]],
        stats::setNames(as.list(as.integer(values)), dates_sorted),
        Total = as.integer(sum(values))
      )), check.names = FALSE, stringsAsFactors = FALSE)
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_report_channel_label <- function(value, role = "", label = "") {
  text <- trimws(as.character(value %||% ""))
  key <- .monitoreo_safe_name(text)
  label_key <- .monitoreo_safe_name(label)
  if (key %in% c("telefono", "telefonico", "phone", "llamada")) return("Telefónico")
  if (key %in% c("whatsapp", "wsp")) return("WhatsApp")
  if (key %in% c("presencial", "qr", "ficha_qr", "fichas_qr", "ficha")) return("Ficha QR")
  if (key %in% c("correo", "email", "mail", "web", "link", "enlace")) return("Correo")
  if (identical(.monitoreo_safe_name(role), "barrido")) return("Telefónico")
  if (grepl("whatsapp", label_key, fixed = TRUE)) return("WhatsApp")
  if (grepl("telefon", label_key, fixed = TRUE)) return("Telefónico")
  if (grepl("qr", label_key, fixed = TRUE) || grepl("presencial", label_key, fixed = TRUE)) return("Ficha QR")
  if (nzchar(text)) return(text)
  "Correo"
}

.monitoreo_report_channel_values <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(character(0))
  channel_col <- .monitoreo_report_col(df, c("dim_canal", "dim_channel", "dim_modalidad", "Canal", "canal", "channel", "modalidad"))
  raw <- if (nzchar(channel_col)) as.character(df[[channel_col]]) else rep("", nrow(df))
  roles <- as.character(df$.source_role %||% "")
  labels <- as.character(df$.source_label %||% "")
  vapply(seq_len(nrow(df)), function(i) .monitoreo_report_channel_label(raw[[i]], roles[[i]], labels[[i]]), character(1))
}

.monitoreo_report_daily_channel_df <- function(data, profile = list()) {
  response_mask_all <- .monitoreo_report_role_mask(data, "respuestas")
  use_responses <- any(response_mask_all, na.rm = TRUE)
  work <- if (use_responses) {
    data[response_mask_all, , drop = FALSE]
  } else {
    data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  }
  if (!nrow(work)) return(data.frame())
  states <- .monitoreo_report_states(work, profile)
  dates <- .monitoreo_report_date_values(work)
  channels <- .monitoreo_report_channel_values(work)
  reconciled <- if (use_responses) {
    .monitoreo_report_response_reconciled_mask(data, profile)[response_mask_all]
  } else {
    rep(TRUE, nrow(work))
  }
  dates_sorted <- sort(unique(dates[nzchar(dates)]))
  if (!length(dates_sorted)) dates_sorted <- "Sin fecha"
  state_rows <- list(Completa = "Efectivas", Parcial = "Parciales", Rechazo = if (use_responses) "Rechazos plataforma" else "Rechazos telefónicos")
  rows <- list()
  for (channel in sort(unique(channels))) {
    channel_mask <- channels == channel
    for (state in names(state_rows)) {
      values <- vapply(dates_sorted, function(day) {
        state_mask <- states == state
        if (!identical(state, "Rechazo")) state_mask <- state_mask & reconciled
        sum(channel_mask & state_mask & dates == day, na.rm = TRUE)
      }, integer(1))
      if (!sum(values, na.rm = TRUE)) next
      rows[[length(rows) + 1L]] <- as.data.frame(as.list(c(
        Canal = channel,
        Estado = state_rows[[state]],
        stats::setNames(as.list(as.integer(values)), dates_sorted),
        Total = as.integer(sum(values))
      )), check.names = FALSE, stringsAsFactors = FALSE)
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_report_daily_source_df <- function(data, profile = list()) {
  response_mask_all <- .monitoreo_report_role_mask(data, "respuestas")
  use_responses <- any(response_mask_all, na.rm = TRUE)
  work <- if (use_responses) {
    data[response_mask_all, , drop = FALSE]
  } else {
    data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  }
  if (!nrow(work)) return(data.frame())
  states <- .monitoreo_report_states(work, profile)
  dates <- .monitoreo_report_date_values(work)
  channels <- .monitoreo_report_channel_values(work)
  actors <- .monitoreo_report_first_values(work, c("dim_actor", "Actor", "actor", "Unidad", "unidad"))
  source_ids <- if (".source_id" %in% names(work)) trimws(as.character(work$.source_id %||% "")) else rep("", nrow(work))
  source_labels <- if (".source_label" %in% names(work)) trimws(as.character(work$.source_label %||% "Respuestas")) else rep("Respuestas", nrow(work))
  source_labels[!nzchar(source_labels) | is.na(source_labels)] <- if (use_responses) "Respuestas" else "Barrido"
  source_keys <- ifelse(nzchar(source_ids), source_ids, source_labels)
  units <- .monitoreo_report_units(profile, data)
  reconciled_global <- if (use_responses) {
    .monitoreo_report_response_reconciled_mask(data, profile)[response_mask_all]
  } else {
    rep(TRUE, nrow(work))
  }
  dates_sorted <- sort(unique(dates[nzchar(dates)]))
  if (!length(dates_sorted)) dates_sorted <- "Sin fecha"
  state_rows <- list(Completa = "Efectivas", Parcial = "Parciales", Rechazo = if (use_responses) "Rechazos plataforma" else "Rechazos telefónicos")
  source_order <- unique(source_keys)
  rows <- list()
  for (source_key in source_order) {
    source_mask <- source_keys == source_key
    first_idx <- which(source_mask)[[1]]
    source_id <- source_ids[[first_idx]] %||% ""
    source_label <- source_labels[[first_idx]]
    channel <- channels[[first_idx]] %||% ""
    if (!nzchar(channel) || is.na(channel)) channel <- "Sin canal"
    actor <- .monitoreo_report_source_actor(actors[[first_idx]] %||% "", source_label, profile, channel)
    unit <- NULL
    actor_key <- .monitoreo_report_unit_key(actor)
    for (candidate in units) {
      if (identical(.monitoreo_scalar(candidate$key, ""), actor_key) ||
          identical(.monitoreo_report_unit_key(candidate$label), actor_key)) {
        unit <- candidate
        break
      }
    }
    reconciled <- if (is.null(unit) || !use_responses) reconciled_global else {
      .monitoreo_report_response_reconciled_mask(data, profile, unit)[response_mask_all]
    }
    for (state in names(state_rows)) {
      values <- vapply(dates_sorted, function(day) {
        state_mask <- states == state
        if (!identical(state, "Rechazo")) state_mask <- state_mask & reconciled
        sum(source_mask & state_mask & dates == day, na.rm = TRUE)
      }, integer(1))
      total <- as.integer(sum(values))
      if (!total) next
      rows[[length(rows) + 1L]] <- as.data.frame(as.list(c(
        source_id = source_id,
        Fuente = source_label,
        Actor = actor,
        Canal = channel,
        Estado = state_rows[[state]],
        stats::setNames(as.list(as.integer(values)), dates_sorted),
        Total = total
      )), check.names = FALSE, stringsAsFactors = FALSE)
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_client_report_pct <- function(num, den) {
  num <- suppressWarnings(as.numeric(num))
  den <- suppressWarnings(as.numeric(den))
  if (!is.finite(num) || !is.finite(den) || den <= 0) return(NA_real_)
  round(num / den, 4)
}

.monitoreo_client_report_date_cols <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !ncol(df)) return(character(0))
  reserved <- .monitoreo_text_key(c(
    "Unidad", "Actor", "Canal", "Fuente", "Estado", "Total", "source_id",
    "Universo", "Mínimo", "Minimo", "Efectivas", "Parciales", "Rechazos",
    "Rechazos plataforma", "Rechazos telefónicos", "Sin respuesta plataforma",
    "Origen avance", "Avance"
  ))
  names(df)[!vapply(.monitoreo_text_key(names(df)), function(x) x %in% reserved, logical(1))]
}

.monitoreo_report_control_value <- function(value, type = "texto") {
  value <- trimws(as.character(value %||% ""))
  value[is.na(value) | !nzchar(value)] <- "Sin dato"
  if (identical(.monitoreo_text_key(type), "anio")) {
    year <- regmatches(value, regexpr("(19|20)[0-9]{2}", value))
    has_year <- nzchar(year)
    value[has_year] <- year[has_year]
  }
  value
}

.monitoreo_report_control_specs <- function(data, profile = list()) {
  specs <- list(
    list(actor = "Egresados", label = "Año de egreso", type = "anio", aliases = c(
      "Ciclo de egreso", "CICLO DE EGRESO", "Año de egreso", "Anio de egreso",
      "Promocion", "Promoción", "Ciclo"
    )),
    list(actor = "Docentes", label = "Tipo de dedicación", type = "texto", aliases = c(
      "Dedicación", "Dedicacion", "Tipo de dedicación", "Tipo de dedicacion",
      "DEDICACIÓN", "DEDICACION"
    )),
    list(actor = "Docentes", label = "Categoría docente", type = "texto", aliases = c(
      "Categoría", "Categoria", "Categoría docente", "Categoria docente",
      "CATEGORÍA", "CATEGORIA"
    )),
    list(actor = "Administrativos", label = "Área de trabajo", type = "texto", aliases = c(
      "Área de trabajo", "Area de trabajo", "Unidad administrativa", "Oficina",
      "Dependencia", "Área", "Area"
    ))
  )
  configured <- .monitoreo_chr_vec(profile$control_vars %||% list())
  if (length(configured)) {
    for (field in configured) {
      specs[[length(specs) + 1L]] <- list(
        actor = "",
        label = field,
        type = "texto",
        aliases = c(field)
      )
    }
  }
  specs
}

.monitoreo_report_control_distribution_df <- function(data, profile = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data.frame())
  units <- .monitoreo_report_units(profile, data)
  if (!length(units)) return(data.frame())
  specs <- .monitoreo_report_control_specs(data, profile)
  states_all <- .monitoreo_report_states(data, profile)
  roles <- as.character(data$.source_role %||% "")
  rows <- list()

  for (unit in units) {
    unit_key <- .monitoreo_report_unit_key(unit$label)
    unit_spec <- Filter(function(spec) {
      actor <- .monitoreo_report_unit_key(spec$actor %||% "")
      !nzchar(actor) || identical(actor, unit_key)
    }, specs)
    if (!length(unit_spec)) next

    universe_mask <- .monitoreo_report_unit_mask(data, unit, roles = "universo")
    barrido_mask <- .monitoreo_report_unit_mask(data, unit, roles = "barrido")
    base_mask <- if (any(universe_mask, na.rm = TRUE)) universe_mask else barrido_mask
    response_mask <- .monitoreo_report_unit_mask(data, unit, roles = "respuestas")
    if (!any(base_mask, na.rm = TRUE) || !any(response_mask, na.rm = TRUE)) next

    base <- data[base_mask, , drop = FALSE]
    responses <- data[response_mask, , drop = FALSE]
    response_states <- states_all[response_mask]
    reconciled <- .monitoreo_report_response_reconciled_mask(data, profile, unit)[response_mask]
    response_keys <- .monitoreo_report_key_list(responses, profile, "respuesta")
    completed_keys <- .monitoreo_report_key_set(response_keys[response_states == "Completa" & reconciled])
    partial_keys <- .monitoreo_report_key_set(response_keys[response_states == "Parcial" & reconciled])
    refusal_keys <- .monitoreo_report_key_set(response_keys[response_states == "Rechazo"])
    base_keys <- .monitoreo_report_key_list(base, profile, "universo")
    base_effective <- vapply(base_keys, .monitoreo_report_has_key, logical(1), key_set = completed_keys)
    base_partial <- !base_effective & vapply(base_keys, .monitoreo_report_has_key, logical(1), key_set = partial_keys)
    base_refusal <- !base_effective & !base_partial & vapply(base_keys, .monitoreo_report_has_key, logical(1), key_set = refusal_keys)

    for (spec in unit_spec) {
      col <- .monitoreo_report_col(base, spec$aliases %||% character(0))
      if (!nzchar(col)) next
      values <- .monitoreo_report_control_value(base[[col]], spec$type %||% "texto")
      levels <- unique(values)
      if (identical(.monitoreo_text_key(spec$type %||% ""), "anio")) {
        levels <- levels[order(suppressWarnings(as.integer(ifelse(levels == "Sin dato", "9999", levels))), levels)]
      } else {
        levels <- levels[order(levels)]
      }
      total_universe <- length(values)
      total_effective <- sum(base_effective, na.rm = TRUE)
      for (value in levels) {
        value_mask <- values == value
        universe <- sum(value_mask, na.rm = TRUE)
        effective <- sum(value_mask & base_effective, na.rm = TRUE)
        partial <- sum(value_mask & base_partial, na.rm = TRUE)
        refusal <- sum(value_mask & base_refusal, na.rm = TRUE)
        unanswered <- max(0L, universe - effective - partial - refusal)
        universe_share <- if (total_universe > 0L) universe / total_universe else NA_real_
        effective_share <- if (total_effective > 0L) effective / total_effective else NA_real_
        delta <- if (is.finite(universe_share) && is.finite(effective_share)) (effective_share - universe_share) * 100 else NA_real_
        rows[[length(rows) + 1L]] <- data.frame(
          Actor = unit$label,
          Variable = spec$label %||% col,
          Valor = value,
          Universo = as.integer(universe),
          Efectivas = as.integer(effective),
          Parciales = as.integer(partial),
          `Rechazos plataforma` = as.integer(refusal),
          `Sin respuesta plataforma` = as.integer(unanswered),
          `% base` = round(universe_share, 4),
          `% efectivas` = round(effective_share, 4),
          `Diferencia pp` = round(delta, 1),
          `Columna origen` = col,
          check.names = FALSE,
          stringsAsFactors = FALSE
        )
      }
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_internal_empty_queries <- function() {
  list(
    schema = "monitoreo_acreditacion_internal_queries_v1",
    cases = list(),
    totals = list(
      actor = list(),
      date = list(),
      channel = list(),
      source = list(),
      collector = list()
    ),
    pending_exit = list(),
    issues = list(),
    flow = list(nodes = list(), links = list())
  )
}

.monitoreo_internal_pending_base <- function(status, source = "", role = "") {
  key <- .monitoreo_text_key(paste(status, source, role))
  if (!nzchar(key)) return(FALSE)
  grepl("faltant", key) ||
    grepl("pendient", key) ||
    grepl("no barrido|nobarrido", key) ||
    grepl("sin respuesta|no respuesta", key) ||
    grepl("no contesta|contactar despues|contactar_despues", key)
}

.monitoreo_internal_collector_label <- function(collector_id, collector_name) {
  collector_id <- .monitoreo_scalar(collector_id, "")
  collector_name <- .monitoreo_scalar(collector_name, "")
  if (nzchar(collector_name) && nzchar(collector_id) && !identical(collector_name, collector_id)) {
    return(paste0(collector_name, " (", collector_id, ")"))
  }
  if (nzchar(collector_name)) return(collector_name)
  if (nzchar(collector_id)) return(collector_id)
  "Sin recopilador"
}

.monitoreo_internal_is_recovery_collector <- function(collector_id, collector_name, source_label = "") {
  key <- .monitoreo_safe_name(paste(collector_id, collector_name, source_label))
  grepl("faltante|faltantes|recuperacion|recuperacion", key)
}

.monitoreo_internal_decision_for <- function(result, response_id, profile = list(), has_base = TRUE) {
  if (!isTRUE(has_base) && !identical(result, "Sin llave")) {
    return(list(
      label = "Incluido en avance",
      note = "Incluido porque no hay base local configurada para contrastar esta respuesta."
    ))
  }
  .monitoreo_reconciliation_decision(result, response_id, profile)
}

.monitoreo_internal_advancement <- function(state, decision_label) {
  state_key <- .monitoreo_text_key(state)
  decision_key <- .monitoreo_text_key(decision_label)
  included <- grepl("incluido", decision_key)
  if (identical(state_key, "completa") && included) return("effective")
  if (identical(state_key, "parcial")) return("partial")
  if (identical(state_key, "rechazo")) return("refusal")
  if (included) return("included_review")
  "excluded"
}

.monitoreo_internal_issue_type <- function(state, result, advancement, key) {
  state_key <- .monitoreo_text_key(state)
  result_key <- .monitoreo_text_key(result)
  if (identical(advancement, "effective")) return("efectiva_real")
  if (identical(state_key, "parcial")) {
    return(if (nzchar(.monitoreo_scalar(key, ""))) "parcial_identificable" else "parcial_no_identificable")
  }
  if (identical(state_key, "rechazo")) return("rechazo_plataforma")
  if (grepl("sin llave", result_key)) return("sin_llave")
  if (grepl("sin cruce", result_key)) return("fuera_base")
  if (identical(advancement, "included_review")) return("incluido_con_salvedad")
  "revision"
}

.monitoreo_internal_issue_label <- function(type) {
  switch(type,
    efectiva_real = "Efectiva real",
    parcial_identificable = "Parcial identificable",
    parcial_no_identificable = "Parcial no identificable",
    rechazo_plataforma = "Rechazo de plataforma",
    sin_respuesta = "Sin respuesta",
    sin_llave = "Respuesta sin llave",
    fuera_base = "Llave fuera de base",
    incluido_con_salvedad = "Incluido con salvedad",
    duplicado_caso = "Caso duplicado",
    "Revisión"
  )
}

.monitoreo_internal_case_priority <- function(row) {
  advancement <- .monitoreo_scalar(row$advancement, "")
  state <- .monitoreo_text_key(row$platform_state)
  base <- switch(advancement,
    effective = 50,
    included_review = 40,
    partial = 30,
    refusal = 20,
    pending = 8,
    excluded = 10,
    1
  )
  if (identical(state, "completa")) base <- max(base, 45)
  if (identical(state, "parcial")) base <- max(base, 30)
  if (identical(state, "rechazo")) base <- max(base, 20)
  parsed <- suppressWarnings(tryCatch(
    as.Date(.monitoreo_scalar(row$date, "")),
    error = function(e) as.Date(NA)
  ))
  date_bonus <- if (!is.na(parsed)) as.integer(parsed - as.Date("1970-01-01")) / 100000 else 0
  base + date_bonus
}

.monitoreo_internal_records_to_df <- function(rows) {
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, lapply(rows, function(row) {
    as.data.frame(row, check.names = FALSE, stringsAsFactors = FALSE)
  }))
  rownames(out) <- NULL
  out
}

.monitoreo_internal_deduplicate_cases <- function(cases_df) {
  if (is.null(cases_df) || !is.data.frame(cases_df) || !nrow(cases_df)) return(cases_df)
  dedupe_key <- as.character(cases_df$case_key %||% "")
  fallback <- as.character(cases_df$response_id %||% "")
  dedupe_key[!nzchar(dedupe_key) | is.na(dedupe_key)] <- paste0("response:", fallback[!nzchar(dedupe_key) | is.na(dedupe_key)])
  dedupe_key[!nzchar(dedupe_key) | is.na(dedupe_key)] <- paste0("row:", seq_len(nrow(cases_df))[!nzchar(dedupe_key) | is.na(dedupe_key)])
  priorities <- vapply(seq_len(nrow(cases_df)), function(i) {
    .monitoreo_internal_case_priority(as.list(cases_df[i, , drop = FALSE]))
  }, numeric(1))
  keep <- logical(nrow(cases_df))
  for (key in unique(dedupe_key)) {
    idx <- which(dedupe_key == key)
    best <- idx[which.max(priorities[idx])]
    keep[best] <- TRUE
  }
  cases_df[keep, , drop = FALSE]
}

.monitoreo_internal_totals_df <- function(cases_df, group_col, group_label = "grupo") {
  if (is.null(cases_df) || !is.data.frame(cases_df) || !nrow(cases_df) || !group_col %in% names(cases_df)) {
    return(data.frame())
  }
  group <- trimws(as.character(cases_df[[group_col]] %||% ""))
  group[!nzchar(group) | is.na(group)] <- "Sin dato"
  df <- data.frame(
    grupo = group,
    total = 1L,
    efectivas = as.integer(cases_df$advancement == "effective"),
    parciales = as.integer(cases_df$advancement == "partial"),
    rechazos = as.integer(cases_df$advancement == "refusal"),
    pendientes = as.integer(cases_df$advancement == "pending"),
    revision = as.integer(!cases_df$advancement %in% c("effective", "partial", "refusal", "pending")),
    salen_de_pendientes = as.integer(cases_df$pending_exit %in% TRUE | cases_df$pending_exit == "TRUE"),
    stringsAsFactors = FALSE
  )
  out <- stats::aggregate(
    df[, c("total", "efectivas", "parciales", "rechazos", "pendientes", "revision", "salen_de_pendientes"), drop = FALSE],
    by = list(grupo = df$grupo),
    FUN = sum
  )
  names(out)[names(out) == "grupo"] <- group_label
  out <- out[order(-out$efectivas, -out$total, out[[group_label]]), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.monitoreo_internal_case_issues <- function(cases_df) {
  if (is.null(cases_df) || !is.data.frame(cases_df) || !nrow(cases_df)) return(data.frame())
  rows <- list()
  for (i in seq_len(nrow(cases_df))) {
    type <- .monitoreo_scalar(cases_df$issue_type[[i]], "revision")
    if (type %in% c("efectiva_real", "sin_respuesta")) next
    rows[[length(rows) + 1L]] <- data.frame(
      issue_type = type,
      label = .monitoreo_internal_issue_label(type),
      severity = if (type %in% c("sin_llave", "fuera_base")) "alta" else "media",
      actor = cases_df$actor[[i]],
      case_key = cases_df$case_key[[i]],
      response_id = cases_df$response_id[[i]],
      count = 1L,
      detail = cases_df$rule[[i]],
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  key <- as.character(cases_df$case_key %||% "")
  key <- key[nzchar(key) & !is.na(key)]
  if (length(key)) {
    tab <- table(key)
    duplicated_keys <- names(tab)[tab > 1L]
    for (dup in duplicated_keys) {
      subset <- cases_df[cases_df$case_key == dup, , drop = FALSE]
      rows[[length(rows) + 1L]] <- data.frame(
        issue_type = "duplicado_caso",
        label = .monitoreo_internal_issue_label("duplicado_caso"),
        severity = "alta",
        actor = subset$actor[[1]],
        case_key = dup,
        response_id = paste(subset$response_id[nzchar(subset$response_id)], collapse = ", "),
        count = as.integer(nrow(subset)),
        detail = "Varias respuestas comparten la misma llave; el conteo interno prioriza completa válida sobre parcial o rechazo.",
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_internal_flow <- function(cases_df) {
  if (is.null(cases_df) || !is.data.frame(cases_df) || !nrow(cases_df)) {
    return(list(nodes = list(), links = list()))
  }
  base_layer <- ifelse(
    cases_df$pending_exit %in% TRUE | cases_df$pending_exit == "TRUE",
    "Faltantes / barrido",
    ifelse(cases_df$base_result == "Cruzó", "En base", "Fuera de base")
  )
  stages <- data.frame(
    base = base_layer,
    channel = ifelse(nzchar(cases_df$channel), cases_df$channel, "Sin canal"),
    state = ifelse(nzchar(cases_df$platform_state), cases_df$platform_state, "Sin estado"),
    decision = ifelse(nzchar(cases_df$decision), cases_df$decision, "Sin decisión"),
    stringsAsFactors = FALSE
  )
  link_parts <- list(
    data.frame(source = stages$base, target = stages$channel, stringsAsFactors = FALSE),
    data.frame(source = stages$channel, target = stages$state, stringsAsFactors = FALSE),
    data.frame(source = stages$state, target = stages$decision, stringsAsFactors = FALSE)
  )
  links <- do.call(rbind, link_parts)
  links$value <- 1L
  links <- stats::aggregate(value ~ source + target, data = links, FUN = sum)
  links <- links[order(-links$value, links$source, links$target), , drop = FALSE]
  nodes <- unique(c(as.character(links$source), as.character(links$target)))
  nodes_df <- data.frame(
    id = vapply(nodes, .monitoreo_safe_name, character(1)),
    label = nodes,
    stringsAsFactors = FALSE
  )
  list(
    nodes = .monitoreo_report_records(nodes_df),
    links = .monitoreo_report_records(links)
  )
}

.monitoreo_acreditacion_internal_queries <- function(data, profile = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(.monitoreo_internal_empty_queries())
  profile <- monitoreo_normalize_profile(profile)
  response_mask <- .monitoreo_report_role_mask(data, "respuestas")
  base_mask <- .monitoreo_report_base_mask(data)
  if (!any(response_mask, na.rm = TRUE) && !any(base_mask, na.rm = TRUE)) {
    return(.monitoreo_internal_empty_queries())
  }
  response_rows <- data[response_mask, , drop = FALSE]
  response_idx <- which(response_mask)
  response_states <- .monitoreo_report_states(response_rows, profile)
  response_dates <- .monitoreo_report_date_values(response_rows)
  response_channels <- .monitoreo_report_channel_values(response_rows)
  response_actors <- .monitoreo_report_trace_actor_values(response_rows)
  response_details <- .monitoreo_report_key_details(response_rows, profile, "respuesta")
  response_ids <- .monitoreo_report_response_ids(response_rows)
  response_person <- .monitoreo_report_person_values(response_rows)
  source_ids <- if (".source_id" %in% names(response_rows)) trimws(as.character(response_rows$.source_id %||% "")) else rep("", nrow(response_rows))
  source_labels <- if (".source_label" %in% names(response_rows)) trimws(as.character(response_rows$.source_label %||% "")) else rep("", nrow(response_rows))
  collector_ids <- .monitoreo_report_first_values(response_rows, c("collector_id", "id_recopilador", "recopilador_id"))
  collector_names <- .monitoreo_report_first_values(response_rows, c("collector_name", "Nombre recopilador", "nombre_recopilador", "Recopilador", "recopilador"))

  base_index <- list()
  base_records <- list()
  has_base <- any(base_mask, na.rm = TRUE)
  if (has_base) {
    base_rows <- data[base_mask, , drop = FALSE]
    base_idx <- which(base_mask)
    base_details <- .monitoreo_report_key_details(base_rows, profile, "universo")
    base_sources <- if (".source_label" %in% names(base_rows)) as.character(base_rows$.source_label %||% "") else rep("", nrow(base_rows))
    base_source_ids <- if (".source_id" %in% names(base_rows)) as.character(base_rows$.source_id %||% "") else rep("", nrow(base_rows))
    base_roles <- if (".source_role" %in% names(base_rows)) as.character(base_rows$.source_role %||% "") else rep("", nrow(base_rows))
    base_status <- .monitoreo_report_status_values(base_rows)
    base_dates <- .monitoreo_report_date_values(base_rows)
    base_channels <- .monitoreo_report_channel_values(base_rows)
    base_actors <- .monitoreo_report_trace_actor_values(base_rows)
    base_people <- .monitoreo_report_person_values(base_rows)
    base_responsibles <- .monitoreo_report_responsable_values(base_rows)
    base_ids <- .monitoreo_report_first_values(base_rows, c(
      "CodPulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP",
      "Código", "Codigo", "ID", "id", "correo", "email", "E-mail", "CORREO PUCP",
      "Nombre", "Nombres", "Apellidos"
    ))
    base_ids[!nzchar(trimws(base_ids)) | is.na(base_ids)] <- paste0("Fila base ", base_idx[!nzchar(trimws(base_ids)) | is.na(base_ids)])
    for (i in seq_along(base_details)) {
      items <- base_details[[i]]
      if (!length(items)) next
      primary <- items[[1L]]
      item_keys <- unique(vapply(items, function(item) item$key %||% "", character(1)))
      item_keys <- item_keys[nzchar(item_keys)]
      base_record <- c(primary, list(
        row = base_idx[[i]],
        identifier = base_ids[[i]],
        source_id = base_source_ids[[i]],
        source = base_sources[[i]],
        role = base_roles[[i]],
        status = base_status[[i]],
        date = base_dates[[i]],
        channel = base_channels[[i]],
        actor = base_actors[[i]],
        person = base_people[[i]],
        responsible = base_responsibles[[i]],
        pending = .monitoreo_internal_pending_base(base_status[[i]], base_sources[[i]], base_roles[[i]]),
        all_keys = as.list(item_keys)
      ))
      base_records[[length(base_records) + 1L]] <- base_record
      for (item in items) {
        key <- item$key %||% ""
        if (!nzchar(key) || !is.null(base_index[[key]])) next
        base_index[[key]] <- c(item, list(
          row = base_idx[[i]],
          identifier = base_ids[[i]],
          source_id = base_source_ids[[i]],
          source = base_sources[[i]],
          role = base_roles[[i]],
          status = base_status[[i]],
          date = base_dates[[i]],
          channel = base_channels[[i]],
          actor = base_actors[[i]],
          person = base_people[[i]],
          responsible = base_responsibles[[i]],
          pending = .monitoreo_internal_pending_base(base_status[[i]], base_sources[[i]], base_roles[[i]]),
          all_keys = as.list(item_keys)
        ))
      }
    }
  }

  cases <- list()
  answered_base_keys <- character(0)
  relevant <- response_states %in% c("Completa", "Parcial", "Rechazo")
  for (i in which(relevant)) {
    details <- response_details[[i]]
    response_id <- response_ids[[i]] %||% ""
    result <- "Sin llave"
    detail <- list(key = "", type = "", column = "", label = "", value = "")
    base <- NULL
    if (length(details)) {
      detail <- details[[1L]]
      result <- if (has_base) "Sin cruce" else "Sin base configurada"
      if (has_base) {
        for (candidate in details) {
          candidate_base <- base_index[[candidate$key %||% ""]]
          if (is.null(candidate_base)) next
          detail <- candidate
          base <- candidate_base
          result <- "Cruzó"
          answered_base_keys <- c(answered_base_keys, unlist(candidate_base$all_keys %||% list(candidate$key %||% ""), use.names = FALSE))
          break
        }
      }
    }
    decision <- .monitoreo_internal_decision_for(result, response_id, profile, has_base = has_base)
    advancement <- .monitoreo_internal_advancement(response_states[[i]], decision$label)
    issue_type <- .monitoreo_internal_issue_type(response_states[[i]], result, advancement, detail$key %||% "")
    collector_label <- .monitoreo_internal_collector_label(collector_ids[[i]], collector_names[[i]])
    case_channel <- response_channels[[i]] %||% ""
    if (!is.null(base)) {
      base_responsible <- .monitoreo_scalar(base$responsible %||% "", "")
      base_responsible_key <- .monitoreo_text_key(base_responsible)
      base_channel_key <- .monitoreo_text_key(paste(
        response_channels[[i]] %||% "",
        base$channel %||% "",
        base$source %||% "",
        base$role %||% ""
      ))
      if (nzchar(base_responsible) &&
          !grepl("sin responsable|sin asignar|no asignad", base_responsible_key) &&
          grepl("telefon|barrido|llamada", base_channel_key)) {
        collector_label <- base_responsible
        case_channel <- base$channel %||% "Telefónico"
      }
    }
    base_pending <- isTRUE(base$pending %||% FALSE)
    recovery_collector <- .monitoreo_internal_is_recovery_collector(collector_ids[[i]], collector_names[[i]], source_labels[[i]])
    pending_exit <- identical(advancement, "effective") && (base_pending || recovery_collector)
    person <- response_person[[i]]
    if (!is.null(base) && nzchar(base$person %||% "")) person <- base$person %||% ""
    if (!nzchar(person) && !is.null(base)) person <- base$identifier %||% ""
    if (!nzchar(person)) person <- detail$value %||% detail$key %||% response_id
    cases[[length(cases) + 1L]] <- data.frame(
      actor = response_actors[[i]],
      person_label = person,
      case_key = detail$key %||% "",
      response_id = response_id,
      date = response_dates[[i]],
      source_id = source_ids[[i]] %||% "",
      source_label = source_labels[[i]] %||% "",
      channel = case_channel,
      collector_id = collector_ids[[i]] %||% "",
      collector_name = collector_label,
      platform_state = response_states[[i]],
      base_result = result,
      base_record = base$identifier %||% "",
      base_source = base$source %||% "",
      base_status = base$status %||% "",
      decision = decision$label %||% "",
      decision_reason = decision$note %||% "",
      advancement = advancement,
      issue_type = issue_type,
      rule = switch(issue_type,
        efectiva_real = "Completa válida incluida en avance; si venía de faltantes, sale de pendientes sin importar el recopilador usado.",
        parcial_identificable = "Parcial con llave identificable; sirve para seguimiento, no cuenta como efectiva.",
        parcial_no_identificable = "Parcial sin código, correo ni llave reconocible; no cuenta como efectiva y no se puede atribuir a un caso.",
        rechazo_plataforma = "Rechazo de plataforma o consentimiento; no cuenta como efectiva.",
        sin_llave = "Respuesta sin llave reconciliable; queda fuera hasta identificarla.",
        fuera_base = "Llave detectada fuera de la base; queda fuera hasta corregir o decidir incluir con salvedad.",
        incluido_con_salvedad = "Incluido por decisión auditada pese a no cruzar automáticamente.",
        "Revisión pendiente."
      ),
      pending_exit = pending_exit,
      recovery_collector = recovery_collector,
      response_row = as.integer(response_idx[[i]]),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  answered_base_keys <- unique(answered_base_keys[nzchar(answered_base_keys)])
  if (length(base_records)) {
    for (base in base_records) {
      base_keys <- unlist(base$all_keys %||% list(base$key %||% ""), use.names = FALSE)
      base_keys <- unique(base_keys[nzchar(base_keys)])
      if (length(base_keys) && any(base_keys %in% answered_base_keys)) next
      person <- base$person %||% ""
      if (!nzchar(person)) person <- base$identifier %||% base$value %||% base$key %||% ""
      cases[[length(cases) + 1L]] <- data.frame(
        actor = base$actor %||% "",
        person_label = person,
        case_key = base$key %||% "",
        response_id = "",
        date = base$date %||% "Sin fecha",
        source_id = base$source_id %||% "",
        source_label = base$source %||% "",
        channel = base$channel %||% "",
        collector_id = "",
        collector_name = base$responsible %||% "Sin responsable",
        platform_state = "Sin respuesta",
        base_result = "Cruzó",
        base_record = base$identifier %||% "",
        base_source = base$source %||% "",
        base_status = base$status %||% "",
        decision = "Pendiente de respuesta",
        decision_reason = "Existe en la base del corte y no tiene respuesta SurveyMonkey reconciliada.",
        advancement = "pending",
        issue_type = "sin_respuesta",
        rule = "Caso en base sin respuesta reconciliada; queda para seguimiento operativo.",
        pending_exit = FALSE,
        recovery_collector = FALSE,
        response_row = NA_integer_,
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }
  }
  if (!length(cases)) return(.monitoreo_internal_empty_queries())

  cases_df <- .monitoreo_internal_records_to_df(cases)
  key <- as.character(cases_df$case_key %||% "")
  duplicate_count <- rep(1L, nrow(cases_df))
  for (dup_key in unique(key[nzchar(key) & !is.na(key)])) {
    idx <- which(key == dup_key)
    duplicate_count[idx] <- length(idx)
  }
  cases_df$duplicate_count <- duplicate_count
  cases_df$issue_type[duplicate_count > 1L & cases_df$issue_type == "efectiva_real"] <- "efectiva_real"

  deduped <- .monitoreo_internal_deduplicate_cases(cases_df)
  pending_exit_df <- deduped[deduped$pending_exit %in% TRUE | deduped$pending_exit == "TRUE", , drop = FALSE]
  issues_df <- .monitoreo_internal_case_issues(cases_df)
  flow <- .monitoreo_internal_flow(deduped)

  list(
    schema = "monitoreo_acreditacion_internal_queries_v1",
    cases = .monitoreo_report_records(cases_df),
    totals = list(
      actor = .monitoreo_report_records(.monitoreo_internal_totals_df(deduped, "actor", "actor")),
      date = .monitoreo_report_records(.monitoreo_internal_totals_df(deduped, "date", "date")),
      channel = .monitoreo_report_records(.monitoreo_internal_totals_df(deduped, "channel", "channel")),
      source = .monitoreo_report_records(.monitoreo_internal_totals_df(deduped, "source_label", "source")),
      collector = .monitoreo_report_records(.monitoreo_internal_totals_df(deduped, "collector_name", "collector"))
    ),
    pending_exit = .monitoreo_report_records(pending_exit_df),
    issues = .monitoreo_report_records(issues_df),
    flow = flow
  )
}

.monitoreo_client_report_model <- function(data, config = list(), generated_at = NULL) {
  cfg <- monitoreo_normalize_config(config, data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  resumen <- .monitoreo_report_summary_df(data, profile)
  avance_general <- .monitoreo_report_daily_df(data, profile, FALSE)
  avance_fuente <- .monitoreo_report_daily_source_df(data, profile)
  controles <- .monitoreo_report_control_distribution_df(data, profile)
  if (is.null(generated_at) || !nzchar(as.character(generated_at))) generated_at <- .monitoreo_now_iso()

  if (!nrow(resumen)) {
    empty_summary <- data.frame(
      Indicador = c("Actores reportados", "Efectivas", "Parciales", "Rechazos plataforma", "Universo"),
      Valor = c(0L, 0L, 0L, 0L, 0L),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
    return(list(
      schema = "monitoreo_client_report_v1",
      generated_at = generated_at,
      title = "Reporte de avance para cliente",
      summary = .monitoreo_report_records(empty_summary),
      actors = list(),
      daily_general = list(),
      daily_actor = list(),
      sources = list(),
      controls = list(),
      has_targets = FALSE,
      sheets = list()
    ))
  }

  safe_num <- function(x, default = 0) {
    out <- suppressWarnings(as.numeric(x))
    out[!is.finite(out)] <- default
    out
  }
  actor_df <- data.frame(
    Actor = as.character(resumen$Unidad %||% ""),
    Universo = as.integer(safe_num(resumen$Universo)),
    Efectivas = as.integer(safe_num(resumen$Efectivas %||% resumen$Completas)),
    Parciales = as.integer(safe_num(resumen$Parciales)),
    `Rechazos plataforma` = as.integer(safe_num(resumen$`Rechazos plataforma` %||% resumen$Rechazos)),
    `Sin respuesta plataforma` = as.integer(safe_num(resumen$`Sin respuesta plataforma` %||% resumen$`Sin respuesta`)),
    `Sin respuesta` = as.integer(safe_num(resumen$`Sin respuesta`)),
    Meta = as.integer(safe_num(resumen$Mínimo, NA_real_)),
    `Origen avance` = as.character(resumen$`Origen avance` %||% ""),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  actor_df$Meta[!is.finite(actor_df$Meta)] <- NA_integer_
  actor_df$`Avance universo` <- vapply(seq_len(nrow(actor_df)), function(i) {
    .monitoreo_client_report_pct(actor_df$Efectivas[[i]], actor_df$Universo[[i]])
  }, numeric(1))
  actor_df$`Avance meta` <- vapply(seq_len(nrow(actor_df)), function(i) {
    .monitoreo_client_report_pct(actor_df$Efectivas[[i]], actor_df$Meta[[i]])
  }, numeric(1))
  actor_df$`Brecha meta` <- ifelse(is.na(actor_df$Meta), NA_integer_, pmax(0L, actor_df$Meta - actor_df$Efectivas))

  date_cols <- .monitoreo_client_report_date_cols(avance_general)
  actor_daily_map <- list()
  if (nrow(avance_general) && length(date_cols)) {
    for (i in seq_len(nrow(avance_general))) {
      actor <- as.character(avance_general$Unidad[[i]] %||% "")
      state <- .monitoreo_text_key(avance_general$Estado[[i]] %||% "")
      for (day in date_cols) {
        value <- as.integer(safe_num(avance_general[[day]][[i]], 0))
        if (value <= 0L) next
        key <- paste(actor, day, sep = "\r")
        current <- actor_daily_map[[key]]
        if (is.null(current)) current <- list(Actor = actor, Fecha = day, Efectivas = 0L, Parciales = 0L, `Rechazos plataforma` = 0L)
        if (grepl("efectiva|completa", state)) current$Efectivas <- current$Efectivas + value
        else if (grepl("parcial", state)) current$Parciales <- current$Parciales + value
        else if (grepl("rechazo", state)) current$`Rechazos plataforma` <- current$`Rechazos plataforma` + value
        actor_daily_map[[key]] <- current
      }
    }
  }
  actor_daily <- if (length(actor_daily_map)) {
    do.call(rbind, lapply(actor_daily_map, function(row) as.data.frame(row, check.names = FALSE, stringsAsFactors = FALSE)))
  } else {
    data.frame(Actor = character(), Fecha = character(), Efectivas = integer(), Parciales = integer(), `Rechazos plataforma` = integer(), check.names = FALSE)
  }
  if (nrow(actor_daily)) {
    actor_daily <- actor_daily[order(actor_daily$Actor, actor_daily$Fecha), , drop = FALSE]
    actor_daily$`Total respuestas` <- actor_daily$Efectivas + actor_daily$Parciales + actor_daily$`Rechazos plataforma`
    actor_daily$Acumulado <- ave(actor_daily$Efectivas, actor_daily$Actor, FUN = cumsum)
  } else {
    actor_daily$`Total respuestas` <- integer(0)
    actor_daily$Acumulado <- integer(0)
  }

  daily_general <- if (nrow(actor_daily)) {
    agg <- stats::aggregate(
      actor_daily[, c("Efectivas", "Parciales", "Rechazos plataforma"), drop = FALSE],
      by = list(Fecha = actor_daily$Fecha),
      FUN = sum
    )
    agg <- agg[order(agg$Fecha), , drop = FALSE]
    agg$`Total respuestas` <- agg$Efectivas + agg$Parciales + agg$`Rechazos plataforma`
    agg$Acumulado <- cumsum(agg$Efectivas)
    agg
  } else {
    data.frame(Fecha = character(), Efectivas = integer(), Parciales = integer(), `Rechazos plataforma` = integer(), `Total respuestas` = integer(), Acumulado = integer(), check.names = FALSE)
  }

  source_map <- list()
  if (nrow(avance_fuente)) {
    source_dates <- .monitoreo_client_report_date_cols(avance_fuente)
    for (i in seq_len(nrow(avance_fuente))) {
      state <- .monitoreo_text_key(avance_fuente$Estado[[i]] %||% "")
      values <- as.integer(safe_num(unlist(avance_fuente[i, source_dates, drop = TRUE], use.names = FALSE), 0))
      total <- sum(values, na.rm = TRUE)
      if (total <= 0L) next
      active_dates <- source_dates[values > 0L]
      key <- paste(as.character(avance_fuente$source_id[[i]] %||% ""), avance_fuente$Actor[[i]] %||% "", avance_fuente$Canal[[i]] %||% "", avance_fuente$Fuente[[i]] %||% "", sep = "\r")
      current <- source_map[[key]]
      if (is.null(current)) {
        current <- list(
          Actor = as.character(avance_fuente$Actor[[i]] %||% "Sin actor"),
          Canal = as.character(avance_fuente$Canal[[i]] %||% "Sin canal"),
          Fuente = as.character(avance_fuente$Fuente[[i]] %||% "Encuesta"),
          Efectivas = 0L,
          Parciales = 0L,
          `Rechazos plataforma` = 0L,
          `Primer día` = "",
          `Última respuesta` = "",
          `Última efectiva` = ""
        )
      }
      if (grepl("efectiva|completa", state)) {
        current$Efectivas <- current$Efectivas + total
        if (length(active_dates)) current$`Última efectiva` <- active_dates[[length(active_dates)]]
      } else if (grepl("parcial", state)) {
        current$Parciales <- current$Parciales + total
      } else if (grepl("rechazo", state)) {
        current$`Rechazos plataforma` <- current$`Rechazos plataforma` + total
      }
      if (length(active_dates)) {
        if (!nzchar(current$`Primer día`)) current$`Primer día` <- active_dates[[1]]
        current$`Última respuesta` <- active_dates[[length(active_dates)]]
      }
      source_map[[key]] <- current
    }
  }
  sources_df <- if (length(source_map)) {
    do.call(rbind, lapply(source_map, function(row) as.data.frame(row, check.names = FALSE, stringsAsFactors = FALSE)))
  } else {
    data.frame(Actor = character(), Canal = character(), Fuente = character(), Efectivas = integer(), Parciales = integer(), `Rechazos plataforma` = integer(),
      `Primer día` = character(), `Última respuesta` = character(), `Última efectiva` = character(), check.names = FALSE)
  }
  if (nrow(sources_df)) {
    sources_df$`Total respuestas` <- sources_df$Efectivas + sources_df$Parciales + sources_df$`Rechazos plataforma`
  } else {
    sources_df$`Total respuestas` <- integer(0)
  }

  controls_df <- controles
  if (!nrow(controls_df)) controls_df <- data.frame(
    Actor = character(), Variable = character(), Valor = character(), Universo = integer(), Efectivas = integer(),
    Parciales = integer(), `Rechazos plataforma` = integer(), `Sin respuesta plataforma` = integer(),
    `% base` = numeric(), `% efectivas` = numeric(), `Diferencia pp` = numeric(), check.names = FALSE
  )

  first_last <- function(actor, field) {
    dates <- actor_daily$Fecha[actor_daily$Actor == actor & actor_daily$Efectivas > 0L]
    if (!length(dates)) return("")
    if (identical(field, "first")) dates[[1]] else dates[[length(dates)]]
  }
  actor_df$`Primer día` <- vapply(actor_df$Actor, first_last, character(1), field = "first")
  actor_df$`Última efectiva` <- vapply(actor_df$Actor, first_last, character(1), field = "last")
  actor_df <- actor_df[order(-actor_df$Efectivas, -actor_df$`Avance universo`, actor_df$Actor), , drop = FALSE]

  total_universe <- sum(actor_df$Universo, na.rm = TRUE)
  total_effective <- sum(actor_df$Efectivas, na.rm = TRUE)
  total_partial <- sum(actor_df$Parciales, na.rm = TRUE)
  total_refusal <- sum(actor_df$`Rechazos plataforma`, na.rm = TRUE)
  summary <- data.frame(
    Indicador = c("Actores reportados", "Efectivas", "Parciales", "Rechazos plataforma", "Universo", "Avance efectivo", "Fuentes reportadas"),
    Valor = c(
      as.character(nrow(actor_df)),
      as.character(total_effective),
      as.character(total_partial),
      as.character(total_refusal),
      as.character(total_universe),
      if (total_universe > 0L) sprintf("%.1f%%", 100 * total_effective / total_universe) else "S/D",
      as.character(nrow(sources_df))
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )

  list(
    schema = "monitoreo_client_report_v1",
    generated_at = generated_at,
    title = "Reporte de avance para cliente",
    summary = .monitoreo_report_records(summary),
    actors = .monitoreo_report_records(actor_df),
    daily_general = .monitoreo_report_records(daily_general),
    daily_actor = .monitoreo_report_records(actor_daily),
    sources = .monitoreo_report_records(sources_df),
    controls = .monitoreo_report_records(controls_df),
    has_targets = any(!is.na(actor_df$Meta)),
    sheets = list()
  )
}

.monitoreo_client_report_sheet_frames <- function(model, include_targets = FALSE) {
  records_df <- function(records) {
    records <- records %||% list()
    if (!length(records)) return(data.frame())
    rows <- lapply(records, function(row) as.data.frame(as.list(row), check.names = FALSE, stringsAsFactors = FALSE))
    out <- tryCatch(do.call(rbind, rows), error = function(e) data.frame())
    rownames(out) <- NULL
    out
  }
  actors <- records_df(model$actors)
  daily_general <- records_df(model$daily_general)
  daily_actor <- records_df(model$daily_actor)
  sources <- records_df(model$sources)
  controls <- records_df(model$controls)
  if (!nrow(actors)) {
    actors <- data.frame(Actor = character(), Universo = integer(), Efectivas = integer(), `Avance universo` = numeric(), check.names = FALSE)
  }
  actor_cols <- c("Actor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "Sin respuesta plataforma", "Sin respuesta", "Origen avance", "Avance universo", "Primer día", "Última efectiva")
  if (isTRUE(include_targets)) actor_cols <- c(actor_cols, "Meta", "Brecha meta", "Avance meta")
  actor_cols <- intersect(actor_cols, names(actors))
  reporte <- actors[, actor_cols, drop = FALSE]

  avance_actor <- daily_actor
  if (nrow(avance_actor)) {
    avance_actor <- avance_actor[, intersect(c("Actor", "Fecha", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Acumulado"), names(avance_actor)), drop = FALSE]
  }

  fechas <- if (nrow(avance_actor)) sort(unique(as.character(avance_actor$Fecha))) else character(0)
  matriz <- data.frame(Fecha = fechas, check.names = FALSE, stringsAsFactors = FALSE)
  if (length(fechas)) {
    for (actor in as.character(actors$Actor %||% character(0))) {
      matriz[[actor]] <- vapply(fechas, function(day) {
        sum(as.integer(avance_actor$Efectivas[avance_actor$Actor == actor & avance_actor$Fecha == day]), na.rm = TRUE)
      }, integer(1))
    }
    actor_cols_m <- setdiff(names(matriz), "Fecha")
    matriz$`Total día` <- rowSums(matriz[, actor_cols_m, drop = FALSE], na.rm = TRUE)
    matriz$Parciales <- vapply(fechas, function(day) {
      sum(as.integer(avance_actor$Parciales[avance_actor$Fecha == day]), na.rm = TRUE)
    }, integer(1))
    matriz$`Rechazos plataforma` <- vapply(fechas, function(day) {
      sum(as.integer(avance_actor$`Rechazos plataforma`[avance_actor$Fecha == day]), na.rm = TRUE)
    }, integer(1))
    matriz$Acumulado <- cumsum(matriz$`Total día`)
  } else {
    matriz$`Total día` <- integer(0)
    matriz$Parciales <- integer(0)
    matriz$`Rechazos plataforma` <- integer(0)
    matriz$Acumulado <- integer(0)
  }

  fuentes <- if (nrow(sources)) {
    sources[, intersect(c("Actor", "Canal", "Fuente", "Efectivas", "Parciales", "Rechazos plataforma", "Total respuestas", "Primer día", "Última respuesta", "Última efectiva"), names(sources)), drop = FALSE]
  } else {
    data.frame(Actor = character(), Canal = character(), Fuente = character(), Efectivas = integer(), check.names = FALSE)
  }

  variables_control <- if (nrow(controls)) {
    controls[, intersect(c("Actor", "Variable", "Valor", "Universo", "Efectivas", "Parciales", "Rechazos plataforma", "Sin respuesta plataforma", "% base", "% efectivas", "Diferencia pp"), names(controls)), drop = FALSE]
  } else {
    data.frame(Actor = character(), Variable = character(), Valor = character(), Universo = integer(), Efectivas = integer(), check.names = FALSE)
  }

  list(
    reporte = reporte,
    avance_actor = avance_actor,
    efectivas_fecha = matriz,
    fuentes_actor = fuentes,
    variables_control = variables_control,
    daily_general = daily_general
  )
}

monitoreo_acreditacion_client_report_sheets <- function(model, include_targets = FALSE) {
  frames <- .monitoreo_client_report_sheet_frames(model, include_targets)
  list(
    .monitoreo_report_sheet("cliente_reporte", "Reporte", "Resumen ejecutivo de avance efectivo por actor.", list(
      .monitoreo_report_block("resumen_actor", "Resumen por actor", frames$reporte)
    ), scope = "cliente"),
    .monitoreo_report_sheet("cliente_avance_actor", "Avance por actor", "Efectivas diarias y acumuladas por actor.", list(
      .monitoreo_report_block("avance_actor_dia", "Avance diario por actor", frames$avance_actor)
    ), scope = "cliente"),
    .monitoreo_report_sheet("cliente_efectivas_fecha", "Efectivas por fecha", "Matriz de efectivas por fecha y actor.", list(
      .monitoreo_report_block("efectivas_fecha", "Efectivas por fecha", frames$efectivas_fecha)
    ), scope = "cliente"),
    .monitoreo_report_sheet("cliente_fuentes_actor", "Fuentes por actor", "Fuentes exactas de plataforma incluidas en el reporte.", list(
      .monitoreo_report_block("fuentes_actor", "Fuentes por actor", frames$fuentes_actor)
    ), scope = "cliente"),
    .monitoreo_report_sheet("cliente_variables_control", "Variables de control", "Distribución del avance frente al universo para variables relevantes por actor.", list(
      .monitoreo_report_block("variables_control", "Distribución por variable de control", frames$variables_control)
    ), scope = "cliente")
  )
}

monitoreo_acreditacion_client_report_model <- function(data, config = list()) {
  .monitoreo_client_report_model(data, config)
}

monitoreo_acreditacion_client_report_pdf <- function(model, output_file, include_targets = FALSE, title = NULL) {
  records_df <- function(records) {
    records <- records %||% list()
    if (!length(records)) return(data.frame())
    rows <- lapply(records, function(row) as.data.frame(as.list(row), check.names = FALSE, stringsAsFactors = FALSE))
    out <- tryCatch(do.call(rbind, rows), error = function(e) data.frame())
    rownames(out) <- NULL
    out
  }
  num <- function(x) {
    out <- suppressWarnings(as.numeric(x))
    out[!is.finite(out)] <- 0
    out
  }
  pct_label <- function(x) {
    x <- suppressWarnings(as.numeric(x))
    if (!is.finite(x)) return("S/D")
    sprintf("%.1f%%", if (abs(x) <= 1) x * 100 else x)
  }
  fmt <- function(x) formatC(as.integer(round(num(x))), big.mark = ",", format = "d")
  actors <- records_df(model$actors)
  daily_general <- records_df(model$daily_general)
  daily_actor <- records_df(model$daily_actor)
  sources <- records_df(model$sources)
  total_effective <- sum(num(actors$Efectivas), na.rm = TRUE)
  total_partial <- sum(num(actors$Parciales), na.rm = TRUE)
  total_refusal <- sum(num(actors$`Rechazos plataforma`), na.rm = TRUE)
  total_universe <- sum(num(actors$Universo), na.rm = TRUE)
  report_title <- title %||% model$title %||% "Reporte de avance para cliente"
  generated_at <- as.character(model$generated_at %||% "")
  pretty_stamp <- function(x) {
    parsed <- .monitoreo_parse_time_vec(x)
    if (length(parsed) && !is.na(parsed[[1]])) return(format(parsed[[1]], "%d/%m/%y, %H:%M"))
    x
  }
  pretty_day <- function(x) {
    parsed <- suppressWarnings(as.Date(as.character(x)))
    ifelse(is.na(parsed), as.character(x), format(parsed, "%d/%m"))
  }
  generated_label <- pretty_stamp(generated_at)

  dir.create(dirname(output_file), recursive = TRUE, showWarnings = FALSE)
  grDevices::pdf(output_file, paper = "a4", width = 8.27, height = 11.69, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)

  draw_header <- function(section = "") {
    graphics::par(mar = c(0, 0, 0, 0))
    graphics::plot.new()
    graphics::rect(0, 0.92, 1, 1, col = "#f7fafc", border = NA)
    graphics::text(0.06, 0.965, report_title, adj = c(0, 0.5), cex = 1.18, font = 2, col = "#0f2341")
    if (nzchar(section)) graphics::text(0.06, 0.93, section, adj = c(0, 0.5), cex = 0.78, col = "#657389")
    graphics::text(0.94, 0.95, generated_label, adj = c(1, 0.5), cex = 0.62, col = "#657389")
  }
  metric_box <- function(x, y, w, h, label, value, hint = "", border = "#d9e2ef") {
    graphics::rect(x, y, x + w, y + h, col = "#ffffff", border = border, lwd = 1.2)
    graphics::text(x + 0.025, y + h - 0.03, toupper(label), adj = c(0, 1), cex = 0.55, font = 2, col = "#64748b")
    graphics::text(x + 0.025, y + h * 0.48, value, adj = c(0, 0.5), cex = 1.24, font = 2, col = "#162033")
    if (nzchar(hint)) graphics::text(x + 0.025, y + 0.025, hint, adj = c(0, 0), cex = 0.58, col = "#657389")
  }
  draw_trend <- function(df, x0, y0, w, h, title = "Efectivas por fecha") {
    if (!nrow(df)) {
      graphics::rect(x0, y0, x0 + w, y0 + h, col = "#f8fafc", border = "#d9e2ef")
      graphics::text(x0 + w / 2, y0 + h / 2, "Sin fechas disponibles", cex = 0.8, col = "#657389")
      return(invisible(NULL))
    }
    values <- num(df$Efectivas)
    partials <- if ("Parciales" %in% names(df)) num(df$Parciales) else rep(0, length(values))
    refusals <- if ("Rechazos plataforma" %in% names(df)) num(df$`Rechazos plataforma`) else rep(0, length(values))
    accum <- if ("Acumulado" %in% names(df)) num(df$Acumulado) else cumsum(values)
    n <- length(values)
    ymax_bar <- max(values + partials + refusals, 1)
    ymax_line <- max(accum, 1)
    graphics::rect(x0, y0, x0 + w, y0 + h, col = "#ffffff", border = "#d9e2ef")
    graphics::text(x0 + 0.018, y0 + h - 0.026, title, adj = c(0, 1), cex = 0.74, font = 2, col = "#0f2341")
    chart_x0 <- x0 + 0.04
    chart_y0 <- y0 + 0.08
    chart_w <- w - 0.08
    chart_h <- h - 0.16
    for (k in seq(0, 1, length.out = 5)) {
      y <- chart_y0 + chart_h * k
      graphics::segments(chart_x0, y, chart_x0 + chart_w, y, col = "#e8eef6", lwd = 0.6)
    }
    xs <- if (n == 1L) chart_x0 + chart_w / 2 else chart_x0 + chart_w * (seq_len(n) - 1) / (n - 1)
    bar_w <- min(0.035, chart_w / max(4, n) * 0.58)
    for (i in seq_len(n)) {
      y_start <- chart_y0
      bh <- chart_h * values[[i]] / ymax_bar
      graphics::rect(xs[[i]] - bar_w / 2, y_start, xs[[i]] + bar_w / 2, y_start + bh, col = "#168a55", border = NA)
      y_start <- y_start + bh
      ph <- chart_h * partials[[i]] / ymax_bar
      if (ph > 0) graphics::rect(xs[[i]] - bar_w / 2, y_start, xs[[i]] + bar_w / 2, y_start + ph, col = "#b97611", border = NA)
      y_start <- y_start + ph
      rh <- chart_h * refusals[[i]] / ymax_bar
      if (rh > 0) graphics::rect(xs[[i]] - bar_w / 2, y_start, xs[[i]] + bar_w / 2, y_start + rh, col = "#a61d4f", border = NA)
    }
    ys <- chart_y0 + chart_h * accum / ymax_line
    if (n > 1L) graphics::lines(xs, ys, col = "#002f6c", lwd = 2.1)
    graphics::points(xs, ys, pch = 21, bg = "#ffffff", col = "#002f6c", cex = 0.75, lwd = 1.3)
    labels <- pretty_day(as.character(df$Fecha %||% seq_len(n)))
    keep <- unique(round(seq(1, n, length.out = min(6, n))))
    graphics::text(xs[keep], chart_y0 - 0.025, labels[keep], srt = 28, adj = 1, cex = 0.48, col = "#64748b")
    invisible(NULL)
  }

  draw_header("Resumen ejecutivo")
  graphics::text(0.06, 0.84, "Seguimiento de avance por actor", adj = c(0, 0.5), cex = 1.45, font = 2, col = "#111827")
  graphics::text(0.06, 0.805, "Reporte limpio para cliente: efectivas, parciales, rechazos de plataforma, evolución diaria y fuentes exactas.", adj = c(0, 0.5), cex = 0.78, col = "#536174")
  metric_box(0.06, 0.70, 0.20, 0.085, "Efectivas", fmt(total_effective), "respuestas completas", "#8bd5b5")
  metric_box(0.285, 0.70, 0.20, 0.085, "Parciales", fmt(total_partial), "avance no cerrado", "#d7a33a")
  metric_box(0.51, 0.70, 0.20, 0.085, "Rechazos", fmt(total_refusal), "plataforma", "#ce7fa0")
  metric_box(0.735, 0.70, 0.20, 0.085, "Avance", pct_label(.monitoreo_client_report_pct(total_effective, total_universe)), "sobre universo", "#8bd5b5")
  draw_trend(daily_general, 0.06, 0.43, 0.88, 0.22, "Avance diario y efectivas acumuladas")
  if (nrow(actors)) {
    y <- 0.36
    graphics::text(0.06, y, "Resumen por actor", adj = c(0, 0.5), cex = 0.85, font = 2, col = "#0f2341")
    y <- y - 0.035
    graphics::rect(0.06, y - 0.018, 0.94, y + 0.018, col = "#f4f7fb", border = NA)
    headers <- if (isTRUE(include_targets)) c("Actor", "Universo", "Efectivas", "Parciales", "Rechazos", "Avance", "Meta") else c("Actor", "Universo", "Efectivas", "Parciales", "Rechazos", "Avance")
    xs <- if (length(headers) == 7) c(0.08, 0.36, 0.48, 0.59, 0.70, 0.81, 0.90) else c(0.08, 0.40, 0.53, 0.66, 0.78, 0.89)
    for (i in seq_along(headers)) graphics::text(xs[[i]], y, headers[[i]], adj = c(0, 0.5), cex = 0.58, font = 2, col = "#64748b")
    y <- y - 0.04
    for (i in seq_len(min(nrow(actors), 10L))) {
      row <- actors[i, , drop = FALSE]
      vals <- if (isTRUE(include_targets)) {
        c(row$Actor, fmt(row$Universo), fmt(row$Efectivas), fmt(row$Parciales), fmt(row$`Rechazos plataforma`), pct_label(row$`Avance universo`), if ("Meta" %in% names(row) && !is.na(row$Meta)) fmt(row$Meta) else "S/M")
      } else {
        c(row$Actor, fmt(row$Universo), fmt(row$Efectivas), fmt(row$Parciales), fmt(row$`Rechazos plataforma`), pct_label(row$`Avance universo`))
      }
      for (j in seq_along(vals)) graphics::text(xs[[j]], y, vals[[j]], adj = c(0, 0.5), cex = 0.58, col = "#182235")
      graphics::segments(0.06, y - 0.022, 0.94, y - 0.022, col = "#edf2f7", lwd = 0.6)
      y <- y - 0.04
    }
  }

  if (nrow(actors)) {
    for (i in seq_len(nrow(actors))) {
      actor <- as.character(actors$Actor[[i]])
      actor_daily_df <- daily_actor[daily_actor$Actor == actor, , drop = FALSE]
      actor_sources <- sources[sources$Actor == actor, , drop = FALSE]
      draw_header(paste("Actor:", actor))
      graphics::text(0.06, 0.84, actor, adj = c(0, 0.5), cex = 1.45, font = 2, col = "#111827")
      metric_box(0.06, 0.73, 0.20, 0.085, "Efectivas", fmt(actors$Efectivas[[i]]), "plataforma completa", "#8bd5b5")
      metric_box(0.285, 0.73, 0.20, 0.085, "Parciales", fmt(actors$Parciales[[i]]), "avance no cerrado", "#d7a33a")
      metric_box(0.51, 0.73, 0.20, 0.085, "Rechazos", fmt(actors$`Rechazos plataforma`[[i]]), "plataforma", "#ce7fa0")
      if (isTRUE(include_targets)) {
        metric_box(0.735, 0.73, 0.20, 0.085, "Meta", if (!is.na(actors$Meta[[i]])) fmt(actors$Meta[[i]]) else "S/M", "opcional", "#d9e2ef")
      } else {
        metric_box(0.735, 0.73, 0.20, 0.085, "Universo", fmt(actors$Universo[[i]]), "casos base", "#d9e2ef")
      }
      draw_trend(actor_daily_df, 0.06, 0.44, 0.88, 0.22, "Avance diario del actor")
      graphics::text(0.06, 0.36, "Fuentes incluidas", adj = c(0, 0.5), cex = 0.85, font = 2, col = "#0f2341")
      y <- 0.315
      if (nrow(actor_sources)) {
        for (k in seq_len(min(nrow(actor_sources), 6L))) {
          graphics::rect(0.06, y - 0.023, 0.94, y + 0.023, col = if (k %% 2) "#ffffff" else "#f8fafc", border = "#e6edf5")
          graphics::text(0.08, y + 0.006, as.character(actor_sources$Fuente[[k]]), adj = c(0, 0.5), cex = 0.58, font = 2, col = "#182235")
          graphics::text(0.08, y - 0.010, paste(as.character(actor_sources$Canal[[k]]), "·", fmt(actor_sources$Efectivas[[k]]), "efectivas ·", fmt(actor_sources$Parciales[[k]]), "parciales ·", fmt(actor_sources$`Rechazos plataforma`[[k]]), "rechazos"), adj = c(0, 0.5), cex = 0.52, col = "#64748b")
          y <- y - 0.052
        }
      } else {
        graphics::text(0.08, y, "Sin fuentes de plataforma con efectivas para este actor.", adj = c(0, 0.5), cex = 0.62, col = "#64748b")
      }
    }
  }
  invisible(output_file)
}

.monitoreo_report_distribution_df <- function(data, profile) {
  year_col <- .monitoreo_report_col(data, c("Ciclo de egreso", "CICLO DE EGRESO", "Año de egreso", "Anio de egreso", "Promocion", "Promoción"))
  if (!nzchar(year_col)) return(data.frame())
  work <- data[.monitoreo_report_role_mask(data, c("universo", "respuestas")), , drop = FALSE]
  if (!nrow(work)) return(data.frame())
  units <- .monitoreo_report_units(profile, work)
  states_all <- .monitoreo_report_states(work, profile)
  rows <- list()
  for (unit in units) {
    mask <- .monitoreo_report_unit_mask(work, unit, roles = c("universo", "respuestas"))
    df <- work[mask, , drop = FALSE]
    if (!nrow(df)) next
    value <- trimws(as.character(df[[year_col]]))
    value[!nzchar(value) | is.na(value)] <- "Sin dato"
    states <- states_all[mask]
    tab <- sort(table(value), decreasing = TRUE)
    total <- sum(tab)
    for (val in names(tab)) {
      val_mask <- value == val
      efectivos <- sum(states[val_mask] == "Completa", na.rm = TRUE)
      rows[[length(rows) + 1L]] <- data.frame(
        Unidad = unit$label,
        Variable = "Año de egreso",
        Valor = val,
        Universo = as.integer(tab[[val]]),
        `% universo` = if (total > 0L) round(as.integer(tab[[val]]) / total, 4) else NA_real_,
        Efectivas = as.integer(efectivos),
        `% efectivas` = if (sum(states == "Completa") > 0L) round(efectivos / sum(states == "Completa"), 4) else NA_real_,
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }
  }
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  utils::head(out, 120L)
}

.monitoreo_report_phone_data <- function(data) {
  work <- data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  if (!nrow(work)) return(work)
  labels <- .monitoreo_text_key(work$.source_label %||% "")
  status <- .monitoreo_report_status_values(work)
  work[!grepl("puente", labels, fixed = TRUE) & .monitoreo_report_nonempty(status), , drop = FALSE]
}

.monitoreo_report_phone_blocks <- function(data, profile = list()) {
  phone <- .monitoreo_report_phone_data(data)
  responses <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
  count_df <- function(values, name_col) {
    tab <- sort(table(values), decreasing = TRUE)
    data.frame(
      stats::setNames(list(names(tab), as.integer(tab)), c(name_col, "Casos")),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  if (!nrow(phone)) {
    empty <- data.frame(Indicador = "Total telefónico", Casos = 0L, `% del total telefónico` = NA_real_, check.names = FALSE)
    return(list(.monitoreo_report_block("resumen_telefonico", "Resumen general", empty, "Sin hoja de barrido telefónico activa.")))
  }
  status <- .monitoreo_report_status_values(phone)
  status_key <- .monitoreo_text_key(status)
  total <- nrow(phone)
  no_barrido <- sum(status_key %in% c("no barrido", "nobarrido", "sin status"), na.rm = TRUE)
  barridos <- total - no_barrido
  resumen <- data.frame(
    Indicador = c("Casos barridos", "No barridos", "Total telefónico"),
    Casos = as.integer(c(barridos, no_barrido, total)),
    `% del total telefónico` = if (total > 0L) round(c(barridos, no_barrido, total) / total, 4) else NA_real_,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  dist <- count_df(status, "Estatus")
  dist$`% del total telefónico` <- if (total > 0L) round(dist$Casos / total, 4) else NA_real_
  dates <- .monitoreo_report_date_values(phone)
  by_day <- count_df(dates, "Fecha")
  responsables <- .monitoreo_report_responsable_values(phone)
  states <- .monitoreo_report_states(phone)
  attempts <- .monitoreo_report_attempt_values(phone)
  if (length(attempts) != nrow(phone)) attempts <- rep(NA_real_, nrow(phone))
  reconciliation <- .monitoreo_report_phone_reconciliation(phone, responses, profile)
  phone_platform_complete <- reconciliation$phone_platform_complete
  phone_platform_partial <- reconciliation$phone_platform_partial
  phone_effective_conciliated <- reconciliation$phone_effective_conciliated
  if (length(phone_platform_complete) != nrow(phone)) phone_platform_complete <- rep(FALSE, nrow(phone))
  if (length(phone_platform_partial) != nrow(phone)) phone_platform_partial <- rep(FALSE, nrow(phone))
  if (length(phone_effective_conciliated) != nrow(phone)) phone_effective_conciliated <- rep(FALSE, nrow(phone))
  no_barrido_mask <- status_key %in% c("no barrido", "nobarrido", "sin status")
  efectivo_mask <- states == "Completa"
  parcial_mask <- states == "Parcial"
  rechazo_mask <- states == "Rechazo"
  barrido_mask <- !no_barrido_mask
  incidencia_mask <- barrido_mask & !efectivo_mask
  no_answer_mask <- grepl("no contesta|no responde|no answer|nocontesta", status_key)
  call_later_mask <- grepl("contactar despues|contactar luego|llamar despues|pendiente contacto|pendiente de contacto", status_key)
  terminal_no_effective_mask <- grepl("rechazo|no existe|numero incorrecto|fuera de servicio|apagado|inubicable|inalcanz|wrong number", status_key)
  reattempt_mask <- barrido_mask & !efectivo_mask & !terminal_no_effective_mask
  low_reattempt_mask <- reattempt_mask & (is.na(attempts) | attempts < 4)
  dates_sorted <- sort(unique(dates[nzchar(dates)]))
  if (!length(dates_sorted)) dates_sorted <- "Sin fecha"
  efectivo_dia <- data.frame(
    Fecha = dates_sorted,
    Efectivas = as.integer(vapply(dates_sorted, function(day) sum(efectivo_mask & dates == day, na.rm = TRUE), integer(1))),
    `Efectivas telefónicas` = as.integer(vapply(dates_sorted, function(day) sum(efectivo_mask & dates == day, na.rm = TRUE), integer(1))),
    Parciales = as.integer(vapply(dates_sorted, function(day) sum(parcial_mask & dates == day, na.rm = TRUE), integer(1))),
    Rechazos = as.integer(vapply(dates_sorted, function(day) sum(rechazo_mask & dates == day, na.rm = TRUE), integer(1))),
    `Rechazos telefónicos` = as.integer(vapply(dates_sorted, function(day) sum(rechazo_mask & dates == day, na.rm = TRUE), integer(1))),
    Barridos = as.integer(vapply(dates_sorted, function(day) sum(barrido_mask & dates == day, na.rm = TRUE), integer(1))),
    `Sin efectiva` = as.integer(vapply(dates_sorted, function(day) sum(incidencia_mask & dates == day, na.rm = TRUE), integer(1))),
    Incidencias = as.integer(vapply(dates_sorted, function(day) sum(incidencia_mask & dates == day, na.rm = TRUE), integer(1))),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  efectivo_dia$`Ratio incidencias` <- ifelse(efectivo_dia$Barridos > 0L, round(efectivo_dia$Incidencias / efectivo_dia$Barridos, 4), NA_real_)
  resp <- data.frame(Responsable = responsables, Completa = states == "Completa", stringsAsFactors = FALSE)
  by_resp <- stats::aggregate(Completa ~ Responsable, data = resp, FUN = sum)
  names(by_resp) <- c("Responsable", "Efectivas")
  by_resp <- by_resp[order(-by_resp$Efectivas, by_resp$Responsable), , drop = FALSE]
  resp_ops_rows <- lapply(sort(unique(responsables)), function(owner) {
    mask <- responsables == owner
    asignados <- sum(mask, na.rm = TRUE)
    barridos_owner <- sum(mask & barrido_mask, na.rm = TRUE)
    no_barridos_owner <- sum(mask & no_barrido_mask, na.rm = TRUE)
    efectivas_owner <- sum(mask & efectivo_mask, na.rm = TRUE)
    plataforma_owner <- sum(mask & phone_platform_complete, na.rm = TRUE)
    conciliadas_owner <- sum(mask & phone_effective_conciliated, na.rm = TRUE)
    plataforma_parcial_owner <- sum(mask & phone_platform_partial, na.rm = TRUE)
    rechazos_owner <- sum(mask & rechazo_mask, na.rm = TRUE)
    incidencias_owner <- sum(mask & incidencia_mask, na.rm = TRUE)
    no_contesta_owner <- sum(mask & no_answer_mask, na.rm = TRUE)
    reintento_owner <- sum(mask & reattempt_mask, na.rm = TRUE)
    bajo_reintento_owner <- sum(mask & low_reattempt_mask, na.rm = TRUE)
    owner_attempts <- attempts[mask & reattempt_mask & !is.na(attempts)]
    data.frame(
      Responsable = owner,
      `Casos asignados` = as.integer(asignados),
      Barridos = as.integer(barridos_owner),
      `No barridos` = as.integer(no_barridos_owner),
      Efectivas = as.integer(efectivas_owner),
      `Efectivas telefónicas` = as.integer(efectivas_owner),
      `Plataforma completa` = as.integer(plataforma_owner),
      Conciliadas = as.integer(conciliadas_owner),
      `Tel. efectiva sin plataforma completa` = as.integer(max(0L, efectivas_owner - conciliadas_owner)),
      `Plataforma completa sin tel. efectiva` = as.integer(max(0L, plataforma_owner - conciliadas_owner)),
      `Plataforma parcial` = as.integer(plataforma_parcial_owner),
      `Rechazos telefónicos` = as.integer(rechazos_owner),
      `Sin efectiva` = as.integer(incidencias_owner),
      Incidencias = as.integer(incidencias_owner),
      `No contesta` = as.integer(no_contesta_owner),
      Reintentos = as.integer(reintento_owner),
      `Reintentos bajos` = as.integer(bajo_reintento_owner),
      `Promedio intentos reintento` = if (length(owner_attempts)) round(mean(owner_attempts), 2) else NA_real_,
      `% no barrido` = if (asignados > 0L) round(no_barridos_owner / asignados, 4) else NA_real_,
      `Ratio incidencias` = if (barridos_owner > 0L) round(incidencias_owner / barridos_owner, 4) else NA_real_,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  by_resp_ops <- if (length(resp_ops_rows)) do.call(rbind, resp_ops_rows) else data.frame()
  if (nrow(by_resp_ops)) {
    by_resp_ops <- by_resp_ops[order(-by_resp_ops$`No barridos`, -by_resp_ops$Incidencias, by_resp_ops$Responsable), , drop = FALSE]
  }
  status_resp <- data.frame(Responsable = responsables, Estado = status, stringsAsFactors = FALSE)
  by_status_resp <- stats::aggregate(rep(1L, nrow(status_resp)), by = list(Responsable = status_resp$Responsable, Estado = status_resp$Estado), FUN = sum)
  names(by_status_resp) <- c("Responsable", "Estado", "Casos")
  status_totals <- stats::aggregate(Casos ~ Responsable, data = by_status_resp, FUN = sum)
  names(status_totals) <- c("Responsable", "Total responsable")
  by_status_resp <- merge(by_status_resp, status_totals, by = "Responsable", all.x = TRUE, sort = FALSE)
  by_status_resp$`% responsable` <- ifelse(by_status_resp$`Total responsable` > 0L, round(by_status_resp$Casos / by_status_resp$`Total responsable`, 4), NA_real_)
  by_status_resp <- by_status_resp[order(by_status_resp$Responsable, -by_status_resp$Casos, by_status_resp$Estado), , drop = FALSE]
  attempt_bucket <- function(values, bucket) {
    sum(!is.na(values) & floor(values) == bucket, na.rm = TRUE)
  }
  insistencia_rows <- lapply(sort(unique(responsables)), function(owner) {
    mask <- responsables == owner & no_answer_mask
    vals <- attempts[mask]
    valid <- vals[!is.na(vals)]
    data.frame(
      Responsable = owner,
      `Casos No contesta` = as.integer(sum(mask, na.rm = TRUE)),
      `Suma intentos` = as.integer(sum(valid, na.rm = TRUE)),
      `Promedio intentos` = if (length(valid)) round(mean(valid), 2) else NA_real_,
      `Sin intentos` = as.integer(sum(is.na(vals), na.rm = TRUE)),
      `1 intento` = as.integer(attempt_bucket(vals, 1)),
      `2 intentos` = as.integer(attempt_bucket(vals, 2)),
      `3 intentos` = as.integer(attempt_bucket(vals, 3)),
      `4 intentos` = as.integer(attempt_bucket(vals, 4)),
      `5 intentos` = as.integer(attempt_bucket(vals, 5)),
      `6 intentos` = as.integer(attempt_bucket(vals, 6)),
      `7 intentos` = as.integer(attempt_bucket(vals, 7)),
      `Más de 7 intentos` = as.integer(sum(!is.na(vals) & vals > 7, na.rm = TRUE)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  insistencia <- if (length(insistencia_rows)) do.call(rbind, insistencia_rows) else data.frame()
  if (nrow(insistencia)) {
    insistencia <- insistencia[insistencia$`Casos No contesta` > 0L, , drop = FALSE]
    insistencia <- insistencia[order(-insistencia$`Casos No contesta`, insistencia$Responsable), , drop = FALSE]
  }
  key_col <- .monitoreo_report_col(phone, c("CodPulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP", "ID", "id", "codigo", "Código", "Codigo"))
  keys <- if (nzchar(key_col)) trimws(as.character(phone[[key_col]])) else rep("", nrow(phone))
  keys[!.monitoreo_report_nonempty(keys)] <- ""
  people <- .monitoreo_report_person_values(phone)
  people[!.monitoreo_report_nonempty(people)] <- keys[!.monitoreo_report_nonempty(people)]
  actors <- .monitoreo_report_trace_actor_values(phone)
  attempt_target <- 4
  attempts_for_ratio <- attempts
  attempts_for_ratio[is.na(attempts_for_ratio)] <- 0
  no_answer_detail <- data.frame(
    Responsable = responsables[no_answer_mask],
    Actor = actors[no_answer_mask],
    Caso = people[no_answer_mask],
    CodPulso = keys[no_answer_mask],
    Estado = status[no_answer_mask],
    Intentos = as.integer(ifelse(is.na(attempts[no_answer_mask]), 0, floor(attempts[no_answer_mask]))),
    `Intentos objetivo` = as.integer(rep(attempt_target, sum(no_answer_mask, na.rm = TRUE))),
    `Ratio insistencia` = round(attempts_for_ratio[no_answer_mask] / attempt_target, 4),
    Fecha = dates[no_answer_mask],
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  if (nrow(no_answer_detail)) {
    no_answer_detail$Caso[!.monitoreo_report_nonempty(no_answer_detail$Caso)] <- "Caso sin nombre"
    no_answer_detail$Actor[!.monitoreo_report_nonempty(no_answer_detail$Actor)] <- "Sin actor"
    no_answer_detail <- no_answer_detail[order(
      no_answer_detail$Responsable,
      no_answer_detail$Intentos,
      no_answer_detail$Caso
    ), , drop = FALSE]
  }
  reintento_rows <- lapply(sort(unique(responsables)), function(owner) {
    mask <- responsables == owner
    vals <- attempts[mask & reattempt_mask]
    valid <- vals[!is.na(vals)]
    data.frame(
      Responsable = owner,
      `Casos reintentables` = as.integer(sum(mask & reattempt_mask, na.rm = TRUE)),
      `No contesta` = as.integer(sum(mask & no_answer_mask, na.rm = TRUE)),
      `Contactar después` = as.integer(sum(mask & call_later_mask, na.rm = TRUE)),
      `Otros no finales` = as.integer(sum(mask & reattempt_mask & !no_answer_mask & !call_later_mask, na.rm = TRUE)),
      `Reintentos bajos` = as.integer(sum(mask & low_reattempt_mask, na.rm = TRUE)),
      `Promedio intentos` = if (length(valid)) round(mean(valid), 2) else NA_real_,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  reintentos <- if (length(reintento_rows)) do.call(rbind, reintento_rows) else data.frame()
  if (nrow(reintentos)) {
    reintentos <- reintentos[reintentos$`Casos reintentables` > 0L, , drop = FALSE]
    reintentos <- reintentos[order(-reintentos$`Reintentos bajos`, -reintentos$`Casos reintentables`, reintentos$Responsable), , drop = FALSE]
  }
  resp_detail_rows <- lapply(sort(unique(responsables)), function(owner) {
    mask <- responsables == owner
    owner_codes <- unique(keys[mask & .monitoreo_report_nonempty(keys)])
    owner_dates <- dates[mask & dates != "Sin fecha" & .monitoreo_report_nonempty(dates)]
    data.frame(
      Responsable = owner,
      `Casos asignados` = as.integer(sum(mask, na.rm = TRUE)),
      `Ultima actualizacion` = if (length(owner_dates)) max(owner_dates) else "Sin fecha",
      `CodPulso asignados` = paste(utils::head(owner_codes, 12L), collapse = ", "),
      `CodPulso adicionales` = as.integer(max(0L, length(owner_codes) - 12L)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  by_resp_detail <- if (length(resp_detail_rows)) do.call(rbind, resp_detail_rows) else data.frame()
  if (nrow(by_resp_detail)) {
    by_resp_detail <- by_resp_detail[order(-by_resp_detail$`Casos asignados`, by_resp_detail$Responsable), , drop = FALSE]
  }
  list(
    .monitoreo_report_block("resumen_telefonico", "Resumen general", resumen),
    .monitoreo_report_block("estatus_telefonico", "Distribución por estatus", dist),
    .monitoreo_report_block("produccion_dia", "Producción por día", by_day),
    .monitoreo_report_block("avance_efectivo_dia", "Avance efectivo por día", efectivo_dia),
    .monitoreo_report_block("operacion_responsable", "Operación por responsable", utils::head(by_resp_ops, 120L)),
    .monitoreo_report_block("campo_vs_plataforma_responsable", "Campo vs plataforma por responsable", utils::head(by_resp_ops[, intersect(names(by_resp_ops), c("Responsable", "Casos asignados", "Barridos", "Efectivas telefónicas", "Plataforma completa", "Conciliadas", "Tel. efectiva sin plataforma completa", "Plataforma completa sin tel. efectiva", "Plataforma parcial")), drop = FALSE], 120L)),
    .monitoreo_report_block("estatus_responsable", "Estados por responsable", utils::head(by_status_resp, 240L)),
    .monitoreo_report_block("insistencia_no_contesta", "Insistencia / rebarrido: No contesta", utils::head(insistencia, 120L)),
    .monitoreo_report_block("detalle_no_contesta", "Detalle de casos que no contestan", utils::head(no_answer_detail, 500L)),
    .monitoreo_report_block("reintentos_responsable", "No efectivos reintentables", utils::head(reintentos, 120L)),
    .monitoreo_report_block("no_barridos_responsable", "No barridos por responsable", utils::head(by_resp_ops[, intersect(names(by_resp_ops), c("Responsable", "Casos asignados", "No barridos", "% no barrido")), drop = FALSE], 120L)),
    .monitoreo_report_block("responsables_barrido", "Responsables asignados", utils::head(by_resp_detail, 120L)),
    .monitoreo_report_block("efectivos_responsable", "Efectivos por responsable", utils::head(by_resp, 80L))
  )
}

.monitoreo_report_alerts_df <- function(data, profile) {
  barrido <- data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  respuestas <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
  rows <- list()
  add <- function(level, type, detail, owner = "", key = "") {
    rows[[length(rows) + 1L]] <<- data.frame(
      Nivel = level,
      `Tipo alerta` = type,
      `Detalle del tipo de alerta` = detail,
      Responsable = owner,
      CodPulso = key,
      Detalle = detail,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }
  key_col <- .monitoreo_report_col(barrido, c("CodPulso", "Codigo Pulso", "Código Pulso", "ID", "id", "codigo", "Código", "Codigo"))
  owner <- .monitoreo_report_responsable_values(barrido)
  status <- .monitoreo_report_status_values(barrido)
  status_key <- .monitoreo_text_key(status)
  if (nrow(barrido) && nzchar(key_col)) {
    keys <- trimws(as.character(barrido[[key_col]]))
    missing <- which(!.monitoreo_report_nonempty(keys))
    if (length(missing)) {
      for (idx in utils::head(missing, 25L)) add("Alta", "llave_faltante_barrido", "Fila de barrido sin llave para cruzar.", owner[[idx]], "")
    }
    dup <- unique(keys[.monitoreo_report_nonempty(keys) & duplicated(keys)])
    if (length(dup)) {
      for (key in utils::head(dup, 25L)) add("Alta", "llave_duplicada_barrido", "La llave aparece mas de una vez en barrido.", "", key)
    }
  } else if (nrow(barrido)) {
    add("Alta", "llave_no_detectada", "No se detecto columna CodPulso/Codigo en el barrido.", "", "")
  }
  if (nrow(barrido)) {
    owner_key <- .monitoreo_text_key(owner)
    unassigned <- which(owner_key %in% c("", "sin responsable", "sin asignar"))
    threshold <- as.integer((profile$alerts %||% list())$unassigned_cases_min %||% 5L)
    if (length(unassigned) >= threshold) {
      add("Media", "casos_sin_responsable", sprintf("%d casos sin responsable asignado.", length(unassigned)), "Sin responsable", "")
    }
    min_cases <- as.integer((profile$alerts %||% list())$no_sweep_min_cases %||% 20L)
    min_pct <- as.numeric((profile$alerts %||% list())$no_sweep_pct %||% 0.5)
    for (owner_name in unique(owner)) {
      mask <- owner == owner_name
      total <- sum(mask, na.rm = TRUE)
      no_sweep <- sum(mask & status_key %in% c("no barrido", "nobarrido"), na.rm = TRUE)
      pct <- if (total > 0L) no_sweep / total else 0
      if (no_sweep >= min_cases || pct >= min_pct) {
        add("Baja", "responsable_no_barridos", sprintf("%d de %d casos siguen No barrido.", no_sweep, total), owner_name, "")
      }
    }
  }
  if (nrow(respuestas)) {
    response_states <- .monitoreo_report_states(respuestas, profile)
    response_keys <- .monitoreo_report_key_list(respuestas, profile, "respuesta")
    response_key_lengths <- lengths(response_keys)
    missing_response_keys <- which(response_key_lengths == 0L & response_states %in% c("Completa", "Parcial", "Rechazo"))
    if (length(missing_response_keys)) {
      source_labels <- if (".source_label" %in% names(respuestas)) as.character(respuestas$.source_label %||% "") else rep("", nrow(respuestas))
      response_ids <- .monitoreo_report_first_values(respuestas, c("response_id", "id_respuesta", "id respuesta"))
      for (idx in utils::head(missing_response_keys, 25L)) {
        detail <- sprintf(
          "Respuesta %s de plataforma sin llave reconciliable. Fuente: %s%s.",
          tolower(response_states[[idx]]),
          source_labels[[idx]] %||% "",
          if (length(response_ids) && nzchar(response_ids[[idx]])) paste0(". response_id: ", response_ids[[idx]]) else ""
        )
        add("Alta", "respuesta_sin_llave", detail, "", "")
      }
    }
    base_mask <- .monitoreo_report_base_mask(data)
    if (any(base_mask, na.rm = TRUE)) {
      base_rows <- data[base_mask, , drop = FALSE]
      base_keys <- .monitoreo_report_key_set(.monitoreo_report_key_list(base_rows, profile, "universo"))
      if (length(base_keys)) {
        source_labels <- if (".source_label" %in% names(respuestas)) as.character(respuestas$.source_label %||% "") else rep("", nrow(respuestas))
        response_ids <- .monitoreo_report_first_values(respuestas, c("response_id", "id_respuesta", "id respuesta"))
        matched <- vapply(response_keys, .monitoreo_report_has_key, logical(1), key_set = base_keys)
        outside_base <- which(response_key_lengths > 0L & !matched & response_states %in% c("Completa", "Parcial", "Rechazo"))
        for (idx in utils::head(outside_base, 50L)) {
          key <- response_keys[[idx]][[1]]
          type <- switch(response_states[[idx]],
            Completa = "efectiva_sin_cruce_base",
            Parcial = "parcial_sin_cruce_base",
            Rechazo = "rechazo_plataforma_sin_cruce_base",
            "respuesta_fuera_de_base"
          )
          detail <- sprintf(
            "Respuesta %s de plataforma no cruza con el universo base. Fuente: %s. Llave detectada: %s%s.",
            tolower(response_states[[idx]]),
            source_labels[[idx]] %||% "",
            key,
            if (length(response_ids) && nzchar(response_ids[[idx]])) paste0(". response_id: ", response_ids[[idx]]) else ""
          )
          add("Alta", type, detail, "", key)
        }
      }
    }
    partial_response <- which(response_states == "Parcial")
    if (length(partial_response)) {
      for (idx in utils::head(partial_response, 25L)) {
        key <- if (length(response_keys[[idx]])) response_keys[[idx]][[1]] else ""
        add("Media", "parcial_plataforma", "Respuesta parcial de plataforma; no cuenta como efectiva.", "", key)
      }
    }
  }
  if (nrow(barrido) && nrow(respuestas)) {
    phone_states <- .monitoreo_report_states(barrido, profile)
    response_states <- .monitoreo_report_states(respuestas, profile)
    phone_keys <- .monitoreo_report_key_list(barrido, profile, "universo")
    response_keys <- .monitoreo_report_key_list(respuestas, profile, "respuesta")
    response_complete_keys <- .monitoreo_report_key_set(response_keys[response_states == "Completa"])
    response_partial_keys <- .monitoreo_report_key_set(response_keys[response_states == "Parcial"])
    response_any_keys <- .monitoreo_report_key_set(response_keys[response_states %in% c("Completa", "Parcial", "Rechazo")])
    phone_effective <- which(phone_states == "Completa")
    for (idx in utils::head(phone_effective, 50L)) {
      keys <- phone_keys[[idx]]
      key <- if (length(keys)) keys[[1]] else ""
      if (!length(keys)) next
      has_complete <- .monitoreo_report_has_key(keys, response_complete_keys)
      has_partial <- .monitoreo_report_has_key(keys, response_partial_keys)
      if (!has_complete && has_partial) {
        add("Alta", "efectivo_telefonico_parcial_plataforma", "Caso marcado efectivo en barrido, pero parcial en plataforma.", owner[[idx]], key)
      } else if (!has_complete) {
        add("Alta", "efectivo_telefonico_sin_plataforma", "Caso marcado efectivo en barrido, pero sin plataforma completa.", owner[[idx]], key)
      }
    }
    phone_rejections <- which(phone_states == "Rechazo")
    for (idx in utils::head(phone_rejections, 50L)) {
      keys <- phone_keys[[idx]]
      key <- if (length(keys)) keys[[1]] else ""
      if (length(keys) && .monitoreo_report_has_key(keys, response_any_keys)) {
        add("Alta", "rechazo_telefonico_con_respuesta", "Caso con rechazo telefónico y respuesta de plataforma.", owner[[idx]], key)
      }
    }
  }
  if (!length(rows)) {
    return(data.frame(
      Nivel = "OK",
      `Tipo alerta` = "Sin alertas",
      `Detalle del tipo de alerta` = "Barrido y respuestas conectadas no muestran diferencias criticas.",
      Responsable = "",
      CodPulso = "",
      Detalle = "",
      check.names = FALSE,
      stringsAsFactors = FALSE
    ))
  }
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  utils::head(out, 300L)
}

monitoreo_acreditacion_reportes <- function(data, config = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(NULL)
  cfg <- monitoreo_normalize_config(config, data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  if (!identical(profile$family, "acreditacion")) return(NULL)

  resumen <- .monitoreo_report_summary_df(data, profile)
  avance_efectivo <- .monitoreo_report_daily_df(data, profile, TRUE)
  avance_general <- .monitoreo_report_daily_df(data, profile, FALSE)
  avance_canal <- .monitoreo_report_daily_channel_df(data, profile)
  avance_fuente <- .monitoreo_report_daily_source_df(data, profile)
  distribucion <- .monitoreo_report_distribution_df(data, profile)
  variables_control <- .monitoreo_report_control_distribution_df(data, profile)
  alertas <- .monitoreo_report_alerts_df(data, profile)
  trazabilidad <- .monitoreo_report_reconciliation_trace_df(data, profile)
  internal_queries <- .monitoreo_acreditacion_internal_queries(data, profile)
  client_report <- .monitoreo_client_report_model(data, cfg)
  client_sheets <- monitoreo_acreditacion_client_report_sheets(client_report, include_targets = FALSE)
  respuestas <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
  encuesta_rows <- if (nrow(respuestas)) {
    source <- as.character(respuestas$.source_label %||% "Respuestas")
    states <- .monitoreo_report_states(respuestas, profile)
    df <- data.frame(Fuente = source, Estado = states, stringsAsFactors = FALSE)
    agg <- as.data.frame(table(df$Fuente, df$Estado), stringsAsFactors = FALSE)
    names(agg) <- c("Fuente", "Estado", "Respuestas")
    agg[agg$Respuestas > 0L, , drop = FALSE]
  } else {
    data.frame(Fuente = "Sin respuestas conectadas", Estado = "Pendiente", Respuestas = 0L, stringsAsFactors = FALSE)
  }

  list(
    schema = "apps_script_acreditacion_v1",
    generated_at = .monitoreo_now_iso(),
    reference_tabs = as.list(c("Resumen", "Alertas", "Monitoreo telefónico", "Avance por encuesta", "Reporte", "Detalle del avance", "Reporte cliente")),
    internal_queries = internal_queries,
    client_report = client_report,
    sheets = c(list(
      .monitoreo_report_sheet("resumen", "Resumen", "Salida interna equivalente a la pestaña Resumen del Apps Script.", list(
        .monitoreo_report_block("resumen_unidad", "Resumen por unidad", resumen),
        .monitoreo_report_block("avance_efectivo_dia", "Avance efectivo por día", avance_efectivo),
        .monitoreo_report_block("avance_general_dia", "Avance general por día", avance_general),
        .monitoreo_report_block("avance_canal_dia", "Avance por canal y día", avance_canal),
        .monitoreo_report_block("distribucion_egresados", "Distribución de egresados por año", distribucion)
      )),
      .monitoreo_report_sheet("monitoreo_telefonico", "Monitoreo telefónico", "Seguimiento de llamadas, estados, responsables, pendientes e incidencias.", .monitoreo_report_phone_blocks(data, profile)),
      .monitoreo_report_sheet("avance_encuesta", "Avance por encuesta", "Resumen de respuestas por encuesta/canal cuando existen fuentes de plataforma conectadas.", list(
        .monitoreo_report_block("resumen_encuesta", "Resumen general por encuesta", encuesta_rows),
        .monitoreo_report_block("avance_fuente_dia", "Avance diario por fuente", avance_fuente)
      )),
      .monitoreo_report_sheet("alertas", "Alertas", "Observaciones de consistencia del barrido y el cruce de respuestas.", list(
        .monitoreo_report_block("alertas", "Observaciones detectadas", alertas),
        .monitoreo_report_block("trazabilidad_cruce", "Trazabilidad de cruce base y respuestas", trazabilidad)
      )),
      .monitoreo_report_sheet("reporte", "Reporte", "Bloques ejecutivos por unidad o carrera; integra avance, cortes diarios y brechas de respuesta.", list(
        .monitoreo_report_block("reporte_interno", "Bloques ejecutivos por unidad", resumen[, intersect(names(resumen), c("Unidad", "Universo", "Mínimo", "Respondidas plataforma", "Efectivas", "Completas", "Parciales", "Rechazos", "Rechazos plataforma", "Rechazos telefónicos", "Sin respuesta plataforma", "Sin respuesta", "Efectivas telefónicas", "Efectivas telefónicas conciliadas", "Efectivas telefónicas sin plataforma completa", "Respuestas plataforma sin cruce base", "Efectivas sin cruce base", "Parciales sin cruce base", "Rechazos plataforma sin cruce base", "Origen avance", "Avance mínimo", "Avance total")), drop = FALSE]),
        .monitoreo_report_block("detalle_diario_efectivo", "Detalle diario - avance efectivo", avance_efectivo),
        .monitoreo_report_block("detalle_diario_general", "Detalle diario - avance general", avance_general),
        .monitoreo_report_block("detalle_variables_control", "Variables de control - base vs avance", variables_control)
      ), scope = "interno")
    ), client_sheets)
  )
}

monitoreo_supervision_sample <- function(data, config = list(), n = NULL, seed = NULL, only_risk = FALSE) {
  if (is.null(data) || !is.data.frame(data) || nrow(data) == 0L) return(data.frame())
  cfg <- monitoreo_normalize_config(config, data)
  n_take <- max(1L, .monitoreo_int(n, cfg$supervision_n))
  seed <- .monitoreo_int(seed, cfg$supervision_seed)
  valid <- .monitoreo_valid_mask(data, cfg)
  duration <- .monitoreo_duration_seconds(data, cfg)
  inc <- .monitoreo_inconsistencies(data, cfg, valid, duration)
  risk <- rep(0L, nrow(data))
  if (nrow(inc)) {
    tab <- table(inc$row)
    risk[as.integer(names(tab))] <- as.integer(tab)
  }
  candidates <- which(valid)
  if (isTRUE(only_risk)) candidates <- intersect(candidates, which(risk > 0L))
  if (!length(candidates)) candidates <- seq_len(nrow(data))
  set.seed(seed)
  prob <- risk[candidates] + 1
  pick <- sample(candidates, size = min(n_take, length(candidates)), replace = FALSE, prob = prob)
  id_var <- cfg$id_var
  enum_var <- cfg$enumerator_var
  contact_var <- cfg$contact_var
  out <- data.frame(
    row = as.integer(pick),
    id = if (nzchar(id_var) && id_var %in% names(data)) as.character(data[[id_var]][pick]) else as.character(pick),
    enumerador = if (nzchar(enum_var) && enum_var %in% names(data)) as.character(data[[enum_var]][pick]) else NA_character_,
    contacto = if (nzchar(contact_var) && contact_var %in% names(data)) as.character(data[[contact_var]][pick]) else NA_character_,
    riesgo = as.integer(risk[pick]),
    stringsAsFactors = FALSE
  )
  ctrl <- unlist(cfg$control_vars, use.names = FALSE)
  for (nm in ctrl) {
    if (nm %in% names(data)) out[[nm]] <- as.character(data[[nm]][pick])
  }
  out[order(-out$riesgo, out$row), , drop = FALSE]
}

monitoreo_export_workbook <- function(data, config = list(), path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete R 'openxlsx' no esta instalado.", call. = FALSE)
  }
  dashboard <- monitoreo_build_dashboard(data, config)
  cfg <- monitoreo_normalize_config(config, data)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "KPIs")
  kpis <- data.frame(
    indicador = names(dashboard$kpis),
    valor = unlist(dashboard$kpis, use.names = FALSE),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "KPIs", kpis)
  openxlsx::addWorksheet(wb, "Avance")
  openxlsx::writeData(wb, "Avance", as.data.frame(dashboard$progress, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Produccion")
  openxlsx::writeData(wb, "Produccion", as.data.frame(dashboard$production, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Inconsistencias")
  openxlsx::writeData(wb, "Inconsistencias", as.data.frame(dashboard$inconsistencies, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Supervision")
  openxlsx::writeData(wb, "Supervision", monitoreo_supervision_sample(data, cfg))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}
