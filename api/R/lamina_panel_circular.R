# Torta y dona dentro de un panel (láminas de población y mixtas; checklist-poblacion-y-filtro-2026-10-14.md, P1).
#
# El recetario no las pone en un panel (usa la dicotomía partida y barras), pero el analista puede elegirlas y antes un
# solo panel con torta mandaba la lámina entera a la plantilla anterior. Aquí van como la lámina 69 en pequeño: el disco a
# la izquierda y, a la derecha, cada porción con su cuadro de color, su cifra y su rótulo. La dona lleva la cifra de su
# primera porción al centro (lámina 70).

#' Geometría del panel circular: el disco, la columna de la leyenda y si cabe
#' @keywords internal
.lam_panel_circular_geo <- function(espec, x, y, w, h, dy = 0) {
  k <- length(espec$valores); y0 <- y + 0.62 + dy
  alto <- y + h - y0 - 0.1
  tope <- .lam_circular_d_grilla(x, y, w, h)   # CCSS-26: todas las donas de la grilla del mismo diámetro
  d <- min(alto, w * 0.42, 2.6, tope)
  wl <- w - d - 0.35
  fila <- if (k) min(0.62, alto / k) else 0
  # El rótulo va en una línea: 11 pt si cabe, 9.5 si no (la caja de texto descuenta 0.2 in de márgenes internos).
  disp <- wl - 0.95 - 0.2
  size <- if (k && all(.lam_ancho_tinta(espec$rotulos, 11) <= disp)) 11 else 9.5
  # En un panel angosto el rótulo puede ir en dos líneas si la fila tiene el alto.
  rot_ok <- k >= 1L && disp > 0.5 && all(vapply(espec$rotulos, function(r) .lam_ancho_tinta(r, size) <= disp ||
                                                  .lam_alto_tinta(r, disp + 0.2, size) <= fila - 0.02, TRUE))
  geo <- list(tipo = "circular", x = x, y0 = y0, d = d, xl = x + d + 0.35, wl = wl, fila = fila, size = size,
              cabe = k >= 2L && k <= 5L && d >= 1.1 && fila >= 0.36 && rot_ok)
  # Frente C: lo que no cabe así se compacta (lamina_circular_leyenda.R) en vez de caer a la imagen ggplot.
  if (isTRUE(geo$cabe) || k < 2L) geo else .lam_circular_leyenda_compacta(espec, x, y0, w, alto, d_tope = tope)
}

#' Dibuja el panel circular
#' @keywords internal
.lam_panel_circular <- function(lz, espec, geo) {
  azul <- .std_color("azul"); k <- length(espec$valores); cols <- .lam_colores_pie(k, espec)
  dona <- !identical(espec$forma, "pie")
  r <- geo$d / 2 * 0.95; cx <- geo$x + geo$d / 2; cy <- geo$y0 + geo$d / 2
  f <- espec$valores / sum(espec$valores); acum <- c(0, cumsum(f))
  for (i in seq_len(k)) if (f[i] > 0) .lam_sector(lz, cx, cy, r, acum[i], acum[i + 1], cols[i], arco = dona, borde_pt = 1.2,
                                                  nombre = if (dona) "dona:porcion" else "torta:porcion")
  if (dona) {
    tam <- min(24, max(14, r * 18))
    .lam_txt(lz, espec$cifras[1], cx - r, cy - tam / 144 - 0.05, 2 * r, tam / 72 + 0.1, tam, azul, bold = TRUE, align = "center", nombre = "dona:cifra")
  }
  if (isTRUE(geo$compacto)) { .lam_circular_leyenda_dibujar(lz, espec, geo, cols); return(invisible(geo$y0 + geo$d)) }
  y_ley <- geo$y0 + max(0, (geo$d - geo$fila * k) / 2)
  for (i in seq_len(k)) {
    yk <- y_ley + (i - 1) * geo$fila
    .lam_caja(lz, geo$xl, yk + 0.08, 0.17, 0.17, cols[i], nombre = "circular:cuadro")
    .lam_txt(lz, .lam_cifras_menor_uno(espec$cifras, .espec_casos(espec))[i], geo$xl + 0.24, yk, 0.75, 0.32, 14, azul, bold = TRUE, nombre = "circular:cifra")   # U5
    .lam_txt(lz, espec$rotulos[i], geo$xl + 0.95, yk + 0.02, geo$wl - 0.95, max(0.3, geo$fila - 0.04), geo$size %||% 11, azul, nombre = "circular:rotulo")
  }
  invisible(geo$y0 + geo$d)
}
