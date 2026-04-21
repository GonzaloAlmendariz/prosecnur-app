# =============================================================================
# Helpers compartidos para Dimensiones
# - Resuelve configuración desde data recodificada + índices
# - Construye catálogos y payloads reutilizables
# - Base común para plan_ppt e interactivo_dimensiones
# =============================================================================

#' @keywords internal
.dim_or <- function(x, y) .ind_or(x, y)

#' @keywords internal
.dim_validate_ready_data <- function(data, caller = "Dimensiones") {
  .ind_validate_data_frame(data, caller = caller)

  rec_meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  idx_meta <- attr(data, "indices_meta", exact = TRUE)

  if (!is.list(rec_meta) || !length(rec_meta)) {
    stop(
      caller,
      ": `data` debe venir de `reporte_dimensiones()` y contener `recodificacion_items_meta`.",
      call. = FALSE
    )
  }

  if (!is.list(idx_meta) || !length(idx_meta)) {
    stop(
      caller,
      ": `data` debe venir de `reporte_dimensiones_indices()` y contener `indices_meta`.",
      call. = FALSE
    )
  }

  invisible(TRUE)
}

#' @keywords internal
.dim_resolve_instrumento <- function(data, instrumento = NULL, caller = "Dimensiones") {
  .ind_resolve_instrumento(
    data = data,
    instrumento = instrumento,
    caller = caller,
    required = TRUE
  )
}

#' @keywords internal
.dim_as_named_chr <- function(x) .ind_as_named_chr(x)

#' @keywords internal
.dim_nm_get <- function(x, key) .ind_nm_get(x, key)

#' @keywords internal
.dim_round_half_up <- function(x, digits = 0L) {
  s <- 10^as.integer(digits)
  out <- ifelse(
    is.na(x),
    NA_real_,
    ifelse(x >= 0, floor(x * s + 0.5), ceiling(x * s - 0.5)) / s
  )
  as.numeric(out)
}

#' @keywords internal
.dim_fmt_int <- function(x) {
  x <- .dim_round_half_up(x, 0)
  ifelse(is.na(x), "", format(as.integer(x), trim = TRUE, scientific = FALSE))
}

#' @keywords internal
.dim_normalize_semaforo_modo <- function(modo, default = "grupos") {
  out <- as.character(modo %||% default)[1]
  if (is.na(out) || !nzchar(trimws(out))) out <- default
  out <- tolower(trimws(out))
  if (identical(out, "degradado")) out <- "degradado_automatico"
  if (!out %in% c("grupos", "degradado_automatico", "degradado_manual")) out <- default
  out
}

#' @keywords internal
.dim_normalize_degradado_anclas <- function(anclas, cortes, default = c(rojo = 0, verde = 100)) {
  cuts <- suppressWarnings(as.numeric(cortes))
  cuts <- cuts[is.finite(cuts) & !is.na(cuts)]
  if (length(cuts) < 2L) cuts <- c(60, 80)
  cuts <- sort(unique(cuts))[1:2]
  if (length(cuts) < 2L || cuts[1] >= cuts[2]) cuts <- c(60, 80)

  vals <- suppressWarnings(as.numeric(anclas))
  vals <- vals[is.finite(vals) & !is.na(vals)]
  if (!length(vals)) {
    vals <- suppressWarnings(as.numeric(default))
  }
  if (length(vals) == 1L) vals <- c(vals[1], 100)
  if (length(vals) < 2L) vals <- c(0, 100)

  low_anchor <- vals[1]
  high_anchor <- vals[2]

  low_anchor <- pmax(0, pmin(cuts[1], low_anchor))
  high_anchor <- pmax(cuts[2], pmin(100, high_anchor))
  if (!is.finite(low_anchor) || is.na(low_anchor)) low_anchor <- 0
  if (!is.finite(high_anchor) || is.na(high_anchor)) high_anchor <- 100
  if (high_anchor <= cuts[2]) high_anchor <- 100

  c(rojo = low_anchor, verde = high_anchor)
}

#' @keywords internal
.dim_mix_color <- function(col_a, col_b, t, fallback = "#FFFFFF") {
  tt <- suppressWarnings(as.numeric(t)[1])
  if (!is.finite(tt) || is.na(tt)) tt <- 0
  tt <- pmax(0, pmin(1, tt))

  rgb_a <- tryCatch(grDevices::col2rgb(col_a), error = function(e) NULL)
  rgb_b <- tryCatch(grDevices::col2rgb(col_b), error = function(e) NULL)
  if (is.null(rgb_a)) rgb_a <- grDevices::col2rgb(fallback)
  if (is.null(rgb_b)) rgb_b <- grDevices::col2rgb(fallback)

  rr <- round(rgb_a[, 1] + (rgb_b[, 1] - rgb_a[, 1]) * tt)
  grDevices::rgb(rr[1], rr[2], rr[3], maxColorValue = 255)
}

#' @keywords internal
.dim_quantize_gradient_t <- function(t, n_steps = 20L) {
  tt <- suppressWarnings(as.numeric(t))
  tt[!is.finite(tt) | is.na(tt)] <- 0
  tt <- pmax(0, pmin(1, tt))
  n_steps <- suppressWarnings(as.integer(n_steps)[1])
  if (!is.finite(n_steps) || is.na(n_steps) || n_steps < 2L) return(tt)
  round(tt * (n_steps - 1L)) / (n_steps - 1L)
}

#' @keywords internal
.dim_normalize_gradiente_segmentos <- function(segmentos, default = 20L) {
  out <- suppressWarnings(as.integer(segmentos)[1])
  if (!is.finite(out) || is.na(out) || out < 2L) out <- as.integer(default)
  as.integer(out)
}

#' @keywords internal
.dim_normalize_gradiente_manual <- function(colores, valores, limites = NULL) {
  cols <- as.character(colores %||% character(0))
  cols <- cols[!is.na(cols) & nzchar(trimws(cols))]

  vals <- suppressWarnings(as.numeric(valores))
  vals <- vals[is.finite(vals) & !is.na(vals)]

  if (length(cols) < 2L || length(vals) < 2L) {
    stop(
      "Semaforo manual: debe definir al menos dos `semaforo_gradiente_colores` y dos `semaforo_gradiente_valores`.",
      call. = FALSE
    )
  }

  if (length(cols) != length(vals)) {
    stop(
      "Semaforo manual: `semaforo_gradiente_colores` y `semaforo_gradiente_valores` deben tener la misma longitud.",
      call. = FALSE
    )
  }

  if (is.unsorted(vals, strictly = TRUE)) {
    stop(
      "Semaforo manual: `semaforo_gradiente_valores` debe venir en orden ascendente y sin repetidos.",
      call. = FALSE
    )
  }

  lims <- suppressWarnings(as.numeric(limites))
  lims <- lims[is.finite(lims) & !is.na(lims)]
  if (length(lims) >= 2L) {
    lims <- lims[1:2]
    if (lims[1] >= lims[2]) {
      stop(
        "Semaforo manual: `semaforo_gradiente_limites` debe tener dos valores ascendentes.",
        call. = FALSE
      )
    }
  } else {
    lims <- range(vals)
  }

  if (vals[1] < lims[1] || vals[length(vals)] > lims[2]) {
    stop(
      "Semaforo manual: `semaforo_gradiente_valores` debe quedar dentro de `semaforo_gradiente_limites`.",
      call. = FALSE
    )
  }

  span <- lims[2] - lims[1]
  vals_rescaled <- if (isTRUE(span > 0)) {
    (vals - lims[1]) / span
  } else {
    rep(0, length(vals))
  }

  list(
    colores = cols,
    valores = vals,
    limites = lims,
    valores_rescaled = pmax(0, pmin(1, vals_rescaled))
  )
}

