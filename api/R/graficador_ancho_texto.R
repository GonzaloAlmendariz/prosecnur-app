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


#' El subbloque hereda el cajon de su lamina
#'
#' P46. `.render_element()` inyecta `ancho` y `alto` en el elemento que
#' renderiza, pero una lamina `multilista` compone VARIOS subbloques y cada uno
#' es un `ppt_element` propio que se renderiza sin volver a pasar por ahi. El
#' padre sabia el tamano de su cajon y los hijos no.
#'
#' Medido sobre el mazo de Conta, pasada de PPT: **20 llamadas llegaban con
#' `ancho = 10`** —el default de la firma de `graficar_barras_apiladas()`—
#' mientras la lamina se dibuja a **12.511 in**. Con `canvas_w_grupo = 0.22`,
#' `w_sum = 1.02` y fraccion 0.2157, el canal para envolver salia
#' `0.2157 * 10 - 0.06 = 2.097 in` cuando el real es
#' `0.2157 * 12.511 = 2.699 in`: el enunciado se envolvia un **22 % mas
#' estrecho que su sitio**, pedia mas lineas de las necesarias y el cupo de
#' `.barras_acotar_titulo_grupo()` lo recortaba. Veintidos enunciados truncados
#' en dieciseis laminas; el entregable aprobado, cero.
#'
#' Vive aqui y no en `reporte_plan_ppt.R` porque ese archivo esta congelado a
#' crecimiento: alli queda solo la llamada.
#'
#' El alto viaja igual que el ancho por simetria y porque su ausencia es el
#' mismo defecto —P42 lo pago en el otro eje—; un subbloque que declare el suyo
#' manda, que es la regla de siempre de los `overrides`.
#'
#' @param hijo Overrides del subbloque.
#' @param padre Overrides de la lamina.
#' @return Los overrides del subbloque con el cajon heredado.
#' @keywords internal
.multilista_heredar_cajon <- function(hijo, padre) {
  hijo  <- hijo  %||% list()
  padre <- padre %||% list()
  for (k in c("ancho", "alto")) {
    if (is.null(hijo[[k]]) && !is.null(padre[[k]])) hijo[[k]] <- padre[[k]]
  }
  hijo
}


