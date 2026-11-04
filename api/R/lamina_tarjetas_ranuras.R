# lamina_tarjetas_ranuras.R — tarjetas de diferencias bajo cada gráfico de una lámina de dos gráficos (ADR 0129 §6)
#
# Maqueta «Composición y línea por nivel» (2026-11-04, 07_combinada_transporte_y_tiempo): cada gráfico arriba en su
# mitad; debajo, un filete y hasta dos tarjetas lado a lado dentro de la misma mitad. La mitad sin diferencias no lleva
# nada (ítem 18 de la v7 RV: «quedamos en que no se pone» la nota de «sin diferencias») y su gráfico usa todo el alto
# (ítem 11 de la v7.11 RV: «que uno tenga tarjetas no significa que el otro no pueda usar todo su alto»). Sin ninguna
# tarjeta en la lámina no hay franja. La lámina conserva su base y su pie (uno por lámina).

.TARJETAS_RANURA_SEP <- 0.15     # entre las dos tarjetas de una mitad
.TARJETAS_RANURA_AIRE <- 0.08    # del fin del gráfico al filete y del filete a las tarjetas (las tarjetas llegan al fin del
                                 # contenido: la base va aparte, debajo)

#' ¿La tarjeta va compacta, con el nombre (corto) a la izquierda de su barra? La pide la franja de una lámina de dos
#' gráficos: con el nombre encima, la tarjeta medía casi 3 in y el gráfico no cabía en lo que quedaba.
#' @keywords internal
.lam_tarjeta_compacta <- function() isTRUE(getOption("prosecnur.lam_tarjeta_compacta", FALSE))

#' Reserva inferior de los paneles de `graficos_2` (in): la fija quien compone una lámina con tarjetas por ranura
#' @keywords internal
.lam_reserva_inferior <- function(k = NULL) {
  # Una por mitad (ítem 11 de la v7.11 RV: «que uno tenga tarjetas no significa que el otro no pueda usar todo su alto»);
  # sin `k`, la mayor (el estilo de la lámina, común a sus paneles).
  v <- suppressWarnings(as.numeric(getOption("prosecnur.lam_reserva_inferior", 0)))
  v[is.na(v) | v < 0] <- 0
  if (!length(v)) return(0)
  if (is.null(k)) max(v) else v[min(k, length(v))]
}

#' Receta del panel de una mitad (`prosecnur.lam_recetas_ranura`): la fija quien compone una dicotómica con tarjetas
#' @keywords internal
.lam_receta_ranura <- function(k) {
  r <- getOption("prosecnur.lam_recetas_ranura", NULL)
  if (!is.list(r) || length(r) < k) NULL else r[[k]]
}

#' ¿El gráfico de una mitad se dibuja como franja dicotómica? (la misma prueba que `.lam_panel_geo`)
#' @keywords internal
.lam_ranura_es_dicotomia <- function(espec, col2) {
  is.list(espec) && identical(espec$tipo, "categorica") && isTRUE(tryCatch(.lam_dicotomia_cabe(espec, col2, con_n = FALSE), error = function(e) FALSE))
}

.TARJETAS_DICO_CIFRA <- 30    # cifra de la franja dicotómica con tarjetas (pt)
.TARJETAS_DICO_BARRA <- 0.55  # grosor de su barra (in)
.TARJETAS_DICO_AIRE <- 0.45   # de la franja a sus tarjetas (in)

#' Receta de una franja dicotómica con tarjetas: más grande, a todo el ancho de su mitad, y bajada lo justo para que la
#' franja y sus tarjetas queden centradas en el alto de la mitad (ítem 14 de la v7.11 RV: la mitad quedaba vacía).
#' @keywords internal
.lam_receta_dicotomia_con_tarjetas <- function(alto_panel, alto_tarjetas) {
  franja <- .TARJETAS_DICO_CIFRA * 1.25 / 72 + 0.3 + .TARJETAS_DICO_BARRA
  libre <- alto_panel - 0.65 - franja - .TARJETAS_DICO_AIRE - alto_tarjetas
  # `conserva_estilo`: el título del panel sigue el estilo de la lámina, como el de la otra mitad.
  list(dicotomia = list(dy = 0.65 + max(0, libre / 2), size = .TARJETAS_DICO_CIFRA, g = .TARJETAS_DICO_BARRA, ancho_pleno = TRUE),
       conserva_estilo = TRUE)
}

