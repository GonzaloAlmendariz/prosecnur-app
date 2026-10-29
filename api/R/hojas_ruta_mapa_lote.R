# Polígonos del mapa de contexto de la ficha, dibujados en lote.
#
# El mapa de la página 2 de cada ficha dibujaba cada anillo de cada manzana con
# su propio `grid.polygon()`: cientos de grobs por hoja, cada uno validando su
# gpar y registrándose en el display list. Era el grueso del tiempo de la ficha
# PDF y el ZIP lo paga una vez por UMP. `grid.polygon(id = …)` acepta un gpar
# vectorizado —un fill, un color y un grosor por polígono— y dibuja en el orden
# de `id`, así que agrupar no cambia la imagen: el mismo orden, los mismos
# estilos, una sola llamada.

#' Dibuja en una sola llamada una lista de anillos ya proyectados.
#'
#' @param proyectados lista de `data.frame`/listas con `x` e `y` (npc).
#' @param fill,col,lwd un valor por anillo (o uno para todos).
#' @param ... otros parámetros de `grid::gpar` comunes a todos.
#' @keywords internal
.hojas_ruta_mapa_poligonos <- function(proyectados, fill = NA, col = "black", lwd = 1, ...) {
  n <- length(proyectados)
  if (!n) return(invisible(FALSE))
  rep_n <- function(v) if (length(v) == 1L) rep(v, n) else v
  fill <- rep_n(fill); col <- rep_n(col); lwd <- rep_n(lwd)
  largo <- vapply(proyectados, function(p) length(p$x), integer(1))
  keep <- largo >= 2L
  if (!any(keep)) return(invisible(FALSE))
  proyectados <- proyectados[keep]
  largo <- largo[keep]
  grid::grid.polygon(
    x = unlist(lapply(proyectados, `[[`, "x"), use.names = FALSE),
    y = unlist(lapply(proyectados, `[[`, "y"), use.names = FALSE),
    id = rep.int(seq_along(proyectados), largo),
    default.units = "npc",
    gp = grid::gpar(fill = fill[keep], col = col[keep], lwd = lwd[keep], ...)
  )
  invisible(TRUE)
}

#' Anillos proyectados de una lista de features, con el índice de su feature.
#' @keywords internal
.hojas_ruta_mapa_anillos <- function(features, project, transform = NULL) {
  if (!length(features)) return(list(p = list(), feature = integer(0)))
  por_feature <- lapply(features, function(f) {
    lapply(f$rings %||% list(), function(r) project(if (is.null(transform)) r else transform(r)))
  })
  list(p = unlist(por_feature, recursive = FALSE),
       feature = rep.int(seq_along(features), lengths(por_feature)))
}
