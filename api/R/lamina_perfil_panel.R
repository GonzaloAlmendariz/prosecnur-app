# =============================================================================
# lamina_perfil_panel.R — paneles de las láminas mixtas y de perfil como el mazo de Contabilidad
# =============================================================================
#
# checklist-arte-vs-conta-2026-10-29, ítems 18–20 (aprobados por Gonzalo). En «PERFIL DEL DOCENTE / ESTUDIANTE /
# ADMINISTRATIVO» el mazo de Contabilidad dibuja:
#   18. barras de 0,69–0,99 cm (Arte salía con 0,41–0,58 cm) y nunca por debajo del piso de panel (0,66 cm);
#   19. rótulos de categoría a 13 pt, el mismo tamaño en todos los paneles de la lámina (Arte mezclaba 11 y 12);
#   20. la pregunta de cada panel a 16 pt y centrada sobre su panel (Arte: 13 pt a la izquierda).
# El estilo se calcula UNA vez por lámina (`.lam_perfil_plan`) y viaja a cada panel como `estilo`: la compuerta
# (`.lam_mixta_caben`) y el dibujo (`.lam_laminas_mixta`) leen la misma regla. Sin `estilo` todo sigue como antes, así
# que las demás láminas que usan `.lam_panel_titulo` o `.lam_panel_geo` no cambian.
#
# Los valores viven en el estándar, `composicion.perfil` (estandar_pulso.json).

#' Estilo de una lámina mixta: rótulo de categoría, pregunta y su alineación
#' @keywords internal
.lam_perfil_estilo <- function(rotulo_pt = unlist(.std_comp("perfil", "rotulo_pt"))[1]) {
  list(rotulo_pt = rotulo_pt, titulo_pt = .std_comp("perfil", "titulo_pt"), titulo_align = "center")
}

#' Cuánto más baja el gráfico por una pregunta de `estilo$titulo_pt` respecto de una línea a 13 pt
#'
#' `.lam_panel_titulo` escala su caja con el tamaño (0.3 in la primera línea y 0.22 cada una más, a 13 pt).
#' @keywords internal
.lam_perfil_dy <- function(pregunta, w, estilo) {
  size <- estilo$titulo_pt; k <- size / .std_pt("pregunta")
  nl <- .lam_panel_lineas(pregunta, w, size)
  (0.3 + 0.22 * (nl - 1)) * k - 0.3
}

#' Barras horizontales de un panel mixto con el estilo de la lámina (ítems 18 y 19)
#'
#' La fila usa el alto del panel con el tope del recetario; la barra es el 70 % de la fila entre el piso de panel
#' (`.std_piso_panel_in()`) y 0,99 cm, y cabe sólo si deja `composicion.perfil` de aire entre barras y el rótulo
#' (al tamaño de la lámina) entra en su fila.
#' @keywords internal
.lam_perfil_barras_geo <- function(espec, x, y, w, h, dy, alto, receta, estilo, con_pub = FALSE) {
  rb <- receta$barras; fin <- y + h
  n <- max(1L, length(espec$largos))
  # Bajo la caja de la pregunta (0.3 in + `dy`) y su público si lo lleva; la receta de la lámina manda si fija el suyo.
  y0 <- y + (rb$dy %||% (0.3 + (if (con_pub) 0.26 else 0) + .std_comp("perfil", "aire_titulo"))) + dy
  size <- estilo$rotulo_pt
  nb <- .std_negrita_forzada("categorias")
  tope <- if (w <= 4.5) w * 0.55 else min(2.6, w * 0.45)
  if (.lam_reserva_inferior() > 0) tope <- w * 0.55   # con tarjetas debajo (ADR 0129 §6) el rótulo gana ancho en vez de líneas
  tinta <- if (length(espec$rotulos)) max(.lam_ancho_tinta(espec$rotulos, size, nb)) else 0
  wlab <- min(tope, max(rb$wlab %||% 1.2, tinta + 0.3))
  altos <- vapply(espec$rotulos, function(r) .lam_alto_tinta(r, wlab, size, nb), 0)
  # Los topes del recetario (0.42: la cuadrícula); un rótulo que a 13 pt va en dos líneas («Tiempo parcial por asignaturas
  # (TPA)», como en Contabilidad) sube el tope de la fila a lo que mide, si el panel tiene el alto.
  tope_fila <- rb$fila %||% max(if (alto) 0.95 else if (h < 2.5) 0.42 else 0.5, max(c(0, altos)) - 0.07)
  fila <- min(tope_fila, (fin - y0 - .std_comp("perfil", "margen_inf")) / n)
  g <- estilo$grosor_in %||% max(.std_piso_panel_in(), min(.std_comp("perfil", "grosor_max_cm") / 2.54, fila * .std_comp("perfil", "grosor_frac")))
  wcif <- max(0.8, max(c(0, .lam_ancho_txt(espec$cifras, size, TRUE))) + 0.12)
  list(tipo = "barras", x = x, w = w, y0 = y0, fila = fila, g = g, wlab = wlab, size = size, receta = receta, perfil = TRUE,
       cabe = length(espec$largos) >= 1L && fila >= g + .std_comp("perfil", "aire_fila") && all(altos - 0.1 <= fila - 0.02) &&
         w - wlab - wcif >= 0.8)
}

