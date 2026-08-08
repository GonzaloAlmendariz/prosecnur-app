# Etiqueta de segmento: porcentaje solo, o porcentaje con la frecuencia entre
# paréntesis.
#
# La decisión es de `mostrar_n_en_etiquetas` y de nada más. Antes la tomaba
# también `etiquetas_arriba_si_no_caben`, que es un ajuste de POSICIÓN —qué
# hacer cuando la etiqueta no entra en su segmento— y que el preset de la casa
# trae encendido: bastaba con eso para que todas las láminas de apiladas
# salieran «98% (51)» aunque el switch de frecuencia estuviera apagado y el
# propio motor de plan pidiera `mostrar_n_en_etiquetas = FALSE` en sus cinco
# llamadas. Dónde va el texto y qué dice el texto son dos decisiones distintas.
#
# `lab_arriba` es la variante que se usa cuando la etiqueta se desplaza fuera
# del segmento; lleva frecuencia bajo la misma condición, para que mover una
# etiqueta no cambie lo que informa.
.apiladas_etiquetas_con_frecuencia <- function(lab, n_txt, mostrar_n_en_etiquetas) {
  lab <- as.character(lab)
  n_txt <- as.character(n_txt)
  con_n <- nzchar(n_txt) & !is.na(n_txt) & !is.na(lab) & nzchar(lab)
  if (!isTRUE(mostrar_n_en_etiquetas)) {
    return(list(lab = lab, lab_arriba = lab))
  }
  lab_arriba <- lab
  lab_arriba[con_n] <- paste0(lab[con_n], " (", n_txt[con_n], ")")
  list(lab = lab_arriba, lab_arriba = lab_arriba)
}

# internal helpers for top/bottom box presets
.normalize_box_label <- function(x) {
  x <- as.character(x %||% "")[1]
  x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
  x <- tolower(trimws(x))
  gsub("[^a-z0-9]+", " ", x)
}

.extract_special_code <- function(x) {
  x <- as.character(x %||% "")[1]
  if (!nzchar(trimws(x))) return(NA_real_)
  m <- regexec("^\\s*([0-9]{1,3})\\b", x, perl = TRUE)
  got <- regmatches(x, m)[[1]]
  if (length(got) < 2L) return(NA_real_)
  suppressWarnings(as.numeric(got[2]))
}

.is_special_box_choice <- function(col_name, label) {
  lab_norm <- .normalize_box_label(label)
  patterns <- c(
    "sin inf",
    "sin informacion",
    "valor perdido",
    "missing",
    "no sabe",
    "no contesta",
    "no responde",
    "ns nc",
    "ns nr",
    "no sabe no contesta",
    "no sabe no responde"
  )
  has_special_label <- any(vapply(patterns, grepl, logical(1), x = lab_norm, fixed = TRUE))
  code_candidates <- c(.extract_special_code(label), .extract_special_code(col_name))
  has_special_code <- any(is.finite(code_candidates) & code_candidates > 60)
  has_special_label || has_special_code
}

.default_box_cols <- function(cols_porcentaje,
                              etiquetas_grupos,
                              n = 2L,
                              side = c("top", "bottom")) {
  side <- match.arg(side)
  n <- suppressWarnings(as.integer(n)[1])
  if (!is.finite(n) || is.na(n) || n < 1L) n <- 1L

  labels_map <- etiquetas_grupos[cols_porcentaje]
  labels_map <- as.character(labels_map)
  if (!length(labels_map)) labels_map <- rep("", length(cols_porcentaje))
  labels_map[is.na(labels_map)] <- ""

  keep <- !vapply(seq_along(cols_porcentaje), function(i) {
    .is_special_box_choice(cols_porcentaje[i], labels_map[i])
  }, logical(1))

  eligible <- cols_porcentaje[keep]
  if (!length(eligible)) eligible <- cols_porcentaje

  if (side == "top") {
    tail(eligible, min(n, length(eligible)))
  } else {
    head(eligible, min(n, length(eligible)))
  }
}

.auto_bar_width_apiladas <- function(n_categorias,
                                     grosor_barras_mult = 1,
                                     usar_grupos_canvas = TRUE,
                                     n_reales = n_categorias) {
  n_eff <- suppressWarnings(as.numeric(n_categorias)[1])
  if (!is.finite(n_eff) || is.na(n_eff) || n_eff <= 0) n_eff <- 1

  n_reales_eff <- suppressWarnings(as.numeric(n_reales)[1])
  if (!is.finite(n_reales_eff) || is.na(n_reales_eff) || n_reales_eff <= 0) {
    n_reales_eff <- n_eff
  }

  mult_eff <- suppressWarnings(as.numeric(grosor_barras_mult)[1])
  if (!is.finite(mult_eff) || is.na(mult_eff) || mult_eff <= 0) mult_eff <- 1

  # Calibracion suave, anclada a uso en PPT:
  # - pocas categorias: barras claramente visibles, sin quedar enclenques
  # - muchas categorias: sostener grosor para que no se afinen demasiado
  base <- stats::approx(
    x = c(1, 3, 5, 9, 12, 20),
    y = c(0.64, 0.70, 0.71, 0.72, 0.74, 0.78),
    xout = n_eff,
    rule = 2
  )$y

  if (!isTRUE(usar_grupos_canvas)) {
    # En barras sin columna de grupos, el mismo width se percibe mas grueso.
    # Compensamos suavemente para acercar el look al modo multi-fuente.
    base <- base * 0.88
  }

  out <- max(0.40, min(0.85, base * mult_eff))

  # Una sola fila REAL (dicotomicas apiladas tipicas): las filas virtuales
  # que evitan la "barra gigante aislada" (min_filas_layout = 2) dejaban una
  # cinta enclenque de ~22% del panel — feedback directo B36/G-2 ("barra muy
  # delgada y poco profesional"). Ensanchamos a una banda con cuerpo (~35%
  # del panel con 2 filas virtuales) conservando el centrado vertical. El
  # multiplicador del usuario sigue mandando por encima del piso.
  if (n_reales_eff == 1 && n_eff > n_reales_eff) {
    out <- max(out, min(1.20, 0.95 * mult_eff))
  }

  out
}

.estimate_label_width_apiladas <- function(labels, size) {
  labels <- as.character(labels)
  if (!length(labels)) return(numeric(0))

  size <- suppressWarnings(as.numeric(size))
  if (!length(size)) size <- 3
  size <- rep_len(size, length(labels))
  size[!is.finite(size)] <- 3

  chars <- nchar(labels, type = "width", allowNA = FALSE, keepNA = FALSE)
  chars[!is.finite(chars)] <- 0

  # Aproximación visual del ancho de etiqueta sobre escala 0-1.
  # Se usa para detectar colisiones entre etiquetas internas.
  est <- 0.005 + 0.0045 * pmax(chars, 2) + 0.0035 * pmax(size, 1)
  pmax(0.018, pmin(0.07, est))
}

.estimate_label_fit_width_apiladas <- function(labels, size) {
  labels <- as.character(labels)
  base <- .estimate_label_width_apiladas(labels, size)
  has_freq <- grepl("\\([^)]*\\d", labels)
  # Las etiquetas con frecuencia (% (n)) ocupan mucho mas que el porcentaje
  # solo. Si subestimamos este ancho terminan invadiendo el segmento vecino.
  base * ifelse(has_freq, 2.40, 0.72)
}

.finalizar_estado_labels_apiladas <- function(df_lab,
                                             color_texto_barras,
                                             color_texto_barras_fuera,
                                             fit_padding = 0.003) {
  if (!NROW(df_lab)) return(df_lab)

  hjust <- suppressWarnings(as.numeric(df_lab$.hjust_label))
  hjust[!is.finite(hjust)] <- 0.5
  hjust <- pmax(0, pmin(1, hjust))

  width_est <- .estimate_label_fit_width_apiladas(df_lab$lab, df_lab$.size_label)
  if (".label_fit_scale" %in% names(df_lab)) {
    scale_width <- suppressWarnings(as.numeric(df_lab$.label_fit_scale))
    scale_width[!is.finite(scale_width) | is.na(scale_width)] <- 1
    width_est <- width_est * scale_width
  }
  span_left <- df_lab$x_label - hjust * width_est
  span_right <- df_lab$x_label + (1 - hjust) * width_est

  tol <- max(0.0015, suppressWarnings(as.numeric(fit_padding)[1]) %||% 0.003)
  inside_bar <- is.finite(span_left) &
    is.finite(span_right) &
    span_left >= 0 - tol &
    span_right <= 1 + tol &
    df_lab$x_label >= 0 - tol &
    df_lab$x_label <= 1 + tol
  inside_bar[is.na(inside_bar)] <- FALSE

  forced_out <- if (".forzar_fuera" %in% names(df_lab)) as.logical(df_lab$.forzar_fuera) else FALSE
  if (length(forced_out) != nrow(df_lab)) forced_out <- rep(FALSE, nrow(df_lab))
  forced_out[is.na(forced_out)] <- FALSE

  df_lab$.label_fuera <- forced_out | !inside_bar
  df_lab$.col_label <- ifelse(df_lab$.label_fuera, color_texto_barras_fuera, color_texto_barras)
  df_lab$.span_label_left <- span_left
  df_lab$.span_label_right <- span_right
  df_lab
}

.limitar_una_label_fuera_por_barra_apiladas <- function(df_lab,
                                                        var_categoria,
                                                        color_texto_barras,
                                                        fit_padding = 0.003,
                                                        etiquetas_peq_padding = 0.012) {
  if (!NROW(df_lab) || !".label_fuera" %in% names(df_lab)) return(df_lab)

  grupos <- if (var_categoria %in% names(df_lab)) {
    split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
  } else {
    list(seq_len(nrow(df_lab)))
  }

  fit_padding <- max(0.002, suppressWarnings(as.numeric(fit_padding)[1]) %||% 0.003)
  gap <- max(0.010, suppressWarnings(as.numeric(etiquetas_peq_padding)[1]) %||% 0.012)

  for (idx in grupos) {
    fuera <- idx[df_lab$.label_fuera[idx] %in% TRUE]
    if (length(fuera) <= 1L) next

    forced <- integer(0)
    if (".forzar_fuera" %in% names(df_lab)) {
      forced <- fuera[df_lab$.forzar_fuera[fuera] %in% TRUE]
    }
    keep_out <- if (length(forced)) {
      forced[which.min(df_lab$x_label[forced])]
    } else {
      span_left <- if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left[fuera] else df_lab$x_label[fuera]
      span_right <- if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right[fuera] else df_lab$x_label[fuera]
      overflow <- pmax(0, -span_left) + pmax(0, span_right - 1)
      overflow[!is.finite(overflow)] <- 0
      fuera[which.max(overflow + (1 - df_lab$x_left[fuera]) * 1e-6)]
    }

    inside <- setdiff(fuera, keep_out)
    if (!length(inside)) next

    ord_left <- inside[df_lab$x_center[inside] <= 0.5]
    ord_left <- ord_left[order(df_lab$x_left[ord_left], seq_along(ord_left))]
    cursor_left <- fit_padding

    for (id in ord_left) {
      width <- .estimate_label_fit_width_apiladas(df_lab$lab[id], df_lab$.size_label[id]) * 1.15
      width <- min(max(width, 0.020), 0.12)
      x_max <- max(fit_padding, 1 - width - fit_padding)
      x_inside <- min(max(cursor_left, df_lab$x_left[id] + fit_padding), x_max)

      df_lab$x_label[id] <- x_inside
      df_lab$.hjust_label[id] <- 0
      df_lab$.label_fuera[id] <- FALSE
      df_lab$.col_label[id] <- color_texto_barras
      if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera[id] <- FALSE
      if (".fijar_label" %in% names(df_lab)) df_lab$.fijar_label[id] <- TRUE
      if (".repel_x_min" %in% names(df_lab)) df_lab$.repel_x_min[id] <- x_inside
      if (".repel_x_max" %in% names(df_lab)) df_lab$.repel_x_max[id] <- x_inside
      if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left[id] <- x_inside
      if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right[id] <- x_inside + width

      cursor_left <- x_inside + width + gap
    }

    ord_right <- inside[df_lab$x_center[inside] > 0.5]
    ord_right <- ord_right[order(df_lab$x_right[ord_right], decreasing = TRUE)]
    cursor_right <- 1 - fit_padding

    for (id in ord_right) {
      width <- .estimate_label_fit_width_apiladas(df_lab$lab[id], df_lab$.size_label[id]) * 1.15
      width <- min(max(width, 0.020), 0.12)
      x_min <- min(1 - fit_padding, width + fit_padding)
      x_inside <- max(min(cursor_right, df_lab$x_right[id] - fit_padding), x_min)

      df_lab$x_label[id] <- x_inside
      df_lab$.hjust_label[id] <- 1
      df_lab$.label_fuera[id] <- FALSE
      df_lab$.col_label[id] <- color_texto_barras
      if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera[id] <- FALSE
      if (".fijar_label" %in% names(df_lab)) df_lab$.fijar_label[id] <- TRUE
      if (".repel_x_min" %in% names(df_lab)) df_lab$.repel_x_min[id] <- x_inside
      if (".repel_x_max" %in% names(df_lab)) df_lab$.repel_x_max[id] <- x_inside
      if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left[id] <- x_inside - width
      if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right[id] <- x_inside

      cursor_right <- x_inside - width - gap
    }
  }

  df_lab
}

.acomodar_labels_dentro_barra_apiladas <- function(df_lab,
                                                   var_categoria,
                                                   color_texto_barras,
                                                   fit_padding = 0.003,
                                                   etiquetas_peq_padding = 0.012,
                                                   width_factor = 2.10) {
  if (!NROW(df_lab) || !".label_fuera" %in% names(df_lab)) return(df_lab)

  grupos <- if (var_categoria %in% names(df_lab)) {
    split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
  } else {
    list(seq_len(nrow(df_lab)))
  }

  fit_padding <- max(0.002, suppressWarnings(as.numeric(fit_padding)[1]) %||% 0.003)
  gap <- max(0.024, suppressWarnings(as.numeric(etiquetas_peq_padding)[1]) %||% 0.012)
  width_factor <- max(1, suppressWarnings(as.numeric(width_factor)[1]) %||% 1.35)

  for (idx in grupos) {
    inside <- idx[!(df_lab$.label_fuera[idx] %in% TRUE)]
    if (length(inside) < 2L) next

    widths <- .estimate_label_width_apiladas(
      df_lab$lab[inside],
      df_lab$.size_label[inside]
    ) * width_factor
    widths[!is.finite(widths) | is.na(widths)] <- 0.05

    hjust <- suppressWarnings(as.numeric(df_lab$.hjust_label[inside]))
    hjust[!is.finite(hjust) | is.na(hjust)] <- 0.5
    hjust <- pmax(0, pmin(1, hjust))

    span_left <- df_lab$x_label[inside] - hjust * widths
    span_right <- df_lab$x_label[inside] + (1 - hjust) * widths
    ord_local <- order(span_left, df_lab$x_label[inside], seq_along(inside))
    if (all(diff(span_left[ord_local]) >= 0) &&
        all(span_left[ord_local][-1] - span_right[ord_local][-length(ord_local)] >= gap)) {
      next
    }

    total_need <- sum(widths) + (length(widths) - 1L) * gap
    if (!is.finite(total_need) || total_need > (1 - 2 * fit_padding)) next

    ord <- inside[ord_local]
    widths_ord <- widths[ord_local]
    hjust_ord <- hjust[ord_local]
    cursor <- fit_padding

    for (pos in seq_along(ord)) {
      id <- ord[pos]
      width <- widths_ord[pos]
      hj <- hjust_ord[pos]
      x_min <- cursor + hj * width
      x_max <- 1 - fit_padding - (1 - hj) * width
      x_target <- max(df_lab$x_label[id], x_min)
      if (is.finite(x_max)) x_target <- min(x_target, x_max)

      df_lab$x_label[id] <- x_target
      df_lab$.hjust_label[id] <- hj
      df_lab$.label_fuera[id] <- FALSE
      df_lab$.col_label[id] <- color_texto_barras
      if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera[id] <- FALSE
      span_left_target <- x_target - hj * width
      span_right_target <- x_target + (1 - hj) * width
      if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left[id] <- span_left_target
      if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right[id] <- span_right_target

      cursor <- span_right_target + gap
    }
  }

  df_lab
}

.forzar_labels_dentro_barra_apiladas <- function(df_lab,
                                                 var_categoria,
                                                 color_texto_barras,
                                                 fit_padding = 0.003,
                                                 etiquetas_peq_padding = 0.012,
                                                 width_factor = 2.10) {
  if (!NROW(df_lab)) return(df_lab)

  grupos <- if (var_categoria %in% names(df_lab)) {
    split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
  } else {
    list(seq_len(nrow(df_lab)))
  }

  fit_padding <- max(0.002, suppressWarnings(as.numeric(fit_padding)[1]) %||% 0.003)
  gap <- max(0.016, suppressWarnings(as.numeric(etiquetas_peq_padding)[1]) %||% 0.012)
  width_factor <- max(1, suppressWarnings(as.numeric(width_factor)[1]) %||% 1.35)

  for (idx in grupos) {
    visible <- idx[nzchar(df_lab$lab[idx] %||% "")]
    if (!length(visible)) next

    base_widths <- .estimate_label_width_apiladas(
      df_lab$lab[visible],
      df_lab$.size_label[visible]
    )
    base_widths[!is.finite(base_widths) | is.na(base_widths)] <- 0.05

    available <- 1 - 2 * fit_padding - gap * max(0L, length(visible) - 1L)
    dyn_factor <- if (sum(base_widths) > 0 && is.finite(available) && available > 0) {
      min(width_factor, max(0.82, available / sum(base_widths)))
    } else {
      width_factor
    }

    widths <- base_widths * dyn_factor
    lower <- fit_padding + widths / 2
    upper <- 1 - fit_padding - widths / 2

    target <- suppressWarnings(as.numeric(df_lab$x_label[visible]))
    bad_target <- !is.finite(target)
    if (any(bad_target)) target[bad_target] <- df_lab$x_center[visible][bad_target]
    target <- pmin(upper, pmax(lower, target))

    x_adj <- .repel_label_positions_apiladas(
      x = target,
      labels = df_lab$lab[visible],
      label_size = df_lab$.size_label[visible],
      movable = rep(TRUE, length(visible)),
      hjust = rep(0.5, length(visible)),
      max_shift = 1,
      x_min = rep(fit_padding, length(visible)),
      x_max = rep(1 - fit_padding, length(visible)),
      padding = gap,
      max_iter = 24L,
      bias_right = 0.72,
      edge_margin = 0,
      width_factor = dyn_factor,
      bias_toward_center = TRUE,
      center_ref = 0.5
    )

    x_adj <- pmin(upper, pmax(lower, x_adj))
    df_lab$x_label[visible] <- x_adj
    df_lab$.hjust_label[visible] <- 0.5
    df_lab$.label_fuera[visible] <- FALSE
    df_lab$.col_label[visible] <- color_texto_barras
    if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera[visible] <- FALSE
    if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left[visible] <- x_adj - widths / 2
    if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right[visible] <- x_adj + widths / 2
  }

  df_lab
}

