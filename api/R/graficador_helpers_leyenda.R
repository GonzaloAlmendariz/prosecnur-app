# Alto de la banda de leyenda, proporcional a las filas que va a ocupar.
# ====================================================================
#
# `canvas_h_legend_in` valia 0.75 pulgadas fijas. Con una escala de cinco
# categorias que entra en UNA fila, esa banda se lleva ~25 % del alto del
# placeholder para dibujar una linea de texto, y las barras se aprietan arriba
# dejando media lamina en blanco. Se vio con `debug_ph_bordes = TRUE`: el marco
# de la leyenda medido en pantalla ocupaba tanto como dos filas de barras.
#
# El alto se estima aqui a partir de las filas que la leyenda necesita. Es una
# ESTIMACION: el reparto real en filas se calcula al dibujar, con las anchuras
# de texto ya resueltas. Por eso se redondea hacia arriba y se deja holgura —
# quedarse corto recorta la leyenda, que es peor que sobrar un poco.
#
# Vive en archivo propio y no dentro de `graficador_barras_apiladas.R`, que ya
# pasa de 3.000 lineas.

# Ancho de una etiqueta de leyenda en pulgadas, incluyendo su cuadrito y el
# espacio que la separa de la siguiente. El glifo medio mide ~0.52 em.
.barras_leyenda_ancho_item <- function(etiqueta, size_pt, key_cm = 0.34) {
  n <- nchar(as.character(etiqueta %||% ""))
  texto_in <- n * size_pt * 0.52 / 72
  cuadro_in <- max(0.10, key_cm / 2.54)
  texto_in + cuadro_in + 0.16
}

# Filas que necesita la leyenda para caber en `ancho_in`.
.barras_leyenda_filas <- function(etiquetas, size_pt, ancho_in, key_cm = 0.34) {
  etiquetas <- as.character(etiquetas %||% character(0))
  etiquetas <- etiquetas[nzchar(trimws(etiquetas))]
  if (!length(etiquetas)) return(0L)
  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 10
  anchos <- vapply(etiquetas, .barras_leyenda_ancho_item, numeric(1),
                   size_pt = size_pt, key_cm = key_cm)
  # Reparto voraz: se llena una fila hasta que el siguiente item no entra. Es lo
  # mismo que hace el dibujo, que reparte los items en filas de igual capacidad.
  filas <- 1L
  usado <- 0
  for (w in anchos) {
    if (usado > 0 && usado + w > ancho_in) {
      filas <- filas + 1L
      usado <- w
    } else {
      usado <- usado + w
    }
  }
  filas
}

# Alto de la banda, en pulgadas.
.BARRAS_LEYENDA_ALTO_FILA_IN <- 0.24
.BARRAS_LEYENDA_HOLGURA_IN <- 0.08

.barras_leyenda_alto_in <- function(etiquetas, size_pt, ancho_in, key_cm = 0.34,
                                    minimo_in = 0.30) {
  filas <- .barras_leyenda_filas(etiquetas, size_pt, ancho_in, key_cm = key_cm)
  if (!filas) return(0)
  max(minimo_in, filas * .BARRAS_LEYENDA_ALTO_FILA_IN + .BARRAS_LEYENDA_HOLGURA_IN)
}

# Alto de fila cuando el hueco fisico da mas de lo que pide el contenido.
# =======================================================================
#
# El canvas se arma con un alto INTRINSECO —filas x alto por fila, mas cabecera,
# leyenda y reserva de pie— y luego se coloca en el placeholder conservando su
# proporcion. Medido con `debug_ph_bordes` sobre el mazo de equivalencias: el
# hueco mide 6 pulgadas de alto y el canvas se armaba con 3.56, asi que el 41 %
# de la lamina quedaba en blanco bajo el grafico.
#
# Aqui el sobrante se reparte a las filas hasta un grosor maximo. El tope existe
# porque una lamina de dos barras estirada a pantalla completa se lee como un
# error de maquetacion, no como un grafico: pasado cierto punto, aire vale mas
# que barra.
.BARRAS_ALTO_FILA_MAX_IN <- 0.62

.barras_alto_fila_ajustado <- function(alto_fila_in, n_filas, alto_fisico_in,
                                       alto_fijo_in = 0,
                                       maximo_in = .BARRAS_ALTO_FILA_MAX_IN) {
  alto_fila_in <- suppressWarnings(as.numeric(alto_fila_in)[1])
  if (!is.finite(alto_fila_in) || alto_fila_in <= 0) return(alto_fila_in)
  n_filas <- suppressWarnings(as.numeric(n_filas)[1])
  if (!is.finite(n_filas) || n_filas < 1) return(alto_fila_in)
  alto_fisico_in <- suppressWarnings(as.numeric(alto_fisico_in)[1])
  if (!is.finite(alto_fisico_in) || alto_fisico_in <= 0) return(alto_fila_in)

  # Lo que queda para las filas una vez servidos cabecera, leyenda y pie.
  disponible <- alto_fisico_in - suppressWarnings(as.numeric(alto_fijo_in)[1] %||% 0)
  if (!is.finite(disponible) || disponible <= 0) return(alto_fila_in)

  objetivo <- disponible / n_filas
  # Solo se CRECE. Si el hueco es mas chico que el contenido, el canvas ya se
  # encoge al colocarse y forzarlo aqui apretaria las barras dos veces.
  max(alto_fila_in, min(objetivo, maximo_in))
}
