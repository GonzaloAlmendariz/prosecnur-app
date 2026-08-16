# Ajuste del titulo de bloque al espacio que su bloque sostiene.
# ==============================================================
#
# `cowplot::draw_text` dibuja centrado y NO recorta: un titulo mas alto que su
# bloque invade los vecinos. Con enunciados completos como nombre de tema —el
# caso de la matriz de equivalencias, donde la etiqueta estandar puede pasar de
# 100 caracteres— los titulos de tres bloques seguidos se escribian unos encima
# de otros y la columna izquierda quedaba ilegible.
#
# Vive en archivo propio y no dentro de `graficador_barras_apiladas.R`, que ya
# pasa de 3.000 lineas: la regla de la casa es que la funcionalidad nueva estrena
# archivo y el grande la llama.

# Lineas de titulo que sostiene una fila de barras.
#
# Se cuenta por FILAS y no por pulgadas. El primer intento estimaba el alto
# fisico del canvas y fallaba en los dos sentidos: recortaba de mas donde habia
# sitio y de menos donde no, porque `h_bars_area` es una fraccion del
# placeholder y el placeholder cambia de tamano entre plantillas. La fila de
# barras, en cambio, es la unidad que el titulo comparte de verdad.
#
# Tres es lo medido: en la diapositiva de seis temas de un solo publico, tres
# lineas por fila llenan la columna sin tocar la vecina.
# Dos, no tres. Con tres el titulo cabia SEGUN LA CUENTA y no segun la
# geometria: una fila mide ~0.58 in de alto y tres lineas de 13 pt no entran, asi
# que el enunciado desbordaba su bloque y se escribia encima del vecino sin que
# el acotado lo impidiera. Medido en la lamina 66 del mazo de acreditacion: cinco
# lineas en un bloque de dos filas, cupo 6, no se truncaba y colisionaba igual.
#
# Baja a 2 junto con el ensanche de `canvas_w_grupo` (0.13 -> 0.20): cada linea
# lleva mas texto, asi que cuatro lineas anchas dicen mas que las seis estrechas
# de antes. Se corta menos y ya no se pisa.
.BARRAS_LINEAS_POR_FILA <- 3L

# Interlineado del enunciado de bloque. Es el mismo que usa el eje Y, y sirve
# para pasar de «cuantas pulgadas mide la fila» a «cuantas lineas caben».
.BARRAS_INTERLINEA_TITULO <- 0.86

# Margen al contar lineas que caben. Ver `.barras_acotar_titulo_grupo()`.
.BARRAS_TOL_LINEA <- 0.05

