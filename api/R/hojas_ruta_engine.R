# Motor nativo R para Hojas de ruta para campo.

HOJAS_RUTA_COLUMNAS <- c(
  "UMP", "IDMANZANA", "ESTRATO", "VIVIENDAS", "NSE",
  "ESQUINA", "RECORRIDO", "ARRANQUE", "CONSTANTE", "IE", "FE"
)

hojas_ruta_cache_dir <- function() {
  root <- Sys.getenv("PROSECNUR_CARTOGRAFIA_CACHE", "")
  if (!nzchar(root)) {
    root <- file.path(path.expand("~"), ".prosecnurapp", "cartografia_cache")
  }
  dir.create(root, recursive = TRUE, showWarnings = FALSE)
  normalizePath(root, mustWork = FALSE)
}

#' Detectar columnas canonicas para hojas de ruta
#'
#' @param data data.frame con base limpia cargada en Prosecnur.
#' @return Lista serializable con estado de columnas e incidencias.
#' @export
hojas_ruta_detectar_campos <- function(data) {
  if (is.null(data) || !is.data.frame(data)) {
    stop("`data` debe ser un data.frame.", call. = FALSE)
  }
  cols <- names(data)
  missing <- setdiff(HOJAS_RUTA_COLUMNAS, cols)
  present <- intersect(HOJAS_RUTA_COLUMNAS, cols)

  status <- lapply(HOJAS_RUTA_COLUMNAS, function(nm) {
    list(
      nombre = nm,
      estado = if (nm %in% cols) "listo" else "faltante",
      tipo = if (nm %in% cols) paste(class(data[[nm]]), collapse = "/") else NA_character_
    )
  })

  invalid <- list()
  if ("UMP" %in% cols) {
    empty <- is.na(data$UMP) | !nzchar(trimws(as.character(data$UMP)))
    if (any(empty)) {
      invalid[[length(invalid) + 1L]] <- list(
        campo = "UMP",
        mensaje = sprintf("%d fila(s) sin UMP.", sum(empty))
      )
    }
  }
  if ("IDMANZANA" %in% cols) {
    ids <- trimws(as.character(data$IDMANZANA))
    bad <- is.na(ids) | nchar(ids) < 11L
    if (any(bad)) {
      invalid[[length(invalid) + 1L]] <- list(
        campo = "IDMANZANA",
        mensaje = sprintf("%d fila(s) con IDMANZANA demasiado corto o vacio.", sum(bad))
      )
    }
  }

  list(
    ok = length(missing) == 0L && length(invalid) == 0L,
    required = as.list(HOJAS_RUTA_COLUMNAS),
    present = as.list(present),
    missing = as.list(missing),
    columns = status,
    invalid = invalid,
    n_filas = as.integer(nrow(data)),
    n_columnas = as.integer(ncol(data))
  )
}

hojas_ruta_parse_id_manzana <- function(id_manzana) {
  x <- trimws(as.character(id_manzana %||% ""))
  list(
    ubigeo = if (nchar(x) >= 6L) substr(x, 1L, 6L) else NA_character_,
    cod_zona = if (nchar(x) >= 11L) substr(x, 7L, 11L) else NA_character_,
    cod_manzana = if (nchar(x) > 11L) substr(x, 12L, nchar(x)) else NA_character_
  )
}

hojas_ruta_map_code <- function(id_manzana) {
  p <- hojas_ruta_parse_id_manzana(id_manzana)
  if (is.na(p$ubigeo) || is.na(p$cod_zona)) return(NA_character_)
  paste0(p$ubigeo, p$cod_zona)
}

hojas_ruta_normalize_config <- function(config = list()) {
  if (is.null(config) || !is.list(config)) config <- list()
  row_var <- as.character(config$row_var %||% "")[1]
  col_var <- as.character(config$col_var %||% "")[1]
  value_var <- as.character(config$value_var %||% "")[1]
  count_mode <- as.character(config$count_mode %||% "frecuencia")[1]
  if (!count_mode %in% c("frecuencia", "suma")) count_mode <- "frecuencia"
  cartografia_dir <- as.character(config$cartografia_dir %||% hojas_ruta_cache_dir())[1]
  project_code <- as.character(config$project_code %||% "")[1]
  max_umps <- suppressWarnings(as.integer(config$max_umps %||% NA_integer_))
  list(
    row_var = row_var,
    col_var = col_var,
    value_var = value_var,
    count_mode = count_mode,
    cartografia_dir = cartografia_dir,
    project_code = project_code,
    max_umps = max_umps
  )
}

hojas_ruta_variables_disponibles <- function(data) {
  lapply(names(data), function(nm) {
    list(nombre = nm, tipo = paste(class(data[[nm]]), collapse = "/"))
  })
}

hojas_ruta_validar_config <- function(data, config) {
  cfg <- hojas_ruta_normalize_config(config)
  issues <- list()
  add_issue <- function(campo, mensaje) {
    issues[[length(issues) + 1L]] <<- list(campo = campo, mensaje = mensaje)
  }
  if (!nzchar(cfg$row_var) || !cfg$row_var %in% names(data)) {
    add_issue("row_var", "Selecciona una variable valida para las filas de cuota.")
  }
  if (!nzchar(cfg$col_var) || !cfg$col_var %in% names(data)) {
    add_issue("col_var", "Selecciona una variable valida para las columnas de cuota.")
  }
  if (identical(cfg$count_mode, "suma") &&
      (!nzchar(cfg$value_var) || !cfg$value_var %in% names(data))) {
    add_issue("value_var", "Para sumar cuotas debes seleccionar un campo numerico.")
  }
  if (identical(cfg$count_mode, "suma") && nzchar(cfg$value_var) &&
      cfg$value_var %in% names(data) && !is.numeric(data[[cfg$value_var]])) {
    add_issue("value_var", "El campo de suma debe ser numerico.")
  }
  list(ok = length(issues) == 0L, issues = issues, config = cfg)
}

hojas_ruta_quota_table <- function(df, config) {
  cfg <- hojas_ruta_normalize_config(config)
  rv <- cfg$row_var
  cv <- cfg$col_var
  if (!rv %in% names(df) || !cv %in% names(df)) return(data.frame())

  row_vals <- as.character(df[[rv]])
  col_vals <- as.character(df[[cv]])
  row_vals[is.na(row_vals) | !nzchar(row_vals)] <- "Sin dato"
  col_vals[is.na(col_vals) | !nzchar(col_vals)] <- "Sin dato"

  if (identical(cfg$count_mode, "suma") && cfg$value_var %in% names(df)) {
    values <- suppressWarnings(as.numeric(df[[cfg$value_var]]))
    values[is.na(values)] <- 0
    tmp <- stats::aggregate(values, by = list(fila = row_vals, columna = col_vals), FUN = sum)
    names(tmp)[3] <- "n"
  } else {
    tmp <- as.data.frame(table(fila = row_vals, columna = col_vals), stringsAsFactors = FALSE)
    names(tmp)[3] <- "n"
    tmp <- tmp[tmp$n > 0, , drop = FALSE]
  }
  if (!nrow(tmp)) return(data.frame())
  wide <- stats::xtabs(n ~ fila + columna, data = tmp)
  out <- as.data.frame.matrix(wide, stringsAsFactors = FALSE)
  out <- data.frame(Cuota = rownames(out), out, check.names = FALSE)
  rownames(out) <- NULL
  total_cols <- setdiff(names(out), "Cuota")
  out$TOTAL <- rowSums(out[total_cols], na.rm = TRUE)
  total_row <- data.frame(Cuota = "TOTAL", t(colSums(out[total_cols], na.rm = TRUE)),
                          TOTAL = sum(out$TOTAL, na.rm = TRUE), check.names = FALSE)
  names(total_row) <- names(out)
  rbind(out, total_row)
}

hojas_ruta_sanitize_filename <- function(x) {
  x <- gsub("[^A-Za-z0-9_-]+", "_", as.character(x %||% ""))
  x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x)
  if (!nzchar(x)) "sin_nombre" else x
}

hojas_ruta_resolver_mapa <- function(mapa_code, cartografia_dir = hojas_ruta_cache_dir()) {
  if (is.na(mapa_code) || !nzchar(mapa_code)) return(NULL)
  if (is.null(cartografia_dir) || !nzchar(cartografia_dir) || !dir.exists(cartografia_dir)) return(NULL)
  for (ext in c(".jpg", ".jpeg", ".png", ".pdf")) {
    p <- file.path(cartografia_dir, paste0(mapa_code, ext))
    if (file.exists(p)) return(normalizePath(p, mustWork = FALSE))
  }
  NULL
}

#' Previsualizar hojas de ruta
#'
#' @param data data.frame con columnas canonicas.
#' @param config configuracion del asistente de cuotas.
#' @return Lista serializable con UMPs, cuotas e incidencias.
#' @export
hojas_ruta_preview <- function(data, config = list()) {
  campos <- hojas_ruta_detectar_campos(data)
  cfg_check <- hojas_ruta_validar_config(data, config)
  cfg <- cfg_check$config

  filas <- data
  if (!is.na(cfg$max_umps) && cfg$max_umps > 0L && nrow(filas) > cfg$max_umps) {
    filas <- utils::head(filas, cfg$max_umps)
  }

  rows <- lapply(seq_len(nrow(filas)), function(i) {
    row <- filas[i, , drop = FALSE]
    parsed <- hojas_ruta_parse_id_manzana(row$IDMANZANA[[1]])
    mapa_code <- hojas_ruta_map_code(row$IDMANZANA[[1]])
    mapa_path <- hojas_ruta_resolver_mapa(mapa_code, cfg$cartografia_dir)
    quota <- if (cfg_check$ok) hojas_ruta_quota_table(row, cfg) else data.frame()
    list(
      index = as.integer(i),
      ump = as.character(row$UMP[[1]] %||% ""),
      idmanzana = as.character(row$IDMANZANA[[1]] %||% ""),
      ubigeo = parsed$ubigeo,
      cod_zona = parsed$cod_zona,
      cod_manzana = parsed$cod_manzana,
      mapa = mapa_code,
      mapa_encontrado = !is.null(mapa_path),
      mapa_path = mapa_path %||% NA_character_,
      filename = sprintf(
        "HojaRuta_%s_%s.pdf",
        hojas_ruta_sanitize_filename(row$UMP[[1]]),
        hojas_ruta_sanitize_filename(mapa_code)
      ),
      cuota = quota
    )
  })
  mapas_faltantes <- sum(!vapply(rows, function(x) isTRUE(x$mapa_encontrado), logical(1)))
  list(
    ok = isTRUE(campos$ok) && isTRUE(cfg_check$ok),
    campos = campos,
    config = cfg,
    config_issues = cfg_check$issues,
    variables = hojas_ruta_variables_disponibles(data),
    n_umps = as.integer(length(rows)),
    mapas_faltantes = as.integer(mapas_faltantes),
    rows = rows
  )
}

.hojas_ruta_draw_table <- function(tbl, x, y, width, row_h = 0.035, font_size = 8) {
  if (is.null(tbl) || !nrow(tbl)) return(invisible(NULL))
  tbl <- as.data.frame(tbl, check.names = FALSE)
  max_rows <- min(nrow(tbl), 10L)
  max_cols <- min(ncol(tbl), 7L)
  tbl <- tbl[seq_len(max_rows), seq_len(max_cols), drop = FALSE]
  col_w <- width / max_cols
  grid::grid.rect(x, y, width, row_h, just = c("left", "top"),
                  gp = grid::gpar(fill = "#e6e9f2", col = "#1f2933", lwd = 0.6))
  for (j in seq_len(max_cols)) {
    grid::grid.text(names(tbl)[j], x + (j - 0.5) * col_w, y - row_h / 2,
                    gp = grid::gpar(fontsize = font_size, fontface = "bold"))
  }
  for (i in seq_len(max_rows)) {
    yy <- y - i * row_h
    grid::grid.rect(x, yy, width, row_h, just = c("left", "top"),
                    gp = grid::gpar(fill = "white", col = "#cbd5e1", lwd = 0.4))
    for (j in seq_len(max_cols)) {
      val <- as.character(tbl[i, j][[1]])
      grid::grid.text(val, x + (j - 0.5) * col_w, yy - row_h / 2,
                      gp = grid::gpar(fontsize = font_size))
    }
  }
  invisible(NULL)
}

.hojas_ruta_draw_pdf_base <- function(row, quota, config, out_pdf) {
  grDevices::pdf(out_pdf, paper = "a4", width = 8.27, height = 11.69)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "white", col = NA))
  grid::grid.text("FICHA DE TRABAJO DE CAMPO", x = 0.5, y = 0.955,
                  gp = grid::gpar(fontsize = 15, fontface = "bold", col = "#002457"))
  grid::grid.text(sprintf("UMP %s | UBIGEO %s | ZONA %s",
                          row$UMP, row$ubigeo, row$cod_zona),
                  x = 0.5, y = 0.925,
                  gp = grid::gpar(fontsize = 10, col = "#1f2933"))
  if (nzchar(config$project_code)) {
    grid::grid.text(sprintf("Codigo de estudio: %s", config$project_code),
                    x = 0.08, y = 0.89, just = "left",
                    gp = grid::gpar(fontsize = 9, col = "#5f6b7a"))
  }

  datos <- data.frame(
    Campo = c("IDMANZANA", "ESTRATO", "NSE", "VIVIENDAS", "IE", "FE",
              "ESQUINA", "RECORRIDO", "ARRANQUE", "CONSTANTE"),
    Valor = c(row$idmanzana, row$estrato, row$nse, row$viviendas, row$ie, row$fe,
              row$esquina, row$recorrido, row$arranque, row$constante),
    stringsAsFactors = FALSE
  )
  .hojas_ruta_draw_table(datos, x = 0.08, y = 0.84, width = 0.84, row_h = 0.035, font_size = 8)
  grid::grid.text("Cuotas", x = 0.08, y = 0.43, just = "left",
                  gp = grid::gpar(fontsize = 12, fontface = "bold", col = "#002457"))
  .hojas_ruta_draw_table(quota, x = 0.08, y = 0.40, width = 0.84, row_h = 0.035, font_size = 7)
  grid::grid.text(format(Sys.Date(), "%d/%m/%Y"), x = 0.5, y = 0.045,
                  gp = grid::gpar(fontsize = 8, col = "#5f6b7a"))
  invisible(out_pdf)
}

.hojas_ruta_image_pdf <- function(map_path, out_pdf) {
  ext <- tolower(tools::file_ext(map_path))
  img <- NULL
  if (ext %in% c("jpg", "jpeg")) {
    if (!requireNamespace("jpeg", quietly = TRUE)) {
      stop("El paquete `jpeg` es necesario para anexar mapas JPG.", call. = FALSE)
    }
    img <- jpeg::readJPEG(map_path)
  } else if (ext == "png") {
    img <- png::readPNG(map_path)
  } else {
    stop("Formato de imagen no soportado.", call. = FALSE)
  }
  grDevices::pdf(out_pdf, paper = "a4", width = 8.27, height = 11.69)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "white", col = NA))
  grid::grid.raster(img, x = 0.5, y = 0.5, width = 0.92, height = 0.92, interpolate = TRUE)
  invisible(out_pdf)
}

.hojas_ruta_combinar_pdf <- function(paths, out_pdf) {
  paths <- paths[file.exists(paths)]
  if (length(paths) == 1L) {
    file.copy(paths[1], out_pdf, overwrite = TRUE)
    return(out_pdf)
  }
  if (requireNamespace("qpdf", quietly = TRUE)) {
    qpdf::pdf_combine(paths, output = out_pdf)
  } else {
    file.copy(paths[1], out_pdf, overwrite = TRUE)
  }
  out_pdf
}

.hojas_ruta_row_payload <- function(row, idx) {
  parsed <- hojas_ruta_parse_id_manzana(row$IDMANZANA[[1]])
  list(
    index = idx,
    ump = as.character(row$UMP[[1]] %||% ""),
    idmanzana = as.character(row$IDMANZANA[[1]] %||% ""),
    ubigeo = parsed$ubigeo,
    cod_zona = parsed$cod_zona,
    cod_manzana = parsed$cod_manzana,
    estrato = as.character(row$ESTRATO[[1]] %||% ""),
    viviendas = as.character(row$VIVIENDAS[[1]] %||% ""),
    nse = as.character(row$NSE[[1]] %||% ""),
    esquina = as.character(row$ESQUINA[[1]] %||% ""),
    recorrido = as.character(row$RECORRIDO[[1]] %||% ""),
    arranque = as.character(row$ARRANQUE[[1]] %||% ""),
    constante = as.character(row$CONSTANTE[[1]] %||% ""),
    ie = as.character(row$IE[[1]] %||% ""),
    fe = as.character(row$FE[[1]] %||% "")
  )
}

#' Generar ZIP de hojas de ruta
#'
#' @param data data.frame con columnas canonicas.
#' @param config configuracion del asistente.
#' @param result_path ruta final .zip.
#' @return Lista con resumen de generacion.
#' @export
hojas_ruta_generar_zip <- function(data, config = list(), result_path) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop("El paquete `zip` es necesario para empaquetar las hojas.", call. = FALSE)
  }
  cfg <- hojas_ruta_normalize_config(config)
  preview <- hojas_ruta_preview(data, cfg)
  if (!isTRUE(preview$campos$ok)) {
    stop("La base no cumple las columnas canonicas requeridas.", call. = FALSE)
  }
  if (length(preview$config_issues) > 0L) {
    stop("La configuracion de cuotas esta incompleta.", call. = FALSE)
  }

  filas <- data
  if (!is.na(cfg$max_umps) && cfg$max_umps > 0L && nrow(filas) > cfg$max_umps) {
    filas <- utils::head(filas, cfg$max_umps)
  }
  stage <- tempfile("hojas_ruta_stage_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  resumen <- list()
  used_names <- character(0)
  pdf_files <- character(0)
  for (i in seq_len(nrow(filas))) {
    row_df <- filas[i, , drop = FALSE]
    payload <- .hojas_ruta_row_payload(row_df, i)
    mapa_code <- hojas_ruta_map_code(payload$idmanzana)
    mapa_path <- hojas_ruta_resolver_mapa(mapa_code, cfg$cartografia_dir)
    quota <- hojas_ruta_quota_table(row_df, cfg)
    base_name <- sprintf(
      "HojaRuta_%s_%s.pdf",
      hojas_ruta_sanitize_filename(payload$ump),
      hojas_ruta_sanitize_filename(mapa_code)
    )
    if (base_name %in% used_names) {
      base_name <- sub("\\.pdf$", sprintf("_%03d.pdf", i), base_name)
    }
    used_names <- c(used_names, base_name)
    base_pdf <- file.path(stage, paste0("base_", i, ".pdf"))
    final_pdf <- file.path(stage, base_name)
    .hojas_ruta_draw_pdf_base(payload, quota, cfg, base_pdf)
    parts <- base_pdf
    map_status <- "faltante"
    if (!is.null(mapa_path) && file.exists(mapa_path)) {
      ext <- tolower(tools::file_ext(mapa_path))
      if (ext == "pdf") {
        parts <- c(parts, mapa_path)
        map_status <- "anexado"
      } else if (ext %in% c("png", "jpg", "jpeg")) {
        map_pdf <- file.path(stage, paste0("mapa_", i, ".pdf"))
        .hojas_ruta_image_pdf(mapa_path, map_pdf)
        parts <- c(parts, map_pdf)
        map_status <- "anexado"
      }
    }
    .hojas_ruta_combinar_pdf(parts, final_pdf)
    pdf_files <- c(pdf_files, final_pdf)
    resumen[[length(resumen) + 1L]] <- data.frame(
      UMP = payload$ump,
      IDMANZANA = payload$idmanzana,
      UBIGEO = payload$ubigeo,
      COD_ZONA = payload$cod_zona,
      MAPA = mapa_code,
      MAPA_ESTADO = map_status,
      ARCHIVO = base_name,
      stringsAsFactors = FALSE
    )
  }
  resumen_df <- do.call(rbind, resumen)
  resumen_path <- file.path(stage, "resumen_generacion.xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Resumen")
  openxlsx::writeData(wb, "Resumen", resumen_df)
  openxlsx::setColWidths(wb, "Resumen", cols = seq_len(ncol(resumen_df)), widths = "auto")
  openxlsx::saveWorkbook(wb, resumen_path, overwrite = TRUE)

  old <- setwd(stage)
  on.exit(setwd(old), add = TRUE)
  files <- c(basename(pdf_files), basename(resumen_path))
  zip::zip(result_path, files = files)
  setwd(old)

  list(
    ok = TRUE,
    path = result_path,
    n_pdfs = as.integer(length(pdf_files)),
    mapas_faltantes = as.integer(sum(resumen_df$MAPA_ESTADO == "faltante")),
    resumen = resumen_df
  )
}

# =============================================================================
# Hojas de ruta integradas: marco INEI 2017 + cuotas + muestra de manzanas
# =============================================================================

HOJAS_RUTA_INEI_VERSION <- "inei2017-lima-callao-manzanas-full-v1"
HOJAS_RUTA_INEI_AGE_SIMPLE_VERSION <- "inei2017-cpv2017-c5p41-sexo-distrito-v1"
HOJAS_RUTA_INEI_SOURCE <- paste(
  "INEI - Censos Nacionales 2017: XII de Poblacion, VII de Vivienda",
  "y III de Comunidades Indigenas"
)
HOJAS_RUTA_INEI_AGE_SIMPLE_SOURCE <- paste(
  "INEI REDATAM CPV2017 - Manzana: Poblacio.C5P41 Edad en anos",
  "por Poblacio.SEXO"
)
HOJAS_RUTA_CARTO_MANZANAS_VERSION <- "planmet-imp-inei2017-manzanas-lima-v1"
HOJAS_RUTA_CARTO_MANZANAS_SOURCE <- paste(
  "IMP PlanMet 2040 - capa Manzanas Urbanas; fuente declarada:",
  "INEI 2017, Equipo Tecnico Plan Met 40, IMP 2020"
)
HOJAS_RUTA_CARTO_MANZANAS_CATALOG_URL <- "https://portal.imp.gob.pe/sim/catalogo-de-datos-planmet-2040/"
HOJAS_RUTA_CARTO_MANZANAS_LAYER_URL <- paste0(
  "https://services5.arcgis.com/bHvzrGGxW8wP6Utm/ArcGIS/rest/services/",
  "Manzanas_Urbanas/FeatureServer/0"
)
HOJAS_RUTA_CARTO_MANZANAS_QUERY_URL <- paste0(HOJAS_RUTA_CARTO_MANZANAS_LAYER_URL, "/query")
HOJAS_RUTA_CARTO_CALLAO_MANZANAS_VERSION <- "callao-pcc2019-v1"
HOJAS_RUTA_CARTO_CALLAO_MANZANAS_SOURCE <- paste(
  "Plan de Desarrollo Metropolitano del Callao - capa B_070101_Manzanas;",
  "fuente declarada en atributos: META 6 - PCC 2019"
)
HOJAS_RUTA_CARTO_CALLAO_MANZANAS_LAYER_URL <- paste0(
  "https://services5.arcgis.com/bHvzrGGxW8wP6Utm/ArcGIS/rest/services/",
  "B_070101_Manzanas/FeatureServer/0"
)
HOJAS_RUTA_CARTO_CALLAO_MANZANAS_QUERY_URL <- paste0(HOJAS_RUTA_CARTO_CALLAO_MANZANAS_LAYER_URL, "/query")

.hojas_ruta_inst_path <- function(...) {
  p <- system.file(..., package = "prosecnurapp", mustWork = FALSE)
  if (nzchar(p) && file.exists(p)) return(p)
  candidates <- c(
    file.path(.app_api_dir(), "inst", ...),
    file.path(getwd(), "inst", ...),
    file.path(getwd(), "..", "inst", ...),
    file.path(getwd(), "..", "..", "inst", ...)
  )
  hit <- candidates[file.exists(candidates)][1]
  if (!is.na(hit) && nzchar(hit)) return(hit)
  candidates[[1]]
}

hojas_ruta_inei_frame_path <- function() {
  full <- .hojas_ruta_inst_path("hojas_ruta", "inei2017_lima_callao_manzanas_full.csv.gz")
  if (file.exists(full)) return(full)
  .hojas_ruta_inst_path("hojas_ruta", "inei2017_lima_callao_manzanas.csv")
}

hojas_ruta_inei_age_simple_path <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "inei2017_lima_callao_edad_simple_distrito.csv")
}

hojas_ruta_cartografia_manzanas_manifest_path <- function(source = "lima") {
  if (identical(source, "callao")) {
    return(.hojas_ruta_inst_path("hojas_ruta", "cartografia_manzanas_callao_2019.json"))
  }
  .hojas_ruta_inst_path("hojas_ruta", "cartografia_manzanas_lima_2017.json")
}

hojas_ruta_cartografia_calles_manifest_path <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "cartografia_calles_osm_lima_callao.json")
}

hojas_ruta_cartografia_contexto_manifest_path <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "cartografia_contexto_osm_lima_callao.json")
}

hojas_ruta_contexto_curado_path <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "contexto_curado_lima_callao.geojson")
}

.hojas_ruta_numeric_cols <- function(df, cols) {
  for (nm in intersect(cols, names(df))) {
    df[[nm]] <- suppressWarnings(as.numeric(df[[nm]]))
  }
  df
}

#' Leer el marco territorial empaquetado para hojas de ruta
#'
#' @return data.frame con manzanas urbanas piloto Lima/Callao.
#' @export
hojas_ruta_inei_frame <- function() {
  path <- hojas_ruta_inei_frame_path()
  if (!file.exists(path)) {
    stop("No se encontro el marco INEI 2017 empaquetado.", call. = FALSE)
  }
  df <- utils::read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    fileEncoding = "UTF-8"
  )
  required <- c(
    "ubigeo", "departamento", "provincia", "distrito", "zona", "manzana",
    "id_manzana", "viviendas", "poblacion"
  )
  missing <- setdiff(required, names(df))
  if (length(missing)) {
    stop("El marco INEI 2017 no tiene columnas requeridas: ",
         paste(missing, collapse = ", "), call. = FALSE)
  }
  df$ubigeo <- sprintf("%06s", as.character(df$ubigeo))
  df$zona <- sprintf("%05s", as.character(df$zona))
  df$manzana <- as.character(df$manzana)
  num_cols <- grep("^(viviendas|poblacion|pob_|lat|lon)", names(df), value = TRUE)
  .hojas_ruta_numeric_cols(df, num_cols)
}

#' Leer edad simple oficial INEI 2017 empaquetada
#'
#' @param required Si TRUE, falla cuando el archivo no existe.
#' @return data.frame con poblacion por ubigeo, edad simple y sexo.
#' @export
hojas_ruta_inei_age_simple <- function(required = FALSE) {
  path <- hojas_ruta_inei_age_simple_path()
  if (!file.exists(path)) {
    if (isTRUE(required)) {
      stop("No se encontro la edad simple INEI 2017 empaquetada.", call. = FALSE)
    }
    return(data.frame())
  }
  df <- utils::read.csv(
    path,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    fileEncoding = "UTF-8",
    colClasses = c(ubigeo = "character")
  )
  required_cols <- c("ubigeo", "distrito", "edad", "sexo", "poblacion")
  missing <- setdiff(required_cols, names(df))
  if (length(missing)) {
    stop("La edad simple INEI 2017 no tiene columnas requeridas: ",
         paste(missing, collapse = ", "), call. = FALSE)
  }
  df$ubigeo <- sprintf("%06s", as.character(df$ubigeo))
  df$edad <- suppressWarnings(as.integer(df$edad))
  df$poblacion <- suppressWarnings(as.numeric(df$poblacion))
  sexo_norm <- tolower(trimws(as.character(df$sexo)))
  df$sexo <- ifelse(substr(sexo_norm, 1L, 1L) == "h" | sexo_norm %in% c("1", "male"),
                    "Hombre", "Mujer")
  df[!is.na(df$edad) & df$edad >= 0L & !is.na(df$poblacion), , drop = FALSE]
}

.hojas_ruta_checksum <- function(path) {
  if (!file.exists(path)) return(NA_character_)
  as.character(tools::md5sum(path)[[1]])
}

.hojas_ruta_age_defs_default <- function() {
  list(
    list(id = "18_24", label = "18-24", min = 18L, max = 24L),
    list(id = "25_34", label = "25-34", min = 25L, max = 34L),
    list(id = "35_44", label = "35-44", min = 35L, max = 44L),
    list(id = "45_54", label = "45-54", min = 45L, max = 54L),
    list(id = "55_64", label = "55-64", min = 55L, max = 64L),
    list(id = "65_plus", label = "65+", min = 65L, max = NA_integer_)
  )
}

.hojas_ruta_age_sources <- function() {
  data.frame(
    id = c("18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"),
    min = c(18L, 25L, 35L, 45L, 55L, 65L),
    max = c(24L, 34L, 44L, 54L, 64L, 120L),
    h_col = c("pob_18_24_h", "pob_25_34_h", "pob_35_44_h", "pob_45_54_h", "pob_55_64_h", "pob_65_plus_h"),
    m_col = c("pob_18_24_m", "pob_25_34_m", "pob_35_44_m", "pob_45_54_m", "pob_55_64_m", "pob_65_plus_m"),
    stringsAsFactors = FALSE
  )
}

