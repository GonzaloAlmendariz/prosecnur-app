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

# Techo de grosor de barra en PULGADAS. 0.394 in son 1.0 cm, que es el grosor
# mayor que usa el entregable aprobado en cualquiera de sus laminas.
#
# Existe por la misma razon que el piso, del otro lado: en una lamina de cuatro
# paneles, el cuadrante con dos barras estira su panel y sale a 1.45 o 1.68 cm
# mientras el de cinco se queda en 0.70. Medido, el motor dispersaba 0.75-0.98
# cm dentro de una misma lamina y el aprobado 0.12-0.29.
.GROSOR_TECHO_IN <- 0.394

# Rejilla del grosor de barra, en pulgadas. 0.0394 in = 1 mm.
#
# Dos laminas del mismo tipo salian con grosores que solo diferian en decimas
# de milimetro —1.17 y 1.16 y 1.19 cm— porque el reparto de alto depende del
# cromo de cada bloque. Medido sobre el mazo: 22 grosores distintos en 411
# barras, contra 17 en 408 del entregable aprobado, que ademas concentra 153
# barras en un solo valor.
#
# MEDIDO Y DESCARTADO como remedio: aplicada a todo el mazo, la rejilla bajo de
# 22 grosores distintos a 21. La dispersion no es de redondeo —no hay valores
# casi iguales que colapsar—, son grosores GENUINAMENTE distintos que salen del
# reparto de alto: 0.65, 1.09, 1.65 y 2.02 cm en laminas de tres filas. El
# helper se conserva porque la funcion es correcta y el dato de que no sirve
# vale mas escrito que reaprendido, pero no se aplica.
.GROSOR_REJILLA_IN <- 0.0394


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


#' Recorta el grosor cuando pasa del techo declarado
#'
#' El piso y el techo no son simetricos: el piso es un objetivo que puede no
#' alcanzarse —si la fila es corta, no hay grosor que la agrande sin pegar las
#' barras—, mientras el techo si se cumple siempre, porque recortar nunca crea
#' un problema de espacio.
#'
#' @param grosor_eff Grosor en unidades ggplot (fraccion de la fila).
#' @param alto_por_cat Alto de la fila, en pulgadas.
#' @param techo_in Techo declarado, en pulgadas. `NULL` o `<= 0` lo desactiva.
#' @return Grosor en unidades ggplot, nunca mayor que el recibido.
#' @keywords internal
.grosor_con_techo_in <- function(grosor_eff, alto_por_cat,
                                 techo_in = .GROSOR_TECHO_IN) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_eff)

  techo <- suppressWarnings(as.numeric(techo_in %||% NA_real_)[1])
  if (!is.finite(techo) || is.na(techo) || techo <= 0) return(g)

  alto <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(alto) || is.na(alto) || alto <= 0) return(g)

  min(g, techo / alto)
}


#' Ajusta el grosor a la rejilla del milimetro
#'
#' Sobre el grosor en PULGADAS FISICAS, no sobre la fraccion: dos barras con la
#' misma fraccion y distinto alto de fila no miden lo mismo, y es la medida
#' fisica la que se compara entre laminas.
#'
#' @param grosor_in Grosor en pulgadas.
#' @param rejilla Paso de la rejilla, en pulgadas.
#' @return El grosor ajustado, o el original si no se puede leer.
#' @keywords internal
.grosor_a_rejilla <- function(grosor_in, rejilla = .GROSOR_REJILLA_IN) {
  g <- suppressWarnings(as.numeric(grosor_in)[1])
  if (!is.finite(g) || is.na(g) || g <= 0) return(grosor_in)
  r <- suppressWarnings(as.numeric(rejilla)[1])
  if (!is.finite(r) || is.na(r) || r <= 0) return(g)
  round(g / r) * r
}


#' Grosor resultante en pulgadas, para verificar
#' @keywords internal
.grosor_en_pulgadas <- function(grosor_eff, alto_por_cat) {
  g <- suppressWarnings(as.numeric(grosor_eff)[1])
  a <- suppressWarnings(as.numeric(alto_por_cat)[1])
  if (!is.finite(g) || !is.finite(a)) return(NA_real_)
  g * a
}
