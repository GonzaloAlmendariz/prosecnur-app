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
.LAM_RESUMEN_H_MAX <- 0.4    # renglón máximo (in); v7.25, ítem 9: con la tabla en dos láminas el alto se aprovecha
.LAM_RESUMEN_H_MIN <- 0.17   # renglón mínimo absoluto; por debajo se quitan filas (sólo un capítulo que no cabe solo)
.LAM_RESUMEN_FILA_DOBLE <- 1.45 # una fila con el rótulo en dos líneas ocupa 1.45 renglones (1.6 hasta la v7.25)
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

#' Rótulo de cada grupo del encabezado: el nombre completo cuando cabe (en una o dos líneas), si no el corto
#'
#' Revisión del PPT v7.25 de CCSS, láminas 56 y 57 (ítem 9). Gonzalo: «ya que tienes más espacio y más alto, las
#' etiquetas de cruces no tienen por qué ir resumidas». Cada columna prueba, en orden, el nombre completo en una línea,
#' en dos (corte equilibrado), el corto en una y el corto en dos; parte de la opción más completa y, mientras las
#' columnas no dejen `w_rot_min` al rótulo de la fila, la columna que más ancho libera pasa a su opción siguiente. Si ni
#' así caben, baja el cuerpo a 9 y 8.5 pt.
#' @return `list(piso, pt, lineas, una_linea)`: ancho de cada columna, cuerpo, las líneas de cada rótulo y si todos
#'   caben sin recorte.
#' @keywords internal
.lam_resumen_rotulos_grupo <- function(etiquetas, cortos, disponible, w_rot_min = 2.6, cruces = NULL) {
  etiquetas <- as.character(etiquetas); cortos <- as.character(cortos)
  K <- length(cortos)
  # Los grupos de un mismo cruce van todos completos o todos cortos («Ningún padre univ.» junto a «Algún padre o tutor
  # con estudios universitarios» se lee como dos categorías de distinto rango).
  cruces <- if (length(cruces) == K) as.character(cruces) else as.character(seq_len(K))
  if (!K) return(list(piso = numeric(0), pt = 9.5, lineas = list(), una_linea = TRUE))
  # Dos líneas equilibradas: el corte más angosto que deja dos líneas (NULL si el texto es de una palabra).
  dos <- function(s, pt) {
    a <- .lam_ancho_tinta(s, pt, TRUE)
    for (wl in seq(a / 2, a, length.out = 12L)) { lin <- .lam_tyc_envolver(s, wl, pt, TRUE); if (length(lin) == 2L) return(lin) }
    NULL
  }
  ancho_de <- function(l, pt) max(0.62, max(.lam_ancho_tinta(l, pt, TRUE)) + 0.16)
  ids <- unique(cruces)
  # `w_rot_min` puede traer varios pisos para el rótulo de la fila, del más holgado al mínimo: se prueba el primero con
  # los tres cuerpos y, si no alcanza, el siguiente.
  for (wr in w_rot_min) for (pt in c(9.5, 9, 8.5)) {
    # Por grupo, sus cuatro estados: 1 completo en una línea, 2 completo en la más angosta de una o dos, 3 y 4 igual con
    # el corto. Todos los grupos de un cruce comparten estado.
    # El nombre completo se parte en dos sólo si el estudio le declaró un corto (es largo); el corto se parte sólo en la
    # última pasada: el rótulo de grupo va entero en una línea siempre que se pueda (v7.23, ítem 13).
    ultima <- identical(wr, w_rot_min[length(w_rot_min)])
    est <- lapply(seq_len(K), function(k) {
      f2 <- if (!identical(etiquetas[k], cortos[k])) dos(etiquetas[k], pt) else NULL
      c2 <- if (ultima) dos(cortos[k], pt) else NULL
      o <- list(etiquetas[k], f2 %||% etiquetas[k], cortos[k], c2 %||% cortos[k])
      if (!is.null(f2) && ancho_de(f2, pt) >= ancho_de(etiquetas[k], pt)) o[[2]] <- etiquetas[k]
      if (!is.null(c2) && ancho_de(c2, pt) >= ancho_de(cortos[k], pt)) o[[4]] <- cortos[k]
      list(o = o, w = vapply(o, ancho_de, 0, pt = pt))
    })
    sel <- stats::setNames(rep(1L, length(ids)), ids)
    w_de <- function(sel) vapply(seq_len(K), function(k) est[[k]]$w[sel[[cruces[k]]]], 0)
    while (sum(w_de(sel)) > disponible - wr) {
      gana <- vapply(ids, function(cr) {
        if (sel[[cr]] >= 4L) return(-Inf)
        s2 <- sel; s2[[cr]] <- s2[[cr]] + 1L; sum(w_de(sel)) - sum(w_de(s2))
      }, 0)
      if (all(!is.finite(gana))) break
      # Un paso que no libera ancho (el corto es el mismo nombre) igual se da: avanza al cruce de mayor ganancia.
      sel[[ids[which.max(gana)]]] <- sel[[ids[which.max(gana)]]] + 1L
    }
    if (sum(w_de(sel)) <= disponible - wr + 1e-6) {
      return(list(piso = w_de(sel), pt = pt, lineas = lapply(seq_len(K), function(k) est[[k]]$o[[sel[[cruces[k]]]]]),
                  una_linea = TRUE))
    }
  }
  ps <- .lam_resumen_pisos(cortos, disponible, min(w_rot_min))
  ps$lineas <- NULL   # el encabezado parte el corto como antes
  ps
}

#' Cuerpos de la fila del resumen según el alto del renglón: 10 pt a 0.3 in y hasta 11.5 pt a 0.4 in (v7.25, ítem 9)
#' @return `list(fila, total, pastilla, pastilla_h)`.
#' @keywords internal
.lam_resumen_cuerpos <- function(h) {
  t <- max(0, min(1, (h - 0.3) / 0.1))
  list(fila = round((10 + 1.5 * t) * 2) / 2, total = round((10 + 1.5 * t) * 2) / 2, pastilla = round((9.5 + 1 * t) * 2) / 2,
       pastilla_h = min(0.21 + 0.05 * t, h - 0.035), pastilla_w = 0.72 + 0.1 * t)
}
