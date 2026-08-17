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

# COMO SE RESOLVIO, y los dos intentos que costo.
#
# 1. Enganchado en el graficador con la base tomada como la MAYOR N de la
#    lamina: 146 anotaciones contra las 11 del aprobado. El criterio confundia
#    publico pequeno con salto de cuestionario — en una lamina de 52 docentes,
#    172 estudiantes y 15 administrativos anotaba los tres.
# 2. Deduciendo la base de la lamina: el criterio es correcto —las cuatro bases
#    de la lamina 18 salen exactas— pero el graficador NO ve la lamina, se le
#    llama UNA VEZ POR PREGUNTA. Cada llamada trae un publico por fila, asi que
#    su maximo es su propia N y no hay salto posible. Cero anotaciones.
#
# La base la calcula ahora el renderer de multilista, que si recorre todos los
# bloques —ya lo hacia para el paso de fila comun de P14—, y la pasa como
# `bases_publico`. Resultado medido: 4 anotaciones en la lamina 17, las cuatro
# filas cuyo N no cuadra con la base de su publico.

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
  # `Inf` significa «ya vienen filtradas, dejalas pasar»: lo usa quien decidio
  # con `.n_barra_procede_por_pregunta()` y solo quiere dibujar. Sin este caso,
  # el `is.finite()` de abajo las rechazaba TODAS y la capa salia vacia — cero
  # anotaciones con el mapa de bases ya llegando bien.
  if (length(n) && is.infinite(base) && base > 0) {
    return(is.finite(n) & n > 0)
  }
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


#' Que filas anotar cuando las barras se agrupan por pregunta
#'
#' La unidad NO es la fila: es la PREGUNTA. Medido sobre la lamina 18 del
#' entregable aprobado, cuya base declara «52 docentes, 172 estudiantes, 178
#' egresados y 15 administrativos», las siete N anotadas son 47, 160, 172, 15,
#' 30, 143 y 15 — y tres de ellas **coinciden con la base de su publico**.
#'
#' Si el criterio fuera fila a fila, esas tres no estarian. Estan porque su
#' PREGUNTA tiene algun publico con salto, y entonces se anotan todos: decir
#' «N = 143» solo en egresados deja al lector sin saber cuantos son los demas, y
#' la comparacion entre publicos —que es para lo que existe la lamina— se vuelve
#' una adivinanza.
#'
#' @param n_por_fila N de cada fila.
#' @param base_por_fila Base del publico de cada fila.
#' @param pregunta Identificador de la pregunta de cada fila.
#' @param tolerancia Diferencia por debajo de la cual no cuenta como salto.
#' @return Vector logico, uno por fila.
#' @keywords internal
.n_barra_procede_por_pregunta <- function(n_por_fila, base_por_fila, pregunta,
                                          tolerancia = .N_BARRA_TOLERANCIA) {
  n <- suppressWarnings(as.numeric(n_por_fila))
  base <- suppressWarnings(as.numeric(base_por_fila))
  g <- as.character(pregunta)
  if (!length(n) || length(base) != length(n) || length(g) != length(n)) {
    return(rep(FALSE, max(1L, length(n))))
  }
  tol <- suppressWarnings(as.numeric(tolerancia)[1])
  if (!is.finite(tol) || tol < 0) tol <- 0

  # Una fila «salta» si su N queda por debajo de la base de SU publico.
  salta <- is.finite(n) & is.finite(base) & base > 0 & n > 0 & (base - n) > tol
  # Y se anota la pregunta entera en cuanto una de sus filas salta.
  preguntas_con_salto <- unique(g[salta])
  g %in% preguntas_con_salto & is.finite(n) & n > 0
}


#' Base de cada publico deducida de la propia lamina
#'
#' El graficador no conoce el pie —quien lo compone es el motor de plan, y esa
#' cifra no viaja hasta aqui—, pero SI ve la lamina entera: todas las preguntas
#' de todos los publicos. La base de un publico es el mayor numero de respuestas
#' que da en cualquiera de esas preguntas, porque una pregunta sin salto la
#' responde su publico completo.
#'
#' Comprobado contra la lamina 18 del entregable aprobado, cuya base declara
#' «52 docentes, 172 estudiantes, 178 egresados y 15 administrativos»: sus filas
#' tienen 47 y 52 en docentes, 160 y 172 en estudiantes, 143 y 178 en egresados,
#' 15 y 15 en administrativos. Los maximos son 52, 172, 178 y 15 — las cuatro
#' bases, exactas.
#'
#' LIMITE, y se prefiere a no tener nada: si TODAS las preguntas de un publico
#' en esa lamina tuvieran salto, su maximo seria menor que su base real y esa
#' fila no se anotaria. El coste es una anotacion de menos, nunca una de mas ni
#' una equivocada.
#'
#' @param n_por_fila N de cada fila.
#' @param publico Publico de cada fila.
#' @return Base deducida, una por fila.
#' @keywords internal
.n_barra_base_por_publico <- function(n_por_fila, publico) {
  n <- suppressWarnings(as.numeric(n_por_fila))
  p <- as.character(publico)
  if (!length(n) || length(p) != length(n)) return(rep(NA_real_, length(n)))
  maximos <- tapply(n, p, function(v) suppressWarnings(max(v, na.rm = TRUE)))
  out <- as.numeric(maximos[p])
  out[!is.finite(out)] <- NA_real_
  out
}


#' Base por publico a partir de las N observadas en toda la lamina
#'
#' Gemela de `.n_barra_base_por_publico()`, pero para quien SI ve la lamina
#' entera: el renderer de multilista. Recibe una N por (publico, pregunta) y
#' devuelve el mapa `publico -> base`, que es su mayor observacion.
#'
#' Vive aqui y no en el renderer porque ese archivo esta congelado a
#' crecimiento: alli queda solo el bucle que recoge las N, que necesita
#' `.tab_freq()` y es local suyo.
#'
#' @param n Vector de N observadas.
#' @param publico Publico de cada observacion.
#' @return Vector nombrado `publico -> base`.
#' @keywords internal
.n_barra_bases_de_lamina <- function(n, publico) {
  v <- suppressWarnings(as.numeric(n))
  p <- as.character(publico)
  ok <- is.finite(v) & v > 0 & !is.na(p) & nzchar(p)
  if (!any(ok)) return(setNames(numeric(0), character(0)))
  tapply(v[ok], p[ok], max)
}


#' Base de cada fila, buscando su publico en el mapa de la lamina
#'
#' El `.cat_id` del layout llega prefijado —«tema_1__2__estudiantes»— porque el
#' renderer necesita que sea unico por fila. El publico es lo que va detras del
#' ultimo separador doble.
#'
#' @param cat_id Identificadores de fila del layout.
#' @param bases Mapa `publico -> base`.
#' @return Base de cada fila, `NA` si su publico no esta en el mapa.
#' @keywords internal
.n_barra_base_de_fila <- function(cat_id, bases) {
  ids <- as.character(cat_id)
  pub <- sub("^.*__", "", ids)
  out <- suppressWarnings(as.numeric(bases[pub]))
  out[!is.finite(out)] <- NA_real_
  out
}