#' Cuerpo del enunciado de bloque que cabe en toda la lamina
#'
#' P46. `.barras_acotar_titulo_grupo()` recorta cuando el texto pide mas lineas
#' de las que su bloque sostiene, y marca el corte con «…». Medido sobre el mazo
#' de Conta: **21 enunciados truncados en 16 laminas de 66**, y el entregable
#' aprobado **cero**.
#'
#' Trazado el cupo en la corrida entera —191 llamadas—, casi todos los recortes
#' son bloques de UNA fila pidiendo de 4 a 11 lineas contra un cupo de 2 a 6. La
#' fila mide de 0.40 a 1.17 in y una linea a 14 pt con interlineado 0.86 ocupa
#' 0.167: no caben, y ensanchar el canal no basta —eso ya se hizo y los
#' truncados solo bajaron de 22 a 21—.
#'
#' La palanca que si usa el aprobado es el CUERPO: sus enunciados largos van a
#' **12 pt** (lamina 29, con nueve y doce lineas) y **13 pt** (laminas 35 y 39)
#' donde el motor pone 14. Esto hace lo mismo: baja el cuerpo hasta que el texto
#' cabe, con piso.
#'
#' DOS DECISIONES, las dos medidas:
#'
#' · **Se re-envuelve a cada tamano candidato, no se escala la cuenta.** A 11 pt
#'   cada linea lleva ~27 % mas texto, asi que un enunciado de nueve lineas baja
#'   a siete. La cuenta estatica —cuerpo = alto / (lineas x interlineado)—
#'   subestima el remedio porque supone que el numero de lineas no cambia.
#' · **El tamano es UNO POR LAMINA, no uno por bloque.** El aprobado usa un solo
#'   cuerpo en toda su lamina 29, 12 pt para sus cuatro enunciados. Mezclar
#'   tamanos entre bloques vecinos no lo hace nadie y se ve.
#'
#' Es la tercera aparicion de la forma «baja el cuerpo hasta que quepa»
#' —`.agrupadas_size_que_cabe()` la resuelve para la etiqueta de eje—, y por eso
#' vive aqui y no como un parche del graficador.
#'
#' @param textos Enunciados de los bloques de la lamina.
#' @param altos_in Alto disponible de cada bloque, en pulgadas. Mismo largo.
#' @param wrap_fun Funcion `(texto, size_pt) -> ancho de wrap en caracteres`.
#'   Se inyecta para que el llamador use su propio medidor —el graficador ya
#'   tiene `.barras_wrap_titulo_grupo()`, que mide con `grid::textGrob`— sin que
#'   este helper tenga que conocer el reparto de columnas.
#' @param size_pt Cuerpo declarado. Es el techo: nunca se sube.
#' @param interlinea Interlineado del enunciado.
#' @param minimo_pt Piso. Por debajo el enunciado deja de leerse, que es peor
#'   que verlo cortado.
#' @param paso_pt Salto entre candidatos.
#' @return El mayor cuerpo <= `size_pt` con el que TODOS los bloques caben, o
#'   `minimo_pt` si ninguno lo consigue.
#' @keywords internal
.titulo_grupo_size_que_cabe <- function(textos, altos_in, wrap_fun, size_pt,
                                        interlinea = .BARRAS_INTERLINEA_TITULO,
                                        minimo_pt = 11, paso_pt = 1) {
  t <- as.character(textos)
  a <- suppressWarnings(as.numeric(altos_in))
  s <- suppressWarnings(as.numeric(size_pt)[1])
  lo <- suppressWarnings(as.numeric(minimo_pt)[1])
  li <- suppressWarnings(as.numeric(interlinea)[1])
  if (!length(t) || length(a) != length(t)) return(s)
  if (!is.finite(s) || s <= 0 || !is.finite(lo) || lo <= 0 || !is.finite(li) || li <= 0) return(s)
  if (!is.function(wrap_fun)) return(s)
  if (lo >= s) return(s)

  ok <- !is.na(t) & nzchar(trimws(t)) & is.finite(a) & a > 0
  if (!any(ok)) return(s)
  t <- t[ok]; a <- a[ok]

  # Cuantas lineas produce el envoltorio REAL a ese cuerpo. No se estima:
  # envolver por palabras no reparte a partes iguales y una cuenta por
  # caracteres se equivoca en los dos sentidos.
  lineas_a <- function(x, pt) {
    if (!requireNamespace("stringr", quietly = TRUE)) return(NA_integer_)
    w <- tryCatch(wrap_fun(x, pt), error = function(e) NA_real_)
    w <- suppressWarnings(as.numeric(w)[1])
    if (!is.finite(w) || w < 1) return(NA_integer_)
    length(strsplit(stringr::str_wrap(gsub("\n", " ", x, fixed = TRUE), width = w),
                    "\n", fixed = TRUE)[[1]])
  }

  candidatos <- seq(s, lo, by = -abs(paso_pt))
  if (!length(candidatos) || candidatos[length(candidatos)] > lo) {
    candidatos <- c(candidatos, lo)
  }
  for (pt in candidatos) {
    alto_linea <- (pt / 72) * li
    if (!is.finite(alto_linea) || alto_linea <= 0) next
    cabe <- TRUE
    for (k in seq_along(t)) {
      n_lin <- lineas_a(t[k], pt)
      # Sin medicion no se decide a ciegas: se deja el cuerpo declarado.
      if (!is.finite(n_lin)) return(s)
      if (n_lin * alto_linea > a[k] + 1e-9) { cabe <- FALSE; break }
    }
    if (cabe) return(pt)
  }
  lo
}


#' Alto de verdad que tiene el enunciado de cada bloque, en pulgadas
#'
#' P46, tercer intento. Los dos anteriores estimaban ese alto como
#' `n_cat * alto_fila` mas medio hueco, y los dos solaparon: el texto se dibuja
#' centrado en `mean(y_min, y_max)`, que son los CENTROS de la primera y la
#' ultima categoria del bloque, no sus bordes. Dos bloques vecinos con distinto
#' numero de filas no tienen sus centros equidistantes del hueco que comparten,
#' asi que «media parte para cada uno» repartia un espacio que no era el real.
#'
#' Aqui no se estima nada: se toman los centros reales en coordenadas del canvas
#' —`group_df$y_min` y `$y_max`, que el graficador ya calcula— y cada bloque
#' recibe **la mitad de la distancia a cada vecino**. Dos contiguos se
#' encuentran exactamente en el punto medio, que es lo que impide el solape por
#' construccion. En los extremos el limite es el borde del area de barras.
#'
#' @param centros Centro de cada bloque, en npc del canvas.
#' @param alto_in Alto del canvas en pulgadas.
#' @param borde_inf,borde_sup Limites del area util, en npc.
#' @return Alto disponible de cada bloque, en pulgadas, en el orden de entrada.
#' @keywords internal
.barras_alto_disponible_real <- function(centros, alto_in,
                                         borde_inf = 0, borde_sup = 1) {
  c0 <- suppressWarnings(as.numeric(centros))
  a <- suppressWarnings(as.numeric(alto_in)[1])
  lo <- suppressWarnings(as.numeric(borde_inf)[1])
  hi <- suppressWarnings(as.numeric(borde_sup)[1])
  n <- length(c0)
  if (!n || !is.finite(a) || a <= 0) return(rep(NA_real_, max(1L, n)))
  if (!is.finite(lo) || !is.finite(hi) || hi <= lo) { lo <- 0; hi <- 1 }
  if (any(!is.finite(c0))) return(rep(NA_real_, n))

  ord <- order(c0)
  cs <- c0[ord]
  arriba <- c(diff(cs) / 2, hi - cs[n])          # hacia el vecino de arriba
  abajo  <- c(cs[1] - lo, diff(cs) / 2)          # hacia el de abajo
  disp <- (pmax(0, arriba) + pmax(0, abajo)) * a
  out <- numeric(n)
  out[ord] <- disp
  out
}