.hojas_ruta_sampling_methods <- function() {
  list(
    list(
      id = "pps",
      label = "PPS estratificado",
      description = "Seleccion por dominio con probabilidad proporcional a viviendas/poblacion."
    ),
    list(
      id = "sistematico",
      label = "Sistematico con arranque aleatorio",
      description = "Seleccion sistematica ordenada dentro de cada dominio territorial."
    ),
    list(
      id = "conglomerado_fijo",
      label = "Conglomerados con carga fija",
      description = "Seleccion de manzanas y carga operativa fija, salvo la ultima manzana."
    )
  )
}

.hojas_ruta_df_rows <- function(df) {
  if (is.null(df) || !nrow(df)) return(list())
  lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    row[] <- lapply(row, function(x) {
      if (length(x) == 0L || is.na(x)) return(NA)
      x[[1]]
    })
    row
  })
}

.hojas_ruta_rows_df <- function(rows) {
  if (is.null(rows) || !length(rows)) return(data.frame())
  out <- do.call(rbind, lapply(rows, function(x) {
    as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE)
  }))
  rownames(out) <- NULL
  out
}

.hojas_ruta_territories <- function(frame = hojas_ruta_inei_frame()) {
  if (is.null(frame) || !nrow(frame)) return(list())
  agg <- stats::aggregate(
    frame[c("viviendas", "poblacion")],
    by = frame[c("departamento", "provincia", "distrito", "ubigeo")],
    FUN = sum,
    na.rm = TRUE
  )
  n_manzanas <- stats::aggregate(
    frame["id_manzana"],
    by = frame[c("ubigeo")],
    FUN = length
  )
  names(n_manzanas)[2] <- "manzanas"
  agg <- merge(agg, n_manzanas, by = "ubigeo", all.x = TRUE)
  agg <- agg[order(agg$departamento, agg$provincia, agg$distrito), , drop = FALSE]
  .hojas_ruta_df_rows(agg)
}

.hojas_ruta_age_simple_meta <- function(age = NULL) {
  path <- hojas_ruta_inei_age_simple_path()
  exists <- file.exists(path)
  if (is.null(age)) {
    age <- if (exists) tryCatch(hojas_ruta_inei_age_simple(), error = function(e) data.frame()) else data.frame()
  }
  ok <- exists && is.data.frame(age) && nrow(age) > 0L
  list(
    ok = ok,
    source = HOJAS_RUTA_INEI_AGE_SIMPLE_SOURCE,
    source_url = "https://censos2017.inei.gob.pe/bininei2/RpWebStats.exe/Dictionary?BASE=CPV2017&ITEM=DICALL&lang=esp",
    query_url = "https://censos2017.inei.gob.pe/bininei2/RpWebStats.exe/CrossTab?BASE=CPV2017&ITEM=PIRAMI&lang=esp",
    year = 2017L,
    version = HOJAS_RUTA_INEI_AGE_SIMPLE_VERSION,
    packaged_at = if (ok && "fetched_at" %in% names(age)) max(age$fetched_at, na.rm = TRUE) else NA_character_,
    checksum = .hojas_ruta_checksum(path),
    granularity = "distrito",
    variable_edad = "Poblacio.C5P41",
    variable_sexo = "Poblacio.SEXO",
    min_age = if (ok) as.integer(min(age$edad, na.rm = TRUE)) else NA_integer_,
    max_age = if (ok) as.integer(max(age$edad, na.rm = TRUE)) else NA_integer_,
    n_ubigeos = if (ok) length(unique(age$ubigeo)) else 0L,
    rows = if (ok) as.integer(nrow(age)) else 0L,
    poblacion = if (ok) as.integer(sum(age$poblacion, na.rm = TRUE)) else 0L,
    poblacion_18_plus = if (ok) as.integer(sum(age$poblacion[age$edad >= 18L], na.rm = TRUE)) else 0L,
    path = normalizePath(path, mustWork = FALSE)
  )
}

.hojas_ruta_cartografia_profile <- function(source) {
  if (identical(source, "callao")) {
    return(list(
      id = "callao",
      source = HOJAS_RUTA_CARTO_CALLAO_MANZANAS_SOURCE,
      source_url = HOJAS_RUTA_CARTO_MANZANAS_CATALOG_URL,
      layer_url = HOJAS_RUTA_CARTO_CALLAO_MANZANAS_LAYER_URL,
      query_url = HOJAS_RUTA_CARTO_CALLAO_MANZANAS_QUERY_URL,
      year = 2019L,
      provider = "Plan de Desarrollo Metropolitano del Callao",
      version = HOJAS_RUTA_CARTO_CALLAO_MANZANAS_VERSION,
      coverage = "Callao",
      dir_name = "manzanas_callao_2019",
      manifest = hojas_ruta_cartografia_manzanas_manifest_path("callao"),
      id_field = "ID_MANZANA",
      district_field = "NOMBDIST",
      source_field = "FTE_MZNA",
      area_field = "AREA_M2",
      out_fields = paste(
        "OBJECTID,ID_MANZANA,CODMZNA,ID_SECT,D_CURB,IDCCPP_07,NOMBCCPP,NOM_HAB",
        "NOMBDIST,NOMBPROV,NOMBDEP,FTE_MZNA,AREA_M2,OBSERV,IDMZNAR",
        sep = ","
      )
    ))
  }
  list(
    id = "lima",
    source = HOJAS_RUTA_CARTO_MANZANAS_SOURCE,
    source_url = HOJAS_RUTA_CARTO_MANZANAS_CATALOG_URL,
    layer_url = HOJAS_RUTA_CARTO_MANZANAS_LAYER_URL,
    query_url = HOJAS_RUTA_CARTO_MANZANAS_QUERY_URL,
    year = 2017L,
    provider = "Instituto Metropolitano de Planificacion - PlanMet 2040",
    version = HOJAS_RUTA_CARTO_MANZANAS_VERSION,
    coverage = "Lima Metropolitana",
    dir_name = "manzanas_lima_2017",
    manifest = hojas_ruta_cartografia_manzanas_manifest_path("lima"),
    id_field = "ID_MANZANA",
    district_field = "NOMBDIST",
    source_field = "FTE_MZNA",
    area_field = "AREA_M2",
    out_fields = "OBJECTID,ID_MANZANA,NOMBDIST,NOMBPROV,NOMBDEP,FTE_MZNA,AREA_M2"
  )
}

.hojas_ruta_cartografia_profile_for_ubigeo <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  if (grepl("^1501[0-9]{2}$", ubigeo)) return(.hojas_ruta_cartografia_profile("lima"))
  if (grepl("^0701[0-9]{2}$", ubigeo)) return(.hojas_ruta_cartografia_profile("callao"))
  NULL
}

.hojas_ruta_packaged_geojson_stats <- function(dir, manifest_path = NULL) {
  if (!is.null(manifest_path) && file.exists(manifest_path)) {
    manifest <- tryCatch(jsonlite::read_json(manifest_path, simplifyVector = FALSE), error = function(e) NULL)
    if (!is.null(manifest) &&
        !is.null(manifest$packaged_districts) &&
        !is.null(manifest$packaged_blocks)) {
      return(list(
        n_distritos = as.integer(manifest$packaged_districts),
        n_manzanas = as.integer(manifest$packaged_blocks)
      ))
    }
  }
  files <- list.files(dir, pattern = "[.]geojson([.]gz)?$", full.names = TRUE)
  if (!length(files)) {
    return(list(n_distritos = 0L, n_manzanas = 0L))
  }
  counts <- vapply(files, function(path) {
    json <- tryCatch(jsonlite::read_json(path, simplifyVector = FALSE), error = function(e) NULL)
    if (is.null(json)) return(0L)
    as.integer(length(json$features %||% list()))
  }, integer(1))
  list(n_distritos = as.integer(length(files)), n_manzanas = as.integer(sum(counts, na.rm = TRUE)))
}

.hojas_ruta_cartografia_meta_from_profile <- function(profile) {
  manifest_path <- profile$manifest
  packaged_dir <- .hojas_ruta_inst_path("hojas_ruta", "cartografia", profile$dir_name)
  stats <- .hojas_ruta_packaged_geojson_stats(packaged_dir, manifest_path)
  list(
    ok = stats$n_manzanas > 0L,
    source = profile$source,
    source_url = profile$source_url,
    layer_url = profile$layer_url,
    query_url = profile$query_url,
    year = profile$year,
    provider = profile$provider,
    version = profile$version,
    packaged_at = NA_character_,
    coverage = profile$coverage,
    geometry = "poligono_manzana",
    id_field = profile$id_field,
    district_field = profile$district_field,
    source_field = profile$source_field,
    area_field = profile$area_field,
    mode = "local_first_optional_online_cache",
    manifest_path = normalizePath(manifest_path, mustWork = FALSE),
    checksum = .hojas_ruta_checksum(manifest_path),
    packaged_dir = normalizePath(packaged_dir, mustWork = FALSE),
    packaged_districts = stats$n_distritos,
    packaged_blocks = stats$n_manzanas,
    note = paste(
      "La app no consulta internet por defecto.",
      "La fuente online queda solo como paso tecnico opcional para preparar o refrescar el paquete local."
    )
  )
}

#' Metadatos de cartografia de manzanas para Lima Metropolitana y Callao
#'
#' @param ubigeo UBIGEO opcional; si se entrega, devuelve la fuente aplicable.
#' @return Lista serializable con fuente, cobertura y estado de la capa.
#' @export
hojas_ruta_cartografia_manzanas_meta <- function(ubigeo = NULL) {
  if (!is.null(ubigeo) && nzchar(as.character(ubigeo))) {
    profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
    if (!is.null(profile)) return(.hojas_ruta_cartografia_meta_from_profile(profile))
  }

  lima <- .hojas_ruta_cartografia_meta_from_profile(.hojas_ruta_cartografia_profile("lima"))
  callao <- .hojas_ruta_cartografia_meta_from_profile(.hojas_ruta_cartografia_profile("callao"))
  list(
    ok = isTRUE(lima$ok) && isTRUE(callao$ok),
    source = paste(lima$source, callao$source, sep = " | "),
    source_url = HOJAS_RUTA_CARTO_MANZANAS_CATALOG_URL,
    layer_url = lima$layer_url,
    query_url = lima$query_url,
    year = 2017L,
    years = c(2017L, 2019L),
    provider = "IMP PlanMet 2040 / Plan de Desarrollo Metropolitano del Callao",
    version = "lima-callao-manzanas-local-v1",
    packaged_at = NA_character_,
    coverage = "Lima Metropolitana y Callao",
    geometry = "poligono_manzana",
    id_field = "ID_MANZANA",
    district_field = "NOMBDIST",
    source_field = "FTE_MZNA",
    area_field = "AREA_M2",
    mode = "local_first_optional_online_cache",
    manifest_path = normalizePath(lima$manifest_path, mustWork = FALSE),
    checksum = paste(na.omit(c(lima$checksum, callao$checksum)), collapse = ";"),
    packaged_districts = as.integer(lima$packaged_districts + callao$packaged_districts),
    packaged_blocks = as.integer(lima$packaged_blocks + callao$packaged_blocks),
    sources = list(lima = lima, callao = callao),
    note = paste(
      "Uso operativo 100% local.",
      "Lima usa la capa PlanMet/IMP con fuente declarada INEI 2017;",
      "Callao usa B_070101_Manzanas con fuente declarada META 6 - PCC 2019."
    )
  )
}

.hojas_ruta_street_cartography_dir <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "cartografia", "calles_osm_lima_callao")
}

.hojas_ruta_context_cartography_dir <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "cartografia", "contexto_osm_lima_callao")
}

.hojas_ruta_street_map_packaged_file <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  base <- file.path(.hojas_ruta_street_cartography_dir(), sprintf("%s.geojson", ubigeo))
  if (file.exists(base)) return(base)
  gz <- paste0(base, ".gz")
  if (file.exists(gz)) return(gz)
  base
}

.hojas_ruta_context_map_packaged_file <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  base <- file.path(.hojas_ruta_context_cartography_dir(), sprintf("%s.geojson", ubigeo))
  if (file.exists(base)) return(base)
  gz <- paste0(base, ".gz")
  if (file.exists(gz)) return(gz)
  base
}

.hojas_ruta_street_geojson_stats <- function(dir, manifest_path = NULL) {
  if (!is.null(manifest_path) && file.exists(manifest_path)) {
    manifest <- tryCatch(jsonlite::read_json(manifest_path, simplifyVector = FALSE), error = function(e) NULL)
    if (!is.null(manifest) &&
        !is.null(manifest$packaged_districts) &&
        !is.null(manifest$packaged_streets)) {
      return(list(
        n_distritos = as.integer(manifest$packaged_districts),
        n_calles = as.integer(manifest$packaged_streets),
        length_km = as.numeric(manifest$packaged_length_km %||% NA_real_)
      ))
    }
  }
  files <- list.files(dir, pattern = "[.]geojson([.]gz)?$", full.names = TRUE)
  if (!length(files)) {
    return(list(n_distritos = 0L, n_calles = 0L, length_km = NA_real_))
  }
  counts <- vapply(files, function(path) {
    json <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
    if (is.null(json)) return(0L)
    as.integer(length(json$features %||% list()))
  }, integer(1))
  list(n_distritos = as.integer(length(files)), n_calles = as.integer(sum(counts, na.rm = TRUE)), length_km = NA_real_)
}

.hojas_ruta_context_geojson_stats <- function(dir, manifest_path = NULL) {
  if (!is.null(manifest_path) && file.exists(manifest_path)) {
    manifest <- tryCatch(jsonlite::read_json(manifest_path, simplifyVector = FALSE), error = function(e) NULL)
    if (!is.null(manifest) &&
        !is.null(manifest$packaged_districts) &&
        !is.null(manifest$packaged_features)) {
      return(list(
        n_distritos = as.integer(manifest$packaged_districts),
        n_features = as.integer(manifest$packaged_features),
        counts_by_class = manifest$counts_by_class %||% list()
      ))
    }
  }
  files <- list.files(dir, pattern = "[.]geojson([.]gz)?$", full.names = TRUE)
  if (!length(files)) {
    return(list(n_distritos = 0L, n_features = 0L, counts_by_class = list()))
  }
  counts <- vapply(files, function(path) {
    json <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
    if (is.null(json)) return(0L)
    as.integer(length(json$features %||% list()))
  }, integer(1))
  list(n_distritos = as.integer(length(files)), n_features = as.integer(sum(counts, na.rm = TRUE)), counts_by_class = list())
}

#' Metadatos de cartografia vial OSM empaquetada para Hojas de ruta
#'
#' @param ubigeo UBIGEO opcional; si se entrega, valida el archivo local.
#' @return Lista serializable con fuente, licencia y cobertura.
#' @export
hojas_ruta_cartografia_calles_meta <- function(ubigeo = NULL) {
  manifest_path <- hojas_ruta_cartografia_calles_manifest_path()
  packaged_dir <- .hojas_ruta_street_cartography_dir()
  manifest <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::read_json(manifest_path, simplifyVector = FALSE), error = function(e) NULL)
  } else NULL
  stats <- .hojas_ruta_street_geojson_stats(packaged_dir, manifest_path)
  packaged_file <- if (!is.null(ubigeo) && nzchar(as.character(ubigeo))) {
    .hojas_ruta_street_map_packaged_file(ubigeo)
  } else NA_character_
  ok <- stats$n_calles > 0L &&
    (is.na(packaged_file) || file.exists(packaged_file))
  list(
    ok = ok,
    source = manifest$source %||% "OpenStreetMap Peru extract distributed by Geofabrik",
    source_url = manifest$source_url %||% "https://download.geofabrik.de/south-america/peru.html",
    extract_url = manifest$extract_url %||% "https://download.geofabrik.de/south-america/peru-latest.osm.pbf",
    provider = manifest$provider %||% "OpenStreetMap contributors / Geofabrik GmbH",
    license = manifest$license %||% "Open Database License (ODbL) 1.0",
    license_url = manifest$license_url %||% "https://www.openstreetmap.org/copyright",
    version = manifest$version %||% "osm-geofabrik-peru-streets-lima-callao-v1",
    packaged_at = manifest$packaged_at %||% NA_character_,
    coverage = manifest$coverage %||% "Lima Metropolitana y Callao",
    format = paste("GeoJSON", manifest$compression %||% "gzip_por_distrito", sep = " / "),
    geometry = manifest$geometry %||% "linea_vial",
    mode = manifest$packaging_mode %||% "local_only",
    attribution = manifest$attribution %||% "© OpenStreetMap contributors · ODbL",
    manifest_path = normalizePath(manifest_path, mustWork = FALSE),
    packaged_dir = normalizePath(packaged_dir, mustWork = FALSE),
    checksum = .hojas_ruta_checksum(manifest_path),
    packaged_districts = stats$n_distritos,
    packaged_streets = stats$n_calles,
    packaged_length_km = stats$length_km,
    included_highways = manifest$included_highways %||% list(),
    excluded_highways = manifest$excluded_highways %||% list(),
    note = manifest$note %||% "Capa de referencia vial para orientacion en campo."
  )
}

#' Metadatos de contexto urbano OSM empaquetado para Hojas de ruta
#'
#' @param ubigeo UBIGEO opcional; si se entrega, valida el archivo local.
#' @return Lista serializable con fuente, licencia y cobertura.
#' @export
hojas_ruta_cartografia_contexto_meta <- function(ubigeo = NULL) {
  manifest_path <- hojas_ruta_cartografia_contexto_manifest_path()
  packaged_dir <- .hojas_ruta_context_cartography_dir()
  manifest <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::read_json(manifest_path, simplifyVector = FALSE), error = function(e) NULL)
  } else NULL
  stats <- .hojas_ruta_context_geojson_stats(packaged_dir, manifest_path)
  packaged_file <- if (!is.null(ubigeo) && nzchar(as.character(ubigeo))) {
    .hojas_ruta_context_map_packaged_file(ubigeo)
  } else NA_character_
  ok <- stats$n_features > 0L &&
    (is.na(packaged_file) || file.exists(packaged_file))
  list(
    ok = ok,
    source = paste(
      manifest$source %||% "OpenStreetMap Peru extract distributed by Geofabrik",
      "+ curaduria local Prosecnur"
    ),
    source_url = manifest$source_url %||% "https://download.geofabrik.de/south-america/peru.html",
    extract_url = manifest$extract_url %||% "https://download.geofabrik.de/south-america/peru-latest.osm.pbf",
    provider = manifest$provider %||% "OpenStreetMap contributors / Geofabrik GmbH",
    license = manifest$license %||% "Open Database License (ODbL) 1.0",
    license_url = manifest$license_url %||% "https://www.openstreetmap.org/copyright",
    version = manifest$version %||% "osm-geofabrik-peru-context-lima-callao-v1",
    packaged_at = manifest$packaged_at %||% NA_character_,
    coverage = manifest$coverage %||% "Lima Metropolitana y Callao",
    format = paste("GeoJSON", manifest$compression %||% "gzip_por_distrito", sep = " / "),
    geometry = manifest$geometry %||% "poligono_linea_punto_contexto",
    mode = manifest$packaging_mode %||% "local_only",
    attribution = manifest$attribution %||% "© OpenStreetMap contributors · ODbL",
    manifest_path = normalizePath(manifest_path, mustWork = FALSE),
    packaged_dir = normalizePath(packaged_dir, mustWork = FALSE),
    checksum = .hojas_ruta_checksum(manifest_path),
    packaged_districts = stats$n_distritos,
    packaged_features = stats$n_features,
    counts_by_class = stats$counts_by_class,
    included_classes = manifest$included_classes %||% list(),
    curated_path = normalizePath(hojas_ruta_contexto_curado_path(), mustWork = FALSE),
    note = paste(
      manifest$note %||% "Capa local de contexto urbano para orientacion en campo.",
      "Incluye curaduria local para parques e hitos publicos faltantes."
    )
  )
}

.hojas_ruta_block_map_cache_dir <- function(profile = .hojas_ruta_cartografia_profile("lima")) {
  root <- file.path(hojas_ruta_cache_dir(), profile$dir_name)
  dir.create(root, recursive = TRUE, showWarnings = FALSE)
  normalizePath(root, mustWork = FALSE)
}

.hojas_ruta_block_map_packaged_dir <- function(profile = .hojas_ruta_cartografia_profile("lima")) {
  .hojas_ruta_inst_path("hojas_ruta", "cartografia", profile$dir_name)
}

.hojas_ruta_read_json_any <- function(path) {
  if (grepl("[.]gz$", path)) {
    con <- gzfile(path, open = "rt", encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    txt <- paste(readLines(con, warn = FALSE), collapse = "\n")
    return(jsonlite::fromJSON(txt, simplifyVector = FALSE))
  }
  jsonlite::read_json(path, simplifyVector = FALSE)
}

.hojas_ruta_block_map_packaged_file <- function(profile, ubigeo) {
  base <- file.path(.hojas_ruta_block_map_packaged_dir(profile), sprintf("%s.geojson", ubigeo))
  if (file.exists(base)) return(base)
  gz <- paste0(base, ".gz")
  if (file.exists(gz)) return(gz)
  base
}

.hojas_ruta_block_map_memory_cache <- new.env(parent = emptyenv())
.hojas_ruta_block_map_response_cache <- new.env(parent = emptyenv())

.hojas_ruta_block_map_read_cached_json <- function(path) {
  info <- file.info(path)
  key <- paste(normalizePath(path, mustWork = FALSE), info$size %||% 0, as.numeric(info$mtime %||% 0), sep = "|")
  cached <- .hojas_ruta_block_map_memory_cache[[key]]
  if (!is.null(cached)) return(cached)
  value <- .hojas_ruta_read_json_any(path)
  rm(list = ls(.hojas_ruta_block_map_memory_cache), envir = .hojas_ruta_block_map_memory_cache)
  .hojas_ruta_block_map_memory_cache[[key]] <- value
  value
}

.hojas_ruta_block_map_file_cache_key <- function(ubigeo, limit, refresh, allow_online) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  if (is.null(profile)) {
    return(paste(ubigeo, limit, refresh, allow_online, "unsupported", sep = "|"))
  }
  packaged_file <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  info <- if (file.exists(packaged_file)) file.info(packaged_file) else NULL
  paste(
    ubigeo,
    as.integer(.hojas_ruta_int(limit, 0L)),
    isTRUE(refresh),
    isTRUE(allow_online),
    normalizePath(packaged_file, mustWork = FALSE),
    if (!is.null(info)) info$size %||% 0 else 0,
    if (!is.null(info)) as.numeric(info$mtime %||% 0) else 0,
    "slim-json-v4",
    sep = "|"
  )
}

.hojas_ruta_block_map_response_cache_file <- function(key) {
  dir <- file.path(hojas_ruta_cache_dir(), "block_map_http_json")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  file.path(dir, paste0(digest::digest(key, algo = "xxhash64"), ".json"))
}

.hojas_ruta_slim_block_features <- function(features, ubigeo, year = 2017L) {
  if (is.null(features) || !length(features)) return(list())
  inei_index <- .hojas_ruta_inei_index_for_ubigeo(ubigeo)
  lapply(features, function(feature) {
    props <- feature$properties %||% list()
    id <- as.character(props$ID_MANZANA %||% props$IDMZNAR %||% props$cartografia_id %||% props$OBJECTID %||% "")
    slim_props <- list(
      OBJECTID = props$OBJECTID %||% NULL,
      ID_MANZANA = id,
      NOMBDIST = props$NOMBDIST %||% props$NOMBDISTRI %||% NULL,
      NOMBPROV = props$NOMBPROV %||% NULL,
      NOMBDEP = props$NOMBDEP %||% NULL,
      FTE_MZNA = props$FTE_MZNA %||% props$FUENTE %||% NULL,
      AREA_M2 = props$AREA_M2 %||% NULL,
      ubigeo = ubigeo,
      cartografia_id = id,
      manzana_label = .hojas_ruta_manzana_label(id),
      fuente_anio = as.integer(year)
    )
    if (!is.null(inei_index) && nzchar(id) && exists(id, envir = inei_index, inherits = FALSE)) {
      enrichment <- .hojas_ruta_inei_props_from_row(get(id, envir = inei_index, inherits = FALSE))
      if (!is.null(enrichment)) {
        for (nm in names(enrichment)) slim_props[[nm]] <- enrichment[[nm]]
      }
    } else if (nchar(id) >= 11L) {
      slim_props$inei_zona <- substr(id, 7L, 11L)
      slim_props$inei_manzana <- if (nchar(id) > 11L) substr(id, 12L, nchar(id)) else ""
      slim_props$inei_id_manzana <- id
    }
    feature$properties <- slim_props
    feature
  })
}

.hojas_ruta_block_map_read_local <- function(path, meta, ubigeo, territory, source_kind = "local") {
  local <- .hojas_ruta_block_map_read_cached_json(path)
  local$features <- .hojas_ruta_slim_block_features(local$features %||% list(), ubigeo, meta$year %||% 2017L)
  returned <- length(local$features %||% list())
  if (returned > 0L) {
    props <- local$features[[1]]$properties %||% list()
    if (is.na(territory$distrito %||% NA_character_) || !nzchar(as.character(territory$distrito %||% ""))) {
      territory$distrito <- as.character(props$NOMBDIST %||% territory$distrito)
    }
    if (is.na(territory$provincia %||% NA_character_) || !nzchar(as.character(territory$provincia %||% ""))) {
      territory$provincia <- as.character(props$NOMBPROV %||% territory$provincia)
    }
    if (is.na(territory$departamento %||% NA_character_) || !nzchar(as.character(territory$departamento %||% ""))) {
      territory$departamento <- as.character(props$NOMBDEP %||% territory$departamento)
    }
  }
  list(
    ok = returned > 0L,
    source = meta,
    ubigeo = ubigeo,
    territory = territory,
    count = as.integer(local$properties$count %||% returned),
    returned = as.integer(returned),
    truncated = isTRUE(local$properties$truncated),
    feature_limit = as.integer(local$properties$feature_limit %||% 0L),
    cache = identical(source_kind, "cache"),
    local_package = identical(source_kind, "package"),
    geojson = local,
    alerts = local$properties$alerts %||% list()
  )
}

.hojas_ruta_url_query <- function(base, params) {
  keep <- !vapply(params, is.null, logical(1))
  params <- params[keep]
  values <- vapply(params, function(x) {
    utils::URLencode(as.character(x[[1]]), reserved = TRUE)
  }, character(1))
  paste0(base, "?", paste(names(values), values, sep = "=", collapse = "&"))
}

.hojas_ruta_fetch_json <- function(base, params) {
  url <- .hojas_ruta_url_query(base, params)
  res <- curl::curl_fetch_memory(url)
  if (res$status_code >= 400L) {
    stop(sprintf("La capa de manzanas respondio HTTP %s.", res$status_code), call. = FALSE)
  }
  txt <- rawToChar(res$content)
  jsonlite::fromJSON(txt, simplifyVector = FALSE)
}

.hojas_ruta_lookup_territory <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  age <- tryCatch(hojas_ruta_inei_age_simple(), error = function(e) data.frame())
  if (nrow(age) && ubigeo %in% age$ubigeo) {
    row <- age[age$ubigeo == ubigeo, , drop = FALSE][1, , drop = FALSE]
    return(list(
      ubigeo = ubigeo,
      departamento = as.character(row$departamento %||% "LIMA"),
      provincia = as.character(row$provincia %||% ""),
      distrito = as.character(row$distrito %||% "")
    ))
  }
  frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) data.frame())
  if (nrow(frame) && ubigeo %in% frame$ubigeo) {
    row <- frame[frame$ubigeo == ubigeo, , drop = FALSE][1, , drop = FALSE]
    return(list(
      ubigeo = ubigeo,
      departamento = as.character(row$departamento %||% ""),
      provincia = as.character(row$provincia %||% ""),
      distrito = as.character(row$distrito %||% "")
    ))
  }
  list(ubigeo = ubigeo, departamento = NA_character_, provincia = NA_character_, distrito = NA_character_)
}

.hojas_ruta_manzana_label <- function(id_manzana) {
  id <- as.character(id_manzana %||% "")
  if (nchar(id) >= 15L) {
    return(sprintf("Zona %s - Manzana %s", substr(id, 7L, 11L), substr(id, 12L, nchar(id))))
  }
  id
}

.hojas_ruta_inei_index_for_ubigeo <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) NULL)
  if (is.null(frame) || !nrow(frame) || !nzchar(ubigeo)) return(NULL)
  sub <- frame[frame$ubigeo == ubigeo, , drop = FALSE]
  if (!nrow(sub)) return(NULL)
  index <- new.env(parent = emptyenv())
  for (i in seq_len(nrow(sub))) {
    key <- as.character(sub$id_manzana[[i]])
    if (!nzchar(key)) next
    index[[key]] <- sub[i, , drop = FALSE]
  }
  index
}