#' Fin vertical del gráfico de una mitad en la lámina en curso (el borde inferior de sus piezas)
#' @keywords internal
.lam_ranura_fin_grafico <- function(doc, x0, x1) {
  sl <- doc$slide$get_slide(doc$cursor)$get(); ns <- xml2::xml_ns(sl)
  sps <- xml2::xml_find_all(sl, "//p:grpSp[starts-with(p:nvGrpSpPr/p:cNvPr/@name, 'prosecnur:grafico')]//p:sp", ns)
  if (!length(sps)) return(NA_real_)
  off <- xml2::xml_find_first(sps, ".//a:off", ns); ext <- xml2::xml_find_first(sps, ".//a:ext", ns)
  x <- as.numeric(xml2::xml_attr(off, "x")) / .EMU; y <- as.numeric(xml2::xml_attr(off, "y")) / .EMU
  h <- as.numeric(xml2::xml_attr(ext, "cy")) / .EMU
  dentro <- x >= x0 - 0.02 & x < x1
  if (!any(dentro)) NA_real_ else max(y[dentro] + h[dentro])
}

#' Reserva de cada mitad: la franja solo bajo el gráfico que lleva tarjetas
#' @keywords internal
.lam_reservas_por_mitad <- function(ts, reserva) {
  vapply(seq_len(2L), function(k) if (k <= length(ts) && length(ts[[k]]$tarjetas %||% list())) reserva else 0, 0)
}

#' Medidas de la franja de tarjetas: ancho de cada tarjeta y alto de la franja (el de la tarjeta más alta)
#' @keywords internal
.lam_tarjetas_ranuras_medidas <- function(ts, col2) {
  op <- options(prosecnur.lam_tarjeta_compacta = TRUE); on.exit(options(op), add = TRUE)
  cw <- (col2 - .TARJETAS_RANURA_SEP) / 2
  altos <- unlist(lapply(ts, function(t) {
    if (is.null(t) || !length(t$tarjetas)) return(numeric(0))
    vapply(t$tarjetas, .lam_tarjeta_alto, numeric(1), w = cw, cortos = t$opcion$cortos, tipo = t$tipo %||% "multiple")
  }))
  alto <- if (length(altos)) max(altos) else 0
  list(cw = cw, alto = alto, reserva = alto + 2 * .TARJETAS_RANURA_AIRE)
}

#' Dibuja las tarjetas de cada mitad en la lámina en curso
#' @param ts Lo que devuelve `.tarjetas_de_ranuras()`.
#' @keywords internal
.lam_tarjetas_ranuras_dibujar <- function(doc, ts, debajo = c(FALSE, FALSE)) {   # `debajo`: tarjetas pegadas a su franja dicotómica
  op <- options(prosecnur.lam_tarjeta_compacta = TRUE); on.exit(options(op), add = TRUE)
  geo <- .lam_mixta_geo("graficos_2")
  col2 <- geo$paneles[[1]]$w
  M <- .lam_tarjetas_ranuras_medidas(ts, col2)
  y1 <- .std_geom("contenido_y1")
  y_filete <- y1 - M$alto - .TARJETAS_RANURA_AIRE
  lz <- .lam_lienzo()
  for (k in seq_along(ts)) {
    t <- ts[[k]]
    if (is.null(t) || !length(t$tarjetas)) next   # sin diferencias, la mitad no lleva filete ni nota (ítem 18)
    x0 <- geo$paneles[[k]]$x
    y_t <- y_filete + .TARJETAS_RANURA_AIRE
    if (isTRUE(debajo[k]) && is.finite(fin <- .lam_ranura_fin_grafico(doc, x0, x0 + col2))) {
      y_t <- fin + .TARJETAS_DICO_AIRE   # bajo su franja, sin filete: forman un solo bloque
    } else {
      .lam_separador_h(lz, x0, x0 + col2, y_filete)
    }
    n <- length(t$tarjetas)
    xs <- if (n == 1L) x0 + (col2 - M$cw) / 2 else x0 + c(0, M$cw + .TARJETAS_RANURA_SEP)
    for (j in seq_len(n)) {
      tj <- t$tarjetas[[j]]
      h <- .lam_tarjeta_alto(tj, M$cw, cortos = t$opcion$cortos, tipo = t$tipo %||% "multiple")
      .lam_tarjeta_dibujar(.lam_tarjeta_backend_ppt(lz), tj, list(l = xs[j], t = y_t, w = M$cw, h = h),
                           unname(t$rotulos_cruce[tj$cruce]) %||% tj$cruce, cortos = t$opcion$cortos, tipo = t$tipo %||% "multiple")
    }
  }
  .lam_agrupar(doc, lz, nombre = "prosecnur:tarjetas_diferencias")
}