# Recorta el titulo a las lineas que caben en un bloque de `n_filas` barras.
# Siempre deja al menos una linea: un bloque sin titulo no dice de que habla.
# `alto_rel` es la porcion de la lamina que ocupa este grafico. Vale 1 en un
# grafico normal y menos en un sub-bloque de escalas mixtas, donde tres o cuatro
# bloques se reparten la altura: ahi la fila mide la mitad y el titulo tiene que
# encogerse en la misma proporcion o invade al vecino.
#' @param alto_fila_in Alto real de la fila, en pulgadas. Cuando se da, el cupo
#'   sale de cuantas lineas caben de verdad en ese alto y no de la constante.
#' @param cuerpo_pt Cuerpo del enunciado, en puntos.
.barras_acotar_titulo_grupo <- function(titulo, n_filas,
                                        lineas_por_fila = .BARRAS_LINEAS_POR_FILA,
                                        alto_rel = 1,
                                        alto_fila_in = NULL, cuerpo_pt = NULL) {
  titulo <- as.character(titulo)[1]
  if (is.na(titulo) || !nzchar(trimws(titulo))) return("")
  lineas <- strsplit(titulo, "\n", fixed = TRUE)[[1]]
  if (length(lineas) <= 1L) return(titulo)

  n_filas <- suppressWarnings(as.integer(n_filas)[1])
  if (!is.finite(n_filas) || n_filas < 1L) n_filas <- 1L
  alto_rel <- suppressWarnings(as.numeric(alto_rel)[1])
  if (!is.finite(alto_rel) || alto_rel <= 0) alto_rel <- 1
  # El cupo sale del alto REAL de la fila cuando se conoce. La constante estaba
  # calibrada contra el alto por defecto (0.42 in), y el motor ya ensancha la
  # fila cuando las etiquetas de eje lo piden —hasta 1.06 in— sin que el cupo se
  # entere: el enunciado seguia cortandose a tres lineas en una fila que admitia
  # el doble. Medido sobre el mazo de acreditacion: 18 enunciados recortados, 11
  # perdiendo mas de la mitad, y el entregable aprobado los muestra enteros.
  lpf <- as.integer(lineas_por_fila)
  alto_in <- suppressWarnings(as.numeric(alto_fila_in %||% NA_real_)[1])
  pt <- suppressWarnings(as.numeric(cuerpo_pt %||% NA_real_)[1])
  if (is.finite(alto_in) && alto_in > 0 && is.finite(pt) && pt > 0) {
    # Alto de una linea = cuerpo por interlineado, en pulgadas.
    alto_linea <- (pt / 72) * .BARRAS_INTERLINEA_TITULO
    if (is.finite(alto_linea) && alto_linea > 0) {
      # La tolerancia no es un redondeo optimista: el interlineado es una
      # estimacion, y sin ella una fila donde caben 3.99 lineas devuelve 3 y el
      # enunciado pierde una linea entera por un 0.25 % de diferencia. Medido
      # sobre el mazo de acreditacion: 25 de los 33 recortes estaban exactamente
      # en ese caso.
      lpf <- max(lpf, as.integer(floor(alto_in / alto_linea + .BARRAS_TOL_LINEA)))
    }
  }
  cupo <- max(1L, as.integer(floor(n_filas * lpf * min(1, alto_rel))))
  if (length(lineas) <= cupo) return(titulo)

  entero <- paste(trimws(lineas), collapse = " ")
  lineas <- lineas[seq_len(cupo)]
  ultima <- trimws(lineas[cupo])
  # El corte se marca: un titulo que termina a media frase sin senal se lee como
  # un dato incompleto, no como un texto acortado.
  lineas[cupo] <- paste0(sub("[[:punct:]]+$", "", ultima), "…")

  # Y ademas se cuenta. El motor cortaba 31 enunciados de un mazo de 67 laminas
  # sin decirlo en ninguna parte: el analista veia el «…» en el PPT entregado y
  # no tenia forma de saber que era decision del motor ni cual era el texto
  # completo. El aviso lleva el enunciado entero y cuanto espacio falto, que es
  # lo que permite decidir si se ensancha el canal del bloque o se acepta.
  # El consejo nombra la superficie que EXISTE. La primera version decia
  # «ensancha la columna de grupo de ESTE grafico» y eso no se puede hacer:
  # `canvas_w_grupo` solo vive en el preset `multi_apiladas`, o sea es global a
  # todas las multi-apiladas del mazo. Mandar al analista a un control que no
  # existe es peor que no decir nada.
  .pulso_aviso(sprintf(
    paste0("Enunciado recortado a %d linea(s): «%s». El bloque tiene %d fila(s) ",
           "y el texto necesita %d lineas. Ensancha «Columna de grupo» en ",
           "Configuracion global > Estilo > Multi-apiladas —aplica a TODAS las ",
           "multi-apiladas— o acorta el enunciado."),
    cupo, entero, n_filas, length(strsplit(titulo, "\n", fixed = TRUE)[[1]])
  ))

  paste(lineas, collapse = "\n")
}