#' @keywords internal
.dim_semaforo_estado <- function(x, cortes, digits = 0L,
                                 labels = c("rojo", "ambar", "verde")) {
  cuts <- suppressWarnings(as.numeric(cortes))
  cuts <- cuts[is.finite(cuts) & !is.na(cuts)]
  if (length(cuts) < 2L) cuts <- c(60, 80)
  cuts <- sort(unique(cuts))[1:2]
  if (length(cuts) < 2L || cuts[1] >= cuts[2]) cuts <- c(60, 80)

  labs <- as.character(labels %||% c("rojo", "ambar", "verde"))
  if (length(labs) < 3L) labs <- c("rojo", "ambar", "verde")
  labs <- labs[1:3]

  x_round <- .dim_round_half_up(x, digits)
  out <- ifelse(
    is.na(x_round),
    NA_character_,
    ifelse(
      x_round < cuts[1],
      labs[1],
      ifelse(x_round <= cuts[2], labs[2], labs[3])
    )
  )
  as.character(out)
}

#' @keywords internal
.dim_semaforo_color <- function(x, cortes, colores, digits = 0L,
                                na_color = NA_character_,
                                modo = "grupos",
                                anclas_degradado = NULL,
                                gradiente_colores = NULL,
                                gradiente_valores = NULL,
                                gradiente_limites = NULL,
                                gradiente_segmentos = 20L) {
  cols <- colores %||% character(0)
  cols_chr <- as.character(unname(cols))
  cols_nms <- names(cols)
  if (is.null(cols_nms)) cols_nms <- character(0)
  if (length(cols_chr) && length(cols_nms) == length(cols_chr)) {
    names(cols_chr) <- cols_nms
  }
  col_rojo <- if ("rojo" %in% cols_nms) cols_chr[["rojo"]] else "#D84B55"
  col_ambar <- if ("ambar" %in% cols_nms) cols_chr[["ambar"]] else if ("amarillo" %in% cols_nms) cols_chr[["amarillo"]] else "#E0B44C"
  col_verde <- if ("verde" %in% cols_nms) cols_chr[["verde"]] else "#3A9A5B"
  modo <- .dim_normalize_semaforo_modo(modo)

  x_round <- .dim_round_half_up(x, digits)
  out <- rep(as.character(na_color), length(x_round))
  ok <- !is.na(x_round) & is.finite(x_round)
  if (!any(ok)) return(as.character(out))

  if (identical(modo, "grupos")) {
    est <- .dim_semaforo_estado(
      x = x_round,
      cortes = cortes,
      digits = 0L,
      labels = c("rojo", "ambar", "verde")
    )
    out[ok] <- ifelse(
      est[ok] == "rojo",
      col_rojo,
      ifelse(est[ok] == "ambar", col_ambar, col_verde)
    )
    return(as.character(out))
  }

  if (identical(modo, "degradado_manual")) {
    grad_manual <- .dim_normalize_gradiente_manual(
      colores = gradiente_colores,
      valores = gradiente_valores,
      limites = gradiente_limites
    )
    lims <- grad_manual$limites
    vals <- pmax(lims[1], pmin(lims[2], x_round[ok]))
    vals_rescaled <- if (isTRUE(diff(lims) > 0)) {
      (vals - lims[1]) / diff(lims)
    } else {
      rep(0, length(vals))
    }
    vals_rescaled <- pmax(0, pmin(1, vals_rescaled))
    anclas <- grad_manual$valores_rescaled
    cols_manual <- grad_manual$colores
    cols_out <- character(length(vals_rescaled))

    for (ii in seq_along(vals_rescaled)) {
      vv <- vals_rescaled[ii]
      if (vv <= anclas[1]) {
        cols_out[ii] <- cols_manual[1]
      } else if (vv >= anclas[length(anclas)]) {
        cols_out[ii] <- cols_manual[length(cols_manual)]
      } else {
        idx_hi <- which(anclas >= vv)[1]
        idx_lo <- max(1L, idx_hi - 1L)
        span <- anclas[idx_hi] - anclas[idx_lo]
        tt <- if (isTRUE(span > 0)) (vv - anclas[idx_lo]) / span else 0
        cols_out[ii] <- .dim_mix_color(cols_manual[idx_lo], cols_manual[idx_hi], tt)
      }
    }

    out[ok] <- cols_out
    return(as.character(out))
  }

  cuts <- suppressWarnings(as.numeric(cortes))
  cuts <- cuts[is.finite(cuts) & !is.na(cuts)]
  if (length(cuts) < 2L) cuts <- c(60, 80)
  cuts <- sort(unique(cuts))[1:2]
  if (length(cuts) < 2L || cuts[1] >= cuts[2]) cuts <- c(60, 80)
  anclas_deg <- .dim_normalize_degradado_anclas(anclas_degradado, cuts, default = c(rojo = 0, verde = 100))
  low_anchor <- unname(anclas_deg[["rojo"]])
  high_anchor <- unname(anclas_deg[["verde"]])

  vals <- pmax(0, pmin(100, x_round[ok]))
  cols_out <- rep(col_ambar, length(vals))
  n_steps <- .dim_normalize_gradiente_segmentos(gradiente_segmentos, default = 20L)

  col_ambar_lo <- .dim_mix_color("#FFF1A6", col_ambar, 0.72)
  col_ambar_hi <- .dim_mix_color(col_ambar, "#D8A91C", 0.28)
  col_verde_lo <- .dim_mix_color(col_ambar, col_verde, 0.18)
  col_verde_hi <- .dim_mix_color(col_verde, "#0B5D43", 0.45)

  idx_low <- vals <= cuts[1]
  idx_mid <- vals > cuts[1] & vals <= cuts[2]
  idx_hi  <- vals > cuts[2]

  if (any(idx_low)) {
    t_low <- (vals[idx_low] - low_anchor) / max(cuts[1] - low_anchor, .Machine$double.eps)
    t_low <- pmax(0, pmin(1, t_low))
    t_low <- .dim_quantize_gradient_t(t_low, n_steps = n_steps)
    cols_out[idx_low] <- vapply(
      t_low^0.9,
      function(tt) .dim_mix_color(col_rojo, col_ambar, tt),
      character(1)
    )
  }

  if (any(idx_mid)) {
    t_mid <- (vals[idx_mid] - cuts[1]) / max(cuts[2] - cuts[1], .Machine$double.eps)
    t_mid <- .dim_quantize_gradient_t(t_mid, n_steps = n_steps)
    cols_out[idx_mid] <- vapply(
      t_mid^1.02,
      function(tt) .dim_mix_color(col_ambar_lo, col_ambar_hi, tt),
      character(1)
    )
  }

  if (any(idx_hi)) {
    t_hi <- (vals[idx_hi] - cuts[2]) / max(high_anchor - cuts[2], .Machine$double.eps)
    t_hi <- pmax(0, pmin(1, t_hi))
    t_hi <- .dim_quantize_gradient_t(t_hi, n_steps = n_steps)
    cols_out[idx_hi] <- vapply(
      t_hi^1.08,
      function(tt) .dim_mix_color(col_verde_lo, col_verde_hi, tt),
      character(1)
    )
  }

  out[ok] <- cols_out
  as.character(out)
}

