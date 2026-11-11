# =============================================================================
# ppt_titulo_cabe.R — el título de una lámina cabe en dos líneas
# =============================================================================
#
# En la ruta de la plantilla el título se escribe al tamaño del perfil (24 pt en ACNUR) dentro de un cuadro de dos
# líneas. Una pregunta larga ("Aunque usted no trabajó durante los últimos 7 días, ¿tenía usted algún trabajo…?")
# ocupaba tres y la última se montaba sobre el gráfico (checklist-informe-acnur-2026-11-11, P7). El tamaño baja de a
# un punto, medido con la tinta real (`.lam_lineas_tinta`), hasta que el título cabe en dos líneas o llega al piso.

#' Tamaño del título de lámina que cabe en `max_lineas`
#'
#' @param text Título.
#' @param pt Tamaño del perfil.
#' @param ancho_in Ancho del cuadro del título, en pulgadas; sin él no se ajusta.
#' @param aplica `FALSE` para portada y separadores, que tienen su propio cuadro.
#' @keywords internal
.ppt_titulo_pt_que_cabe <- function(text, pt, ancho_in = NULL, aplica = TRUE, bold = FALSE,
                                    max_lineas = 2L, piso = 16) {
  pt <- suppressWarnings(as.numeric(pt)[1])
  if (!is.finite(pt) || is.na(pt) || pt <= 0) pt <- 24
  w <- suppressWarnings(as.numeric(ancho_in)[1])
  txt <- as.character(text %||% "")[1]
  if (!isTRUE(aplica) || !is.finite(w) || is.na(w) || w <= 0.5 || is.na(txt) || !nzchar(trimws(txt))) return(pt)
  while (pt > piso && .lam_lineas_tinta(txt, w, pt, bold) > max_lineas) pt <- pt - 1
  pt
}
