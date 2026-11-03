# =============================================================================
# PDF de avance telefonico — salida cliente agregada
# =============================================================================

.mtpdf_text <- function(x, default = "") {
  x <- as.character(x %||% default)
  if (!length(x) || is.na(x[[1L]])) default else trimws(x[[1L]])
}

.mtpdf_df <- function(x) {
  if (is.data.frame(x)) return(x)
  if (!is.list(x) || !length(x)) return(data.frame())
  if (exists(".monitoreo_workbook_df", mode = "function")) {
    out <- tryCatch(.monitoreo_workbook_df(x), error = function(e) data.frame())
    if (is.data.frame(out) && (nrow(out) || ncol(out))) return(out)
  }
  if (all(vapply(x, is.list, logical(1)))) {
    rows <- lapply(x, function(row) as.data.frame(as.list(row), stringsAsFactors = FALSE, check.names = FALSE))
    return(tryCatch(do.call(rbind, rows), error = function(e) data.frame()))
  }
  tryCatch(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE), error = function(e) data.frame())
}

.mtpdf_block_df <- function(blocks, id) {
  if (!is.list(blocks)) return(data.frame())
  for (block in blocks) {
    if (!identical(.mtpdf_text(block$id), id)) next
    return(.mtpdf_df(block$data %||% block$rows %||% NULL))
  }
  data.frame()
}

.mtpdf_safe_columns <- function(df) {
  if (!ncol(df)) return(df)
  forbidden <- grepl("cod.?pulso|telefono|phone|correo|email|uuid|response.?id|case.?id|persona|nombre", names(df), ignore.case = TRUE)
  df[, !forbidden, drop = FALSE]
}

monitoreo_client_snapshot_with_carga_universe <- function(snapshot, session_state) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) return(snapshot)
  bases <- (session_state$estudio %||% list())$bases %||% list()
  if (!length(bases)) return(snapshot)
  active <- .mtpdf_text((session_state$estudio %||% list())$active_base, "")
  ordered <- unique(c(active, names(bases)))
  ordered <- ordered[nzchar(ordered) & ordered %in% names(bases)]
  selected <- NULL
  for (base_name in ordered) {
    candidate <- (bases[[base_name]] %||% list())$universe_filter %||% NULL
    if (is.list(candidate) && isTRUE(candidate$enabled) && length(candidate$real_values %||% character(0))) {
      selected <- candidate
      selected$base_nombre <- base_name
      break
    }
  }
  if (is.null(selected)) return(snapshot)
  variable <- .mtpdf_text(selected$variable, "")
  if (!nzchar(variable)) return(snapshot)
  norm <- function(x) gsub("[^a-z0-9]", "", iconv(tolower(sub("^.*/", "", x)), to = "ASCII//TRANSLIT"))
  response_mask <- if (".source_role" %in% names(snapshot$data)) tolower(trimws(as.character(snapshot$data$.source_role))) == "respuestas" else rep(TRUE, nrow(snapshot$data))
  before <- sum(response_mask, na.rm = TRUE)
  response_data <- snapshot$data[response_mask, , drop = FALSE]
  resolve_column <- function(name) {
    idx <- match(norm(.mtpdf_text(name)), norm(names(response_data)))
    if (is.na(idx)) "" else names(response_data)[idx]
  }
  cfg <- selected
  cfg$variable <- resolve_column(cfg$variable)
  if (!nzchar(cfg$variable)) return(snapshot)
  cfg$corrections <- lapply(cfg$corrections %||% list(), function(item) {
    item$key_variable <- resolve_column(item$key_variable)
    item$variable <- resolve_column(item$variable)
    item
  })
  cfg$exclusion_rules <- lapply(cfg$exclusion_rules %||% list(), function(item) {
    item$variable <- resolve_column(item$variable)
    item
  })
  if (!exists(".cuf_classify", mode = "function")) return(snapshot)
  classified <- .cuf_classify(response_data, cfg, allow_empty_selection = TRUE)
  keep <- !response_mask
  keep[which(response_mask)] <- classified$keep
  after <- sum(classified$keep, na.rm = TRUE)
  snapshot$data <- snapshot$data[keep, , drop = FALSE]
  response_rows <- which(
    if (".source_role" %in% names(snapshot$data)) {
      tolower(trimws(as.character(snapshot$data$.source_role))) == "respuestas"
    } else {
      rep(TRUE, nrow(snapshot$data))
    }
  )
  # Conservar también las correcciones de clasificación en el corte que recibe
  # el motor del reporte. Si solo se copiara el vector keep, las entrevistas
  # corregidas entrarían en la tabla pero seguirían figurando como prueba.
  if (length(response_rows) == nrow(classified$data)) {
    for (name in intersect(names(snapshot$data), names(classified$data))) {
      snapshot$data[[name]][response_rows] <- classified$data[[name]]
    }
  }
  audit <- classified$summary %||% list()
  real_values <- trimws(as.character(unlist(selected$real_values, use.names = FALSE)))
  snapshot$report_universe_filter <- list(
    applied = TRUE,
    base_nombre = selected$base_nombre,
    variable = variable,
    column = cfg$variable,
    responses_before = as.integer(before),
    responses_after = as.integer(after),
    excluded = as.integer(before - after),
    real_values = as.list(real_values),
    corrected = as.integer(audit$corrected %||% 0L),
    excluded_test = as.integer(audit$excluded_test %||% 0L),
    excluded_unclassified = as.integer(audit$excluded_unclassified %||% 0L),
    excluded_rules = as.integer(audit$excluded_rules %||% 0L),
    corrections = audit$corrections %||% list(),
    exclusion_rules = audit$exclusion_rules %||% list()
  )
  snapshot
}

