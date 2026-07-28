# Helpers de `mount_monitoreo` — exportación y normalización de UMP.
#
# Extraídos de `router_monitoreo.R`, que está congelado a crecimiento
# (`agentic/manifest.json` → `policy.frozen_growth_files`). Mismo paquete y
# mismo namespace: el traslado no cambia comportamiento, solo reparte el
# archivo. La lógica de dominio nueva va al engine, no aquí.

.monitoreo_ump_estado_label <- function(estado) {
  switch(as.character(estado %||% ""),
    sin_reporte = "Sin reporte",
    iniciada_sin_reporte = "Iniciada sin reporte",
    incompleta_sin_reporte = "Incompleta sin reporte",
    completa_sin_reporte = "Completa sin reporte",
    revisar_cruce = "Revisar cruce",
    reportada_no_efectiva = "Reportada (no efectiva)",
    reportada_efectiva = "Reportada (efectiva)",
    .monitoreo_scalar(estado, "")
  )
}
.monitoreo_ump_norm_key <- function(v) {
  o <- trimws(gsub("^UMP\\s*", "", toupper(as.character(v)), perl = TRUE))
  o <- sub("^R\\s*(?=[0-9])", "", o, perl = TRUE)
  o <- sub("\\.0+$", "", o, perl = TRUE)
  sub("^0+([0-9]+)$", "\\1", o, perl = TRUE)
}

