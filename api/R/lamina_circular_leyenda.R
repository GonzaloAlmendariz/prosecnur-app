# Leyenda angosta del panel circular (CCSS Perfil 2026; revisión del PPT v7, láminas 7, 10 y 23).
#
# La leyenda del panel llevaba el porcentaje de cada porción en 14 pt junto a su rótulo y le quitaba a la figura casi la
# mitad del ancho. Gonzalo: «el porcentaje no debería estar en la leyenda» y «la leyenda le roba mucho protagonismo al
# gráfico». El porcentaje va ahora en la figura (lamina_panel_circular.R) y la leyenda queda en una columna angosta con
# el cuadro de color y el rótulo, que se corta en líneas antes de ensanchar la columna. Sólo si no cabe en el alto del
# cajón se baja la letra o se reparte en dos columnas. Último recurso, en una celda donde la figura con sus cifras fuera
# no cabe (muchas porciones en un cajón bajo): la cifra vuelve a la leyenda antes de que el panel caiga a la imagen.

.LAM_LEY_CUADRO <- 0.17    # lado del cuadro de color (in)
.LAM_LEY_SANGRIA <- 0.24   # del borde del cuadro a la tinta del rótulo (in); su caja empieza 0.1 in antes

#' Geometría de la leyenda de rótulos: ancho, alto de cada fila y alto total, o `NULL` si un rótulo pasa de tres líneas
#' @param w_max Ancho máximo de la leyenda (in). @param alto Alto disponible (in).
#' @param w_cifra Ancho de la columna de cifras delante del rótulo (in); 0, sin cifras (lo normal: van en la figura).
#' @keywords internal
.lam_circular_leyenda_rotulos_geo <- function(rotulos, size, nc = 1L, w_max, alto, w_cifra = 0) {
  k <- length(rotulos); if (!k) return(NULL)
  # La medición con systemfonts es lo caro y la grilla la repite por celda y por ancho de leyenda: se recuerda.
  clave <- paste(c(rotulos, size, nc, round(w_max, 4), round(alto, 4), round(w_cifra, 4)), collapse = "\r")
  if (!is.null(.LAM_LEY_MEMO[[clave]])) return(.LAM_LEY_MEMO[[clave]]$geo)
  geo <- .lam_circular_leyenda_rotulos_medir(rotulos, size, nc, w_max, alto, w_cifra)
  assign(clave, list(geo = geo), envir = .LAM_LEY_MEMO)
  geo
}

.LAM_LEY_MEMO <- new.env(parent = emptyenv())

#' Mide la leyenda de rótulos (lo que `.lam_circular_leyenda_rotulos_geo` recuerda)
#' @keywords internal
.lam_circular_leyenda_rotulos_medir <- function(rotulos, size, nc, w_max, alto, w_cifra = 0) {
  k <- length(rotulos)
  per <- as.integer(ceiling(k / nc))
  # Columna de texto: la tinta del rótulo más largo, sin pasar del ancho que deja la leyenda a cada columna.
  w_txt_max <- (w_max - 0.15 * (nc - 1L)) / nc - .LAM_LEY_SANGRIA + 0.1 - w_cifra
  if (w_txt_max < 0.5) return(NULL)
  w_txt <- min(max(.lam_ancho_tinta(rotulos, size)) + 0.24, w_txt_max)   # la caja suma 0.2 in de márgenes
  lineas <- .lam_lineas_tinta(rotulos, w_txt, size)
  if (any(lineas > 3L)) return(NULL)
  # El paso de fila: las líneas y 0.07 in de aire (la caja de texto, sin relleno, puede invadir su margen inferior); en la
  # letra más chica, 0.035 in, la fila más apretada que se lee como lista (8 pt en 0.17 in).
  fila <- lineas * size * 1.2 / 72 + (if (size <= 9) 0.035 else 0.07)
  col <- (seq_len(k) - 1L) %/% per
  altos <- vapply(0:(nc - 1L), function(j) sum(fila[col == j]), 0)
  list(ncol = nc, per = per, size = size, w_txt = w_txt, w_cifra = w_cifra, w_col = .LAM_LEY_SANGRIA - 0.1 + w_cifra + w_txt,
       w = nc * (.LAM_LEY_SANGRIA - 0.1 + w_cifra + w_txt) + 0.15 * (nc - 1L), fila = fila, lineas = lineas, alto = max(altos), cabe = max(altos) <= alto)
}

#' Dibuja la leyenda de rótulos centrada en el alto `cy` (in): por categoría, su cuadro, su cifra si va en la leyenda y su
#' rótulo
#' @keywords internal
.lam_circular_leyenda_rotulos <- function(lz, rotulos, cols, ley, xl, cy, cifras = NULL, y_min = -Inf, y_max = Inf) {
  azul <- .std_color("azul"); k <- length(rotulos)
  col <- (seq_len(k) - 1L) %/% ley$per
  # Una leyenda que no cabe (el panel irá con su respaldo) se aprieta al alto del cajón en vez de salirse de él.
  if (is.finite(y_max - y_min) && ley$alto > y_max - y_min) ley$fila <- ley$fila * (y_max - y_min) / ley$alto
  for (j in unique(col)) {
    # Centrada en la figura, sin salir del cajón (`y_min`-`y_max`) cuando es más alta que ella.
    idx <- which(col == j); hj <- sum(ley$fila[idx]); yk <- max(y_min, min(cy - hj / 2, y_max - hj))
    xc <- xl + j * (ley$w_col + 0.15)
    for (i in idx) {
      # El cuadro a la altura de la primera línea del rótulo (margen superior de 0.05 in de su caja).
      .lam_caja(lz, xc, yk + 0.05 + ley$size * 1.2 / 72 / 2 - .LAM_LEY_CUADRO / 2, .LAM_LEY_CUADRO, .LAM_LEY_CUADRO, cols[i],
                nombre = "circular:cuadro")
      if (!is.null(cifras) && ley$w_cifra > 0) {
        .lam_txt(lz, cifras[i], xc + .LAM_LEY_SANGRIA - 0.1, yk, ley$w_cifra + 0.2, ley$fila[i] - 0.005, ley$size, azul, bold = TRUE, nombre = "circular:cifra")
      }
      .lam_txt(lz, rotulos[i], xc + .LAM_LEY_SANGRIA - 0.1 + ley$w_cifra, yk, ley$w_txt, ley$fila[i] - 0.005, ley$size, azul, nombre = "circular:rotulo")
      yk <- yk + ley$fila[i]
    }
  }
  invisible(lz)
}

#' Celdas de la grilla de población a la que pertenece el panel (CCSS-26), o `NULL` si no es una celda de esas grillas
#'
#' En la grilla de cinco o de seis gráficos de población las celdas tienen distinto alto y todas las donas llevan el
#' mismo diámetro: el que esa dona tendría en la celda más baja (`.lam_panel_circular_geo`). Las grillas de celdas
#' iguales (2 x 2, dos gráficos) no tienen tope.
#' @keywords internal
.lam_circular_celdas_grilla <- function(x, y, w, h) {
  for (tipo in c("poblacion_6", "poblacion_5")) {
    P <- tryCatch(.lam_mixta_geo(tipo)$paneles, error = function(e) NULL)
    if (!length(P)) next
    es <- vapply(P, function(p) abs(p$x - x) < 1e-3 && abs(p$y - y) < 1e-3 && abs(p$w - w) < 1e-3 && abs(p$h - h) < 1e-3, TRUE)
    if (any(es)) return(P)
  }
  NULL
}
