# =============================================================================
# graficador_n_por_barra.R — la N baja al grafico cuando la fila no cuadra
# =============================================================================
#
# La lamina metodologica del entregable aprobado promete esto con todas sus
# letras: «en los casos en que una pregunta presenta un numero de respuestas
# menor al total de la base debido a saltos en el cuestionario, esta cifra se
# muestra directamente en el grafico correspondiente».
#
# El motor emitia esa frase y no la cumplia: CERO anotaciones «N = …» dentro de
# graficos contra ONCE del aprobado. Tenia el dato —`var_n` es la N por
# categoria— y dos formas de enseñarlo que no son esta: entre parentesis dentro
# de la etiqueta, y la barra extra que P9 quito por no estar en el aprobado.
#
# Lo que faltaba es la tercera: una anotacion pequeña a la derecha de la barra,
# SOLO en las filas cuya N es menor que la base. Ese «solo» es lo que la hace
# util: si apareciera en todas seria ruido, y justamente lo que hay que ver es
# la fila que NO cuadra con el pie.
#
# Medido sobre el aprobado, patron dominante (7 de sus 11, lamina 18): 8 pt,
# cursiva, pegada al final del area de barras, una por fila, con el `top`
# siguiendo a su barra.

# NO ESTA ENGANCHADO, y la razon es lo que hay que resolver antes.
#
# Se probo colgando la capa en `graficador_barras_apiladas.R` con la base
# tomada como la MAYOR N de la lamina —el graficador no conoce el pie—. Medido
# tras regenerar: 146 anotaciones contra las 11 del aprobado.
#
# El criterio confunde dos cosas que no son la misma. En una lamina con tres
# publicos —52 docentes, 172 estudiantes, 15 administrativos— los dos pequenos
# quedan por debajo del mayor y se anotan los tres, cuando ninguno tiene salto
# de cuestionario: simplemente son publicos de distinto tamano. Lo que el
# aprobado anota es la fila cuya N es menor que LA BASE DE SU PROPIO PUBLICO.
#
# Esa base existe en el motor de plan —`.reporte_plan_base_na_reducida()` ya
# decide si una base esta reducida— pero no viaja al graficador. Hacerla llegar
# es el trabajo que falta; el helper de aqui esta listo para consumirla.

# Cuerpo de la anotacion, en puntos. El aprobado usa 8: es una acotacion, no un
# dato de la lamina, y a 10 compite con las cifras de dentro de la barra.
.N_BARRA_SIZE_PT <- 8

# Tolerancia para decidir que una fila «no cuadra». Un caso de diferencia sobre
# una base de 178 es redondeo del filtrado, no un salto del cuestionario; el
# aprobado no lo anota.
.N_BARRA_TOLERANCIA <- 1L


#' Que filas merecen su N anotada
#'
#' @param n_por_fila N de cada fila.
#' @param n_base Base de la lamina, la que va en el pie.
#' @param tolerancia Diferencia por debajo de la cual no se anota.
#' @return Vector logico, uno por fila.
#' @keywords internal
.n_barra_procede <- function(n_por_fila, n_base, tolerancia = .N_BARRA_TOLERANCIA) {
  n <- suppressWarnings(as.numeric(n_por_fila))
  base <- suppressWarnings(as.numeric(n_base)[1])
  if (!length(n) || !is.finite(base) || base <= 0) {
    return(rep(FALSE, max(1L, length(n))))
  }
  tol <- suppressWarnings(as.numeric(tolerancia)[1])
  if (!is.finite(tol) || tol < 0) tol <- 0
  # Solo por DEBAJO. Una fila con mas respuestas que la base no es un salto del
  # cuestionario: es un error de calculo, y anotarlo aqui lo disfrazaria de
  # nota metodologica en vez de dejarlo salir por donde debe.
  is.finite(n) & n > 0 & (base - n) > tol
}


#' Texto de la anotacion
#'
#' `N = 12`, con el espacio a los dos lados del igual. El aprobado escribe tanto
#' «N= 178» como «N = 12»; se toma la forma espaciada, que es la de su patron
#' dominante —siete de sus once—.
#'
#' @keywords internal
.n_barra_texto <- function(n) {
  v <- suppressWarnings(as.numeric(n)[1])
  if (!is.finite(v)) return("")
  sprintf("N = %s", format(round(v), big.mark = "", trim = TRUE))
}


#' Capa de anotaciones de N para un grafico de barras horizontales
#'
#' Devuelve una capa de `ggplot2` lista para sumar, o `NULL` si no hay ninguna
#' fila que anotar —que es el caso normal y por eso no se fuerza nada—.
#'
#' @param y_pos Posicion de cada fila en la escala del panel.
#' @param n_por_fila N de cada fila.
#' @param n_base Base de la lamina.
#' @param x Posicion horizontal de la anotacion, en la escala del panel.
#' @param color,size_pt Estilo.
#' @return Capa de ggplot2, o `NULL`.
#' @keywords internal
.n_barra_capa <- function(y_pos, n_por_fila, n_base, x = 1.02,
                          color = "#081F5C", size_pt = .N_BARRA_SIZE_PT) {
  procede <- .n_barra_procede(n_por_fila, n_base)
  if (!any(procede)) return(NULL)

  y <- suppressWarnings(as.numeric(y_pos))
  n <- suppressWarnings(as.numeric(n_por_fila))
  if (length(y) != length(n)) return(NULL)

  df <- data.frame(
    .x = suppressWarnings(as.numeric(x)[1]),
    .y = y[procede],
    .lab = vapply(n[procede], .n_barra_texto, character(1)),
    stringsAsFactors = FALSE
  )
  if (!nrow(df) || any(!is.finite(df$.y))) return(NULL)

  ggplot2::geom_text(
    data = df,
    mapping = ggplot2::aes(x = .data$.x, y = .data$.y, label = .data$.lab),
    inherit.aes = FALSE,
    hjust = 0, vjust = 0.5,
    # ggplot mide `size` en milimetros: a puntos, x 2.845.
    size = size_pt / 2.845,
    colour = color,
    fontface = "italic",
    family = "Arial"
  )
}
