# =============================================================================
# lamina_barras_ancho.R — las barras de una categórica usan el ancho útil de la lámina (CCSS-8, 2026-10-25)
# =============================================================================
#
# CCSS Perfil 2026 (láminas 7, 19, 20, 28, 32, 33, 35, 36 y 52 del mazo actual): las barras horizontales de una serie
# ocupaban la mitad del ancho y dejaban media lámina vacía. Dos causas:
#   1. La columna de rótulos medía la tinta del más largo, hasta 6.3 in (la mitad de la lámina): ahora se acota SIEMPRE al
#      35 % del ancho útil y el rótulo se envuelve hasta en tres líneas; si ni así cabe en su fila, el cuerpo baja de a medio
#      punto hasta 11 pt; si tampoco, vuelve la columna de antes (nunca se trunca ni se pisa con la barra).
#   2. La espec de `p_barras_agrupadas` con una sola serie trae `escala_completa` (0 a 100 %, recetario p74, Gonzalo
#      2026-10-09: «El recetario es la fuente de verdad»): Economía, con 46 %, mide el 46 % del área. Ese defecto SE CONSERVA;
#      las barras sólo ganan el ancho que libera la columna acotada. Con el eje libre (`usar_eje_libre = TRUE`, que deja
#      `escala_completa = FALSE`) el eje va al máximo observado × 1.15, la cifra de la mayor cabe en ese aire y, con tres
#      categorías o menos, el bloque no se estira: mide el 75 % del ancho útil y se centra.
# Sólo cambian posiciones y tamaños: cifras, base, orden y categorías salen intactas de la espec.

#' Constantes de la norma de uso del ancho (CCSS-8)
#' @keywords internal
.LAM_BARRAS_ANCHO <- list(aire = 1.15, tope_rotulo = 0.35, lineas = 3L, piso_pt = 11, pocas = 3L, frac_pocas = 0.75,
                          sep_barra = 0.12, sep_cifra = 0.04)

#' ¿El eje de la lámina completa escala al máximo? Sólo con el eje libre: con `escala_completa` (el defecto) va de 0 a 100 %
#' @keywords internal
.lam_barras_ancho_aplica <- function(espec) !isTRUE(espec$escala_completa)

#' Ancho de la columna de cifras de `.lam_barras_h` (misma cuenta: 0.8 in o lo que mida la cifra más ancha)
#' @keywords internal
.lam_barras_ancho_cifra <- function(cifras, size) max(0.8, max(.lam_ancho_tinta(cifras, size, TRUE)) + 0.12)

#' Columna de rótulos acotada: el ancho de su tinta, con tope del 35 % del ancho útil y envoltorio de hasta 3 líneas
#'
#' @param rotulos Rótulos. @param ancho Ancho útil (in). @param size Cuerpo pedido. @param fila Alto de la fila (in).
#' @param nb ¿Rótulos en negrita? @param previa Columna de antes (respaldo si con el tope no cabe).
#' @return `list(wlab, size, acotada)`.
#' @keywords internal
.lam_barras_ancho_rotulos <- function(rotulos, ancho, size, fila, nb = FALSE, previa = NULL) {
  U <- .LAM_BARRAS_ANCHO; tope <- U$tope_rotulo * ancho
  natural <- max(1.4, max(.lam_ancho_tinta(rotulos, size, nb)) + 0.3)
  if (natural <= tope) return(list(wlab = natural, size = size, acotada = FALSE))
  piso <- max(U$piso_pt, .std_valor("ppt", "tipografia", "cifra_minimo") %||% 8)
  for (s in unique(c(seq(size, piso, by = -0.5), piso))) {
    if (s < piso) next
    lin <- .lam_lineas_tinta(rotulos, tope, s, nb)
    # Cabe en su fila por la tinta y por la cuenta de `.lam_categorica_forma` (que no debe cambiar de forma por esto).
    if (all(lin <= U$lineas) && all(.lam_alto_tinta(rotulos, tope, s, nb) <= fila + 0.02) &&
        all(vapply(rotulos, function(r) .lam_alto_txt(r, tope, s) <= fila + 0.02, TRUE))) {
      return(list(wlab = tope, size = s, acotada = TRUE))
    }
  }
  list(wlab = previa %||% natural, size = size, acotada = FALSE)
}

#' Geometría horizontal de las barras de la lámina completa: columna de rótulos, escala y bloque
#'
#' El área de barras va del borde de la barra al borde derecho del bloque; la mayor mide `1 / aire` de esa área (80-87 %)
#' y su cifra cabe en el aire que queda. `escala` y `w` se entregan en los términos de `.lam_barras_h` (que reserva la
#' columna de cifras dentro de `w`), así que esa función no cambia.
#' @param espec Espec categórica. @param ancho Ancho útil (in). @param wlab,size Columna y cuerpo de los rótulos.
#' @return `list(w, dx, escala, wbar_area, bw_max)` o `NULL` con el eje de 0 a 100 % (`escala_completa`).
#' @keywords internal
.lam_barras_ancho_geo <- function(espec, ancho, wlab, size) {
  if (!.lam_barras_ancho_aplica(espec)) return(NULL)
  U <- .LAM_BARRAS_ANCHO; v <- suppressWarnings(as.numeric(espec$largos)); vmax <- max(c(0, v[is.finite(v)]))
  if (!(vmax > 0)) return(NULL)
  w <- if (length(v) <= U$pocas) U$frac_pocas * ancho else ancho
  dx <- (ancho - w) / 2
  wcif <- .lam_barras_ancho_cifra(espec$cifras, size)
  area <- w - wlab - U$sep_barra
  if (area <= wcif + 0.5) return(NULL)
  # El aire es el de la norma (× 1.15) o el que pida una cifra ancha («62% (124)», letras de significancia).
  aire <- max(U$aire, area / (area - wcif - U$sep_cifra))
  bw_max <- area / aire
  wbar_h <- w - wlab - wcif   # el área que usa `.lam_barras_h` para su cuenta
  list(w = w, dx = dx, escala = vmax * wbar_h / bw_max, wbar_area = area, bw_max = bw_max, aire = aire)
}

#' x (in) del encabezado «% de encuestados que marcó cada opción»: sobre el borde de las barras, pero nunca encima del
#' subtítulo de la lámina, que puede caer en la misma franja (CCSS lámina 57: con la columna acotada el encabezado se corrió
#' a la izquierda y pisaba «Uno de cada tres trabaja para ayudar...»). Se corre a la derecha de la tinta del subtítulo.
#' @keywords internal
.lam_barras_ancho_x_encabezado <- function(x, sub = NULL, titulo = NULL) {
  if (is.null(sub) || !nzchar(sub %||% "")) return(x)
  # Misma cuenta que `.lam_titulo`: el subtítulo baja lo que miden las líneas de más del título.
  pt <- .std_pt("titulo"); g_ <- .std_geom
  baja <- (max(1L, .lam_lineas_tinta(trimws(as.character(titulo %||% "")[1]), 10.4, pt, TRUE)) - 1L) * pt * 1.2 / 72
  y_sub <- g_("titulo_y") + 0.55 + baja; y_enc <- g_("zona_datos_y0") - 0.25
  if (y_sub + 0.32 <= y_enc || y_enc + 0.26 <= y_sub) return(x)   # no comparten franja
  fin_sub <- .std_geom("margen_izq") + 0.1 + max(.lam_ancho_tinta(as.character(sub)[1], 12.5))
  max(x, fin_sub + 0.3)
}
