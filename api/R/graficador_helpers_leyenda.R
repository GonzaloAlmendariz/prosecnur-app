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
#
# El piso baja de 0,24" a 0,20" y la holgura deja de ser un plano de 0,08" para
# volverse proporcional a la fila. Medido con las guías sobre «Conta 10-08»: la
# banda reservaba 38 px para dibujar 16 —el 58 % era aire—. El plano sumaba dos
# veces lo mismo: `alto_fila` ya trae su interlineado del 35 %, y encima se le
# añadía un margen fijo que a 10,5 pt pesaba otro 40 % del contenido.
#
# Solo aprieta las leyendas CHICAS. A 16 pt la banda queda igual que antes
# (0,39" contra 0,38"), así que el mazo de acreditación no se mueve.
.BARRAS_LEYENDA_ALTO_FILA_IN <- 0.20
.BARRAS_LEYENDA_HOLGURA_REL <- 0.30
# Interlineado: una fila de texto necesita mas que el cuerpo de la letra.
.BARRAS_LEYENDA_INTERLINEA <- 1.35

# Alto de UNA fila de leyenda, en pulgadas, para el cuerpo de letra que se va a
# dibujar. El plano de 0,24" era ciego al tamano: con la leyenda por defecto
# sobra interlineado, pero el mazo de acreditacion la pide a 16 pt —0,222" solo
# de cuerpo— y dos filas salian pegadas, «SIN INF» montado sobre «En
# desacuerdo». El 0,24" se conserva como piso para no encoger las leyendas
# chicas que hoy estan bien.
.barras_leyenda_alto_fila_in <- function(size_pt) {
  size_pt <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(size_pt) || size_pt <= 0) return(.BARRAS_LEYENDA_ALTO_FILA_IN)
  max(.BARRAS_LEYENDA_ALTO_FILA_IN, size_pt / 72 * .BARRAS_LEYENDA_INTERLINEA)
}

.barras_leyenda_alto_in <- function(etiquetas, size_pt, ancho_in, key_cm = 0.34,
                                    gap_npc = 0.018, aspect_yx = 0.6,
                                    n_por_fila = 6L, minimo_in = 0.24) {
  filas <- .barras_leyenda_filas(etiquetas, size_pt, ancho_in, key_cm = key_cm,
                                 gap_npc = gap_npc, aspect_yx = aspect_yx,
                                 n_por_fila = n_por_fila)
  if (!filas) return(0)
  alto_fila <- .barras_leyenda_alto_fila_in(size_pt)
  max(minimo_in, filas * alto_fila + alto_fila * .BARRAS_LEYENDA_HOLGURA_REL)
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

# Reparto del sobrante vertical cuando el canvas es mas corto que su hueco.
# =========================================================================
#
# El sobrante se repartia en DOS margenes iguales, arriba y abajo. Con una sola
# barra eso deja el grafico como una tira flotando en el centro de la lamina —
# medido: canvas de 3.37 pulgadas en un hueco de 6, con 1.3 de aire por lado— y
# se lee como un error de maquetacion, no como una decision.
#
# La alternativa que NO se tomo fue engordar la barra: eso contradice el ADR
# 0065, que existe justamente para que una barra mida lo mismo en la lamina 3 y
# en la 30. El grosor se conserva; lo que cambia es DONDE queda el aire.
#
# Arriba va poco y abajo va el resto: la lamina se lee de arriba hacia abajo, y
# un bloque de contenido anclado alto con su aire debajo es una composicion
# normal. Dos bandas simetricas, en cambio, solo dicen «aqui falta algo».
.BARRAS_PAD_ARRIBA <- 0.22

.barras_pad_superior <- function(sobrante_npc, proporcion = .BARRAS_PAD_ARRIBA) {
  sobrante_npc <- suppressWarnings(as.numeric(sobrante_npc)[1])
  if (!is.finite(sobrante_npc) || sobrante_npc <= 0) return(0)
  sobrante_npc * max(0, min(1, proporcion))
}

# Ancho del canal de etiquetas del eje Y, dimensionado por su CONTENIDO.
# =====================================================================
#
# El defecto era 0.38 —el 38 % del ancho— fuera cual fuera el largo del texto.
# En una lamina cuyo eje dice «Indique el sueldo mensual bruto que percibe.» eso
# es cuatro veces lo que hace falta, y ese ancho se lo quita a las barras, que
# son el dato.
#
# El ADR 0065 ya lo dejo escrito al declarar que NO gobierna: los canales
# laterales se dimensionan por su contenido, porque ahi lo que se compara entre
# laminas es el texto y no una magnitud.
#
# Se acota por los dos lados. Por abajo, para que una etiqueta corta no deje el
# rotulo pegado a la barra; por arriba, para que una larga no se coma la lamina
# —a partir de cierto punto lo que toca es envolver el texto, no seguir cediendo
# ancho—.
.BARRAS_ETQ_MIN_NPC <- 0.12
.BARRAS_ETQ_MAX_NPC <- 0.42

.barras_ancho_etiquetas <- function(etiquetas, size_pt, ancho_in,
                                    minimo = .BARRAS_ETQ_MIN_NPC,
                                    maximo = .BARRAS_ETQ_MAX_NPC) {
  etiquetas <- as.character(etiquetas %||% character(0))
  etiquetas <- etiquetas[nzchar(trimws(etiquetas))]
  if (!length(etiquetas)) return(minimo)

  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 10
  size_pt <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(size_pt) || size_pt <= 0) size_pt <- 9

  # El texto ya puede venir envuelto: manda la linea mas larga, no el total.
  lineas <- unlist(strsplit(etiquetas, "\n", fixed = TRUE))
  chars <- suppressWarnings(max(nchar(lineas, type = "width"), na.rm = TRUE))
  if (!is.finite(chars) || chars <= 0) return(minimo)

  # Mismo modelo de ancho de glifo que usa la leyenda, mas un respiro para que
  # el rotulo no toque la barra.
  ancho_npc <- chars * size_pt * 0.52 / 72 / ancho_in + 0.02
  max(minimo, min(maximo, ancho_npc))
}

