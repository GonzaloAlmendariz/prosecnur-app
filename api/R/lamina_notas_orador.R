# Notas del orador de una lámina (checklist-recetario-desfase-2026-10-26.md, C1).
#
# Una lámina del plan puede traer `meta$notas` (texto o vector de líneas). El PPT las escribe en la página de notas de
# cada lámina física que produjo esa lámina lógica (una escala partida en dos lleva la misma nota en las dos). Sin notas
# no se toca nada: officer no crea la página de notas y el mazo sale byte a byte como antes.
#
# `reporte_ppt_plan` está congelado: marca dónde empieza cada lámina lógica (`.lam_notas_orador_marca`) y, al empezar
# la siguiente y al cerrar el mazo, aplica la pendiente (`.lam_notas_orador_aplicar`).

#' Texto de las notas del orador de una lámina, o `NULL`
#' @keywords internal
.lam_notas_orador_texto <- function(slide) {
  notas <- (slide$meta %||% list())$notas
  if (is.null(notas)) return(NULL)
  notas <- trimws(as.character(unlist(notas, use.names = FALSE)))
  notas <- notas[!is.na(notas) & nzchar(notas)]
  if (!length(notas)) NULL else notas
}

#' Lo que queda pendiente al empezar una lámina lógica: desde qué lámina física y qué notas
#' @keywords internal
.lam_notas_orador_marca <- function(slide, doc) {
  texto <- .lam_notas_orador_texto(slide)
  if (is.null(texto) || !inherits(doc, "rpptx")) return(NULL)
  list(desde = length(doc), texto = texto)
}

#' Escribe las notas pendientes en las láminas físicas agregadas desde la marca
#' @keywords internal
.lam_notas_orador_aplicar <- function(doc, pendiente) {
  if (is.null(pendiente) || !inherits(doc, "rpptx")) return(doc)
  hasta <- length(doc)
  if (hasta <= pendiente$desde) return(doc)
  valor <- if (length(pendiente$texto) == 1L) pendiente$texto else
    do.call(officer::block_list, lapply(pendiente$texto, function(l) officer::fpar(officer::ftext(l))))
  for (k in seq.int(pendiente$desde + 1L, hasta)) {
    doc <- officer::on_slide(doc, k)
    doc <- officer::set_notes(doc, valor, location = officer::notes_location_type("body"))
  }
  officer::on_slide(doc, hasta)
}