.hojas_ruta_inei_props_from_row <- function(row) {
  if (is.null(row) || !is.data.frame(row) || !nrow(row)) return(NULL)
  value_num <- function(col, default = NA_real_) {
    if (!col %in% names(row)) return(default)
    val <- suppressWarnings(as.numeric(row[[col]][[1]]))
    if (length(val) == 0L || is.na(val)) default else val
  }
  age_cols <- c(
    "pob_18_24_h", "pob_18_24_m",
    "pob_25_34_h", "pob_25_34_m",
    "pob_35_44_h", "pob_35_44_m",
    "pob_45_54_h", "pob_45_54_m",
    "pob_55_64_h", "pob_55_64_m",
    "pob_65_plus_h", "pob_65_plus_m"
  )
  age_breakdown <- list()
  age_pob_h <- 0
  age_pob_m <- 0
  has_age_breakdown <- FALSE
  for (col in age_cols) {
    if (col %in% names(row)) {
      val <- value_num(col, 0)
      if (is.na(val)) val <- 0
      has_age_breakdown <- TRUE
      age_breakdown[[col]] <- val
      if (endsWith(col, "_h")) age_pob_h <- age_pob_h + val
      else if (endsWith(col, "_m")) age_pob_m <- age_pob_m + val
    }
  }
  pob_h <- value_num("poblacion_h", NA_real_)
  pob_m <- value_num("poblacion_m", NA_real_)
  if (is.na(pob_h)) pob_h <- age_pob_h
  if (is.na(pob_m)) pob_m <- age_pob_m
  list(
    inei_zona = as.character(row$zona %||% ""),
    inei_manzana = as.character(row$manzana %||% ""),
    inei_id_manzana = as.character(row$id_manzana %||% ""),
    inei_viviendas = value_num("viviendas", 0),
    inei_poblacion = value_num("poblacion", 0),
    inei_pob_hombres = as.numeric(pob_h),
    inei_pob_mujeres = as.numeric(pob_m),
    inei_pob_18_plus = if (has_age_breakdown) as.numeric(age_pob_h + age_pob_m) else NULL,
    inei_age_breakdown = age_breakdown
  )
}

.hojas_ruta_normalize_block_features <- function(features, ubigeo, year = 2017L) {
  if (is.null(features) || !length(features)) return(list())
  inei_index <- .hojas_ruta_inei_index_for_ubigeo(ubigeo)
  lapply(features, function(feature) {
    props <- feature$properties %||% list()
    id <- as.character(props$ID_MANZANA %||% props$IDMZNAR %||% props$OBJECTID %||% "")
    props$ubigeo <- ubigeo
    props$cartografia_id <- id
    props$manzana_label <- .hojas_ruta_manzana_label(id)
    props$fuente_anio <- as.integer(year)
    if (!is.null(inei_index) && nzchar(id) && exists(id, envir = inei_index, inherits = FALSE)) {
      inei_row <- get(id, envir = inei_index, inherits = FALSE)
      enrichment <- .hojas_ruta_inei_props_from_row(inei_row)
      if (!is.null(enrichment)) {
        for (nm in names(enrichment)) props[[nm]] <- enrichment[[nm]]
      }
    }
    feature$properties <- props
    feature
  })
}

#' Cargar geometria de manzanas por distrito desde la capa Lima 2017
#'
#' @param ubigeo UBIGEO de distrito.
#' @param limit Maximo de manzanas a devolver para mantener fluida la UI.
#' @param refresh Si TRUE, ignora cache local.
#' @param allow_online Si TRUE, permite consultar la fuente remota y cachear.
#' @return Lista serializable con GeoJSON, metadatos y alertas.
#' @export
hojas_ruta_block_map_preview <- function(ubigeo, limit = 1200L, refresh = FALSE,
                                         allow_online = FALSE) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  meta <- hojas_ruta_cartografia_manzanas_meta(ubigeo)
  territory <- .hojas_ruta_lookup_territory(ubigeo)
  alerts <- list()

  if (is.null(profile)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_CARTOGRAPHY_UNSUPPORTED_COVERAGE",
      message = "La cartografia local de manzanas esta empaquetada para Lima Metropolitana y Callao."
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      returned = 0L,
      truncated = FALSE,
      feature_limit = 0L,
      cache = FALSE,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  feature_limit <- .hojas_ruta_int(limit, 0L)
  fetch_all <- feature_limit <= 0L
  limit_key <- if (fetch_all) "all" else as.character(feature_limit)
  packaged_file <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  cache_file <- file.path(.hojas_ruta_block_map_cache_dir(profile), sprintf("%s_%s.geojson", ubigeo, limit_key))

  if (file.exists(packaged_file) && (!isTRUE(refresh) || !isTRUE(allow_online))) {
    return(.hojas_ruta_block_map_read_local(packaged_file, meta, ubigeo, territory, "package"))
  }

  if (file.exists(cache_file) && !isTRUE(refresh)) {
    return(.hojas_ruta_block_map_read_local(cache_file, meta, ubigeo, territory, "cache"))
  }

  if (!isTRUE(allow_online)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_BLOCK_MAP_NOT_PACKAGED_LOCAL",
      message = paste(
        "La cartografia local de manzanas para este distrito aun no esta empaquetada.",
        sprintf("El software funciona sin internet; falta incorporar el paquete local %s.", meta$coverage)
      )
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      returned = 0L,
      truncated = FALSE,
      feature_limit = as.integer(if (fetch_all) 0L else feature_limit),
      cache = FALSE,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  tryCatch({
    where <- sprintf("%s LIKE '%s%%'", profile$id_field, ubigeo)
    count_json <- .hojas_ruta_fetch_json(profile$query_url, list(
      where = where,
      returnCountOnly = "true",
      f = "pjson"
    ))
    count <- as.integer(count_json$count %||% 0L)
    to_fetch <- if (fetch_all) count else min(count, feature_limit)
    if (!fetch_all && count > feature_limit) {
      alerts[[length(alerts) + 1L]] <- list(
        level = "info",
        code = "I_BLOCK_MAP_LIMITED",
        message = sprintf("Vista rapida: se muestran %s de %s manzanas para mantener fluido el mapa.",
                          format(to_fetch, big.mark = ","), format(count, big.mark = ","))
      )
    }

    features <- list()
    offset <- 0L
    while (length(features) < to_fetch) {
      page_size <- min(2000L, to_fetch - length(features))
      page <- .hojas_ruta_fetch_json(profile$query_url, list(
        where = where,
        outFields = profile$out_fields,
        returnGeometry = "true",
        outSR = "4326",
        orderByFields = "ID_MANZANA",
        resultOffset = offset,
        resultRecordCount = page_size,
        geometryPrecision = "6",
        f = "geojson"
      ))
      page_features <- page$features %||% list()
      if (!length(page_features)) break
      features <- c(features, page_features)
      offset <- offset + length(page_features)
    }
    features <- .hojas_ruta_normalize_block_features(features, ubigeo, meta$year)
    geojson <- list(
      type = "FeatureCollection",
      properties = list(
        ubigeo = ubigeo,
        distrito = territory$distrito,
        count = as.integer(count),
        returned = as.integer(length(features)),
        truncated = count > length(features),
        feature_limit = as.integer(if (fetch_all) 0L else feature_limit),
        source_version = meta$version,
        alerts = alerts
      ),
      features = features
    )
    jsonlite::write_json(geojson, cache_file, auto_unbox = TRUE, null = "null", digits = 8)
    list(
      ok = length(features) > 0L,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = as.integer(count),
      returned = as.integer(length(features)),
      truncated = count > length(features),
      feature_limit = as.integer(if (fetch_all) 0L else feature_limit),
      cache = FALSE,
      geojson = geojson,
      alerts = alerts
    )
  }, error = function(e) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "error",
      code = "E_BLOCK_MAP_SOURCE",
      message = paste("No se pudo consultar la cartografia de manzanas:", conditionMessage(e))
    )
    list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      returned = 0L,
      truncated = FALSE,
      feature_limit = as.integer(if (fetch_all) 0L else feature_limit),
      cache = FALSE,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    )
  })
}

#' GeoJSON de manzanas ya serializado para servir rapido por HTTP
#'
#' Evita que Plumber reserialice miles de features en cada click de distrito.
#' La respuesta sigue siendo JSON estandar y 100% local.
#' @export
hojas_ruta_block_map_preview_json <- function(ubigeo, limit = 1200L, refresh = FALSE,
                                              allow_online = FALSE) {
  key <- .hojas_ruta_block_map_file_cache_key(ubigeo, limit, refresh, allow_online)
  if (!isTRUE(refresh) && !isTRUE(allow_online)) {
    cached <- .hojas_ruta_block_map_response_cache[[key]]
    if (!is.null(cached)) return(cached)
    cache_file <- .hojas_ruta_block_map_response_cache_file(key)
    if (file.exists(cache_file)) {
      raw <- readBin(cache_file, what = "raw", n = file.info(cache_file)$size)
      .hojas_ruta_block_map_response_cache[[key]] <- raw
      return(raw)
    }
  }
  payload <- hojas_ruta_block_map_preview(
    ubigeo = ubigeo,
    limit = limit,
    refresh = refresh,
    allow_online = allow_online
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", digits = 8)
  raw <- charToRaw(enc2utf8(json))
  if (!isTRUE(refresh) && !isTRUE(allow_online)) {
    rm(list = ls(.hojas_ruta_block_map_response_cache), envir = .hojas_ruta_block_map_response_cache)
    .hojas_ruta_block_map_response_cache[[key]] <- raw
    cache_file <- .hojas_ruta_block_map_response_cache_file(key)
    writeBin(raw, cache_file)
  }
  raw
}

.hojas_ruta_zone_code_from_id <- function(id_manzana) {
  id <- as.character(id_manzana %||% "")
  out <- ifelse(nchar(id) >= 11L, substr(id, 7L, 11L), NA_character_)
  out[is.na(id)] <- NA_character_
  out
}

.hojas_ruta_block_geometry_to_multipolygon_parts <- function(geometry) {
  if (is.null(geometry) || is.null(geometry$type) || is.null(geometry$coordinates)) return(list())
  if (identical(geometry$type, "Polygon")) return(list(geometry$coordinates))
  if (identical(geometry$type, "MultiPolygon")) return(geometry$coordinates)
  list()
}

.hojas_ruta_zone_stats_for_ubigeo <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  frame <- hojas_ruta_inei_frame()
  sub <- frame[frame$ubigeo == ubigeo, , drop = FALSE]
  if (!nrow(sub)) {
    return(data.frame(
      ubigeo = character(0), departamento = character(0), provincia = character(0),
      distrito = character(0), zona = character(0), viviendas = numeric(0),
      poblacion = numeric(0), n_manzanas = integer(0), stringsAsFactors = FALSE
    ))
  }
  agg <- stats::aggregate(
    sub[c("viviendas", "poblacion")],
    by = sub[c("ubigeo", "departamento", "provincia", "distrito", "zona")],
    FUN = sum,
    na.rm = TRUE
  )
  counts <- stats::aggregate(sub["id_manzana"], by = sub[c("ubigeo", "zona")], FUN = length)
  names(counts)[3] <- "n_manzanas"
  agg <- merge(agg, counts, by = c("ubigeo", "zona"), all.x = TRUE)
  agg <- agg[order(agg$zona), , drop = FALSE]
  rownames(agg) <- NULL
  agg
}

.hojas_ruta_zone_feature_properties <- function(stats_row) {
  list(
    ubigeo = as.character(stats_row$ubigeo %||% ""),
    departamento = as.character(stats_row$departamento %||% ""),
    provincia = as.character(stats_row$provincia %||% ""),
    distrito = as.character(stats_row$distrito %||% ""),
    zona = as.character(stats_row$zona %||% ""),
    zona_label = paste("Zona", as.character(stats_row$zona %||% "")),
    n_manzanas = as.integer(stats_row$n_manzanas %||% 0L),
    viviendas = as.integer(round(as.numeric(stats_row$viviendas %||% 0))),
    poblacion = as.integer(round(as.numeric(stats_row$poblacion %||% 0)))
  )
}

.hojas_ruta_zone_map_fallback_geojson <- function(block_payload, zone_stats) {
  features <- block_payload$geojson$features %||% list()
  by_zone <- list()
  for (feature in features) {
    props <- feature$properties %||% list()
    id <- as.character(props$inei_id_manzana %||% props$ID_MANZANA %||% props$cartografia_id %||% "")
    zona <- as.character(props$inei_zona %||% .hojas_ruta_zone_code_from_id(id) %||% "")
    if (!nzchar(zona)) next
    by_zone[[zona]] <- c(by_zone[[zona]] %||% list(), list(feature))
  }
  zone_rows <- split(zone_stats, zone_stats$zona)
  out <- lapply(names(zone_rows), function(zona) {
    row <- zone_rows[[zona]][1, , drop = FALSE]
    zone_features <- by_zone[[zona]] %||% list()
    polygons <- unlist(lapply(zone_features, function(feature) {
      .hojas_ruta_block_geometry_to_multipolygon_parts(feature$geometry)
    }), recursive = FALSE)
    list(
      type = "Feature",
      id = paste(row$ubigeo[[1]], zona, sep = "-"),
      properties = .hojas_ruta_zone_feature_properties(row),
      geometry = if (length(polygons)) {
        list(type = "MultiPolygon", coordinates = polygons)
      } else {
        NULL
      }
    )
  })
  out <- out[!vapply(out, function(feature) is.null(feature$geometry), logical(1))]
  list(type = "FeatureCollection", features = out)
}

.hojas_ruta_zone_map_sf_geojson <- function(ubigeo, packaged_file, zone_stats) {
  if (!requireNamespace("sf", quietly = TRUE) || !file.exists(packaged_file)) return(NULL)
  read_path <- packaged_file
  tmp_read <- NULL
  if (grepl("[.]gz$", packaged_file)) {
    tmp_read <- tempfile(fileext = ".geojson")
    con <- gzfile(packaged_file, open = "rt", encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    writeLines(readLines(con, warn = FALSE), tmp_read, useBytes = TRUE)
    read_path <- tmp_read
  }
  sf_obj <- tryCatch(sf::st_read(read_path, quiet = TRUE, stringsAsFactors = FALSE), error = function(e) NULL)
  if (is.null(sf_obj) || !nrow(sf_obj)) return(NULL)
  id_col <- intersect(c("ID_MANZANA", "IDMZNAR", "cartografia_id"), names(sf_obj))[1]
  if (is.na(id_col) || !nzchar(id_col)) return(NULL)
  sf_obj$cartografia_id <- as.character(sf_obj[[id_col]])
  sf_obj$zona <- .hojas_ruta_zone_code_from_id(sf_obj$cartografia_id)
  sf_obj <- sf_obj[!is.na(sf_obj$zona) & nzchar(sf_obj$zona), , drop = FALSE]
  if (!nrow(sf_obj)) return(NULL)
  zones_sf <- tryCatch(
    stats::aggregate(sf_obj["cartografia_id"], by = list(zona = sf_obj$zona), FUN = length, do_union = TRUE),
    error = function(e) NULL
  )
  if (is.null(zones_sf) || !nrow(zones_sf)) return(NULL)
  names(zones_sf)[names(zones_sf) == "cartografia_id"] <- "n_geom_manzanas"
  zones_sf <- merge(zones_sf, zone_stats, by = "zona", all.x = TRUE, sort = FALSE)
  zones_sf$id <- paste(zones_sf$ubigeo, zones_sf$zona, sep = "-")
  zones_sf$zona_label <- paste("Zona", zones_sf$zona)
  zones_sf$viviendas <- as.integer(round(as.numeric(zones_sf$viviendas %||% 0)))
  zones_sf$poblacion <- as.integer(round(as.numeric(zones_sf$poblacion %||% 0)))
  zones_sf$n_manzanas <- as.integer(zones_sf$n_manzanas %||% zones_sf$n_geom_manzanas %||% 0L)
  keep <- c("id", "ubigeo", "departamento", "provincia", "distrito", "zona",
            "zona_label", "n_manzanas", "viviendas", "poblacion")
  zones_sf <- zones_sf[intersect(keep, names(zones_sf))]
  zones_sf <- sf::st_make_valid(zones_sf)
  tmp_out <- tempfile(fileext = ".geojson")
  tryCatch(
    sf::st_write(zones_sf, tmp_out, driver = "GeoJSON", quiet = TRUE, delete_dsn = TRUE),
    error = function(e) NULL
  )
  if (!file.exists(tmp_out)) return(NULL)
  geo <- tryCatch(jsonlite::read_json(tmp_out, simplifyVector = FALSE), error = function(e) NULL)
  if (is.null(geo) || !length(geo$features %||% list())) return(NULL)
  geo
}

.hojas_ruta_zone_map_file_cache_key <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  if (is.null(profile)) return(paste(ubigeo, "unsupported", "zone-json-v1", sep = "|"))
  packaged_file <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  info <- if (file.exists(packaged_file)) file.info(packaged_file) else NULL
  paste(
    ubigeo,
    normalizePath(packaged_file, mustWork = FALSE),
    if (!is.null(info)) info$size %||% 0 else 0,
    if (!is.null(info)) as.numeric(info$mtime %||% 0) else 0,
    "zone-json-v1",
    sep = "|"
  )
}

.hojas_ruta_zone_map_response_cache <- new.env(parent = emptyenv())

#' Cargar geometria operativa de zonas por distrito
#'
#' La geometria se deriva localmente desde las manzanas empaquetadas. Si `sf`
#' esta disponible se disuelven las manzanas por zona; si no, se entrega un
#' MultiPolygon agrupado por zona para conservar el modo offline.
#'
#' @param ubigeo UBIGEO de distrito.
#' @return Lista serializable con GeoJSON de zonas, metadatos y alertas.
#' @export
hojas_ruta_zone_map_preview <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  meta <- hojas_ruta_cartografia_manzanas_meta(ubigeo)
  territory <- .hojas_ruta_lookup_territory(ubigeo)
  alerts <- list()
  zone_stats <- .hojas_ruta_zone_stats_for_ubigeo(ubigeo)

  if (is.null(profile) || !nrow(zone_stats)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_ZONE_MAP_UNSUPPORTED_COVERAGE",
      message = "La capa de zonas esta disponible para distritos del marco Lima Metropolitana y Callao."
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      returned = 0L,
      cache = FALSE,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  packaged_file <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  if (!file.exists(packaged_file)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_ZONE_MAP_NOT_PACKAGED_LOCAL",
      message = "No se encontro la cartografia local de manzanas necesaria para derivar zonas."
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = as.integer(nrow(zone_stats)),
      returned = 0L,
      cache = FALSE,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  geojson <- .hojas_ruta_zone_map_sf_geojson(ubigeo, packaged_file, zone_stats)
  if (is.null(geojson)) {
    block_payload <- hojas_ruta_block_map_preview(ubigeo, limit = 0L, refresh = FALSE, allow_online = FALSE)
    geojson <- .hojas_ruta_zone_map_fallback_geojson(block_payload, zone_stats)
    alerts[[length(alerts) + 1L]] <- list(
      level = "info",
      code = "I_ZONE_MAP_GROUPED_MULTIPOLYGON",
      message = "La vista de zonas agrupa manzanas locales por zona censal."
    )
  }
  geojson$properties <- list(
    ubigeo = ubigeo,
    distrito = territory$distrito,
    count = as.integer(nrow(zone_stats)),
    returned = as.integer(length(geojson$features %||% list())),
    source_version = meta$version,
    geometry = "zona_derivada_de_manzanas",
    alerts = alerts
  )

  list(
    ok = length(geojson$features %||% list()) > 0L,
    source = meta,
    ubigeo = ubigeo,
    territory = territory,
    count = as.integer(nrow(zone_stats)),
    returned = as.integer(length(geojson$features %||% list())),
    cache = FALSE,
    geojson = geojson,
    alerts = alerts
  )
}

#' JSON de zonas ya serializado para servir rapido por HTTP
#' @export
hojas_ruta_zone_map_preview_json <- function(ubigeo) {
  key <- .hojas_ruta_zone_map_file_cache_key(ubigeo)
  cached <- .hojas_ruta_zone_map_response_cache[[key]]
  if (!is.null(cached)) return(cached)
  cache_file <- .hojas_ruta_block_map_response_cache_file(paste("zones", key, sep = "|"))
  if (file.exists(cache_file)) {
    raw <- readBin(cache_file, what = "raw", n = file.info(cache_file)$size)
    .hojas_ruta_zone_map_response_cache[[key]] <- raw
    return(raw)
  }
  payload <- hojas_ruta_zone_map_preview(ubigeo)
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", digits = 8)
  raw <- charToRaw(enc2utf8(json))
  rm(list = ls(.hojas_ruta_zone_map_response_cache), envir = .hojas_ruta_zone_map_response_cache)
  .hojas_ruta_zone_map_response_cache[[key]] <- raw
  writeBin(raw, cache_file)
  raw
}

.hojas_ruta_street_map_file_cache_key <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  packaged_file <- .hojas_ruta_street_map_packaged_file(ubigeo)
  info <- if (file.exists(packaged_file)) file.info(packaged_file) else NULL
  paste(
    ubigeo,
    normalizePath(packaged_file, mustWork = FALSE),
    if (!is.null(info)) info$size %||% 0 else 0,
    if (!is.null(info)) as.numeric(info$mtime %||% 0) else 0,
    "street-json-v3-context-neighbor",
    sep = "|"
  )
}

.hojas_ruta_street_map_response_cache <- new.env(parent = emptyenv())

.hojas_ruta_slim_street_features <- function(features) {
  if (is.null(features) || !length(features)) return(list())
  lapply(features, function(feature) {
    props <- feature$properties %||% list()
    feature$properties <- list(
      osm_id = as.character(props$osm_id %||% ""),
      name = as.character(props$name %||% ""),
      highway = as.character(props$highway %||% ""),
      class_group = as.character(props$class_group %||% ""),
      rank = as.integer(props$rank %||% 9L),
      avenue_like = as.logical(props$avenue_like %||% FALSE),
      display_name = as.character(props$display_name %||% props$name %||% ""),
      length_m = suppressWarnings(as.numeric(props$length_m %||% NA_real_))
    )
    feature
  })
}

.hojas_ruta_geometry_bbox <- function(geometry) {
  rings <- .hojas_ruta_geometry_rings(geometry)
  lines <- .hojas_ruta_geometry_line_parts(geometry)
  points <- .hojas_ruta_geometry_points(geometry)
  parts <- c(rings, lines, if (nrow(points)) list(points) else list())
  .hojas_ruta_bbox_from_rings(parts)
}

.hojas_ruta_block_map_bbox_for_ubigeo <- function(ubigeo) {
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  if (is.null(profile)) return(NULL)
  packaged_file <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  if (!file.exists(packaged_file)) return(NULL)
  local <- tryCatch(.hojas_ruta_read_json_any(packaged_file), error = function(e) NULL)
  features <- local$features %||% list()
  if (!length(features)) return(NULL)
  rings <- unlist(lapply(features, function(feature) {
    .hojas_ruta_geometry_rings(feature$geometry)
  }), recursive = FALSE)
  .hojas_ruta_bbox_from_rings(rings)
}

.hojas_ruta_street_feature_intersects <- function(feature, bbox) {
  if (is.null(bbox)) return(TRUE)
  .hojas_ruta_bbox_intersects(.hojas_ruta_geometry_bbox(feature$geometry), bbox)
}

.hojas_ruta_street_feature_key <- function(feature) {
  props <- feature$properties %||% list()
  bbox <- .hojas_ruta_geometry_bbox(feature$geometry)
  bbox_key <- if (is.null(bbox)) {
    "no-bbox"
  } else {
    paste(format(round(as.numeric(bbox), 7), scientific = FALSE), collapse = ":")
  }
  paste(as.character(props$osm_id %||% props$id %||% ""), bbox_key, sep = "|")
}

.hojas_ruta_street_neighbor_features <- function(ubigeo, bbox) {
  if (is.null(bbox)) return(list(features = list(), ubigeos = character(0)))
  dir <- .hojas_ruta_street_cartography_dir()
  files <- list.files(dir, pattern = "[.]geojson([.]gz)?$", full.names = TRUE)
  if (!length(files)) return(list(features = list(), ubigeos = character(0)))
  active_name <- sprintf("%s.geojson", ubigeo)
  files <- files[!basename(files) %in% c(active_name, paste0(active_name, ".gz"))]
  out <- list()
  used <- character(0)
  for (path in files) {
    local <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
    features <- local$features %||% list()
    if (!length(features)) next
    keep <- vapply(features, .hojas_ruta_street_feature_intersects, logical(1), bbox = bbox)
    if (!any(keep)) next
    out <- c(out, features[keep])
    used <- c(used, sub("[.]geojson([.]gz)?$", "", basename(path)))
  }
  list(features = out, ubigeos = unique(used))
}

#' Cargar capa vial local por distrito desde OpenStreetMap/Geofabrik
#'
#' @param ubigeo UBIGEO de distrito.
#' @return Lista serializable con GeoJSON, metadatos y alertas.
#' @export
hojas_ruta_street_map_preview <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  meta <- hojas_ruta_cartografia_calles_meta(ubigeo)
  territory <- .hojas_ruta_lookup_territory(ubigeo)
  alerts <- list()
  packaged_file <- .hojas_ruta_street_map_packaged_file(ubigeo)

  if (!file.exists(packaged_file)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_STREET_MAP_NOT_PACKAGED_LOCAL",
      message = "La capa local de calles esta empaquetada para Lima Metropolitana y Callao, pero falta este distrito."
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  local <- .hojas_ruta_read_json_any(packaged_file)
  active_features <- local$features %||% list()
  district_bbox <- .hojas_ruta_block_map_bbox_for_ubigeo(ubigeo)
  context_bbox <- .hojas_ruta_bbox_expand(district_bbox, pad = 0.10)
  neighbor_pack <- .hojas_ruta_street_neighbor_features(ubigeo, context_bbox)
  merged <- c(active_features, neighbor_pack$features %||% list())
  if (length(merged)) {
    keys <- vapply(merged, .hojas_ruta_street_feature_key, character(1))
    merged <- merged[!duplicated(keys)]
  }
  local$features <- .hojas_ruta_slim_street_features(merged)
  local$properties <- local$properties %||% list()
  local$properties$active_ubigeo <- ubigeo
  local$properties$context_ubigeos <- neighbor_pack$ubigeos %||% character(0)
  returned <- length(local$features %||% list())
  list(
    ok = returned > 0L,
    source = meta,
    ubigeo = ubigeo,
    territory = territory,
    count = as.integer(returned),
    geojson = local,
    alerts = alerts
  )
}

#' JSON de capa vial local ya serializado para servir rapido por HTTP
#' @export
hojas_ruta_street_map_preview_json <- function(ubigeo) {
  key <- .hojas_ruta_street_map_file_cache_key(ubigeo)
  cached <- .hojas_ruta_street_map_response_cache[[key]]
  if (!is.null(cached)) return(cached)
  cache_file <- .hojas_ruta_block_map_response_cache_file(paste("streets", key, sep = "|"))
  if (file.exists(cache_file)) {
    raw <- readBin(cache_file, what = "raw", n = file.info(cache_file)$size)
    .hojas_ruta_street_map_response_cache[[key]] <- raw
    return(raw)
  }
  payload <- hojas_ruta_street_map_preview(ubigeo)
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", digits = 8)
  raw <- charToRaw(enc2utf8(json))
  rm(list = ls(.hojas_ruta_street_map_response_cache), envir = .hojas_ruta_street_map_response_cache)
  .hojas_ruta_street_map_response_cache[[key]] <- raw
  writeBin(raw, cache_file)
  raw
}

.hojas_ruta_context_map_file_cache_key <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  packaged_file <- .hojas_ruta_context_map_packaged_file(ubigeo)
  info <- if (file.exists(packaged_file)) file.info(packaged_file) else NULL
  paste(
    ubigeo,
    normalizePath(packaged_file, mustWork = FALSE),
    if (!is.null(info)) info$size %||% 0 else 0,
    if (!is.null(info)) as.numeric(info$mtime %||% 0) else 0,
    normalizePath(hojas_ruta_contexto_curado_path(), mustWork = FALSE),
    .hojas_ruta_checksum(hojas_ruta_contexto_curado_path()) %||% "",
    "context-json-v4-neighbor-curated-filtered",
    sep = "|"
  )
}

.hojas_ruta_context_map_response_cache <- new.env(parent = emptyenv())

.hojas_ruta_slim_context_features <- function(features) {
  if (is.null(features) || !length(features)) return(list())
  lapply(features, function(feature) {
    props <- feature$properties %||% list()
    feature$properties <- list(
      osm_id = as.character(props$osm_id %||% ""),
      name = as.character(props$name %||% ""),
      display_name = as.character(props$display_name %||% props$name %||% ""),
      feature_class = as.character(props$feature_class %||% "context"),
      kind = as.character(props$kind %||% ""),
      rank = as.integer(props$rank %||% 9L),
      area_m2 = suppressWarnings(as.numeric(props$area_m2 %||% NA_real_)),
      length_m = suppressWarnings(as.numeric(props$length_m %||% NA_real_)),
      source_kind = as.character(props$source_kind %||% "osm"),
      source = as.character(props$source %||% ""),
      source_url = as.character(props$source_url %||% ""),
      confidence = as.character(props$confidence %||% ""),
      aliases = props$aliases %||% list()
    )
    feature
  })
}