# Mapa UMP -> responsable derivado del AVANCE (código pulso + roster). Sirve para
# rellenar el responsable de UMP faltantes (sin reporte de ocurrencia): el equipo
# igual hizo el avance ahí, así que su código pulso identifica al responsable.
.monitoreo_ump_avance_responsable_map <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  tcfg <- cfg$territorial %||% list()
  pick_col <- function(primary, aliases) {
    primary <- .monitoreo_scalar(primary, "")
    if (nzchar(primary) && primary %in% names(data)) return(primary)
    hit <- intersect(aliases, names(data))
    if (length(hit)) hit[[1]] else ""
  }
  code_col <- pick_col(tcfg$pulso_code_var, c("closing_group/code_pulso", "code_pulso", "codigo_pulso", "cod_pulso"))
  ump_col <- pick_col(tcfg$ump_var, c("closing_group/UMP", "UMP", "ump"))
  if (!nzchar(code_col) || !nzchar(ump_col)) return(list())
  roster <- .monitoreo_territorial_normalize_enumerator_roster(tcfg$enumerator_roster %||% list())
  code_lookup <- new.env(parent = emptyenv())
  for (a in (roster$assignments %||% list())) {
    cd <- .monitoreo_territorial_clean_code(a$codigo_pulso, roster$code_format)
    nm <- .monitoreo_scalar(a$nombre, "")
    if (nzchar(cd) && nzchar(nm)) assign(cd, nm, envir = code_lookup)
  }
  codes <- as.character(data[[code_col]])
  umps <- .monitoreo_ump_norm_key(data[[ump_col]])
  # Nombre del encuestador SOLO si el código pulso está reconocido en el roster.
  names_resolved <- vapply(codes, function(code) {
    k <- .monitoreo_territorial_clean_code(code, roster$code_format)
    if (nzchar(k) && exists(k, envir = code_lookup, inherits = FALSE)) get(k, envir = code_lookup, inherits = FALSE) else ""
  }, character(1))
  raw_codes <- trimws(codes)
  out <- list()
  for (u in unique(umps[nzchar(umps)])) {
    idx <- which(umps == u)
    # Preferir el encuestador RECONOCIDO (código en el roster) sobre un código
    # no registrado (ej. "1091"): el responsable real es el encuestador del roster.
    res <- names_resolved[idx]
    res <- res[nzchar(res)]
    if (length(res)) {
      tb <- sort(table(res), decreasing = TRUE)
      out[[u]] <- names(tb)[1]
    } else {
      rc <- raw_codes[idx]
      rc <- rc[nzchar(rc)]
      if (length(rc)) {
        tb <- sort(table(rc), decreasing = TRUE)
        out[[u]] <- names(tb)[1]
      }
    }
  }
  out
}
.monitoreo_ump_export_rows <- function(by_ump, only_missing = FALSE, responsable = "", distrito = "", resp_map = list()) {
  if (is.null(by_ump) || !length(by_ump)) return(data.frame())
  responsable <- trimws(.monitoreo_scalar(responsable, ""))
  distrito <- trimws(.monitoreo_scalar(distrito, ""))
  resolve_resp <- function(it) {
    r <- trimws(.monitoreo_scalar(it$responsable, ""))
    if (nzchar(r) && !identical(r, "Sin responsable")) return(r)
    u <- .monitoreo_ump_norm_key(.monitoreo_scalar(it$ump, .monitoreo_scalar(it$key, "")))
    cand <- .monitoreo_scalar(resp_map[[u]], "")
    if (nzchar(cand)) cand else "Sin responsable"
  }
  keep <- Filter(function(it) {
    # Solo las UMP DETERMINADAS (universo de ruta, las 150). Excluye reemplazos y
    # UMP fuera de ruta (una UMP cubierta por su reemplazo aparece en su slot titular).
    if (isTRUE(it$outside)) return(FALSE)
    if (identical(.monitoreo_scalar(it$route_match_status, ""), "ump_no_esperada")) return(FALSE)
    tiene <- isTRUE(it$has_report)
    if (isTRUE(only_missing) && tiene) return(FALSE)
    if (nzchar(responsable) && !identical(resolve_resp(it), responsable)) return(FALSE)
    if (nzchar(distrito) && !identical(trimws(tolower(.monitoreo_scalar(it$distrito, ""))), tolower(distrito))) return(FALSE)
    TRUE
  }, by_ump)
  if (!length(keep)) return(data.frame())
  df <- do.call(rbind, lapply(keep, function(it) {
    tiene <- isTRUE(it$has_report)
    data.frame(
      Distrito = .monitoreo_scalar(it$distrito, ""),
      UMP = .monitoreo_scalar(it$ump, .monitoreo_scalar(it$key, "")),
      Responsable = resolve_resp(it),
      `¿Tiene ocurrencias?` = if (tiene) "Sí" else "No",
      Fecha = if (tiene) .monitoreo_scalar(it$ultimo_reporte, "") else "",
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  }))
  # Ordenar por número de UMP ascendente (1 -> 150); no numéricas al final.
  ump_num <- suppressWarnings(as.numeric(.monitoreo_ump_norm_key(df$UMP)))
  df[order(is.na(ump_num), ump_num), , drop = FALSE]
}
.monitoreo_ump_export_write_workbook <- function(ump_df, path, meta = list()) {
  wb <- openxlsx::createWorkbook()
  sheet <- "UMP"
  openxlsx::addWorksheet(wb, sheet)
  title_style <- openxlsx::createStyle(fontSize = 14, textDecoration = "bold", fontColour = "#17212F")
  meta_style <- openxlsx::createStyle(fontSize = 9, fontColour = "#5F6B7A")
  header_style <- openxlsx::createStyle(
    textDecoration = "bold", fgFill = "#BE123C", fontColour = "#FFFFFF",
    border = "TopBottomLeftRight", borderColour = "#E2E7F0",
    halign = "left", valign = "center", wrapText = TRUE
  )
  yes_style <- openxlsx::createStyle(fgFill = "#DCFCE7", fontColour = "#166534", textDecoration = "bold", halign = "center")
  no_style <- openxlsx::createStyle(fgFill = "#FEE2E2", fontColour = "#991B1B", textDecoration = "bold", halign = "center")

  openxlsx::writeData(wb, sheet, "UMP determinadas y su estado de ocurrencias", startRow = 1, startCol = 1)
  openxlsx::addStyle(wb, sheet, title_style, rows = 1, cols = 1, stack = TRUE)
  if (length(meta)) {
    meta_txt <- paste(vapply(names(meta), function(k) sprintf("%s: %s", k, meta[[k]]), character(1)), collapse = "   ·   ")
    openxlsx::writeData(wb, sheet, meta_txt, startRow = 2, startCol = 1)
    openxlsx::addStyle(wb, sheet, meta_style, rows = 2, cols = 1, stack = TRUE)
  }
  header_row <- 4L
  if (!nrow(ump_df)) {
    openxlsx::writeData(wb, sheet, "Sin UMP para los filtros seleccionados.", startRow = header_row, startCol = 1)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
    return(invisible(path))
  }
  n_cols <- ncol(ump_df)
  openxlsx::writeData(wb, sheet, ump_df, startRow = header_row, startCol = 1, headerStyle = header_style)
  openxlsx::freezePane(wb, sheet, firstActiveRow = header_row + 1L)
  # Autofiltro en los encabezados de la tabla.
  openxlsx::addFilter(wb, sheet, rows = header_row, cols = seq_len(n_cols))
  openxlsx::setColWidths(wb, sheet, cols = seq_len(n_cols), widths = c(22, 16, 34, 20, 22)[seq_len(n_cols)])
  # Color condicional en "¿Tiene ocurrencias?": verde = tiene, rojo = no.
  oc_col <- which(names(ump_df) == "¿Tiene ocurrencias?")
  if (length(oc_col)) {
    yes_rows <- which(ump_df[[oc_col]] == "Sí")
    no_rows <- which(ump_df[[oc_col]] == "No")
    if (length(yes_rows)) openxlsx::addStyle(wb, sheet, yes_style, rows = header_row + yes_rows, cols = oc_col, gridExpand = TRUE, stack = TRUE)
    if (length(no_rows)) openxlsx::addStyle(wb, sheet, no_style, rows = header_row + no_rows, cols = oc_col, gridExpand = TRUE, stack = TRUE)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}
.monitoreo_ump_export <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  s <- session_get(sid)
  main_data <- (s$monitoreo_snapshot %||% list())$data %||% data.frame()
  cfg <- monitoreo_normalize_config(parsed$config %||% s$monitoreo_config %||% list(), main_data)
  family <- .monitoreo_scalar(cfg$monitoreo_profile$family, "")
  if (!identical(family, "territorial")) {
    stop_api(400, "E_MONITOREO_UMP_EXPORT_FAMILY", "El export de UMPs esta disponible para Monitoreo territorial.")
  }
  report <- .monitoreo_territorial_occurrences_dashboard(sid, cfg)
  by_ump <- report$by_ump %||% list()
  if (!length(by_ump)) {
    stop_api(409, "E_MONITOREO_UMP_EXPORT_EMPTY", "No hay UMPs para exportar. Sincroniza las ocurrencias de campo primero.")
  }
  only_missing <- isTRUE(parsed$only_missing %||% parsed$onlyMissing %||% parsed$faltantes)
  responsable <- .monitoreo_scalar(parsed$responsable, "")
  distrito <- .monitoreo_scalar(parsed$distrito, "")
  resp_map <- .monitoreo_ump_avance_responsable_map(main_data, cfg)
  ump_df <- .monitoreo_ump_export_rows(by_ump, only_missing = only_missing, responsable = responsable, distrito = distrito, resp_map = resp_map)

  dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
  project <- .monitoreo_publication_project_label(parsed, s, cfg)
  project_slug <- .monitoreo_publication_evidence_slug(project, "monitoreo")
  suffix <- if (only_missing) "faltantes" else if (nzchar(responsable)) "responsable" else "determinadas"
  out_name <- paste0(paste(project_slug, "umps", suffix, sep = "-"), ".xlsx")
  out_path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
  sin_oc <- if (nrow(ump_df)) sum(ump_df[["¿Tiene ocurrencias?"]] == "No") else 0L
  meta <- list(
    Universo = if (only_missing) "Solo faltantes (sin ocurrencias)" else "UMP determinadas",
    Responsable = if (nzchar(responsable)) responsable else "Todos",
    UMP = nrow(ump_df),
    Corte = .monitoreo_scalar((report$snapshot %||% list())$synced_at, "")
  )
  .monitoreo_ump_export_write_workbook(ump_df, out_path, meta = meta)
  file_meta <- .register_output_file(sid, "monitoreo_ump_export", out_path, original_name = out_name)
  list(
    ok = TRUE,
    file_id = file_meta$file_id,
    filename = file_meta$original_name,
    size = file_meta$size,
    counts = list(
      ump = as.integer(nrow(ump_df)),
      sin_ocurrencias = as.integer(sin_oc)
    ),
    filters = list(only_missing = only_missing, responsable = responsable, distrito = distrito)
  )
}