.mtpdf_parse_date <- function(x) {
  x <- trimws(as.character(x))
  x[x %in% c("", "Sin fecha", "NA", "N/A")] <- NA_character_
  out <- as.Date(rep(NA_character_, length(x)))
  parse_mask <- function(mask, fmt, width = NULL) {
    if (!any(mask)) return(invisible(NULL))
    values <- x[mask]
    if (!is.null(width)) values <- substr(values, 1L, width)
    out[mask] <<- suppressWarnings(as.Date(values, format = fmt))
  }
  parse_mask(!is.na(x) & grepl("^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}", x), "%Y-%m-%d", 10L)
  parse_mask(is.na(out) & !is.na(x) & grepl("^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}", x), "%Y/%m/%d", 10L)
  parse_mask(is.na(out) & !is.na(x) & grepl("^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}", x), "%d/%m/%Y")
  parse_mask(is.na(out) & !is.na(x) & grepl("^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}", x), "%d-%m-%Y")
  out
}

.mtpdf_normalize_daily <- function(df) {
  if (!nrow(df) || !"Fecha" %in% names(df)) return(list(data = data.frame(), invalid = 0L, outside = 0L))
  dates <- .mtpdf_parse_date(df$Fecha)
  invalid <- sum(is.na(dates))
  valid_dates <- dates[!is.na(dates)]
  outside <- rep(FALSE, length(dates))
  if (length(valid_dates)) {
    center <- stats::median(as.numeric(valid_dates))
    outside <- !is.na(dates) & abs(as.numeric(dates) - center) > 366
  }
  keep <- !is.na(dates) & !outside
  if (!any(keep)) return(list(data = data.frame(), invalid = as.integer(invalid), outside = as.integer(sum(outside))))
  numeric_cols <- names(df)[vapply(df, function(col) is.numeric(col) || any(!is.na(suppressWarnings(as.numeric(as.character(col))))), logical(1))]
  numeric_cols <- setdiff(numeric_cols, "Fecha")
  out <- data.frame(Fecha = dates[keep], stringsAsFactors = FALSE)
  for (nm in numeric_cols) out[[nm]] <- suppressWarnings(as.numeric(as.character(df[[nm]][keep])))
  if (length(numeric_cols)) out <- stats::aggregate(out[numeric_cols], by = list(Fecha = out$Fecha), FUN = function(x) sum(x, na.rm = TRUE))
  out <- out[order(out$Fecha), , drop = FALSE]
  list(data = out, invalid = as.integer(invalid), outside = as.integer(sum(outside)))
}

.mtpdf_metric <- function(summary, label, default = NA_real_) {
  if (!nrow(summary)) return(default)
  label_col <- intersect(names(summary), c("Indicador", "Metrica", "Métrica"))[1]
  value_col <- intersect(names(summary), c("Casos", "Valor", "Total"))[1]
  if (is.na(label_col) || is.na(value_col)) return(default)
  idx <- which(tolower(trimws(as.character(summary[[label_col]]))) == tolower(label))
  if (!length(idx)) return(default)
  value <- suppressWarnings(as.numeric(summary[[value_col]][idx[[1L]]]))
  if (length(value) && is.finite(value)) value else default
}

