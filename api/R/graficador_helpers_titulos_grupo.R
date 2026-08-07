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
.BARRAS_LINEAS_POR_FILA <- 3L

# Recorta el titulo a las lineas que caben en un bloque de `n_filas` barras.
# Siempre deja al menos una linea: un bloque sin titulo no dice de que habla.
# `alto_rel` es la porcion de la lamina que ocupa este grafico. Vale 1 en un
# grafico normal y menos en un sub-bloque de escalas mixtas, donde tres o cuatro
# bloques se reparten la altura: ahi la fila mide la mitad y el titulo tiene que
# encogerse en la misma proporcion o invade al vecino.
.barras_acotar_titulo_grupo <- function(titulo, n_filas,
                                        lineas_por_fila = .BARRAS_LINEAS_POR_FILA,
                                        alto_rel = 1) {
  titulo <- as.character(titulo)[1]
  if (is.na(titulo) || !nzchar(trimws(titulo))) return("")
  lineas <- strsplit(titulo, "\n", fixed = TRUE)[[1]]
  if (length(lineas) <= 1L) return(titulo)

  n_filas <- suppressWarnings(as.integer(n_filas)[1])
  if (!is.finite(n_filas) || n_filas < 1L) n_filas <- 1L
  alto_rel <- suppressWarnings(as.numeric(alto_rel)[1])
  if (!is.finite(alto_rel) || alto_rel <= 0) alto_rel <- 1
  cupo <- max(1L, as.integer(floor(n_filas * as.integer(lineas_por_fila) * min(1, alto_rel))))
  if (length(lineas) <= cupo) return(titulo)

  lineas <- lineas[seq_len(cupo)]
  ultima <- trimws(lineas[cupo])
  # El corte se marca: un titulo que termina a media frase sin senal se lee como
  # un dato incompleto, no como un texto acortado.
  lineas[cupo] <- paste0(sub("[[:punct:]]+$", "", ultima), "…")
  paste(lineas, collapse = "\n")
}
