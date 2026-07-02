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
    return(0L)
  }
  x <- data[[var]]
  sum(!.graficos_is_blank_cell(x))
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
  if (startsWith(kind, "kobo")) return("kobo")
  if (kind %in% c("manual", "xlsform", "existing_project", "uploaded", "local")) return("xlsform")
  kind
}

.graficos_acnur_koica_districts <- function() {
  list(
    list(ubigeo = "150132", distrito = "San Juan de Lurigancho", short = "SJL", group = "intervencion"),
    list(ubigeo = "150135", distrito = "San Martin de Porres", short = "SMP", group = "intervencion"),
    list(ubigeo = "150108", distrito = "Chorrillos", short = "Chorrillos", group = "intervencion"),
    list(ubigeo = "150103", distrito = "Ate", short = "Ate", group = "comparacion"),
    list(ubigeo = "150133", distrito = "San Juan de Miraflores", short = "SJM", group = "comparacion"),
    list(ubigeo = "150117", distrito = "Los Olivos", short = "Los Olivos", group = "comparacion")
  )
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

.graficos_zone_sets <- function(reports) {
  audit <- .graficos_records_df(reports$response_audit %||% reports$map$points %||% list())
  routes <- .graficos_records_df(
    reports$route_blocks %||% reports$map$blocks %||% reports$block_progress %||% reports$advance$block_progress %||% list()
  )
  zone_key <- function(df, ubigeo_cols, zone_cols, effective_only = FALSE) {
    if (!nrow(df)) return(character(0))
    ucol <- .graficos_first_col(df, ubigeo_cols)
    zcol <- .graficos_first_col(df, zone_cols)
    if (!nzchar(ucol) || !nzchar(zcol)) return(character(0))
    keep <- rep(TRUE, nrow(df))
    if (isTRUE(effective_only)) {
      av_col <- .graficos_first_col(df, c("advance_valid", "source_effective"))
      st_col <- .graficos_first_col(df, c("validation_status", "advance_status", "Estado"))
      if (nzchar(av_col)) {
        keep <- keep & tolower(as.character(df[[av_col]])) %in% c("true", "1", "validada", "si", "yes")
      }
      if (nzchar(st_col)) {
        keep <- keep & tolower(as.character(df[[st_col]])) %in% c("validada", "validado")
      }
    }
    ub <- .graficos_ubigeo6(df[[ucol]])
    zn <- trimws(as.character(df[[zcol]]))
    unique(paste(ub[keep], zn[keep], sep = "::"))
  }
  list(
    effective = zone_key(
      audit,
      ubigeo_cols = c("advance_block_ubigeo", "ubigeo", "district_code"),
      zone_cols = c("advance_block_zona", "zona", "zone"),
      effective_only = TRUE
    ),
    route = zone_key(
      routes,
      ubigeo_cols = c("advance_block_ubigeo", "ubigeo", "district_code"),
      zone_cols = c("advance_block_zona", "zona", "zone"),
      effective_only = FALSE
    )
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
      if (is_route) route_n <- route_n + 1L
      if (is_effective) effective_n <- effective_n + 1L
      status <- if (is_effective) {
        "efectiva"
      } else if (is_route) {
        "intervencion"
      } else if (identical(scope, "overview_koica") && identical(district$group, "comparacion")) {
        "comparacion"
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
    "Overview territorial KOICA"
  } else {
    paste("Cobertura efectiva -", selected[[1]]$distrito)
  }
  list(
    scope = scope,
    ubigeo = if (identical(scope, "district")) selected[[1]]$ubigeo else "",
    distrito = if (identical(scope, "district")) selected[[1]]$distrito else "",
    titulo = title,
    subtitle = "Zonas sombreadas segun ruta e informacion validada",
    caption = "Fuente: Hojas de Ruta y Monitoreo territorial Prosecnur.",
    zones = zones,
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
      group = d$group,
      kobo_code = "",
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  s <- session_get(sid, required = FALSE)
  cfg <- (s$monitoreo_config %||% list())$territorial %||% list()
  cw <- cfg$district_crosswalk %||% cfg$districtCrosswalk %||% list()
  cw_df <- .graficos_records_df(cw)
  if (nrow(cw_df) && all(c("ubigeo", "kobo_code") %in% names(cw_df))) {
    for (i in seq_len(nrow(out))) {
      hit <- which(.graficos_ubigeo6(cw_df$ubigeo) == out$ubigeo)[1]
      if (!is.na(hit)) out$kobo_code[[i]] <- .graficos_norm_text_key(cw_df$kobo_code[[hit]])
    }
  }
  out
}

.graficos_detect_district_values <- function(df, sid) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(list(ubigeo = rep("", 0L), distrito = rep("", 0L), group = rep("", 0L)))
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
  group <- ifelse(!is.na(match_idx) & cw$group[match_idx] == "intervencion", "Intervencion KOICA",
                  ifelse(!is.na(match_idx) & cw$group[match_idx] == "comparacion", "Comparacion KOICA", "Otros distritos"))
  list(ubigeo = ub, distrito = distrito, group = group)
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
    if (!"__koica_group" %in% names(df)) df$`__koica_group` <- detected$group
    if (!"__district" %in% names(df)) df$`__district` <- detected$distrito
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
    add_survey("__koica_group", "Grupo KOICA", "__koica_group_list")
    add_survey("__district", "Distrito", "__district_list")
    add_choices("__koica_group_list", c("Intervencion KOICA", "Comparacion KOICA", "Otros distritos"))
    add_choices("__district_list", unique(as.character(detected$distrito)))
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
    n_non_empty <- .graficos_var_non_empty_n(data, nm)
    vs[[length(vs) + 1L]] <- list(
      name = nm,
      label = as.character(label[i] %||% nm),
      tipo = tb,
      seccion = section,
      list_name = list_name,
      choices = choice_meta$items,
      scale_signature = choice_meta$signature,
      data_available = n_non_empty > 0L,
      n_non_empty = n_non_empty,
      source_kind = .graficos_simplify_source_kind(source_kind),
      group_path = group_path,
      section_reliable = .graficos_section_is_reliable(group_path %||% section, source_kind)
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
      countable <- isTRUE(v$graphable) && isTRUE(v$is_preferred) && status != "excluida_intencionalmente"
      c(v, list(status = status, coverage_countable = countable))
    })
    list(
      name = source_name,
      source_kind = .graficos_scalar_chr(src$source_kind, "unknown"),
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

.graficos_is_ordinal_signature <- function(v) {
  n <- .graficos_var_choice_n(v)
  isTRUE(v$graphable) &&
    identical(.graficos_base_type(v$tipo), "select_one") &&
    nzchar(.graficos_scalar_chr(v$scale_signature, "")) &&
    n >= 3L && n <= 7L
}

.graficos_chart_for_var <- function(v, ref, profile_id = "", comparison_ref = NULL) {
  n_choices <- .graficos_var_choice_n(v)
  label <- .graficos_scalar_chr(v$label, ref)
  tipo <- .graficos_base_type(v$tipo)
  acnur_profile <- identical(.graficos_scalar_chr(profile_id, ""), "acnur_kobo_cruncher_plus")
  comparison_ref <- .graficos_scalar_chr(comparison_ref, "")
  add_comparison <- function(args) {
    if (nzchar(comparison_ref)) args$cruces <- comparison_ref
    args
  }
  if (isTRUE(acnur_profile)) {
    return(list(
      graficador = "p_barras_agrupadas",
      args = add_comparison(list(var = ref, titulo = label, mostrar_ceros = FALSE))
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

.graficos_pack_simple_graphs <- function(graphs, section_title = "") {
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
          base = "",
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
          base = "",
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
  if (identical(mode, "district")) return(.graficos_ref_for_source(source, "__district"))
  ""
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
    estudio$project_kind,
    estudio$profile_family,
    (estudio$independent_siblings %||% list())$project_kind,
    (estudio$independent_siblings %||% list())$profile_family,
    base_values
  ))
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

.graficos_acnur_intro_slides <- function(sid, include_coverage_maps = FALSE, acnur_mode = "general") {
  territorial_mode <- identical(.graficos_scalar_chr(acnur_mode, "general"), "territorial")
  slides <- list(
    list(
      id = .graficos_plan_slide_id("acnur"),
      tipo = "p_slide_portada",
      payload = list(
        titulo = if (territorial_mode) "ACNUR KOICA" else "ACNUR",
        subtitulo = if (territorial_mode) "Resultados Kobo + cobertura territorial" else "Resultados Kobo",
        fecha = format(Sys.Date(), "%Y"),
        subtexto = "Plantilla Prosecnur original inspirada en estructura Kobo-style"
      )
    ),
    list(
      id = .graficos_plan_slide_id("acnur"),
      tipo = "p_slide_texto",
      payload = list(
        titulo = "Ficha tecnica",
        texto = c(
          "Fuente: KoboToolbox UNHCR.",
          "Instrumento: XLSForm + submissions normalizadas.",
          "Procesamiento: Motor Prosecnur.",
          if (territorial_mode) {
            "Cobertura: Hojas de Ruta + Monitoreo territorial."
          } else {
            "Visualizacion: resultados en barras agrupadas ACNUR."
          }
        ),
        bullets = "",
        base = ""
      )
    )
  )
  if (territorial_mode) {
    slides[[length(slides) + 1L]] <- list(
      id = .graficos_plan_slide_id("acnur"),
      tipo = "p_slide_texto",
      payload = list(
        titulo = "Diseno de intervencion y comparacion",
        texto = c(
          "Intervencion KOICA: San Juan de Lurigancho, San Martin de Porres y Chorrillos.",
          "Comparacion KOICA: Ate, San Juan de Miraflores y Los Olivos."
        ),
        bullets = "",
        base = ""
      )
    )
  }
  if (isTRUE(territorial_mode) && isTRUE(include_coverage_maps)) {
    overview_context <- .graficos_coverage_map_context(sid, scope = "overview_koica")
    slides[[length(slides) + 1L]] <- list(
      id = .graficos_plan_slide_id("map"),
      tipo = "p_slide_1_grafico_narrativo",
      payload = list(
        titulo = "Overview territorial KOICA",
        texto = "",
        grafico = list(
          graficador = "p_mapa_cobertura_territorial",
          args = list(scope = "overview_koica", titulo = "Overview territorial KOICA", contexto = overview_context)
        ),
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
    for (district in .graficos_acnur_koica_districts()) {
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
  slides[[length(slides) + 1L]] <- list(id = .graficos_plan_slide_id("idx"), tipo = "p_slide_indice", payload = list())
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
  if (isTRUE(include_value) || comparison_mode %in% c("koica_group", "district")) {
    return("territorial")
  }
  "general"
}

.graficos_pack_acnur_graphs <- function(graphs, section_title = "") {
  lapply(graphs, function(item) {
    list(
      id = .graficos_plan_slide_id("auto"),
      tipo = "p_slide_1_grafico_narrativo",
      payload = list(
        titulo = item$title,
        texto = "",
        grafico = item$graf,
        base = "",
        pie = "",
        etiqueta = ""
      )
    )
  })
}

.graficos_suggested_plan <- function(sid, config = NULL) {
  raw_cfg <- config %||% list()
  cfg <- .graficos_effective_config(sid, config)
  profile_id <- .graficos_scalar_chr(raw_cfg$profile_id %||% raw_cfg$profileId %||% cfg$profile_id, "")
  include_value <- raw_cfg$include_coverage_maps %||% raw_cfg$includeCoverageMaps %||% cfg$include_coverage_maps
  comparison_value <- raw_cfg$comparison_mode %||% raw_cfg$comparisonMode %||% cfg$comparison_mode
  include_explicit <- !is.null(raw_cfg$include_coverage_maps) ||
    !is.null(raw_cfg$includeCoverageMaps) ||
    !is.null(cfg$include_coverage_maps)
  comparison_explicit <- !is.null(raw_cfg$comparison_mode) ||
    !is.null(raw_cfg$comparisonMode) ||
    !is.null(cfg$comparison_mode)
  coverage_caps <- .graficos_territorial_coverage_capabilities(sid)
  include_coverage_maps <- isTRUE(include_value)
  comparison_mode <- .graficos_scalar_chr(comparison_value, "")
  acnur_mode <- .graficos_acnur_mode(raw_cfg, cfg, include_value = include_value, comparison_value = comparison_value)
  if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
    if (identical(acnur_mode, "territorial")) {
      if (!include_explicit) include_coverage_maps <- isTRUE(coverage_caps$has_coverage_maps)
      if (!comparison_mode %in% c("koica_group", "district", "none")) comparison_mode <- "koica_group"
      if (!comparison_explicit || !nzchar(comparison_mode)) comparison_mode <- "koica_group"
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
      acnur_mode = acnur_mode
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

  for (src in coverage_for_plan$sources %||% list()) {
    source <- .graficos_scalar_chr(src$name, "default")
    vars <- src$variables %||% list()
    vars <- Filter(function(v) {
      isTRUE(v$graphable) &&
        isTRUE(v$is_preferred) &&
        !identical(v$status, "excluida_intencionalmente") &&
        isTRUE(v$data_available) &&
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
                base = "",
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
        simple[[length(simple) + 1L]] <- list(
          title = .graficos_scalar_chr(v$label, ref),
          graf = .graficos_chart_for_var(v, ref, profile_id = profile_id, comparison_ref = comparison_ref)
        )
      }
      slides <- c(
        slides,
        if (identical(profile_id, "acnur_kobo_cruncher_plus")) {
          .graficos_pack_acnur_graphs(simple, section_title = if (identical(section, "Variables sugeridas")) "" else section)
        } else {
          .graficos_pack_simple_graphs(simple, section_title = if (identical(section, "Variables sugeridas")) "" else section)
        }
      )
    }
  }

  plan <- list(slides = slides)
  next_coverage <- .graficos_plan_coverage(
    sid,
    plan = plan,
    config = cfg,
    scoped = !isTRUE(use_multisource_report)
  )
  list(
    ok = TRUE,
    plan = plan,
    coverage = next_coverage,
    warnings = as.list(unique(c(
      unlist(warnings, use.names = FALSE),
      if (!length(slides)) "No se encontraron variables graficables con datos para sugerir un plan." else character(0)
    )))
  )
}