.hojas_ruta_context_feature_allowed <- function(feature) {
  props <- feature$properties %||% list()
  cls <- as.character(props$feature_class %||% "context")
  kind <- as.character(props$kind %||% "")
  if (cls %in% c("green", "water", "coast", "waterway", "square")) return(TRUE)
  if (cls %in% c("commerce", "transit", "rail")) return(FALSE)
  public_kinds <- c("police", "hospital", "clinic", "fire_station", "townhall", "courthouse", "marketplace", "library")
  if (cls %in% c("public", "landmark")) return(kind %in% public_kinds)
  FALSE
}

.hojas_ruta_filter_context_features <- function(features) {
  if (is.null(features) || !length(features)) return(list())
  features[vapply(features, .hojas_ruta_context_feature_allowed, logical(1))]
}

.hojas_ruta_context_neighbor_features <- function(ubigeo, bbox) {
  if (is.null(bbox)) return(list(features = list(), ubigeos = character(0)))
  dir <- .hojas_ruta_context_cartography_dir()
  files <- list.files(dir, pattern = "[.]geojson([.]gz)?$", full.names = TRUE)
  if (!length(files)) return(list(features = list(), ubigeos = character(0)))
  active_name <- sprintf("%s.geojson", ubigeo)
  files <- files[!basename(files) %in% c(active_name, paste0(active_name, ".gz"))]
  out <- list()
  used <- character(0)
  for (path in files) {
    local <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
    features <- local$features %||% list()
    if (!length(features)) next
    keep <- vapply(features, .hojas_ruta_street_feature_intersects, logical(1), bbox = bbox)
    if (!any(keep)) next
    out <- c(out, features[keep])
    used <- c(used, sub("[.]geojson([.]gz)?$", "", basename(path)))
  }
  list(features = out, ubigeos = unique(used))
}

.hojas_ruta_context_curated_features <- function(ubigeo, bbox, existing_features = list()) {
  path <- hojas_ruta_contexto_curado_path()
  if (!file.exists(path)) return(list())
  local <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
  features <- local$features %||% list()
  if (!length(features)) return(list())
  existing_names <- unique(tolower(trimws(unlist(lapply(existing_features, function(feature) {
    props <- feature$properties %||% list()
    c(props$name %||% "", props$display_name %||% "", unlist(props$aliases %||% list()))
  }), use.names = FALSE))))
  existing_names <- existing_names[nzchar(existing_names)]
  out <- list()
  for (feature in features) {
    props <- feature$properties %||% list()
    related <- as.character(unlist(props$related_ubigeos %||% list(), use.names = FALSE))
    if (length(related) && !ubigeo %in% related && is.null(bbox)) next
    if (!.hojas_ruta_street_feature_intersects(feature, bbox)) next
    names_i <- unique(tolower(trimws(c(
      props$name %||% "",
      props$display_name %||% "",
      unlist(props$aliases %||% list(), use.names = FALSE)
    ))))
    names_i <- names_i[nzchar(names_i)]
    if (length(intersect(names_i, existing_names))) next
    out[[length(out) + 1L]] <- feature
  }
  out
}

.hojas_ruta_context_feature_key <- function(feature) {
  props <- feature$properties %||% list()
  bbox <- .hojas_ruta_geometry_bbox(feature$geometry)
  bbox_key <- if (is.null(bbox)) {
    "no-bbox"
  } else {
    paste(format(round(as.numeric(bbox), 7), scientific = FALSE), collapse = ":")
  }
  paste(
    as.character(props$source_kind %||% "osm"),
    as.character(props$osm_id %||% props$id %||% feature$id %||% ""),
    tolower(as.character(props$display_name %||% props$name %||% "")),
    bbox_key,
    sep = "|"
  )
}

#' Cargar capa local de contexto urbano OSM por distrito
#'
#' @param ubigeo UBIGEO de distrito.
#' @return Lista serializable con GeoJSON, metadatos y alertas.
#' @export
hojas_ruta_context_map_preview <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  meta <- hojas_ruta_cartografia_contexto_meta(ubigeo)
  territory <- .hojas_ruta_lookup_territory(ubigeo)
  alerts <- list()
  packaged_file <- .hojas_ruta_context_map_packaged_file(ubigeo)

  if (!file.exists(packaged_file)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_CONTEXT_MAP_NOT_PACKAGED_LOCAL",
      message = "La capa local de contexto urbano aun no esta empaquetada para este distrito."
    )
    return(list(
      ok = FALSE,
      source = meta,
      ubigeo = ubigeo,
      territory = territory,
      count = 0L,
      geojson = list(type = "FeatureCollection", features = list()),
      alerts = alerts
    ))
  }

  local <- .hojas_ruta_read_json_any(packaged_file)
  active_features <- local$features %||% list()
  district_bbox <- .hojas_ruta_block_map_bbox_for_ubigeo(ubigeo)
  context_bbox <- .hojas_ruta_bbox_expand(district_bbox, pad = 0.10)
  neighbor_pack <- .hojas_ruta_context_neighbor_features(ubigeo, context_bbox)
  merged <- c(active_features, neighbor_pack$features %||% list())
  curated <- .hojas_ruta_context_curated_features(ubigeo, context_bbox, merged)
  merged <- c(merged, curated)
  merged <- .hojas_ruta_filter_context_features(merged)
  if (length(merged)) {
    keys <- vapply(merged, .hojas_ruta_context_feature_key, character(1))
    merged <- merged[!duplicated(keys)]
  }
  local$features <- .hojas_ruta_slim_context_features(merged)
  local$properties <- local$properties %||% list()
  local$properties$active_ubigeo <- ubigeo
  local$properties$context_ubigeos <- neighbor_pack$ubigeos %||% character(0)
  local$properties$curated_count <- length(curated)
  returned <- length(local$features %||% list())
  list(
    ok = returned > 0L,
    source = meta,
    ubigeo = ubigeo,
    territory = territory,
    count = as.integer(returned),
    returned = as.integer(returned),
    geojson = local,
    alerts = alerts
  )
}

#' JSON de contexto urbano local ya serializado para servir rapido por HTTP
#' @export
hojas_ruta_context_map_preview_json <- function(ubigeo) {
  key <- .hojas_ruta_context_map_file_cache_key(ubigeo)
  cached <- .hojas_ruta_context_map_response_cache[[key]]
  if (!is.null(cached)) return(cached)
  cache_file <- .hojas_ruta_block_map_response_cache_file(paste("context", key, sep = "|"))
  if (file.exists(cache_file)) {
    raw <- readBin(cache_file, what = "raw", n = file.info(cache_file)$size)
    .hojas_ruta_context_map_response_cache[[key]] <- raw
    return(raw)
  }
  payload <- hojas_ruta_context_map_preview(ubigeo)
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", digits = 8)
  raw <- charToRaw(enc2utf8(json))
  rm(list = ls(.hojas_ruta_context_map_response_cache), envir = .hojas_ruta_context_map_response_cache)
  .hojas_ruta_context_map_response_cache[[key]] <- raw
  writeBin(raw, cache_file)
  raw
}

.hojas_ruta_frame_meta <- function(frame = hojas_ruta_inei_frame()) {
  path <- hojas_ruta_inei_frame_path()
  age <- tryCatch(hojas_ruta_inei_age_simple(), error = function(e) data.frame())
  full_frame <- grepl("manzanas_full[.]csv[.]gz$", basename(path))
  list(
    ok = TRUE,
    source = HOJAS_RUTA_INEI_SOURCE,
    year = 2017L,
    version = HOJAS_RUTA_INEI_VERSION,
    packaged_at = "2026-05-03",
    checksum = .hojas_ruta_checksum(path),
    coverage = if (full_frame) "Lima Metropolitana y Callao" else "Piloto Lima/Callao",
    pilot = !full_frame,
    granularity = if (full_frame) "manzana_urbana" else "manzana_piloto",
    path = normalizePath(path, mustWork = FALSE),
    n_departamentos = length(unique(frame$departamento)),
    n_provincias = length(unique(paste(frame$departamento, frame$provincia))),
    n_distritos = length(unique(frame$ubigeo)),
    n_manzanas = nrow(frame),
    viviendas = as.integer(sum(frame$viviendas, na.rm = TRUE)),
    poblacion = as.integer(sum(frame$poblacion, na.rm = TRUE)),
    age_data = .hojas_ruta_age_simple_meta(age),
    nse_data = list(
      ok = FALSE,
      available = FALSE,
      source = "",
      message = "NSE no disponible en el marco local INEI 2017 empaquetado."
    ),
    block_cartography = hojas_ruta_cartografia_manzanas_meta(),
    street_cartography = hojas_ruta_cartografia_calles_meta(),
    context_cartography = hojas_ruta_cartografia_contexto_meta(),
    methods = .hojas_ruta_sampling_methods(),
    note = if (full_frame) {
      paste(
        "Marco local completo para Lima Metropolitana y Callao urbano.",
        "Las manzanas se empatan por ID cartografico con conteos REDATAM CPV2017;",
        "Callao mantiene cartografia 2019 claramente separada de la base poblacional 2017."
      )
    } else {
      paste(
        "Marco empaquetado para el piloto funcional Lima/Callao.",
        "Las cuotas por edad/sexo usan edad simple oficial INEI REDATAM cuando esta disponible;",
        "las manzanas siguen limitadas al piloto hasta empaquetar el marco completo."
      )
    }
  )
}

.hojas_ruta_default_integrated_config <- function(frame = hojas_ruta_inei_frame()) {
  list(
    n_objetivo = 120L,
    n_mode = "total",
    n_por_distrito = list(),
    territorios = list(),
    row_var = "distrito",
    col_var = "rango_edad",
    subquota_var = "sexo",
    measure_var = "viviendas",
    sampling_method = "pps",
    seed = 2017L,
    max_per_manzana = 8L,
    entrevistas_por_manzana = 6L,
    age_range_mode = "manual",
    zone_allocation = "proportional",
    age_ranges = .hojas_ruta_age_defs_default(),
    sample_size_mode = "calculator",
    sample_size = .hojas_ruta_normalize_sample_size(list(), "pps")
  )
}

.hojas_ruta_scalar <- function(x, default = "") {
  if (is.null(x) || length(x) == 0L) return(default)
  x <- unlist(x, recursive = TRUE, use.names = FALSE)
  if (!length(x) || is.na(x[1])) return(default)
  as.character(x[1])
}

.hojas_ruta_int <- function(x, default = NA_integer_) {
  out <- suppressWarnings(as.integer(.hojas_ruta_scalar(x, as.character(default))))
  if (is.na(out)) default else out
}

.hojas_ruta_num <- function(x, default = NA_real_) {
  out <- suppressWarnings(as.numeric(.hojas_ruta_scalar(x, as.character(default))))
  if (is.na(out)) default else out
}

.hojas_ruta_bool <- function(x, default = FALSE) {
  if (is.null(x) || length(x) == 0L) return(default)
  if (is.logical(x)) return(isTRUE(x[[1]]))
  value <- tolower(.hojas_ruta_scalar(x, if (isTRUE(default)) "true" else "false"))
  value %in% c("1", "true", "t", "yes", "y", "si", "sí")
}

.hojas_ruta_prop <- function(x, default, min = 0.0001, max = 0.9999) {
  out <- .hojas_ruta_num(x, default)
  if (out > 1) out <- out / 100
  pmin(pmax(out, min), max)
}

.hojas_ruta_design_effect_default <- function(method = "pps") {
  method <- .hojas_ruta_scalar(method, "pps")
  if (identical(method, "sistematico")) return(1.1)
  if (identical(method, "conglomerado_fijo")) return(2.0)
  1.5
}

.hojas_ruta_allocation_modes <- function() c("proportional", "uniform", "compromise")

.hojas_ruta_normalize_design_effect_overrides <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x) && all(c("ubigeo", "deff") %in% names(x))) {
    vals <- stats::setNames(x$deff, x$ubigeo)
  } else if (is.list(x) && length(names(x))) {
    vals <- unlist(x, recursive = TRUE, use.names = TRUE)
  } else {
    return(list())
  }
  nms <- as.character(names(vals))
  vals <- suppressWarnings(as.numeric(vals))
  ok <- !is.na(vals) & vals >= 0.1 & vals <= 20 & nzchar(nms)
  vals <- vals[ok]
  names(vals) <- nms[ok]
  as.list(vals)
}

.hojas_ruta_normalize_margin_overrides <- function(x) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x) && all(c("ubigeo", "margin") %in% names(x))) {
    vals <- stats::setNames(x$margin, x$ubigeo)
  } else if (is.list(x) && length(names(x))) {
    vals <- unlist(x, recursive = TRUE, use.names = TRUE)
  } else {
    return(list())
  }
  nms <- as.character(names(vals))
  vals <- suppressWarnings(as.numeric(vals))
  vals <- ifelse(!is.na(vals) & vals > 1, vals / 100, vals)
  ok <- !is.na(vals) & vals >= 0.001 & vals <= 0.8 & nzchar(nms)
  vals <- vals[ok]
  names(vals) <- nms[ok]
  as.list(vals)
}

.hojas_ruta_normalize_sample_size <- function(x = list(), method = "pps") {
  if (is.null(x) || !is.list(x)) x <- list()
  allocation_mode <- .hojas_ruta_scalar(x$allocation_mode, "proportional")
  if (!allocation_mode %in% .hojas_ruta_allocation_modes()) allocation_mode <- "proportional"
  enforce_district <- .hojas_ruta_bool(x$enforce_district_floor, TRUE)
  list(
    confidence_level = .hojas_ruta_prop(x$confidence_level, 0.95, min = 0.5, max = 0.999),
    margin_total = .hojas_ruta_prop(x$margin_total, 0.05, min = 0.001, max = 0.5),
    margin_district = .hojas_ruta_prop(x$margin_district, 0.10, min = 0.001, max = 0.8),
    margin_district_overrides = .hojas_ruta_normalize_margin_overrides(x$margin_district_overrides),
    expected_proportion = .hojas_ruta_prop(x$expected_proportion, 0.50, min = 0.001, max = 0.999),
    design_effect = max(0.1, .hojas_ruta_num(x$design_effect, .hojas_ruta_design_effect_default(method))),
    design_effect_overrides = .hojas_ruta_normalize_design_effect_overrides(x$design_effect_overrides),
    allocation_mode = allocation_mode,
    enforce_district_floor = enforce_district,
    response_rate = .hojas_ruta_prop(x$response_rate, 0.90, min = 0.01, max = 1),
    apply_fpc = .hojas_ruta_bool(x$apply_fpc, TRUE)
  )
}

.hojas_ruta_design_effect_for <- function(params, ubigeo = NULL) {
  base <- max(0.1, as.numeric(params$design_effect %||% 1.5))
  if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) return(base)
  overrides <- params$design_effect_overrides %||% list()
  key <- as.character(ubigeo)
  if (length(overrides) && key %in% names(overrides)) {
    val <- suppressWarnings(as.numeric(overrides[[key]]))
    if (!is.na(val) && val >= 0.1) return(val)
  }
  base
}

.hojas_ruta_margin_district_for <- function(params, ubigeo = NULL) {
  base <- as.numeric(params$margin_district %||% 0.10)
  if (is.null(ubigeo) || !nzchar(as.character(ubigeo))) return(base)
  overrides <- params$margin_district_overrides %||% list()
  key <- as.character(ubigeo)
  if (length(overrides) && key %in% names(overrides)) {
    val <- suppressWarnings(as.numeric(overrides[[key]]))
    if (!is.na(val) && val >= 0.001 && val <= 0.8) return(val)
  }
  base
}

.hojas_ruta_sample_size_z <- function(confidence_level) {
  stats::qnorm((1 + confidence_level) / 2)
}

.hojas_ruta_sample_size_n <- function(population, params, margin = params$margin_total, ubigeo = NULL) {
  population <- max(0, as.numeric(population %||% 0))
  if (population <= 0) return(0L)
  z <- .hojas_ruta_sample_size_z(params$confidence_level)
  pq <- params$expected_proportion * (1 - params$expected_proportion)
  deff <- .hojas_ruta_design_effect_for(params, ubigeo)
  n_srs <- (z^2 * pq) / (margin^2)
  n_design <- deff * n_srs
  n_fpc <- if (isTRUE(params$apply_fpc)) {
    population * n_design / (population + n_design - 1)
  } else {
    n_design
  }
  as.integer(min(population, ceiling(n_fpc)))
}

.hojas_ruta_margin_error <- function(population, n, params, ubigeo = NULL) {
  population <- max(0, as.numeric(population %||% 0))
  n <- max(0, as.numeric(n %||% 0))
  if (population <= 0 || n <= 0) return(NA_real_)
  z <- .hojas_ruta_sample_size_z(params$confidence_level)
  pq <- params$expected_proportion * (1 - params$expected_proportion)
  deff <- .hojas_ruta_design_effect_for(params, ubigeo)
  fpc <- if (isTRUE(params$apply_fpc) && population > 1) {
    sqrt(max(0, (population - min(n, population)) / (population - 1)))
  } else {
    1
  }
  z * sqrt(deff * pq / n) * fpc
}

.hojas_ruta_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  out <- as.character(unlist(x, recursive = TRUE, use.names = FALSE))
  out <- out[!is.na(out) & nzchar(out)]
  unique(out)
}

.hojas_ruta_named_int_map <- function(x, allowed = character(0)) {
  if (is.null(x) || !length(x)) return(list())
  if (is.data.frame(x) && all(c("ubigeo", "n") %in% names(x))) {
    vals <- stats::setNames(x$n, x$ubigeo)
  } else if (is.list(x) && length(names(x))) {
    vals <- unlist(x, recursive = TRUE, use.names = TRUE)
  } else {
    return(list())
  }
  nms <- as.character(names(vals))
  vals <- suppressWarnings(as.integer(vals))
  names(vals) <- nms
  vals <- vals[!is.na(vals) & vals >= 0L & nzchar(names(vals))]
  if (length(allowed)) vals <- vals[names(vals) %in% allowed]
  as.list(vals)
}

.hojas_ruta_normalize_age_ranges <- function(x, defaults = .hojas_ruta_age_defs_default()) {
  if (is.null(x) || !length(x)) return(defaults)
  if (is.data.frame(x)) {
    rows <- lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE]))
  } else if (is.list(x) && all(vapply(x, is.list, logical(1)))) {
    rows <- x
  } else {
    return(defaults)
  }
  out <- list()
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    min_age <- .hojas_ruta_int(row$min, NA_integer_)
    max_age <- .hojas_ruta_int(row$max, NA_integer_)
    if (is.na(min_age) || min_age < 0L) next
    if (!is.na(max_age) && max_age < min_age) next
    label <- .hojas_ruta_scalar(row$label, "")
    if (!nzchar(label)) label <- if (is.na(max_age)) paste0(min_age, "+") else paste0(min_age, "-", max_age)
    id <- .hojas_ruta_scalar(row$id, "")
    if (!nzchar(id)) id <- hojas_ruta_sanitize_filename(label)
    out[[length(out) + 1L]] <- list(
      id = id,
      label = label,
      min = as.integer(min_age),
      max = if (is.na(max_age)) NA_integer_ else as.integer(max_age)
    )
  }
  if (!length(out)) return(defaults)
  mins <- vapply(out, `[[`, integer(1), "min")
  out[order(mins)]
}

.hojas_ruta_age_range_modes <- function() c("manual", "terciles", "cuartiles", "quintiles")

.hojas_ruta_age_range_count <- function(mode) {
  if (identical(mode, "terciles")) return(3L)
  if (identical(mode, "cuartiles")) return(4L)
  if (identical(mode, "quintiles")) return(5L)
  NA_integer_
}

.hojas_ruta_age_ranges_from_population <- function(territorios, mode) {
  k <- .hojas_ruta_age_range_count(mode)
  if (is.na(k) || k < 2L) return(.hojas_ruta_age_defs_default())
  age <- tryCatch(hojas_ruta_inei_age_simple(required = TRUE), error = function(e) data.frame())
  if (!nrow(age)) return(.hojas_ruta_age_defs_default())
  territorios <- .hojas_ruta_chr_vec(territorios)
  if (!length(territorios)) return(.hojas_ruta_age_defs_default())
  age <- age[age$ubigeo %in% territorios & age$edad >= 18L, , drop = FALSE]
  if (!nrow(age)) return(.hojas_ruta_age_defs_default())
  agg <- stats::aggregate(
    age$poblacion,
    by = list(edad = as.integer(age$edad)),
    FUN = sum,
    na.rm = TRUE
  )
  names(agg)[2] <- "poblacion"
  agg <- agg[order(agg$edad), , drop = FALSE]
  agg$poblacion[is.na(agg$poblacion) | agg$poblacion < 0] <- 0
  total <- sum(agg$poblacion, na.rm = TRUE)
  if (total <= 0) return(.hojas_ruta_age_defs_default())
  agg$cum <- cumsum(agg$poblacion)
  min_age <- max(18L, min(agg$edad, na.rm = TRUE))
  max_age <- max(agg$edad, na.rm = TRUE)
  if (!is.finite(max_age) || max_age <= min_age) return(.hojas_ruta_age_defs_default())

  breaks <- integer(0)
  previous <- min_age - 1L
  for (i in seq_len(k - 1L)) {
    target <- total * i / k
    candidates <- agg$edad[agg$cum >= target]
    if (!length(candidates)) next
    br <- as.integer(candidates[[1]])
    br <- max(br, previous + 1L)
    br <- min(br, max_age - (k - i))
    if (br > previous && br < max_age) {
      breaks <- c(breaks, br)
      previous <- br
    }
  }
  breaks <- unique(breaks)
  if (length(breaks) < k - 1L) {
    fallback <- stats::quantile(agg$edad, probs = seq(1 / k, (k - 1) / k), type = 1, names = FALSE)
    fallback <- as.integer(pmax(min_age, pmin(max_age - 1L, fallback)))
    breaks <- unique(sort(c(breaks, fallback)))
  }
  breaks <- breaks[breaks >= min_age & breaks < max_age]
  if (length(breaks) > k - 1L) breaks <- breaks[seq_len(k - 1L)]
  starts <- c(min_age, breaks + 1L)
  maxs <- c(breaks, NA_integer_)
  out <- vector("list", length(starts))
  for (i in seq_along(starts)) {
    label <- if (is.na(maxs[[i]])) paste0(starts[[i]], "+") else paste0(starts[[i]], "-", maxs[[i]])
    out[[i]] <- list(
      id = paste0(mode, "_", gsub("[^0-9A-Za-z]+", "_", label)),
      label = label,
      min = as.integer(starts[[i]]),
      max = if (is.na(maxs[[i]])) NA_integer_ else as.integer(maxs[[i]])
    )
  }
  out
}

.hojas_ruta_route_size <- function(cfg) {
  max(1L, as.integer(cfg$entrevistas_por_manzana %||% 1L))
}

.hojas_ruta_route_examples <- function(n, route_size) {
  route_size <- max(1L, as.integer(route_size))
  n <- max(0L, as.integer(n %||% 0L))
  lower <- max(route_size, floor(n / route_size) * route_size)
  if (lower == n) lower <- max(route_size, n - route_size)
  examples <- unique(c(lower, lower + route_size, lower + route_size * 2L))
  examples[examples > 0L]
}

.hojas_ruta_route_multiple_status <- function(cfg, frame = NULL) {
  route_size <- .hojas_ruta_route_size(cfg)
  alerts <- list()
  ok <- TRUE
  invalid <- data.frame(
    ubigeo = character(0),
    distrito = character(0),
    n = integer(0),
    stringsAsFactors = FALSE
  )
  if (identical(cfg$n_mode, "por_distrito")) {
    n_map <- unlist(cfg$n_por_distrito, use.names = TRUE)
    selected <- unlist(cfg$territorios, use.names = FALSE)
    for (ubigeo in selected) {
      n_i <- as.integer(if (ubigeo %in% names(n_map)) n_map[[ubigeo]] else 0L)
      if (is.na(n_i) || n_i <= 0L || n_i %% route_size == 0L) next
      ok <- FALSE
      distrito <- ubigeo
      if (!is.null(frame) && nrow(frame)) {
        d <- unique(as.character(frame$distrito[frame$ubigeo == ubigeo]))
        if (length(d) && nzchar(d[[1]])) distrito <- d[[1]]
      }
      invalid <- rbind(
        invalid,
        data.frame(ubigeo = ubigeo, distrito = distrito, n = n_i, stringsAsFactors = FALSE)
      )
    }
    if (nrow(invalid)) {
      first <- invalid[1, , drop = FALSE]
      examples <- paste(format(.hojas_ruta_route_examples(first$n, route_size), big.mark = ","), collapse = ", ")
      alerts[[length(alerts) + 1L]] <- list(
        level = "error",
        code = "E_ROUTE_N_NOT_MULTIPLE",
        message = sprintf(
          "El N por distrito debe calzar con rutas completas. En %s, con %d encuestas por ruta, usa valores como %s.",
          first$distrito[[1]], route_size, examples
        )
      )
    }
  } else {
    n <- as.integer(cfg$n_objetivo %||% 0L)
    if (is.na(n) || n <= 0L || n %% route_size != 0L) {
      ok <- FALSE
      examples <- paste(format(.hojas_ruta_route_examples(n, route_size), big.mark = ","), collapse = ", ")
      alerts[[length(alerts) + 1L]] <- list(
        level = "error",
        code = "E_ROUTE_N_NOT_MULTIPLE",
        message = sprintf(
          "Con %d encuestas por ruta, el N debe ser multiplo de %d. Ejemplos: %s.",
          route_size, route_size, examples
        )
      )
    }
  }
  list(
    ok = ok,
    route_size = route_size,
    invalid = invalid,
    alerts = alerts
  )
}

#' Normalizar configuracion integrada de hojas de ruta
#'
#' @param config Lista proveniente del frontend.
#' @return Lista normalizada.
#' @export
hojas_ruta_integrada_normalize_config <- function(config = list()) {
  frame <- hojas_ruta_inei_frame()
  defaults <- .hojas_ruta_default_integrated_config(frame)
  if (is.null(config) || !is.list(config)) config <- list()
  method <- .hojas_ruta_scalar(config$sampling_method %||% config$method,
                               defaults$sampling_method)
  if (!method %in% vapply(.hojas_ruta_sampling_methods(), `[[`, character(1), "id")) {
    method <- defaults$sampling_method
  }
  row_var <- .hojas_ruta_scalar(config$row_var, defaults$row_var)
  if (!row_var %in% c("departamento", "provincia", "distrito", "ubigeo", "zona")) {
    row_var <- defaults$row_var
  }
  measure_var <- .hojas_ruta_scalar(config$measure_var, defaults$measure_var)
  if (!measure_var %in% c("viviendas", "poblacion")) measure_var <- defaults$measure_var
  subquota_var <- .hojas_ruta_scalar(config$subquota_var, defaults$subquota_var)
  if (!subquota_var %in% c("sexo", "ninguna")) subquota_var <- defaults$subquota_var
  territorios <- .hojas_ruta_chr_vec(config$territorios)
  territorios <- intersect(territorios, unique(frame$ubigeo))
  age_range_mode <- .hojas_ruta_scalar(config$age_range_mode %||% config$ageRangeMode,
                                       defaults$age_range_mode)
  if (!age_range_mode %in% .hojas_ruta_age_range_modes()) age_range_mode <- defaults$age_range_mode
  zone_allocation <- .hojas_ruta_scalar(config$zone_allocation %||% config$zoneAllocation,
                                        defaults$zone_allocation)
  if (!zone_allocation %in% c("proportional")) zone_allocation <- defaults$zone_allocation
  sample_size_mode_present <- !is.null(config$sample_size_mode)
  sample_size_mode <- .hojas_ruta_scalar(config$sample_size_mode, defaults$sample_size_mode)
  if (!sample_size_mode %in% c("calculator", "external_total", "external_district")) {
    sample_size_mode <- defaults$sample_size_mode
  }
  sample_size <- .hojas_ruta_normalize_sample_size(config$sample_size, method)
  n_mode <- .hojas_ruta_scalar(config$n_mode, defaults$n_mode)
  if (!n_mode %in% c("total", "por_distrito")) n_mode <- defaults$n_mode
  if (isTRUE(sample_size_mode_present) && identical(sample_size_mode, "external_district")) {
    n_mode <- "por_distrito"
  } else if (isTRUE(sample_size_mode_present) && sample_size_mode %in% c("calculator", "external_total")) {
    n_mode <- "total"
  }
  n_por_distrito <- .hojas_ruta_named_int_map(config$n_por_distrito, territorios)
  n_objetivo <- max(1L, .hojas_ruta_int(config$n_objetivo, defaults$n_objetivo))
  n_por_total <- sum(unlist(n_por_distrito, use.names = FALSE), na.rm = TRUE)
  if (identical(n_mode, "por_distrito") && n_por_total > 0L) {
    n_objetivo <- as.integer(n_por_total)
  }
  age_ranges <- if (identical(age_range_mode, "manual")) {
    .hojas_ruta_normalize_age_ranges(config$age_ranges, defaults$age_ranges)
  } else {
    .hojas_ruta_age_ranges_from_population(territorios, age_range_mode)
  }
  list(
    n_objetivo = n_objetivo,
    n_mode = n_mode,
    n_por_distrito = n_por_distrito,
    territorios = as.list(territorios),
    row_var = row_var,
    col_var = "rango_edad",
    subquota_var = subquota_var,
    measure_var = measure_var,
    sampling_method = method,
    seed = .hojas_ruta_int(config$seed, defaults$seed),
    max_per_manzana = max(1L, .hojas_ruta_int(config$max_per_manzana, defaults$max_per_manzana)),
    entrevistas_por_manzana = max(1L, .hojas_ruta_int(config$entrevistas_por_manzana,
                                                      defaults$entrevistas_por_manzana)),
    age_range_mode = age_range_mode,
    zone_allocation = zone_allocation,
    age_ranges = age_ranges,
    sample_size_mode = sample_size_mode,
    sample_size = sample_size
  )
}

