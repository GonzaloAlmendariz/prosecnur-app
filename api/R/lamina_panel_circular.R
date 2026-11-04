# Torta y dona dentro de un panel (láminas de población y mixtas; checklist-poblacion-y-filtro-2026-10-14.md, P1).
#
# Revisión de Gonzalo del PPT v7 de CCSS Perfil 2026 (láminas 7, 10 y 23): «las etiquetas de porcentajes deben estar en
# su eje», «el porcentaje no debería estar en la leyenda», «la leyenda le roba mucho protagonismo al gráfico» y «la dona
# no aprovecha todo su alto». La figura ocupa ahora todo el alto del cajón (sin el tope de 42 % del ancho), cada cifra va
# sobre su porción o, si no cabe, fuera con su guía recta (lamina_circular_guia.R), y a la derecha queda una leyenda de
# una columna angosta con el cuadro de color y el rótulo, sin porcentajes (lamina_circular_leyenda.R). La dona ya no
# lleva una cifra al centro salvo que el analista elija qué respuesta resaltar (`al_centro` o `frase_centro`). Cifras,
# base y redondeo son los de la espec: sólo cambian de sitio.

.LAM_PANEL_ARO <- 0.27        # grosor del aro de la dona del panel como fracción del diámetro: deja leer la cifra encima
.LAM_PANEL_HUECO <- 0.3       # aire entre la figura y su leyenda (in)

#' Radio donde va la cifra dentro de la porción: a media altura del aro en la dona, a 62 % del radio en la torta
#' @keywords internal
.lam_panel_circular_r_cifra <- function(r, dona) if (isTRUE(dona)) r * (1 - .LAM_PANEL_ARO) else r * 0.62

#' Cuerpo de la cifra dentro de la porción: el de la casa si cabe en el grosor del aro (o en una torta de radio de 0.8 in o
#' más), 12 pt si no
#' @keywords internal
.lam_panel_circular_size <- function(r, dona) {
  if (!isTRUE(dona)) return(if (r >= 0.8) .std_pt("cifra") else 12)   # en una torta chica, 12 pt para no tocar la vecina
  if (2 * r * .LAM_PANEL_ARO >= .std_pt("cifra") * 1.2 / 72 + 0.12) .std_pt("cifra") else 12
}

#' Grosor del aro de la dona del panel (in); la torta no tiene aro
#' @keywords internal
.lam_panel_circular_aro <- function(r, dona) if (isTRUE(dona)) 2 * r * .LAM_PANEL_ARO else Inf

#' Lo que la figura reserva a cada lado para las cifras de fuera (in): sólo del lado donde salen
#' @return `c(l, r, t, b)`; donde no sale ninguna, 0.05 in de aire.
#' @keywords internal
.lam_panel_circular_margen <- function(espec, d, dona) {
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f)); mid <- acum[seq_along(f)] + f / 2
  r <- d / 2 * 0.95; rc <- .lam_panel_circular_r_cifra(r, dona); size <- .lam_panel_circular_size(r, dona)
  chica <- .lam_circular_chicas(espec$cifras, f, rc, size, .lam_panel_circular_aro(r, dona))
  m <- c(l = 0.05, r = 0.05, t = 0.05, b = 0.05)
  if (!any(chica)) return(m)
  sn <- sin(2 * pi * mid[chica]); cs <- cos(2 * pi * mid[chica])   # a las 12, cs = 1; a las 3, sn = 1
  lado <- .LAM_GUIA_LARGO_IN + 0.05 + max(.lam_ancho_tinta(espec$cifras[chica], .std_pt("cifra_fuera"), TRUE)) + 0.05
  alto <- .LAM_GUIA_LARGO_IN + 0.05 + .std_pt("cifra_fuera") * 1.2 / 72
  if (any(sn > 0.3)) m[["r"]] <- lado
  if (any(sn < -0.3)) m[["l"]] <- lado
  if (any(abs(sn) <= 0.3 & cs > 0)) m[["t"]] <- alto
  if (any(abs(sn) <= 0.3 & cs < 0)) m[["b"]] <- alto
  m
}

