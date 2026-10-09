# =============================================================================
# graficos_espec_divergentes.R — lo que afirman las barras divergentes (ADR 0093, N3; lámina 71)
# =============================================================================
#
# Reglas de recetario_m3a.R:50-77: el desacuerdo crece a la izquierda del centro y
# el acuerdo a la derecha; cada lado suma sus cifras rotuladas (el de acuerdo es el
# Top Two Box, como la lámina 19); «SIN INF» no entra en ningún lado y va en su
# columna a la derecha; las afirmaciones se ordenan por el lado de acuerdo, de mayor
# a menor. Si la escala tiene neutro, se parte en el centro.

.DIVERGENTES_ESPECIAL <- "^(SIN INF|Sin información|No sabe|NS/NR|No responde|No aplica)"

#' Especificación de unas barras divergentes
#'
#' @param data,var_categoria,cols_porcentaje,etiquetas Los del graficador.
#' @param particion Resultado de `.divergentes_reparto()` (negativas, neutro, positivas).
#' @return Lista `divergentes/1` con `filas` (rótulo por afirmación, ya ordenadas), `categorias` (col, rotulo, color,
#'   lado), `unidades` y `cifras` (matriz filas x categorías), `total_neg`/`total_pos` (sumas rotuladas) y `sin_inf`.
#' @keywords internal
.espec_divergentes <- function(data, var_categoria, cols_porcentaje, etiquetas, particion, escala_valor = "proporcion_100",
                               decimales = 0L, colores = NULL) {
  rot <- unname(etiquetas[cols_porcentaje]); rot[is.na(rot)] <- cols_porcentaje[is.na(rot)]
  especial <- grepl(.DIVERGENTES_ESPECIAL, rot, ignore.case = TRUE)
  lado <- ifelse(especial, "sin_inf", ifelse(cols_porcentaje %in% particion$negativas, "neg",
                 ifelse(cols_porcentaje %in% particion$neutro, "neu", "pos")))
  P <- vapply(cols_porcentaje, function(c) suppressWarnings(as.numeric(data[[c]])), numeric(nrow(data)))
  P <- matrix(P, nrow = nrow(data)); P[!is.finite(P)] <- 0
  if (identical(escala_valor, "proporcion_100")) P <- P / 100
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  U <- t(apply(P, 1, function(r) .pulso_pct_unidades(r, dec, "estandar")))
  if (ncol(P) == 1L) U <- t(U)
  cifras <- matrix(.pulso_fmt_pct_unidades(U, dec), nrow(U))
  tn <- rowSums(U[, lado == "neg", drop = FALSE]); tp <- rowSums(U[, lado == "pos", drop = FALSE])
  o <- order(-tp, seq_along(tp))
  cols_pal <- colores %||% unname(.std_paleta("likert"))[seq_along(cols_porcentaje)]
  list(version = "divergentes/1", tipo = "divergentes",
       filas = as.character(data[[var_categoria]])[o],
       categorias = data.frame(col = cols_porcentaje, rotulo = rot, color = rep_len(unname(cols_pal), length(rot)), lado = lado, stringsAsFactors = FALSE),
       unidades = U[o, , drop = FALSE], cifras = cifras[o, , drop = FALSE],
       total_neg = tn[o], total_pos = tp[o], cifras_neg = .pulso_fmt_pct_unidades(tn[o], dec), cifras_pos = .pulso_fmt_pct_unidades(tp[o], dec),
       decimales = dec)
}
