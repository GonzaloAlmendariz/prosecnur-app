# Inventario, cobertura y sugerencia automatica para planes de Graficos.
#
# Mantener esta logica fuera del router permite reutilizarla desde la UI,
# tests y flujos futuros de exportacion sin acoplarla a PPT o Word.

.graficos_scalar_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.graficos_base_type <- function(x) {
  x <- tolower(trimws(.graficos_scalar_chr(x, "")))
  sub("\\s+.*$", "", x)
}

.graficos_norm_text_key <- function(x) {
  out <- iconv(enc2utf8(as.character(x %||% "")), to = "ASCII//TRANSLIT")
  out <- tolower(trimws(out))
  out <- gsub("[^a-z0-9]+", "_", out)
  gsub("^_+|_+$", "", out)
}

.graficos_is_blank_cell <- function(x) {
  if (is.null(x)) return(TRUE)
  if (length(x) == 0L) return(TRUE)
  if (is.logical(x)) return(is.na(x))
  if (is.numeric(x)) return(is.na(x))
  txt <- trimws(as.character(x))
  is.na(txt) | !nzchar(txt)
}

.graficos_var_non_empty_n <- function(data, var) {
  if (is.null(data) || !is.data.frame(data) || !nzchar(var) || !(var %in% names(data))) {
    if (is.null(data) || !is.data.frame(data) || !nzchar(var)) return(0L)
    name_key <- tolower(names(data))
    exact <- which(name_key == tolower(var))[1]
    if (length(exact) && is.finite(exact) && !is.na(exact)) {
      return(sum(!.graficos_is_blank_cell(data[[exact]])))
    }
    dummy_idx <- which(startsWith(name_key, paste0(tolower(var), ".")))
    if (!length(dummy_idx)) return(0L)
    marked <- lapply(dummy_idx, function(idx) {
      x <- data[[idx]]
      if (is.numeric(x) || is.logical(x)) {
        return(!is.na(x) & suppressWarnings(as.numeric(x)) > 0)
      }
      key <- .graficos_norm_text_key(x)
      key %in% c("1", "true", "si", "yes", "x", "marcada", "marcado")
    })
    return(sum(Reduce(`|`, marked, rep(FALSE, nrow(data)))))
  }
  x <- data[[var]]
  sum(!.graficos_is_blank_cell(x))
}

.graficos_align_recoded_dummy_names <- function(data, instrumento) {
  if (is.null(data) || !is.data.frame(data) || !ncol(data) ||
      is.null(instrumento) || !is.list(instrumento)) return(data)
  survey <- instrumento$survey %||% NULL
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) return(data)
  vars <- trimws(as.character(survey$name))
  vars <- unique(vars[!is.na(vars) & nzchar(vars) & grepl("_recod$", vars, ignore.case = TRUE)])
  if (!length(vars)) return(data)

  data_names <- names(data)
  for (var in vars) {
    idx <- which(startsWith(tolower(data_names), paste0(tolower(var), ".")))
    for (j in idx) {
      target <- paste0(var, substring(data_names[[j]], nchar(var) + 1L))
      if (identical(data_names[[j]], target)) next
      if (target %in% data_names) next
      data_names[[j]] <- target
    }
  }
  names(data) <- data_names
  data
}

.graficos_align_recoded_dummy_sources <- function(src) {
  if (!is.list(src) || !is.list(src$data_sources) || !is.list(src$inst_sources)) return(src)
  common <- intersect(names(src$data_sources), names(src$inst_sources))
  for (name in common) {
    src$data_sources[[name]] <- .graficos_align_recoded_dummy_names(
      src$data_sources[[name]],
      src$inst_sources[[name]]
    )
  }
  src
}

.graficos_var_has_data <- function(data, var) {
  .graficos_var_non_empty_n(data, var) > 0L
}

.graficos_is_recoded_var <- function(name) {
  grepl("(^|_)recod$", .graficos_scalar_chr(name, ""), ignore.case = TRUE)
}

.graficos_raw_name_for_recod <- function(name) {
  sub("(^|_)recod$", "", .graficos_scalar_chr(name, ""), ignore.case = TRUE)
}

.graficos_other_parent_candidates <- function(name) {
  nm <- .graficos_scalar_chr(name, "")
  candidates <- c(
    sub("(_other|_otros|_otro|_specify|_especifique)$", "", nm, ignore.case = TRUE),
    sub("(other|otros|otro)$", "", nm, ignore.case = TRUE)
  )
  unique(candidates[nzchar(candidates) & candidates != nm])
}

.graficos_is_open_child_var <- function(name) {
  grepl("(_other|_otros|_otro|_specify|_especifique)$|(^|_)other$", .graficos_scalar_chr(name, ""),
        ignore.case = TRUE)
}

.graficos_source_kind_map <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (!is.list(bases) || !length(bases)) return(list())
  out <- list()
  for (nm in names(bases)) {
    meta <- bases[[nm]] %||% list()
    out[[nm]] <- .graficos_scalar_chr(meta$source_kind %||% meta$kind %||% "", "")
  }
  out
}

.graficos_all_data_sources <- function(sid) {
  if (exists(".pulso_rebuild_estudio_runtime_sources", mode = "function")) {
    tryCatch(.pulso_rebuild_estudio_runtime_sources(sid), error = function(e) FALSE)
  }
  out <- tryCatch(estudio_data_sources(sid), error = function(e) list())
  out <- .graficos_named_source_list(out)
  if (length(out)) return(out)
  s <- session_get(sid, required = FALSE)
  if (!is.null(s$rp_data_sources)) {
    out <- .graficos_named_source_list(s$rp_data_sources)
    if (length(out)) return(out)
  }
  if (!is.null(s$rp_data) && is.data.frame(s$rp_data)) return(list(default = s$rp_data))
  list()
}

.graficos_simplify_source_kind <- function(kind) {
  kind <- tolower(.graficos_scalar_chr(kind, ""))
  if (!nzchar(kind)) return("unknown")
  if (startsWith(kind, "surveymonkey")) return("surveymonkey")
  if (grepl("(^|_)kobo($|_)", kind, perl = TRUE)) return("kobo")
  if (kind %in% c("manual", "xlsform", "existing_project", "uploaded", "local")) return("xlsform")
  kind
}

.graficos_acnur_koica_districts <- function() {
  list(
    list(ubigeo = "150135", distrito = "San Martín de Porres", short = "SMP", group = "intervencion",
         pair_id = "lima_norte", pair_label = "Lima Norte", pair_order = 1L, label_dx = -0.025, label_dy = -0.015),
    list(ubigeo = "150117", distrito = "Los Olivos", short = "Los Olivos", group = "comparacion",
         pair_id = "lima_norte", pair_label = "Lima Norte", pair_order = 1L, label_dx = -0.025, label_dy = 0.020),
    list(ubigeo = "150132", distrito = "San Juan de Lurigancho", short = "SJL", group = "intervencion",
         pair_id = "lima_este", pair_label = "Lima Este", pair_order = 2L, label_dx = 0.028, label_dy = 0.012),
    list(ubigeo = "150103", distrito = "Ate", short = "Ate", group = "comparacion",
         pair_id = "lima_este", pair_label = "Lima Este", pair_order = 2L, label_dx = 0.030, label_dy = -0.005),
    list(ubigeo = "150108", distrito = "Chorrillos", short = "Chorrillos", group = "intervencion",
         pair_id = "lima_sur", pair_label = "Lima Sur", pair_order = 3L, label_dx = -0.020, label_dy = -0.018),
    list(ubigeo = "150133", distrito = "San Juan de Miraflores", short = "SJM", group = "comparacion",
         pair_id = "lima_sur", pair_label = "Lima Sur", pair_order = 3L, label_dx = -0.020, label_dy = 0.016)
  )
}

.graficos_acnur_koica_pairs <- function() {
  districts <- .graficos_acnur_koica_districts()
  pair_ids <- unique(vapply(districts, function(x) .graficos_scalar_chr(x$pair_id, ""), character(1)))
  pairs <- lapply(pair_ids[nzchar(pair_ids)], function(pair_id) {
    members <- Filter(function(x) identical(.graficos_scalar_chr(x$pair_id, ""), pair_id), districts)
    intervention <- Filter(function(x) identical(x$group, "intervencion"), members)
    comparison <- Filter(function(x) identical(x$group, "comparacion"), members)
    if (length(intervention) != 1L || length(comparison) != 1L) {
      stop("Cada par territorial ACNUR debe tener un distrito de intervención y uno de comparación.", call. = FALSE)
    }
    list(
      id = pair_id,
      label = .graficos_scalar_chr(members[[1L]]$pair_label, pair_id),
      order = suppressWarnings(as.integer(members[[1L]]$pair_order %||% 999L)[1]),
      intervention = intervention[[1L]],
      comparison = comparison[[1L]],
      districts = c(intervention[[1L]]$distrito, comparison[[1L]]$distrito)
    )
  })
  pairs[order(vapply(pairs, function(x) x$order, integer(1)))]
}

.graficos_records_df <- function(rows) {
  if (is.null(rows)) return(data.frame())
  if (is.data.frame(rows)) return(as.data.frame(rows, stringsAsFactors = FALSE, check.names = FALSE))
  if (!is.list(rows) || !length(rows)) return(data.frame())
  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  cols <- cols[!is.na(cols) & nzchar(cols)]
  if (!length(cols)) return(data.frame())
  out <- as.data.frame(stats::setNames(rep(list(rep(NA_character_, length(rows))), length(cols)), cols),
                       stringsAsFactors = FALSE, check.names = FALSE)
  scalar <- function(x) {
    if (is.null(x) || !length(x)) return(NA_character_)
    if (is.atomic(x)) return(as.character(x[[1]]))
    if (is.list(x) && length(x) == 1L && is.atomic(x[[1]])) return(as.character(x[[1]]))
    as.character(jsonlite::toJSON(x, auto_unbox = TRUE, null = "null"))
  }
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    if (!is.list(row)) next
    for (nm in intersect(names(row), cols)) out[[nm]][[i]] <- scalar(row[[nm]])
  }
  out
}

.graficos_first_col <- function(df, candidates) {
  if (is.null(df) || !is.data.frame(df) || !ncol(df)) return("")
  hit <- candidates[candidates %in% names(df)][1]
  if (length(hit) && !is.na(hit)) hit else ""
}

.graficos_ubigeo6 <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x[is.na(x)] <- ""
  x <- gsub("[^0-9]", "", x)
  ifelse(nzchar(x), sprintf("%06d", suppressWarnings(as.integer(x))), "")
}

.graficos_territorial_reports <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  snapshot <- s$monitoreo_snapshot %||% list()
  candidates <- list(
    snapshot$dashboard$territorial_reports,
    snapshot$territorial_reports,
    snapshot$dashboard,
    s$monitoreo_territorial_dashboard,
    s$monitoreo_dashboard$territorial_reports
  )
  cache_entries <- snapshot$territorial_report_cache$entries %||% list()
  if (length(cache_entries)) {
    candidates <- c(lapply(cache_entries, function(entry) entry$dashboard %||% list()), candidates)
  }
  for (cand in candidates) {
    if (is.list(cand) && (
      length(cand$response_audit %||% list()) ||
        length(cand$route_blocks %||% list()) ||
        length(cand$block_progress %||% list()) ||
        length(cand$map$points %||% list()) ||
        length(cand$map$blocks %||% list()) ||
        length(cand$advance$block_progress %||% list())
    )) return(cand)
  }
  list()
}

.graficos_payload_has_rows <- function(x) {
  if (is.null(x)) return(FALSE)
  if (is.data.frame(x)) return(nrow(x) > 0L)
  if (is.list(x)) return(length(x) > 0L)
  length(x) > 0L
}

