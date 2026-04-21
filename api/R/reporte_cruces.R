# =============================================================================
# CRUCES (CATEGORICOS + NUMERICOS)  -  MISMO REPORTE, NUEVA INTEGRACION
# - Mantiene tus encabezados (3 niveles) tal cual para categoricos
# - Agrega soporte de cruces NUMERICOS via argumento `numericas`
#   (tabla tipo SPSS: N, media, sd, min, p25, mediana, p75, max) por estrato + total
# =============================================================================

# =============================================================================
# Estilos para cruces
# =============================================================================

mk_styles_cruces <- function() {
  list(
    sec_title = openxlsx::createStyle(
      fontSize       = 18,
      textDecoration = "bold",
      halign         = "center",
      valign         = "center",
      wrapText       = TRUE,
      fontColour     = "#000000",
      fgFill         = "#FFFFFF",
      fontName       = "Arial"
    ),
    q_title = openxlsx::createStyle(
      fontSize       = 11,
      textDecoration = "italic",
      halign         = "left",
      valign         = "center",
      wrapText       = TRUE,
      fontColour     = "#000000",
      fgFill         = "#FFFFFF",
      fontName       = "Arial"
    ),
    header = openxlsx::createStyle(
      fontSize       = 10,
      textDecoration = "bold",
      border         = c("top", "bottom"),
      borderStyle    = "thin",
      borderColour   = "#000000",
      halign         = "center",
      valign         = "center",
      wrapText       = TRUE,
      fgFill         = "#FFFFFF",
      fontName       = "Arial"
    ),
    header_A = openxlsx::createStyle(
      fontSize       = 10,
      textDecoration = "bold",
      halign         = "left",
      valign         = "center",
      wrapText       = TRUE,
      fgFill         = "#FFFFFF",
      fontName       = "Arial"
    ),
    body_txt = openxlsx::createStyle(
      fontSize = 10,
      halign   = "left",
      valign   = "center",
      wrapText = TRUE,
      fgFill   = "#FFFFFF",
      fontName = "Arial"
    ),
    body_int = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "#,##0",
      halign   = "right",
      valign   = "center",
      fontName = "Arial",
      fgFill   = "#FFFFFF"
    ),

    body_num = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "#,##0.0",
      halign   = "right",
      valign   = "center",
      fontName = "Arial",
      fgFill   = "#FFFFFF"
    ),
    body_pct = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "0.0%",
      halign   = "right",
      valign   = "center",
      fontName = "Arial",
      fgFill   = "#FFFFFF"
    ),
    note = openxlsx::createStyle(
      fontSize       = 9,
      fontColour     = "#666666",
      halign         = "left",
      valign         = "center",
      wrapText       = TRUE,
      textDecoration = "italic",
      fgFill         = "#FFFFFF",
      fontName       = "Arial"
    ),
    total_bold = openxlsx::createStyle(
      textDecoration = "bold",
      fontName       = "Arial"
    ),
    table_end = openxlsx::createStyle(
      border       = "bottom",
      borderStyle  = "thin",
      borderColour = "#000000"
    ),
    footer_top = openxlsx::createStyle(
      border       = "top",
      borderStyle  = "thin",
      borderColour = "#000000"
    ),
    cell = openxlsx::createStyle(
      fontSize = 10,
      halign   = "center",
      valign   = "center",
      fgFill   = "#FFFFFF",
      fontName = "Arial"
    )
  )
}

# =============================================================================
# Helper: altura de fila dinamica segun longitud de texto
# =============================================================================

.calc_row_height <- function(text, col_width = 60, font_size = 10,
                              min_h = 15, max_h = 120) {
  if (is.null(text) || is.na(text) || !nzchar(as.character(text)))
    return(as.integer(min_h))
  n <- nchar(as.character(text))
  n_lines <- ceiling(n / max(col_width, 1))
  h <- n_lines * font_size * 1.5
  as.integer(pmin(pmax(h, min_h), max_h))
}

.merge_runs <- function(v) {
  if (!length(v)) return(list())
  res <- list()
  s <- 1L
  for (i in seq_along(v)) {
    if (i == length(v) || v[i] != v[i + 1]) {
      res[[length(res) + 1L]] <- c(s, i)
      s <- i + 1L
    }
  }
  res
}

.header_row_height <- function(values,
                               runs = NULL,
                               col_offset = 0L,
                               first_col_width = 60,
                               other_col_width = 16,
                               font_size = 10,
                               min_h = 15,
                               max_h = 120) {
  if (!length(values)) return(as.integer(min_h))

  if (is.null(runs)) {
    runs <- lapply(seq_along(values), function(i) c(i, i))
  }
  if (!length(runs)) return(as.integer(min_h))

  heights <- vapply(runs, function(r) {
    rel_cols <- seq.int(r[1], r[2])
    abs_cols <- col_offset + rel_cols
    col_width <- sum(ifelse(abs_cols == 1L, first_col_width, other_col_width))
    .calc_row_height(
      text      = values[r[1]],
      col_width = col_width,
      font_size = font_size,
      min_h     = min_h,
      max_h     = max_h
    )
  }, integer(1))

  as.integer(max(heights, na.rm = TRUE))
}

# =============================================================================
# Helpers basicos
# =============================================================================

get_pesos <- function(data, weight_col = "peso") {
  if (!is.null(weight_col) && weight_col %in% names(data)) {
    w <- suppressWarnings(as.numeric(data[[weight_col]]))
    w[is.na(w) | !is.finite(w)] <- 0
    return(w)
  }
  rep(1, nrow(data))
}

# Detectar si existe la variable o alguna dummy asociada (var/cod, var.cod)
.has_var_or_dummies <- function(data, var) {
  if (!is.data.frame(data)) return(FALSE)
  if (var %in% names(data)) return(TRUE)
  var_esc <- gsub("([\\W])", "\\\\\\1", var)
  any(grepl(paste0("^", var_esc, "[/\\.]"), names(data)))
}

tipo_pregunta <- function(var, survey = NULL, sm_vars_force = NULL, data = NULL) {
  if (!is.null(sm_vars_force) && var %in% sm_vars_force) return("sm")

  if (!is.null(survey) && any(survey$name == var)) {
    tipos <- unique(na.omit(survey$type[survey$name == var]))
    if (any(grepl("^select_multiple(\\s|$)", tipos))) return("sm")
    if (any(grepl("^select_one(\\s|$)", tipos)))      return("so")
  }

  # Si no esta marcado en survey pero hay dummies asociadas, tratar como SM
  if (!is.null(data) && .has_var_or_dummies(data, var)) {
    return("sm")
  }

  "so"
}

col_sm_compact <- function(data, var) {
  v_orig <- paste0(var, "_ORIG")
  if (v_orig %in% names(data)) return(v_orig)
  if (var %in% names(data))    return(var)
  NA_character_
}

sm_compact_to_long <- function(x, id, w) {
  tibble::tibble(
    id    = id,
    valor = as.character(x),
    w     = as.numeric(w)
  ) |>
    tidyr::separate_rows(valor, sep = "\\s*;\\s*", convert = FALSE) |>
    dplyr::mutate(valor = trimws(valor)) |>
    dplyr::filter(!is.na(valor) & nzchar(valor) & valor != "NA")
}

label_variable <- function(var, dic_vars = NULL, labels_override = NULL, data = NULL) {
  if (!is.null(labels_override) && var %in% names(labels_override)) {
    return(as.character(labels_override[[var]]))
  }
  if (!is.null(data) && var %in% names(data)) {
    vlab <- attr(data[[var]], "label", exact = TRUE)
    if (!is.null(vlab) && nzchar(as.character(vlab))) {
      return(as.character(vlab))
    }
  }
  if (!is.null(dic_vars) && all(c("name", "label") %in% names(dic_vars))) {
    lab <- dic_vars$label[dic_vars$name == var]
    if (length(lab) && !all(is.na(lab))) return(as.character(lab[1]))
  }
  as.character(var)
}

.strip_label_0100 <- function(x) {
  out <- as.character(x)
  out <- gsub("\\s*\\[0-100\\]\\s*$", "", out)
  trimws(out)
}

.pick_cat_keys <- function(values, codes, labels) {
  if (!length(codes) && !length(labels)) return(character(0))
  if (!length(codes)) return(labels)
  if (!length(labels)) return(codes)
  vv <- as.character(values)
  usa_codes  <- any(vv %in% codes)
  usa_labels <- any(vv %in% labels)
  if (isTRUE(usa_codes) || !isTRUE(usa_labels)) codes else labels
}

.dim_weighted_stats <- function(x, w, mask) {
  x <- suppressWarnings(as.numeric(x))
  w <- suppressWarnings(as.numeric(w))
  idx <- if (length(mask) == length(x)) as.logical(mask) else rep(TRUE, length(x))
  idx <- idx &
    is.finite(x) & !is.na(x) &
    is.finite(w) & !is.na(w) &
    w > 0
  n_valid <- sum(idx, na.rm = TRUE)
  if (!n_valid) {
    return(list(mean = NA_real_, sd = NA_real_, n = 0))
  }
  x_ok <- x[idx]
  w_ok <- w[idx]
  w_sum <- sum(w_ok, na.rm = TRUE)
  if (!is.finite(w_sum) || w_sum <= 0) {
    return(list(mean = NA_real_, sd = NA_real_, n = n_valid))
  }
  mu <- sum(w_ok * x_ok, na.rm = TRUE) / w_sum
  var_w <- sum(w_ok * (x_ok - mu)^2, na.rm = TRUE) / w_sum
  sd_w <- sqrt(var_w)
  list(mean = as.numeric(mu), sd = as.numeric(sd_w), n = as.numeric(n_valid))
}

.dim_pretty_label <- function(var, data = NULL) {
  if (is.null(var) || !length(var)) return("")
  v <- as.character(var)[1]
  lbl <- ""
  if (!is.null(data) && v %in% names(data)) {
    lb <- attr(data[[v]], "label", exact = TRUE)
    if (!is.null(lb) && nzchar(trimws(as.character(lb)))) {
      lbl <- as.character(lb)[1]
    }
  }
  if (!nzchar(trimws(lbl))) {
    lbl <- v
  }
  lbl <- .strip_label_0100(lbl)
  if (!nzchar(lbl) || identical(lbl, v)) {
    base <- gsub("^(r100_|sub_|idx_)", "", v)
    base <- gsub("_", " ", base, fixed = TRUE)
    lbl <- tools::toTitleCase(base)
  }
  trimws(lbl)
}

.dim_label_limpio <- function(x) {
  out <- as.character(x)
  out[is.na(out)] <- ""
  out <- .strip_label_0100(out)
  out <- gsub("\\*+", "", out)
  out <- gsub("^\\s*[0-9]+(?:\\.[0-9]+)?\\.\\s*", "", out, perl = TRUE)
  out <- gsub("[\r\n]+", " ", out)
  out <- gsub("\\s+", " ", out)
  trimws(out)
}

.dim_pregunta_editorial <- function(var, label = NULL, data = NULL) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  v <- as.character(var)[1]
  lbl <- .dim_label_limpio(label %||% .dim_pretty_label(v, data))
  m <- regexec("^p([0-9]+(?:\\.[0-9]+)?)$", v)
  mt <- regmatches(v, m)[[1]]
  if (length(mt) >= 2L) {
    return(paste0("Pregunta ", mt[2], ": ", lbl))
  }
  lbl
}

.strip_prefijo_subindice <- function(estr_labels, s_lbl) {
  if (!length(estr_labels)) return(estr_labels)
  pref <- paste0(trimws(as.character(s_lbl)), ":")
  labs <- trimws(as.character(estr_labels))

  # solo limpiar si TODOS vienen con el mismo prefijo
  if (all(startsWith(labs, pref))) {
    labs <- sub(paste0("^", stringr::fixed(pref), "\\s*"), "", labs)
  }
  labs
}

# =============================================================================
# Mapeo codigos/labels usando instrumento (survey + orders_list)
# =============================================================================

get_list_name <- function(var, survey = NULL) {
  if (is.null(survey) ||
      !all(c("name", "list_name") %in% names(survey))) {
    return(NA_character_)
  }
  ln <- unique(na.omit(as.character(survey$list_name[survey$name == var])))
  if (!length(ln)) return(NA_character_)
  ln[1]
}

get_categorias <- function(var,
                           data,
                           survey          = NULL,
                           orders_list     = NULL,
                           opciones_excluir = NULL) {
  x <- if (var %in% names(data)) data[[var]] else NULL
  lab_attr <- if (!is.null(x)) attr(x, "labels", exact = TRUE) else NULL

  ln <- get_list_name(var, survey)
  codes  <- character(0)
  labels <- character(0)

  # 1) orders_list: primero por variable, luego por list_name
  obj <- NULL
  if (!is.null(orders_list)) {
    if (var %in% names(orders_list)) {
      obj <- orders_list[[var]]
    } else if (!is.na(ln) && ln %in% names(orders_list)) {
      obj <- orders_list[[ln]]
    }
  }

  if (!is.null(obj)) {
    codes  <- as.character(obj$names)
    labels <- as.character(obj$labels)

  } else if (!is.null(lab_attr) && length(lab_attr) > 0) {
    # 2) attr(labels) de la data (reporte_data)
    codes  <- names(lab_attr)
    labels <- as.character(unname(lab_attr))

  } else if (!is.null(x)) {
    # 3) fallback: categorias en los datos (solo si existe la columna)
    codes  <- sort(unique(na.omit(as.character(x))))
    labels <- codes
  }

  ok <- !is.na(codes) & nzchar(codes)
  codes  <- codes[ok]
  labels <- labels[ok]

  if (!is.null(opciones_excluir) && length(opciones_excluir) > 0) {
    ok <- !(labels %in% opciones_excluir)
    codes  <- codes[ok]
    labels <- labels[ok]
  }

  list(codes = codes, labels = labels, list_name = ln)
}

# =============================================================================
# Conteo y denominador para SO y SM
# =============================================================================

contar_por_opcion <- function(data,
                              var,
                              codes,
                              tp,
                              mask,
                              weight_col = "peso") {
  w <- get_pesos(data, weight_col)

  if (tp == "so") {
    v_codes <- as.character(data[[var]])
    elig    <- mask & !is.na(v_codes) & nzchar(v_codes) & v_codes != "NA"
    vapply(seq_along(codes), function(j) {
      sum(w[elig & v_codes == codes[j]], na.rm = TRUE)
    }, numeric(1))
  } else if (tp == "sm") {

    colc <- col_sm_compact(data, var)
    if (!is.na(colc)) {
      long <- sm_compact_to_long(data[[colc]], id = seq_len(nrow(data)), w = w)
      if (!nrow(long)) return(rep(0, length(codes)))
      ids_mask <- which(mask)
      long <- long[long$id %in% ids_mask & long$valor %in% codes, , drop = FALSE]
      vapply(seq_along(codes), function(j) {
        code_j <- codes[j]
        ids_j  <- unique(long$id[long$valor == code_j])
        sum(w[ids_j], na.rm = TRUE)
      }, numeric(1))
    } else {
      # Dummies: var/cod o var.cod (sufijo numerico o texto)
      subs <- grep(paste0("^", stringr::fixed(var), "[/\\.]"),
                   names(data), value = TRUE)
      if (!length(subs)) return(rep(0, length(codes)))
      codes_dummy <- sub(paste0("^", var, "[/\\.]"), "", subs)

      vapply(seq_along(codes), function(j) {
        code_j   <- codes[j]
        cols_j   <- subs[codes_dummy == code_j]
        if (!length(cols_j)) return(0)
        mat <- sapply(cols_j, function(col) {
          v <- suppressWarnings(as.numeric(as.character(data[[col]])))
          v == 1
        })
        if (!is.matrix(mat)) mat <- matrix(mat, ncol = 1)
        elig_ids <- which(mask & rowSums(mat, na.rm = TRUE) > 0)
        sum(w[elig_ids], na.rm = TRUE)
      }, numeric(1))
    }
  } else {
    rep(0, length(codes))
  }
}

denominador_validos <- function(data,
                                var,
                                codes,
                                tp,
                                mask,
                                weight_col = "peso") {
  w <- get_pesos(data, weight_col)

  if (tp == "so") {
    v_codes <- as.character(data[[var]])
    elig <- mask &
      !is.na(v_codes) &
      nzchar(v_codes) &
      v_codes != "NA" &
      v_codes %in% codes
    return(sum(w[elig], na.rm = TRUE))
  }

  if (tp == "sm") {
    colc <- col_sm_compact(data, var)
    if (!is.na(colc)) {
      long <- sm_compact_to_long(data[[colc]], id = seq_len(nrow(data)), w = w)
      if (!nrow(long)) return(0)
      ids_mask <- which(mask)
      long <- long[long$id %in% ids_mask & long$valor %in% codes, , drop = FALSE]
      denom_ids <- unique(long$id)
      return(sum(w[denom_ids], na.rm = TRUE))
    } else {
      # Dummies: var/cod o var.cod
      subs <- grep(paste0("^", stringr::fixed(var), "[/\\.]"),
                   names(data), value = TRUE)
      if (!length(subs)) return(0)
      codes_dummy <- sub(paste0("^", var, "[/\\.]"), "", subs)
      subs_keep   <- subs[codes_dummy %in% codes]
      if (!length(subs_keep)) return(0)
      mat <- sapply(subs_keep, function(col) {
        v <- suppressWarnings(as.numeric(as.character(data[[col]])))
        v == 1
      })
      if (!is.matrix(mat)) mat <- matrix(mat, ncol = 1)
      elig_ids <- which(mask & rowSums(mat, na.rm = TRUE) > 0)
      return(sum(w[elig_ids], na.rm = TRUE))
    }
  }

  0
}

# =============================================================================
# NUEVO: Cruces numericos (resumenes ponderados por estrato)
# =============================================================================

.resumen_numerico_w_mask <- function(x, w, mask,
                                     probs = c(.25, .5, .75),
                                     digits = 1) {
  x <- suppressWarnings(as.numeric(x))
  w <- suppressWarnings(as.numeric(w))
  mask <- as.logical(mask)

  idx <- mask & is.finite(x) & !is.na(x) & is.finite(w) & !is.na(w) & w > 0
  if (!any(idx)) {
    return(c(
      N = 0,
      Media = NA_real_, SD = NA_real_,
      Min = NA_real_, P25 = NA_real_, Mediana = NA_real_, P75 = NA_real_, Max = NA_real_
    ))
  }

  x <- x[idx]; w <- w[idx]
  n_val <- length(x)

  mu <- stats::weighted.mean(x, w, na.rm = TRUE)

  wsum <- sum(w)
  var_w <- if (wsum > 0) sum(w * (x - mu)^2) / wsum else NA_real_
  sd_w  <- sqrt(var_w)

  ord <- order(x)
  x2 <- x[ord]; w2 <- w[ord]
  cw <- cumsum(w2) / sum(w2)

  wq <- function(p) {
    j <- which(cw >= p)[1]
    if (is.na(j)) NA_real_ else x2[j]
  }

  c(
    N       = n_val,
    Media   = round(mu, digits),
    SD      = round(sd_w, digits),
    Min     = round(min(x2), digits),
    P25     = round(wq(probs[1]), digits),
    Mediana = round(wq(probs[2]), digits),
    P75     = round(wq(probs[3]), digits),
    Max     = round(max(x2), digits)
  )
}