#' @keywords internal
.dim_clamp <- function(x, lo, hi) max(lo, min(hi, x))

#' @keywords internal
.dim_pretty_label <- function(x) .ind_pretty_label(x)

#' @keywords internal
.dim_first_nonempty <- function(...) {
  vals <- list(...)
  for (vv in vals) {
    v <- as.character(.dim_or(vv, ""))[1]
    if (!is.na(v) && nzchar(trimws(v))) return(trimws(v))
  }
  ""
}

#' @keywords internal
.dim_choices_label_col <- function(ch) {
  if (is.null(ch)) return(NULL)
  if ("label" %in% names(ch)) return("label")
  cand <- grep("^label(::|$)", names(ch), value = TRUE)
  if (length(cand)) cand[1] else NULL
}

#' @keywords internal
.dim_choice_map <- function(var, instrumento) {
  surv <- instrumento$survey %||% NULL
  ch <- instrumento$choices %||% NULL
  if (is.null(surv) || is.null(ch) ||
      !all(c("name", "list_name") %in% names(surv)) ||
      !all(c("list_name", "name") %in% names(ch))) {
    return(stats::setNames(character(0), character(0)))
  }

  ln <- get_list_name(var, surv)
  if (is.na(ln) || !nzchar(ln)) return(stats::setNames(character(0), character(0)))

  col_lab <- .dim_choices_label_col(ch)
  if (is.null(col_lab) || !(col_lab %in% names(ch))) {
    return(stats::setNames(character(0), character(0)))
  }

  chv <- ch[ch$list_name == ln, , drop = FALSE]
  if (!nrow(chv)) return(stats::setNames(character(0), character(0)))
  stats::setNames(as.character(chv[[col_lab]]), as.character(chv$name))
}

#' @keywords internal
.dim_safe_weights <- function(df, weight_col = NULL) {
  weight_col <- as.character(.dim_or(weight_col, attr(df, "var_peso", exact = TRUE)) %||% "")[1]
  if (!nzchar(weight_col) || !(weight_col %in% names(df))) {
    return(rep(1, nrow(df)))
  }
  w <- suppressWarnings(as.numeric(df[[weight_col]]))
  w[!is.finite(w) | is.na(w)] <- 0
  w
}

#' @keywords internal
.dim_weighted_mean <- function(x, w) {
  x <- suppressWarnings(as.numeric(x))
  w <- suppressWarnings(as.numeric(w))
  ok <- is.finite(x) & !is.na(x) & is.finite(w) & !is.na(w) & w > 0
  if (!any(ok)) return(NA_real_)
  sum(x[ok] * w[ok], na.rm = TRUE) / sum(w[ok], na.rm = TRUE)
}

#' @keywords internal
.dim_level_label_map <- function(var, data, instrumento) {
  if (!(var %in% names(data))) return(stats::setNames(character(0), character(0)))

  out <- stats::setNames(character(0), character(0))
  labs <- attr(data[[var]], "labels", exact = TRUE)
  if (!is.null(labs) && length(labs)) {
    out <- stats::setNames(as.character(unname(labs)), as.character(names(labs)))
  }

  map_choice <- .dim_choice_map(var, instrumento)
  if (length(map_choice)) out[names(map_choice)] <- map_choice
  out
}

#' @keywords internal
.dim_level_label_order <- function(var, data, instrumento = NULL) {
  if (!(var %in% names(data))) return(character(0))

  x <- data[[var]]
  out <- character(0)

  if (is.factor(x)) {
    out <- levels(x)
  }

  if (!length(out)) {
    labs <- attr(x, "labels", exact = TRUE)
    if (!is.null(labs) && length(labs)) {
      out <- as.character(unname(labs))
    }
  }

  if (!length(out) && !is.null(instrumento)) {
    surv <- instrumento$survey %||% NULL
    ch <- instrumento$choices %||% NULL
    ln <- tryCatch(get_list_name(var, surv), error = function(e) NA_character_)
    col_lab <- .dim_choices_label_col(ch)
    if (!is.null(ch) && !is.null(surv) &&
        !is.na(ln) && nzchar(ln) &&
        !is.null(col_lab) && col_lab %in% names(ch)) {
      chv <- ch[ch$list_name == ln, , drop = FALSE]
      if (nrow(chv)) out <- as.character(chv[[col_lab]])
    }
  }

  out <- trimws(as.character(out))
  out <- out[!is.na(out) & nzchar(out) & out != "NA"]
  unique(out)
}

#' @keywords internal
.dim_categorias_var <- function(df, var, w, data_ref = df, instrumento = NULL, max_levels = 12L) {
  out_empty <- list(
    rows = data.frame(value = character(0), label = character(0), base = numeric(0), stringsAsFactors = FALSE),
    total_levels = 0L,
    hidden_levels = 0L
  )

  if (!(var %in% names(df)) || !nrow(df)) return(out_empty)

  x <- trimws(as.character(df[[var]]))
  ok <- !is.na(x) & nzchar(x) & x != "NA"
  if (!any(ok)) return(out_empty)

  ww <- as.numeric(w)
  if (length(ww) != nrow(df)) ww <- rep(1, nrow(df))

  tab <- stats::aggregate(
    ww[ok],
    by = list(value = x[ok]),
    FUN = sum,
    na.rm = TRUE
  )
  names(tab) <- c("value", "base")
  tab <- tab[order(-tab$base, tab$value), , drop = FALSE]

  map <- if (!is.null(instrumento)) {
    .dim_level_label_map(var, data_ref, instrumento)
  } else {
    stats::setNames(character(0), character(0))
  }

  labs <- unname(map[tab$value])
  labs[is.na(labs) | !nzchar(labs)] <- tab$value[is.na(labs) | !nzchar(labs)]
  tab$label <- as.character(labs)

  n_tot <- nrow(tab)
  if (is.finite(max_levels) && max_levels > 0L && n_tot > max_levels) {
    tab <- tab[seq_len(max_levels), , drop = FALSE]
  }

  list(
    rows = tab[, c("value", "label", "base"), drop = FALSE],
    total_levels = n_tot,
    hidden_levels = max(0L, n_tot - nrow(tab))
  )
}

#' @keywords internal
.dim_range_labels <- function(c1, c2) {
  c(
    paste0("Menor a ", .dim_fmt_int(c1)),
    paste0(.dim_fmt_int(c1), " - ", .dim_fmt_int(c2)),
    paste0("Mayor a ", .dim_fmt_int(c2))
  )
}

#' @keywords internal
.dim_palette_ipe <- function(n) {
  base_cols <- c(
    "#355C7D", "#6C5B7B", "#C06C84", "#F67280", "#F8B195",
    "#4575B4", "#74ADD1", "#ABD9E9", "#E0F3F8", "#FEE090",
    "#FDAE61", "#F46D43", "#D73027", "#66BD63", "#1A9850",
    "#006837", "#8C510A", "#BF812D", "#DFC27D", "#80CDC1",
    "#018571", "#35978F", "#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C"
  )
  if (n <= length(base_cols)) base_cols[seq_len(n)] else grDevices::colorRampPalette(base_cols)(n)
}