.graficos_hojas_outputs_have_data <- function(outputs = list()) {
  if (exists(".hojas_ruta_workspace_outputs_has_data", mode = "function")) {
    ok <- tryCatch(.hojas_ruta_workspace_outputs_has_data(outputs), error = function(e) NA)
    if (!is.na(ok)) return(isTRUE(ok))
  }
  if (!is.list(outputs) || !length(outputs)) return(FALSE)
  sample <- outputs$sample %||% outputs$sample_preview %||% outputs$samplePreview %||% list()
  .graficos_payload_has_rows(sample$blocks %||% NULL) ||
    .graficos_payload_has_rows(sample$replacement_blocks %||% NULL) ||
    .graficos_payload_has_rows(sample$sample %||% NULL) ||
    .graficos_payload_has_rows(outputs$quota %||% NULL) ||
    .graficos_payload_has_rows(outputs$population %||% NULL) ||
    .graficos_payload_has_rows(outputs$sample_size_preview %||% outputs$sampleSizePreview %||% NULL) ||
    !is.null(sample$total_entrevistas) ||
    !is.null(sample$total_manzanas)
}

.graficos_has_hojas_ruta <- function(sid) {
  if (is.null(sid) || !nzchar(sid)) return(FALSE)
  if (exists(".hojas_ruta_ensure_runs", mode = "function")) {
    tryCatch(.hojas_ruta_ensure_runs(sid), error = function(e) NULL)
  }
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  candidates <- list(s$hojas_ruta_workspace_outputs %||% NULL)
  runs <- s$hojas_ruta_runs %||% list()
  if (is.list(runs) && length(runs)) {
    candidates <- c(
      candidates,
      lapply(runs, function(run) run$workspace_outputs %||% run$workspaceOutputs %||% run$outputs %||% list())
    )
  }
  any(vapply(candidates, .graficos_hojas_outputs_have_data, logical(1))) || isTRUE(s$hojas_ruta_ok)
}

.graficos_has_monitoreo_territorial <- function(sid) {
  if (is.null(sid) || !nzchar(sid)) return(FALSE)
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  reports <- .graficos_territorial_reports(sid)
  has_territorial_state <- length(s$monitoreo_snapshot %||% list()) ||
    length(s$monitoreo_territorial_dashboard %||% list()) ||
    length((s$monitoreo_dashboard %||% list())$territorial_reports %||% list())
  has_territorial_rows <- .graficos_payload_has_rows(reports$response_audit %||% NULL) ||
    .graficos_payload_has_rows(reports$block_progress %||% NULL) ||
    .graficos_payload_has_rows(reports$route_blocks %||% NULL) ||
    .graficos_payload_has_rows((reports$map %||% list())$points %||% NULL) ||
    .graficos_payload_has_rows((reports$map %||% list())$blocks %||% NULL) ||
    .graficos_payload_has_rows((reports$advance %||% list())$block_progress %||% NULL)
  isTRUE(has_territorial_state) && isTRUE(has_territorial_rows)
}

.graficos_territorial_coverage_capabilities <- function(sid) {
  has_hojas <- .graficos_has_hojas_ruta(sid)
  has_monitoreo <- .graficos_has_monitoreo_territorial(sid)
  missing <- character(0)
  if (!has_hojas) missing <- c(missing, "Hojas de Ruta")
  if (!has_monitoreo) missing <- c(missing, "Monitoreo territorial")
  available <- isTRUE(has_hojas) && isTRUE(has_monitoreo)
  list(
    has_hojas_ruta = has_hojas,
    has_monitoreo_territorial = has_monitoreo,
    has_coverage_maps = available,
    available = available,
    disabled_reason = if (available) "" else paste0(
      "Mapa de cobertura disponible cuando el proyecto tenga ",
      paste(missing, collapse = " y "),
      "."
    )
  )
}

.graficos_fieldwork_activity_mask <- function(df, mode = c("planned", "visited", "effective")) {
  mode <- match.arg(mode)
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(logical(0))
  if (identical(mode, "planned")) return(rep(TRUE, nrow(df)))

  truthy <- function(x) {
    key <- .graficos_norm_text_key(x)
    key %in% c("true", "1", "si", "yes", "visitada", "visitado", "recorrida", "recorrido",
               "contactada", "contactado", "validada", "validado", "completada", "completado")
  }
  first_present <- function(candidates) {
    hit <- candidates[candidates %in% names(df)][1]
    if (length(hit) && !is.na(hit)) hit else ""
  }

  explicit_col <- if (identical(mode, "effective")) {
    first_present(c("advance_valid", "source_effective", "effective", "efectiva"))
  } else {
    first_present(c("visited", "visitada", "recorrida", "contacted", "contactada", "fieldwork_activity"))
  }
  if (nzchar(explicit_col)) return(vapply(df[[explicit_col]], truthy, logical(1)))

  status_col <- first_present(c("validation_status", "advance_status", "Estado", "estado"))
  if (nzchar(status_col)) {
    status_key <- vapply(df[[status_col]], .graficos_norm_text_key, character(1))
    has_status <- nzchar(status_key)
    if (any(has_status)) {
      active_status <- if (identical(mode, "effective")) {
        c("validada", "validado", "efectiva", "efectivo", "completada", "completado")
      } else {
        c("validada", "validado", "revision", "en_revision", "no_defendible", "no_defendibles",
          "visitada", "visitado", "recorrida", "recorrido", "contactada", "contactado",
          "completada", "completado")
      }
      return(has_status & status_key %in% active_status)
    }
  }

  count_candidates <- if (identical(mode, "effective")) {
    c("validas", "validos", "effective_count")
  } else {
    c("validas", "validos", "effective_count", "revision", "revisiones", "revision_count",
      "no_defendibles", "no_defendible", "non_defensible_count")
  }
  count_cols <- intersect(count_candidates, names(df))
  if (length(count_cols)) {
    counts <- lapply(count_cols, function(col) {
      value <- suppressWarnings(as.numeric(df[[col]]))
      value[!is.finite(value)] <- 0
      value
    })
    return(Reduce(`+`, counts) > 0)
  }

  pct_col <- first_present(c("avance_pct", "advance_pct"))
  if (nzchar(pct_col)) {
    pct <- suppressWarnings(as.numeric(df[[pct_col]]))
    return(is.finite(pct) & pct > 0)
  }
  rep(FALSE, nrow(df))
}

.graficos_zone_sets <- function(reports) {
  first_non_empty <- function(candidates) {
    for (candidate in candidates) {
      out <- .graficos_records_df(candidate %||% list())
      if (nrow(out)) return(out)
    }
    data.frame()
  }
  audit <- first_non_empty(list(
    reports$response_audit,
    (reports$map %||% list())$points,
    reports$block_progress,
    (reports$advance %||% list())$block_progress
  ))
  routes <- first_non_empty(list(
    reports$route_blocks,
    (reports$map %||% list())$blocks,
    reports$block_progress,
    (reports$advance %||% list())$block_progress
  ))
  zone_key <- function(df, ubigeo_cols, zone_cols, activity = c("planned", "visited", "effective")) {
    activity <- match.arg(activity)
    if (!nrow(df)) return(character(0))
    ucol <- .graficos_first_col(df, ubigeo_cols)
    zcol <- .graficos_first_col(df, zone_cols)
    if (!nzchar(ucol) || !nzchar(zcol)) return(character(0))
    keep <- .graficos_fieldwork_activity_mask(df, activity)
    ub <- .graficos_ubigeo6(df[[ucol]])
    zn <- trimws(as.character(df[[zcol]]))
    keep <- keep & nzchar(ub) & nzchar(zn)
    unique(paste(ub[keep], zn[keep], sep = "::"))
  }
  effective <- zone_key(
      audit,
      ubigeo_cols = c("advance_block_ubigeo", "ubigeo", "district_code"),
      zone_cols = c("advance_block_zona", "zona", "zone"),
      activity = "effective"
    )
  visited <- zone_key(
      audit,
      ubigeo_cols = c("advance_block_ubigeo", "ubigeo", "district_code"),
      zone_cols = c("advance_block_zona", "zona", "zone"),
      activity = "visited"
    )
  planned <- zone_key(
      routes,
      ubigeo_cols = c("advance_block_ubigeo", "ubigeo", "district_code"),
      zone_cols = c("advance_block_zona", "zona", "zone"),
      activity = "planned"
    )
  list(
    effective = effective,
    visited = visited,
    planned = planned,
    route = planned
  )
}

.graficos_geojson_zone_code <- function(feature) {
  props <- feature$properties %||% list()
  .graficos_scalar_chr(
    props$zona %||% props$ZONA %||% props$zona_censal %||% props$CODZONA %||% props$codzona %||% props$id,
    ""
  )
}

.graficos_geojson_rings_payload <- function(geometry) {
  rings <- if (exists(".hojas_ruta_geometry_rings", mode = "function")) {
    tryCatch(.hojas_ruta_geometry_rings(geometry), error = function(e) list())
  } else {
    list()
  }
  lapply(rings, function(mat) {
    mat <- as.matrix(mat)
    list(
      x = unname(as.numeric(mat[, 1])),
      y = unname(as.numeric(mat[, 2]))
    )
  })
}

.graficos_rings_payload <- function(rings) {
  lapply(rings %||% list(), function(mat) {
    mat <- as.matrix(mat)
    if (!nrow(mat) || ncol(mat) < 2L) return(list(x = numeric(0), y = numeric(0)))
    list(x = unname(as.numeric(mat[, 1])), y = unname(as.numeric(mat[, 2])))
  })
}

.graficos_lima_district_context <- function() {
  candidates <- c(
    system.file("hojas_ruta", "cartografia", "lima_district_coverage.json", package = "prosecnurapp"),
    file.path(.app_api_dir(), "inst", "hojas_ruta", "cartografia", "lima_district_coverage.json"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "cartografia", "lima_district_coverage.json"),
    file.path(getwd(), "inst", "hojas_ruta", "cartografia", "lima_district_coverage.json")
  )
  path <- candidates[nzchar(candidates) & file.exists(candidates)][1]
  if (is.na(path) || !nzchar(path)) return(list())
  geo <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
  features <- (geo %||% list())$features %||% list()
  out <- lapply(features, function(feature) {
    props <- feature$properties %||% list()
    ubigeo <- .graficos_ubigeo6(props$ubigeo)
    if (!startsWith(ubigeo, "1501")) return(NULL)
    rings <- .graficos_geojson_rings_payload(feature$geometry)
    if (!length(rings)) return(NULL)
    list(
      ubigeo = ubigeo,
      distrito = .graficos_scalar_chr(props$distrito, ""),
      rings = rings,
      label_x = suppressWarnings(as.numeric(props$label_lon %||% NA_real_)),
      label_y = suppressWarnings(as.numeric(props$label_lat %||% NA_real_))
    )
  })
  out[!vapply(out, is.null, logical(1))]
}

.graficos_study_blocks_context <- function(reports, districts) {
  progress <- .graficos_records_df((reports$advance %||% list())$block_progress %||% reports$block_progress)
  if (!nrow(progress)) return(list())
  id_col <- .graficos_first_col(progress, c("id_manzana", "block_id", "advance_block_id"))
  ubigeo_col <- .graficos_first_col(progress, c("ubigeo", "advance_block_ubigeo", "district_code"))
  if (!nzchar(id_col) || !nzchar(ubigeo_col)) return(list())
  visited_mask <- .graficos_fieldwork_activity_mask(progress, "visited")
  effective_mask <- .graficos_fieldwork_activity_mask(progress, "effective")
  out <- list()
  for (district in districts) {
    mask <- .graficos_ubigeo6(progress[[ubigeo_col]]) == district$ubigeo
    ids <- unique(trimws(as.character(progress[[id_col]][mask])))
    ids <- ids[nzchar(ids)]
    if (!length(ids) || !exists(".hojas_ruta_pdf_block_features_for_ubigeo", mode = "function")) next
    features <- tryCatch(
      .hojas_ruta_pdf_block_features_for_ubigeo(district$ubigeo, selected_ids = ids),
      error = function(e) list()
    )
    features <- Filter(function(feature) .graficos_scalar_chr(feature$id, "") %in% ids, features)
    for (feature in features) {
      feature_id <- .graficos_scalar_chr(feature$id, "")
      feature_rows <- mask & trimws(as.character(progress[[id_col]])) == feature_id
      visited <- any(visited_mask[feature_rows], na.rm = TRUE)
      effective <- any(effective_mask[feature_rows], na.rm = TRUE)
      rings <- .graficos_rings_payload(feature$rings)
      if (!length(rings)) next
      out[[length(out) + 1L]] <- list(
        ubigeo = district$ubigeo,
        distrito = district$distrito,
        zona = feature_id,
        status = if (!visited) {
          "no_intervenido"
        } else if (identical(district$group, "intervencion")) {
          "intervencion"
        } else {
          "comparacion"
        },
        visited = visited,
        effective = effective,
        rings = rings
      )
    }
  }
  out
}