write_one_numeric_cross <- function(wb, sheet, data, var, dic_vars,
                                    CRUZAR_CON,
                                    labels_override = NULL,
                                    start_row = 1, start_col = 1,
                                    fuente = "Pulso PUCP",
                                    survey = NULL,
                                    orders_list = NULL,
                                    weight_col = "peso",
                                    opciones_excluir = NULL,
                                    digits = 1) {

  st   <- mk_styles_cruces()
  fila <- start_row

  qlab <- label_variable(var, dic_vars, labels_override, data)

  # ---------------------------
  # Titulo (merge luego cuando se conozca ncols)
  # ---------------------------
  openxlsx::writeData(wb, sheet, qlab, startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$q_title, rows = fila, cols = start_col, gridExpand = TRUE)
  openxlsx::setRowHeights(wb, sheet, rows = fila,
                          heights = .calc_row_height(qlab, col_width = 60, font_size = 11))
  fila <- fila + 1

  w <- get_pesos(data, weight_col)

  estad <- c(
    "Casos validos",
    "Promedio",
    "Desviacion estandar",
    "Minimo",
    "Percentil 25",
    "Mediana (Percentil 50)",
    "Percentil 75",
    "Maximo"
  )

  # =========================================================
  # 1) Construir columnas (internas) + headers (2 niveles)
  # =========================================================
  blocks   <- list()
  h1 <- c("")   # fila header 1 (estrato)
  h2 <- c("")   # fila header 2 (categorias)

  # Columna Total
  blocks[["Total"]] <- .resumen_numerico_w_mask(
    x = data[[var]], w = w, mask = rep(TRUE, nrow(data)),
    digits = digits
  )
  h1 <- c(h1, "")
  h2 <- c(h2, "Total")

  # Cruces
  for (s in CRUZAR_CON) {
    if (!(s %in% names(data)) || identical(s, var)) next

    cats_s <- get_categorias(
      var              = s,
      data             = data,
      survey           = survey,
      orders_list      = orders_list,
      opciones_excluir = opciones_excluir
    )
    estr_codes  <- cats_s$codes
    estr_labels <- cats_s$labels
    if (!length(estr_codes)) next

    s_lbl <- label_variable(s, dic_vars, labels_override, data)

    # Parche: si labels vienen como "Region: Callao", dejar "Callao"
    estr_labels <- .strip_prefijo_subindice(estr_labels, s_lbl)

    v_estr <- as.character(data[[s]])
    usa_codes  <- any(v_estr %in% estr_codes)
    usa_labels <- any(v_estr %in% estr_labels)
    keys_vec   <- if (usa_codes || !usa_labels) estr_codes else estr_labels

    # Por cada categoria del estrato, una columna numerica
    for (j in seq_along(keys_vec)) {
      key_j  <- keys_vec[j]
      mask_j <- !is.na(v_estr) & v_estr == key_j

      col_id <- paste0(s, "__", j)  # nombre interno (unico)
      blocks[[col_id]] <- .resumen_numerico_w_mask(
        x = data[[var]], w = w, mask = mask_j, digits = digits
      )

      h1 <- c(h1, s_lbl)
      h2 <- c(h2, as.character(estr_labels[j]))
    }
  }

  # =========================================================
  # 2) Armar tabla final (Estadístico + columnas)
  # =========================================================
  make_col <- function(vec) {
    c(vec["N"], vec["Media"], vec["SD"], vec["Min"], vec["P25"], vec["Mediana"], vec["P75"], vec["Max"])
  }

  out <- tibble::tibble(Estadístico = estad)

  # Orden columnas: Total primero, luego bloques en el orden construido
  col_keys <- c("Total", setdiff(names(blocks), "Total"))
  for (k in col_keys) {
    out[[k]] <- as.numeric(make_col(blocks[[k]]))
  }

  ncols_tbl <- ncol(out)

  # ---------------------------
  # Merge del titulo y linea superior
  # ---------------------------
  openxlsx::mergeCells(wb, sheet,
                       rows = start_row,
                       cols = start_col:(start_col + ncols_tbl - 1))
  openxlsx::addStyle(wb, sheet, st$table_end,
                     rows = start_row,
                     cols = start_col:(start_col + ncols_tbl - 1),
                     gridExpand = TRUE, stack = TRUE)

  # =========================================================
  # 3) Escribir headers (2 niveles) con merges por estrato
  # =========================================================
  openxlsx::writeData(wb, sheet, t(h1), startRow = fila,     startCol = start_col, colNames = FALSE)
  openxlsx::writeData(wb, sheet, t(h2), startRow = fila + 1, startCol = start_col, colNames = FALSE)

  # Estilos de encabezado
  openxlsx::addStyle(wb, sheet, st$header_A,
                     rows = fila:(fila + 1), cols = start_col, gridExpand = TRUE)
  if (ncols_tbl >= 2) {
    openxlsx::addStyle(wb, sheet, st$header,
                       rows = fila:(fila + 1),
                       cols = (start_col + 1):(start_col + ncols_tbl - 1),
                       gridExpand = TRUE, stack = TRUE)
  }

  # Merge runs en header1 (estratos)
  runs1 <- .merge_runs(h1)
  for (r in runs1) {
    if ((r[2] - r[1] + 1) > 1) {
      openxlsx::mergeCells(wb, sheet,
                           rows = fila,
                           cols = (start_col + r[1] - 1):(start_col + r[2] - 1))
    }
  }

  openxlsx::setRowHeights(
    wb, sheet, rows = fila,
    heights = .header_row_height(
      values = h1,
      runs = runs1,
      col_offset = as.integer(start_col - 1L),
      font_size = 10,
      min_h = 18,
      max_h = 100
    )
  )
  openxlsx::setRowHeights(
    wb, sheet, rows = fila + 1,
    heights = .header_row_height(
      values = h2,
      runs = NULL,
      col_offset = as.integer(start_col - 1L),
      font_size = 10,
      min_h = 18,
      max_h = 100
    )
  )

  fila <- fila + 2

  # =========================================================
  # 4) Escribir cuerpo + estilos (N entero, resto numerico)
  # =========================================================
  openxlsx::writeData(wb, sheet, out, startRow = fila, startCol = start_col, colNames = FALSE)

  r_ini <- fila
  r_fin <- fila + nrow(out) - 1

  # Primera columna (texto)
  openxlsx::addStyle(wb, sheet, st$body_txt,
                     rows = r_ini:r_fin, cols = start_col, gridExpand = TRUE)

  # Columnas numericas
  if (ncols_tbl >= 2) {
    num_cols <- (start_col + 1):(start_col + ncols_tbl - 1)

    # Fila N valido (primera fila del cuerpo)
    openxlsx::addStyle(wb, sheet, st$body_int,
                       rows = r_ini, cols = num_cols, gridExpand = TRUE)

    # Resto de filas (media, sd, cuantiles...)
    if (nrow(out) > 1) {
      openxlsx::addStyle(wb, sheet, st$body_num,
                         rows = (r_ini + 1):r_fin, cols = num_cols, gridExpand = TRUE)
    }
  }

  # Linea final de tabla
  openxlsx::addStyle(wb, sheet, st$table_end,
                     rows = r_fin, cols = start_col:(start_col + ncols_tbl - 1),
                     gridExpand = TRUE, stack = TRUE)

  fila <- r_fin + 1

  # Pie
  pie_txt <- sprintf("Fuente: %s", fuente)
  openxlsx::writeData(wb, sheet, pie_txt, startRow = fila, startCol = start_col)
  openxlsx::addStyle(wb, sheet, st$note, rows = fila, cols = start_col, gridExpand = TRUE)
  openxlsx::mergeCells(wb, sheet, rows = fila, cols = start_col:(start_col + ncols_tbl - 1))
  openxlsx::addStyle(wb, sheet, st$footer_top,
                     rows = fila, cols = start_col:(start_col + ncols_tbl - 1),
                     gridExpand = TRUE, stack = TRUE)

  fila + 2
}

# =============================================================================
# Significancia (z + Bonferroni)
# =============================================================================

comparar_columnas_sig <- function(n_mat, N_vec, alpha = 0.05) {
  K <- ncol(n_mat)
  R <- nrow(n_mat)

  letras <- matrix("", nrow = R, ncol = K, dimnames = dimnames(n_mat))
  sig    <- matrix(FALSE, nrow = R, ncol = K, dimnames = dimnames(n_mat))

  for (i in seq_len(R)) {
    n <- n_mat[i, ]
    N <- N_vec
    p <- ifelse(N > 0, n / N, NA_real_)
    lock <- is.na(p) | N == 0 | p <= 0 | p >= 1
    idx <- which(!lock)
    if (length(idx) >= 2) {
      pairs <- utils::combn(idx, 2, simplify = TRUE)
      pvals <- apply(pairs, 2, function(ab) {
        a <- ab[1]; b <- ab[2]
        pa <- p[a]; pb <- p[b]
        na <- N[a]; nb <- N[b]
        if (any(is.na(c(pa, pb, na, nb))) || any(c(na, nb) == 0)) return(NA_real_)
        ppool <- (n[a] + n[b]) / (na + nb)
        se <- sqrt(ppool * (1 - ppool) * (1/na + 1/nb))
        if (!is.finite(se) || se <= 0) return(NA_real_)
        z <- (pa - pb) / se
        2 * stats::pnorm(-abs(z))
      })
      padj <- stats::p.adjust(pvals, method = "bonferroni")
      for (k in seq_along(padj)) {
        if (is.na(padj[k]) || padj[k] >= alpha) next
        a <- pairs[1, k]; b <- pairs[2, k]
        if (p[a] > p[b]) {
          letras[i, a] <- paste(letras[i, a], LETTERS[b])
          sig[i, a]    <- TRUE
        } else if (p[b] > p[a]) {
          letras[i, b] <- paste(letras[i, b], LETTERS[a])
          sig[i, b]    <- TRUE
        }
      }
    }
    letras[i, lock] <- ifelse(nzchar(letras[i, lock]), letras[i, lock], ".a")
  }

  list(letras = letras, sig = sig)
}

comparar_medias_sig <- function(medias_mat, ns_mat, sds_mat, alpha = 0.05) {
  K <- ncol(medias_mat)
  R <- nrow(medias_mat)

  letras <- matrix("", R, K, dimnames = dimnames(medias_mat))
  sig    <- matrix(FALSE, R, K, dimnames = dimnames(medias_mat))

  for (i in seq_len(R)) {
    idx <- which(!is.na(medias_mat[i, ]) & ns_mat[i, ] >= 2)
    if (length(idx) < 2) next

    pairs <- utils::combn(idx, 2, simplify = TRUE)
    pvals <- apply(pairs, 2, function(ab) {
      a <- ab[1]
      b <- ab[2]
      m1 <- medias_mat[i, a]
      m2 <- medias_mat[i, b]
      s1 <- sds_mat[i, a]
      s2 <- sds_mat[i, b]
      n1 <- ns_mat[i, a]
      n2 <- ns_mat[i, b]

      if (any(is.na(c(m1, m2, s1, s2, n1, n2))) || (s1 == 0 && s2 == 0)) {
        return(NA_real_)
      }

      v1 <- s1^2 / n1
      v2 <- s2^2 / n2
      se <- sqrt(v1 + v2)
      if (!is.finite(se) || se <= 0) return(NA_real_)

      den_df <- (v1^2 / (n1 - 1)) + (v2^2 / (n2 - 1))
      if (!is.finite(den_df) || den_df <= 0) return(NA_real_)

      t_stat <- (m1 - m2) / se
      df <- (v1 + v2)^2 / den_df
      if (!is.finite(df) || df <= 0) return(NA_real_)

      2 * stats::pt(-abs(t_stat), df = df)
    })

    padj <- stats::p.adjust(pvals, method = "bonferroni")
    for (k in seq_along(padj)) {
      if (is.na(padj[k]) || padj[k] >= alpha) next
      a <- pairs[1, k]
      b <- pairs[2, k]
      if (medias_mat[i, a] > medias_mat[i, b]) {
        letras[i, a] <- trimws(paste(letras[i, a], LETTERS[b]))
        sig[i, a] <- TRUE
      } else if (medias_mat[i, b] > medias_mat[i, a]) {
        letras[i, b] <- trimws(paste(letras[i, b], LETTERS[a]))
        sig[i, b] <- TRUE
      }
    }
    lock <- is.na(medias_mat[i, ]) | ns_mat[i, ] < 2
    letras[i, lock] <- ifelse(nzchar(letras[i, lock]), letras[i, lock], ".a")
  }

  list(letras = letras, sig = sig)
}

nN_para_sig_simple <- function(data,
                               var,
                               opciones_labels,
                               codes_row,
                               estratos,
                               var_estrato,
                               tp,
                               weight_col = "peso") {

  w <- get_pesos(data, weight_col)
  v_estrato <- as.character(data[[var_estrato]])

  n_mat <- matrix(
    0,
    nrow = length(opciones_labels),
    ncol = length(estratos),
    dimnames = list(opciones_labels, estratos)
  )
  N_vec <- numeric(length(estratos))
  names(N_vec) <- estratos

  for (j in seq_along(estratos)) {
    catj <- estratos[j]
    mask_j <- !is.na(v_estrato) & v_estrato == catj

    N_vec[j] <- denominador_validos(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_j,
      weight_col = weight_col
    )

    if (N_vec[j] == 0) next

    n_vec <- contar_por_opcion(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_j,
      weight_col = weight_col
    )

    n_mat[, j] <- n_vec
  }

  list(n_mat = n_mat, N_vec = N_vec)
}

# =============================================================================
# Exportador principal: exportar_cruces_multi (con `numericas`)
# =============================================================================