#' @keywords internal
.dim_palette_okabe <- function(n) {
  cols <- c("#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000")
  if (n <= length(cols)) cols[seq_len(n)] else grDevices::colorRampPalette(cols)(n)
}

#' @keywords internal
.dim_group_colors <- function(
    groups,
    paleta_radar = "okabe_ito",
    total_color = "#0E3B74",
    palette_override = NULL,
    group_keys = NULL
) {
  groups <- unique(as.character(groups))
  if (!length(groups)) return(stats::setNames(character(0), character(0)))

  others <- setdiff(groups, "Total")
  pal <- if (identical(paleta_radar, "ipe")) {
    .dim_palette_ipe(length(others))
  } else {
    .dim_palette_okabe(length(others))
  }
  names(pal) <- others

  out <- stats::setNames(rep("#4B6E99", length(groups)), groups)
  if ("Total" %in% groups) out[["Total"]] <- as.character(total_color %||% "#0E3B74")
  if (length(others)) out[others] <- pal[others]

  if (!is.null(palette_override) && length(palette_override)) {
    pal_override <- as.character(unlist(palette_override, use.names = TRUE))
    pal_names <- names(pal_override)

    if (is.null(pal_names)) {
      pal_override <- pal_override[seq_len(min(length(pal_override), length(others)))]
      names(pal_override) <- others[seq_along(pal_override)]
      pal_names <- names(pal_override)
    } else {
      pal_names <- trimws(as.character(pal_names))
      ok <- !is.na(pal_names) & nzchar(pal_names)
      pal_override <- stats::setNames(pal_override[ok], pal_names[ok])
      pal_names <- names(pal_override)
    }

    if (length(pal_override)) {
      key_map <- stats::setNames(rep(NA_character_, length(groups)), groups)
      if (!is.null(group_keys) && length(group_keys) == length(groups)) {
        key_map[groups] <- as.character(group_keys)
      }

      for (grp in others) {
        if (grp %in% pal_names) {
          out[[grp]] <- pal_override[[grp]]
          next
        }

        grp_key <- key_map[[grp]] %||% NA_character_
        if (!is.na(grp_key) && nzchar(grp_key) && grp_key %in% pal_names) {
          out[[grp]] <- pal_override[[grp_key]]
        }
      }
    }
  }

  out
}

#' @keywords internal
.dim_group_order <- function(sc) {
  if (!nrow(sc)) return(character(0))
  base_df <- sc |>
    dplyr::distinct(.data$grupo, .data$base)

  others_df <- base_df[base_df$grupo != "Total", , drop = FALSE]
  others <- as.character(others_df$grupo[order(-others_df$base, as.character(others_df$grupo))])

  if ("Total" %in% as.character(base_df$grupo)) unique(c("Total", others)) else unique(others)
}

#' @keywords internal
.dim_add_alpha <- function(col, alpha = 0.22) {
  grDevices::adjustcolor(as.character(.dim_or(col, "#1F4E85")), alpha.f = alpha)
}

#' @keywords internal
.dim_wrap_axis_label <- function(x, width = 16L) {
  x <- as.character(.dim_or(x, ""))
  if (!length(x)) return(x)
  if (requireNamespace("stringr", quietly = TRUE)) {
    stringr::str_wrap(x, width = width)
  } else {
    vapply(x, function(xx) paste(strwrap(xx, width = width), collapse = "\n"), character(1))
  }
}

#' @keywords internal
.dim_apply_filters <- function(df, filters = list()) {
  .apply_named_filters(df, filters = filters, arg_name = "filtros")
}

#' @keywords internal
.dim_resolve_visual_cfg <- function(config) {
  vis_cfg <- config$visual %||% list()

  radar_min_ejes <- suppressWarnings(as.integer(vis_cfg$radar_min_ejes %||% 3L)[1])
  if (!is.finite(radar_min_ejes) || is.na(radar_min_ejes) || radar_min_ejes < 1L) radar_min_ejes <- 3L

  max_categorias_principal <- suppressWarnings(as.integer(vis_cfg$max_categorias_principal %||% 8L)[1])
  if (!is.finite(max_categorias_principal) || is.na(max_categorias_principal) || max_categorias_principal < 1L) {
    max_categorias_principal <- 8L
  }

  max_niveles_iteracion <- suppressWarnings(as.integer(vis_cfg$max_niveles_iteracion %||% 12L)[1])
  if (!is.finite(max_niveles_iteracion) || is.na(max_niveles_iteracion) || max_niveles_iteracion < 1L) {
    max_niveles_iteracion <- 12L
  }

  paleta_radar <- as.character(vis_cfg$paleta_radar %||% "okabe_ito")[1]
  if (!paleta_radar %in% c("okabe_ito", "ipe")) paleta_radar <- "okabe_ito"

  sem_cfg <- config$semaforo %||% list()
  sem_cortes <- suppressWarnings(as.numeric(sem_cfg$cortes %||% c(60, 80)))
  sem_cortes <- sem_cortes[is.finite(sem_cortes)]
  if (length(sem_cortes) < 2L) sem_cortes <- c(60, 80)
  sem_cortes <- sort(unique(sem_cortes))[1:2]
  sem_cortes <- pmax(0, pmin(100, sem_cortes))
  if (length(sem_cortes) < 2L || sem_cortes[1] >= sem_cortes[2]) sem_cortes <- c(60, 80)
  sem_anclas <- .dim_normalize_degradado_anclas(
    sem_cfg$anclas_degradado %||% NULL,
    sem_cortes,
    default = c(rojo = 0, verde = 100)
  )
  sem_segmentos <- .dim_normalize_gradiente_segmentos(
    sem_cfg$gradiente_segmentos %||% 20L,
    default = 20L
  )
  sem_grad_manual <- NULL
  if (identical(.dim_normalize_semaforo_modo(sem_cfg$modo %||% "grupos"), "degradado_manual")) {
    sem_grad_manual <- .dim_normalize_gradiente_manual(
      colores = sem_cfg$gradiente_colores %||% NULL,
      valores = sem_cfg$gradiente_valores %||% NULL,
      limites = sem_cfg$gradiente_limites %||% NULL
    )
  }

  sem_cols <- as.character(sem_cfg$colores %||% character(0))
  nms_sem <- names(sem_cols %||% character(0))
  if (is.null(nms_sem)) nms_sem <- character(0)

  sem_rojo <- if ("rojo" %in% nms_sem) sem_cols[["rojo"]] else "#D84B55"
  sem_ambar <- if ("ambar" %in% nms_sem) sem_cols[["ambar"]] else "#E0B44C"
  sem_verde <- if ("verde" %in% nms_sem) sem_cols[["verde"]] else "#3A9A5B"

  list(
    radar_min_ejes = as.integer(radar_min_ejes),
    max_categorias_principal = as.integer(max_categorias_principal),
    max_niveles_iteracion = as.integer(max_niveles_iteracion),
    paleta_radar = paleta_radar,
    incluir_total_default = isTRUE(vis_cfg$incluir_total_default),
    semaforo = list(
      cortes = sem_cortes,
      modo = .dim_normalize_semaforo_modo(sem_cfg$modo %||% "grupos"),
      anclas_degradado = sem_anclas,
      gradiente_segmentos = as.integer(sem_segmentos),
      gradiente_colores = sem_grad_manual$colores %||% NULL,
      gradiente_valores = sem_grad_manual$valores %||% NULL,
      gradiente_limites = sem_grad_manual$limites %||% NULL,
      colores = c(rojo = sem_rojo, ambar = sem_ambar, verde = sem_verde),
      rojo = sem_rojo,
      ambar = sem_ambar,
      verde = sem_verde,
      na = "#DFE5EE"
    )
  )
}