.mtpdf_status_metric <- function(status, label, default = NA_real_) {
  if (!nrow(status) || !all(c("Estatus", "Casos") %in% names(status))) return(default)
  idx <- which(tolower(trimws(as.character(status$Estatus))) == tolower(label))
  if (!length(idx)) return(default)
  value <- suppressWarnings(as.numeric(status$Casos[idx[[1L]]]))
  if (length(value) && is.finite(value)) value else default
}

.mtpdf_match_data_column <- function(data, variable, prefer_populated = FALSE) {
  if (!is.data.frame(data) || !ncol(data)) return("")
  normalize <- function(x) {
    x <- iconv(tolower(trimws(as.character(x))), to = "ASCII//TRANSLIT")
    gsub("[^a-z0-9]", "", x)
  }
  target <- normalize(variable)
  names_full <- normalize(names(data))
  names_tail <- normalize(sub("^.*/", "", names(data)))
  exact <- which(names_full == target | names_tail == target)
  if (!isTRUE(prefer_populated) && length(exact)) return(names(data)[[exact[[1L]]]])
  candidates <- unique(c(
    exact,
    which(grepl(target, names_full, fixed = TRUE) | grepl(target, names_tail, fixed = TRUE))
  ))
  if (!length(candidates)) return("")
  populated <- vapply(candidates, function(i) {
    values <- trimws(as.character(data[[i]]))
    sum(!is.na(values) & nzchar(values))
  }, numeric(1))
  exact_bonus <- as.numeric(candidates %in% exact) / 10
  names(data)[[candidates[[which.max(populated + exact_bonus)]]]]
}

# Nombre legible de cada dimensión de cuota. `dim_actor` es la copia interna de
# la columna que la fuente declaró como actor («Periodo de Llegada» en el RMS) y
# no puede llegar al cliente: se busca la columna del barrido que dice lo mismo
# fila por fila. Sin una que calce, «Grupo» antes que el nombre interno.
.mtpdf_quota_labels <- function(quotas, data) {
  variables <- unique(as.character(quotas$Variable %||% character(0)))
  variables <- variables[nzchar(variables) & !is.na(variables)]
  internas <- c("dim_actor", ".dim_actor", ".source_actor", "source_actor", "actor", "Actor")
  out <- stats::setNames(variables, variables)
  for (variable in intersect(variables, internas)) {
    out[[variable]] <- "Grupo"
    if (!is.data.frame(data) || !variable %in% names(data)) next
    filas <- if (".source_role" %in% names(data)) tolower(as.character(data$.source_role)) == "barrido" else rep(TRUE, nrow(data))
    ref <- trimws(as.character(data[[variable]][filas]))
    con_valor <- !is.na(ref) & nzchar(ref)
    if (!any(con_valor)) next
    candidatas <- setdiff(names(data), c(internas, grep("^\\.", names(data), value = TRUE)))
    for (columna in candidatas) {
      valores <- trimws(as.character(data[[columna]][filas]))
      if (identical(valores[con_valor], ref[con_valor])) {
        # «Periodo de Llegada» → «Periodo de llegada»: el título de una columna
        # de Sheets no es el de un rótulo de documento.
        out[[variable]] <- paste0(substr(columna, 1L, 1L), tolower(substring(columna, 2L)))
        break
      }
    }
  }
  out
}

