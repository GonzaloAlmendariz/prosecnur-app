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
#'
#' Si `project` viene de `.hojas_ruta_mapa_adelgazar()`, proyecta y adelgaza
#' todos los anillos de la capa en una sola operación vectorizada: anillo por
#' anillo eran miles de llamadas en R por mapa.
#' @keywords internal
.hojas_ruta_mapa_anillos <- function(features, project, transform = NULL) {
  if (!length(features)) return(list(p = list(), feature = integer(0)))
  base <- attr(project, "base")
  if (is.null(transform) && is.function(base)) {
    rings <- lapply(features, function(f) f$rings %||% list())
    feature <- rep.int(seq_along(features), lengths(rings))
    rings <- unlist(rings, recursive = FALSE)
    if (!length(rings)) return(list(p = list(), feature = integer(0)))
    rings <- lapply(rings, as.matrix)
    largo <- vapply(rings, nrow, integer(1))
    id <- rep.int(seq_along(rings), largo)
    p <- base(do.call(rbind, rings))
    tol <- attr(project, "tol")
    kx <- round(p$x / tol)
    ky <- round(p$y / tol)
    n <- length(kx)
    nuevo_anillo <- c(TRUE, id[-1L] != id[-n])
    cambia <- c(TRUE, (kx[-1L] != kx[-n]) | (ky[-1L] != ky[-n]))
    corto <- largo[id] < 4L  # como en el adelgazado por anillo: no se tocan
    keep <- nuevo_anillo | cambia | corto
    keep[is.na(keep)] <- TRUE
    xs <- split(p$x[keep], factor(id[keep], levels = seq_along(rings)))
    ys <- split(p$y[keep], factor(id[keep], levels = seq_along(rings)))
    return(list(p = unname(Map(function(x, y) list2DF(list(x = x, y = y)), xs, ys)),
                feature = feature))
  }
  por_feature <- lapply(features, function(f) {
    lapply(f$rings %||% list(), function(r) project(if (is.null(transform)) r else transform(r)))
  })
  list(p = unlist(por_feature, recursive = FALSE),
       feature = rep.int(seq_along(features), lengths(por_feature)))
}

#' Envuelve una proyección para que adelgace los anillos a la resolución de impresión.
#'
#' El minimapa distrital mide ~4 cm de ancho y recibía el distrito entero manzana
#' por manzana: ~260 000 de los ~288 000 vértices de cada mapa, casi todos a
#' menos de un punto de impresión del anterior. Cada vértice se ajusta a una
#' grilla de `tol` (npc del viewport donde se dibuja) y se descartan los
#' consecutivos que caen en la misma celda. El error máximo es `tol / 2`; con el
#' `tol` del minimapa queda bajo un punto a 300 ppp. Una manzana más chica que
#' la tolerancia queda con uno o dos vértices: un trazo de menos de un punto.
#' @keywords internal
.hojas_ruta_mapa_adelgazar <- function(project, tol) {
  f <- function(ring) {
    p <- project(ring)
    n <- length(p$x)
    if (n < 4L) return(p)
    kx <- round(p$x / tol)
    ky <- round(p$y / tol)
    keep <- c(TRUE, (kx[-1L] != kx[-n]) | (ky[-1L] != ky[-n]))
    keep[is.na(keep)] <- TRUE
    if (all(keep)) return(p)
    list2DF(list(x = p$x[keep], y = p$y[keep]))
  }
  structure(f, base = project, tol = tol)
}