.graficos_coverage_map_context <- function(sid, scope = c("district", "overview_koica"), ubigeo = NULL) {
  scope <- match.arg(scope)
  districts <- .graficos_acnur_koica_districts()
  reports <- .graficos_territorial_reports(sid)
  zone_sets <- .graficos_zone_sets(reports)
  selected <- if (identical(scope, "district")) {
    Filter(function(x) identical(x$ubigeo, .graficos_ubigeo6(ubigeo)), districts)
  } else {
    districts
  }
  if (!length(selected)) selected <- districts
  zones <- list()
  summary <- list()
  alerts <- list()
  lima_boundary <- if (identical(scope, "overview_koica")) .graficos_lima_district_context() else list()
  study_blocks <- if (identical(scope, "overview_koica")) {
    .graficos_study_blocks_context(reports, selected)
  } else list()
  boundary_by_ubigeo <- stats::setNames(lima_boundary, vapply(lima_boundary, function(x) x$ubigeo, character(1)))
  for (district in selected) {
    payload <- tryCatch(hojas_ruta_zone_map_preview(district$ubigeo), error = function(e) {
      alerts[[length(alerts) + 1L]] <<- list(level = "warn", code = "zone_map_failed", message = conditionMessage(e))
      NULL
    })
    features <- payload$geojson$features %||% list()
    route_n <- 0L
    effective_n <- 0L
    for (feature in features) {
      zona <- .graficos_geojson_zone_code(feature)
      key <- paste(district$ubigeo, zona, sep = "::")
      is_effective <- key %in% zone_sets$effective
      is_route <- key %in% zone_sets$route
      is_visited <- key %in% zone_sets$visited
      if (is_route) route_n <- route_n + 1L
      if (is_effective) effective_n <- effective_n + 1L
      status <- if (identical(scope, "overview_koica")) {
        if (!is_visited) {
          "no_intervenido"
        } else if (identical(district$group, "comparacion")) {
          "comparacion"
        } else {
          "intervencion"
        }
      } else if (is_effective) {
        "efectiva"
      } else if (is_route) {
        "intervencion"
      } else {
        "no_intervenido"
      }
      rings <- .graficos_geojson_rings_payload(feature$geometry)
      if (!length(rings)) next
      zones[[length(zones) + 1L]] <- list(
        ubigeo = district$ubigeo,
        distrito = district$distrito,
        group = district$group,
        zona = zona,
        status = status,
        planned = is_route,
        visited = is_visited,
        effective = is_effective,
        rings = rings
      )
    }
    summary[[length(summary) + 1L]] <- list(
      ubigeo = district$ubigeo,
      distrito = district$distrito,
      grupo = district$group,
      zonas_ruta = route_n,
      zonas_efectivas = effective_n
    )
  }
  title <- if (identical(scope, "overview_koica")) {
    "Distritos del estudio"
  } else {
    paste("Cobertura efectiva -", selected[[1]]$distrito)
  }
  list(
    scope = scope,
    ubigeo = if (identical(scope, "district")) selected[[1]]$ubigeo else "",
    distrito = if (identical(scope, "district")) selected[[1]]$distrito else "",
    titulo = title,
    subtitle = if (identical(scope, "overview_koica")) {
      ""
    } else {
      "Zonas sombreadas según ruta e información validada"
    },
    caption = "",
    zones = zones,
    lima_boundary = lima_boundary,
    study_districts = unname(Filter(
      function(feature) length(feature %||% list()) > 0L,
      boundary_by_ubigeo[vapply(selected, function(district) district$ubigeo, character(1))]
    )),
    study_blocks = study_blocks,
    district_labels = unname(lapply(selected, function(district) {
      feature <- boundary_by_ubigeo[[district$ubigeo]] %||% list()
      list(
        ubigeo = district$ubigeo,
        distrito = district$distrito,
        pair_label = .graficos_scalar_chr(district$pair_label, ""),
        status = if (identical(district$group, "intervencion")) "intervencion" else "comparacion",
        x = suppressWarnings(as.numeric(feature$label_x %||% NA_real_)) +
          suppressWarnings(as.numeric(district$label_dx %||% 0)),
        y = suppressWarnings(as.numeric(feature$label_y %||% NA_real_)) +
          suppressWarnings(as.numeric(district$label_dy %||% 0))
      )
    })),
    summary = summary,
    alerts = alerts
  )
}

.graficos_koica_crosswalk <- function(sid) {
  districts <- .graficos_acnur_koica_districts()
  rows <- lapply(districts, function(d) {
    data.frame(
      ubigeo = d$ubigeo,
      distrito = d$distrito,
      pair_label = d$pair_label,
      group = d$group,
      kobo_code = "",
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  default_codes <- c(
    `150132` = "sjl",
    `150135` = "smp",
    `150108` = "chorrillos",
    `150103` = "ate",
    `150133` = "sjm",
    `150117` = "olivos"
  )
  out$kobo_code <- unname(default_codes[out$ubigeo])
  s <- session_get(sid, required = FALSE)
  cfg <- (s$monitoreo_config %||% list())$territorial %||% list()
  cw <- cfg$district_crosswalk %||% cfg$districtCrosswalk %||% list()
  cw_df <- .graficos_records_df(cw)
  if (nrow(cw_df) && all(c("ubigeo", "kobo_code") %in% names(cw_df))) {
    configured_codes <- .graficos_norm_text_key(cw_df$kobo_code)
    duplicated_codes <- duplicated(configured_codes) | duplicated(configured_codes, fromLast = TRUE)
    for (i in seq_len(nrow(out))) {
      hit <- which(.graficos_ubigeo6(cw_df$ubigeo) == out$ubigeo[[i]])[1]
      if (!is.na(hit) && nzchar(configured_codes[[hit]]) && !duplicated_codes[[hit]]) {
        out$kobo_code[[i]] <- configured_codes[[hit]]
      }
    }
  }
  out
}

.graficos_detect_district_values <- function(df, sid) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) {
    return(list(
      ubigeo = rep("", 0L),
      distrito = rep("", 0L),
      pair = rep("", 0L),
      group = rep("", 0L)
    ))
  }
  cw <- .graficos_koica_crosswalk(sid)
  col <- .graficos_first_col(df, c(
    "advance_block_ubigeo", "ubigeo", "district_code", "Core/M5_district",
    "M5_district", "district", "distrito", "Distrito"
  ))
  raw <- if (nzchar(col)) as.character(df[[col]]) else rep("", n)
  raw_key <- .graficos_norm_text_key(raw)
  ub <- .graficos_ubigeo6(raw)
  for (i in seq_along(raw_key)) {
    if (nzchar(ub[[i]])) next
    hit <- which(cw$kobo_code == raw_key[[i]] | .graficos_norm_text_key(cw$distrito) == raw_key[[i]])[1]
    if (!is.na(hit)) ub[[i]] <- cw$ubigeo[[hit]]
  }
  match_idx <- match(ub, cw$ubigeo)
  distrito <- ifelse(!is.na(match_idx), cw$distrito[match_idx], "Otros distritos")
  pair <- ifelse(!is.na(match_idx), cw$pair_label[match_idx], "Otros distritos")
  group <- ifelse(!is.na(match_idx) & cw$group[match_idx] == "intervencion", "Intervención territorial",
                  ifelse(!is.na(match_idx) & cw$group[match_idx] == "comparacion", "Comparación territorial", "Otros distritos"))
  list(ubigeo = ub, distrito = distrito, pair = pair, group = group)
}

.graficos_detect_age_groups <- function(df, sid = NULL) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(rep("", 0L))

  find_col <- function(candidates) {
    candidates <- unique(as.character(candidates %||% character(0)))
    exact <- candidates[candidates %in% names(df)]
    if (length(exact)) return(exact[[1L]])
    keys <- .graficos_norm_text_key(names(df))
    candidate_keys <- .graficos_norm_text_key(candidates)
    hit <- which(keys %in% candidate_keys)[1]
    if (length(hit) && !is.na(hit)) names(df)[[hit]] else ""
  }

  state <- if (!is.null(sid)) session_get(sid, required = FALSE) else NULL
  territorial <- ((state %||% list())$monitoreo_config %||% list())$territorial %||% list()
  configured_age <- .graficos_scalar_chr(territorial$age_var, "")
  configured_leaf <- sub("^.*/", "", configured_age)
  grouped_col <- find_col(c(
    "E1_age_calc", "Core/E1_age_calc", "age_group", "grupo_edad",
    "rango_edad", paste0(configured_age, "_calc"), paste0(configured_leaf, "_calc")
  ))

  canonicalize <- function(values) {
    key <- .graficos_norm_text_key(values)
    out <- rep("", length(key))
    out[grepl("(^|_)18_.*29(_|$)", key, perl = TRUE)] <- "18 a 29 años"
    out[grepl("(^|_)30_.*44(_|$)", key, perl = TRUE)] <- "30 a 44 años"
    out[grepl("(^|_)45_.*59(_|$)", key, perl = TRUE)] <- "45 a 59 años"
    out[grepl("(^|_)60(_|$)", key, perl = TRUE) | grepl("(^|_)60_.*(mas|more)(_|$)", key, perl = TRUE)] <- "60 años o más"
    out
  }

  if (nzchar(grouped_col)) {
    grouped <- canonicalize(df[[grouped_col]])
    if (any(nzchar(grouped))) return(grouped)
  }

  age_col <- find_col(c(configured_age, configured_leaf, "E1_age", "Core/E1_age", "age", "edad"))
  if (!nzchar(age_col)) return(rep("", n))
  age <- suppressWarnings(as.numeric(as.character(df[[age_col]])))
  out <- rep("", length(age))
  out[is.finite(age) & age >= 18 & age <= 29] <- "18 a 29 años"
  out[is.finite(age) & age >= 30 & age <= 44] <- "30 a 44 años"
  out[is.finite(age) & age >= 45 & age <= 59] <- "45 a 59 años"
  out[is.finite(age) & age >= 60] <- "60 años o más"
  out
}