.mtpdf_reconcile_response_counts <- function(model, data, profile = list()) {
  if (!is.data.frame(data) || !nrow(data) || !(".source_role" %in% names(data))) return(model)
  is_response <- tolower(trimws(as.character(data$.source_role))) == "respuestas"
  responses <- data[is_response, , drop = FALSE]
  if (!nrow(responses)) return(model)

  # Solo las respuestas EFECTIVAS alimentan los conteos de este reporte. El motor
  # ya aplica este criterio (consentimiento del perfil y exclusión de pruebas) al
  # calcular las cuotas; contar acá las filas crudas hacía que la columna
  # Efectivas dejara de producir el "Avance meta" y la "Brecha" de su propia fila.
  # Se reusa la máscara del motor, no una reimplementación: fuera de la familia
  # telefónica devuelve todo TRUE y el conteo por filas queda igual que antes.
  effective <- .monitoreo_report_effective_filter_mask(responses, profile)
  if (length(effective) == nrow(responses)) {
    effective[is.na(effective)] <- FALSE
    responses <- responses[effective, , drop = FALSE]
    if (!nrow(responses)) return(model)
  }

  model$metrics <- model$metrics %||% list()
  # La unidad del avance es la encuesta efectiva, no el código de contacto.
  # Esto conserva dos respuestas válidas aunque compartan el mismo CodPulso.
  model$metrics$kobo_effective <- as.integer(nrow(responses))

  # El día de cada respuesta es el que usa el motor: el instante del envío en la
  # hora de Lima (`.monitoreo_report_date_values`). Leer `kobo_fecha_iso` daba el
  # día UTC y corría al día siguiente toda entrevista enviada después de las 19:00.
  response_dates <- .mtpdf_parse_date(.monitoreo_report_date_values(responses))
  if (length(response_dates) && any(!is.na(response_dates))) {
    daily_counts <- table(response_dates[!is.na(response_dates)])
    daily <- .mtpdf_df(model$daily %||% data.frame())
    daily_dates <- if ("Fecha" %in% names(daily)) .mtpdf_parse_date(daily$Fecha) else as.Date(character(0))
    all_dates <- sort(unique(c(daily_dates[!is.na(daily_dates)], as.Date(names(daily_counts)))))
    aligned <- data.frame(Fecha = all_dates, stringsAsFactors = FALSE)
    if (nrow(daily)) {
      match_old <- match(all_dates, daily_dates)
      for (name in setdiff(names(daily), "Fecha")) aligned[[name]] <- daily[[name]][match_old]
    }
    counts <- as.integer(daily_counts[as.character(all_dates)])
    counts[is.na(counts)] <- 0L
    aligned[["Efectivas"]] <- counts
    aligned[["Efectivas Kobo"]] <- counts
    model$daily <- aligned
  }

  quotas <- .mtpdf_df(model$quotas %||% data.frame())
  variable_col <- intersect(c("Variable", "Dimension", "Dimensión"), names(quotas))[1]
  value_col <- intersect(c("Valor", "Segmento", "Grupo"), names(quotas))[1]
  actual_col <- intersect(c("Efectivas", "Válidas", "Validas", "Logrado"), names(quotas))[1]
  if (nrow(quotas) && !is.na(variable_col) && !is.na(value_col) && !is.na(actual_col)) {
    touched <- integer(0)
    for (dimension in unique(as.character(quotas[[variable_col]]))) {
      data_col <- .mtpdf_match_data_column(responses, dimension, prefer_populated = TRUE)
      if (!nzchar(data_col)) next
      counts <- table(trimws(as.character(responses[[data_col]])))
      rows <- which(as.character(quotas[[variable_col]]) == dimension)
      values <- trimws(as.character(quotas[[value_col]][rows]))
      # Una columna homónima que no trae ninguno de los valores de la cuota no
      # es la dimensión: en el RMS el periodo vive en el barrido y las respuestas
      # traen `dim_actor` vacía. Contarla borraba las efectivas que el motor ya
      # cruzó por la llave; se conservan las del motor.
      if (!any(values %in% names(counts))) next
      actual <- as.integer(counts[values])
      actual[is.na(actual)] <- 0L
      quotas[[actual_col]][rows] <- actual
      touched <- c(touched, rows)
    }
    # Reescribir Efectivas sin reescribir lo que se deriva de ella deja la fila
    # contradiciéndose: el "Avance meta" y la "Brecha" seguían saliendo del conteo
    # del motor. Se recalculan con la misma regla del motor
    # (.monitoreo_report_phone_quota_df) para que la tabla nunca afirme dos cifras
    # incompatibles sobre la misma cuota.
    quotas <- .mtpdf_refresh_quota_gap(quotas, unique(touched), actual_col)
    model$quotas <- quotas
  }
  model
}