.posicionar_labels_arriba_si_no_caben_apiladas <- function(df_lab,
                                                           var_categoria,
                                                           usar_y_numerico,
                                                           grosor_eff,
                                                           fit_padding = 0.003,
                                                           etiquetas_peq_padding = 0.012,
                                                           color_texto_barras_fuera,
                                                           colores_grupos = NULL,
                                                           color_conectores_etiquetas = c("segmento", "azul_pulso"),
                                                           posicion_conector_etiquetas = c("centro", "izquierda", "derecha"),
                                                           offset_y = 0.17,
                                                           connector_gap_y = 0.060,
                                                           width_factor = 2.15) {
  if (!NROW(df_lab)) return(df_lab)

  color_conectores_etiquetas <- match.arg(color_conectores_etiquetas)
  posicion_conector_etiquetas <- match.arg(posicion_conector_etiquetas)

  if (!".label_arriba" %in% names(df_lab)) df_lab$.label_arriba <- FALSE
  if (!"y_label" %in% names(df_lab)) {
    df_lab$y_label <- if (".y_plot" %in% names(df_lab)) df_lab$.y_plot else NA_real_
  }
  if (!"x_conector_label" %in% names(df_lab)) df_lab$x_conector_label <- NA_real_
  if (!"x_conector_barra" %in% names(df_lab)) df_lab$x_conector_barra <- NA_real_
  if (!"y_conector_label" %in% names(df_lab)) df_lab$y_conector_label <- NA_real_
  if (!"y_conector_barra" %in% names(df_lab)) df_lab$y_conector_barra <- NA_real_
  if (!".col_conector" %in% names(df_lab)) df_lab$.col_conector <- color_texto_barras_fuera

  if (!isTRUE(usar_y_numerico) || !".y_plot" %in% names(df_lab)) {
    return(df_lab)
  }

  fit_padding <- max(0.002, suppressWarnings(as.numeric(fit_padding)[1]) %||% 0.003)
  gap <- max(0.016, suppressWarnings(as.numeric(etiquetas_peq_padding)[1]) %||% 0.012)
  offset_y <- suppressWarnings(as.numeric(offset_y)[1])
  if (!is.finite(offset_y) || is.na(offset_y) || offset_y <= 0) offset_y <- 0.13
  connector_gap_y <- suppressWarnings(as.numeric(connector_gap_y)[1])
  if (!is.finite(connector_gap_y) || is.na(connector_gap_y) || connector_gap_y < 0) connector_gap_y <- 0.035
  width_factor <- max(1, suppressWarnings(as.numeric(width_factor)[1]) %||% 1.55)

  grosor_eff <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(grosor_eff) || is.na(grosor_eff) || grosor_eff <= 0) grosor_eff <- 0.70

  color_segmento <- rep(color_texto_barras_fuera, nrow(df_lab))
  if (!is.null(colores_grupos)) {
    cg <- colores_grupos
    if (!is.null(names(cg)) && length(names(cg))) {
      hit <- as.character(cg[match(as.character(df_lab$.grupo), names(cg))])
      ok <- !is.na(hit) & nzchar(hit)
      color_segmento[ok] <- hit[ok]
    }
  }

  grupos <- if (var_categoria %in% names(df_lab)) {
    split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
  } else {
    list(seq_len(nrow(df_lab)))
  }

  top_y <- df_lab$.y_plot + grosor_eff / 2

  for (idx in grupos) {
    visible <- idx[nzchar(df_lab$lab[idx] %||% "")]
    if (!length(visible)) next
    mover <- visible[df_lab$.label_fuera[visible] %in% TRUE]
    if (!length(mover)) next

    if (".lab_arriba" %in% names(df_lab)) {
      lab_arriba <- as.character(df_lab$.lab_arriba[mover])
      usar_lab_arriba <- !is.na(lab_arriba) & nzchar(lab_arriba)
      if (any(usar_lab_arriba)) {
        df_lab$lab[mover[usar_lab_arriba]] <- lab_arriba[usar_lab_arriba]
      }
    }

    label_widths <- .estimate_label_width_apiladas(
      df_lab$lab[mover],
      df_lab$.size_label[mover]
    )
    widths <- label_widths * width_factor
    if (".label_fit_scale" %in% names(df_lab)) {
      scale_width <- suppressWarnings(as.numeric(df_lab$.label_fit_scale[mover]))
      scale_width[!is.finite(scale_width) | is.na(scale_width)] <- 1
      label_widths <- label_widths * scale_width
      widths <- widths * scale_width
    }
    label_widths[!is.finite(label_widths) | is.na(label_widths)] <- 0.05
    widths[!is.finite(widths) | is.na(widths)] <- 0.05

    lower <- fit_padding + widths / 2
    upper <- 1 - fit_padding - widths / 2
    impossible <- lower > upper
    if (any(impossible)) {
      lower[impossible] <- 0.5
      upper[impossible] <- 0.5
    }

    target <- suppressWarnings(as.numeric(df_lab$x_center[mover]))
    target[!is.finite(target)] <- 0.5
    target <- pmin(upper, pmax(lower, target))

    x_adj <- .repel_label_positions_apiladas(
      x = target,
      labels = df_lab$lab[mover],
      label_size = df_lab$.size_label[mover],
      movable = rep(TRUE, length(mover)),
      hjust = rep(0.5, length(mover)),
      max_shift = 1,
      x_min = rep(fit_padding, length(mover)),
      x_max = rep(1 - fit_padding, length(mover)),
      padding = gap,
      max_iter = 28L,
      bias_right = 0.55,
      edge_margin = 0,
      width_factor = width_factor,
      bias_toward_center = TRUE,
      center_ref = 0.5
    )
    x_adj <- pmin(upper, pmax(lower, x_adj))
    x_conector_label <- switch(
      posicion_conector_etiquetas,
      izquierda = x_adj - label_widths / 2,
      derecha = x_adj + label_widths / 2,
      centro = x_adj
    )
    x_conector_label <- pmin(1 - fit_padding, pmax(fit_padding, x_conector_label))

    df_lab$x_label[mover] <- x_adj
    df_lab$.hjust_label[mover] <- 0.5
    df_lab$.label_fuera[mover] <- TRUE
    df_lab$.label_arriba[mover] <- TRUE
    df_lab$.col_label[mover] <- color_texto_barras_fuera
    df_lab$.col_conector[mover] <- if (identical(color_conectores_etiquetas, "azul_pulso")) {
      color_texto_barras_fuera
    } else {
      color_segmento[mover]
    }
    df_lab$y_label[mover] <- top_y[mover] + offset_y
    df_lab$x_conector_label[mover] <- x_conector_label
    df_lab$x_conector_barra[mover] <- df_lab$x_center[mover]
    df_lab$y_conector_label[mover] <- top_y[mover] + connector_gap_y
    df_lab$y_conector_barra[mover] <- top_y[mover] - max(0.010, connector_gap_y * 0.15)
    if (".fijar_label" %in% names(df_lab)) df_lab$.fijar_label[mover] <- TRUE
    if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera[mover] <- TRUE
  }

  df_lab
}

.finalizar_labels_interiores_apiladas <- function(df_lab,
                                                  var_categoria,
                                                  color_texto_barras,
                                                  color_texto_barras_fuera,
                                                  fit_padding = 0.003,
                                                  etiquetas_peq_padding = 0.012,
                                                  width_factor = 2.10) {
  if (!NROW(df_lab)) return(df_lab)

  df_lab <- .finalizar_estado_labels_apiladas(
    df_lab,
    color_texto_barras = color_texto_barras,
    color_texto_barras_fuera = color_texto_barras_fuera,
    fit_padding = fit_padding
  )
  df_lab <- .limitar_una_label_fuera_por_barra_apiladas(
    df_lab,
    var_categoria = var_categoria,
    color_texto_barras = color_texto_barras,
    fit_padding = fit_padding,
    etiquetas_peq_padding = etiquetas_peq_padding
  )
  df_lab <- .acomodar_labels_dentro_barra_apiladas(
    df_lab,
    var_categoria = var_categoria,
    color_texto_barras = color_texto_barras,
    fit_padding = fit_padding,
    etiquetas_peq_padding = etiquetas_peq_padding
  )
  df_lab <- .forzar_labels_dentro_barra_apiladas(
    df_lab,
    var_categoria = var_categoria,
    color_texto_barras = color_texto_barras,
    fit_padding = fit_padding,
    etiquetas_peq_padding = etiquetas_peq_padding,
    width_factor = width_factor
  )

  df_lab
}