#' Exportar tablas de cruces multiples a Excel
#'
#' @param numericas Vector opcional de variables a tratar como numericas
#'   (tabla de resumenes por estrato + total).
#' @param digits Numero de decimales para resumenes numericos.
#' ... (resto igual)
#'
exportar_cruces_multi <- function(data,
                                  dic_vars,
                                  SECCIONES,
                                  CRUZAR_CON,
                                  labels_override  = NULL,
                                  path_xlsx        = "cruces_multi.xlsx",
                                  hoja             = "Cruces",
                                  fuente           = "Pulso PUCP",
                                  survey           = NULL,
                                  sm_vars_force    = NULL,
                                  weight_col       = "peso",
                                  orders_list      = NULL,
                                  opciones_excluir = NULL,
                                  show_sig         = TRUE,
                                  alpha            = 0.05,
                                  codigos_solo_si_presentes = NULL,
                                  numericas        = NULL,
                                  digits           = 1) {

  numericas <- if (is.null(numericas)) character(0) else as.character(numericas)

  # Mantener en SECCIONES variables que existan como columna o tengan dummies
  SECCIONES <- lapply(SECCIONES, function(v) {
    v[vapply(v, function(x) .has_var_or_dummies(data, x), logical(1))]
  })
  # Variables de cruce: por simplicidad, solo columnas reales
  CRUZAR_CON <- CRUZAR_CON[CRUZAR_CON %in% names(data)]
  stopifnot(length(CRUZAR_CON) > 0)

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, hoja)
  st <- mk_styles_cruces()

  fila <- 1L

  # titulo general
  openxlsx::writeData(wb, hoja, "CRUCES", startRow = fila, startCol = 1)
  openxlsx::addStyle(wb, hoja, st$sec_title, rows = fila, cols = 1, gridExpand = TRUE)
  openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:6)
  fila <- fila + 2

  # helper para merges de encabezado (categoricos)
  escribir_encabezado <- function(h1, h2, h3, row0, col0 = 1) {
    ncols <- length(h3)
    if (ncols == 0) return(invisible(NULL))

    openxlsx::writeData(wb, hoja, t(h1), startRow = row0,     startCol = col0, colNames = FALSE)
    openxlsx::writeData(wb, hoja, t(h2), startRow = row0 + 1, startCol = col0, colNames = FALSE)
    openxlsx::writeData(wb, hoja, t(h3), startRow = row0 + 2, startCol = col0, colNames = FALSE)

    if (ncols >= 1) {
      openxlsx::addStyle(wb, hoja, st$header_A,
                         rows = row0:(row0 + 2), cols = col0, gridExpand = TRUE)
    }
    if (ncols >= 2) {
      openxlsx::addStyle(wb, hoja, st$header,
                         rows = row0:(row0 + 2),
                         cols = (col0 + 1):(col0 + ncols - 1),
                         gridExpand = TRUE)
    }

    runs1 <- .merge_runs(h1)
    for (r in runs1) if ((r[2] - r[1] + 1) > 1) {
      openxlsx::mergeCells(wb, hoja,
                           rows = row0,
                           cols = (col0 + r[1] - 1):(col0 + r[2] - 1))
    }

    runs2 <- .merge_runs(h2)
    for (r in runs2) if ((r[2] - r[1] + 1) > 1) {
      openxlsx::mergeCells(wb, hoja,
                           rows = row0 + 1,
                           cols = (col0 + r[1] - 1):(col0 + r[2] - 1))
    }

    openxlsx::setRowHeights(
      wb, hoja, rows = row0,
      heights = .header_row_height(
        values = h1,
        runs = runs1,
        col_offset = as.integer(col0 - 1L),
        font_size = 10,
        min_h = 18,
        max_h = 100
      )
    )
    openxlsx::setRowHeights(
      wb, hoja, rows = row0 + 1,
      heights = .header_row_height(
        values = h2,
        runs = runs2,
        col_offset = as.integer(col0 - 1L),
        font_size = 10,
        min_h = 18,
        max_h = 100
      )
    )
    openxlsx::setRowHeights(
      wb, hoja, rows = row0 + 2,
      heights = .header_row_height(
        values = h3,
        runs = NULL,
        col_offset = as.integer(col0 - 1L),
        font_size = 10,
        min_h = 15,
        max_h = 80
      )
    )

    invisible(NULL)
  }

  # ================== LOOP POR SECCIONES ==================
  for (sec in names(SECCIONES)) {
    vars_sec <- SECCIONES[[sec]]
    if (!length(vars_sec)) next

    openxlsx::writeData(wb, hoja, toupper(sec), startRow = fila, startCol = 1)
    openxlsx::addStyle(wb, hoja, st$sec_title, rows = fila, cols = 1, gridExpand = TRUE)
    openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:3)
    fila <- fila + 2

    # ---------- loop por variable de la seccion ----------
    for (var in vars_sec) {

      # ==========================
      # NUEVO: si es numerica → tabla de resumenes por estrato
      # ==========================
      if (var %in% numericas) {
        fila <- write_one_numeric_cross(
          wb            = wb,
          sheet         = hoja,
          data          = data,
          var           = var,
          dic_vars      = dic_vars,
          CRUZAR_CON    = CRUZAR_CON,
          labels_override = labels_override,
          start_row     = fila,
          start_col     = 1,
          fuente        = fuente,
          survey        = survey,
          orders_list   = orders_list,
          weight_col    = weight_col,
          opciones_excluir = opciones_excluir,
          digits        = digits
        )
        fila <- fila + 1
        next
      }

      # ==========================
      # CATEGORICOS (tu flujo original)
      # ==========================
      tp <- tipo_pregunta(var, survey = survey, sm_vars_force = sm_vars_force, data = data)
      cats_var <- get_categorias(
        var              = var,
        data             = data,
        survey           = survey,
        orders_list      = orders_list,
        opciones_excluir = opciones_excluir
      )

      opciones  <- cats_var$labels
      codes_row <- cats_var$codes

      # ------------------------------------------------------------
      # Parche robusto: eliminar "Total" como categoria (labels o codes)
      # (case-insensitive + trim) + quitar vacios
      # ------------------------------------------------------------
      op_chr <- trimws(tolower(as.character(opciones)))
      cd_chr <- trimws(tolower(as.character(codes_row)))

      drop_total <- (op_chr == "total") | (cd_chr == "total") | is.na(op_chr) | (op_chr == "")

      if (any(drop_total)) {
        opciones  <- opciones[!drop_total]
        codes_row <- codes_row[!drop_total]
      }

      # (opcional recomendado) evitar duplicados de labels tras mapeos
      keep <- !duplicated(trimws(tolower(as.character(opciones))))
      opciones  <- opciones[keep]
      codes_row <- codes_row[keep]

      qlab <- label_variable(var, dic_vars, labels_override, data)

      # --- filtrar codigos condicionales sin casos ---
      if (!is.null(codigos_solo_si_presentes) && length(codes_row)) {
        cod_cond <- as.character(codigos_solo_si_presentes)

        mask_total0 <- rep(TRUE, nrow(data))
        n_total_all <- contar_por_opcion(
          data       = data,
          var        = var,
          codes      = codes_row,
          tp         = tp,
          mask       = mask_total0,
          weight_col = weight_col
        )

        to_drop <- codes_row %in% cod_cond & n_total_all == 0
        if (any(to_drop)) {
          codes_row <- codes_row[!to_drop]
          opciones  <- opciones[!to_drop]
        }
      }

      if (!length(opciones)) {
        openxlsx::writeData(wb, hoja, qlab, startRow = fila, startCol = 1)
        openxlsx::addStyle(wb, hoja, st$q_title, rows = fila, cols = 1, gridExpand = TRUE)
        openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:6)
        openxlsx::setRowHeights(wb, hoja, rows = fila,
                                heights = .calc_row_height(qlab, col_width = 60, font_size = 11))
        fila <- fila + 1
        openxlsx::writeData(wb, hoja, "Sin datos validos para cruzar.", startRow = fila, startCol = 1)
        openxlsx::addStyle(wb, hoja, st$body_txt, rows = fila, cols = 1, gridExpand = TRUE)
        fila <- fila + 2
        next
      }

      cuerpo <- tibble::tibble(Opciones = opciones)
      denom_map        <- list()
      estratos_totales <- list()

      # ---------- TOTAL ----------
      mask_total <- rep(TRUE, nrow(data))
      N_total <- denominador_validos(
        data       = data,
        var        = var,
        codes      = codes_row,
        tp         = tp,
        mask       = mask_total,
        weight_col = weight_col
      )
      n_total <- contar_por_opcion(
        data       = data,
        var        = var,
        codes      = codes_row,
        tp         = tp,
        mask       = mask_total,
        weight_col = weight_col
      )
      pct_total <- if (N_total > 0) n_total / N_total else rep(NA_real_, length(n_total))

      cuerpo <- dplyr::bind_cols(
        cuerpo,
        tibble::tibble(
          Total__n   = as.numeric(n_total),
          Total__pct = as.numeric(pct_total)
        )
      )
      denom_map[["Total__n"]] <- N_total

      # ---------- Cruces con cada variable de CRUZAR_CON ----------
      for (s in CRUZAR_CON) {
        if (!(s %in% names(data)) || identical(s, var)) next

        cats_s <- get_categorias(
          var              = s,
          data             = data,
          survey           = survey,
          orders_list      = orders_list,
          opciones_excluir = opciones_excluir
        )
        estr_codes  <- cats_s$codes
        estr_labels <- cats_s$labels
        if (!length(estr_codes)) next

        # Etiqueta del estrato (ej. "Region")
        s_lbl <- label_variable(s, dic_vars, labels_override, data)

        # Parche: si viene como "Region: Callao", dejar solo "Callao"
        estr_labels <- .strip_prefijo_subindice(estr_labels, s_lbl)

        # Guardar ya limpio
        estratos_totales[[s]] <- list(codes = estr_codes, labels = estr_labels)

        # Valores reales en la data para el estrato
        v_estr <- as.character(data[[s]])

        # Detectar si la data usa codigos o labels
        usa_codes  <- any(v_estr %in% estr_codes)
        usa_labels <- any(v_estr %in% estr_labels)

        keys_vec <- if (usa_codes || !usa_labels) estr_codes else estr_labels

        bloques <- lapply(seq_along(keys_vec), function(j) {
          key_j  <- keys_vec[j]
          mask_s <- !is.na(v_estr) & v_estr == key_j

          n_vec <- contar_por_opcion(
            data       = data,
            var        = var,
            codes      = codes_row,
            tp         = tp,
            mask       = mask_s,
            weight_col = weight_col
          )

          N <- denominador_validos(
            data       = data,
            var        = var,
            codes      = codes_row,
            tp         = tp,
            mask       = mask_s,
            weight_col = weight_col
          )

          pct <- if (N > 0) n_vec / N else rep(NA_real_, length(n_vec))
          nm_n   <- paste0(s, "__", make.names(estr_labels[j]), "__n")
          nm_pct <- paste0(s, "__", make.names(estr_labels[j]), "__pct")

          dfb <- tibble::tibble(
            !!nm_n   := as.numeric(n_vec),
            !!nm_pct := as.numeric(pct)
          )
          list(df = dfb, N = N)
        })

        cols_df    <- dplyr::bind_cols(lapply(bloques, `[[`, "df"))
        idx_n_cols <- grep("__n$", names(cols_df))
        Ns         <- vapply(bloques, `[[`, numeric(1), "N")

        if (length(idx_n_cols) == length(Ns) && length(Ns) > 0) {
          for (k in seq_along(idx_n_cols)) {
            denom_map[[names(cols_df)[idx_n_cols[k]]]] <- Ns[k]
          }
        }

        cuerpo <- dplyr::bind_cols(cuerpo, cols_df)
      }

      # ---------- fila Total ----------
      total_row <- as.list(rep(NA, ncol(cuerpo)))
      names(total_row) <- names(cuerpo)
      total_row[["Opciones"]] <- "Total"

      n_cols   <- grep("__n$",   names(cuerpo))
      pct_cols <- grep("__pct$", names(cuerpo))

      for (j in n_cols) {
        nm <- names(cuerpo)[j]
        Nj <- denom_map[[nm]]
        total_row[[j]] <- if (is.null(Nj)) NA_real_ else round(as.numeric(Nj), 0)
      }
      for (j in pct_cols) {
        n_partner <- sub("__pct$", "__n", names(cuerpo)[j])
        Nj <- suppressWarnings(as.numeric(total_row[[n_partner]]))
        total_row[[j]] <- if (!is.na(Nj) && Nj > 0) 1.0 else NA_real_
      }

      cuerpo <- dplyr::bind_rows(cuerpo, tibble::as_tibble(total_row))

      # ---------- titulo de la pregunta ----------
      ncols_tbl <- ncol(cuerpo)
      openxlsx::writeData(wb, hoja, qlab, startRow = fila, startCol = 1)
      openxlsx::addStyle(wb, hoja, st$q_title, rows = fila, cols = 1, gridExpand = TRUE)
      openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncols_tbl)
      openxlsx::setRowHeights(wb, hoja, rows = fila,
                              heights = .calc_row_height(qlab, col_width = 60, font_size = 11))
      openxlsx::addStyle(wb, hoja, st$table_end,
                         rows = fila, cols = 1:ncols_tbl,
                         gridExpand = TRUE, stack = TRUE)
      fila <- fila + 1

      # ---------- encabezados (3 niveles) ----------
      ncols_total <- ncol(cuerpo)
      hdr1_full <- rep("", ncols_total)
      hdr2_full <- rep("", ncols_total)
      hdr3_full <- rep("", ncols_total)

      hdr1_full[1] <- ""
      hdr2_full[1] <- ""
      hdr3_full[1] <- ""

      col_ptr <- 2L

      if (any(names(cuerpo) == "Total__n")) {
        hdr1_full[col_ptr:(col_ptr + 1)] <- ""
        hdr2_full[col_ptr:(col_ptr + 1)] <- "Total"
        hdr3_full[col_ptr:(col_ptr + 1)] <- c("n", "%")
        col_ptr <- col_ptr + 2L
      }

      if (length(estratos_totales)) {
        for (s in CRUZAR_CON) {
          info_s <- estratos_totales[[s]]
          if (is.null(info_s)) next
          estr_labels <- info_s$labels
          if (!length(estr_labels)) next

          s_lbl <- label_variable(s, dic_vars, labels_override, data)

          for (lab in estr_labels) {
            if (col_ptr > ncols_total) break
            hdr1_full[col_ptr:(col_ptr + 1)] <- s_lbl
            hdr2_full[col_ptr:(col_ptr + 1)] <- rep(as.character(lab), 2)
            hdr3_full[col_ptr:(col_ptr + 1)] <- c("n", "%")
            col_ptr <- col_ptr + 2L
          }
        }
      }

      if (col_ptr <= ncols_total) {
        remaining <- col_ptr:ncols_total
        hdr1_full[remaining] <- ""
        hdr2_full[remaining] <- ""
        hdr3_full[remaining] <- rep(c("n", "%"), length.out = length(remaining))
      }

      escribir_encabezado(hdr1_full, hdr2_full, hdr3_full, row0 = fila, col0 = 1)

      openxlsx::addStyle(wb, hoja, st$table_end,
                         rows = fila + 2, cols = 1:ncols_total,
                         gridExpand = TRUE, stack = TRUE)

      fila <- fila + 3

      # ---------- cuerpo en Excel ----------
      openxlsx::writeData(wb, hoja, cuerpo, startRow = fila, startCol = 1, colNames = FALSE)

      nfil     <- nrow(cuerpo)
      ncol_tbl <- ncol(cuerpo)

      openxlsx::addStyle(wb, hoja, st$body_txt,
                         rows = fila:(fila + nfil - 1), cols = 1,
                         gridExpand = TRUE)

      if (ncol_tbl > 1) {
        is_pct <- grepl("__pct$", names(cuerpo))
        pct_cols_w <- which(is_pct)
        int_cols   <- setdiff(2:ncol_tbl, pct_cols_w)

        if (length(int_cols)) {
          openxlsx::addStyle(wb, hoja, st$body_int,
                             rows = fila:(fila + nfil - 1),
                             cols  = int_cols,
                             gridExpand = TRUE)
        }
        if (length(pct_cols_w)) {
          openxlsx::addStyle(wb, hoja, st$body_pct,
                             rows = fila:(fila + nfil - 1),
                             cols  = pct_cols_w,
                             gridExpand = TRUE)
        }
      }

      fila_total <- fila + nfil - 1
      if (length(n_cols)) {
        openxlsx::addStyle(wb, hoja, st$body_int,
                           rows = fila_total, cols = n_cols,
                           gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$total_bold,
                           rows = fila_total, cols = 1,
                           gridExpand = TRUE, stack = TRUE)
      }
      if (length(pct_cols)) {
        openxlsx::addStyle(wb, hoja, st$body_pct,
                           rows = fila_total, cols = pct_cols,
                           gridExpand = TRUE, stack = TRUE)
      }
      openxlsx::addStyle(wb, hoja, st$table_end,
                         rows = fila_total, cols = 1:ncol_tbl,
                         gridExpand = TRUE, stack = TRUE)

      fila <- fila + nfil

      # ---------- pie de tabla ----------
      pie_txt <- sprintf("Fuente: %s", fuente)
      openxlsx::writeData(wb, hoja, pie_txt, startRow = fila, startCol = 1)
      openxlsx::addStyle(wb, hoja, st$note, rows = fila, cols = 1, gridExpand = TRUE)
      openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol_tbl)

      openxlsx::addStyle(
        wb, hoja, st$footer_top,
        rows = fila, cols = 1:ncol_tbl,
        gridExpand = TRUE, stack = TRUE
      )

      fila <- fila + 1

      # ---------- tabla de significancia (letras) ----------
      if (isTRUE(show_sig) && length(estratos_totales)) {

        letras_map_text <- c()
        bloques_sig     <- list()
        sig_h1          <- c("")
        sig_h2          <- c("")

        for (s in CRUZAR_CON) {
          info_s <- estratos_totales[[s]]
          if (is.null(info_s)) next
          estr_labels <- info_s$labels
          estr_codes  <- info_s$codes
          if (!length(estr_labels)) next

          s_lbl <- label_variable(s, dic_vars, labels_override, data)

          sig_h1 <- c(sig_h1, rep(s_lbl, length(estr_labels)))
          col_letters <- LETTERS[seq_along(estr_labels)]
          sig_h2 <- c(sig_h2, paste0(estr_labels, " (", col_letters, ")"))

          letras_map_text <- c(
            letras_map_text,
            paste0(
              s_lbl, ": ",
              paste0("(", col_letters, ") ", estr_labels, collapse = " · ")
            )
          )

          nn <- nN_para_sig_simple(
            data            = data,
            var             = var,
            opciones_labels = opciones,
            codes_row       = codes_row,
            estratos        = estr_codes,
            var_estrato     = s,
            tp              = tp,
            weight_col      = weight_col
          )

          cmp <- comparar_columnas_sig(nn$n_mat, nn$N_vec, alpha = alpha)

          bloques_sig[[s]] <- list(
            opciones    = opciones,
            estr_codes  = estr_codes,
            estr_labels = estr_labels,
            letras      = cmp$letras,
            sig         = cmp$sig
          )
        }

        if (length(bloques_sig)) {

          t_sig <- "Comparaciones de proporciones de columna"
          openxlsx::writeData(wb, hoja, t_sig, startRow = fila, startCol = 1)
          openxlsx::addStyle(wb, hoja, st$q_title, rows = fila, cols = 1, gridExpand = TRUE)

          ncols_sig <- length(sig_h1)
          if (ncols_sig < 2) ncols_sig <- 2

          openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncols_sig)
          openxlsx::addStyle(wb, hoja, st$table_end,
                             rows = fila, cols = 1:ncols_sig,
                             gridExpand = TRUE, stack = TRUE)
          fila <- fila + 1

          openxlsx::writeData(wb, hoja, t(sig_h1),
                              startRow = fila, startCol = 1, colNames = FALSE)
          openxlsx::writeData(wb, hoja, t(sig_h2),
                              startRow = fila + 1, startCol = 1, colNames = FALSE)
          openxlsx::addStyle(wb, hoja, st$header,
                             rows = fila:(fila + 1),
                             cols  = 1:ncols_sig,
                             gridExpand = TRUE)

          runs1 <- .merge_runs(sig_h1)
          for (r in runs1) if ((r[2] - r[1] + 1) > 1) {
            openxlsx::mergeCells(wb, hoja,
                                 rows = fila,
                                 cols = r[1]:r[2])
          }

          openxlsx::setRowHeights(
            wb, hoja, rows = fila,
            heights = .header_row_height(
              values = sig_h1,
              runs = runs1,
              col_offset = 0L,
              font_size = 10,
              min_h = 18,
              max_h = 100
            )
          )
          openxlsx::setRowHeights(
            wb, hoja, rows = fila + 1,
            heights = .header_row_height(
              values = sig_h2,
              runs = NULL,
              col_offset = 0L,
              font_size = 10,
              min_h = 18,
              max_h = 100
            )
          )

          fila_datos <- fila + 2

          openxlsx::writeData(wb, hoja, opciones,
                              startRow = fila_datos, startCol = 1, colNames = FALSE)
          openxlsx::addStyle(wb, hoja, st$cell,
                             rows = fila_datos:(fila_datos + length(opciones) - 1),
                             cols  = 1, gridExpand = TRUE)

          col_cursor <- 2
          for (s in CRUZAR_CON) {
            bl <- bloques_sig[[s]]
            if (is.null(bl)) next

            for (j in seq_along(bl$estr_labels)) {
              col_let <- character(length(opciones))

              rr <- match(opciones, bl$opciones)
              cc <- j

              ok <- which(!is.na(rr))
              if (length(ok)) {
                col_let[ok] <- bl$letras[cbind(rr[ok], cc)]
              }

              openxlsx::writeData(
                wb, hoja, col_let,
                startRow = fila_datos, startCol = col_cursor,
                colNames = FALSE
              )
              openxlsx::addStyle(
                wb, hoja, st$cell,
                rows = fila_datos:(fila_datos + length(opciones) - 1),
                cols  = col_cursor,
                gridExpand = TRUE
              )
              col_cursor <- col_cursor + 1
            }
          }

          pie_sig <- paste0(
            "Las letras indican columnas cuya proporcion es significativamente mayor ",
            "que la proporcion de la columna marcada por esa letra, segun pruebas z ",
            "de diferencia de proporciones con correccion de Bonferroni para ",
            "comparaciones multiples (α = ", alpha, "). ",
            "'.a' indica categoria excluida del contraste (proporciones 0 o 1).\n",
            "Letras por estrato: ",
            paste(letras_map_text, collapse = "  |  "),
            "\nFuente: ", fuente
          )

          fila_note <- fila_datos + length(opciones)
          openxlsx::writeData(wb, hoja, pie_sig,
                              startRow = fila_note, startCol = 1)
          openxlsx::addStyle(wb, hoja, st$note,
                             rows = fila_note, cols = 1, gridExpand = TRUE)
          openxlsx::mergeCells(wb, hoja, rows = fila_note, cols = 1:(col_cursor - 1))

          openxlsx::addStyle(
            wb, hoja, st$footer_top,
            rows = fila_note, cols = 1:(col_cursor - 1),
            gridExpand = TRUE, stack = TRUE
          )

          openxlsx::setRowHeights(wb, hoja, rows = fila_note,
                                  heights = .calc_row_height(pie_sig, col_width = 60,
                                                             font_size = 9, max_h = 150))

          fila <- fila_note + 2
        } else {
          fila <- fila + 1
        }
      }

      fila <- fila + 1
    }

    fila <- fila + 1
  }

  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 60)
  openxlsx::setColWidths(wb, hoja, cols = 2:200, widths = 16)

  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  message("Cruces exportados a: ", normalizePath(path_xlsx))
  invisible(path_xlsx)
}

# =============================================================================
# Dimensiones (modo especializado para variables 0-100)
# =============================================================================

