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
