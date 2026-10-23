# =============================================================================
# reporte_word_escala_fijados.R — lo que el recetario fija en la escala apilada del Word, en UNA fuente
# =============================================================================
#
# `.word_g_escala()` redibuja la escala del Word desde la espec (`preparar_escala()`): sólo los args que entran en la espec
# (colores, decimales, redondeo, box pedido, orden, inversiones, categorías en cero) llegan al documento. El resto —tamaños
# de texto, leyenda, envoltura de rótulos, grosor, alto, columna del box, semáforo— lo fija el recetario y el editor de
# ajustes Word no debe ofrecerlo como si mandara (C5). Las constantes de aquí las leen tanto el renderer como el payload
# de `/presets-metadata` (`word_fijado`), así que lo que la UI dice que sale es lo que sale: cambiar un valor aquí cambia
# los dos; cambiarlo en el renderer sin pasar por aquí rompe `test-graficos-metadata-word-fijado.R`.
#
# Excepción: si el gráfico no trae espec del recetario o el renderer falla, `.word_grafico()` cae a `.word_g_marco()` y el
# ggplot del motor va tal cual, con estos args aplicados. El motivo de cada entrada lo dice.

#' Puntos tipográficos que pide la escala Word del recetario (antes de `.word_pt()`, que aplica el piso de 8 pt y el 0.95)
#' @keywords internal
.WORD_ESCALA_PT <- list(
  cifra_dentro = 9,     # cifra dentro del segmento
  cifra_chica  = 8,     # cifra de un segmento chico, encima con su guía
  rotulo_fila  = 9.5,   # rótulo de cada fila (eje y)
  box_cifra    = 10,    # cifra de la columna Top/Bottom Two Box
  box_rotulo   = 7.5,   # rótulo de la columna Top/Bottom Two Box
  leyenda      = 8,     # texto de la leyenda (va directo al tema, sin `.word_pt()`)
  leyenda_clave = 8     # lado del cuadrito de la leyenda
)

#' Caracteres por línea del rótulo de fila (`strwrap(width = )`)
#'
#' N7 (Renzo, Arte, 2026-10-22): con 22 los enunciados largos salían en 7-8 líneas y la figura «absurdamente alta»; la
#' columna de etiquetas es ahora más ancha (42) y las barras algo más cortas.
#' @keywords internal
.WORD_ESCALA_ENVOLTURA <- 42L

#' Tope de líneas de un rótulo de fila; si el enunciado lo supera se ensancha la envoltura hasta `.WORD_ESCALA_ENVOLTURA_MAX`
#' @keywords internal
.WORD_ESCALA_LINEAS_MAX <- 4L

#' Envoltura máxima (caracteres) de la columna de etiquetas: lo que `.word_rotulo_in()` (tope 3,3 in) alcanza a reservar
#' @keywords internal
.WORD_ESCALA_ENVOLTURA_MAX <- 48L

#' Porcentaje del segmento desde el que la cifra va dentro; por debajo va encima con su guía (nunca se oculta)
#' @keywords internal
.WORD_ESCALA_CABE_PCT <- 7

# La leyenda ya no se parte por suma de caracteres (antes, 90): la mide `.word_leyenda_plan()` contra el ancho de la
# figura con el modo de Identidad › Letra (leyenda_plan.R, O8b).

#' Presets del editor cuya figura Word dibuja `.word_g_escala()` (verificado por renderer real: las apiladas simples y los
#' bloques multiapilados, también multiactor, cuelgan espec `escala`)
#' @keywords internal
.WORD_ESCALA_PRESETS <- c("barras_apiladas", "multi_apiladas", "multi_apiladas_multiactor")

#' Tamaño efectivo en pt de un texto de la escala Word (lo que de verdad sale tras `.word_pt()`)
#' @keywords internal
.word_escala_pt_efectivo <- function(clave) .word_pt(.WORD_ESCALA_PT[[clave]]) * ggplot2::.pt

