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
#
# P50, MEDIDO Y ABIERTO: **0.86 esta por debajo del interlineado REAL en las 33
# laminas del mazo de Conta que se pudieron medir**, y esta constante es la que
# convierte pulgadas en cupo de lineas (`caben_en()` en `.titulo_grupo_ajuste()`
# y el `lpf` de `.barras_acotar_titulo_grupo()` mas abajo). Si subestima el alto
# de una linea, el cupo autoriza mas lineas de las que caben y el bloque invade
# a su vecino.
#
# La medicion, sobre `p52.pptx`: paso mediano entre lineas de la columna del
# enunciado contra el cuerpo de la lamina. Interlineado real min **1.126**,
# p25 **1.143**, mediana **1.436**, max **2.266**. LIMITE DE ESA MEDICION: el
# cuerpo usado es el MODAL DE LA LAMINA —14 pt en 28 de 33, que son las
# etiquetas de porcentaje—, no el del enunciado, asi que el factor exacto NO
# esta medido; el signo y el orden de magnitud si. En la unica lamina donde el
# cuerpo del enunciado se leyo directo del XML —la **59**, 11 pt, paso
# **0.2200 in**— el interlineado real es **1.44**: el motor cree que caben
# **1.67x** mas lineas de las que caben.
#
# Y ahi esta el solape: la 59 dibuja su bloque 2 de 3.4571 a 5.0275 y el 3 de
# 4.8034 a 6.0930, con centros en 4.2423 y 5.4482. El punto medio cae en
# **4.8453**; el de arriba lo pasa en **+0.182** y el de abajo sube **+0.042**.
# Se pisan **0.224 in = exactamente una linea**.
#
# POR QUE SOLO UNA LAMINA DE 66 SOLAPA si la constante falla en todas: el cupo
# generoso solo muerde cuando el enunciado es lo bastante largo para agotarlo.
# La mayoria no lo agota, asi que el defecto queda latente.
#
# NO SE TOCA A CIEGAS. `test-titulo-grupo-geometria.R` comprueba que el helper
# es coherente CON ESTA CONSTANTE (`ocupa <- cupos * (size_pt/72) * .BARRAS_
# INTERLINEA_TITULO`), o sea que no puede atrapar que la constante misma este
# mal: una suite verde no cubre lo que ninguna prueba enciende. Y bajarla
# encoge el cupo en todo el mazo, que es justo lo que P46 subio para llevar los
# cortes a cero. Antes de moverla hay que leer el cuerpo del ENUNCIADO —no el
# modal de la lamina— emparejando cada caja con su `<a:rPr sz>`, y medir el
# factor de verdad.
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
                                        alto_fila_in = NULL, cuerpo_pt = NULL,
                                        cupo_forzado = NULL) {
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
  # Cuando `.titulo_grupo_ajuste()` ya decidio cuerpo y lineas en la MISMA
  # pasada y sobre el alto REAL, manda su cupo.
  cf <- suppressWarnings(as.integer(cupo_forzado %||% NA_integer_)[1])
  if (is.finite(cf) && cf >= 1L) cupo <- cf
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
  # P46, MEDIDO Y ABIERTO. Este recorte NO es un caso raro: en el mazo de Conta
  # de hoy (`p45.pptx`) hay **22 textos truncados en 16 laminas de 66**, y el
  # entregable aprobado tiene **CERO**. Una de cada cuatro laminas entrega una
  # pregunta cortada a media frase.
  #
  # Y la causa no es el wrap —`.barras_wrap_titulo_grupo()` ya mide con
  # `textGrob`, no estima—: es el ANCHO del canal. Medido en el XML de la lamina
  # 41, «La Unidad facilita los medios necesarios…» vive en una caja de
  # **1.492 in a 14 pt**; el aprobado pone sus enunciados largos en cajas de
  # hasta **6.675 in a 13 pt** (su lamina 35, ocho lineas sin recortar). Mas de
  # cuatro veces el ancho, y un punto menos de cuerpo.
  #
  # EL MISMO ENUNCIADO, LOS DOS MAZOS, MEDIDO. «La Unidad facilita los medios
  # necesarios para que…» sale en la lamina 39 del aprobado en un canal de
  # **2.678 in a 13 pt, seis lineas, entero**; en la 41 del motor, en **1.492 in
  # a 14 pt, recortado**. Y el aprobado no tiene tope de lineas por fila: su
  # lamina 29 llega a **nueve y hasta doce lineas a 12 pt** en canales de 2.4 a
  # 3.2 in. O sea que su regla no es «tantas lineas por fila» sino «el canal que
  # el texto necesite, y si hace falta un punto menos de cuerpo».
  #
  # CAUSA LOCALIZADA, TRAZANDO EL REPARTO. Y NO ES LA QUE PARECIA: la hipotesis
  # anotada aqui antes —que `w_group / w_sum` encogia el canal declarado— era
  # falsa. Trazado el reparto de `graficador_barras_apiladas.R:3089`, la lamina
  # 41 llega con `canvas_w_grupo = 0.22`, `w_sum = 1.02` y fraccion **0.2157**;
  # el «0.22 / 1.85 = 0.119» era coincidencia aritmetica, no mecanismo. Y el
  # 1.492 in medido en el XML tampoco es el canal: es la caja del TEXTO, que
  # `draw_text` ajusta a lo dibujado.
  #
  # LO QUE SI FALLA: **`ancho` llega valiendo 10**, que es el default de la firma
  # de `graficar_barras_apiladas()`, mientras la lamina se dibuja a **12.511 in**.
  # Contadas las llamadas de la pasada de PPT: **20 con `ancho = 10`**, 13 con
  # 12.5, 37 con 12.511 y 35 con 6.1. Asi que el canal para envolver se calcula
  # como `0.2157 * 10 - 0.06 = 2.097 in` cuando el canal real es
  # `0.2157 * 12.511 = 2.699 in`: **el enunciado se envuelve un 22 % mas
  # estrecho que el sitio que tiene**, pide mas lineas de las necesarias, y
  # entonces el cupo de aqui lo recorta.
  #
  # Es la misma forma que P42 pero sobre el otro eje: un parametro que no viaja
  # hace mentir a todo lo que dependa de el. REPARADO en `8fa60752` con
  # `.multilista_heredar_cajon()`: el enunciado de la lamina 41 pasa de una caja
  # de 1.492 in a una de 1.794, un 20 %.
  #
  # Y NO BASTA: los truncados bajan solo de 22 a 21. Trazado ESTE cupo sobre la
  # corrida entera —191 llamadas, 21 recortes—, el cuadro es este:
  #
  #   · casi todos son bloques de UNA fila con el enunciado pidiendo de 4 a 11
  #     lineas y un cupo de 2 a 6. La fila mide de 0.40 a 1.17 in y una linea a
  #     14 pt con interlineado 0.86 ocupa 0.167, asi que fisicamente no caben.
  #   · el cuerpo que SI las haria caber, calculado bloque a bloque:
  #     13.6 · 12.1 · 12.1 · 11.8 · 11.5 · 10.9 · 10.1 · 9.8 · 9.6 · 9.1 · 9.1 ·
  #     8.7 · 8.7 · 8.4 · 8.4 · 7.8 · 7.6 · 6.7 · 6.6 · 6.6 · 6.6 pt.
  #     Con piso de 12 pt se salvan 3 de 21; con 11, cinco; con 10, siete.
  #
  # O sea que la palanca del aprobado —«y si hace falta, un punto menos de
  # cuerpo»: sus enunciados largos van a 12 y 13 pt donde el motor pone 14—
  # existe y alcanza para una parte. La cuenta de arriba la SUBESTIMA, porque
  # supone que el numero de lineas no cambia: a 11 pt cada linea lleva ~27 % mas
  # texto, asi que un enunciado de nueve lineas baja a siete. Hay que medirlo
  # re-envolviendo a cada tamano candidato, no con la cuenta estatica.
  #
  # Es la tercera vez que aparece la misma forma —`.agrupadas_size_que_cabe()`
  # ya la resuelve para la etiqueta de eje—, asi que pide un helper y no un
  # parche. Y el tamano se decide POR LAMINA, no por bloque: el aprobado usa un
  # solo cuerpo en toda su lamina 29 (12 pt para sus cuatro enunciados).
  # HECHO: los truncados bajaron de 21 a 10.
  #
  # DE LOS 10 QUE QUEDAN, DOS SALIDAS DESCARTADAS Y UNA VIVA, todas medidas:
  #
  # · Bajar el piso de 11 pt. NO: piden entre 6.6 y 8.7 pt y serian ilegibles.
  # · Sacar alto del hueco entre bloques. NO: clasificados los huecos, el motor
  #   separa MENOS que el aprobado en las dos partes —0.37 contra 0.62 cm dentro
  #   de bloque, 1.77 contra 2.14 entre bloques—. Anotado en `reporte_plan_ppt.R`
  #   junto a `canvas_gap_grupos`.
  # · Poner el enunciado a ancho completo. NO: contados sobre el aprobado, **106
  #   de sus enunciados van en canal lateral y solo 7 a ancho completo**, y esos
  #   siete son sus laminas 3, 5, 6 y 7 —objetivo, ficha tecnica, escala, numero
  #   de respuestas—, o sea texto metodologico y no enunciado de bloque.
  #
  # LA VIVA, y sale de la misma medicion: el aprobado mete **doce lineas a 12 pt
  # en su lamina 29**, o sea ~1.72 in de texto, en bloques cuyo paso de fila
  # ronda 0.9. No le caben en su bloque: **DESBORDA hacia el hueco vecino**, que
  # el tiene en 2.14 cm. El cupo de aqui, en cambio, encierra el enunciado en su
  # bloque, y por eso corta. La hipotesis a probar es darle su bloque MAS medio
  # hueco a cada lado: con los 1.77 cm del motor son +0.70 in, y un bloque de
  # 0.65 pasaria a 1.35 —de cuatro lineas a diez, a 11 pt—. Antes de tocarlo hay
  # que comprobar EN EL RENDER que dos bloques vecinos con enunciado largo no se
  # pisen, que es justo lo que este cupo existe para evitar.
  # PROBADO Y REVERTIDO, con la medicion que lo descarta. Implementado el
  # desbordamiento —medio hueco por cada lado con vecino, +0.55 in por bloque
  # con `canvas_gap_grupos = 0.85` y una fila de 0.65— los truncados bajaban de
  # **10 a 6**… **y aparecia el solape que este cupo existe para evitar**: en la
  # lamina 25 tres enunciados escritos unos encima de otros, y en la 69 dos.
  #
  # LA CAUSA DEL FALLO, y es la parte que hay que recordar: **los dos ajustes se
  # retroalimentan**. `.titulo_grupo_size_que_cabe()` decide el cuerpo con el
  # alto disponible, y el cupo decide las lineas con ese mismo alto. Al sumarle
  # el hueco, el primero deja de necesitar encoger —vuelve a 14 pt— y entonces
  # el segundo autoriza diez lineas que a 14 pt miden 1.67 in en un sitio de
  # 1.35. Cada cuenta es correcta por separado y juntas se pasan.
  #
  # Quien lo reintente tiene que resolver ESO primero: decidir cuerpo y lineas
  # en una sola pasada, no en dos que se alimentan. Medido sobre `p49.pptx`
  # contra `p48.pptx`.
  #
  # UNIFICADAS LAS DOS CUENTAS, Y SIGUE SOLAPANDO. Segundo intento, tambien
  # revertido: `.titulo_grupo_ajuste()` decidia cuerpo y lineas en una pasada
  # —para cada cuerpo candidato envolvia, contaba lineas reales y comprobaba que
  # cupieran— con el invariante «lo autorizado cabe» probado sobre un barrido de
  # altos. Los truncados bajaron de **10 a CERO**, igual que el aprobado… y el
  # render seguia con enunciados encima unos de otros en las laminas 25, 38 y 69.
  #
  # POR QUE, y es lo que hay que resolver antes de un tercer intento: el alto
  # que se le pasaba era una ESTIMACION —`n_cat * alto_fila + medio hueco`— y el
  # texto se dibuja centrado en `mean(y_min, y_max)` del bloque, que son los
  # centros de la primera y la ultima categoria, NO sus bordes. Dos bloques
  # vecinos de distinto numero de filas no tienen sus centros equidistantes del
  # hueco que comparten, asi que «media parte para cada uno» no reparte el
  # espacio real.
  #
  # LA VIA QUE QUEDA: usar la geometria REAL que el graficador ya tiene en
  # `group_df$y_min` / `$y_max` —la distancia entre el centro de este bloque y
  # el del vecino— y no dejar que el texto pase de la mitad de esa distancia.
  # Nada de estimar el alto a partir del numero de filas.
  #
  # Y el coste tambien subio: la corrida paso de 154 s a 384 s, porque cada
  # bloque prueba sus candidatos. Habra que memoizar tambien la cuenta de lineas
  # por `(texto, pt)`.
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
# Cache del envoltorio. `.barras_wrap_titulo_grupo()` es una funcion PURA de sus
# argumentos y cada llamada baja de uno en uno midiendo con `grid::textGrob`, que
# es lo caro. Sin cache, el mismo enunciado se mide una y otra vez: una por cada
# cuerpo candidato que prueba `.titulo_grupo_size_que_cabe()`, otra al envolver
# de verdad, y todas otra vez en la pasada de Word.
#
# Medido sobre el mazo de Conta: sin cache la corrida pasaba de ~235 s a
# **1.054 s** —PPT 347, Word 707—. Es el mismo `(texto, columna, ancho, cuerpo,
# tipografia)` repetido, asi que memorizarlo no cambia ni un pixel.
.BARRAS_WRAP_CACHE <- new.env(parent = emptyenv())

.barras_wrap_titulo_grupo <- function(texto, w_npc, ancho_in, size_pt,
                                      family = "", minimo = 10L) {
  clave <- paste(texto, w_npc, ancho_in, size_pt, family, minimo, sep = "\r")
  if (!is.null(hit <- .BARRAS_WRAP_CACHE[[clave]])) return(hit)
  out <- .barras_wrap_titulo_grupo_calc(texto, w_npc, ancho_in, size_pt,
                                        family = family, minimo = minimo)
  assign(clave, out, envir = .BARRAS_WRAP_CACHE)
  out
}

.barras_wrap_titulo_grupo_calc <- function(texto, w_npc, ancho_in, size_pt,
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
