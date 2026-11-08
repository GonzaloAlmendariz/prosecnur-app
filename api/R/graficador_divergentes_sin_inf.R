# =============================================================================
# graficador_divergentes_sin_inf.R — «Sin información» en su columna en el respaldo ggplot de la escala (ADR 0135, U5)
# =============================================================================
#
# La lámina nativa pone «Sin información» en una columna aparte, a la derecha del acuerdo. El respaldo en ggplot (Word y
# `motor_nativo = FALSE`) la apilaba pegada al lado de acuerdo y se leía como más acuerdo. Aquí va en su propia columna:
# después del acuerdo más largo, con un hueco, en el gris de lo no sustantivo y con su cifra.

#' Posición de la columna de «Sin información»: arranca tras el lado derecho más largo, con un hueco
#'
#' @param df_si Filas `.lado == "sin_inf"` (`.item`, `.cat`, `.valor`).
#' @param df Las demás filas (las del apilado), para medir el lado derecho.
#' @param tope Límite del eje sin la columna.
#' @return `list(df = df_si con .x (centro) y .w (ancho), tope)`; `df` vacío si no hay nada que dibujar.
#' @keywords internal
.divergentes_sin_inf_columna <- function(df_si, df, tope) {
  if (is.null(df_si) || !nrow(df_si) || !any(df_si$.valor > 0)) return(list(df = df_si[0, , drop = FALSE], tope = tope))
  der <- df$.signo[df$.signo > 0]
  der_max <- if (length(der)) max(stats::aggregate(df$.signo[df$.signo > 0], by = list(df$.item[df$.signo > 0]), FUN = sum)$x) else 0
  hueco <- max(4, 0.06 * tope)
  x0 <- der_max + hueco
  # Una fila puede traer varias no sustantivas: se apilan dentro de la columna, en su orden.
  df_si <- df_si[order(df_si$.item, match(as.character(df_si$.cat), unique(as.character(df_si$.cat)))), , drop = FALSE]
  ini <- stats::ave(df_si$.valor, df_si$.item, FUN = function(v) cumsum(v) - v)
  df_si$.w <- df_si$.valor
  df_si$.x <- x0 + ini + df_si$.valor / 2
  list(df = df_si, tope = max(tope, max(x0 + ini + df_si$.valor) * 1.04))
}

#' Estilo resumen: las no sustantivas de una fila se suman en una sola columna «Sin información» (ADR 0135)
#'
#' En el resumen la columna es el encabezado «Sin información», no el rótulo de cada opción: «SIN INF» y «No sabe» de
#' una misma escala van juntas y la leyenda las nombra una vez. Con una sola no sustantiva no cambia nada.
#' @param df_si Filas `.lado == "sin_inf"`. @param sin_inf Columnas no sustantivas, en su orden.
#' @keywords internal
.divergentes_sin_inf_agrupar <- function(df_si, sin_inf) {
  if (is.null(df_si) || !nrow(df_si) || length(unique(as.character(df_si$.cat))) < 2L) return(df_si)
  suma <- stats::aggregate(df_si$.valor, by = list(.item = df_si$.item), FUN = sum)
  out <- df_si[match(suma$.item, df_si$.item), , drop = FALSE]
  out$.valor <- suma$x; out$.signo <- suma$x
  out$.cat <- factor(sin_inf[1], levels = levels(df_si$.cat) %||% unique(c(sin_inf, as.character(df_si$.cat))))
  rownames(out) <- NULL
  out
}

#' Las cifras de la columna de «Sin información»: dentro si su tinta cabe, encima con guía si no (O3 ola 3)
#'
#' La columna mide lo que su porcentaje (5 % de la escala, ~0.1 in en una lámina de dos gráficos) y la cifra de 14 pt en
#' blanco se salía por los dos lados: sobre el fondo de la lámina no se leía («5%» y «6%» cortados). Igual que las demás
#' cifras de la imagen (`.divergentes_cifras_posiciones`): ninguna se achica ni se oculta.
#' @param lab_si Filas de la columna con `.x`, `.w`, `.item` y `.lab`.
#' @return `p` con las cifras.
#' @keywords internal
.divergentes_sin_inf_cifras <- function(p, lab_si, size_pt, in_por_unidad, grosor, size_valores, color_dentro, color_fuera,
                                        font_family, fontface) {
  lab_si <- lab_si[nzchar(lab_si$.lab), , drop = FALSE]
  if (!nrow(lab_si)) return(p)
  tinta <- .ancho_texto_in(lab_si$.lab, size_pt)
  dentro <- lab_si$.w * in_por_unidad >= tinta + 0.06
  lab_si$.y <- as.numeric(lab_si$.item)
  if (any(dentro)) {
    p <- p + ggplot2::geom_text(data = lab_si[dentro, , drop = FALSE], ggplot2::aes(x = .data$.x, y = .data$.y, label = .data$.lab),
                                inherit.aes = FALSE, size = size_valores, colour = color_dentro, family = font_family, fontface = fontface)
  }
  if (any(!dentro)) {
    f <- lab_si[!dentro, , drop = FALSE]
    f$.gy0 <- f$.y + grosor / 2; f$.ty <- f$.y + grosor / 2 + 0.06; f$.gy1 <- f$.ty - 0.01
    p <- p +
      ggplot2::geom_segment(data = f, ggplot2::aes(x = .data$.x, xend = .data$.x, y = .data$.gy0, yend = .data$.gy1), inherit.aes = FALSE,
                            colour = .std_color("texto_tenue"), linewidth = 0.3) +
      ggplot2::geom_text(data = f, ggplot2::aes(x = .data$.x, y = .data$.ty, label = .data$.lab), inherit.aes = FALSE, vjust = 0,
                         size = size_valores, colour = color_fuera, family = font_family, fontface = fontface)
  }
  p
}

#' Filas de la leyenda de la divergente imagen para que quepa en el ancho del lienzo (O3 ola 3)
#'
#' Cada clave mide su rótulo al cuerpo de la leyenda más la caja de color y su aire (~0.55 in). Sin ancho conocido, una fila.
#' @keywords internal
.divergentes_leyenda_filas <- function(rotulos, size_pt, ancho = NULL) {
  a <- suppressWarnings(as.numeric(ancho)[1])
  rot <- as.character(unname(rotulos)); rot <- rot[!is.na(rot) & nzchar(rot)]
  if (!length(a) || !is.finite(a) || a <= 0 || !length(rot)) return(1L)
  w <- .ancho_texto_in(rot, size_pt) + 0.55
  if (anyNA(w)) return(1L)
  disp <- a - 0.5
  for (n in seq_len(length(rot))) {
    por_fila <- ceiling(length(rot) / n)
    filas <- split(w, ceiling(seq_along(w) / por_fila))
    if (all(vapply(filas, sum, 0) <= disp)) return(as.integer(n))
  }
  length(rot)
}