.graficos_add_virtual_koica_group_sources <- function(sid, sources) {
  ds <- sources$data_sources %||% list()
  inst <- sources$inst_sources %||% list()
  if (!length(ds) || !length(inst)) return(sources)
  for (nm in intersect(names(ds), names(inst))) {
    df <- ds[[nm]]
    rp_inst <- inst[[nm]]
    if (!is.data.frame(df) || is.null(rp_inst$survey) || !is.data.frame(rp_inst$survey)) next
    detected <- .graficos_detect_district_values(df, sid)
    age_group <- .graficos_detect_age_groups(df, sid)
    if (!"__koica_group" %in% names(df)) df$`__koica_group` <- detected$group
    if (!"__district" %in% names(df)) df$`__district` <- detected$distrito
    if (!"__territory_pair" %in% names(df)) df$`__territory_pair` <- detected$pair
    if (!"__age_group" %in% names(df)) df$`__age_group` <- age_group
    survey <- rp_inst$survey
    choices <- rp_inst$choices %||% rp_inst$choices_raw %||% data.frame()
    add_survey <- function(name, label, list_name) {
      if (name %in% as.character(survey$name %||% character())) return()
      row <- survey[0, , drop = FALSE]
      if (!nrow(row)) {
        row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(survey))), names(survey))),
                             stringsAsFactors = FALSE, check.names = FALSE)
      } else {
        row <- row[1, , drop = FALSE]
      }
      if ("type" %in% names(row)) row$type <- paste("select_one", list_name)
      if ("type_base" %in% names(row)) row$type_base <- "select_one"
      if ("name" %in% names(row)) row$name <- name
      if ("label" %in% names(row)) row$label <- label
      if ("list_name" %in% names(row)) row$list_name <- list_name
      survey <<- rbind(survey, row[, names(survey), drop = FALSE])
    }
    add_choices <- function(list_name, values) {
      if (!is.data.frame(choices) || !"list_name" %in% names(choices) || !"name" %in% names(choices)) return()
      if (any(as.character(choices$list_name %||% "") == list_name)) return()
      lab_col <- .graficos_choices_label_col(choices)
      for (value in values) {
        row <- choices[0, , drop = FALSE]
        if (!nrow(row)) {
          row <- as.data.frame(as.list(stats::setNames(rep(NA_character_, length(names(choices))), names(choices))),
                               stringsAsFactors = FALSE, check.names = FALSE)
        } else {
          row <- row[1, , drop = FALSE]
        }
        row$list_name <- list_name
        row$name <- value
        if (!is.na(lab_col) && lab_col %in% names(row)) row[[lab_col]] <- value
        choices <<- rbind(choices, row[, names(choices), drop = FALSE])
      }
    }
    add_survey("__koica_group", "Grupo territorial", "__koica_group_list")
    add_survey("__district", "Distrito", "__district_list")
    add_survey("__territory_pair", "Ámbito territorial", "__territory_pair_list")
    add_survey("__age_group", "Grupo de edad", "__age_group_list")
    add_choices("__koica_group_list", c("Intervención territorial", "Comparación territorial", "Otros distritos"))
    add_choices("__district_list", unique(as.character(detected$distrito)))
    add_choices("__territory_pair_list", c("Lima Norte", "Lima Este", "Lima Sur", "Otros distritos"))
    add_choices("__age_group_list", c("18 a 29 años", "30 a 44 años", "45 a 59 años", "60 años o más"))
    rp_inst$survey <- survey
    rp_inst$choices <- choices
    ds[[nm]] <- df
    inst[[nm]] <- rp_inst
  }
  sources$data_sources <- ds
  sources$inst_sources <- inst
  sources
}

.graficos_group_path_for_row <- function(survey, i) {
  for (col in c("group_path", "path", "group_label", "group_name", "seccion", "section")) {
    if (col %in% names(survey)) {
      val <- .graficos_scalar_chr(survey[[col]][i], "")
      if (nzchar(val)) return(val)
    }
  }
  ""
}

.graficos_section_looks_like_page <- function(section) {
  key <- .graficos_norm_text_key(section)
  !nzchar(key) ||
    grepl("^(page|pagina|pag|section|seccion|grupo|group)(_?[0-9]+)?$", key) ||
    grepl("^(page|pagina|pag|section|seccion|grupo|group)_[0-9]+$", key)
}

.graficos_section_is_reliable <- function(section, source_kind) {
  simplified <- .graficos_simplify_source_kind(source_kind)
  if (identical(simplified, "surveymonkey")) return(FALSE)
  if (!nzchar(.graficos_scalar_chr(section, ""))) return(FALSE)
  if (.graficos_section_looks_like_page(section)) return(FALSE)
  simplified %in% c("kobo", "xlsform") || identical(simplified, "unknown")
}

.graficos_is_identifier_like <- function(name, label = "") {
  key <- paste(.graficos_norm_text_key(name), .graficos_norm_text_key(label))
  grepl(
    paste(c(
      "\\b(id|uuid|token|codigo|code|key|llave)\\b",
      "correo|email|mail",
      "telefono|phone|celular|whatsapp",
      "\\bnombre\\b|apellidos?",
      "empresa|organizacion|institucion_de_contacto",
      "direccion|address",
      "comentario|observacion|sugerencia"
    ), collapse = "|"),
    key,
    perl = TRUE
  )
}

.graficos_graphable_reason <- function(item) {
  tipo <- .graficos_base_type(item$tipo)
  if (!isTRUE(item$data_available)) return(list(graphable = FALSE, reason = "vacía"))
  if (.graficos_is_identifier_like(item$name, item$label)) {
    return(list(graphable = FALSE, reason = "identificador/contacto/texto sensible"))
  }
  if (tipo %in% c("select_one", "select_multiple")) {
    return(list(graphable = TRUE, reason = ""))
  }
  if (.graficos_is_recoded_var(item$name) && length(item$choices %||% list()) > 0L) {
    return(list(graphable = TRUE, reason = ""))
  }
  if (tipo %in% c("text", "geopoint", "geotrace", "geoshape", "image", "audio", "video", "file", "barcode")) {
    return(list(graphable = FALSE, reason = "abierta cruda"))
  }
  list(graphable = FALSE, reason = sprintf("tipo no graficable (%s)", tipo %||% ""))
}

.graficos_finalize_var_metadata <- function(vars) {
  if (!length(vars)) return(vars)
  by_name <- stats::setNames(seq_along(vars), vapply(vars, function(v) .graficos_scalar_chr(v$name), character(1)))

  # Primero, metadata basica de graficabilidad.
  for (i in seq_along(vars)) {
    vars[[i]]$is_recoded <- .graficos_is_recoded_var(vars[[i]]$name)
    vars[[i]]$raw_parent <- if (isTRUE(vars[[i]]$is_recoded)) .graficos_raw_name_for_recod(vars[[i]]$name) else NULL
    vars[[i]]$preferred_variable <- .graficos_scalar_chr(vars[[i]]$name)
    vars[[i]]$covered_by <- NULL
    vars[[i]]$integrated_in <- NULL
    vars[[i]]$is_preferred <- TRUE
    vars[[i]]$suggest_as_primary <- !isTRUE(vars[[i]]$parent_inherited) &&
      !isTRUE(vars[[i]]$repeat_inherited)

    g <- .graficos_graphable_reason(vars[[i]])
    vars[[i]]$graphable <- isTRUE(g$graphable)
    vars[[i]]$exclusion_reason <- .graficos_scalar_chr(g$reason, "")
  }

  # Si hay recodificada con datos, la original queda cubierta por ella.
  for (i in seq_along(vars)) {
    if (!isTRUE(vars[[i]]$is_recoded) || !isTRUE(vars[[i]]$graphable)) next
    parent <- .graficos_scalar_chr(vars[[i]]$raw_parent, "")
    if (!nzchar(parent) || !(parent %in% names(by_name))) next
    j <- by_name[[parent]]
    vars[[j]]$preferred_variable <- vars[[i]]$name
    vars[[j]]$covered_by <- vars[[i]]$name
    vars[[j]]$is_preferred <- FALSE
  }

  # Campos "other/otros" se consideran integrados si existe madre o madre recodificada.
  for (i in seq_along(vars)) {
    if (!.graficos_is_open_child_var(vars[[i]]$name)) next
    candidates <- .graficos_other_parent_candidates(vars[[i]]$name)
    target <- ""
    for (cand in candidates) {
      recod <- paste0(cand, "_recod")
      if (recod %in% names(by_name)) {
        target <- recod
        break
      }
      if (cand %in% names(by_name)) {
        target <- cand
        break
      }
    }
    if (nzchar(target)) {
      vars[[i]]$integrated_in <- target
      vars[[i]]$covered_by <- target
      vars[[i]]$is_preferred <- FALSE
      vars[[i]]$graphable <- FALSE
      vars[[i]]$exclusion_reason <- "integrada en otra variable"
    }
  }

  vars
}

.graficos_dynamic_tokens <- function(text) {
  text <- .graficos_scalar_chr(text, "")
  hits <- regmatches(text, gregexpr("\\$\\{[^}]+\\}", text, perl = TRUE))[[1]]
  if (!length(hits) || identical(hits, "")) return(character(0))
  unique(sub("\\}$", "", sub("^\\$\\{", "", hits)))
}

.graficos_clean_dynamic_label <- function(text) {
  out <- .graficos_scalar_chr(text, "")
  if (!nzchar(out)) return(out)
  out <- gsub("\\s*[-–—:]\\s*\\$\\{[^}]+\\}", "", out, perl = TRUE)
  out <- gsub("\\s+\\b(de|del|en|para|por|con|a)\\s+\\$\\{[^}]+\\}", "", out,
              perl = TRUE, ignore.case = TRUE)
  out <- gsub("\\$\\{[^}]+\\}", "", out, perl = TRUE)
  out <- gsub("\\s+([,.;:?!])", "\\1", out, perl = TRUE)
  out <- gsub("([,.;:])\\s*([,.;:])", "\\2", out, perl = TRUE)
  out <- gsub("\\s{2,}", " ", out, perl = TRUE)
  trimws(out)
}

.graficos_resolve_dynamic_label <- function(text, var_name, data, choices, is_repeat = FALSE) {
  original <- .graficos_scalar_chr(text, var_name)
  tokens <- .graficos_dynamic_tokens(original)
  universal <- .graficos_clean_dynamic_label(original)
  result <- list(
    label_original = original,
    label = universal,
    dynamic_tokens = as.list(tokens),
    context_resolution = if (length(tokens)) "universal" else "not_required"
  )
  if (!length(tokens) || !isTRUE(is_repeat) || !is.data.frame(data) || !(var_name %in% names(data))) {
    return(result)
  }

  response_mask <- !.graficos_is_blank_cell(data[[var_name]])
  allowed <- character(0)
  if (is.data.frame(choices) && nrow(choices)) {
    label_col <- .graficos_choices_label_col(choices)
    choice_labels <- if (!is.na(label_col) && label_col %in% names(choices)) {
      as.character(choices[[label_col]])
    } else {
      character(0)
    }
    allowed <- unique(trimws(c(
      as.character(choices$name %||% character(0)),
      choice_labels
    )))
    allowed <- allowed[!is.na(allowed) & nzchar(allowed)]
  }
  resolved <- list()
  for (token in tokens) {
    if (.graficos_is_identifier_like(token, token) || !(token %in% names(data)) || !length(allowed)) {
      return(result)
    }
    values <- trimws(as.character(data[[token]][response_mask]))
    values <- unique(values[!is.na(values) & nzchar(values)])
    if (length(values) != 1L || !(values[[1]] %in% allowed)) return(result)
    resolved[[token]] <- values[[1]]
  }
  final <- original
  for (token in names(resolved)) {
    final <- gsub(
      paste0("\\s*[-–—]\\s*\\$\\{", token, "\\}"),
      paste0(": ", resolved[[token]]),
      final,
      perl = TRUE
    )
    final <- gsub(paste0("${", token, "}"), resolved[[token]], final, fixed = TRUE)
  }
  result$label <- .graficos_clean_dynamic_label(final)
  result$context_resolution <- "unique_materialized_repeat_context"
  result
}

