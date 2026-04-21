# =============================================================================
# Graficadores de Dimensiones
# - Heatmap semaforico en canvas
# - Wrapper radar/barras con payloads de dimensiones
# - Wrapper radar+tabla, sin tablas nativas de PowerPoint
# =============================================================================

#' @keywords internal
.dim_wrap_debug_canvas <- function(g, debug_ph_bordes = FALSE, debug_ph_col = "#FF00FF", debug_ph_lwd = 0.6) {
  if (!isTRUE(debug_ph_bordes)) return(g)
  cowplot::ggdraw(g) +
    cowplot::draw_grob(
      grid::rectGrob(
        gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
      ),
      x = 0, y = 0, width = 1, height = 1
    )
}

#' @keywords internal
.dim_export_canvas <- function(
    canvas,
    exportar = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho = 8.5,
    alto = 6.0,
    dpi = 300,
    ppt_append = TRUE,
    ppt_layout = "Blank",
    ppt_master = "Office Theme"
) {
  exportar <- match.arg(exportar)

  if (exportar == "rplot") return(canvas)

  if (is.null(path_salida) || !nzchar(path_salida)) {
    stop("`path_salida` es requerido para exportar.", call. = FALSE)
  }

  if (exportar == "png") {
    ggplot2::ggsave(
      filename = path_salida,
      plot = canvas,
      width = ancho,
      height = alto,
      units = "in",
      dpi = dpi,
      bg = "transparent"
    )
    return(invisible(canvas))
  }

  if (exportar %in% c("ppt", "word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

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

    doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
    doc <- officer::body_add_par(doc, value = "", style = "Normal")
    doc <- officer::body_add_dml(
      doc,
      value = rvg::dml(ggobj = canvas),
      width = ancho,
      height = alto
    )
    print(doc, target = path_salida)
    return(invisible(canvas))
  }

  stop("Tipo de exportacion no soportado.", call. = FALSE)
}

#' @keywords internal
.dim_blank_canvas <- function(
    mensaje = "Sin datos para mostrar",
    debug_ph_bordes = FALSE,
    debug_ph_col = "#FF00FF",
    debug_ph_lwd = 0.6
) {
  .dim_wrap_debug_canvas(
    cowplot::ggdraw() +
      cowplot::draw_label(
        label = mensaje,
        x = 0.5, y = 0.5,
        hjust = 0.5, vjust = 0.5,
        size = 12,
        colour = "#20324d"
      ),
    debug_ph_bordes = debug_ph_bordes,
    debug_ph_col = debug_ph_col,
    debug_ph_lwd = debug_ph_lwd
  )
}

#' @keywords internal
.dim_heat_legend_block <- function(labels, colors, size = 11, colour = "#004B8D") {
  labels <- as.character(labels)
  colors <- as.character(colors)
  n <- min(length(labels), length(colors))
  if (!n) return(cowplot::ggdraw() + cowplot::theme_nothing())

  labels <- labels[seq_len(n)]
  colors <- colors[seq_len(n)]
  width_guess <- pmax(nchar(labels, type = "width"), 8)
  item_units <- 0.045 + (width_guess * 0.012) + 0.04
  total_units <- sum(item_units)
  usable_width <- min(0.92, total_units)
  scale <- if (total_units > 0) usable_width / total_units else 1
  item_widths <- item_units * scale
  start_x <- max(0.03, (1 - sum(item_widths)) / 2)
  x_box <- numeric(n)
  x_text <- numeric(n)
  cur_x <- start_x

  g <- cowplot::ggdraw()
  for (i in seq_len(n)) {
    x_box[i] <- cur_x
    x_text[i] <- min(cur_x + 0.04, 0.96)
    g <- g +
      cowplot::draw_grob(
        grid::rectGrob(gp = grid::gpar(fill = colors[i], col = NA)),
        x = x_box[i], y = 0.5,
        width = 0.028, height = 0.22,
        hjust = 0, vjust = 0.5
      ) +
      cowplot::draw_label(
        label = labels[i],
        x = x_text[i], y = 0.5,
        hjust = 0, vjust = 0.5,
        size = size,
        colour = colour
      )
    cur_x <- cur_x + item_widths[i]
  }
  g
}

# ---------------------------------------------------------------------------
# Helpers de iconos PNG
# ---------------------------------------------------------------------------

#' @keywords internal
.dim_normalize_optional_color <- function(color, arg_name = "color") {
  if (is.null(color)) return(NULL)
  color <- as.character(color)[1]
  if (is.na(color) || !nzchar(trimws(color))) {
    stop("`", arg_name, "` debe ser NULL o un color valido.", call. = FALSE)
  }
  ok <- !inherits(try(grDevices::col2rgb(color), silent = TRUE), "try-error")
  if (!ok) stop("`", arg_name, "` debe ser NULL o un color valido.", call. = FALSE)
  color
}

#' @keywords internal
.dim_tint_icon <- function(img, tint_color = NULL) {
  tint_color <- .dim_normalize_optional_color(tint_color, arg_name = "tint_color")
  if (is.null(tint_color) || is.null(img)) return(img)
  d <- dim(img)
  if (is.null(d)) return(img)

  # Normaliza a RGBA para soportar PNG en gris / gris+alpha / RGB / RGBA.
  as_rgba <- function(x) {
    dx <- dim(x)
    if (length(dx) == 2L) {
      arr <- array(0, dim = c(dx[1], dx[2], 4L))
      arr[, , 1] <- x
      arr[, , 2] <- x
      arr[, , 3] <- x
      arr[, , 4] <- 1
      return(arr)
    }
    if (length(dx) != 3L) return(NULL)
    ch <- dx[3]
    arr <- array(0, dim = c(dx[1], dx[2], 4L))
    if (ch >= 4L) {
      arr <- x[, , 1:4, drop = FALSE]
    } else if (ch == 3L) {
      arr[, , 1:3] <- x[, , 1:3, drop = FALSE]
      arr[, , 4] <- 1
    } else if (ch == 2L) {
      arr[, , 1] <- x[, , 1]
      arr[, , 2] <- x[, , 1]
      arr[, , 3] <- x[, , 1]
      arr[, , 4] <- x[, , 2]
    } else if (ch == 1L) {
      arr[, , 1] <- x[, , 1]
      arr[, , 2] <- x[, , 1]
      arr[, , 3] <- x[, , 1]
      arr[, , 4] <- 1
    } else {
      return(NULL)
    }
    arr
  }

  rgba <- as_rgba(img)
  if (is.null(rgba)) return(img)
  rgba <- array(
    pmax(0, pmin(1, as.numeric(rgba))),
    dim = dim(rgba)
  )

  # Tinte plano preservando alpha (comportamiento esperado para blanco/brand color).
  tint <- as.numeric(grDevices::col2rgb(tint_color)) / 255
  rgba[, , 1] <- tint[1]
  rgba[, , 2] <- tint[2]
  rgba[, , 3] <- tint[3]
  rgba
}

#' @keywords internal
.dim_outline_icon <- function(
    img,
    outline_color = "#000000",
    outline_alpha = 0.22,
    alpha_threshold = 1e-4
) {
  if (is.null(img)) return(img)
  d <- dim(img)
  if (is.null(d) || length(d) != 3L || d[3] < 4L) return(img)

  outline_color <- .dim_normalize_optional_color(outline_color, arg_name = "outline_color")
  if (is.null(outline_color)) return(img)
  outline_alpha <- suppressWarnings(as.numeric(outline_alpha)[1])
  if (!is.finite(outline_alpha) || is.na(outline_alpha) || outline_alpha <= 0) return(img)
  outline_alpha <- max(0, min(1, outline_alpha))

  a <- img[, , 4]
  solid <- a > alpha_threshold
  if (!any(solid)) return(img)

  # Borde interno: pixeles solidos que tocan el fondo transparente.
  edge <- solid
  nr <- nrow(solid)
  nc <- ncol(solid)
  if (nr >= 3 && nc >= 3) {
    edge <- matrix(FALSE, nrow = nr, ncol = nc)
    edge[2:(nr - 1), 2:(nc - 1)] <- solid[2:(nr - 1), 2:(nc - 1)] & (
      !solid[1:(nr - 2), 2:(nc - 1)] |
      !solid[3:nr, 2:(nc - 1)] |
      !solid[2:(nr - 1), 1:(nc - 2)] |
      !solid[2:(nr - 1), 3:nc] |
      !solid[1:(nr - 2), 1:(nc - 2)] |
      !solid[1:(nr - 2), 3:nc] |
      !solid[3:nr, 1:(nc - 2)] |
      !solid[3:nr, 3:nc]
    )
    edge[1, ] <- solid[1, ]
    edge[nr, ] <- solid[nr, ]
    edge[, 1] <- solid[, 1]
    edge[, nc] <- solid[, nc]
  }
  if (!any(edge)) return(img)

  out <- img
  oc <- as.numeric(grDevices::col2rgb(outline_color)) / 255
  blend <- outline_alpha * (a * edge)
  out[, , 1] <- out[, , 1] * (1 - blend) + oc[1] * blend
  out[, , 2] <- out[, , 2] * (1 - blend) + oc[2] * blend
  out[, , 3] <- out[, , 3] * (1 - blend) + oc[3] * blend
  out
}

#' @keywords internal
.dim_trim_icon_alpha <- function(img, alpha_threshold = 1e-4, pad = 1L) {
  if (is.null(img)) return(img)
  d <- dim(img)
  if (is.null(d) || length(d) != 3L || d[3] < 4L) return(img)

  a <- img[, , 4]
  keep_rows <- which(rowSums(a > alpha_threshold, na.rm = TRUE) > 0)
  keep_cols <- which(colSums(a > alpha_threshold, na.rm = TRUE) > 0)
  if (!length(keep_rows) || !length(keep_cols)) return(img)

  pad <- max(0L, as.integer(pad)[1])
  r1 <- max(1L, min(keep_rows) - pad)
  r2 <- min(d[1], max(keep_rows) + pad)
  c1 <- max(1L, min(keep_cols) - pad)
  c2 <- min(d[2], max(keep_cols) + pad)
  img[r1:r2, c1:c2, , drop = FALSE]
}

#' @keywords internal
.dim_load_icon <- function(path, tint_color = NULL) {
  if (is.null(path) || !nzchar(as.character(path %||% ""))) return(NULL)
  path <- as.character(path)[1]
  if (!file.exists(path)) return(NULL)
  if (!requireNamespace("png", quietly = TRUE)) {
    warning(
      "Instala el paquete `png` para mostrar \u00edconos en los graficadores.",
      call. = FALSE
    )
    return(NULL)
  }
  img <- tryCatch(png::readPNG(path), error = function(e) NULL)
  img <- .dim_tint_icon(img, tint_color = tint_color)
  .dim_trim_icon_alpha(img, pad = 1L)
}

#' Genera un raster RGBA con texto renderizado, para usarlo como icono.
#' @keywords internal
.dim_text_to_icon <- function(
    label,
    colour = "#0E3B74",
    fontsize = 44,
    px_width = 420,
    px_height = 220,
    fontface = "bold",
    lineheight = 0.9
) {
  tmp <- tempfile(fileext = ".png")
  on.exit(unlink(tmp), add = TRUE)
  grDevices::png(
    tmp,
    width = px_width,
    height = px_height,
    bg = "transparent",
    type = "cairo"
  )
  grid::grid.newpage()
  grid::grid.text(
    label,
    x = 0.5,
    y = 0.5,
    gp = grid::gpar(
      fontsize = fontsize,
      col = colour,
      fontface = fontface,
      lineheight = lineheight
    )
  )
  grDevices::dev.off()
  if (!requireNamespace("png", quietly = TRUE)) return(NULL)
  img <- tryCatch(png::readPNG(tmp), error = function(e) NULL)
  .dim_trim_icon_alpha(img, pad = 3L)
}

#' @keywords internal
.dim_load_icon_contraste <- function(path, tint_color = NULL, aplicar_borde = FALSE) {
  img <- .dim_load_icon(path, tint_color = tint_color)
  if (isTRUE(aplicar_borde)) {
    img <- .dim_outline_icon(img, outline_color = "#000000", outline_alpha = 0.20)
  }
  img
}

# Devuelve TRUE si algun icono de la lista (names = etiquetas) es no-NULL
#' @keywords internal
.dim_has_iconos <- function(iconos) {
  is.list(iconos) && any(vapply(iconos, function(x) !is.null(x) && nzchar(x), logical(1)))
}

# Construye un bloque de leyenda con iconos pequenos + etiquetas (para heatmap/radar)
#' @keywords internal
.dim_icono_leyenda_block <- function(
    axis_iconos,
    icon_size = 0.035,
    gap_icon_text = 0.008,
    size_text = 9,
    colour_text = "#004B8D",
    icon_color = NULL,
    max_rows = 2L,
    row_gap = 0.30,
    compact = FALSE,
    icon_height_rel = NULL,
    item_padding = 0.025
) {
  labels <- names(axis_iconos)
  n <- length(labels)
  if (!n) return(cowplot::ggdraw() + cowplot::theme_nothing())

  max_rows <- max(1L, as.integer(max_rows)[1])
  row_gap <- pmax(0.08, suppressWarnings(as.numeric(row_gap)[1]))
  item_padding <- pmax(0.004, suppressWarnings(as.numeric(item_padding)[1]))
  compact <- isTRUE(compact)

  txt_w <- pmax(nchar(labels, type = "width"), if (compact) 3 else 4) *
    if (compact) 0.0088 else 0.011
  txt_w <- txt_w + if (compact) 0.016 else 0.03
  item_w <- icon_size + gap_icon_text + txt_w + item_padding
  avail_w <- 0.94

  row_id <- rep(1L, n)
  if (max_rows > 1L) {
    cur_row <- 1L
    cur_sum <- 0
    for (i in seq_len(n)) {
      next_sum <- cur_sum + item_w[i]
      if (cur_row < max_rows && cur_sum > 0 && next_sum > avail_w) {
        cur_row <- cur_row + 1L
        cur_sum <- 0
      }
      row_id[i] <- cur_row
      cur_sum <- cur_sum + item_w[i]
    }
  }

  n_rows <- max(row_id)
  y_rows <- if (n_rows <= 1L) {
    0.5
  } else {
    seq(0.5 + row_gap * (n_rows - 1L) / 2, 0.5 - row_gap * (n_rows - 1L) / 2, length.out = n_rows)
  }

  g <- cowplot::ggdraw()

  for (rr in seq_len(n_rows)) {
    idx_row <- which(row_id == rr)
    row_units <- item_w[idx_row]
    row_total <- sum(row_units)
    row_scale <- if (row_total > avail_w) avail_w / row_total else 1
    icon_w <- icon_size * row_scale
    icon_h <- icon_height_rel %||%
      if (compact) {
        min(0.34, max(0.18, icon_w / 0.035 * 0.18))
      } else {
        min(0.90, icon_w / 0.035 * 0.50)
      }
    cur_x <- max(0.02, (1 - sum(row_units * row_scale)) / 2)

    for (i in idx_row) {
      img <- .dim_load_icon(axis_iconos[[i]], tint_color = icon_color)
      if (!is.null(img)) {
        g <- g + cowplot::draw_image(
          img,
          x = cur_x, y = y_rows[rr],
          width = icon_w, height = icon_h,
          hjust = 0, vjust = 0.5,
          interpolate = TRUE
        )
      }
      g <- g + cowplot::draw_label(
        label = labels[i],
        x = cur_x + icon_w + gap_icon_text,
        y = y_rows[rr],
        hjust = 0, vjust = 0.5,
        size = size_text,
        colour = colour_text
      )
      cur_x <- cur_x + item_w[i] * row_scale
    }
  }
  g
}

#' @keywords internal
.dim_payload_to_plot_df <- function(payload) {
  payload$score_plot |>
    dplyr::transmute(
      eje = as.character(.data$axis_label),
      grupo = as.character(.data$grupo),
      valor = as.numeric(.data$score_round),
      base = as.numeric(.data$base)
    )
}

#' @keywords internal
.dim_alias_radar_extra_args <- function(extra_args) {
  if (is.null(extra_args) || !is.list(extra_args) || !length(extra_args)) return(extra_args)

  alias_if_missing <- function(dst, src) {
    if (!is.null(extra_args[[src]]) && is.null(extra_args[[dst]])) {
      extra_args[[dst]] <<- extra_args[[src]]
    }
    extra_args[[src]] <<- NULL
  }

  alias_if_missing("canvas_h_header_in", "canvas_h_title")
  alias_if_missing("canvas_h_header_in", "canvas_h_header")
  alias_if_missing("canvas_h_legend_in", "canvas_h_legend")
  alias_if_missing("canvas_h_caption_in", "canvas_h_caption")
  extra_args
}

#' @keywords internal
.dim_payload_to_numeric_wide <- function(payload) {
  df_plot <- .dim_payload_to_plot_df(payload)
  grupos <- payload$group_order %||% unique(as.character(df_plot$grupo))
  if (!length(grupos)) grupos <- unique(as.character(df_plot$grupo))

  safe_name <- function(x) {
    x <- gsub("[^A-Za-z0-9]+", "_", as.character(x))
    x <- gsub("^_+|_+$", "", x)
    x <- gsub("_+", "_", x)
    paste0("serie_", ifelse(nzchar(x), x, "x"))
  }

  series_cols <- safe_name(grupos)
  make_unique <- function(x) {
    if (!length(x)) return(x)
    out <- x
    dup <- duplicated(out)
    if (any(dup)) {
      idx <- ave(seq_along(out), out, FUN = seq_along)
      out[dup] <- paste0(out[dup], "_", idx[dup])
    }
    out
  }
  series_cols <- make_unique(series_cols)
  map_cols <- stats::setNames(series_cols, grupos)

  wide <- df_plot |>
    dplyr::mutate(.serie_col = map_cols[.data$grupo]) |>
    dplyr::select(.data$eje, .data$.serie_col, .data$valor) |>
    tidyr::pivot_wider(names_from = ".serie_col", values_from = "valor")

  wide$categoria <- factor(
    wide$eje,
    levels = rev(payload$axis_order_plot %||% unique(as.character(wide$eje)))
  )
  wide <- wide[, c("categoria", series_cols), drop = FALSE]

  list(
    data = wide,
    vars_valor = series_cols,
    etiquetas_series = stats::setNames(grupos, series_cols)
  )
}

#' @keywords internal
.dim_normalize_visual_mode <- function(modo, default = "auto") {
  out <- as.character(modo %||% default)[1]
  if (is.na(out) || !nzchar(trimws(out))) out <- default
  out <- tolower(trimws(out))
  if (out %in% c("chip", "barras_chip", "total_cruce_chip", "barras_total_chip")) {
    out <- "barras_chip_total"
  }
  if (out %in% c("chip_ejes", "barras_chip_ejes", "axis_chip", "barras_axis_chip")) {
    out <- "barras_chip_ejes"
  }
  if (!out %in% c("auto", "radar", "barras", "barras_chip_total", "barras_chip_ejes")) out <- default
  out
}

#' @keywords internal
.dim_primary_bar_color <- function(payload, fallback = "#1F5563") {
  fill_one <- as.character(fallback)[1]
  if (is.na(fill_one) || !nzchar(trimws(fill_one))) fill_one <- fallback
  fill_one
}

#' @keywords internal
.dim_payload_to_total_cruce_df <- function(payload) {
  df <- payload$score_heat |>
    dplyr::filter(.data$tipo == "total_cruce") |>
    dplyr::transmute(
      categoria = as.character(.data$grupo),
      valor_raw = as.numeric(.data$score_raw),
      valor_round = as.numeric(.data$score_round),
      base = as.numeric(.data$base)
    )

  if (!nrow(df)) return(df)

  ord <- payload$group_order_natural %||% payload$group_order %||% unique(as.character(df$categoria))
  ord <- ord[ord %in% unique(as.character(df$categoria))]
  if (!length(ord)) ord <- unique(as.character(df$categoria))

  df$categoria <- factor(df$categoria, levels = ord)
  fill_one <- .dim_primary_bar_color(payload, fallback = "#1F5563")
  df$fill_bar <- rep(fill_one, nrow(df))
  df
}

#' @keywords internal
.dim_payload_to_axis_total_df <- function(payload) {
  df <- payload$score_plot |>
    dplyr::transmute(
      categoria = as.character(.data$axis_label),
      grupo = as.character(.data$grupo),
      valor_raw = as.numeric(.data$score_raw),
      valor_round = as.numeric(.data$score_round),
      base = as.numeric(.data$base)
    )

  if (!nrow(df)) return(df)

  grupo_pref <- payload$group_order_natural %||% payload$group_order %||% character(0)
  grupo_ref <- if ("Total" %in% grupo_pref) "Total" else if (length(grupo_pref)) grupo_pref[1] else unique(df$grupo)[1]
  df <- df[df$grupo == grupo_ref, , drop = FALSE]
  if (!nrow(df)) return(df)

  ord <- payload$axis_order_plot %||% unique(as.character(df$categoria))
  ord <- ord[ord %in% unique(as.character(df$categoria))]
  if (!length(ord)) ord <- unique(as.character(df$categoria))

  df$categoria <- factor(df$categoria, levels = ord)
  fill_one <- .dim_primary_bar_color(payload, fallback = "#1F5563")
  df$fill_bar <- rep(fill_one, nrow(df))
  df
}

#' @keywords internal
.dim_plot_barras_chip_df <- function(
    df,
    payload,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    note_outside = FALSE,
    ...
) {
  if (!nrow(df)) return(.dim_blank_canvas("Sin datos para mostrar"))
  extra_args <- list(...)
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  .norm_text_face <- function(face, fallback = "plain") {
    face <- as.character(face %||% fallback)[1]
    face <- trimws(face)
    if (!nzchar(face)) face <- fallback
    face
  }

  .norm_text_color <- function(color, fallback = "#000000") {
    color <- as.character(color %||% fallback)[1]
    color <- trimws(color)
    if (!nzchar(color)) fallback else color
  }

  color_barra_unica <- as.character(extra_args$color_barra_unica %||% .dim_primary_bar_color(payload, fallback = "#1F5563"))[1]
  if (!is.na(color_barra_unica) && nzchar(trimws(color_barra_unica))) {
    df$fill_bar <- rep(color_barra_unica, nrow(df))
  }

  df$categoria <- factor(as.character(df$categoria), levels = levels(df$categoria) %||% unique(as.character(df$categoria)))

  sem <- payload$semaforo %||% list()
  cortes_chip <- suppressWarnings(as.numeric(extra_args$cortes_chip %||% sem$cortes %||% c(60, 80)))
  cortes_chip <- cortes_chip[is.finite(cortes_chip) & !is.na(cortes_chip)]
  if (length(cortes_chip) < 2L) cortes_chip <- c(60, 80)
  cortes_chip <- sort(unique(cortes_chip))[1:2]
  if (length(cortes_chip) < 2L || cortes_chip[1] >= cortes_chip[2]) cortes_chip <- c(60, 80)

  chip_colores <- extra_args$chip_colores %||% sem$colores %||% list(
    rojo = "#D84B55",
    ambar = "#E0B44C",
    verde = "#3A9A5B"
  )
  semaforo_anclas_degradado <- extra_args$semaforo_anclas_degradado %||% sem$anclas_degradado %||% NULL
  semaforo_gradiente_colores <- extra_args$semaforo_gradiente_colores %||% sem$gradiente_colores %||% NULL
  semaforo_gradiente_valores <- extra_args$semaforo_gradiente_valores %||% sem$gradiente_valores %||% NULL
  semaforo_gradiente_limites <- extra_args$semaforo_gradiente_limites %||% sem$gradiente_limites %||% NULL
  semaforo_gradiente_segmentos <- extra_args$semaforo_gradiente_segmentos %||% sem$gradiente_segmentos %||% 20L
  modo_semaforo <- .dim_normalize_semaforo_modo(extra_args$modo_semaforo %||% sem$modo %||% "grupos")
  chip_decimales <- suppressWarnings(as.integer(extra_args$chip_decimales %||% extra_args$decimales %||% 0L)[1])
  if (!is.finite(chip_decimales) || is.na(chip_decimales) || chip_decimales < 0L) chip_decimales <- 0L

  df$chip_fill <- .dim_semaforo_color(
    x = df$valor_raw,
    cortes = cortes_chip,
    colores = chip_colores,
    digits = chip_decimales,
    modo = modo_semaforo,
    anclas_degradado = semaforo_anclas_degradado,
    gradiente_colores = semaforo_gradiente_colores,
    gradiente_valores = semaforo_gradiente_valores,
    gradiente_limites = semaforo_gradiente_limites,
    gradiente_segmentos = semaforo_gradiente_segmentos
  )
  df$chip_label <- ifelse(
    is.na(df$valor_raw),
    "",
    format(.dim_round_half_up(df$valor_raw, chip_decimales), nsmall = chip_decimales, trim = TRUE)
  )

  size_titulo <- suppressWarnings(as.numeric(extra_args$size_titulo %||% 10.5)[1])
  if (!is.finite(size_titulo) || is.na(size_titulo) || size_titulo <= 0) size_titulo <- 10.5
  size_subtitulo <- suppressWarnings(as.numeric(extra_args$size_subtitulo %||% 8.6)[1])
  if (!is.finite(size_subtitulo) || is.na(size_subtitulo) || size_subtitulo <= 0) size_subtitulo <- 8.6
  size_ejes <- suppressWarnings(as.numeric(extra_args$size_ejes %||% 8.8)[1])
  if (!is.finite(size_ejes) || is.na(size_ejes) || size_ejes <= 0) size_ejes <- 8.8
  size_chip <- suppressWarnings(as.numeric(extra_args$size_texto_chip %||% 3.2)[1])
  if (!is.finite(size_chip) || is.na(size_chip) || size_chip <= 0) size_chip <- 3.2
  padding_chip <- suppressWarnings(as.numeric(extra_args$padding_texto_chip %||% 0.20)[1])
  if (!is.finite(padding_chip) || is.na(padding_chip) || padding_chip < 0) padding_chip <- 0.20
  chip_texto_color <- .norm_text_color(extra_args$chip_texto_color, fallback = "#000000")
  color_ejes_base <- .norm_text_color(extra_args$color_ejes, fallback = "#000000")
  color_ejes_x <- .norm_text_color(extra_args$color_ejes_x, fallback = color_ejes_base)
  color_ejes_y <- .norm_text_color(extra_args$color_ejes_y, fallback = color_ejes_base)
  color_titulo <- .norm_text_color(extra_args$color_titulo, fallback = "#000000")
  color_subtitulo <- .norm_text_color(extra_args$color_subtitulo, fallback = "#000000")
  color_nota_pie <- .norm_text_color(extra_args$color_nota_pie, fallback = "#000000")
  font_family <- trimws(as.character(extra_args$font_family %||% "Arial")[1])
  if (!nzchar(font_family)) font_family <- "Arial"
  textos_negrita <- extra_args$textos_negrita %||% character(0)
  fontface_ejes_x <- .norm_text_face(
    extra_args$fontface_ejes_x,
    fallback = if ("eje_x" %in% textos_negrita) "bold" else "plain"
  )
  fontface_ejes_y <- .norm_text_face(
    extra_args$fontface_ejes_y,
    fallback = if ("eje_y" %in% textos_negrita) "bold" else "plain"
  )
  fontface_titulo <- .norm_text_face(
    extra_args$fontface_titulo,
    fallback = if ("titulo" %in% textos_negrita) "bold" else "bold"
  )
  fontface_subtitulo <- .norm_text_face(
    extra_args$fontface_subtitulo,
    fallback = if ("subtitulo" %in% textos_negrita) "bold" else "plain"
  )
  fontface_nota_pie <- .norm_text_face(
    extra_args$fontface_nota_pie,
    fallback = if ("nota_pie" %in% textos_negrita) "bold" else "plain"
  )
  ancho_barras <- suppressWarnings(as.numeric(extra_args$ancho_barras %||% 0.62)[1])
  if (!is.finite(ancho_barras) || is.na(ancho_barras) || ancho_barras <= 0) ancho_barras <- 0.62
  wrap_width <- suppressWarnings(as.integer(extra_args$ancho_max_eje_cat %||% 14L)[1])
  if (!is.finite(wrap_width) || is.na(wrap_width) || wrap_width < 8L) wrap_width <- 14L

  max_val <- max(df$valor_raw, na.rm = TRUE)
  if (!is.finite(max_val) || is.na(max_val)) max_val <- 100

  limites_y <- suppressWarnings(as.numeric(extra_args$limites_y %||% c(55, 100)))
  limites_y <- limites_y[is.finite(limites_y) & !is.na(limites_y)]
  if (length(limites_y) >= 2L) {
    y_min <- min(limites_y[1:2], na.rm = TRUE)
    y_max <- max(limites_y[1:2], na.rm = TRUE)
  } else {
    y_min <- max(0, min(cortes_chip, na.rm = TRUE) - 5)
    y_max <- 100
  }
  if (!is.finite(y_min) || is.na(y_min) || y_min < 0) y_min <- 0
  if (!is.finite(y_max) || is.na(y_max)) y_max <- 100
  y_max <- max(y_max, max_val * 1.06, max(cortes_chip, na.rm = TRUE) * 1.03)
  if (y_max <= y_min) y_max <- y_min + 10

  y_breaks <- suppressWarnings(as.numeric(extra_args$cortes_y %||% seq(60, 100, by = 10)))
  y_breaks <- y_breaks[is.finite(y_breaks) & !is.na(y_breaks)]
  if (!length(y_breaks)) {
    y_breaks <- pretty(c(y_min, y_max), n = 5)
  }
  y_breaks <- sort(unique(c(y_breaks, cortes_chip)))
  y_breaks <- y_breaks[y_breaks >= y_min & y_breaks <= y_max]
  label_offset <- max(2, (y_max - y_min) * 0.06)
  df$valor_plot <- pmax(0, df$valor_raw - y_min)
  df$y_chip <- pmin(y_max - label_offset * 0.25, df$valor_raw + label_offset)
  df$y_chip_plot <- pmax(0, df$y_chip - y_min)
  cortes_plot <- pmax(0, cortes_chip - y_min)
  y_breaks_plot <- pmax(0, y_breaks - y_min)

  label_fun <- function(x) {
    if (!requireNamespace("stringr", quietly = TRUE)) return(x)
    stringr::str_wrap(x, width = wrap_width)
  }

  label_y_fun <- function(x) {
    out <- x + y_min
    out <- .dim_round_half_up(out, 0)
    format(out, trim = TRUE, scientific = FALSE)
  }

  p <- ggplot2::ggplot(
    df,
    ggplot2::aes(x = .data$categoria, y = .data$valor_plot, fill = .data$categoria)
  ) +
    ggplot2::geom_hline(
      data = data.frame(yint = cortes_plot),
      ggplot2::aes(yintercept = .data$yint),
      inherit.aes = FALSE,
      colour = "#D6DEE8",
      linewidth = 0.45,
      linetype = "22"
    ) +
    ggplot2::geom_col(width = ancho_barras, show.legend = FALSE) +
    ggplot2::geom_label(
      data = df,
      ggplot2::aes(x = .data$categoria, y = .data$y_chip_plot, label = .data$chip_label),
      inherit.aes = FALSE,
      fill = df$chip_fill,
      colour = chip_texto_color,
      label.size = 0,
      label.padding = grid::unit(padding_chip, "lines"),
      size = size_chip,
      family = font_family,
      fontface = "bold",
      show.legend = FALSE
    ) +
    ggplot2::scale_fill_manual(values = stats::setNames(df$fill_bar, as.character(df$categoria))) +
    ggplot2::scale_x_discrete(labels = label_fun) +
    ggplot2::scale_y_continuous(
      breaks = y_breaks_plot,
      labels = label_y_fun,
      expand = ggplot2::expansion(mult = c(0, 0.03))
    ) +
    ggplot2::labs(
      title = titulo %||% NULL,
      subtitle = subtitulo %||% NULL,
      caption = if (isTRUE(note_outside)) NULL else nota_pie %||% NULL
    ) +
    ggplot2::theme_minimal(base_size = 9, base_family = font_family) +
    ggplot2::theme(
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_line(colour = "#E4EAF1", linewidth = 0.35),
      axis.title.x = ggplot2::element_blank(),
      axis.title.y = ggplot2::element_blank(),
      axis.text.x = ggplot2::element_text(
        colour = color_ejes_x,
        size = size_ejes,
        face = fontface_ejes_x,
        hjust = 0.5,
        vjust = 1,
        margin = ggplot2::margin(t = 8)
      ),
      axis.text.y = ggplot2::element_text(
        colour = color_ejes_y,
        size = size_ejes,
        face = fontface_ejes_y
      ),
      plot.title = ggplot2::element_text(
        colour = color_titulo,
        size = size_titulo,
        face = fontface_titulo,
        hjust = 0.5,
        margin = ggplot2::margin(b = 3)
      ),
      plot.subtitle = ggplot2::element_text(
        colour = color_subtitulo,
        size = size_subtitulo,
        face = fontface_subtitulo,
        hjust = 0.5,
        margin = ggplot2::margin(b = 5)
      ),
      plot.caption = ggplot2::element_text(
        colour = color_nota_pie,
        size = 7.8,
        face = fontface_nota_pie,
        hjust = 1
      ),
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      legend.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      plot.margin = ggplot2::margin(8, 10, 14, 10)
    ) +
    ggplot2::coord_cartesian(ylim = c(0, y_max - y_min), clip = "off")

  alto_word_sugerido <- suppressWarnings(as.numeric(extra_args$alto_word_sugerido %||% 2.8)[1])
  if (!is.finite(alto_word_sugerido) || is.na(alto_word_sugerido) || alto_word_sugerido <= 0) {
    alto_word_sugerido <- 2.8
  }
  attr(p, "alto_word_sugerido") <- alto_word_sugerido
  ancho_word_sugerido <- suppressWarnings(as.numeric(extra_args$ancho_word_sugerido %||% 5.8)[1])
  if (is.finite(ancho_word_sugerido) && !is.na(ancho_word_sugerido) && ancho_word_sugerido > 0) {
    attr(p, "ancho_word_sugerido") <- ancho_word_sugerido
  }
  if (isTRUE(note_outside) && !is.null(nota_pie) && nzchar(trimws(as.character(nota_pie)[1]))) {
    attr(p, "note_outside") <- trimws(as.character(nota_pie)[1])
  }
  p
}

#' @keywords internal
.dim_plot_total_cruce_barras_chip <- function(
    payload,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    note_outside = FALSE,
    ...
) {
  df <- .dim_payload_to_total_cruce_df(payload)
  .dim_plot_barras_chip_df(
    df = df,
    payload = payload,
    titulo = titulo,
    subtitulo = subtitulo,
    nota_pie = nota_pie,
    note_outside = note_outside,
    ...
  )
}

#' @keywords internal
.dim_plot_axis_total_barras_chip <- function(
    payload,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    note_outside = FALSE,
    ...
) {
  df <- .dim_payload_to_axis_total_df(payload)
  .dim_plot_barras_chip_df(
    df = df,
    payload = payload,
    titulo = titulo,
    subtitulo = subtitulo,
    nota_pie = nota_pie,
    note_outside = note_outside,
    ...
  )
}

#' @keywords internal
.dim_make_table_df <- function(payload, titulo_left = "TOP TWO BOX", digits = 0L) {
  digits <- suppressWarnings(as.integer(digits))
  if (!is.finite(digits) || digits < 0L) digits <- 0L

  df_plot <- .dim_payload_to_plot_df(payload)
  ejes <- payload$axis_order_plot %||% unique(as.character(df_plot$eje))
  grupos <- payload$group_order %||% unique(as.character(df_plot$grupo))

  wide <- df_plot |>
    dplyr::transmute(
      eje = as.character(.data$eje),
      grupo = as.character(.data$grupo),
      valor = as.numeric(.data$valor)
    ) |>
    tidyr::complete(eje = ejes, grupo = grupos, fill = list(valor = 0)) |>
    tidyr::pivot_wider(names_from = "grupo", values_from = "valor")

  fmt_pct <- function(x) {
    x <- suppressWarnings(as.numeric(x))
    x[!is.finite(x) | is.na(x)] <- 0
    if (digits == 0L) sprintf("%.0f%%", x) else sprintf(paste0("%.", digits, "f%%"), x)
  }

  out <- as.data.frame(wide)
  out[[1]] <- as.character(out[[1]])
  for (j in 2:ncol(out)) out[[j]] <- fmt_pct(out[[j]])
  names(out)[1] <- as.character(titulo_left %||% "TOP TWO BOX")[1]
  out
}

#' @keywords internal
.dim_make_table_grob <- function(
    tb,
    header_fill = "#062A63",
    header_text = "white",
    body_fill = "#F2F2F2",
    grid_col = "white",
    text_blue = "#062A63",
    font_family = "Arial",
    header_size = 8,
    body_size = 7,
    firstcol_bold = TRUE,
    highlight_threshold = 60,
    highlight_col = "red",
    padding_mm = 3,
    firstcol_frac = 0.55,
    wrap_header = 14
) {
  if (!requireNamespace("gridExtra", quietly = TRUE)) stop("Requiere gridExtra.", call. = FALSE)

  n_data <- nrow(tb)
  n_cols <- ncol(tb)
  firstcol_frac <- suppressWarnings(as.numeric(firstcol_frac))
  if (!is.finite(firstcol_frac)) firstcol_frac <- 0.55
  firstcol_frac <- max(0.40, min(0.80, firstcol_frac))

  if (requireNamespace("stringr", quietly = TRUE) && is.finite(wrap_header) && wrap_header > 0) {
    nms <- names(tb)
    if (length(nms) >= 2) {
      nms[-1] <- stringr::str_wrap(nms[-1], width = as.integer(wrap_header))
      names(tb) <- nms
    }
  }

  tg <- gridExtra::tableGrob(
    tb,
    rows = NULL,
    theme = gridExtra::ttheme_minimal(
      base_size = body_size,
      base_family = font_family,
      padding = grid::unit(rep(padding_mm, 2), "mm"),
      colhead = list(
        fg_params = list(col = header_text, fontface = "bold"),
        bg_params = list(fill = header_fill, col = grid_col, lwd = 2)
      ),
      core = list(
        fg_params = list(col = text_blue),
        bg_params = list(fill = body_fill, col = grid_col, lwd = 2)
      )
    )
  )

  if (n_cols >= 2) {
    rest <- (1 - firstcol_frac) / (n_cols - 1)
    tg$widths <- grid::unit(c(firstcol_frac, rep(rest, n_cols - 1)), "npc")
  } else {
    tg$widths <- grid::unit(1, "npc")
  }

  for (j in seq_len(n_cols)) {
    k <- which(tg$layout$t == 1 & tg$layout$l == j & tg$layout$name == "colhead-fg")
    if (length(k)) {
      tg$grobs[[k]]$just <- "center"
      tg$grobs[[k]]$x <- grid::unit(0.5, "npc")
      tg$grobs[[k]]$gp <- grid::gpar(col = header_text, fontface = "bold", fontsize = header_size)
    }
  }

  for (i in seq_len(n_data)) {
    r <- i + 1
    k1 <- which(tg$layout$t == r & tg$layout$l == 1 & tg$layout$name == "core-fg")
    if (length(k1)) {
      tg$grobs[[k1]]$just <- "center"
      tg$grobs[[k1]]$x <- grid::unit(0.5, "npc")
      tg$grobs[[k1]]$y <- grid::unit(0.5, "npc")
      tg$grobs[[k1]]$gp <- grid::gpar(
        col = text_blue,
        fontface = if (isTRUE(firstcol_bold)) "bold" else "plain",
        fontsize = body_size,
        lineheight = 0.95
      )
    }

    if (n_cols >= 2) {
      for (j in 2:n_cols) {
        kj <- which(tg$layout$t == r & tg$layout$l == j & tg$layout$name == "core-fg")
        if (length(kj)) {
          tg$grobs[[kj]]$just <- "center"
          tg$grobs[[kj]]$x <- grid::unit(0.5, "npc")
          tg$grobs[[kj]]$y <- grid::unit(0.5, "npc")
          tg$grobs[[kj]]$gp <- grid::gpar(
            col = text_blue,
            fontface = if (i == 1L) "bold" else "plain",
            fontsize = body_size
          )
        }
      }
    }
  }

  parse_pct <- function(x) suppressWarnings(as.numeric(gsub("%", "", x)))
  if (n_cols >= 2) {
    for (j in 2:n_cols) {
      vals <- parse_pct(tb[[j]])
      idx_low <- which(is.finite(vals) & !is.na(vals) & vals <= highlight_threshold)
      if (length(idx_low)) {
        for (ii in idx_low) {
          r <- ii + 1
          kj <- which(tg$layout$t == r & tg$layout$l == j & tg$layout$name == "core-fg")
          if (length(kj)) {
            tg$grobs[[kj]]$gp <- grid::gpar(col = highlight_col, fontface = "bold", fontsize = body_size)
            tg$grobs[[kj]]$just <- "center"
            tg$grobs[[kj]]$x <- grid::unit(0.5, "npc")
          }
        }
      }
    }
  }

  tg
}

#' @keywords internal
.dim_compose_plot_table_canvas <- function(
    plot_obj,
    table_grob,
    tabla_ph_ancho = 0.40,
    tabla_ph_gap = 0.03,
    tabla_auto_fit = FALSE,
    tabla_fit_pad = 0.98,
    tabla_allow_upscale = FALSE,
    debug_ph_bordes = FALSE,
    debug_ph_col = "#FF00FF",
    debug_ph_lwd = 0.6
) {
  tabla_ph_ancho <- suppressWarnings(as.numeric(tabla_ph_ancho))
  if (!is.finite(tabla_ph_ancho) || tabla_ph_ancho <= 0 || tabla_ph_ancho >= 0.8) tabla_ph_ancho <- 0.40
  tabla_ph_gap <- suppressWarnings(as.numeric(tabla_ph_gap))
  if (!is.finite(tabla_ph_gap) || tabla_ph_gap < 0 || tabla_ph_gap >= 0.2) tabla_ph_gap <- 0.03

  w_plot <- 1 - tabla_ph_ancho - tabla_ph_gap
  x_table <- w_plot + tabla_ph_gap

  scale_tab <- 1
  if (isTRUE(tabla_auto_fit)) {
    gw_in <- suppressWarnings(grid::convertWidth(sum(table_grob$widths), "in", valueOnly = TRUE))
    gh_in <- suppressWarnings(grid::convertHeight(sum(table_grob$heights), "in", valueOnly = TRUE))
    if (is.finite(gw_in) && gw_in > 0 && is.finite(gh_in) && gh_in > 0) {
      s_w <- tabla_ph_ancho / gw_in
      s_h <- 1 / gh_in
      scale_tab <- min(s_w, s_h)
      if (!isTRUE(tabla_allow_upscale)) scale_tab <- min(1, scale_tab)
      scale_tab <- scale_tab * tabla_fit_pad
      if (!is.finite(scale_tab) || scale_tab <= 0) scale_tab <- 1
    }
  }

  canvas <- cowplot::ggdraw() +
    cowplot::draw_plot(plot_obj, x = 0, y = 0, width = w_plot, height = 1) +
    cowplot::draw_grob(
      table_grob,
      x = x_table + (tabla_ph_ancho * 0.5),
      y = 0.5,
      width = tabla_ph_ancho,
      height = 1,
      hjust = 0.5,
      vjust = 0.5,
      scale = scale_tab
    )

  if (isTRUE(debug_ph_bordes)) {
    canvas <- canvas +
      cowplot::draw_grob(grid::rectGrob(gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)), x = 0, y = 0, width = w_plot, height = 1) +
      cowplot::draw_grob(grid::rectGrob(gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)), x = x_table, y = 0, width = tabla_ph_ancho, height = 1)
  }

  canvas
}