.dim_footer_from_meta <- function(data, fuente = "Pulso PUCP") {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  rec_meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  idx_meta <- attr(data, "indices_meta", exact = TRUE)

  if ((!is.list(rec_meta) || !length(rec_meta)) &&
      (!is.list(idx_meta) || !length(idx_meta))) {
    return(paste0("Fuente: ", fuente))
  }

  fmt_num <- function(x) {
    out <- suppressWarnings(as.numeric(x))
    if (is.na(out)) return(NA_character_)
    format(round(out, 2), trim = TRUE, scientific = FALSE)
  }

  item_lines <- list()
  if (is.list(rec_meta) && length(rec_meta)) {
    for (nm in names(rec_meta)) {
      it <- rec_meta[[nm]]
      out_var <- as.character(it$variable_salida %||% nm)[1]
      it_lbl <- .dim_pretty_label(out_var, data)

      map <- it$mapeo
      escala <- ""
      if (is.data.frame(map) && nrow(map)) {
        lab_col <- if ("etiqueta" %in% names(map)) {
          "etiqueta"
        } else if ("label" %in% names(map)) {
          "label"
        } else {
          names(map)[1]
        }
        score_col <- if ("score_0_100" %in% names(map)) {
          "score_0_100"
        } else if ("score" %in% names(map)) {
          "score"
        } else {
          NA_character_
        }

        labs <- as.character(map[[lab_col]])
        scores <- if (!is.na(score_col)) {
          suppressWarnings(as.numeric(map[[score_col]]))
        } else {
          rep(NA_real_, length(labs))
        }

        ok <- !is.na(labs) & nzchar(trimws(labs))
        labs <- labs[ok]
        scores <- scores[ok]

        if (length(labs)) {
          pares <- vapply(seq_along(labs), function(i) {
            sc <- fmt_num(scores[i])
            if (is.na(sc)) labs[i] else paste0(labs[i], " (", sc, ")")
          }, character(1))
          escala <- paste(pares, collapse = " -> ")
        }
      }

      item_line <- if (nzchar(escala)) {
        paste0("  - ", it_lbl, ": ", escala)
      } else {
        paste0("  - ", it_lbl)
      }

      item_lines[[out_var]] <- item_line
      item_lines[[nm]] <- item_line
    }
  }

  subindices_lines <- character(0)

  subindices_meta <- if (is.list(idx_meta) && is.list(idx_meta$subindices)) idx_meta$subindices else list()
  if (length(subindices_meta)) {
    for (id in names(subindices_meta)) {
      sl <- subindices_meta[[id]]
      out_var <- as.character(sl$salida %||% paste0("sub_", id))[1]
      sl_lbl <- sl$etiqueta %||% .dim_pretty_label(out_var, data)
      subindices_lines <- c(subindices_lines, paste0("- ", sl_lbl, ": promedio de:"))

      vars_sl <- unique(as.character(sl$vars %||% character(0)))
      vars_sl <- vars_sl[!is.na(vars_sl) & nzchar(trimws(vars_sl))]
      if (!length(vars_sl)) {
        subindices_lines <- c(subindices_lines, "  - Componentes no disponibles")
        next
      }

      for (v in vars_sl) {
        ln <- item_lines[[v]]
        if (is.null(ln) || !nzchar(trimws(ln))) {
          ln <- paste0("  - ", .dim_pretty_label(v, data))
        }
        subindices_lines <- c(subindices_lines, ln)
      }
    }
  }

  indices_lines <- character(0)
  indices <- if (is.list(idx_meta) && is.list(idx_meta$indices)) idx_meta$indices else list()
  if (length(indices)) {
    for (id in names(indices)) {
      ix <- indices[[id]]
      out_var <- as.character(ix$salida %||% paste0("idx_", id))[1]
      ix_lbl <- ix$etiqueta %||% .dim_pretty_label(out_var, data)
      refs <- unique(as.character(ix$refs_resueltas %||% ix$refs %||% character(0)))
      refs <- refs[!is.na(refs) & nzchar(trimws(refs))]

      if (!length(refs)) {
        indices_lines <- c(indices_lines, paste0("- ", ix_lbl, ": indice agregado"))
        next
      }

      refs_lbl <- vapply(refs, function(r) {
        r2 <- if (r %in% names(data)) {
          r
        } else if (paste0("sub_", r) %in% names(data)) {
          paste0("sub_", r)
        } else {
          r
        }
        .dim_pretty_label(r2, data)
      }, character(1))

      indices_lines <- c(indices_lines, paste0("- ", ix_lbl, ": promedio de ", paste(refs_lbl, collapse = ", ")))
    }
  }

  partes <- c(
    "1) Enfoque general:",
    "Este tablero reporta indicadores en escala de 0 a 100 y usa ponderadores cuando hay una variable de pesos disponible."
  )

  if (length(item_lines)) {
    partes <- c(
      partes,
      "",
      "2) Recodificacion de items a escala 0-100:",
      unname(unique(unlist(item_lines)))
    )
  }

  if (length(subindices_lines)) {
    partes <- c(
      partes,
      "",
      "3) Construccion de subindices:",
      subindices_lines
    )
  }

  if (length(indices_lines)) {
    partes <- c(
      partes,
      "",
      "4) Construccion de indices:",
      indices_lines
    )
  }

  partes <- c(partes, "", paste0("Fuente: ", fuente))
  paste(partes, collapse = "\n")
}

.dim_metodologia_df <- function(data,
                                fuente = "Pulso PUCP",
                                fila = NULL,
                                cruces = NULL,
                                aplicar_semaforo = FALSE,
                                semaforo_cortes = c(50, 80),
                                hay_brecha = FALSE,
                                show_sig = TRUE,
                                alpha = 0.05,
                                estilo = c("tecnico", "editorial")) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  estilo <- match.arg(estilo)

  rec_meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  idx_meta <- attr(data, "indices_meta", exact = TRUE)

  fmt_num <- function(x) {
    out <- suppressWarnings(as.numeric(x))
    if (is.na(out)) return(NA_character_)
    format(round(out, 2), trim = TRUE, scientific = FALSE)
  }

  fmt_escala <- function(map) {
    if (!is.data.frame(map) || !nrow(map)) return("")
    lab_col <- if ("etiqueta" %in% names(map)) {
      "etiqueta"
    } else if ("label" %in% names(map)) {
      "label"
    } else {
      names(map)[1]
    }
    score_col <- if ("score_0_100" %in% names(map)) {
      "score_0_100"
    } else if ("score" %in% names(map)) {
      "score"
    } else {
      NA_character_
    }

    labs <- as.character(map[[lab_col]])
    scores <- if (!is.na(score_col)) suppressWarnings(as.numeric(map[[score_col]])) else rep(NA_real_, length(labs))
    ok <- !is.na(labs) & nzchar(trimws(labs))
    labs <- .dim_label_limpio(labs[ok])
    scores <- scores[ok]
    if (!length(labs)) return("")

    pares <- vapply(seq_along(labs), function(i) {
      sc <- fmt_num(scores[i])
      if (is.na(sc)) labs[i] else paste0(labs[i], " (", sc, ")")
    }, character(1))
    paste(pares, collapse = if (identical(estilo, "editorial")) ", " else " -> ")
  }

  rows <- list()
  add_row <- function(tipo, elemento, detalle = "") {
    rows[[length(rows) + 1L]] <<- data.frame(
      tipo = as.character(tipo),
      elemento = as.character(elemento),
      detalle = as.character(detalle),
      stringsAsFactors = FALSE
    )
  }

  add_row(
    "heading",
    if (identical(estilo, "editorial")) "1. Como leer estas tablas" else "1) Enfoque general",
    if (identical(estilo, "editorial")) {
      "Estas tablas muestran resultados en escala de 0 a 100. Cuando la base incluye ponderadores, los promedios se calculan usando esos pesos."
    } else {
      "Este tablero reporta indicadores en escala de 0 a 100 y usa ponderadores cuando hay una variable de pesos disponible."
    }
  )

  if (is.list(rec_meta) && length(rec_meta)) {
    add_row(
      "heading",
      if (identical(estilo, "editorial")) "2. Escalas usadas" else "2) Recodificacion de items (0-100)",
      ""
    )
    for (nm in names(rec_meta)) {
      it <- rec_meta[[nm]]
      src_var <- as.character(it$variable %||% nm)[1]

      lbl_src <- as.character(it$label %||% "")[1]
      if (!nzchar(trimws(lbl_src))) {
        lbl_src <- .dim_pretty_label(src_var, data)
      }
      lbl_src <- .dim_label_limpio(lbl_src)
      escala <- fmt_escala(it$mapeo)

      det <- if (nzchar(escala)) {
        paste0("Escala 0-100: ", escala)
      } else {
        "Recodificado en escala 0-100."
      }

      add_row(
        "item",
        if (identical(estilo, "editorial")) .dim_pregunta_editorial(src_var, lbl_src, data = data) else paste0(src_var, " - ", lbl_src),
        det
      )
    }
  }

  subindices_meta2 <- if (is.list(idx_meta) && is.list(idx_meta$subindices)) idx_meta$subindices else list()
  if (length(subindices_meta2)) {
    add_row(
      "heading",
      if (identical(estilo, "editorial")) "3. Como se construyen los drivers" else "3) Construccion de subindices",
      ""
    )
    for (id in names(subindices_meta2)) {
      sl <- subindices_meta2[[id]]
      out_var <- as.character(sl$salida %||% paste0("sub_", id))[1]
      sl_lbl <- .dim_label_limpio(sl$etiqueta %||% .dim_pretty_label(out_var, data))
      vars_sl <- unique(as.character(sl$vars %||% character(0)))
      vars_sl <- vars_sl[!is.na(vars_sl) & nzchar(trimws(vars_sl))]

      det <- if (length(vars_sl)) {
        comp <- vapply(vars_sl, function(v) .dim_label_limpio(.dim_pretty_label(v, data)), FUN.VALUE = character(1))
        paste0("Promedio simple de: ", paste(comp, collapse = ", "))
      } else {
        "Componentes no disponibles"
      }
      add_row("item", sl_lbl, det)
    }
  }

  indices <- if (is.list(idx_meta) && is.list(idx_meta$indices)) idx_meta$indices else list()
  if (length(indices)) {
    add_row(
      "heading",
      if (identical(estilo, "editorial")) "4. Como se construyen los indices" else "4) Construccion de indices",
      ""
    )
    for (id in names(indices)) {
      ix <- indices[[id]]
      out_var <- as.character(ix$salida %||% paste0("idx_", id))[1]
      ix_lbl <- .dim_label_limpio(ix$etiqueta %||% .dim_pretty_label(out_var, data))
      refs <- unique(as.character(ix$refs_resueltas %||% ix$refs %||% character(0)))
      refs <- refs[!is.na(refs) & nzchar(trimws(refs))]

      det <- if (length(refs)) {
        refs_lbl <- vapply(refs, function(r) {
          r2 <- if (r %in% names(data)) {
            r
          } else if (paste0("sub_", r) %in% names(data)) {
            paste0("sub_", r)
          } else {
            r
          }
          .dim_label_limpio(.dim_pretty_label(r2, data))
        }, character(1))
        paste0("Promedio simple de: ", paste(refs_lbl, collapse = ", "))
      } else {
        "Indice agregado"
      }

      add_row("item", ix_lbl, det)
    }
  }

  add_row("source", "Fuente", as.character(fuente))

  do.call(rbind, rows)
}

