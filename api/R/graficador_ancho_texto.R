# =============================================================================
# graficador_ancho_texto.R — cuanto mide de verdad una etiqueta
# =============================================================================
#
# P43. Los graficadores deciden si una etiqueta de eje cabe multiplicando su
# numero de caracteres por un ancho medio estimado. Ese estimado es `0.55` em
# —`char_in <- size * 0.55 / 72`— y no salio de medir nada.
#
# LO QUE COSTO, medido en la lamina 13 del mazo de Conta contra el entregable
# aprobado. Con el cajon de 5.2 in y la fraccion de etiquetas en 0.45, la
# columna disponible es `5.2 * 0.45 - 0.12 = 2.22 in`. La cuenta estimada dice
# que «Entre 1500 y 3000 soles» —23 caracteres a 13 pt— pide
# `23 * 13 * 0.55 / 72 = 2.28 in`, o sea que NO cabe: se envuelve a dos lineas,
# y entonces el ajuste de P42 baja el cuerpo a 7.99 pt para que las dos quepan
# en la fila. El aprobado resuelve la misma etiqueta a **13 pt en una sola
# linea**.
#
# Medida de verdad con `systemfonts::string_width()`, esa etiqueta en Arial 13
# pt mide **1.958 in**. Cabia en 2.22 con un cuarto de pulgada de sobra. El
# 0.55 la rechazaba por un solo caracter: el ancho medio real de estas
# etiquetas esta en **0.47–0.50 em**, no en 0.55.
#
# Y el 0.55 no es un error tonto: medido sobre las 1.174 formas de texto de una
# sola corrida del mazo, el cociente `ancho_caja / (n_car * pt/72)` da mediana
# **0.507** y p75 **0.552**. O sea que 0.55 es el percentil 75 de las CAJAS —que
# incluyen relleno y alineacion— y no el ancho del texto. Como estimado
# conservador es razonable; como criterio de si algo cabe, sobra por defecto y
# encoge lo que no hacia falta encoger.
#
# La salida de aqui es la misma que consumia el llamador —un numero de
# caracteres para `str_wrap()`— para no cambiar de contrato a media reparacion.

# Ancho medio por caracter, en em, cuando no se puede medir. Se conserva el
# valor historico a proposito: si `systemfonts` no esta, el comportamiento tiene
# que ser exactamente el de antes y no uno nuevo sin medir.
.ANCHO_CHAR_EM_ESTIMADO <- 0.55


#' Ancho real de un texto, en pulgadas
#'
#' Devuelve `NA_real_` cuando no hay con que medir; quien llama decide el
#' respaldo.
#'
#' @param texto Vector de cadenas.
#' @param size_pt Cuerpo en puntos.
#' @param family Familia tipografica.
#' @return Anchos en pulgadas, uno por cadena, o `NA_real_`.
#' @keywords internal
.ancho_texto_in <- function(texto, size_pt, family = "Arial") {
  t <- as.character(texto)
  if (!length(t)) return(numeric(0))
  pt <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(pt) || pt <= 0) return(rep(NA_real_, length(t)))
  if (!requireNamespace("systemfonts", quietly = TRUE)) {
    return(rep(NA_real_, length(t)))
  }
  # `string_width()` devuelve puntos con las metricas reales de la fuente, que
  # es justo lo que el estimado por caracter no puede saber: una etiqueta de
  # cifras y espacios es mucho mas angosta que una de mayusculas.
  w <- tryCatch(
    systemfonts::string_width(t, family = family, size = pt),
    error = function(e) NULL
  )
  if (is.null(w) || length(w) != length(t)) return(rep(NA_real_, length(t)))
  out <- suppressWarnings(as.numeric(w) / 72)
  out[!is.finite(out)] <- NA_real_
  out
}


#' Cuantos caracteres caben en un ancho dado
#'
#' Si la etiqueta mas larga ya cabe entera, devuelve su propio largo: envolver
#' seria partir por partir. Si no cabe, el presupuesto se deriva del ancho
#' **medido** de esa misma etiqueta y no de un ancho medio de catalogo, que es
#' la diferencia entre rechazar por un caracter y aceptar con sobra.
#'
#' @param etiquetas Etiquetas del eje.
#' @param ancho_in Ancho disponible, en pulgadas.
#' @param size_pt Cuerpo en puntos.
#' @param family Familia tipografica.
#' @param minimo Piso de caracteres, para no devolver un presupuesto absurdo.
#' @return Numero entero de caracteres, o `NA_integer_` si no se pudo medir.
#' @keywords internal
.chars_que_caben <- function(etiquetas, ancho_in, size_pt, family = "Arial",
                             minimo = 10L) {
  et <- as.character(etiquetas)
  et <- et[!is.na(et) & nzchar(et)]
  a <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!length(et) || !is.finite(a) || a <= 0) return(NA_integer_)

  anchos <- .ancho_texto_in(et, size_pt, family = family)
  if (all(is.na(anchos))) return(NA_integer_)

  largos <- nchar(et, type = "width", allowNA = FALSE, keepNA = FALSE)
  ok <- is.finite(anchos) & is.finite(largos) & largos > 0
  if (!any(ok)) return(NA_integer_)

  # La que manda es la que mas ancho pide, no la que mas caracteres tiene: en
  # «Entre 1500 y 3000 soles» los digitos y los espacios pesan menos que las
  # letras, y ordenar por numero de caracteres se equivoca de etiqueta.
  peor <- which.max(anchos[ok])
  ancho_peor <- anchos[ok][peor]
  largo_peor <- largos[ok][peor]

  if (ancho_peor <= a) return(as.integer(max(largos[ok])))

  por_char <- ancho_peor / largo_peor
  if (!is.finite(por_char) || por_char <= 0) return(NA_integer_)
  as.integer(max(minimo, floor(a / por_char)))
}