#' @keywords internal
.dim_build_context <- function(
    data,
    instrumento = NULL,
    config = NULL,
    secciones_limpias = NULL,
    theme_color = "#0E3B74",
    weight_col = NULL
) {
  .dim_validate_ready_data(data, caller = ".dim_build_context()")
  instrumento <- .dim_resolve_instrumento(data, instrumento = instrumento, caller = ".dim_build_context()")
  config <- .dim_or(config, attr(data, "dimensiones_config", exact = TRUE))
  config <- .dim_or(config, reporte_dimensiones_config(data))
  if (!is.list(config)) {
    stop("`.dim_build_context()`: `config` debe ser lista.", call. = FALSE)
  }

  meta_raw <- attr(data, "indices_meta", exact = TRUE)
  rec_meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  meta_indices <- if (is.list(meta_raw) && is.list(meta_raw$indices)) meta_raw$indices else list()
  meta_subindices <- if (is.list(meta_raw) && is.list(meta_raw$subindices)) meta_raw$subindices else list()

  idx_key_to_var <- stats::setNames(
    vapply(meta_indices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
    names(meta_indices)
  )
  idx_key_to_var <- idx_key_to_var[!is.na(idx_key_to_var) & nzchar(idx_key_to_var)]
  idx_var_to_key <- stats::setNames(names(idx_key_to_var), as.character(idx_key_to_var))

  sub_key_to_var <- stats::setNames(
    vapply(meta_subindices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
    names(meta_subindices)
  )
  sub_key_to_var <- sub_key_to_var[!is.na(sub_key_to_var) & nzchar(sub_key_to_var)]
  sub_var_to_key <- stats::setNames(names(sub_key_to_var), as.character(sub_key_to_var))

  rec_out_to_src <- stats::setNames(character(0), character(0))
  if (is.list(rec_meta) && length(rec_meta)) {
    rec_df <- data.frame(
      src = names(rec_meta),
      out = vapply(rec_meta, function(x) as.character(x$variable_salida %||% NA_character_)[1], character(1)),
      stringsAsFactors = FALSE
    )
    rec_df <- rec_df[!is.na(rec_df$out) & nzchar(rec_df$out), , drop = FALSE]
    if (nrow(rec_df)) {
      rec_out_to_src <- stats::setNames(as.character(rec_df$src), as.character(rec_df$out))
    }
  }

  label_var <- function(v) {
    f <- get0(".obtener_label_var", mode = "function", ifnotfound = NULL)
    if (is.function(f)) {
      out <- tryCatch(f(v, instrumento, data), error = function(e) NULL)
      out <- as.character(out %||% "")
      if (nzchar(trimws(out))) return(out)
    }
    as.character(v)
  }

  label_data <- function(v) {
    if (!(v %in% names(data))) return(.dim_pretty_label(v))
    lb <- attr(data[[v]], "label", exact = TRUE)
    lb <- as.character(lb %||% "")
    lb <- gsub("\\s*\\[0-100\\]$", "", lb)
    if (nzchar(trimws(lb))) trimws(lb) else .dim_pretty_label(v)
  }

  lbl_idx <- .dim_as_named_chr(config$labels_indices)
  lbl_sub <- .dim_as_named_chr(config$labels_subindices)
  lbl_ind <- .dim_as_named_chr(config$labels_indicadores)

  label_idx <- function(v, key = NULL) {
    kk <- as.character(key %||% .dim_nm_get(idx_var_to_key, v) %||% "")
    .dim_first_nonempty(
      .dim_nm_get(lbl_idx, kk),
      .dim_nm_get(lbl_idx, v),
      if (nzchar(kk)) .dim_pretty_label(kk) else "",
      label_data(v),
      label_var(v),
      .dim_pretty_label(v)
    )
  }

  label_sub <- function(v, key = NULL) {
    kk <- as.character(key %||% .dim_nm_get(sub_var_to_key, v) %||% "")
    sub_etiq <- if (nzchar(kk) && kk %in% names(meta_subindices)) meta_subindices[[kk]]$etiqueta else NULL
    .dim_first_nonempty(
      sub_etiq,
      .dim_nm_get(lbl_sub, kk),
      .dim_nm_get(lbl_sub, v),
      if (nzchar(kk)) .dim_pretty_label(kk) else "",
      label_data(v),
      label_var(v),
      .dim_pretty_label(v)
    )
  }

  label_ind <- function(v) {
    src <- as.character(.dim_nm_get(rec_out_to_src, v) %||% "")
    .dim_first_nonempty(
      .dim_nm_get(lbl_ind, v),
      if (nzchar(src)) .dim_nm_get(lbl_ind, src) else "",
      label_data(v),
      label_var(v),
      if (nzchar(src)) .dim_pretty_label(src) else "",
      .dim_pretty_label(v)
    )
  }

  build_catalog <- function(cat_in, mode = c("general", "indicadores")) {
    mode <- match.arg(mode)
    out <- list()

    if (is.list(cat_in) && length(cat_in)) {
      for (nm in names(cat_in)) {
        it <- cat_in[[nm]]
        if (!is.list(it)) next

        if (identical(mode, "general")) {
          id_var <- as.character(it$id %||% nm)[1]
          key <- as.character(it$key %||% .dim_nm_get(idx_var_to_key, id_var) %||% nm)[1]
          axis_vars <- as.character(it$axis_vars %||% character(0))
          axis_vars <- axis_vars[axis_vars %in% names(data)]
          if (!length(axis_vars) || !(id_var %in% names(data))) next

          out[[id_var]] <- list(
            id = id_var,
            key = key,
            mode = "general",
            label = label_idx(id_var, key),
            icono = meta_indices[[key]]$icono %||% NULL,
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, label_sub, character(1)),
            axis_iconos = lapply(axis_vars, function(av) {
              sk <- .dim_nm_get(sub_var_to_key, av)
              if (!is.null(sk) && nzchar(sk)) meta_subindices[[sk]]$icono else NULL
            })
          )
        } else {
          key <- as.character(it$key %||% it$id %||% nm)[1]
          bvar <- as.character(it$block_var %||% .dim_nm_get(sub_key_to_var, key) %||% NA_character_)[1]
          axis_vars <- as.character(it$axis_vars %||% character(0))
          axis_vars <- axis_vars[axis_vars %in% names(data)]
          if (!length(axis_vars)) next

          out[[key]] <- list(
            id = key,
            key = key,
            mode = "indicadores",
            label = label_sub(bvar, key),
            icono = meta_subindices[[key]]$icono %||% NULL,
            block_var = bvar,
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, label_ind, character(1)),
            axis_iconos = vector("list", length(axis_vars))
          )
        }
      }
    }

    out
  }

  catalog_general <- build_catalog(config$catalog_general, mode = "general")
  catalog_indicadores <- build_catalog(config$catalog_indicadores, mode = "indicadores")

  if (!length(catalog_general)) {
    for (nm in names(meta_indices)) {
      it <- meta_indices[[nm]]
      idx_var <- as.character(it$salida %||% NA_character_)[1]
      if (is.na(idx_var) || !nzchar(idx_var) || !(idx_var %in% names(data))) next

      refs <- unique(c(
        as.character(it$refs_resueltas %||% character(0)),
        as.character(it$refs %||% character(0))
      ))
      axis_vars <- character(0)
      for (r in refs) {
        rv <- if (r %in% names(data)) {
          r
        } else if (r %in% names(sub_key_to_var)) {
          as.character(sub_key_to_var[[r]])
        } else {
          NA_character_
        }
        if (!is.na(rv) && nzchar(rv) && rv %in% names(data) && !(rv %in% axis_vars)) {
          axis_vars <- c(axis_vars, rv)
        }
      }
      if (!length(axis_vars)) next

      catalog_general[[idx_var]] <- list(
        id = idx_var,
        key = nm,
        mode = "general",
        label = label_idx(idx_var, nm),
        icono = it$icono %||% NULL,
        axis_vars = axis_vars,
        axis_labels = vapply(axis_vars, label_sub, character(1)),
        axis_iconos = lapply(axis_vars, function(av) {
          sk <- .dim_nm_get(sub_var_to_key, av)
          if (!is.null(sk) && nzchar(sk)) meta_subindices[[sk]]$icono else NULL
        })
      )
    }
  }

  if (!length(catalog_indicadores)) {
    for (sk in names(meta_subindices)) {
      sl <- meta_subindices[[sk]]
      svar <- as.character(sl$salida %||% NA_character_)[1]
      axis_vars <- unique(as.character(sl$vars %||% character(0)))
      axis_vars <- axis_vars[axis_vars %in% names(data)]
      if (!length(axis_vars)) next

      catalog_indicadores[[sk]] <- list(
        id = sk,
        key = sk,
        mode = "indicadores",
        label = label_sub(svar, sk),
        icono = sl$icono %||% NULL,
        block_var = svar,
        axis_vars = axis_vars,
        axis_labels = vapply(axis_vars, label_ind, character(1)),
        axis_iconos = vector("list", length(axis_vars))
      )
    }
  }

  surv <- instrumento$survey %||% NULL
  so_all <- character(0)
  if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
    so_all <- as.character(surv$name[grepl("^select_one\\b", tolower(as.character(surv$type)))])
    so_all <- unique(so_all[so_all %in% names(data)])
  }

  sec_map_raw <- secciones_limpias %||% list()
  if (!is.list(sec_map_raw) || !length(sec_map_raw)) {
    sec_map_raw <- list("Variables disponibles" = so_all)
  }
  if (is.null(names(sec_map_raw)) || !length(names(sec_map_raw))) {
    names(sec_map_raw) <- paste0("Sección ", seq_along(sec_map_raw))
  }

  section_var_map <- lapply(sec_map_raw, function(vs) {
    vv <- unique(as.character(vs))
    vv <- vv[vv %in% names(data)]
    vv
  })
  section_var_map <- section_var_map[vapply(section_var_map, length, integer(1)) > 0]

  if (!length(section_var_map) && length(so_all)) {
    section_var_map <- list("Variables disponibles" = so_all)
  }

  var_filtrable <- function(v) {
    if (!(v %in% names(data))) return(FALSE)

    surv <- instrumento$survey %||% NULL
    if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
      tipo <- tolower(as.character(surv$type[surv$name == v][1] %||% ""))
      if (grepl("^select_one\\b", tipo) || grepl("^select_multiple\\b", tipo)) return(TRUE)
    }

    if (length(.dim_choice_map(v, instrumento))) return(TRUE)

    x <- trimws(as.character(data[[v]]))
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]
    n_u <- length(unique(x))
    is.finite(n_u) && n_u > 1L && n_u <= 60L
  }

  filter_var_map <- lapply(section_var_map, function(vs) {
    vv <- unique(as.character(vs))
    vv <- vv[vapply(vv, var_filtrable, logical(1))]
    vv
  })
  filter_var_map <- filter_var_map[vapply(filter_var_map, length, integer(1)) > 0]

  vis <- .dim_resolve_visual_cfg(config)

  weight_col <- as.character(weight_col %||% attr(data, "var_peso", exact = TRUE) %||% "")[1]
  if (!nzchar(weight_col) || !(weight_col %in% names(data))) {
    weight_col <- if ("peso" %in% names(data)) "peso" else ""
  }

  structure(list(
    data = data,
    instrumento = instrumento,
    config = config,
    theme_color = as.character(theme_color %||% "#0E3B74")[1],
    weight_col = weight_col,
    meta_indices = meta_indices,
    meta_subindices = meta_subindices,
    catalog_general = catalog_general,
    catalog_indicadores = catalog_indicadores,
    section_var_map = section_var_map,
    filter_var_map = filter_var_map,
    label_var = label_var,
    label_data = label_data,
    label_idx = label_idx,
    label_sub = label_sub,
    label_ind = label_ind,
    radar_min_ejes = vis$radar_min_ejes,
    max_categorias_principal = vis$max_categorias_principal,
    max_niveles_iteracion = vis$max_niveles_iteracion,
    paleta_radar = vis$paleta_radar,
    paletas_cruce = config$paletas_cruce %||% list(),
    incluir_total_default = vis$incluir_total_default,
    semaforo = vis$semaforo
  ), class = c("prosecnur_dim_context", "list"))
}

