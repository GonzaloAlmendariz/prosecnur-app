# El filtro y su subpregunta en el Word: dos figuras, no la composición del PowerPoint.
#
# En la lámina, el gráfico del filtro y el dependiente van juntos con la llave «Sólo los N que respondieron…»
# (graficos_filtro_subpregunta.R, recetario p192–p194). El Word pegaba esa composición como una sola imagen al ancho de la
# página: la escala quedaba aplastada, la leyenda encimada y «Top Two Box» cortado (Gonzalo, 2026-10-26, Arte_v1-6). Aquí
# cada pieza vuelve a pasar por el registro normal del Word y sale como su propia figura, con su rótulo y su base; el
# título de la subpregunta dice a quiénes se les preguntó, que es lo que en la lámina dice la llave.

#' A quiénes se les hizo la subpregunta, para el título de su figura
#'
#' `frase` es la del analista («que conocen el reglamento»); sin ella, las respuestas que habilitan.
#' @keywords internal
.word_filtro_sub_quien <- function(frase, habilita) {
  frase <- trimws(as.character(frase %||% "")[1])
  if (!is.na(frase) && nzchar(frase)) {
    return(if (grepl("^que ", frase)) paste("sólo quienes", sub("^que ", "", frase)) else paste("sólo", frase))
  }
  habilita <- as.character(unlist(habilita %||% character(0)))
  sprintf("sólo quienes respondieron %s", paste0("«", habilita, "»", collapse = " o "))
}

#' Las dos piezas del filtro y su subpregunta como elementos para el registro del Word, o `NULL` si no se pueden armar
#'
#' Se arman con la misma función que la lámina (`.fsub_elementos`): el dependiente ya trae el filtro de quienes lo
#' habilitan, así que su base es la de ellos.
#' @param el El elemento `filtro_subpregunta`.
#' @param plot El gráfico compuesto de la lámina (su espec trae los dos gráficos y los enunciados).
#' @return `list(list(el, plot), list(el, plot))` o `NULL`.
#' @keywords internal
.word_filtro_sub_piezas <- function(el, plot) {
  pz <- tryCatch(.fsub_elementos(el), error = function(e) NULL)
  if (is.null(pz)) return(NULL)
  espec <- attr(plot, "pulso_espec") %||% list()
  dep <- pz$el_s
  pregunta <- trimws(as.character(espec$pregunta_sub %||% "")[1])
  if (is.na(pregunta) || !nzchar(pregunta)) pregunta <- .fsub_enunciado(pz$ctx_s)
  pregunta <- sub("[.]\\s*$", "", pregunta)   # «pertinente (sólo quienes…)», no «pertinente. (sólo…)»
  dep$title_slide <- NULL
  dep$overrides <- dep$overrides %||% list()
  dep$overrides$titulo <- sprintf("%s (%s)", pregunta, .word_filtro_sub_quien(el$frase, espec$habilita %||% el$habilita))
  list(list(el = pz$el_f, plot = espec$plot_filtro %||% plot),
       list(el = dep, plot = espec$plot_sub %||% plot))
}