.centrar_labels_interiores_segmento_apiladas <- function(df_lab,
                                                         color_texto_barras) {
  if (!NROW(df_lab)) return(df_lab)

  df_lab$x_label <- df_lab$x_center
  df_lab$.hjust_label <- 0.5
  df_lab$.label_fuera <- FALSE
  df_lab$.col_label <- color_texto_barras
  if (".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera <- FALSE
  if (".fijar_label" %in% names(df_lab)) df_lab$.fijar_label <- TRUE
  if (".repel_x_min" %in% names(df_lab)) df_lab$.repel_x_min <- df_lab$x_center
  if (".repel_x_max" %in% names(df_lab)) df_lab$.repel_x_max <- df_lab$x_center
  if (".span_label_left" %in% names(df_lab)) df_lab$.span_label_left <- NA_real_
  if (".span_label_right" %in% names(df_lab)) df_lab$.span_label_right <- NA_real_
  df_lab
}

.dejar_max_una_label_fuera_izq_apiladas <- function(df_lab,
                                                    idx_izq,
                                                    label_offset,
                                                    fit_padding,
                                                    etiquetas_peq_padding,
                                                    color_texto_barras) {
  if (!length(idx_izq) || length(idx_izq) < 2L) return(df_lab)

  first <- idx_izq[which.min(df_lab$x_left[idx_izq])]
  if (!is.finite(df_lab$x_left[first]) || df_lab$x_left[first] > 0.015) return(df_lab)

  ord_edge <- idx_izq[order(df_lab$x_left[idx_izq], seq_along(idx_izq))]
  gap <- max(etiquetas_peq_padding, 0.016)
  widths_all <- .estimate_label_width_apiladas(
    df_lab$lab[ord_edge],
    df_lab$.size_label[ord_edge]
  ) * 1.18
  widths_all[!is.finite(widths_all) | is.na(widths_all)] <- 0.05
  start_inside <- max(0.006, min(df_lab$x_left[first] + max(fit_padding, 0.003), 0.03))
  keep_out <- integer(0)
  inside <- ord_edge

  if (!".fijar_label" %in% names(df_lab)) df_lab$.fijar_label <- FALSE
  if (!".forzar_fuera" %in% names(df_lab)) df_lab$.forzar_fuera <- FALSE
  if (!".repel_x_min" %in% names(df_lab)) df_lab$.repel_x_min <- NA_real_
  if (!".repel_x_max" %in% names(df_lab)) df_lab$.repel_x_max <- NA_real_

  if (length(keep_out)) {
    df_lab$x_label[keep_out] <- df_lab$x_left[keep_out] - max(label_offset, 0.008)
    df_lab$.hjust_label[keep_out] <- 1
    df_lab$.repel_x_min[keep_out] <- max(-0.20, df_lab$x_label[keep_out])
    df_lab$.repel_x_max[keep_out] <- df_lab$x_label[keep_out]
    df_lab$.fijar_label[keep_out] <- TRUE
    df_lab$.forzar_fuera[keep_out] <- TRUE
  }

  if (length(inside)) {
    widths_inside <- .estimate_label_width_apiladas(
      df_lab$lab[inside],
      df_lab$.size_label[inside]
    ) * 1.35
    cursor <- if (length(keep_out)) {
      max(0.006, df_lab$x_right[keep_out] + max(fit_padding, 0.003))
    } else {
      start_inside
    }

    for (pos in seq_along(inside)) {
      id <- inside[pos]
      w <- widths_inside[pos]
      if (!is.finite(w) || is.na(w)) w <- 0.05
      x_inside <- min(max(cursor, 0.003), max(0.003, 1 - w - fit_padding))
      df_lab$x_label[id] <- x_inside
      df_lab$.hjust_label[id] <- 0
      df_lab$.label_fuera[id] <- FALSE
      df_lab$.col_label[id] <- color_texto_barras
      df_lab$.repel_x_min[id] <- x_inside
      df_lab$.repel_x_max[id] <- x_inside
      df_lab$.fijar_label[id] <- TRUE
      df_lab$.forzar_fuera[id] <- FALSE
      cursor <- x_inside + w + gap
    }
  }

  df_lab
}

.repel_label_positions_apiladas <- function(x,
                                            labels,
                                            label_size,
                                            movable,
                                            hjust = 0.5,
                                            max_shift = 0.05,
                                            x_min = 0,
                                            x_max = 1,
                                            padding = 0.003,
                                            max_iter = 16L,
                                            bias_right = 0.5,
                                            edge_margin = 0,
                                            width_factor = 1,
                                            bias_toward_center = FALSE,
                                            center_ref = 0.5) {
  x <- suppressWarnings(as.numeric(x))
  n <- length(x)
  if (!n) return(x)
  if (n == 1L) return(x)

  movable <- as.logical(movable)
  movable[is.na(movable)] <- FALSE
  if (!any(movable)) return(x)

  max_shift <- suppressWarnings(as.numeric(max_shift)[1])
  if (!is.finite(max_shift) || is.na(max_shift) || max_shift < 0) max_shift <- 0.05

  padding <- suppressWarnings(as.numeric(padding)[1])
  if (!is.finite(padding) || is.na(padding) || padding < 0) padding <- 0.003

  bias_right <- suppressWarnings(as.numeric(bias_right)[1])
  if (!is.finite(bias_right) || is.na(bias_right)) bias_right <- 0.5
  bias_right <- max(0, min(1, bias_right))

  edge_margin <- suppressWarnings(as.numeric(edge_margin)[1])
  if (!is.finite(edge_margin) || is.na(edge_margin) || edge_margin < 0) edge_margin <- 0

  width_factor <- suppressWarnings(as.numeric(width_factor)[1])
  if (!is.finite(width_factor) || is.na(width_factor) || width_factor <= 0) width_factor <- 1
  bias_toward_center <- isTRUE(bias_toward_center)
  center_ref <- suppressWarnings(as.numeric(center_ref)[1])
  if (!is.finite(center_ref) || is.na(center_ref)) center_ref <- 0.5
  center_ref <- max(0, min(1, center_ref))

  ord <- order(x, seq_along(x))
  inv <- order(ord)

  x_ord <- x[ord]
  labels_ord <- rep_len(as.character(labels), n)[ord]
  size_ord <- rep_len(suppressWarnings(as.numeric(label_size)), n)[ord]
  movable_ord <- movable[ord]
  hjust_ord <- rep_len(suppressWarnings(as.numeric(hjust)), n)[ord]
  hjust_ord[!is.finite(hjust_ord)] <- 0.5
  hjust_ord <- pmax(0, pmin(1, hjust_ord))

  x_min_vec <- rep_len(suppressWarnings(as.numeric(x_min)), n)
  x_max_vec <- rep_len(suppressWarnings(as.numeric(x_max)), n)
  x_min_vec[!is.finite(x_min_vec)] <- 0
  x_max_vec[!is.finite(x_max_vec)] <- 1

  x_min_ord <- x_min_vec[ord]
  x_max_ord <- x_max_vec[ord]
  swap_idx <- x_min_ord > x_max_ord
  if (any(swap_idx)) {
    tmp <- x_min_ord[swap_idx]
    x_min_ord[swap_idx] <- x_max_ord[swap_idx]
    x_max_ord[swap_idx] <- tmp
  }

  # Margen interno para que la etiqueta no toque el borde del segmento.
  x_min_ord <- pmin(x_max_ord - 1e-6, x_min_ord + edge_margin)
  x_max_ord <- pmax(x_min_ord + 1e-6, x_max_ord - edge_margin)

  width_est <- .estimate_label_width_apiladas(labels_ord, size_ord) * width_factor

  lower <- pmax(x_min_ord + hjust_ord * width_est, x_ord - max_shift)
  upper <- pmin(x_max_ord - (1 - hjust_ord) * width_est, x_ord + max_shift)

  impossible <- lower > upper
  if (any(impossible)) {
    seg_center_imp <- (x_min_ord[impossible] + x_max_ord[impossible]) / 2
    push_to_center <- ifelse(seg_center_imp <= center_ref, x_max_ord[impossible], x_min_ord[impossible])
    center_fix <- pmin(
      x_max_ord[impossible],
      pmax(x_min_ord[impossible], push_to_center)
    )
    lower[impossible] <- center_fix
    upper[impossible] <- center_fix
  }

  x_adj <- pmin(upper, pmax(lower, x_ord))

  max_iter <- suppressWarnings(as.integer(max_iter)[1])
  if (!is.finite(max_iter) || is.na(max_iter) || max_iter < 1L) max_iter <- 16L

  for (iter in seq_len(max_iter)) {
    changed <- FALSE

    for (i in seq_len(n - 1L)) {
      span_right_i <- x_adj[i] + (1 - hjust_ord[i]) * width_est[i]
      span_left_next <- x_adj[i + 1L] - hjust_ord[i + 1L] * width_est[i + 1L]
      current_gap <- span_left_next - span_right_i

      if (!is.finite(current_gap) || current_gap + 1e-9 >= padding) next

      overlap <- padding - current_gap
      left_room <- if (movable_ord[i]) max(0, x_adj[i] - lower[i]) else 0
      right_room <- if (movable_ord[i + 1L]) max(0, upper[i + 1L] - x_adj[i + 1L]) else 0

      if (left_room <= 0 && right_room <= 0) next

      shift_left <- 0
      shift_right <- 0

      if (movable_ord[i] && movable_ord[i + 1L]) {
        bias_eff <- bias_right
        if (isTRUE(bias_toward_center)) {
          pair_mid <- (x_adj[i] + x_adj[i + 1L]) / 2
          center_bias <- if (pair_mid < center_ref) {
            0.9
          } else if (pair_mid > center_ref) {
            0.1
          } else {
            0.5
          }
          bias_eff <- (bias_right + center_bias * 2) / 3
        }
        target_right <- overlap * bias_eff
        target_left <- overlap - target_right
        shift_right <- min(target_right, right_room)
        shift_left <- min(target_left, left_room)

        rem <- overlap - shift_left - shift_right
        if (rem > 1e-9 && right_room > shift_right) {
          extra <- min(rem, right_room - shift_right)
          shift_right <- shift_right + extra
          rem <- rem - extra
        }
        if (rem > 1e-9 && left_room > shift_left) {
          extra <- min(rem, left_room - shift_left)
          shift_left <- shift_left + extra
        }
      } else if (movable_ord[i]) {
        shift_left <- min(overlap, left_room)
      } else if (movable_ord[i + 1L]) {
        shift_right <- min(overlap, right_room)
      }

      if (shift_left > 0) x_adj[i] <- x_adj[i] - shift_left
      if (shift_right > 0) x_adj[i + 1L] <- x_adj[i + 1L] + shift_right
      if (shift_left > 0 || shift_right > 0) changed <- TRUE
    }

    x_adj <- pmin(upper, pmax(lower, x_adj))

    if (n > 1L) {
      for (i in 2:n) {
        prev_right <- x_adj[i - 1L] + (1 - hjust_ord[i - 1L]) * width_est[i - 1L]
        this_left <- x_adj[i] - hjust_ord[i] * width_est[i]
        if (this_left < prev_right + padding) {
          x_adj[i] <- min(upper[i], x_adj[i] + (prev_right + padding - this_left))
        }
      }
      for (i in seq.int(n - 1L, 1L)) {
        this_right <- x_adj[i] + (1 - hjust_ord[i]) * width_est[i]
        next_left <- x_adj[i + 1L] - hjust_ord[i + 1L] * width_est[i + 1L]
        if (this_right > next_left - padding) {
          x_adj[i] <- max(lower[i], x_adj[i] - (this_right - next_left + padding))
        }
      }
    }

    if (!changed) break
  }

  x_adj[inv]
}

#' Graficar barras apiladas (100%) con canvas opcional y exportación
#'
#' Construye un gráfico de **barras apiladas horizontales** normalizadas a 100% por categoría.
#' El insumo esperado es un `data.frame` en formato **ancho** con:
#' una columna de categorías (`var_categoria`), una columna de base (`var_n`) y varias columnas
#' de porcentajes (`cols_porcentaje`). Las columnas de porcentaje pueden venir como proporción
#' (`0–1`) o como porcentaje (`0–100`), controlado por `escala_valor`.
#'
#' La función convierte a formato largo, **normaliza** cada fila a suma 1, aplica un **cierre exacto**
#' para corregir residuos numéricos (ajustando el último segmento del stack), y luego grafica con
#' `geom_col()`. Las etiquetas de porcentaje internas se asignan de forma **exacta** para que, con los
#' decimales definidos, la suma sea 100.0/100.00/etc. por barra.
#'
#' En modo estándar (`usar_canvas = FALSE`) se devuelve un `ggplot` convencional con título/subtítulo
#' y leyenda inferior (si corresponde). En modo `usar_canvas = TRUE` se arma un **canvas** con
#' `cowplot` que separa placeholders internos (encabezado, etiquetas Y, panel de barras, columna extra,
#' leyenda y caption), permitiendo un control fino del layout (útil para exportación a PPT).
#'
#' Además, se puede agregar una columna de **barra extra** (por defecto, N) o indicadores tipo
#' `top2box`, `top3box` o `bottom2box` a partir de los segmentos apilados.
#'
#' Desde esta versión, el repelido de etiquetas pequenas es configurable: se puede ajustar el
#' detector de colisión (ancho estimado), el padding mínimo, el número de iteraciones, el sesgo
#' izquierda/derecha y un modo **confinado por segmento** para que las etiquetas no crucen a
#' segmentos vecinos ni se salgan visualmente de su barra. Además, `etiquetas_uniformes = TRUE`
#' activa un modo opt-in sin split `peq/grande`, con sesgo de empuje hacia el centro para
#' reducir choques. Por compatibilidad, el comportamiento legacy se mantiene cuando
#' `etiquetas_uniformes = FALSE` (default).
#'
#' @param data `data.frame` o `tibble` en formato ancho con columnas de categorías, base y porcentajes.
#' @param var_categoria Nombre de la columna categórica (eje Y).
#' @param var_etiqueta_categoria Columna opcional con la etiqueta visible de cada categoría.
#' @param var_n Nombre de la columna base (por ejemplo, N por categoría).
#' @param cols_porcentaje Vector con los nombres de columnas de porcentajes (segmentos apilados).
#' @param etiquetas_grupos Vector nombrado que mapea `cols_porcentaje` → etiqueta visible de cada segmento.
#'   Sus `names()` deben coincidir con `cols_porcentaje`.
#' @param etiquetas_leyenda Vector opcional con etiquetas visibles solo para la
#'   leyenda. Puede venir nombrado por las etiquetas finales de
#'   `etiquetas_grupos` o tener el mismo largo y orden que la escala.
#' @param cols_n Vector opcional que mapea cada columna de porcentaje a una
#'   columna de frecuencia absoluta. Si no tiene nombres, debe tener el mismo
#'   largo y orden que `cols_porcentaje`.
#' @param mostrar_n_en_etiquetas Si `TRUE`, agrega la frecuencia entre parentesis
#'   a las etiquetas de porcentaje, por ejemplo `9% (16)`.
#'
#' @param escala_valor Indica la escala de los porcentajes en `cols_porcentaje`:
#'   `"proporcion_1"` para `0–1` o `"proporcion_100"` para `0–100`.
#' @param colores_grupos Vector de colores opcional (idealmente nombrado por etiqueta final).
#' @param mostrar_valores Si `TRUE`, dibuja etiquetas internas de porcentaje.
#' @param decimales Decimales para etiquetas de porcentaje internas.
#' @param umbral_etiqueta Umbral mínimo de proporción para usar una etiqueta de tamano normal.
#'   Se mantiene por compatibilidad y actúa como alias de `umbral_etiqueta_normal`.
#' @param umbral_etiqueta_peq Umbral mínimo de proporción para mostrar una etiqueta pequena.
#'   Se mantiene por compatibilidad y actúa como alias de `umbral_mostrar_etiqueta`.
#' @param umbral_mostrar_etiqueta Umbral de proporción para reubicar etiquetas fuera del segmento.
#'   Los valores positivos por debajo de este umbral se etiquetan dentro del ancho total de la barra.
#' @param umbral_etiqueta_normal Umbral mínimo de proporción para usar una etiqueta de tamano normal.
#'   Controla tamaño de fuente y puede ser menor que `umbral_mostrar_etiqueta`.
#' @param umbral_ocultar_etiqueta Umbral de proporción bajo el cual se oculta solo
#'   la etiqueta de porcentaje, manteniendo visible el segmento de la barra.
#'
#' @param mostrar_barra_extra Si `TRUE`, dibuja una columna extra a la derecha (por defecto, basada en `var_n`).
#' @param barra_extra_preset Tipo de barra/indicador extra: `"ninguno"`, `"totales"`, `"top2box"`, `"top3box"` o `"bottom2box"`.
#' @param prefijo_barra_extra Prefijo del texto extra (por ejemplo, `"N = "`).
#' @param titulo_barra_extra Título de la columna extra en el canvas.
#'
#' @param titulo,subtitulo,nota_pie Textos del encabezado y caption (izquierda).
#' @param nota_pie_derecha Texto adicional para caption (derecha), concatenado cuando corresponda.
#' @param pos_titulo Alineación del encabezado: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param pos_nota_pie Alineación del caption: `"derecha"`, `"izquierda"` o `"centro"`.
#' @param centro_cowplot Centro horizontal opcional para leyenda en canvas (coordenadas npc).
#'
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo,color_nota_pie,size_nota_pie
#'   Estilos de texto del encabezado y caption.
#' @param color_leyenda,size_leyenda Estilos de texto de leyenda.
#' @param color_texto_barras,size_texto_barras,size_texto_barras_peq Estilos de etiquetas internas.
#' @param etiquetas_uniformes Si `TRUE`, activa modo uniforme de etiquetas:
#'   no separa entre etiquetas grandes/pequenas, muestra todo valor positivo
#'   y aplica el repelido dentro del ancho total de la barra.
#' @param repeler_etiquetas_peq Si `TRUE`, intenta separar horizontalmente las etiquetas pequenas
#'   cuando se superponen, manteniendolas cerca de su centro original. En modo uniforme,
#'   este repelido se aplica a todas las etiquetas visibles.
#' @param desplazamiento_max_etiquetas_peq Corrimiento horizontal maximo permitido para etiquetas
#'   pequenas, en la escala `0-1` de la barra normalizada.
#' @param etiquetas_peq_factor_ancho Multiplicador del ancho estimado de etiquetas pequenas para
#'   detectar colisiones. Valores mayores a `1` vuelven el detector más conservador y tienden a
#'   separar mejor textos como `2%`, `4%`, `5%`.
#' @param etiquetas_peq_padding Espacio horizontal mínimo adicional entre etiquetas pequenas
#'   (escala `0-1` de la barra).
#' @param etiquetas_peq_max_iter Número máximo de iteraciones del algoritmo de repelido.
#' @param etiquetas_peq_sesgo_derecha Sesgo de ajuste cuando dos etiquetas pequenas chocan.
#'   `0.5` reparte el movimiento de forma equilibrada; valores mayores desplazan más la etiqueta
#'   de la derecha (útil cuando se desea “empujar hacia adentro”).
#' @param etiquetas_peq_confinadas Si `TRUE`, las etiquetas pequenas solo se mueven dentro de su
#'   propio segmento apilado y no pueden cruzar a segmentos vecinos.
#' @param etiquetas_peq_margen_interno Margen de seguridad dentro del segmento cuando
#'   `etiquetas_peq_confinadas = TRUE`, para evitar textos pegados al borde.
#' @param etiquetas_arriba_si_no_caben Si `TRUE`, cuando una barra tiene al menos
#'   una etiqueta que no cabe en su segmento, mueve todas las etiquetas visibles de
#'   esa barra encima y las conecta con su segmento mediante una línea corta.
#' @param etiquetas_arriba_offset Separación vertical entre el borde superior de la
#'   barra y las etiquetas superiores, en unidades del eje Y interno.
#' @param color_conectores_etiquetas Color de las líneas que conectan etiquetas
#'   superiores con su segmento. `"segmento"` hereda el color del segmento;
#'   `"azul_pulso"` usa el color de texto fuera de barra.
#' @param posicion_conector_etiquetas Punto del texto superior desde donde sale
#'   la línea guía: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param linewidth_conectores_etiquetas Grosor de las líneas que conectan etiquetas
#'   superiores con su segmento.
#' @param color_barra_extra,size_barra_extra,size_titulo_extra Estilos de la columna extra.
#' @param color_ejes,size_ejes Estilos de las etiquetas de categorías (dibujadas en canvas).
#' @param color_titulos_grupo,size_titulos_grupo Estilos para títulos de bloque izquierdo en canvas.
#' @param color_fondo Color de fondo (útil en exportación).
#'
#' @param grosor_barras Grosor manual de barras en `geom_col()`.
#' @param extra_derecha_rel Espacio extra al lado derecho cuando no se usa canvas y hay barra extra.
#' @param espacio_izquierda_rel Espacio relativo al lado izquierdo cuando no se usa canvas.
#' @param ancho_max_eje_y Ancho de wrap para etiquetas de categorías (requiere `stringr`).
#'
#' @param mostrar_leyenda Si `TRUE`, incluye leyenda (en no-canvas: abajo; en canvas: placeholder propio).
#' @param invertir_leyenda Si `TRUE`, invierte el orden de la leyenda.
#' @param invertir_barras Si `TRUE`, invierte el orden de categorías.
#' @param invertir_segmentos Si `TRUE`, invierte el orden del stack (segmentos).
#' @param textos_negrita Vector con tokens para forzar negrita por componente (por ejemplo,
#'   `"titulo"`, `"leyenda"`, `"porcentajes"`/`"valores"`, `"eje_y"`, `"barra_extra"`).
#'
#' @param usar_canvas Si `TRUE`, arma el gráfico con `cowplot` en placeholders internos.
#' @param var_grupo_id,var_grupo_titulo Columnas opcionales para agrupar categorías en bloques
#'   y dibujar un título por bloque en el canvas.
#' @param canvas_w_grupo,canvas_w_buf_grupo_etq Ancho relativo de la columna de bloque y su
#'   separación respecto a las etiquetas del cruce.
#' @param canvas_gap_grupos Separación vertical adicional entre bloques, expresada en “altos de fila”.
#' @param canvas_w_etiquetas,canvas_w_buf_etq_bars,canvas_w_buf_bars_extra,canvas_w_bars,canvas_w_extra
#'   Anchos relativos de columnas del canvas (etiquetas, buffers, panel, extra).
#' @param canvas_h_header_in,canvas_h_legend_in,canvas_h_caption_in,canvas_h_panel_in,canvas_h_toprow_in
#'   Alturas relativas (en pulgadas “virtuales”) para encabezado, panel, leyenda, caption y fila superior.
#' @param canvas_min_filas Mínimo de filas virtuales cuando `usar_canvas = TRUE`.
#'   Sirve para mantener alineación y grosor visual consistente entre gráficos
#'   con una sola barra y gráficos con múltiples barras.
#' @param canvas_pad_bars_y_in Padding vertical (in) dentro del placeholder del panel de barras (top/bottom).
#'
#' @param grosor_modo `"manual"` o `"auto"` para ajustar grosor según número de categorías.
#' @param grosor_barras_mult Multiplicador adicional para grosor en modo auto.
#'
#' @param legend_key_cm Tamaño de “key” de la leyenda.
#' @param legend_espaciado Espaciado lateral del texto de leyenda (pt).
#' @param legend_n_por_fila Número de ítems por fila en la leyenda.
#' @param legend_ancho_rel Ancho relativo mínimo reservado para la leyenda
#'   manual compacta en canvas. Si es `NULL`, se calcula con las etiquetas.
#' @param legend_gap_npc Separación horizontal entre ítems de leyenda manual
#'   compacta, en coordenadas normalizadas del canvas.
#' @param legend_key_aspect_yx Relación alto/ancho física usada para cuadrar
#'   la marca de color de la leyenda manual. Si es `NULL`, usa `alto / ancho`.
#'
#' @param encabezado_desplazamiento_in Ajuste vertical del encabezado (in).
#' @param encabezado_separacion_in Separación vertical entre título y subtítulo (in).
#' @param leyenda_desplazamiento_in Ajuste vertical de la leyenda (in).
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de depuración de placeholders del canvas.
#' @param debug_ph_col,debug_ph_lwd Color y grosor de bordes de depuración.
#'
#' @param exportar Tipo de salida: `"rplot"` (devuelve el objeto), `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida para exportaciones no-`rplot`.
#' @param ancho,alto Dimensiones (en pulgadas) para exportación.
#' @param alto_por_categoria Altura sugerida por categoría para el cálculo de panel en canvas.
#' @param dpi Resolución para PNG.
#'
#' @param ppt_append Si `TRUE` y el archivo existe, agrega una diapositiva; si no, crea un nuevo PPT.
#' @param ppt_layout,ppt_master Layout y master para la diapositiva en exportación a PPT.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto `ggplot` (en no-canvas) o un objeto `cowplot`
#'   (en canvas). En otros modos, exporta el archivo y retorna invisiblemente el gráfico.
#'
#' @examples
#' \dontrun{
#' p <- graficar_barras_apiladas(
#'   data = df_wide,
#'   var_categoria = "pregunta",
#'   var_n = "n_base",
#'   cols_porcentaje = c("pct_1","pct_2","pct_3"),
#'   etiquetas_grupos = c(pct_1="Sí", pct_2="No", pct_3="NS/NP"),
#'   usar_canvas = TRUE,
#'   exportar = "ppt",
#'   path_salida = "salida.pptx"
#' )
#' }
#' @family graficador
#' @export
graficar_barras_apiladas <- function(
    data,
    var_categoria,
    var_etiqueta_categoria = NULL,
    var_n,
    cols_porcentaje,
    etiquetas_grupos,
    etiquetas_leyenda     = NULL,
    cols_n                = NULL,
    mostrar_n_en_etiquetas = FALSE,
    escala_valor          = c("proporcion_1", "proporcion_100"),
    colores_grupos        = NULL,
    mostrar_valores       = TRUE,
    decimales             = 0,
    umbral_etiqueta       = 0.001,
    umbral_etiqueta_peq   = NULL,
    umbral_mostrar_etiqueta = NULL,
    umbral_etiqueta_normal  = NULL,
    umbral_ocultar_etiqueta = 0,
    mostrar_barra_extra   = TRUE,
    barra_extra_preset    = c("ninguno", "totales", "top2box", "top3box", "bottom2box"),
    prefijo_barra_extra   = NULL,
    titulo_barra_extra    = NULL,
    titulo                = NULL,
    subtitulo             = NULL,
    nota_pie              = NULL,
    nota_pie_derecha      = NULL,
    pos_titulo            = c("centro", "izquierda", "derecha"),
    pos_nota_pie          = c("derecha", "izquierda", "centro"),
    centro_cowplot        = NA_real_,

    # Estilo de texto y layout
    color_titulo          = "#000000",
    size_titulo           = 11,
    color_subtitulo       = "#000000",
    size_subtitulo        = 9,
    # Italica, como en barras agrupadas: el subtitulo es una acotacion sobre la
    # pregunta —«Pregunta de opcion multiple»—, no un segundo titulo. El formal
    # NO existia, asi que el `face` que le mandaba el motor se descartaba en
    # silencio y el aviso salia en redonda.
    face_subtitulo        = "italic",
    color_nota_pie        = "#000000",
    size_nota_pie         = 8,
    color_leyenda         = "#000000",
    size_leyenda          = 8,
    color_texto_barras    = "white",
    color_texto_barras_fuera = NULL,
    size_texto_barras     = 3,
    size_texto_barras_peq = NULL,
    etiquetas_uniformes   = FALSE,
    repeler_etiquetas_peq = TRUE,
    desplazamiento_max_etiquetas_peq = 0.07,
    etiquetas_peq_factor_ancho = 1.25,
    etiquetas_peq_padding = 0.008,
    etiquetas_peq_max_iter = 16L,
    etiquetas_peq_sesgo_derecha = 0.5,
    etiquetas_peq_confinadas = FALSE,
    etiquetas_peq_margen_interno = 0,
    etiquetas_arriba_si_no_caben = FALSE,
    etiquetas_arriba_offset = 0.13,
    color_conectores_etiquetas = c("segmento", "azul_pulso"),
    posicion_conector_etiquetas = c("centro", "izquierda", "derecha"),
    linewidth_conectores_etiquetas = 0.32,
    color_barra_extra     = "#000000",
    # 3 pt no es un tamano, es un borron. La columna extra lleva la cifra que
    # resume la lamina —el top-two-box— y salia mas pequena que cualquier otro
    # texto del grafico; dos rutas del motor ya la subian a 11 a mano, senal de
    # que el defecto nunca sirvio. Se alinea con `size_ejes` para que la cifra
    # pese lo que pesa un rotulo de barra.
    size_barra_extra      = 10,
    size_titulo_extra     = 8.5,
    color_ejes            = "#000000",
    size_ejes             = 9,
    color_titulos_grupo   = NULL,
    size_titulos_grupo    = NULL,
    color_fondo           = NA,
    font_family           = "Arial",

    grosor_barras         = 0.7,
    extra_derecha_rel     = 0.10,
    espacio_izquierda_rel = 0,
    ancho_max_eje_y       = NULL,

    mostrar_leyenda       = TRUE,
    leyenda_posicion      = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),
    invertir_leyenda      = FALSE,
    invertir_barras       = FALSE,
    invertir_segmentos    = FALSE,
    textos_negrita        = NULL,

    # ==========================
    # BOXES POR LABEL
    # ==========================
    top2box_labels     = NULL,  # ej: c("De acuerdo","Muy de acuerdo")
    top3box_labels     = NULL,  # ej: c("Algo de acuerdo","De acuerdo","Muy de acuerdo")
    bottom2box_labels  = NULL,   # ej: c("Nada de acuerdo","En desacuerdo")

    # ==========================
    # CANVAS CONTROLADO
    # ==========================
    usar_canvas           = FALSE,
    var_grupo_id          = NULL,
    var_grupo_titulo      = NULL,
    canvas_w_grupo        = 0,
    # Porcion de la lamina que ocupa este grafico. El motor la pasa a cada
    # sub-bloque de escalas mixtas, donde la fila mide la mitad y el titulo tiene
    # que encogerse igual.
    titulos_grupo_alto_rel = 1,
    canvas_w_buf_grupo_etq= 0,
    canvas_gap_grupos     = 0,

    canvas_w_etiquetas      = 0.38,
    canvas_w_buf_etq_bars   = 0.00,
    canvas_w_buf_bars_extra = 0.00,
    canvas_w_bars           = 0.52,
    canvas_w_extra          = 0.10,

    canvas_h_header_in    = 0.75,
    canvas_h_legend_in    = 0.75,
    canvas_h_caption_in   = 0.40,
    canvas_h_reserva_pie_in = 0,
    canvas_h_panel_in     = NULL,
    canvas_h_panel_in_min = 0,
    canvas_h_toprow_in    = 0.18,
    canvas_min_filas      = 1L,
    canvas_pad_bars_y_in  = 0.08,

    # ==========================
    # CONTROL DE GROSOR
    # ==========================
    grosor_modo           = c("manual", "auto"),
    grosor_barras_mult    = 1.00,

    # ==========================
    # LEYENDA
    # ==========================
    legend_key_cm         = 0.30,
    # 6 pt y no 0.20: mismo criterio editorial que agrupadas (P13) — con 0.20
    # el swatch quedaba pegado al texto.
    legend_espaciado      = 6,
    legend_n_por_fila     = 6L,
    legend_ancho_rel      = NULL,
    legend_gap_npc        = 0.018,
    legend_key_aspect_yx  = NULL,

    # ==========================
    # AJUSTES POSICIONALES
    # ==========================
    encabezado_desplazamiento_in = 0,
    encabezado_separacion_in     = 0.14,
    leyenda_desplazamiento_in    = 0,

    # ==========================
    # DEBUG PH
    # ==========================
    debug_ph_bordes       = FALSE,
    debug_ph_col          = "#FF00FF",
    debug_ph_lwd          = 0.6,

    # ==========================
    # EXPORTAR
    # ==========================
    exportar              = c("rplot", "png", "ppt", "word"),
    path_salida           = NULL,
    ancho                 = 10,
    alto                  = 6,
    alto_por_categoria    = NULL,
    dpi                   = 300,

    ppt_append            = TRUE,
    ppt_layout            = "Blank",
    ppt_master            = "Office Theme"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y
  hjust_from_pos <- function(x) switch(x, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)
  normalizar_umbral_prop <- function(x, nombre, default = NULL) {
    if (is.null(x)) return(default)
    x_num <- suppressWarnings(as.numeric(x)[1])
    if (!is.finite(x_num) || is.na(x_num)) {
      stop(sprintf("`%s` debe ser numerico finito.", nombre), call. = FALSE)
    }
    if (x_num < 0 || x_num > 1) {
      stop(sprintf("`%s` debe estar en escala 0-1.", nombre), call. = FALSE)
    }
    x_num
  }

  # deps
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("dplyr", quietly = TRUE))  stop("Requiere dplyr.", call. = FALSE)
  if (!requireNamespace("tidyr", quietly = TRUE))  stop("Requiere tidyr.", call. = FALSE)
  if (!requireNamespace("grid", quietly = TRUE))   stop("Requiere grid.", call. = FALSE)

  escala_valor       <- match.arg(escala_valor)
  exportar           <- match.arg(exportar)
  barra_extra_preset <- match.arg(barra_extra_preset)
  pos_titulo         <- match.arg(pos_titulo)
  pos_nota_pie       <- match.arg(pos_nota_pie)
  grosor_modo        <- match.arg(grosor_modo)
  leyenda_posicion   <- match.arg(leyenda_posicion)
  color_conectores_etiquetas <- match.arg(color_conectores_etiquetas)
  posicion_conector_etiquetas <- match.arg(posicion_conector_etiquetas)
  font_family <- as.character(font_family %||% "Arial")[1]
  if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"
  if (identical(leyenda_posicion, "ninguna")) mostrar_leyenda <- FALSE
  legend_pos_gg <- switch(
    leyenda_posicion,
    abajo = "bottom",
    arriba = "top",
    derecha = "right",
    izquierda = "left",
    ninguna = "none",
    "bottom"
  )
  legend_is_top  <- identical(leyenda_posicion, "arriba")
  legend_is_side <- leyenda_posicion %in% c("derecha", "izquierda")

  legend_ancho_rel <- suppressWarnings(as.numeric(legend_ancho_rel)[1])
  if (!is.finite(legend_ancho_rel) || is.na(legend_ancho_rel) || legend_ancho_rel <= 0) {
    legend_ancho_rel <- NA_real_
  } else {
    legend_ancho_rel <- max(0.15, min(0.98, legend_ancho_rel))
  }
  legend_gap_npc <- suppressWarnings(as.numeric(legend_gap_npc)[1])
  if (!is.finite(legend_gap_npc) || is.na(legend_gap_npc) || legend_gap_npc < 0) {
    legend_gap_npc <- 0.018
  }
  legend_gap_npc <- min(0.12, legend_gap_npc)


  # normalizaciones
  decimales <- suppressWarnings(as.integer(decimales))
  if (length(decimales) < 1L || !is.finite(decimales[1]) || decimales[1] < 0L) decimales <- 0L else decimales <- decimales[1]
  size_texto_barras_peq <- size_texto_barras_peq %||% size_texto_barras
  color_texto_barras_fuera <- color_texto_barras_fuera %||% color_ejes %||% "#081F5C"
  etiquetas_uniformes <- isTRUE(etiquetas_uniformes)
  repeler_etiquetas_peq <- isTRUE(repeler_etiquetas_peq)
  desplazamiento_max_etiquetas_peq <- suppressWarnings(as.numeric(desplazamiento_max_etiquetas_peq)[1])
  if (!is.finite(desplazamiento_max_etiquetas_peq) || is.na(desplazamiento_max_etiquetas_peq) || desplazamiento_max_etiquetas_peq < 0) {
    desplazamiento_max_etiquetas_peq <- 0.07
  }
  etiquetas_peq_factor_ancho <- suppressWarnings(as.numeric(etiquetas_peq_factor_ancho)[1])
  if (!is.finite(etiquetas_peq_factor_ancho) || is.na(etiquetas_peq_factor_ancho) || etiquetas_peq_factor_ancho <= 0) {
    etiquetas_peq_factor_ancho <- 1.25
  }
  etiquetas_peq_padding <- suppressWarnings(as.numeric(etiquetas_peq_padding)[1])
  if (!is.finite(etiquetas_peq_padding) || is.na(etiquetas_peq_padding) || etiquetas_peq_padding < 0) {
    etiquetas_peq_padding <- 0.008
  }
  etiquetas_peq_max_iter <- suppressWarnings(as.integer(etiquetas_peq_max_iter)[1])
  if (!is.finite(etiquetas_peq_max_iter) || is.na(etiquetas_peq_max_iter) || etiquetas_peq_max_iter < 1L) {
    etiquetas_peq_max_iter <- 16L
  }
  etiquetas_peq_sesgo_derecha <- suppressWarnings(as.numeric(etiquetas_peq_sesgo_derecha)[1])
  if (!is.finite(etiquetas_peq_sesgo_derecha) || is.na(etiquetas_peq_sesgo_derecha)) {
    etiquetas_peq_sesgo_derecha <- 0.5
  }
  etiquetas_peq_sesgo_derecha <- max(0, min(1, etiquetas_peq_sesgo_derecha))
  etiquetas_peq_confinadas <- isTRUE(etiquetas_peq_confinadas)
  etiquetas_peq_margen_interno <- suppressWarnings(as.numeric(etiquetas_peq_margen_interno)[1])
  if (!is.finite(etiquetas_peq_margen_interno) || is.na(etiquetas_peq_margen_interno) || etiquetas_peq_margen_interno < 0) {
    etiquetas_peq_margen_interno <- 0
  }
  umbral_etiqueta_legacy <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta)) NULL else umbral_etiqueta,
    "umbral_etiqueta",
    default = NULL
  )
  umbral_etiqueta_peq_legacy <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta_peq)) NULL else umbral_etiqueta_peq,
    "umbral_etiqueta_peq",
    default = NULL
  )
  umbral_mostrar_etiqueta <- normalizar_umbral_prop(
    if (missing(umbral_mostrar_etiqueta)) NULL else umbral_mostrar_etiqueta,
    "umbral_mostrar_etiqueta",
    default = NULL
  )
  umbral_etiqueta_normal <- normalizar_umbral_prop(
    if (missing(umbral_etiqueta_normal)) NULL else umbral_etiqueta_normal,
    "umbral_etiqueta_normal",
    default = NULL
  )
  umbral_ocultar_etiqueta_eff <- normalizar_umbral_prop(
    if (missing(umbral_ocultar_etiqueta)) NULL else umbral_ocultar_etiqueta,
    "umbral_ocultar_etiqueta",
    default = 0
  )

  usa_umbrales_explicitos <- !is.null(umbral_mostrar_etiqueta) || !is.null(umbral_etiqueta_normal)
  if (usa_umbrales_explicitos) {
    umbral_mostrar_etiqueta_eff <- umbral_mostrar_etiqueta %||% umbral_etiqueta_peq_legacy %||% 0.001
    umbral_etiqueta_normal_eff  <- umbral_etiqueta_normal %||% umbral_etiqueta_legacy %||% umbral_mostrar_etiqueta_eff
  } else {
    umbral_etiqueta_normal_eff  <- umbral_etiqueta_legacy %||% 0.001
    umbral_mostrar_etiqueta_eff <- umbral_etiqueta_peq_legacy %||% umbral_etiqueta_normal_eff
  }
  # `umbral_mostrar_etiqueta` controla ubicacion dentro/fuera del segmento,
  # mientras `umbral_etiqueta_normal` controla tamano. Pueden ser distintos.

  hjust_titulo  <- hjust_from_pos(pos_titulo)
  hjust_caption <- hjust_from_pos(pos_nota_pie)

  textos_negrita <- textos_negrita %||% character(0)
  if ("valores" %in% textos_negrita && !("porcentajes" %in% textos_negrita)) {
    textos_negrita <- c(textos_negrita, "porcentajes")
  }

  pulso_azul  <- "#002768"
  pulso_verde <- "#70AD47"

  # validaciones
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (is.null(var_etiqueta_categoria)) var_etiqueta_categoria <- var_categoria
  if (!var_etiqueta_categoria %in% names(data)) stop("`var_etiqueta_categoria` no existe en `data`.", call. = FALSE)
  if (!var_n %in% names(data))         stop("`var_n` no existe en `data`.", call. = FALSE)
  if (!all(cols_porcentaje %in% names(data))) {
    faltan <- cols_porcentaje[!cols_porcentaje %in% names(data)]
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (!all(names(etiquetas_grupos) %in% cols_porcentaje)) {
    stop("Los names de `etiquetas_grupos` deben coincidir con `cols_porcentaje`.", call. = FALSE)
  }
  cols_n_map <- NULL
  if (!is.null(cols_n)) {
    if (is.list(cols_n) && !is.data.frame(cols_n)) cols_n <- unlist(cols_n, use.names = TRUE)
    cols_n <- as.character(cols_n)
    cols_n <- cols_n[nzchar(trimws(cols_n))]
    if (length(cols_n)) {
      nm_cols_n <- names(cols_n)
      if (is.null(nm_cols_n) || !all(nzchar(trimws(nm_cols_n)))) {
        if (length(cols_n) != length(cols_porcentaje)) {
          stop("`cols_n` sin nombres debe tener el mismo largo que `cols_porcentaje`.", call. = FALSE)
        }
        names(cols_n) <- cols_porcentaje
      }
      names(cols_n) <- trimws(names(cols_n))
      cols_n <- trimws(cols_n)
      if (!all(names(cols_n) %in% cols_porcentaje)) {
        stop("Los names de `cols_n` deben coincidir con `cols_porcentaje`.", call. = FALSE)
      }
      if (!all(cols_porcentaje %in% names(cols_n))) {
        faltan_map <- cols_porcentaje[!cols_porcentaje %in% names(cols_n)]
        stop("`cols_n` no define frecuencia para: ", paste(faltan_map, collapse = ", "), call. = FALSE)
      }
      faltan_n <- unname(cols_n)[!unname(cols_n) %in% names(data)]
      if (length(faltan_n)) {
        stop("Faltan columnas de frecuencia en `data`: ", paste(faltan_n, collapse = ", "), call. = FALSE)
      }
      cols_n_map <- cols_n[cols_porcentaje]
    }
  }
  usar_grupos_canvas <- isTRUE(usar_canvas) &&
    is.character(var_grupo_id) && length(var_grupo_id) == 1L && nzchar(trimws(var_grupo_id))
  if (usar_grupos_canvas) {
    var_grupo_id <- trimws(var_grupo_id)
    if (!var_grupo_id %in% names(data)) stop("`var_grupo_id` no existe en `data`.", call. = FALSE)
    if (!is.character(var_grupo_titulo) || length(var_grupo_titulo) != 1L || !nzchar(trimws(var_grupo_titulo))) {
      stop("`var_grupo_titulo` debe ser character(1) no vacío cuando se usa `var_grupo_id`.", call. = FALSE)
    }
    var_grupo_titulo <- trimws(var_grupo_titulo)
    if (!var_grupo_titulo %in% names(data)) stop("`var_grupo_titulo` no existe en `data`.", call. = FALSE)
  } else {
    var_grupo_id     <- NULL
    var_grupo_titulo <- NULL
  }
  color_titulos_grupo <- color_titulos_grupo %||% color_ejes
  size_titulos_grupo  <- size_titulos_grupo  %||% size_ejes

  df <- data
  row_id_col <- ".pulso_tmp_row_id"
  while (row_id_col %in% names(df)) row_id_col <- paste0(row_id_col, "_")
  df[[row_id_col]] <- seq_len(nrow(df))
  cat_map <- df |>
    dplyr::mutate(
      .cat_id    = as.character(.data[[var_categoria]]),
      .cat_label = as.character(.data[[var_etiqueta_categoria]])
    ) |>
    dplyr::mutate(
      .cat_label = ifelse(is.na(.data$.cat_label), "", .data$.cat_label),
      .group_id = if (!is.null(var_grupo_id)) as.character(.data[[var_grupo_id]]) else NA_character_,
      .group_title = if (!is.null(var_grupo_titulo)) as.character(.data[[var_grupo_titulo]]) else NA_character_
    ) |>
    dplyr::select(".cat_id", ".cat_label", ".group_id", ".group_title") |>
    dplyr::distinct(.data$.cat_id, .keep_all = TRUE)

  # ---------------------------------------------------------------------------
  # 1) Ancho -> Largo
  # ---------------------------------------------------------------------------
  df_long <- df |>
    dplyr::select(dplyr::all_of(c(row_id_col, var_categoria, var_n, cols_porcentaje))) |>
    tidyr::pivot_longer(
      cols      = dplyr::all_of(cols_porcentaje),
      names_to  = ".col_pct",
      values_to = ".valor"
    ) |>
    dplyr::mutate(.grupo = dplyr::recode(.data$.col_pct, !!!etiquetas_grupos))

  if (!is.numeric(df_long$.valor)) stop("Las columnas de porcentaje deben ser numéricas.", call. = FALSE)

  df_long$.valor_raw_plot <- if (escala_valor == "proporcion_100") df_long$.valor / 100 else df_long$.valor
  df_long$.valor_plot <- df_long$.valor_raw_plot
  df_long$.valor_plot[!is.finite(df_long$.valor_plot) | is.na(df_long$.valor_plot)] <- 0

  if (!is.null(cols_n_map)) {
    n_long <- do.call(rbind, lapply(cols_porcentaje, function(col_pct) {
      data.frame(
        .pulso_tmp_join_id = df[[row_id_col]],
        .col_pct = col_pct,
        .n_label_val = suppressWarnings(as.numeric(df[[cols_n_map[[col_pct]]]])),
        stringsAsFactors = FALSE
      )
    }))
    names(n_long)[names(n_long) == ".pulso_tmp_join_id"] <- row_id_col
    df_long <- dplyr::left_join(df_long, n_long, by = c(row_id_col, ".col_pct"))
  } else if (isTRUE(mostrar_n_en_etiquetas)) {
    df_long$.n_label_val <- suppressWarnings(as.numeric(df_long[[var_n]]) * df_long$.valor_raw_plot)
  }

  # Normalizar por categoría a suma 1
  df_long <- df_long |>
    dplyr::group_by(.data[[var_categoria]]) |>
    dplyr::mutate(
      .suma_raw   = sum(.valor_plot, na.rm = TRUE),
      .valor_plot = dplyr::if_else(.suma_raw > 0, .valor_plot / .suma_raw, 0)
    ) |>
    dplyr::ungroup()

  # Blindaje
  df_long$.valor_plot <- pmax(0, pmin(1, df_long$.valor_plot))

  # Orden de segmentos (DEBE IR ANTES del cierre exacto)
  niveles_originales <- unname(etiquetas_grupos)
  niveles_stack      <- if (invertir_segmentos) niveles_originales else rev(niveles_originales)
  niveles_leyenda    <- if (invertir_leyenda)  rev(niveles_originales) else niveles_originales
  etiquetas_leyenda_resueltas <- niveles_leyenda
  if (!is.null(etiquetas_leyenda)) {
    etiquetas_leyenda_names <- names(etiquetas_leyenda)
    etiquetas_leyenda <- if (is.list(etiquetas_leyenda) && !is.data.frame(etiquetas_leyenda)) {
      unlist(etiquetas_leyenda, use.names = FALSE)
    } else {
      as.character(etiquetas_leyenda)
    }
    etiquetas_leyenda <- as.character(etiquetas_leyenda)
    if (!is.null(etiquetas_leyenda_names) &&
        length(etiquetas_leyenda_names) == length(etiquetas_leyenda)) {
      names(etiquetas_leyenda) <- etiquetas_leyenda_names
    }
    etiquetas_leyenda[is.na(etiquetas_leyenda)] <- ""
    if (!is.null(names(etiquetas_leyenda)) && any(nzchar(names(etiquetas_leyenda)))) {
      hit <- etiquetas_leyenda[niveles_leyenda]
      ok <- !is.na(hit) & nzchar(trimws(hit))
      etiquetas_leyenda_resueltas[ok] <- unname(hit[ok])
    } else if (length(etiquetas_leyenda) == length(niveles_originales)) {
      vals <- if (invertir_leyenda) rev(etiquetas_leyenda) else etiquetas_leyenda
      ok <- nzchar(trimws(vals))
      etiquetas_leyenda_resueltas[ok] <- vals[ok]
    }
  }
  df_long$.grupo     <- factor(df_long$.grupo, levels = niveles_stack)

  # ---------------------------------------------------------------------------
  # 1.05) CIERRE EXACTO A 1
  # Ajusta SOLO el ÚLTIMO del stack (derecha) para absorber residuo numérico.
  # ---------------------------------------------------------------------------
  target_level <- tail(niveles_stack, 1)

  df_long <- df_long |>
    dplyr::group_by(.data[[var_categoria]]) |>
    dplyr::mutate(
      .sum1  = sum(.valor_plot, na.rm = TRUE),
      .delta = 1 - .sum1,
      .valor_plot = dplyr::if_else(
        .data$.grupo == target_level,
        .valor_plot + .delta,
        .valor_plot
      ),
      .valor_plot = pmax(0, .valor_plot)
    ) |>
    dplyr::mutate(
      .sum2 = sum(.valor_plot, na.rm = TRUE),
      .valor_plot = dplyr::if_else(.sum2 > 0, .valor_plot / .sum2, 0)
    ) |>
    dplyr::ungroup() |>
    dplyr::select(-.sum1, -.delta, -.sum2)

  # ---------------------------------------------------------------------------
  # 1.1) ORDEN MASTER de categorías (FIJO)
  # ---------------------------------------------------------------------------
  cat_lvls <- unique(as.character(cat_map$.cat_id))
  if (invertir_barras) cat_lvls <- rev(cat_lvls)

  cat_layout <- cat_map[match(cat_lvls, cat_map$.cat_id), , drop = FALSE]
  rownames(cat_layout) <- NULL
  n_categorias <- length(cat_lvls)
  plot_cat_lvls <- cat_lvls

  wrap_eje_y_eff <- ancho_max_eje_y
  ancho_eje_y_num <- suppressWarnings(as.numeric(ancho_max_eje_y)[1])
  if (!is.finite(ancho_eje_y_num) || is.na(ancho_eje_y_num) || ancho_eje_y_num <= 0) {
    ancho_eje_y_num <- NA_real_
  }
  size_ejes_num <- suppressWarnings(as.numeric(size_ejes)[1])
  if (!is.finite(size_ejes_num) || is.na(size_ejes_num) || size_ejes_num <= 0) {
    size_ejes_num <- 9
  }
  cat_label_chars <- nchar(as.character(cat_layout$.cat_label), type = "width", allowNA = FALSE, keepNA = FALSE)
  cat_label_chars[!is.finite(cat_label_chars)] <- 0
  max_cat_label_chars <- if (length(cat_label_chars)) max(cat_label_chars, na.rm = TRUE) else 0
  if (!is.finite(max_cat_label_chars)) max_cat_label_chars <- 0

  if (isTRUE(usar_canvas) && is.finite(ancho_eje_y_num) &&
      n_categorias <= 4L && max_cat_label_chars >= 95) {
    # En OE y competencias largas, un wrap demasiado ancho corta el texto por
    # la izquierda. Preferimos mas lineas y compensamos con mayor alto/separacion.
    ancho_eje_y_num <- min(ancho_eje_y_num, 40)
    wrap_eje_y_eff <- ancho_eje_y_num
  }
  lineas_eje_y_est <- if (is.finite(ancho_eje_y_num) && ancho_eje_y_num > 0) {
    pmax(1, ceiling(cat_label_chars / ancho_eje_y_num))
  } else {
    rep(1, length(cat_label_chars))
  }
  max_lineas_eje_y_est <- if (length(lineas_eje_y_est)) max(lineas_eje_y_est, na.rm = TRUE) else 1
  if (!is.finite(max_lineas_eje_y_est) || is.na(max_lineas_eje_y_est)) max_lineas_eje_y_est <- 1
  needs_tall_label_slot <- isTRUE(usar_canvas) && n_categorias <= 4L && max_lineas_eje_y_est >= 5

  min_filas_canvas <- suppressWarnings(as.integer(canvas_min_filas)[1])
  if (!is.finite(min_filas_canvas) || is.na(min_filas_canvas) || min_filas_canvas < 1L) {
    min_filas_canvas <- 1L
  }

  usar_y_numerico <- isTRUE(usar_canvas)
  min_filas_layout <- min_filas_canvas
  if (usar_y_numerico && n_categorias == 1L) {
    min_filas_layout <- max(min_filas_layout, 2L)
  }
  y_axis_max <- max(1, n_categorias)
  if (usar_y_numerico) {
    gap_grupos_eff <- if (isTRUE(usar_grupos_canvas)) suppressWarnings(as.numeric(canvas_gap_grupos)) else 0
    if (!is.finite(gap_grupos_eff) || is.na(gap_grupos_eff) || gap_grupos_eff < 0) gap_grupos_eff <- 0
    row_step_eff <- if (isTRUE(etiquetas_arriba_si_no_caben)) 1.72 else 1
    if (n_categorias <= 4L && max_lineas_eje_y_est >= 5) {
      row_step_eff <- max(row_step_eff, min(3.20, 1.16 + max_lineas_eje_y_est * 0.28))
    }

    y_from_top <- numeric(n_categorias)
    offset_top <- 0
    for (i in seq_len(n_categorias)) {
      y_from_top[i] <- offset_top
      offset_top <- offset_top + row_step_eff
      if (i < n_categorias) {
        grp_i <- cat_layout$.group_id[i] %||% ""
        grp_n <- cat_layout$.group_id[i + 1] %||% ""
        if (!identical(grp_i, grp_n)) offset_top <- offset_top + gap_grupos_eff * row_step_eff
      }
    }
    max_from_top_obs <- if (length(y_from_top)) max(y_from_top) else 0
    filas_obs <- max_from_top_obs + 1
    if (!is.finite(filas_obs) || is.na(filas_obs) || filas_obs < 1) filas_obs <- 1

    # Reservar filas virtuales evita que un gráfico con una sola categoría se
    # vea como una barra gigante aislada dentro del panel PPT.
    y_axis_max <- max(filas_obs, if (isTRUE(usar_canvas)) min_filas_layout else 1)
    y_shift <- (y_axis_max - filas_obs) / 2
    cat_layout$.y_plot <- ((max_from_top_obs - y_from_top) + 1) + y_shift
    df_long$.y_plot <- cat_layout$.y_plot[match(as.character(df_long[[var_categoria]]), cat_layout$.cat_id)]
  } else {
    cat_chr  <- as.character(df_long[[var_categoria]])
    # En ejes discretos, ggplot dibuja el ultimo nivel arriba. Invertimos los
    # levels de ploteo para que el primer elemento de `cat_lvls` quede arriba,
    # igual que en el modo con y numerico (grupos canvas).
    plot_cat_lvls <- rev(cat_lvls)
    df_long[[var_categoria]] <- factor(cat_chr, levels = plot_cat_lvls)
    cat_layout$.y_plot <- match(cat_layout$.cat_id, plot_cat_lvls)
    y_axis_max <- max(1, n_categorias)
  }

  # ---------------------------------------------------------------------------
  # 1.5) Grosor de barras
  # ---------------------------------------------------------------------------
  n_categorias_grosor <- if (isTRUE(usar_canvas)) max(n_categorias, min_filas_layout) else n_categorias
  if (grosor_modo == "auto") {
    grosor_eff <- .auto_bar_width_apiladas(
      n_categorias = n_categorias_grosor,
      grosor_barras_mult = grosor_barras_mult,
      usar_grupos_canvas = usar_grupos_canvas,
      n_reales = n_categorias
    )
  } else {
    grosor_eff <- grosor_barras
  }

  # Piso editorial para UNA fila real bajo filas virtuales (B36/G-2): tanto el
  # 0.7 manual por defecto como el auto (~0.59) dejaban la banda en ~22-26%
  # del panel — "barra muy delgada y poco profesional". Subimos a ~35%
  # conservando el centrado. Solo pisamos la banda tipica de defaults
  # [0.55, 0.85]: un grosor explicito fuera de ese rango es intencion del
  # analista y se respeta.
  if (isTRUE(usar_canvas) && n_categorias == 1L && min_filas_layout > 1L &&
      is.finite(grosor_eff) && grosor_eff >= 0.55 && grosor_eff <= 0.85) {
    grosor_eff <- 0.95
  }

  label_fit_scale <- 1
  if (isTRUE(usar_canvas)) {
    raw_group <- if (isTRUE(usar_grupos_canvas)) canvas_w_grupo else 0
    raw_buf0  <- if (isTRUE(usar_grupos_canvas)) canvas_w_buf_grupo_etq else 0
    raw_sum <- raw_group + raw_buf0 + canvas_w_etiquetas + canvas_w_buf_etq_bars +
      canvas_w_bars + canvas_w_buf_bars_extra + canvas_w_extra
    if (is.finite(raw_sum) && raw_sum > 0 && is.finite(canvas_w_bars) && canvas_w_bars > 0) {
      bar_width_rel <- canvas_w_bars / raw_sum
      label_fit_scale <- 0.59 / max(0.25, bar_width_rel)
      label_fit_scale <- max(0.55, min(1.35, label_fit_scale))
    }
  }

  # ---------------------------------------------------------------------------
  # 2) BARRAS
  # ---------------------------------------------------------------------------
  y_axis_extra_top <- 0
  y_axis_extra_bottom <- 0
  if (usar_y_numerico && isTRUE(etiquetas_arriba_si_no_caben)) {
    offset_top_labels <- suppressWarnings(as.numeric(etiquetas_arriba_offset)[1])
    if (!is.finite(offset_top_labels) || is.na(offset_top_labels) || offset_top_labels <= 0) {
      offset_top_labels <- 0.13
    }
    y_axis_extra_top <- max(0.16, offset_top_labels + 0.06)
    y_axis_extra_bottom <- 0.55
  }

  max_suma <- 1
  x_max_bars <- if (usar_canvas) 1 else if (mostrar_barra_extra) max_suma * (1 + extra_derecha_rel) else max_suma

  expand_x <- if (usar_canvas) {
    ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
  } else {
    ggplot2::expansion(mult = c(espacio_izquierda_rel, 0.05))
  }

  p_bars <- ggplot2::ggplot(
    df_long,
    ggplot2::aes(
      x    = .data$.valor_plot,
      y    = if (usar_y_numerico) .data$.y_plot else .data[[var_categoria]],
      fill = .data$.grupo
    )
  ) +
    ggplot2::geom_col(width = grosor_eff, orientation = "y",
                      key_glyph = .graficos_key_glyph_cuadrado(legend_key_cm)) +
    ggplot2::scale_x_continuous(expand = expand_x) +
    {
      if (usar_y_numerico) {
        ggplot2::scale_y_continuous(
          breaks = cat_layout$.y_plot,
          labels = rep("", n_categorias),
          limits = c(0.5 - y_axis_extra_bottom, y_axis_max + 0.5 + y_axis_extra_top),
          expand = ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
        )
      } else {
        ggplot2::scale_y_discrete(
          limits = plot_cat_lvls, drop = FALSE,
          expand = ggplot2::expansion(mult = c(0, 0), add = c(0, 0))
        )
      }
    } +
    ggplot2::coord_cartesian(
      xlim = c(0, x_max_bars),
      clip = "off"
    ) +
    ggplot2::theme_minimal(base_size = 9, base_family = font_family) +
    ggplot2::theme(
      panel.grid.major = ggplot2::element_blank(),
      panel.grid.minor = ggplot2::element_blank(),
      axis.title       = ggplot2::element_blank(),
      axis.text.x      = ggplot2::element_blank(),
      axis.ticks.x     = ggplot2::element_blank(),
      legend.position  = "none",
      axis.text.y      = ggplot2::element_blank(),
      axis.ticks.y     = ggplot2::element_blank(),
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin      = ggplot2::margin(0,0,0,0)
    )

  # ---------------------------------------------------------------------------
  # 3) Etiquetas internas (%) con asignación exacta (suma 100.00 si decimales=2, etc.)
  # ---------------------------------------------------------------------------
  labels_arriba_activas <- FALSE
  labels_rendered <- character(0)
  if (isTRUE(mostrar_valores)) {

    niveles_fill       <- levels(df_long$.grupo)
    niveles_stack_real <- rev(niveles_fill)

    df_lab <- df_long |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::arrange(factor(.grupo, levels = niveles_stack_real), .by_group = TRUE) |>
      dplyr::mutate(
        x_right = cumsum(.valor_plot),
        x_left = x_right - .valor_plot,
        x_center = x_left + .valor_plot / 2
      ) |>
      dplyr::ungroup()

    .asignar_pct_exacto <- function(p, dec) {
      p[is.na(p) | !is.finite(p)] <- 0
      s <- sum(p)
      if (s <= 0) return(rep.int(0L, length(p)))
      p <- p / s

      escala <- 10^dec
      target_units <- as.integer(100L * escala)

      x_units <- p * target_units
      base <- floor(x_units)
      resto <- target_units - sum(base)

      if (resto > 0L) {
        frac <- x_units - base
        idx <- order(frac, decreasing = TRUE)
        base[idx[seq_len(resto)]] <- base[idx[seq_len(resto)]] + 1L
      }
      as.integer(base)
    }

    .fmt_units_pct <- function(units, dec){
      escala <- 10^dec
      val <- units / escala
      out <- format(val, nsmall = dec, trim = TRUE, scientific = FALSE)
      paste0(out, "%")
    }

    .fmt_count_label <- function(x) {
      x <- suppressWarnings(as.numeric(x))
      out <- rep("", length(x))
      ok <- is.finite(x) & !is.na(x)
      out[ok] <- format(round(x[ok]), big.mark = ",", scientific = FALSE, trim = TRUE)
      out
    }

    df_lab <- df_lab |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::mutate(
        .pct_units = .asignar_pct_exacto(.valor_plot, decimales),
        lab        = .fmt_units_pct(.pct_units, decimales)
      ) |>
      dplyr::ungroup()

    if (".n_label_val" %in% names(df_lab)) {
      etiquetas <- .apiladas_etiquetas_con_frecuencia(
        df_lab$lab,
        .fmt_count_label(df_lab$.n_label_val),
        mostrar_n_en_etiquetas
      )
      df_lab$lab <- etiquetas$lab
      df_lab$.lab_arriba <- etiquetas$lab_arriba
    } else {
      df_lab$.lab_arriba <- df_lab$lab
    }

    if (isTRUE(etiquetas_uniformes)) {
      label_offset <- min(0.012, max(0.004, etiquetas_peq_padding * 0.5))
      fit_padding <- min(0.004, max(0.002, etiquetas_peq_padding * 0.25))
      df_lab <- df_lab |>
        dplyr::mutate(
          .mostrar = .valor_plot > umbral_ocultar_etiqueta_eff,
          .size_label = size_texto_barras,
          .label_fit_scale = label_fit_scale,
          .label_fit_width = .estimate_label_fit_width_apiladas(lab, .size_label) * .label_fit_scale,
          .entra_segmento = .mostrar &
            is.finite(.valor_plot) &
            .valor_plot >= (.label_fit_width + 2 * fit_padding),
          .label_fuera = .mostrar & !.entra_segmento,
          x_label = dplyr::case_when(
            .label_fuera & x_center <= 0.5 ~ pmin(0.985, pmax(0.015, x_right + label_offset)),
            .label_fuera                   ~ pmax(0.015, pmin(0.985, x_left - label_offset)),
            TRUE                          ~ x_center
          ),
          .hjust_label = dplyr::case_when(
            .label_fuera & x_center <= 0.5 ~ 0,
            .label_fuera                   ~ 1,
            TRUE                           ~ 0.5
          ),
          .repel_x_min = dplyr::case_when(
            .label_fuera & x_center > 0.5  ~ -0.08,
            .label_fuera & x_center <= 0.5 ~ x_right + label_offset,
            TRUE                           ~ x_left + fit_padding
          ),
          .repel_x_max = dplyr::case_when(
            .label_fuera & x_center <= 0.5 ~ 1.08,
            .label_fuera & x_center > 0.5  ~ x_left - label_offset,
            TRUE                           ~ x_right - fit_padding
          ),
          .col_label = dplyr::if_else(.label_fuera, color_texto_barras_fuera, color_texto_barras),
          .fijar_label = FALSE,
          .forzar_fuera = FALSE
        ) |>
        dplyr::filter(.mostrar, is.finite(x_center))

      if (!isTRUE(etiquetas_arriba_si_no_caben) && nrow(df_lab) > 1L) {
        idx_por_cat_borde <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat_borde) {
          idx_izq <- idx[df_lab$.label_fuera[idx] & df_lab$x_center[idx] <= 0.5]
          if (length(idx_izq) < 2L) next
          df_lab <- .dejar_max_una_label_fuera_izq_apiladas(
            df_lab,
            idx_izq = idx_izq,
            label_offset = label_offset,
            fit_padding = fit_padding,
            etiquetas_peq_padding = etiquetas_peq_padding,
            color_texto_barras = color_texto_barras
          )
        }
      }

      if (nrow(df_lab) > 1L) {
        idx_por_cat_colision <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        collision_padding <- max(etiquetas_peq_padding, 0.018)
        for (idx in idx_por_cat_colision) {
          if (length(idx) < 2L) next
          ord <- idx[order(df_lab$x_label[idx], seq_along(idx))]
          widths <- .estimate_label_width_apiladas(df_lab$lab[ord], df_lab$.size_label[ord]) * 1.35
          for (pos in seq_len(length(ord) - 1L)) {
            i <- ord[pos]
            j <- ord[pos + 1L]
            if (!is.finite(df_lab$x_label[i]) || !is.finite(df_lab$x_label[j])) next
            if (df_lab$x_label[i] < df_lab$x_left[i]) next
            if (df_lab$x_center[i] > 0.5) next
            if (!isTRUE(df_lab$.label_fuera[i])) next

            span_right_i <- df_lab$x_label[i] + (1 - df_lab$.hjust_label[i]) * widths[pos]
            span_left_j <- df_lab$x_label[j] - df_lab$.hjust_label[j] * widths[pos + 1L]
            if (is.finite(span_left_j - span_right_i) && span_left_j - span_right_i >= collision_padding) next

            anchor <- max(fit_padding, min(df_lab$x_right[i] + label_offset, 1 - fit_padding))
            df_lab$x_label[i] <- anchor
            df_lab$.hjust_label[i] <- 0
            df_lab$.repel_x_min[i] <- max(fit_padding, df_lab$x_left[i] + fit_padding)
            df_lab$.repel_x_max[i] <- 1 - fit_padding
          }
        }
      }

      if (isTRUE(repeler_etiquetas_peq) &&
          desplazamiento_max_etiquetas_peq > 0 &&
          nrow(df_lab) > 1L) {
        idx_por_cat <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat) {
          if (length(idx) < 2L) next
          repel_width_factor <- if (any(df_lab$.label_fuera[idx])) {
            max(etiquetas_peq_factor_ancho, 1.65)
          } else {
            min(etiquetas_peq_factor_ancho, 0.90)
          }
          df_lab$x_label[idx] <- .repel_label_positions_apiladas(
            x = df_lab$x_label[idx],
            labels = df_lab$lab[idx],
            label_size = df_lab$.size_label[idx],
            movable = {
              fijo <- as.logical(df_lab$.fijar_label[idx])
              fijo[is.na(fijo)] <- FALSE
              !fijo
            },
            hjust = df_lab$.hjust_label[idx],
            max_shift = desplazamiento_max_etiquetas_peq,
            x_min = df_lab$.repel_x_min[idx],
            x_max = df_lab$.repel_x_max[idx],
            padding = etiquetas_peq_padding,
            max_iter = etiquetas_peq_max_iter,
            bias_right = etiquetas_peq_sesgo_derecha,
            edge_margin = if (etiquetas_peq_confinadas) etiquetas_peq_margen_interno else 0,
            width_factor = repel_width_factor,
            bias_toward_center = TRUE
          )
        }
      }

      df_lab <- .posicionar_labels_arriba_si_no_caben_apiladas(
        df_lab,
        var_categoria = var_categoria,
        usar_y_numerico = usar_y_numerico && isTRUE(etiquetas_arriba_si_no_caben),
        grosor_eff = grosor_eff,
        fit_padding = fit_padding,
        etiquetas_peq_padding = etiquetas_peq_padding,
        color_texto_barras_fuera = color_texto_barras_fuera,
        colores_grupos = colores_grupos,
        color_conectores_etiquetas = color_conectores_etiquetas,
        posicion_conector_etiquetas = posicion_conector_etiquetas,
        offset_y = etiquetas_arriba_offset
      )
      arriba_idx <- if (".label_arriba" %in% names(df_lab)) df_lab$.label_arriba %in% TRUE else rep(FALSE, nrow(df_lab))
      df_lab_arriba <- df_lab[arriba_idx, , drop = FALSE]
      df_lab_dentro <- df_lab[!arriba_idx, , drop = FALSE]
      df_lab_dentro <- if (isTRUE(etiquetas_arriba_si_no_caben)) {
        .centrar_labels_interiores_segmento_apiladas(
          df_lab_dentro,
          color_texto_barras = color_texto_barras
        )
      } else {
        .finalizar_labels_interiores_apiladas(
          df_lab_dentro,
          var_categoria = var_categoria,
          color_texto_barras = color_texto_barras,
          color_texto_barras_fuera = color_texto_barras_fuera,
          fit_padding = fit_padding,
          etiquetas_peq_padding = etiquetas_peq_padding,
          width_factor = 2.10
        )
      }
      df_lab <- dplyr::bind_rows(df_lab_dentro, df_lab_arriba)

      if (nrow(df_lab) > 0) {
        arriba_plot_idx <- if (".label_arriba" %in% names(df_lab)) {
          df_lab$.label_arriba %in% TRUE
        } else {
          rep(FALSE, nrow(df_lab))
        }
        df_lab_arriba_plot <- df_lab[arriba_plot_idx, , drop = FALSE]
        if (nrow(df_lab_arriba_plot) > 0) {
          labels_arriba_activas <- TRUE
          p_bars <- p_bars +
            ggplot2::geom_segment(
              data = df_lab_arriba_plot,
              mapping = ggplot2::aes(
                x = x_conector_label,
                xend = x_conector_barra,
                y = y_conector_label,
                yend = y_conector_barra,
                colour = .data$.col_conector
              ),
              linewidth = linewidth_conectores_etiquetas,
              lineend = "round",
              inherit.aes = FALSE,
              show.legend = FALSE
            )
        }
        labels_rendered <- as.character(df_lab$lab)
        p_bars <- p_bars +
          ggplot2::geom_text(
            data    = df_lab,
            mapping = ggplot2::aes(
              x = x_label,
              y = if (usar_y_numerico) .data$y_label else .data[[var_categoria]],
              label = lab,
              colour = .data$.col_label,
              hjust = .data$.hjust_label
            ),
            size    = size_texto_barras,
            family  = font_family,
            fontface = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
            inherit.aes = FALSE,
            show.legend = FALSE
          ) +
          ggplot2::scale_colour_identity(guide = "none")
      }
    } else {
      label_offset <- min(0.012, max(0.004, etiquetas_peq_padding * 0.5))
      fit_padding <- min(0.004, max(0.002, etiquetas_peq_padding * 0.25))
      df_lab <- df_lab |>
        dplyr::mutate(
          .tamano_etq = dplyr::case_when(
            .valor_plot <= umbral_ocultar_etiqueta_eff ~ "ninguna",
            .valor_plot >= umbral_etiqueta_normal_eff  ~ "grande",
            .valor_plot > umbral_ocultar_etiqueta_eff  ~ "peq",
            TRUE                                        ~ "ninguna"
          ),
          .size_label = dplyr::if_else(.tamano_etq == "grande", size_texto_barras, size_texto_barras_peq),
          .label_fit_scale = label_fit_scale,
          .label_fit_width = .estimate_label_fit_width_apiladas(lab, .size_label) * .label_fit_scale,
          .entra_segmento = .tamano_etq != "ninguna" &
            is.finite(.valor_plot) &
            .valor_plot >= (.label_fit_width + 2 * fit_padding),
          .label_fuera = .tamano_etq != "ninguna" & !.entra_segmento,
          x_label = dplyr::case_when(
            .label_fuera & x_center <= 0.5 ~ pmin(0.985, pmax(0.015, x_right + label_offset)),
            .label_fuera                   ~ pmax(0.015, pmin(0.985, x_left - label_offset)),
            TRUE                          ~ x_center
          ),
          .hjust_label = dplyr::case_when(
            .label_fuera & x_center <= 0.5 ~ 0,
            .label_fuera                   ~ 1,
            TRUE                           ~ 0.5
          ),
          .col_label = dplyr::if_else(.label_fuera, color_texto_barras_fuera, color_texto_barras),
          .fijar_label = FALSE,
          .forzar_fuera = FALSE
        ) |>
        dplyr::filter(.tamano_etq != "ninguna", is.finite(x_center))

      if (!isTRUE(etiquetas_arriba_si_no_caben) && nrow(df_lab) > 1L) {
        idx_por_cat_borde <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat_borde) {
          idx_izq <- idx[df_lab$.label_fuera[idx] & df_lab$x_center[idx] <= 0.5]
          if (length(idx_izq) < 2L) next
          df_lab <- .dejar_max_una_label_fuera_izq_apiladas(
            df_lab,
            idx_izq = idx_izq,
            label_offset = label_offset,
            fit_padding = fit_padding,
            etiquetas_peq_padding = etiquetas_peq_padding,
            color_texto_barras = color_texto_barras
          )
        }
      }

      if (nrow(df_lab) > 1L) {
        idx_por_cat_colision <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        collision_padding <- max(etiquetas_peq_padding, 0.018)
        for (idx in idx_por_cat_colision) {
          if (length(idx) < 2L) next
          ord <- idx[order(df_lab$x_label[idx], seq_along(idx))]
          widths <- .estimate_label_width_apiladas(df_lab$lab[ord], df_lab$.size_label[ord]) * 1.35
          for (pos in seq_len(length(ord) - 1L)) {
            i <- ord[pos]
            j <- ord[pos + 1L]
            if (!is.finite(df_lab$x_label[i]) || !is.finite(df_lab$x_label[j])) next
            if (df_lab$x_label[i] < df_lab$x_left[i]) next
            if (df_lab$x_center[i] > 0.5) next
            if (!isTRUE(df_lab$.label_fuera[i])) next

            span_right_i <- df_lab$x_label[i] + (1 - df_lab$.hjust_label[i]) * widths[pos]
            span_left_j <- df_lab$x_label[j] - df_lab$.hjust_label[j] * widths[pos + 1L]
            if (is.finite(span_left_j - span_right_i) && span_left_j - span_right_i >= collision_padding) next

            df_lab$x_label[i] <- max(fit_padding, min(df_lab$x_right[i] + label_offset, 1 - fit_padding))
            df_lab$.hjust_label[i] <- 0
          }
        }
      }

      if (isTRUE(repeler_etiquetas_peq) &&
          desplazamiento_max_etiquetas_peq > 0 &&
          nrow(df_lab) > 1L &&
          any(df_lab$.tamano_etq == "peq")) {
        idx_por_cat <- split(seq_len(nrow(df_lab)), as.character(df_lab[[var_categoria]]))
        for (idx in idx_por_cat) {
          if (length(idx) < 2L) next
          repel_width_factor <- if (any(df_lab$.label_fuera[idx])) {
            max(etiquetas_peq_factor_ancho, 1.65)
          } else {
            min(etiquetas_peq_factor_ancho, 0.90)
          }
          fijo_idx <- as.logical(df_lab$.fijar_label[idx])
          fijo_idx[is.na(fijo_idx)] <- FALSE
          movable_idx <- df_lab$.tamano_etq[idx] == "peq" & !fijo_idx
          x_min_idx <- dplyr::if_else(
            df_lab$.label_fuera[idx] & df_lab$x_label[idx] < df_lab$x_left[idx],
            -0.20,
            dplyr::if_else(
              df_lab$.label_fuera[idx] & df_lab$.hjust_label[idx] == 0.5,
              df_lab$x_label[idx],
              dplyr::if_else(
                df_lab$.label_fuera[idx] & df_lab$x_center[idx] <= 0.5,
                df_lab$x_right[idx] + label_offset,
                dplyr::if_else(
                  df_lab$.label_fuera[idx],
                  -0.08,
                  df_lab$x_left[idx] + fit_padding
                )
              )
            )
          )
          x_max_idx <- dplyr::if_else(
            df_lab$.label_fuera[idx] & df_lab$x_label[idx] < df_lab$x_left[idx],
            df_lab$x_label[idx],
            dplyr::if_else(
              df_lab$.label_fuera[idx] & df_lab$.hjust_label[idx] == 0.5,
              df_lab$x_label[idx],
              dplyr::if_else(
                df_lab$.label_fuera[idx] & df_lab$x_center[idx] > 0.5,
                df_lab$x_left[idx] - label_offset,
                dplyr::if_else(
                  df_lab$.label_fuera[idx],
                  1.08,
                  df_lab$x_right[idx] - fit_padding
                )
              )
            )
          )
          x_min_idx[fijo_idx] <- df_lab$x_label[idx][fijo_idx]
          x_max_idx[fijo_idx] <- df_lab$x_label[idx][fijo_idx]
          df_lab$x_label[idx] <- .repel_label_positions_apiladas(
            x = df_lab$x_label[idx],
            labels = df_lab$lab[idx],
            label_size = df_lab$.size_label[idx],
            movable = movable_idx,
            hjust = df_lab$.hjust_label[idx],
            max_shift = desplazamiento_max_etiquetas_peq,
            x_min = x_min_idx,
            x_max = x_max_idx,
            padding = etiquetas_peq_padding,
            max_iter = etiquetas_peq_max_iter,
            bias_right = etiquetas_peq_sesgo_derecha,
            edge_margin = if (etiquetas_peq_confinadas) etiquetas_peq_margen_interno else 0,
            width_factor = repel_width_factor
          )
        }
      }

      df_lab <- .posicionar_labels_arriba_si_no_caben_apiladas(
        df_lab,
        var_categoria = var_categoria,
        usar_y_numerico = usar_y_numerico && isTRUE(etiquetas_arriba_si_no_caben),
        grosor_eff = grosor_eff,
        fit_padding = fit_padding,
        etiquetas_peq_padding = etiquetas_peq_padding,
        color_texto_barras_fuera = color_texto_barras_fuera,
        colores_grupos = colores_grupos,
        color_conectores_etiquetas = color_conectores_etiquetas,
        posicion_conector_etiquetas = posicion_conector_etiquetas,
        offset_y = etiquetas_arriba_offset
      )
      arriba_idx <- if (".label_arriba" %in% names(df_lab)) df_lab$.label_arriba %in% TRUE else rep(FALSE, nrow(df_lab))
      df_lab_arriba <- df_lab[arriba_idx, , drop = FALSE]
      df_lab_dentro <- df_lab[!arriba_idx, , drop = FALSE]
      df_lab_dentro <- if (isTRUE(etiquetas_arriba_si_no_caben)) {
        .centrar_labels_interiores_segmento_apiladas(
          df_lab_dentro,
          color_texto_barras = color_texto_barras
        )
      } else {
        .finalizar_labels_interiores_apiladas(
          df_lab_dentro,
          var_categoria = var_categoria,
          color_texto_barras = color_texto_barras,
          color_texto_barras_fuera = color_texto_barras_fuera,
          fit_padding = fit_padding,
          etiquetas_peq_padding = etiquetas_peq_padding,
          width_factor = 2.10
        )
      }
      df_lab <- dplyr::bind_rows(df_lab_dentro, df_lab_arriba)

      if (nrow(df_lab) > 0) {
        arriba_plot_idx <- if (".label_arriba" %in% names(df_lab)) {
          df_lab$.label_arriba %in% TRUE
        } else {
          rep(FALSE, nrow(df_lab))
        }
        df_lab_arriba_plot <- df_lab[arriba_plot_idx, , drop = FALSE]
        if (nrow(df_lab_arriba_plot) > 0) {
          labels_arriba_activas <- TRUE
          p_bars <- p_bars +
            ggplot2::geom_segment(
              data = df_lab_arriba_plot,
              mapping = ggplot2::aes(
                x = x_conector_label,
                xend = x_conector_barra,
                y = y_conector_label,
                yend = y_conector_barra,
                colour = .data$.col_conector
              ),
              linewidth = linewidth_conectores_etiquetas,
              lineend = "round",
              inherit.aes = FALSE,
              show.legend = FALSE
            )
        }
        labels_rendered <- as.character(df_lab$lab)
        p_bars <- p_bars +
          ggplot2::geom_text(
            data    = df_lab,
            mapping = ggplot2::aes(
              x = x_label,
              y = if (usar_y_numerico) .data$y_label else .data[[var_categoria]],
              label = lab,
              colour = .data$.col_label,
              size = .data$.size_label,
              hjust = .data$.hjust_label
            ),
            family = font_family,
            fontface = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
            inherit.aes = FALSE,
            show.legend = FALSE
          ) +
          ggplot2::scale_colour_identity(guide = "none") +
          ggplot2::scale_size_identity(guide = "none")
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 4) Colores + leyenda (para extraer grob) — con separación horizontal REAL
  # ---------------------------------------------------------------------------
  wrap_fun <- NULL
  if (requireNamespace("stringr", quietly = TRUE)) wrap_fun <- function(x) stringr::str_wrap(x, width = 40)
  labels_leyenda <- etiquetas_leyenda_resueltas
  if (!is.null(wrap_fun)) labels_leyenda <- wrap_fun(labels_leyenda)
  labels_leyenda <- stats::setNames(labels_leyenda, niveles_leyenda)
  colores_leyenda_manual <- NULL

  if (!is.null(colores_grupos)) {
    if (is.null(names(colores_grupos))) colores_grupos <- stats::setNames(colores_grupos, niveles_originales)
    # El override del usuario puede venir corto, sin nombres o como el deparse
    # de un vector; se sanea y rellena con el helper compartido para no abortar
    # scale_fill_manual con "Insufficient values in manual scale".
    valores_leyenda <- .graficos_mk_palette(niveles_leyenda, pal_user = colores_grupos)
    colores_leyenda_manual <- unname(valores_leyenda)
    p_bars <- p_bars +
      ggplot2::scale_fill_manual(
        breaks = niveles_leyenda,
        values = valores_leyenda,
        labels = labels_leyenda
      )
  } else {
    p_bars <- p_bars +
      ggplot2::scale_fill_discrete(
        breaks = niveles_leyenda,
        labels = labels_leyenda
      )
  }

  n_items_leyenda <- length(niveles_leyenda)
  n_por_fila <- as.integer(legend_n_por_fila)
  if (!is.finite(n_por_fila) || n_por_fila < 1L) n_por_fila <- 6L
  legend_key_side_cm <- max(0.30, legend_key_cm)
  legend_key_w_cm <- legend_key_side_cm
  legend_key_h_cm <- legend_key_side_cm

  p_for_legend <- p_bars +
    ggplot2::theme(
      legend.position = if (legend_is_side) "right" else "bottom",
      legend.title    = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        family = font_family,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        margin = ggplot2::margin(l = legend_espaciado/2, r = legend_espaciado/2, unit = "pt")
      ),

      legend.key.width  = grid::unit(legend_key_w_cm, "cm"),
      legend.key.height = grid::unit(legend_key_h_cm, "cm"),

      legend.key.spacing.x = grid::unit(0.10, "cm"),

      plot.margin = ggplot2::margin(0, 0, 0, 0)
    ) +
    ggplot2::guides(
      fill = ggplot2::guide_legend(
        byrow = TRUE,
        ncol  = if (legend_is_side) 1L else n_por_fila,
        keywidth  = grid::unit(legend_key_w_cm, "cm"),
        keyheight = grid::unit(legend_key_h_cm, "cm")
      )
    )

  # ---------------------------------------------------------------------------
  # 5) Etiquetas Y y extra como texto (sin ggplot)
  # ---------------------------------------------------------------------------
  etiquetas_vec <- cat_layout$.cat_label
  if (!is.null(wrap_eje_y_eff)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    etiquetas_vec <- stringr::str_wrap(etiquetas_vec, width = wrap_eje_y_eff)
  }

  df_wide_extra <- df |>
    dplyr::select(dplyr::all_of(c(var_categoria, var_n, cols_porcentaje))) |>
    dplyr::mutate(valor_extra = .data[[var_n]])

  prefijo_extra_int     <- prefijo_barra_extra %||% ""
  titulo_extra_int      <- titulo_barra_extra
  color_barra_extra_int <- color_barra_extra
  fontface_barra_extra  <- if ("barra_extra" %in% textos_negrita) "bold" else "plain"

  if (barra_extra_preset != "ninguno") {
    if (barra_extra_preset == "totales") {
      if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "Total"
      if (is.null(prefijo_barra_extra)) prefijo_extra_int <- "N = "
      if (is.null(color_barra_extra))   color_barra_extra_int <- pulso_azul
      fontface_barra_extra <- "bold"
    } else {

      base_mat <- df_wide_extra[, cols_porcentaje, drop = FALSE]
      if (escala_valor == "proporcion_100") base_mat <- base_mat / 100

      # labels disponibles por columna: names(etiquetas_grupos)=cols, values=labels
      .cols_from_labels <- function(labels_sel, etiquetas_grupos, cols_porcentaje) {
        if (is.null(labels_sel) || !length(labels_sel)) return(character(0))
        labels_sel <- trimws(as.character(labels_sel))
        hit <- names(etiquetas_grupos)[as.character(etiquetas_grupos) %in% labels_sel]
        hit <- hit[hit %in% cols_porcentaje]
        unique(hit)
      }

      # defaults: prioriza categorías sustantivas y excluye especiales
      .default_top2 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 2L, side = "top")
      }
      .default_top3 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 3L, side = "top")
      }
      .default_bottom2 <- function(cols_porcentaje, etiquetas_grupos) {
        .default_box_cols(cols_porcentaje, etiquetas_grupos, n = 2L, side = "bottom")
      }

      if (barra_extra_preset == "top2box") {

        cols_sel <- .cols_from_labels(top2box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_top2(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "Top 2 Box"

      } else if (barra_extra_preset == "top3box") {

        cols_sel <- .cols_from_labels(top3box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_top3(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "Top 3 Box"

      } else if (barra_extra_preset == "bottom2box") {

        cols_sel <- .cols_from_labels(bottom2box_labels, etiquetas_grupos, cols_porcentaje)
        if (!length(cols_sel)) cols_sel <- .default_bottom2(cols_porcentaje, etiquetas_grupos)

        df_wide_extra$valor_extra <- rowSums(as.matrix(base_mat[, cols_sel, drop = FALSE]), na.rm = TRUE)
        if (is.null(titulo_barra_extra) || !nzchar(titulo_barra_extra)) titulo_extra_int <- "Bottom 2 Box"
      }

      df_wide_extra$valor_extra <- df_wide_extra$valor_extra * 100
      if (is.null(color_barra_extra) || !nzchar(trimws(as.character(color_barra_extra)[1]))) {
        color_barra_extra_int <- pulso_verde
      } else {
        color_barra_extra_int <- as.character(color_barra_extra)[1]
      }
      fontface_barra_extra  <- "bold"
    }
  }

  .format_pct_clean <- function(x, dec){
    x_round <- round(x, dec)
    format(x_round, nsmall = dec, trim = TRUE, scientific = FALSE)
  }

  extra_map <- df_wide_extra |>
    dplyr::mutate(.cat_chr = as.character(.data[[var_categoria]])) |>
    dplyr::select(.cat_chr, valor_extra)

  extra_vals <- vapply(cat_lvls, function(cc) {
    vv <- extra_map$valor_extra[match(cc, extra_map$.cat_chr)]
    if (length(vv) == 0 || is.na(vv)) vv <- NA_real_
    vv
  }, numeric(1))

  extra_labels <- rep("", length(cat_lvls))
  if (isTRUE(mostrar_barra_extra)) {
    extra_labels <- if (barra_extra_preset %in% c("top2box", "top3box", "bottom2box")) {
      paste0(prefijo_extra_int, .format_pct_clean(extra_vals, decimales), "%")
    } else {
      paste0(prefijo_extra_int, format(extra_vals, big.mark = ",", scientific = FALSE, trim = TRUE))
    }
    extra_labels[!is.finite(extra_vals)] <- ""
  }

  # ---------------------------------------------------------------------------
  # 7) Caption (texto)
  # ---------------------------------------------------------------------------
  caption_text <- NULL
  if (!is.null(nota_pie) && nzchar(nota_pie) && !is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- paste0(nota_pie, "   ", nota_pie_derecha)
  } else if (!is.null(nota_pie) && nzchar(nota_pie)) {
    caption_text <- nota_pie
  } else if (!is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- nota_pie_derecha
  }

  # ---------------------------------------------------------------------------
  # 8) No canvas
  # ---------------------------------------------------------------------------
  if (!isTRUE(usar_canvas)) {
    out <- p_bars +
      ggplot2::theme(legend.position = if (mostrar_leyenda) legend_pos_gg else "none") +
      ggplot2::labs(title = titulo, subtitle = subtitulo, caption = caption_text)

    if (exportar == "rplot") return(out)

    # EXPORT PNG / PPT / WORD (sin canvas): se exporta el ggplot directamente
    if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

    if (exportar == "png") {
      ggplot2::ggsave(filename = path_salida, plot = out, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
      return(invisible(out))
    }

    if (exportar %in% c("ppt", "word")) {
      if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
      if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg (dml).", call. = FALSE)

      if (exportar == "ppt") {
        doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
        doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
        doc <- officer::ph_with(
          doc,
          value = rvg::dml(ggobj = out),
          location = officer::ph_location_fullsize()
        )
        print(doc, target = path_salida)
        return(invisible(out))
      }

      if (exportar == "word") {
        doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
        doc <- officer::body_add_par(doc, value = "", style = "Normal")
        doc <- officer::body_add_dml(
          doc,
          value = rvg::dml(ggobj = out),
          width = ancho, height = alto
        )
        print(doc, target = path_salida)
        return(invisible(out))
      }
    }

    stop("Tipo de exportación no soportado.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 9) CANVAS (cowplot)
  # ---------------------------------------------------------------------------
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere cowplot.", call. = FALSE)

  # barras “panel puro”
  p_bars_panel <- p_bars +
    ggplot2::theme_void() +
    ggplot2::theme(
      legend.position  = "none",
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      # Margen lateral para que etiquetas al borde no se corten visualmente.
      plot.margin      = ggplot2::margin(0, 4, 0, 18)
    )

  .ph_border <- function(x, y, w, h) {
    cowplot::draw_grob(
      grid::rectGrob(
        x = 0, y = 0, width = 1, height = 1,
        just = c("left", "bottom"),
        gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
      ),
      x = x, y = y, width = w, height = h,
      hjust = 0, vjust = 0
    )
  }

  # alturas en pulgadas
  alto_por_cat_eff <- alto_por_categoria %||% 0.42
  if (isTRUE(needs_tall_label_slot)) {
    alto_por_cat_eff <- max(
      alto_por_cat_eff,
      if (max_lineas_eje_y_est >= 8L) 1.06 else 0.96
    )
  }
  n_filas_virtuales <- if (isTRUE(usar_canvas)) y_axis_max else max(1L, n_categorias)
  h_panel_in <- if (!is.null(canvas_h_panel_in) && is.finite(canvas_h_panel_in) && canvas_h_panel_in > 0) {
    canvas_h_panel_in
  } else {
    n_filas_virtuales * alto_por_cat_eff
  }

  # Mínimo configurable del panel (para Word, donde charts con 1 barra quedan muy chicos)
  panel_min <- suppressWarnings(as.numeric(canvas_h_panel_in_min))
  if (is.finite(panel_min) && panel_min > 0) {
    h_panel_in <- max(h_panel_in, panel_min)
  }

  titulo_canvas <- as.character(titulo %||% "")[1]
  title_lines <- if (nzchar(trimws(titulo_canvas))) 1L else 0L
  if (title_lines > 0L && requireNamespace("stringr", quietly = TRUE)) {
    chart_width <- suppressWarnings(as.numeric(ancho)[1])
    if (!is.finite(chart_width) || chart_width <= 0) chart_width <- 10
    wrap_width <- max(24L, as.integer(floor(chart_width * 7.2)))
    titulo_canvas <- stringr::str_wrap(titulo_canvas, width = wrap_width)
    title_lines <- length(strsplit(titulo_canvas, "\n", fixed = TRUE)[[1]])
  }

  has_header  <- nzchar(trimws(titulo_canvas)) || (!is.null(subtitulo) && nzchar(subtitulo))
  has_legend  <- isTRUE(mostrar_leyenda) && length(niveles_leyenda) > 0
  has_caption <- !is.null(caption_text) && nzchar(caption_text)

  h_header_in  <- if (has_header)  canvas_h_header_in  else 0
  if (title_lines > 1L) {
    subtitle_extra_in <- if (!is.null(subtitulo) && nzchar(subtitulo)) 0.16 else 0
    h_header_in <- max(
      h_header_in,
      title_lines * suppressWarnings(as.numeric(size_titulo)[1]) / 72 * 1.18 + subtitle_extra_in
    )
  }
  h_legend_in  <- if (has_legend && !legend_is_side)  canvas_h_legend_in  else 0
  # El fijo de 0.75in se lleva un cuarto del placeholder para dibujar UNA linea
  # de texto, y las barras se aprietan arriba dejando media lamina en blanco
  # (visto con `debug_ph_bordes`). Se ajusta a las filas que la leyenda necesita,
  # sin pasar nunca del valor declarado: quien pida mas alto lo conserva.
  if (h_legend_in > 0) {
    # Se le pasan los MISMOS parametros con los que dibuja: con otros, la
    # estimacion se equivoca justo en el limite entre una fila y dos.
    h_legend_in <- min(h_legend_in, .barras_leyenda_alto_in(
      niveles_leyenda, size_leyenda, ancho,
      key_cm = legend_key_cm, gap_npc = legend_gap_npc,
      aspect_yx = legend_key_aspect_yx %||% (suppressWarnings(as.numeric(alto)[1] / as.numeric(ancho)[1])),
      n_por_fila = legend_n_por_fila))
  }
  # B44/G-21: sin caption propio, la Base del SLIDE vive justo debajo del
  # canvas; canvas_h_reserva_pie_in deja esa banda vacia para que la
  # leyenda no choque con el texto de Base (antes la fila caption
  # simplemente desaparecia y cualquier reserva era un no-op).
  reserva_pie_in <- suppressWarnings(as.numeric(canvas_h_reserva_pie_in)[1])
  if (!is.finite(reserva_pie_in) || reserva_pie_in < 0) reserva_pie_in <- 0
  h_caption_in <- if (has_caption) canvas_h_caption_in else reserva_pie_in
  if (isTRUE(needs_tall_label_slot) && has_legend && !legend_is_side) {
    h_legend_in <- max(h_legend_in, 0.40)
  }

  # El canvas se coloca conservando su proporcion, asi que un alto intrinseco
  # corto deja el resto del hueco en blanco: medido, 3.56 de 6 pulgadas. El
  # sobrante se reparte a las filas hasta un grosor maximo, y solo cuando el alto
  # del panel es el intrinseco (nadie lo fijo a mano).
  if (is.null(canvas_h_panel_in) || !is.finite(suppressWarnings(as.numeric(canvas_h_panel_in)[1])) ||
      suppressWarnings(as.numeric(canvas_h_panel_in)[1]) <= 0) {
    alto_por_cat_eff <- .barras_alto_fila_ajustado(
      alto_por_cat_eff, n_filas_virtuales, alto,
      alto_fijo_in = h_header_in + h_legend_in + h_caption_in)
    h_panel_in <- max(h_panel_in, n_filas_virtuales * alto_por_cat_eff)
    if (is.finite(panel_min) && panel_min > 0) h_panel_in <- max(h_panel_in, panel_min)
  }

  h_total_in <- h_header_in + h_panel_in + h_legend_in + h_caption_in
  if (h_total_in <= 0) h_total_in <- 1

  # B46/G-21: con 1-2 filas reales, estirar el canvas al alto fisico del
  # slot dejaba una cinta perdida entre dos vacios enormes (feedback
  # directo: "sigue escueta la barra sola"). Si el alto fisico inyectado
  # por el slide supera al contenido intrinseco, el excedente se va a
  # MARGENES simetricos arriba y abajo — el bloque queda centrado y las
  # filas conservan su proporcion editorial.
  pad_flex_h <- 0
  alto_fisico <- suppressWarnings(as.numeric(alto)[1])
  if (is.finite(alto_fisico) && alto_fisico > 0 &&
      n_categorias <= 2L &&
      (is.null(canvas_h_panel_in) || !is.finite(suppressWarnings(as.numeric(canvas_h_panel_in)[1])) ||
         suppressWarnings(as.numeric(canvas_h_panel_in)[1]) <= 0)) {
    # Piso fisico del panel: el area de barras real descuenta el pad interno
    # que protege etiquetas de eje altas (B48: con una etiqueta de 5+ lineas
    # el pad llegaba a 0.63in por lado y la banda quedaba en 0.29in aunque
    # el grosor efectivo fuera 0.95). El piso garantiza area de barras, no
    # solo panel: piso = area_deseada + 2*pad_estimado.
    pad_est_in <- suppressWarnings(as.numeric(canvas_pad_bars_y_in)[1])
    if (!is.finite(pad_est_in) || pad_est_in < 0) pad_est_in <- 0
    if (isTRUE(needs_tall_label_slot)) {
      size_pad_est <- suppressWarnings(as.numeric(size_ejes)[1])
      if (!is.finite(size_pad_est) || size_pad_est <= 0) size_pad_est <- 13.8
      size_pad_est <- min(size_pad_est, 13.8)
      pad_est_in <- max(pad_est_in, max_lineas_eje_y_est * size_pad_est * 0.80 / 72 / 2 + 0.25)
    }
    area_deseada_in <- if (n_categorias == 1L) 1.5 else 2.1
    panel_floor_in <- max(if (n_categorias == 1L) 2.2 else 2.8,
                          area_deseada_in + 2 * pad_est_in)
    if (h_panel_in < panel_floor_in) {
      h_total_in <- h_total_in - h_panel_in + panel_floor_in
      h_panel_in <- panel_floor_in
    }
    if (alto_fisico > h_total_in) {
      pad_total_in <- alto_fisico - h_total_in
      h_total_in <- alto_fisico
      # Antes: dos margenes iguales. Con una sola barra eso dejaba el grafico
      # como una tira flotando en el centro. El grosor NO se toca —el ADR 0065
      # existe para que una barra mida lo mismo en toda la presentacion—; lo que
      # cambia es donde queda el aire: arriba poco y abajo el resto, que es como
      # se lee una lamina.
      pad_flex_h <- .barras_pad_superior(pad_total_in / h_total_in)
    }
  }

  header_h  <- h_header_in  / h_total_in
  panel_h   <- h_panel_in   / h_total_in
  legend_h  <- h_legend_in  / h_total_in
  caption_h <- h_caption_in / h_total_in

  y_header0 <- 1 - pad_flex_h - header_h
  if (has_legend && legend_is_top && !legend_is_side) {
    y_legend0  <- y_header0 - legend_h
    y_panel0   <- y_legend0 - panel_h
    y_caption0 <- y_panel0 - caption_h
  } else {
    y_panel0   <- y_header0 - panel_h
    y_legend0  <- y_panel0  - legend_h
    y_caption0 <- y_legend0 - caption_h
  }

  # widths (6 columnas efectivas) — grupo + etiquetas + buffers + barras + extra
  w_group <- if (usar_grupos_canvas) canvas_w_grupo else 0
  w_buf0  <- if (usar_grupos_canvas) canvas_w_buf_grupo_etq else 0
  # El canal de etiquetas se dimensiona por su CONTENIDO cuando nadie declaro
  # uno. El defecto de 0.38 era el 38 % del ancho fuera cual fuera el texto: en
  # una lamina cuyo eje dice una frase corta, eso es cuatro veces lo necesario, y
  # ese ancho se lo quita a las barras, que son el dato.
  #
  # Un valor declarado por la lamina o por el preset manda: aqui solo se rellena
  # el hueco que dejaba un defecto fijo.
  # `missing()` y no una bandera: la pregunta es si la lamina o el preset lo
  # declararon, y esa es la unica forma de saberlo sin anadir un flag que haya
  # que mantener sincronizado. Un valor declarado manda siempre.
  w_etq   <- canvas_w_etiquetas
  if (missing(canvas_w_etiquetas)) {
    w_etq <- .barras_ancho_etiquetas(etiquetas_vec, size_ejes_num, ancho)
  }
  w_buf1  <- canvas_w_buf_etq_bars
  w_bars  <- canvas_w_bars
  w_buf2  <- canvas_w_buf_bars_extra
  w_extra <- canvas_w_extra
  w_legend_side <- if (has_legend && legend_is_side) 0.18 else 0

  w_sum <- w_legend_side + w_group + w_buf0 + w_etq + w_buf1 + w_bars + w_buf2 + w_extra
  if (!is.finite(w_sum) || w_sum <= 0) w_sum <- 1

  w_legend_side <- w_legend_side / w_sum
  w_group <- w_group / w_sum
  w_buf0  <- w_buf0  / w_sum
  w_etq   <- w_etq   / w_sum
  w_buf1  <- w_buf1  / w_sum
  w_bars  <- w_bars  / w_sum
  w_buf2  <- w_buf2  / w_sum
  w_extra <- w_extra / w_sum

  x_legend_side0 <- if (identical(leyenda_posicion, "izquierda")) 0 else NA_real_
  x_group0 <- if (identical(leyenda_posicion, "izquierda")) w_legend_side else 0
  x_buf00  <- x_group0 + w_group
  x_etq0   <- x_buf00 + w_buf0
  x_buf10  <- x_etq0 + w_etq
  x_bars0  <- x_buf10 + w_buf1
  x_buf20  <- x_bars0 + w_bars
  x_extra0 <- x_buf20 + w_buf2
  if (identical(leyenda_posicion, "derecha")) x_legend_side0 <- x_extra0 + w_extra

  # top row (título del extra)
  top_in <- canvas_h_toprow_in %||% 0
  if (!is.finite(top_in) || is.na(top_in) || top_in < 0) top_in <- 0
  if (isTRUE(mostrar_barra_extra) && !is.null(titulo_extra_int) && nzchar(titulo_extra_int)) {
    # Reserva mínima compacta para que el título de barra extra no aleje el gráfico.
    top_in <- max(top_in, max(0.09, (size_titulo_extra %||% 9) * 0.012))
  }
  top_in <- min(top_in, h_panel_in * 0.45)
  top_h  <- if (top_in > 0) top_in / h_total_in else 0

  main_h  <- panel_h - top_h
  y_top0  <- y_panel0 + main_h
  y_main0 <- y_panel0

  # leyenda grob
  usar_leyenda_manual <- has_legend &&
    !legend_is_side &&
    !is.null(colores_leyenda_manual) &&
    length(colores_leyenda_manual) == length(niveles_leyenda) &&
    all(!is.na(colores_leyenda_manual) & nzchar(colores_leyenda_manual))
  leg_grob <- NULL
  if (has_legend && !usar_leyenda_manual) {
    leg_grob <- cowplot::get_legend(
      p_for_legend + ggplot2::theme(
        legend.position  = if (legend_is_side) "right" else "bottom",
        legend.direction = if (legend_is_side) "vertical" else "horizontal",
        legend.box       = if (legend_is_side) "vertical" else "horizontal"
      )
    )
  }

  canvas <- cowplot::ggdraw()

  # ============================================================
  # HEADER: centrado + desplazamiento + separación
  # ============================================================
  if (has_header) {
    y_header_center <- y_header0 + (header_h * 0.5)
    dy_head <- encabezado_desplazamiento_in / h_total_in
    sep     <- encabezado_separacion_in     / h_total_in

    has_t <- nzchar(trimws(titulo_canvas))
    has_s <- (!is.null(subtitulo) && nzchar(subtitulo))

    # Con los dos textos, `sep` es la distancia ENTRE ellos: cero los dibuja en
    # la misma coordenada y salen uno encima del otro. El piso se deriva de los
    # cuerpos de letra —no es una constante— para que valga igual si alguien
    # sube el tamano del titulo.
    if (has_t && has_s) {
      sep_min <- (as.numeric(size_titulo)[1] + as.numeric(size_subtitulo)[1]) *
        0.5 * 1.15 / 72 / h_total_in
      if (!is.finite(sep) || sep < sep_min) sep <- sep_min
    }

    if (has_t && has_s) {
      y_title <- y_header_center + (sep * 0.5) + dy_head
      y_sub   <- y_header_center - (sep * 0.5) + dy_head
    } else if (has_t) {
      y_title <- y_header_center + dy_head
      y_sub   <- NA_real_
    } else {
      y_title <- NA_real_
      y_sub   <- y_header_center + dy_head
    }

    if (has_t) {
      canvas <- canvas + cowplot::draw_text(
        text  = titulo_canvas,
        x     = hjust_titulo,
        y     = y_title,
        hjust = hjust_titulo,
        vjust = 0.5,
        size  = size_titulo,
        colour= color_titulo,
        family = font_family,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain"
      )
    }

    if (has_s) {
      canvas <- canvas + cowplot::draw_text(
        text  = subtitulo,
        x     = hjust_titulo,
        y     = y_sub,
        hjust = hjust_titulo,
        vjust = 0.5,
        size  = size_subtitulo,
        colour= color_subtitulo,
        family = font_family,
        fontface = if ("subtitulo" %in% textos_negrita) "bold" else face_subtitulo
      )
    }

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_header0, 1, header_h)
  }

  # TOP ROW (título extra)
  if (top_h > 0) {

    if (debug_ph_bordes) {
      canvas <- canvas +
        .ph_border(x_group0, y_top0, w_group, top_h) +
        .ph_border(x_etq0,   y_top0, w_etq,   top_h) +
        .ph_border(x_bars0,  y_top0, w_bars,  top_h) +
        .ph_border(x_extra0, y_top0, w_extra, top_h)
    }

    if (isTRUE(mostrar_barra_extra) && !is.null(titulo_extra_int) && nzchar(titulo_extra_int)) {
      canvas <- canvas + cowplot::draw_text(
        text     = titulo_extra_int,
        x        = x_extra0 + (w_extra * 0.5),
        y        = y_top0 + (top_h * 0.5),
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_titulo_extra,
        colour   = color_barra_extra_int,
        family = font_family,
        fontface = "bold"
      )
    }
  }

  # ============================================================
  # MAIN ROW: sub-placeholders verticales (pad_top + bars_area + pad_bottom)
  # ============================================================

  # padding en pulgadas -> npc (respecto al alto total del canvas)
  pad_in <- canvas_pad_bars_y_in %||% 0
  if (!is.finite(pad_in) || is.na(pad_in) || pad_in < 0) pad_in <- 0
  if (isTRUE(needs_tall_label_slot)) {
    label_size_for_pad <- size_ejes_num
    if (max_lineas_eje_y_est >= 9L) {
      label_size_for_pad <- min(label_size_for_pad, 11.8)
    } else if (max_lineas_eje_y_est >= 8L) {
      label_size_for_pad <- min(label_size_for_pad, 12.4)
    } else if (max_lineas_eje_y_est >= 7L) {
      label_size_for_pad <- min(label_size_for_pad, 12.9)
    } else {
      label_size_for_pad <- min(label_size_for_pad, 13.8)
    }
    label_half_height_in <- max_lineas_eje_y_est * label_size_for_pad * 0.80 / 72 / 2
    pad_in <- max(pad_in, label_half_height_in + 0.25)
  }
  pad_npc <- pad_in / h_total_in

  # clamp: no permitir que el padding "mate" el área útil
  pad_npc <- min(pad_npc, main_h * 0.45)

  # sub-PH
  y_padbot0 <- y_main0
  h_padbot  <- pad_npc

  y_bars_area0 <- y_padbot0 + h_padbot
  h_bars_area  <- main_h - 2 * pad_npc

  y_padtop0 <- y_bars_area0 + h_bars_area
  h_padtop  <- pad_npc

  # dibujar barras SOLO en el área útil
  if (h_bars_area > 0) {
    canvas <- canvas +
      cowplot::draw_plot(
        p_bars_panel,
        x = x_bars0, y = y_bars_area0,
        width = w_bars, height = h_bars_area
      )
  }

  # ============================================================
  # Y del panel: usar y.range NUMÉRICO del panel (estable)
  # ============================================================
  gb <- ggplot2::ggplot_build(p_bars_panel)

  pp <- gb$layout$panel_params[[1]]
  y_rng <- pp$y.range  # <- numérico (ej: c(0.5, n+0.5))

  if (!is.numeric(y_rng) || length(y_rng) != 2 || any(!is.finite(y_rng))) {
    # fallback ultra seguro
    y_rng <- c(0.5, max(cat_layout$.y_plot, na.rm = TRUE) + 0.5)
  }

  den <- diff(y_rng); if (!is.finite(den) || den <= 0) den <- 1
  if (usar_y_numerico) {
    y_npc <- (cat_layout$.y_plot - y_rng[1]) / den
  } else {
    y_centros <- cat_layout$.y_plot
    y_npc <- (y_centros - y_rng[1]) / den
  }
  y_npc <- pmax(0, pmin(1, y_npc))

  # llevar a coordenadas absolutas del canvas (área útil)
  y_abs <- y_bars_area0 + y_npc * h_bars_area
  cat_layout$.y_abs <- y_abs

  # debug: bordes del PH total + pads + área útil
  if (debug_ph_bordes) {
    # borde total (ya lo tienes abajo; si quieres, lo puedes dejar duplicado o remover el viejo)
    canvas <- canvas +
      .ph_border(x_bars0, y_main0,      w_bars, main_h) +
      .ph_border(x_bars0, y_padtop0,    w_bars, h_padtop) +
      .ph_border(x_bars0, y_bars_area0, w_bars, h_bars_area) +
      .ph_border(x_bars0, y_padbot0,    w_bars, h_padbot)
  }

  if (usar_grupos_canvas && w_group > 0) {
    group_df <- cat_layout |>
      dplyr::filter(!is.na(.data$.group_id) & nzchar(trimws(.data$.group_id))) |>
      dplyr::group_by(.data$.group_id) |>
      dplyr::summarise(
        .group_title = dplyr::first(.data$.group_title),
        y_min = min(.data$.y_abs, na.rm = TRUE),
        y_max = max(.data$.y_abs, na.rm = TRUE),
        n_cat = dplyr::n(),
        .groups = "drop"
      )

    x_group_txt <- x_group0 + (w_group * 0.5)
    # El titulo se dibuja centrado en su bloque, y `draw_text` no recorta: un
    # titulo mas alto que su bloque invade los vecinos. Con enunciados completos
    # como nombre de tema —el caso de la matriz de equivalencias— los titulos de
    # tres bloques seguidos se escribian unos encima de otros y quedaban
    # ilegibles. Cada uno se acota a las lineas que su bloque sostiene.
    for (i in seq_len(nrow(group_df))) {
      title_i <- as.character(group_df$.group_title[i])
      if (is.na(title_i)) title_i <- ""
      if (!nzchar(trimws(title_i))) next
      # El cupo se cuenta por FILAS de barras, que es lo que el titulo comparte
      # de verdad. Medir la distancia entre la primera y la ultima categoria
      # daba cero en un bloque de una sola barra —justo el caso donde el titulo
      # largo invade a los vecinos—.
      title_i <- .barras_acotar_titulo_grupo(title_i, group_df$n_cat[i],
                                            alto_rel = titulos_grupo_alto_rel)
      canvas <- canvas + cowplot::draw_text(
        text     = title_i,
        x        = x_group_txt,
        y        = mean(c(group_df$y_min[i], group_df$y_max[i])),
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_titulos_grupo,
        colour   = color_titulos_grupo,
        family = font_family,
        fontface = "bold"
      )
    }
  }

  # Etiquetas (columna izquierda)
  pad_x <- 0.004
  x_lab <- x_etq0 + w_etq * (1 - pad_x)
  fontface_etq <- if ("eje_y" %in% textos_negrita) "bold" else "plain"
  size_ejes_eff <- size_ejes_num
  lineheight_eje_y_eff <- if (isTRUE(needs_tall_label_slot)) 0.80 else 0.86
  lineas_eje_y <- vapply(strsplit(as.character(etiquetas_vec), "\n", fixed = TRUE), length, integer(1))
  lineas_eje_y[!is.finite(lineas_eje_y) | is.na(lineas_eje_y) | lineas_eje_y < 1L] <- 1L
  if (isTRUE(needs_tall_label_slot)) {
    max_lines_eje_y <- max(lineas_eje_y, na.rm = TRUE)
    size_cap <- if (max_lines_eje_y >= 9L) {
      11.8
    } else if (max_lines_eje_y >= 8L) {
      12.4
    } else if (max_lines_eje_y >= 7L) {
      12.9
    } else {
      13.8
    }
    size_ejes_eff <- min(size_ejes_eff, size_cap)
  }
  if (isTRUE(usar_canvas) && n_categorias > 1L && any(lineas_eje_y >= 4L)) {
    y_sorted <- sort(as.numeric(y_abs))
    gaps_in <- diff(y_sorted) * h_total_in
    gaps_in <- gaps_in[is.finite(gaps_in) & gaps_in > 0]
    if (length(gaps_in)) {
      min_gap_in <- min(gaps_in)
      max_lines <- max(lineas_eje_y, na.rm = TRUE)
      size_fit <- (min_gap_in * 72 * 0.82) / (max(1, max_lines) * lineheight_eje_y_eff)
      if (is.finite(size_fit) && size_fit > 0) {
        floor_size <- if (max_lines >= 7L) 8.8 else 9.6
        size_ejes_eff <- max(floor_size, min(size_ejes_eff, size_fit))
      }
    }
  }

  draw_y_labels <- is.finite(w_etq) && w_etq > sqrt(.Machine$double.eps)
  if (draw_y_labels) {
    for (i in seq_len(n_categorias)) {
      canvas <- canvas + cowplot::draw_text(
        text     = etiquetas_vec[i],
        x        = x_lab,
        y        = y_abs[i],
        hjust    = 1,
        vjust    = 0.5,
        size     = size_ejes_eff,
        colour   = color_ejes,
        family = font_family,
        fontface = fontface_etq,
        lineheight = lineheight_eje_y_eff
      )
    }
  }

  # Extra (columna derecha)
  x_extra_txt <- x_extra0 + (w_extra * 0.5)
  for (i in seq_len(n_categorias)) {
    if (nzchar(extra_labels[i])) {
      canvas <- canvas + cowplot::draw_text(
        text     = extra_labels[i],
        x        = x_extra_txt,
        y        = y_abs[i],
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_barra_extra,
        colour   = color_barra_extra_int,
        family = font_family,
        fontface = fontface_barra_extra
      )
    }
  }

  if (debug_ph_bordes) {
    canvas <- canvas +
      .ph_border(x_group0, y_main0, w_group, main_h) +
      .ph_border(x_buf00,  y_main0, w_buf0,  main_h) +
      .ph_border(x_etq0,   y_main0, w_etq,   main_h) +
      .ph_border(x_buf10,  y_main0, w_buf1,  main_h) +
      .ph_border(x_buf20,  y_main0, w_buf2,  main_h) +
      .ph_border(x_extra0, y_main0, w_extra, main_h)
  }

  # ============================================================
  # LEYENDA: centrada + desplazamiento
  # ============================================================
  legend_manual_layout <- NULL
  if (has_legend && (usar_leyenda_manual || !is.null(leg_grob))) {

    dy_leg <- leyenda_desplazamiento_in / h_total_in
    if (isTRUE(needs_tall_label_slot) && !legend_is_side) {
      dy_leg <- dy_leg - (0.08 / h_total_in)
    }
    if (legend_is_side) {
      canvas <- canvas + cowplot::draw_grob(
        leg_grob,
        x = x_legend_side0 + (w_legend_side * 0.5),
        y = y_main0 + (main_h * 0.5) + dy_leg,
        width  = w_legend_side,
        height = main_h,
        hjust  = 0.5,
        vjust  = 0.5
      )
      if (debug_ph_bordes) canvas <- canvas + .ph_border(x_legend_side0, y_main0, w_legend_side, main_h)
    } else if (usar_leyenda_manual) {
      labels_manual <- unname(labels_leyenda)
      fills_manual <- unname(colores_leyenda_manual)
      n_items <- length(labels_manual)
      n_per_row <- min(max(1L, n_por_fila), n_items)
      aspect_yx <- suppressWarnings(as.numeric(legend_key_aspect_yx)[1])
      if (!is.finite(aspect_yx) || aspect_yx <= 0) {
        aspect_yx <- suppressWarnings(as.numeric(alto)[1] / as.numeric(ancho)[1])
      }
      if (!is.finite(aspect_yx) || aspect_yx <= 0) aspect_yx <- 0.6
      key_size_mm <- max(2.4, suppressWarnings(as.numeric(legend_key_cm)[1]) * 10)
      if (!is.finite(key_size_mm)) key_size_mm <- 3
      fontface_ley <- if ("leyenda" %in% textos_negrita) "bold" else "plain"
      chart_width_in <- suppressWarnings(as.numeric(ancho)[1])
      if (!is.finite(chart_width_in) || chart_width_in <= 0) chart_width_in <- 10
      estimate_text_width <- function(label_chars) {
        # Average glyph width is roughly 0.52 em. Convert points to inches and
        # then to the canvas' normalized x coordinates so narrow PPT slots do
        # not incorrectly keep long legends on a single row.
        pmax(0.016, label_chars * size_leyenda * 0.52 / 72 / chart_width_in)
      }

      repeat {
        n_rows <- ceiling(n_items / n_per_row)
        row_ids <- ceiling(seq_len(n_items) / n_per_row)
        row_h <- legend_h / max(1, n_rows)
        key_side_y <- min(row_h * 0.82, max(0.034, legend_key_cm * 0.11))
        key_h <- key_side_y
        key_w <- key_side_y * aspect_yx
        key_gap <- min(0.012, max(0.007, legend_gap_npc * 0.60))
        slot_gap <- min(0.040, max(0.026, legend_gap_npc * 1.80))
        label_chars_all <- nchar(
          gsub("\\s+", " ", gsub("\n", " ", labels_manual)),
          type = "width"
        )
        text_w_all <- estimate_text_width(label_chars_all)
        item_w_all <- key_w + key_gap + text_w_all
        row_widths <- vapply(seq_len(n_rows), function(row_index) {
          idx <- which(row_ids == row_index)
          sum(item_w_all[idx], na.rm = TRUE) + slot_gap * max(0L, length(idx) - 1L)
        }, numeric(1))
        if (n_per_row <= 1L || max(row_widths, na.rm = TRUE) <= 0.96) break
        n_per_row <- n_per_row - 1L
      }

      for (r in seq_len(n_rows)) {
        idx_row <- which(row_ids == r)
        n_row <- length(idx_row)
        if (!n_row) next
        labels_row <- labels_manual[idx_row]
        label_chars <- nchar(gsub("\\s+", " ", gsub("\n", " ", labels_row)), type = "width")
        text_w <- estimate_text_width(label_chars)
        item_w <- key_w + key_gap + text_w
        row_w <- sum(item_w, na.rm = TRUE) + slot_gap * max(0L, n_row - 1L)
        if (is.finite(legend_ancho_rel)) row_w <- max(row_w, legend_ancho_rel)
        row_w <- max(0.12, min(0.98, row_w))
        x_origin <- 0.5 - row_w / 2
        y_row <- y_legend0 + legend_h - ((r - 0.5) * row_h) + dy_leg
        x_offsets <- c(0, cumsum(item_w + slot_gap))
        for (j in seq_along(idx_row)) {
          idx <- idx_row[j]
          x_left <- x_origin + x_offsets[j]
          legend_manual_layout <- rbind(
            legend_manual_layout,
            data.frame(
              row = r,
              idx = idx,
              label = labels_manual[idx],
              x_left = x_left,
              x_key_right = x_left + key_w,
              key_width = key_w,
              key_height = key_h,
              key_width_physical_in = key_w * as.numeric(ancho)[1],
              key_height_physical_in = key_h * as.numeric(alto)[1],
              key_square_width_unit = key_w / aspect_yx,
              key_square_height_unit = key_h,
              key_aspect_yx = aspect_yx,
              key_marker = "rect_square",
              key_size_mm = key_size_mm,
              x_text = x_left + key_w + key_gap,
              x_item_right = x_left + item_w[j],
              stringsAsFactors = FALSE
            )
          )
          canvas <- canvas + ggplot2::annotate(
            "rect",
            xmin = x_left,
            xmax = x_left + key_w,
            ymin = y_row - key_h * 0.5,
            ymax = y_row + key_h * 0.5,
            fill = fills_manual[idx],
            colour = NA
          )
          canvas <- canvas + cowplot::draw_text(
            labels_manual[idx],
            x = x_left + key_w + key_gap,
            y = y_row,
            size = size_leyenda,
            color = color_leyenda,
            family = font_family,
            fontface = fontface_ley,
            hjust = 0,
            vjust = 0.5
          )
        }
      }
      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_legend0, 1, legend_h)
    } else {
      pos_leyenda_x <- 0.5
      if (!is.na(centro_cowplot) && is.finite(centro_cowplot)) pos_leyenda_x <- centro_cowplot

      y_legend_center <- y_legend0 + (legend_h * 0.5)

      canvas <- canvas + cowplot::draw_grob(
        leg_grob,
        x = pos_leyenda_x,
        y = y_legend_center + dy_leg,
        width  = 1,
        height = legend_h,
        hjust  = 0.5,
        vjust  = 0.5
      )

      if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_legend0, 1, legend_h)
    }
  }

  # CAPTION
  if (has_caption) {
    # Mismo defecto que arrastraba agrupadas: el pie se anclaba al borde
    # absoluto del lienzo. Se alinea con la columna de contenido
    # (ver `.graficos_caption_x` en graficador_helpers.R).
    cap <- .graficos_caption_x(hjust_caption, x_etq0, x_extra0 + w_extra)

    canvas <- canvas + cowplot::draw_text(
      text  = caption_text,
      x     = cap$x,
      y     = y_caption0 + (caption_h * 0.35),
      hjust = hjust_caption,
      vjust = 0.5,
      size  = size_nota_pie,
      family = font_family,
      colour= color_nota_pie
    )
    if (debug_ph_bordes) canvas <- canvas + .ph_border(cap$x0, y_caption0, cap$x1 - cap$x0, caption_h)
  }

  # ---------------------------------------------------------------------------
  # 10) EXPORT
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") {
    attr(canvas, "alto_word_sugerido") <- h_total_in
    attr(canvas, "pulso_labels_above_bars") <- isTRUE(labels_arriba_activas)
    attr(canvas, "pulso_needs_tall_plot_slot") <- isTRUE(labels_arriba_activas) || isTRUE(needs_tall_label_slot)
    attr(canvas, "pulso_title_lines") <- as.integer(title_lines)
    attr(canvas, "pulso_canvas_title_height_in") <- as.numeric(h_header_in)
    attr(canvas, "pulso_draw_y_labels") <- isTRUE(draw_y_labels)
    attr(canvas, "pulso_umbral_ocultar_etiqueta") <- as.numeric(umbral_ocultar_etiqueta_eff)
    attr(canvas, "pulso_labels_rendered") <- labels_rendered
    attr(canvas, "pulso_barras_apiladas_layout") <- list(
      n_categorias = n_categorias,
      y_axis_max = y_axis_max,
      grosor_eff = grosor_eff,
      h_panel_in = h_panel_in,
      pad_in = pad_in,
      h_bars_area_in = h_bars_area * h_total_in
    )
    if (!is.null(legend_manual_layout)) {
      layout_attr <- attr(canvas, "pulso_barras_apiladas_layout")
      layout_attr$legend_manual <- legend_manual_layout
      attr(canvas, "pulso_barras_apiladas_layout") <- layout_attr
    }
    return(canvas)
  }

  if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

  if (exportar == "png") {
    ggplot2::ggsave(filename = path_salida, plot = canvas, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
    return(invisible(canvas))
  }

  if (exportar %in% c("ppt", "word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg (dml).", call. = FALSE)

    if (exportar == "ppt") {
      doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
      doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
      doc <- officer::ph_with(
        doc,
        value = rvg::dml(ggobj = canvas),
        location = officer::ph_location_fullsize()
      )
      print(doc, target = path_salida)
      return(invisible(canvas))
    }

    if (exportar == "word") {
      doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
      doc <- officer::body_add_par(doc, value = "", style = "Normal")
      doc <- officer::body_add_dml(
        doc,
        value = rvg::dml(ggobj = canvas),
        width = ancho, height = alto
      )
      print(doc, target = path_salida)
      return(invisible(canvas))
    }
  }

  stop("Tipo de exportación no soportado.", call. = FALSE)
}
