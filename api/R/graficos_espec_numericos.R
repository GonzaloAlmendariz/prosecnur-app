# =============================================================================
# graficos_espec_numericos.R — lo que afirman los gráficos de números (ADR 0093, N4)
# =============================================================================
#
# Capa pura de los gráficos numéricos del recetario (recetario_m3b.R). Los
# renderers nativos (lamina_numericos.R) leen esto y no recalculan.

#' Especificación de un diagrama de caja por grupo (lámina 81, recetario_m3b.R:27-45)
#'
#' Cuartiles con `quantile()` de tipo 7, bigotes a 1.5 RIC acotados por el mínimo y el máximo, y los atípicos
#' fuera de ellos. Los grupos van en el orden de `categoria` (sus niveles si es factor).
#' @param categoria Grupo de cada caso.
#' @param valor Valor numérico de cada caso.
#' @return Lista `boxplot/1` con `grupos` (data.frame: rotulo, n, q1, mediana, q3, bigote_inf, bigote_sup),
#'   `atipicos` (lista por grupo), `rango` (mínimo y máximo de todos los casos).
#' @keywords internal
preparar_boxplot <- function(categoria, valor) {
  valor <- suppressWarnings(as.numeric(valor))
  ok <- !is.na(categoria) & is.finite(valor)
  niveles <- if (is.factor(categoria)) levels(droplevels(categoria[ok])) else unique(as.character(categoria[ok]))
  partes <- split(valor[ok], factor(as.character(categoria[ok]), levels = niveles))
  fila <- function(x) {
    q <- stats::quantile(x, c(.25, .5, .75), names = FALSE); iqr <- q[3] - q[1]
    # Como el recetario: el bigote llega a 1.5 RIC acotado por el mínimo y el máximo de los datos.
    bi <- max(min(x), q[1] - 1.5 * iqr); bs <- min(max(x), q[3] + 1.5 * iqr)
    list(q = q, bi = bi, bs = bs, out = sort(unique(x[x < bi | x > bs])))
  }
  r <- lapply(partes, fila)
  list(version = "boxplot/1", tipo = "boxplot",
       grupos = data.frame(rotulo = names(partes), n = vapply(partes, length, 0L),
                           q1 = vapply(r, function(z) z$q[1], 0), mediana = vapply(r, function(z) z$q[2], 0),
                           q3 = vapply(r, function(z) z$q[3], 0), bigote_inf = vapply(r, `[[`, 0, "bi"),
                           bigote_sup = vapply(r, `[[`, 0, "bs"), stringsAsFactors = FALSE, row.names = NULL),
       atipicos = unname(lapply(r, `[[`, "out")), rango = range(valor[ok]))
}

#' Especificación de una serie de dos mediciones (lámina 87, recetario_m3c.R:47-64)
#'
#' Sólo con exactamente dos períodos y cada serie medida en los dos: con tres o más la serie sigue en ggplot
#' (ADR 0093, N6). El eje va de un múltiplo de 10 a otro con 8 puntos de aire, como `.serie_recetario`; las
#' guías cada 20 si el rango supera 40 puntos. La diferencia se escribe en puntos («-15 pts»).
#' @param df Tabla preparada de la serie (`.serie`, `.periodo`, `.y`).
#' @keywords internal
.espec_serie_dos <- function(df, colores, decimales = 0L, limite_y = NULL) {
  periodos <- levels(df$.periodo)
  if (length(periodos) != 2L) return(NULL)
  series <- levels(droplevels(factor(df$.serie)))
  v <- vapply(series, function(s) vapply(periodos, function(p) {
    x <- df$.y[as.character(df$.serie) == s & as.character(df$.periodo) == p]; if (length(x) == 1L) x else NA_real_
  }, 0), numeric(2))
  v <- matrix(v, nrow = 2L, dimnames = list(periodos, series))
  if (any(!is.finite(v))) return(NULL)
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  lim <- suppressWarnings(as.numeric(limite_y))
  if (length(lim) != 2L || !all(is.finite(lim))) {
    lim <- c(max(0, floor((min(v) - 8) / 10) * 10), min(100, ceiling((max(v) + 8) / 10) * 10))
  }
  d1 <- .pulso_round_half_up(v[2, ], dec) - .pulso_round_half_up(v[1, ], dec)
  list(version = "serie2/1", tipo = "serie2", periodos = periodos, series = series, colores = unname(colores[series]),
       v1 = unname(v[1, ]), v2 = unname(v[2, ]),
       cifras1 = .pulso_fmt_pct_half_up(v[1, ], dec, escala = 1), cifras2 = .pulso_fmt_pct_half_up(v[2, ], dec, escala = 1),
       textos_diferencia = paste0(ifelse(d1 > 0, "+", ""), .pulso_fmt_half_up(d1, dec), " pts"),
       eje = c(lo = lim[1], hi = lim[2], paso = if (diff(lim) > 40) 20 else 10))
}
