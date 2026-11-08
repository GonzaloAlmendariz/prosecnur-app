# Leyenda de la agrupada que cabe en el ancho de su lienzo.
#
# Ola 2, Q1 (qa_r7/blank/l6_cruce.pptx): la agrupada con cruce en una lámina de varios gráficos dibuja la leyenda en
# una sola fila. Con rótulos largos («Tiempo completo (TC)», «Tiempo parcial por asignaturas (TPA)» a 14 pt) la fila
# mide 16.5 cm en un lienzo de 12.7: el primer cuadro queda fuera del recorte y rvg lo escribe con geometría no finita
# (`<a:off x="2147483647">`, `<a:ext cx="-2147483648">`). Ese rectángulo azul tapa la lámina entera y PowerPoint pide
# reparar el archivo.
#
# Contrato: la leyenda horizontal se parte en filas hasta que su ancho cabe en el lienzo; el alto reservado para la
# leyenda crece con las filas que agrega. Nunca se achica la letra.

#' Ancho y alto (pulgadas) de la tabla de claves de una leyenda de ggplot
#' @keywords internal
.agrupadas_leyenda_medida_in <- function(leg_grob) {
  if (is.null(leg_grob) || !inherits(leg_grob, "gtable")) return(c(w = NA_real_, h = NA_real_))
  k <- which(leg_grob$layout$name == "guides")
  tabla <- if (length(k)) leg_grob$grobs[[k[1]]] else leg_grob
  if (!inherits(tabla, "gtable")) return(c(w = NA_real_, h = NA_real_))
  med <- function(u, f) tryCatch(sum(f(u, "in", valueOnly = TRUE)), error = function(e) NA_real_)
  c(w = med(tabla$widths, grid::convertWidth), h = med(tabla$heights, grid::convertHeight))
}

#' Leyenda horizontal que cabe en `ancho_in`, partida en filas si hace falta
#'
#' @param construir `function(ncol)` que devuelve el grob de la leyenda con `ncol` claves por fila.
#' @param n_items Número de claves.
#' @param n_por_fila Claves por fila pedidas.
#' @param ancho_in Ancho del lienzo en pulgadas (NA = no se mide).
#' @return Lista `grob`, `ncol`, `extra_h_in` (alto que hay que sumar a la banda de la leyenda).
#' @keywords internal
.agrupadas_leyenda_que_cabe <- function(construir, n_items, n_por_fila, ancho_in) {
  n_items <- max(1L, as.integer(n_items))
  ncol <- max(1L, as.integer(n_por_fila))
  grob <- construir(ncol)   # la primera, tal como se pidió: si cabe, la leyenda no cambia
  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!is.finite(ancho_in) || ancho_in <= 0) return(list(grob = grob, ncol = ncol, extra_h_in = 0))
  m0 <- .agrupadas_leyenda_medida_in(grob)
  if (!is.finite(m0[["w"]]) || m0[["w"]] <= ancho_in) return(list(grob = grob, ncol = ncol, extra_h_in = 0))
  m <- m0
  ncol <- min(ncol, n_items)
  while (ncol > 1L && is.finite(m[["w"]]) && m[["w"]] > ancho_in) {
    ncol <- ncol - 1L
    grob <- construir(ncol)
    m <- .agrupadas_leyenda_medida_in(grob)
  }
  extra <- if (is.finite(m[["h"]]) && is.finite(m0[["h"]])) max(0, m[["h"]] - m0[["h"]]) else 0
  list(grob = grob, ncol = ncol, extra_h_in = extra)
}