.graficos_extract_vars_from_inst <- function(rp_inst, data = NULL, source_name = "", source_kind = "") {
  if (is.null(rp_inst)) return(list())
  survey <- rp_inst$survey
  if (is.null(survey) || !is.data.frame(survey) || !nrow(survey)) return(list())
  choices <- rp_inst$choices %||% rp_inst$choices_raw %||% NULL
  type_base <- if ("type_base" %in% names(survey)) survey[["type_base"]] else rep(NA_character_, nrow(survey))
  type <- if ("type" %in% names(survey)) survey[["type"]] else rep("", nrow(survey))
  name <- if ("name" %in% names(survey)) survey[["name"]] else rep("", nrow(survey))
  label <- if ("label" %in% names(survey)) survey[["label"]] else name
  group_name <- if ("group_name" %in% names(survey)) survey[["group_name"]] else rep("", nrow(survey))
  structural_section <- if (exists(".graficos_acnur_survey_sections", mode = "function")) {
    .graficos_acnur_survey_sections(survey)
  } else {
    rep("", nrow(survey))
  }
  repeat_grain <- attr(rp_inst, "repeat_grain", exact = TRUE) %||% rp_inst$repeat_grain %||% list()
  is_repeat <- identical(.graficos_scalar_chr(repeat_grain$kind, ""), "instancia")
  vs <- list()
  for (i in seq_len(nrow(survey))) {
    tb <- as.character(type_base[i] %||% type[i] %||% "")
    tb <- .graficos_base_type(tb)
    if (tb %in% .graficos_var_skip_types) next
    nm <- as.character(name[i] %||% "")
    if (!nzchar(nm)) next
    if (startsWith(nm, "__")) next
    list_name <- .graficos_list_name_for_row(survey, i)
    choice_meta <- .graficos_choices_for_list(choices, list_name)
    section <- as.character(group_name[i] %||% "")
    group_path <- .graficos_group_path_for_row(survey, i)
    if (!nzchar(.graficos_scalar_chr(group_path, ""))) {
      group_path <- .graficos_scalar_chr(structural_section[[i]], "")
    }
    if (!nzchar(.graficos_scalar_chr(section, ""))) section <- group_path
    label_meta <- .graficos_resolve_dynamic_label(
      label[i] %||% nm,
      var_name = nm,
      data = data,
      choices = choices,
      is_repeat = is_repeat
    )
    n_non_empty <- .graficos_var_non_empty_n(data, nm)
    parent_inherited <- FALSE
    if ("parent_inherited" %in% names(survey)) {
      flag <- suppressWarnings(as.logical(survey$parent_inherited[i]))
      parent_inherited <- isTRUE(flag)
    }
    repeat_inherited <- parent_inherited || (
      is.data.frame(data) && nm %in% names(data) &&
        isTRUE(attr(data[[nm]], "repeat_inherited", exact = TRUE))
    )
    vs[[length(vs) + 1L]] <- list(
      name = nm,
      label = label_meta$label,
      label_original = label_meta$label_original,
      dynamic_tokens = label_meta$dynamic_tokens,
      context_resolution = label_meta$context_resolution,
      tipo = tb,
      seccion = .graficos_clean_dynamic_label(section),
      list_name = list_name,
      choices = choice_meta$items,
      scale_signature = choice_meta$signature,
      data_available = n_non_empty > 0L,
      n_non_empty = n_non_empty,
      source_kind = .graficos_simplify_source_kind(source_kind),
      group_path = .graficos_clean_dynamic_label(group_path),
      section_reliable = .graficos_section_is_reliable(group_path %||% section, source_kind),
      parent_inherited = parent_inherited,
      repeat_inherited = repeat_inherited
    )
  }
  .graficos_finalize_var_metadata(vs)
}

.graficos_ref_parts <- function(ref) {
  ref <- .graficos_scalar_chr(ref, "")
  idx <- regexpr("\\$", ref, fixed = FALSE)[[1]]
  if (is.na(idx) || idx < 1L) return(list(source = "", name = ref))
  list(source = substr(ref, 1L, idx - 1L), name = substr(ref, idx + 1L, nchar(ref)))
}

.graficos_collect_strings <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.character(x)) return(trimws(x[nzchar(trimws(x))]))
  if (is.atomic(x)) return(character(0))
  if (is.list(x)) return(unlist(lapply(x, .graficos_collect_strings), use.names = FALSE))
  character(0)
}

.graficos_collect_refs_from_args <- function(args) {
  if (!is.list(args)) return(character(0))
  refs <- character(0)
  for (key in intersect(names(args), c("var", "vars", "cruces", "cruce", "variable", "variables", "objetivo"))) {
    refs <- c(refs, .graficos_collect_strings(args[[key]]))
  }
  if (is.list(args$bloques)) {
    refs <- c(refs, unlist(lapply(args$bloques, .graficos_collect_refs_from_args), use.names = FALSE))
  }
  unique(refs[nzchar(refs)])
}

.graficos_collect_plan_refs <- function(plan) {
  plan <- .normalize_plan(plan)
  slides <- plan$slides %||% list()
  refs <- character(0)
  for (slide in slides) {
    payload <- .as_json_list((slide %||% list())$payload) %||% list()
    for (value in payload) {
      graf <- .as_json_list(value)
      if (is.null(graf$graficador)) next
      refs <- c(refs, .graficos_collect_refs_from_args(graf$args %||% list()))
    }
  }
  unique(refs[nzchar(refs)])
}

.graficos_coverage_exclusions <- function(config = NULL) {
  cfg <- .graficos_normalize_config(config %||% list())
  rules <- cfg$scope_rules %||% list()
  exclusions <- rules$coverage_exclusions %||% rules$coverageExclusions %||% list()
  unique(.graficos_collect_strings(exclusions))
}

.graficos_ref_matches_var <- function(ref, source, name) {
  parts <- .graficos_ref_parts(ref)
  if (nzchar(parts$source)) {
    identical(parts$source, source) && identical(parts$name, name)
  } else {
    identical(parts$name, name)
  }
}

.graficos_is_var_ref_in <- function(refs, source, name) {
  any(vapply(refs, .graficos_ref_matches_var, logical(1), source = source, name = name))
}

.graficos_var_status <- function(v, source, included_refs, exclusions) {
  name <- .graficos_scalar_chr(v$name, "")
  if (.graficos_is_var_ref_in(exclusions, source, name)) return("excluida_intencionalmente")
  if (!isTRUE(v$data_available)) return("vacía")
  if (nzchar(.graficos_scalar_chr(v$integrated_in, ""))) return("integrada_en_otra_variable")
  if (nzchar(.graficos_scalar_chr(v$covered_by, ""))) return("cubierta_por_recodificada")
  if (!isTRUE(v$graphable)) return("no_graficable")
  if (.graficos_is_var_ref_in(included_refs, source, name)) return("cubierta")
  "sin_usar"
}

.graficos_plan_coverage <- function(sid, plan = NULL, config = NULL, scoped = TRUE) {
  plan <- .normalize_plan(plan %||% (.graficos_config_get(sid)$plan %||% list(slides = list())))
  cfg <- .graficos_effective_config(sid, config)
  payload <- .graficos_variables_sources_payload(sid, scoped = isTRUE(scoped))
  included_refs <- .graficos_collect_plan_refs(plan)
  exclusions <- .graficos_coverage_exclusions(cfg)

  sources <- lapply(payload$sources %||% list(), function(src) {
    source_name <- .graficos_scalar_chr(src$name, "default")
    vars <- lapply(src$variables %||% list(), function(v) {
      status <- .graficos_var_status(v, source_name, included_refs, exclusions)
      countable <- isTRUE(v$graphable) && isTRUE(v$is_preferred) &&
        !identical(v$suggest_as_primary, FALSE) &&
        status != "excluida_intencionalmente"
      c(v, list(status = status, coverage_countable = countable))
    })
    list(
      name = source_name,
      source_kind = .graficos_scalar_chr(src$source_kind, "unknown"),
      source_kind_raw = .graficos_scalar_chr(src$source_kind_raw, ""),
      source_role = .graficos_scalar_chr(src$source_role, "principal"),
      repeat_grain = src$repeat_grain %||% list(),
      base_label = .graficos_scalar_chr(src$base_label, ""),
      variables = vars
    )
  })

  all_vars <- unlist(lapply(sources, `[[`, "variables"), recursive = FALSE)
  count_status <- function(status) sum(vapply(all_vars, function(v) identical(v$status, status), logical(1)))
  graphable_countable <- vapply(all_vars, function(v) isTRUE(v$coverage_countable), logical(1))
  included_countable <- vapply(all_vars, function(v) isTRUE(v$coverage_countable) && identical(v$status, "cubierta"), logical(1))

  warnings <- character(0)
  if (any(vapply(sources, function(src) {
    identical(.graficos_simplify_source_kind(src$source_kind), "surveymonkey") &&
      any(vapply(src$variables, function(v) nzchar(.graficos_scalar_chr(v$seccion, "")), logical(1)))
  }, logical(1)))) {
    warnings <- c(warnings, "Se ignoraron páginas/grupos SurveyMonkey como secciones temáticas sugeridas.")
  }

  list(
    ok = TRUE,
    summary = list(
      total_variables = length(all_vars),
      graphable_variables = sum(graphable_countable),
      included_graphable = sum(included_countable),
      unused_graphable = sum(graphable_countable) - sum(included_countable),
      not_graphable = count_status("no_graficable"),
      empty = count_status("vacía"),
      covered_by_recod = count_status("cubierta_por_recodificada"),
      integrated = count_status("integrada_en_otra_variable"),
      excluded_intentionally = count_status("excluida_intencionalmente"),
      included_refs = length(included_refs)
    ),
    sources = sources,
    warnings = as.list(unique(warnings))
  )
}

.graficos_var_choice_n <- function(v) length(v$choices %||% list())

.graficos_acnur_choice_exclusion_aliases <- function(item) {
  values <- Filter(nzchar, c(
    .graficos_scalar_chr(item$name, ""),
    .graficos_scalar_chr(item$label, "")
  ))
  keys <- .graficos_norm_text_key(values)
  if (any(keys %in% c("otro", "otros", "otra", "otras", "other", "others"))) {
    values <- c(values, "Otro", "Otros", "Otra", "Otras", "Other", "Others")
  }
  unique(values)
}

.graficos_acnur_choice_pages <- function(v, max_per_slide = 8L) {
  choices <- v$choices %||% list()
  n_choices <- length(choices)
  max_per_slide <- suppressWarnings(as.integer(max_per_slide)[1])
  if (!is.finite(max_per_slide) || is.na(max_per_slide) || max_per_slide < 2L) {
    max_per_slide <- 8L
  }
  if (n_choices <= max_per_slide) {
    return(list(list(exclude_options = NULL, page = 1L, pages = 1L)))
  }

  chunks <- split(seq_len(n_choices), ceiling(seq_len(n_choices) / max_per_slide))
  lapply(seq_along(chunks), function(page_idx) {
    keep_idx <- chunks[[page_idx]]
    exclude_idx <- setdiff(seq_len(n_choices), keep_idx)
    exclude_options <- unique(unlist(lapply(choices[exclude_idx], function(item) {
      .graficos_acnur_choice_exclusion_aliases(item)
    }), use.names = FALSE))
    list(
      exclude_options = exclude_options,
      page = as.integer(page_idx),
      pages = as.integer(length(chunks))
    )
  })
}

.graficos_acnur_page_subtitle <- function(subtitle, page_spec) {
  subtitle <- .graficos_scalar_chr(subtitle, "")
  pages <- suppressWarnings(as.integer((page_spec %||% list())$pages %||% 1L)[1])
  page <- suppressWarnings(as.integer((page_spec %||% list())$page %||% 1L)[1])
  if (!is.finite(pages) || pages <= 1L) return(subtitle)
  marker <- sprintf("%d de %d", page, pages)
  if (nzchar(subtitle)) paste(subtitle, marker, sep = " · ") else marker
}

.graficos_is_ordinal_signature <- function(v) {
  n <- .graficos_var_choice_n(v)
  isTRUE(v$graphable) &&
    identical(.graficos_base_type(v$tipo), "select_one") &&
    nzchar(.graficos_scalar_chr(v$scale_signature, "")) &&
    n >= 3L && n <= 7L
}