exportar_dimensiones_multi <- function(data,
                                       dic_vars,
                                       SECCIONES,
                                       fila,
                                       cruzar_dim       = NULL,
                                       incluir_total    = TRUE,
                                       brecha_filas     = FALSE,
                                       etiq_brecha_filas = "Brecha",
                                       brecha_cols      = FALSE,
                                       etiq_brecha_cols = "Brecha",
                                       tablas           = NULL,
                                       labels_override  = NULL,
                                       path_xlsx        = "cruces_multi.xlsx",
                                       hoja             = "Cruces",
                                       fuente           = "Pulso PUCP",
                                       titulo_metodologia = "Como leer estas tablas",
                                       estilo_metodologia = c("tecnico", "editorial"),
                                       survey           = NULL,
                                       orders_list      = NULL,
                                       weight_col       = "peso",
                                       opciones_excluir = NULL,
                                       show_sig         = TRUE,
                                       alpha            = 0.05,
                                       digits           = 1,
                                       aplicar_semaforo = TRUE,
                                       semaforo_cortes  = c(50, 75),
                                       semaforo_modo    = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
                                       semaforo_anclas_degradado = NULL,
                                       semaforo_gradiente_segmentos = 20L,
                                       semaforo_gradiente_colores = NULL,
                                       semaforo_gradiente_valores = NULL,
                                       semaforo_gradiente_limites = NULL,
                                       semaforo_colores = c(
                                         rojo = "#F8D7DA",
                                         amarillo = "#FFF3CD",
                                         verde = "#D4EDDA"
                                       ),
                                       aplicar_gradiente_brecha = TRUE,
                                       brecha_colores = c(
                                         bajo = "#FFFFFF",
                                         alto = "#F4B183"
                                       ),
                                       brecha_cortes = c(0, 30)) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  estilo_metodologia <- match.arg(estilo_metodologia)
  semaforo_modo <- .dim_normalize_semaforo_modo(semaforo_modo)
  semaforo_anclas_degradado <- .dim_normalize_degradado_anclas(
    semaforo_anclas_degradado,
    semaforo_cortes,
    default = c(rojo = 0, verde = 100)
  )
  semaforo_gradiente_segmentos <- .dim_normalize_gradiente_segmentos(
    semaforo_gradiente_segmentos,
    default = 20L
  )
  semaforo_gradiente_manual <- NULL
  if (identical(semaforo_modo, "degradado_manual")) {
    semaforo_gradiente_manual <- .dim_normalize_gradiente_manual(
      colores = semaforo_gradiente_colores,
      valores = semaforo_gradiente_valores,
      limites = semaforo_gradiente_limites
    )
  }
  .clean_chr <- function(x) {
    y <- as.character(x)
    y <- y[!is.na(y) & nzchar(trimws(y))]
    unique(trimws(y))
  }
  .sanitize_sheet_name <- function(x, fallback = "Resultados") {
    out <- as.character(x)[1]
    if (is.na(out) || !nzchar(trimws(out))) out <- fallback
    out <- trimws(out)
    out <- gsub("[:\\\\/\\?\\*\\[\\]]", "-", out)
    if (!nzchar(out)) out <- fallback
    substr(out, 1, 31)
  }
  .numfmt <- function(dg) {
    if (!is.finite(dg) || is.na(dg) || dg < 0) dg <- 1L
    dg <- as.integer(dg)
    if (dg == 0L) "#,##0" else paste0("#,##0.", paste(rep("0", dg), collapse = ""))
  }
  .coerce_nonneg_int <- function(x, default = 0L) {
    y <- suppressWarnings(as.integer(x)[1])
    if (!is.finite(y) || is.na(y) || y < 0L) as.integer(default) else y
  }
  .letters_ref <- function(n) {
    if (!is.finite(n) || is.na(n) || n <= 0) return(character(0))
    vapply(seq_len(as.integer(n)), function(i) openxlsx::int2col(i), FUN.VALUE = character(1))
  }
  .to_rgb <- function(col, fallback = "#FFFFFF") {
    x <- tryCatch(grDevices::col2rgb(col), error = function(e) NULL)
    if (is.null(x)) x <- grDevices::col2rgb(fallback)
    as.numeric(x[, 1])
  }
  .mix_color <- function(col_bajo, col_alto, t) {
    t <- pmax(0, pmin(1, as.numeric(t)))
    r0 <- .to_rgb(col_bajo, "#FFFFFF")
    r1 <- .to_rgb(col_alto, "#F4B183")
    rr <- round(r0 + (r1 - r0) * t)
    grDevices::rgb(rr[1], rr[2], rr[3], maxColorValue = 255)
  }

  etiq_brecha_filas <- as.character(etiq_brecha_filas)[1]
  if (!nzchar(trimws(etiq_brecha_filas))) etiq_brecha_filas <- "Brecha"
  etiq_brecha_cols <- as.character(etiq_brecha_cols)[1]
  if (!nzchar(trimws(etiq_brecha_cols))) etiq_brecha_cols <- "Brecha"
  digits <- suppressWarnings(as.integer(digits)[1])
  if (!is.finite(digits) || is.na(digits) || digits < 0L) {
    stop("`digits` debe ser un entero mayor o igual a 0.", call. = FALSE)
  }
  aplicar_semaforo <- isTRUE(aplicar_semaforo)
  semaforo_cortes <- suppressWarnings(as.numeric(semaforo_cortes))
  semaforo_cortes <- semaforo_cortes[is.finite(semaforo_cortes) & !is.na(semaforo_cortes)]
  if (length(semaforo_cortes) < 2L) semaforo_cortes <- c(50, 80)
  semaforo_cortes <- sort(semaforo_cortes)[1:2]
  semaforo_cortes <- pmax(0, pmin(100, semaforo_cortes))
  if (semaforo_cortes[1] >= semaforo_cortes[2]) semaforo_cortes <- c(50, 80)

  semaforo_colores <- as.character(semaforo_colores)
  nmsc <- names(semaforo_colores %||% character(0))
  if (is.null(nmsc)) nmsc <- character(0)
  col_rojo <- if ("rojo" %in% nmsc) semaforo_colores[["rojo"]] else "#F8D7DA"
  col_ambar <- if ("amarillo" %in% nmsc) semaforo_colores[["amarillo"]] else "#FFF3CD"
  col_verde <- if ("verde" %in% nmsc) semaforo_colores[["verde"]] else "#D4EDDA"
  aplicar_gradiente_brecha <- isTRUE(aplicar_gradiente_brecha)
  brecha_colores <- as.character(brecha_colores)
  nmbc <- names(brecha_colores %||% character(0))
  if (is.null(nmbc)) nmbc <- character(0)
  col_brecha_bajo <- if ("bajo" %in% nmbc) brecha_colores[["bajo"]] else if (length(brecha_colores) >= 1L) brecha_colores[1] else "#FFFFFF"
  col_brecha_alto <- if ("alto" %in% nmbc) brecha_colores[["alto"]] else if (length(brecha_colores) >= 2L) brecha_colores[2] else "#F4B183"
  brecha_cortes <- suppressWarnings(as.numeric(brecha_cortes))
  brecha_cortes <- brecha_cortes[is.finite(brecha_cortes) & !is.na(brecha_cortes)]
  if (length(brecha_cortes) < 2L) brecha_cortes <- c(0, 30)
  brecha_cortes <- sort(brecha_cortes)[1:2]
  brecha_corte_min <- brecha_cortes[1]
  brecha_corte_max <- brecha_cortes[2]

  hoja_meta <- .sanitize_sheet_name("Metodologia", fallback = "Metodologia")

  plan_tablas <- list()
  if (is.null(tablas)) {
    if (!is.list(SECCIONES) || !length(SECCIONES)) {
      stop("`SECCIONES` debe ser una lista nombrada de variables de indicadores.", call. = FALSE)
    }
    if (is.null(names(SECCIONES))) {
      names(SECCIONES) <- paste0("SECCION_", seq_along(SECCIONES))
    }
    if (!length(fila) || is.na(fila) || !nzchar(trimws(as.character(fila)[1]))) {
      stop("En modo `dimensiones`, `cruces` debe tener exactamente una variable de fila.", call. = FALSE)
    }
    fila <- as.character(fila)[1]
    for (sec in names(SECCIONES)) {
      plan_tablas[[length(plan_tablas) + 1L]] <- list(
        titulo = as.character(sec),
        indicadores = SECCIONES[[sec]],
        fila = fila,
        cruzar_dim = cruzar_dim,
        orientacion = "filas_dimension",
        hoja = hoja,
        incluir_total = isTRUE(incluir_total),
        brecha_filas = isTRUE(brecha_filas),
        etiq_brecha_filas = etiq_brecha_filas,
        brecha_cols = isTRUE(brecha_cols),
        etiq_brecha_cols = etiq_brecha_cols,
        espacio_antes = 0L,
        espacio_despues = 1L
      )
    }
  } else {
    if (!is.list(tablas) || !length(tablas)) {
      stop("`tablas` debe ser una lista no vacia.", call. = FALSE)
    }

    # --- Auto-expansion sobre tablas raw: idx_* se desglosa en sus subindices ---
    idx_meta_raw <- attr(data, "indices_meta", exact = TRUE)
    meta_idx_map  <- if (is.list(idx_meta_raw) && is.list(idx_meta_raw$indices)) idx_meta_raw$indices else list()
    meta_sub_map  <- if (is.list(idx_meta_raw) && is.list(idx_meta_raw$subindices)) idx_meta_raw$subindices else list()

    .expand_idx_to_subs <- function(tb_in) {
      inds_raw <- .clean_chr(tb_in$indicadores %||% tb_in$secciones %||% character(0))
      if (length(inds_raw) != 1L || !grepl("^idx_", inds_raw)) return(list(tb_in))

      idx_key <- NULL
      for (nm in names(meta_idx_map)) {
        salida <- as.character(meta_idx_map[[nm]]$salida %||% paste0("idx_", nm))[1]
        if (identical(salida, inds_raw)) { idx_key <- nm; break }
      }
      if (is.null(idx_key)) return(list(tb_in))

      idx_entry <- meta_idx_map[[idx_key]]
      idx_etiq  <- as.character(idx_entry$etiqueta %||% idx_key)[1]

      # titulo y hoja: respetar si el usuario los especifico explicitamente
      tb_in$titulo <- as.character(tb_in$titulo %||% idx_etiq)[1]
      tb_in$hoja   <- .sanitize_sheet_name(tb_in$hoja %||% idx_etiq, fallback = idx_etiq)

      refs <- unique(as.character(idx_entry$refs %||% character(0)))
      refs <- refs[!is.na(refs) & nzchar(trimws(refs))]

      sub_tables <- list()
      first_sub <- TRUE
      for (r in refs) {
        sub_entry <- meta_sub_map[[r]]
        if (is.null(sub_entry)) next
        sub_var <- as.character(sub_entry$salida %||% paste0("sub_", r))[1]
        if (!(sub_var %in% names(data))) next

        sub_tb <- tb_in
        sub_tb$titulo        <- as.character(sub_entry$etiqueta %||% r)[1]
        sub_tb$indicadores   <- sub_var
        sub_tb$espacio_antes <- if (first_sub) 3L else 1L
        sub_tables <- c(sub_tables, list(sub_tb))
        first_sub <- FALSE
      }

      c(list(tb_in), sub_tables)
    }

    tablas_exp <- list()
    for (tb_raw in tablas) {
      if (!is.list(tb_raw)) stop("Cada elemento de `tablas` debe ser una lista.", call. = FALSE)
      tablas_exp <- c(tablas_exp, .expand_idx_to_subs(tb_raw))
    }

    nms <- names(tablas_exp)
    for (i in seq_along(tablas_exp)) {
      tb <- tablas_exp[[i]]
      indicadores_i <- tb$indicadores %||% tb$secciones %||% character(0)
      titulo_guess <- if (!is.null(tb$titulo) && nzchar(trimws(as.character(tb$titulo)[1]))) {
        as.character(tb$titulo)[1]
      } else if (length(indicadores_i)) {
        lbl_guess <- label_variable(indicadores_i[1], dic_vars = dic_vars, data = data)
        .strip_label_0100(lbl_guess)
      } else if (!is.null(nms) && nzchar(nms[i])) {
        nms[i]
      } else {
        paste0("TABLA_", i)
      }
      titulo_i <- as.character(titulo_guess)[1]
      fila_i <- as.character(tb$fila %||% fila)[1]
      cruz_i <- tb$cruzar_dim %||% tb$cruzar_con %||% cruzar_dim
      incluir_total_i <- if (!is.null(tb$incluir_total)) isTRUE(tb$incluir_total) else isTRUE(incluir_total)
      brecha_filas_i <- if (!is.null(tb$brecha_filas)) isTRUE(tb$brecha_filas) else isTRUE(brecha_filas)
      etiq_brecha_filas_i <- as.character(tb$etiq_brecha_filas %||% etiq_brecha_filas)[1]
      if (!nzchar(trimws(etiq_brecha_filas_i))) etiq_brecha_filas_i <- "Brecha"
      brecha_cols_i <- if (!is.null(tb$brecha_cols)) isTRUE(tb$brecha_cols) else isTRUE(brecha_cols)
      etiq_brecha_cols_i <- as.character(tb$etiq_brecha_cols %||% etiq_brecha_cols)[1]
      if (!nzchar(trimws(etiq_brecha_cols_i))) etiq_brecha_cols_i <- "Brecha"
      espacio_antes_i <- .coerce_nonneg_int(tb$espacio_antes %||% 0L, default = 0L)
      espacio_despues_i <- .coerce_nonneg_int(tb$espacio_despues %||% 1L, default = 1L)

      plan_tablas[[length(plan_tablas) + 1L]] <- list(
        titulo = titulo_i,
        indicadores = indicadores_i,
        fila = fila_i,
        cruzar_dim = cruz_i,
        orientacion = as.character(tb$orientacion %||% "filas_dimension")[1],
        hoja = as.character(tb$hoja %||% hoja)[1],
        incluir_total = incluir_total_i,
        brecha_filas = brecha_filas_i,
        etiq_brecha_filas = etiq_brecha_filas_i,
        brecha_cols = brecha_cols_i,
        etiq_brecha_cols = etiq_brecha_cols_i,
        espacio_antes = espacio_antes_i,
        espacio_despues = espacio_despues_i
      )
    }
  }

  for (k in seq_along(plan_tablas)) {
    tb <- plan_tablas[[k]]
    titulo_k <- as.character(tb$titulo)[1]

    fila_k <- as.character(tb$fila)[1]
    if (!nzchar(trimws(fila_k)) || !(fila_k %in% names(data))) {
      stop("La variable de fila `", fila_k, "` no existe en `data` (tabla: ", titulo_k, ").", call. = FALSE)
    }

    inds_k <- .clean_chr(tb$indicadores)
    if (!length(inds_k)) {
      stop("La tabla `", titulo_k, "` no tiene indicadores validos.", call. = FALSE)
    }

    missing_vars <- setdiff(inds_k, names(data))
    if (length(missing_vars)) {
      stop(
        "Variables no encontradas en `data` (tabla ", titulo_k, "): ",
        paste(missing_vars, collapse = ", "),
        call. = FALSE
      )
    }

    no_num <- inds_k[!vapply(inds_k, function(v) is.numeric(data[[v]]), logical(1))]
    if (length(no_num)) {
      stop(
        "En modo `dimensiones`, todos los indicadores deben ser numericos (tabla ",
        titulo_k, "). No numericos: ", paste(no_num, collapse = ", "),
        call. = FALSE
      )
    }

    pref_ok <- grepl("^(r100_|sub_|idx_)", inds_k)
    if (any(!pref_ok)) {
      warning(
        "Tabla `", titulo_k, "`: variables fuera de prefijos esperados (r100_, sub_, idx_): ",
        paste(inds_k[!pref_ok], collapse = ", "),
        call. = FALSE
      )
    }

    cruz_k <- .clean_chr(tb$cruzar_dim)
    cruz_k <- intersect(cruz_k, names(data))
    cruz_k <- setdiff(cruz_k, fila_k)
    orientacion_k <- as.character(tb$orientacion %||% "filas_dimension")[1]
    if (is.na(orientacion_k) || !orientacion_k %in% c("filas_dimension", "filas_indicadores")) {
      stop(
        "La tabla `", titulo_k, "` usa una `orientacion` no soportada: ",
        as.character(tb$orientacion %||% NA_character_)[1],
        call. = FALSE
      )
    }
    hoja_k <- .sanitize_sheet_name(tb$hoja %||% hoja, fallback = hoja)
    if (identical(tolower(hoja_k), tolower(hoja_meta))) {
      hoja_k <- .sanitize_sheet_name(paste0(hoja_k, "_tablas"), fallback = "Resultados")
    }

    plan_tablas[[k]]$indicadores <- inds_k
    plan_tablas[[k]]$fila <- fila_k
    plan_tablas[[k]]$cruzar_dim <- cruz_k
    plan_tablas[[k]]$orientacion <- orientacion_k
    plan_tablas[[k]]$hoja <- hoja_k
    plan_tablas[[k]]$incluir_total <- isTRUE(tb$incluir_total)
    plan_tablas[[k]]$brecha_filas <- isTRUE(tb$brecha_filas)
    plan_tablas[[k]]$etiq_brecha_filas <- as.character(tb$etiq_brecha_filas)[1]
    plan_tablas[[k]]$brecha_cols <- isTRUE(tb$brecha_cols)
    plan_tablas[[k]]$etiq_brecha_cols <- as.character(tb$etiq_brecha_cols)[1]
    plan_tablas[[k]]$espacio_antes <- .coerce_nonneg_int(tb$espacio_antes %||% 0L, default = 0L)
    plan_tablas[[k]]$espacio_despues <- .coerce_nonneg_int(tb$espacio_despues %||% 1L, default = 1L)
  }

  w <- get_pesos(data, weight_col)
  st <- mk_styles_cruces()
  style_num_dim <- openxlsx::createStyle(
    fontSize = 10,
    numFmt = .numfmt(digits),
    halign = "right",
    valign = "center",
    fontName = "Arial"
  )
  st_blanco    <- openxlsx::createStyle(fgFill = "#FFFFFF", fontName = "Arial")
  st_sem_rojo  <- openxlsx::createStyle(fgFill = col_rojo,  fontName = "Arial")
  st_sem_ambar <- openxlsx::createStyle(fgFill = col_ambar, fontName = "Arial")
  st_sem_verde <- openxlsx::createStyle(fgFill = col_verde, fontName = "Arial")
  sem_style_cache <- new.env(parent = emptyenv())
  sem_style_cache[[col_rojo]] <- st_sem_rojo
  sem_style_cache[[col_ambar]] <- st_sem_ambar
  sem_style_cache[[col_verde]] <- st_sem_verde
  .sem_style_for <- function(fill) {
    fill <- as.character(fill %||% "")[1]
    if (!nzchar(fill)) return(NULL)
    if (!exists(fill, envir = sem_style_cache, inherits = FALSE)) {
      sem_style_cache[[fill]] <- openxlsx::createStyle(fgFill = fill, fontName = "Arial")
    }
    sem_style_cache[[fill]]
  }
  .apply_semaforo_excel <- function(val_mat, row_ini, hoja_tb, idx_eval = seq_len(nrow(val_mat)),
                                    exclude_rows_by_col = NULL) {
    if (!isTRUE(aplicar_semaforo) || !ncol(val_mat)) return(invisible(NULL))
    idx_eval <- idx_eval[is.finite(idx_eval) & !is.na(idx_eval)]
    if (!length(idx_eval)) return(invisible(NULL))

    sem_cols <- .dim_semaforo_color(
      x = as.numeric(val_mat),
      cortes = semaforo_cortes,
      colores = list(rojo = col_rojo, ambar = col_ambar, verde = col_verde),
      digits = 0L,
      modo = semaforo_modo,
      anclas_degradado = semaforo_anclas_degradado,
      gradiente_colores = semaforo_gradiente_manual$colores %||% NULL,
      gradiente_valores = semaforo_gradiente_manual$valores %||% NULL,
      gradiente_limites = semaforo_gradiente_manual$limites %||% NULL,
      gradiente_segmentos = semaforo_gradiente_segmentos
    )
    sem_mat <- matrix(sem_cols, nrow = nrow(val_mat), ncol = ncol(val_mat))

    for (cc in seq_len(ncol(val_mat))) {
      idx_col_eval <- idx_eval
      if (!is.null(exclude_rows_by_col) && length(exclude_rows_by_col) >= cc && length(exclude_rows_by_col[[cc]])) {
        idx_col_eval <- setdiff(idx_col_eval, exclude_rows_by_col[[cc]])
      }
      if (!length(idx_col_eval)) next
      fills <- sem_mat[idx_col_eval, cc]
      keep <- !is.na(fills) & nzchar(fills)
      if (!any(keep)) next
      idx_rows <- idx_col_eval[keep]
      fills <- fills[keep]
      excel_col <- cc + 1L
      for (fill in unique(fills)) {
        rows_fill <- idx_rows[fills == fill]
        sty <- .sem_style_for(fill)
        if (length(rows_fill) && !is.null(sty)) {
          openxlsx::addStyle(
            wb, hoja_tb, sty,
            rows = row_ini + rows_fill - 1L,
            cols = excel_col,
            gridExpand = TRUE,
            stack = TRUE
          )
        }
      }
    }
    invisible(NULL)
  }

  wb <- openxlsx::createWorkbook()
  footer_source <- paste0("Fuente: ", fuente)
  meta_df <- .dim_metodologia_df(
    data = data,
    fuente = fuente,
    estilo = estilo_metodologia
  )

  st_meta_h <- openxlsx::createStyle(
    fontSize = if (identical(estilo_metodologia, "editorial")) 12 else 11,
    textDecoration = "bold",
    halign = "left",
    valign = "center",
    wrapText = TRUE,
    fontName = "Arial"
  )
  st_meta_label <- openxlsx::createStyle(
    fontSize = 10,
    textDecoration = if (identical(estilo_metodologia, "editorial")) "bold" else "italic",
    halign = "left",
    valign = "top",
    wrapText = TRUE,
    fontName = "Arial"
  )
  st_meta_t <- openxlsx::createStyle(
    fontSize = 10,
    halign = "left",
    valign = "top",
    wrapText = TRUE,
    fontName = "Arial"
  )

  openxlsx::addWorksheet(wb, hoja_meta)
  openxlsx::writeData(
    wb,
    hoja_meta,
    if (is.na(titulo_metodologia) || !nzchar(trimws(titulo_metodologia))) "Como leer estas tablas" else as.character(titulo_metodologia)[1],
    startRow = 1,
    startCol = 1,
    colNames = FALSE
  )
  openxlsx::mergeCells(wb, hoja_meta, rows = 1, cols = 1:2)
  openxlsx::addStyle(wb, hoja_meta, st$sec_title, rows = 1, cols = 1:2, gridExpand = TRUE, stack = TRUE)

  rr <- 3L
  for (i in seq_len(nrow(meta_df))) {
    el <- as.character(meta_df$elemento[i])
    det <- as.character(meta_df$detalle[i])
    tp <- as.character(meta_df$tipo[i])

    openxlsx::writeData(wb, hoja_meta, el, startRow = rr, startCol = 1, colNames = FALSE)
    openxlsx::writeData(wb, hoja_meta, det, startRow = rr, startCol = 2, colNames = FALSE)

    if (identical(tp, "heading")) {
      openxlsx::addStyle(wb, hoja_meta, st_meta_h, rows = rr, cols = 1:2, gridExpand = TRUE, stack = TRUE)
    } else if (identical(tp, "source")) {
      openxlsx::addStyle(wb, hoja_meta, st$note, rows = rr, cols = 1:2, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_meta, st$footer_top, rows = rr, cols = 1:2, gridExpand = TRUE, stack = TRUE)
    } else {
      openxlsx::addStyle(wb, hoja_meta, st_meta_label, rows = rr, cols = 1, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_meta, st_meta_t, rows = rr, cols = 2, gridExpand = TRUE, stack = TRUE)
    }

    h1 <- .calc_row_height(el, col_width = if (identical(estilo_metodologia, "editorial")) 34 else 44, font_size = if (identical(tp, "heading")) 11 else 10, max_h = 160)
    h2 <- .calc_row_height(det, col_width = if (identical(estilo_metodologia, "editorial")) 78 else 96, font_size = 10, max_h = 180)
    openxlsx::setRowHeights(wb, hoja_meta, rows = rr, heights = max(h1, h2))
    rr <- rr + 1L
  }

  openxlsx::setColWidths(wb, hoja_meta, cols = 1, widths = if (identical(estilo_metodologia, "editorial")) 34 else 44)
  openxlsx::setColWidths(wb, hoja_meta, cols = 2, widths = if (identical(estilo_metodologia, "editorial")) 78 else 96)

  sheet_rows <- list()
  sheet_used_cols <- list()
  sheet_brecha_cols <- list()
  sheet_first_col_chars <- list()
  .ensure_sheet <- function(sheet_name) {
    sn <- .sanitize_sheet_name(sheet_name, fallback = hoja)
    if (!(sn %in% names(sheet_rows))) {
      openxlsx::addWorksheet(wb, sn)
      row0 <- 1L
      openxlsx::writeData(wb, sn, "CRUCES", startRow = row0, startCol = 1)
      openxlsx::addStyle(wb, sn, st$sec_title, rows = row0, cols = 1, gridExpand = TRUE)
      openxlsx::mergeCells(wb, sn, rows = row0, cols = 1:6)
      sheet_rows[[sn]] <<- row0 + 2L
      sheet_used_cols[[sn]] <<- 1:6
      sheet_brecha_cols[[sn]] <<- integer(0)
      sheet_first_col_chars[[sn]] <<- integer(0)
    }
    as.integer(sheet_rows[[sn]])
  }
  .set_sheet_row <- function(sheet_name, row_value) {
    sn <- .sanitize_sheet_name(sheet_name, fallback = hoja)
    sheet_rows[[sn]] <<- as.integer(row_value)
  }
  .register_sheet_cols <- function(sheet_name,
                                   used_cols = integer(0),
                                   brecha_cols = integer(0),
                                   first_col_texts = character(0)) {
    sn <- .sanitize_sheet_name(sheet_name, fallback = hoja)
    used_cols <- suppressWarnings(as.integer(used_cols))
    used_cols <- used_cols[is.finite(used_cols) & !is.na(used_cols) & used_cols >= 1L]
    brecha_cols <- suppressWarnings(as.integer(brecha_cols))
    brecha_cols <- brecha_cols[is.finite(brecha_cols) & !is.na(brecha_cols) & brecha_cols >= 1L]
    first_col_texts <- .clean_chr(first_col_texts)
    first_col_chars <- nchar(first_col_texts, type = "width", allowNA = FALSE, keepNA = FALSE)
    sheet_used_cols[[sn]] <<- sort(unique(c(sheet_used_cols[[sn]] %||% integer(0), used_cols)))
    sheet_brecha_cols[[sn]] <<- sort(unique(c(sheet_brecha_cols[[sn]] %||% integer(0), brecha_cols)))
    sheet_first_col_chars[[sn]] <<- c(sheet_first_col_chars[[sn]] %||% integer(0), first_col_chars)
    invisible(NULL)
  }

  for (tb in plan_tablas) {
    hoja_tb <- tb$hoja
    fila_excel <- .ensure_sheet(hoja_tb)
    espacio_antes_tb <- .coerce_nonneg_int(tb$espacio_antes %||% 0L, default = 0L)
    espacio_despues_tb <- .coerce_nonneg_int(tb$espacio_despues %||% 1L, default = 1L)
    fila_antes_inicio <- fila_excel
    fila_excel <- fila_excel + espacio_antes_tb

    sec <- as.character(tb$titulo)[1]
    vars_sec <- tb$indicadores
    fila_tb <- tb$fila
    cruzar_dim_tb <- tb$cruzar_dim
    incluir_total_tb <- isTRUE(tb$incluir_total)
    brecha_filas_tb <- isTRUE(tb$brecha_filas)
    etiq_brecha_filas_tb <- as.character(tb$etiq_brecha_filas)[1]
    brecha_cols_tb <- isTRUE(tb$brecha_cols)
    etiq_brecha_cols_tb <- as.character(tb$etiq_brecha_cols)[1]

    x_cache <- lapply(vars_sec, function(v) suppressWarnings(as.numeric(data[[v]])))
    names(x_cache) <- vars_sec
    ind_labels <- vapply(vars_sec, function(v) {
      .dim_label_limpio(label_variable(v, dic_vars, labels_override, data))
    }, character(1))

    fila_lbl <- .dim_label_limpio(label_variable(fila_tb, dic_vars, labels_override, data))
    fila_hdr <- ""
    orientacion_tb <- as.character(tb$orientacion %||% "filas_dimension")[1]

    if (identical(orientacion_tb, "filas_indicadores")) {
      vars_cols_tb <- unique(c(fila_tb, cruzar_dim_tb))
      blocks_t <- list()

      if (isTRUE(incluir_total_tb) || !length(vars_cols_tb)) {
        blocks_t[[length(blocks_t) + 1L]] <- list(
          top = "Promedio general",
          sub = "",
          legacy = "Promedio general",
          var_key = NA_character_,
          mask = rep(TRUE, nrow(data)),
          block_label = "Promedio general"
        )
      }

      for (s in vars_cols_tb) {
        cats_s <- get_categorias(
          var              = s,
          data             = data,
          survey           = survey,
          orders_list      = orders_list,
          opciones_excluir = opciones_excluir
        )
        estr_codes  <- cats_s$codes
        estr_labels <- cats_s$labels
        if (!length(estr_codes)) next

        s_lbl <- .dim_label_limpio(label_variable(s, dic_vars, labels_override, data))
        estr_labels <- .strip_prefijo_subindice(estr_labels, s_lbl)

        v_estr <- as.character(data[[s]])
        keys_s <- .pick_cat_keys(v_estr, estr_codes, estr_labels)
        if (!length(keys_s)) next

        for (j in seq_along(keys_s)) {
          blocks_t[[length(blocks_t) + 1L]] <- list(
            top = s_lbl,
            sub = as.character(estr_labels[j]),
            legacy = paste0(s_lbl, ": ", as.character(estr_labels[j])),
            var_key = as.character(s)[1],
            mask = !is.na(v_estr) & v_estr == keys_s[j],
            block_label = paste0(s_lbl, ": ", as.character(estr_labels[j]))
          )
        }
      }

      if (!length(blocks_t)) {
        blocks_t[[1L]] <- list(
          top = "Promedio general",
          sub = "",
          legacy = "Promedio general",
          var_key = NA_character_,
          mask = rep(TRUE, nrow(data)),
          block_label = "Promedio general"
        )
      }

      I_t <- length(vars_sec)
      B_t <- length(blocks_t)
      medias_t <- matrix(NA_real_, nrow = I_t, ncol = B_t)
      sds_t <- matrix(NA_real_, nrow = I_t, ncol = B_t)
      ns_t <- matrix(NA_real_, nrow = I_t, ncol = B_t)

      for (b in seq_len(B_t)) {
        mask_b <- as.logical(blocks_t[[b]]$mask)
        for (i in seq_len(I_t)) {
          st_i <- .dim_weighted_stats(x_cache[[i]], w, mask_b)
          medias_t[i, b] <- st_i$mean
          sds_t[i, b] <- st_i$sd
          ns_t[i, b] <- st_i$n
        }
      }

      fila_lbl_t <- if (all(grepl("^r100_", vars_sec))) "Criterio" else "Indicador"
      out <- data.frame(
        stats::setNames(list(as.character(ind_labels)), fila_lbl_t),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
      h1 <- c("")
      h2 <- c("")
      col_k <- 0L
      is_brecha_col <- logical(0)

      idx_total_t <- which(vapply(blocks_t, function(bl) is.na(bl$var_key), logical(1)))

      if (length(idx_total_t)) {
        for (b in idx_total_t) {
          col_k <- col_k + 1L
          out[[paste0("col_", col_k)]] <- ifelse(is.na(medias_t[, b]), NA_real_, round(medias_t[, b], digits))
          h1 <- c(h1, blocks_t[[b]]$top)
          h2 <- c(h2, blocks_t[[b]]$sub)
          is_brecha_col <- c(is_brecha_col, FALSE)
        }
      }

      for (s in vars_cols_tb) {
        s_chr <- as.character(s)[1]
        idx_cv <- which(vapply(blocks_t, function(bl) identical(bl$var_key, s_chr), logical(1)))
        if (!length(idx_cv)) next

        for (b in idx_cv) {
          col_k <- col_k + 1L
          out[[paste0("col_", col_k)]] <- ifelse(is.na(medias_t[, b]), NA_real_, round(medias_t[, b], digits))
          h1 <- c(h1, blocks_t[[b]]$top)
          h2 <- c(h2, blocks_t[[b]]$sub)
          is_brecha_col <- c(is_brecha_col, FALSE)
        }

        if (isTRUE(brecha_cols_tb) && length(idx_cv) >= 2L) {
          col_k <- col_k + 1L
          vals_bc <- rep(NA_real_, I_t)
          for (i in seq_len(I_t)) {
            vv <- medias_t[i, idx_cv]
            vv <- vv[is.finite(vv) & !is.na(vv)]
            vals_bc[i] <- if (length(vv) >= 2L) round(max(vv) - min(vv), digits) else NA_real_
          }
          out[[paste0("col_", col_k)]] <- vals_bc
          h1 <- c(h1, .dim_label_limpio(label_variable(s_chr, dic_vars, labels_override, data)))
          h2 <- c(h2, etiq_brecha_cols_tb)
          is_brecha_col <- c(is_brecha_col, TRUE)
        }
      }

      brecha_col_df_indices <- which(is_brecha_col)
      row_brecha_idx_out <- NA_integer_
      ncols_tbl <- ncol(out)
      ncols_pintar <- max(6L, ncols_tbl)

      if (espacio_antes_tb > 0L) {
        rows_esp_antes <- fila_antes_inicio:(fila_antes_inicio + espacio_antes_tb - 1L)
        openxlsx::addStyle(
          wb, hoja_tb, st_blanco,
          rows = rows_esp_antes,
          cols = 1:ncols_pintar,
          gridExpand = TRUE,
          stack = TRUE
        )
      }

      sec_txt <- if (!is.na(sec) && nzchar(trimws(sec))) as.character(sec) else "SECCION"
      openxlsx::writeData(wb, hoja_tb, sec_txt, startRow = fila_excel, startCol = 1, colNames = FALSE)
      openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
      openxlsx::addStyle(wb, hoja_tb, st$q_title, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      fila_excel <- fila_excel + 1L

      openxlsx::writeData(wb, hoja_tb, t(h1), startRow = fila_excel, startCol = 1, colNames = FALSE)
      openxlsx::writeData(wb, hoja_tb, t(h2), startRow = fila_excel + 1L, startCol = 1, colNames = FALSE)
      openxlsx::addStyle(wb, hoja_tb, st$header_A, rows = fila_excel:(fila_excel + 1L), cols = 1, gridExpand = TRUE, stack = TRUE)
      if (ncols_tbl > 1L) {
        openxlsx::addStyle(
          wb, hoja_tb, st$header,
          rows = fila_excel:(fila_excel + 1L),
          cols = 2:ncols_tbl,
          gridExpand = TRUE,
          stack = TRUE
        )
      }

      runs1 <- .merge_runs(h1)
      for (r in runs1) {
        c1 <- max(2L, r[1])
        c2 <- r[2]
        if ((c2 - c1 + 1L) > 1L) {
          openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = c1:c2)
        }
      }

      openxlsx::setRowHeights(
        wb, hoja_tb, rows = fila_excel,
        heights = .header_row_height(
          values = h1,
          runs = runs1,
          col_offset = 0L,
          font_size = 10,
          min_h = 18,
          max_h = 100
        )
      )
      openxlsx::setRowHeights(
        wb, hoja_tb, rows = fila_excel + 1L,
        heights = .header_row_height(
          values = h2,
          runs = NULL,
          col_offset = 0L,
          font_size = 10,
          min_h = 18,
          max_h = 100
        )
      )

      fila_excel <- fila_excel + 2L
      openxlsx::writeData(wb, hoja_tb, out, startRow = fila_excel, startCol = 1, colNames = FALSE)
      row_ini <- fila_excel
      row_fin <- fila_excel + nrow(out) - 1L

      openxlsx::addStyle(wb, hoja_tb, st$body_txt, rows = row_ini:row_fin, cols = 1, gridExpand = TRUE, stack = TRUE)
      if (ncols_tbl > 1L) {
        openxlsx::addStyle(wb, hoja_tb, st_blanco, rows = row_ini:row_fin, cols = 2:ncols_tbl, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja_tb, style_num_dim, rows = row_ini:row_fin, cols = 2:ncols_tbl, gridExpand = TRUE, stack = TRUE)

        if (isTRUE(aplicar_semaforo)) {
          val_mat <- as.matrix(out[, 2:ncols_tbl, drop = FALSE])
          .apply_semaforo_excel(val_mat, row_ini = row_ini, hoja_tb = hoja_tb)
        }
      }

      if (length(brecha_col_df_indices)) {
        bc_excel_cols <- brecha_col_df_indices + 1L
        st_bold <- openxlsx::createStyle(textDecoration = "Bold")
        openxlsx::addStyle(wb, hoja_tb, st_bold, rows = row_ini:row_fin, cols = bc_excel_cols, gridExpand = TRUE, stack = TRUE)
      }
      .register_sheet_cols(
        hoja_tb,
        used_cols = seq_len(ncols_tbl),
        brecha_cols = if (length(brecha_col_df_indices)) brecha_col_df_indices + 1L else integer(0),
        first_col_texts = c(sec_txt, ind_labels)
      )

      if (length(brecha_col_df_indices) && isTRUE(aplicar_gradiente_brecha)) {
        bc_excel_cols <- brecha_col_df_indices + 1L
        style_cache_bc <- new.env(parent = emptyenv())
        for (rr in seq_len(nrow(out))) {
          row_excel_rr <- row_ini + rr - 1L
          for (jj in seq_along(brecha_col_df_indices)) {
            val_bc <- suppressWarnings(as.numeric(out[rr, brecha_col_df_indices[jj] + 1L]))
            if (!is.finite(val_bc) || is.na(val_bc)) next
            tt <- if (isTRUE(brecha_corte_max > brecha_corte_min)) {
              pmax(0, pmin(1, (val_bc - brecha_corte_min) / (brecha_corte_max - brecha_corte_min)))
            } else 0.5
            col_j <- .mix_color(col_brecha_bajo, col_brecha_alto, tt)
            if (!exists(col_j, envir = style_cache_bc, inherits = FALSE)) {
              assign(col_j, openxlsx::createStyle(fgFill = col_j, fontName = "Arial"), envir = style_cache_bc)
            }
            st_j <- get(col_j, envir = style_cache_bc, inherits = FALSE)
            openxlsx::addStyle(wb, hoja_tb, st_j, rows = row_excel_rr, cols = bc_excel_cols[jj], gridExpand = TRUE, stack = TRUE)
          }
        }
      }

      openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = row_fin, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      fila_excel <- row_fin + 1L

      openxlsx::writeData(wb, hoja_tb, footer_source, startRow = fila_excel, startCol = 1, colNames = FALSE)
      openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
      openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_tb, st$footer_top, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      openxlsx::setRowHeights(
        wb, hoja_tb, rows = fila_excel,
        heights = .calc_row_height(footer_source, col_width = 60, font_size = 9, max_h = 220)
      )
      fila_excel <- fila_excel + 1L

      nota_partes <- c(
        "Nota metodologica: Los valores representan promedios ponderados en escala de 0 a 100."
      )
      if (isTRUE(aplicar_semaforo)) {
        c1 <- semaforo_cortes[1]
        c2 <- semaforo_cortes[2]
        nota_partes <- c(
          nota_partes,
          paste0(
            "Se emplea un semaforo de colores (rojo < ", c1,
            ", amarillo ", c1, "-", c2, ", verde > ", c2, ")."
          )
        )
      }
      if (length(brecha_col_df_indices)) {
        nota_partes <- c(
          nota_partes,
          "La brecha corresponde a la diferencia entre el promedio maximo y minimo del grupo respectivo."
        )
        if (isTRUE(aplicar_gradiente_brecha)) {
          nota_partes <- c(nota_partes, "Se aplica un gradiente de color proporcional a la magnitud de la brecha.")
        }
      }

      nota_txt <- paste(nota_partes, collapse = " ")
      openxlsx::writeData(wb, hoja_tb, nota_txt, startRow = fila_excel, startCol = 1, colNames = FALSE)
      openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
      openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      openxlsx::setRowHeights(
        wb, hoja_tb, rows = fila_excel,
        heights = .calc_row_height(nota_txt, col_width = 60, font_size = 9, max_h = 80)
      )
      fila_excel <- fila_excel + 2L

      if (isTRUE(show_sig) && length(vars_cols_tb)) {
        sig_out <- data.frame(
          stats::setNames(list(as.character(ind_labels)), fila_lbl_t),
          stringsAsFactors = FALSE,
          check.names = FALSE
        )
        sig_h1 <- c("")
        sig_h2 <- c("")
        letras_map_text <- character(0)
        sig_k <- 0L

        if (length(idx_total_t)) {
          for (b in idx_total_t) {
            sig_k <- sig_k + 1L
            sig_out[[paste0("col_", sig_k)]] <- rep("", I_t)
            sig_h1 <- c(sig_h1, blocks_t[[b]]$top)
            sig_h2 <- c(sig_h2, blocks_t[[b]]$sub)
          }
        }

        for (s in vars_cols_tb) {
          s_chr <- as.character(s)[1]
          idx_cv <- which(vapply(blocks_t, function(bl) identical(bl$var_key, s_chr), logical(1)))
          if (!length(idx_cv)) next

          s_lbl <- .dim_label_limpio(label_variable(s_chr, dic_vars, labels_override, data))
          estr_lbl_s <- vapply(idx_cv, function(ix) as.character(blocks_t[[ix]]$sub %||% "")[1], character(1))
          col_letters <- LETTERS[seq_along(estr_lbl_s)]
          letras_map_text <- c(
            letras_map_text,
            paste0(s_lbl, ": ", paste0("(", col_letters, ") ", estr_lbl_s, collapse = " · "))
          )

          letras_mat <- matrix("", nrow = I_t, ncol = length(idx_cv))
          if (length(idx_cv) >= 2L) {
            for (i in seq_len(I_t)) {
              medias_mat <- matrix(medias_t[i, idx_cv, drop = FALSE], nrow = 1, ncol = length(idx_cv))
              ns_mat <- matrix(ns_t[i, idx_cv, drop = FALSE], nrow = 1, ncol = length(idx_cv))
              sds_mat <- matrix(sds_t[i, idx_cv, drop = FALSE], nrow = 1, ncol = length(idx_cv))
              rownames(medias_mat) <- ind_labels[i]
              rownames(ns_mat) <- ind_labels[i]
              rownames(sds_mat) <- ind_labels[i]
              colnames(medias_mat) <- estr_lbl_s
              colnames(ns_mat) <- estr_lbl_s
              colnames(sds_mat) <- estr_lbl_s
              cmp_i <- comparar_medias_sig(medias_mat, ns_mat, sds_mat, alpha = alpha)
              letras_mat[i, ] <- as.character(cmp_i$letras[1, ])
            }
          }

          for (j in seq_along(idx_cv)) {
            sig_k <- sig_k + 1L
            sig_out[[paste0("col_", sig_k)]] <- if (length(idx_cv) >= 2L) letras_mat[, j] else rep("", I_t)
            sig_h1 <- c(sig_h1, s_lbl)
            sig_h2 <- c(sig_h2, paste0(estr_lbl_s[j], " (", col_letters[j], ")"))
          }

          if (isTRUE(brecha_cols_tb) && length(idx_cv) >= 2L) {
            sig_k <- sig_k + 1L
            sig_out[[paste0("col_", sig_k)]] <- rep("", I_t)
            sig_h1 <- c(sig_h1, s_lbl)
            sig_h2 <- c(sig_h2, etiq_brecha_cols_tb)
          }
        }

        ncols_sig <- ncol(sig_out)
        ncols_pintar <- max(ncols_pintar, ncols_sig)
        txt_sig <- "Comparaciones de medias"
        openxlsx::writeData(wb, hoja_tb, txt_sig, startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_sig)
        openxlsx::addStyle(wb, hoja_tb, st$q_title, rows = fila_excel, cols = 1, gridExpand = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = fila_excel, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)
        fila_excel <- fila_excel + 1L

        sig_runs1 <- .merge_runs(sig_h1)
        openxlsx::writeData(wb, hoja_tb, t(sig_h1), startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::writeData(wb, hoja_tb, t(sig_h2), startRow = fila_excel + 1L, startCol = 1, colNames = FALSE)
        openxlsx::addStyle(wb, hoja_tb, st$header_A, rows = fila_excel:(fila_excel + 1L), cols = 1, gridExpand = TRUE, stack = TRUE)
        if (ncols_sig > 1L) {
          openxlsx::addStyle(wb, hoja_tb, st$header, rows = fila_excel:(fila_excel + 1L), cols = 2:ncols_sig, gridExpand = TRUE, stack = TRUE)
        }

        for (r in sig_runs1) {
          c1 <- max(2L, r[1])
          c2 <- r[2]
          if ((c2 - c1 + 1L) > 1L) {
            openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = c1:c2)
          }
        }

        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel,
          heights = .header_row_height(values = sig_h1, runs = sig_runs1, col_offset = 0L, font_size = 10, min_h = 18, max_h = 100)
        )
        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel + 1L,
          heights = .header_row_height(values = sig_h2, runs = NULL, col_offset = 0L, font_size = 10, min_h = 18, max_h = 100)
        )
        fila_excel <- fila_excel + 2L

        openxlsx::writeData(wb, hoja_tb, sig_out, startRow = fila_excel, startCol = 1, colNames = FALSE)
        sig_ini <- fila_excel
        sig_fin <- fila_excel + nrow(sig_out) - 1L
        openxlsx::addStyle(wb, hoja_tb, st$cell, rows = sig_ini:sig_fin, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = sig_fin, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)
        fila_excel <- sig_fin + 1L

        pie_sig <- paste0(
          "Las letras indican columnas cuya media es significativamente mayor que la media de la columna identificada con esa letra, ",
          "segun pruebas t de Welch con correccion de Bonferroni (alpha = ", alpha, "). ",
          "Letras por estrato: ", paste(letras_map_text, collapse = "  |  "), ". ",
          "Fuente: ", fuente
        )
        openxlsx::writeData(wb, hoja_tb, pie_sig, startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
        openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$footer_top, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel,
          heights = .calc_row_height(pie_sig, col_width = 60, font_size = 9, max_h = 180)
        )
        fila_excel <- fila_excel + 2L
      }

      if (espacio_despues_tb > 0L) {
        rows_esp_desp <- fila_excel:(fila_excel + espacio_despues_tb - 1L)
        openxlsx::addStyle(
          wb, hoja_tb, st_blanco,
          rows = rows_esp_desp,
          cols = 1:ncols_pintar,
          gridExpand = TRUE,
          stack = TRUE
        )
      }
      fila_excel <- fila_excel + espacio_despues_tb
      .set_sheet_row(hoja_tb, fila_excel)
      next
    }

    cats_f <- get_categorias(
      var              = fila_tb,
      data             = data,
      survey           = survey,
      orders_list      = orders_list,
      opciones_excluir = opciones_excluir
    )
    row_codes  <- cats_f$codes
    row_labels <- cats_f$labels
    v_fila <- as.character(data[[fila_tb]])
    row_keys <- .pick_cat_keys(v_fila, row_codes, row_labels)

    if (length(row_keys)) {
      row_masks <- lapply(row_keys, function(k) !is.na(v_fila) & v_fila == k)
      row_labels <- as.character(row_labels)
    } else {
      row_masks <- list(rep(FALSE, nrow(data)))
      row_labels <- "Sin datos"
    }

    blocks <- list()
    if (isTRUE(incluir_total_tb) || !length(cruzar_dim_tb)) {
      blocks[[length(blocks) + 1L]] <- list(
        top = "Promedio general",
        sub = "",
        legacy = "Promedio general",
        var_key = NA_character_,
        mask = rep(TRUE, nrow(data)),
        block_label = "Promedio general"
      )
    }

    for (s in cruzar_dim_tb) {
      cats_s <- get_categorias(
        var              = s,
        data             = data,
        survey           = survey,
        orders_list      = orders_list,
        opciones_excluir = opciones_excluir
      )
      estr_codes  <- cats_s$codes
      estr_labels <- cats_s$labels
      if (!length(estr_codes)) next

      s_lbl <- .dim_label_limpio(label_variable(s, dic_vars, labels_override, data))
      estr_labels <- .strip_prefijo_subindice(estr_labels, s_lbl)

      v_estr <- as.character(data[[s]])
      keys_s <- .pick_cat_keys(v_estr, estr_codes, estr_labels)
      if (!length(keys_s)) next

      for (j in seq_along(keys_s)) {
        cat_lbl <- as.character(estr_labels[j])
        head_lbl <- paste0(s_lbl, ": ", cat_lbl)
        blocks[[length(blocks) + 1L]] <- list(
          top = s_lbl,
          sub = cat_lbl,
          legacy = head_lbl,
          var_key = as.character(s)[1],
          mask = !is.na(v_estr) & v_estr == keys_s[j],
          block_label = head_lbl
        )
      }
    }

    if (!length(blocks)) {
      blocks[[1L]] <- list(
        top = "Promedio general",
        sub = "",
        legacy = "Promedio general",
        var_key = NA_character_,
        mask = rep(TRUE, nrow(data)),
        block_label = "Promedio general"
      )
    }

    R <- length(row_labels)
    I <- length(vars_sec)
    B <- length(blocks)

    medias <- array(NA_real_, dim = c(R, I, B))
    sds    <- array(NA_real_, dim = c(R, I, B))
    ns     <- array(NA_real_, dim = c(R, I, B))

    for (b in seq_len(B)) {
      mask_b <- as.logical(blocks[[b]]$mask)
      for (r in seq_len(R)) {
        mask_rb <- row_masks[[r]] & mask_b
        for (i in seq_len(I)) {
          st_i <- .dim_weighted_stats(x_cache[[i]], w, mask_rb)
          medias[r, i, b] <- st_i$mean
          sds[r, i, b] <- st_i$sd
          ns[r, i, b] <- st_i$n
        }
      }
    }

    out <- data.frame(
      stats::setNames(list(as.character(row_labels)), fila_lbl),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    row_brecha_idx_out <- NA_integer_
    row_total_idx_out <- NA_integer_

    h1 <- c("")
    h2 <- c(fila_hdr)
    col_k <- 0L
    is_brecha_col <- logical(0)

    idx_total <- which(vapply(blocks, function(bl) is.na(bl$var_key), logical(1)))

    .add_data_cols <- function(block_indices) {
      for (b in block_indices) {
        if (I == 1L) {
          col_k <<- col_k + 1L
          out[[paste0("col_", col_k)]] <<- ifelse(is.na(medias[, 1L, b]), NA_real_, round(medias[, 1L, b], digits))
          h1 <<- c(h1, blocks[[b]]$top)
          h2 <<- c(h2, blocks[[b]]$sub)
          is_brecha_col <<- c(is_brecha_col, FALSE)
        } else {
          for (i in seq_len(I)) {
            col_k <<- col_k + 1L
            out[[paste0("col_", col_k)]] <<- ifelse(is.na(medias[, i, b]), NA_real_, round(medias[, i, b], digits))
            h1 <<- c(h1, blocks[[b]]$legacy)
            h2 <<- c(h2, ind_labels[i])
            is_brecha_col <<- c(is_brecha_col, FALSE)
          }
        }
      }
    }

    .add_brecha_cols <- function(idx_cv) {
      if (!isTRUE(brecha_cols_tb) || length(idx_cv) < 2L) return(invisible(NULL))
      idx_bc <- c(idx_total, idx_cv)
      if (length(idx_bc) < 2L) return(invisible(NULL))
      cv_top <- blocks[[idx_cv[1]]]$top
      if (I == 1L) {
        col_k <<- col_k + 1L
        vals_bc <- rep(NA_real_, R)
        for (r in seq_len(R)) {
          vv <- medias[r, 1L, idx_bc]
          vv <- vv[is.finite(vv) & !is.na(vv)]
          vals_bc[r] <- if (length(vv) >= 2L) round(max(vv) - min(vv), digits) else NA_real_
        }
        out[[paste0("col_", col_k)]] <<- vals_bc
        h1 <<- c(h1, cv_top)
        h2 <<- c(h2, etiq_brecha_cols_tb)
        is_brecha_col <<- c(is_brecha_col, TRUE)
      } else {
        for (i in seq_len(I)) {
          col_k <<- col_k + 1L
          vals_bc <- rep(NA_real_, R)
          for (r in seq_len(R)) {
            vv <- medias[r, i, idx_bc]
            vv <- vv[is.finite(vv) & !is.na(vv)]
            vals_bc[r] <- if (length(vv) >= 2L) round(max(vv) - min(vv), digits) else NA_real_
          }
          out[[paste0("col_", col_k)]] <<- vals_bc
          h1 <<- c(h1, paste0(cv_top, ": ", etiq_brecha_cols_tb))
          h2 <<- c(h2, ind_labels[i])
          is_brecha_col <<- c(is_brecha_col, TRUE)
        }
      }
    }

    .add_data_cols(idx_total)
    for (s in cruzar_dim_tb) {
      s_chr <- as.character(s)[1]
      idx_cv <- which(vapply(blocks, function(bl) identical(bl$var_key, s_chr), logical(1)))
      if (!length(idx_cv)) next
      .add_data_cols(idx_cv)
      .add_brecha_cols(idx_cv)
    }

    if (isTRUE(incluir_total_tb)) {
      row_total <- list("Promedio general")
      for (b in idx_total) {
        mask_b <- as.logical(blocks[[b]]$mask)
        for (i in seq_len(I)) {
          st_i <- .dim_weighted_stats(x_cache[[i]], w, mask_b)
          row_total[[length(row_total) + 1L]] <- if (is.na(st_i$mean)) NA_real_ else round(st_i$mean, digits)
        }
      }
      for (s in cruzar_dim_tb) {
        s_chr <- as.character(s)[1]
        idx_cv <- which(vapply(blocks, function(bl) identical(bl$var_key, s_chr), logical(1)))
        if (!length(idx_cv)) next
        for (b in idx_cv) {
          mask_b <- as.logical(blocks[[b]]$mask)
          for (i in seq_len(I)) {
            st_i <- .dim_weighted_stats(x_cache[[i]], w, mask_b)
            row_total[[length(row_total) + 1L]] <- if (is.na(st_i$mean)) NA_real_ else round(st_i$mean, digits)
          }
        }
        if (isTRUE(brecha_cols_tb) && length(idx_cv) >= 2L) {
          idx_bc <- c(idx_total, idx_cv)
          for (i in seq_len(I)) {
            mask_all <- lapply(idx_bc, function(bb) as.logical(blocks[[bb]]$mask))
            vv_total <- vapply(mask_all, function(m) {
              st_ti <- .dim_weighted_stats(x_cache[[i]], w, m)
              st_ti$mean
            }, numeric(1))
            vv_total <- vv_total[is.finite(vv_total) & !is.na(vv_total)]
            row_total[[length(row_total) + 1L]] <- if (length(vv_total) >= 2L) round(max(vv_total) - min(vv_total), digits) else NA_real_
          }
        }
      }
      total_df <- as.data.frame(row_total, stringsAsFactors = FALSE, check.names = FALSE)
      names(total_df) <- names(out)
      for (jj in seq.int(2, ncol(total_df))) {
        total_df[[jj]] <- suppressWarnings(as.numeric(total_df[[jj]]))
      }
      out <- dplyr::bind_rows(out, total_df)
      row_total_idx_out <- nrow(out)
    }

    if (isTRUE(brecha_filas_tb) && R >= 2) {
      row_bf <- list(etiq_brecha_filas_tb)
      for (b in idx_total) {
        for (i in seq_len(I)) {
          vv <- medias[, i, b]
          vv <- vv[is.finite(vv) & !is.na(vv)]
          row_bf[[length(row_bf) + 1L]] <- if (!length(vv)) NA_real_ else round(max(vv) - min(vv), digits)
        }
      }
      for (s in cruzar_dim_tb) {
        s_chr <- as.character(s)[1]
        idx_cv <- which(vapply(blocks, function(bl) identical(bl$var_key, s_chr), logical(1)))
        if (!length(idx_cv)) next
        for (b in idx_cv) {
          for (i in seq_len(I)) {
            vv <- medias[, i, b]
            vv <- vv[is.finite(vv) & !is.na(vv)]
            row_bf[[length(row_bf) + 1L]] <- if (!length(vv)) NA_real_ else round(max(vv) - min(vv), digits)
          }
        }
        if (isTRUE(brecha_cols_tb) && length(idx_cv) >= 2L) {
          for (i in seq_len(I)) row_bf[[length(row_bf) + 1L]] <- NA_real_
        }
      }
      row_b_df <- as.data.frame(row_bf, stringsAsFactors = FALSE, check.names = FALSE)
      names(row_b_df) <- names(out)
      out <- dplyr::bind_rows(out, row_b_df)
      for (jj in seq.int(2, ncol(out))) {
        out[[jj]] <- suppressWarnings(as.numeric(out[[jj]]))
      }
      row_brecha_idx_out <- nrow(out)
    }

    brecha_col_df_indices <- which(is_brecha_col)

    ncols_tbl <- ncol(out)
    ncols_pintar <- max(6L, ncols_tbl)

    if (espacio_antes_tb > 0L) {
      rows_esp_antes <- fila_antes_inicio:(fila_antes_inicio + espacio_antes_tb - 1L)
      openxlsx::addStyle(
        wb, hoja_tb, st_blanco,
        rows = rows_esp_antes,
        cols = 1:ncols_pintar,
        gridExpand = TRUE,
        stack = TRUE
      )
    }

    sec_txt <- if (!is.na(sec) && nzchar(trimws(sec))) as.character(sec) else "SECCION"
    openxlsx::writeData(wb, hoja_tb, sec_txt, startRow = fila_excel, startCol = 1, colNames = FALSE)
    openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
    openxlsx::addStyle(wb, hoja_tb, st$q_title, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    fila_excel <- fila_excel + 1L

    openxlsx::writeData(wb, hoja_tb, t(h1), startRow = fila_excel, startCol = 1, colNames = FALSE)
    openxlsx::writeData(wb, hoja_tb, t(h2), startRow = fila_excel + 1L, startCol = 1, colNames = FALSE)

    openxlsx::addStyle(wb, hoja_tb, st$header_A, rows = fila_excel:(fila_excel + 1L), cols = 1, gridExpand = TRUE, stack = TRUE)
    if (ncols_tbl > 1L) {
      openxlsx::addStyle(
        wb, hoja_tb, st$header,
        rows = fila_excel:(fila_excel + 1L),
        cols = 2:ncols_tbl,
        gridExpand = TRUE,
        stack = TRUE
      )
    }

    runs1 <- .merge_runs(h1)
    for (r in runs1) {
      c1 <- max(2L, r[1])
      c2 <- r[2]
      if ((c2 - c1 + 1L) > 1L) {
        openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = c1:c2)
      }
    }

    openxlsx::setRowHeights(
      wb, hoja_tb, rows = fila_excel,
      heights = .header_row_height(
        values = h1,
        runs = runs1,
        col_offset = 0L,
        font_size = 10,
        min_h = 18,
        max_h = 100
      )
    )
    openxlsx::setRowHeights(
      wb, hoja_tb, rows = fila_excel + 1L,
      heights = .header_row_height(
        values = h2,
        runs = NULL,
        col_offset = 0L,
        font_size = 10,
        min_h = 18,
        max_h = 100
      )
    )

    fila_excel <- fila_excel + 2L

    openxlsx::writeData(wb, hoja_tb, out, startRow = fila_excel, startCol = 1, colNames = FALSE)
    row_ini <- fila_excel
    row_fin <- fila_excel + nrow(out) - 1L

    openxlsx::addStyle(wb, hoja_tb, st$body_txt, rows = row_ini:row_fin, cols = 1, gridExpand = TRUE, stack = TRUE)
    if (ncols_tbl > 1L) {
      openxlsx::addStyle(wb, hoja_tb, st_blanco, rows = row_ini:row_fin, cols = 2:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_tb, style_num_dim, rows = row_ini:row_fin, cols = 2:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      if (isTRUE(aplicar_semaforo)) {
        val_mat <- as.matrix(out[, 2:ncols_tbl, drop = FALSE])
        idx_eval <- seq_len(nrow(val_mat))
        if (!is.na(row_brecha_idx_out) && row_brecha_idx_out %in% idx_eval) {
          idx_eval <- setdiff(idx_eval, row_brecha_idx_out)
        }
        exclude_rows_by_col <- vector("list", ncol(val_mat))
        if (
          isTRUE(aplicar_gradiente_brecha) &&
          length(brecha_col_df_indices) &&
          !is.na(row_total_idx_out) &&
          row_total_idx_out %in% idx_eval
        ) {
          for (cc in brecha_col_df_indices) {
            if (cc >= 1L && cc <= length(exclude_rows_by_col)) {
              exclude_rows_by_col[[cc]] <- row_total_idx_out
            }
          }
        }
        .apply_semaforo_excel(
          val_mat,
          row_ini = row_ini,
          hoja_tb = hoja_tb,
          idx_eval = idx_eval,
          exclude_rows_by_col = exclude_rows_by_col
        )
      }
    }

    if (length(brecha_col_df_indices)) {
      bc_excel_cols <- brecha_col_df_indices + 1L
      st_bold <- openxlsx::createStyle(textDecoration = "Bold")
      data_rows <- row_ini:(row_ini + nrow(out) - 1L)
      openxlsx::addStyle(wb, hoja_tb, st_bold, rows = data_rows, cols = bc_excel_cols, gridExpand = TRUE, stack = TRUE)
    }
    .register_sheet_cols(
      hoja_tb,
      used_cols = seq_len(ncols_tbl),
      brecha_cols = if (length(brecha_col_df_indices)) brecha_col_df_indices + 1L else integer(0),
      first_col_texts = c(sec_txt, row_labels, "Promedio general", etiq_brecha_filas_tb)
    )

    if (isTRUE(incluir_total_tb) && nrow(out) > R) {
      row_total_excel <- row_ini + R
      openxlsx::addStyle(wb, hoja_tb, st$total_bold, rows = row_total_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      st_total_border <- openxlsx::createStyle(border = "Top", borderStyle = "thin")
      openxlsx::addStyle(wb, hoja_tb, st_total_border, rows = row_total_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    }
    if (isTRUE(brecha_filas_tb) && nrow(out) > R + as.integer(isTRUE(incluir_total_tb))) {
      row_brecha_excel <- row_fin
      openxlsx::addStyle(wb, hoja_tb, st$total_bold, rows = row_brecha_excel, cols = 1, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja_tb, st$footer_top, rows = row_brecha_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
      if (isTRUE(aplicar_gradiente_brecha) && !is.na(row_brecha_idx_out) && ncols_tbl > 1L) {
        vals_b <- suppressWarnings(as.numeric(as.matrix(out[row_brecha_idx_out, 2:ncols_tbl, drop = FALSE])[1, ]))
        idx_ok_b <- which(is.finite(vals_b) & !is.na(vals_b))
        if (length(idx_ok_b)) {
          style_cache <- new.env(parent = emptyenv())
          for (jj in idx_ok_b) {
            tt <- if (isTRUE(brecha_corte_max > brecha_corte_min)) {
              pmax(0, pmin(1, (vals_b[jj] - brecha_corte_min) / (brecha_corte_max - brecha_corte_min)))
            } else 0.5
            col_j <- .mix_color(col_brecha_bajo, col_brecha_alto, tt)
            if (!exists(col_j, envir = style_cache, inherits = FALSE)) {
              assign(col_j, openxlsx::createStyle(fgFill = col_j, fontName = "Arial"), envir = style_cache)
            }
            st_j <- get(col_j, envir = style_cache, inherits = FALSE)
            openxlsx::addStyle(wb, hoja_tb, st_j, rows = row_brecha_excel, cols = jj + 1L, gridExpand = TRUE, stack = TRUE)
          }
        }
      }
    }

    if (length(brecha_col_df_indices) && isTRUE(aplicar_gradiente_brecha)) {
      bc_excel_cols <- brecha_col_df_indices + 1L
      style_cache_bc <- new.env(parent = emptyenv())
      rows_gradiente_bc <- seq_len(R)
      if (!is.na(row_total_idx_out) && row_total_idx_out >= 1L && row_total_idx_out <= nrow(out)) {
        rows_gradiente_bc <- c(rows_gradiente_bc, row_total_idx_out)
      }
      rows_gradiente_bc <- unique(rows_gradiente_bc)
      for (rr in rows_gradiente_bc) {
        row_excel_rr <- row_ini + rr - 1L
        for (jj in seq_along(brecha_col_df_indices)) {
          val_bc <- suppressWarnings(as.numeric(out[rr, brecha_col_df_indices[jj] + 1L]))
          if (!is.finite(val_bc) || is.na(val_bc)) next
          tt <- if (isTRUE(brecha_corte_max > brecha_corte_min)) {
            pmax(0, pmin(1, (val_bc - brecha_corte_min) / (brecha_corte_max - brecha_corte_min)))
          } else 0.5
          col_j <- .mix_color(col_brecha_bajo, col_brecha_alto, tt)
          if (!exists(col_j, envir = style_cache_bc, inherits = FALSE)) {
            assign(col_j, openxlsx::createStyle(fgFill = col_j, fontName = "Arial"), envir = style_cache_bc)
          }
          st_j <- get(col_j, envir = style_cache_bc, inherits = FALSE)
          openxlsx::addStyle(wb, hoja_tb, st_j, rows = row_excel_rr, cols = bc_excel_cols[jj], gridExpand = TRUE, stack = TRUE)
        }
      }
    }

    openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = row_fin, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)

    fila_excel <- row_fin + 1L

    openxlsx::writeData(wb, hoja_tb, footer_source, startRow = fila_excel, startCol = 1, colNames = FALSE)
    openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
    openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, hoja_tb, st$footer_top, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    openxlsx::setRowHeights(
      wb, hoja_tb, rows = fila_excel,
      heights = .calc_row_height(footer_source, col_width = 60, font_size = 9, max_h = 220)
    )
    fila_excel <- fila_excel + 1L

    nota_partes <- c(
      "Nota metodologica: Los valores representan promedios ponderados en escala de 0 a 100."
    )
    if (isTRUE(aplicar_semaforo)) {
      c1 <- semaforo_cortes[1]
      c2 <- semaforo_cortes[2]
      nota_partes <- c(
        nota_partes,
        paste0(
          "Se emplea un semaforo de colores (rojo < ", c1,
          ", amarillo ", c1, "-", c2, ", verde > ", c2, ")."
        )
      )
    }
    hay_brecha <- isTRUE(brecha_filas_tb) || length(brecha_col_df_indices)
    if (hay_brecha) {
      nota_partes <- c(
        nota_partes,
        "La brecha corresponde a la diferencia entre el promedio maximo y minimo del grupo respectivo."
      )
      if (isTRUE(aplicar_gradiente_brecha)) {
        nota_partes <- c(nota_partes, "Se aplica un gradiente de color proporcional a la magnitud de la brecha.")
      }
    }
    
    nota_txt <- paste(nota_partes, collapse = " ")
    openxlsx::writeData(wb, hoja_tb, nota_txt, startRow = fila_excel, startCol = 1, colNames = FALSE)
    openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
    openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
    openxlsx::setRowHeights(
      wb, hoja_tb, rows = fila_excel,
      heights = .calc_row_height(nota_txt, col_width = 60, font_size = 9, max_h = 80)
    )
    fila_excel <- fila_excel + 2L

    if (isTRUE(show_sig) && B >= 2L && R >= 1L) {
      idx_by_var <- list()
      cmp_by_var <- list()
      letras_map_text <- character(0)

      for (s in cruzar_dim_tb) {
        s_chr <- as.character(s)[1]
        idx_s <- which(vapply(blocks, function(bl) {
          identical(as.character(bl$var_key %||% "")[1], s_chr)
        }, FUN.VALUE = logical(1)))
        if (length(idx_s) < 2L) next

        s_lbl <- .dim_label_limpio(label_variable(s_chr, dic_vars, labels_override, data))
        estr_lbl_s <- vapply(idx_s, function(ix) {
          as.character(blocks[[ix]]$sub %||% "")[1]
        }, FUN.VALUE = character(1))
        col_letters <- LETTERS[seq_along(estr_lbl_s)]
        letras_map_text <- c(
          letras_map_text,
          paste0(
            s_lbl, ": ",
            paste0("(", col_letters, ") ", estr_lbl_s, collapse = " \u00b7 ")
          )
        )

        cmp_s <- vector("list", I)
        for (i in seq_len(I)) {
          medias_mat <- matrix(medias[, i, idx_s, drop = FALSE], nrow = R, ncol = length(idx_s))
          ns_mat <- matrix(ns[, i, idx_s, drop = FALSE], nrow = R, ncol = length(idx_s))
          sds_mat <- matrix(sds[, i, idx_s, drop = FALSE], nrow = R, ncol = length(idx_s))
          rownames(medias_mat) <- as.character(row_labels)
          rownames(ns_mat) <- as.character(row_labels)
          rownames(sds_mat) <- as.character(row_labels)
          colnames(medias_mat) <- estr_lbl_s
          colnames(ns_mat) <- estr_lbl_s
          colnames(sds_mat) <- estr_lbl_s
          cmp_s[[i]] <- comparar_medias_sig(medias_mat, ns_mat, sds_mat, alpha = alpha)
        }
        idx_by_var[[s_chr]] <- idx_s
        cmp_by_var[[s_chr]] <- cmp_s
      }

      if (length(cmp_by_var)) {
        sig_out <- data.frame(
          stats::setNames(list(as.character(row_labels)), fila_lbl),
          stringsAsFactors = FALSE,
          check.names = FALSE
        )
        sig_h1 <- c("")
        sig_h2 <- c(fila_hdr)

        sig_k <- 0L
        for (b in idx_total) {
          if (I == 1L) {
            sig_k <- sig_k + 1L
            sig_out[[paste0("col_", sig_k)]] <- rep("", R)
            sig_h1 <- c(sig_h1, blocks[[b]]$top)
            sig_h2 <- c(sig_h2, blocks[[b]]$sub)
          } else {
            for (i in seq_len(I)) {
              sig_k <- sig_k + 1L
              sig_out[[paste0("col_", sig_k)]] <- rep("", R)
              sig_h1 <- c(sig_h1, blocks[[b]]$legacy)
              sig_h2 <- c(sig_h2, ind_labels[i])
            }
          }
        }
        for (s in cruzar_dim_tb) {
          s_chr <- as.character(s)[1]
          idx_cv <- which(vapply(blocks, function(bl) identical(bl$var_key, s_chr), logical(1)))
          if (!length(idx_cv)) next
          estr_lbl_s <- vapply(idx_cv, function(ix) as.character(blocks[[ix]]$sub %||% "")[1], character(1))
          col_letters <- LETTERS[seq_along(estr_lbl_s)]
          has_cmp <- !is.null(cmp_by_var[[s_chr]])
          for (j in seq_along(idx_cv)) {
            b <- idx_cv[j]
            pos <- if (has_cmp) match(b, idx_by_var[[s_chr]]) else NA_integer_
            if (I == 1L) {
              sig_k <- sig_k + 1L
              if (is.na(pos) || !has_cmp) {
                sig_out[[paste0("col_", sig_k)]] <- rep("", R)
              } else {
                sig_out[[paste0("col_", sig_k)]] <- as.character(cmp_by_var[[s_chr]][[1L]]$letras[, pos])
              }
              sig_h1 <- c(sig_h1, blocks[[b]]$top)
              sig_h2 <- c(sig_h2, paste0(estr_lbl_s[j], " (", col_letters[j], ")"))
            } else {
              for (i in seq_len(I)) {
                sig_k <- sig_k + 1L
                if (is.na(pos) || !has_cmp) {
                  sig_out[[paste0("col_", sig_k)]] <- rep("", R)
                } else {
                  sig_out[[paste0("col_", sig_k)]] <- as.character(cmp_by_var[[s_chr]][[i]]$letras[, pos])
                }
                sig_h1 <- c(sig_h1, blocks[[b]]$legacy)
                sig_h2 <- c(sig_h2, paste0(ind_labels[i], " (", col_letters[j], ")"))
              }
            }
          }
        }

        ncols_sig <- ncol(sig_out)
        ncols_pintar <- max(ncols_pintar, ncols_sig)
        txt_sig <- "Comparaciones de medias"
        openxlsx::writeData(wb, hoja_tb, txt_sig, startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_sig)
        openxlsx::addStyle(wb, hoja_tb, st$q_title, rows = fila_excel, cols = 1, gridExpand = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = fila_excel, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)
        fila_excel <- fila_excel + 1L

        sig_runs1 <- .merge_runs(sig_h1)
        openxlsx::writeData(wb, hoja_tb, t(sig_h1), startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::writeData(wb, hoja_tb, t(sig_h2), startRow = fila_excel + 1L, startCol = 1, colNames = FALSE)
        openxlsx::addStyle(wb, hoja_tb, st$header_A, rows = fila_excel:(fila_excel + 1L), cols = 1, gridExpand = TRUE, stack = TRUE)
        if (ncols_sig > 1L) {
          openxlsx::addStyle(wb, hoja_tb, st$header, rows = fila_excel:(fila_excel + 1L), cols = 2:ncols_sig, gridExpand = TRUE, stack = TRUE)
        }

        for (r in sig_runs1) {
          c1 <- max(2L, r[1])
          c2 <- r[2]
          if ((c2 - c1 + 1L) > 1L) {
            openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = c1:c2)
          }
        }

        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel,
          heights = .header_row_height(
            values = sig_h1,
            runs = sig_runs1,
            col_offset = 0L,
            font_size = 10,
            min_h = 18,
            max_h = 100
          )
        )
        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel + 1L,
          heights = .header_row_height(
            values = sig_h2,
            runs = NULL,
            col_offset = 0L,
            font_size = 10,
            min_h = 18,
            max_h = 100
          )
        )
        fila_excel <- fila_excel + 2L

        openxlsx::writeData(wb, hoja_tb, sig_out, startRow = fila_excel, startCol = 1, colNames = FALSE)
        sig_ini <- fila_excel
        sig_fin <- fila_excel + nrow(sig_out) - 1L

        openxlsx::addStyle(wb, hoja_tb, st$cell, rows = sig_ini:sig_fin, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$table_end, rows = sig_fin, cols = 1:ncols_sig, gridExpand = TRUE, stack = TRUE)

        fila_excel <- sig_fin + 1L

        pie_sig <- paste0(
          "Las letras indican columnas cuya media es significativamente mayor que la media de la columna identificada con esa letra, ",
          "segun pruebas t de Welch con correccion de Bonferroni (alpha = ", alpha, "). ",
          "Letras por estrato: ", paste(letras_map_text, collapse = "  |  "), ". ",
          "Fuente: ", fuente
        )
        openxlsx::writeData(wb, hoja_tb, pie_sig, startRow = fila_excel, startCol = 1, colNames = FALSE)
        openxlsx::mergeCells(wb, hoja_tb, rows = fila_excel, cols = 1:ncols_tbl)
        openxlsx::addStyle(wb, hoja_tb, st$note, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja_tb, st$footer_top, rows = fila_excel, cols = 1:ncols_tbl, gridExpand = TRUE, stack = TRUE)
        openxlsx::setRowHeights(
          wb, hoja_tb, rows = fila_excel,
          heights = .calc_row_height(pie_sig, col_width = 60, font_size = 9, max_h = 180)
        )
        fila_excel <- fila_excel + 2L
      }
    }

    if (espacio_despues_tb > 0L) {
      rows_esp_desp <- fila_excel:(fila_excel + espacio_despues_tb - 1L)
      openxlsx::addStyle(
        wb, hoja_tb, st_blanco,
        rows = rows_esp_desp,
        cols = 1:ncols_pintar,
        gridExpand = TRUE,
        stack = TRUE
      )
    }
    fila_excel <- fila_excel + espacio_despues_tb
    .set_sheet_row(hoja_tb, fila_excel)
  }

  if (length(sheet_rows)) {
    for (sn in names(sheet_rows)) {
      used_cols_sn <- sort(unique(sheet_used_cols[[sn]] %||% 1:6))
      brecha_cols_sn <- sort(unique(sheet_brecha_cols[[sn]] %||% integer(0)))
      regular_cols_sn <- setdiff(used_cols_sn, c(1L, brecha_cols_sn))
      first_col_chars_sn <- sheet_first_col_chars[[sn]] %||% integer(0)
      first_col_width_sn <- if (length(first_col_chars_sn)) {
        pmin(42, pmax(18, ceiling(max(first_col_chars_sn, na.rm = TRUE) * 0.95) + 2L))
      } else 24
      openxlsx::setColWidths(wb, sn, cols = 1, widths = first_col_width_sn)
      if (length(regular_cols_sn)) {
        openxlsx::setColWidths(wb, sn, cols = regular_cols_sn, widths = 15)
      }
      if (length(brecha_cols_sn)) {
        openxlsx::setColWidths(wb, sn, cols = brecha_cols_sn, widths = 10)
      }
    }
  }

  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  message("Cruces (modo dimensiones) exportados a: ", normalizePath(path_xlsx))
  invisible(path_xlsx)
}

