#' Paso entre filas de una barra apilada
#'
#' El paso crece cuando hay pocas categorias con etiquetas de eje largas: la
#' fila necesita alto para que quepa el texto. Eso esta bien en un grafico
#' suelto y es un problema en una lamina `multilista`, porque **cada bloque lo
#' decide por su cuenta**: en «Mecanismos de admision» el bloque de arriba
#' inflaba su paso y el de abajo no, y las barras salian a 1.19 y 0.90 cm sobre
#' la misma lamina —la fraccion era 0.33 contra 0.26—.
#'
#' Aqui el calculo vive aparte para poder pedirselo a todos los bloques ANTES de
#' renderizar ninguno, quedarse con el mayor y pasarselo a todos. Un paso comun
#' no cambia lo que cada bloque necesita para su texto: el mayor cubre al resto.
#'
#' @name graficador_row_step
NULL


# Paso base, sin inflar.
.ROW_STEP_BASE <- 1
# Paso base cuando las etiquetas van arriba de su barra.
.ROW_STEP_ETIQUETAS_ARRIBA <- 1.72
# Tope del inflado: por encima los bloques quedan a una distancia que se come
# la leyenda.
.ROW_STEP_TOPE <- 3.20


#' @param n_categorias Numero de filas del bloque.
#' @param max_lineas_eje_y Lineas de la etiqueta de eje mas larga.
#' @param etiquetas_arriba `TRUE` si las etiquetas van sobre la barra.
#' @return Paso entre filas, en unidades de la escala Y.
#' @keywords internal
.apiladas_row_step <- function(n_categorias, max_lineas_eje_y,
                               etiquetas_arriba = FALSE) {
  base <- if (isTRUE(etiquetas_arriba)) .ROW_STEP_ETIQUETAS_ARRIBA else .ROW_STEP_BASE

  n <- suppressWarnings(as.numeric(n_categorias)[1])
  lineas <- suppressWarnings(as.numeric(max_lineas_eje_y)[1])
  if (!is.finite(n) || !is.finite(lineas)) return(base)

  # Solo con POCAS categorias: con muchas, la fila ya es corta y el texto se
  # resuelve por otro lado.
  if (n > 4 || lineas < 5) return(base)
  max(base, min(.ROW_STEP_TOPE, 1.16 + lineas * 0.28))
}


#' Paso comun para un conjunto de bloques
#'
#' El mayor de todos: es el unico que cubre las necesidades de texto de cada
#' uno. Quedarse con el menor dejaria alguna etiqueta sin sitio.
#'
#' @param pasos Vector de pasos, uno por bloque.
#' @return El paso comun, o `NULL` si no hay ninguno utilizable.
#' @keywords internal
.apiladas_row_step_comun <- function(pasos) {
  p <- suppressWarnings(as.numeric(unlist(pasos)))
  p <- p[is.finite(p) & p > 0]
  if (!length(p)) return(NULL)
  max(p)
}


# Piso editorial de un bloque de UNA fila. Existe porque una barra sola bajo
# filas virtuales salia a ~22 % del panel —«muy delgada y poco profesional»— y
# se sube a ~35 %. La banda [0.55, 0.85] es la de los defaults: un grosor
# explicito fuera de ella es intencion del analista y no se pisa.
.APILADAS_GROSOR_UNA_FILA <- 0.95


#' Un bloque de una fila, ¿debe recibir el piso editorial?
#'
#' Solo si esta SOLO en su lamina. El piso se penso para la lamina de un unico
#' bloque, donde la barra no tiene con que compararse; en una multilista la
#' barra sola esta al lado de otras, y subirla al 0.95 mientras sus vecinas van
#' al 0.78 produce dos defectos a la vez:
#'
#' - dentro de la lamina, dos bloques con distinto grosor (regla B3);
#' - entre laminas, dos gemelas que no salen iguales (regla B4), porque una
#'   tiene un bloque de una fila y la otra no.
#'
#' Es el hermano de `.apiladas_row_step_comun()`: aquel unifico el PASO entre
#' bloques y este el GROSOR, que era la mitad que quedo suelta.
#'
#' NO ESTA ENGANCHADO, y el motivo importa. Se escribio contra la hipotesis de
#' que el salto de 1.20x entre laminas gemelas —0.980 contra 1.173 cm en las
#' `rampa:7`, 1.694 contra 2.068 en las `rampa:3`— venia de este piso, porque
#' 0.95/0.78 da exactamente ese cociente. Enganchado en los DOS sitios donde
#' vive el piso, la vara no se movio ni una decima: 22 hallazgos antes y
#' despues, 22 grosores distintos, ratio 2.98 en ambos.
#'
#' La razon: el preset declara `grosor_modo = "manual"`, asi que
#' `.auto_bar_width_apiladas()` no llega a llamarse y la fraccion es 0.7 fija.
#' Lo que varia es el ALTO DE FILA, y los numeros cuadran exactos:
#' 0.55 x 0.7 = 0.978 cm, 0.651 x 0.7 = 1.19, 0.74 x 0.7 = 1.36 —los tres
#' valores que el verificador mide—. La reparacion esta en igualar
#' `alto_por_categoria` entre laminas de la misma familia, no en el grosor.
#'
#' El helper se conserva con sus tests porque el razonamiento sigue siendo
#' correcto para un mazo en modo `auto`, y porque la medicion que lo descarta
#' aqui vale mas escrita que reaprendida.
#'
#' @param n_bloques Bloques de la lamina.
#' @return `TRUE` si el piso editorial procede.
#' @keywords internal
.apiladas_piso_una_fila_procede <- function(n_bloques) {
  n <- suppressWarnings(as.numeric(n_bloques)[1])
  # Sin dato, se conserva el comportamiento previo: el piso se aplica. Quitarlo
  # por no saber cuantos bloques hay devolveria la barra enclenque de B36/G-2.
  if (!is.finite(n)) return(TRUE)
  n <= 1
}