#' El estilo y la geometría de una lámina mixta: un tamaño de rótulo y un grosor para todos sus paneles (ítems 18–19)
#'
#' Prueba 13 pt y baja medio punto mientras eso deje más paneles en piezas nativas; con cada tamaño, si algún panel no
#' cabe, prueba repartir el alto entre las dos filas de paneles (`.lam_perfil_reparto`). El reparto sólo se acepta si
#' lleva paneles del respaldo a barras sin cambiar la forma de ningún otro (un panel que con más alto pasaría a columnas
#' se queda con su respaldo). La barra de la lámina es la más delgada de sus paneles de barras: una sola, como Contabilidad.
#' @return Lista con `geo` (la geometría a dibujar), `estilo` y `caben` (lógico por panel).
#' @keywords internal
.lam_perfil_plan <- function(especs, geo, preguntas, publicos, compartida) {
  geos <- function(est, g) lapply(seq_along(especs), function(k) .lam_perfil_panel_geo(especs[[k]], g$paneles[[k]], preguntas[[k]],
                                                                                      publicos[[k]], !compartida[k], est))
  tipo <- function(x) if (isTRUE(x$cabe)) x$tipo %||% "nativo" else "respaldo"
  mejor <- NULL
  # Con tarjetas por gráfico debajo (ADR 0129 §6) el panel es más bajo: puede bajar hasta 10 pt, como la maqueta.
  tamanos <- unlist(.std_comp("perfil", "rotulo_pt"))
  if (.lam_reserva_inferior() > 0) tamanos <- c(tamanos, unlist(.std_comp("perfil", "rotulo_pt_con_tarjetas")))
  for (s in tamanos) {
    est <- .lam_perfil_estilo(s)
    gs <- geos(est, geo); g <- geo
    t0 <- vapply(gs, tipo, "")
    if (any(t0 == "respaldo")) {
      g2 <- .lam_perfil_reparto(geo, especs, preguntas, publicos, compartida, est)
      if (!identical(g2, geo)) {
        gs2 <- geos(est, g2); t2 <- vapply(gs2, tipo, "")
        nuevos <- t0 == "respaldo" & t2 == "barras"
        # Lo que no pasa a barras se queda como estaba: el panel nativo conserva su forma y el de respaldo, su respaldo.
        if (any(nuevos) && all(t2[t0 != "respaldo"] == t0[t0 != "respaldo"])) {
          gs2[t0 == "respaldo" & !nuevos] <- list(list(cabe = FALSE)); gs <- gs2; g <- g2
        }
      }
    }
    ok <- vapply(gs, function(x) isTRUE(x$cabe), TRUE)
    if (is.null(mejor) || sum(ok) > sum(mejor$caben)) mejor <- list(geo = g, estilo = est, caben = ok, geos = gs)
    if (all(ok)) break
  }
  barras <- Filter(function(x) isTRUE(x$cabe) && identical(x$tipo, "barras") && isTRUE(x$perfil), mejor$geos)
  if (length(barras)) mejor$estilo$grosor_in <- min(vapply(barras, `[[`, 0, "g"))
  mejor$geos <- NULL
  mejor
}