.hojas_ruta_filter_frame <- function(config) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  frame <- hojas_ruta_inei_frame()
  frame[frame$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
}

.hojas_ruta_allocate_integer <- function(weights, n) {
  n <- as.integer(n)
  if (length(weights) == 0L) return(integer(0))
  if (n <= 0L || sum(weights, na.rm = TRUE) <= 0) return(rep(0L, length(weights)))
  weights[is.na(weights) | weights < 0] <- 0
  raw <- n * weights / sum(weights)
  out <- floor(raw)
  rem <- n - sum(out)
  if (rem > 0L) {
    ord <- order(raw - out, weights, decreasing = TRUE)
    out[ord[seq_len(min(rem, length(ord)))]] <- out[ord[seq_len(min(rem, length(ord)))]] + 1L
  }
  as.integer(out)
}

.hojas_ruta_allocate_with_floor <- function(weights, n, floors = NULL) {
  k <- length(weights)
  if (k == 0L) return(integer(0))
  n <- as.integer(n)
  if (is.null(floors)) floors <- rep(0L, k)
  floors <- as.integer(pmax(0L, floors))
  total_floor <- sum(floors)
  if (n <= total_floor) return(floors)
  remaining <- n - total_floor
  extra <- .hojas_ruta_allocate_integer(weights, remaining)
  as.integer(floors + extra)
}

.hojas_ruta_allocate_by_mode <- function(weights, n, mode = "proportional", floors = NULL) {
  if (!mode %in% .hojas_ruta_allocation_modes()) mode <- "proportional"
  k <- length(weights)
  if (k == 0L) return(integer(0))
  n <- as.integer(n)
  weights <- as.numeric(weights)
  weights[is.na(weights) | weights < 0] <- 0
  if (identical(mode, "uniform")) {
    use_w <- rep(1, k)
  } else if (identical(mode, "compromise")) {
    use_w <- sqrt(weights)
    if (sum(use_w) <= 0) use_w <- weights
  } else {
    use_w <- weights
  }
  .hojas_ruta_allocate_with_floor(use_w, n, floors)
}

.hojas_ruta_age_population <- function(frame, def, sexo) {
  sources <- .hojas_ruta_age_sources()
  req_min <- as.integer(def$min)
  req_max <- if (is.na(def$max)) 120L else as.integer(def$max)
  out <- rep(0, nrow(frame))
  for (i in seq_len(nrow(sources))) {
    src_min <- sources$min[[i]]
    src_max <- sources$max[[i]]
    overlap <- max(0L, min(req_max, src_max) - max(req_min, src_min) + 1L)
    if (overlap <= 0L) next
    width <- src_max - src_min + 1L
    cols <- if (identical(sexo, "Hombre")) {
      sources$h_col[[i]]
    } else if (identical(sexo, "Mujer")) {
      sources$m_col[[i]]
    } else {
      c(sources$h_col[[i]], sources$m_col[[i]])
    }
    for (col in intersect(cols, names(frame))) {
      out <- out + suppressWarnings(as.numeric(frame[[col]])) * (overlap / width)
    }
  }
  out
}

.hojas_ruta_exact_age_cells <- function(frame, cfg) {
  if (!cfg$row_var %in% c("departamento", "provincia", "distrito", "ubigeo", "zona")) {
    return(list(ok = FALSE, reason = "unsupported_row_var", cells = data.frame()))
  }
  age <- hojas_ruta_inei_age_simple()
  if (!nrow(age)) {
    return(list(ok = FALSE, reason = "missing_age_simple", cells = data.frame()))
  }
  selected_ubigeos <- unique(as.character(frame$ubigeo))
  age <- age[age$ubigeo %in% selected_ubigeos, , drop = FALSE]
  missing_ubigeos <- setdiff(selected_ubigeos, unique(age$ubigeo))
  if (!nrow(age) || length(missing_ubigeos)) {
    return(list(
      ok = FALSE,
      reason = "incomplete_age_simple",
      missing_ubigeos = missing_ubigeos,
      cells = data.frame()
    ))
  }
  defs <- cfg$age_ranges %||% .hojas_ruta_age_defs_default()
  sex_groups <- if (identical(cfg$subquota_var, "sexo")) {
    list(Hombre = "Hombre", Mujer = "Mujer")
  } else {
    list(Total = c("Hombre", "Mujer"))
  }
  zone_weights <- NULL
  if (identical(cfg$row_var, "zona")) {
    zone_weights <- stats::aggregate(
      frame$poblacion,
      by = frame[c("ubigeo", "zona")],
      FUN = sum,
      na.rm = TRUE
    )
    names(zone_weights)[3] <- "zona_poblacion"
    district_weights <- stats::aggregate(
      frame$poblacion,
      by = frame["ubigeo"],
      FUN = sum,
      na.rm = TRUE
    )
    names(district_weights)[2] <- "distrito_poblacion"
    zone_weights <- merge(zone_weights, district_weights, by = "ubigeo", all.x = TRUE)
    zone_weights$share <- ifelse(zone_weights$distrito_poblacion > 0,
                                 zone_weights$zona_poblacion / zone_weights$distrito_poblacion,
                                 0)
  }
  rows <- list()
  for (def in defs) {
    req_min <- as.integer(def$min)
    req_max <- if (is.na(def$max)) max(age$edad, na.rm = TRUE) else as.integer(def$max)
    for (sexo in names(sex_groups)) {
      sub <- age[
        age$sexo %in% sex_groups[[sexo]] & age$edad >= req_min & age$edad <= req_max,
        , drop = FALSE
      ]
      if (!nrow(sub)) next
      if (identical(cfg$row_var, "zona")) {
        district_age <- stats::aggregate(
          sub$poblacion,
          by = sub["ubigeo"],
          FUN = sum,
          na.rm = TRUE
        )
        names(district_age)[2] <- "poblacion_distrito_edad"
        agg <- merge(zone_weights, district_age, by = "ubigeo", all.x = TRUE)
        agg$poblacion_distrito_edad[is.na(agg$poblacion_distrito_edad)] <- 0
        agg$poblacion <- agg$poblacion_distrito_edad * agg$share
        agg$territorio <- paste(agg$ubigeo, agg$zona, sep = "-")
        agg <- agg[c("territorio", "ubigeo", "poblacion")]
      } else {
        sub$territorio <- if (identical(cfg$row_var, "ubigeo")) sub$ubigeo else as.character(sub[[cfg$row_var]])
        agg <- stats::aggregate(
          sub$poblacion,
          by = sub[c("territorio", "ubigeo")],
          FUN = sum,
          na.rm = TRUE
        )
        names(agg) <- c("territorio", "ubigeo", "poblacion")
      }
      agg$rango_edad <- def$label
      agg$rango_id <- def$id
      agg$sexo <- sexo
      agg$age_source <- if (identical(cfg$row_var, "zona")) "edad_simple_c5p41_distribuida_zona" else "edad_simple_c5p41"
      rows[[length(rows) + 1L]] <- agg
    }
  }
  cells <- if (length(rows)) do.call(rbind, rows) else data.frame()
  attr(cells, "age_source") <- list(
    type = if (identical(cfg$row_var, "zona")) "edad_simple_c5p41_distribuida_zona" else "edad_simple_c5p41",
    label = if (identical(cfg$row_var, "zona")) {
      "Edad simple oficial INEI 2017 distribuida a zona con pesos de poblacion de manzana"
    } else {
      "Edad simple oficial INEI 2017"
    },
    granularity = if (identical(cfg$row_var, "zona")) "zona_estimacion_desde_distrito" else "distrito",
    variable_edad = "Poblacio.C5P41",
    variable_sexo = "Poblacio.SEXO",
    version = HOJAS_RUTA_INEI_AGE_SIMPLE_VERSION
  )
  list(ok = nrow(cells) > 0L, reason = NULL, cells = cells)
}

.hojas_ruta_finalize_quota_cells <- function(cells, cfg) {
  if (!nrow(cells)) return(cells)
  cells$cuota_raw <- 0
  cells$cuota <- 0L
  route_size <- .hojas_ruta_route_size(cfg)
  route_domain <- if (identical(cfg$row_var, "zona")) as.character(cells$territorio) else as.character(cells$ubigeo)

  assign_domain <- function(idx, n_domain) {
    n_domain <- as.integer(n_domain)
    if (is.na(n_domain) || n_domain <= 0L || !any(idx)) return(invisible(NULL))
    total_pop <- sum(cells$poblacion[idx], na.rm = TRUE)
    if (total_pop > 0) {
      cells$cuota_raw[idx] <<- n_domain * cells$poblacion[idx] / total_pop
    }
    cells$cuota[idx] <<- .hojas_ruta_allocate_integer(cells$poblacion[idx], n_domain)
    invisible(NULL)
  }

  if (identical(cfg$n_mode, "por_distrito")) {
    n_map <- unlist(cfg$n_por_distrito, use.names = TRUE)
    for (ubigeo in unique(as.character(cells$ubigeo))) {
      idx <- as.character(cells$ubigeo) == ubigeo
      n_ubigeo <- as.integer(if (ubigeo %in% names(n_map)) n_map[[ubigeo]] else 0L)
      if (is.na(n_ubigeo) || n_ubigeo <= 0L || !any(idx)) next
      if (identical(cfg$row_var, "zona")) {
        domains <- unique(route_domain[idx])
        weights <- vapply(domains, function(domain) {
          sum(cells$poblacion[idx & route_domain == domain], na.rm = TRUE)
        }, numeric(1))
        route_counts <- .hojas_ruta_allocate_integer(weights, n_ubigeo / route_size)
        for (j in seq_along(domains)) {
          assign_domain(idx & route_domain == domains[[j]], route_counts[[j]] * route_size)
        }
      } else {
        assign_domain(idx, n_ubigeo)
      }
    }
  } else {
    route_total <- as.integer(cfg$n_objetivo / route_size)
    if (identical(cfg$row_var, "zona")) {
      domains <- unique(route_domain)
      weights <- vapply(domains, function(domain) {
        sum(cells$poblacion[route_domain == domain], na.rm = TRUE)
      }, numeric(1))
      route_counts <- .hojas_ruta_allocate_integer(weights, route_total)
      for (j in seq_along(domains)) {
        assign_domain(route_domain == domains[[j]], route_counts[[j]] * route_size)
      }
    } else {
      domains <- unique(as.character(cells$ubigeo))
      weights <- vapply(domains, function(ubigeo) {
        sum(cells$poblacion[as.character(cells$ubigeo) == ubigeo], na.rm = TRUE)
      }, numeric(1))
      route_counts <- .hojas_ruta_allocate_integer(weights, route_total)
      for (j in seq_along(domains)) {
        assign_domain(as.character(cells$ubigeo) == domains[[j]], route_counts[[j]] * route_size)
      }
    }
  }
  cells <- cells[order(cells$territorio, cells$sexo, cells$rango_id), , drop = FALSE]
  rownames(cells) <- NULL
  cells
}

.hojas_ruta_population_cells <- function(frame, cfg) {
  if (!nrow(frame)) return(data.frame())
  exact <- .hojas_ruta_exact_age_cells(frame, cfg)
  if (isTRUE(exact$ok)) {
    source <- attr(exact$cells, "age_source", exact = TRUE)
    cells <- exact$cells
    cells <- cells[order(cells$territorio, cells$sexo, cells$rango_id), , drop = FALSE]
    rownames(cells) <- NULL
    attr(cells, "age_source") <- source
    return(cells)
  }

  defs <- cfg$age_ranges %||% .hojas_ruta_age_defs_default()
  sex_groups <- if (identical(cfg$subquota_var, "sexo")) c("Hombre", "Mujer") else "Total"
  rows <- list()
  for (def in defs) {
    for (sexo in sex_groups) {
      pop_vec <- .hojas_ruta_age_population(frame, def, sexo)
      by_df <- data.frame(
        territorio = as.character(frame[[cfg$row_var]]),
        ubigeo = as.character(frame$ubigeo),
        stringsAsFactors = FALSE
      )
      agg <- stats::aggregate(
        pop_vec,
        by = by_df,
        FUN = sum,
        na.rm = TRUE
      )
      names(agg) <- c("territorio", "ubigeo", "poblacion")
      if (!nrow(agg)) next
      agg$rango_edad <- def$label
      agg$rango_id <- def$id
      agg$sexo <- sexo
      agg$age_source <- "bucket_overlap"
      rows[[length(rows) + 1L]] <- agg
    }
  }
  cells <- if (length(rows)) do.call(rbind, rows) else data.frame()
  if (!nrow(cells)) return(cells)
  source <- list(
    type = "bucket_overlap",
    label = "Aproximacion por buckets piloto",
    granularity = "manzana_piloto",
    reason = exact$reason %||% "unknown"
  )
  cells <- cells[order(cells$territorio, cells$sexo, cells$rango_id), , drop = FALSE]
  rownames(cells) <- NULL
  attr(cells, "age_source") <- source
  cells
}

.hojas_ruta_quota_cells <- function(frame, cfg) {
  cells <- .hojas_ruta_population_cells(frame, cfg)
  if (!nrow(cells)) return(cells)
  source <- attr(cells, "age_source", exact = TRUE)
  cells <- .hojas_ruta_finalize_quota_cells(cells, cfg)
  attr(cells, "age_source") <- source
  cells
}

.hojas_ruta_population_table <- function(cells) {
  if (!nrow(cells)) return(data.frame())
  ages <- unique(cells$rango_edad)
  groups <- unique(cells[c("territorio", "sexo")])
  rows <- lapply(seq_len(nrow(groups)), function(i) {
    g <- groups[i, , drop = FALSE]
    sub <- cells[cells$territorio == g$territorio[[1]] & cells$sexo == g$sexo[[1]], , drop = FALSE]
    vals <- stats::setNames(rep(0, length(ages)), ages)
    for (age in ages) {
      vals[[age]] <- sum(sub$poblacion[sub$rango_edad == age], na.rm = TRUE)
    }
    data.frame(
      territorio = g$territorio[[1]],
      sexo = g$sexo[[1]],
      as.list(vals),
      TOTAL = sum(vals),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  total <- as.list(c(territorio = "TOTAL", sexo = "Total"))
  for (age in ages) total[[age]] <- sum(out[[age]], na.rm = TRUE)
  total$TOTAL <- sum(out$TOTAL, na.rm = TRUE)
  rbind(out, as.data.frame(total, stringsAsFactors = FALSE, check.names = FALSE))
}

.hojas_ruta_quota_table <- function(cells) {
  if (!nrow(cells)) return(data.frame())
  ages <- unique(cells$rango_edad)
  groups <- unique(cells[c("territorio", "sexo")])
  rows <- lapply(seq_len(nrow(groups)), function(i) {
    g <- groups[i, , drop = FALSE]
    sub <- cells[cells$territorio == g$territorio[[1]] & cells$sexo == g$sexo[[1]], , drop = FALSE]
    vals <- stats::setNames(rep(0L, length(ages)), ages)
    for (age in ages) {
      vals[[age]] <- as.integer(sum(sub$cuota[sub$rango_edad == age], na.rm = TRUE))
    }
    data.frame(
      territorio = g$territorio[[1]],
      sexo = g$sexo[[1]],
      as.list(vals),
      TOTAL = as.integer(sum(vals)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  total <- as.list(c(territorio = "TOTAL", sexo = "Total"))
  for (age in ages) total[[age]] <- as.integer(sum(out[[age]], na.rm = TRUE))
  total$TOTAL <- as.integer(sum(out$TOTAL, na.rm = TRUE))
  rbind(out, as.data.frame(total, stringsAsFactors = FALSE, check.names = FALSE))
}

.hojas_ruta_population_alerts <- function(frame, cells, age_source) {
  alerts <- list()
  if (!nrow(frame)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "error",
      code = "E_NO_TERRITORY",
      message = "No hay manzanas INEI 2017 para los territorios seleccionados."
    )
  }
  if (age_source$type %in% c("edad_simple_c5p41", "edad_simple_c5p41_distribuida_zona")) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "info",
      code = "I_AGE_SIMPLE_OFFICIAL",
      message = if (identical(age_source$type, "edad_simple_c5p41_distribuida_zona")) {
        "La matriz usa edad simple oficial INEI 2017 (C5P41 x SEXO) y la distribuye a zona usando el marco de manzanas."
      } else {
        "La matriz usa edad simple oficial INEI 2017 (C5P41 x SEXO) empaquetada a nivel distrito."
      }
    )
  } else if (nrow(cells)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_AGE_BUCKET_APPROXIMATION",
      message = "No se pudo usar edad simple oficial para esta configuracion; la poblacion se aproxima desde buckets del marco piloto."
    )
  }
  alerts
}

#' Previsualizar matriz poblacional integrada sin N objetivo
#'
#' @param config Configuracion de territorios y cortes.
#' @return Lista serializable con poblacion base y diagnostico.
#' @export
hojas_ruta_population_preview_integrado <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  frame_all <- hojas_ruta_inei_frame()
  frame <- frame_all[frame_all$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
  cells <- .hojas_ruta_population_cells(frame, cfg)
  age_source <- attr(cells, "age_source", exact = TRUE) %||% list(type = "none")
  table <- .hojas_ruta_population_table(cells)
  territories <- .hojas_ruta_territories(frame)
  list(
    ok = nrow(frame) > 0L && nrow(cells) > 0L,
    frame_meta = .hojas_ruta_frame_meta(frame_all),
    age_source = age_source,
    config = cfg,
    total_poblacion = as.integer(round(sum(cells$poblacion, na.rm = TRUE))),
    territories = territories,
    cells = .hojas_ruta_df_rows(cells),
    table = .hojas_ruta_df_rows(table),
    alerts = .hojas_ruta_population_alerts(frame, cells, age_source)
  )
}

.hojas_ruta_population_matrix_wide <- function(cells) {
  if (!nrow(cells)) return(data.frame())
  ages <- unique(as.character(cells$rango_edad))
  has_sex <- any(as.character(cells$sexo) %in% c("Hombre", "Mujer"))
  groups <- unique(cells[c("territorio", "ubigeo")])
  rows <- lapply(seq_len(nrow(groups)), function(i) {
    g <- groups[i, , drop = FALSE]
    sub <- cells[
      cells$territorio == g$territorio[[1]] & cells$ubigeo == g$ubigeo[[1]],
      ,
      drop = FALSE
    ]
    row <- list(Territorio = g$territorio[[1]], Ubigeo = g$ubigeo[[1]])
    for (age in ages) {
      if (has_sex) {
        row[[paste(age, "Hombres", sep = " - ")]] <- sum(sub$poblacion[sub$rango_edad == age & sub$sexo == "Hombre"], na.rm = TRUE)
        row[[paste(age, "Mujeres", sep = " - ")]] <- sum(sub$poblacion[sub$rango_edad == age & sub$sexo == "Mujer"], na.rm = TRUE)
      } else {
        row[[age]] <- sum(sub$poblacion[sub$rango_edad == age], na.rm = TRUE)
      }
    }
    row[["Poblacion total"]] <- sum(sub$poblacion, na.rm = TRUE)
    as.data.frame(row, check.names = FALSE, stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, rows)
  total <- as.list(rep(0, ncol(out)))
  names(total) <- names(out)
  total$Territorio <- "TOTAL"
  total$Ubigeo <- ""
  for (nm in setdiff(names(out), c("Territorio", "Ubigeo"))) {
    total[[nm]] <- sum(out[[nm]], na.rm = TRUE)
  }
  rbind(out, as.data.frame(total, check.names = FALSE, stringsAsFactors = FALSE))
}

.hojas_ruta_population_matrix_proportional <- function(cells) {
  matrix <- .hojas_ruta_population_matrix_wide(cells)
  if (!nrow(matrix)) return(matrix)
  total_population <- sum(cells$poblacion, na.rm = TRUE)
  district_totals <- as.numeric(matrix[["Poblacion total"]])
  out <- matrix
  value_cols <- setdiff(names(out), c("Territorio", "Ubigeo", "Poblacion total"))
  for (nm in value_cols) {
    out[[nm]] <- ifelse(district_totals > 0, as.numeric(out[[nm]]) / district_totals, 0)
  }
  out[["Proporcion del marco"]] <- if (total_population > 0) {
    district_totals / total_population
  } else {
    rep(0, length(district_totals))
  }
  out[["Poblacion total"]] <- NULL
  out
}

#' Exportar la matriz poblacional INEI 2017 a Excel
#'
#' @param config Configuracion de territorios y cortes.
#' @param path Ruta .xlsx de salida.
#' @return Lista con ruta y resumen de exportacion.
#' @export
hojas_ruta_exportar_matriz_poblacional <- function(config = list(), path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("Se requiere el paquete 'openxlsx' para exportar Excel.", call. = FALSE)
  }
  preview <- hojas_ruta_population_preview_integrado(config)
  if (!isTRUE(preview$ok)) {
    stop("La matriz poblacional no esta lista para exportar.", call. = FALSE)
  }
  cells <- .hojas_ruta_rows_df(preview$cells)
  matrix <- .hojas_ruta_population_matrix_wide(cells)
  proportions <- .hojas_ruta_population_matrix_proportional(cells)
  detail <- cells[c("ubigeo", "territorio", "rango_id", "rango_edad", "sexo", "poblacion", "age_source")]
  names(detail) <- c("ubigeo", "territorio", "rango_id", "rango_edad", "sexo", "poblacion", "fuente_edad")
  district_total <- ave(detail$poblacion, detail$ubigeo, FUN = function(x) sum(x, na.rm = TRUE))
  total_population <- sum(detail$poblacion, na.rm = TRUE)
  detail$proporcion_en_distrito <- ifelse(district_total > 0, detail$poblacion / district_total, 0)
  detail$proporcion_en_marco <- if (total_population > 0) {
    detail$poblacion / total_population
  } else {
    rep(0, nrow(detail))
  }
  cfg <- preview$config
  params <- rbind(
    data.frame(tipo = "configuracion", campo = "filas", valor = cfg$row_var, stringsAsFactors = FALSE),
    data.frame(tipo = "configuracion", campo = "columnas", valor = cfg$col_var, stringsAsFactors = FALSE),
    data.frame(tipo = "configuracion", campo = "subcuotas", valor = cfg$subquota_var, stringsAsFactors = FALSE),
    data.frame(tipo = "configuracion", campo = "modo_rangos_edad", valor = cfg$age_range_mode %||% "manual", stringsAsFactors = FALSE),
    data.frame(tipo = "territorio", campo = unlist(cfg$territorios, use.names = FALSE), valor = "", stringsAsFactors = FALSE),
    do.call(rbind, lapply(cfg$age_ranges, function(r) {
      data.frame(
        tipo = "rango_edad",
        campo = r$label,
        valor = if (is.na(r$max)) paste0(r$min, "+") else paste0(r$min, "-", r$max),
        stringsAsFactors = FALSE
      )
    }))
  )
  meta <- preview$frame_meta
  fuente <- data.frame(
    campo = c("fuente", "anio", "version", "empaquetado", "checksum", "cobertura", "granularidad", "fuente_edad", "exportado"),
    valor = c(
      meta$source,
      meta$year,
      meta$version,
      meta$packaged_at,
      meta$checksum %||% "",
      meta$coverage,
      meta$granularity %||% "",
      preview$age_source$label %||% preview$age_source$type %||% "",
      format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    ),
    stringsAsFactors = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Matriz_poblacional")
  openxlsx::writeData(wb, "Matriz_poblacional", matrix, withFilter = TRUE)
  openxlsx::addWorksheet(wb, "Matriz_proporcional")
  openxlsx::writeData(wb, "Matriz_proporcional", proportions, withFilter = TRUE)
  openxlsx::addWorksheet(wb, "Detalle_largo")
  openxlsx::writeData(wb, "Detalle_largo", detail, withFilter = TRUE)
  openxlsx::addWorksheet(wb, "Parametros")
  openxlsx::writeData(wb, "Parametros", params, withFilter = TRUE)
  openxlsx::addWorksheet(wb, "Fuente")
  openxlsx::writeData(wb, "Fuente", fuente, withFilter = TRUE)
  pct_style <- openxlsx::createStyle(numFmt = "0.0%")
  if (nrow(proportions)) {
    pct_cols <- which(!names(proportions) %in% c("Territorio", "Ubigeo"))
    openxlsx::addStyle(
      wb,
      "Matriz_proporcional",
      pct_style,
      rows = seq_len(nrow(proportions)) + 1L,
      cols = pct_cols,
      gridExpand = TRUE,
      stack = TRUE
    )
  }
  detail_pct_cols <- which(names(detail) %in% c("proporcion_en_distrito", "proporcion_en_marco"))
  if (length(detail_pct_cols)) {
    openxlsx::addStyle(
      wb,
      "Detalle_largo",
      pct_style,
      rows = seq_len(nrow(detail)) + 1L,
      cols = detail_pct_cols,
      gridExpand = TRUE,
      stack = TRUE
    )
  }
  for (sh in names(wb)) {
    openxlsx::freezePane(wb, sh, firstActiveRow = 2)
    openxlsx::setColWidths(wb, sh, cols = 1:60, widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  list(
    path = normalizePath(path, mustWork = FALSE),
    total_poblacion = preview$total_poblacion,
    n_territorios = length(cfg$territorios),
    n_cells = nrow(cells)
  )
}

#' Previsualizar calculo y diagnostico de tamano de muestra
#'
#' @param config Configuracion de territorios y muestra.
#' @return Lista serializable con N recomendado, N usado y margenes.
#' @export
hojas_ruta_sample_size_preview <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  frame_all <- hojas_ruta_inei_frame()
  frame <- frame_all[frame_all$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
  params <- cfg$sample_size
  alerts <- list()

  if (!nrow(frame)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "error",
      code = "E_NO_TERRITORY",
      message = "Confirma al menos un distrito antes de calcular la muestra."
    )
  }

  district_frame <- if (nrow(frame)) {
    stats::aggregate(
      frame[c("poblacion", "viviendas")],
      by = frame[c("ubigeo", "distrito")],
      FUN = sum,
      na.rm = TRUE
    )
  } else {
    data.frame(ubigeo = character(0), distrito = character(0),
               poblacion = numeric(0), viviendas = numeric(0))
  }
  district_frame <- district_frame[order(district_frame$distrito), , drop = FALSE]
  total_population <- sum(district_frame$poblacion, na.rm = TRUE)
  route_status <- .hojas_ruta_route_multiple_status(cfg, frame)
  alerts <- c(alerts, route_status$alerts)
  route_size <- route_status$route_size

  district_pop <- as.numeric(district_frame$poblacion)
  district_ubigeos <- as.character(district_frame$ubigeo)
  district_deff <- vapply(district_ubigeos, function(u) {
    .hojas_ruta_design_effect_for(params, u)
  }, numeric(1))

  n_total_min <- .hojas_ruta_sample_size_n(total_population, params, params$margin_total)
  district_target_margin <- vapply(district_ubigeos, function(u) {
    .hojas_ruta_margin_district_for(params, u)
  }, numeric(1))
  n_district_min <- vapply(seq_len(nrow(district_frame)), function(i) {
    as.integer(.hojas_ruta_sample_size_n(district_pop[[i]], params,
                                          district_target_margin[[i]],
                                          ubigeo = district_ubigeos[[i]]))
  }, integer(1))
  n_district_floor <- as.integer(sum(n_district_min))
  enforce_floor <- isTRUE(params$enforce_district_floor)
  n_recommended <- if (enforce_floor) {
    as.integer(max(n_total_min, n_district_floor))
  } else {
    as.integer(n_total_min)
  }
  n_recommended_route <- as.integer(ceiling(max(1L, n_recommended) / route_size) * route_size)

  alloc_mode <- params$allocation_mode %||% "proportional"
  floors_recommended <- if (enforce_floor) floor(n_district_min / route_size) else rep(0L, length(district_pop))
  if (sum(floors_recommended, na.rm = TRUE) > n_recommended_route / route_size) {
    floors_recommended <- rep(0L, length(district_pop))
  }
  recommended_routes_by_district <- .hojas_ruta_allocate_by_mode(
    district_pop, n_recommended_route / route_size, alloc_mode, floors_recommended
  )
  recommended_by_district <- as.integer(recommended_routes_by_district * route_size)

  n_map <- unlist(cfg$n_por_distrito, use.names = TRUE)
  n_external_total <- sum(n_map, na.rm = TRUE)
  n_used <- if (identical(cfg$sample_size_mode, "external_district") && n_external_total > 0) {
    as.integer(n_external_total)
  } else {
    as.integer(cfg$n_objetivo)
  }
  if (is.na(n_used) || n_used < 0L) n_used <- 0L

  used_by_district <- if (identical(cfg$sample_size_mode, "external_district")) {
    as.integer(ifelse(district_ubigeos %in% names(n_map), n_map[district_ubigeos], 0L))
  } else if (isTRUE(route_status$ok) && n_used > 0L) {
    used_routes <- as.integer(n_used / route_size)
    floors_used <- if (enforce_floor && n_used >= n_district_floor) floor(n_district_min / route_size) else rep(0L, length(district_pop))
    if (sum(floors_used, na.rm = TRUE) > used_routes) floors_used <- rep(0L, length(district_pop))
    as.integer(.hojas_ruta_allocate_by_mode(district_pop, used_routes, alloc_mode, floors_used) * route_size)
  } else {
    floors_used <- if (enforce_floor && n_used >= n_district_floor) n_district_min else rep(0L, length(district_pop))
    .hojas_ruta_allocate_by_mode(district_pop, n_used, alloc_mode, floors_used)
  }
  used_by_district[is.na(used_by_district) | used_by_district < 0L] <- 0L

  margin_total <- .hojas_ruta_margin_error(total_population, n_used, params)
  if (!is.na(margin_total) && margin_total > params$margin_total + 1e-9) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_TOTAL_MARGIN_HIGH",
      message = "El N usado queda por encima de la precision esperada total."
    )
  }
  if (enforce_floor && n_used > 0L && n_used < n_district_floor &&
      !identical(cfg$sample_size_mode, "external_district")) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_DISTRICT_FLOOR_UNMET",
      message = sprintf(
        "El N usado (%d) no alcanza el piso distrital sumado (%d) para garantizar la precision distrital.",
        n_used, n_district_floor
      )
    )
  }

  rows <- vector("list", nrow(district_frame))
  missing_external <- 0L
  high_margin <- 0L
  for (i in seq_len(nrow(district_frame))) {
    n_i <- used_by_district[[i]]
    ub <- district_ubigeos[[i]]
    margin_i <- .hojas_ruta_margin_error(district_pop[[i]], n_i, params, ubigeo = ub)
    target_i <- as.numeric(district_target_margin[[i]])
    status <- "ok"
    message <- "Listo"
    if (n_i <= 0L) {
      status <- "faltante"
      message <- "Falta N"
      if (identical(cfg$sample_size_mode, "external_district")) missing_external <- missing_external + 1L
    } else if (!is.na(margin_i) && margin_i > target_i + 1e-9) {
      status <- "alerta"
      message <- "Precision distrital baja"
      high_margin <- high_margin + 1L
    }
    rows[[i]] <- list(
      ubigeo = ub,
      distrito = as.character(district_frame$distrito[[i]]),
      poblacion = as.integer(round(district_pop[[i]])),
      viviendas = as.integer(round(district_frame$viviendas[[i]])),
      n_recommended = as.integer(recommended_by_district[[i]]),
      n_min_district = as.integer(n_district_min[[i]]),
      n_used = as.integer(n_i),
      margin_estimated = if (is.na(margin_i)) NA_real_ else margin_i,
      target_margin = target_i,
      sampling_fraction = if (district_pop[[i]] > 0) n_i / district_pop[[i]] else NA_real_,
      design_effect = as.numeric(district_deff[[i]]),
      status = status,
      message = message
    )
  }

  if (missing_external > 0L) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_EXTERNAL_DISTRICT_MISSING",
      message = sprintf("%d distrito(s) no tienen N externo.", missing_external)
    )
  }
  if (high_margin > 0L) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_DISTRICT_MARGIN_HIGH",
      message = sprintf("%d distrito(s) quedan con precision distrital baja.", high_margin)
    )
  }

  list(
    ok = nrow(frame) > 0L && n_used > 0L && isTRUE(route_status$ok),
    frame_meta = .hojas_ruta_frame_meta(frame_all),
    config = cfg,
    sample_size = params,
    mode = cfg$sample_size_mode,
    total_population = as.integer(round(total_population)),
    n_recommended = as.integer(n_recommended),
    n_recommended_route = as.integer(n_recommended_route),
    n_total_min = as.integer(n_total_min),
    n_district_floor = as.integer(n_district_floor),
    route_size = as.integer(route_size),
    route_multiple_ok = isTRUE(route_status$ok),
    n_route_previous = as.integer(max(route_size, floor(n_used / route_size) * route_size)),
    n_route_next = as.integer(ceiling(max(1L, n_used) / route_size) * route_size),
    allocation_mode = alloc_mode,
    enforce_district_floor = enforce_floor,
    n_used = as.integer(n_used),
    contacts_suggested = as.integer(ceiling(n_used / params$response_rate)),
    margin_total_estimated = if (is.na(margin_total)) NA_real_ else margin_total,
    margin_total_target = params$margin_total,
    district_rows = rows,
    alerts = alerts
  )
}

