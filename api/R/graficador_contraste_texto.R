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
# 0.52, medido contra el entregable aprobado. Con 0.6 el verde alto de la rampa
# —`#70AD47`, luminancia 0.561— caia del lado oscuro y su cifra salia BLANCA:
# siete en la lamina de estructura organizacional, donde el aprobado no usa
# ninguna. El aprobado escribe azul sobre ese verde en las tres laminas
# equivalentes, asi que el corte va por debajo de 0.561.
#
# No baja mas: el rojo institucional (`#CA5651`, 0.471) y el azul de cuerpo
# (`#081F5C`, 0.122) tienen que seguir llevando cifra blanca.
.CONTRASTE_UMBRAL <- 0.52

# Color de la cifra sobre fondo claro. El azul institucional, que es el color de
# cuerpo del mazo.
.CONTRASTE_SOBRE_CLARO <- "#081F5C"


# Familias con color de cifra FIJO, por decision de la casa.
#
# La luminancia decide bien cuando la paleta es libre, pero en las dos familias
# que el mazo usa a diario la casa ya tiene criterio y no quiere que varie
# segmento a segmento: en la dicotomica azul la cifra va SIEMPRE blanca, y en la
# escala Likert SIEMPRE en azul Pulso. Una lamina donde unas cifras salen
# blancas y otras azules se lee como un error aunque cada una, por separado,
# tenga contraste suficiente.
.CONTRASTE_FAMILIA_DICOTOMICA <- c("081F5C", "9DC3E6")
.CONTRASTE_FAMILIA_LIKERT <- c(
  "F4B183", "FFD965", "FFD966", "EFD25E", "ADD493", "B0D597",
  "8FC36B", "85BB85", "70AD47", "BFBFBF"
)


#' Color de cifra fijo de una familia, o `NULL` si no la reconoce
#'
#' Devuelve `NULL` —y no un color por defecto— cuando los rellenos no son de
#' ninguna de las dos familias: ahi sigue mandando la luminancia, que es lo
#' correcto para una paleta que el analista invento.
#'
#' @param fills Colores de relleno del grafico.
#' @return `"white"`, el azul Pulso, o `NULL`.
#' @keywords internal
.contraste_familia <- function(fills) {
  f <- toupper(gsub("^#", "", as.character(fills)))
  f <- f[!is.na(f) & nzchar(f)]
  if (!length(f)) return(NULL)
  u <- unique(f)

  # El gris de «SIN INF» acompana a la escala pero no la define: si SOLO hay
  # gris no se puede decidir la familia.
  sin_gris <- setdiff(u, "BFBFBF")
  if (!length(sin_gris)) return(NULL)

  if (all(sin_gris %in% .CONTRASTE_FAMILIA_DICOTOMICA)) return("white")
  if (all(sin_gris %in% .CONTRASTE_FAMILIA_LIKERT)) return(.CONTRASTE_SOBRE_CLARO)
  NULL
}


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
