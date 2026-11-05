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
