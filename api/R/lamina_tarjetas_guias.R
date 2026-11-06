# lamina_tarjetas_guias.R — de dónde sale la guía de cada tarjeta en una categórica en barras (ADR 0129)
#
# Revisión del PPT v7.23 de CCSS, ítem 9 (lámina 37: «estas tarjetas de significancia tienen una sola columna; ¿por qué no
# salen con la línea que las conecta con su respuesta?»). Las tarjetas se anclan a su fila con una guía en codo
# (`.lam_tarjetas_anclar`); si no se encontraban las filas, caían al panel en columna, sin guía. Lo que fallaba era
# exigir una barra por rótulo: una categoría de largo cero («No responde», «<1%») no dibuja barra. Aquí cada rótulo se
# empareja por su altura con la fila que sí está dibujada.

#' Centro vertical y fin (barra o cifra) de cada fila de barras, emparejados por altura con sus rótulos
#'
#' @param rot,bar,pista,cif Piezas de la lámina (`data.frame` con `texto`, `x`, `y`, `w`, `h`) o `NULL`.
#' @return `data.frame` con `yc` (centro de la fila) y `fin` (borde derecho de la barra y de su cifra), una fila por
#'   rótulo; `NULL` si algún rótulo no tiene fila dibujada o dos rótulos caen en la misma.
#' @keywords internal
.lam_tarjetas_filas_por_altura <- function(rot, bar, pista = NULL, cif = NULL, tol = 0.06) {
  if (is.null(rot) || !nrow(rot)) return(NULL)
  centro <- function(d) if (is.null(d) || !nrow(d)) numeric(0) else d$y + d$h / 2
  ryc <- centro(rot); byc <- centro(bar); pyc <- centro(pista); cyc <- centro(cif)
  # La referencia de filas: la pista (una por fila, también en las de largo cero); sin ella, las barras y las cifras.
  ref <- if (length(pyc)) pyc else sort(unique(round(c(byc, cyc), 3)))
  if (!length(ref)) return(NULL)
  k <- vapply(ryc, function(y) which.min(abs(ref - y)), 1L)
  if (any(abs(ref[k] - ryc) > tol) || anyDuplicated(k)) return(NULL)
  yc <- ref[k]
  cerca <- function(v, y) { i <- which(abs(v - y) <= tol); if (length(i)) i[which.min(abs(v[i] - y))] else NA_integer_ }
  fin <- vapply(yc, function(y) {
    b <- cerca(byc, y); c <- cerca(cyc, y); p <- cerca(pyc, y)
    f <- if (!is.na(b)) bar$x[b] + bar$w[b] else if (!is.na(p)) pista$x[p] else NA_real_
    if (!is.na(c)) f <- max(f, cif$x[c] + .lam_ancho_tinta(cif$texto[c], .std_pt("cifra"), TRUE) + 0.12, na.rm = TRUE)
    f
  }, 0)
  if (anyNA(fin)) return(NULL)
  data.frame(yc = yc, fin = fin)
}

#' Ruta de la guía tarjeta→fila sin cruzar otras barras: por el carril entre filas
#'
#' Revisión del PPT v7.25 de CCSS, lámina 38 (ítem 6). Gonzalo: «la línea ¿no puede ir o hacer su carril entre las dos
#' barras al medio para no tocar otra barra?». El codo bajaba a media distancia entre la cifra y la tarjeta y su tramo
#' vertical atravesaba la pista de la fila vecina. Ahora:
#'
#'   - si la tarjeta toca la altura de su fila, la guía va recta (o con un codo dentro de la propia fila);
#'   - si no, sale de su fila por el lado (un tramo vertical corto junto al punto, dentro de su franja) hasta el carril,
#'     el hueco a media altura entre su fila y la vecina en dirección a la tarjeta, y corre por él;
#'   - si la tarjeta no alcanza ese carril, corre por el carril hasta la columna libre a la derecha de todas las barras,
#'     y sólo ahí sube o baja hasta la tarjeta.
#'
#' @param filas_y Centros de todas las filas de la lámina (in). @param fin_barras Borde derecho de la zona de barras (la
#'   pista o la barra más larga), o NA.
#' @return Matriz de puntos (x, y) de la polilínea, del punto de la fila a la tarjeta.
#' @keywords internal
.lam_tarjeta_guia_ruta <- function(xa, ya, xp, tp, h, filas_y, fin_barras = NA_real_) {
  yt <- min(max(ya, tp + 0.18), tp + h - 0.18)
  fy <- sort(unique(round(filas_y, 4)))
  paso <- if (length(fy) > 1L) min(diff(fy)) else 0.5
  if (abs(yt - ya) <= 0.3 * paso) {
    # Recta, o con un codo que no sale de la franja de su fila.
    xm <- xa + max(0.06, (xp - xa) / 2)
    return(if (abs(yt - ya) > 0.01) rbind(c(xa, ya), c(xm, ya), c(xm, yt), c(xp, yt)) else rbind(c(xa, ya), c(xp, ya)))
  }
  dir <- sign(yt - ya)
  vecina <- if (dir > 0) fy[fy > ya + 1e-3] else fy[fy < ya - 1e-3]
  carril <- if (length(vecina)) (ya + (if (dir > 0) min(vecina) else max(vecina))) / 2 else ya + dir * paso / 2
  xs <- xa + 0.08   # el tramo que sale de la fila, junto al punto
  if (carril >= tp + 0.08 && carril <= tp + h - 0.08) return(rbind(c(xa, ya), c(xs, ya), c(xs, carril), c(xp, carril)))
  # La tarjeta queda más allá del carril: por él hasta la columna libre, y ahí el tramo vertical hasta su altura.
  x_libre <- if (is.finite(fin_barras) && fin_barras + 0.04 < xp) (max(fin_barras, xs) + xp) / 2 else NA_real_
  if (is.na(x_libre)) {
    xm <- xa + max(0.06, (xp - xa) / 2)
    return(rbind(c(xa, ya), c(xm, ya), c(xm, yt), c(xp, yt)))
  }
  rbind(c(xa, ya), c(xs, ya), c(xs, carril), c(x_libre, carril), c(x_libre, yt), c(xp, yt))
}
