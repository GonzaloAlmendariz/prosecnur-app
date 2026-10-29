# lamina_dicotomia_como_escala.R — el Sí/No de una sola pregunta se dibuja como una fila de escala (Gonzalo, 2026-10-29:
# «Sí, como C»).
#
# Contabilidad (vf.pdf, «¿Conoce el plan de estudios de la carrera?») y el informe de Arte (lámina 47, «¿Participa en la
# actualización de la malla curricular?») dibujan la Sí/No sola como la escala: la pregunta en su columna a la izquierda,
# el público como rótulo de fila y la barra en la columna de la escala, del mismo largo que todas
# (`.std_geom("likert")$ancho_barra`). El bloque centrado al 85 % del ancho (`.LAM_DICOTOMIA_UNICA_FRAC`) quedaba delgado y
# flotando a media lámina. La espec categórica se pasa a una escala de una fila y la dibuja la multilista de un bloque (`.lam_laminas_multilista`, el camino de la lámina 47 de Arte); las
# cifras son las de la categórica (mismo redondeo que sus rótulos).

#' Espec de escala de una fila con la dicotomía de una categórica
#' @param pregunta Texto de la pregunta (columna de la izquierda); vacío si el título de la lámina ya es la pregunta.
#' @param actor Rótulo de la fila: el público (la base visible); vacío en un informe de una base.
#' @keywords internal
.lam_dicotomia_como_escala <- function(espec, pregunta = NULL, actor = NULL) {
  d <- .lam_dicotomia_datos(espec)
  k <- length(d$rotulos)
  niv <- stats::setNames(d$rotulos, paste0("t", seq_len(k)))
  total <- suppressWarnings(as.numeric(.espec_total_casos(espec))[1])
  fila <- data.frame(item = "q", rotulo = as.character(actor %||% "")[1], N = if (is.finite(total)) total else NA_real_,
                     grupo_id = "q", grupo_titulo = as.character(pregunta %||% "")[1], stringsAsFactors = FALSE)
  for (j in seq_len(k)) fila[[names(niv)[j]]] <- as.numeric(d$largos[j])
  cols <- d$colores
  if (is.null(names(cols)) || !all(d$rotulos %in% names(cols))) cols <- stats::setNames(rep_len(unname(cols), k), d$rotulos)
  e <- preparar_escala(fila, "item", "N", names(niv), niv, var_etiqueta_categoria = "rotulo",
                       var_grupo_id = "grupo_id", var_grupo_titulo = "grupo_titulo",
                       colores_grupos = as.list(cols[d$rotulos]))
  e$cifras[1, ] <- d$cifras
  e
}
