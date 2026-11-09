# =============================================================================
# graficos_regla_desempate.R — dos cifras que se leen igual se desempatan por su valor sin redondear (P7)
# =============================================================================
#
# Prueba con Arte (resumen ejecutivo, 2026-11-09): la escala «bajo 60%» elige 22 preguntas y la lámina admite 20. El
# recorte dejó fuera docentes$p15_1 (57,4 % de Top Two Box) y conservó estudiantes$p24_2 (58,1 %): las dos se rotulan
# 58 % (las unidades de la lámina suman 100) y el empate lo decidía el orden de entrada, es decir, la base. La regla mide
# sobre las cifras que se leen (un umbral de 60 no deja fuera a una que se lee 59) y, entre las que se leen igual, manda
# el valor sin redondear: el mismo Top Two Box sobre todos los que responden, «Sin información» incluido.
#
# El valor sin redondear lleva seis decimales más que los de la lámina: el ruido del punto flotante (16,4 − 1,4) no
# desempata, y en un empate exacto sigue mandando el orden del instrumento.

#' La métrica de la regla sobre los valores sin redondear (sólo desempata)
#'
#' @param tipo Tipo de regla. @param ind Indicadores; si traen `valor_fino` (la escala, cuyo `valor` ya viene con las
#'   unidades de la lámina) se usa en lugar de `valor`.
#' @param V,S Matrices tema × grupo de valor y «Sin información» sin redondear. @param completo Temas con valor en todos.
#' @return Vector alineado con `temas`.
#' @keywords internal
.regla_preguntas_metrica_fina <- function(tipo, ind, temas, grupos, V, S, completo, dec = 0L) {
  k <- length(grupos)
  if (!length(temas) || !k) return(rep(NA_real_, length(temas)))
  if ("valor_fino" %in% names(ind)) {
    vf <- suppressWarnings(as.numeric(ind$valor_fino)); tema <- as.character(ind$tema); grp <- as.character(ind$grupo)
    for (i in seq_along(temas)) for (j in seq_len(k)) {
      w <- which(tema == temas[i] & grp == grupos[j])
      if (length(w) && is.finite(vf[w[1]])) V[i, j] <- vf[w[1]]
    }
  }
  fila <- function(M, f) apply(M, 1, function(r) if (any(is.finite(r))) f(r[is.finite(r)]) else NA_real_)
  dif <- rep(NA_real_, length(temas))
  if (k >= 2L && any(completo)) dif[completo] <- abs(.contraste_diferencia(V[completo, , drop = FALSE]))
  out <- switch(tipo,
    mayor_diferencia = dif, diferencia_minima = dif,
    mayor_sin_info = fila(S, max),
    bajo_umbral = fila(V, min),
    extremos = fila(V, mean),
    if (k >= 2L) dif else V[, 1])
  round(as.numeric(out), dec + 6L)
}