# =============================================================================
# FODA helpers
# =============================================================================

#' @keywords internal
.foda_compute_stats <- function(data, vars, labels, usar_pesos = TRUE, weight_col = NULL) {
  n <- length(vars)
  score_mean <- rep(NA_real_, n)
  score_sd   <- rep(NA_real_, n)
  n_valid    <- rep(0L, n)
  usar_pesos <- isTRUE(usar_pesos)
  w_all <- if (usar_pesos) .dim_safe_weights(data, weight_col = weight_col) else NULL

  for (i in seq_len(n)) {
    x <- suppressWarnings(as.numeric(data[[vars[i]]]))
    if (!usar_pesos) {
      x_ok <- x[!is.na(x) & is.finite(x)]
      n_valid[i] <- length(x_ok)
      if (length(x_ok) >= 1L) score_mean[i] <- mean(x_ok)
      if (length(x_ok) >= 2L) score_sd[i]   <- stats::sd(x_ok)
      next
    }

    w <- suppressWarnings(as.numeric(w_all))
    ok <- !is.na(x) & is.finite(x) & !is.na(w) & is.finite(w) & w > 0
    n_valid[i] <- sum(ok)
    if (!any(ok)) next

    x_ok <- x[ok]
    w_ok <- w[ok]
    sw <- sum(w_ok, na.rm = TRUE)
    if (!is.finite(sw) || sw <= 0) next

    mu <- sum(x_ok * w_ok, na.rm = TRUE) / sw
    score_mean[i] <- mu
    if (length(x_ok) >= 2L) {
      # SD ponderada poblacional para comparar dispersión entre variables.
      var_w <- sum(w_ok * (x_ok - mu)^2, na.rm = TRUE) / sw
      score_sd[i] <- sqrt(max(0, var_w))
    }
  }

  data.frame(
    var        = vars,
    label      = labels,
    score_mean = score_mean,
    score_sd   = score_sd,
    n_valid    = n_valid,
    stringsAsFactors = FALSE
  )
}

