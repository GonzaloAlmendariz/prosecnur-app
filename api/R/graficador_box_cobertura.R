# Cuando un box abarca la escala entera deja de ser un dato.
#
# Un Top 2 Box sobre una escala de dos categorias suma las dos y da 100 % en
# todas las filas: no informa nada, por aritmetica. El graficador ya lo evitaba
# contando columnas —menos de tres, se apaga—, pero se saltaba el guardia en
# cuanto habia categorias declaradas, con el argumento de que quien declara
# esta eligiendo que suma.
#
# Ese argumento vale para una declaracion hecha PARA ese grafico. Deja de valer
# cuando la declaracion se hereda: en una lamina de bloques, el analista declara
# «De acuerdo / Muy de acuerdo» una vez para todo el mazo, y el bloque que
# resulta ser una pregunta Si/No no eligio nada. Al heredar las etiquetas
# aparecieron 16 laminas con celdas al 100 %, entre ellas cuatro filas de
# «¿Conoce los propositos...?».
#
# El criterio correcto no es si hay declaracion ni de donde viene, sino si lo
# declarado cubre TODA la escala. Es el mismo que ya estaba escrito en el
# comentario del guardia; lo que faltaba era medirlo en vez de aproximarlo.

#' Normaliza una etiqueta de categoria para comparar
#'
#' Ignora mayusculas y tildes: en un estudio real la misma categoria convive
#' escrita de dos formas —«De acuerdo» y «De Acuerdo», «Si» y «SI»— porque cada
#' lista se escribio por separado.
#'
#' La transliteracion va por `stringi` y no por `iconv(to = "ASCII//TRANSLIT")`
#' porque esa depende de la libc: en macOS «SI» sale como `S'I` —con apostrofo—
#' y no empareja con `SI`, mientras que en el Linux del CI sale bien. Es decir,
#' el emparejamiento por etiquetas acentuadas funcionaba en el CI y fallaba en
#' la maquina donde se trabaja, en silencio y con la columna sumando de menos.
#' La app corre en macOS y Windows: la normalizacion tiene que dar lo mismo en
#' las tres.
#'
#' @keywords internal
.box_norm_etiqueta <- function(x) {
  x <- toupper(trimws(as.character(x)))
  if (requireNamespace("stringi", quietly = TRUE)) {
    return(stringi::stri_trans_general(x, "Latin-ASCII"))
  }
  # Sin stringi, mejor comparar con tildes que con el apostrofo que mete iconv.
  x
}


#' Columnas de porcentaje que seleccionan unas etiquetas declaradas
#' @keywords internal
.box_cols_desde_etiquetas <- function(labels_sel, etiquetas_grupos, cols_porcentaje) {
  if (is.null(labels_sel) || !length(labels_sel)) return(character(0))
  sel <- .box_norm_etiqueta(labels_sel)
  hit <- names(etiquetas_grupos)[.box_norm_etiqueta(etiquetas_grupos) %in% sel]
  unique(hit[hit %in% cols_porcentaje])
}


#' Decide si la columna de box se dibuja, y con que columnas
#'
#' Concentra en un sitio las tres razones por las que un box no informa:
#'
#' - **No empareja nada.** Hay categorias declaradas pero ninguna existe en esta
#'   escala. Pasa al heredar la declaracion del mazo sobre un bloque que resulta
#'   ser una pregunta Si/No. Antes se caia al reparto posicional —«las dos
#'   ultimas»— que sobre una escala de dos son las dos: la columna salia al
#'   100 % en todas las filas. Adivinar aqui es justo lo que el motor ya se
#'   niega a hacer cuando no hay declaracion ninguna.
#' - **Cubre la escala entera.** Lo declarado son todas las categorias, asi que
#'   la suma es 100 % por construccion.
#' - **La escala es demasiado corta** para el preset y no hay declaracion.
#'
#' @param labels Categorias declaradas, o `NULL`.
#' @param etiquetas_grupos Mapa columna -> etiqueta visible.
#' @param cols_porcentaje Columnas de porcentaje de la escala.
#' @param minimo Categorias minimas que exige el preset.
#'
#' @return Lista con `dibujar`, `cols` y `motivo`.
#' @keywords internal
.box_decidir <- function(labels, etiquetas_grupos, cols_porcentaje, minimo = 3L) {
  no <- function(motivo) list(dibujar = FALSE, cols = character(0), motivo = motivo)

  if (!length(cols_porcentaje)) return(no("sin_escala"))

  if (length(labels)) {
    sel <- .box_cols_desde_etiquetas(labels, etiquetas_grupos, cols_porcentaje)
    if (!length(sel)) return(no("no_empareja"))
    if (length(sel) >= length(cols_porcentaje)) return(no("cubre_escala"))
    return(list(dibujar = TRUE, cols = sel, motivo = "declarado"))
  }

  # Sin declaracion no se dibuja nunca. La regla posicional —«las dos ultimas»—
  # asume un orden de peor a mejor y, cuando la escala no lo respeta, suma las
  # dos equivocadas sin que nadie se entere. Un box es una decision
  # metodologica, no una consecuencia del orden de las columnas.
  #
  # Se distinguen dos casos porque uno es accionable y el otro no: sobre una
  # escala demasiado corta no hay nada que declarar, y avisar por cada pregunta
  # Si/No del mazo solo tapa los avisos que si sirven.
  if (length(cols_porcentaje) < minimo) return(no("escala_corta"))
  no("sin_declaracion")
}


#' Indica si lo declarado cubre la escala entera
#'
#' @param labels_sel Etiquetas declaradas para el box.
#' @param etiquetas_grupos Mapa columna -> etiqueta visible.
#' @param cols_porcentaje Columnas de porcentaje de la escala.
#'
#' @return `TRUE` si el box sumaria todas las categorias presentes.
#' @keywords internal
.box_cubre_escala_completa <- function(labels_sel, etiquetas_grupos, cols_porcentaje) {
  if (!length(cols_porcentaje)) return(FALSE)
  sel <- .box_cols_desde_etiquetas(labels_sel, etiquetas_grupos, cols_porcentaje)
  if (!length(sel)) return(FALSE)
  # Una escala de una sola categoria tampoco informa, pero de eso ya se ocupa
  # el minimo por preset: aqui solo interesa el caso "lo declarado son todas".
  length(sel) >= length(cols_porcentaje)
}
