# =============================================================================
# lamina_resumen_diferencias_paginas.R — paginación por capítulos y rótulos en una línea del resumen de diferencias
# =============================================================================
#
# Revisión del PPT v7.23 de CCSS, lámina 55 (ítem 13). Gonzalo: «puede ir en dos slides si se puede ver algo mejor;
# además los ejes de corte lo ideal es que no se corten en sus etiquetas».
#
#   - Paginación: si todas las filas no caben con aire (renglón de al menos `.LAM_RESUMEN_H_AIRE`), la tabla se reparte en
#     el menor número de láminas que lo permite, por capítulos enteros (un capítulo nunca se parte) y lo más parejas
#     posible. Cada fila conserva su cálculo: sólo cambia en qué lámina cae. Todas las láminas usan el mismo alto de
#     renglón, repiten el encabezado de cruces y grupos, la leyenda y la base; la segunda y siguientes llevan «(cont.)».
#   - Rótulos de grupo en una línea: cada columna mide lo que su rótulo corto (los `cortos` del plan o la etiqueta del
#     grupo) pide en una línea. Si ni bajando el cuerpo a 8.5 pt caben, se vuelve a partir en dos líneas y se avisa.
#   - El rótulo de la fila puede ir en dos líneas cuando no cabe en una: con la paginación hay alto para hacerlo sin
#     recortarlo con «…».

.LAM_RESUMEN_H_AIRE <- 0.24  # renglón mínimo con aire (in); por debajo, la tabla se pagina
.LAM_RESUMEN_H_MAX <- 0.3    # renglón máximo (in)
.LAM_RESUMEN_H_MIN <- 0.17   # renglón mínimo absoluto; por debajo se quitan filas (sólo un capítulo que no cabe solo)
.LAM_RESUMEN_FILA_DOBLE <- 1.6  # una fila con el rótulo en dos líneas ocupa 1.6 renglones
.LAM_RESUMEN_CAPITULO <- 0.85   # el rótulo del capítulo ocupa 0.85 renglones

#' Líneas del rótulo de una fila: una si cabe, dos si no (la segunda recortada con «…» si aún no cabe)
#' @keywords internal
.lam_resumen_fila_lineas <- function(rotulo, w, pt = 10) {
  lin <- .lam_tyc_envolver(rotulo, w, pt)
  if (length(lin) <= 2L) return(lin)
  resto <- paste(lin[-1], collapse = " ")
  c(lin[1], .lam_dif_recortar(resto, w, pt)$texto)
}

#' Renglones que ocupa un capítulo: su rótulo y cada fila (1 o `.LAM_RESUMEN_FILA_DOBLE` si el rótulo va en dos líneas)
#' @keywords internal
.lam_resumen_unidades <- function(cap, w_rot) {
  filas <- vapply(cap$filas, function(f) if (length(.lam_resumen_fila_lineas(f$rotulo, w_rot)) > 1L) .LAM_RESUMEN_FILA_DOBLE else 1, numeric(1))
  .LAM_RESUMEN_CAPITULO + sum(filas)
}

#' Reparte los capítulos en láminas: el menor número que deja renglones de `h_aire`, lo más parejas posible
#'
#' @param u Renglones de cada capítulo (`.lam_resumen_unidades`). @param disponible Alto para filas en una lámina (in).
#' @return Lista de vectores de índices de capítulos, uno por lámina, en orden y sin partir capítulos.
#' @keywords internal
.lam_resumen_paginar <- function(u, disponible, h_aire = .LAM_RESUMEN_H_AIRE) {
  n <- length(u)
  if (!n) return(list())
  cap_u <- disponible / h_aire
  if (sum(u) <= cap_u) return(list(seq_len(n)))
  # Todas las particiones contiguas en P partes (n es chico: capítulos de un informe); la de menor máximo gana.
  particiones <- function(desde, P) {
    if (P == 1L) return(list(list(desde:n)))
    out <- list()
    for (fin in desde:(n - P + 1L)) for (r in particiones(fin + 1L, P - 1L)) out[[length(out) + 1L]] <- c(list(desde:fin), r)
    out
  }
  for (P in 2:n) {
    cands <- particiones(1L, P)
    maximos <- vapply(cands, function(pp) max(vapply(pp, function(i) sum(u[i]), numeric(1))), numeric(1))
    if (min(maximos) <= cap_u) return(cands[[which.min(maximos)]])
  }
  as.list(seq_len(n))   # cada capítulo en su lámina; el que no quepa con aire queda más apretado
}

#' Ancho de cada columna de grupo con su rótulo en una línea, y el cuerpo con que cabe
#'
#' Prueba 9.5, 9 y 8.5 pt: la primera con la que las columnas dejan al menos `w_rot_min` al rótulo de la fila.
#' @return `list(piso, pt, una_linea)`; con `una_linea = FALSE` el piso es el de antes (palabra más larga, dos líneas).
#' @keywords internal
.lam_resumen_pisos <- function(cortos, disponible, w_rot_min = 2.6) {
  cortos <- as.character(cortos)
  for (pt in c(9.5, 9, 8.5)) {
    piso <- pmax(0.62, .lam_ancho_tinta(cortos, pt, TRUE) + 0.16)
    if (sum(piso) <= disponible - w_rot_min) return(list(piso = unname(piso), pt = pt, una_linea = TRUE))
  }
  piso <- vapply(cortos, function(s) {
    pal <- strsplit(s, "\\s+")[[1]]
    w <- max(0.62, if (length(pal)) max(.lam_ancho_tinta(pal, 9.5, TRUE)) + 0.16 else 0)
    while (length(.lam_tyc_envolver(s, w - 0.12, 9.5, TRUE)) > 2L && w < 1.6) w <- w + 0.02
    w
  }, numeric(1), USE.NAMES = FALSE)
  list(piso = piso, pt = 9.5, una_linea = FALSE)
}