#' Args que la escala Word del recetario fija o ignora, con el valor que realmente sale
#'
#' Forma de cada entrada: `list(arg, valor, unidad, motivo, aplica_si_marco)`. `valor` (y `unidad`) faltan cuando el arg
#' no tiene valor equivalente en el Word: el recetario no lo usa (p. ej. los umbrales del semáforo). `aplica_si_marco`
#' es siempre TRUE: si el gráfico cae al marco, el arg vuelve a mandar.
#' @return list de entradas.
#' @keywords internal
.word_escala_fijados <- function() {
  ap <- .std_word("figura", "alto_apilada")
  navy <- .std_word("colores", "titulos")
  marco <- " Si el gráfico cae al marco (si el tipo no tiene diseño propio o su dibujo falla), este ajuste sí aplica."
  e <- function(arg, detalle, valor = NULL, unidad = NULL) {
    x <- list(arg = arg)
    if (!is.null(valor)) x$valor <- valor
    if (!is.null(unidad)) x$unidad <- unidad
    x$motivo <- paste0("Fijo por diseño en el Word: ", detalle, ".", marco)
    x$aplica_si_marco <- TRUE
    x
  }
  pt <- .word_escala_pt_efectivo
  cabe <- .WORD_ESCALA_CABE_PCT / 100
  list(
    # Leyenda
    e("size_leyenda", "la leyenda va a 8 pt", .WORD_ESCALA_PT$leyenda, "pt"),
    e("legend_key_cm", "el cuadrito de la leyenda mide 8 pt", round(.WORD_ESCALA_PT$leyenda_clave * 2.54 / 72.27, 3), "cm"),   # «pt» de grid: 1/72.27 in
    e("leyenda_posicion", "la leyenda va abajo", "abajo"),
    e("mostrar_leyenda", "la leyenda siempre se muestra", TRUE),
    e("legend_n_por_fila", "la leyenda va en una fila si cabe a lo ancho de la figura y, si no, en filas equilibradas; se cambia en Identidad, Letra"),
    # Cifras de los segmentos
    e("size_texto_barras", "la cifra dentro del segmento sale a ese tamaño", pt("cifra_dentro"), "pt"),
    e("size_texto_barras_peq", "la cifra de un segmento chico sale a ese tamaño", pt("cifra_chica"), "pt"),
    e("color_texto_barras", "el color de la cifra se elige por contraste con su segmento"),
    e("color_texto_barras_fuera", "la cifra encima de un segmento chico va en el azul de títulos", navy),
    e("mostrar_valores", "todas las cifras se escriben", TRUE),
    e("mostrar_n_en_etiquetas", "la cifra va sin frecuencia", FALSE),
    e("textos_negrita", "la negrita de cifras, rótulos, box y leyenda se elige para todo el informe en Identidad, Letra"),
    e("umbral_ocultar_etiqueta", "ninguna cifra se oculta", 0, "proporción"),
    e("umbral_mostrar_etiqueta", paste0("la cifra va dentro desde el ", .WORD_ESCALA_CABE_PCT, " % y encima por debajo"), cabe, "proporción"),
    e("umbral_etiqueta_normal", paste0("la cifra va dentro desde el ", .WORD_ESCALA_CABE_PCT, " % y encima por debajo"), cabe, "proporción"),
    # Rótulos de fila
    e("size_ejes", "el rótulo de cada fila sale a ese tamaño", pt("rotulo_fila"), "pt"),
    e("ancho_max_eje_y", paste0("el rótulo de fila se parte a ", .WORD_ESCALA_ENVOLTURA, " caracteres"), .WORD_ESCALA_ENVOLTURA, "caracteres"),
    # Columna Top/Bottom Two Box
    e("size_barra_extra", "la cifra del Top Two Box sale a ese tamaño", pt("box_cifra"), "pt"),
    e("size_titulo_extra", "el rótulo del Top Two Box sale a ese tamaño", pt("box_rotulo"), "pt"),
    e("color_barra_extra", "la cifra del Top Two Box va siempre en verde", .std_color("verde_top_two_box")),
    e("titulo_barra_extra", "el rótulo de la columna es el estándar (Top Two Box, Top Three Box o Bottom Two Box)"),
    e("prefijo_barra_extra", "la cifra del box va sin prefijo"),
    e("barra_extra_semaforo", "la cifra del Top Two Box no usa semáforo", FALSE),
    e("barra_extra_umbral_alto", "sin semáforo en el Word, el umbral verde no tiene efecto"),
    e("barra_extra_umbral_medio", "sin semáforo en el Word, el umbral ámbar no tiene efecto"),
    # Geometría
    e("grosor_barras", "la barra ocupa esa fracción de su fila", ap$grosor_fraccion %||% 0.58, "proporción"),
    e("grosor_modo", "el grosor es el fijo del estándar"),
    e("grosor_barras_mult", "el grosor es el fijo del estándar"),
    e("alto_por_categoria", paste0("cada fila suma esa altura a una base de ", ap$base, " in"), ap$por_fila, "pulgadas")
  )
}

#' `word_fijado` de un preset del editor: la lista de `.word_escala_fijados()` si su Word lo dibuja la escala, o NULL
#' @keywords internal
.word_fijado_de_preset <- function(nombre) {
  if (nombre %in% .WORD_ESCALA_PRESETS) .word_escala_fijados() else NULL
}
