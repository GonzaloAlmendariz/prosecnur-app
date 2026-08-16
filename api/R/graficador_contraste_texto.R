# El color de la cifra sale del segmento sobre el que cae.
#
# Estaba fijo en blanco. Funcionaba mientras el extremo negativo de la escala era
# el rojo institucional —oscuro—, y dejo de funcionar cuando la receta 4 lo
# cambio a naranja claro: las cifras que se leian sobre el rojo se volvieron
# invisibles sobre el naranja. Medido sobre el mazo de acreditacion: **37
# laminas** con cifras blancas sobre tramo claro, contra **cero** en el
# entregable aprobado.
#
# Lo que enseña el fallo, y por eso vive en su propio archivo: **cambiar un color
# de fondo cambia que color de texto encima se lee**. El arreglo del fondo se dio
# por cerrado con evidencia cierta —rojo 270 → 97, naranja 0 → 173— y esa mitad
# era verdad; la otra mitad no se miro.
#
# La decision se toma por LUMINANCIA y no contra una lista de hexes claros. Una
# lista hay que mantenerla cada vez que alguien añade un color a una paleta, y el
# dia que se olvide volveran las cifras invisibles sin que nada avise. La
# luminancia funciona con cualquier color, incluidos los que aun no existen.

# Umbral de luminancia por encima del cual un fondo se considera claro.
#
# 0.6 y no 0.5: entre 0.5 y 0.6 viven los verdes medios de la rampa, donde el
# blanco todavia se lee y el azul empieza a competir con el propio segmento.
.CONTRASTE_UMBRAL <- 0.6

# Color de la cifra sobre fondo claro. El azul institucional, que es el color de
# cuerpo del mazo.
.CONTRASTE_SOBRE_CLARO <- "#081F5C"


#' Luminancia relativa de un color hexadecimal
#'
#' Coeficientes de percepcion (0.299 / 0.587 / 0.114): el ojo no pesa igual los
#' tres canales, y un verde puro se percibe mucho mas claro que un azul puro de
#' la misma intensidad.
#'
#' @param hex Color como `"#RRGGBB"` o `"RRGGBB"`.
#' @return Luminancia entre 0 y 1, o `NA_real_` si no se puede leer.
#' @keywords internal
.contraste_luminancia <- function(hex) {
  h <- toupper(gsub("^#", "", as.character(hex)))
  out <- rep(NA_real_, length(h))
  ok <- !is.na(h) & grepl("^[0-9A-F]{6}$", h)
  if (!any(ok)) return(out)
  v <- h[ok]
  r <- strtoi(substr(v, 1, 2), 16L) / 255
  g <- strtoi(substr(v, 3, 4), 16L) / 255
  b <- strtoi(substr(v, 5, 6), 16L) / 255
  out[ok] <- 0.299 * r + 0.587 * g + 0.114 * b
  out
}


#' Color de texto legible sobre un fondo dado
#'
#' @param fill Color del segmento.
#' @param sobre_oscuro Color a usar cuando el fondo es oscuro.
#' @param sobre_claro Color a usar cuando el fondo es claro.
#' @param umbral Luminancia a partir de la cual el fondo es claro.
#'
#' @return Vector de colores, uno por entrada de `fill`. Cuando el fondo no se
#'   puede leer se conserva `sobre_oscuro`, que es el comportamiento de siempre.
#' @keywords internal
.contraste_texto <- function(fill, sobre_oscuro = "white",
                             sobre_claro = .CONTRASTE_SOBRE_CLARO,
                             umbral = .CONTRASTE_UMBRAL) {
  lum <- .contraste_luminancia(fill)
  out <- rep(as.character(sobre_oscuro)[1], length(lum))
  claro <- !is.na(lum) & lum > umbral
  out[claro] <- as.character(sobre_claro)[1]
  out
}