#' ¿Los dos gráficos caben en piezas nativas con la franja de tarjetas debajo? Un gráfico que no cabe va por el respaldo
#' (ggplot) y, con menos alto, sus rótulos se pisan: entonces la lámina va sin tarjetas.
#' @keywords internal
.lam_slide_2_caben_con_tarjetas <- function(ps, els, reserva, titulo_de_var = NULL) {   # `reserva`: una por mitad
  especs <- lapply(ps, .lam_espec_de)
  if (any(vapply(especs, is.null, TRUE))) return(FALSE)
  op <- options(prosecnur.lam_reserva_inferior = reserva); on.exit(options(op), add = TRUE)
  ok <- tryCatch(.lam_mixta_caben(especs, .lam_mixta_geo("graficos_2"), els, titulo_de_var), error = function(e) FALSE)
  all(ok %in% TRUE)
}

#' Compone la lámina de dos gráficos con tarjetas bajo cada uno (`compone(doc)` es la ruta mixta de siempre)
#'
#' Los paneles se acortan lo que mide la franja de tarjetas (`prosecnur.lam_reserva_inferior`, que lee
#' `.lam_mixta_geo`); el gráfico se compone con el estándar del motor y después se agregan las tarjetas. Si algún gráfico
#' no cabe sobre la franja, la lámina sale como siempre, sin tarjetas, y un aviso dice qué acortar.
#' @keywords internal
.lam_slide_2_con_tarjetas <- function(doc, ts, compone, ps = NULL, els = NULL, titulo = "", titulo_de_var = NULL) {
  geo <- .lam_mixta_geo("graficos_2")
  M <- .lam_tarjetas_ranuras_medidas(ts, geo$paneles[[1]]$w)
  hay <- any(vapply(ts, function(t) length(t$tarjetas %||% list()) > 0L, TRUE))
  if (!hay) return(compone(doc))   # ninguna diferencia: la lámina de siempre, sin franja
  reservas <- .lam_reservas_por_mitad(ts, M$reserva)
  # Una franja dicotómica con tarjetas no reserva alto: sus tarjetas van pegadas debajo y el bloque se centra (ítem 14).
  especs <- if (is.null(ps)) list(NULL, NULL) else lapply(ps, function(p) tryCatch(.lam_espec_de(p), error = function(e) NULL))
  col2 <- geo$paneles[[1]]$w
  debajo <- vapply(1:2, function(k) k <= length(ts) && length(ts[[k]]$tarjetas %||% list()) > 0L && .lam_ranura_es_dicotomia(especs[[k]], col2), TRUE)
  recetas <- vector("list", 2L)
  for (k in which(debajo)) {
    reservas[k] <- 0
    recetas[[k]] <- .lam_receta_dicotomia_con_tarjetas(geo$paneles[[k]]$h, M$alto)
  }
  op_r <- options(prosecnur.lam_recetas_ranura = recetas); on.exit(options(op_r), add = TRUE)
  if (!is.null(ps) && !.lam_slide_2_caben_con_tarjetas(ps, els, reservas, titulo_de_var)) {
    if (exists(".pulso_aviso", mode = "function")) {
      .pulso_aviso(sprintf(paste0("Tarjetas de diferencias: en «%s» los gráficos no caben sobre las tarjetas (piden %.1f in); la lámina ",
                                  "va sin ellas. Acorta los rótulos o excluye opciones del gráfico más largo."), titulo, M$reserva))
    }
    return(compone(doc))
  }
  op <- options(prosecnur.lam_reserva_inferior = reservas); on.exit(options(op), add = TRUE)
  doc <- compone(doc)
  options(op)
  .lam_tarjetas_ranuras_dibujar(doc, ts, debajo = debajo)
}