.graficos_chart_for_var <- function(v, ref, profile_id = "", comparison_ref = NULL,
                                    base_label = "", exclude_options = NULL,
                                    filtros = list(), subtitulo = "",
                                    comparison_colors = NULL,
                                    base_unit = "") {
  n_choices <- .graficos_var_choice_n(v)
  label <- .graficos_scalar_chr(v$label, ref)
  tipo <- .graficos_base_type(v$tipo)
  acnur_profile <- identical(.graficos_scalar_chr(profile_id, ""), "acnur_kobo_cruncher_plus")
  comparison_ref <- .graficos_scalar_chr(comparison_ref, "")
  add_comparison <- function(args) {
    if (nzchar(comparison_ref)) args$cruces <- comparison_ref
    if (length(filtros)) args$filtros <- filtros
    args
  }
  if (isTRUE(acnur_profile)) {
    comparison_enabled <- nzchar(comparison_ref)
    chart_overrides <- list(
      mostrar_leyenda = comparison_enabled,
      leyenda_posicion = if (comparison_enabled) "abajo" else "ninguna",
      excluir_opciones = exclude_options,
      minimo_cero_visual = 0.005,
      color_fondo = "#FFFFFF"
    )
    if (comparison_enabled && length(filtros)) {
      chart_overrides$base_por_grupo <- TRUE
      chart_overrides$invertir_series <- TRUE
      chart_overrides$invertir_leyenda <- TRUE
      chart_overrides$legend_espaciado <- 5
    }
    base_label <- .graficos_scalar_chr(base_label, "")
    subtitulo <- .graficos_scalar_chr(subtitulo, "")
    if (nzchar(base_label)) chart_overrides$nota_pie <- base_label
    if (nzchar(subtitulo)) chart_overrides$subtitulo <- subtitulo
    base_unit <- .graficos_scalar_chr(base_unit, "")
    if (nzchar(base_unit)) chart_overrides$unidad_base <- base_unit
    if (!is.null(comparison_colors) && length(comparison_colors)) {
      chart_overrides$colores_series <- comparison_colors
    }
    return(list(
      graficador = "p_barras_agrupadas",
      args = add_comparison(list(
        var = ref,
        mostrar_ceros = TRUE,
        overrides = chart_overrides
      ))
    ))
  }
  if (identical(tipo, "select_multiple")) {
    return(list(graficador = "p_barras_agrupadas", args = add_comparison(list(var = ref, titulo = label, mostrar_ceros = FALSE))))
  }
  if (n_choices == 2L) {
    return(list(graficador = "p_pie", args = list(var = ref, titulo = label)))
  }
  if (n_choices > 8L) {
    return(list(graficador = "p_barras_agrupadas", args = add_comparison(list(var = ref, titulo = label, mostrar_ceros = FALSE))))
  }
  list(graficador = "p_barras_apiladas", args = add_comparison(list(var = ref, titulo = label)))
}

.graficos_plan_slide_id <- local({
  counter <- 0L
  function(prefix = "sug") {
    counter <<- counter + 1L
    sprintf("%s-%04d-%s", prefix, counter, paste(sample(c(letters, 0:9), 5, TRUE), collapse = ""))
  }
})

.graficos_add_section_slide <- function(slides, title) {
  title <- .graficos_scalar_chr(title, "")
  if (!nzchar(title)) return(slides)
  slides[[length(slides) + 1L]] <- list(
    id = .graficos_plan_slide_id("sec"),
    tipo = "p_slide_seccion",
    payload = list(titulo = title, subtitulo = "", introduccion_word = "")
  )
  slides
}

.graficos_pack_simple_graphs <- function(graphs, section_title = "", base_label = "") {
  slides <- list()
  i <- 1L
  while (i <= length(graphs)) {
    remaining <- length(graphs) - i + 1L
    if (remaining >= 2L) {
      title <- section_title
      if (!nzchar(title)) title <- "Resultados por pregunta"
      slides[[length(slides) + 1L]] <- list(
        id = .graficos_plan_slide_id("auto"),
        tipo = "p_slide_2_graficos_narrativo",
        payload = list(
          titulo = title,
          texto = "",
          izquierda = graphs[[i]]$graf,
          derecha = graphs[[i + 1L]]$graf,
          base = base_label,
          pie = "",
          etiqueta = ""
        )
      )
      i <- i + 2L
    } else {
      slides[[length(slides) + 1L]] <- list(
        id = .graficos_plan_slide_id("auto"),
        tipo = "p_slide_1_grafico_narrativo",
        payload = list(
          titulo = graphs[[i]]$title,
          texto = "",
          grafico = graphs[[i]]$graf,
          base = base_label,
          pie = "",
          etiqueta = ""
        )
      )
      i <- i + 1L
    }
  }
  slides
}

.graficos_ref_for_source <- function(source, name) {
  name <- .graficos_scalar_chr(name, "")
  if (!nzchar(name)) return("")
  if (!identical(.graficos_scalar_chr(source, "default"), "default")) paste0(source, "$", name) else name
}

.graficos_comparison_ref <- function(source, comparison_mode = "none") {
  mode <- .graficos_scalar_chr(comparison_mode, "none")
  if (identical(mode, "koica_group")) return(.graficos_ref_for_source(source, "__koica_group"))
  if (mode %in% c("district", "paired_district")) return(.graficos_ref_for_source(source, "__district"))
  ""
}

.graficos_acnur_pair_specs <- function(source = "default") {
  lapply(.graficos_acnur_koica_pairs(), function(pair) {
    districts <- pair$districts
    colors <- stats::setNames(c("#0072BC", "#00A98F"), districts)
    list(
      id = pair$id,
      label = pair$label,
      subtitle = pair$label,
      comparison_ref = .graficos_ref_for_source(source, "__district"),
      filters = stats::setNames(list(districts), "__district"),
      colors = colors,
      districts = districts
    )
  })
}

.graficos_acnur_pairwise_exempt <- function(v) {
  name_key <- .graficos_norm_text_key(.graficos_scalar_chr(v$name, ""))
  label_key <- .graficos_norm_text_key(.graficos_scalar_chr(v$label, ""))
  name_key %in% c("consent", "consentimiento", "m5_district", "district", "distrito") ||
    grepl("(^|_)consent($|_)|(^|_)district($|_)|(^|_)distrito($|_)", name_key, perl = TRUE) ||
    grepl("^distrito$|acepta continuar|consentimiento", label_key, perl = TRUE)
}

.graficos_boolish <- function(x) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.logical(x)) return(isTRUE(x[[1]]))
  key <- .graficos_norm_text_key(as.character(x[[1]] %||% ""))
  if (key %in% c("true", "1", "si", "yes", "on", "enabled", "activo")) return(TRUE)
  if (key %in% c("false", "0", "no", "off", "disabled", "inactivo")) return(FALSE)
  NULL
}

.graficos_multisource_flag <- function(raw_cfg, cfg) {
  rules <- (cfg %||% list())$scope_rules %||% list()
  .graficos_boolish(
    (raw_cfg %||% list())$multi_actor_comparisons %||%
      (raw_cfg %||% list())$multiActorComparisons %||%
      rules$multi_actor_comparisons %||%
      rules$multiActorComparisons
  )
}

.graficos_session_profile_values <- function(sid, raw_cfg = list(), cfg = list()) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(character(0))
  profile <- (s$monitoreo_config %||% list())$monitoreo_profile %||% s$monitoreo_profile %||% list()
  estudio <- s$estudio %||% list()
  bases <- estudio$bases %||% list()
  base_values <- unlist(lapply(bases, function(meta) {
    .graficos_collect_strings(list(
      meta$project_kind,
      meta$profile_family,
      meta$profile_id,
      meta$source_alias,
      meta$source_title
    ))
  }), use.names = FALSE)
  .graficos_collect_strings(list(
    raw_cfg$profile_id,
    raw_cfg$profileId,
    raw_cfg$project_kind,
    raw_cfg$projectKind,
    raw_cfg$profile_family,
    raw_cfg$profileFamily,
    cfg$profile_id,
    cfg$project_kind,
    cfg$profile_family,
    profile$family,
    profile$variant,
    s$project_path,
    tools::file_path_sans_ext(basename(s$project_path %||% "")),
    estudio$project_kind,
    estudio$profile_family,
    (estudio$independent_siblings %||% list())$project_kind,
    (estudio$independent_siblings %||% list())$profile_family,
    base_values
  ))
}

.graficos_is_acnur_study <- function(sid, raw_cfg = list(), cfg = list()) {
  keys <- .graficos_norm_text_key(
    .graficos_session_profile_values(sid, raw_cfg = raw_cfg, cfg = cfg)
  )
  any(grepl("(^|_)(acnur|unhcr)(_|$)", keys, perl = TRUE))
}

.graficos_should_use_multisource_report <- function(sid, coverage, raw_cfg = list(), cfg = list(), profile_id = "") {
  n_sources <- length((coverage %||% list())$sources %||% list())
  if (n_sources < 2L) return(FALSE)
  if (identical(.graficos_scalar_chr(profile_id, ""), "acnur_kobo_cruncher_plus")) return(FALSE)

  explicit <- .graficos_multisource_flag(raw_cfg, cfg)
  if (!is.null(explicit)) return(isTRUE(explicit))

  keys <- .graficos_norm_text_key(.graficos_session_profile_values(sid, raw_cfg = raw_cfg, cfg = cfg))
  if (any(grepl("acreditacion|accreditation", keys))) return(TRUE)

  if (exists("estudio_is_independent_siblings", mode = "function") &&
      isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))) {
    return(TRUE)
  }
  FALSE
}

.graficos_multisource_choice_signature <- function(v) {
  .graficos_scalar_chr(v$scale_signature, "")
}

.graficos_multisource_candidate_rows <- function(coverage) {
  rows <- list()
  for (src in (coverage$sources %||% list())) {
    source <- .graficos_scalar_chr(src$name, "default")
    for (v in (src$variables %||% list())) {
      tipo <- .graficos_base_type(v$tipo)
      if (!identical(tipo, "select_one")) next
      if (!isTRUE(v$graphable) || !isTRUE(v$is_preferred) || !isTRUE(v$data_available)) next
      if (identical(v$suggest_as_primary, FALSE)) next
      if (identical(v$status, "excluida_intencionalmente")) next
      choice_n <- .graficos_var_choice_n(v)
      if (choice_n < 2L || choice_n > 8L) next
      label <- .graficos_scalar_chr(v$label, v$name)
      label_key <- .graficos_norm_text_key(label)
      signature <- .graficos_multisource_choice_signature(v)
      if (!nzchar(label_key) || !nzchar(signature)) next
      rows[[length(rows) + 1L]] <- list(
        source = source,
        name = .graficos_scalar_chr(v$name, ""),
        label = label,
        label_key = label_key,
        signature = signature,
        choice_n = choice_n
      )
    }
  }
  rows
}

.graficos_multisource_comparison_candidates <- function(coverage, max_slides = 4L) {
  rows <- .graficos_multisource_candidate_rows(coverage)
  if (!length(rows)) return(list())
  group_key <- vapply(rows, function(row) paste(row$label_key, row$signature, sep = "::"), character(1))
  groups <- split(rows, group_key)
  candidates <- list()
  for (group in groups) {
    seen_sources <- character(0)
    unique_rows <- list()
    for (row in group) {
      if (!nzchar(row$source) || row$source %in% seen_sources) next
      seen_sources <- c(seen_sources, row$source)
      unique_rows[[length(unique_rows) + 1L]] <- row
    }
    if (length(unique_rows) < 2L) next
    refs <- vapply(unique_rows, function(row) {
      .graficos_ref_for_source(row$source, row$name)
    }, character(1))
    key <- unique_rows[[1]]$label_key
    candidates[[length(candidates) + 1L]] <- list(
      key = key,
      label = unique_rows[[1]]$label,
      refs = refs,
      source_count = length(unique_rows),
      choice_n = unique_rows[[1]]$choice_n
    )
  }
  if (!length(candidates)) return(list())
  ord <- order(
    -vapply(candidates, `[[`, integer(1), "source_count"),
    vapply(candidates, function(x) .graficos_norm_text_key(x$label), character(1))
  )
  candidates[ord][seq_len(min(length(candidates), as.integer(max_slides %||% 4L)))]
}