# Deriva "Avance meta", "Brecha" y "Estado cuota" del conteo efectivo de cada fila.
# Espeja la regla del motor: brecha con piso en cero y "Cumple" al alcanzar la meta.
.mtpdf_refresh_quota_gap <- function(quotas, rows, actual_col) {
  if (!length(rows) || is.na(actual_col) || !(actual_col %in% names(quotas))) return(quotas)
  meta_col <- intersect(c("Meta", "Cuota", "Objetivo"), names(quotas))[1]
  if (is.na(meta_col)) return(quotas)
  advance_col <- intersect(c("Avance meta", "Avance"), names(quotas))[1]
  gap_col <- intersect(c("Brecha", "Faltante"), names(quotas))[1]
  state_col <- intersect(c("Estado cuota", "Estado"), names(quotas))[1]
  for (i in rows) {
    meta <- suppressWarnings(as.numeric(quotas[[meta_col]][[i]]))
    effective <- suppressWarnings(as.numeric(quotas[[actual_col]][[i]]))
    if (!is.finite(effective)) next
    if (!is.na(advance_col)) {
      quotas[[advance_col]][[i]] <- if (is.finite(meta) && meta > 0) round(100 * effective / meta, 1) else NA_real_
    }
    if (!is.na(gap_col)) {
      quotas[[gap_col]][[i]] <- if (is.finite(meta)) as.integer(max(0, meta - effective)) else NA_integer_
    }
    if (!is.na(state_col)) {
      quotas[[state_col]][[i]] <- if (!is.finite(meta)) "Sin meta" else if (effective >= meta) "Cumple" else "Brecha"
    }
  }
  quotas
}

build_monitoreo_telefonico_report_model <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) stop_api(409, "E_NO_MONITOREO_DATA", "Sin datos de Monitoreo.")
  data <- snapshot$data
  cfg <- monitoreo_normalize_config(cfg, data)
  family <- .monitoreo_publication_family_key(cfg$monitoreo_profile$family %||% detect_monitoreo_family(config = cfg, data = data))
  if (!identical(family, "telefonico")) stop_api(409, "E_PERFIL_NO_TELEFONICO", "El reporte telefónico requiere un perfil telefónico.")
  blocks <- .monitoreo_report_phone_blocks(data, cfg$monitoreo_profile %||% list(), cfg)
  summary <- .mtpdf_block_df(blocks, "resumen_telefonico")
  daily <- .mtpdf_normalize_daily(.mtpdf_block_df(blocks, "avance_efectivo_dia"))
  status <- .mtpdf_safe_columns(.mtpdf_block_df(blocks, "estatus_telefonico"))
  quotas <- .mtpdf_safe_columns(.mtpdf_block_df(blocks, "cuotas_variable"))
  if (nrow(quotas) && "Actor" %in% names(quotas) && any(as.character(quotas$Actor) == "Total")) {
    quotas <- quotas[as.character(quotas$Actor) == "Total", , drop = FALSE]
  }
  daily_actor <- .mtpdf_safe_columns(.mtpdf_block_df(blocks, "avance_efectivo_actor_dia"))
  sources <- if (all(c(".source_id", ".source_role") %in% names(data))) {
    stats::aggregate(rep(1L, nrow(data)), by = list(
      Rol = as.character(data$.source_role),
      Fuente = as.character(data$.source_label %||% data$.source_id)
    ), FUN = sum)
  } else data.frame()
  if (nrow(sources)) names(sources)[ncol(sources)] <- "Registros"
  total <- .mtpdf_metric(summary, "Total telefónico", sum(data$.source_role == "barrido", na.rm = TRUE))
  swept <- .mtpdf_metric(summary, "Casos barridos", NA_real_)
  not_swept <- .mtpdf_metric(summary, "No barridos", if (is.finite(total) && is.finite(swept)) total - swept else NA_real_)
  daily_df <- daily$data
  last_value <- function(names) {
    nm <- intersect(names, names(daily_df))[1]
    if (is.na(nm) || !nrow(daily_df)) return(NA_real_)
    .mtpdf_sum_or_na(daily_df[[nm]])
  }
  phone_effective <- .mtpdf_status_metric(status, "Efectivo", last_value(c("Efectivas telefónicas", "Efectivas telefonicas")))
  phone_non_effective <- if (
    is.finite(swept) && swept >= 0 && is.finite(phone_effective) &&
      phone_effective >= 0 && phone_effective <= swept
  ) swept - phone_effective else NA_real_
  model <- list(
    schema = "monitoreo_telefonico_advance_report_v1",
    report_kind = "telefonico_advance_pdf",
    family = "telefonico",
    generated_at = format(Sys.time(), "%Y-%m-%d %H:%M %Z"),
    synced_at = .mtpdf_text(snapshot$synced_at, "Sin registro"),
    include_targets = isTRUE(include_targets),
    metrics = list(
      total = total,
      swept = swept,
      not_swept = not_swept,
      phone_effective = phone_effective,
      phone_non_effective = phone_non_effective,
      kobo_effective = last_value(c("Efectivas Kobo", "Efectivas"))
    ),
    daily = daily_df,
    daily_quality = daily[c("invalid", "outside")],
    daily_actor = daily_actor[, intersect(c("Actor", "Fecha", "Efectivas"), names(daily_actor)), drop = FALSE],
    status = status,
    quotas = quotas,
    quota_labels = .mtpdf_quota_labels(quotas, data),
    sources = .mtpdf_safe_columns(sources),
    universe_filter = snapshot$report_universe_filter %||% list(applied = FALSE),
    methodology = c(
      "El universo operativo proviene de la hoja de barrido y las encuestas validas provienen de la base de respuestas filtrada.",
      "Las fechas equivalentes se normalizan al día civil; fechas inválidas o alejadas más de un año del corte se excluyen del gráfico y se contabilizan.",
      "El documento cliente presenta el volumen recogido, su distribución, el registro diario y la base telefónica considerada.",
      if (isTRUE((snapshot$report_universe_filter %||% list())$applied)) {
        sprintf("Preparación de datos: se recibieron %s respuestas, se retiraron %s encuestas de prueba o no clasificadas y se consideraron %s respuestas de campo.", snapshot$report_universe_filter$responses_before, snapshot$report_universe_filter$excluded, snapshot$report_universe_filter$responses_after)
      } else {
        "No consta una clasificación de encuestas de campo y de prueba para este informe."
      }
    )
  )
  .mtpdf_reconcile_response_counts(model, data, cfg$monitoreo_profile %||% list())
}

