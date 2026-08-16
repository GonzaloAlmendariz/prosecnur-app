# Piso de grosor de barra declarado en PULGADAS.
#
# Los graficadores fijan el grosor en unidades ggplot: una fraccion de la fila
# que ocupa la categoria. Ese numero no dice nada sobre lo que se ve. Una barra
# al 0.70 de su fila es gruesa si la fila mide media pulgada y es una cinta si
# la fila mide un quinto, y el recetario pone el piso donde se mide —0.32 in en
# escala, 0.20 in en categorica—, no en la fraccion.
#
# La conversion es directa: el grosor en pulgadas es la fraccion por el alto de
# la fila. Con eso el piso deja de ser un numero magico calibrado a ojo y pasa a
# ser el que el recetario declara.
#
# El piso es un objetivo, no una garantia: cuando el alto de fila es tan corto
# que ni la barra entera lo alcanza, se llega al tope y no mas. Forzar mas seria
# pegar las barras unas con otras, que es peor que una barra fina.

# Fraccion maxima de la fila que puede ocupar una barra. Por encima de esto las
# barras se tocan y el panel se lee como un bloque.
.GROSOR_TOPE_FRACCION <- 0.92


#' Alto en pulgadas de la fila de una categoria
#'
#' Vive aqui —y no dentro del graficador— porque lo necesitan dos momentos
#' distintos: cuando se decide el grosor y, mucho despues, cuando se calcula el
#' alto del panel. Dos copias del mismo calculo divergen en cuanto una se toca.
#'
#' @param alto_por_categoria Alto declarado, o `NULL` para el de por defecto.
#' @param needs_tall_label_slot `TRUE` si las etiquetas piden fila alta.
#' @param max_lineas_eje_y Lineas de la etiqueta mas larga.
#'
#' @return Alto de fila en pulgadas.
#' @keywords internal
.grosor_alto_por_categoria <- function(alto_por_categoria = NULL,
                                       needs_tall_label_slot = FALSE,
                                       max_lineas_eje_y = 1L) {
  alto <- suppressWarnings(as.numeric(alto_por_categoria %||% 0.42)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) alto <- 0.42
  if (isTRUE(needs_tall_label_slot)) {
    n <- suppressWarnings(as.numeric(max_lineas_eje_y)[1])
    if (!is.finite(n) || is.na(n)) n <- 1
    alto <- max(alto, if (n >= 8) 1.06 else 0.96)
  }
  alto
}


#' Sube el grosor hasta que la barra alcance su piso en pulgadas
#'
#' @param grosor_eff Grosor en unidades ggplot (fraccion de la fila).
#' @param alto_por_cat Alto de la fila, en pulgadas.
#' @param piso_in Piso declarado por la familia, en pulgadas. `NULL` o `<= 0`
#'   desactiva el piso y devuelve el grosor tal cual.
#' @param tope Fraccion maxima de la fila.
#'
#' @return Grosor en unidades ggplot, nunca menor que el recibido.
#' @keywords internal
.grosor_con_piso_in <- function(grosor_eff, alto_por_cat, piso_in,
                                tope = .GROSOR_TOPE_FRACCION) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_eff)

  piso <- suppressWarnings(as.numeric(piso_in %||% NA_real_)[1])
  if (!is.finite(piso) || is.na(piso) || piso <= 0) return(g)

  alto <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) return(g)

  # Fraccion de fila que hace falta para llegar al piso. Si pasa del tope, la
  # fila es demasiado corta y no hay grosor que lo arregle: subir mas solo
  # pegaria las barras entre si.
  necesaria <- piso / alto
  max(g, min(tope, necesaria))
}


#' Grosor resultante en pulgadas, para verificar
#' @keywords internal
.grosor_en_pulgadas <- function(grosor_eff, alto_por_cat) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  a <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(g) || !is.finite(a)) return(NA_real_)
  g * a
}
