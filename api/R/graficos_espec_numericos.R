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