# Filas de leyenda de un bloque de multilista, antes de renderizarlo.
# ==================================================================
#
# El reparto de alto entre bloques (`.multilista_block_height`) se decide antes
# de dibujar nada, asi que necesita saber cuantas filas va a ocupar la leyenda
# sin haberla dibujado. Las categorias salen de la escala compartida por las
# variables del bloque, que es exactamente lo que la leyenda va a listar.
#
# Los resolutores viajan como argumento porque viven como closures dentro de
# `reporte_ppt_plan()` (necesitan la data y el instrumento de la corrida) y este
# archivo no los ve. Ante cualquier fallo devuelve 1: quedarse corto reparte el
# alto como se repartia antes, que es el comportamiento conocido.
.multilista_filas_leyenda_de_refs <- function(refs, resolver, escala_compartida,
                                              size_pt = 10, ancho_in = 10) {
  refs <- as.character(unlist(refs %||% character(0)))
  refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
  if (!length(refs)) return(1L)

  filas <- tryCatch({
    ctxs <- lapply(refs, resolver, arg_name = "vars")
    spec <- escala_compartida(ctxs, arg_name = "var_cruce")
    niveles <- .reporte_plan_choice_levels_for_list(spec$list_name, spec$choices)
    etiquetas <- as.character(niveles$label %||% character(0))
    etiquetas <- etiquetas[nzchar(trimws(etiquetas))]
    if (!length(etiquetas)) return(1L)
    .barras_leyenda_filas(etiquetas, size_pt, ancho_in)
  }, error = function(e) 1L)

  filas <- suppressWarnings(as.integer(filas)[1])
  if (!is.finite(filas) || filas < 1L) 1L else filas
}

# Cuántos caracteres caben en el canal de etiquetas del eje Y.
# =============================================================
#
# `ancho_max_eje_y` mide en CARACTERES y `canvas_w_etiquetas` en fracción del
# canvas: son dos controles que describen la misma caja y nadie los conciliaba.
# Declarar un wrap de 60 y un canal de 0,332 hace que el motor obedezca a los
# dos y el texto salga de la lámina — medido en «Conta 10-08»: el canal daba
# 4,4" y el texto envuelto medía 5,85", así que se salía 1,4" por la izquierda.
#
# Aquí se traduce el ancho del canal al número de caracteres que entran, con el
# mismo modelo de ancho de glifo que usa la leyenda. Solo sirve para ACOTAR: el
# wrap declarado nunca se amplía, porque quien pidió 40 caracteres quiere 40.
.barras_chars_en_canal <- function(w_npc, ancho_in, size_pt, minimo = 12L) {
  w_npc <- suppressWarnings(as.numeric(w_npc)[1])
  ancho_in <- suppressWarnings(as.numeric(ancho_in)[1])
  size_pt <- suppressWarnings(as.numeric(size_pt)[1])
  if (!is.finite(w_npc) || w_npc <= 0) return(NA_integer_)
  if (!is.finite(ancho_in) || ancho_in <= 0) ancho_in <- 10
  if (!is.finite(size_pt) || size_pt <= 0) size_pt <- 9

  # El canal reserva un respiro contra la barra; sin él la última letra queda
  # pegada al segmento.
  utiles <- (w_npc * ancho_in) - 0.06
  if (utiles <= 0) return(as.integer(minimo))
  max(as.integer(minimo), as.integer(floor(utiles * 72 / (size_pt * 0.52))))
}
