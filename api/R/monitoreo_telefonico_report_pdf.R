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
  idx <- match(norm(variable), norm(names(snapshot$data)))
  if (is.na(idx)) return(snapshot)
  column <- names(snapshot$data)[idx]
  values <- trimws(as.character(snapshot$data[[column]]))
  real_values <- trimws(as.character(unlist(selected$real_values, use.names = FALSE)))
  response_mask <- if (".source_role" %in% names(snapshot$data)) tolower(trimws(as.character(snapshot$data$.source_role))) == "respuestas" else rep(TRUE, nrow(snapshot$data))
  keep <- !response_mask | (!is.na(values) & values %in% real_values)
  before <- sum(response_mask, na.rm = TRUE)
  after <- sum(response_mask & keep, na.rm = TRUE)
  snapshot$data <- snapshot$data[keep, , drop = FALSE]
  snapshot$report_universe_filter <- list(
    applied = TRUE,
    base_nombre = selected$base_nombre,
    variable = variable,
    column = column,
    responses_before = as.integer(before),
    responses_after = as.integer(after),
    excluded = as.integer(before - after),
    real_values = as.list(real_values)
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

build_monitoreo_telefonico_report_model <- function(snapshot, cfg, include_targets = FALSE) {
  if (is.null(snapshot) || !is.data.frame(snapshot$data) || !nrow(snapshot$data)) stop_api(409, "E_NO_MONITOREO_DATA", "Sin datos de Monitoreo.")
  data <- snapshot$data
  cfg <- monitoreo_normalize_config(cfg, data)
  family <- .monitoreo_publication_family_key(cfg$monitoreo_profile$family %||% detect_monitoreo_family(config = cfg, data = data))
  if (!identical(family, "telefonico")) stop_api(409, "E_PERFIL_NO_TELEFONICO", "El reporte telefonico requiere un perfil telefonico.")
  blocks <- .monitoreo_report_phone_blocks(data, cfg$monitoreo_profile %||% list(), cfg)
  summary <- .mtpdf_block_df(blocks, "resumen_telefonico")
  daily <- .mtpdf_normalize_daily(.mtpdf_block_df(blocks, "avance_efectivo_dia"))
  status <- .mtpdf_safe_columns(.mtpdf_block_df(blocks, "estatus_telefonico"))
  quotas <- .mtpdf_safe_columns(.mtpdf_block_df(blocks, "cuotas_variable"))
  if (nrow(quotas) && "Actor" %in% names(quotas) && any(as.character(quotas$Actor) == "Total")) {
    quotas <- quotas[as.character(quotas$Actor) == "Total", , drop = FALSE]
  }
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
  list(
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
    quotas = quotas,
    sources = .mtpdf_safe_columns(sources),
    universe_filter = snapshot$report_universe_filter %||% list(applied = FALSE),
    methodology = c(
      "El universo operativo proviene de la hoja de barrido y las encuestas validas provienen de la base de respuestas filtrada.",
      "Las fechas equivalentes se normalizan al dia civil; fechas invalidas o alejadas mas de un año del corte se excluyen del grafico y se contabilizan.",
      "El documento cliente presenta el volumen recogido, su distribución, el registro diario y la base telefónica considerada.",
      if (isTRUE((snapshot$report_universe_filter %||% list())$applied)) {
        sprintf("Preparación de datos: se recibieron %s respuestas, se retiraron %s encuestas de prueba o no clasificadas y se consideraron %s respuestas de campo.", snapshot$report_universe_filter$responses_before, snapshot$report_universe_filter$excluded, snapshot$report_universe_filter$responses_after)
      } else {
        "No consta una clasificación de encuestas de campo y de prueba para este informe."
      }
    )
  )
}

.mtpdf_wrap <- function(x, width = 90L) paste(strwrap(.mtpdf_text(x), width = width), collapse = "\n")

.mtpdf_safe_font_size <- function(size, minimum = 7) {
  value <- suppressWarnings(as.numeric(size)[[1L]])
  if (!is.finite(value)) value <- minimum
  max(minimum, value)
}

.mtpdf_daily_legend_layout <- function(panel_x = 0.050, panel_y = 0.135, panel_width = 0.640) {
  group_width <- 0.266
  list(
    x = panel_x + (panel_width - group_width) / 2,
    y = panel_y + 0.022,
    width = group_width
  )
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

.mtpdf_fmt <- function(x) formatC(as.integer(round(.mtpdf_num(x, 0)[[1L]])), big.mark = ",", format = "d")

.mtpdf_date_label <- function(x, with_year = FALSE) {
  value <- suppressWarnings(as.Date(as.character(x)))
  if (!length(value) || is.na(value[[1L]])) return("")
  months <- c("ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "set.", "oct.", "nov.", "dic.")
  suffix <- if (isTRUE(with_year)) paste0(" ", format(value[[1L]], "%Y")) else ""
  sprintf("%d %s%s", as.integer(format(value[[1L]], "%d")), months[[as.integer(format(value[[1L]], "%m"))]], suffix)
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
  total_valid <- .mtpdf_num(metrics$kobo_effective %||% NA_real_, NA_real_)[[1L]]
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

monitoreo_telefonico_advance_report_pdf <- function(model, path, include_targets = FALSE) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  if (isTRUE(capabilities("cairo"))) {
    grDevices::cairo_pdf(path, width = 11.69, height = 8.27, onefile = TRUE, family = "Helvetica")
  } else {
    grDevices::pdf(path, paper = "special", width = 11.69, height = 8.27, onefile = TRUE, family = "Helvetica")
  }
  device <- grDevices::dev.cur()
  closed <- FALSE
  close_pdf <- function() {
    if (isTRUE(closed)) return(invisible(NULL))
    tryCatch(if (identical(grDevices::dev.cur(), device)) grDevices::dev.off() else grDevices::dev.off(device), error = function(e) NULL)
    closed <<- TRUE
    invisible(NULL)
  }
  on.exit(close_pdf(), add = TRUE)

  facts <- .mtpdf_report_facts(model)
  quota_met <- is.finite(facts$quota_pct) && facts$quota_pct >= 100
  ink <- "#17212F"; muted <- "#5F6B7A"; faint <- "#8792A2"; canvas <- "#F3F5F9"
  panel <- "#FFFFFF"; border <- "#C7D7E8"; grid_line <- "#E7EDF5"; navy <- "#002457"
  deep_blue <- "#0B3A66"; teal <- "#0E7490"; green <- "#0F8F7D"; green_dark <- "#0F766E"
  blue_soft <- "#EEF4FA"; green_soft <- "#EAF5F2"; amber <- "#B7791F"; amber_soft <- "#FFF8E8"
  fmt <- .mtpdf_fmt
  pct <- function(x) if (is.finite(x)) sprintf("%.1f%%", x) else "S/D"
  rr <- function(x, y, w, h, fill = panel, col = border, lwd = 1, r = 0.014) {
    grid::grid.roundrect(x = grid::unit(x + w / 2, "npc"), y = grid::unit(y + h / 2, "npc"), width = grid::unit(w, "npc"), height = grid::unit(h, "npc"), r = grid::unit(r, "snpc"), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  }
  rect <- function(x, y, w, h, fill, col = NA, lwd = 1) {
    grid::grid.rect(x = grid::unit(x + w / 2, "npc"), y = grid::unit(y + h / 2, "npc"), width = grid::unit(w, "npc"), height = grid::unit(h, "npc"), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  }
  txt <- function(label, x, y, size = 8, col = ink, face = "plain", just = c("left", "center"), lineheight = 1.03) {
    grid::grid.text(as.character(label %||% ""), x = grid::unit(x, "npc"), y = grid::unit(y, "npc"), just = just, gp = grid::gpar(fontsize = .mtpdf_safe_font_size(size), col = col, fontface = face, lineheight = lineheight))
  }
  line <- function(x0, y0, x1, y1, col = border, lwd = 1, lty = 1) {
    grid::grid.segments(x0 = grid::unit(x0, "npc"), y0 = grid::unit(y0, "npc"), x1 = grid::unit(x1, "npc"), y1 = grid::unit(y1, "npc"), gp = grid::gpar(col = col, lwd = lwd, lty = lty, lineend = "round"))
  }
  logo_path <- function() {
    candidates <- c(
      system.file("hojas_ruta", "assets", "logo_pulso.png", package = "prosecnurapp"),
      file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
      file.path(getwd(), "frontend", "public", "pulso-pucp-logo.png")
    )
    candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
    if (length(candidates)) candidates[[1L]] else ""
  }
  draw_logo <- function(x, y, height = 0.044) {
    path_logo <- logo_path()
    if (nzchar(path_logo) && requireNamespace("png", quietly = TRUE)) {
      img <- tryCatch(png::readPNG(path_logo), error = function(e) NULL)
      if (!is.null(img)) {
        width <- height * (dim(img)[[2L]] / dim(img)[[1L]]) * (8.27 / 11.69)
        grid::grid.raster(img, x = grid::unit(x + width / 2, "npc"), y = grid::unit(y, "npc"), width = grid::unit(width, "npc"), height = grid::unit(height, "npc"), interpolate = TRUE)
        return(invisible(width))
      }
    }
    txt("PULSO\nPUCP", x, y, size = 9.5, col = navy, face = "bold", just = c("left", "center"), lineheight = 0.85)
    invisible(0.085)
  }
  field_start <- .mtpdf_date_label(facts$field_start, TRUE)
  field_end <- .mtpdf_date_label(facts$field_end, TRUE)
  page_no <- 0L
  draw_field_chip <- function(x, y) {
    w <- 0.285; h <- 0.044
    rr(x, y - h / 2, w, h, fill = panel, col = border, lwd = 0.9, r = 0.012)
    rect(x, y - h / 2, 0.006, h, navy)
    txt("CAMPO", x + 0.018, y + 0.012, size = 5.0, col = muted, face = "bold")
    txt(field_start, x + 0.018, y - 0.010, size = 6.5, col = navy, face = "bold")
    line(x + 0.098, y - 0.010, x + 0.120, y - 0.010, col = faint, lwd = 1.1)
    txt(field_end, x + 0.130, y - 0.010, size = 6.5, col = green_dark, face = "bold")
    rr(x + w - 0.074, y - 0.010, 0.062, 0.020, fill = blue_soft, col = border, lwd = 0.6, r = 0.010)
    txt(paste(fmt(facts$field_days), "días"), x + w - 0.043, y, size = 6.0, col = navy, face = "bold", just = c("center", "center"))
  }
  draw_page <- function(section) {
    page_no <<- page_no + 1L
    grid::grid.newpage(); rect(0, 0, 1, 1, canvas); rect(0, 0.908, 1, 0.092, panel); rect(0, 0.908, 1, 0.006, navy)
    logo_w <- draw_logo(0.048, 0.960)
    txt("Informe de avance", 0.048 + logo_w + 0.018, 0.966, size = 11.8, col = navy, face = "bold")
    txt("Levantamiento telefónico", 0.048 + logo_w + 0.018, 0.941, size = 6.8, col = muted, face = "bold")
    if (nzchar(field_start) || nzchar(field_end)) draw_field_chip(0.665, 0.958)
    line(0.050, 0.060, 0.950, 0.060, col = border, lwd = 0.6)
    year <- if (!is.na(facts$field_end)) format(facts$field_end, "%Y") else format(Sys.Date(), "%Y")
    txt(paste0("PULSO PUCP · ", year), 0.050, 0.034, size = 5.9, col = faint, face = "bold")
    txt(paste("Página", page_no), 0.950, 0.034, size = 5.9, col = faint, just = c("right", "center"))
    invisible(section)
  }
  title_block <- function(title, subtitle) {
    txt(title, 0.050, 0.842, size = 20, col = ink, face = "bold")
    subtitle <- .mtpdf_wrap(subtitle, 112L)
    subtitle_size <- if (grepl("\n", subtitle, fixed = TRUE)) 7.2 else 8.0
    txt(subtitle, 0.050, 0.817, size = subtitle_size, col = muted, face = "bold", just = c("left", "top"), lineheight = 1.05)
  }
  meter <- function(x, y, w, h, value, fill = green, cap = 100) {
    if (!is.finite(value)) value <- 0
    shown <- max(0, min(cap, value)) / cap
    rr(x, y, w, h, fill = grid_line, col = NA, lwd = 0, r = h / 2)
    if (shown > 0) rr(x, y, max(0.006, w * shown), h, fill = fill, col = NA, lwd = 0, r = h / 2)
  }
  metric_card <- function(x, y, w, h, label, value, hint = "", tone = green, prominent = FALSE) {
    rr(x, y, w, h, fill = panel, col = border, lwd = 1.0, r = 0.012); rect(x, y, 0.005, h, tone)
    label_size <- if (isTRUE(prominent)) 8.0 else 7.2
    value_size <- if (isTRUE(prominent)) 20.0 else 15.5
    label_offset <- if (isTRUE(prominent)) 0.024 else 0.020
    value_offset <- if (isTRUE(prominent)) 0.044 else 0.034
    hint_offset <- if (isTRUE(prominent)) 0.026 else 0.020
    hint_size <- if (isTRUE(prominent)) 7.2 else 7.0
    txt(label, x + 0.014, y + h - label_offset, size = label_size, col = muted, face = "bold", just = c("left", "top"))
    txt(value, x + 0.014, y + value_offset, size = value_size, col = ink, face = "bold", just = c("left", "bottom"))
    if (nzchar(hint)) txt(.mtpdf_wrap(hint, 28), x + w - 0.014, y + hint_offset, size = hint_size, col = muted, face = "bold", just = c("right", "bottom"), lineheight = 0.94)
  }

  fmt_or <- function(x, fallback = "Sin dato") {
    value <- .mtpdf_num(x, NA_real_)[[1L]]
    if (is.finite(value)) fmt(value) else fallback
  }
  pct_or <- function(x, fallback = "Sin dato") if (length(x) && is.finite(x[[1L]])) sprintf("%.1f%%", x[[1L]]) else fallback
  category_word <- function(n) if (identical(as.integer(n), 1L)) "categoría" else "categorías"
  survey_word <- function(n) if (identical(as.integer(round(n)), 1L)) "encuesta" else "encuestas"
  row_capacity <- function(rows, regular = 6L) {
    if (!nrow(rows)) return(regular)
    if (any(nchar(as.character(rows$segment)) > 52L, na.rm = TRUE)) min(4L, regular) else regular
  }
  row_chunks <- function(rows, capacity) {
    if (!nrow(rows)) return(list())
    split(rows, ceiling(seq_len(nrow(rows)) / max(1L, capacity)))
  }
  dimension_actual_total <- function(dimension) {
    values <- dimension$rows$actual
    if (length(values) && any(is.finite(values))) sum(values, na.rm = TRUE) else NA_real_
  }
  dimension_target_total <- function(dimension) {
    values <- dimension$rows$target
    if (length(values) && any(is.finite(values))) sum(values, na.rm = TRUE) else NA_real_
  }
  compact_quota_rows <- function(rows, max_rows = 5L) {
    compact <- rows[, c("segment", "actual", "target"), drop = FALSE]
    if (nrow(compact) <= max_rows) return(compact)
    keep_n <- max(1L, max_rows - 1L)
    remainder <- compact[(keep_n + 1L):nrow(compact), , drop = FALSE]
    sum_or_na <- function(values) if (any(is.finite(values))) sum(values, na.rm = TRUE) else NA_real_
    aggregate <- data.frame(
      segment = paste("Otras", nrow(remainder), category_word(nrow(remainder))),
      actual = sum_or_na(remainder$actual),
      target = sum_or_na(remainder$target),
      stringsAsFactors = FALSE
    )
    rbind(compact[seq_len(keep_n), , drop = FALSE], aggregate)
  }
  valid_total <- facts$total_valid
  primary_rows <- facts$quota_rows
  primary_count <- nrow(primary_rows)
  primary_label <- .mtpdf_text(facts$primary_quota_dimension, "Categoría")
  primary_actual_total <- if (primary_count && any(is.finite(primary_rows$actual))) sum(primary_rows$actual, na.rm = TRUE) else NA_real_
  primary_target_total <- if (primary_count && any(is.finite(primary_rows$target))) sum(primary_rows$target, na.rm = TRUE) else NA_real_

  # Página 1: resumen descriptivo, independiente de la dimensión de cuota.
  draw_page("Resumen")
  summary_subtitle <- if (length(facts$quota_dimensions)) {
    "Encuestas válidas, composición y periodo de campo."
  } else {
    "Encuestas válidas y periodo de campo."
  }
  title_block("Resumen del levantamiento telefónico", summary_subtitle)
  rr(0.050, 0.135, 0.605, 0.630, fill = panel, col = border, lwd = 1.05, r = 0.016)
  txt("ENCUESTAS VÁLIDAS", 0.074, 0.730, size = 7.2, col = teal, face = "bold")
  txt(fmt_or(valid_total), 0.074, 0.650, size = 34, col = ink, face = "bold")
  hero_right_value <- if (is.finite(primary_target_total)) fmt(primary_target_total) else if (facts$field_days > 0) fmt(facts$field_days) else fmt_or(facts$real_responses)
  hero_right_label <- if (is.finite(primary_target_total)) "ENCUESTAS PREVISTAS" else if (facts$field_days > 0) "DÍAS CON REGISTROS" else "RESPUESTAS DE CAMPO"
  txt(hero_right_value, 0.610, 0.657, size = 21, col = navy, face = "bold", just = c("right", "center"))
  txt(hero_right_label, 0.610, 0.620, size = 7.0, col = muted, face = "bold", just = c("right", "center"))
  line(0.074, 0.580, 0.610, 0.580, col = grid_line, lwd = 1.0)
  if (primary_count >= 2L) {
    metric_card(0.074, 0.380, 0.245, 0.150, "COMPOSICIÓN", fmt(primary_count), primary_label, navy, prominent = TRUE)
  } else if (primary_count == 1L) {
    metric_card(0.074, 0.380, 0.245, 0.150, "COMPOSICIÓN", "1", primary_label, navy, prominent = TRUE)
  } else {
    metric_card(0.074, 0.380, 0.245, 0.150, "RESUMEN", "Total", "sin desglose", navy, prominent = TRUE)
  }
  metric_card(0.337, 0.380, 0.273, 0.150, "DÍAS DE CAMPO", paste(fmt(facts$field_days), "días"), paste(.mtpdf_date_label(facts$field_start), "a", .mtpdf_date_label(facts$field_end)), deep_blue, prominent = TRUE)
  metric_card(0.074, 0.190, 0.245, 0.150, "RESPUESTAS DE CAMPO", fmt_or(facts$real_responses), "", teal, prominent = TRUE)
  if (is.finite(primary_target_total)) {
    metric_card(0.337, 0.190, 0.273, 0.150, "REFERENCIA DEL ESTUDIO", fmt(primary_target_total), "encuestas previstas", navy, prominent = TRUE)
  } else {
    metric_card(0.337, 0.190, 0.273, 0.150, "FECHA DEL INFORME", .mtpdf_date_label(facts$field_end, TRUE), "último día de campo", navy, prominent = TRUE)
  }

  rr(0.680, 0.135, 0.270, 0.630, fill = panel, col = border, lwd = 1.05, r = 0.016)
  primary_has_values <- primary_count >= 1L && (
    any(is.finite(primary_rows$actual)) || any(is.finite(primary_rows$target))
  )
  if (primary_has_values) {
    primary_label_wrapped <- .mtpdf_wrap(primary_label, 30)
    label_lines <- length(strsplit(primary_label_wrapped, "\n", fixed = TRUE)[[1L]])
    primary_label_size <- if (label_lines >= 3L) 11.0 else if (label_lines == 2L) 13.0 else 16.0
    divider_y <- if (label_lines >= 3L) 0.610 else if (label_lines == 2L) 0.635 else 0.660
    txt(primary_label_wrapped, 0.704, 0.730, size = primary_label_size, col = ink, face = "bold", just = c("left", "top"), lineheight = 1.02)
    line(0.704, divider_y, 0.926, divider_y, col = grid_line)

    chart_rows <- compact_quota_rows(primary_rows, max_rows = 5L)
    has_actual_series <- any(is.finite(chart_rows$actual))
    has_target_series <- any(is.finite(chart_rows$target))
    chart_values <- c(
      if (has_actual_series) chart_rows$actual[is.finite(chart_rows$actual)] else numeric(0),
      if (has_target_series) chart_rows$target[is.finite(chart_rows$target)] else numeric(0)
    )
    chart_max <- if (length(chart_values)) max(chart_values, na.rm = TRUE) else 1
    if (!is.finite(chart_max) || chart_max <= 0) chart_max <- 1
    row_top <- divider_y - 0.060
    row_bottom <- 0.235
    row_y <- if (nrow(chart_rows) == 1L) {
      mean(c(row_top, row_bottom))
    } else {
      seq(row_top, row_bottom, length.out = nrow(chart_rows))
    }
    for (i in seq_len(nrow(chart_rows))) {
      yy <- row_y[[i]]
      category_label <- .mtpdf_wrap(chart_rows$segment[[i]], 23)
      txt(category_label, 0.704, yy + 0.022, size = 7.0, col = ink, face = "bold", just = c("left", "top"), lineheight = 0.94)
      if (has_actual_series && has_target_series) {
        txt(fmt_or(chart_rows$actual[[i]], "—"), 0.884, yy + 0.012, size = 7.0, col = teal, face = "bold", just = c("right", "center"))
        txt(fmt_or(chart_rows$target[[i]], "—"), 0.926, yy + 0.012, size = 7.0, col = navy, face = "bold", just = c("right", "center"))
      } else if (has_actual_series) {
        txt(fmt_or(chart_rows$actual[[i]], "—"), 0.926, yy + 0.012, size = 7.0, col = teal, face = "bold", just = c("right", "center"))
      } else {
        txt(fmt_or(chart_rows$target[[i]], "—"), 0.926, yy + 0.012, size = 7.0, col = navy, face = "bold", just = c("right", "center"))
      }
      bar_y <- yy - 0.030
      rr(0.704, bar_y, 0.222, 0.011, fill = grid_line, col = NA, lwd = 0, r = 0.006)
      if (is.finite(chart_rows$actual[[i]]) && chart_rows$actual[[i]] > 0) {
        actual_w <- 0.222 * min(1, max(0, chart_rows$actual[[i]] / chart_max))
        rr(0.704, bar_y, max(0.005, actual_w), 0.011, fill = teal, col = NA, lwd = 0, r = 0.006)
      }
      if (is.finite(chart_rows$target[[i]]) && chart_rows$target[[i]] >= 0) {
        target_x <- 0.704 + 0.222 * min(1, max(0, chart_rows$target[[i]] / chart_max))
        line(target_x, bar_y - 0.005, target_x, bar_y + 0.016, col = navy, lwd = 2.0)
      }
    }
    if (has_actual_series) {
      rect(0.704, 0.165, 0.014, 0.010, teal)
      txt("Recogido", 0.725, 0.170, size = 7.0, col = muted, face = "bold")
    }
    if (has_target_series) {
      target_legend_x <- if (has_actual_series) 0.830 else 0.704
      line(target_legend_x + 0.006, 0.161, target_legend_x + 0.006, 0.179, col = navy, lwd = 2.0)
      txt("Previsto", target_legend_x + 0.020, 0.170, size = 7.0, col = muted, face = "bold")
    }
  } else {
    txt("DATOS DISPONIBLES", 0.704, 0.730, size = 7.5, col = teal, face = "bold")
    txt(fmt_or(valid_total), 0.704, 0.655, size = 24, col = ink, face = "bold")
    txt(paste(survey_word(valid_total), "válidas"), 0.704, 0.615, size = 7.2, col = muted, face = "bold")
    line(0.704, 0.565, 0.926, 0.565, col = grid_line)
    txt("RESPUESTAS DE CAMPO", 0.704, 0.525, size = 7.0, col = muted, face = "bold")
    txt(fmt_or(facts$real_responses), 0.704, 0.475, size = 18, col = navy, face = "bold")
    line(0.704, 0.300, 0.926, 0.300, col = grid_line)
    txt("FECHA DEL INFORME", 0.704, 0.267, size = 6.2, col = muted, face = "bold")
    txt(.mtpdf_date_label(facts$field_end, TRUE), 0.704, 0.225, size = 10.2, col = ink, face = "bold")
  }

  # Páginas de composición: una dimensión a la vez, sin truncar categorías.
  composition_dimensions <- Filter(function(d) nrow(d$rows) >= 2L && isTRUE(d$has_actual), facts$quota_dimensions)
  for (dimension in composition_dimensions) {
    rows <- dimension$rows
    actual_total <- dimension_actual_total(dimension)
    rows$share <- if (is.finite(actual_total) && actual_total > 0) 100 * rows$actual / actual_total else NA_real_
    capacity <- row_capacity(rows, 6L)
    chunks <- row_chunks(rows, capacity)
    max_share <- suppressWarnings(max(rows$share, na.rm = TRUE))
    if (!is.finite(max_share) || max_share <= 0) max_share <- 100
    share_cap <- min(100, max(10, ceiling(max_share / 10) * 10))
    for (page_index in seq_along(chunks)) {
      chunk <- chunks[[page_index]]
      is_last <- page_index == length(chunks)
      continuation <- if (length(chunks) > 1L) paste0(" · página ", page_index, " de ", length(chunks)) else ""
      draw_page("Composición")
      title_block("Composición de las entrevistas", paste0(dimension$label, " · Número de encuestas y participación dentro del total encuestado", continuation, "."))
      rr(0.050, 0.115, 0.900, 0.670, fill = panel, col = border, lwd = 1.05, r = 0.016)
      txt(.mtpdf_wrap(paste("ENCUESTAS VÁLIDAS POR", toupper(dimension$label)), 48), 0.070, 0.755, size = 8.0, col = teal, face = "bold", just = c("left", "top"), lineheight = 0.96)
      txt(paste("Total encuestado:", fmt_or(actual_total)), 0.930, 0.755, size = 7.5, col = muted, face = "bold", just = c("right", "center"))
      add_summary <- is_last && nrow(chunk) < capacity
      n_items <- nrow(chunk) + as.integer(add_summary)
      n_grid_rows <- max(1L, ceiling(n_items / 2))
      gap <- 0.024
      body_height <- 0.535
      card_h <- min(0.205, (body_height - (n_grid_rows - 1L) * gap) / n_grid_rows)
      used_height <- n_grid_rows * card_h + (n_grid_rows - 1L) * gap
      bottom <- 0.155 + (body_height - used_height) / 2
      card_w <- 0.405
      for (i in seq_len(nrow(chunk))) {
        grid_row <- floor((i - 1L) / 2L)
        grid_col <- (i - 1L) %% 2L
        cx <- 0.070 + grid_col * 0.435
        cy <- bottom + (n_grid_rows - 1L - grid_row) * (card_h + gap)
        rr(cx, cy, card_w, card_h, fill = "#FBFCFE", col = border, lwd = 0.9, r = 0.012)
        label_size <- if (nchar(chunk$segment[[i]]) > 52L) 7.0 else 8.2
        txt(.mtpdf_wrap(chunk$segment[[i]], if (label_size <= 7) 46 else 40), cx + 0.018, cy + card_h - 0.024, size = label_size, col = ink, face = "bold", just = c("left", "top"), lineheight = 0.98)
        txt(fmt_or(chunk$actual[[i]]), cx + 0.018, cy + 0.070, size = 18, col = ink, face = "bold")
        txt(paste(survey_word(chunk$actual[[i]]), "válidas"), cx + 0.078, cy + 0.070, size = 7.2, col = muted, face = "bold")
        txt(if (is.finite(chunk$share[[i]])) paste0(sprintf("%.1f%%", chunk$share[[i]]), " del total encuestado") else "Participación sin dato", cx + card_w - 0.020, cy + 0.073, size = 7.2, col = teal, face = "bold", just = c("right", "center"))
        if (is.finite(chunk$share[[i]])) meter(cx + 0.018, cy + 0.042, 0.268, 0.010, chunk$share[[i]], teal, cap = share_cap)
      }
      if (add_summary) {
        i <- nrow(chunk) + 1L
        grid_row <- floor((i - 1L) / 2L); grid_col <- (i - 1L) %% 2L
        sx <- 0.070 + grid_col * 0.435
        sy <- bottom + (n_grid_rows - 1L - grid_row) * (card_h + gap)
        rr(sx, sy, card_w, card_h, fill = blue_soft, col = border, lwd = 0.9, r = 0.012)
        txt("TOTAL ENCUESTADO", sx + 0.018, sy + card_h - 0.026, size = 7.2, col = teal, face = "bold", just = c("left", "top"))
        txt(fmt_or(actual_total), sx + 0.018, sy + 0.070, size = 20, col = ink, face = "bold")
        txt(paste(survey_word(actual_total), "válidas"), sx + 0.105, sy + 0.072, size = 7.2, col = muted, face = "bold")
      }
    }
  }

  dx <- facts$daily_dates; dy <- facts$daily_values; dc <- facts$cumulative
  if (length(dy)) {
    draw_page("Registro diario")
    title_block("Entrevistas registradas por día", "Encuestas válidas de cada fecha y total acumulado durante el trabajo de campo.")
    rr(0.050, 0.135, 0.640, 0.650, fill = panel, col = border, lwd = 1.05, r = 0.016)
    txt("ENCUESTAS VÁLIDAS POR DÍA", 0.074, 0.750, size = 8.0, col = teal, face = "bold")
    txt("Registro diario y total acumulado", 0.074, 0.720, size = 9.4, col = ink, face = "bold")
    px0 <- 0.108; px1 <- 0.660; py0 <- 0.230; py1 <- 0.660
    ymax <- max(c(if (is.finite(primary_target_total)) primary_target_total else numeric(0), dc), na.rm = TRUE) * 1.08
    if (!is.finite(ymax) || ymax <= 0) ymax <- 1
    ticks <- pretty(c(0, ymax), n = 5); ticks <- ticks[ticks >= 0 & ticks <= ymax]
    for (tk in ticks) {
      yy <- py0 + (tk / ymax) * (py1 - py0); line(px0, yy, px1, yy, col = grid_line, lwd = 0.6)
      txt(fmt(tk), px0 - 0.012, yy, size = 7.0, col = faint, just = c("right", "center"))
    }
    xs <- if (length(dy) == 1L) (px0 + px1) / 2 else seq(px0 + 0.014, px1 - 0.014, length.out = length(dy))
    bw <- min(0.036, (px1 - px0) / max(8, length(dy)) * 0.55)
    label_step <- max(1L, ceiling(length(dy) / 9L))
    date_labels <- unique(c(1L, seq.int(1L, length(dy), by = label_step), length(dy)))
    value_labels <- if (length(dy) <= 14L) seq_along(dy) else unique(c(which.max(dy), length(dy)))
    for (i in seq_along(dy)) {
      bh <- (dy[[i]] / ymax) * (py1 - py0)
      rr(xs[[i]] - bw / 2, py0, bw, max(0.004, bh), fill = green, col = NA, lwd = 0, r = 0.004)
      if (i %in% value_labels) txt(fmt(dy[[i]]), xs[[i]], py0 + bh + 0.018, size = 7.0, col = green_dark, face = "bold", just = c("center", "center"))
      if (i %in% date_labels) txt(gsub(" ", "\n", .mtpdf_date_label(dx[[i]]), fixed = TRUE), xs[[i]], py0 - 0.042, size = 7.0, col = muted, face = "bold", just = c("center", "center"), lineheight = 0.88)
    }
    if (is.finite(primary_target_total) && primary_target_total > 0) {
      qy <- py0 + (primary_target_total / ymax) * (py1 - py0); line(px0, qy, px1, qy, col = navy, lwd = 1.0, lty = 3)
      txt(paste("REFERENCIA", fmt(primary_target_total)), px0 + 0.004, qy + 0.015, size = 7.0, col = navy, face = "bold")
    }
    cys <- py0 + (dc / ymax) * (py1 - py0)
    grid::grid.lines(x = grid::unit(xs, "npc"), y = grid::unit(cys, "npc"), gp = grid::gpar(col = navy, lwd = 1.8))
    grid::grid.points(x = grid::unit(xs, "npc"), y = grid::unit(cys, "npc"), pch = 21, size = grid::unit(2.2, "mm"), gp = grid::gpar(col = navy, fill = panel, lwd = 1.1))
    txt(fmt(tail(dc, 1)), tail(xs, 1), tail(cys, 1) + 0.020, size = 7.0, col = navy, face = "bold", just = c("center", "center"))
    daily_legend <- .mtpdf_daily_legend_layout()
    rect(daily_legend$x, daily_legend$y - 0.006, 0.018, 0.012, green)
    txt("Válidas por día", daily_legend$x + 0.026, daily_legend$y, size = 7.0, col = ink, face = "bold")
    line(daily_legend$x + 0.161, daily_legend$y, daily_legend$x + 0.186, daily_legend$y, col = navy, lwd = 1.8)
    txt("Acumulado", daily_legend$x + 0.196, daily_legend$y, size = 7.0, col = ink, face = "bold")
    rr(0.720, 0.135, 0.230, 0.650, fill = panel, col = border, lwd = 1.05, r = 0.016)
    txt("RESUMEN DEL CAMPO", 0.744, 0.750, size = 8.0, col = teal, face = "bold")
    txt(paste(fmt(facts$field_days), "días"), 0.744, 0.660, size = 24, col = ink, face = "bold")
    txt("con encuestas registradas", 0.744, 0.620, size = 7.2, col = muted, face = "bold")
    metric_card(0.744, 0.500, 0.182, 0.092, "MAYOR REGISTRO DIARIO", fmt_or(facts$best_value), .mtpdf_date_label(facts$best_date), teal)
    if (is.finite(primary_target_total) && !is.na(facts$reached_date)) {
      metric_card(0.744, 0.385, 0.182, 0.092, paste(fmt(primary_target_total), "ACUMULADAS"), .mtpdf_date_label(facts$reached_date), "referencia del estudio", navy)
    } else {
      metric_card(0.744, 0.385, 0.182, 0.092, "PROMEDIO DIARIO", fmt_or(facts$daily_average), "encuestas válidas", navy)
    }
    metric_card(0.744, 0.270, 0.182, 0.092, "TOTAL DEL PERIODO", fmt_or(valid_total), .mtpdf_date_label(facts$field_end), deep_blue)
    txt(.mtpdf_wrap("Las barras muestran las encuestas registradas cada día; la línea presenta el total acumulado.", 31), 0.744, 0.220, size = 7.0, col = muted, face = "bold", just = c("left", "top"), lineheight = 1.12)
  }

  # Páginas comparativas: escala porcentual real y paginación completa.
  comparison_dimensions <- Filter(function(d) nrow(d$rows) >= 2L && isTRUE(d$has_actual) && isTRUE(d$has_targets), facts$quota_dimensions)
  for (dimension in comparison_dimensions) {
    comp <- dimension$rows
    target_total <- dimension_target_total(dimension)
    actual_total <- dimension_actual_total(dimension)
    comp$target_share <- if (is.finite(target_total) && target_total > 0) 100 * comp$target / target_total else NA_real_
    comp$actual_share <- if (is.finite(actual_total) && actual_total > 0) 100 * comp$actual / actual_total else NA_real_
    capacity <- row_capacity(comp, 6L)
    chunks <- row_chunks(comp, capacity)
    for (page_index in seq_along(chunks)) {
      chunk <- chunks[[page_index]]
      continuation <- if (length(chunks) > 1L) paste0(" · página ", page_index, " de ", length(chunks)) else ""
      draw_page("Distribución")
      title_block("Distribución prevista y recogida", paste0(dimension$label, " · Comparación de cantidades y participaciones", continuation, "."))
      rr(0.050, 0.115, 0.900, 0.670, fill = panel, col = border, lwd = 1.05, r = 0.016)
      txt("PARTICIPACIÓN EN EL TOTAL ENCUESTADO", 0.074, 0.755, size = 8.0, col = teal, face = "bold")
      txt(paste("Previsto:", fmt_or(target_total), "· Recogido:", fmt_or(actual_total)), 0.926, 0.755, size = 7.5, col = muted, face = "bold", just = c("right", "center"))
      n <- nrow(chunk)
      top_y <- 0.700; bottom_y <- 0.205
      step <- (top_y - bottom_y) / max(1L, n)
      bar_x <- 0.310; bar_w <- 0.500
      for (i in seq_len(n)) {
        yy <- top_y - (i - 0.5) * step
        label_size <- if (nchar(chunk$segment[[i]]) > 48L) 7.0 else 8.2
        txt(.mtpdf_wrap(chunk$segment[[i]], if (label_size <= 7) 40 else 30), 0.074, yy, size = label_size, col = ink, face = "bold", just = c("left", "center"), lineheight = 0.96)
        rr(bar_x, yy + 0.013, bar_w, 0.014, fill = grid_line, col = NA, lwd = 0, r = 0.007)
        if (is.finite(chunk$target_share[[i]])) rr(bar_x, yy + 0.013, max(0.004, bar_w * min(100, max(0, chunk$target_share[[i]])) / 100), 0.014, fill = navy, col = NA, lwd = 0, r = 0.007)
        rr(bar_x, yy - 0.018, bar_w, 0.014, fill = grid_line, col = NA, lwd = 0, r = 0.007)
        if (is.finite(chunk$actual_share[[i]])) rr(bar_x, yy - 0.018, max(0.004, bar_w * min(100, max(0, chunk$actual_share[[i]])) / 100), 0.014, fill = teal, col = NA, lwd = 0, r = 0.007)
        target_label <- if (is.finite(chunk$target[[i]]) && is.finite(chunk$target_share[[i]])) paste("Previsto", fmt(chunk$target[[i]]), "·", sprintf("%.1f%%", chunk$target_share[[i]])) else "Previsto · Sin dato"
        actual_label <- if (is.finite(chunk$actual[[i]]) && is.finite(chunk$actual_share[[i]])) paste("Recogido", fmt(chunk$actual[[i]]), "·", sprintf("%.1f%%", chunk$actual_share[[i]])) else "Recogido · Sin dato"
        txt(target_label, 0.926, yy + 0.014, size = 7.0, col = navy, face = "bold", just = c("right", "center"))
        txt(actual_label, 0.926, yy - 0.017, size = 7.0, col = teal, face = "bold", just = c("right", "center"))
        if (i < n) line(0.074, yy - step / 2, 0.926, yy - step / 2, col = grid_line, lwd = 0.5)
      }
      rect(0.074, 0.160, 0.014, 0.011, navy); txt("Distribución prevista", 0.096, 0.166, size = 7.0, col = ink, face = "bold")
      rect(0.250, 0.160, 0.014, 0.011, teal); txt("Distribución recogida", 0.272, 0.166, size = 7.0, col = ink, face = "bold")
    }
  }

  # Cobertura: solo cuando el modelo contiene métricas reales de contacto.
  if (isTRUE(facts$has_global_coverage)) {
    has_detail_coverage <- primary_count >= 2L && isTRUE(facts$has_category_coverage)
    coverage_chunks <- if (has_detail_coverage) row_chunks(primary_rows, row_capacity(primary_rows, 6L)) else list(NULL)
    for (page_index in seq_along(coverage_chunks)) {
      cover <- coverage_chunks[[page_index]]
      continuation <- if (length(coverage_chunks) > 1L) paste0(" · página ", page_index, " de ", length(coverage_chunks)) else ""
      draw_page("Base telefónica")
      coverage_subtitle <- if (has_detail_coverage) {
        paste0(primary_label, " · Contactados, no contactados y resultado agregado de los contactos", continuation, ".")
      } else {
        "Contactados, no contactados y resultado agregado de los contactos."
      }
      title_block("Cobertura de la base telefónica", coverage_subtitle)
      if (has_detail_coverage) {
        rr(0.050, 0.135, 0.610, 0.650, fill = panel, col = border, lwd = 1.05, r = 0.016)
        txt(.mtpdf_wrap(paste("REGISTROS CONTACTADOS POR", toupper(primary_label)), 48), 0.074, 0.750, size = 8.0, col = teal, face = "bold", just = c("left", "top"), lineheight = 0.96)
        n <- nrow(cover)
        top_y <- 0.700; bottom_y <- 0.190
        step <- (top_y - bottom_y) / max(1L, n)
        for (i in seq_len(n)) {
          yy <- top_y - (i - 0.5) * step
          label_size <- if (nchar(cover$segment[[i]]) > 46L) 7.0 else 8.2
          txt(.mtpdf_wrap(cover$segment[[i]], if (label_size <= 7) 38 else 28), 0.074, yy + 0.012, size = label_size, col = ink, face = "bold", just = c("left", "center"), lineheight = 0.96)
          if (is.finite(cover$swept[[i]]) && is.finite(cover$universe[[i]]) && is.finite(cover$coverage_pct[[i]])) {
            txt(paste(fmt(cover$swept[[i]]), "de", fmt(cover$universe[[i]]), "registros contactados"), 0.074, yy - 0.021, size = 7.0, col = muted, face = "bold")
            meter(0.278, yy - 0.012, 0.260, 0.016, cover$coverage_pct[[i]], navy)
            txt(pct_or(cover$coverage_pct[[i]]), 0.630, yy + 0.010, size = 8.5, col = navy, face = "bold", just = c("right", "center"))
            if (is.finite(cover$pending[[i]])) txt(paste(fmt(cover$pending[[i]]), "no contactados"), 0.630, yy - 0.021, size = 7.0, col = muted, face = "bold", just = c("right", "center"))
          } else {
            txt("Sin dato de contacto para esta categoría", 0.278, yy - 0.005, size = 7.0, col = muted, face = "bold")
          }
          if (i < n) line(0.074, yy - step / 2, 0.630, yy - step / 2, col = grid_line, lwd = 0.5)
        }
        side_x <- 0.690; side_w <- 0.260
      } else {
        rr(0.050, 0.135, 0.580, 0.650, fill = panel, col = border, lwd = 1.05, r = 0.016)
        txt("BASE TELEFÓNICA", 0.080, 0.745, size = 8.0, col = teal, face = "bold")
        txt(fmt_or(facts$total), 0.080, 0.645, size = 32, col = ink, face = "bold")
        txt("registros disponibles", 0.080, 0.600, size = 8.0, col = muted, face = "bold")
        meter(0.080, 0.545, 0.500, 0.020, facts$coverage_pct, navy)
        metric_card(0.080, 0.355, 0.235, 0.125, "REGISTROS CONTACTADOS", fmt_or(facts$swept), pct_or(facts$coverage_pct), navy)
        metric_card(0.345, 0.355, 0.235, 0.125, "NO CONTACTADOS", fmt_or(facts$pending), "registros", teal)
        rr(0.080, 0.185, 0.500, 0.125, fill = blue_soft, col = border, lwd = 0.8, r = 0.012)
        txt("LECTURA DE LA COBERTURA", 0.100, 0.280, size = 7.2, col = teal, face = "bold", just = c("left", "top"))
        coverage_reading <- paste0(
          "De los ", fmt_or(facts$total), " registros disponibles, ", fmt_or(facts$swept),
          " fueron contactados y ", fmt_or(facts$pending), " no fueron contactados. ",
          "La cobertura se informa para el conjunto de la base porque no existe un desglose por categoría."
        )
        txt(.mtpdf_wrap(coverage_reading, 76), 0.100, 0.245, size = 8.0, col = ink, face = "bold", just = c("left", "top"), lineheight = 1.12)
        side_x <- 0.660; side_w <- 0.290
      }
      rr(side_x, 0.135, side_w, 0.650, fill = panel, col = border, lwd = 1.05, r = 0.016)
      sx <- side_x + 0.024; sw <- side_w - 0.048
      txt("RESUMEN DE LA BASE", sx, 0.750, size = 8.0, col = teal, face = "bold")
      txt(fmt_or(facts$total), sx, 0.665, size = 24, col = navy, face = "bold")
      txt("registros en la base", sx, 0.625, size = 7.0, col = ink, face = "bold")
      meter(sx, 0.585, sw, 0.016, facts$coverage_pct, navy)
      rect(sx, 0.543, 0.010, 0.010, navy)
      txt(paste(fmt_or(facts$swept), "contactados ·", pct_or(facts$coverage_pct)), sx + 0.016, 0.548, size = 7.0, col = ink, face = "bold")
      pending_pct <- if (is.finite(facts$total) && facts$total > 0 && is.finite(facts$pending)) 100 * facts$pending / facts$total else NA_real_
      rect(sx, 0.510, 0.010, 0.010, grid_line)
      txt(paste(fmt_or(facts$pending), "no contactados ·", pct_or(pending_pct)), sx + 0.016, 0.515, size = 7.0, col = muted, face = "bold")
      if (isTRUE(facts$has_phone_effectiveness)) {
        line(sx, 0.475, sx + sw, 0.475, col = grid_line)
        txt("RESULTADO DE LOS CONTACTADOS", sx, 0.445, size = 7.2, col = teal, face = "bold")
        rr(sx, 0.402, sw, 0.016, fill = grid_line, col = NA, lwd = 0, r = 0.008)
        effective_share <- max(0, min(100, facts$phone_effectiveness_pct)) / 100
        if (effective_share > 0) rr(sx, 0.402, max(0.006, sw * effective_share), 0.016, fill = teal, col = NA, lwd = 0, r = 0.008)
        metric_card(sx, 0.285, sw, 0.095, "CONTACTOS EFECTIVOS", fmt_or(facts$phone_effective), paste(pct_or(facts$phone_effectiveness_pct), "de contactados"), teal)
        metric_card(sx, 0.160, sw, 0.095, "CONTACTOS NO EFECTIVOS", fmt_or(facts$phone_non_effective), paste(pct_or(100 - facts$phone_effectiveness_pct), "de contactados"), deep_blue)
      }
    }
  }

  close_pdf()
  invisible(path)
}
