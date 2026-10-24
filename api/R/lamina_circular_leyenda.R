# Leyenda compacta del panel circular (frente C, CCSS Perfil 2026).
#
# La dona y la torta en un panel (lamina_panel_circular.R) llevaban una leyenda de filas de 0.36–0.62 in con la cifra en
# 14 pt: cabían hasta cinco categorías y, con más o en un panel bajo, el panel caía a la imagen ggplot (otro estilo, título
# repetido, leyenda cortada y, en un cajón angosto, un rectángulo de rvg fuera de escala que pintaba la lámina entera).
# Aquí la leyenda se compacta antes de rendirse: letra más chica, cifra a la par del rótulo, dos columnas y un disco
# menor. Si la geometría de siempre cabe, se usa la de siempre (`.lam_panel_circular_geo`), así que nada de lo que ya
# salía nativo cambia.

#' Geometría compacta del panel circular: la primera combinación de letra, columnas y disco en que todo cabe
#'
#' Se prefiere la letra grande a la columna única y ésta al disco grande: lo que más pesa al leer es el rótulo.
#' @param alto Alto disponible bajo el encabezado del panel (in).
#' @return Geometría con `compacto = TRUE` (o la que mejor se acercó, con `cabe = FALSE`).
#' @keywords internal
.lam_circular_leyenda_compacta <- function(espec, x, y0, w, alto) {
  k <- length(espec$valores)
  d_max <- min(alto, w * 0.42, 2.6)
  discos <- if (d_max >= 0.9) unique(round(c(d_max, rev(seq(0.9, d_max, by = 0.15))), 3)) else numeric(0)
  ultimo <- NULL
  if (k < 2L || !length(discos)) return(list(tipo = "circular", compacto = TRUE, cabe = FALSE))
  # Primero con el disco de al menos tres cuartos del mayor; si no hay manera, con cualquiera desde 0.9 in.
  for (piso_d in c(0.75 * d_max, 0.9)) for (size in c(11, 10, 9.5, 9, 8.5, 8)) for (nc in 1:2) for (d in discos[discos >= piso_d - 1e-9]) {
    per <- ceiling(k / nc)
    xl <- x + d + 0.3; wl <- x + w - xl
    wcol <- (wl - 0.15 * (nc - 1L)) / nc
    tam_cifra <- if (size <= 9) size else min(14, size + 1)   # en la letra más chica la cifra va del mismo cuerpo, en negrita
    wcif <- max(.lam_ancho_tinta(espec$cifras, tam_cifra, TRUE)) + 0.08
    disp <- wcol - 0.24 - wcif - 0.2          # el cuadro (0.24), la cifra y los márgenes internos del cuadro de texto
    fila <- min(0.62, alto / per)
    # Interlineado de 1.2 y 0.035 in de aire: la fila más apretada que se lee como lista (8 pt en 0.17 in).
    lineas <- if (disp > 0.35) vapply(espec$rotulos, function(r) .lam_lineas_tinta(r, disp + 0.2, size), 1) else Inf
    rot_ok <- all(lineas * size * 1.2 / 72 + 0.035 <= fila)
    piso <- tam_cifra * 1.2 / 72 + 0.035
    ultimo <- list(tipo = "circular", compacto = TRUE, x = x, y0 = y0, d = d, xl = xl, wl = wl, ncol = nc, per = per, wcol = wcol,
                   wcif = wcif, fila = fila, size = size, size_cifra = tam_cifra, cabe = fila >= piso && rot_ok)
    if (isTRUE(ultimo$cabe)) return(ultimo)
  }
  ultimo
}

#' Dibuja la leyenda compacta: por categoría, su cuadro de color, la cifra en negrita y el rótulo, en una o dos columnas
#' @keywords internal
.lam_circular_leyenda_dibujar <- function(lz, espec, geo, cols) {
  azul <- .std_color("azul"); k <- length(espec$valores)
  y_ley <- geo$y0 + max(0, (geo$d - geo$fila * geo$per) / 2)
  lado <- min(0.17, geo$fila - 0.08)
  for (i in seq_len(k)) {
    col <- (i - 1L) %/% geo$per; fil <- (i - 1L) %% geo$per
    xc <- geo$xl + col * (geo$wcol + 0.15); yk <- y_ley + fil * geo$fila
    .lam_caja(lz, xc, yk + (geo$fila - lado) / 2, lado, lado, cols[i], nombre = "circular:cuadro")
    .lam_txt(lz, espec$cifras[i], xc + 0.24 - 0.1, yk, geo$wcif + 0.2, geo$fila - 0.02, geo$size_cifra, azul, bold = TRUE,
             nombre = "circular:cifra")
    xr <- xc + 0.24 + geo$wcif
    .lam_txt(lz, espec$rotulos[i], xr, yk + 0.01, xc + geo$wcol - xr, geo$fila - 0.02, geo$size, azul, nombre = "circular:rotulo")
  }
  invisible(y_ley + geo$per * geo$fila)
}