#' @keywords internal
.foda_classify <- function(stats_df, corte_score, corte_sd) {
  cuadrante <- rep(NA_character_, nrow(stats_df))
  s   <- stats_df$score_mean
  sd_ <- stats_df$score_sd
  sd_[is.na(sd_)] <- 0

  cuadrante[s >= corte_score & sd_ <  corte_sd] <- "fortaleza"
  cuadrante[s >= corte_score & sd_ >= corte_sd] <- "oportunidad"
  cuadrante[s <  corte_score & sd_ <  corte_sd] <- "debilidad"
  cuadrante[s <  corte_score & sd_ >= corte_sd] <- "amenaza"

  stats_df$cuadrante <- cuadrante
  stats_df
}

#' @keywords internal
.dim_empty_payload <- function(ctx, mode = NA_character_, objective = NA_character_) {
  list(
    score_plot = data.frame(),
    score_heat = data.frame(),
    base_universe = NA_real_,
    axis_order_plot = character(0),
    axis_order_heat = character(0),
    mode = as.character(mode %||% ""),
    objective = as.character(objective %||% ""),
    principal_label = "",
    principal_var = "",
    principal_hidden = 0L,
    iter_active = FALSE,
    iter_var_label = "",
    iter_level_label = "",
    iter_hidden_levels = 0L,
    visual_mode = "barras",
    group_order = character(0),
    group_order_natural = character(0),
    group_colors = stats::setNames(character(0), character(0)),
    semaforo = ctx$semaforo,
    radar_min_ejes = ctx$radar_min_ejes
  )
}