#' Cuerpo Y lineas de los enunciados de una lamina, EN UNA SOLA PASADA
#'
#' P46. Separar las dos decisiones —una elegia el cuerpo y otra las lineas— las
#' hacia retroalimentarse: al dar mas alto, el cuerpo dejaba de encoger y con el
#' cuerpo grande las lineas autorizadas ya no cabian. Aqui van juntas: para cada
#' cuerpo candidato se envuelve, se cuentan las lineas REALES y se comprueba que
#' quepan. Se elige el mayor cuerpo con el que TODOS los bloques caben enteros;
#' si ninguno lo consigue, el piso, y el cupo que se devuelve es el de ESE
#' cuerpo. Asi el numero de lineas nunca se decide con un cuerpo distinto del
#' que se dibuja.
#'
#' El alto que recibe tiene que ser el REAL —`.barras_alto_disponible_real()`—,
#' no `n_cat * alto_fila`: con el estimado esta funcion es correcta y el render
#' solapa igual.
#'
#' @param textos Enunciados de los bloques.
#' @param altos_in Alto disponible de cada bloque, en pulgadas.
#' @param wrap_fun Funcion `(texto, size_pt) -> ancho de wrap en caracteres`.
#' @param size_pt Cuerpo declarado; es el techo.
#' @param interlinea,minimo_pt,paso_pt Igual que en el resto de la familia.
#' @return Lista con `size_pt` —uno para toda la lamina— y `cupos`.
#' @keywords internal
.titulo_grupo_ajuste <- function(textos, altos_in, wrap_fun, size_pt,
                                 interlinea = .BARRAS_INTERLINEA_TITULO,
                                 minimo_pt = 11, paso_pt = 1) {
  t <- as.character(textos)
  a <- suppressWarnings(as.numeric(altos_in))
  s <- suppressWarnings(as.numeric(size_pt)[1])
  lo <- suppressWarnings(as.numeric(minimo_pt)[1])
  li <- suppressWarnings(as.numeric(interlinea)[1])
  nulo <- list(size_pt = s, cupos = NULL)
  if (!length(t) || length(a) != length(t)) return(nulo)
  if (!is.finite(s) || s <= 0 || !is.finite(li) || li <= 0) return(nulo)
  if (!is.function(wrap_fun)) return(nulo)
  if (!is.finite(lo) || lo <= 0 || lo > s) lo <- s

  memo <- new.env(parent = emptyenv())
  lineas_a <- function(x, pt) {
    k <- paste(x, pt, sep = "\r")
    if (!is.null(h <- memo[[k]])) return(h)
    if (!requireNamespace("stringr", quietly = TRUE)) return(NA_integer_)
    w <- tryCatch(wrap_fun(x, pt), error = function(e) NA_real_)
    w <- suppressWarnings(as.numeric(w)[1])
    v <- if (!is.finite(w) || w < 1) NA_integer_ else {
      length(strsplit(stringr::str_wrap(gsub("\n", " ", x, fixed = TRUE), width = w),
                      "\n", fixed = TRUE)[[1]])
    }
    assign(k, v, envir = memo)
    v
  }
  caben_en <- function(alto, pt) {
    al <- (pt / 72) * li
    if (!is.finite(al) || al <= 0 || !is.finite(alto) || alto <= 0) return(NA_integer_)
    max(1L, as.integer(floor(alto / al + .BARRAS_TOL_LINEA)))
  }

  ok <- !is.na(t) & nzchar(trimws(t)) & is.finite(a) & a > 0
  if (!any(ok)) return(nulo)
  candidatos <- seq(s, lo, by = -abs(paso_pt))
  if (candidatos[length(candidatos)] > lo) candidatos <- c(candidatos, lo)

  ultimo <- NULL
  for (pt in candidatos) {
    pide <- rep(NA_integer_, length(t)); cupos <- rep(NA_integer_, length(t))
    for (k in which(ok)) {
      pide[k] <- lineas_a(t[k], pt)
      cupos[k] <- caben_en(a[k], pt)
    }
    if (any(is.na(pide[ok]))) return(nulo)
    ultimo <- list(size_pt = pt, cupos = cupos)
    if (all(pide[ok] <= cupos[ok])) return(ultimo)
  }
  ultimo %||% nulo
}
