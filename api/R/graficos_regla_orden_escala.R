# =============================================================================
# graficos_regla_orden_escala.R — la regla fija el orden de la escala del resumen (ADR 0135, decisión del 2026-11-07)
# =============================================================================
#
# En la escala del resumen (`p_barras_divergentes`, estilo resumen) la regla dice también cómo se leen las filas,
# como el resumen de Arte del cliente («Ordenado por Top Two Box», la de menor acuerdo primero):
#
#   - `bajo_umbral`: por Top Two Box, de menor a mayor (la más crítica arriba).
#   - `mayor_sin_info`: por «Sin información», de mayor a menor (desempata el Top Two Box, como la especificación).
#
# Sólo cuando el slot no declaró `orden`: un orden declarado se respeta y la regla no escribe su criterio en el pie.
# La regla ordena sus seleccionadas (también las agregadas a mano) y la lámina las dibuja en ese orden (`declarado`),
# así que el conteo, la lámina nativa y el respaldo no pueden discrepar.

.REGLA_ESCALA_ORDEN <- c(bajo_umbral = "top_two_box_asc", mayor_sin_info = "sin_informacion")
.REGLA_ESCALA_ORDEN_PIE <- c(top_two_box_asc = "Ordenado por Top Two Box, de menor a mayor.",
                             sin_informacion = "Ordenado por Sin información.")

#' El criterio de orden que fija la regla en la escala del resumen, o `NULL`
#'
#' @param el Elemento construido. @param regla Regla del elemento (por defecto, la suya).
#' @return `"top_two_box_asc"`, `"sin_informacion"` o `NULL` (otro tipo, otra regla u orden declarado).
#' @keywords internal
.regla_escala_orden_fijado <- function(el, regla = el$regla) {
  if (!identical(el$.element_type, "barras_divergentes")) return(NULL)
  ov <- el$overrides %||% list()
  if (!identical(ov$estilo, "resumen") || !is.null(ov$orden)) return(NULL)
  tipo <- (.regla_preguntas_normalizar(regla) %||% list(tipo = "todas"))$tipo
  if (!tipo %in% names(.REGLA_ESCALA_ORDEN)) return(NULL)
  unname(.REGLA_ESCALA_ORDEN[[tipo]])
}

#' Ordena las seleccionadas con el criterio de la regla y añade el criterio a la nota
#'
#' @param ev Evaluación de `.regla_preguntas_evaluar()`. @param indicadores Tabla de indicadores (tema, valor, sin_info).
#' @param criterio Resultado de `.regla_escala_orden_fijado()`.
#' @keywords internal
.regla_escala_ordenar <- function(ev, indicadores, criterio) {
  temas <- as.character(ev$temas)
  if (length(temas) > 1L) {
    i <- match(temas, as.character(indicadores$tema))
    valor <- suppressWarnings(as.numeric(indicadores$valor[i]))
    si <- suppressWarnings(as.numeric(indicadores$sin_info[i]))
    pos <- seq_along(temas)
    o <- switch(criterio,
      top_two_box_asc = order(ifelse(is.finite(valor), valor, Inf), pos),
      sin_informacion = order(-ifelse(is.finite(si), si, -Inf), -ifelse(is.finite(valor), valor, -Inf), pos),
      pos)
    ev$temas <- temas[o]
    # Una sola fila no tiene orden que declarar: el criterio va al pie desde dos.
    pie <- .REGLA_ESCALA_ORDEN_PIE[[criterio]]
    ev$texto <- if (nzchar(ev$texto %||% "")) paste(ev$texto, pie) else pie
  }
  ev
}

#' En el render: si la regla fijó el orden, la lámina dibuja las filas en el orden de la regla
#' @keywords internal
.regla_escala_orden_args <- function(args, el) {
  if (!is.null(.regla_escala_orden_fijado(el))) args$orden <- "declarado"
  args
}
