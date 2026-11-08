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