#' Previsualizar cuotas integradas desde el marco INEI 2017
#'
#' @param config Configuracion de cuotas y territorios.
#' @return Lista serializable con matriz de cuotas y diagnostico.
#' @export
hojas_ruta_quota_preview_integrado <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  frame_all <- hojas_ruta_inei_frame()
  frame <- frame_all[frame_all$ubigeo %in% unlist(cfg$territorios, use.names = FALSE), , drop = FALSE]
  alerts <- list()
  if (!identical(.hojas_ruta_frame_meta(frame_all)$pilot, FALSE)) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "warn",
      code = "W_PILOT_FRAME",
      message = "El marco empaquetado actual es piloto Lima/Callao; requiere reemplazo por el extracto oficial completo antes de produccion."
    )
  }
  route_status <- .hojas_ruta_route_multiple_status(cfg, frame)
  if (!isTRUE(route_status$ok)) {
    age_source <- list(type = "none")
    return(list(
      ok = FALSE,
      frame_meta = .hojas_ruta_frame_meta(frame_all),
      age_source = age_source,
      config = cfg,
      n_objetivo = as.integer(cfg$n_objetivo),
      total_asignado = 0L,
      route_size = as.integer(route_status$route_size),
      route_multiple_ok = FALSE,
      territories = .hojas_ruta_territories(frame),
      cells = list(),
      table = list(),
      alerts = c(alerts, route_status$alerts)
    ))
  }
  cells <- .hojas_ruta_quota_cells(frame, cfg)
  age_source <- attr(cells, "age_source", exact = TRUE) %||% list(type = "none")
  alerts <- c(alerts, .hojas_ruta_population_alerts(frame, cells, age_source))
  if (nrow(cells)) {
    small <- sum(cells$poblacion > 0 & cells$cuota == 0, na.rm = TRUE)
    if (small > 0L) {
      alerts[[length(alerts) + 1L]] <- list(
        level = "info",
        code = "I_SMALL_CELLS",
        message = sprintf("%d celda(s) con poblacion positiva quedaron con cuota 0 por redondeo.", small)
      )
    }
  }
  table <- .hojas_ruta_quota_table(cells)
  territories <- .hojas_ruta_territories(frame)
  list(
    ok = nrow(frame) > 0L && sum(cells$cuota, na.rm = TRUE) == cfg$n_objetivo,
    frame_meta = .hojas_ruta_frame_meta(frame_all),
    age_source = age_source,
    config = cfg,
    n_objetivo = as.integer(cfg$n_objetivo),
    total_asignado = as.integer(sum(cells$cuota, na.rm = TRUE)),
    route_size = as.integer(route_status$route_size),
    route_multiple_ok = TRUE,
    territories = territories,
    cells = .hojas_ruta_df_rows(cells),
    table = .hojas_ruta_df_rows(table),
    alerts = alerts
  )
}

.hojas_ruta_allocate_capped <- function(weights, n, cap) {
  if (!length(weights) || n <= 0L) return(list(values = integer(length(weights)), unassigned = n))
  cap <- rep(as.integer(cap), length(weights))
  weights[is.na(weights) | weights < 0] <- 0
  if (sum(weights) <= 0) weights <- rep(1, length(weights))
  raw <- n * weights / sum(weights)
  values <- pmin(floor(raw), cap)
  rem <- as.integer(n - sum(values))
  guard <- 0L
  while (rem > 0L && any(values < cap) && guard < 100000L) {
    ord <- order((raw - values), weights, decreasing = TRUE)
    for (i in ord) {
      if (rem <= 0L) break
      if (values[[i]] < cap[[i]]) {
        values[[i]] <- values[[i]] + 1L
        rem <- rem - 1L
      }
    }
    guard <- guard + 1L
  }
  list(values = as.integer(values), unassigned = as.integer(rem))
}

.hojas_ruta_sample_indices <- function(df, n_blocks, cfg) {
  n_blocks <- min(as.integer(n_blocks), nrow(df))
  if (n_blocks <= 0L) return(integer(0))
  if (identical(cfg$sampling_method, "sistematico")) {
    ord <- order(df$ubigeo, df$zona, df$manzana, df$id_manzana)
    if (n_blocks >= length(ord)) return(ord)
    step <- length(ord) / n_blocks
    start <- stats::runif(1, min = 1, max = step)
    pos <- pmin(length(ord), floor(start + (seq_len(n_blocks) - 1L) * step))
    return(ord[unique(pos)])
  }
  prob <- df[[cfg$measure_var]]
  prob[is.na(prob) | prob <= 0] <- 1
  sample(seq_len(nrow(df)), size = n_blocks, replace = FALSE, prob = prob)
}

#' Seleccionar manzanas y asignar entrevistas
#'
#' @param config Configuracion integrada.
#' @return Lista serializable con cuotas, muestra y alertas.
#' @export
hojas_ruta_sample_preview_integrado <- function(config = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  quota <- hojas_ruta_quota_preview_integrado(cfg)
  frame <- .hojas_ruta_filter_frame(cfg)
  cells <- .hojas_ruta_rows_df(quota$cells)
  alerts <- quota$alerts

  if (!nrow(cells)) {
    return(list(
      ok = FALSE,
      frame_meta = quota$frame_meta,
      config = cfg,
      quota = quota,
      blocks = list(),
      n_blocks = 0L,
      total_entrevistas = 0L,
      alerts = alerts
    ))
  }

  seed <- as.integer(cfg$seed)
  old_seed <- if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
    get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  } else {
    NULL
  }
  on.exit({
    if (!is.null(old_seed)) assign(".Random.seed", old_seed, envir = .GlobalEnv)
  }, add = TRUE)
  set.seed(seed)

  route_size <- .hojas_ruta_route_size(cfg)
  district_n <- stats::aggregate(
    cells$cuota,
    by = list(ubigeo = as.character(cells$ubigeo)),
    FUN = sum,
    na.rm = TRUE
  )
  names(district_n)[2] <- "n"
  blocks <- list()
  unassigned_total <- 0L

  for (i in seq_len(nrow(district_n))) {
    ubigeo <- as.character(district_n$ubigeo[[i]])
    n_district <- as.integer(district_n$n[[i]])
    if (is.na(n_district) || n_district <= 0L) next
    district_frame <- frame[as.character(frame$ubigeo) == ubigeo, , drop = FALSE]
    if (!nrow(district_frame)) next
    route_total <- as.integer(n_district / route_size)
    if (route_total <= 0L) next

    zone_value_cols <- unique(c(cfg$measure_var, "poblacion", "viviendas"))
    zone_frame <- stats::aggregate(
      district_frame[zone_value_cols],
      by = district_frame[c("ubigeo", "distrito", "zona")],
      FUN = sum,
      na.rm = TRUE
    )
    zone_frame <- zone_frame[order(zone_frame$zona), , drop = FALSE]
    if (identical(cfg$row_var, "zona")) {
      zone_quota <- stats::aggregate(
        cells$cuota[cells$ubigeo == ubigeo],
        by = list(zona = sub("^[^-]+-", "", as.character(cells$territorio[cells$ubigeo == ubigeo]))),
        FUN = sum,
        na.rm = TRUE
      )
      names(zone_quota)[2] <- "n"
      zone_frame <- merge(zone_frame, zone_quota, by = "zona", all.x = TRUE)
      zone_frame$n[is.na(zone_frame$n)] <- 0L
      zone_routes <- as.integer(zone_frame$n / route_size)
    } else {
      zone_routes <- .hojas_ruta_allocate_integer(zone_frame[[cfg$measure_var]], route_total)
    }

    for (j in seq_len(nrow(zone_frame))) {
      n_routes <- as.integer(zone_routes[[j]])
      if (is.na(n_routes) || n_routes <= 0L) next
      zona <- as.character(zone_frame$zona[[j]])
      df_z <- district_frame[as.character(district_frame$zona) == zona, , drop = FALSE]
      if (!nrow(df_z)) {
        unassigned_total <- unassigned_total + n_routes * route_size
        next
      }
      n_blocks <- n_routes
      if (n_blocks > nrow(df_z)) {
        alerts[[length(alerts) + 1L]] <- list(
          level = "warn",
          code = "W_FRAME_INSUFFICIENT",
          message = sprintf(
            "%s zona %s requiere %d ruta(s), pero el marco contiene %d manzana(s).",
            as.character(zone_frame$distrito[[j]]), zona, n_blocks, nrow(df_z)
          )
        )
        unassigned_total <- unassigned_total + as.integer((n_blocks - nrow(df_z)) * route_size)
        n_blocks <- nrow(df_z)
      }
      idx <- .hojas_ruta_sample_indices(df_z, n_blocks, cfg)
      selected <- df_z[idx, , drop = FALSE]
      selected$territorio_muestral <- paste(ubigeo, zona, sep = "-")
      selected$metodo <- cfg$sampling_method
      selected$orden_seleccion <- seq_len(nrow(selected))
      selected$entrevistas <- as.integer(rep(route_size, nrow(selected)))
      selected$medida_tamano <- selected[[cfg$measure_var]]
      blocks[[length(blocks) + 1L]] <- selected
    }
  }

  blocks_df <- if (length(blocks)) do.call(rbind, blocks) else data.frame()
  if (unassigned_total > 0L) {
    alerts[[length(alerts) + 1L]] <- list(
      level = "error",
      code = "E_UNASSIGNED_INTERVIEWS",
      message = sprintf("%d entrevista(s) no pudieron asignarse con los limites actuales.", unassigned_total)
    )
  }
  if (nrow(blocks_df) && any(blocks_df$entrevistas <= 0L)) {
    blocks_df <- blocks_df[blocks_df$entrevistas > 0L, , drop = FALSE]
  }
  blocks_public <- blocks_df[, intersect(c(
    "id_manzana", "departamento", "provincia", "distrito", "ubigeo", "zona",
    "manzana", "viviendas", "poblacion", "territorio_muestral", "metodo",
    "orden_seleccion", "entrevistas", "medida_tamano", "lat", "lon"
  ), names(blocks_df)), drop = FALSE]
  list(
    ok = nrow(blocks_public) > 0L && unassigned_total == 0L,
    frame_meta = quota$frame_meta,
    config = cfg,
    quota = quota,
    method = cfg$sampling_method,
    seed = seed,
    blocks = .hojas_ruta_df_rows(blocks_public),
    n_blocks = as.integer(nrow(blocks_public)),
    total_entrevistas = as.integer(sum(blocks_public$entrevistas, na.rm = TRUE)),
    unassigned = as.integer(unassigned_total),
    alerts = alerts
  )
}

.hojas_ruta_geometry_rings <- function(geometry) {
  if (is.null(geometry) || is.null(geometry$type) || is.null(geometry$coordinates)) return(list())
  make_ring <- function(ring) {
    if (!length(ring)) return(NULL)
    pts <- do.call(rbind, lapply(ring, function(p) {
      if ((is.numeric(p) || is.list(p)) && length(p) >= 2L) {
        c(as.numeric(p[[1]]), as.numeric(p[[2]]))
      } else {
        c(NA_real_, NA_real_)
      }
    }))
    pts <- pts[stats::complete.cases(pts), , drop = FALSE]
    if (nrow(pts) < 3L) return(NULL)
    pts
  }
  if (identical(geometry$type, "Polygon")) {
    rings <- lapply(geometry$coordinates, make_ring)
  } else if (identical(geometry$type, "MultiPolygon")) {
    rings <- unlist(lapply(geometry$coordinates, function(poly) lapply(poly, make_ring)), recursive = FALSE)
  } else {
    rings <- list()
  }
  rings[!vapply(rings, is.null, logical(1))]
}

.hojas_ruta_geometry_line_parts <- function(geometry) {
  if (is.null(geometry) || is.null(geometry$type) || is.null(geometry$coordinates)) return(list())
  make_line <- function(line) {
    if (!length(line)) return(NULL)
    pts <- do.call(rbind, lapply(line, function(p) {
      if ((is.numeric(p) || is.list(p)) && length(p) >= 2L) {
        c(as.numeric(p[[1]]), as.numeric(p[[2]]))
      } else {
        c(NA_real_, NA_real_)
      }
    }))
    pts <- pts[stats::complete.cases(pts), , drop = FALSE]
    if (nrow(pts) < 2L) return(NULL)
    pts
  }
  if (identical(geometry$type, "LineString")) {
    lines <- list(make_line(geometry$coordinates))
  } else if (identical(geometry$type, "MultiLineString")) {
    lines <- lapply(geometry$coordinates, make_line)
  } else {
    lines <- list()
  }
  lines[!vapply(lines, is.null, logical(1))]
}

.hojas_ruta_geometry_points <- function(geometry) {
  if (is.null(geometry) || is.null(geometry$type) || is.null(geometry$coordinates)) {
    return(matrix(numeric(0), ncol = 2))
  }
  make_point <- function(p) {
    if ((is.numeric(p) || is.list(p)) && length(p) >= 2L) {
      c(as.numeric(p[[1]]), as.numeric(p[[2]]))
    } else {
      c(NA_real_, NA_real_)
    }
  }
  pts <- if (identical(geometry$type, "Point")) {
    matrix(make_point(geometry$coordinates), ncol = 2, byrow = TRUE)
  } else if (identical(geometry$type, "MultiPoint")) {
    do.call(rbind, lapply(geometry$coordinates, make_point))
  } else {
    matrix(numeric(0), ncol = 2)
  }
  pts <- pts[stats::complete.cases(pts), , drop = FALSE]
  if (!nrow(pts)) matrix(numeric(0), ncol = 2) else pts
}

.hojas_ruta_bbox_from_rings <- function(rings) {
  rings <- rings[lengths(rings) > 0L]
  if (!length(rings)) return(NULL)
  pts <- do.call(rbind, rings)
  pts <- pts[stats::complete.cases(pts), , drop = FALSE]
  if (!nrow(pts)) return(NULL)
  c(
    min_lon = min(pts[, 1], na.rm = TRUE),
    max_lon = max(pts[, 1], na.rm = TRUE),
    min_lat = min(pts[, 2], na.rm = TRUE),
    max_lat = max(pts[, 2], na.rm = TRUE)
  )
}

.hojas_ruta_bbox_expand <- function(bbox, pad = 0.18) {
  if (is.null(bbox)) return(NULL)
  lon_delta <- max(1e-8, bbox[["max_lon"]] - bbox[["min_lon"]])
  lat_delta <- max(1e-8, bbox[["max_lat"]] - bbox[["min_lat"]])
  c(
    min_lon = bbox[["min_lon"]] - lon_delta * pad,
    max_lon = bbox[["max_lon"]] + lon_delta * pad,
    min_lat = bbox[["min_lat"]] - lat_delta * pad,
    max_lat = bbox[["max_lat"]] + lat_delta * pad
  )
}

.hojas_ruta_bbox_to_ring <- function(bbox) {
  if (is.null(bbox)) return(matrix(numeric(0), ncol = 2))
  matrix(c(
    bbox[["min_lon"]], bbox[["min_lat"]],
    bbox[["max_lon"]], bbox[["min_lat"]],
    bbox[["max_lon"]], bbox[["max_lat"]],
    bbox[["min_lon"]], bbox[["max_lat"]],
    bbox[["min_lon"]], bbox[["min_lat"]]
  ), ncol = 2, byrow = TRUE)
}

.hojas_ruta_pdf_focus_bbox <- function(selected_rings, map_width = 1, map_height = 1) {
  bbox <- .hojas_ruta_bbox_from_rings(selected_rings)
  if (is.null(bbox)) return(NULL)
  cx <- mean(c(bbox[["min_lon"]], bbox[["max_lon"]]))
  cy <- mean(c(bbox[["min_lat"]], bbox[["max_lat"]]))
  selected_lon <- max(1e-8, bbox[["max_lon"]] - bbox[["min_lon"]])
  selected_lat <- max(1e-8, bbox[["max_lat"]] - bbox[["min_lat"]])
  # Radio operativo: se acerca a la manzana, pero deja entrar las calles
  # que la rodean y parte del tejido de zonas vecinas.
  lon_span <- max(0.0042, selected_lon * 9)
  lat_span <- max(0.0034, selected_lat * 9)
  target_aspect <- max(0.1, map_width / max(0.1, map_height))
  if (lon_span / lat_span < target_aspect) {
    lon_span <- lat_span * target_aspect
  } else {
    lat_span <- lon_span / target_aspect
  }
  c(
    min_lon = cx - lon_span / 2,
    max_lon = cx + lon_span / 2,
    min_lat = cy - lat_span / 2,
    max_lat = cy + lat_span / 2
  )
}

.hojas_ruta_bbox_intersects <- function(a, b) {
  if (is.null(a) || is.null(b)) return(FALSE)
  !(a[["max_lon"]] < b[["min_lon"]] ||
      a[["min_lon"]] > b[["max_lon"]] ||
      a[["max_lat"]] < b[["min_lat"]] ||
      a[["min_lat"]] > b[["max_lat"]])
}

.hojas_ruta_line_length_npc <- function(p) {
  if (is.null(p) || nrow(p) < 2L) return(0)
  sum(sqrt(diff(p$x)^2 + diff(p$y)^2), na.rm = TRUE)
}

.hojas_ruta_pdf_line_anchor_near <- function(p, target_x, target_y) {
  if (is.null(p) || nrow(p) < 2L) return(NULL)
  dx <- diff(p$x)
  dy <- diff(p$y)
  seg <- sqrt(dx^2 + dy^2)
  valid <- is.finite(seg) & seg > 0
  if (!any(valid)) return(NULL)
  mid_x <- (p$x[-nrow(p)] + p$x[-1L]) / 2
  mid_y <- (p$y[-nrow(p)] + p$y[-1L]) / 2
  distance <- sqrt((mid_x - target_x)^2 + (mid_y - target_y)^2)
  score <- distance - pmin(seg, 0.06) * 0.15
  score[!valid | !is.finite(score)] <- Inf
  idx <- which.min(score)
  if (!length(idx) || !is.finite(score[[idx]])) return(NULL)
  angle <- atan2(dy[[idx]], dx[[idx]]) * 180 / pi
  if (angle > 90) angle <- angle - 180
  if (angle < -90) angle <- angle + 180
  list(
    x = mid_x[[idx]],
    y = mid_y[[idx]],
    angle = angle,
    distance = distance[[idx]],
    segment = seg[[idx]]
  )
}

.hojas_ruta_pdf_street_label_candidates <- function(streets, project, target_x, target_y,
                                                    max_labels = 24L) {
  candidates <- list()
  for (feature in streets) {
    if (!nzchar(feature$name %||% "")) next
    major <- feature$rank <= 5L || isTRUE(feature$avenue_like) || identical(feature$class_group, "major")
    for (line in feature$lines) {
      p <- project(line)
      line_length <- .hojas_ruta_line_length_npc(p)
      if (nrow(p) < 2L || line_length < 0.018) next
      anchor <- .hojas_ruta_pdf_line_anchor_near(p, target_x, target_y)
      if (is.null(anchor)) next
      near_selected <- anchor$distance <= 0.22
      if (!major && !near_selected) next
      if (!major && line_length < 0.026) next
      candidates[[length(candidates) + 1L]] <- list(
        name = feature$name,
        x = anchor$x,
        y = anchor$y,
        angle = anchor$angle,
        distance = anchor$distance,
        major = major,
        rank = feature$rank,
        line_length = line_length,
        priority = if (near_selected) 0 else 1.5 +
          feature$rank * 0.12 +
          anchor$distance * 4 -
          min(line_length, 0.20)
      )
    }
  }
  if (!length(candidates)) return(list())
  ord <- order(
    vapply(candidates, `[[`, numeric(1), "priority"),
    vapply(candidates, `[[`, numeric(1), "distance"),
    -vapply(candidates, `[[`, numeric(1), "line_length")
  )
  candidates <- candidates[ord]
  accepted <- list()
  for (candidate in candidates) {
    if (candidate$x < 0.02 || candidate$x > 0.98 || candidate$y < 0.02 || candidate$y > 0.98) next
    collides <- vapply(accepted, function(other) {
      distance <- sqrt((candidate$x - other$x)^2 + (candidate$y - other$y)^2)
      same_name <- identical(toupper(candidate$name), toupper(other$name))
      distance < if (same_name) 0.074 else 0.052
    }, logical(1))
    if (length(collides) && any(collides)) next
    accepted[[length(accepted) + 1L]] <- candidate
    if (length(accepted) >= max_labels) break
  }
  accepted
}

.hojas_ruta_pdf_street_features <- function(ubigeo, bbox, max_features = 360L) {
  payload <- tryCatch(hojas_ruta_street_map_preview(ubigeo), error = function(e) NULL)
  features <- payload$geojson$features %||% list()
  if (!length(features)) return(list())
  out <- lapply(features, function(feature) {
    props <- feature$properties %||% list()
    lines <- .hojas_ruta_geometry_line_parts(feature$geometry)
    if (!length(lines)) return(NULL)
    feature_bbox <- .hojas_ruta_bbox_from_rings(lines)
    if (!.hojas_ruta_bbox_intersects(feature_bbox, bbox)) return(NULL)
    rank <- suppressWarnings(as.integer(props$rank %||% 9L))
    if (!is.finite(rank)) rank <- 9L
    highway <- as.character(props$highway %||% "")
    class_group <- as.character(props$class_group %||% "")
    name <- as.character(props$display_name %||% props$name %||% "")
    highway_principal <- grepl("^(motorway|trunk|primary|secondary|tertiary)", highway, ignore.case = TRUE)
    avenue_like <- isTRUE(props$avenue_like) ||
      identical(tolower(as.character(props$avenue_like %||% "")), "true") ||
      grepl("(^|\\b)(av\\.?|avenida|via expresa|circuito)(\\b|\\s)", name, ignore.case = TRUE) ||
      highway_principal ||
      class_group %in% c("major", "avenue")
    if (rank > 5L && isTRUE(avenue_like)) rank <- 5L
    list(
      id = as.character(props$osm_id %||% props$id %||% ""),
      name = name,
      highway = highway,
      class_group = if (highway_principal && identical(class_group, "detail")) "avenue" else class_group,
      rank = rank,
      avenue_like = avenue_like,
      length_m = suppressWarnings(as.numeric(props$length_m %||% 0)),
      lines = lines
    )
  })
  out <- out[!vapply(out, is.null, logical(1))]
  if (!length(out)) return(list())
  order_idx <- order(
    vapply(out, `[[`, integer(1), "rank"),
    -vapply(out, function(x) x$length_m %||% 0, numeric(1))
  )
  out <- out[order_idx]
  if (length(out) <= max_features) return(out)
  keep_major <- vapply(out, function(x) x$rank <= 5L || isTRUE(x$avenue_like), logical(1))
  major <- out[keep_major]
  detail <- out[!keep_major]
  detail_n <- min(length(detail), max(0L, max_features - length(major)))
  c(major, if (detail_n > 0L) detail[seq_len(detail_n)] else list())
}

.hojas_ruta_pdf_streets_near_focus <- function(ubigeo, focus_bbox, max_features = 360L) {
  for (pad in c(0.26, 0.45, 0.70, 1.05)) {
    bbox <- .hojas_ruta_bbox_expand(focus_bbox, pad = pad)
    streets <- .hojas_ruta_pdf_street_features(ubigeo, bbox, max_features = max_features)
    major_count <- sum(vapply(streets, function(x) x$rank <= 5L || isTRUE(x$avenue_like), logical(1)))
    if (length(streets) >= 8L || major_count >= 2L) {
      return(list(bbox = bbox, streets = streets))
    }
  }
  bbox <- .hojas_ruta_bbox_expand(focus_bbox, pad = 1.05)
  list(
    bbox = bbox,
    streets = .hojas_ruta_pdf_street_features(ubigeo, bbox, max_features = max_features)
  )
}

