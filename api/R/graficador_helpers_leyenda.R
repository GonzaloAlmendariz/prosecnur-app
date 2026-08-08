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

# Filas que va a ocupar la leyenda, con el MISMO modelo que usa el dibujo.
#
# Es la parte delicada. El reparto real trabaja en coordenadas normalizadas del
# canvas, no en pulgadas: parte de `legend_n_por_fila` items por fila y lo baja
# de uno en uno hasta que ninguna fila pasa del 96 % del ancho. Una estimacion
# con otro modelo se equivoca en el unico caso que importa —el limite entre una
# fila y dos— y ahi la banda se dimensiona para una mientras el dibujo pinta dos:
# `row_h` se parte a la mitad, los cuadritos colapsan y la segunda fila se monta
# sobre la primera. Medido con la escala de siete categorias: estimaba 1 y el
# dibujo usaba 2.
#
# Por eso esto NO es una aproximacion propia: replica la del dibujo termino a
# termino. Si aquella cambia, esta tiene que cambiar con ella.
.BARRAS_LEYENDA_ANCHO_MAX_NPC <- 0.96

.barras_leyenda_filas <- function(etiquetas, size_pt, ancho_in,
                                  key_cm = 0.34, gap_npc = 0.018,
                                  aspect_yx = 0.6, n_por_fila = 6L) {
  etiquetas <- as.character(etiquetas %||% character(0))
  etiquetas <- etiquetas[nzchar(trimws(etiquetas))]
  n <- length(etiquetas)
  if (!n) return(0L)

  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 10
  size_pt <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(size_pt) || size_pt <= 0) size_pt <- 9
  aspect_yx <- suppressWarnings(as.numeric(aspect_yx)[1])
  if (!is.finite(aspect_yx) || aspect_yx <= 0) aspect_yx <- 0.6

  # El cuadrito se toma en su tope: `key_side_y` es el minimo entre ese tope y
  # `row_h * 0.82`, y `row_h` depende del alto que estamos calculando. Tomar el
  # tope rompe la circularidad por el lado seguro —sobrestimar el ancho de un
  # item da una fila de mas, nunca una de menos—.
  key_side <- max(0.034, suppressWarnings(as.numeric(key_cm)[1]) * 0.11)
  if (!is.finite(key_side)) key_side <- 0.034
  key_w <- key_side * aspect_yx
  key_gap <- min(0.012, max(0.007, gap_npc * 0.60))
  slot_gap <- min(0.040, max(0.026, gap_npc * 1.80))

  chars <- nchar(gsub("\\s+", " ", gsub("\n", " ", etiquetas)), type = "width")
  texto_npc <- pmax(0.016, chars * size_pt * 0.52 / 72 / ancho_in)
  item <- key_w + key_gap + texto_npc

  por_fila <- min(max(1L, as.integer(n_por_fila)), n)
  repeat {
    filas <- ceiling(n / por_fila)
    ids <- ceiling(seq_len(n) / por_fila)
    anchos <- vapply(seq_len(filas), function(r) {
      idx <- which(ids == r)
      sum(item[idx], na.rm = TRUE) + slot_gap * max(0L, length(idx) - 1L)
    }, numeric(1))
    if (por_fila <= 1L || max(anchos, na.rm = TRUE) <= .BARRAS_LEYENDA_ANCHO_MAX_NPC) break
    por_fila <- por_fila - 1L
  }
  as.integer(filas)
}

# Alto de la banda, en pulgadas.
.BARRAS_LEYENDA_ALTO_FILA_IN <- 0.24
.BARRAS_LEYENDA_HOLGURA_IN <- 0.08

.barras_leyenda_alto_in <- function(etiquetas, size_pt, ancho_in, key_cm = 0.34,
                                    gap_npc = 0.018, aspect_yx = 0.6,
                                    n_por_fila = 6L, minimo_in = 0.30) {
  filas <- .barras_leyenda_filas(etiquetas, size_pt, ancho_in, key_cm = key_cm,
                                 gap_npc = gap_npc, aspect_yx = aspect_yx,
                                 n_por_fila = n_por_fila)
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