.graficos_multisource_comparison_slides <- function(coverage, max_slides = 4L) {
  candidates <- .graficos_multisource_comparison_candidates(coverage, max_slides = max_slides)
  if (!length(candidates)) return(list(slides = list(), refs = character(0)))
  slides <- list()
  slides <- .graficos_add_section_slide(slides, "Comparativo por actor")
  refs <- character(0)
  for (candidate in candidates) {
    vars <- stats::setNames(list(unname(candidate$refs)), candidate$key)
    titulos_grupo <- stats::setNames(candidate$label, candidate$key)
    slides[[length(slides) + 1L]] <- list(
      id = .graficos_plan_slide_id("auto"),
      tipo = "p_slide_1_grafico_narrativo",
      payload = list(
        titulo = paste("Comparativo por actor:", candidate$label),
        texto = "",
        grafico = list(
          graficador = "p_barras_multiapiladas",
          args = list(
            modo = "var_cruce",
            vars = vars,
            titulos_grupo = titulos_grupo,
            titulo = candidate$label,
            top2box = candidate$choice_n %in% c(4L, 5L),
            wrap_y = 60
          )
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
    refs <- c(refs, candidate$refs)
  }
  list(slides = slides, refs = unique(refs))
}

.graficos_acnur_intro_slides <- function(sid, include_coverage_maps = FALSE, acnur_mode = "general",
                                         coverage = NULL, index_single_limit = 8L,
                                         index_per_slide = 8L,
                                         include_district_maps = FALSE,
                                         cover_title = "") {
  territorial_mode <- identical(.graficos_scalar_chr(acnur_mode, "general"), "territorial")
  slides <- .graficos_acnur_report_intro_slides(
    sid,
    coverage,
    acnur_mode = acnur_mode,
    index_single_limit = index_single_limit,
    index_per_slide = index_per_slide,
    cover_title = cover_title
  )
  if (territorial_mode) {
    is_note <- vapply(slides, function(slide) {
      identical(.graficos_scalar_chr((slide %||% list())$tipo, ""), "p_slide_texto") &&
        identical(.graficos_scalar_chr(((slide %||% list())$payload %||% list())$titulo, ""),
                  "Diseño territorial")
    }, logical(1))
    slides <- slides[!is_note]
  }
  if (isTRUE(territorial_mode) && isTRUE(include_coverage_maps)) {
    overview_context <- .graficos_coverage_map_context(sid, scope = "overview_koica")
    overview_context$titulo <- ""
    overview_context$mostrar_titulo <- FALSE
    slides[[length(slides) + 1L]] <- list(
      id = .graficos_plan_slide_id("map"),
      tipo = "p_slide_1_grafico_narrativo",
      payload = list(
        titulo = "Distritos del estudio",
        texto = "",
        grafico = list(
          graficador = "p_mapa_cobertura_territorial",
          args = list(
            scope = "overview_koica",
            titulo = "Distritos del estudio",
            contexto = overview_context,
            overrides = list(titulo = "")
          )
        ),
        base = "",
        pie = "",
        etiqueta = "",
        meta = list(
          plot_extra_height_cm = 0,
          plot_max_height_cm = 12.50
        )
      )
    )
    if (isTRUE(include_district_maps)) for (district in .graficos_acnur_koica_districts()) {
      ctx <- .graficos_coverage_map_context(sid, scope = "district", ubigeo = district$ubigeo)
      title <- paste("Cobertura efectiva -", district$distrito)
      slides[[length(slides) + 1L]] <- list(
        id = .graficos_plan_slide_id("map"),
        tipo = "p_slide_1_grafico_narrativo",
        payload = list(
          titulo = title,
          texto = "",
          grafico = list(
            graficador = "p_mapa_cobertura_territorial",
            args = list(scope = "district", ubigeo = district$ubigeo, titulo = title, contexto = ctx)
          ),
          base = "",
          pie = "",
          etiqueta = ""
        )
      )
    }
  }
  if (isTRUE(territorial_mode) && exists(".graficos_acnur_profile_slides", mode = "function")) {
    slides <- c(slides, .graficos_acnur_profile_slides(sid, coverage))
  }
  slides
}

.graficos_acnur_mode <- function(raw_cfg, cfg, include_value = NULL, comparison_value = NULL) {
  raw_cfg <- raw_cfg %||% list()
  cfg <- cfg %||% list()
  mode_value <- raw_cfg$acnur_mode %||% raw_cfg$acnurMode %||%
    raw_cfg$report_mode %||% raw_cfg$reportMode %||%
    cfg$acnur_mode %||% cfg$acnurMode %||% cfg$report_mode %||% cfg$reportMode
  mode_explicit <- !is.null(raw_cfg$acnur_mode) ||
    !is.null(raw_cfg$acnurMode) ||
    !is.null(raw_cfg$report_mode) ||
    !is.null(raw_cfg$reportMode) ||
    !is.null(cfg$acnur_mode) ||
    !is.null(cfg$acnurMode) ||
    !is.null(cfg$report_mode) ||
    !is.null(cfg$reportMode)

  mode <- .graficos_norm_text_key(.graficos_scalar_chr(mode_value, "general"))
  if (mode %in% c("territorial", "koica", "koica_territorial", "cobertura", "mapas", "coverage")) {
    return("territorial")
  }
  if (isTRUE(mode_explicit)) return("general")

  comparison_mode <- .graficos_scalar_chr(comparison_value, "")
  if (isTRUE(include_value) || comparison_mode %in% c("koica_group", "district", "paired_district")) {
    return("territorial")
  }
  "general"
}

.graficos_pack_acnur_graphs <- function(graphs, section_title = "", base_label = "") {
  lapply(graphs, function(item) {
    list(
      id = .graficos_plan_slide_id("auto"),
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = item$title,
        grafico = item$graf,
        base = NULL,
        pie = .graficos_scalar_chr(item$source_note, ""),
        etiqueta = "",
        meta = list(
          suppress_base_placeholder = TRUE,
          suppress_footer_placeholder = !nzchar(.graficos_scalar_chr(item$source_note, ""))
        )
      )
    )
  })
}

.graficos_generation_audit <- function(plan, coverage) {
  variable_index <- list()
  for (src in coverage$sources %||% list()) {
    source <- .graficos_scalar_chr(src$name, "default")
    for (v in src$variables %||% list()) {
      key <- paste(source, .graficos_scalar_chr(v$name, ""), sep = "$")
      variable_index[[key]] <- c(v, list(source = source, ref = key))
    }
  }
  find_variable <- function(ref) {
    parts <- .graficos_ref_parts(ref)
    if (nzchar(parts$source)) return(variable_index[[paste(parts$source, parts$name, sep = "$")]])
    hits <- Filter(function(v) identical(.graficos_scalar_chr(v$name, ""), parts$name), variable_index)
    covered <- Filter(function(v) identical(v$status, "cubierta"), hits)
    if (length(covered)) covered[[1]] else if (length(hits)) hits[[1]] else NULL
  }

  generated <- list()
  seen <- character(0)
  for (slide in (.normalize_plan(plan)$slides %||% list())) {
    payload <- .as_json_list(slide$payload) %||% list()
    title_final <- .graficos_clean_dynamic_label(payload$titulo %||% "")
    for (value in payload) {
      graf <- .as_json_list(value)
      if (is.null(graf$graficador)) next
      args <- .as_json_list(graf$args) %||% list()
      refs <- unique(c(.graficos_collect_strings(args$var), .graficos_collect_strings(args$vars)))
      for (ref in refs[nzchar(refs)]) {
        v <- find_variable(ref)
        if (is.null(v)) next
        key <- paste(v$source, v$name, sep = "$")
        if (key %in% seen) next
        seen <- c(seen, key)
        generated[[length(generated) + 1L]] <- list(
          source = v$source,
          var = v$name,
          ref = key,
          slide_id = .graficos_scalar_chr(slide$id, ""),
          graficador = .graficos_scalar_chr(graf$graficador, ""),
          label_original = .graficos_scalar_chr(v$label_original %||% v$label, ""),
          title_final = if (nzchar(title_final)) title_final else .graficos_scalar_chr(v$label, v$name),
          tokens = v$dynamic_tokens %||% list(),
          context_resolution = .graficos_scalar_chr(v$context_resolution, "not_required")
        )
      }
    }
  }

  omitted <- list()
  for (v in variable_index) {
    key <- paste(v$source, v$name, sep = "$")
    if (key %in% seen) next
    inherited <- isTRUE(v$parent_inherited) || isTRUE(v$repeat_inherited)
    operational_filter <- isTRUE(v$operational_filter)
    omitted[[length(omitted) + 1L]] <- list(
      source = v$source,
      var = v$name,
      ref = key,
      reason_code = if (operational_filter) {
        "universe_filter"
      } else if (inherited) {
        "inherited_dimension"
      } else {
        .graficos_scalar_chr(v$status, "sin_usar")
      },
      status = .graficos_scalar_chr(v$status, "sin_usar"),
      inherited = inherited,
      operational_filter = operational_filter
    )
  }
  list(
    totals = list(generated = length(generated), omitted = length(omitted), failed = 0L),
    generated = generated,
    omitted = omitted,
    failed = list()
  )
}

.graficos_suggested_plan <- function(sid, config = NULL) {
  raw_cfg <- config %||% list()
  cfg <- .graficos_effective_config(sid, config)
  profile_id <- .graficos_scalar_chr(raw_cfg$profile_id %||% raw_cfg$profileId %||% cfg$profile_id, "")
  if (!nzchar(profile_id) && .graficos_is_acnur_study(sid, raw_cfg = raw_cfg, cfg = cfg)) {
    profile_id <- "acnur_kobo_cruncher_plus"
  }
  include_value <- raw_cfg$include_coverage_maps %||% raw_cfg$includeCoverageMaps %||% cfg$include_coverage_maps
  comparison_value <- raw_cfg$comparison_mode %||% raw_cfg$comparisonMode %||% cfg$comparison_mode
  include_district_maps <- isTRUE(
    raw_cfg$include_district_maps %||% raw_cfg$includeDistrictMaps %||%
      cfg$include_district_maps %||% cfg$includeDistrictMaps
  )
  include_explicit <- !is.null(raw_cfg$include_coverage_maps) ||
    !is.null(raw_cfg$includeCoverageMaps) ||
    !is.null(cfg$include_coverage_maps)
  comparison_explicit <- !is.null(raw_cfg$comparison_mode) ||
    !is.null(raw_cfg$comparisonMode) ||
    !is.null(cfg$comparison_mode)
  coverage_caps <- .graficos_territorial_coverage_capabilities(sid)
  include_coverage_maps <- isTRUE(include_value)
  comparison_mode <- .graficos_scalar_chr(comparison_value, "")
  # Override OPT-IN del titulo de portada del PPT ACNUR: si el config del
  # export trae `cover_title`/`study_title`, prevalece sobre el nombre del
  # `.pulso` sin tocar el proyecto en disco. Vacio = comportamiento actual.
  acnur_cover_title <- .graficos_scalar_chr(
    raw_cfg$cover_title %||% raw_cfg$coverTitle %||%
      raw_cfg$study_title %||% raw_cfg$studyTitle %||%
      cfg$cover_title %||% cfg$coverTitle %||%
      cfg$study_title %||% cfg$studyTitle,
    ""
  )
  acnur_mode <- .graficos_acnur_mode(raw_cfg, cfg, include_value = include_value, comparison_value = comparison_value)
  acnur_index_int <- function(value, fallback) {
    out <- suppressWarnings(as.integer(value)[1])
    if (!is.finite(out) || is.na(out) || out < 1L) fallback else out
  }
  acnur_index_single_limit <- acnur_index_int(
    raw_cfg$acnur_index_single_limit %||% raw_cfg$acnurIndexSingleLimit %||%
      cfg$acnur_index_single_limit %||% cfg$acnurIndexSingleLimit,
    8L
  )
  acnur_index_per_slide <- acnur_index_int(
    raw_cfg$acnur_index_per_slide %||% raw_cfg$acnurIndexPerSlide %||%
      cfg$acnur_index_per_slide %||% cfg$acnurIndexPerSlide,
    8L
  )
  acnur_categories_per_slide <- acnur_index_int(
    raw_cfg$acnur_categories_per_slide %||% raw_cfg$acnurCategoriesPerSlide %||%
      cfg$acnur_categories_per_slide %||% cfg$acnurCategoriesPerSlide,
    8L
  )
  if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
    if (identical(acnur_mode, "territorial")) {
      if (!include_explicit) include_coverage_maps <- isTRUE(coverage_caps$has_coverage_maps)
      if (!comparison_mode %in% c("paired_district", "koica_group", "district", "none")) {
        comparison_mode <- "paired_district"
      }
      if (!comparison_explicit || !nzchar(comparison_mode)) comparison_mode <- "paired_district"
    } else {
      include_coverage_maps <- FALSE
      comparison_mode <- "none"
    }
  }
  requested_coverage_maps <- isTRUE(include_coverage_maps)
  if (!isTRUE(coverage_caps$has_coverage_maps)) include_coverage_maps <- FALSE
  if (!nzchar(comparison_mode)) comparison_mode <- "none"
  coverage <- .graficos_plan_coverage(sid, plan = list(slides = list()), config = cfg)
  all_coverage <- .graficos_plan_coverage(sid, plan = list(slides = list()), config = cfg, scoped = FALSE)
  use_multisource_report <- .graficos_should_use_multisource_report(
    sid,
    all_coverage,
    raw_cfg = raw_cfg,
    cfg = cfg,
    profile_id = profile_id
  )
  coverage_for_plan <- if (isTRUE(use_multisource_report)) all_coverage else coverage
  warnings <- coverage$warnings %||% list()
  if (isTRUE(use_multisource_report)) {
    warnings <- c(warnings, all_coverage$warnings %||% list())
  }
  if (requested_coverage_maps && !isTRUE(coverage_caps$has_coverage_maps)) {
    warnings <- c(
      warnings,
      coverage_caps$disabled_reason %||%
        "Mapas de cobertura omitidos: disponibles cuando el proyecto tenga Hojas de Ruta y Monitoreo territorial."
    )
  }
  slides <- if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
    .graficos_acnur_intro_slides(
      sid,
      include_coverage_maps = include_coverage_maps,
      acnur_mode = acnur_mode,
      coverage = coverage_for_plan,
      index_single_limit = acnur_index_single_limit,
      index_per_slide = acnur_index_per_slide,
      include_district_maps = include_district_maps,
      cover_title = acnur_cover_title
    )
  } else {
    list()
  }
  multisource_pack <- if (isTRUE(use_multisource_report)) {
    .graficos_multisource_comparison_slides(all_coverage)
  } else {
    list(slides = list(), refs = character(0))
  }
  slides <- c(slides, multisource_pack$slides %||% list())
  comparison_refs <- multisource_pack$refs %||% character(0)
  acnur_profile_source <- ""
  acnur_profile_sex <- ""
  if (identical(profile_id, "acnur_kobo_cruncher_plus") && identical(acnur_mode, "territorial") &&
      exists(".graficos_acnur_report_context", mode = "function") &&
      exists(".graficos_acnur_profile_variable", mode = "function")) {
    profile_context <- .graficos_acnur_report_context(sid, coverage_for_plan)
    profile_age <- .graficos_acnur_profile_variable(profile_context, "age")
    profile_sex <- .graficos_acnur_profile_variable(profile_context, "sex")
    if (nzchar(profile_age) && nzchar(profile_sex)) {
      acnur_profile_source <- .graficos_scalar_chr((profile_context$main %||% list())$name, "")
      acnur_profile_sex <- profile_sex
    }
  }

  for (src in coverage_for_plan$sources %||% list()) {
    source <- .graficos_scalar_chr(src$name, "default")
    vars <- src$variables %||% list()
    vars <- Filter(function(v) {
      isTRUE(v$graphable) &&
        isTRUE(v$is_preferred) &&
        !identical(v$suggest_as_primary, FALSE) &&
        !identical(v$status, "excluida_intencionalmente") &&
        isTRUE(v$data_available) &&
        !(identical(source, acnur_profile_source) &&
            identical(.graficos_scalar_chr(v$name, ""), acnur_profile_sex)) &&
        !.graficos_is_var_ref_in(comparison_refs, source, .graficos_scalar_chr(v$name, ""))
    }, vars)
    if (!length(vars)) next

    section_key <- vapply(vars, function(v) {
      if (isTRUE(v$section_reliable)) {
        path <- .graficos_scalar_chr(v$group_path %||% v$seccion, "")
        if (nzchar(path)) return(path)
      }
      "Variables sugeridas"
    }, character(1))
    section_levels <- unique(section_key)

    for (section in section_levels) {
      section_vars <- vars[section_key == section]
      if (!length(section_vars)) next
      if (!identical(section, "Variables sugeridas")) {
        slides <- .graficos_add_section_slide(slides, section)
      }

      used <- rep(FALSE, length(section_vars))
      names(used) <- vapply(section_vars, function(v) .graficos_scalar_chr(v$name), character(1))

      # Baterias ordinales con misma escala: usar multi-apiladas en bloques.
      # En ACNUR se prefiere una lamina por variable con barras agrupadas.
      if (!identical(profile_id, "acnur_kobo_cruncher_plus")) {
        sigs <- unique(vapply(section_vars, function(v) .graficos_scalar_chr(v$scale_signature, ""), character(1)))
        for (sig in sigs[nzchar(sigs)]) {
          idx <- which(vapply(section_vars, function(v) identical(.graficos_scalar_chr(v$scale_signature, ""), sig) && .graficos_is_ordinal_signature(v), logical(1)))
          idx <- idx[!used[idx]]
          if (length(idx) < 3L) next
          chunks <- split(idx, ceiling(seq_along(idx) / 4))
          for (chunk in chunks) {
            chunk_vars <- section_vars[chunk]
            refs <- vapply(chunk_vars, function(v) {
              ref <- .graficos_scalar_chr(v$name)
              if (!identical(source, "default")) paste0(source, "$", ref) else ref
            }, character(1))
            labels <- vapply(chunk_vars, function(v) .graficos_scalar_chr(v$label, v$name), character(1))
            choices_n <- .graficos_var_choice_n(chunk_vars[[1]])
            slides[[length(slides) + 1L]] <- list(
              id = .graficos_plan_slide_id("auto"),
              tipo = "p_slide_1_grafico_narrativo",
              payload = list(
                titulo = section,
                texto = "",
                grafico = list(
                  graficador = "p_barras_multiapiladas",
                  args = list(
                    modo = "var",
                    vars = as.list(refs),
                    titulo = labels[[1]],
                    top2box = choices_n %in% c(4L, 5L),
                    wrap_y = 60
                  )
                ),
                base = .graficos_scalar_chr(src$base_label, ""),
                pie = "",
                etiqueta = ""
              )
            )
            used[chunk] <- TRUE
          }
        }
      }

      simple <- list()
      comparison_ref <- .graficos_comparison_ref(source, comparison_mode)
      for (idx in which(!used)) {
        v <- section_vars[[idx]]
        ref <- .graficos_scalar_chr(v$name)
        if (!identical(source, "default")) ref <- paste0(source, "$", ref)
        semantics <- if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
          .graficos_acnur_question_semantics(sid, source, v)
        } else {
          list(
            note = .graficos_scalar_chr(src$base_label, ""),
            exclude_options = NULL,
            source_note = ""
          )
        }
        pairwise <- identical(comparison_mode, "paired_district") &&
          identical(profile_id, "acnur_kobo_cruncher_plus") &&
          !.graficos_acnur_pairwise_exempt(v)
        pair_specs <- if (isTRUE(pairwise)) .graficos_acnur_pair_specs(source) else list(NULL)
        choice_pages <- if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
          .graficos_acnur_choice_pages(v, max_per_slide = acnur_categories_per_slide)
        } else {
          list(list(exclude_options = NULL, page = 1L, pages = 1L))
        }
        for (pair_spec in pair_specs) {
          pair_subtitle <- if (is.null(pair_spec)) "" else pair_spec$subtitle
          for (page_spec in choice_pages) {
            page_exclusions <- .graficos_collect_strings(page_spec$exclude_options %||% NULL)
            simple[[length(simple) + 1L]] <- list(
              title = .graficos_scalar_chr(v$label, ref),
              source_note = .graficos_scalar_chr(semantics$source_note, ""),
              pair_id = if (is.null(pair_spec)) "" else pair_spec$id,
              category_page = page_spec$page %||% 1L,
              category_pages = page_spec$pages %||% 1L,
              graf = .graficos_chart_for_var(
                v,
                ref,
                profile_id = profile_id,
                comparison_ref = if (is.null(pair_spec)) {
                  if (identical(comparison_mode, "paired_district")) "" else comparison_ref
                } else pair_spec$comparison_ref,
                base_label = if (is.null(pair_spec)) .graficos_scalar_chr(semantics$note, "") else "",
                exclude_options = unique(c(semantics$exclude_options, page_exclusions)),
                filtros = if (is.null(pair_spec)) list() else pair_spec$filters,
                subtitulo = .graficos_acnur_page_subtitle(pair_subtitle, page_spec),
                comparison_colors = if (is.null(pair_spec)) NULL else pair_spec$colors,
                base_unit = if (is.null(pair_spec)) "" else "personas"
              )
            )
          }
        }
      }
      slides <- c(
        slides,
        if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
          .graficos_pack_acnur_graphs(
            simple,
            section_title = if (identical(section, "Variables sugeridas")) "" else section,
            base_label = .graficos_scalar_chr(src$base_label, "")
          )
        } else {
          .graficos_pack_simple_graphs(
            simple,
            section_title = if (identical(section, "Variables sugeridas")) "" else section,
            base_label = .graficos_scalar_chr(src$base_label, "")
          )
        }
      )
    }
  }

  delivery <- .graficos_delivery_options(
    cfg,
    profile_id = profile_id,
    template_id = if (identical(profile_id, "acnur_kobo_cruncher_plus")) "acnur_16_9" else NULL,
    auto_otros_slides = if (identical(profile_id, "acnur_kobo_cruncher_plus")) FALSE else NULL
  )
  plan <- list(
    slides = slides,
    template_id = delivery$template_id,
    auto_otros_slides = delivery$auto_otros_slides
  )
  next_coverage <- .graficos_plan_coverage(
    sid,
    plan = plan,
    config = cfg,
    scoped = !isTRUE(use_multisource_report)
  )
  report_inputs <- NULL
  if (identical(profile_id, "acnur_kobo_cruncher_plus") &&
      exists(".graficos_acnur_report_inputs", mode = "function")) {
    report_inputs <- .graficos_acnur_report_inputs(
      sid,
      coverage_for_plan,
      acnur_mode = acnur_mode,
      map_included = include_coverage_maps,
      comparison_mode = comparison_mode
    )
  }
  response <- list(
    ok = TRUE,
    plan = plan,
    profile_id = profile_id,
    acnur_mode = if (identical(profile_id, "acnur_kobo_cruncher_plus")) acnur_mode else "",
    report_scope = "single_study",
    template_id = delivery$template_id,
    auto_otros_slides = delivery$auto_otros_slides,
    generation_audit = .graficos_generation_audit(plan, next_coverage),
    coverage = next_coverage,
    warnings = as.list(unique(c(
      unlist(warnings, use.names = FALSE),
      if (!length(slides)) "No se encontraron variables graficables con datos para sugerir un plan." else character(0)
    )))
  )
  if (!is.null(report_inputs)) response$report_inputs <- report_inputs
  response
}
