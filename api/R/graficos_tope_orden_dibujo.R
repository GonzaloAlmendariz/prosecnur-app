# =============================================================================
# graficos_tope_orden_dibujo.R — `hasta` y `continuar_desde` cuentan en el orden en que se dibujan las filas (O1)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre "Preguntas con menos de 60 %" (su resumen de Arte revisado a mano): la lámina se lee de
# arriba abajo de la más alta (58 %) a la más baja (28 %), pero `hasta = 11` dejaba en la primera las 11 MÁS BAJAS: el
# recorte contaba en el orden de la métrica de la regla y la lámina dibujaba en otro (`orden = "top_two_box"`, de mayor
# a menor). Regla de la casa: en una serie (`hasta` o `continuar_desde`), las posiciones cuentan en el orden en que se
# dibujan, de arriba abajo. La primera lámina lleva las 11 primeras filas tal como se leen y la segunda las 11 siguientes.
# Sin serie no cambia nada: si no caben todas, se quedan las primeras en la prioridad de la regla (P7).

#' ¿El elemento es parte de una serie declarada por el analista (`hasta` o `continuar_desde`)?
#' @keywords internal
.tope_espacio_en_serie <- function(el) !is.null(el$hasta) || .tope_espacio_desde(el$continuar_desde) > 1L

#' Orden en que la lámina dibuja `temas`, de arriba abajo (índices sobre `temas`)
#'
#' Reproduce el orden del graficador con los valores de la regla: en la escala, `orden` del slot (`top_two_box` de
#' mayor a menor; `sin_informacion`, la de más "Sin información" primero) o, sin orden declarado, el que fija la regla
#' (graficos_regla_orden_escala.R); en el contraste, la diferencia (con o sin signo, `.regla_preguntas_orden_contraste`),
#' el valor del primer grupo o el orden declarado. Los empates, en el orden de `temas`.
#' @param temas Temas en el orden en que llegan. @param ind Indicadores (`tema`, `grupo`, `valor`, `sin_info`).
#' @param el Elemento. @param regla Regla normalizada. @param contraste ¿Contraste (dumbbell resumen)?
#' @param decimales Decimales de la lámina (las cifras redondeadas fijan el orden).
#' @keywords internal
.tope_espacio_orden_dibujo <- function(temas, ind, el, regla, contraste, decimales = 0L) {
  temas <- as.character(temas); pos <- seq_along(temas)
  if (length(temas) < 2L || !is.data.frame(ind) || !nrow(ind)) return(pos)
  ov <- el$overrides %||% list()
  num <- function(x) suppressWarnings(as.numeric(x))
  fin <- function(x, v) ifelse(is.finite(x), x, v)
  if (!isTRUE(contraste)) {
    i <- match(temas, as.character(ind$tema))
    valor <- round(num(ind$valor[i]), decimales); si <- round(num(ind$sin_info[i]), decimales)
    orden <- as.character(ov$orden %||% "")[1]
    if (!nzchar(orden) || identical(orden, "declarado")) {
      criterio <- .regla_escala_orden_fijado(el, regla)
      if (is.null(criterio)) return(pos)
      orden <- if (identical(criterio, "top_two_box_asc")) "top_two_box_asc" else "sin_informacion"
    }
    return(switch(orden,
      top_two_box = order(-fin(valor, -Inf), pos),
      top_two_box_asc = order(fin(valor, Inf), pos),
      sin_informacion = order(-fin(si, -Inf), -fin(valor, -Inf), pos),
      pos))
  }
  if (length(unlist(el$separar_tras %||% ov$separar_tras))) return(pos)   # los separadores fijan el orden declarado
  orden <- .regla_preguntas_orden_contraste(list(estilo = "resumen", orden = ov$orden), regla)$orden %||% "brecha"
  if (identical(orden, "declarado")) return(pos)
  grupos <- unique(as.character(ind$grupo))
  V <- vapply(grupos, function(g) {
    d <- ind[as.character(ind$grupo) == g, , drop = FALSE]
    num(d$valor[match(temas, as.character(d$tema))])
  }, numeric(length(temas)))
  V <- matrix(V, nrow = length(temas))
  if (identical(orden, "valor")) return(order(-fin(V[, 1], -Inf), pos))
  dif <- .contraste_diferencia(matrix(.pulso_round_half_up(V, decimales), nrow(V)))
  if (identical(orden, "brecha_absoluta")) order(-fin(abs(dif), -Inf), pos) else order(-fin(dif, -Inf), pos)
}
