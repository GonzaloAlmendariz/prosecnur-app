# =============================================================================
# lamina_avisos_lineas.R — avisos con el conteo de líneas que parte una lámina o desborda su título (K12b, F6 §4.3c)
# =============================================================================
#
# El motor nativo no encoge la letra: si las premisas no caben, parte la lámina en «(cont.)», y un título largo
# ocupa las líneas que necesite. El analista se enteraba mirando el PPT. Aquí cada compositor lo dice una vez por
# lámina, con el número que lo causó, por el canal sellado de avisos (`.pulso_aviso`, jobs.R) que la vista previa y
# los jobs ya recogen. Las líneas se cuentan como se componen: corte por palabras sobre la tinta de Arial
# (`.lam_lineas_tinta`) en el ancho de la columna de premisas o de la caja del título. Sólo avisa: la lámina no cambia.

#' Título de la lámina para un aviso
#' @keywords internal
.lam_aviso_nombre <- function(titulo) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) "Lámina sin título" else sprintf("“%s”", t)
}

.lam_aviso_lineas_txt <- function(n) sprintf("%d %s", as.integer(n), if (n == 1L) "línea" else "líneas")

#' Avisa que la lámina salió en varias partes, con las líneas de su premisa más alta
#'
#' @param grupos Lista de juegos de premisas (`.lam_escala_premisas`): uno en la escala, uno por bloque en la
#'   multilista; cada juego se mide en el ancho de su propia columna de premisas.
#' @param partes Número de láminas en que salió.
#' @keywords internal
.lam_aviso_partes <- function(titulo, grupos, partes) {
  if (is.null(partes) || partes <= 1L) return(invisible(FALSE))
  n <- max(0L, unlist(lapply(grupos, function(premisas) {
    if (!length(premisas)) return(integer())
    textos <- vapply(premisas, function(p) { x <- as.character(p$texto %||% "")[1]; if (is.na(x)) "" else x }, "")
    .lam_lineas_tinta(textos, .lam_escala_ancho_prem(premisas), .std_pt("pregunta"), TRUE)
  })))
  if (n < 1L) return(invisible(FALSE))
  .pulso_aviso(sprintf("%s: las premisas ocupan hasta %s; salió en %d partes", .lam_aviso_nombre(titulo), .lam_aviso_lineas_txt(n), as.integer(partes)))
}

#' Avisa que el título pasa de dos líneas en su caja (`w` in, a `.std_pt("titulo")` pt en negrita)
#' @keywords internal
.lam_aviso_titulo <- function(titulo, w) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) return(invisible(FALSE))
  n <- .lam_lineas_tinta(t, w, .std_pt("titulo"), TRUE)
  if (n <= 2L) return(invisible(FALSE))
  .pulso_aviso(sprintf("%s: el título ocupa %s", .lam_aviso_nombre(t), .lam_aviso_lineas_txt(n)))
}
