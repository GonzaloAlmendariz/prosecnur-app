# =============================================================================
# Lienzo "Sin datos" e íconos PNG compartidos por los graficadores
#
# Rescatados sin cambios de `graficador_dimensiones.R` antes de borrarlo
# (ADR 0137, fase 2). Los consumen, detrás de `exists()`:
#   - `.blank_canvas()` de `reporte_plan_ppt.R`: el lienzo en blanco de todos los
#     gráficos (`.dim_blank_canvas`, `.dim_wrap_debug_canvas`);
#   - `graficador_radar.R` (`p_radar`) y `dashboard_dimensiones.R`: los íconos
#     de los ejes y su leyenda.
# `test-graficos-lienzo-iconos.R` falla si alguno de estos `exists()` deja de
# resolver, porque entonces caerían en silencio a su respaldo.
# =============================================================================

#' Envuelve un bloque de dimensiones con el plano de la guia
#'
#' Este archivo tenia el TERCER sistema de guia del paquete: dibujaba el marco
#' —ya con el color y el grosor de la guia— pero sin una sola cota, mientras
#' barras, pie y radar acotaban cada caja. Un marco sin medida no deja comprobar
#' nada, que es justo lo que la guia viene a permitir.
#'
#' Ahora delega en `.guia_envolver_bloque()`. Sin `ancho_in`/`alto_in` no hay
#' cota posible y sale solo el marco, que es el comportamiento de antes: por eso
#' los dos llamadores que envuelven el canvas ENTERO —y que no saben su tamaño
#' en pulgadas— siguen funcionando sin tocarlos.
#'
#' @param g Bloque de `cowplot`/`ggplot`.
#' @param debug_ph_bordes Si `FALSE`, devuelve el bloque intacto.
#' @param debug_ph_col,debug_ph_lwd Estilo.
#' @param etiqueta,nota Ver `.guia_ph_grobs()`.
#' @param ancho_in,alto_in Tamaño FISICO del bloque, en pulgadas.
#' @param cota_ancho,rotulo_derecha Ver `.guia_ph_grobs()`.
#' @keywords internal
.dim_wrap_debug_canvas <- function(g, debug_ph_bordes = FALSE,
                                   debug_ph_col = .GUIA_COL,
                                   debug_ph_lwd = .GUIA_LWD,
                                   etiqueta = NULL, nota = NULL,
                                   ancho_in = NA_real_, alto_in = NA_real_,
                                   cota_ancho = TRUE, rotulo_derecha = FALSE) {
  if (!isTRUE(debug_ph_bordes)) return(g)
  .guia_envolver_bloque(
    g,
    ancho_in = ancho_in, alto_in = alto_in,
    etiqueta = etiqueta, nota = nota,
    col = debug_ph_col %||% .GUIA_COL,
    lwd = debug_ph_lwd %||% .GUIA_LWD,
    cota_ancho = cota_ancho, rotulo_derecha = rotulo_derecha
  )
}


#' @keywords internal
.dim_blank_canvas <- function(
    mensaje = "Sin datos para mostrar",
    debug_ph_bordes = FALSE,
    debug_ph_col = .GUIA_COL,
    debug_ph_lwd = .GUIA_LWD
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