#' Geometría del panel circular: el disco a todo el alto, su leyenda angosta y si cabe
#'
#' Se prueba la letra de 11 pt en una columna y se baja la letra o se pasa a dos columnas sólo si la leyenda no cabe en
#' el alto del cajón. La leyenda no pasa del 40 % del ancho del panel; el rótulo largo se corta en hasta tres líneas.
#' @keywords internal
.lam_panel_circular_geo <- function(espec, x, y, w, h, dy = 0, tope = NULL) {
  k <- length(espec$valores); y0 <- y + 0.62 + dy
  alto <- y + h - y0 - 0.1
  if (k < 2L) return(list(tipo = "circular", cabe = FALSE, x = x, y0 = y0, d = 0))
  dona <- !identical(espec$forma, "pie")
  if (is.null(tope)) {
    # CCSS-26: en la grilla de población la dona lleva el diámetro que tendría en la celda más baja.
    P <- .lam_circular_celdas_grilla(x, y, w, h)
    # Las celdas de igual tamaño dan el mismo disco: se mide una de cada tamaño.
    if (length(P)) P <- P[!duplicated(vapply(P, function(p) sprintf("%.3f|%.3f", p$w, p$h), ""))]
    # Una celda donde esta figura no cabe de ninguna forma no fija el tope: ahí iría su gráfico de respaldo.
    tope <- if (length(P)) min(vapply(P, function(p) { g <- .lam_panel_circular_geo(espec, p$x, p$y, p$w, p$h, dy, tope = Inf)
                                                       if (isTRUE(g$cabe)) g$d else Inf }, 0)) else Inf
  }
  ultimo <- NULL
  # Entre los anchos de leyenda que caben se queda el que da la figura mayor y, a igual figura, el más ancho (menos
  # cortes de línea): dos donas vecinas con rótulos de distinto largo quedan del mismo diámetro si las dos llegan al alto.
  # Primero con las cifras en la figura; sólo si así no cabe, con las cifras en la leyenda (sin cifras fuera).
  for (en_ley in c(FALSE, TRUE)) for (size in c(11, 10, 9.5, 9, 8.5, 8)) for (nc in 1:2) {
    caben <- list()
    wcif <- if (en_ley) max(.lam_ancho_tinta(.lam_cifras_menor_uno(espec$cifras, .espec_casos(espec)), size, TRUE)) + 0.08 else 0
    for (fr in if (en_ley) c(0.4, 0.5, 0.6, (w - 0.9 - .LAM_PANEL_HUECO - 0.1) / w) else c(0.28, 0.34, 0.4)) {
      ley <- .lam_circular_leyenda_rotulos_geo(espec$rotulos, size, nc, w_max = fr * w, alto = alto, w_cifra = wcif)
      if (is.null(ley)) next
      margen <- function(d) if (en_ley) c(l = 0.05, r = 0.05, t = 0.05, b = 0.05) else .lam_panel_circular_margen(espec, d, dona)
      cabe_d <- function(m) min(alto - m[["t"]] - m[["b"]], w - ley$w - .LAM_PANEL_HUECO - m[["l"]] - m[["r"]], tope)
      d <- min(alto, w - ley$w - .LAM_PANEL_HUECO, tope)
      m <- margen(d); d <- cabe_d(m)
      m <- margen(d); d <- cabe_d(m)   # el disco menor puede dejar otra cifra fuera
      # La figura y su leyenda van juntas y centradas en el panel; la figura, centrada en el alto que le dejan sus cifras.
      ancho <- m[["l"]] + d + m[["r"]] + .LAM_PANEL_HUECO + ley$w
      x0 <- x + max(0, (w - ancho) / 2)
      geo <- list(tipo = "circular", x = x0 + m[["l"]], y0 = y0 + m[["t"]] + (alto - m[["t"]] - m[["b"]] - d) / 2, d = d, dona = dona,
                  xl = x0 + m[["l"]] + d + m[["r"]] + .LAM_PANEL_HUECO, ley = ley, size = size, ncol = nc, cifras_en_leyenda = en_ley, y_area = y0, alto = alto,
                  compacto = size < 11 || nc > 1L || en_ley,
                  cabe = d >= 0.9 && ley$alto <= alto + 1e-9)
      ultimo <- geo
      if (isTRUE(geo$cabe)) caben[[length(caben) + 1L]] <- geo
    }
    if (length(caben)) {
      ds <- vapply(caben, function(g) g$d, 0)
      return(caben[[max(which(ds >= max(ds) - 0.01))]])
    }
  }
  ultimo %||% list(tipo = "circular", cabe = FALSE, x = x, y0 = y0, d = 0)
}

#' Dibuja el panel circular
#' @keywords internal
.lam_panel_circular <- function(lz, espec, geo) {
  azul <- .std_color("azul"); k <- length(espec$valores); cols <- .lam_colores_pie(k, espec)
  dona <- !identical(espec$forma, "pie"); pre <- if (dona) "dona" else "torta"
  espec$cifras <- .lam_cifras_menor_uno(espec$cifras, .espec_casos(espec))   # U5: «<1%» si redondea a 0 con casos
  r <- geo$d / 2 * 0.95; cx <- geo$x + geo$d / 2; cy <- geo$y0 + geo$d / 2
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f))
  for (i in seq_len(k)) if (f[i] > 0) .lam_sector(lz, cx, cy, r, acum[i], acum[i + 1], cols[i], arco = dona, grosor = .LAM_PANEL_ARO,
                                                  borde_pt = 1.2, nombre = paste0(pre, ":porcion"))
  # La respuesta que el analista eligió resaltar va al centro y no se repite en su porción; sin elegir, ninguna.
  centro <- dona && isTRUE(espec$centro_elegido)
  if (centro) {
    tam <- min(24, max(14, r * 18))
    .lam_txt(lz, espec$cifras[1], cx - r, cy - tam / 144 - 0.05, 2 * r, tam / 72 + 0.1, tam, azul, bold = TRUE, align = "center", nombre = "dona:cifra")
  }
  if (isTRUE(geo$cifras_en_leyenda)) {
    .lam_circular_leyenda_rotulos(lz, espec$rotulos, cols, geo$ley, geo$xl, cy, cifras = espec$cifras, y_min = geo$y_area,
                                  y_max = geo$y_area + geo$alto)
    return(invisible(geo$y0 + geo$d))
  }
  .lam_circular_cifras(lz, espec, cx, cy, r, f, acum, cols, prefijo = pre, r_cifra = .lam_panel_circular_r_cifra(r, dona),
                       color_sobre = TRUE, nombre_dentro = if (dona) "dona:cifra_aro" else "torta:cifra",
                       size_dentro = .lam_panel_circular_size(r, dona), aro = .lam_panel_circular_aro(r, dona), omitir = if (centro) 1L else integer(0))
  .lam_circular_leyenda_rotulos(lz, espec$rotulos, cols, geo$ley, geo$xl, cy, y_min = geo$y_area, y_max = geo$y_area + geo$alto)
  invisible(geo$y0 + geo$d)
}