#' @keywords internal
.dim_build_payload <- function(
    ctx,
    modo = c("general", "indicadores"),
    objetivo,
    cruce = NULL,
    incluir_total = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL
) {
  if (!inherits(ctx, "prosecnur_dim_context")) {
    stop("`.dim_build_payload()`: `ctx` debe venir de `.dim_build_context()`.", call. = FALSE)
  }

  modo <- match.arg(modo)
  objetivo <- as.character(objetivo %||% "")[1]
  if (!nzchar(objetivo)) stop("`objetivo` debe ser character(1) no vacío.", call. = FALSE)

  obj_map <- if (identical(modo, "indicadores")) ctx$catalog_indicadores else ctx$catalog_general
  if (!(objetivo %in% names(obj_map))) {
    .norm <- function(x) tolower(trimws(as.character(x %||% "")))
    keys <- names(obj_map)
    labs <- vapply(obj_map, function(z) as.character(z$label %||% ""), character(1))
    target <- .norm(objetivo)

    hit_key <- keys[.norm(keys) == target]
    hit_lab <- keys[.norm(labs) == target]
    hits <- unique(c(hit_key, hit_lab))

    if (length(hits) == 1L) {
      objetivo <- hits[1]
    } else {
      other_mode <- if (identical(modo, "general")) "indicadores" else "general"
      other_map <- if (identical(modo, "general")) ctx$catalog_indicadores else ctx$catalog_general
      exists_in_other <- objetivo %in% names(other_map)

      avail <- if (length(keys)) paste(utils::head(keys, 12), collapse = ", ") else "<vacío>"
      if (length(keys) > 12) avail <- paste0(avail, ", ...")

      hint_other <- if (isTRUE(exists_in_other)) {
        paste0(" El objetivo sí existe en `modo='", other_mode, "'.")
      } else {
        ""
      }
      hint_amb <- if (length(hits) > 1L) {
        paste0(" Coincidencias ambiguas por etiqueta/id: ", paste(hits, collapse = ", "), ".")
      } else {
        ""
      }

      stop(
        "`objetivo` no existe en el catálogo de dimensiones para `modo='", modo, "'. ",
        "Objetivos disponibles: ", avail, ".",
        hint_other, hint_amb,
        call. = FALSE
      )
    }
  }
  obj <- obj_map[[objetivo]]

  cruce <- as.character(cruce %||% "")[1]
  if (nzchar(cruce) && !(cruce %in% names(ctx$data))) {
    stop("`cruce` no existe en `data`.", call. = FALSE)
  }

  iter_var <- as.character(iter_var %||% "")[1]
  if (nzchar(iter_var) && !(iter_var %in% names(ctx$data))) {
    stop("`iter_var` no existe en `data`.", call. = FALSE)
  }
  if (nzchar(iter_var) && nzchar(cruce) && identical(iter_var, cruce)) {
    stop("`iter_var` no puede ser igual a `cruce`.", call. = FALSE)
  }

  df <- .dim_apply_filters(ctx$data, filters = filtros)
  if (!nrow(df)) return(.dim_empty_payload(ctx, mode = modo, objective = obj$label %||% objetivo))

  iter_pick <- NULL
  if (nzchar(iter_var)) {
    w_iter <- .dim_safe_weights(df, ctx$weight_col)
    cats_iter <- .dim_categorias_var(
      df,
      iter_var,
      w = w_iter,
      data_ref = ctx$data,
      instrumento = ctx$instrumento,
      max_levels = ctx$max_niveles_iteracion
    )
    if (nrow(cats_iter$rows)) {
      iter_level <- as.character(iter_level %||% "")[1]
      if (!nzchar(iter_level) || !(iter_level %in% as.character(cats_iter$rows$value))) {
        iter_level <- as.character(cats_iter$rows$value[1])
      }

      row_iter <- cats_iter$rows[match(iter_level, as.character(cats_iter$rows$value)), , drop = FALSE]
      if (nrow(row_iter)) {
        iter_pick <- list(
          key = as.character(row_iter$value[1]),
          label = as.character(row_iter$label[1]),
          base = as.numeric(row_iter$base[1]),
          var = iter_var,
          var_label = ctx$label_var(iter_var),
          hidden_levels = as.integer(cats_iter$hidden_levels)
        )

        x_iter <- trimws(as.character(df[[iter_var]]))
        keep_iter <- !is.na(x_iter) & x_iter == as.character(iter_pick$key)
        df <- df[keep_iter, , drop = FALSE]
      }
    }
  }

  if (!nrow(df)) {
    out <- .dim_empty_payload(ctx, mode = modo, objective = obj$label %||% objetivo)
    out$iter_active <- !is.null(iter_pick)
    out$iter_var_label <- as.character(iter_pick$var_label %||% "")
    out$iter_level_label <- as.character(iter_pick$label %||% "")
    out$iter_hidden_levels <- as.integer(iter_pick$hidden_levels %||% 0L)
    return(out)
  }

  axis_vars <- as.character(obj$axis_vars %||% character(0))
  axis_vars <- axis_vars[axis_vars %in% names(df)]
  if (!length(axis_vars)) {
    out <- .dim_empty_payload(ctx, mode = modo, objective = obj$label %||% objetivo)
    out$iter_active <- !is.null(iter_pick)
    out$iter_var_label <- as.character(iter_pick$var_label %||% "")
    out$iter_level_label <- as.character(iter_pick$label %||% "")
    out$iter_hidden_levels <- as.integer(iter_pick$hidden_levels %||% 0L)
    return(out)
  }

  axis_labels <- as.character(obj$axis_labels %||% axis_vars)
  axis_labels <- axis_labels[match(axis_vars, as.character(obj$axis_vars))]

  axis_iconos_raw <- obj$axis_iconos %||% vector("list", length(obj$axis_vars %||% character(0)))
  axis_iconos <- axis_iconos_raw[match(axis_vars, as.character(obj$axis_vars %||% axis_vars))]
  if (length(axis_iconos) != length(axis_vars)) axis_iconos <- vector("list", length(axis_vars))
  names(axis_iconos) <- axis_labels

  include_total <- if (is.null(incluir_total)) {
    isTRUE(ctx$incluir_total_default)
  } else {
    isTRUE(incluir_total)
  }

  w <- .dim_safe_weights(df, ctx$weight_col)
  base_universe <- suppressWarnings(sum(w, na.rm = TRUE))
  groups <- list()
  hidden_main <- 0L

  if (include_total) {
    groups[[length(groups) + 1L]] <- list(
      key = "__total__",
      label = "Total",
      mask = rep(TRUE, nrow(df)),
      base = sum(w, na.rm = TRUE)
    )
  }

  if (nzchar(cruce)) {
    cats_main <- .dim_categorias_var(
      df,
      cruce,
      w = w,
      data_ref = ctx$data,
      instrumento = ctx$instrumento,
      max_levels = ctx$max_categorias_principal
    )
    hidden_main <- as.integer(cats_main$hidden_levels)
    xv <- trimws(as.character(df[[cruce]]))

    for (i in seq_len(nrow(cats_main$rows))) {
      val <- as.character(cats_main$rows$value[i])
      groups[[length(groups) + 1L]] <- list(
        key = val,
        label = as.character(cats_main$rows$label[i]),
        mask = !is.na(xv) & xv == val,
        base = as.numeric(cats_main$rows$base[i])
      )
    }
  }

  if (!length(groups)) {
    groups[[1]] <- list(
      key = "__total__",
      label = "Total",
      mask = rep(TRUE, nrow(df)),
      base = sum(w, na.rm = TRUE)
    )
  }

  obj_mode <- as.character(obj$mode %||% "")
  obj_summary_var <- if (identical(obj_mode, "general")) {
    as.character(obj$id %||% "")
  } else {
    as.character(obj$block_var %||% "")
  }
  if (!nzchar(obj_summary_var) || !(obj_summary_var %in% names(df))) {
    obj_summary_var <- ""
  }

  out_axis <- list()
  out_total <- list()

  for (g in groups) {
    gw <- w * as.numeric(g$mask)

    for (j in seq_along(axis_vars)) {
      v <- axis_vars[j]
      mu <- .dim_weighted_mean(df[[v]], gw)
      out_axis[[length(out_axis) + 1L]] <- data.frame(
        axis_var = v,
        axis_label = as.character(axis_labels[j]),
        grupo = as.character(g$label),
        tipo = "apertura",
        score_raw = as.numeric(mu),
        base = as.numeric(g$base),
        stringsAsFactors = FALSE
      )
    }

    mu_total <- if (nzchar(obj_summary_var)) {
      .dim_weighted_mean(df[[obj_summary_var]], gw)
    } else {
      X <- as.data.frame(df[, axis_vars, drop = FALSE])
      X[] <- lapply(X, function(z) suppressWarnings(as.numeric(z)))
      row_mu <- rowMeans(X, na.rm = TRUE)
      row_mu[!is.finite(row_mu)] <- NA_real_
      .dim_weighted_mean(row_mu, gw)
    }

    out_total[[length(out_total) + 1L]] <- data.frame(
      axis_var = "__total_cruce__",
      axis_label = "Total cruce",
      grupo = as.character(g$label),
      tipo = "total_cruce",
      score_raw = as.numeric(mu_total),
      base = as.numeric(g$base),
      stringsAsFactors = FALSE
    )
  }

  sc_plot <- dplyr::bind_rows(out_axis)
  sc_total <- dplyr::bind_rows(out_total)
  sc_plot$score_round <- .dim_round_half_up(sc_plot$score_raw, 0)
  sc_total$score_round <- .dim_round_half_up(sc_total$score_raw, 0)
  sc_heat <- dplyr::bind_rows(sc_total, sc_plot)

  group_order <- .dim_group_order(sc_plot)
  group_order_natural <- character(0)
  if (nzchar(cruce)) {
    natural_labels <- .dim_level_label_order(cruce, ctx$data, ctx$instrumento)
    observed_labels <- unique(as.character(vapply(groups, function(x) x$label %||% "", character(1))))
    observed_others <- setdiff(observed_labels, "Total")
    natural_others <- natural_labels[natural_labels %in% observed_others]
    natural_others <- c(natural_others, setdiff(observed_others, natural_others))
    if ("Total" %in% observed_labels) {
      group_order_natural <- c("Total", natural_others)
    } else {
      group_order_natural <- natural_others
    }
    group_order_natural <- unique(group_order_natural)
  }
  if (!length(group_order_natural)) group_order_natural <- group_order
  group_labels_all <- vapply(groups, function(x) as.character(x$label %||% ""), character(1))
  group_keys_all <- vapply(groups, function(x) as.character(x$key %||% x$label %||% ""), character(1))
  group_keys_order <- group_keys_all[match(group_order, group_labels_all)]
  palette_override <- if (nzchar(cruce)) ctx$paletas_cruce[[cruce]] %||% NULL else NULL
  group_colors <- .dim_group_colors(
    group_order,
    paleta_radar = ctx$paleta_radar,
    total_color = ctx$theme_color,
    palette_override = palette_override,
    group_keys = group_keys_order
  )

  n_ejes <- length(unique(as.character(axis_labels)))
  visual_mode <- if (n_ejes >= ctx$radar_min_ejes) "radar" else "barras"

  list(
    score_plot = sc_plot,
    score_heat = sc_heat,
    base_universe = as.numeric(base_universe),
    axis_order_plot = as.character(axis_labels),
    axis_order_heat = c("Total cruce", as.character(axis_labels)),
    mode = as.character(obj$mode %||% modo),
    objective = as.character(obj$label %||% objetivo),
    objective_id = as.character(obj$id %||% objetivo),
    principal_label = if (nzchar(cruce)) ctx$label_var(cruce) else "",
    principal_var = cruce,
    principal_hidden = hidden_main,
    iter_active = !is.null(iter_pick),
    iter_var_label = as.character(iter_pick$var_label %||% ""),
    iter_level_label = as.character(iter_pick$label %||% ""),
    iter_hidden_levels = as.integer(iter_pick$hidden_levels %||% 0L),
    visual_mode = visual_mode,
    group_order = group_order,
    group_order_natural = group_order_natural,
    group_colors = group_colors,
    semaforo = ctx$semaforo,
    radar_min_ejes = ctx$radar_min_ejes,
    axis_iconos = axis_iconos,
    objective_icono = obj$icono %||% NULL
  )
}