#' Heatmap semaforico de dimensiones en canvas
#'
#' Visualiza indices y subindices de dimensiones como heatmap semaforico (rojo /
#' ambar / verde). Requiere que `data` sea la salida encadenada de
#' [reporte_dimensiones()] y [reporte_dimensiones_indices()].
#'
#' @param data Base recodificada e indexada; salida de
#'   `reporte_dimensiones() |> reporte_dimensiones_indices()`.
#' @param modo `"general"` (indices por subindices) o `"indicadores"` (subindices por item).
#' @param objetivo Id tecnico del catalogo (columna `idx_*` o clave de bloque).
#' @param instrumento Instrumento opcional. Si es `NULL`, se usa `attr(data, "instrumento_reporte")`.
#' @param cruce Variable de comparacion opcional (columna en `data`).
#' @param incluir_total Si es `NULL`, usa el default de la configuracion interna.
#' @param modo_semaforo Modo del semaforo para el heatmap: `"grupos"` mantiene
#'   la clasificacion discreta actual y `"degradado"` interpola colores
#'   alrededor de los cortes de referencia.
#' @param brecha_filas,brecha_cols Si `TRUE`, agrega fila/columna de brecha
#'   calculada como `(max - min)` en la matriz del heatmap.
#' @param etiq_brecha_filas,etiq_brecha_cols Etiquetas para fila/columna de brecha.
#' @param aplicar_gradiente_brecha Si `TRUE`, colorea celdas de brecha con gradiente.
#' @param brecha_colores Vector de colores para brecha (`bajo`, `alto`).
#' @param brecha_cortes Cortes numericos (min, max) para escalar el gradiente de brecha.
#' @param filtros Lista nombrada de filtros por variable.
#' @param iter_var Variable opcional de iteracion (columna en `data`).
#' @param iter_level Nivel especifico de iteracion.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param size_ejes_x Tamano opcional de etiquetas del eje X. Si es `NULL`, usa `size_ejes`.
#' @param titulo_total_x,titulo_total_y Etiquetas para los totales en eje X y eje Y.
#' @param mostrar_n_cruce_x Si `TRUE`, agrega `(N=...)` en etiquetas del eje X por cruce.
#' @param usar_canvas Si `TRUE`, compone encabezado, panel, leyenda y pie con `cowplot`.
#' @param debug_ph_bordes,debug_ph_col,debug_ph_lwd Borde de depuracion del canvas.
#' @param exportar Tipo de exportacion: `"rplot"`, `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida cuando `exportar != "rplot"`.
#' @param ancho,alto,dpi Tamano y resolucion de exportacion.
#'
#' @return Objeto grafico (canvas cowplot) o exportacion invisible.
#' @family graficador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_indices()],
#'   [reporte_dimensiones_config()], [graficar_radar_dimensiones()]
#' @export
graficar_heatmap_dimensiones <- function(
    data,
    modo = c("general", "indicadores"),
    objetivo,
    instrumento = NULL,
    cruce = NULL,
    incluir_total = NULL,
    modo_semaforo = NULL,
    brecha_filas = FALSE,
    etiq_brecha_filas = "Brecha",
    brecha_cols = FALSE,
    etiq_brecha_cols = "Brecha",
    aplicar_gradiente_brecha = TRUE,
    brecha_colores = c(bajo = "#FFFFFF", alto = "#F4B183"),
    brecha_cortes = c(0, 30),
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    color_titulo = "#004B8D",
    size_titulo = 12,
    color_subtitulo = "#004B8D",
    size_subtitulo = 9,
    color_nota_pie = "#004B8D",
    size_nota_pie = 8,
    color_leyenda = "#004B8D",
    size_leyenda = 9,
    color_ejes = "#20324d",
    size_ejes = 10,
    size_ejes_x = NULL,
    color_texto_celdas = "#122842",
    size_texto_celdas = 10,
    color_fondo = NA,
    angle_x = 0,
    titulo_total_x = "Promedio\ngeneral",
    titulo_total_y = "Total cruce",
    mostrar_n_cruce_x = FALSE,
    mostrar_leyenda = TRUE,
    icono_modo = c("reemplazar", "acompanar"),
    icono_size_cm = 0.55,
    usar_canvas = TRUE,
    canvas_h_title = 0.13,
    canvas_h_legend = 0.09,
    canvas_h_caption = 0.06,
    canvas_pad_top = 0.01,
    debug_ph_bordes = FALSE,
    debug_ph_col = "#FF00FF",
    debug_ph_lwd = 0.6,
    exportar = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho = 8.5,
    alto = 5.6,
    dpi = 300,
    ppt_append = TRUE,
    ppt_layout = "Blank",
    ppt_master = "Office Theme"
) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Requiere cowplot.", call. = FALSE)

  icono_modo <- match.arg(icono_modo)
  modo <- match.arg(modo)
  exportar <- match.arg(exportar)
  mostrar_leyenda <- isTRUE(mostrar_leyenda)
  mostrar_n_cruce_x <- isTRUE(mostrar_n_cruce_x)

  brecha_filas <- isTRUE(brecha_filas)
  brecha_cols <- isTRUE(brecha_cols)
  aplicar_gradiente_brecha <- isTRUE(aplicar_gradiente_brecha)

  size_ejes_x <- suppressWarnings(as.numeric(size_ejes_x))
  if (!length(size_ejes_x) || !is.finite(size_ejes_x[1]) || is.na(size_ejes_x[1]) || size_ejes_x[1] <= 0) {
    size_ejes_x <- size_ejes
  } else {
    size_ejes_x <- size_ejes_x[1]
  }

  titulo_total_x <- as.character(titulo_total_x %||% "Total")[1]
  if (!nzchar(trimws(titulo_total_x))) titulo_total_x <- "Promedio\ngeneral"
  titulo_total_y <- as.character(titulo_total_y %||% "Total cruce")[1]
  if (!nzchar(trimws(titulo_total_y))) titulo_total_y <- "Total cruce"

  etiq_brecha_filas <- as.character(etiq_brecha_filas %||% "Brecha")[1]
  if (!nzchar(trimws(etiq_brecha_filas))) etiq_brecha_filas <- "Brecha"
  etiq_brecha_cols <- as.character(etiq_brecha_cols %||% "Brecha")[1]
  if (!nzchar(trimws(etiq_brecha_cols))) etiq_brecha_cols <- "Brecha"

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

  .to_rgb <- function(col, fallback = "#FFFFFF") {
    x <- tryCatch(grDevices::col2rgb(col), error = function(e) NULL)
    if (is.null(x)) x <- grDevices::col2rgb(fallback)
    as.numeric(x[, 1])
  }
  .mix_color <- function(col_bajo, col_alto, t) {
    t <- pmax(0, pmin(1, as.numeric(t)))
    if (!is.finite(t) || is.na(t)) return(col_bajo)
    r0 <- .to_rgb(col_bajo, "#FFFFFF")
    r1 <- .to_rgb(col_alto, "#F4B183")
    rr <- round(r0 + (r1 - r0) * t)
    grDevices::rgb(rr[1], rr[2], rr[3], maxColorValue = 255)
  }
  .calc_brecha <- function(x) {
    v <- suppressWarnings(as.numeric(x))
    v <- v[is.finite(v) & !is.na(v)]
    if (length(v) < 2L) return(NA_real_)
    max(v, na.rm = TRUE) - min(v, na.rm = TRUE)
  }
  .fmt_n_x <- function(x) {
    x <- .dim_round_half_up(x, 0)
    if (!is.finite(x) || is.na(x)) return(NA_character_)
    format(as.integer(x), trim = TRUE, big.mark = ",", scientific = FALSE)
  }

  ctx <- .dim_build_context(data, instrumento = instrumento)
  payload <- .dim_build_payload(
    ctx,
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level
  )

  if (!nrow(payload$score_heat)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin datos para mostrar",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho,
      alto = alto,
      dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  sem <- payload$semaforo
  sem_modo <- .dim_normalize_semaforo_modo(modo_semaforo %||% sem$modo %||% "grupos")
  cuts_lab <- .dim_range_labels(sem$cortes[1], sem$cortes[2])
  legend_breaks <- cuts_lab
  legend_limits <- c(cuts_lab[1], cuts_lab[2], cuts_lab[3], "Sin dato")
  sc_base <- payload$score_heat
  sc <- sc_base

  if (isTRUE(brecha_cols)) {
    sc_bc <- sc_base |>
      dplyr::group_by(.data$axis_label) |>
      dplyr::summarise(score_raw = .calc_brecha(.data$score_raw), .groups = "drop") |>
      dplyr::mutate(
        axis_var = "__brecha_cols__",
        grupo = etiq_brecha_cols,
        tipo = "brecha_cols",
        base = NA_real_,
        score_round = .dim_round_half_up(.data$score_raw, 0)
      ) |>
      dplyr::select("axis_var", "axis_label", "grupo", "tipo", "score_raw", "base", "score_round")
    sc <- dplyr::bind_rows(sc, sc_bc)
  }

  if (isTRUE(brecha_filas)) {
    sc_bf <- sc_base |>
      dplyr::group_by(.data$grupo) |>
      dplyr::summarise(score_raw = .calc_brecha(.data$score_raw), .groups = "drop") |>
      dplyr::mutate(
        axis_var = "__brecha_filas__",
        axis_label = etiq_brecha_filas,
        tipo = "brecha_filas",
        base = NA_real_,
        score_round = .dim_round_half_up(.data$score_raw, 0)
      ) |>
      dplyr::select("axis_var", "axis_label", "grupo", "tipo", "score_raw", "base", "score_round")
    sc <- dplyr::bind_rows(sc, sc_bf)
  }

  if (isTRUE(brecha_cols) && isTRUE(brecha_filas)) {
    sc_corner <- data.frame(
      axis_var = "__brecha_corner__",
      axis_label = etiq_brecha_filas,
      grupo = etiq_brecha_cols,
      tipo = "brecha_corner",
      score_raw = NA_real_,
      base = NA_real_,
      score_round = NA_real_,
      stringsAsFactors = FALSE
    )
    sc <- dplyr::bind_rows(sc, sc_corner)
  }

  sc$grupo <- as.character(sc$grupo)
  sc$axis_label <- as.character(sc$axis_label)
  sc$grupo[sc$grupo == "Total"] <- titulo_total_x
  sc$axis_label[sc$axis_label == "Total cruce"] <- titulo_total_y

  group_order <- payload$group_order_natural %||% payload$group_order %||% unique(as.character(sc_base$grupo))
  group_order <- as.character(group_order)
  group_order[group_order == "Total"] <- titulo_total_x
  if (isTRUE(brecha_cols) && !(etiq_brecha_cols %in% group_order)) {
    group_order <- c(group_order, etiq_brecha_cols)
  }
  axis_order_heat <- payload$axis_order_heat %||% unique(as.character(sc_base$axis_label))
  axis_order_heat <- as.character(axis_order_heat)
  axis_order_heat[axis_order_heat == "Total cruce"] <- titulo_total_y
  if (isTRUE(brecha_filas) && !(etiq_brecha_filas %in% axis_order_heat)) {
    axis_order_heat <- c(axis_order_heat, etiq_brecha_filas)
  }

  if (isTRUE(mostrar_n_cruce_x)) {
    bases_grupo <- sc |>
      dplyr::group_by(.data$grupo) |>
      dplyr::summarise(
        base_plot = {
          b <- suppressWarnings(as.numeric(.data$base))
          b <- b[is.finite(b) & !is.na(b)]
          if (length(b)) b[1] else NA_real_
        },
        .groups = "drop"
      )

    map_n <- stats::setNames(
      vapply(seq_len(nrow(bases_grupo)), function(i) {
        lab <- as.character(bases_grupo$grupo[i])
        n_txt <- .fmt_n_x(as.numeric(bases_grupo$base_plot[i]))
        if (is.na(n_txt) || !nzchar(n_txt)) lab else paste0(lab, " (N=", n_txt, ")")
      }, character(1)),
      as.character(bases_grupo$grupo)
    )

    sc_groups_new <- unname(map_n[sc$grupo])
    keep_old_sc <- is.na(sc_groups_new) | !nzchar(sc_groups_new)
    sc_groups_new[keep_old_sc] <- sc$grupo[keep_old_sc]
    sc$grupo <- sc_groups_new

    group_order_new <- unname(map_n[group_order])
    keep_old_ord <- is.na(group_order_new) | !nzchar(group_order_new)
    group_order_new[keep_old_ord] <- group_order[keep_old_ord]
    group_order <- unique(group_order_new)
  }

  # Ajusta automáticamente etiquetas largas del eje X para evitar solapes.
  .wrap_heatmap_group <- function(x, width) {
    x <- as.character(x %||% "")
    if (!nzchar(trimws(x))) return(x)
    if (!is.finite(width) || is.na(width) || width < 4) return(x)
    paste(base::strwrap(x, width = width), collapse = "\n")
  }

  n_groups_plot <- max(1L, length(group_order))
  wrap_width_x <- .dim_clamp(floor(44 / n_groups_plot), 8, 18)
  group_order_display <- vapply(group_order, .wrap_heatmap_group, character(1), width = wrap_width_x)
  map_group_display <- stats::setNames(group_order_display, group_order)
  sc_grupo_raw <- as.character(sc$grupo)
  sc$grupo <- unname(map_group_display[sc_grupo_raw])
  miss_group_display <- is.na(sc$grupo) | !nzchar(sc$grupo)
  sc$grupo[miss_group_display] <- sc_grupo_raw[miss_group_display]
  max_lines_x <- max(
    lengths(strsplit(group_order_display, "\n", fixed = TRUE)),
    na.rm = TRUE
  )
  bottom_margin <- 8 + (max(1L, max_lines_x) - 1L) * 11

  sc$grupo <- factor(sc$grupo, levels = group_order_display)
  sc$axis_label <- factor(sc$axis_label, levels = rev(axis_order_heat))
  sc$is_brecha <- as.character(sc$tipo %||% "") %in% c("brecha_cols", "brecha_filas", "brecha_corner")
  sc$estado <- .dim_semaforo_estado(
    x = sc$score_raw,
    cortes = sem$cortes,
    digits = 0,
    labels = cuts_lab
  )
  sc$estado[is.na(sc$score_raw)] <- "Sin dato"
  sc$estado <- factor(sc$estado, levels = c(cuts_lab[1], cuts_lab[2], cuts_lab[3], "Sin dato"))

  fill_std <- .dim_semaforo_color(
    x = sc$score_raw,
    cortes = sem$cortes,
    colores = list(rojo = sem$rojo, ambar = sem$ambar, verde = sem$verde),
    digits = 0,
    na_color = sem$na,
    modo = sem_modo,
    anclas_degradado = sem$anclas_degradado %||% NULL,
    gradiente_colores = sem$gradiente_colores %||% NULL,
    gradiente_valores = sem$gradiente_valores %||% NULL,
    gradiente_limites = sem$gradiente_limites %||% NULL,
    gradiente_segmentos = sem$gradiente_segmentos %||% 20L
  )
  fill_brecha <- rep(col_brecha_alto, nrow(sc))
  if (isTRUE(aplicar_gradiente_brecha)) {
    vals_b <- suppressWarnings(as.numeric(sc$score_raw))
    tt <- if (isTRUE(brecha_corte_max > brecha_corte_min)) {
      pmax(0, pmin(1, (vals_b - brecha_corte_min) / (brecha_corte_max - brecha_corte_min)))
    } else {
      rep(0.5, length(vals_b))
    }
    fill_brecha <- vapply(tt, function(ti) .mix_color(col_brecha_bajo, col_brecha_alto, ti), character(1))
  }
  fill_brecha[!is.finite(suppressWarnings(as.numeric(sc$score_raw))) | is.na(sc$score_raw)] <- sem$na
  sc$fill_hex <- ifelse(sc$is_brecha, fill_brecha, as.character(fill_std))
  sc$label <- ifelse(is.na(sc$score_raw), "", .dim_fmt_int(sc$score_round))

  max_chars <- max(nchar(as.character(axis_order_heat), type = "width"), na.rm = TRUE)
  left_margin <- .dim_clamp(36 + 7 * max_chars, 130, 320)

  p_panel <- ggplot2::ggplot(
    sc,
    ggplot2::aes(x = .data$grupo, y = .data$axis_label, fill = .data$fill_hex)
  ) +
    ggplot2::geom_tile(colour = "#F2F5F9", linewidth = 0.45) +
    ggplot2::geom_text(
      ggplot2::aes(label = .data$label),
      size = size_texto_celdas / 3,
      colour = color_texto_celdas,
      fontface = "bold"
    ) +
    ggplot2::scale_fill_identity() +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(
      panel.grid = ggplot2::element_blank(),
      axis.title = ggplot2::element_blank(),
      axis.text.x = ggplot2::element_text(
        size = size_ejes_x,
        colour = color_ejes,
        angle = angle_x,
        hjust = if (abs(angle_x) < 1e-6) 0.5 else 0,
        vjust = if (abs(angle_x) < 1e-6) 0.5 else 1
      ),
      axis.text.y = ggplot2::element_text(size = size_ejes, colour = color_ejes),
      legend.title = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(size = size_leyenda, colour = color_leyenda),
      legend.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      legend.key = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin = ggplot2::margin(8, 12, bottom_margin, 8)
    )

  if (!isTRUE(usar_canvas)) {
    return(.dim_export_canvas(
      p_panel,
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho,
      alto = alto,
      dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  p_panel <- p_panel + ggplot2::theme(legend.position = "none")

  # --- Iconos en el heatmap --------------------------------------------------
  axis_iconos_heat <- payload$axis_iconos %||% list()
  has_iconos_heat  <- .dim_has_iconos(axis_iconos_heat)

  if (has_iconos_heat) {
    n_rows_heat <- length(axis_order_heat)
    .heat_row_icon <- function(i, lbl) {
      if (i == 1L) return(NULL)
      if (length(axis_iconos_heat) >= (i - 1L)) {
        ico_pos <- axis_iconos_heat[[i - 1L]]
        if (!is.null(ico_pos) && nzchar(as.character(ico_pos))) return(ico_pos)
      }
      ico_lbl <- axis_iconos_heat[[lbl]]
      if (!is.null(ico_lbl) && nzchar(as.character(ico_lbl))) return(ico_lbl)
      NULL
    }

    if (identical(icono_modo, "reemplazar")) {
      p_panel <- p_panel +
        ggplot2::scale_y_discrete(
          labels = stats::setNames(rep("", length(axis_order_heat)), axis_order_heat)
        ) +
        ggplot2::theme(axis.ticks.y = ggplot2::element_blank())
    } else {
      p_panel <- p_panel + ggplot2::theme(
        axis.text.y  = ggplot2::element_blank(),
        axis.ticks.y = ggplot2::element_blank()
      )
    }

    if (identical(icono_modo, "acompanar")) {
      icon_ac <- cowplot::axis_canvas(p_panel, axis = "y")

      for (i in seq_len(n_rows_heat)) {
        lbl_heat <- axis_order_heat[[i]]
        ico_path <- .heat_row_icon(i, lbl_heat)
        img      <- .dim_load_icon(ico_path)
        y_pos    <- n_rows_heat + 1L - i

        if (!is.null(img)) {
          icon_ac <- icon_ac + ggplot2::annotation_custom(
            grid::rasterGrob(img, interpolate = TRUE),
            xmin = 0.0, xmax = 0.28,
            ymin = y_pos - 0.42, ymax = y_pos + 0.42
          )
        }
        icon_ac <- icon_ac + ggplot2::annotate(
          "text",
          x = if (!is.null(img)) 0.35 else 0.05,
          y = y_pos,
          label = lbl_heat,
          hjust = 0, vjust = 0.5,
          size  = size_ejes / 3,
          colour = color_ejes
        )
      }
    } else {
      icon_ac <- cowplot::ggdraw()
      row_h_npc <- 1 / max(1, n_rows_heat)
      icon_h_npc <- min(0.13, row_h_npc * 0.56)
      y_npc_rows <- rev(((seq_len(n_rows_heat) - 0.5) / n_rows_heat))

      for (i in seq_len(n_rows_heat)) {
        lbl_heat <- axis_order_heat[[i]]
        ico_path <- .heat_row_icon(i, lbl_heat)
        img      <- .dim_load_icon(ico_path)
        is_text_icon <- FALSE

        # Para filas sin icono (ej. indice general), generar imagen del texto
        if (is.null(img)) {
          img <- .dim_text_to_icon(
            paste(strwrap(lbl_heat, width = 10), collapse = "\n"),
            colour = color_ejes,
            fontsize = 52,
            px_width = 520,
            px_height = 220,
            fontface = "bold",
            lineheight = 0.88
          )
          is_text_icon <- TRUE
        }

        y_npc <- y_npc_rows[[i]]

        if (!is.null(img)) {
          img_width <- if (isTRUE(is_text_icon)) 0.72 else 0.38
          img_x <- if (isTRUE(is_text_icon)) (0.41 - img_width / 2) else 0.22
          img_height <- if (isTRUE(is_text_icon)) min(0.16, row_h_npc * 0.78) else icon_h_npc
          icon_ac <- icon_ac + cowplot::draw_image(
            img,
            x = img_x, y = y_npc - (img_height / 2),
            width = img_width, height = img_height,
            interpolate = TRUE
          )
        }
      }
    }

    # Calcular ancho del panel de iconos
    icon_panel_cm <- if (identical(icono_modo, "acompanar")) {
      max_chars <- max(nchar(axis_order_heat, type = "width"), na.rm = TRUE)
      max(2.5, 0.22 * max_chars + icono_size_cm + 0.3)
    } else {
      labels_sin_icono <- axis_order_heat[vapply(seq_along(axis_order_heat), function(i) {
        ico <- .heat_row_icon(i, axis_order_heat[[i]])
        is.null(ico) || !nzchar(as.character(ico))
      }, logical(1))]
      if (length(labels_sin_icono)) {
        max(icono_size_cm, 1.20)
      } else {
        icono_size_cm
      }
    }

    p_panel <- cowplot::insert_yaxis_grob(
      p_panel, icon_ac,
      width    = grid::unit(icon_panel_cm, "cm"),
      position = "left"
    )
  }
  # ---------------------------------------------------------------------------

  title_block <- cowplot::ggdraw() +
    cowplot::draw_label(
      label = titulo %||% "",
      x = 0.5, y = if (!is.null(subtitulo) && nzchar(subtitulo)) 0.62 else 0.5,
      hjust = 0.5, vjust = 0.5,
      size = size_titulo,
      colour = color_titulo,
      fontface = "bold"
    ) +
    cowplot::draw_label(
      label = subtitulo %||% "",
      x = 0.5, y = if (!is.null(subtitulo) && nzchar(subtitulo)) 0.28 else 0.5,
      hjust = 0.5, vjust = 0.5,
      size = size_subtitulo,
      colour = color_subtitulo
    )

  sem_legend <- if (isTRUE(mostrar_leyenda)) {
    .dim_heat_legend_block(
      labels = legend_breaks,
      colors = c(sem$rojo, sem$ambar, sem$verde),
      size = size_leyenda,
      colour = color_leyenda
    )
  } else {
    cowplot::ggdraw() + cowplot::theme_nothing()
  }

  # Cuando hay iconos en modo "reemplazar" anadir leyenda de iconos
  has_icono_legend <- has_iconos_heat && identical(icono_modo, "reemplazar")
  icono_legend_block <- if (has_icono_legend) {
    # Solo los items con icono (excluir Total cruce)
    iconos_legend <- axis_iconos_heat[
      !is.na(names(axis_iconos_heat)) &
      vapply(axis_iconos_heat, function(x) !is.null(x) && nzchar(x), logical(1))
    ]
    if (length(iconos_legend)) {
      .dim_icono_leyenda_block(
        iconos_legend,
        size_text = size_leyenda,
        colour_text = color_leyenda
      )
    } else NULL
  } else NULL

  legend_block <- if (!is.null(icono_legend_block) && isTRUE(mostrar_leyenda)) {
    cowplot::plot_grid(sem_legend, icono_legend_block, ncol = 1, rel_heights = c(0.45, 0.55))
  } else if (!is.null(icono_legend_block)) {
    icono_legend_block
  } else {
    sem_legend
  }

  caption_block <- cowplot::ggdraw() +
    cowplot::draw_label(
      label = nota_pie %||% "",
      x = 1, y = 0.5,
      hjust = 1, vjust = 0.5,
      size = size_nota_pie,
      colour = color_nota_pie
    )

  h_title   <- canvas_h_title
  h_legend  <- if (isTRUE(mostrar_leyenda) || !is.null(icono_legend_block)) {
    if (!is.null(icono_legend_block)) canvas_h_legend * 1.8 else canvas_h_legend
  } else {
    0.01
  }
  h_caption <- if (!is.null(nota_pie) && nzchar(nota_pie)) canvas_h_caption else 0.01
  h_panel   <- max(0.01, 1 - (h_title + h_legend + h_caption) - canvas_pad_top)

  canvas <- cowplot::plot_grid(
    .dim_wrap_debug_canvas(title_block, debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(p_panel, debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(legend_block, debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(caption_block, debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    ncol = 1,
    rel_heights = c(h_title, h_panel, h_legend, h_caption)
  )

  .dim_export_canvas(
    canvas,
    exportar = exportar,
    path_salida = path_salida,
    ancho = ancho,
    alto = alto,
    dpi = dpi,
    ppt_append = ppt_append,
    ppt_layout = ppt_layout,
    ppt_master = ppt_master
  )
}

#' Heatmap de criterios por conductor
#'
#' Construye una matriz de criterios agrupados por conductor, calculando el
#' puntaje ponderado de cada criterio y representandolo con semaforo degradado.
#'
#' @param data Base recodificada e indexada; salida de
#'   `reporte_dimensiones() |> reporte_dimensiones_indices()`.
#' @param config_criterios Lista de conductores, cada uno con `id`, `titulo`,
#'   `vars` y opcionalmente `icono` y `labels`.
#' @param instrumento Instrumento opcional. Si es `NULL`, se usa
#'   `attr(data, "instrumento_reporte")`.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param modo_semaforo Modo del semaforo.
#' @param cortes Vector numerico de dos cortes para clasificar el semaforo.
#' @param colores Vector de colores del semaforo (`rojo`, `ambar`, `verde`).
#' @param na_color Color para celdas sin dato.
#' @param alineacion_criterios `"centrado"` o `"izquierda"`.
#' @param mostrar_titulo_conductor Si `TRUE`, muestra cabecera por conductor.
#' @param mostrar_icono_conductor Si `TRUE`, intenta mostrar icono por conductor.
#' @param wrap_criterio Ancho de wrap para el texto del criterio.
#' @param gutter_conductores Separacion visual entre paneles de conductor.
#' @param header_h_conductor Altura relativa de la cabecera del conductor.
#' @param color_texto Color del texto del grafico.
#' @param title_band_fill,title_band_col Estilo de la banda de cabecera.
#' @param size_texto_criterio,size_texto_celda,size_titulo_conductor Tamano de texto.
#' @param font_family Familia tipografica.
#' @param semaforo_anclas_degradado,semaforo_gradiente_colores,
#'   semaforo_gradiente_valores,semaforo_gradiente_limites Parametros del degradado.
#' @param debug_ph_bordes,debug_ph_col,debug_ph_lwd Borde de depuracion del canvas.
#' @param exportar,path_salida,ancho,alto,dpi,ppt_append,ppt_layout,ppt_master
#'   Configuracion de exportacion.
#'
#' @return Objeto grafico (canvas cowplot) o exportacion invisible.
#' @family graficador
#' @export
graficar_heatmap_criterios_dimensiones <- function(
    data,
    config_criterios,
    instrumento = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    modo_semaforo = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    cortes = c(70, 80),
    colores = c(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B"),
    na_color = "#F7F9FC",
    alineacion_criterios = c("centrado", "izquierda"),
    mostrar_titulo_conductor = TRUE,
    mostrar_icono_conductor = TRUE,
    wrap_criterio = 13,
    gutter_conductores = 0.045,
    header_h_conductor = 0.15,
    color_texto = "#000000",
    title_band_fill = "#F5F7FA",
    title_band_col = "#E2E8F0",
    size_texto_criterio = 2.8,
    size_texto_celda = 2.9,
    size_titulo_conductor = 10,
    fontface_texto_criterio = "plain",
    fontface_titulo_conductor = "bold",
    size_icono_conductor = 0.075,
    gap_icono_titulo = 0.02,
    font_family = "Arial",
    semaforo_anclas_degradado = NULL,
    semaforo_gradiente_colores = NULL,
    semaforo_gradiente_valores = NULL,
    semaforo_gradiente_limites = NULL,
    debug_ph_bordes = FALSE,
    debug_ph_col = "#FF00FF",
    debug_ph_lwd = 0.6,
    exportar = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho = 8.5,
    alto = 5.6,
    dpi = 300,
    ppt_append = TRUE,
    ppt_layout = "Blank",
    ppt_master = "Office Theme"
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y

  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Requiere cowplot.", call. = FALSE)
  if (!is.data.frame(data)) stop("`data` debe ser data.frame.", call. = FALSE)

  exportar <- match.arg(exportar)
  modo_semaforo <- .dim_normalize_semaforo_modo(match.arg(modo_semaforo))
  alineacion_criterios <- match.arg(alineacion_criterios)

  ctx <- .dim_build_context(data, instrumento = instrumento)
  instrumento <- instrumento %||% ctx$instrumento %||% NULL

  wrap_criterio <- suppressWarnings(as.integer(wrap_criterio)[1])
  if (!is.finite(wrap_criterio) || is.na(wrap_criterio) || wrap_criterio < 6L) wrap_criterio <- 13L
  gutter_conductores <- suppressWarnings(as.numeric(gutter_conductores)[1])
  if (!is.finite(gutter_conductores) || is.na(gutter_conductores) || gutter_conductores < 0) gutter_conductores <- 0.045
  header_h_conductor <- suppressWarnings(as.numeric(header_h_conductor)[1])
  if (!is.finite(header_h_conductor) || is.na(header_h_conductor) || header_h_conductor <= 0 || header_h_conductor >= 0.4) header_h_conductor <- 0.15
  size_texto_criterio <- suppressWarnings(as.numeric(size_texto_criterio)[1])
  if (!is.finite(size_texto_criterio) || is.na(size_texto_criterio) || size_texto_criterio <= 0) size_texto_criterio <- 2.55
  size_texto_celda <- suppressWarnings(as.numeric(size_texto_celda)[1])
  if (!is.finite(size_texto_celda) || is.na(size_texto_celda) || size_texto_celda <= 0) size_texto_celda <- 2.9
  size_titulo_conductor <- suppressWarnings(as.numeric(size_titulo_conductor)[1])
  if (!is.finite(size_titulo_conductor) || is.na(size_titulo_conductor) || size_titulo_conductor <= 0) size_titulo_conductor <- 10
  fontface_texto_criterio <- as.character(fontface_texto_criterio %||% "plain")[1]
  if (is.na(fontface_texto_criterio) || !nzchar(trimws(fontface_texto_criterio))) fontface_texto_criterio <- "plain"
  fontface_titulo_conductor <- as.character(fontface_titulo_conductor %||% "bold")[1]
  if (is.na(fontface_titulo_conductor) || !nzchar(trimws(fontface_titulo_conductor))) fontface_titulo_conductor <- "bold"
  size_icono_conductor <- suppressWarnings(as.numeric(size_icono_conductor)[1])
  if (!is.finite(size_icono_conductor) || is.na(size_icono_conductor) || size_icono_conductor <= 0 || size_icono_conductor >= 0.3) {
    size_icono_conductor <- 0.075
  }
  gap_icono_titulo <- suppressWarnings(as.numeric(gap_icono_titulo)[1])
  if (!is.finite(gap_icono_titulo) || is.na(gap_icono_titulo) || gap_icono_titulo < 0 || gap_icono_titulo >= 0.15) {
    gap_icono_titulo <- 0.02
  }
  font_family <- as.character(font_family %||% "Arial")[1]
  if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"
  color_texto <- as.character(color_texto %||% "#000000")[1]
  if (is.na(color_texto) || !nzchar(trimws(color_texto))) color_texto <- "#000000"

  if (!is.list(config_criterios) || !length(config_criterios)) {
    stop("`config_criterios` debe ser una lista no vacia.", call. = FALSE)
  }

  .label_from_instrument <- function(var, instrumento) {
    if (is.null(instrumento) || is.null(instrumento$survey) || !"name" %in% names(instrumento$survey)) return(NA_character_)
    survey <- instrumento$survey
    idx <- !is.na(survey$name) & as.character(survey$name) == var
    if (!any(idx)) return(NA_character_)
    for (nm in c("label", "label_es", "etiqueta")) {
      if (nm %in% names(survey)) {
        val <- as.character(survey[[nm]][idx])
        val <- val[!is.na(val) & nzchar(trimws(val))]
        if (length(val)) return(val[1])
      }
    }
    NA_character_
  }

  .label_for_var <- function(var, labels = NULL) {
    if (!is.null(labels)) {
      if (!is.null(names(labels)) && var %in% names(labels)) {
        val <- as.character(labels[[var]])[1]
        if (!is.na(val) && nzchar(trimws(val))) return(trimws(val))
      }
      vals <- as.character(labels)
      idx <- which(seq_along(vals) == match(var, unname(names(labels) %||% character(0))))
      if (length(idx)) {
        val <- vals[idx[1]]
        if (!is.na(val) && nzchar(trimws(val))) return(trimws(val))
      }
    }
    attr_label <- attr(data[[var]], "label", exact = TRUE)
    attr_label <- as.character(attr_label %||% NA_character_)[1]
    if (!is.na(attr_label) && nzchar(trimws(attr_label))) return(trimws(attr_label))
    inst_label <- .label_from_instrument(var, instrumento = instrumento)
    if (!is.na(inst_label) && nzchar(trimws(inst_label))) return(trimws(inst_label))
    var
  }

  config_tbl <- purrr::imap_dfr(
    config_criterios,
    function(cfg, idx) {
      if (!is.list(cfg)) stop("Cada entrada de `config_criterios` debe ser lista.", call. = FALSE)
      conductor_id <- as.character(cfg$id %||% names(config_criterios)[idx] %||% paste0("conductor_", idx))[1]
      conductor_titulo <- as.character(cfg$titulo %||% conductor_id)[1]
      vars <- as.character(cfg$vars %||% character(0))
      vars <- vars[!is.na(vars) & nzchar(trimws(vars))]
      if (!length(vars)) stop("Cada conductor en `config_criterios` debe incluir `vars` no vacios.", call. = FALSE)
      labels_cfg <- cfg$labels %||% NULL
      icono <- as.character(cfg$icono %||% NA_character_)[1]
      if (is.na(icono) || !nzchar(trimws(icono))) icono <- NA_character_

      tibble::tibble(
        conductor_id = conductor_id,
        conductor_label = conductor_titulo,
        conductor_orden = idx,
        icono = icono,
        criterio_var = vars,
        criterio_orden = seq_along(vars)
      ) |>
        dplyr::mutate(
          criterio_label = vapply(.data$criterio_var, .label_for_var, character(1), labels = labels_cfg),
          criterio_display = vapply(
            .data$criterio_label,
            function(x) paste(strwrap(x, width = wrap_criterio), collapse = "\n"),
            character(1)
          )
        )
    }
  )

  missing_vars <- setdiff(unique(config_tbl$criterio_var), names(data))
  if (length(missing_vars)) {
    stop("No se encontraron estas variables de criterios en `data`: ", paste(missing_vars, collapse = ", "), call. = FALSE)
  }

  var_peso <- as.character(attr(data, "var_peso", exact = TRUE) %||% "peso")[1]
  if (!nzchar(var_peso) || !(var_peso %in% names(data))) {
    pesos <- rep(1, nrow(data))
  } else {
    pesos <- suppressWarnings(as.numeric(data[[var_peso]]))
    pesos[!is.finite(pesos) | is.na(pesos) | pesos < 0] <- 0
  }

  cortes <- suppressWarnings(as.numeric(cortes))
  cortes <- cortes[is.finite(cortes) & !is.na(cortes)]
  if (length(cortes) < 2L) cortes <- c(70, 80)
  cortes <- sort(unique(cortes))[1:2]

  colores <- as.character(colores)
  nmc <- names(colores %||% character(0))
  if (is.null(nmc)) nmc <- character(0)
  color_rojo <- if ("rojo" %in% nmc) colores[["rojo"]] else if (length(colores) >= 1L) colores[1] else "#D84B55"
  color_ambar <- if ("ambar" %in% nmc) colores[["ambar"]] else if (length(colores) >= 2L) colores[2] else "#E0B44C"
  color_verde <- if ("verde" %in% nmc) colores[["verde"]] else if (length(colores) >= 3L) colores[3] else "#3A9A5B"

  score_tbl <- config_tbl |>
    dplyr::rowwise() |>
    dplyr::mutate(
      score_raw = {
        vv <- suppressWarnings(as.numeric(data[[.data$criterio_var]]))
        ok <- is.finite(vv) & !is.na(vv) & is.finite(pesos) & !is.na(pesos) & pesos > 0
        if (!any(ok)) NA_real_ else sum(vv[ok] * pesos[ok], na.rm = TRUE) / sum(pesos[ok], na.rm = TRUE)
      }
    ) |>
    dplyr::ungroup() |>
    dplyr::mutate(
      score_round = .dim_round_half_up(.data$score_raw, 0),
      label = dplyr::if_else(is.na(.data$score_raw), "", .dim_fmt_int(.data$score_round)),
      fill_hex = .dim_semaforo_color(
        x = .data$score_raw,
        cortes = cortes,
        colores = c(rojo = color_rojo, ambar = color_ambar, verde = color_verde),
        digits = 0L,
        na_color = na_color,
        modo = modo_semaforo,
        anclas_degradado = semaforo_anclas_degradado,
        gradiente_colores = semaforo_gradiente_colores,
        gradiente_valores = semaforo_gradiente_valores,
        gradiente_limites = semaforo_gradiente_limites
      )
    )

  legend_colors <- .dim_semaforo_color(
    x = c(cortes[1] - 5, mean(cortes), cortes[2] + 10),
    cortes = cortes,
    colores = c(rojo = color_rojo, ambar = color_ambar, verde = color_verde),
    digits = 0L,
    na_color = na_color,
    modo = modo_semaforo,
    anclas_degradado = semaforo_anclas_degradado,
    gradiente_colores = semaforo_gradiente_colores,
    gradiente_valores = semaforo_gradiente_valores,
    gradiente_limites = semaforo_gradiente_limites
  )
  legend_labels <- .dim_range_labels(cortes[1], cortes[2])

  panel_ids <- unique(as.character(score_tbl$conductor_id))
  paneles <- lapply(seq_along(panel_ids), function(i) {
    conductor_id_i <- panel_ids[[i]]
    df_i <- score_tbl |>
      dplyr::filter(.data$conductor_id == conductor_id_i) |>
      dplyr::arrange(.data$criterio_orden) |>
      dplyr::mutate(
        fila = dplyr::row_number(),
        fila_rev = dplyr::n() - .data$fila + 1L
      )

    n_filas <- nrow(df_i)
    x_label <- if (identical(alineacion_criterios, "centrado")) 1.2 else 0.12
    hjust_label <- if (identical(alineacion_criterios, "centrado")) 0.5 else 0

    base_plot <- ggplot2::ggplot() +
      ggplot2::geom_tile(
        data = df_i,
        ggplot2::aes(x = 3.15, y = .data$fila_rev, fill = .data$fill_hex),
        width = 1.05,
        height = 0.86,
        colour = "#F2F5F9",
        linewidth = 0.45
      ) +
      ggplot2::geom_text(
        data = df_i,
        ggplot2::aes(x = x_label, y = .data$fila_rev, label = .data$criterio_display),
        hjust = hjust_label,
        colour = color_texto,
        family = font_family,
        fontface = fontface_texto_criterio,
        size = size_texto_criterio,
        lineheight = 0.95
      ) +
      ggplot2::geom_text(
        data = df_i,
        ggplot2::aes(x = 3.15, y = .data$fila_rev, label = .data$label),
        colour = color_texto,
        family = font_family,
        fontface = "bold",
        size = size_texto_celda
      ) +
      ggplot2::scale_fill_identity() +
      ggplot2::scale_x_continuous(limits = c(0, 4.05), expand = c(0, 0)) +
      ggplot2::scale_y_continuous(limits = c(0.5, n_filas + 0.5), expand = c(0, 0)) +
      ggplot2::labs(x = NULL, y = NULL) +
      ggplot2::coord_cartesian(clip = "off") +
      ggplot2::theme_void(base_family = font_family) +
      ggplot2::theme(
        plot.margin = ggplot2::margin(t = 5, r = 14, b = 5, l = 8),
        panel.background = ggplot2::element_rect(fill = "transparent", colour = NA),
        plot.background = ggplot2::element_rect(fill = "transparent", colour = NA)
      )

    header_y <- 1 - header_h_conductor
    title_x <- 0.5
    icon_img <- NULL
    if (isTRUE(mostrar_icono_conductor)) {
      icon_path <- as.character(df_i$icono[[1]] %||% NA_character_)[1]
      if (!is.na(icon_path) && nzchar(trimws(icon_path))) {
        icon_img <- .dim_load_icon(icon_path, tint_color = color_texto)
      }
    }

    panel <- cowplot::ggdraw()
    if (isTRUE(mostrar_titulo_conductor)) {
      panel <- panel +
        cowplot::draw_grob(
          grid::roundrectGrob(
            gp = grid::gpar(fill = title_band_fill, col = title_band_col, lwd = 0.6),
            r = grid::unit(0.04, "snpc")
          ),
          x = 0.02, y = header_y, width = 0.96, height = header_h_conductor * 0.86
        )

      if (!is.null(icon_img)) {
        icon_w <- size_icono_conductor
        icon_h <- min(header_h_conductor * 0.5, size_icono_conductor)
        group_center_x <- 0.5
        group_total_w <- icon_w + gap_icono_titulo + 0.24
        icon_center_x <- group_center_x - group_total_w / 2 + icon_w / 2
        title_x <- icon_center_x + icon_w / 2 + gap_icono_titulo

        panel <- panel +
          cowplot::draw_grob(
            grid::rasterGrob(icon_img, interpolate = TRUE),
            x = icon_center_x,
            y = header_y + header_h_conductor * 0.21,
            width = icon_w,
            height = icon_h
          )
      }

      panel <- panel +
        cowplot::draw_label(
          label = as.character(df_i$conductor_label[[1]]),
          x = title_x,
          y = header_y + header_h_conductor * 0.42,
          hjust = if (!is.null(icon_img)) 0 else 0.5,
          vjust = 0.5,
          fontfamily = font_family,
          fontface = fontface_titulo_conductor,
          color = color_texto,
          size = size_titulo_conductor
        )
    }

    panel <- panel +
      cowplot::draw_plot(
        base_plot,
        x = 0,
        y = 0,
        width = 1,
        height = if (isTRUE(mostrar_titulo_conductor)) 1 - header_h_conductor - 0.01 else 1
      )

    if (i < length(panel_ids) && gutter_conductores > 0) {
      panel <- panel +
        cowplot::draw_grob(
          grid::rectGrob(gp = grid::gpar(fill = "#E8EDF2", col = NA)),
          x = 1 - gutter_conductores / 2,
          y = 0.06,
          width = min(0.01, gutter_conductores / 2),
          height = 0.88
        )
    }

    panel
  })

  p_panel <- cowplot::plot_grid(
    plotlist = paneles,
    nrow = 1,
    align = "h",
    axis = "tb",
    rel_widths = rep(1, length(paneles))
  )

  leyenda <- .dim_heat_legend_block(
    labels = legend_labels,
    colors = legend_colors,
    size = 9,
    colour = color_texto
  )

  canvas <- cowplot::plot_grid(
    p_panel,
    leyenda,
    ncol = 1,
    align = "v",
    rel_heights = c(1, 0.09)
  )

  meta_out <- list(
    config_tbl = config_tbl,
    score_tbl = score_tbl,
    alineacion_criterios = alineacion_criterios,
    mostrar_titulo_conductor = isTRUE(mostrar_titulo_conductor),
    mostrar_icono_conductor = isTRUE(mostrar_icono_conductor),
    size_texto_criterio = size_texto_criterio,
    size_titulo_conductor = size_titulo_conductor,
    fontface_texto_criterio = fontface_texto_criterio,
    fontface_titulo_conductor = fontface_titulo_conductor,
    size_icono_conductor = size_icono_conductor,
    gap_icono_titulo = gap_icono_titulo
  )

  canvas <- .dim_wrap_debug_canvas(
    canvas,
    debug_ph_bordes = debug_ph_bordes,
    debug_ph_col = debug_ph_col,
    debug_ph_lwd = debug_ph_lwd
  )
  attr(canvas, "dim_heatmap_criterios_meta") <- meta_out

  .dim_export_canvas(
    canvas,
    exportar = exportar,
    path_salida = path_salida,
    ancho = ancho,
    alto = alto,
    dpi = dpi,
    ppt_append = ppt_append,
    ppt_layout = ppt_layout,
    ppt_master = ppt_master
  )
}

#' Radar o barras de dimensiones en canvas
#'
#' Visualiza indices y bloques de dimensiones como radar (cuando hay 3+ ejes)
#' o barras numericas comparativas. Requiere que `data` sea la salida encadenada
#' de [reporte_dimensiones()] y [reporte_dimensiones_indices()].
#'
#' @param data Base recodificada e indexada; salida de
#'   `reporte_dimensiones() |> reporte_dimensiones_indices()`.
#' @param modo `"general"` (indices por subindices) o `"indicadores"` (subindices por item).
#' @param objetivo Id tecnico del catalogo (columna `idx_*` o clave de bloque).
#' @param instrumento Instrumento opcional. Si es `NULL`, se usa `attr(data, "instrumento_reporte")`.
#' @param cruce Variable de comparacion opcional (columna en `data`).
#' @param incluir_total Si es `NULL`, usa el default interno.
#' @param inicio_eje_pct Piso visual del eje radial en porcentaje (0-99). Si se
#'   define, se mapea internamente a `limites = c(inicio_eje_pct/100, 1)` y
#'   falla con error si hay valores observados por debajo de ese piso.
#' @param filtros Lista nombrada de filtros por variable.
#' @param iter_var,iter_level Variable y nivel opcionales de iteracion.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param icono_modo Modo de etiqueta por icono: \code{"reemplazar"} o
#'   \code{"acompanar"}.
#' @param icono_size_radar Escala relativa del icono en los ejes del radar.
#' @param icono_color_radar Color opcional para tintar iconos PNG del radar.
#' @param icono_color_leyenda_radar Color opcional para tintar iconos de la
#'   leyenda del radar. Si es \code{NULL}, conserva el color original del PNG.
#' @param mostrar_leyenda_iconos_radar Si \code{TRUE}, muestra la leyenda de
#'   iconos en radar cuando \code{icono_modo="reemplazar"}.
#' @param filtrar_ejes_incompletos Si \code{TRUE}, excluye ejes que tengan
#'   datos faltantes en alguno de los grupos comparados.
#' @param agregar_nota_ejes_incompletos Si \code{TRUE} y
#'   \code{filtrar_ejes_incompletos = TRUE}, agrega una nota con los ejes
#'   excluidos y los grupos que si tenian dato.
#' @param ... Argumentos adicionales para `graficar_radar()` o `graficar_barras_numericas()`.
#'
#' @return Objeto grafico (canvas cowplot) o exportacion invisible.
#' @family graficador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_indices()],
#'   [reporte_dimensiones_config()], [graficar_heatmap_dimensiones()]
#' @export
graficar_radar_dimensiones <- function(
    data,
    modo = c("general", "indicadores"),
    objetivo,
    instrumento = NULL,
    cruce = NULL,
    incluir_total = NULL,
    radar_min_ejes = NULL,
    inicio_eje_pct = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    icono_modo = c("reemplazar", "acompanar"),
    icono_size_radar = 0.12,
    icono_color_radar = NULL,
    icono_color_leyenda_radar = NULL,
    mostrar_leyenda_iconos_radar = TRUE,
    filtrar_ejes_incompletos = TRUE,
    agregar_nota_ejes_incompletos = TRUE,
    ...
) {
  icono_modo <- match.arg(icono_modo)
  icono_size_radar <- suppressWarnings(as.numeric(icono_size_radar)[1])
  if (!is.finite(icono_size_radar) || is.na(icono_size_radar) || icono_size_radar <= 0) {
    stop("`icono_size_radar` debe ser numerico positivo.", call. = FALSE)
  }
  icono_color_radar <- .dim_normalize_optional_color(icono_color_radar, arg_name = "icono_color_radar")
  icono_color_leyenda_radar <- .dim_normalize_optional_color(
    icono_color_leyenda_radar,
    arg_name = "icono_color_leyenda_radar"
  )
  mostrar_leyenda_iconos_radar <- isTRUE(mostrar_leyenda_iconos_radar)
  filtrar_ejes_incompletos <- isTRUE(filtrar_ejes_incompletos)
  agregar_nota_ejes_incompletos <- isTRUE(agregar_nota_ejes_incompletos)
  modo <- match.arg(modo)
  ctx <- .dim_build_context(data, instrumento = instrumento)
  payload <- .dim_build_payload(
    ctx,
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level
  )

  # --- Filtro de ejes comunes -----------------------------------------------
  # Si algun cruce no tiene dato en una dimension (score_raw = NA), se excluye
  # esa dimension del payload. Se auto-genera una nota al pie por eje excluido
  # indicando que cruces si tienen dato.
  if (isTRUE(filtrar_ejes_incompletos) && nrow(payload$score_plot)) {
    sc_plot <- payload$score_plot

    ejes_sin_dato <- sc_plot |>
      dplyr::filter(is.na(.data$score_raw)) |>
      dplyr::pull(.data$axis_label) |>
      unique()

    if (length(ejes_sin_dato) > 0) {
      notas_filtro <- vapply(ejes_sin_dato, function(ej) {
        gps_con_dato <- sc_plot |>
          dplyr::filter(.data$axis_label == ej, !is.na(.data$score_raw)) |>
          dplyr::pull(.data$grupo) |>
          unique()
        if (length(gps_con_dato) == 0) {
          paste0("En ", ej, " no hay dato disponible")
        } else {
          paste0("En ", ej, " dato disponible solo para ",
                 paste(gps_con_dato, collapse = ", "))
        }
      }, character(1))

      if (isTRUE(agregar_nota_ejes_incompletos)) {
        nota_filtro_str <- paste(notas_filtro, collapse = "\n")
        nota_pie <- if (!is.null(nota_pie) && nzchar(nota_pie %||% "")) {
          paste(nota_pie, nota_filtro_str, sep = "\n")
        } else {
          nota_filtro_str
        }
      }

      ejes_comunes_labels <- setdiff(
        unique(as.character(payload$axis_order_plot)),
        ejes_sin_dato
      )
      payload$score_plot      <- sc_plot[!(sc_plot$axis_label %in% ejes_sin_dato), , drop = FALSE]
      payload$axis_order_plot <- ejes_comunes_labels
    }
  }
  # --------------------------------------------------------------------------

  radar_min_ejes_use <- suppressWarnings(as.integer(radar_min_ejes)[1])
  if (!is.finite(radar_min_ejes_use) || is.na(radar_min_ejes_use) || radar_min_ejes_use < 1L) {
    radar_min_ejes_use <- payload$radar_min_ejes %||% ctx$radar_min_ejes %||% 3L
  }
  n_ejes_plot <- length(unique(as.character(payload$axis_order_plot %||% character(0))))
  extra_args <- list(...)
  extra_args <- .dim_alias_radar_extra_args(extra_args)
  nota_pie_externa <- isTRUE(extra_args$nota_pie_externa %||% FALSE)
  extra_args$nota_pie_externa <- NULL
  visual_mode_pref <- .dim_normalize_visual_mode(extra_args$visual_mode %||% NULL, default = "auto")
  extra_args$visual_mode <- NULL
  visual_mode_auto <- if (n_ejes_plot >= radar_min_ejes_use) "radar" else "barras"
  payload$visual_mode <- if (identical(visual_mode_pref, "auto")) visual_mode_auto else visual_mode_pref
  payload$radar_min_ejes <- radar_min_ejes_use

  if (!nrow(payload$score_plot)) {
    blank <- .dim_blank_canvas("Sin datos para mostrar")
    return(.dim_export_canvas(
      blank,
      exportar = extra_args$exportar %||% "rplot",
      path_salida = extra_args$path_salida %||% NULL,
      ancho = extra_args$ancho %||% 8.5,
      alto = extra_args$alto %||% 6.0,
      dpi = extra_args$dpi %||% 300,
      ppt_append = extra_args$ppt_append %||% TRUE,
      ppt_layout = extra_args$ppt_layout %||% "Blank",
      ppt_master = extra_args$ppt_master %||% "Office Theme"
    ))
  }

  if (identical(payload$visual_mode, "barras_chip_total")) {
    args_total_chip <- c(
      list(
        payload = payload,
        titulo = titulo,
        subtitulo = subtitulo,
        nota_pie = nota_pie,
        note_outside = nota_pie_externa
      ),
      extra_args
    )
    return(do.call(.dim_plot_total_cruce_barras_chip, args_total_chip))
  }

  if (identical(payload$visual_mode, "barras_chip_ejes")) {
    args_axis_chip <- c(
      list(
        payload = payload,
        titulo = titulo,
        subtitulo = subtitulo,
        nota_pie = nota_pie,
        note_outside = nota_pie_externa
      ),
      extra_args
    )
    return(do.call(.dim_plot_axis_total_barras_chip, args_axis_chip))
  }

  if (identical(payload$visual_mode, "radar")) {
    if (!exists("graficar_radar", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_radar()`.", call. = FALSE)
    }

    df_plot <- .dim_payload_to_plot_df(payload)
    inicio_eje_pct <- .dim_or(inicio_eje_pct, extra_args$inicio_eje_pct)
    if (!is.null(inicio_eje_pct)) {
      inicio_eje_pct <- suppressWarnings(as.numeric(inicio_eje_pct)[1])
      if (!is.finite(inicio_eje_pct) || inicio_eje_pct < 0 || inicio_eje_pct >= 100) {
        stop("`inicio_eje_pct` debe ser NULL o un numero en [0, 100).", call. = FALSE)
      }
      vals <- suppressWarnings(as.numeric(df_plot$valor))
      vals <- vals[is.finite(vals) & !is.na(vals)]
      if (length(vals)) {
        min_obs <- suppressWarnings(min(vals, na.rm = TRUE))
        if (is.finite(min_obs) && min_obs < inicio_eje_pct) {
          stop(
            "`inicio_eje_pct`=", format(inicio_eje_pct, trim = TRUE),
            " no es valido: el minimo observado es ",
            format(round(min_obs, 1), trim = TRUE),
            ". Ajuste el piso o revise los datos.",
            call. = FALSE
          )
        }
      }
      if (is.null(extra_args$limites)) {
        extra_args$limites <- c(inicio_eje_pct / 100, 1)
      }
    }
    note_outside_txt <- nota_pie
    base_args <- list(
      data = df_plot,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      colores_series = payload$group_colors,
      titulo = titulo,
      subtitulo = subtitulo,
      nota_pie = if (isTRUE(nota_pie_externa)) NULL else nota_pie,
      axis_iconos = payload$axis_iconos %||% NULL,
      icono_modo = icono_modo,
      icono_size_radar = icono_size_radar,
      icono_color_radar = icono_color_radar,
      icono_color_leyenda_radar = icono_color_leyenda_radar,
      mostrar_leyenda_iconos = mostrar_leyenda_iconos_radar,
      usar_canvas = TRUE,
      mostrar_radios = FALSE,
      mostrar_niveles = FALSE,
      color_grilla = "#D9E1EA",
      color_radios = "#E4EAF1",
      cortes_grilla = 4,
      wrap_ejes = 22,
      eje_label_mult = 1.03,
      leyenda_posicion = "abajo",
      legend_n_por_fila = 4,
      legend_key_cm = 0.45,
      legend_espaciado = 12,
      canvas_h_header_in = 0.58,
      canvas_h_legend_in = 0.20,
      canvas_h_caption_in = 0.08
    )

    args <- .merge_args(base_args, extra_args)
    if (isTRUE(nota_pie_externa)) {
      # Blindaje: un `nota_pie` que venga desde presets/overrides no debe
      # reingresar al grafico cuando la nota ya se externalizo.
      args$nota_pie <- NULL
      args$canvas_h_caption_in <- 0
    }
    args <- .keep_formals(graficar_radar, args)
    out <- suppressWarnings(do.call(graficar_radar, args))
    if (isTRUE(nota_pie_externa) && !is.null(note_outside_txt) && nzchar(trimws(note_outside_txt))) {
      attr(out, "note_outside") <- trimws(as.character(note_outside_txt)[1])
    }
    return(out)
  }

  if (!exists("graficar_barras_numericas", mode = "function", inherits = TRUE)) {
    stop("No existe `graficar_barras_numericas()`.", call. = FALSE)
  }

  wide <- .dim_payload_to_numeric_wide(payload)
  base_args <- list(
    data = wide$data,
    var_categoria = "categoria",
    vars_valor = wide$vars_valor,
    etiquetas_series = wide$etiquetas_series,
    orientacion = "horizontal",
    formato_valor = "numero",
    decimales = 0,
    colores_series = payload$group_colors,
    mostrar_n_sobre_barras = FALSE,
    titulo = titulo,
    subtitulo = subtitulo,
    nota_pie = if (isTRUE(nota_pie_externa)) NULL else nota_pie,
    usar_canvas = TRUE
  )

  args <- .merge_args(base_args, extra_args)
  if (isTRUE(nota_pie_externa)) {
    args$nota_pie <- NULL
  }
  args <- .keep_formals(graficar_barras_numericas, args)
  out <- suppressWarnings(do.call(graficar_barras_numericas, args))
  if (isTRUE(nota_pie_externa) && !is.null(nota_pie) && nzchar(trimws(nota_pie))) {
    attr(out, "note_outside") <- trimws(as.character(nota_pie)[1])
  }
  out
}

#' @title Comparativo de dimensiones con radar o barras
#' @family graficador
#' @export
graficar_comparativo_radarbar_dimensiones <- function(
    data,
    modo = c("general", "indicadores"),
    objetivo,
    instrumento = NULL,
    cruce = NULL,
    incluir_total = FALSE,
    radar_min_ejes = 5L,
    inicio_eje_pct = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    icono_modo = c("reemplazar", "acompanar"),
    icono_size_radar = 0.12,
    icono_color_radar = NULL,
    icono_color_leyenda_radar = NULL,
    mostrar_leyenda_iconos_radar = TRUE,
    ...
) {
  graficar_radar_dimensiones(
    data = data,
    modo = modo,
    objetivo = objetivo,
    instrumento = instrumento,
    cruce = cruce,
    incluir_total = incluir_total,
    radar_min_ejes = radar_min_ejes,
    inicio_eje_pct = inicio_eje_pct,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level,
    titulo = titulo,
    subtitulo = subtitulo,
    nota_pie = nota_pie,
    icono_modo = icono_modo,
    icono_size_radar = icono_size_radar,
    icono_color_radar = icono_color_radar,
    icono_color_leyenda_radar = icono_color_leyenda_radar,
    mostrar_leyenda_iconos_radar = mostrar_leyenda_iconos_radar,
    ...
  )
}

#' Radar + tabla de dimensiones en canvas
#'
#' Visualiza indices y bloques de dimensiones como radar o barras, con una
#' tabla adjunta de valores numericos. Requiere que `data` sea la salida
#' encadenada de [reporte_dimensiones()] y [reporte_dimensiones_indices()].
#'
#' @param data Base recodificada e indexada; salida de
#'   `reporte_dimensiones() |> reporte_dimensiones_indices()`.
#' @param modo `"general"` (indices por subindices) o `"indicadores"` (subindices por item).
#' @param objetivo Id tecnico del catalogo (columna `idx_*` o clave de bloque).
#' @param instrumento Instrumento opcional. Si es `NULL`, se usa `attr(data, "instrumento_reporte")`.
#' @param cruce Variable de comparacion opcional (columna en `data`).
#' @param incluir_total Si es `NULL`, usa el default interno.
#' @param filtros Lista nombrada de filtros por variable.
#' @param iter_var,iter_level Variable y nivel opcionales de iteracion.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param titulo_tabla Titulo de la primera columna de la tabla adjunta.
#' @param ... Argumentos adicionales del radar, barras y tabla.
#'
#' @return Objeto grafico (canvas cowplot) o exportacion invisible.
#' @family graficador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_indices()],
#'   [reporte_dimensiones_config()], [graficar_heatmap_dimensiones()]
#' @export
graficar_radar_tabla_dimensiones <- function(
    data,
    modo = c("general", "indicadores"),
    objetivo,
    instrumento = NULL,
    cruce = NULL,
    incluir_total = NULL,
    filtros = list(),
    iter_var = NULL,
    iter_level = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    titulo_tabla = "TOP TWO BOX",
    ...
) {
  modo <- match.arg(modo)
  ctx <- .dim_build_context(data, instrumento = instrumento)
  payload <- .dim_build_payload(
    ctx,
    modo = modo,
    objetivo = objetivo,
    cruce = cruce,
    incluir_total = incluir_total,
    filtros = filtros,
    iter_var = iter_var,
    iter_level = iter_level
  )

  extra_args <- list(...)
  extra_args <- .dim_alias_radar_extra_args(extra_args)

  if (!nrow(payload$score_plot)) {
    blank <- .dim_blank_canvas("Sin datos para mostrar")
    return(.dim_export_canvas(
      blank,
      exportar = extra_args$exportar %||% "rplot",
      path_salida = extra_args$path_salida %||% NULL,
      ancho = extra_args$ancho %||% 8.5,
      alto = extra_args$alto %||% 6.0,
      dpi = extra_args$dpi %||% 300,
      ppt_append = extra_args$ppt_append %||% TRUE,
      ppt_layout = extra_args$ppt_layout %||% "Blank",
      ppt_master = extra_args$ppt_master %||% "Office Theme"
    ))
  }

  if (identical(payload$visual_mode, "radar")) {
    if (!exists("graficar_radar", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_radar()`.", call. = FALSE)
    }

    df_plot <- .dim_payload_to_plot_df(payload)
    base_args <- list(
      data = df_plot,
      var_eje = "eje",
      var_grupo = "grupo",
      var_valor = "valor",
      escala_valor = "proporcion_100",
      colores_series = payload$group_colors,
      titulo = titulo,
      subtitulo = subtitulo,
      nota_pie = nota_pie,
      usar_canvas = TRUE,
      mostrar_radios = FALSE,
      mostrar_niveles = FALSE,
      mostrar_tabla_derecha = TRUE,
      titulo_tabla = titulo_tabla
    )

    args <- .merge_args(base_args, extra_args)
    args <- .keep_formals(graficar_radar, args)
    return(suppressWarnings(do.call(graficar_radar, args)))
  }

  if (!exists("graficar_barras_numericas", mode = "function", inherits = TRUE)) {
    stop("No existe `graficar_barras_numericas()`.", call. = FALSE)
  }

  wide <- .dim_payload_to_numeric_wide(payload)
  args_bars <- .merge_args(
    list(
      data = wide$data,
      var_categoria = "categoria",
      vars_valor = wide$vars_valor,
      etiquetas_series = wide$etiquetas_series,
      orientacion = "horizontal",
      formato_valor = "numero",
      decimales = 0,
      colores_series = payload$group_colors,
      mostrar_n_sobre_barras = FALSE,
      titulo = titulo,
      subtitulo = subtitulo,
      nota_pie = NULL,
      usar_canvas = TRUE,
      exportar = "rplot"
    ),
    extra_args
  )
  args_bars <- .keep_formals(graficar_barras_numericas, args_bars)
  p_bars <- suppressWarnings(do.call(graficar_barras_numericas, args_bars))

  tb <- .dim_make_table_df(
    payload,
    titulo_left = titulo_tabla,
    digits = extra_args$tabla_digits %||% 0L
  )
  tg <- .dim_make_table_grob(
    tb,
    header_fill = extra_args$tabla_header_fill %||% "#062A63",
    body_fill = extra_args$tabla_body_fill %||% "#F2F2F2",
    grid_col = extra_args$tabla_grid_col %||% "white",
    text_blue = extra_args$tabla_text_blue %||% "#062A63",
    font_family = extra_args$tabla_font_family %||% "Arial",
    header_size = extra_args$tabla_header_size %||% 8,
    body_size = extra_args$tabla_body_size %||% 7,
    firstcol_bold = extra_args$tabla_firstcol_bold %||% TRUE,
    highlight_threshold = extra_args$umbral_rojo_pct %||% 50,
    padding_mm = extra_args$tabla_padding_mm %||% 3,
    firstcol_frac = extra_args$tabla_firstcol_frac %||% 0.55,
    wrap_header = extra_args$tabla_wrap_header %||% 14
  )

  canvas <- .dim_compose_plot_table_canvas(
    p_bars,
    tg,
    tabla_ph_ancho = extra_args$tabla_ph_ancho %||% 0.40,
    tabla_ph_gap = extra_args$tabla_ph_gap %||% 0.03,
    tabla_auto_fit = extra_args$tabla_auto_fit %||% FALSE,
    tabla_fit_pad = extra_args$tabla_fit_pad %||% 0.98,
    tabla_allow_upscale = extra_args$tabla_allow_upscale %||% FALSE,
    debug_ph_bordes = extra_args$debug_ph_bordes %||% FALSE,
    debug_ph_col = extra_args$debug_ph_col %||% "#FF00FF",
    debug_ph_lwd = extra_args$debug_ph_lwd %||% 0.6
  )

  if (!is.null(nota_pie) && nzchar(nota_pie)) {
    canvas <- cowplot::plot_grid(
      canvas,
      cowplot::ggdraw() +
        cowplot::draw_label(
          label = nota_pie,
          x = 1, y = 0.5,
          hjust = 1, vjust = 0.5,
          size = extra_args$size_nota_pie %||% 8,
          colour = extra_args$color_nota_pie %||% "#004B8D"
        ),
      ncol = 1,
      rel_heights = c(1, 0.08)
    )
  }

  if (identical(extra_args$exportar %||% "rplot", "rplot")) return(canvas)
  .dim_export_canvas(
    canvas,
    exportar = extra_args$exportar %||% "rplot",
    path_salida = extra_args$path_salida %||% NULL,
    ancho = extra_args$ancho %||% 8.5,
    alto = extra_args$alto %||% 6.0,
    dpi = extra_args$dpi %||% 300,
    ppt_append = extra_args$ppt_append %||% TRUE,
    ppt_layout = extra_args$ppt_layout %||% "Blank",
    ppt_master = extra_args$ppt_master %||% "Office Theme"
  )
}

# =============================================================================
# FODA dimensiones
# =============================================================================

#' Matriz FODA automatica de dimensiones
#'
#' Clasifica indicadores o subindices en una matriz 2x2 FODA (Fortalezas,
#' Oportunidades, Debilidades, Amenazas) basandose en dos ejes derivados de
#' los datos: el puntaje promedio (0-100) y la variabilidad (desviacion
#' estandar) entre respondentes.
#'
#' La clasificacion es automatica:
#' \itemize{
#'   \item \strong{Fortaleza}: puntaje alto + SD baja (consolidado y fuerte).
#'   \item \strong{Oportunidad}: puntaje alto + SD alta (fuerte pero desigual).
#'   \item \strong{Debilidad}: puntaje bajo + SD baja (rezago estructural).
#'   \item \strong{Amenaza}: puntaje bajo + SD alta (rezago con alta dispersion).
#' }
#'
#' @param data Base recodificada e indexada; salida de
#'   \code{reporte_dimensiones() |> reporte_dimensiones_indices()}.
#' @param nivel \code{"subindices"} para clasificar columnas \verb{sub_*},
#'   o \code{"indicadores"} para clasificar columnas \verb{r100_*} de un bloque.
#' @param objetivo Para \code{nivel = "indicadores"}: clave del bloque en el
#'   catalogo de indicadores. Para \code{nivel = "subindices"} es opcional (si
#'   se provee, usa solo los axis_vars de ese indice).
#' @param modo_foda Modo de visualizacion: \code{"matriz"} (cuadrantes con
#'   tarjetas) o \code{"dispersion"} (scatter con coordenadas reales).
#' @param instrumento Instrumento opcional. Si es \code{NULL}, se usa
#'   \code{attr(data, "instrumento_reporte")}.
#' @param cruce Variable opcional de cruce. Solo se aplica cuando
#'   \code{modo_foda = "dispersion"}.
#' @param incluir_total Si \code{TRUE}, agrega el grupo total en modo
#'   dispersion combinada con cruce.
#' @param solo_indice_general_cruce Reservado para compatibilidad. En
#'   \code{nivel = "subindices"} con \code{modo_foda = "dispersion"} no se usa
#'   para evitar reemplazar el desglose por cruce.
#' @param filtros Lista nombrada de filtros por variable.
#' @param usar_pesos Si \code{TRUE} y existe columna de peso, calcula media y
#'   SD ponderadas para clasificar cuadrantes.
#' @param corte_score Corte de puntaje para clasificar alto/bajo. Si es
#'   \code{NULL}, usa \code{semaforo$cortes[2]} (default 80), salvo en
#'   \code{modo_foda = "dispersion"} donde es obligatorio.
#' @param corte_sd Corte de SD para clasificar variabilidad alta/baja. Si es
#'   \code{NULL}, usa la mediana de las SDs calculadas.
#' @param colores_foda Vector nombrado de 4 colores de fondo para los
#'   cuadrantes (\code{fortaleza}, \code{oportunidad}, \code{debilidad},
#'   \code{amenaza}).
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param color_titulo,size_titulo Estilo del titulo.
#' @param color_subtitulo,size_subtitulo Estilo del subtitulo.
#' @param color_nota_pie,size_nota_pie Estilo del pie de pagina.
#' @param color_cuadrante_titulo,size_cuadrante_titulo Estilo de los titulos
#'   de cuadrante (FORTALEZAS, OPORTUNIDADES, etc.).
#' @param titulos_areas_foda Vector nombrado con los titulos por cuadrante
#'   (\code{fortaleza}, \code{oportunidad}, \code{debilidad}, \code{amenaza}).
#'   Si se omite, usa los titulos tradicionales por defecto.
#' @param mostrar_subtitulo_area Si \code{TRUE}, muestra el subtitulo
#'   descriptivo dentro de cada area del FODA.
#' @param sd_tecnico Si \code{TRUE}, muestra el corte tecnico de SD y eje X
#'   numerico. Si \code{FALSE}, oculta el corte SD y usa extremos narrativos
#'   en X (\code{"Menor dispersion"} / \code{"Mayor dispersion"}).
#' @param color_indice_total Color de la tarjeta del \code{"Indice"} total
#'   global en modo dispersion con cruce.
#' @param disposicion_recuadro Disposicion del texto en tarjetas de dispersion
#'   con cruce: \code{"dos_lineas"} (\code{subindice} arriba y \code{cruce}
#'   abajo), \code{"una_linea"} (ambos en una linea) o \code{"sin_cruce"}
#'   (solo subindice). El \code{Indice} total global siempre se muestra en una
#'   sola linea con su nombre agregado.
#' @param etiqueta_cruce_en_dos_lineas Alias legado opcional para
#'   compatibilidad. Si se define, \code{TRUE} equivale a
#'   \code{disposicion_recuadro = "dos_lineas"} y \code{FALSE} a
#'   \code{"una_linea"}.
#' @param color_items,size_items Estilo de los items dentro de cada cuadrante.
#' @param ancho_tarjeta_base_rel Ancho base relativo de tarjetas.
#' @param factor_ancho_matriz Multiplicador del ancho de tarjeta para modo
#'   \code{"matriz"}.
#' @param factor_ancho_dispersion Multiplicador del ancho de tarjeta para modo
#'   \code{"dispersion"}.
#' @param ancho_recuadro_rel Ajuste relativo opcional del ancho de recuadro
#'   respecto al calculo automatico (\code{1 = automatico}).
#' @param ancho_recuadro_auto Si \code{TRUE}, ajusta automaticamente el ancho
#'   de cada recuadro segun su contenido para reducir espacio sobrante entre
#'   texto y chip.
#' @param ancho_chip_rel Ancho relativo del chip de puntaje dentro del recuadro.
#'   Se acota internamente para preservar legibilidad.
#' @param sufijo_puntaje Sufijo del puntaje mostrado en el chip (por ejemplo
#'   \code{" pts"}).
#' @param cortes_chip Cortes del semaforo para los chips de puntaje
#'   (vector numerico de longitud 2). Si es \code{NULL}, usa
#'   \code{c(semaforo$cortes[1], corte_score)} para mantener consistencia con
#'   el corte principal de puntaje.
#' @param modo_semaforo Modo del semaforo para chips y heatmap asociado:
#'   \code{"grupos"} mantiene la clasificacion discreta actual y
#'   \code{"degradado"} interpola colores alrededor de los cortes de referencia.
#' @param tamano_texto_tarjeta Tamano base del texto del subindice dentro de la
#'   tarjeta.
#' @param tamano_letra_recuadro Alias opcional en espanol para
#'   \code{tamano_texto_tarjeta}. Si se define, tiene prioridad.
#' @param tamano_texto_chip Tamano base del texto del chip de puntaje.
#' @param tarjetas_color_solido Si \code{TRUE}, aplica color solido a las
#'   tarjetas segun cuadrante FODA y texto blanco.
#' @param jitter_x_rel Intensidad relativa del jitter horizontal en dispersion.
#' @param jitter_y_rel Intensidad relativa del jitter vertical en dispersion.
#' @param iter_separacion Numero de iteraciones de separacion para reducir
#'   solapes de tarjetas en dispersion.
#' @param factor_reduccion_tarjeta_dispersion Factor de reduccion de tamano de
#'   tarjetas en modo dispersion.
#' @param icono_modo Modo de uso de iconos cuando existen rutas de PNG:
#'   \code{"reemplazar"} oculta texto y deja icono; \code{"acompanar"}
#'   conserva texto + icono.
#' @param icono_size_foda Escala relativa de iconos en FODA (matriz y
#'   dispersion).
#' @param icono_color_foda Color opcional para tintar los iconos PNG del FODA.
#' @param icono_color_leyenda_foda Color opcional para tintar iconos de la
#'   leyenda FODA. Si es \code{NULL}, mantiene el color original del PNG.
#' @param distancia_icono_chip_foda Separacion vertical relativa entre icono y
#'   chip en burbuja (proporcion del radio de la burbuja).
#' @param distancia_minima_icono_chip_foda Separacion vertical minima absoluta
#'   entre icono y chip en burbuja.
#' @param padding_chip_foda Escala relativa del padding interno del chip.
#'   Afecta ancho y alto efectivo del chip.
#' @param padding_texto_chip_foda Aire interno del texto del chip en burbuja.
#'   Se usa para ampliar el tamano util del chip alrededor del numero.
#' @param separacion_chip_icono_rel_foda,separacion_chip_icono_min_foda,
#'   padding_chip_rel_foda,padding_chip_label_lineas_foda Alias legados de
#'   compatibilidad para los parametros anteriores.
#' @param forma_bloque_dispersion Forma de bloque en \code{modo_foda="dispersion"}:
#'   \code{"rectangular"} (tarjeta) o \code{"burbuja"} (circulo).
#' @param radio_burbuja_rel Escala relativa del radio de burbujas en
#'   \code{modo_foda="dispersion"} cuando \code{forma_bloque_dispersion="burbuja"}.
#'   \code{1} conserva el tamano por defecto.
#' @param colorear_fondo_foda Si \code{TRUE}, muestra color de fondo en los
#'   cuadrantes FODA. Si \code{FALSE}, los cuadrantes quedan sin relleno
#'   (solo bordes y lineas de referencia).
#' @param color_fondo Color de fondo del grafico.
#' @param mostrar_leyenda Si \code{TRUE}, muestra leyenda explicativa.
#' @param mostrar_leyenda_iconos Si \code{TRUE}, muestra el bloque de leyenda
#'   de iconos cuando \code{icono_modo="reemplazar"}.
#' @param usar_canvas Si \code{TRUE}, compone con \code{cowplot}
#'   (titulo/panel/leyenda/pie).
#' @param canvas_h_title,canvas_h_legend,canvas_h_caption,canvas_pad_top
#'   Proporciones de altura del canvas.
#' @param debug_ph_bordes,debug_ph_col,debug_ph_lwd Bordes de depuracion.
#' @param exportar Tipo de exportacion: \code{"rplot"}, \code{"png"},
#'   \code{"ppt"} o \code{"word"}.
#' @param path_salida Ruta de salida para \code{exportar != "rplot"}.
#' @param ancho,alto,dpi Tamano y resolucion de exportacion.
#' @param ppt_append,ppt_layout,ppt_master Parametros de exportacion PPT.
#'
#' @return Objeto grafico (canvas cowplot) o exportacion invisible.
#' @family indicador
#' @family graficador
#' @seealso [reporte_dimensiones()], [reporte_dimensiones_indices()],
#'   [reporte_dimensiones_config()], [graficar_heatmap_dimensiones()],
#'   [graficar_radar_dimensiones()]
#' @export
graficar_foda_dimensiones <- function(
    data,
    nivel = c("subindices", "indicadores"),
    objetivo = NULL,
    modo_foda = c("matriz", "dispersion"),
    instrumento = NULL,
    cruce = NULL,
    incluir_total = TRUE,
    solo_indice_general_cruce = FALSE,
    filtros = list(),
    usar_pesos = TRUE,
    corte_score = NULL,
    corte_sd = NULL,
    colores_foda = c(
      fortaleza = "#E8F5E9", oportunidad = "#E3F2FD",
      debilidad = "#FFEBEE", amenaza = "#FFF3E0"
    ),
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    color_titulo = "#004B8D",
    size_titulo = 12,
    color_subtitulo = "#004B8D",
    size_subtitulo = 9,
    color_nota_pie = "#004B8D",
    size_nota_pie = 8,
    color_cuadrante_titulo = "#20324d",
    size_cuadrante_titulo = 11,
    color_items = "#122842",
    size_items = 9,
    titulos_areas_foda = c(
      fortaleza = "FORTALEZAS",
      oportunidad = "OPORTUNIDADES",
      debilidad = "DEBILIDADES",
      amenaza = "AMENAZAS"
    ),
    mostrar_subtitulo_area = TRUE,
    sd_tecnico = TRUE,
    color_indice_total = "#FF6A00",
    disposicion_recuadro = c("dos_lineas", "una_linea", "sin_cruce"),
    etiqueta_cruce_en_dos_lineas = NULL,
    ancho_tarjeta_base_rel = 0.72,
    factor_ancho_matriz = 1.00,
    factor_ancho_dispersion = 0.72,
    ancho_recuadro_rel = NULL,
    ancho_recuadro_auto = FALSE,
    ancho_chip_rel = 0.18,
    chip_texto_color = "#000000",
    sufijo_puntaje = " pts",
    cortes_chip = NULL,
    modo_semaforo = NULL,
    tamano_texto_tarjeta = NULL,
    tamano_letra_recuadro = NULL,
    tamano_texto_chip = NULL,
    tarjetas_color_solido = TRUE,
    jitter_x_rel = 0.06,
    jitter_y_rel = 0.03,
    iter_separacion = 12L,
    factor_reduccion_tarjeta_dispersion = 0.85,
    chip_width_rel = NULL,
    score_suffix = NULL,
    icono_size_foda = 1,
    icono_size_leyenda_foda = NULL,
    icono_color_foda = NULL,
    icono_color_leyenda_foda = NULL,
    distancia_icono_chip_foda = 0.14,
    distancia_minima_icono_chip_foda = 0.006,
    padding_chip_foda = 1,
    padding_texto_chip_foda = 0.08,
    separacion_chip_icono_rel_foda = NULL,
    separacion_chip_icono_min_foda = NULL,
    padding_chip_rel_foda = NULL,
    padding_chip_label_lineas_foda = NULL,
    forma_bloque_dispersion = c("rectangular", "burbuja"),
    radio_burbuja_rel = 1,
    score_max_disp = 110,
    colorear_fondo_foda = TRUE,
    color_fondo = NA,
    mostrar_leyenda = TRUE,
    mostrar_leyenda_iconos = TRUE,
    usar_canvas = TRUE,
    canvas_h_title = 0,
    canvas_h_legend = 0.09,
    canvas_h_caption = 0.06,
    canvas_pad_top = 0.01,
    icono_modo = c("reemplazar", "acompanar"),
    debug_ph_bordes = FALSE,
    debug_ph_col = "#FF00FF",
    debug_ph_lwd = 0.6,
    exportar = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho = 10,
    alto = 7,
    dpi = 300,
    ppt_append = TRUE,
    ppt_layout = "Blank",
    ppt_master = "Office Theme"
) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Requiere cowplot.", call. = FALSE)

  nivel    <- match.arg(nivel)
  modo_foda <- match.arg(modo_foda)
  icono_modo <- match.arg(icono_modo)
  forma_bloque_dispersion <- match.arg(forma_bloque_dispersion)
  exportar <- match.arg(exportar)
  usar_pesos <- isTRUE(usar_pesos)
  incluir_total <- isTRUE(incluir_total)
  mostrar_subtitulo_area <- isTRUE(mostrar_subtitulo_area)
  sd_tecnico <- isTRUE(sd_tecnico)
  mostrar_leyenda_iconos <- isTRUE(mostrar_leyenda_iconos)
  icono_color_foda <- .dim_normalize_optional_color(icono_color_foda, arg_name = "icono_color_foda")
  icono_color_leyenda_foda <- .dim_normalize_optional_color(
    icono_color_leyenda_foda,
    arg_name = "icono_color_leyenda_foda"
  )
  if (!is.null(etiqueta_cruce_en_dos_lineas)) {
    if (!is.logical(etiqueta_cruce_en_dos_lineas) || length(etiqueta_cruce_en_dos_lineas) != 1L || is.na(etiqueta_cruce_en_dos_lineas)) {
      stop("`etiqueta_cruce_en_dos_lineas` debe ser NULL o logical(1).", call. = FALSE)
    }
    disposicion_recuadro <- if (isTRUE(etiqueta_cruce_en_dos_lineas)) "dos_lineas" else "una_linea"
  }
  disposicion_recuadro <- as.character(disposicion_recuadro %||% "dos_lineas")[1]
  if (!nzchar(disposicion_recuadro) || is.na(disposicion_recuadro)) disposicion_recuadro <- "dos_lineas"
  disposicion_recuadro <- match.arg(disposicion_recuadro, c("dos_lineas", "una_linea", "sin_cruce"))
  cruce <- as.character(cruce %||% "")[1]
  color_indice_total <- as.character(color_indice_total %||% "#FF6A00")[1]
  if (!nzchar(trimws(color_indice_total)) || is.na(color_indice_total)) color_indice_total <- "#FF6A00"
  if (inherits(try(grDevices::col2rgb(color_indice_total), silent = TRUE), "try-error")) color_indice_total <- "#FF6A00"

  titulos_default <- c(
    fortaleza = "FORTALEZAS",
    oportunidad = "OPORTUNIDADES",
    debilidad = "DEBILIDADES",
    amenaza = "AMENAZAS"
  )
  titulos_in <- as.character(titulos_areas_foda)
  titulos_out <- titulos_default
  if (length(titulos_in)) {
    nms_t <- names(titulos_areas_foda %||% character(0))
    if (is.null(nms_t)) nms_t <- character(0)
    if (!length(nms_t) || !any(nzchar(trimws(nms_t)))) {
      n_take <- min(length(titulos_default), length(titulos_in))
      if (n_take > 0L) titulos_out[seq_len(n_take)] <- titulos_in[seq_len(n_take)]
    } else {
      nms_t <- tolower(trimws(as.character(nms_t)))
      for (k in names(titulos_default)) {
        hit <- which(nms_t == k)
        if (length(hit)) titulos_out[k] <- titulos_in[hit[1]]
      }
    }
  }
  titulos_out <- vapply(
    names(titulos_out),
    function(k) {
      x <- as.character(titulos_out[[k]] %||% titulos_default[[k]])[1]
      x <- trimws(x)
      if (!nzchar(x) || is.na(x)) titulos_default[[k]] else x
    },
    character(1)
  )
  names(titulos_out) <- names(titulos_default)

  ancho_tarjeta_base_rel <- suppressWarnings(as.numeric(ancho_tarjeta_base_rel)[1])
  if (!is.finite(ancho_tarjeta_base_rel) || is.na(ancho_tarjeta_base_rel)) ancho_tarjeta_base_rel <- 0.72
  ancho_tarjeta_base_rel <- .dim_clamp(ancho_tarjeta_base_rel, 0.50, 0.90)
  factor_ancho_matriz <- suppressWarnings(as.numeric(factor_ancho_matriz)[1])
  if (!is.finite(factor_ancho_matriz) || is.na(factor_ancho_matriz)) factor_ancho_matriz <- 1.00
  factor_ancho_matriz <- .dim_clamp(factor_ancho_matriz, 0.60, 1.40)
  factor_ancho_dispersion <- suppressWarnings(as.numeric(factor_ancho_dispersion)[1])
  if (!is.finite(factor_ancho_dispersion) || is.na(factor_ancho_dispersion)) factor_ancho_dispersion <- 0.72
  factor_ancho_dispersion <- .dim_clamp(factor_ancho_dispersion, 0.40, 1.20)
  ancho_tarjeta_matriz <- .dim_clamp(ancho_tarjeta_base_rel * factor_ancho_matriz, 0.48, 0.88)
  ancho_tarjeta_disp <- .dim_clamp(ancho_tarjeta_base_rel * factor_ancho_dispersion, 0.36, 0.78)
  ancho_recuadro_auto <- isTRUE(ancho_recuadro_auto)
  ancho_recuadro_rel <- suppressWarnings(as.numeric(ancho_recuadro_rel)[1])
  if (is.finite(ancho_recuadro_rel) && !is.na(ancho_recuadro_rel) && ancho_recuadro_rel > 0) {
    ancho_recuadro_rel <- .dim_clamp(ancho_recuadro_rel, 0.55, 1.45)
    ancho_tarjeta_matriz <- .dim_clamp(ancho_tarjeta_matriz * ancho_recuadro_rel, 0.36, 0.88)
    ancho_tarjeta_disp <- .dim_clamp(ancho_tarjeta_disp * ancho_recuadro_rel, 0.26, 0.78)
  }

  if (!is.null(chip_width_rel)) ancho_chip_rel <- chip_width_rel
  if (!is.null(score_suffix)) sufijo_puntaje <- score_suffix
  ancho_chip_rel <- suppressWarnings(as.numeric(ancho_chip_rel)[1])
  if (!is.finite(ancho_chip_rel) || is.na(ancho_chip_rel)) ancho_chip_rel <- 0.18
  ancho_chip_rel <- .dim_clamp(ancho_chip_rel, 0.04, 0.36)
  sufijo_puntaje <- as.character(sufijo_puntaje %||% " pts")[1]
  if (is.na(sufijo_puntaje)) sufijo_puntaje <- " pts"
  if (!is.null(tamano_letra_recuadro)) tamano_texto_tarjeta <- tamano_letra_recuadro
  tamano_texto_tarjeta <- suppressWarnings(as.numeric(tamano_texto_tarjeta)[1])
  if (!is.finite(tamano_texto_tarjeta) || is.na(tamano_texto_tarjeta) || tamano_texto_tarjeta <= 0) {
    tamano_texto_tarjeta <- size_items
  }
  tamano_texto_chip <- suppressWarnings(as.numeric(tamano_texto_chip)[1])
  if (!is.finite(tamano_texto_chip) || is.na(tamano_texto_chip) || tamano_texto_chip <= 0) {
    tamano_texto_chip <- max(8, size_items + 1.0)
  }
  tarjetas_color_solido <- isTRUE(tarjetas_color_solido)
  jitter_x_rel <- suppressWarnings(as.numeric(jitter_x_rel)[1])
  if (!is.finite(jitter_x_rel) || is.na(jitter_x_rel) || jitter_x_rel < 0) jitter_x_rel <- 0.06
  jitter_x_rel <- .dim_clamp(jitter_x_rel, 0, 0.20)
  jitter_y_rel <- suppressWarnings(as.numeric(jitter_y_rel)[1])
  if (!is.finite(jitter_y_rel) || is.na(jitter_y_rel) || jitter_y_rel < 0) jitter_y_rel <- 0.045
  jitter_y_rel <- .dim_clamp(jitter_y_rel, 0, 0.20)
  iter_separacion <- suppressWarnings(as.integer(iter_separacion)[1])
  if (!is.finite(iter_separacion) || is.na(iter_separacion) || iter_separacion < 0L) iter_separacion <- 12L
  iter_separacion <- max(0L, min(60L, iter_separacion))
  factor_reduccion_tarjeta_dispersion <- suppressWarnings(as.numeric(factor_reduccion_tarjeta_dispersion)[1])
  if (!is.finite(factor_reduccion_tarjeta_dispersion) || is.na(factor_reduccion_tarjeta_dispersion)) {
    factor_reduccion_tarjeta_dispersion <- 0.85
  }
  factor_reduccion_tarjeta_dispersion <- .dim_clamp(factor_reduccion_tarjeta_dispersion, 0.55, 1.00)
  icono_size_foda <- suppressWarnings(as.numeric(icono_size_foda)[1])
  if (!is.finite(icono_size_foda) || is.na(icono_size_foda) || icono_size_foda <= 0) {
    stop("`icono_size_foda` debe ser numerico positivo.", call. = FALSE)
  }
  icono_size_foda <- .dim_clamp(icono_size_foda, 0.40, 3.20)
  # Tamano de iconos en la leyenda: parametro propio o derivado de icono_size_foda.
  icono_size_leyenda_foda <- if (!is.null(icono_size_leyenda_foda)) {
    v <- suppressWarnings(as.numeric(icono_size_leyenda_foda)[1])
    if (!is.finite(v) || is.na(v) || v <= 0) {
      stop("`icono_size_leyenda_foda` debe ser numerico positivo.", call. = FALSE)
    }
    .dim_clamp(v, 0.016, 0.14)
  } else {
    max(0.024, min(0.07, 0.030 * icono_size_foda))
  }
  if (
    is.null(icono_color_leyenda_foda) &&
    identical(modo_foda, "dispersion") &&
    identical(icono_modo, "reemplazar")
  ) {
    icono_color_leyenda_foda <- "#35516C"
  }
  # Alias legados -> nombres nuevos (si vienen definidos).
  if (!is.null(separacion_chip_icono_rel_foda)) {
    distancia_icono_chip_foda <- separacion_chip_icono_rel_foda
  }
  if (!is.null(separacion_chip_icono_min_foda)) {
    distancia_minima_icono_chip_foda <- separacion_chip_icono_min_foda
  }
  if (!is.null(padding_chip_rel_foda)) {
    padding_chip_foda <- padding_chip_rel_foda
  }
  if (!is.null(padding_chip_label_lineas_foda)) {
    padding_texto_chip_foda <- padding_chip_label_lineas_foda
  }

  distancia_icono_chip_foda <- suppressWarnings(as.numeric(distancia_icono_chip_foda)[1])
  if (!is.finite(distancia_icono_chip_foda) || is.na(distancia_icono_chip_foda) ||
      distancia_icono_chip_foda < 0) {
    stop("`distancia_icono_chip_foda` debe ser numerico >= 0.", call. = FALSE)
  }
  distancia_icono_chip_foda <- .dim_clamp(distancia_icono_chip_foda, 0, 0.40)
  distancia_minima_icono_chip_foda <- suppressWarnings(as.numeric(distancia_minima_icono_chip_foda)[1])
  if (!is.finite(distancia_minima_icono_chip_foda) || is.na(distancia_minima_icono_chip_foda) ||
      distancia_minima_icono_chip_foda < 0) {
    stop("`distancia_minima_icono_chip_foda` debe ser numerico >= 0.", call. = FALSE)
  }
  distancia_minima_icono_chip_foda <- .dim_clamp(distancia_minima_icono_chip_foda, 0, 0.08)
  padding_chip_foda <- suppressWarnings(as.numeric(padding_chip_foda)[1])
  if (!is.finite(padding_chip_foda) || is.na(padding_chip_foda) || padding_chip_foda <= 0) {
    stop("`padding_chip_foda` debe ser numerico positivo.", call. = FALSE)
  }
  padding_chip_foda <- .dim_clamp(padding_chip_foda, 0.70, 1.60)
  padding_texto_chip_foda <- suppressWarnings(as.numeric(padding_texto_chip_foda)[1])
  if (!is.finite(padding_texto_chip_foda) || is.na(padding_texto_chip_foda) ||
      padding_texto_chip_foda < 0) {
    stop("`padding_texto_chip_foda` debe ser numerico >= 0.", call. = FALSE)
  }
  padding_texto_chip_foda <- .dim_clamp(padding_texto_chip_foda, 0, 0.30)

  # Variables internas de layout (compatibilidad con implementacion existente).
  separacion_chip_icono_rel_foda <- distancia_icono_chip_foda
  separacion_chip_icono_min_foda <- distancia_minima_icono_chip_foda
  padding_chip_rel_foda <- padding_chip_foda
  padding_chip_label_lineas_foda <- padding_texto_chip_foda
  radio_burbuja_rel <- suppressWarnings(as.numeric(radio_burbuja_rel)[1])
  if (!is.finite(radio_burbuja_rel) || is.na(radio_burbuja_rel) || radio_burbuja_rel <= 0) {
    stop("`radio_burbuja_rel` debe ser numerico positivo.", call. = FALSE)
  }
  radio_burbuja_rel <- .dim_clamp(radio_burbuja_rel, 0.70, 2.30)
  score_max_disp <- suppressWarnings(as.numeric(score_max_disp)[1])
  if (!is.finite(score_max_disp) || is.na(score_max_disp) || score_max_disp <= 100) {
    score_max_disp <- 110
  }
  if (!is.logical(colorear_fondo_foda) || length(colorear_fondo_foda) != 1L || is.na(colorear_fondo_foda)) {
    stop("`colorear_fondo_foda` debe ser logical(1).", call. = FALSE)
  }

  ctx <- .dim_build_context(data, instrumento = instrumento)
  obj <- NULL
  sem <- ctx$semaforo

  # --- Resolver variables y etiquetas segun nivel ---
  if (identical(nivel, "subindices")) {
    if (!is.null(objetivo) && nzchar(as.character(objetivo)[1])) {
      obj <- ctx$catalog_general[[as.character(objetivo)[1]]]
      if (is.null(obj)) {
        stop(
          "graficar_foda_dimensiones(): `objetivo` '", objetivo,
          "' no encontrado en catalog_general.",
          call. = FALSE
        )
      }
      vars   <- obj$axis_vars
      labels <- obj$axis_labels
    } else {
      vars   <- character(0)
      labels <- character(0)
      for (entry in ctx$catalog_general) {
        new_vars   <- setdiff(entry$axis_vars, vars)
        new_labels <- entry$axis_labels[entry$axis_vars %in% new_vars]
        vars   <- c(vars, new_vars)
        labels <- c(labels, new_labels)
      }
      if (!length(vars)) {
        sub_cols <- grep("^sub_", names(data), value = TRUE)
        vars   <- sub_cols
        labels <- vapply(sub_cols, ctx$label_sub, character(1))
      }
    }
  } else {
    if (is.null(objetivo) || !nzchar(as.character(objetivo)[1])) {
      stop(
        "graficar_foda_dimensiones(): `objetivo` es requerido para nivel='indicadores'.",
        call. = FALSE
      )
    }
    obj <- ctx$catalog_indicadores[[as.character(objetivo)[1]]]
    if (is.null(obj)) {
      stop(
        "graficar_foda_dimensiones(): `objetivo` '", objetivo,
        "' no encontrado en catalog_indicadores.",
        call. = FALSE
      )
    }
    vars   <- obj$axis_vars
    labels <- obj$axis_labels
  }

  vars <- as.character(vars)
  labels <- as.character(labels)
  if (length(labels) < length(vars)) {
    labels <- c(labels, vars[seq.int(length(labels) + 1L, length(vars))])
  }
  labels <- labels[seq_along(vars)]
  keep_vars <- vars %in% names(data)
  vars <- vars[keep_vars]
  labels <- labels[keep_vars]

  # --- Mapa de iconos: var -> path (o NULL) ----------------------------------
  iconos_map <- setNames(vector("list", length(vars)), vars)
  if (!is.null(obj)) {
    # objetivo explicito: tomar icons de obj$axis_iconos
    ovars  <- as.character(obj$axis_vars  %||% character(0))
    oicons <- obj$axis_iconos %||% vector("list", length(ovars))
    for (.ii in seq_along(ovars)) {
      .v <- ovars[[.ii]]
      if (.v %in% vars) iconos_map[[.v]] <- oicons[[.ii]]
    }
  } else {
    # sin objetivo: buscar icons directamente en meta_subindices/meta_indices del contexto
    .meta_src <- if (identical(nivel, "subindices")) {
      ctx$meta_subindices %||% list()
    } else {
      ctx$meta_indices %||% list()
    }
    # Construir mapa salida_var -> key desde los metadatos
    .key_to_var <- vapply(
      .meta_src,
      function(x) as.character(x$salida %||% NA_character_)[1],
      character(1)
    )
    .var_to_key <- if (length(.key_to_var)) {
      stats::setNames(names(.key_to_var), as.character(.key_to_var))
    } else {
      character(0)
    }
    .var_to_key <- .var_to_key[!is.na(.var_to_key) & nzchar(.var_to_key)]
    for (.v in vars) {
      .sk <- if (length(.var_to_key) && .v %in% names(.var_to_key)) .var_to_key[[.v]] else NA_character_
      if (!is.na(.sk) && nzchar(.sk) && .sk %in% names(.meta_src)) {
        .ico <- .meta_src[[.sk]]$icono %||% NULL
        if (!is.null(.ico) && nzchar(as.character(.ico %||% ""))) {
          iconos_map[[.v]] <- as.character(.ico)[1]
        }
      }
    }
  }
  has_iconos_foda <- .dim_has_iconos(iconos_map)

  .resolve_indice_total <- function() {
    out_var <- NA_character_
    out_lbl <- NA_character_

    .norm_txt <- function(x) {
      x <- tolower(trimws(as.character(x %||% "")))
      x <- suppressWarnings(iconv(x, to = "ASCII//TRANSLIT"))
      x[is.na(x)] <- ""
      x <- gsub("[^a-z0-9]+", " ", x)
      trimws(gsub("\\s+", " ", x))
    }

    if (is.na(out_var) || !nzchar(out_var)) {
      best_score <- -Inf
      best_var <- NA_character_
      best_lbl <- NA_character_
      for (nm in names(ctx$catalog_general %||% list())) {
        cc <- ctx$catalog_general[[nm]]
        if (!is.list(cc)) next
        id_cc <- as.character(cc$id %||% nm %||% NA_character_)[1]
        if (is.na(id_cc) || !nzchar(id_cc) || !(id_cc %in% names(data))) next
        key_cc <- as.character(cc$key %||% nm %||% "")[1]
        lbl_cc <- as.character(cc$label %||% id_cc)[1]
        axis_cc <- unique(as.character(cc$axis_vars %||% character(0)))
        cov_cc <- if (length(vars)) mean(vars %in% axis_cc) else 0
        score_cc <- length(axis_cc) + (10 * cov_cc)
        txt_cc <- .norm_txt(paste(id_cc, key_cc, lbl_cc))
        if (grepl("\\bindice general\\b|\\bindice_general\\b", txt_cc)) {
          score_cc <- score_cc + 1000
        } else if (grepl("\\bgeneral\\b", txt_cc)) {
          score_cc <- score_cc + 200
        }
        if (is.finite(score_cc) && score_cc > best_score) {
          best_score <- score_cc
          best_var <- id_cc
          best_lbl <- lbl_cc
        }
      }
      if (is.finite(best_score) && nzchar(best_var)) {
        out_var <- best_var
        out_lbl <- best_lbl
      }
    }

    if ((is.na(out_var) || !nzchar(out_var)) && ("idx_indice_general" %in% names(data))) {
      out_var <- "idx_indice_general"
      out_lbl <- "Indice General"
    }
    if ((is.na(out_var) || !nzchar(out_var)) && !is.null(obj) && identical(nivel, "subindices")) {
      id_obj <- as.character(obj$id %||% NA_character_)[1]
      if (!is.na(id_obj) && nzchar(id_obj) && id_obj %in% names(data)) {
        out_var <- id_obj
        out_lbl <- as.character(obj$label %||% id_obj)[1]
      }
    }
    if ((is.na(out_var) || !nzchar(out_var))) {
      idx_guess <- grep("^idx_", names(data), value = TRUE)
      if (length(idx_guess)) {
        out_var <- idx_guess[1]
        out_lbl <- .dim_pretty_label(out_var)
      }
    }
    list(var = out_var, label = out_lbl)
  }

  if (!length(vars)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin variables disponibles para FODA",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  # --- Aplicar filtros ---
  cruce <- trimws(as.character(cruce %||% "")[1])
  if (identical(cruce, "NA")) cruce <- ""
  if (identical(modo_foda, "matriz") && nzchar(cruce)) {
    stop("`cruce` solo esta disponible cuando `modo_foda = 'dispersion'`.", call. = FALSE)
  }

  df <- .dim_apply_filters(ctx$data, filters = filtros)
  if (!nrow(df)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin datos luego de aplicar filtros para FODA",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  total_group_label <- "Indice"

  # --- Calcular stats (base o por cruce) ---
  if (identical(modo_foda, "dispersion") && nzchar(cruce)) {
    if (!cruce %in% names(df)) {
      stop("`cruce` no existe en `data`: ", cruce, call. = FALSE)
    }

    w_cruce <- .dim_safe_weights(df, weight_col = ctx$weight_col)
    lev <- .dim_categorias_var(
      df = df,
      var = cruce,
      w = w_cruce,
      data_ref = ctx$data,
      instrumento = ctx$instrumento,
      max_levels = max(1000L, as.integer(nrow(df) + 1L))
    )
    lev_df <- lev$rows %||% data.frame()
    if (nrow(lev_df)) {
      is_total_like <- function(x) {
        x <- tolower(trimws(as.character(x %||% "")))
        x <- suppressWarnings(iconv(x, to = "ASCII//TRANSLIT"))
        x[is.na(x)] <- ""
        x <- gsub("[^a-z0-9]+", " ", x)
        x <- trimws(gsub("\\s+", " ", x))
        x %in% c(
          "total", "totales",
          "indice total", "indice totales",
          "indice general total", "indice general totales"
        )
      }
      keep_lev <- !(is_total_like(lev_df$value) | is_total_like(lev_df$label))
      lev_df <- lev_df[keep_lev, , drop = FALSE]
    }
    if (!nrow(lev_df)) {
      return(.dim_export_canvas(
        .dim_blank_canvas(
          mensaje = "Sin niveles validos para el cruce en modo dispersion",
          debug_ph_bordes = debug_ph_bordes,
          debug_ph_col = debug_ph_col,
          debug_ph_lwd = debug_ph_lwd
        ),
        exportar = exportar,
        path_salida = path_salida,
        ancho = ancho, alto = alto, dpi = dpi,
        ppt_append = ppt_append,
        ppt_layout = ppt_layout,
        ppt_master = ppt_master
      ))
    }

    x_cruce <- trimws(as.character(df[[cruce]]))
    add_total_idx <- .resolve_indice_total()
    has_total_idx <- isTRUE(incluir_total) &&
      !is.na(add_total_idx$var) &&
      nzchar(as.character(add_total_idx$var))

    stats_list <- vector("list", nrow(lev_df) + if (isTRUE(has_total_idx)) 1L else 0L)
    k <- 1L
    for (i in seq_len(nrow(lev_df))) {
      key_i <- trimws(as.character(lev_df$value[i] %||% ""))
      if (!nzchar(key_i)) next
      mask_i <- !is.na(x_cruce) & nzchar(x_cruce) & (x_cruce == key_i)
      if (!any(mask_i)) next

      st_i <- .foda_compute_stats(
        data = df[mask_i, , drop = FALSE],
        vars = vars,
        labels = labels,
        usar_pesos = usar_pesos,
        weight_col = ctx$weight_col
      )
      st_i$grupo_key <- key_i
      st_i$grupo <- as.character(lev_df$label[i] %||% key_i)
      st_i$is_total_global <- FALSE
      stats_list[[k]] <- st_i
      k <- k + 1L
    }

    if (isTRUE(has_total_idx)) {
      st_total <- .foda_compute_stats(
        data = df,
        vars = as.character(add_total_idx$var)[1],
        labels = as.character(add_total_idx$label %||% add_total_idx$var)[1],
        usar_pesos = usar_pesos,
        weight_col = ctx$weight_col
      )
      st_total$grupo_key <- "__total__"
      st_total$grupo <- total_group_label
      st_total$is_total_global <- TRUE
      stats_list[[k]] <- st_total
    }

    stats_list <- stats_list[vapply(stats_list, function(x) !is.null(x), logical(1))]
    stats_df <- if (length(stats_list)) {
      do.call(rbind, stats_list)
    } else {
      data.frame()
    }
  } else {
    stats_df <- .foda_compute_stats(
      data = df,
      vars = vars,
      labels = labels,
      usar_pesos = usar_pesos,
      weight_col = ctx$weight_col
    )
    stats_df$grupo_key <- "__total__"
    stats_df$grupo <- total_group_label
    stats_df$is_total_global <- FALSE
  }

  if (!nrow(stats_df)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin datos suficientes para FODA",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  stats_df$grupo <- as.character(stats_df$grupo)
  stats_df$grupo_key <- as.character(stats_df$grupo_key)
  if (!("is_total_global" %in% names(stats_df))) stats_df$is_total_global <- FALSE
  stats_df$is_total_global <- !is.na(stats_df$is_total_global) & as.logical(stats_df$is_total_global)
  stats_df <- stats_df[!is.na(stats_df$score_mean), , drop = FALSE]
  if (!nrow(stats_df)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin datos clasificables para FODA",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  corte_score_raw <- suppressWarnings(as.numeric(corte_score)[1])
  if (identical(modo_foda, "dispersion") &&
      (is.na(corte_score_raw) || !is.finite(corte_score_raw))) {
    stop("En `modo_foda='dispersion'` el argumento `corte_score` es obligatorio.", call. = FALSE)
  }
  corte_score_val <- if (is.na(corte_score_raw) || !is.finite(corte_score_raw)) sem$cortes[2] else corte_score_raw

  sd_vals <- stats_df$score_sd[!is.na(stats_df$score_sd) & is.finite(stats_df$score_sd)]
  corte_sd_val <- suppressWarnings(as.numeric(corte_sd)[1])
  if (is.na(corte_sd_val) || !is.finite(corte_sd_val)) {
    corte_sd_val <- if (length(sd_vals)) stats::median(sd_vals) else 25
  }

  stats_df <- .foda_classify(stats_df, corte_score_val, corte_sd_val)
  stats_df <- stats_df[!is.na(stats_df$cuadrante), , drop = FALSE]
  if (!nrow(stats_df)) {
    return(.dim_export_canvas(
      .dim_blank_canvas(
        mensaje = "Sin datos clasificables para FODA",
        debug_ph_bordes = debug_ph_bordes,
        debug_ph_col = debug_ph_col,
        debug_ph_lwd = debug_ph_lwd
      ),
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  # --- Resolver colores FODA ---
  colores_foda <- as.character(colores_foda)
  nms_cf <- names(colores_foda)
  if (is.null(nms_cf)) nms_cf <- character(0)
  col_f <- if ("fortaleza"   %in% nms_cf) colores_foda[["fortaleza"]]   else "#E8F5E9"
  col_o <- if ("oportunidad" %in% nms_cf) colores_foda[["oportunidad"]] else "#E3F2FD"
  col_d <- if ("debilidad"   %in% nms_cf) colores_foda[["debilidad"]]   else "#FFEBEE"
  col_a <- if ("amenaza"     %in% nms_cf) colores_foda[["amenaza"]]     else "#FFF3E0"
  if (!isTRUE(colorear_fondo_foda)) {
    col_f <- "transparent"
    col_o <- "transparent"
    col_d <- "transparent"
    col_a <- "transparent"
  }

  .is_light_col <- function(col, threshold = 0.62) {
    rgb <- tryCatch(grDevices::col2rgb(col) / 255, error = function(e) NULL)
    if (is.null(rgb) || !ncol(rgb)) return(FALSE)
    lum <- 0.2126 * rgb[1, 1] + 0.7152 * rgb[2, 1] + 0.0722 * rgb[3, 1]
    is.finite(lum) && !is.na(lum) && lum >= threshold
  }

  # --- Color semaforo por score (independiente del corte de cuadrantes) ---
  chip_cortes <- suppressWarnings(as.numeric(cortes_chip))
  chip_cortes <- chip_cortes[is.finite(chip_cortes)]
  if (length(chip_cortes) >= 2L) {
    chip_cortes <- sort(unique(chip_cortes))[1:2]
  } else {
    chip_lo <- suppressWarnings(as.numeric(sem$cortes[1])[1])
    chip_hi <- corte_score_val
    if (!is.finite(chip_lo) || is.na(chip_lo)) chip_lo <- chip_hi - 15
    if (!is.finite(chip_hi) || is.na(chip_hi)) chip_hi <- suppressWarnings(as.numeric(sem$cortes[2])[1])
    if (!is.finite(chip_hi) || is.na(chip_hi)) chip_hi <- chip_lo + 15
    if (chip_lo >= chip_hi) chip_lo <- chip_hi - 10
    chip_cortes <- c(chip_lo, chip_hi)
  }
  chip_cortes <- pmax(-Inf, pmin(Inf, chip_cortes))
  if (length(chip_cortes) < 2L || chip_cortes[1] >= chip_cortes[2]) {
    chip_cortes <- c(60, max(80, corte_score_val))
  }

  sem_keys <- c("rojo", "ambar", "verde")
  sem_modo <- .dim_normalize_semaforo_modo(modo_semaforo %||% sem$modo %||% "grupos")
  stats_df$score_round <- .dim_round_half_up(stats_df$score_mean, 0)
  stats_df$sem_key <- .dim_semaforo_estado(
    x = stats_df$score_mean,
    cortes = chip_cortes,
    digits = 0,
    labels = sem_keys
  )
  stats_df$sem_color <- .dim_semaforo_color(
    x = stats_df$score_mean,
    cortes = chip_cortes,
    colores = sem,
    digits = 0,
    na_color = sem$na,
    modo = sem_modo,
    anclas_degradado = sem$anclas_degradado %||% NULL,
    gradiente_colores = sem$gradiente_colores %||% NULL,
    gradiente_valores = sem$gradiente_valores %||% NULL,
    gradiente_limites = sem$gradiente_limites %||% NULL,
    gradiente_segmentos = sem$gradiente_segmentos %||% 20L
  )
  stats_df$score_sd_plot <- ifelse(is.na(stats_df$score_sd), 0, stats_df$score_sd)

  # --- Utilidades tipograficas ---
  .foda_trunc <- function(x, max_chars = 28L) {
    x <- trimws(as.character(x %||% ""))
    max_chars <- max(6L, as.integer(max_chars)[1])
    ifelse(
      nchar(x, type = "width") <= max_chars,
      x,
      paste0(substr(x, 1L, max_chars - 3L), "...")
    )
  }
  .foda_compact_label <- function(x, max_chars = 18L) {
    x <- trimws(as.character(x %||% ""))
    x <- gsub("^[ÍI]ndice general$", "Ind. G.", x, ignore.case = TRUE)
    x <- gsub("^Promedio general$", "Prom. G.", x, ignore.case = TRUE)
    x <- gsub("^Indice general$", "Ind. G.", x, ignore.case = TRUE)
    .foda_trunc(x, max_chars = max_chars)
  }
  .wrap_item_label <- function(x, width = 24L, max_lines = 2L) {
    width <- max(10L, as.integer(width)[1])
    max_lines <- max(1L, as.integer(max_lines)[1])
    x <- as.character(x %||% "")
    wrapped <- if (requireNamespace("stringr", quietly = TRUE)) {
      stringr::str_wrap(x, width = width)
    } else {
      vapply(x, function(xx) paste(strwrap(xx, width = width), collapse = "\n"), character(1))
    }
    out <- vapply(wrapped, function(xx) {
      ln <- strsplit(xx, "\n", fixed = TRUE)[[1]]
      if (length(ln) <= max_lines) return(paste(ln, collapse = "\n"))
      ln <- ln[seq_len(max_lines)]
      ln[max_lines] <- .foda_trunc(ln[max_lines], max_chars = width)
      paste(ln, collapse = "\n")
    }, character(1))
    out
  }
  stats_df <- stats_df[order(-stats_df$score_mean, stats_df$grupo, stats_df$label), , drop = FALSE]
  legend_cruce_labels <- character(0)
  legend_cruce_colors <- character(0)

  # --- Construccion del panel segun modo ---
  if (identical(modo_foda, "matriz")) {
    cuadrantes_cfg <- data.frame(
      cuadrante = c("fortaleza", "oportunidad", "debilidad", "amenaza"),
      titulo    = c(
        titulos_out[["fortaleza"]],
        titulos_out[["oportunidad"]],
        titulos_out[["debilidad"]],
        titulos_out[["amenaza"]]
      ),
      subtexto  = c("Puntaje alto + consistente",
                     "Puntaje alto + disperso",
                     "Puntaje bajo + consistente",
                     "Puntaje bajo + disperso"),
      xmin = c(0, 1, 0, 1),
      xmax = c(1, 2, 1, 2),
      ymin = c(1, 1, 0, 0),
      ymax = c(2, 2, 1, 1),
      fill = c(col_f, col_o, col_d, col_a),
      tx   = c(0.5, 1.5, 0.5, 1.5),
      ty   = c(1.92, 1.92, 0.92, 0.92),
      stx  = c(0.5, 1.5, 0.5, 1.5),
      sty  = c(1.84, 1.84, 0.84, 0.84),
      stringsAsFactors = FALSE
    )

    items_df <- data.frame(
      x = numeric(0), y = numeric(0),
      w = numeric(0), h = numeric(0),
      title_x = numeric(0), title_y = numeric(0),
      title_txt = character(0),
      score_x = numeric(0), score_y = numeric(0),
      score_txt = character(0),
      chip_x = numeric(0), chip_w = numeric(0), chip_h = numeric(0),
      chip_fill = character(0), chip_text_col = character(0),
      card_fill = character(0), card_border = character(0), title_col = character(0),
      icono = character(0),
      stringsAsFactors = FALSE
    )

    for (q in cuadrantes_cfg$cuadrante) {
      q_items <- stats_df[stats_df$cuadrante == q, , drop = FALSE]
      if (!nrow(q_items)) next

      cfg <- cuadrantes_cfg[cuadrantes_cfg$cuadrante == q, , drop = FALSE]
      n_cols <- if (nrow(q_items) <= 4L) 1L else 2L
      max_rows <- if (n_cols == 1L) 6L else 5L
      max_show <- n_cols * max_rows
      n_show <- min(nrow(q_items), max_show)

      idx_show <- seq_len(n_show)
      row_ids <- ((idx_show - 1L) %/% n_cols) + 1L
      col_ids <- ((idx_show - 1L) %% n_cols) + 1L

      if (n_cols == 1L) {
        card_w_base <- min(ancho_tarjeta_matriz, 0.82)
        card_w_max <- card_w_base
        x_centers <- cfg$xmin + 0.5
      } else {
        gap_x <- 0.028
        side_min <- 0.045
        card_w_base <- min(ancho_tarjeta_matriz, (1 - (2 * side_min) - gap_x) / 2)
        card_w_max <- card_w_base
        side_pad <- max(side_min, (1 - (2 * card_w_base) - gap_x) / 2)
        x_centers <- c(cfg$xmin + side_pad + card_w_base / 2, cfg$xmax - side_pad - card_w_base / 2)
      }

      y_top <- cfg$ymax - 0.22
      y_bottom <- cfg$ymin + 0.08
      n_rows_show <- max(row_ids)
      gap_y <- if (n_rows_show <= 2L) 0.028 else 0.020
      area_h <- max(0.22, y_top - y_bottom)
      card_h <- min(0.22, (area_h - gap_y * (n_rows_show - 1L)) / n_rows_show)
      card_h <- max(0.115, card_h)
      stack_h <- n_rows_show * card_h + (n_rows_show - 1L) * gap_y
      y_mid <- (y_top + y_bottom) / 2
      y_start <- y_mid + stack_h / 2 - card_h / 2
      y_vals <- y_start - (row_ids - 1L) * (card_h + gap_y)
      x_vals <- x_centers[col_ids]

      score_txt_vec <- paste0(.dim_fmt_int(q_items$score_round[idx_show]), sufijo_puntaje)
      pad_left <- 0.026
      pad_right <- pad_left
      gap_title_chip <- 0.012
      card_w <- rep(card_w_base, n_show)
      if (isTRUE(ancho_recuadro_auto)) {
        lbl_vec <- as.character(q_items$label[idx_show] %||% "")
        chars_lbl <- nchar(lbl_vec, type = "width")
        chip_need_auto <- (0.020 + pmax(1, nchar(score_txt_vec, type = "width")) * 0.0070) *
          padding_chip_rel_foda * (1 + 0.28 * padding_chip_label_lineas_foda)
        txt_need_auto <- 0.030 + pmin(chars_lbl, 44) * 0.0062
        w_need <- pad_left + txt_need_auto + gap_title_chip + chip_need_auto + pad_right
        card_w <- pmin(card_w_max, pmax(0.235, w_need))
      }
      chip_h <- pmin(
        card_h * 0.90,
        card_h * 0.72 * padding_chip_rel_foda * (1 + 0.45 * padding_chip_label_lineas_foda)
      )
      chip_w_target <- card_w * .dim_clamp(ancho_chip_rel, 0.06, 0.55)
      chip_w_need <- (0.020 + pmax(1, nchar(score_txt_vec, type = "width")) * 0.0070) *
        padding_chip_rel_foda * (1 + 0.28 * padding_chip_label_lineas_foda)
      chip_w <- pmin(card_w * 0.48, pmax(chip_w_target, chip_w_need))
      left_edge <- x_vals - (card_w / 2)
      right_edge <- x_vals + (card_w / 2)
      chip_x <- right_edge - (chip_w / 2) - pad_right
      title_x <- left_edge + pad_left
      score_x <- chip_x
      score_y <- y_vals
      title_y <- y_vals
      # Ajuste de title_x para iconos en "matriz" (siempre "acompanar")
      icon_w_mat  <- card_h * 0.60
      icon_gap_mat <- 0.008
      item_vars_q <- as.character(q_items$var[idx_show])
      has_icon_q  <- if (has_iconos_foda) vapply(item_vars_q, function(.v) {
        .ico <- iconos_map[[.v]]
        !is.null(.ico) && nzchar(as.character(.ico %||% ""))
      }, logical(1)) else rep(FALSE, n_show)
      title_x <- title_x + ifelse(has_icon_q, icon_w_mat + icon_gap_mat, 0)
      text_w <- pmax(0.18, (chip_x - (chip_w / 2)) - title_x - gap_title_chip)
      wrap_w <- pmax(11L, as.integer(floor(text_w * 64)))

      label_matrix <- as.character(q_items$label[idx_show] %||% "")
      label_matrix <- gsub("^[ÍI]ndice general$", "Ind. G.", label_matrix, ignore.case = TRUE)
      label_matrix <- gsub("^Indice general$", "Ind. G.", label_matrix, ignore.case = TRUE)

      q_df <- data.frame(
        x = x_vals,
        y = y_vals,
        w = card_w,
        h = rep(card_h, n_show),
        title_x = title_x,
        title_y = title_y,
        title_txt = mapply(
          function(tt, ww) .wrap_item_label(tt, width = ww, max_lines = 2L),
          label_matrix, wrap_w, USE.NAMES = FALSE
        ),
        score_x = score_x,
        score_y = score_y,
        score_txt = score_txt_vec,
        chip_x = chip_x,
        chip_w = chip_w,
        chip_h = rep(chip_h, n_show),
        chip_fill = as.character(q_items$sem_color[idx_show]),
        chip_text_col = rep(chip_texto_color, n_show),
        card_fill = rep("#FFFFFF", n_show),
        card_border = rep("#7C90A6", n_show),
        title_col = rep("#0D243E", n_show),
        icono = vapply(item_vars_q, function(.v) {
          .ico <- iconos_map[[.v]]
          if (!is.null(.ico) && nzchar(as.character(.ico %||% ""))) as.character(.ico)[1] else ""
        }, character(1)),
        stringsAsFactors = FALSE
      )
      if (nrow(q_items) > n_show && nrow(q_df)) {
        j <- nrow(q_df)
        q_df$title_txt[j] <- paste0("+", nrow(q_items) - n_show, " mas")
        q_df$score_txt[j] <- ""
        q_df$chip_fill[j] <- "#E3EAF3"
        q_df$chip_text_col[j] <- chip_texto_color
        q_df$card_fill[j] <- "#F8FAFD"
        q_df$card_border[j] <- "#C2CFDC"
        q_df$title_col[j] <- "#546678"
        q_df$icono[j]      <- ""
      }

      items_df <- rbind(items_df, q_df)
    }

    p_panel <- ggplot2::ggplot() +
      ggplot2::geom_rect(
        data = cuadrantes_cfg,
        ggplot2::aes(xmin = .data$xmin, xmax = .data$xmax, ymin = .data$ymin, ymax = .data$ymax),
        fill = cuadrantes_cfg$fill,
        colour = "#D4DEE9",
        linewidth = 0.55
      ) +
      ggplot2::annotate(
        "segment",
        x = 1, xend = 1, y = 0, yend = 2,
        colour = "#7C8FA4",
        linewidth = 0.6,
        linetype = "22"
      ) +
      ggplot2::annotate(
        "segment",
        x = 0, xend = 2, y = 1, yend = 1,
        colour = "#7C8FA4",
        linewidth = 0.6,
        linetype = "22"
      ) +
      ggplot2::annotate(
        "text",
        x = cuadrantes_cfg$tx,
        y = cuadrantes_cfg$ty,
        label = cuadrantes_cfg$titulo,
        fontface = "bold",
        size = size_cuadrante_titulo / 3,
        colour = color_cuadrante_titulo,
        hjust = 0.5, vjust = 1
      )

    if (isTRUE(sd_tecnico)) {
      p_panel <- p_panel +
        ggplot2::annotate(
          "label",
          x = 1,
          y = 1.985,
          label = paste0("Corte SD = ", format(round(corte_sd_val, 1), trim = TRUE)),
          fill = "#EEF3F8",
          colour = "#4A5F75",
          linewidth = 0,
          size = (size_items - 1) / 3,
          vjust = 1
        )
    }

    p_panel <- p_panel +
      ggplot2::annotate(
        "label",
        x = 0.012,
        y = 1,
        label = paste0("Corte puntaje = ", format(round(corte_score_val, 1), trim = TRUE)),
        fill = "#EEF3F8",
        colour = "#4A5F75",
        linewidth = 0,
        size = (size_items - 1) / 3,
        hjust = 0,
        vjust = -0.2
      )

    if (isTRUE(mostrar_subtitulo_area)) {
      p_panel <- p_panel +
        ggplot2::annotate(
          "text",
          x = cuadrantes_cfg$stx,
          y = cuadrantes_cfg$sty,
          label = cuadrantes_cfg$subtexto,
          fontface = "plain",
          size = (size_items - 1) / 3.2,
          colour = "#5D6F82",
          hjust = 0.5, vjust = 1
        )
    }

    if (nrow(items_df)) {
      p_panel <- p_panel +
        ggplot2::geom_tile(
          data = items_df,
          ggplot2::aes(
            x = .data$x, y = .data$y,
            width = .data$w, height = .data$h,
            fill = .data$card_fill, colour = .data$card_border
          ),
          linewidth = 0.62
        ) +
        ggplot2::geom_tile(
          data = items_df,
          ggplot2::aes(
            x = .data$chip_x, y = .data$y,
            width = .data$chip_w, height = .data$chip_h,
            fill = .data$chip_fill
          ),
          colour = "#2E425A",
          linewidth = 0.25
        ) +
        ggplot2::geom_text(
          data = items_df,
          ggplot2::aes(x = .data$title_x, y = .data$title_y, label = .data$title_txt, colour = .data$title_col),
          size = tamano_texto_tarjeta / 1.95,
          hjust = 0,
          vjust = 0.5,
          lineheight = 0.92,
          fontface = "bold"
        ) +
        ggplot2::geom_text(
          data = items_df,
          ggplot2::aes(x = .data$score_x, y = .data$score_y, label = .data$score_txt, colour = .data$chip_text_col),
          size = tamano_texto_chip / 2.55,
          hjust = 0.5,
          vjust = 0.5,
          lineheight = 1,
          fontface = "bold"
        ) +
        ggplot2::scale_fill_identity() +
        ggplot2::scale_colour_identity()
    }

    p_panel <- p_panel +
      ggplot2::coord_cartesian(xlim = c(0, 2), ylim = c(0, 2), expand = FALSE)

    # Iconos en tarjetas "matriz"  -  siempre modo "acompanar"
    if (has_iconos_foda && nrow(items_df)) {
      for (.ii in seq_len(nrow(items_df))) {
        .ico_path <- items_df$icono[.ii]
        if (!nzchar(.ico_path %||% "")) next
        .img <- .dim_load_icon(.ico_path, tint_color = icono_color_foda)
        if (is.null(.img)) next
        .iw  <- pmin(items_df$h[.ii] * 0.60 * icono_size_foda, items_df$w[.ii] * 0.40)
        .igap <- 0.008
        .cx  <- items_df$x[.ii] - items_df$w[.ii] / 2 + .igap + .iw / 2
        .cy  <- items_df$y[.ii]
        p_panel <- p_panel + ggplot2::annotation_custom(
          grid::rasterGrob(.img, interpolate = TRUE),
          xmin = .cx - .iw / 2, xmax = .cx + .iw / 2,
          ymin = .cy - .iw / 2, ymax = .cy + .iw / 2
        )
      }
    }
  } else {
    plot_df <- stats_df[order(stats_df$score_mean, stats_df$score_sd_plot, stats_df$grupo, stats_df$label), , drop = FALSE]
    n_pts <- nrow(plot_df)

    if (nzchar(cruce)) {
      grp_ref <- unique(plot_df[, c("grupo", "grupo_key"), drop = FALSE])
      grp_cols <- .dim_group_colors(
        groups = as.character(grp_ref$grupo),
        paleta_radar = ctx$paleta_radar,
        total_color = color_indice_total,
        palette_override = ctx$paletas_cruce[[cruce]] %||% NULL,
        group_keys = as.character(grp_ref$grupo_key)
      )
      plot_df$is_total <- !is.na(plot_df$is_total_global) & as.logical(plot_df$is_total_global)
      plot_df$card_fill <- as.character(grp_cols[plot_df$grupo])
      plot_df$card_fill[!nzchar(plot_df$card_fill) | is.na(plot_df$card_fill)] <- "#2F4A66"
      idx_total <- which(!is.na(plot_df$is_total) & plot_df$is_total)
      if (length(idx_total)) plot_df$card_fill[idx_total] <- color_indice_total

      grp_ref$is_total <- (as.character(grp_ref$grupo_key) == "__total__") |
        (tolower(trimws(as.character(grp_ref$grupo))) %in% c("indice", "indice"))
      grp_ref$color_leg <- as.character(grp_cols[as.character(grp_ref$grupo)])
      keep_legend <- !grp_ref$is_total
      legend_cruce_labels <- as.character(grp_ref$grupo[keep_legend])
      legend_cruce_colors <- as.character(grp_ref$color_leg[keep_legend])
      ok_leg <- nzchar(legend_cruce_labels) & !is.na(legend_cruce_colors) & nzchar(legend_cruce_colors)
      legend_cruce_labels <- legend_cruce_labels[ok_leg]
      legend_cruce_colors <- legend_cruce_colors[ok_leg]
    } else {
      plot_df$card_fill <- if (isTRUE(tarjetas_color_solido)) "#2F4A66" else "#FFFFFF"
    }
    plot_df$card_border <- grDevices::adjustcolor(plot_df$card_fill, alpha.f = 0.92)
    plot_df$title_col <- ifelse(
      vapply(plot_df$card_fill, .is_light_col, logical(1)),
      "#0D243E",
      "#FFFFFF"
    )
      plot_df$chip_text_col <- chip_texto_color
    plot_df$score_txt <- paste0(.dim_fmt_int(plot_df$score_round), sufijo_puntaje)

    # --- Normalizacion centrada en cortes para cuadrantes visualmente equivalentes ---
    x_raw <- plot_df$score_sd_plot
    y_raw <- plot_df$score_mean
    x_min_obs <- suppressWarnings(min(c(x_raw, corte_sd_val), na.rm = TRUE))
    x_max_obs <- suppressWarnings(max(c(x_raw, corte_sd_val), na.rm = TRUE))
    y_min_obs <- suppressWarnings(min(c(y_raw, corte_score_val), na.rm = TRUE))
    y_max_obs <- suppressWarnings(max(c(y_raw, corte_score_val), na.rm = TRUE))

    x_span_lo <- max(corte_sd_val - x_min_obs, 0.35)
    x_span_hi <- max(x_max_obs - corte_sd_val, 0.35)
    y_span_lo <- max(corte_score_val - y_min_obs, 3.0)
    y_span_hi <- max(y_max_obs - corte_score_val, 3.0)

    # Priorizamos lectura de puntaje (Y) y damos mas tolerancia visual a la
    # dispersion (X), que funciona mejor como eje orientador que exacto.
    x_min_ref <- max(0, corte_sd_val - x_span_lo * 1.32)
    x_max_ref <- corte_sd_val + x_span_hi * 1.32
    y_min_ref <- max(0, corte_score_val - y_span_lo * 1.08)
    y_max_ref <- min(score_max_disp, corte_score_val + y_span_hi * 1.08)

    .map_norm <- function(v, cut, lo, hi) {
      v <- as.numeric(v)
      out <- rep(NA_real_, length(v))
      d_lo <- max(cut - lo, 1e-6)
      d_hi <- max(hi - cut, 1e-6)
      i_lo <- which(v <= cut)
      i_hi <- which(v > cut)
      if (length(i_lo)) out[i_lo] <- -1 + (v[i_lo] - lo) / d_lo
      if (length(i_hi)) out[i_hi] <- (v[i_hi] - cut) / d_hi
      pmax(-1, pmin(1, out))
    }
    .x_map <- function(v) .map_norm(v, cut = corte_sd_val, lo = x_min_ref, hi = x_max_ref)
    .y_map <- function(v) .map_norm(v, cut = corte_score_val, lo = y_min_ref, hi = y_max_ref)

    plot_df$x_base <- .x_map(x_raw)
    plot_df$y_base <- .y_map(y_raw)
    x_lim <- c(-1, 1)
    y_lim <- c(-1, 1)

    cuadrantes_cfg <- data.frame(
      cuadrante = c("fortaleza", "oportunidad", "debilidad", "amenaza"),
      titulo    = c(
        titulos_out[["fortaleza"]],
        titulos_out[["oportunidad"]],
        titulos_out[["debilidad"]],
        titulos_out[["amenaza"]]
      ),
      subtexto  = c("Puntaje alto + consistente",
                    "Puntaje alto + disperso",
                    "Puntaje bajo + consistente",
                    "Puntaje bajo + disperso"),
      xmin = c(-1, 0, -1, 0),
      xmax = c(0, 1, 0, 1),
      ymin = c(0, 0, -1, -1),
      ymax = c(1, 1, 0, 0),
      fill = c(col_f, col_o, col_d, col_a),
      stringsAsFactors = FALSE
    )
    cuadrantes_cfg$tx <- (cuadrantes_cfg$xmin + cuadrantes_cfg$xmax) / 2
    cuadrantes_cfg$ty <- cuadrantes_cfg$ymin + (cuadrantes_cfg$ymax - cuadrantes_cfg$ymin) * 0.92
    cuadrantes_cfg$stx <- cuadrantes_cfg$tx
    cuadrantes_cfg$sty <- cuadrantes_cfg$ymin + (cuadrantes_cfg$ymax - cuadrantes_cfg$ymin) * 0.80

    label_display <- as.character(plot_df$label %||% "")
    icono_row_has <- vapply(as.character(plot_df$var), function(.v) {
      .ico <- iconos_map[[.v]]
      !is.null(.ico) && nzchar(as.character(.ico %||% ""))
    }, logical(1))
    label_display[!icono_row_has] <- .foda_compact_label(label_display[!icono_row_has], max_chars = 18L)

    card_w_base <- .dim_clamp(ancho_tarjeta_disp * factor_reduccion_tarjeta_dispersion * 0.37, 0.105, 0.24)
    card_w_cap <- .dim_clamp(card_w_base * 1.45, 0.16, 0.34)
    is_bubble_disp <- identical(forma_bloque_dispersion, "burbuja")
    bubble_icon_only <- is_bubble_disp &&
      identical(icono_modo, "reemplazar") &&
      isTRUE(has_iconos_foda)
    pad_left <- if (bubble_icon_only) 0.008 else 0.012
    pad_right <- if (bubble_icon_only) 0.004 else 0.006
    gap_title_chip <- if (bubble_icon_only) 0.006 else 0.010
    card_w <- rep(card_w_base, n_pts)
    if (isTRUE(ancho_recuadro_auto) && n_pts > 0L) {
      label_seed <- label_display
      if (nzchar(cruce)) {
        is_total_lbl <- !is.na(plot_df$is_total) & plot_df$is_total
        if (identical(disposicion_recuadro, "dos_lineas")) {
          label_seed <- ifelse(
            is_total_lbl,
            label_display,
            ifelse(
              nchar(as.character(plot_df$grupo), type = "width") > nchar(as.character(plot_df$label), type = "width"),
              as.character(plot_df$grupo), label_display
            )
          )
        } else if (identical(disposicion_recuadro, "sin_cruce")) {
          label_seed <- label_display
        } else {
          label_seed <- ifelse(is_total_lbl, label_display, paste0(label_display, " · ", as.character(plot_df$grupo)))
        }
      }
      chars_lbl <- nchar(label_seed, type = "width")
      chip_need_auto <- 0.028 + pmax(1, nchar(plot_df$score_txt, type = "width")) * 0.0080
      txt_need_auto <- 0.026 + pmin(chars_lbl, 52) * 0.0058
      w_need <- pad_left + txt_need_auto + gap_title_chip + chip_need_auto + pad_right
      card_w <- pmin(card_w_cap, pmax(card_w_base, w_need))
    }
    card_h <- .dim_clamp((if (n_pts > 26L) 0.082 else 0.095) * factor_reduccion_tarjeta_dispersion, 0.055, 0.12)
    bubble_r_geom <- rep(NA_real_, n_pts)
    if (is_bubble_disp) {
      # En burbuja damos mas aire para icono + chip sin solapes visuales.
      card_h <- .dim_clamp(
        card_h * (if (bubble_icon_only) 1.08 else 1.20 + 0.14 * .dim_clamp(icono_size_foda, 0.40, 2.60)),
        if (bubble_icon_only) 0.072 else 0.080,
        if (bubble_icon_only) 0.165 else 0.19
      )
      .size_boost <- .dim_clamp(icono_size_foda, 0.40, 2.60)
      bubble_r_base <- pmax(
        card_h * if (bubble_icon_only) 0.54 else 0.58,
        card_h * ((if (bubble_icon_only) 0.46 else 0.50) + 0.17 * .size_boost)
      ) * radio_burbuja_rel
      bubble_r_base <- pmax(if (bubble_icon_only) 0.040 else 0.045, pmin(if (bubble_icon_only) 0.34 else 0.42, bubble_r_base))
      bubble_r_geom <- rep(bubble_r_base, n_pts)
      card_w <- pmax(card_w, bubble_r_geom * if (bubble_icon_only) 1.92 else 2.08)
    }

    if (n_pts > 0) {
      idx <- seq_len(n_pts)
      plot_df$x_card <- plot_df$x_base + jitter_x_rel * sin(idx * 2.399 + 0.7)
      plot_df$y_card <- plot_df$y_base + jitter_y_rel * cos(idx * 1.913 + 0.2)
    } else {
      plot_df$x_card <- numeric(0)
      plot_df$y_card <- numeric(0)
    }

    half_h_eff <- if (is_bubble_disp) bubble_r_geom + 0.010 else card_h / 2
    pad_x <- if (is_bubble_disp) bubble_r_geom + 0.016 else card_w / 2 + 0.012
    pad_y <- half_h_eff + 0.012
    title_band_q <- if (bubble_icon_only) 0.16 else 0.20
    axis_gap <- if (is_bubble_disp) pmax(0.014, half_h_eff * 0.10) else pmax(0.008, half_h_eff * 0.08)
    q_ymax <- stats::setNames(cuadrantes_cfg$ymax, cuadrantes_cfg$cuadrante)
    q_ymin <- stats::setNames(cuadrantes_cfg$ymin, cuadrantes_cfg$cuadrante)
    y_cap_by_q <- as.numeric(q_ymax[as.character(plot_df$cuadrante)]) - title_band_q - half_h_eff
    y_floor_by_q <- as.numeric(q_ymin[as.character(plot_df$cuadrante)]) + half_h_eff
    y_cap_by_q[!is.finite(y_cap_by_q)] <- y_lim[2] - pad_y
    y_floor_by_q[!is.finite(y_floor_by_q)] <- y_lim[1] + pad_y

    score_side <- .dim_round_half_up(plot_df$score_mean, 0)
    cut_side <- .dim_round_half_up(corte_score_val, 0)
    is_score_alto <- as.numeric(score_side) >= as.numeric(cut_side)
    y_floor_by_score <- ifelse(is_score_alto, 0 + half_h_eff + axis_gap, y_lim[1] + pad_y)
    y_cap_by_score <- ifelse(is_score_alto, y_lim[2] - pad_y, 0 - half_h_eff - axis_gap)

    y_floor_row <- pmax(y_lim[1] + pad_y, y_floor_by_q, y_floor_by_score)
    y_cap_row <- pmin(y_lim[2] - pad_y, y_cap_by_q, y_cap_by_score)
    bad_span <- y_floor_row > y_cap_row
    if (any(bad_span, na.rm = TRUE)) {
      y_mid <- (y_floor_row + y_cap_row) / 2
      y_floor_row[bad_span] <- y_mid[bad_span] - 1e-4
      y_cap_row[bad_span] <- y_mid[bad_span] + 1e-4
    }
    if (n_pts > 0) {
      plot_df$x_card <- pmin(pmax(plot_df$x_card, x_lim[1] + pad_x), x_lim[2] - pad_x)
      plot_df$y_card <- pmin(pmax(plot_df$y_card, y_floor_row), y_cap_row)
    }

    # Micro-offset deterministico para pares casi coincidentes (evita montes exactos).
    if (is_bubble_disp && n_pts > 1L) {
      xs_pre <- as.numeric(plot_df$x_card)
      ys_pre <- as.numeric(plot_df$y_card)
      for (i in seq_len(n_pts - 1L)) {
        for (j in seq.int(i + 1L, n_pts)) {
          dx <- xs_pre[j] - xs_pre[i]
          dy <- ys_pre[j] - ys_pre[i]
          d <- sqrt(dx * dx + dy * dy)
          near_thr <- 0.35 * (bubble_r_geom[i] + bubble_r_geom[j])
          if (!is.finite(d) || !is.finite(near_thr) || d >= near_thr) next
          s <- if (((i + j) %% 2L) == 0L) 1 else -1
          shift <- pmax(0.004, near_thr * 0.08)
          xs_pre[i] <- xs_pre[i] - s * shift
          xs_pre[j] <- xs_pre[j] + s * shift
          ys_pre[i] <- ys_pre[i] + s * (shift * 0.45)
          ys_pre[j] <- ys_pre[j] - s * (shift * 0.45)
        }
      }
      plot_df$x_card <- pmin(pmax(xs_pre, x_lim[1] + pad_x), x_lim[2] - pad_x)
      plot_df$y_card <- pmin(pmax(ys_pre, y_floor_row), y_cap_row)
    }

    # Empuje iterativo simple para reducir colisiones.
    if (n_pts > 1L && iter_separacion > 0L) {
      xs <- as.numeric(plot_df$x_card)
      ys <- as.numeric(plot_df$y_card)
      if (!is_bubble_disp) iter_separacion <- max(iter_separacion, 28L)
      for (it in seq_len(iter_separacion)) {
        for (i in seq_len(n_pts - 1L)) {
          for (j in seq.int(i + 1L, n_pts)) {
            dx <- xs[j] - xs[i]
            dy <- ys[j] - ys[i]
            min_dx <- if (is_bubble_disp) {
              (bubble_r_geom[i] + bubble_r_geom[j]) * 1.08
            } else {
              (card_w[i] + card_w[j]) / 2 + 0.024
            }
            min_dy <- if (is_bubble_disp) (bubble_r_geom[i] + bubble_r_geom[j]) * 1.05 else card_h + 0.020
            if (!is.finite(dx) || !is.finite(dy) || !is.finite(min_dx) || !is.finite(min_dy)) next
            if (abs(dx) < min_dx && abs(dy) < min_dy) {
              sx <- ifelse(dx >= 0, 1, -1)
              sy <- ifelse(dy >= 0, 1, -1)
              overlap_x <- min_dx - abs(dx)
              overlap_y <- min_dy - abs(dy)
              if (is_bubble_disp) {
                move_x <- overlap_x * 0.42
                move_y <- overlap_y * 0.30
              } else if (overlap_y <= overlap_x * 1.10) {
                move_x <- overlap_x * 0.14
                move_y <- overlap_y * 0.66
              } else {
                move_x <- overlap_x * 0.58
                move_y <- overlap_y * 0.24
              }
              xs[i] <- xs[i] - sx * move_x
              xs[j] <- xs[j] + sx * move_x
              ys[i] <- ys[i] - sy * move_y
              ys[j] <- ys[j] + sy * move_y
            }
          }
        }
        if (is_bubble_disp) {
          # Mantener cercania con coordenadas originales (respeta senal de dispersion/puntaje).
          xs <- xs * 0.95 + as.numeric(plot_df$x_base) * 0.05
          ys <- ys * 0.76 + as.numeric(plot_df$y_base) * 0.24
        }
        xs <- pmin(pmax(xs, x_lim[1] + pad_x), x_lim[2] - pad_x)
        ys <- pmin(pmax(ys, y_floor_row), y_cap_row)
      }

      if (!is_bubble_disp) {
        max_iter_no_overlap <- max(24L, as.integer(iter_separacion) * 2L)
        for (it in seq_len(max_iter_no_overlap)) {
          moved_any <- FALSE
          for (i in seq_len(n_pts - 1L)) {
            for (j in seq.int(i + 1L, n_pts)) {
              dx <- xs[j] - xs[i]
              dy <- ys[j] - ys[i]
              min_dx <- (card_w[i] + card_w[j]) / 2 + 0.024
              min_dy <- card_h + 0.020
              if (abs(dx) >= min_dx || abs(dy) >= min_dy) next
              sx <- ifelse(dx >= 0, 1, -1)
              sy <- ifelse(dy >= 0, 1, -1)
              overlap_x <- min_dx - abs(dx) + 1e-04
              overlap_y <- min_dy - abs(dy) + 1e-04
              if (overlap_y <= overlap_x * 1.15) {
                ys[i] <- ys[i] - sy * (overlap_y / 2)
                ys[j] <- ys[j] + sy * (overlap_y / 2)
                xs[i] <- xs[i] - sx * (overlap_x * 0.10)
                xs[j] <- xs[j] + sx * (overlap_x * 0.10)
              } else {
                xs[i] <- xs[i] - sx * (overlap_x / 2)
                xs[j] <- xs[j] + sx * (overlap_x / 2)
                ys[i] <- ys[i] - sy * (overlap_y * 0.12)
                ys[j] <- ys[j] + sy * (overlap_y * 0.12)
              }
              moved_any <- TRUE
            }
          }
          xs <- pmin(pmax(xs, x_lim[1] + pad_x), x_lim[2] - pad_x)
          ys <- pmin(pmax(ys, y_floor_row), y_cap_row)
          if (!moved_any) break
        }
      }

      # Post-ajuste radial en burbuja: no permitir superposicion entre pares.
      if (is_bubble_disp) {
        max_iter_no_overlap <- max(16L, as.integer(iter_separacion) * 2L)
        for (it in seq_len(max_iter_no_overlap)) {
          moved_any <- FALSE
          for (i in seq_len(n_pts - 1L)) {
            for (j in seq.int(i + 1L, n_pts)) {
              dx <- xs[j] - xs[i]
              dy <- ys[j] - ys[i]
              d <- sqrt(dx * dx + dy * dy)
              ri <- bubble_r_geom[i]
              rj <- bubble_r_geom[j]
              min_allowed <- (ri + rj) + 1e-4
              if (!is.finite(d) || !is.finite(min_allowed) || d >= min_allowed) next

              if (d < 1e-6) {
                ang <- ((i * 37 + j * 17) %% 360) * pi / 180
                ux <- cos(ang)
                uy <- sin(ang)
              } else {
                ux <- dx / d
                uy <- dy / d
              }
              delta <- (min_allowed - d) / 2
              xs[i] <- xs[i] - ux * delta
              xs[j] <- xs[j] + ux * delta
              ys[i] <- ys[i] - uy * delta
              ys[j] <- ys[j] + uy * delta
              moved_any <- TRUE
            }
          }
          if (is_bubble_disp) {
            xs <- xs * 0.96 + as.numeric(plot_df$x_base) * 0.04
            ys <- ys * 0.80 + as.numeric(plot_df$y_base) * 0.20
          }
          xs <- pmin(pmax(xs, x_lim[1] + pad_x), x_lim[2] - pad_x)
          ys <- pmin(pmax(ys, y_floor_row), y_cap_row)
          if (!moved_any) break
        }
      }
      plot_df$x_card <- xs
      plot_df$y_card <- ys
    }

    chip_h_base <- if (is_bubble_disp) {
      card_h * (if (bubble_icon_only) 0.50 else 0.58)
    } else {
      card_h * 0.70
    }
    chip_h <- pmin(
      if (is_bubble_disp) card_h * 0.86 else card_h * 0.92,
      chip_h_base * padding_chip_rel_foda * (1 + 0.45 * padding_chip_label_lineas_foda)
    )
    chip_w_target <- card_w * .dim_clamp(
      ancho_chip_rel,
      if (bubble_icon_only) 0.04 else 0.06,
      if (bubble_icon_only) 0.40 else 0.58
    )
    chip_w_need <- (0.020 + pmax(1, nchar(plot_df$score_txt, type = "width")) * 0.0072) *
      padding_chip_rel_foda * (1 + 0.28 * padding_chip_label_lineas_foda)
    chip_w <- pmin(
      card_w * if (bubble_icon_only) 0.38 else 0.50,
      pmax(chip_w_target, chip_w_need)
    )
    plot_df$card_w <- card_w
    plot_df$chip_w <- chip_w
    plot_df$chip_h <- chip_h
    plot_df$chip_x <- plot_df$x_card + (card_w / 2) - (chip_w / 2) - pad_right
    plot_df$title_x <- plot_df$x_card - (card_w / 2) + pad_left
    txt_w <- pmax(0.12, (plot_df$chip_x - chip_w / 2) - plot_df$title_x - gap_title_chip)
    wrap_w <- if (is_bubble_disp) {
      pmax(
        if (bubble_icon_only) 7L else 8L,
        as.integer(floor((2 * bubble_r_geom) * (if (bubble_icon_only) 44 else 50)))
      )
    } else {
      pmax(9L, as.integer(floor(txt_w * 82)))
    }

    if (is_bubble_disp) {
      if (nzchar(cruce)) {
        is_total_lbl <- !is.na(plot_df$is_total) & plot_df$is_total
        if (identical(disposicion_recuadro, "dos_lineas")) {
          title_base <- ifelse(is_total_lbl, label_display, paste0(label_display, "\n", as.character(plot_df$grupo)))
        } else if (identical(disposicion_recuadro, "sin_cruce")) {
          title_base <- label_display
        } else {
          title_base <- ifelse(is_total_lbl, label_display, paste0(label_display, " · ", as.character(plot_df$grupo)))
        }
      } else {
        title_base <- label_display
      }
      plot_df$title_txt <- mapply(
        function(tt, ww) .wrap_item_label(tt, width = max(8L, ww), max_lines = 3L),
        title_base, wrap_w, USE.NAMES = FALSE
      )
    } else if (nzchar(cruce)) {
      is_total_lbl <- !is.na(plot_df$is_total) & plot_df$is_total
      if (identical(disposicion_recuadro, "dos_lineas")) {
        line_1 <- mapply(function(tt, ww) .foda_trunc(tt, max_chars = max(12L, ww + 1L)), label_display, wrap_w, USE.NAMES = FALSE)
        line_2 <- mapply(function(tt, ww) .foda_trunc(tt, max_chars = max(9L, ww)), plot_df$grupo, wrap_w, USE.NAMES = FALSE)
        title_txt <- paste0(line_1, "\n", line_2)
      } else if (identical(disposicion_recuadro, "sin_cruce")) {
        title_txt <- mapply(
          function(tt, ww) .foda_trunc(tt, max_chars = max(14L, ww + 3L)),
          label_display, wrap_w,
          USE.NAMES = FALSE
        )
      } else {
        title_txt <- mapply(
          function(tt, gg, ww) .foda_trunc(paste0(tt, " · ", gg), max_chars = max(14L, ww + 3L)),
          label_display, plot_df$grupo, wrap_w,
          USE.NAMES = FALSE
        )
      }
      if (any(is_total_lbl)) {
        title_txt[is_total_lbl] <- mapply(
          function(tt, ww) .foda_trunc(tt, max_chars = max(14L, ww + 3L)),
          label_display[is_total_lbl], wrap_w[is_total_lbl],
          USE.NAMES = FALSE
        )
      }
      plot_df$title_txt <- title_txt
    } else {
      plot_df$title_txt <- mapply(
        function(tt, ww) .wrap_item_label(tt, width = ww, max_lines = 2L),
        plot_df$label, wrap_w, USE.NAMES = FALSE
      )
    }

    # Iconos en dispersion
    plot_df$icono <- vapply(as.character(plot_df$var), function(.v) {
      .ico <- iconos_map[[.v]]
      if (!is.null(.ico) && nzchar(as.character(.ico %||% ""))) as.character(.ico)[1] else ""
    }, character(1))
    if (has_iconos_foda && identical(icono_modo, "reemplazar")) {
      .has_ico_row <- nzchar(plot_df$icono)
      plot_df$title_txt[.has_ico_row] <- ""
    }

    size_title_eff <- pmax(2.0, pmin(tamano_texto_tarjeta / 2.30, card_h * 28))
    size_chip_eff <- pmax(2.4, pmin(tamano_texto_chip / 2.45, chip_h * 27))
    if (is_bubble_disp && n_pts > 0L) {
      txt_chars <- pmax(1, nchar(gsub("\n", "", plot_df$title_txt), type = "width"))
      plot_df$title_size <- pmax(
        1.7,
        pmin(
          size_title_eff,
          1.25 + (bubble_r_geom * 13) - (txt_chars / 28)
        )
      )
      is_total_bubble <- if ("is_total" %in% names(plot_df)) {
        !is.na(plot_df$is_total) & as.logical(plot_df$is_total)
      } else {
        rep(FALSE, n_pts)
      }
      if (any(is_total_bubble)) {
        plot_df$title_size[is_total_bubble] <- pmax(
          1.55,
          plot_df$title_size[is_total_bubble] * 0.86
        )
      }
    } else {
      plot_df$title_size <- rep(size_title_eff, n_pts)
    }
    if (!is_bubble_disp && n_pts > 0L) {
      txt_chars_rect <- pmax(1, nchar(gsub("\n", "", plot_df$title_txt), type = "width"))
      plot_df$title_size <- pmax(
        1.8,
        pmin(
          size_title_eff,
          1.65 + (card_w * 9.8) - pmax(0, txt_chars_rect - 10) / 11
        )
      )
    }

    if (isTRUE(sd_tecnico)) {
      x_break_vals <- sort(unique(c(pretty(c(x_min_ref, x_max_ref), n = 5), corte_sd_val)))
      x_break_vals <- x_break_vals[is.finite(x_break_vals) & x_break_vals >= x_min_ref & x_break_vals <= x_max_ref]
      x_breaks <- .x_map(x_break_vals)
      x_labels <- format(round(x_break_vals, 1), trim = TRUE)
      x_expand_mult <- c(0, 0)
    } else {
      x_breaks <- c(x_lim[1] + 0.03, x_lim[2] - 0.03)
      x_labels <- c("Menor\ndispersion", "Mayor\ndispersion")
      x_expand_mult <- c(0.10, 0.10)
    }

    y_display_max <- min(100, y_max_ref)
    y_break_vals <- sort(unique(c(pretty(c(y_min_ref, y_display_max), n = 5), corte_score_val)))
    y_break_vals <- y_break_vals[is.finite(y_break_vals) & y_break_vals >= y_min_ref & y_break_vals <= y_display_max]
    y_breaks <- .y_map(y_break_vals)
    y_labels <- format(round(y_break_vals, 1), trim = TRUE)

    p_panel <- ggplot2::ggplot() +
      ggplot2::geom_rect(
        data = cuadrantes_cfg,
        ggplot2::aes(xmin = .data$xmin, xmax = .data$xmax, ymin = .data$ymin, ymax = .data$ymax),
        fill = cuadrantes_cfg$fill,
        colour = "#D4DEE9",
        linewidth = 0.55
      ) +
      ggplot2::annotate(
        "segment",
        x = 0, xend = 0, y = y_lim[1], yend = y_lim[2],
        colour = "#7C8FA4", linewidth = 0.6, linetype = "22"
      ) +
      ggplot2::annotate(
        "segment",
        x = x_lim[1], xend = x_lim[2], y = 0, yend = 0,
        colour = "#7C8FA4", linewidth = 0.6, linetype = "22"
      ) +
      ggplot2::annotate(
        "text",
        x = cuadrantes_cfg$tx,
        y = cuadrantes_cfg$ty,
        label = cuadrantes_cfg$titulo,
        fontface = "bold",
        size = size_cuadrante_titulo / 3,
        colour = color_cuadrante_titulo,
        hjust = 0.5, vjust = 1
      )

    if (isTRUE(sd_tecnico)) {
      p_panel <- p_panel +
        ggplot2::annotate(
          "label",
          x = 0,
          y = y_lim[2] - 0.015,
          label = paste0("Corte SD = ", format(round(corte_sd_val, 1), trim = TRUE)),
          fill = "#EEF3F8",
          colour = "#4A5F75",
          linewidth = 0,
          size = (size_items - 1) / 3,
          vjust = 1
        )
    }

    p_panel <- p_panel +
      ggplot2::annotate(
        "label",
        x = x_lim[1] + 0.012,
        y = 0,
        label = paste0("Corte puntaje = ", format(round(corte_score_val, 1), trim = TRUE)),
        fill = "#EEF3F8",
        colour = "#4A5F75",
        linewidth = 0,
        size = (size_items - 1) / 3,
        hjust = 0,
        vjust = -0.2
      )

    if (isTRUE(mostrar_subtitulo_area)) {
      p_panel <- p_panel +
        ggplot2::annotate(
          "text",
          x = cuadrantes_cfg$stx,
          y = cuadrantes_cfg$sty,
          label = cuadrantes_cfg$subtexto,
          fontface = "plain",
          size = (size_items - 1) / 3.2,
          colour = "#5D6F82",
          hjust = 0.5, vjust = 1
        )
    }

    if (nrow(plot_df)) {
      if (identical(forma_bloque_dispersion, "burbuja")) {
        .size_boost <- .dim_clamp(icono_size_foda, 0.40, 2.60)
        plot_df$bubble_r <- bubble_r_geom
        plot_df$bubble_size <- pmax(8.5, pmin(26, plot_df$bubble_r * 168))
        plot_df$icon_r_disp <- pmin(
          plot_df$bubble_r * ((if (bubble_icon_only) 0.26 else 0.22) + 0.17 * .size_boost),
          plot_df$bubble_r * if (bubble_icon_only) 0.40 else 0.36
        )
        .sep_ci <- pmax(
          plot_df$bubble_r * separacion_chip_icono_rel_foda,
          separacion_chip_icono_min_foda
        )
        .chip_h_est <- pmax(chip_h * if (bubble_icon_only) 1.00 else 1.10, pmin(plot_df$bubble_r * if (bubble_icon_only) 0.48 else 0.56, card_h * 1.00))
        .block_h <- .chip_h_est + .sep_ci + (2 * plot_df$icon_r_disp)
        plot_df$chip_y <- plot_df$y_card - (.block_h / 2 - .chip_h_est / 2)
        plot_df$icon_y <- plot_df$y_card + (.block_h / 2 - plot_df$icon_r_disp)
        is_total_bubble <- if ("is_total" %in% names(plot_df)) {
          !is.na(plot_df$is_total) & as.logical(plot_df$is_total)
        } else {
          rep(FALSE, nrow(plot_df))
        }
        plot_df$title_y <- ifelse(
          is_total_bubble,
          plot_df$y_card + (plot_df$bubble_r * 0.52),
          plot_df$y_card + (plot_df$bubble_r * 0.60)
        )
        p_panel <- p_panel +
          ggplot2::geom_point(
            data = plot_df,
            ggplot2::aes(
              x = .data$x_card, y = .data$y_card,
              fill = .data$card_fill, colour = .data$card_border,
              size = .data$bubble_size
            ),
            shape = 21,
            stroke = 0.48
          ) +
          ggplot2::geom_tile(
            data = plot_df,
            ggplot2::aes(
              x = .data$x_card, y = .data$chip_y,
              fill = .data$sem_color,
              width = .data$chip_w,
              height = .data$chip_h
            ),
            colour = "#24394F",
            linewidth = 0.20
          ) +
          ggplot2::geom_text(
            data = plot_df,
            ggplot2::aes(
              x = .data$x_card, y = .data$chip_y,
              label = .data$score_txt,
              colour = .data$chip_text_col
            ),
            size = size_chip_eff,
            fontface = "bold",
            hjust = 0.5,
            vjust = 0.52,
            lineheight = 0.98
          ) +
          ggplot2::geom_text(
            data = plot_df,
            ggplot2::aes(
              x = .data$x_card, y = .data$title_y,
              label = .data$title_txt, colour = .data$title_col,
              size = .data$title_size
            ),
            hjust = 0.5,
            vjust = 0.5,
            lineheight = 0.86,
            fontface = "bold"
          ) +
          ggplot2::scale_size_identity() +
          ggplot2::scale_fill_identity() +
          ggplot2::scale_colour_identity()
      } else {
        p_panel <- p_panel +
          ggplot2::geom_tile(
            data = plot_df,
            ggplot2::aes(x = .data$x_card, y = .data$y_card, width = .data$card_w),
            height = card_h,
            fill = plot_df$card_fill,
            colour = plot_df$card_border,
            linewidth = 0.56
          ) +
          ggplot2::geom_tile(
            data = plot_df,
            ggplot2::aes(
              x = .data$chip_x, y = .data$y_card,
              fill = .data$sem_color,
              width = .data$chip_w,
              height = .data$chip_h
            ),
            colour = "#24394F",
            linewidth = 0.23
          ) +
          ggplot2::geom_text(
            data = plot_df,
            ggplot2::aes(
              x = .data$title_x, y = .data$y_card,
              label = .data$title_txt, colour = .data$title_col,
              size = .data$title_size
            ),
            hjust = 0,
            vjust = 0.5,
            lineheight = 0.86,
            fontface = "bold"
          ) +
          ggplot2::geom_text(
            data = plot_df,
            ggplot2::aes(x = .data$chip_x, y = .data$y_card, label = .data$score_txt, colour = .data$chip_text_col),
            size = size_chip_eff,
            hjust = 0.5,
            vjust = 0.5,
            lineheight = 1,
            fontface = "bold"
          ) +
          ggplot2::scale_size_identity() +
          ggplot2::scale_fill_identity() +
          ggplot2::scale_colour_identity()
      }
    }

    p_panel <- p_panel +
      ggplot2::coord_cartesian(xlim = x_lim, ylim = y_lim, expand = FALSE, clip = "on") +
      ggplot2::scale_x_continuous(
        breaks = x_breaks,
        labels = x_labels,
        limits = x_lim,
        expand = ggplot2::expansion(mult = x_expand_mult)
      ) +
      ggplot2::scale_y_continuous(
        breaks = y_breaks,
        labels = y_labels,
        limits = y_lim,
        expand = ggplot2::expansion(mult = 0)
      ) +
      ggplot2::labs(x = if (isTRUE(sd_tecnico)) "Desviacion estandar" else NULL, y = "Puntaje")

    # Iconos en tarjetas dispersion
    if (has_iconos_foda && nrow(plot_df)) {
      for (.ii in seq_len(nrow(plot_df))) {
        .ico_path <- plot_df$icono[.ii]
        if (!nzchar(.ico_path %||% "")) next
        .img <- .dim_load_icon_contraste(
          .ico_path,
          tint_color = icono_color_foda,
          aplicar_borde = identical(forma_bloque_dispersion, "burbuja")
        )
        if (is.null(.img)) next
        if (identical(forma_bloque_dispersion, "burbuja")) {
          .br <- plot_df$bubble_r[.ii] %||% (card_h * 0.62)
          icon_r_disp <- plot_df$icon_r_disp[.ii] %||% (.br * 0.28)
          .cx <- plot_df$x_card[.ii]
          .cy <- plot_df$icon_y[.ii] %||% (plot_df$y_card[.ii] + card_h * 0.12)
        } else {
          .tx_left  <- plot_df$title_x[.ii]
          .tx_right <- plot_df$chip_x[.ii] - plot_df$chip_w[.ii] / 2 - gap_title_chip
          .avail_w <- max(0.012, .tx_right - .tx_left)
          icon_r_disp <- pmin(
            card_h * (0.20 + 0.18 * .dim_clamp(icono_size_foda, 0.40, 2.60)),
            .avail_w * 0.46,
            card_h * 0.48
          )
          .cx <- (.tx_left + .tx_right) / 2
          .cy <- plot_df$y_card[.ii]
        }
        p_panel <- p_panel + ggplot2::annotation_custom(
          grid::rasterGrob(.img, interpolate = TRUE),
          xmin = .cx - icon_r_disp, xmax = .cx + icon_r_disp,
          ymin = .cy - icon_r_disp, ymax = .cy + icon_r_disp
        )
      }
    }
  }

  if (identical(modo_foda, "matriz")) {
    p_panel <- p_panel +
      ggplot2::theme_void() +
      ggplot2::theme(
        plot.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
        panel.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
        plot.margin = ggplot2::margin(4, 8, 4, 8)
      )
  } else {
    x_text_size <- max(7, size_items - 1)
    x_text_margin <- if (!isTRUE(sd_tecnico)) ggplot2::margin(t = 7, r = 6, b = 0, l = 6) else ggplot2::margin(t = 4)
    pm_right <- if (!isTRUE(sd_tecnico)) 30 else 8
    pm_left <- if (!isTRUE(sd_tecnico)) 30 else 8
    p_panel <- p_panel +
      ggplot2::theme_minimal(base_size = max(8, size_items)) +
      ggplot2::theme(
        plot.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
        panel.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
        panel.grid.minor = ggplot2::element_blank(),
        panel.grid.major = ggplot2::element_line(colour = "#DCE5EF", linewidth = 0.35),
        axis.title = ggplot2::element_text(colour = "#1B314A", size = max(8, size_items)),
        axis.text.y = ggplot2::element_text(colour = "#334A63", size = max(7, size_items - 1)),
        axis.text.x = ggplot2::element_text(
          colour = "#334A63",
          size = x_text_size,
          margin = x_text_margin,
          lineheight = if (!isTRUE(sd_tecnico)) 0.95 else 1
        ),
        axis.ticks = ggplot2::element_line(colour = "#8AA0B7", linewidth = 0.25),
        plot.margin = ggplot2::margin(4, pm_right, 6, pm_left)
      )
  }

  # --- Non-canvas mode ---
  if (!isTRUE(usar_canvas)) {
    return(.dim_export_canvas(
      p_panel,
      exportar = exportar,
      path_salida = path_salida,
      ancho = ancho, alto = alto, dpi = dpi,
      ppt_append = ppt_append,
      ppt_layout = ppt_layout,
      ppt_master = ppt_master
    ))
  }

  # --- Canvas mode ---
  title_block <- cowplot::ggdraw() +
    cowplot::draw_label(
      label = titulo %||% "",
      x = 0.5, y = if (!is.null(subtitulo) && nzchar(subtitulo)) 0.62 else 0.5,
      hjust = 0.5, vjust = 0.5,
      size = size_titulo,
      colour = color_titulo,
      fontface = "bold"
    ) +
    cowplot::draw_label(
      label = subtitulo %||% "",
      x = 0.5, y = if (!is.null(subtitulo) && nzchar(subtitulo)) 0.28 else 0.5,
      hjust = 0.5, vjust = 0.5,
      size = size_subtitulo,
      colour = color_subtitulo
    )

  # Leyenda de iconos para dispersion + "reemplazar"
  iconos_legend_disp <- if (
    has_iconos_foda &&
    identical(modo_foda, "dispersion") &&
    identical(icono_modo, "reemplazar")
  ) {
    # Construir named list: etiqueta -> icono path (solo vars con icono, sin duplicados)
    .seen_vars <- character(0)
    .ico_leg <- list()
    for (.r in seq_len(nrow(stats_df))) {
      .v <- as.character(stats_df$var[.r])
      if (.v %in% .seen_vars) next
      .seen_vars <- c(.seen_vars, .v)
      .ico <- iconos_map[[.v]]
      if (!is.null(.ico) && nzchar(as.character(.ico %||% ""))) {
        .lbl <- as.character(stats_df$label[.r])
        .ico_leg[[.lbl]] <- as.character(.ico)[1]
      }
    }
    if (length(.ico_leg)) .ico_leg else NULL
  } else NULL

  legend_cruce_block <- if (
    identical(modo_foda, "dispersion") &&
      nzchar(cruce) &&
      length(legend_cruce_labels)
  ) {
    .dim_heat_legend_block(
      labels = legend_cruce_labels,
      colors = legend_cruce_colors,
      size = max(6.6, size_items - 1.1),
      colour = "#4A5F75"
    )
  } else NULL

  legend_icon_block <- if (isTRUE(mostrar_leyenda_iconos) && !is.null(iconos_legend_disp)) {
    .dim_icono_leyenda_block(
      axis_iconos = iconos_legend_disp,
      icon_size = icono_size_leyenda_foda,
      size_text = if (identical(modo_foda, "dispersion")) max(6.4, size_items - 1.4) else max(7, size_items),
      colour_text = "#4A5F75",
      icon_color = icono_color_leyenda_foda,
      max_rows = if (identical(modo_foda, "dispersion")) 1L else 2L,
      row_gap = if (identical(modo_foda, "dispersion")) 0.18 else 0.30,
      compact = identical(modo_foda, "dispersion"),
      icon_height_rel = if (identical(modo_foda, "dispersion")) 0.52 else NULL,
      item_padding = if (identical(modo_foda, "dispersion")) 0.020 else 0.025
    )
  } else NULL

  legend_block <- if (isTRUE(mostrar_leyenda)) {
    if (!is.null(legend_cruce_block) && !is.null(legend_icon_block)) {
      cowplot::plot_grid(legend_cruce_block, legend_icon_block, ncol = 1, rel_heights = c(0.42, 0.58))
    } else if (!is.null(legend_cruce_block)) {
      legend_cruce_block
    } else if (!is.null(legend_icon_block)) {
      legend_icon_block
    } else {
      .dim_heat_legend_block(
        labels = c("Rojo", "Ambar", "Verde"),
        colors = c(sem$rojo, sem$ambar, sem$verde),
        size = max(7, size_items),
        colour = "#4A5F75"
      )
    }
  } else {
    cowplot::ggdraw() + cowplot::theme_nothing()
  }

  caption_block <- cowplot::ggdraw() +
    cowplot::draw_label(
      label = nota_pie %||% "",
      x = 1, y = 0.5,
      hjust = 1, vjust = 0.5,
      size = size_nota_pie,
      colour = color_nota_pie
    )

  h_title   <- canvas_h_title
  has_dual_legend <- !is.null(legend_cruce_block) && !is.null(legend_icon_block)
  has_icon_only_legend <- is.null(legend_cruce_block) && !is.null(legend_icon_block)
  h_legend  <- if (isTRUE(mostrar_leyenda)) {
    if (identical(modo_foda, "dispersion") && has_dual_legend) {
      min(0.16, max(0.075, canvas_h_legend * 1.20))
    } else if (identical(modo_foda, "dispersion") && has_icon_only_legend) {
      min(0.11, max(0.055, canvas_h_legend * 1.05))
    } else if (has_dual_legend) min(0.35, canvas_h_legend * 1.90)
    else if (has_icon_only_legend) min(0.28, canvas_h_legend * 1.25)
    else canvas_h_legend
  } else 0.01
  h_caption <- if (!is.null(nota_pie) && nzchar(nota_pie)) canvas_h_caption else 0.01
  h_panel   <- max(0.01, 1 - (h_title + h_legend + h_caption) - canvas_pad_top)

  canvas <- cowplot::plot_grid(
    .dim_wrap_debug_canvas(title_block,   debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(p_panel,       debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(legend_block,  debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    .dim_wrap_debug_canvas(caption_block, debug_ph_bordes, debug_ph_col, debug_ph_lwd),
    ncol = 1,
    rel_heights = c(h_title, h_panel, h_legend, h_caption)
  )

  attr(canvas, "alto_word_sugerido") <- if (identical(modo_foda, "dispersion")) 3.9 else 3.0
  attr(canvas, "ancho_word_sugerido") <- if (identical(modo_foda, "dispersion")) 6.6 else 6.0

  .dim_export_canvas(
    canvas,
    exportar = exportar,
    path_salida = path_salida,
    ancho = ancho,
    alto = alto,
    dpi = dpi,
    ppt_append = ppt_append,
    ppt_layout = ppt_layout,
    ppt_master = ppt_master
  )
}
