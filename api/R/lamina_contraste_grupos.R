# =============================================================================
# lamina_contraste_grupos.R — el contraste y las aperturas con tres o cuatro grupos se leen por pregunta (S7)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre «Diferencias por ciclo» (tres ciclos, siete preguntas): «al ser tres y tantas premisas no
# queda claro cuál es cuál». Las sub-filas de una pregunta y las de la siguiente iban al mismo paso. Regla:
#   - el hueco entre preguntas es al menos un paso de sub-fila (de la última sub-fila de una pregunta a la primera de la
#     siguiente hay al menos dos pasos; `.lam_contraste_geom`);
#   - un filete fino entre preguntas, nunca entre las sub-filas de una misma pregunta;
#   - el rótulo, centrado en el bloque de sus sub-filas;
#   - con más de ocho preguntas la lámina avisa que se puede partir en dos con "Continuar desde". Nunca se parte sola.
#     Gonzalo dejó "Diferencias por ciclo" (tres grupos, siete preguntas) en UNA lámina: partida en 4 y 3 se veía vacía.

#' Preguntas a partir de las cuales (más de) la lámina con tres o cuatro grupos avisa
#' @keywords internal
.LAM_CONTRASTE_GRUPOS_AVISO <- 8L

#' Filete fino entre dos preguntas del contraste con grupos
#' @keywords internal
.lam_contraste_separador <- function(lz, m, y) {
  .lam_linea(lz, m$ml, y, m$xr, y, .std_color("filete"), pt = 0.5, nombre = "puntos:filete_pregunta")
}

#' Con tres o cuatro grupos y más de ocho preguntas, el aviso que sugiere partir la lámina (sin partirla)
#' @keywords internal
.lam_contraste_grupos_aviso <- function(espec) {
  k <- length(espec$grupos); n <- length(espec$rotulos)
  if (identical(espec$modo, "par") || k < 3L || n <= .LAM_CONTRASTE_GRUPOS_AVISO) return(invisible(FALSE))
  num <- c("tres", "cuatro")[k - 2L]
  .pulso_aviso(.aviso_en_lamina(sprintf("Con %s grupos y %d preguntas la lectura se aprieta; puedes partirla en dos láminas con \"Continuar desde\".", num, n)))
  invisible(TRUE)
}

#' La serie del contraste en su especificación (S6): rótulos y eje de todas las preguntas que elige la regla, y cuántas
#' lleva la más larga de las dos láminas
#'
#' Con `hasta` en la primera y `continuar_desde` en la segunda, las dos eligen la columna sobre los rótulos de la serie,
#' dibujan el mismo eje y reparten el alto como si llevaran `m_max` preguntas: el paso de sub-fila y el hueco entre
#' preguntas son los mismos en las dos.
#' @keywords internal
.contraste_serie_en_espec <- function(p, el, vars_serie, sources, args) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (!is.list(espec) || !identical(espec$tipo, "contraste") || (is.null(el$continuar_desde) && is.null(el$hasta)) || is.null(el$regla)) return(p)
  if (length(vars_serie) <= length(espec$rotulos)) return(p)
  es <- tryCatch({
    d <- if (!is.null(el$cruce)) {
      .dumbbell_grupos_datos(.resumen_temas_cortos(.dumbbell_grupos_temas(vars_serie, sources)), el$corte, el$cruce, el$grupos, sources,
                             filtros = el$filtros %||% list())
    } else .radar_mb_datos(.resumen_temas_cortos(vars_serie), el$corte, sources, filtros = el$filtros %||% list())
    a2 <- args; a2$data <- d
    attr(suppressMessages(do.call(graficar_dumbbell, a2)), "pulso_espec")
  }, error = function(e) NULL)
  if (!is.list(es) || !length(es$rotulos)) return(p)
  m <- length(espec$rotulos); n <- length(es$rotulos); d <- .tope_espacio_desde(el$continuar_desde)
  espec$serie <- list(rotulos = es$rotulos, eje = es$eje, m_max = max(m, d - 1L, n - (d - 1L) - m))
  attr(p, "pulso_espec") <- espec
  p
}

#' En una serie, el contenido de la lámina con las preguntas que le faltan para llegar a `m_max` (de una línea)
#' @keywords internal
.lam_contraste_serie_contenido <- function(espec, contenido, una) {
  m_max <- espec$serie$m_max %||% length(contenido)
  c(contenido, rep(una, max(0L, m_max - length(contenido))))
}