.hojas_ruta_pdf_context_features <- function(ubigeo, bbox, max_points = 34L) {
  payload <- tryCatch(hojas_ruta_context_map_preview(ubigeo), error = function(e) NULL)
  features <- payload$geojson$features %||% list()
  if (!length(features)) return(list(polygons = list(), lines = list(), points = list()))
  polys <- list()
  lines_out <- list()
  points_out <- list()
  for (feature in features) {
    props <- feature$properties %||% list()
    cls <- as.character(props$feature_class %||% "")
    if (!cls %in% c("green", "water", "square", "waterway", "coast")) next
    rank <- suppressWarnings(as.integer(props$rank %||% 9L))
    if (!is.finite(rank)) rank <- 9L
    label <- as.character(props$display_name %||% props$name %||% "")
    rings <- .hojas_ruta_geometry_rings(feature$geometry)
    line_parts <- .hojas_ruta_geometry_line_parts(feature$geometry)
    points <- .hojas_ruta_geometry_points(feature$geometry)
    geom_parts <- c(rings, line_parts, if (nrow(points)) list(points) else list())
    feature_bbox <- .hojas_ruta_bbox_from_rings(geom_parts)
    if (!.hojas_ruta_bbox_intersects(feature_bbox, bbox)) next
    item <- list(
      class = cls,
      kind = as.character(props$kind %||% ""),
      label = label,
      rank = rank,
      area_m2 = suppressWarnings(as.numeric(props$area_m2 %||% 0)),
      length_m = suppressWarnings(as.numeric(props$length_m %||% 0)),
      rings = rings,
      lines = line_parts,
      points = points
    )
    if (length(rings) && cls %in% c("green", "water", "square")) {
      polys[[length(polys) + 1L]] <- item
    }
    if (length(line_parts) && cls %in% c("water", "waterway", "coast")) {
      lines_out[[length(lines_out) + 1L]] <- item
    }
  }
  points_out <- points_out[order(vapply(points_out, `[[`, integer(1), "rank"))]
  if (length(points_out) > max_points) points_out <- points_out[seq_len(max_points)]
  list(polygons = polys, lines = lines_out, points = points_out)
}

.hojas_ruta_block_context_features <- function(block) {
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(block$ubigeo)
  if (is.null(profile)) return(NULL)
  path <- .hojas_ruta_block_map_packaged_file(profile, block$ubigeo)
  if (!file.exists(path)) return(NULL)
  geo <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
  if (is.null(geo) || !length(geo$features %||% list())) return(NULL)
  rings_by_feature <- lapply(geo$features, function(feature) {
    props <- feature$properties %||% list()
    rings <- .hojas_ruta_geometry_rings(feature$geometry)
    pts <- if (length(rings)) do.call(rbind, rings) else matrix(numeric(0), ncol = 2)
    list(
      id = as.character(props$cartografia_id %||% props$ID_MANZANA %||% props$IDMZNAR %||% ""),
      label = as.character(props$manzana_label %||% props$ID_MANZANA %||% props$IDMZNAR %||% ""),
      rings = rings,
      cx = if (nrow(pts)) mean(pts[, 1], na.rm = TRUE) else NA_real_,
      cy = if (nrow(pts)) mean(pts[, 2], na.rm = TRUE) else NA_real_
    )
  })
  all_rings <- unlist(lapply(rings_by_feature, `[[`, "rings"), recursive = FALSE)
  if (!length(all_rings)) return(NULL)
  selected_id <- as.character(block$id_manzana %||% "")
  selected_idx <- which(vapply(rings_by_feature, function(feature) identical(feature$id, selected_id), logical(1)))[1]
  if (is.na(selected_idx)) return(NULL)
  selected <- rings_by_feature[[selected_idx]]
  distances <- vapply(rings_by_feature, function(feature) {
    sqrt((feature$cx - selected$cx)^2 + (feature$cy - selected$cy)^2)
  }, numeric(1))
  distances[!is.finite(distances)] <- Inf
  context_idx <- order(distances)[seq_len(min(90L, length(distances)))]
  list(
    all = rings_by_feature,
    context = rings_by_feature[context_idx],
    selected = selected,
    selected_id = selected_id
  )
}

.hojas_ruta_project_rings <- function(rings, x, y, width, height, pad = 0.04) {
  pts <- do.call(rbind, rings)
  min_lon <- min(pts[, 1], na.rm = TRUE)
  max_lon <- max(pts[, 1], na.rm = TRUE)
  min_lat <- min(pts[, 2], na.rm = TRUE)
  max_lat <- max(pts[, 2], na.rm = TRUE)
  lon_pad <- max(1e-9, (max_lon - min_lon) * pad)
  lat_pad <- max(1e-9, (max_lat - min_lat) * pad)
  min_lon <- min_lon - lon_pad
  max_lon <- max_lon + lon_pad
  min_lat <- min_lat - lat_pad
  max_lat <- max_lat + lat_pad
  lon_range <- max(1e-9, max_lon - min_lon)
  lat_range <- max(1e-9, max_lat - min_lat)
  scale <- min(width / lon_range, height / lat_range)
  map_w <- lon_range * scale
  map_h <- lat_range * scale
  ox <- x + (width - map_w) / 2
  oy <- y + (height - map_h) / 2
  function(ring) {
    data.frame(
      x = ox + (ring[, 1] - min_lon) * scale,
      y = oy + map_h - (ring[, 2] - min_lat) * scale
    )
  }
}

.hojas_ruta_draw_block_minimap <- function(block, x = 0.08, y = 0.49, width = 0.84, height = 0.2) {
  ctx <- .hojas_ruta_block_context_features(block)
  if (is.null(ctx)) return(FALSE)
  all_rings <- unlist(lapply(ctx$all, `[[`, "rings"), recursive = FALSE)
  project <- .hojas_ruta_project_rings(all_rings, x, y, width, height, pad = 0.02)
  grid::grid.rect(
    x = x + width / 2,
    y = y + height / 2,
    width = width,
    height = height,
    gp = grid::gpar(fill = "#f8fafc", col = "#d6dee8", lwd = 0.8)
  )
  for (feature in ctx$all) {
    selected <- identical(feature$id, ctx$selected_id)
    for (ring in feature$rings) {
      p <- project(ring)
      grid::grid.polygon(
        x = p$x,
        y = p$y,
        default.units = "npc",
        gp = grid::gpar(
          fill = if (selected) "#0f766e" else NA,
          col = if (selected) "#064e3b" else "#cfd8e3",
          lwd = if (selected) 1.2 else 0.18
        )
      )
    }
  }
  grid::grid.text(
    "Manzana seleccionada",
    x = x + 0.012,
    y = y + height - 0.018,
    just = c("left", "top"),
    gp = grid::gpar(fontsize = 7.5, fontface = "bold", col = "#064e3b")
  )
  TRUE
}

.hojas_ruta_title_case <- function(x) {
  x <- tolower(as.character(x %||% ""))
  tools::toTitleCase(x)
}

.hojas_ruta_pdf_text <- function(label, x, y, w = NULL, h = NULL, align = "left",
                                 fontsize = 8, fontface = "plain", col = "black",
                                 rot = 0) {
  just <- switch(align,
                 center = c("center", "center"),
                 right = c("right", "center"),
                 c("left", "center"))
  tx <- if (is.null(w)) x else if (identical(align, "center")) x + w / 2 else if (identical(align, "right")) x + w - 0.006 else x + 0.006
  ty <- if (is.null(h)) y else y - h / 2
  grid::grid.text(label, x = tx, y = ty, just = just, rot = rot,
                  gp = grid::gpar(fontsize = fontsize, fontface = fontface, col = col))
}

.hojas_ruta_pdf_rect <- function(x, y, w, h, fill = NA, col = "black", lwd = 0.55) {
  grid::grid.rect(x = x + w / 2, y = y - h / 2, width = w, height = h,
                  gp = grid::gpar(fill = fill, col = col, lwd = lwd))
}

.hojas_ruta_draw_reference_table <- function(data, x, y, col_widths, row_heights,
                                             grey_cells = matrix(FALSE, nrow(data), ncol(data)),
                                             span_last = FALSE, font_size = 8,
                                             align = NULL, fontface = NULL,
                                             pad_x = 0.006, lineheight = 1.05) {
  if (is.null(align)) {
    align <- matrix("left", nrow(data), ncol(data))
    align[, seq(2L, ncol(data), by = 2L)] <- "center"
  } else if (length(align) == 1L) {
    align <- matrix(as.character(align), nrow(data), ncol(data))
  }
  if (is.null(fontface)) {
    fontface <- matrix("plain", nrow(data), ncol(data))
  } else if (length(fontface) == 1L) {
    fontface <- matrix(as.character(fontface), nrow(data), ncol(data))
  }
  yy <- y
  for (i in seq_len(nrow(data))) {
    h <- row_heights[[i]]
    xx <- x
    if (isTRUE(span_last) && i == nrow(data)) {
      .hojas_ruta_pdf_rect(x, yy, sum(col_widths), h, fill = "white")
      .hojas_ruta_pdf_text(data[i, 1], x, yy, sum(col_widths), h, align = "left", fontsize = font_size,
                           fontface = fontface[i, 1])
      yy <- yy - h
      next
    }
    for (j in seq_len(ncol(data))) {
      w <- col_widths[[j]]
      .hojas_ruta_pdf_rect(x = xx, y = yy, w = w, h = h,
                           fill = if (isTRUE(grey_cells[i, j])) "#dedede" else "white")
      just <- switch(align[i, j],
                     center = c("center", "center"),
                     right = c("right", "center"),
                     c("left", "center"))
      tx <- if (identical(align[i, j], "center")) xx + w / 2 else if (identical(align[i, j], "right")) xx + w - pad_x else xx + pad_x
      grid::grid.text(data[i, j], x = tx, y = yy - h / 2, just = just,
                      gp = grid::gpar(fontsize = font_size, fontface = fontface[i, j],
                                      lineheight = lineheight))
      xx <- xx + w
    }
    yy <- yy - h
  }
}

.hojas_ruta_legacy_asset_path <- function(filename) {
  candidates <- c(
    .hojas_ruta_inst_path("hojas_ruta", "assets", filename),
    file.path(path.expand("~"), "Documents", "Pulso", "GeneradorHojasDeZona", "assets", filename),
    file.path("/Users/gonzaloalmendariz/Documents/Pulso/GeneradorHojasDeZona/assets", filename)
  )
  hit <- candidates[file.exists(candidates)][1]
  if (!is.na(hit) && nzchar(hit)) normalizePath(hit, mustWork = FALSE) else NA_character_
}

.hojas_ruta_draw_png_asset <- function(filename, x, y, width, height) {
  path <- .hojas_ruta_legacy_asset_path(filename)
  if (is.na(path) || !nzchar(path) || !requireNamespace("png", quietly = TRUE)) return(FALSE)
  img <- tryCatch(png::readPNG(path), error = function(e) NULL)
  if (is.null(img)) return(FALSE)
  grid::grid.raster(img, x = x, y = y, width = width, height = height,
                    interpolate = TRUE)
  TRUE
}

.hojas_ruta_reference_quota_data <- function(block, quota_table) {
  qt <- as.data.frame(quota_table, stringsAsFactors = FALSE)
  age_cols <- setdiff(names(qt), c("territorio", "sexo", "TOTAL"))
  if (!length(age_cols)) age_cols <- character(0)
  domain <- qt[as.character(qt$territorio) != "TOTAL", , drop = FALSE]
  if (!nrow(domain)) domain <- qt
  find_row <- function(sex) {
    hit <- domain[tolower(as.character(domain$sexo)) == tolower(sex), , drop = FALSE]
    if (nrow(hit)) hit[1, , drop = FALSE] else NULL
  }
  hombre <- find_row("Hombre")
  mujer <- find_row("Mujer")
  total <- if (!is.null(hombre) || !is.null(mujer)) {
    vals <- lapply(c(age_cols, "TOTAL"), function(nm) {
      sum(c(
        if (!is.null(hombre) && nm %in% names(hombre)) suppressWarnings(as.numeric(hombre[[nm]])) else 0,
        if (!is.null(mujer) && nm %in% names(mujer)) suppressWarnings(as.numeric(mujer[[nm]])) else 0
      ), na.rm = TRUE)
    })
    names(vals) <- c(age_cols, "TOTAL")
    vals
  } else {
    vals <- as.list(rep(0, length(age_cols) + 1L))
    names(vals) <- c(age_cols, "TOTAL")
    vals
  }
  label_age <- function(x) {
    out <- toupper(gsub("-", " A ", x, fixed = TRUE))
    out <- gsub("[+]", " A MAS", out)
    paste("EDAD", out)
  }
  get_vals <- function(row) {
    if (is.null(row)) return(rep("", length(age_cols) + 1L))
    as.character(c(unlist(row[age_cols], use.names = FALSE), row$TOTAL[[1]] %||% ""))
  }
  rbind(
    c("", vapply(age_cols, label_age, character(1)), "TOTAL"),
    c("HOMBRE", get_vals(hombre)),
    c("MUJER", get_vals(mujer)),
    c("TOTAL", as.character(c(unlist(total[age_cols], use.names = FALSE), total$TOTAL)))
  )
}

.hojas_ruta_draw_reference_logo <- function(x = 0.085, y = 0.957, height = 0.038) {
  # El logo Pulso PUCP tiene proporcion ~2.6:1 (ancho:alto). Calculamos el ancho
  # respetando la proporcion del A4 vertical (8.27 x 11.69 in) para que el logo
  # no quede deformado.
  paper_ratio <- 11.69 / 8.27
  width <- height * 2.6 / paper_ratio
  if (isTRUE(.hojas_ruta_draw_png_asset("logo_pulso.png",
                                         x = x + width / 2, y = y,
                                         width = width, height = height))) {
    return(invisible(TRUE))
  }
  # Fallback tipografico monocromatico (impresion B/N).
  grid::grid.text("PULSO", x = x, y = y + 0.005, just = "left",
                  gp = grid::gpar(fontsize = 13, fontface = "bold", col = "black"))
  grid::grid.text("PUCP", x = x, y = y - 0.013, just = "left",
                  gp = grid::gpar(fontsize = 9, fontface = "bold", col = "#3a3a3a",
                                   letter.spacing = 1.5))
  invisible(TRUE)
}

.hojas_ruta_draw_systematic_diagram <- function(esquina, recorrido, arranque, constante) {
  grid::grid.text("Esquema de recorrido", x = 0.5, y = 0.41,
                  gp = grid::gpar(fontsize = 9.5, fontface = "bold", col = "#2a2a2a"))
  if (isTRUE(.hojas_ruta_draw_png_asset("graficoMsistematico.png", x = 0.5, y = 0.30, width = 0.275, height = 0.17))) {
    return(invisible(TRUE))
  }
  # Fallback vectorial monocromatico.
  left <- 0.355
  top <- 0.385
  cell <- 0.09
  gap <- 0.008
  labels <- matrix(c("Reemplazo 8", "Reemplazo 1", "Reemplazo 2",
                     "Reemplazo 7", "Manzana\ninicial",  "Reemplazo 3",
                     "Reemplazo 6", "Reemplazo 5", "Reemplazo 4"),
                   nrow = 3, byrow = TRUE)
  for (r in 1:3) {
    for (cidx in 1:3) {
      x <- left + (cidx - 1) * (cell + gap)
      y <- top - (r - 1) * (cell + gap)
      is_center <- r == 2 && cidx == 2
      .hojas_ruta_pdf_rect(x, y, cell, cell,
                           fill = if (is_center) "white" else "#ededed",
                           col = if (is_center) "black" else "#888888",
                           lwd = if (is_center) 0.9 else 0.4)
      if (is_center) {
        .hojas_ruta_pdf_text("4", x + 0.008, y - 0.011, fontsize = 6, fontface = "bold")
        .hojas_ruta_pdf_text("1", x + cell - 0.012, y - 0.011, align = "right", fontsize = 6, fontface = "bold")
        .hojas_ruta_pdf_text("3", x + 0.008, y - cell + 0.011, fontsize = 6, fontface = "bold")
        .hojas_ruta_pdf_text("2", x + cell - 0.012, y - cell + 0.011, align = "right", fontsize = 6, fontface = "bold")
      }
      grid::grid.text(labels[r, cidx], x = x + cell / 2, y = y - cell / 2,
                      gp = grid::gpar(fontsize = 6.4,
                                       fontface = if (is_center) "bold" else "plain",
                                       col = if (is_center) "black" else "#3a3a3a",
                                       lineheight = 1.0))
    }
  }
}

.hojas_ruta_short_block_label <- function(id) {
  id <- as.character(id %||% "")
  if (nchar(id) >= 15L) return(substr(id, 12L, nchar(id)))
  id
}