#' La geometría de un panel con el estilo de la lámina (la que leen `.lam_mixta_cabe` y el dibujo)
#' @keywords internal
.lam_perfil_panel_geo <- function(espec, p, pregunta, publico, leyenda, estilo) {
  if (.lam_es_cifra(espec)) return(list(tipo = "cifra", cabe = TRUE))
  if (is.null(espec)) return(list(cabe = FALSE))
  if (!is.null(p$receta$lateral)) {
    q <- .lam_panel_lateral_rect(p)
    return(.lam_panel_geo(espec, q$x, q$y, q$w, q$h, NULL, NULL, leyenda, receta = p$receta, estilo = estilo))
  }
  .lam_panel_geo(espec, p$x, p$y, p$w, p$h, pregunta, publico, leyenda, receta = p$receta, estilo = estilo)
}

#' Reparte el alto entre las dos filas de paneles según lo que pide cada una (ítem 18)
#'
#' Sólo en disposiciones de dos filas sin receta ni cifras. Lo que pide un panel es el alto mínimo con el que cabe
#' (búsqueda binaria); el que no cabe con ningún alto conserva el suyo (irá con su respaldo). Si las dos filas no
#' caben juntas en el alto de hoy, la geometría no cambia.
#' @keywords internal
.lam_perfil_reparto <- function(geo, especs, preguntas, publicos, compartida, estilo) {
  P <- geo$paneles
  if (length(P) < 2L || !is.null(geo$cifras) || any(!vapply(P, function(p) is.null(p$receta), TRUE))) return(geo)
  if (any(vapply(especs, .lam_es_cifra, TRUE))) return(geo)
  ys <- round(vapply(P, `[[`, 0, "y"), 2); filas <- sort(unique(ys))
  if (length(filas) != 2L) return(geo)
  arriba <- which(ys == filas[1]); abajo <- which(ys == filas[2])
  hs <- vapply(P, `[[`, 0, "h")
  if (diff(range(hs[arriba])) > 0.01 || diff(range(hs[abajo])) > 0.01) return(geo)
  h1 <- hs[arriba[1]]; h2 <- hs[abajo[1]]; total <- h1 + h2
  forma <- function(k, h) {
    p <- P[[k]]; p$h <- h
    x <- .lam_perfil_panel_geo(especs[[k]], p, preguntas[[k]], publicos[[k]], !compartida[k], estilo)
    if (isTRUE(x$cabe)) x$tipo %||% "nativo" else "respaldo"
  }
  t0 <- vapply(seq_along(P), function(k) forma(k, P[[k]]$h), "")
  pide <- function(k) {
    # El panel nativo pide el alto con el que conserva su forma; el de respaldo, el que lo lleva a barras.
    meta <- if (identical(t0[k], "respaldo")) "barras" else t0[k]
    cabe <- function(h) identical(forma(k, h), meta)
    if (!cabe(total)) return(P[[k]]$h)
    lo <- 0.5; hi <- total
    for (i in 1:12) { m <- (lo + hi) / 2; if (cabe(m)) hi <- m else lo <- m }
    hi
  }
  pedido <- vapply(seq_along(P), pide, 0)
  # El panel de respaldo que pide más de lo que hay se queda con su respaldo (y su alto): se descarta el que más pide
  # hasta que las dos filas quepan, para que los demás sí lleguen a barras.
  repeat {
    n1 <- max(pedido[arriba]); n2 <- max(pedido[abajo])
    if (n1 + n2 <= total + 1e-9) break
    cand <- which(t0 == "respaldo" & pedido > hs + 1e-9)
    if (!length(cand)) return(geo)
    k <- cand[which.max(pedido[cand])]; pedido[k] <- hs[k]
  }
  H1 <- n1 + (total - n1 - n2) * n1 / (n1 + n2); d <- H1 - h1
  if (abs(d) < 0.01) return(geo)
  fin1 <- filas[1] + h1
  geo$paneles <- lapply(seq_along(P), function(k) {
    p <- P[[k]]
    if (k %in% arriba) p$h <- p$h + d else { p$y <- p$y + d; p$h <- p$h - d }
    p
  })
  geo$filetes <- lapply(geo$filetes, function(f) {
    if (identical(f$tipo, "v")) {
      if (abs(f$y1 - fin1) < 0.05) f$y1 <- f$y1 + d
      if (abs(f$y0 - filas[2]) < 0.05) f$y0 <- f$y0 + d
    } else if (f$y > fin1 - 0.05 && f$y < filas[2] + 0.05) f$y <- f$y + d
    f
  })
  geo
}