.mtpdf_num <- function(x, default = 0) {
  out <- suppressWarnings(as.numeric(gsub("%", "", as.character(x))))
  out[!is.finite(out)] <- default
  out
}

.mtpdf_sum_or_na <- function(x) {
  values <- suppressWarnings(as.numeric(as.character(x)))
  values <- values[is.finite(values)]
  if (!length(values)) return(NA_real_)
  sum(values)
}

.mtpdf_report_facts <- function(model) {
  quotas <- .mtpdf_df(model$quotas %||% data.frame())
  variable_col <- intersect(c("Variable", "Dimension", "Dimensión"), names(quotas))[1]
  value_col <- intersect(c("Valor", "Segmento", "Grupo"), names(quotas))[1]
  meta_col <- intersect(c("Meta", "Cuota", "Objetivo"), names(quotas))[1]
  actual_col <- intersect(c("Efectivas", "Válidas", "Validas", "Logrado"), names(quotas))[1]
  universe_col <- intersect(c("Universo", "Total"), names(quotas))[1]
  pending_col <- intersect(c("No barridos", "Pendientes"), names(quotas))[1]
  if (nrow(quotas) && is.na(value_col)) {
    reserved <- na.omit(c(variable_col, meta_col, actual_col, universe_col, pending_col))
    candidates <- setdiff(names(quotas), reserved)
    if (length(candidates)) value_col <- candidates[[1L]]
  }
  empty_rows <- function() data.frame(
    segment = character(0), target = numeric(0), actual = numeric(0), pct = numeric(0),
    margin = numeric(0), universe = numeric(0), pending = numeric(0), swept = numeric(0),
    coverage_pct = numeric(0), stringsAsFactors = FALSE
  )
  optional_numbers <- function(df, col) {
    if (is.na(col) || !col %in% names(df)) return(rep(NA_real_, nrow(df)))
    .mtpdf_num(df[[col]], NA_real_)
  }
  if (nrow(quotas)) {
    inferred_dimension <- if (!is.na(value_col)) value_col else "Categoría"
    dimension_values <- if (!is.na(variable_col)) as.character(quotas[[variable_col]]) else rep(inferred_dimension, nrow(quotas))
    dimension_values[is.na(dimension_values) | !nzchar(trimws(dimension_values))] <- "Categoría"
    dimension_labels <- unique(dimension_values)
  } else {
    dimension_values <- character(0)
    dimension_labels <- character(0)
  }
  quota_dimensions <- lapply(dimension_labels, function(label) {
    current <- quotas[dimension_values == label, , drop = FALSE]
    target <- optional_numbers(current, meta_col)
    actual <- optional_numbers(current, actual_col)
    universe <- optional_numbers(current, universe_col)
    pending <- optional_numbers(current, pending_col)
    swept <- ifelse(is.finite(universe) & is.finite(pending), pmax(0, universe - pending), NA_real_)
    coverage_pct <- ifelse(is.finite(universe) & universe > 0 & is.finite(swept), 100 * swept / universe, NA_real_)
    segments <- if (!is.na(value_col)) as.character(current[[value_col]]) else sprintf("Categoría %d", seq_len(nrow(current)))
    segments[is.na(segments) | !nzchar(trimws(segments))] <- sprintf("Categoría %d", which(is.na(segments) | !nzchar(trimws(segments))))
    rows <- data.frame(
      segment = segments,
      target = target,
      actual = actual,
      pct = ifelse(is.finite(target) & target > 0 & is.finite(actual), 100 * actual / target, NA_real_),
      margin = ifelse(is.finite(target) & is.finite(actual), actual - target, NA_real_),
      universe = universe,
      pending = pending,
      swept = swept,
      coverage_pct = coverage_pct,
      stringsAsFactors = FALSE
    )
    list(
      label = .mtpdf_text(label, "Categoría"),
      rows = rows,
      has_targets = any(is.finite(target) & target > 0),
      has_actual = any(is.finite(actual)),
      has_category_coverage = any(is.finite(coverage_pct))
    )
  })
  names(quota_dimensions) <- vapply(quota_dimensions, `[[`, character(1), "label")
  requested_dimension <- .mtpdf_text(model$primary_quota_dimension %||% model$quota_dimension %||% "")
  primary_idx <- if (length(quota_dimensions) && nzchar(requested_dimension)) {
    match(tolower(requested_dimension), tolower(names(quota_dimensions)))
  } else {
    NA_integer_
  }
  if (!length(primary_idx) || is.na(primary_idx)) {
    with_actual <- which(vapply(quota_dimensions, function(x) isTRUE(x$has_actual), logical(1)))
    primary_idx <- if (length(with_actual)) with_actual[[1L]] else if (length(quota_dimensions)) 1L else NA_integer_
  }
  primary <- if (!is.na(primary_idx)) quota_dimensions[[primary_idx]] else list(
    label = "Categoría", rows = empty_rows(), has_targets = FALSE,
    has_actual = FALSE, has_category_coverage = FALSE
  )
  quota_rows <- primary$rows
  quota_target <- if (nrow(quota_rows) && any(is.finite(quota_rows$target))) sum(quota_rows$target, na.rm = TRUE) else NA_real_
  quota_actual <- if (nrow(quota_rows) && any(is.finite(quota_rows$actual))) sum(quota_rows$actual, na.rm = TRUE) else NA_real_
  quota_pct <- if (is.finite(quota_target) && quota_target > 0 && is.finite(quota_actual)) 100 * quota_actual / quota_target else NA_real_

  daily <- .mtpdf_df(model$daily %||% data.frame())
  daily_col <- intersect(c("Efectivas Kobo", "Efectivas", "Válidas", "Validas"), names(daily))[1]
  daily_values <- if (!is.na(daily_col)) .mtpdf_num(daily[[daily_col]]) else numeric(0)
  daily_dates <- if ("Fecha" %in% names(daily)) suppressWarnings(as.Date(as.character(daily$Fecha))) else as.Date(character(0))
  keep_daily <- is.finite(daily_values) & daily_values >= 0 & !is.na(daily_dates)
  daily_values <- daily_values[keep_daily]
  daily_dates <- daily_dates[keep_daily]
  cumulative <- cumsum(daily_values)
  reached_idx <- if (is.finite(quota_target) && quota_target > 0) which(cumulative >= quota_target) else integer(0)
  best_idx <- if (length(daily_values)) which.max(daily_values) else integer(0)

  metrics <- model$metrics %||% list()
  total <- .mtpdf_num(metrics$total %||% NA_real_, NA_real_)[[1L]]
  swept <- .mtpdf_num(metrics$swept %||% NA_real_, NA_real_)[[1L]]
  pending_total <- .mtpdf_num(metrics$not_swept %||% NA_real_, NA_real_)[[1L]]
  phone_effective <- .mtpdf_num(metrics$phone_effective %||% NA_real_, NA_real_)[[1L]]
  phone_non_effective <- .mtpdf_num(metrics$phone_non_effective %||% NA_real_, NA_real_)[[1L]]
  valid_effectiveness <- is.finite(swept) && swept >= 0 && is.finite(phone_effective) &&
    phone_effective >= 0 && phone_effective <= swept
  if (isTRUE(valid_effectiveness) && !is.finite(phone_non_effective)) {
    phone_non_effective <- swept - phone_effective
  }
  valid_effectiveness <- isTRUE(valid_effectiveness) && is.finite(phone_non_effective) &&
    phone_non_effective >= 0 && abs((phone_effective + phone_non_effective) - swept) < 0.5
  filter <- model$universe_filter %||% list(applied = FALSE)
  real_responses <- .mtpdf_num(filter$responses_after %||% NA_real_, NA_real_)[[1L]]
  if (!is.finite(real_responses)) {
    sources <- .mtpdf_df(model$sources %||% data.frame())
    if (nrow(sources) && all(c("Rol", "Registros") %in% names(sources))) {
      idx <- which(tolower(as.character(sources$Rol)) == "respuestas")
      if (length(idx)) real_responses <- .mtpdf_num(sources$Registros[idx[[1L]]], NA_real_)[[1L]]
    }
  }
  # Cuando Carga dejó constancia de un universo efectivo, ese conteo representa
  # respuestas incluidas. No se reduce por códigos de contacto repetidos: dos
  # entrevistas válidas con el mismo código siguen siendo dos encuestas.
  total_valid <- if (isTRUE(filter$applied) && is.finite(real_responses)) {
    real_responses
  } else {
    .mtpdf_num(metrics$kobo_effective %||% NA_real_, NA_real_)[[1L]]
  }
  if (!is.finite(total_valid) && is.finite(quota_actual)) total_valid <- quota_actual
  if (!is.finite(total_valid) && is.finite(real_responses)) total_valid <- real_responses
  primary_target <- quota_rows$target
  primary_actual <- quota_rows$actual
  list(
    quota_dimension = primary$label,
    primary_quota_dimension = primary$label,
    quota_dimensions = quota_dimensions,
    quota_rows = quota_rows,
    quota_target = quota_target,
    quota_actual = quota_actual,
    quota_pct = quota_pct,
    quota_margin = if (is.finite(quota_actual) && is.finite(quota_target)) quota_actual - quota_target else NA_real_,
    quotas_met = sum(is.finite(primary_actual) & is.finite(primary_target) & primary_actual >= primary_target & primary_target > 0),
    quotas_total = sum(is.finite(primary_target) & primary_target > 0),
    category_count = nrow(quota_rows),
    has_targets = isTRUE(primary$has_targets),
    has_category_coverage = isTRUE(primary$has_category_coverage),
    total_valid = total_valid,
    daily_dates = daily_dates,
    daily_values = daily_values,
    cumulative = cumulative,
    field_start = if (length(daily_dates)) min(daily_dates) else as.Date(NA),
    field_end = if (length(daily_dates)) max(daily_dates) else as.Date(NA),
    field_days = length(daily_values),
    daily_average = if (length(daily_values)) mean(daily_values) else NA_real_,
    daily_median = if (length(daily_values)) stats::median(daily_values) else NA_real_,
    best_value = if (length(best_idx)) daily_values[[best_idx]] else NA_real_,
    best_date = if (length(best_idx)) daily_dates[[best_idx]] else as.Date(NA),
    reached_date = if (length(reached_idx)) daily_dates[[reached_idx[[1L]]]] else as.Date(NA),
    total = total,
    swept = swept,
    pending = pending_total,
    coverage_pct = if (is.finite(total) && total > 0 && is.finite(swept)) 100 * swept / total else NA_real_,
    has_global_coverage = is.finite(total) && total > 0 && is.finite(swept),
    phone_effective = if (isTRUE(valid_effectiveness)) phone_effective else NA_real_,
    phone_non_effective = if (isTRUE(valid_effectiveness)) phone_non_effective else NA_real_,
    phone_effectiveness_pct = if (isTRUE(valid_effectiveness) && swept > 0) 100 * phone_effective / swept else NA_real_,
    has_phone_effectiveness = isTRUE(valid_effectiveness) && swept > 0,
    real_responses = real_responses,
    responses_before = .mtpdf_num(filter$responses_before %||% NA_real_, NA_real_)[[1L]],
    test_excluded = .mtpdf_num(filter$excluded %||% 0, 0)[[1L]],
    filter_applied = isTRUE(filter$applied)
  )
}
