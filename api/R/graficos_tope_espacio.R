# =============================================================================
# graficos_tope_espacio.R — nunca una imagen ilegible: si no cabe, menos filas y el pie lo dice (E3)
# =============================================================================
#
# Prueba con Arte (2026-11-09): la escala del resumen con más de 20 filas salía como imagen de respaldo con las cifras
# montadas unas sobre otras, y un contraste de 40 pares salía igual de apretado. Una imagen donde las cifras se pisan
# no se entrega.
#
# Regla: si las filas no caben en la lámina nativa, se muestran las que caben, en el orden de la regla (las más bajas
# con «bajo umbral», las de más Sin información, las de mayor diferencia en el contraste), y el pie lo dice:
#   «Por espacio, se muestran las 20 más bajas de 22; el resto en otra lámina.»
# El tope es el de la lámina nativa: 20 filas en la escala del resumen (`.LAM_DIV_RESUMEN_MAX_FILAS`) y 14 pares en el
# contraste (o las preguntas que caben en 27 sub-filas con tres o cuatro grupos, `.lam_contraste_cabe`).

#' Pares que caben en el contraste según cuántos grupos compara (el tope de `.lam_contraste_cabe`)
#' @keywords internal
.contraste_tope_filas <- function(k) {
  k <- as.integer(k)[1]
  if (!is.finite(k) || k <= 2L) return(14L)
  as.integer(floor((27 + 0.7) / (k + 0.7)))   # n·k + (n − 1)·0,7 ≤ 27 sub-filas
}

#' Cómo se nombra, en el pie, el orden con que se recortan las filas
#' @param tipo Tipo de la regla de preguntas (o NULL: el orden declarado).
#' @keywords internal
.tope_espacio_criterio <- function(tipo) {
  switch(as.character(tipo %||% "")[1],
    bajo_umbral = "más bajas",
    mayor_sin_info = "con más Sin información",
    mayor_diferencia = , diferencia_minima = "de mayor diferencia",
    "primeras")
}

#' Nota del pie cuando se muestran menos filas por espacio
#' @param k Filas que se muestran. @param n Filas elegidas. @param criterio `.tope_espacio_criterio()`.
#' @keywords internal
.tope_espacio_texto <- function(k, n, criterio) {
  if (identical(criterio, "primeras")) return(sprintf("Por espacio, se muestran las primeras %d de %d; el resto en otra lámina.", k, n))
  sprintf("Por espacio, se muestran las %d %s de %d; el resto en otra lámina.", k, criterio, n)
}

#' Aviso al analista (sin nombrar la serie: dice qué pasó y qué hacer)
#' @keywords internal
.tope_espacio_aviso <- function(k, n) {
  sprintf("%d filas no caben en la lámina: se muestran %d y el pie lo dice; el resto va en otra lámina.", n, k)
}

#' Recorta un contraste a los temas de mayor diferencia que caben (`datos` tidy: eje, grupo, valor)
#'
#' La diferencia es la de la lámina (`.contraste_diferencia` sobre las cifras redondeadas: el primero menos el segundo
#' con dos grupos, el mayor menos el menor con tres o más), en valor absoluto; en un empate gana el orden declarado.
#' @return `list(datos, texto)`; `texto` es NULL si todo cabe.
#' @keywords internal
.contraste_tope_espacio <- function(datos, decimales = 0L) {
  if (!is.data.frame(datos) || !nrow(datos)) return(list(datos = datos, texto = NULL))
  eje <- as.character(datos$eje); grp <- as.character(datos$grupo)
  temas <- if (is.factor(datos$eje)) intersect(levels(datos$eje), unique(eje)) else unique(eje)
  grupos <- if (is.factor(datos$grupo)) intersect(levels(datos$grupo), unique(grp)) else unique(grp)
  tope <- .contraste_tope_filas(length(grupos))
  if (length(temas) <= tope) return(list(datos = datos, texto = NULL))
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  R <- vapply(grupos, function(g) {
    v <- suppressWarnings(as.numeric(datos$valor))[match(paste(temas, g), paste(eje, grp))]
    .pulso_round_half_up(v, dec)
  }, numeric(length(temas)))
  R <- matrix(R, nrow = length(temas))
  dif <- abs(.contraste_diferencia(R)); dif[!is.finite(dif)] <- -Inf
  quedan <- temas[sort(order(-dif, seq_along(temas))[seq_len(tope)])]
  d <- datos[eje %in% quedan, , drop = FALSE]
  if (is.factor(d$eje)) d$eje <- factor(as.character(d$eje), levels = intersect(levels(datos$eje), quedan))
  for (a in setdiff(names(attributes(datos)), c("names", "row.names", "class"))) attr(d, a) <- attr(datos, a)
  .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(tope, length(temas))))
  list(datos = d, texto = .tope_espacio_texto(tope, length(temas), "de mayor diferencia"))
}

#' Recorta las preguntas de la escala del resumen a las que caben, en el orden de la regla
#'
#' @param vars Refs ya elegidas por la regla (en su orden) o declaradas. @param regla Regla del elemento.
#' @return `list(vars, texto)`; `texto` es NULL si todo cabe.
#' @keywords internal
.divergentes_tope_espacio <- function(vars, regla = NULL) {
  v <- as.character(unlist(vars))
  tope <- .LAM_DIV_RESUMEN_MAX_FILAS
  if (length(v) <= tope || any(grepl("\\$\\*$|^\\*$", v))) return(list(vars = vars, texto = NULL))
  tipo <- (.regla_preguntas_normalizar(regla) %||% list(tipo = NULL))$tipo
  .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(tope, length(v))))
  list(vars = utils::head(v, tope), texto = .tope_espacio_texto(tope, length(v), .tope_espacio_criterio(tipo)))
}

#' Une la nota de la regla con la del recorte por espacio
#' @keywords internal
.tope_espacio_unir <- function(texto_regla, texto_tope) {
  t <- c(texto_regla, texto_tope)
  t <- t[!is.na(t) & nzchar(trimws(t))]
  if (length(t)) paste(t, collapse = " ") else NULL
}

#' Pone la nota del recorte en el pie de un gráfico que no lleva especificación de resumen (el dumbbell clásico)
#' @keywords internal
.tope_espacio_al_pie <- function(p, el, texto) {
  if (is.null(texto) || is.null(p)) return(p)
  previa <- attr(p, "note_outside", exact = TRUE) %||% (el$overrides %||% list())$nota_pie %||% el$nota_pie
  previa <- trimws(as.character(previa %||% "")[1])
  attr(p, "note_outside") <- .lam_unir_base(if (is.na(previa) || !nzchar(previa)) NULL else previa, texto)
  p
}
