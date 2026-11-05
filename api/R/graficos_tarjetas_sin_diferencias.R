# graficos_tarjetas_sin_diferencias.R — la lámina con tarjetas activas que no encuentra ninguna lo dice (ADR 0129)
#
# Revisión del PPT v7.25 de CCSS, lámina 36 (recursos de la Facultad, ítem 5). Gonzalo: «¿se analizó si hay diferencias
# significativas por top2box?». Las tarjetas estaban encendidas sobre el Top Two Box y ninguna diferencia pasó la regla
# del estudio (ADR 0128, Rao-Scott con BH de la familia del informe), así que la lámina salía como si no se hubiera
# preguntado. Ahora escribe una línea discreta sobre «Base:», como el resumen ejecutivo: «Sin diferencias por área,
# nivel, sexo ni estudios de padres en el Top Two Box». Sólo nombra los cruces que se probaron (los que tienen al menos
# dos grupos en la base) y sólo si la prueba corrió: sin cruces o con el diseño inválido no hay frase. La regla y las
# cifras no cambian: es la lectura del mismo cálculo que arma las tarjetas.

#' Qué compara la tarjeta, para la frase sin diferencias: «el Top Two Box», el indicador de una batería sin columna o NULL
#' @keywords internal
.tarjetas_indicador_frase <- function(tipo, sin_columna, espec, ttb = NULL, opt = list()) {
  if (!identical(tipo, "bateria")) return(NULL)
  if (isTRUE(sin_columna)) {
    ind <- .tarjetas_indicador(ttb %||% character(0), opt$indicador)
    return(if (identical(ind, "Top Two Box")) "el Top Two Box" else paste0("«", ind, "»"))
  }
  rot <- as.character(espec$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX)[1]
  if (identical(toupper(rot), toupper(.PPT_ROTULO_TOP_TWO_BOX))) rot <- .PPT_ROTULO_TOP_TWO_BOX
  paste("el", rot)
}

#' La frase de una lámina con tarjetas activas y ninguna diferencia, o NULL
#'
#' @param t Tarjetas calculadas (`.tarjetas_calcular`).
#' @return «Sin diferencias por área, nivel, sexo ni estudios de padres en el Top Two Box.», o NULL si hay tarjetas, si
#'   no se probó ningún cruce o si la lámina no tiene tarjetas activas.
#' @keywords internal
.tarjetas_sin_diferencias_texto <- function(t) {
  if (!is.list(t) || length(t$tarjetas) || !NROW(t$grupos)) return(NULL)
  probados <- intersect(t$cruces %||% character(0), unique(as.character(t$grupos$cruce)))
  if (!length(probados)) return(NULL)
  rot <- unname((t$rotulos_cruce %||% stats::setNames(probados, probados))[probados])
  rot[is.na(rot)] <- probados[is.na(rot)]
  paste0("Sin diferencias por ", .halla_lista_ni(rot), if (!is.null(t$indicador)) paste0(" en ", t$indicador) else "", ".")
}

#' La frase sin diferencias de un gráfico (lee `attr(p, "pulso_tarjetas")`), o NULL
#' @keywords internal
.tarjetas_sin_diferencias_de <- function(p) {
  if (!inherits(p, "ggplot")) return(NULL)
  .tarjetas_sin_diferencias_texto(attr(p, "pulso_tarjetas"))
}

#' La lámina de dos gráficos con alguna ranura con tarjetas activas y ninguna diferencia: su línea sobre «Base:»
#'
#' Si ninguna ranura tiene diferencias y las dos dicen lo mismo, va una sola frase. Si una ranura tiene tarjetas y la otra
#' no, la frase nombra el gráfico al que se refiere («En «Principales motivos…», sin diferencias por …»).
#' @param ts Lo que devuelve `.tarjetas_de_ranuras()`. @param els Elementos de las ranuras (para el título de cada una).
#' @param compone La lámina sin la línea, `function(doc)`.
#' @keywords internal
.lam_slide_2_sin_diferencias <- function(doc, ts, els, compone) {
  nota <- .lam_slide_2_frase_sin(ts, els)
  if (is.null(nota)) return(compone(doc))
  op <- options(prosecnur.lam_reserva_pie = .lam_nota_sig_alto(nota)); on.exit(options(op), add = TRUE)
  doc <- compone(doc)
  options(op)
  .lam_nota_sig_dibujar(doc, nota)
}

#' La frase sin diferencias de una lámina de dos gráficos, o NULL
#' @keywords internal
.lam_slide_2_frase_sin <- function(ts, els = NULL) {
  frases <- lapply(ts, .tarjetas_sin_diferencias_texto)
  sin <- which(!vapply(frases, is.null, TRUE))
  if (!length(sin)) return(NULL)
  hay <- any(vapply(ts, function(t) length(t$tarjetas %||% list()) > 0L, TRUE))
  # Decisión de Gonzalo (v7, ítem 18; S4 4ab83f995): la mitad sin diferencias no lleva filete ni nota. Si una ranura tiene
  # tarjetas, la otra calla; sólo cuando ninguna encuentra diferencias va una línea para toda la lámina.
  if (hay) return(NULL)
  if (length(unique(frases[sin])) == 1L) return(frases[[sin[1]]])
  titulo_de <- function(k) {
    el <- if (k <= length(els)) els[[k]] else NULL
    t <- (el$overrides %||% list())$titulo %||% el$title_slide %||% el$titulo
    if (inherits(t, "ppt_element_text")) t <- t$text
    t <- trimws(as.character(t %||% "")[1])
    if (is.na(t) || !nzchar(t)) NULL else t
  }
  partes <- vapply(sin, function(k) {
    f <- frases[[k]]; t <- titulo_de(k)
    if (is.null(t)) f else paste0("En «", t, "», s", substring(f, 2))
  }, "")
  paste(partes, collapse = " ")
}