.hojas_ruta_draw_context_map_pdf <- function(block, config, out_pdf) {
  ctx <- .hojas_ruta_block_context_features(block)
  if (is.null(ctx)) return(FALSE)
  grDevices::pdf(out_pdf, paper = "special", width = 11.69, height = 8.27)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "white", col = NA))

  # Header consistente con la pagina 1: logo a la izq, contexto a la der.
  paper_ratio <- 8.27 / 11.69  # paper apaisado: ratio invertido
  logo_h <- 0.052
  logo_w <- logo_h * 2.6 / paper_ratio
  if (!isTRUE(.hojas_ruta_draw_png_asset("logo_pulso.png",
                                          x = 0.06 + logo_w / 2, y = 0.945,
                                          width = logo_w, height = logo_h))) {
    grid::grid.text("PULSO", x = 0.06, y = 0.95, just = "left",
                    gp = grid::gpar(fontsize = 16, fontface = "bold", col = "black"))
    grid::grid.text("PUCP", x = 0.06, y = 0.928, just = "left",
                    gp = grid::gpar(fontsize = 11, fontface = "bold", col = "#3a3a3a"))
  }
  grid::grid.text(
    sprintf("Mapa de contexto · UMP %d",
            as.integer(block$hoja_num %||% block$orden_seleccion %||% 1L)),
    x = 0.5, y = 0.95, gp = grid::gpar(fontsize = 15, fontface = "bold", col = "black")
  )
  grid::grid.text(
    sprintf("%s · UBIGEO %s · Zona %s · Manzana %s",
            .hojas_ruta_title_case(block$distrito), block$ubigeo, block$zona, block$manzana),
    x = 0.5, y = 0.918, gp = grid::gpar(fontsize = 10, col = "#3a3a3a")
  )
  grid::grid.lines(x = c(0.06, 0.96), y = c(0.895, 0.895),
                   gp = grid::gpar(col = "black", lwd = 0.5))

  map_x <- 0.035
  map_y <- 0.072
  map_w <- 0.785
  map_h <- 0.798
  grid::grid.rect(x = map_x + map_w / 2, y = map_y + map_h / 2, width = map_w, height = map_h,
                  gp = grid::gpar(fill = "#fbfbfb", col = "black", lwd = 0.7))

  context_rings <- unlist(lapply(ctx$context, `[[`, "rings"), recursive = FALSE)
  focus_bbox <- .hojas_ruta_pdf_focus_bbox(ctx$selected$rings, map_width = map_w, map_height = map_h)
  street_pack <- .hojas_ruta_pdf_streets_near_focus(block$ubigeo, focus_bbox)
  context_bbox <- street_pack$bbox
  streets <- street_pack$streets
  urban_context <- .hojas_ruta_pdf_context_features(block$ubigeo, context_bbox)
  visible_features <- lapply(ctx$all, function(feature) {
    feature_bbox <- .hojas_ruta_bbox_from_rings(feature$rings)
    if (.hojas_ruta_bbox_intersects(feature_bbox, context_bbox)) feature else NULL
  })
  visible_features <- visible_features[!vapply(visible_features, is.null, logical(1))]
  if (!length(visible_features)) visible_features <- ctx$context
  focus_ring <- .hojas_ruta_bbox_to_ring(focus_bbox)
  project <- .hojas_ruta_project_rings(list(focus_ring), 0.012, 0.012, 0.976, 0.976, pad = 0.02)

  grid::pushViewport(grid::viewport(
    x = map_x + map_w / 2,
    y = map_y + map_h / 2,
    width = map_w,
    height = map_h,
    clip = "on"
  ))

  # Contexto urbano OSM en escala de grises: parques/agua/plazas debajo de la grilla de manzanas.
  for (feature in urban_context$polygons) {
    fill <- switch(feature$class,
                   water = "#eeeeee",
                   square = "#f2f2f2",
                   "#e7e7e7")
    border <- switch(feature$class,
                     water = "#777777",
                     square = "#666666",
                     "#555555")
    for (ring in feature$rings) {
      p <- project(ring)
      grid::grid.polygon(
        x = p$x, y = p$y, default.units = "npc",
        gp = grid::gpar(fill = fill, col = border, lwd = 0.35)
      )
    }
  }

  # Manzanas vecinas: el tejido urbano queda visible, no desaparece alrededor de la UMP.
  for (feature in visible_features) {
    if (identical(feature$id, ctx$selected_id)) next
    for (ring in feature$rings) {
      p <- project(ring)
      grid::grid.polygon(
        x = p$x, y = p$y, default.units = "npc",
        gp = grid::gpar(fill = "#fafafa", col = "#595959", lwd = 0.34)
      )
    }
  }

  draw_street_line <- function(line, gp) {
    p <- project(line)
    if (nrow(p) < 2L) return(invisible(FALSE))
    grid::grid.lines(x = p$x, y = p$y, default.units = "npc", gp = gp)
    invisible(TRUE)
  }
  street_width <- function(feature, inner = FALSE) {
    base <- if (feature$rank <= 3L || identical(feature$class_group, "major")) {
      3.4
    } else if (feature$rank <= 5L || isTRUE(feature$avenue_like)) {
      2.45
    } else {
      1.05
    }
    if (inner) base * 0.58 else base
  }

  # Vias: casing oscuro + centro claro, legible en blanco y negro.
  for (feature in streets) {
    for (line in feature$lines) {
      draw_street_line(
        line,
        grid::gpar(
          col = if (feature$rank <= 5L || isTRUE(feature$avenue_like)) "#222222" else "#646464",
          lwd = street_width(feature, inner = FALSE),
          lineend = "round", linejoin = "round"
        )
      )
    }
  }
  for (feature in streets) {
    for (line in feature$lines) {
      draw_street_line(
        line,
        grid::gpar(
          col = if (feature$rank <= 5L || isTRUE(feature$avenue_like)) "#ffffff" else "#fbfbfb",
          lwd = street_width(feature, inner = TRUE),
          lineend = "round", linejoin = "round"
        )
      )
    }
  }

  # Lineas de referencia: tren/costa/canales si existen.
  for (feature in urban_context$lines) {
    for (line in feature$lines) {
      draw_street_line(
        line,
        grid::gpar(
          col = if (identical(feature$class, "rail")) "black" else "#6f6f6f",
          lwd = if (identical(feature$class, "rail")) 1.1 else 0.75,
          lty = if (identical(feature$class, "rail")) "22" else "solid",
          lineend = "round"
        )
      )
    }
  }

  # Etiquetas de calles: primero las calles que realmente rodean la manzana,
  # luego avenidas principales de referencia.
  p_sel_center <- project(matrix(c(ctx$selected$cx, ctx$selected$cy), ncol = 2))
  street_labels <- .hojas_ruta_pdf_street_label_candidates(
    streets,
    project,
    target_x = p_sel_center$x[[1]],
    target_y = p_sel_center$y[[1]],
    max_labels = 24L
  )
  for (label in street_labels) {
    grid::grid.text(
      label$name,
      x = label$x,
      y = label$y,
      rot = label$angle,
      gp = grid::gpar(
        fontsize = if (isTRUE(label$major)) 6.1 else 5.2,
        fontface = "bold",
        col = "#111111"
      )
    )
  }

  # Manzana asignada: alto contraste B/N sin tapar por completo el contexto.
  for (ring in ctx$selected$rings) {
    p <- project(ring)
    grid::grid.polygon(
      x = p$x, y = p$y, default.units = "npc",
      gp = grid::gpar(fill = "#bdbdbd", col = "black", lwd = 1.8)
    )
  }

  # La identificacion textual queda en el panel lateral para no tapar manzanas
  # vecinas ni manzanas de otras zonas dentro del mapa operativo.
  grid::popViewport()
  grid::grid.rect(x = map_x + map_w / 2, y = map_y + map_h / 2, width = map_w, height = map_h,
                  gp = grid::gpar(fill = NA, col = "black", lwd = 0.7))

  # Sidebar derecho: 3 secciones limpias en B/N.
  side_x <- 0.84
  side_w <- 0.13

  # Seccion 1: Ubicacion de campo
  .hojas_ruta_pdf_text("UBICACIÓN DE CAMPO", side_x, 0.86,
                       fontsize = 8.5, fontface = "bold", col = "black")
  grid::grid.lines(x = c(side_x, side_x + side_w), y = c(0.847, 0.847),
                   gp = grid::gpar(col = "black", lwd = 0.5))
  details <- list(
    list("Distrito", .hojas_ruta_title_case(block$distrito)),
    list("Zona",     as.character(block$zona %||% "")),
    list("Manzana",  as.character(block$manzana %||% "")),
    list("ID",       as.character(block$id_manzana %||% "")),
    list("Viviendas", format(as.integer(block$viviendas %||% 0L), big.mark = ",")),
    list("Entrevistas", format(as.integer(block$entrevistas %||% 0L), big.mark = ","))
  )
  detail_y <- 0.83
  for (d in details) {
    grid::grid.text(d[[1]], x = side_x, y = detail_y, just = c("left", "center"),
                    gp = grid::gpar(fontsize = 7.5, fontface = "bold", col = "#3a3a3a"))
    grid::grid.text(d[[2]], x = side_x + side_w, y = detail_y, just = c("right", "center"),
                    gp = grid::gpar(fontsize = 7.5, col = "black"))
    detail_y <- detail_y - 0.026
  }

  # Seccion 2: Mini contexto distrital
  mini_x <- side_x
  mini_y <- 0.34
  mini_w <- side_w
  mini_h <- 0.24
  .hojas_ruta_pdf_text("CONTEXTO DISTRITAL", side_x, mini_y + mini_h + 0.018,
                       fontsize = 8.5, fontface = "bold", col = "black")
  grid::grid.lines(x = c(side_x, side_x + side_w), y = c(mini_y + mini_h + 0.005, mini_y + mini_h + 0.005),
                   gp = grid::gpar(col = "black", lwd = 0.5))
  grid::grid.rect(x = mini_x + mini_w / 2, y = mini_y + mini_h / 2, width = mini_w, height = mini_h,
                  gp = grid::gpar(fill = "white", col = "#9a9a9a", lwd = 0.5))
  all_rings <- unlist(lapply(ctx$all, `[[`, "rings"), recursive = FALSE)
  mini_project <- .hojas_ruta_project_rings(all_rings, mini_x + 0.008, mini_y + 0.008, mini_w - 0.016, mini_h - 0.016, pad = 0.04)
  for (feature in ctx$all) {
    selected <- identical(feature$id, ctx$selected_id)
    for (ring in feature$rings) {
      p <- mini_project(ring)
      grid::grid.polygon(
        x = p$x, y = p$y, default.units = "npc",
        gp = grid::gpar(fill = if (selected) "black" else NA,
                        col = if (selected) "black" else "#cfcfcf",
                        lwd = if (selected) 0.9 else 0.12)
      )
    }
  }

  # Seccion 3: Leyenda
  legend_top <- 0.30
  .hojas_ruta_pdf_text("LEYENDA", side_x, legend_top,
                       fontsize = 8.5, fontface = "bold", col = "black")
  grid::grid.lines(x = c(side_x, side_x + side_w), y = c(legend_top - 0.013, legend_top - 0.013),
                   gp = grid::gpar(col = "black", lwd = 0.5))
  grid::grid.rect(x = side_x + 0.012, y = legend_top - 0.04, width = 0.018, height = 0.018,
                  gp = grid::gpar(fill = "#bdbdbd", col = "black", lwd = 1.0))
  grid::grid.text("Manzana asignada", x = side_x + 0.030, y = legend_top - 0.04,
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "black"))
  grid::grid.rect(x = side_x + 0.012, y = legend_top - 0.072, width = 0.018, height = 0.018,
                  gp = grid::gpar(fill = "#fafafa", col = "#595959", lwd = 0.5))
  grid::grid.text("Manzanas vecinas", x = side_x + 0.030, y = legend_top - 0.072,
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#3a3a3a"))
  grid::grid.lines(x = c(side_x + 0.003, side_x + 0.021), y = c(legend_top - 0.103, legend_top - 0.103),
                   gp = grid::gpar(col = "#3f3f3f", lwd = 2.2, lineend = "round"))
  grid::grid.lines(x = c(side_x + 0.003, side_x + 0.021), y = c(legend_top - 0.103, legend_top - 0.103),
                   gp = grid::gpar(col = "white", lwd = 1.3, lineend = "round"))
  grid::grid.text("Avenida / vía principal", x = side_x + 0.030, y = legend_top - 0.103,
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#3a3a3a"))
  grid::grid.lines(x = c(side_x + 0.003, side_x + 0.021), y = c(legend_top - 0.134, legend_top - 0.134),
                   gp = grid::gpar(col = "#777777", lwd = 0.9, lineend = "round"))
  grid::grid.lines(x = c(side_x + 0.003, side_x + 0.021), y = c(legend_top - 0.134, legend_top - 0.134),
                   gp = grid::gpar(col = "#f4f4f4", lwd = 0.5, lineend = "round"))
  grid::grid.text("Calle local", x = side_x + 0.030, y = legend_top - 0.134,
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#3a3a3a"))
  grid::grid.rect(x = side_x + 0.012, y = legend_top - 0.165, width = 0.018, height = 0.018,
                  gp = grid::gpar(fill = "#e7e7e7", col = "#555555", lwd = 0.5))
  grid::grid.text("Parque / plaza / agua", x = side_x + 0.030, y = legend_top - 0.165,
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#3a3a3a"))
  # Footer en B/N
  grid::grid.lines(x = c(0.06, 0.96), y = c(0.05, 0.05),
                   gp = grid::gpar(col = "#888888", lwd = 0.4))
  grid::grid.text("Pulso PUCP · Mapa de contexto",
                  x = 0.06, y = 0.035, just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  grid::grid.text(format(Sys.Date(), "%d/%m/%Y"),
                  x = 0.96, y = 0.035, just = c("right", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  invisible(TRUE)
}

.hojas_ruta_zone_summary <- function(sample) {
  blocks <- .hojas_ruta_rows_df(sample$blocks)
  if (!nrow(blocks)) return(data.frame())
  frame <- hojas_ruta_inei_frame()
  keys <- unique(paste(blocks$ubigeo, blocks$zona, sep = "|"))
  frame <- frame[paste(frame$ubigeo, frame$zona, sep = "|") %in% keys, , drop = FALSE]
  zone_stats <- stats::aggregate(
    frame[c("viviendas", "poblacion")],
    by = frame[c("ubigeo", "departamento", "provincia", "distrito", "zona")],
    FUN = sum,
    na.rm = TRUE
  )
  counts <- stats::aggregate(frame["id_manzana"], by = frame[c("ubigeo", "zona")], FUN = length)
  names(counts)[3] <- "manzanas_zona"
  zone_stats <- merge(zone_stats, counts, by = c("ubigeo", "zona"), all.x = TRUE)
  sel <- stats::aggregate(
    blocks["entrevistas"],
    by = blocks[c("ubigeo", "distrito", "zona")],
    FUN = sum,
    na.rm = TRUE
  )
  names(sel)[4] <- "entrevistas"
  sel_count <- stats::aggregate(blocks["id_manzana"], by = blocks[c("ubigeo", "zona")], FUN = length)
  names(sel_count)[3] <- "manzanas_seleccionadas"
  out <- merge(zone_stats, sel, by = c("ubigeo", "distrito", "zona"), all.x = TRUE)
  out <- merge(out, sel_count, by = c("ubigeo", "zona"), all.x = TRUE)
  out$entrevistas[is.na(out$entrevistas)] <- 0
  out$manzanas_seleccionadas[is.na(out$manzanas_seleccionadas)] <- 0
  out <- out[order(out$distrito, out$zona), , drop = FALSE]
  rownames(out) <- NULL
  out[c(
    "departamento", "provincia", "distrito", "ubigeo", "zona",
    "poblacion", "viviendas", "manzanas_zona",
    "manzanas_seleccionadas", "entrevistas"
  )]
}

.hojas_ruta_zone_context_features <- function(ubigeo, zona, selected_ids = character(0)) {
  profile <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  if (is.null(profile)) return(NULL)
  path <- .hojas_ruta_block_map_packaged_file(profile, ubigeo)
  if (!file.exists(path)) return(NULL)
  geo <- tryCatch(.hojas_ruta_read_json_any(path), error = function(e) NULL)
  if (is.null(geo) || !length(geo$features %||% list())) return(NULL)
  zona <- as.character(zona %||% "")
  selected_ids <- as.character(selected_ids %||% character(0))
  features_all <- lapply(geo$features, function(feature) {
    props <- feature$properties %||% list()
    id <- as.character(props$ID_MANZANA %||% props$IDMZNAR %||% props$cartografia_id %||% "")
    z <- as.character(props$inei_zona %||% .hojas_ruta_zone_code_from_id(id) %||% "")
    rings <- .hojas_ruta_geometry_rings(feature$geometry)
    if (!length(rings)) return(NULL)
    pts <- do.call(rbind, rings)
    list(
      id = id,
      label = .hojas_ruta_short_block_label(id),
      zona = z,
      in_zone = identical(z, zona),
      selected = id %in% selected_ids,
      rings = rings,
      cx = mean(pts[, 1], na.rm = TRUE),
      cy = mean(pts[, 2], na.rm = TRUE)
    )
  })
  features_all <- features_all[!vapply(features_all, is.null, logical(1))]
  zone_features <- features_all[vapply(features_all, function(x) isTRUE(x$in_zone), logical(1))]
  if (!length(zone_features)) return(NULL)
  zone_bbox <- .hojas_ruta_bbox_expand(
    .hojas_ruta_bbox_from_rings(unlist(lapply(zone_features, `[[`, "rings"), recursive = FALSE)),
    pad = 0.22
  )
  features <- features_all[vapply(features_all, function(feature) {
    isTRUE(feature$in_zone) ||
      .hojas_ruta_bbox_intersects(.hojas_ruta_bbox_from_rings(feature$rings), zone_bbox)
  }, logical(1))]
  list(features = features, selected_ids = selected_ids)
}

.hojas_ruta_draw_zone_sheet_pdf <- function(zone_row, zone_blocks, config, out_pdf) {
  ctx <- .hojas_ruta_zone_context_features(zone_row$ubigeo, zone_row$zona, zone_blocks$id_manzana)
  if (is.null(ctx)) return(FALSE)
  grDevices::pdf(out_pdf, paper = "special", width = 11.69, height = 8.27)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "white", col = NA))

  .hojas_ruta_draw_reference_logo(x = 0.055, y = 0.948, height = 0.046)
  grid::grid.text("Hoja operativa de zona",
                  x = 0.5, y = 0.952,
                  gp = grid::gpar(fontsize = 16, fontface = "bold", col = "black"))
  grid::grid.text(
    sprintf("%s · UBIGEO %s · Zona %s",
            .hojas_ruta_title_case(zone_row$distrito), zone_row$ubigeo, zone_row$zona),
    x = 0.5, y = 0.923,
    gp = grid::gpar(fontsize = 10, col = "#3a3a3a")
  )
  grid::grid.lines(x = c(0.055, 0.955), y = c(0.895, 0.895),
                   gp = grid::gpar(col = "black", lwd = 0.5))

  map_x <- 0.045
  map_y <- 0.075
  map_w <- 0.62
  map_h <- 0.79
  grid::grid.rect(x = map_x + map_w / 2, y = map_y + map_h / 2,
                  width = map_w, height = map_h,
                  gp = grid::gpar(fill = "#f8fafc", col = "black", lwd = 0.7))
  all_rings <- unlist(lapply(ctx$features, `[[`, "rings"), recursive = FALSE)
  project <- .hojas_ruta_project_rings(all_rings, map_x + 0.015, map_y + 0.015, map_w - 0.03, map_h - 0.03, pad = 0.08)
  for (feature in ctx$features) {
    for (ring in feature$rings) {
      p <- project(ring)
      fill <- if (isTRUE(feature$selected)) {
        "#bdbdbd"
      } else if (isTRUE(feature$in_zone)) {
        "#f5f5f5"
      } else {
        "#fbfbfb"
      }
      col <- if (isTRUE(feature$selected)) {
        "black"
      } else if (isTRUE(feature$in_zone)) {
        "#686868"
      } else {
        "#b8b8b8"
      }
      lwd <- if (isTRUE(feature$selected)) 1.2 else if (isTRUE(feature$in_zone)) 0.36 else 0.22
      grid::grid.polygon(
        x = p$x, y = p$y, default.units = "npc",
        gp = grid::gpar(fill = fill, col = col, lwd = lwd)
      )
    }
  }
  # La lista lateral identifica las manzanas seleccionadas; evitamos rotulos
  # sobre el mapa para no tapar manzanas colindantes.

  side_x <- 0.69
  side_w <- 0.265
  .hojas_ruta_pdf_text("RESUMEN DE ZONA", side_x, 0.86,
                       fontsize = 9, fontface = "bold", col = "black")
  grid::grid.lines(x = c(side_x, side_x + side_w), y = c(0.847, 0.847),
                   gp = grid::gpar(col = "black", lwd = 0.5))
  summary <- list(
    list("Distrito", .hojas_ruta_title_case(zone_row$distrito)),
    list("Zona", as.character(zone_row$zona)),
    list("Manzanas de la zona", format(as.integer(zone_row$manzanas_zona %||% 0L), big.mark = ",")),
    list("Manzanas seleccionadas", format(as.integer(zone_row$manzanas_seleccionadas %||% 0L), big.mark = ",")),
    list("Entrevistas", format(as.integer(zone_row$entrevistas %||% 0L), big.mark = ",")),
    list("Viviendas censadas", format(as.integer(zone_row$viviendas %||% 0L), big.mark = ","))
  )
  yy <- 0.825
  for (item in summary) {
    grid::grid.text(item[[1]], x = side_x, y = yy, just = c("left", "center"),
                    gp = grid::gpar(fontsize = 7.8, fontface = "bold", col = "#3a3a3a"))
    grid::grid.text(item[[2]], x = side_x + side_w, y = yy, just = c("right", "center"),
                    gp = grid::gpar(fontsize = 7.8, col = "black"))
    yy <- yy - 0.026
  }

  .hojas_ruta_pdf_text("MANZANAS SELECCIONADAS", side_x, 0.61,
                       fontsize = 9, fontface = "bold", col = "black")
  grid::grid.lines(x = c(side_x, side_x + side_w), y = c(0.597, 0.597),
                   gp = grid::gpar(col = "black", lwd = 0.5))
  rows <- zone_blocks[order(zone_blocks$orden_seleccion), , drop = FALSE]
  rows <- utils::head(rows, 18L)
  tbl <- cbind(
    Manzana = as.character(rows$manzana),
    Entrev = as.character(rows$entrevistas),
    Viviendas = as.character(rows$viviendas)
  )
  if (nrow(tbl)) {
    data <- rbind(c("Manzana", "Entrev.", "Viviendas"), tbl)
    grey <- matrix(FALSE, nrow(data), ncol(data))
    grey[1, ] <- TRUE
    font <- matrix("plain", nrow(data), ncol(data))
    font[1, ] <- "bold"
    .hojas_ruta_draw_reference_table(
      data,
      x = side_x,
      y = 0.58,
      col_widths = c(0.105, 0.07, 0.09),
      row_heights = rep(0.026, nrow(data)),
      grey_cells = grey,
      font_size = 7.4,
      align = "center",
      fontface = font
    )
  }

  grid::grid.rect(x = side_x + 0.012, y = 0.12, width = 0.018, height = 0.018,
                  gp = grid::gpar(fill = "#bdbdbd", col = "black", lwd = 1.0))
  grid::grid.text("Manzana seleccionada",
                  x = side_x + 0.03, y = 0.12, just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "black"))
  grid::grid.rect(x = side_x + 0.012, y = 0.092, width = 0.018, height = 0.018,
                  gp = grid::gpar(fill = "white", col = "#9a9a9a", lwd = 0.5))
  grid::grid.text("Manzana no seleccionada",
                  x = side_x + 0.03, y = 0.092, just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#3a3a3a"))
  grid::grid.lines(x = c(0.055, 0.955), y = c(0.05, 0.05),
                   gp = grid::gpar(col = "#888888", lwd = 0.4))
  grid::grid.text("Pulso PUCP · Hoja de zona",
                  x = 0.055, y = 0.035, just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  grid::grid.text(format(Sys.Date(), "%d/%m/%Y"),
                  x = 0.955, y = 0.035, just = c("right", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  invisible(TRUE)
}

.hojas_ruta_draw_integrated_pdf_page1 <- function(block, quota_table, meta, config, out_pdf) {
  grDevices::pdf(out_pdf, paper = "a4", width = 8.27, height = 11.69)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "white", col = NA))

  start <- as.integer(block$rango_inicio %||% 1L)
  end <- as.integer(block$rango_fin %||% block$entrevistas %||% start)
  hoja_num <- as.integer(block$hoja_num %||% block$orden_seleccion %||% 1L)
  viviendas <- as.integer(block$viviendas %||% 0L)
  entrevistas <- max(1L, as.integer(block$entrevistas %||% 1L))
  constante <- max(1L, floor(viviendas / entrevistas))
  esquina <- ((hoja_num - 1L) %% 4L) + 1L
  recorrido <- if (identical(config$sampling_method, "conglomerado_fijo")) 2L else 1L
  arranque <- ((as.integer(config$seed %||% 2017L) + hoja_num) %% constante) + 1L
  project_code <- as.character(config$project_code %||% "001")

  # Header: logo a la izquierda, contexto a la derecha. Linea separadora delgada.
  .hojas_ruta_draw_reference_logo(x = 0.085, y = 0.957, height = 0.034)
  grid::grid.text(
    sprintf("%s · %s",
            toupper(.hojas_ruta_title_case(block$departamento %||% "")),
            toupper(.hojas_ruta_title_case(block$provincia %||% ""))),
    x = 0.92, y = 0.962, just = c("right", "center"),
    gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = "black", letter.spacing = 1)
  )
  grid::grid.text(
    sprintf("Encuestas %s a %s", start, end),
    x = 0.92, y = 0.948, just = c("right", "center"),
    gp = grid::gpar(fontsize = 8, col = "#4a4a4a")
  )
  grid::grid.lines(x = c(0.085, 0.92), y = c(0.93, 0.93),
                   gp = grid::gpar(col = "black", lwd = 0.6))

  # Titulo y subtitulo: jerarquia tipografica clara.
  grid::grid.text(
    sprintf("Ficha de trabajo de campo · UMP %d", hoja_num),
    x = 0.085, y = 0.905, just = c("left", "center"),
    gp = grid::gpar(fontsize = 14, fontface = "bold", col = "black")
  )
  grid::grid.text(
    sprintf("%s · Zona %s", .hojas_ruta_title_case(block$distrito %||% ""), as.character(block$zona %||% "")),
    x = 0.085, y = 0.886, just = c("left", "center"),
    gp = grid::gpar(fontsize = 11, col = "#2a2a2a")
  )
  grid::grid.text(
    sprintf("UBIGEO %s", block$ubigeo),
    x = 0.92, y = 0.886, just = c("right", "center"),
    gp = grid::gpar(fontsize = 9.5, fontface = "bold", col = "#4a4a4a", letter.spacing = 0.8)
  )

  .hojas_ruta_pdf_text("A. Datos generales", 0.085, 0.852,
                       fontsize = 10, fontface = "bold")
  year <- format(Sys.Date(), "%Y")
  table_a <- matrix(c(
    "CÓDIGO DE ESTUDIO", project_code, "ESTRATO", as.character(block$territorio_muestral %||% "-"),
    "FECHA INICIO / FIN", sprintf("__/__/%s   __/__/%s", year, year), "NIVEL SOCIOECONÓMICO", "-",
    "NOMBRE DEL\nENCUESTADOR", "", "CÓDIGO DE ZONA", as.character(block$zona %||% ""),
    "SUPERVISOR DE\nMESA", "", "CÓDIGO DE MANZANA", as.character(block$manzana %||% ""),
    "SUPERVISOR DE\nCAMPO", "", "TOTAL DE VIVIENDAS", as.character(viviendas),
    "Indique líneas de transporte, rutas y paraderos de referencia para llegar a la zona:\n\n\n", "", "", ""
  ), ncol = 4, byrow = TRUE)
  grey_a <- matrix(FALSE, nrow(table_a), ncol(table_a))
  grey_a[1:5, c(1, 3)] <- TRUE
  align_a <- matrix("left", nrow(table_a), ncol(table_a))
  align_a[1:5, c(2, 4)] <- "center"
  font_a <- matrix("plain", nrow(table_a), ncol(table_a))
  font_a[1:5, c(1, 3)] <- "bold"
  .hojas_ruta_draw_reference_table(
    table_a, x = 0.085, y = 0.838,
    col_widths = c(0.232, 0.183, 0.232, 0.188),
    row_heights = c(0.026, 0.027, 0.034, 0.034, 0.034, 0.052),
    grey_cells = grey_a,
    span_last = TRUE,
    font_size = 7.6,
    align = align_a,
    fontface = font_a,
    lineheight = 1.1
  )

  .hojas_ruta_pdf_text("B. Cuotas de sexo y edad", 0.085, 0.605,
                       fontsize = 10, fontface = "bold")
  quota_data <- .hojas_ruta_reference_quota_data(block, quota_table)
  q_cols <- ncol(quota_data)
  q_width <- 0.835
  q_left <- 0.5 - q_width / 2
  q_label <- 0.135
  q_widths <- c(q_label, rep((q_width - q_label) / (q_cols - 1), q_cols - 1))
  grey_q <- matrix(FALSE, nrow(quota_data), ncol(quota_data))
  grey_q[1, ] <- TRUE
  grey_q[, 1] <- TRUE
  align_q <- matrix("center", nrow(quota_data), ncol(quota_data))
  font_q <- matrix("plain", nrow(quota_data), ncol(quota_data))
  font_q[1, ] <- "bold"
  font_q[, 1] <- "bold"
  .hojas_ruta_draw_reference_table(
    quota_data, x = q_left, y = 0.589,
    col_widths = q_widths,
    row_heights = rep(0.031, nrow(quota_data)),
    grey_cells = grey_q,
    font_size = if (q_cols > 6) 6.5 else 8.2,
    align = align_q,
    fontface = font_q,
    lineheight = 1.0
  )

  .hojas_ruta_pdf_text("C. Selección sistemática de viviendas", 0.085, 0.435,
                       fontsize = 10, fontface = "bold")
  .hojas_ruta_draw_systematic_diagram(esquina, recorrido, arranque, constante)
  table_c <- matrix(c(
    "ESQUINA DE INICIO", as.character(esquina),
    "TIPO DE RECORRIDO", as.character(recorrido),
    "VIVIENDA DE INICIO", as.character(arranque),
    "CONSTANTE DE SALTO", as.character(constante)
  ), ncol = 2, byrow = TRUE)
  grey_c <- matrix(FALSE, nrow(table_c), ncol(table_c))
  grey_c[, 1] <- TRUE
  align_c <- matrix("center", nrow(table_c), ncol(table_c))
  align_c[, 1] <- "left"
  font_c <- matrix("plain", nrow(table_c), ncol(table_c))
  font_c[, 1] <- "bold"
  .hojas_ruta_draw_reference_table(
    table_c, x = 0.215, y = 0.175,
    col_widths = c(0.34, 0.235),
    row_heights = rep(0.029, 4),
    grey_cells = grey_c,
    font_size = 9.5,
    align = align_c,
    fontface = font_c
  )

  # Footer minimalista: linea fina + tres elementos balanceados.
  grid::grid.lines(x = c(0.085, 0.92), y = c(0.052, 0.052),
                   gp = grid::gpar(col = "#888888", lwd = 0.4))
  grid::grid.text("Pulso PUCP · Ficha de trabajo de campo",
                  x = 0.085, y = 0.038, just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  grid::grid.text(sprintf("UMP %d", hoja_num),
                  x = 0.5, y = 0.038,
                  gp = grid::gpar(fontsize = 7.5, fontface = "bold", col = "#4a4a4a"))
  grid::grid.text(format(Sys.Date(), "%d/%m/%Y"),
                  x = 0.92, y = 0.038, just = c("right", "center"),
                  gp = grid::gpar(fontsize = 7.5, col = "#4a4a4a"))
  invisible(out_pdf)
}

.hojas_ruta_draw_integrated_pdf <- function(block, quota_table, meta, config, out_pdf) {
  tmp_dir <- tempfile("hojas_ruta_pdf_")
  dir.create(tmp_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp_dir, recursive = TRUE, force = TRUE), add = TRUE)
  page1 <- file.path(tmp_dir, "ficha.pdf")
  page2 <- file.path(tmp_dir, "mapa_contexto.pdf")
  .hojas_ruta_draw_integrated_pdf_page1(block, quota_table, meta, config, page1)
  map_ok <- tryCatch(
    .hojas_ruta_draw_context_map_pdf(block, config, page2),
    error = function(e) FALSE
  )
  if (isTRUE(map_ok) && file.exists(page2)) {
    .hojas_ruta_combinar_pdf(c(page1, page2), out_pdf)
  } else {
    file.copy(page1, out_pdf, overwrite = TRUE)
  }
  invisible(out_pdf)
}

.hojas_ruta_write_integrated_workbook <- function(sample, path, technical = FALSE) {
  wb <- openxlsx::createWorkbook()
  meta <- as.data.frame(sample$frame_meta[setdiff(names(sample$frame_meta), c("methods"))],
                        stringsAsFactors = FALSE)
  openxlsx::addWorksheet(wb, "Fuente")
  openxlsx::writeData(wb, "Fuente", t(meta), colNames = FALSE)
  quota_cells <- .hojas_ruta_rows_df(sample$quota$cells)
  quota_table <- .hojas_ruta_rows_df(sample$quota$table)
  blocks <- .hojas_ruta_rows_df(sample$blocks)
  zone_summary <- .hojas_ruta_zone_summary(sample)
  alerts <- .hojas_ruta_rows_df(sample$alerts)
  openxlsx::addWorksheet(wb, "Cuotas")
  openxlsx::writeData(wb, "Cuotas", quota_table)
  openxlsx::addWorksheet(wb, "Cuotas_detalle")
  openxlsx::writeData(wb, "Cuotas_detalle", quota_cells)
  openxlsx::addWorksheet(wb, "Manzanas")
  openxlsx::writeData(wb, "Manzanas", blocks)
  openxlsx::addWorksheet(wb, "Resumen_zonas")
  openxlsx::writeData(wb, "Resumen_zonas", zone_summary)
  openxlsx::addWorksheet(wb, "Alertas")
  if (nrow(alerts)) openxlsx::writeData(wb, "Alertas", alerts) else openxlsx::writeData(wb, "Alertas", "Sin alertas.")
  if (isTRUE(technical)) {
    params <- data.frame(
      parametro = c("n_objetivo", "metodo", "semilla", "medida_tamano",
                    "max_por_manzana", "entrevistas_por_manzana", "tamano_ruta",
                    "modo_rangos_edad", "asignacion_zonas",
                    "modo_tamano_muestra", "confianza", "margen_total",
                    "margen_distrito", "proporcion_esperada", "efecto_diseno",
                    "respuesta_esperada", "ajuste_poblacion_finita"),
      valor = c(sample$config$n_objetivo, sample$config$sampling_method,
                sample$config$seed, sample$config$measure_var,
                sample$config$max_per_manzana, sample$config$entrevistas_por_manzana,
                .hojas_ruta_route_size(sample$config),
                sample$config$age_range_mode %||% "manual",
                sample$config$zone_allocation %||% "proportional",
                sample$config$sample_size_mode,
                sample$config$sample_size$confidence_level,
                sample$config$sample_size$margin_total,
                sample$config$sample_size$margin_district,
                sample$config$sample_size$expected_proportion,
                sample$config$sample_size$design_effect,
                sample$config$sample_size$response_rate,
                sample$config$sample_size$apply_fpc),
      stringsAsFactors = FALSE
    )
    openxlsx::addWorksheet(wb, "Parametros")
    openxlsx::writeData(wb, "Parametros", params)
  }
  for (sh in names(wb)) {
    openxlsx::setColWidths(wb, sh, cols = 1:40, widths = "auto")
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

#' Generar ZIP operativo integrado de hojas de ruta
#'
#' @param config Configuracion integrada.
#' @param result_path Ruta .zip final.
#' @param progress_path Ruta opcional a archivo .progress (escrito por callr).
#' @return Resumen de generacion.
#' @export
hojas_ruta_generar_zip_integrado <- function(config = list(), result_path, progress_path = NULL) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop("El paquete `zip` es necesario para empaquetar las hojas.", call. = FALSE)
  }
  report <- if (exists("job_progress_writer", mode = "function")) {
    job_progress_writer(progress_path)
  } else {
    function(...) invisible(NULL)
  }
  report("preview", percent = 2, message = "Preparando seleccion de manzanas...")
  sample <- hojas_ruta_sample_preview_integrado(config)
  if (!isTRUE(sample$ok)) {
    stop("La seleccion de manzanas no esta lista para generar hojas de ruta.", call. = FALSE)
  }
  stage <- tempfile("hojas_ruta_inei_stage_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  blocks <- .hojas_ruta_rows_df(sample$blocks)
  quota_table <- .hojas_ruta_rows_df(sample$quota$table)
  pdf_files <- character(0)
  zone_pdf_files <- character(0)
  used_names <- character(0)
  range_start <- 1L
  total_pdfs <- nrow(blocks)
  # Reservamos 90% del progreso para los PDFs (la parte costosa).
  pdf_budget <- 88
  pdf_offset <- 5
  for (i in seq_len(total_pdfs)) {
    block <- as.list(blocks[i, , drop = FALSE])
    block[] <- lapply(block, function(x) x[[1]])
    block$hoja_num <- i
    block$rango_inicio <- range_start
    block$rango_fin <- range_start + as.integer(block$entrevistas %||% 1L) - 1L
    range_start <- block$rango_fin + 1L
    qdom <- quota_table[quota_table$territorio %in% c(block$territorio_muestral, "TOTAL"), , drop = FALSE]
    base_name <- sprintf(
      "HojaRuta_INEI2017_%s_%s.pdf",
      hojas_ruta_sanitize_filename(block$distrito),
      hojas_ruta_sanitize_filename(block$id_manzana)
    )
    if (base_name %in% used_names) base_name <- sub("\\.pdf$", sprintf("_%03d.pdf", i), base_name)
    used_names <- c(used_names, base_name)
    out_pdf <- file.path(stage, base_name)
    pct_before <- pdf_offset + round(pdf_budget * (i - 1L) / max(1L, total_pdfs))
    report("pdf", current = i - 1L, total = total_pdfs, percent = pct_before,
           message = sprintf("Generando hoja %d de %d (%s)", i, total_pdfs,
                              .hojas_ruta_title_case(block$distrito %||% "")))
    .hojas_ruta_draw_integrated_pdf(block, qdom, sample$frame_meta, sample$config, out_pdf)
    pdf_files <- c(pdf_files, out_pdf)
  }
  zone_summary <- .hojas_ruta_zone_summary(sample)
  if (nrow(zone_summary)) {
    report("zone-pdf", percent = 92, message = "Generando hojas operativas por zona...")
    for (i in seq_len(nrow(zone_summary))) {
      zone_row <- as.list(zone_summary[i, , drop = FALSE])
      zone_row[] <- lapply(zone_row, function(x) x[[1]])
      zone_blocks <- blocks[
        blocks$ubigeo == zone_row$ubigeo & blocks$zona == zone_row$zona,
        ,
        drop = FALSE
      ]
      if (!nrow(zone_blocks)) next
      base_name <- sprintf(
        "HojaZona_INEI2017_%s_Zona_%s.pdf",
        hojas_ruta_sanitize_filename(zone_row$distrito),
        hojas_ruta_sanitize_filename(zone_row$zona)
      )
      if (base_name %in% used_names) base_name <- sub("\\.pdf$", sprintf("_%03d.pdf", i), base_name)
      used_names <- c(used_names, base_name)
      out_pdf <- file.path(stage, base_name)
      ok_zone <- tryCatch(
        .hojas_ruta_draw_zone_sheet_pdf(zone_row, zone_blocks, sample$config, out_pdf),
        error = function(e) FALSE
      )
      if (isTRUE(ok_zone) && file.exists(out_pdf)) zone_pdf_files <- c(zone_pdf_files, out_pdf)
    }
  }
  report("workbook", percent = pdf_offset + pdf_budget, message = "Generando resumen y reporte tecnico...")
  resumen_path <- file.path(stage, "resumen_operativo.xlsx")
  informe_path <- file.path(stage, "informe_tecnico.xlsx")
  .hojas_ruta_write_integrated_workbook(sample, resumen_path, technical = FALSE)
  .hojas_ruta_write_integrated_workbook(sample, informe_path, technical = TRUE)

  report("zip", percent = 96, message = "Empaquetando ZIP final...")
  old <- setwd(stage)
  on.exit(setwd(old), add = TRUE)
  files <- c(basename(zone_pdf_files), basename(pdf_files), basename(resumen_path), basename(informe_path))
  zip::zip(result_path, files = files)
  setwd(old)

  report("done", percent = 100,
         message = sprintf("%d hojas de manzana y %d hojas de zona listas.",
                           length(pdf_files), length(zone_pdf_files)))
  list(
    ok = TRUE,
    path = result_path,
    n_pdfs = as.integer(length(pdf_files) + length(zone_pdf_files)),
    n_zone_pdfs = as.integer(length(zone_pdf_files)),
    n_blocks = as.integer(nrow(blocks)),
    n_zones = as.integer(nrow(zone_summary)),
    total_entrevistas = as.integer(sum(blocks$entrevistas, na.rm = TRUE)),
    alerts = sample$alerts,
    frame_version = sample$frame_meta$version
  )
}