# =============================================================================
# reporte_cruces()
# =============================================================================

#' Generar reporte de cruces en Excel (estandar o dimensiones)
#'
#' Funcion de alto nivel que enruta a:
#' \itemize{
#'   \item \code{exportar_cruces_multi()} cuando \code{modo = "estandar"}.
#'   \item \code{exportar_dimensiones_multi()} cuando \code{modo = "dimensiones"}.
#' }
#'
#' En modo \code{"dimensiones"}:
#' \itemize{
#'   \item \code{SECCIONES} debe contener indicadores numericos (tipicamente
#'   \code{r100_}, \code{sub_}, \code{idx_}).
#'   \item Se crea una hoja inicial \code{"Metodologia"} con el detalle tecnico
#'   de construccion de indicadores y escalas.
#'   \item Si no se usa \code{tablas}, \code{cruces} debe tener exactamente una
#'   variable, usada como filas.
#'   \item \code{cruzar_dim} define cruces adicionales para subindices de columnas.
#' }
#'
#' @param data Data frame ya adaptado por \code{reporte_data()}.
#' @param instrumento Objeto de \code{reporte_instrumento()} con \code{$survey}
#'   y opcionalmente \code{$orders_list}.
#' @param SECCIONES Lista nombrada de variables a reportar.
#' @param cruces Variables de cruce. En modo \code{"dimensiones"}, si no se
#'   usa \code{tablas}, debe ser un vector de longitud 1 (variable de fila).
#' @param modo Modo de exportacion: \code{"estandar"} o \code{"dimensiones"}.
#' @param path_xlsx Ruta del archivo \code{.xlsx} de salida.
#' @param hoja Nombre de la hoja de salida.
#' @param fuente Texto de fuente al pie de tabla.
#' @param labels_override Lista nombrada opcional de etiquetas por variable.
#' @param sm_vars_force Solo modo \code{"estandar"}: variables a forzar como
#'   \emph{select_multiple}.
#' @param weight_col Variable de pesos.
#' @param opciones_excluir Categorias a excluir en cruces.
#' @param show_sig Si \code{TRUE}, agrega tablas de significancia.
#' @param alpha Nivel de significancia.
#' @param codigos_solo_si_presentes Solo modo \code{"estandar"}.
#' @param numericas Solo modo \code{"estandar"}.
#' @param digits Decimales para resultados numericos.
#' @param cruzar_dim Solo modo \code{"dimensiones"}: variables adicionales para
#'   subindices de columnas.
#' @param filas_dimensiones Solo modo \code{"dimensiones"}: variable de filas.
#'   Si se especifica, tiene prioridad sobre \code{cruces}.
#' @param incluir_total Solo modo \code{"dimensiones"}: agrega fila Total.
#' @param brecha_filas Solo modo \code{"dimensiones"}: agrega fila Brecha (max - min entre filas).
#' @param etiq_brecha_filas Solo modo \code{"dimensiones"}: texto de la fila Brecha.
#' @param brecha_cols Solo modo \code{"dimensiones"}: agrega columnas de Brecha
#'   (max - min entre columnas de cada variable de cruce, sin Total).
#' @param etiq_brecha_cols Solo modo \code{"dimensiones"}: texto del header de
#'   las columnas de Brecha.
#' @param aplicar_semaforo Solo modo \code{"dimensiones"}: aplica formato
#'   condicional rojo-amarillo-verde en celdas numericas.
#' @param semaforo_cortes Solo modo \code{"dimensiones"}: vector numerico de
#'   dos cortes para semaforo (por defecto \code{c(50, 75)}).
#' @param semaforo_modo Solo modo \code{"dimensiones"}: `"grupos"`,
#'   `"degradado_automatico"` o `"degradado_manual"`. `"degradado"` se mantiene
#'   como alias de compatibilidad hacia `"degradado_automatico"`.
#' @param semaforo_anclas_degradado Solo modo \code{"dimensiones"}: anclas del
#'   degradado automatico.
#' @param semaforo_gradiente_segmentos Solo modo \code{"dimensiones"}: numero
#'   de segmentos internos del gradiente automatico.
#' @param semaforo_gradiente_colores Solo modo \code{"dimensiones"}: colores
#'   ancla del gradiente manual.
#' @param semaforo_gradiente_valores Solo modo \code{"dimensiones"}: valores
#'   ancla del gradiente manual.
#' @param semaforo_gradiente_limites Solo modo \code{"dimensiones"}: limites
#'   del gradiente manual.
#' @param semaforo_colores Solo modo \code{"dimensiones"}: vector nombrado con
#'   colores para \code{rojo}, \code{amarillo} y \code{verde}.
#' @param aplicar_gradiente_brecha Solo modo \code{"dimensiones"}: si
#'   \code{TRUE}, colorea la fila Brecha con gradiente.
#' @param brecha_colores Solo modo \code{"dimensiones"}: vector nombrado con
#'   colores para \code{bajo} y \code{alto} en la fila Brecha.
#' @param brecha_cortes Solo modo \code{"dimensiones"}: vector de dos valores
#'   que definen el rango del gradiente de brecha. Valores por debajo del primer
#'   corte no reciben color; valores por encima del segundo reciben el color
#'   maximo. Por defecto \code{c(0, 30)}.
#' @param tablas Solo modo \code{"dimensiones"}: lista opcional de tablas para
#'   exportar multiples planos en un solo archivo. Cada elemento puede definir
#'   \code{titulo}, \code{indicadores}, \code{fila}, \code{cruzar_dim}
#'   (o \code{cruzar_con}), \code{hoja}, \code{incluir_total},
#'   \code{brecha_filas}, \code{brecha_cols}, \code{espacio_antes},
#'   \code{espacio_despues}, \code{etiq_brecha_filas} y \code{etiq_brecha_cols}.
#'
#' @return Invisiblemente, la ruta del archivo de salida.
#'
#' @seealso \code{\link{reporte_instrumento}},
#'   \code{\link{reporte_data}},
#'   \code{\link{exportar_cruces_multi}}
#'
#' @family reporte
#' @export
reporte_cruces <- function(
    data,
    instrumento,
    SECCIONES,
    cruces,
    modo             = c("estandar", "dimensiones"),
    path_xlsx        = "cruces_multi.xlsx",
    hoja             = "Cruces",
    fuente           = "Pulso PUCP",
    titulo_metodologia = "Como leer estas tablas",
    estilo_metodologia = c("tecnico", "editorial"),
    labels_override  = NULL,
    sm_vars_force    = NULL,
    weight_col       = "peso",
    opciones_excluir = NULL,
    show_sig         = TRUE,
    alpha            = 0.05,
    codigos_solo_si_presentes = NULL,
    numericas        = NULL,
    digits           = 1,
    cruzar_dim       = NULL,
    filas_dimensiones = NULL,
    incluir_total    = TRUE,
    brecha_filas     = FALSE,
    etiq_brecha_filas = "Brecha",
    brecha_cols      = FALSE,
    etiq_brecha_cols = "Brecha",
    aplicar_semaforo = TRUE,
    semaforo_cortes  = c(50, 75),
    semaforo_modo    = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    semaforo_anclas_degradado = NULL,
    semaforo_gradiente_segmentos = 20L,
    semaforo_gradiente_colores = NULL,
    semaforo_gradiente_valores = NULL,
    semaforo_gradiente_limites = NULL,
    semaforo_colores = c(
      rojo = "#F8D7DA",
      amarillo = "#FFF3CD",
      verde = "#D4EDDA"
    ),
    aplicar_gradiente_brecha = TRUE,
    brecha_colores = c(
      bajo = "#FFFFFF",
      alto = "#F4B183"
    ),
    brecha_cortes = c(0, 30),
    tablas           = NULL
) {
  modo <- match.arg(modo)
  estilo_metodologia <- match.arg(estilo_metodologia)
  semaforo_modo <- .dim_normalize_semaforo_modo(semaforo_modo)
  semaforo_anclas_degradado <- .dim_normalize_degradado_anclas(
    semaforo_anclas_degradado,
    semaforo_cortes,
    default = c(rojo = 0, verde = 100)
  )
  semaforo_gradiente_segmentos <- .dim_normalize_gradiente_segmentos(
    semaforo_gradiente_segmentos,
    default = 20L
  )
  semaforo_gradiente_manual <- NULL
  if (identical(semaforo_modo, "degradado_manual")) {
    semaforo_gradiente_manual <- .dim_normalize_gradiente_manual(
      colores = semaforo_gradiente_colores,
      valores = semaforo_gradiente_valores,
      limites = semaforo_gradiente_limites
    )
  }

  survey <- NULL
  if (!is.null(instrumento) && "survey" %in% names(instrumento)) {
    survey <- instrumento$survey
  }

  orders_list <- NULL
  if (!is.null(instrumento) && "orders_list" %in% names(instrumento)) {
    orders_list <- instrumento$orders_list
  }

  dic_vars <- NULL
  if (!is.null(survey) && all(c("name", "label") %in% names(survey))) {
    dic_vars <- dplyr::select(survey, name, label)
    dic_vars <- dplyr::filter(dic_vars, !is.na(name) & name != "")
  }

  if (identical(modo, "dimensiones")) {
    fila_dim <- if (!is.null(filas_dimensiones)) filas_dimensiones else cruces
    fila_dim <- as.character(fila_dim)
    fila_dim <- fila_dim[!is.na(fila_dim) & nzchar(trimws(fila_dim))]

    if (is.null(tablas)) {
      if (length(fila_dim) != 1L) {
        stop(
          "En `modo = \"dimensiones\"`, debe definir exactamente una variable de fila en `cruces` o `filas_dimensiones`.",
          call. = FALSE
        )
      }
      fila_dim <- fila_dim[1]
    } else if (length(fila_dim) > 1L) {
      stop(
        "Si usa `filas_dimensiones`, debe contener solo una variable.",
        call. = FALSE
      )
    }

    return(
      exportar_dimensiones_multi(
        data             = data,
        dic_vars         = dic_vars,
        SECCIONES        = SECCIONES,
        fila             = fila_dim,
        cruzar_dim       = cruzar_dim,
        incluir_total    = incluir_total,
        brecha_filas     = brecha_filas,
        etiq_brecha_filas = etiq_brecha_filas,
        brecha_cols      = brecha_cols,
        etiq_brecha_cols = etiq_brecha_cols,
        tablas           = tablas,
        labels_override  = labels_override,
        path_xlsx        = path_xlsx,
        hoja             = hoja,
        fuente           = fuente,
        titulo_metodologia = titulo_metodologia,
        estilo_metodologia = estilo_metodologia,
        survey           = survey,
        orders_list      = orders_list,
        weight_col       = weight_col,
        opciones_excluir = opciones_excluir,
        show_sig         = show_sig,
        alpha            = alpha,
        digits           = digits,
        aplicar_semaforo = aplicar_semaforo,
        semaforo_cortes  = semaforo_cortes,
        semaforo_modo    = semaforo_modo,
        semaforo_anclas_degradado = semaforo_anclas_degradado,
        semaforo_gradiente_segmentos = semaforo_gradiente_segmentos,
        semaforo_gradiente_colores = semaforo_gradiente_manual$colores %||% NULL,
        semaforo_gradiente_valores = semaforo_gradiente_manual$valores %||% NULL,
        semaforo_gradiente_limites = semaforo_gradiente_manual$limites %||% NULL,
        semaforo_colores = semaforo_colores,
        aplicar_gradiente_brecha = aplicar_gradiente_brecha,
        brecha_colores = brecha_colores,
        brecha_cortes = brecha_cortes
      )
    )
  }

  exportar_cruces_multi(
    data                      = data,
    dic_vars                  = dic_vars,
    SECCIONES                 = SECCIONES,
    CRUZAR_CON                = cruces,
    labels_override           = labels_override,
    path_xlsx                 = path_xlsx,
    hoja                      = hoja,
    fuente                    = fuente,
    survey                    = survey,
    sm_vars_force             = sm_vars_force,
    weight_col                = weight_col,
    orders_list               = orders_list,
    opciones_excluir          = opciones_excluir,
    show_sig                  = show_sig,
    alpha                     = alpha,
    codigos_solo_si_presentes = codigos_solo_si_presentes,
    numericas                 = numericas,
    digits                    = digits
  )
}