# ===========================================================================
# R3 — la geometria se calcula, no se calibra
# ===========================================================================
#
# El wrap del titulo de bloque era un factor ajustado a ojo contra UNA columna:
# `0.36 * wrap_y` calibrado para `canvas_w_grupo = 0.13`. Ensanchar la columna no
# cambiaba el texto, y cada ancho nuevo pedia reajustar el factor —medido: con
# 0.20 el bueno era 0.42, con 0.22 el 0.46, y extrapolar a 0.28 se salia por la
# izquierda—.
#
# La alternativa obvia, `.barras_chars_en_canal()`, tampoco mide: asume un ancho
# medio de caracter de `size_pt * 0.52`. Medido sobre el enunciado real de la
# lamina 66, ese factor sobreestima un 16 % (0.0794 in/char asumidos contra
# 0.0686 reales a 11 pt).
#
# Esto mide el texto que se va a dibujar, a su tamano, con su tipografia.

#' Ancho de wrap en caracteres para un titulo de bloque.
#'
#' Mide, no estima. Y mide la LINEA MAS ANCHA que produce el wrap, no el
#' promedio del texto entero: `str_wrap(width = n)` reparte por palabras, asi que
#' una linea puede quedarse en 18 caracteres y la siguiente llegar a 27 con
#' letras mas anchas. Medido con los valores reales del render —`ancho = 12.5`,
#' 14 pt Arial, columna 0.216— el promedio decia que caben 27 y la linea mas
#' ancha se salia; empiricamente el limite estaba en torno a 16-18.
#'
#' El bucle baja de uno en uno desde el techo geometrico hasta que la linea mas
#' ancha cabe. Son pocas iteraciones y cada una es una medicion exacta.
#'
#' @param texto El titulo que se va a dibujar. Se mide ESE.
#' @param w_npc Fraccion de ancho de la columna del tema.
#' @param ancho_in Ancho del canvas en pulgadas.
#' @param size_pt Cuerpo del titulo de bloque.
#' @param family Tipografia; `""` usa la del dispositivo.
#' @param minimo Piso en caracteres: por debajo, el titulo se parte en jirones.
#' @return Numero de caracteres por linea.
#' @keywords internal
.barras_wrap_titulo_grupo <- function(texto, w_npc, ancho_in, size_pt,
                                      family = "", minimo = 10L) {
  texto <- as.character(texto)[1]
  if (is.na(texto) || !nzchar(texto)) return(as.integer(minimo))

  w_npc    <- suppressWarnings(as.numeric(w_npc)[1])
  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  size_pt  <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(w_npc) || w_npc <= 0) return(as.integer(minimo))
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 10
  if (!is.finite(size_pt) || size_pt <= 0) size_pt <- 11

  # El canal reserva un respiro contra el eje, igual que el de las etiquetas.
  utiles <- (w_npc * ancho_in) - 0.06
  if (utiles <= 0) return(as.integer(minimo))

  mide <- function(x) {
    tryCatch({
      g <- grid::textGrob(x, gp = grid::gpar(fontsize = size_pt, fontfamily = family))
      grid::convertWidth(grid::grobWidth(g), "in", valueOnly = TRUE)
    }, error = function(e) NA_real_)
  }

  # Techo geometrico con el ancho medio: el punto de partida del bucle.
  medio <- mide(texto) / max(1L, nchar(texto))
  # Sin dispositivo grafico la medicion falla; se cae al estimador de siempre en
  # vez de dejar el titulo sin envolver.
  if (!is.finite(medio) || medio <= 0) {
    return(.barras_chars_en_canal(w_npc, ancho_in, size_pt, minimo = minimo))
  }
  n <- max(as.integer(minimo), as.integer(floor(utiles / medio)))

  if (!requireNamespace("stringr", quietly = TRUE)) return(n)
  while (n > minimo) {
    lineas <- strsplit(stringr::str_wrap(texto, width = n), "\n", fixed = TRUE)[[1]]
    anchos <- vapply(lineas, mide, numeric(1))
    if (!any(is.finite(anchos))) return(n)
    if (max(anchos, na.rm = TRUE) <= utiles) return(n)
    n <- n - 1L
  }
  as.integer(minimo)
}
